import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

export const SUPPORTED_ENGINES = Object.freeze([
  'mock',
  'claude',
  'codex',
  'cursor',
  'antigravity',
]);

const TASK_ID_RE = /^[a-z0-9][a-z0-9-]{0,120}$/;
const AGENT_NAME_RE = /^@?[a-z0-9][a-z0-9-]{0,60}$/;
const WINDOWS_ARG_LIMIT_BYTES = 24 * 1024;

const SECRET_PATTERNS = [
  /ghp_[A-Za-z0-9_]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /gho_[A-Za-z0-9_]{20,}/g,
  /ghs_[A-Za-z0-9_]{20,}/g,
  /sk-[A-Za-z0-9_-]{16,}/g,
  /(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi,
  /(token\s+)[A-Za-z0-9._~+/=-]{12,}/gi,
];

/**
 * Redacts known secret patterns and active environment tokens before
 * writing to log files or broadcasting via SSE (RN-09).
 *
 * @param {string} input
 * @param {string[]} [extraSecrets]
 * @returns {string}
 */
export function redactSecrets(input, extraSecrets = []) {
  let out = String(input ?? '');
  if (!out) return out;

  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match, prefix) =>
      typeof prefix === 'string' && prefix.length > 0 ? `${prefix}[REDACTED]` : '[REDACTED]'
    );
  }

  const runtimeSecrets = [process.env.GITHUB_TOKEN, ...extraSecrets].filter(
    (s) => typeof s === 'string' && s.trim().length >= 6
  );

  for (const secret of runtimeSecrets) {
    const trimmed = secret.trim();
    if (out.includes(trimmed)) {
      out = out.split(trimmed).join('[REDACTED]');
    }
  }

  return out;
}

function assertSafeTaskId(taskId) {
  if (typeof taskId !== 'string' || !TASK_ID_RE.test(taskId)) {
    const err = new Error(`Invalid taskId: "${String(taskId)}"`);
    err.code = 'INVALID_TASK_ID';
    err.statusCode = 400;
    throw err;
  }
}

function normalizeAgentName(agent) {
  if (typeof agent !== 'string' || !AGENT_NAME_RE.test(agent.trim())) {
    return '@developer';
  }
  const clean = agent.trim();
  return clean.startsWith('@') ? clean : `@${clean}`;
}

function ensurePathInside(baseDir, targetPath) {
  const resolvedBase = resolve(baseDir);
  const resolvedTarget = resolve(targetPath);
  if (
    resolvedTarget !== resolvedBase &&
    !resolvedTarget.startsWith(resolvedBase + sep)
  ) {
    const err = new Error('Path traversal rejected');
    err.code = 'PATH_TRAVERSAL';
    err.statusCode = 400;
    throw err;
  }
  return resolvedTarget;
}

function readAgentIdentity(rootDir, agent) {
  if (!rootDir) return null;
  const slug = normalizeAgentName(agent).slice(1);
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const agentsDir = resolve(rootDir, '.claude', 'agents');
  const candidate = ensurePathInside(agentsDir, join(agentsDir, `${slug}.md`));
  if (!existsSync(candidate)) return null;
  try {
    const content = readFileSync(candidate, 'utf8').trim();
    return content.slice(0, 1500);
  } catch {
    return null;
  }
}

function readTaskMarkdown(rootDir, taskId) {
  if (!rootDir || !TASK_ID_RE.test(taskId)) return null;
  const tasksDir = resolve(rootDir, '.specs', 'tasks');
  const candidate = ensurePathInside(tasksDir, join(tasksDir, `${taskId}.md`));
  if (!existsSync(candidate)) return null;
  try {
    return readFileSync(candidate, 'utf8');
  } catch {
    return null;
  }
}

