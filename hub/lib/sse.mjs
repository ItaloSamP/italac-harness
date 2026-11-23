import { randomBytes } from 'node:crypto';

const DEFAULT_HEARTBEAT_MS = 15_000;

/**
 * Creates a lightweight Server-Sent Events (SSE) hub for broadcasting
 * live state updates and runner logs to connected HTTP clients.
 *
 * @param {{ heartbeatMs?: number }} [options]
 */
export function createSseHub(options = {}) {
  const heartbeatMs =
    typeof options.heartbeatMs === 'number' && options.heartbeatMs > 0
      ? options.heartbeatMs
      : DEFAULT_HEARTBEAT_MS;

  /** @type {Map<string, { id: string, res: import('node:http').ServerResponse, cleanup: () => void }>} */
  const clients = new Map();

  let heartbeatTimer = null;

  function formatFrame(event, data) {
    const safeEvent = String(event || 'message').replace(/[\r\n]+/g, ' ').trim();
    const payload = JSON.stringify(data ?? {});
    return `event: ${safeEvent}\ndata: ${payload}\n\n`;
  }

  function removeClient(clientId) {
    const entry = clients.get(clientId);
    if (!entry) return;
    clients.delete(clientId);
    entry.cleanup();
    if (clients.size === 0 && heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function safeWrite(clientId, chunk) {
    const entry = clients.get(clientId);
    if (!entry) return false;
    const { res } = entry;
    if (res.writableEnded || res.destroyed) {
      removeClient(clientId);
      return false;
    }
    try {
      res.write(chunk);
      return true;
    } catch {
      removeClient(clientId);
      return false;
    }
  }

  function ensureHeartbeat() {
    if (heartbeatTimer || clients.size === 0) return;
    heartbeatTimer = setInterval(() => {
      for (const clientId of Array.from(clients.keys())) {
        safeWrite(clientId, ':heartbeat\n\n');
      }
    }, heartbeatMs);
    if (typeof heartbeatTimer.unref === 'function') {
      heartbeatTimer.unref();
    }
  }

  /**
   * Registers an HTTP request/response pair as an active SSE stream.
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  function addClient(req, res) {
    const clientId = `sse-${randomBytes(4).toString('hex')}`;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const onDisconnect = () => removeClient(clientId);

    const cleanup = () => {
      req?.off?.('close', onDisconnect);
      req?.off?.('error', onDisconnect);
      res?.off?.('close', onDisconnect);
      res?.off?.('error', onDisconnect);
    };

    req?.on?.('close', onDisconnect);
    req?.on?.('error', onDisconnect);
    res?.on?.('close', onDisconnect);
    res?.on?.('error', onDisconnect);

    clients.set(clientId, { id: clientId, res, cleanup });
    ensureHeartbeat();

    safeWrite(
      clientId,
      formatFrame('connected', {
        ts: new Date().toISOString(),
        clientId,
      })
    );

    return {
      clientId,
      close() {
        removeClient(clientId);
        if (!res.writableEnded && !res.destroyed) {
          try {
            res.end();
          } catch {
            // ignore close errors
          }
        }
      },
    };
  }

  /**
   * Broadcasts an event to all currently connected SSE clients.
   * @param {string} event
   * @param {unknown} data
   */
  function broadcast(event, data) {
    if (clients.size === 0) return 0;
    const frame = formatFrame(event, data);
    let delivered = 0;
    for (const clientId of Array.from(clients.keys())) {
      if (safeWrite(clientId, frame)) {
        delivered += 1;
      }
    }
    return delivered;
  }

  /**
   * Gracefully closes all active SSE streams and stops the heartbeat timer.
   */
  function closeAll() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    for (const [clientId, entry] of Array.from(clients.entries())) {
      clients.delete(clientId);
      entry.cleanup();
      if (!entry.res.writableEnded && !entry.res.destroyed) {
        try {
          entry.res.end();
        } catch {
          // ignore close errors
        }
      }
    }
  }

  function clientCount() {
    return clients.size;
  }

  return {
    addClient,
    broadcast,
    closeAll,
    clientCount,
  };
}
