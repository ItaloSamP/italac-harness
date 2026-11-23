/**
 * Harness Hub — HTTP API Client & SSE Event Stream
 * Vanilla ES Module — Zero dependencies.
 */

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN', details = null, payload = null } = {}) {
    super(message || 'Erro na requisição');
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.payload = payload;
  }
}

async function request(path, options = {}) {
  const { method = 'GET', body = undefined, signal = undefined } = options;
  const headers = { Accept: 'application/json' };
  const init = { method, headers, signal };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, init);
  } catch (err) {
    throw new ApiError('Sem conexão com o servidor local do italac-harness (127.0.0.1).', {
      status: 0,
      code: 'NETWORK_ERROR',
      details: err?.message || String(err),
    });
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const code = data?.error || data?.code || `HTTP_${res.status}`;
    const message = data?.message || data?.error || `Erro HTTP ${res.status}`;
    throw new ApiError(message, {
      status: res.status,
      code,
      details: data?.details ?? null,
      payload: data,
    });
  }

  return data;
}

export const api = {
  getState() {
    return request('/api/state');
  },

  createTask(payload) {
    return request('/api/tasks', { method: 'POST', body: payload });
  },

  updateTask(id, payload) {
    return request(`/api/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload });
  },

  moveTask(id, payload) {
    return request(`/api/tasks/${encodeURIComponent(id)}/move`, { method: 'POST', body: payload });
  },

  unblockTask(id, payload = {}) {
    return request(`/api/tasks/${encodeURIComponent(id)}/unblock`, { method: 'POST', body: payload });
  },

  claimTask(id, payload) {
    return request(`/api/tasks/${encodeURIComponent(id)}/claim`, { method: 'POST', body: payload });
  },

  releaseTask(id, payload = {}) {
    return request(`/api/tasks/${encodeURIComponent(id)}/release`, { method: 'POST', body: payload });
  },

  getQueue(agent = '') {
    const q = agent ? `?agent=${encodeURIComponent(agent)}` : '';
    return request(`/api/queue${q}`);
  },

  runTask(id, payload = {}) {
    return request(`/api/tasks/${encodeURIComponent(id)}/run`, { method: 'POST', body: payload });
  },

  stopRun(runId) {
    return request(`/api/runs/${encodeURIComponent(runId)}/stop`, { method: 'POST', body: {} });
  },

  getGithubIssues(repo = '') {
    const q = repo ? `?repo=${encodeURIComponent(repo)}` : '';
    return request(`/api/github/issues${q}`);
  },

  importGithubIssue(payload) {
    return request('/api/github/import', { method: 'POST', body: payload });
  },

  getAdaptersStatus() {
    return request('/api/adapters/status');
  },

  syncAdapters(payload = {}) {
    return request('/api/adapters/sync', { method: 'POST', body: payload });
  },

  runGates(only = null) {
    const body = only ? { only } : {};
    return request('/api/gates/run', { method: 'POST', body });
  },

  updateConfig(payload) {
    return request('/api/config', { method: 'PATCH', body: payload });
  },

  getCalendar({ workspace = '', month = '' } = {}) {
    const params = new URLSearchParams();
    if (workspace && workspace !== 'all') params.set('workspace', workspace);
    if (month) params.set('month', month);
    const qs = params.toString();
    return request(`/api/calendar${qs ? `?${qs}` : ''}`);
  },

  createCalendarEvent(payload) {
    return request('/api/calendar', { method: 'POST', body: payload });
  },

  updateCalendarEvent(id, payload) {
    return request(`/api/calendar/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload });
  },

  deleteCalendarEvent(id) {
    return request(`/api/calendar/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  promoteCalendarEvent(id, payload = { boardLane: 'scheduled' }) {
    return request(`/api/calendar/${encodeURIComponent(id)}/promote`, { method: 'POST', body: payload });
  },

  getWorkspaces() {
    return request('/api/workspaces');
  },

  createWorkspace(payload) {
    return request('/api/workspaces', { method: 'POST', body: payload });
  },

  selectWorkspace(id) {
    return request('/api/workspaces/select', { method: 'POST', body: { id } });
  },
};

const SSE_EVENTS = [
  'connected',
  'state:changed',
  'run:started',
  'run:step',
  'run:log',
  'run:finished',
  'run:stopped',
  'gate:updated',
  'adapter:updated',
  'calendar:updated',
  'workspace:changed',
  'watcher:error',
];

export class HubEventStream {
  constructor(url = '/api/events') {
    this.url = url;
    this.source = null;
    this.listeners = new Map();
    this.statusListeners = new Set();
    this.attempt = 0;
    this.retryTimer = null;
    this.closed = false;
    this.status = 'reconnecting';
    this.lastEventAt = null;
  }

  on(eventName, handler) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(handler);
    return () => this.listeners.get(eventName)?.delete(handler);
  }

  onStatus(handler) {
    this.statusListeners.add(handler);
    return () => this.statusListeners.delete(handler);
  }

  _setStatus(status) {
    this.status = status;
    for (const fn of this.statusListeners) {
      try { fn(status, this.lastEventAt); } catch { /* ignore */ }
    }
  }

  _emit(eventName, data) {
    this.lastEventAt = Date.now();
    const handlers = this.listeners.get(eventName);
    if (!handlers) return;
    for (const fn of handlers) {
      try { fn(data); } catch { /* ignore */ }
    }
  }

  connect() {
    this.closed = false;
    this._clearRetry();
    this._closeSource();
    this._setStatus(this.attempt === 0 ? 'reconnecting' : 'reconnecting');

    let es;
    try {
      es = new EventSource(this.url);
    } catch {
      this._scheduleReconnect();
      return;
    }

    this.source = es;

    es.onopen = () => {
      this.attempt = 0;
      this.lastEventAt = Date.now();
      this._setStatus('connected');
    };

    es.onerror = () => {
      this._closeSource();
      if (this.closed) return;
      this._setStatus(this.attempt >= 2 ? 'disconnected' : 'reconnecting');
      this._scheduleReconnect();
    };

    for (const evt of SSE_EVENTS) {
      es.addEventListener(evt, (e) => {
        let parsed = null;
        if (e.data) {
          try { parsed = JSON.parse(e.data); } catch { parsed = { raw: e.data }; }
        }
        if (evt === 'connected') {
          this.attempt = 0;
          this._setStatus('connected');
        }
        this._emit(evt, parsed);
      });
    }
  }

  reconnect() {
    this.attempt = 0;
    this.connect();
  }

  close() {
    this.closed = true;
    this._clearRetry();
    this._closeSource();
  }

  _closeSource() {
    if (this.source) {
      try { this.source.close(); } catch { /* ignore */ }
      this.source = null;
    }
  }

  _clearRetry() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  _scheduleReconnect() {
    if (this.closed) return;
    this._clearRetry();
    const delay = Math.min(15000, 1000 * Math.pow(2, this.attempt));
    this.attempt += 1;
    this.retryTimer = setTimeout(() => {
      if (!this.closed) this.connect();
    }, delay);
  }
}