function formatAcceptanceCriteria(acs) {
  if (!Array.isArray(acs) || acs.length === 0) {
    return '- (Nenhum critério explícito listado; validar conforme ## Problem e ## Proof)';
  }
  return acs
    .map((item) => {
      if (typeof item === 'string') return `- [ ] ${item}`;
      const mark = item.done ? 'x' : ' ';
      const ev = item.evidence ? ` — evidence: ${item.evidence}` : '';
      return `- [${mark}] ${item.text ?? ''}${ev}`;
    })
    .join('\n');
}

function formatList(items, emptyText) {
  if (!Array.isArray(items) || items.length === 0) return `- ${emptyText}`;
  return items.map((x) => `- ${x}`).join('\n');
}

/**
 * Builds the deterministic execution prompt embedding the 4-part
 * Prompt Amplifier model from `.claude/rules/80-prompt-amplifier.md`,
 * task details, assigned agent role, and mandatory safety guardrails.
 *
 * @param {object} task
 * @param {{ rootDir?: string, agent?: string, mode?: 'impl'|'verify', engine?: string }} [options]
 * @returns {string}
 */
export function buildExecutionPrompt(task, options = {}) {
  const {
    rootDir = null,
    agent = task?.meta?.assignee || '@developer',
    mode = 'impl',
    engine = 'mock',
  } = options;

  const normalizedAgent = normalizeAgentName(agent);
  const taskId = task?.id || 'task-unknown';
  const title = task?.title || taskId;
  const problem = task?.problem || 'Sem descrição detalhada; consultar o arquivo da tarefa.';
  const proof = task?.proof || 'node --test';
  const files = Array.isArray(task?.files) ? task.files : [];
  const outOfScope = Array.isArray(task?.outOfScope) ? task.outOfScope : [];
  const approach = task?.approach || 'Seguir a arquitetura e os padrões existentes do repositório.';
  const agentIdentity = readAgentIdentity(rootDir, normalizedAgent);
  const rawTaskFile = task?.raw || readTaskMarkdown(rootDir, taskId);

  const sections = [
    `# Harness Hub Execution Brief`,
    ``,
    `- **Task ID:** ${taskId}`,
    `- **Title:** ${title}`,
    `- **Assigned Agent:** ${normalizedAgent}`,
    `- **Execution Mode:** ${mode} (engine=${engine})`,
    ``,
    `## Agent Role`,
    agentIdentity
      ? agentIdentity
      : `Atue estritamente como ${normalizedAgent}, mantendo escopo cirúrgico e evidências reais de verificação.`,
    ``,
    `## 4-Part Prompt Amplifier (80-prompt-amplifier.md)`,
    `Aplique profundidade de especialista (**a deeper version of the task, not a bigger one**):`,
    ``,
    `1. **Unasked expertise** — O que um especialista sênior faria além do pedido mínimo nesta tarefa (tratamento de bordas, validação de entrada, proteção contra path traversal, atomicidade, idempotência e compatibilidade Windows/POSIX)?`,
    `2. **Rawest material** — Comece pelas fontes primárias antes de editar: leia o código em execução, logs reais e exatamente os arquivos declarados em ## Files (${files.length ? files.join(', ') : 'definidos na tarefa'}).`,
    `3. **Methods and tools** — Use técnicas e ferramentas determinísticas do harness: \`node scripts/validate-task.mjs\`, \`node scripts/gate.mjs\`, \`node --test\` e revisão estruturada dos contratos.`,
    `4. **External proof** — Prove o resultado com oráculo externo verificável: \`${proof}\` e marque cada critério de aceite abaixo com evidência real executada.`,
    ``,
    `## Task Context`,
    `### Problem`,
    problem,
    ``,
    `### Acceptance Criteria`,
    formatAcceptanceCriteria(task?.acceptanceCriteria),
    ``,
    `### Files in Scope`,
    formatList(files, 'Seguir apenas os arquivos listados na tarefa.'),
    ``,
    `### Out of Scope`,
    formatList(outOfScope, 'Qualquer arquivo fora de ## Files.'),
    ``,
    `### Approach`,
    approach,
    ``,
    `### External Proof Oracle`,
    proof,
  ];

  if (rawTaskFile) {
    sections.push('', '## Canonical Task File', '```markdown', rawTaskFile.trim(), '```');
  }

  sections.push(
    '',
    '## Mandatory Guardrails',
    '- **Never execute Level C actions** (`git push`, open PR, deploy, delete tasks, destructive git commands).',
    normalizedAgent === '@committer'
      ? '- You are `@committer`; commit only after all quality gates and reviews pass.'
      : '- **Never run `git commit`** — only `@committer` commits.',
    '- Stay strictly inside `## Files` scope; never weaken a test or disable a check.',
    '- Never log, persist, or echo `GITHUB_TOKEN` or any secret.'
  );

  return sections.join('\n');
}

