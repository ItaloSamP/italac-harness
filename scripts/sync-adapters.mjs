#!/usr/bin/env node
// Standalone Multi-AI canonical projection sync & drift checker CLI.
// Usage: node scripts/sync-adapters.mjs [--platform all|antigravity|codex|cursor] [--check] [--dry-run] [--force] [--json] [--root <path>]
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAdaptersStatus, PLATFORMS, syncAdapters } from '../hub/lib/adapters.mjs';

const VALID_PLATFORM_ARGS = new Set(['all', ...PLATFORMS.map((p) => p.id)]);

function printUsage() {
  console.log(
    [
      'Usage: node scripts/sync-adapters.mjs [options]',
      '',
      'Options:',
      '  --platform <id>     Target platform(s): all | antigravity | codex | cursor (comma-separated or repeated)',
      '  --check             Verify parity without writing (exit 0 if synced, 1 if drifted/missing)',
      '  --dry-run           Preview files to create/update/overwrite without writing',
      '  --force             Overwrite manually edited projections (Level C confirmation)',
      '  --json              Emit machine-readable JSON output',
      '  --root <path>       Repository root directory (default: repo root)',
      '  -h, --help          Show this help message',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const opts = {
    root: defaultRoot,
    platforms: [],
    check: false,
    dryRun: false,
    force: false,
    json: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--check') {
      opts.check = true;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--force' || arg === '--confirm-overwrite') {
      opts.force = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--root') {
      const val = argv[++i];
      if (!val) throw new Error('--root requires a directory path');
      opts.root = resolve(val);
    } else if (arg === '--platform' || arg === '--targets') {
      const val = argv[++i];
      if (!val) throw new Error(`${arg} requires a platform name`);
      for (const item of val.split(',').map((s) => s.trim()).filter(Boolean)) {
        if (!VALID_PLATFORM_ARGS.has(item)) {
          throw new Error(`Invalid platform "${item}". Valid: ${[...VALID_PLATFORM_ARGS].join(', ')}`);
        }
        opts.platforms.push(item);
      }
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return opts;
}

function formatStatusReport(status, selectedIds) {
  const lines = [
    `Multi-AI Adapters Parity: ${status.inParityCount}/${status.total} synced · rules: ${status.ruleCount} · promptAmplifier: ${status.promptAmplifierIncluded ? 'included' : 'MISSING'}`,
    `Canonical SHA-256: ${status.canonicalHash}`,
  ];
  for (const p of status.platforms) {
    if (selectedIds && !selectedIds.includes(p.id)) continue;
    const tag = p.status.toUpperCase().padEnd(7);
    const manual = p.manuallyEdited ? ' [MANUALLY EDITED]' : '';
    lines.push(`  [${tag}] ${p.id.padEnd(11)} -> ${p.targetPath}${manual} (${p.reason})`);
  }
  return lines.join('\n');
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  if (opts.help) {
    printUsage();
    process.exit(0);
  }

  const targetArg = opts.platforms.length === 0 || opts.platforms.includes('all') ? 'all' : opts.platforms;

  if (opts.check) {
    const status = getAdaptersStatus(opts.root, { skipCliCheck: true });
    const checkedPlatforms =
      targetArg === 'all'
        ? status.platforms
        : status.platforms.filter((p) => targetArg.includes(p.id));
    const allSynced = checkedPlatforms.every((p) => p.status === 'synced');

    if (opts.json) {
      console.log(JSON.stringify({ ok: allSynced, status }, null, 2));
    } else {
      console.log(formatStatusReport(status, targetArg === 'all' ? null : targetArg));
    }
    process.exit(allSynced ? 0 : 1);
  }

  const result = syncAdapters(opts.root, {
    targets: targetArg,
    dryRun: opts.dryRun,
    confirmOverwrite: opts.force,
    skipCliCheck: true,
  });

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.error === 'CONFIRM_OVERWRITE') {
    console.error(`CONFLICT: ${result.message}`);
    for (const file of result.overwriteManual) {
      console.error(`  - ${file} (use --force to overwrite)`);
    }
  } else if (opts.dryRun) {
    console.log('Dry-run preview:');
    console.log(`  create:          ${result.preview.create.join(', ') || '(none)'}`);
    console.log(`  update:          ${result.preview.update.join(', ') || '(none)'}`);
    console.log(`  overwriteManual: ${result.preview.overwriteManual.join(', ') || '(none)'}`);
    console.log(`  unchanged:       ${result.preview.unchanged.join(', ') || '(none)'}`);
  } else {
    console.log(formatStatusReport(result.status, null));
    console.log(`Written: ${result.written.length} file(s)${result.written.length ? ` (${result.written.join(', ')})` : ''}`);
    if (result.validator && !result.validator.skipped) {
      console.log(`Validator: ${result.validator.pass ? 'PASS' : 'FAIL'} (${result.validator.errors} errors, ${result.validator.warnings} warnings)`);
    }
  }

  if (result.error === 'CONFIRM_OVERWRITE') {
    process.exit(2);
  }
  process.exit(result.ok ? 0 : 1);
}

main();
