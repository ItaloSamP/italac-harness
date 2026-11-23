#!/usr/bin/env node
// Unified Agent & Operator CLI for Harness Hub.
// Usage:
//   node scripts/hub.mjs serve   [--port 7331] [--open] [--root <path>]
//   node scripts/hub.mjs queue   [--agent <@agent>] [--bucket build|review|commit] [--json] [--root <path>]
//   node scripts/hub.mjs claim   <taskId> --agent <agent> [--ai <engine> | --engine <engine>] [--json] [--root <path>]
//   node scripts/hub.mjs release <taskId> [--agent <agent>] [--force] [--reason <text>] [--json] [--root <path>]
//   node scripts/hub.mjs status  [--json] [--root <path>]
//   node scripts/hub.mjs sync    [--check] [--dry-run] [--force] [--platform <id>] [--json] [--root <path>]
//   node scripts/hub.mjs --help

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdaptersStatus, PLATFORMS, syncAdapters } from '../hub/lib/adapters.mjs';
import { createStore, StoreError } from '../hub/lib/store.mjs';
import { createServer } from '../hub/server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_ROOT = resolve(__dirname, '..');
const DEFAULT_PORT = 7331;
const VALID_BUCKETS = new Set(['build', 'review', 'commit']);
const VALID_PLATFORMS = new Set(['all', ...PLATFORMS.map((p) => p.id)]);

function printHelp() {
  console.log(
    [
      'Harness Hub CLI — Local Visual Hub, Atomic Queue & Multi-AI Sync',
      '',
      'Usage:',
      '  node scripts/hub.mjs serve   [--port 7331] [--open] [--root <path>]',
      '  node scripts/hub.mjs queue   [--agent <@agent>] [--bucket build|review|commit] [--json] [--root <path>]',
      '  node scripts/hub.mjs claim   <taskId> --agent <agent> [--ai <engine>] [--json] [--root <path>]',
      '  node scripts/hub.mjs release <taskId> [--agent <agent>] [--force] [--reason <text>] [--json] [--root <path>]',
      '  node scripts/hub.mjs status  [--json] [--root <path>]',
      '  node scripts/hub.mjs sync    [--check] [--dry-run] [--force] [--platform all|antigravity|codex|cursor] [--json] [--root <path>]',
      '  node scripts/hub.mjs --help',
      '',
      'Exit codes:',
      '  0  Success (or all adapters in parity on sync --check)',
      '  1  Validation error, missing task, or adapter drift on --check',
      '  2  Conflict (task already claimed, lock owner mismatch, or manual edit overwrite without --force)',
    ].join('\n'),
  );
}