/**
 * Resolves the CLI binary, explicit argument array (for `shell: false`),
 * and child environment adjustments for each supported AI engine.
 *
 * @param {string} engine
 * @param {'impl'|'verify'} mode
 * @param {string} prompt
 * @returns {{ binary: string, args: string[], useStdin: boolean, stdinPayload: string|null, stripEnvKeys: string[] }}
 */
export function buildEngineCommand(engine, mode, prompt) {
  const isVerify = mode === 'verify';
  const useStdin =
    process.platform === 'win32' &&
    Buffer.byteLength(prompt, 'utf8') > WINDOWS_ARG_LIMIT_BYTES;
  const promptArg = useStdin
    ? 'Execute the full instructions provided via standard input (stdin).'
    : prompt;
  const stdinPayload = useStdin ? prompt : null;

  switch (engine) {
    case 'claude':
      return {
        binary: 'claude',
        args: isVerify
          ? ['-p', promptArg, '--allowedTools', 'Read,Glob,Grep', '--output-format', 'text']
          : ['-p', promptArg, '--output-format', 'text'],
        useStdin,
        stdinPayload,
        stripEnvKeys: ['CLAUDECODE'],
      };
    case 'codex':
      return {
        binary: 'codex',
        args: isVerify
          ? ['exec', '--sandbox', 'read-only', promptArg]
          : ['exec', '--sandbox', 'workspace-write', promptArg],
        useStdin,
        stdinPayload,
        stripEnvKeys: [],
      };
    case 'cursor':
      return {
        binary: 'agent',
        args: isVerify ? ['-p', promptArg] : ['-p', '--force', promptArg],
        useStdin,
        stdinPayload,
        stripEnvKeys: [],
      };
    case 'antigravity':
      return {
        binary: 'agy',
        args: isVerify
          ? ['-p', promptArg, '--mode', 'plan', '--sandbox', '--output-format', 'text']
          : ['-p', promptArg, '--mode', 'accept-edits', '--output-format', 'text'],
        useStdin,
        stdinPayload,
        stripEnvKeys: [],
      };
    default: {
      const err = new Error(`Unsupported engine: "${String(engine)}"`);
      err.code = 'INVALID_ENGINE';
      err.statusCode = 400;
      throw err;
    }
  }
}

function createDefaultLockManager(rootDir) {
  const locksDir = resolve(rootDir, '.specs', 'hub', 'locks');

  function lockPathFor(taskId) {
    assertSafeTaskId(taskId);
    return ensurePathInside(locksDir, join(locksDir, `${taskId}.lock`));
  }

  return {
    acquireLock(taskId, holder) {
      mkdirSync(locksDir, { recursive: true });
      const lockPath = lockPathFor(taskId);
      try {
        const fd = openSync(lockPath, 'wx');
        try {
          writeSync(fd, JSON.stringify({ taskId, ...holder }, null, 2), null, 'utf8');
        } finally {
          closeSync(fd);
        }
        return { ok: true, lockPath };
      } catch (err) {
        if (err && err.code === 'EEXIST') {
          let existing = null;
          try {
            existing = JSON.parse(readFileSync(lockPath, 'utf8'));
          } catch {
            existing = null;
          }
          return { ok: false, holder: existing };
        }
        throw err;
      }
    },
    releaseLock(taskId, { runId } = {}) {
      const lockPath = lockPathFor(taskId);
      if (!existsSync(lockPath)) return { ok: true };
      try {
        if (runId) {
          const existing = JSON.parse(readFileSync(lockPath, 'utf8'));
          if (existing?.runId && existing.runId !== runId) {
            return { ok: false, error: 'LOCK_OWNER_MISMATCH' };
          }
        }
      } catch {
        // Proceed with cleanup if lock file is unreadable
      }
      try {
        unlinkSync(lockPath);
      } catch (err) {
        if (err?.code !== 'ENOENT') throw err;
      }
      return { ok: true };
    },
  };
}

function sleepAbortable(ms, signal) {
  if (signal?.aborted) {
    return Promise.reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
  }
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolvePromise();
    }, ms);
    if (typeof timer.unref === 'function') timer.unref();

    function onAbort() {
      clearTimeout(timer);
      rejectPromise(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function killProcessTree(pid, child) {
  if (!pid) return;
  if (process.platform === 'win32') {
    try {
      const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        shell: false,
        stdio: 'ignore',
      });
      killer.on('error', () => {
        try {
          child?.kill('SIGTERM');
        } catch {
          // ignore
        }
      });
    } catch {
      try {
        child?.kill('SIGTERM');
      } catch {
        // ignore
      }
    }
    return;
  }

  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      child?.kill('SIGTERM');
    } catch {
      // ignore
    }
  }

  const forceTimer = setTimeout(() => {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        child?.kill('SIGKILL');
      } catch {
        // ignore
      }
    }
  }, 3000);
  if (typeof forceTimer.unref === 'function') forceTimer.unref();
}

/**
 * Creates an Auto-Execute Runner supporting the built-in `mock` engine
 * and 4 real AI CLI adapters (`claude`, `codex`, `cursor`, `antigravity`),
 * strictly using `shell: false`, atomic task locks, live SSE log streaming,
 * secret redaction, and cross-platform cancellation.
 *
 * @param {{
 *   rootDir: string,
 *   sse?: { broadcast: (event: string, data: unknown) => void },
 *   onRunUpdate?: (run: object) => void,
 *   maxConcurrentRuns?: number,
 *   lockManager?: { acquireLock: Function, releaseLock: Function },
 *   mockStepDelayMs?: number,
 *   spawnImpl?: typeof spawn,
 * }} options
 */