function normalizeAgent(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

function openBrowser(url) {
  try {
    let cmd;
    let args;
    if (process.platform === 'win32') {
      cmd = 'rundll32';
      args = ['url.dll,FileProtocolHandler', url];
    } else if (process.platform === 'darwin') {
      cmd = 'open';
      args = [url];
    } else {
      cmd = 'xdg-open';
      args = [url];
    }
    const child = spawn(cmd, args, {
      detached: true,
      shell: false,
      stdio: 'ignore',
    });
    child.on('error', () => {});
    child.unref();
  } catch {
    // Non-fatal: URL is already printed to stdout
  }
}

function parseFlags(argv) {
  const positionals = [];
  const flags = {
    root: DEFAULT_ROOT,
    port: undefined,
    open: false,
    noOpen: false,
    agent: null,
    bucket: null,
    engine: null,
    force: false,
    reason: null,
    check: false,
    dryRun: false,
    platforms: [],
    json: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg === '--json') {
      flags.json = true;
    } else if (arg === '--open') {
      flags.open = true;
    } else if (arg === '--no-open') {
      flags.noOpen = true;
    } else if (arg === '--force' || arg === '--confirm-overwrite') {
      flags.force = true;
    } else if (arg === '--check') {
      flags.check = true;
    } else if (arg === '--dry-run') {
      flags.dryRun = true;
    } else if (arg === '--root') {
      const val = argv[++i];
      if (!val) throw new Error('--root requires a directory path');
      flags.root = resolve(val);
    } else if (arg === '--port') {
      const val = argv[++i];
      if (!val || !/^\d+$/.test(val)) throw new Error('--port requires an integer');
      flags.port = Number(val);
    } else if (arg === '--agent') {
      const val = argv[++i];
      if (!val) throw new Error('--agent requires an agent name');
      flags.agent = normalizeAgent(val);
    } else if (arg === '--bucket') {
      const val = argv[++i];
      if (!val || !VALID_BUCKETS.has(val)) {
        throw new Error(`Invalid --bucket "${val || ''}". Use: build, review, commit`);
      }
      flags.bucket = val;
    } else if (arg === '--ai' || arg === '--engine') {
      const val = argv[++i];
      if (!val) throw new Error(`${arg} requires an engine name`);
      flags.engine = val.trim();
    } else if (arg === '--reason') {
      const val = argv[++i];
      if (!val) throw new Error('--reason requires a message');
      flags.reason = val;
    } else if (arg === '--platform' || arg === '--targets') {
      const val = argv[++i];
      if (!val) throw new Error(`${arg} requires a platform name`);
      for (const item of val.split(',').map((s) => s.trim()).filter(Boolean)) {
        if (!VALID_PLATFORMS.has(item)) {
          throw new Error(`Invalid platform "${item}". Valid: ${[...VALID_PLATFORMS].join(', ')}`);
        }
        flags.platforms.push(item);
      }
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  return { positionals, flags };
}

async function cmdServe(flags) {
  const port = flags.port !== undefined ? flags.port : Number(process.env.PORT || DEFAULT_PORT);
  const hub = createServer({ rootDir: flags.root, port });
  const info = await hub.start();

  console.log('Harness Hub Server');
  console.log(`  URL:  ${info.url}`);
  console.log(`  Root: ${flags.root}`);
  console.log('  Press Ctrl+C to stop.');

  if (flags.open && !flags.noOpen) {
    openBrowser(info.url);
  }

  const shutdown = async () => {
    console.log('\nShutting down Harness Hub...');
    await hub.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function cmdQueue(flags) {
  const store = createStore(flags.root);
  store.cleanupStaleLocks();
  const raw = store.getQueue({ agent: flags.agent });
  const queue = flags.bucket
    ? {
        eligible: raw.eligible.filter((i) => i.kind === flags.bucket),
        ineligible: raw.ineligible.filter((i) => i.kind === flags.bucket),
      }
    : raw;

  if (flags.json) {
    console.log(JSON.stringify(queue, null, 2));
    return 0;
  }

  console.log(
    `Demand Queue (${queue.eligible.length} eligible, ${queue.ineligible.length} ineligible)` +
      (flags.agent ? ` · agent=${flags.agent}` : '') +
      (flags.bucket ? ` · bucket=${flags.bucket}` : ''),
  );

  if (queue.eligible.length > 0) {
    console.log('\nEligible:');
    for (const item of queue.eligible) {
      const nextTag = item.isNext ? ' [NEXT]' : '';
      console.log(
        `  ${item.priority} | ${item.kind.padEnd(6)} | ${(item.targetAgent || '-').padEnd(16)} | ${item.taskId}${nextTag} — ${item.title}`,
      );
    }
  } else {
    console.log('\nEligible: (none)');
  }

  if (queue.ineligible.length > 0) {
    console.log('\nIneligible:');
    for (const item of queue.ineligible) {
      console.log(
        `  ${item.priority} | ${item.kind.padEnd(6)} | ${(item.targetAgent || '-').padEnd(16)} | ${item.taskId} — ${item.reason}`,
      );
    }
  }
  return 0;
}

function cmdClaim(positionals, flags) {
  const taskId = positionals[0];
  if (!taskId) {
    throw new Error('claim requires <taskId>');
  }
  if (!flags.agent) {
    throw new Error('claim requires --agent <@agent>');
  }

  const store = createStore(flags.root);
  store.cleanupStaleLocks();
  const board = store.readBoard();
  const engine = flags.engine || board.config.defaultEngine || 'mock';
  const result = store.claimTask(taskId, { agent: flags.agent, engine });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `Claimed ${taskId} as ${flags.agent} (engine=${engine}, status=${result.task.status})`,
    );
  }
  return 0;
}

function cmdRelease(positionals, flags) {
  const taskId = positionals[0];
  if (!taskId) {
    throw new Error('release requires <taskId>');
  }

  const store = createStore(flags.root);
  const result = store.releaseClaim(taskId, {
    agent: flags.agent,
    force: flags.force,
    reason: flags.reason,
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      result.released
        ? `Released lock on ${taskId} (status=${result.task.status})`
        : `No active lock on ${taskId} (status=${result.task.status})`,
    );
  }
  return 0;
}

function cmdStatus(flags) {
  const store = createStore(flags.root);
  store.cleanupStaleLocks();
  const state = store.getState();
  const adapters = getAdaptersStatus(flags.root, { skipCliCheck: true });

  const byStatus = {};
  let activeLocks = 0;
  for (const t of state.tasks) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    if (t.lock) activeLocks += 1;
  }

  const summary = {
    repoRoot: state.repoRoot,
    tasksTotal: state.tasks.length,
    byStatus,
    queueEligible: state.queue.eligible.length,
    queueIneligible: state.queue.ineligible.length,
    activeLocks,
    openIncidents: state.incidents.open.length,
    gatesCount: state.gates.length,
    adapters: {
      inParityCount: adapters.inParityCount,
      total: adapters.total,
      canonicalHash: adapters.canonicalHash,
    },
    config: state.config,
  };

  if (flags.json) {
    console.log(JSON.stringify(summary, null, 2));
    return 0;
  }

  const statusLine =
    Object.entries(byStatus)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ') || 'none';

  console.log(`Harness Hub Status (${state.repoRoot})`);
  console.log(`  Tasks:     ${state.tasks.length} (${statusLine})`);
  console.log(`  Queue:     ${state.queue.eligible.length} eligible, ${state.queue.ineligible.length} ineligible`);
  console.log(`  Locks:     ${activeLocks} active`);
  console.log(`  Incidents: ${state.incidents.open.length} open (${state.incidents.fixedCount} fixed)`);
  console.log(`  Gates:     ${state.gates.length} configured`);
  console.log(`  Adapters:  ${adapters.inParityCount}/${adapters.total} in parity`);
  return 0;
}

function cmdSync(flags) {
  const targetArg =
    flags.platforms.length === 0 || flags.platforms.includes('all') ? 'all' : flags.platforms;

  if (flags.check) {
    const status = getAdaptersStatus(flags.root, { skipCliCheck: true });
    const checked =
      targetArg === 'all'
        ? status.platforms
        : status.platforms.filter((p) => targetArg.includes(p.id));
    const allSynced = checked.every((p) => p.status === 'synced');

    if (flags.json) {
      console.log(JSON.stringify({ ok: allSynced, status }, null, 2));
    } else {
      console.log(
        `Multi-AI Parity: ${status.inParityCount}/${status.total} synced (promptAmplifier=${status.promptAmplifierIncluded ? 'included' : 'missing'})`,
      );
      for (const p of checked) {
        const manual = p.manuallyEdited ? ' [MANUALLY EDITED]' : '';
        console.log(`  [${p.status.toUpperCase().padEnd(7)}] ${p.id.padEnd(11)} -> ${p.targetPath}${manual}`);
      }
    }
    return allSynced ? 0 : 1;
  }

  const result = syncAdapters(flags.root, {
    targets: targetArg,
    dryRun: flags.dryRun,
    force: flags.force,
    skipCliCheck: true,
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.error === 'CONFIRM_OVERWRITE') {
    console.error(`Conflict: ${result.message}`);
    console.error(`Files: ${result.overwriteManual.join(', ')}`);
    console.error('Re-run with --force to overwrite manually edited projections.');
  } else if (flags.dryRun) {
    console.log('Dry-run preview:');
    console.log(`  create:    ${result.preview.create.join(', ') || '(none)'}`);
    console.log(`  update:    ${result.preview.update.join(', ') || '(none)'}`);
    console.log(`  overwrite: ${result.preview.overwriteManual.join(', ') || '(none)'}`);
    console.log(`  unchanged: ${result.preview.unchanged.join(', ') || '(none)'}`);
  } else {
    console.log(
      `Synced ${result.written.length} file(s), ${result.unchanged.length} unchanged (${result.status.inParityCount}/${result.status.total} in parity).`,
    );
    if (result.validator && !result.validator.skipped) {
      console.log(`Validator: ${result.validator.pass ? 'PASS' : 'FAIL'}`);
    }
  }

  if (result.error === 'CONFIRM_OVERWRITE') return 2;
  return result.ok ? 0 : 1;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0 || rawArgs[0] === '--help' || rawArgs[0] === '-h' || rawArgs[0] === 'help') {
    printHelp();
    process.exit(0);
  }

  const subcommand = rawArgs[0];
  let parsed;
  try {
    parsed = parseFlags(rawArgs.slice(1));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  if (parsed.flags.help) {
    printHelp();
    process.exit(0);
  }

  try {
    switch (subcommand) {
      case 'serve':
        await cmdServe(parsed.flags);
        return;
      case 'queue':
        process.exit(cmdQueue(parsed.flags));
        return;
      case 'claim':
        process.exit(cmdClaim(parsed.positionals, parsed.flags));
        return;
      case 'release':
        process.exit(cmdRelease(parsed.positionals, parsed.flags));
        return;
      case 'status':
        process.exit(cmdStatus(parsed.flags));
        return;
      case 'sync':
        process.exit(cmdSync(parsed.flags));
        return;
      default:
        console.error(`Unknown subcommand: "${subcommand}". Run "node scripts/hub.mjs --help".`);
        process.exit(1);
    }
  } catch (err) {
    const isConflict =
      (err instanceof StoreError && err.statusCode === 409) ||
      err?.statusCode === 409 ||
      err?.code === 'ALREADY_CLAIMED' ||
      err?.code === 'LOCK_NOT_OWNER' ||
      err?.code === 'FILE_CONFLICT';

    if (parsed.flags.json) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            error: err?.code || 'ERROR',
            message: err?.message || String(err),
          },
          null,
          2,
        ),
      );
    } else {
      console.error(`Error: ${err?.message || String(err)}`);
    }
    process.exit(isConflict ? 2 : 1);
  }
}

await main();