export function createRunner(options) {
  const {
    rootDir,
    sse = null,
    onRunUpdate = null,
    maxConcurrentRuns = 2,
    lockManager = createDefaultLockManager(rootDir),
    mockStepDelayMs = 200,
    spawnImpl = spawn,
  } = options || {};

  if (!rootDir) {
    throw new Error('createRunner requires rootDir');
  }

  const logsDir = resolve(rootDir, '.specs', 'logs');

  /** @type {Map<string, any>} */
  const runs = new Map();

  function toPublicRun(record) {
    return {
      runId: record.runId,
      taskId: record.taskId,
      agent: record.agent,
      engine: record.engine,
      mode: record.mode,
      status: record.status,
      step: record.step,
      progress: record.progress,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      durationMs: record.durationMs,
      exitCode: record.exitCode,
      logFile: record.logFile,
      pid: record.pid,
      error: record.error,
    };
  }

  function emitSse(event, data) {
    try {
      sse?.broadcast?.(event, data);
    } catch {
      // SSE errors must never break runner lifecycle
    }
  }

  function notifyUpdate(record) {
    try {
      onRunUpdate?.(toPublicRun(record));
    } catch {
      // callback errors must never break runner lifecycle
    }
  }

  function appendLog(record, stream, rawLine) {
    const cleanLine = redactSecrets(String(rawLine ?? '').replace(/\r?\n$/, ''));
    const ts = new Date().toISOString();
    const formatted = `[${ts}] [${stream}] ${cleanLine}`;
    record.lines.push(formatted);
    try {
      appendFileSync(record.absLogFile, `${formatted}\n`, 'utf8');
    } catch {
      // ignore disk write failure during teardown
    }
    emitSse('run:log', {
      runId: record.runId,
      taskId: record.taskId,
      ts,
      stream,
      line: cleanLine,
    });
  }

  function setStep(record, step, progress) {
    record.step = step;
    record.progress = progress;
    appendLog(record, 'STEP', `${step} (engine=${record.engine}, agent=${record.agent})`);
    emitSse('run:step', {
      runId: record.runId,
      taskId: record.taskId,
      step,
      progress,
    });
    notifyUpdate(record);
  }

  function releaseTaskLock(record) {
    if (record.lockReleased) return;
    record.lockReleased = true;
    try {
      lockManager.releaseLock(record.taskId, { runId: record.runId, agent: record.agent });
    } catch {
      // ignore release failure
    }
  }

  function finalizeRun(record, { status, exitCode, error = null, emitEvent = 'run:finished', reason = null }) {
    if (record.finalized) return;
    record.finalized = true;
    record.status = status;
    record.exitCode = exitCode;
    record.error = error ? redactSecrets(error) : null;
    record.finishedAt = new Date().toISOString();
    record.durationMs = Date.now() - record.startedAtMs;
    if (status === 'completed') record.progress = 100;

    if (emitEvent === 'run:stopped') {
      appendLog(record, 'STOP', reason || 'Execução interrompida');
    } else {
      appendLog(record, 'EXIT', `code=${exitCode ?? 1} durationMs=${record.durationMs}`);
    }

    releaseTaskLock(record);

    if (emitEvent === 'run:stopped') {
      emitSse('run:stopped', {
        runId: record.runId,
        taskId: record.taskId,
        reason: reason || 'Cancelado pelo usuário',
      });
    } else {
      emitSse('run:finished', {
        runId: record.runId,
        taskId: record.taskId,
        exitCode,
        durationMs: record.durationMs,
        status,
        error: record.error,
      });
    }

    notifyUpdate(record);
  }

  async function runTaskValidator(record, signal) {
    const validatorPath = resolve(rootDir, 'scripts', 'validate-task.mjs');
    const tasksDir = resolve(rootDir, '.specs', 'tasks');
    const taskFile = ensurePathInside(tasksDir, join(tasksDir, `${record.taskId}.md`));

    if (!existsSync(validatorPath) || !existsSync(taskFile)) {
      appendLog(
        record,
        'STDOUT',
        `Gate simulado concluído (task=${record.taskId}, proof="${record.taskProof || 'node --test'}")`
      );
      return 0;
    }

    return new Promise((resolveCode) => {
      const child = spawnImpl(process.execPath, [validatorPath, taskFile], {
        cwd: rootDir,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const onAbort = () => {
        killProcessTree(child.pid, child);
        resolveCode(130);
      };
      signal.addEventListener('abort', onAbort, { once: true });

      const pipeLines = (streamName) => (chunk) => {
        const text = chunk.toString('utf8');
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) appendLog(record, streamName, line);
        }
      };

      child.stdout?.on('data', pipeLines('STDOUT'));
      child.stderr?.on('data', pipeLines('STDERR'));

      child.on('error', (err) => {
        signal.removeEventListener('abort', onAbort);
        appendLog(record, 'STDERR', `Erro ao executar validate-task.mjs: ${err.message}`);
        resolveCode(1);
      });

      child.on('close', (code) => {
        signal.removeEventListener('abort', onAbort);
        resolveCode(code ?? 0);
      });
    });
  }

  async function executeMockRun(record, task) {
    const { signal } = record.abortController;
    const filesList = Array.isArray(task.files) && task.files.length > 0
      ? task.files.join(', ')
      : '(escopo declarado na tarefa)';
    const acCount = Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria.length : 0;

    try {
      setStep(record, 'Amplificando Prompt', 20);
      appendLog(
        record,
        'INFO',
        'Amplified prompt carregado (4 partes de 80-prompt-amplifier.md: Unasked expertise, Rawest material, Methods and tools, External proof)'
      );
      await sleepAbortable(mockStepDelayMs, signal);

      setStep(record, 'Decompondo Tarefa', 45);
      appendLog(record, 'STDOUT', `Tarefa: "${task.title || task.id}" — ${acCount} critérios de aceite mapeados.`);
      appendLog(record, 'STDOUT', `Arquivos em escopo: ${filesList}`);
      await sleepAbortable(mockStepDelayMs, signal);

      setStep(record, 'Executando Slice', 75);
      appendLog(
        record,
        'STDOUT',
        record.mode === 'verify'
          ? `Executando verificação read-only como ${record.agent}...`
          : `Aplicando plano de implementação como ${record.agent} (mock seguro, zero alterações destrutivas)...`
      );
      await sleepAbortable(mockStepDelayMs, signal);

      setStep(record, 'Validando Gate', 95);
      const gateExit = await runTaskValidator(record, signal);
      if (signal.aborted || record.finalized) return;

      if (gateExit === 0) {
        finalizeRun(record, { status: 'completed', exitCode: 0 });
      } else {
        finalizeRun(record, {
          status: 'failed',
          exitCode: gateExit,
          error: `Validação da tarefa retornou código ${gateExit}`,
        });
      }
    } catch (err) {
      if (err?.name === 'AbortError' || signal.aborted || record.finalized) {
        return;
      }
      finalizeRun(record, {
        status: 'failed',
        exitCode: 1,
        error: err?.message || 'Erro inesperado no mock runner',
      });
    }
  }

  function executeCliRun(record, prompt) {
    setStep(record, 'Amplificando Prompt', 15);
    appendLog(
      record,
      'INFO',
      `Amplified prompt montado (${Buffer.byteLength(prompt, 'utf8')} bytes, 4 partes de 80-prompt-amplifier.md)`
    );

    const cmd = buildEngineCommand(record.engine, record.mode, prompt);
    const childEnv = { ...process.env };
    for (const key of cmd.stripEnvKeys) {
      delete childEnv[key];
    }

    setStep(record, 'Executando Slice', 40);
    appendLog(record, 'INFO', `Iniciando CLI "${cmd.binary}" (shell: false, mode=${record.mode})`);

    let child;
    try {
      child = spawnImpl(cmd.binary, cmd.args, {
        cwd: rootDir,
        shell: false,
        env: childEnv,
        detached: process.platform !== 'win32',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      const msg =
        err?.code === 'ENOENT'
          ? `CLI "${cmd.binary}" não encontrada no PATH para a engine "${record.engine}". Instale a ferramenta ou use engine="mock".`
          : `Falha ao iniciar CLI "${cmd.binary}": ${err.message}`;
      appendLog(record, 'STDERR', msg);
      finalizeRun(record, { status: 'failed', exitCode: 127, error: msg });
      return;
    }

    record.child = child;
    record.pid = child.pid ?? null;
    notifyUpdate(record);

    if (cmd.useStdin && cmd.stdinPayload) {
      try {
        child.stdin.write(cmd.stdinPayload, 'utf8');
      } catch {
        // ignore broken pipe
      }
    }
    try {
      child.stdin.end();
    } catch {
      // ignore
    }

    let stdoutBuffer = '';
    let stderrBuffer = '';

    const handleStreamChunk = (streamName, isStdout) => (chunk) => {
      const text = chunk.toString('utf8');
      const combined = (isStdout ? stdoutBuffer : stderrBuffer) + text;
      const parts = combined.split(/\r?\n/);
      const remainder = parts.pop() ?? '';
      if (isStdout) stdoutBuffer = remainder;
      else stderrBuffer = remainder;

      for (const line of parts) {
        if (line.length > 0) appendLog(record, streamName, line);
      }
    };

    child.stdout?.on('data', handleStreamChunk('STDOUT', true));
    child.stderr?.on('data', handleStreamChunk('STDERR', false));

    child.on('error', (err) => {
      const msg =
        err?.code === 'ENOENT'
          ? `CLI "${cmd.binary}" não encontrada no PATH para a engine "${record.engine}". Instale a ferramenta ou use engine="mock".`
          : `Erro no processo "${cmd.binary}": ${err.message}`;
      appendLog(record, 'STDERR', msg);
      finalizeRun(record, { status: 'failed', exitCode: 127, error: msg });
    });

    child.on('close', (code, signal) => {
      if (stdoutBuffer.trim()) appendLog(record, 'STDOUT', stdoutBuffer);
      if (stderrBuffer.trim()) appendLog(record, 'STDERR', stderrBuffer);
      if (record.finalized) return;

      if (code === 0) {
        setStep(record, 'Validando Gate', 95);
        finalizeRun(record, { status: 'completed', exitCode: 0 });
      } else {
        const msg = signal
          ? `Processo encerrado por sinal ${signal}`
          : `Processo "${cmd.binary}" terminou com código ${code}`;
        finalizeRun(record, { status: 'failed', exitCode: code ?? 1, error: msg });
      }
    });
  }

  function getActiveRuns() {
    const active = [];
    for (const r of runs.values()) {
      if (r.status === 'running') active.push(r);
    }
    return active;
  }

  /**
   * Starts a new execution run for a task.
   *
   * @param {{
   *   task: object,
   *   engine?: 'mock'|'claude'|'codex'|'cursor'|'antigravity',
   *   mode?: 'impl'|'verify',
   *   agent?: string,
   *   maxConcurrentRuns?: number,
   * }} params
   */
  function startRun(params) {
    const {
      task,
      engine = 'mock',
      mode = 'impl',
      agent = task?.meta?.assignee || '@developer',
      maxConcurrentRuns: overrideMax = maxConcurrentRuns,
    } = params || {};

    if (!task || typeof task !== 'object') {
      const err = new Error('startRun requires a task object');
      err.code = 'INVALID_TASK';
      err.statusCode = 400;
      throw err;
    }

    assertSafeTaskId(task.id);

    if (!SUPPORTED_ENGINES.includes(engine)) {
      const err = new Error(`Engine inválida: "${String(engine)}". Use: ${SUPPORTED_ENGINES.join(', ')}`);
      err.code = 'INVALID_ENGINE';
      err.statusCode = 400;
      throw err;
    }

    if (mode !== 'impl' && mode !== 'verify') {
      const err = new Error(`Modo inválido: "${String(mode)}". Use "impl" ou "verify".`);
      err.code = 'INVALID_MODE';
      err.statusCode = 400;
      throw err;
    }

    const activeRuns = getActiveRuns();
    if (activeRuns.some((r) => r.taskId === task.id)) {
      const err = new Error(`A tarefa "${task.id}" já possui uma execução em andamento.`);
      err.code = 'ALREADY_RUNNING';
      err.statusCode = 409;
      throw err;
    }

    if (activeRuns.length >= overrideMax) {
      const err = new Error(`Limite de concorrência atingido (${overrideMax} execuções simultâneas).`);
      err.code = 'CONCURRENCY_LIMIT';
      err.statusCode = 409;
      throw err;
    }

    const runId = `run-${Date.now()}-${randomBytes(3).toString('hex')}`;
    const normalizedAgent = normalizeAgentName(agent);

    const lockResult = lockManager.acquireLock(task.id, {
      agent: normalizedAgent,
      engine,
      runId,
      pid: process.pid,
      acquiredAt: new Date().toISOString(),
    });

    if (!lockResult?.ok) {
      const err = new Error(`A tarefa "${task.id}" já está bloqueada por outra execução ou agente.`);
      err.code = 'ALREADY_RUNNING';
      err.statusCode = 409;
      err.holder = lockResult?.holder ?? null;
      throw err;
    }

    mkdirSync(logsDir, { recursive: true });
    const logFileName = `run-${task.id}-${Date.now()}.log`;
    const absLogFile = ensurePathInside(logsDir, join(logsDir, logFileName));
    const relLogFile = relative(rootDir, absLogFile).replace(/\\/g, '/');

    const prompt = buildExecutionPrompt(task, {
      rootDir,
      agent: normalizedAgent,
      mode,
      engine,
    });

    const record = {
      runId,
      taskId: task.id,
      taskProof: task.proof || '',
      agent: normalizedAgent,
      engine,
      mode,
      status: 'running',
      step: 'Amplificando Prompt',
      progress: 0,
      startedAt: new Date().toISOString(),
      startedAtMs: Date.now(),
      finishedAt: null,
      durationMs: null,
      exitCode: null,
      logFile: relLogFile,
      absLogFile,
      pid: null,
      error: null,
      lines: [],
      abortController: new AbortController(),
      child: null,
      finalized: false,
      lockReleased: false,
      prompt,
    };

    runs.set(runId, record);

    emitSse('run:started', {
      runId: record.runId,
      taskId: record.taskId,
      agent: record.agent,
      engine: record.engine,
      mode: record.mode,
      step: record.step,
      startedAt: record.startedAt,
      logFile: record.logFile,
    });
    notifyUpdate(record);

    if (engine === 'mock') {
      queueMicrotask(() => {
        executeMockRun(record, task);
      });
    } else {
      queueMicrotask(() => {
        executeCliRun(record, prompt);
      });
    }

    return toPublicRun(record);
  }

  /**
   * Stops a running execution (mock or child process tree) and releases its lock.
   *
   * @param {string} runId
   * @param {string} [reason]
   */
  function stopRun(runId, reason = 'Cancelado pelo usuário') {
    const record = runs.get(runId);
    if (!record) {
      return { ok: false, error: 'NOT_FOUND' };
    }
    if (record.finalized || record.status !== 'running') {
      return { ok: true, alreadyFinished: true, run: toPublicRun(record) };
    }

    if (record.engine === 'mock') {
      record.abortController.abort();
    } else if (record.child) {
      killProcessTree(record.child.pid, record.child);
    }

    finalizeRun(record, {
      status: 'stopped',
      exitCode: null,
      emitEvent: 'run:stopped',
      reason,
    });

    return { ok: true, alreadyFinished: false, run: toPublicRun(record) };
  }

  function listRuns() {
    return Array.from(runs.values())
      .sort((a, b) => b.startedAtMs - a.startedAtMs)
      .map(toPublicRun);
  }

  function getRun(runId) {
    const record = runs.get(runId);
    return record ? toPublicRun(record) : null;
  }

  function getRunLogs(runId) {
    const record = runs.get(runId);
    if (!record) return null;

    let content = '';
    if (existsSync(record.absLogFile)) {
      try {
        content = readFileSync(record.absLogFile, 'utf8');
      } catch {
        content = record.lines.join('\n');
      }
    } else {
      content = record.lines.join('\n');
    }

    return {
      runId: record.runId,
      taskId: record.taskId,
      logFile: record.logFile,
      lines: content ? content.split(/\r?\n/).filter(Boolean) : [...record.lines],
      content,
    };
  }

  function stopAll(reason = 'Servidor encerrado') {
    for (const record of runs.values()) {
      if (record.status === 'running') {
        stopRun(record.runId, reason);
      }
    }
  }

  return {
    startRun,
    stopRun,
    listRuns,
    getRun,
    getRunLogs,
    stopAll,
  };
}
