import { execFileSync } from 'node:child_process';

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const HINT_UNCONFIGURED =
  "Defina GITHUB_TOKEN ou faça login com 'gh auth login' para sincronizar issues e PRs reais.";

export const DEMO_ISSUES = Object.freeze([
  {
    number: 101,
    kind: 'issue',
    title: 'Corrigir timeout na renovação de sessão JWT',
    body: [
      'Usuários com sessão ativa por mais de 15 minutos recebem erro 401 intermitente durante a renovação do token.',
      '',
      '### Checklist',
      '- [ ] Reproduzir o timeout de renovação em teste automatizado com relógio controlado (0 falhas em 10 execuções)',
      '- [ ] Garantir renovação idempotente quando 2 requisições chegam simultaneamente',
      '',
      'Arquivos prováveis: `src/auth/session.mjs`, `tests/auth.test.mjs`.',
    ].join('\n'),
    url: 'https://github.com/demo-org/harness-hub/issues/101',
    repo: 'demo-org/harness-hub',
    labels: ['bug', 'p1', 'auth'],
    state: 'open',
    assignee: 'demo-user',
    updatedAt: '2026-11-23T18:00:00.000Z',
    demo: true,
  },
  {
    number: 108,
    kind: 'issue',
    title: 'Adicionar exportação de relatório semanal da agenda em JSON',
    body: [
      'Permitir exportar os itens agendados da semana atual em JSON estruturado para auditoria.',
      '',
      '### Checklist',
      '- [ ] Expor endpoint retornando HTTP 200 com schema versionado v1',
      '- [ ] Cobrir semana vazia e semana com 5 tarefas em testes automatizados',
    ].join('\n'),
    url: 'https://github.com/demo-org/harness-hub/issues/108',
    repo: 'demo-org/harness-hub',
    labels: ['enhancement', 'p2'],
    state: 'open',
    assignee: 'demo-user',
    updatedAt: '2026-11-23T19:15:00.000Z',
    demo: true,
  },
  {
    number: 114,
    kind: 'issue',
    title: 'Bloquear cabeçalhos Host externos contra DNS rebinding',
    body: [
      'Garantir que o servidor local recuse qualquer Host fora de 127.0.0.1 e localhost com HTTP 403.',
      '',
      '### Checklist',
      '- [ ] Rejeitar Host evil.example:7331 com status 403',
      '- [ ] Permitir 127.0.0.1:7331 e localhost:7331 com status 200',
    ].join('\n'),
    url: 'https://github.com/demo-org/harness-hub/issues/114',
    repo: 'demo-org/harness-hub',
    labels: ['security', 'p0'],
    state: 'open',
    assignee: 'demo-user',
    updatedAt: '2026-11-23T20:00:00.000Z',
    demo: true,
  },
  {
    number: 204,
    kind: 'pr_review',
    title: 'PR #204: Refatorar locks atômicos para suporte NTFS e POSIX',
    body: [
      'Substitui verificação não-atômica por `fs.openSync(path, "wx")` em `.specs/hub/locks/`.',
      '',
      'Arquivos alterados: `hub/lib/store.mjs`, `hub/tests/store.test.mjs`.',
    ].join('\n'),
    url: 'https://github.com/demo-org/harness-hub/pull/204',
    repo: 'demo-org/harness-hub',
    labels: ['review-requested', 'p1'],
    state: 'open',
    assignee: 'teammate-dev',
    updatedAt: '2026-11-23T20:30:00.000Z',
    demo: true,
  },
  {
    number: 209,
    kind: 'pr_review',
    title: 'PR #209: Adicionar validação de drift SHA-256 nos adaptadores Multi-AI',
    body: [
      'Adiciona detecção de edição manual em `.gemini/rules/harness.md`, `.agents/rules/harness.md` e `.cursor/rules/harness.mdc`.',
      '',
      'Arquivos alterados: `hub/lib/adapters.mjs`, `hub/tests/adapters.test.mjs`.',
    ].join('\n'),
    url: 'https://github.com/demo-org/harness-hub/pull/209',
    repo: 'demo-org/harness-hub',
    labels: ['review-requested', 'p2'],
    state: 'open',
    assignee: 'teammate-lead',
    updatedAt: '2026-11-23T21:00:00.000Z',
    demo: true,
  },
]);

/**
 * Resolves a GitHub token strictly in memory:
 * 1. `env.GITHUB_TOKEN`
 * 2. Fallback to `gh auth token` via `execFileSync` with `shell: false`
 * Never logs or persists the token to disk.
 *
 * @param {{ env?: Record<string, string|undefined>, execFileSyncImpl?: typeof execFileSync }} [options]
 * @returns {{ token: string|null, source: 'env'|'gh-cli'|'none' }}
 */
export function resolveGitHubToken(options = {}) {
  const { env = process.env, execFileSyncImpl = execFileSync } = options;

  const envToken = typeof env?.GITHUB_TOKEN === 'string' ? env.GITHUB_TOKEN.trim() : '';
  if (envToken) {
    return { token: envToken, source: 'env' };
  }

  try {
    const out = execFileSyncImpl('gh', ['auth', 'token'], {
      encoding: 'utf8',
      timeout: 3000,
      shell: false,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const cliToken = typeof out === 'string' ? out.trim() : '';
    if (cliToken) {
      return { token: cliToken, source: 'gh-cli' };
    }
  } catch {
    // gh CLI unavailable or not authenticated
  }

  return { token: null, source: 'none' };
}

function extractRepoFromItem(item, fallbackRepo = null) {
  if (item?.repository?.full_name) return item.repository.full_name;
  if (typeof item?.repository_url === 'string') {
    const m = item.repository_url.match(/\/repos\/([^/]+\/[^/]+)$/);
    if (m) return m[1];
  }
  if (typeof item?.html_url === 'string') {
    const m = item.html_url.match(/github\.com\/([^/]+\/[^/]+)\/(?:issues|pull)\/\d+/);
    if (m) return m[1];
  }
  return fallbackRepo || 'unknown/repo';
}

function normalizeGitHubItem(item, kind, fallbackRepo = null) {
  return {
    number: item.number,
    kind,
    title: String(item.title || '').trim(),
    body: typeof item.body === 'string' ? item.body : '',
    url: item.html_url || item.url || '',
    repo: extractRepoFromItem(item, fallbackRepo),
    labels: Array.isArray(item.labels)
      ? item.labels
          .map((l) => (typeof l === 'string' ? l : l?.name))
          .filter((n) => typeof n === 'string' && n.trim().length > 0)
      : [],
    state: item.state || 'open',
    assignee: item.assignee?.login || item.user?.login || null,
    updatedAt: item.updated_at || null,
    demo: false,
  };
}

function buildGitHubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'harness-hub',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function mapHttpError(res) {
  const status = res.status;
  if (status === 401) {
    return {
      configured: true,
      mode: 'error',
      status,
      error: 'UNAUTHORIZED',
      message: 'Token do GitHub inválido ou expirado (401). Verifique GITHUB_TOKEN ou rode "gh auth login".',
      issues: [],
    };
  }
  if (status === 403) {
    const remaining = res.headers?.get?.('x-ratelimit-remaining');
    const reset = res.headers?.get?.('x-ratelimit-reset') || null;
    const isRateLimit = remaining === '0';
    return {
      configured: true,
      mode: 'error',
      status,
      error: isRateLimit ? 'RATE_LIMITED' : 'FORBIDDEN',
      message: isRateLimit
        ? 'Limite de requisições da API do GitHub atingido (403 rate limit). Tente novamente mais tarde.'
        : 'Acesso negado pela API do GitHub (403). Verifique os escopos do token.',
      rateLimitReset: reset,
      issues: [],
    };
  }
  return {
    configured: true,
    mode: 'error',
    status,
    error: 'GITHUB_API_ERROR',
    message: `Erro HTTP ${status} ao consultar a API do GitHub.`,
    issues: [],
  };
}

/**
 * Fetches assigned open GitHub issues AND open Pull Requests where the user's
 * review was requested (`review-requested:@me`).
 * Falls back gracefully to realistic `demo` items when unconfigured or offline.
 *
 * @param {{
 *   token?: string|null,
 *   repo?: string|null,
 *   fetchImpl?: typeof fetch,
 *   env?: Record<string, string|undefined>,
 *   execFileSyncImpl?: typeof execFileSync,
 * }} [options]
 */
export async function fetchAssignedIssues(options = {}) {
  const {
    token: explicitToken,
    repo = null,
    fetchImpl = globalThis.fetch,
    env = process.env,
    execFileSyncImpl = execFileSync,
  } = options;

  let resolvedToken = null;
  let tokenSource = 'none';

  if (explicitToken === undefined) {
    const resolved = resolveGitHubToken({ env, execFileSyncImpl });
    resolvedToken = resolved.token;
    tokenSource = resolved.source;
  } else if (typeof explicitToken === 'string' && explicitToken.trim()) {
    resolvedToken = explicitToken.trim();
    tokenSource = 'explicit';
  }

  if (!resolvedToken) {
    return {
      configured: false,
      mode: 'demo',
      source: 'none',
      hint: HINT_UNCONFIGURED,
      issues: DEMO_ISSUES.map((item) => ({ ...item, labels: [...item.labels] })),
      error: null,
    };
  }

  if (repo !== null && repo !== undefined && repo !== '') {
    if (typeof repo !== 'string' || !REPO_RE.test(repo)) {
      return {
        configured: true,
        mode: 'error',
        status: 400,
        error: 'INVALID_REPO',
        message: 'Formato de repositório inválido. Use "owner/repo".',
        issues: [],
      };
    }
  }

  const headers = buildGitHubHeaders(resolvedToken);
  const issuesUrl = repo
    ? `https://api.github.com/repos/${repo}/issues?state=open&per_page=30`
    : 'https://api.github.com/issues?filter=assigned&state=open&per_page=30';

  const prSearchQuery = repo
    ? `is:pr+is:open+review-requested:@me+repo:${encodeURIComponent(repo)}`
    : 'is:pr+is:open+review-requested:@me';
  const prReviewsUrl = `https://api.github.com/search/issues?q=${prSearchQuery}&per_page=15`;

  try {
    const issuesRes = await fetchImpl(issuesUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!issuesRes.ok) {
      return mapHttpError(issuesRes);
    }

    const rawIssues = await issuesRes.json();
    const assignedIssues = Array.isArray(rawIssues)
      ? rawIssues
          .filter((item) => item && !item.pull_request)
          .map((item) => normalizeGitHubItem(item, 'issue', repo))
      : [];

    // Fetch open PRs awaiting user's review; degrade gracefully if search endpoint fails
    let prReviewItems = [];
    let prWarning = null;
    try {
      const prRes = await fetchImpl(prReviewsUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (prRes.ok) {
        const prData = await prRes.json();
        if (Array.isArray(prData?.items)) {
          prReviewItems = prData.items.map((item) =>
            normalizeGitHubItem(item, 'pr_review', repo)
          );
        }
      } else {
        prWarning = `PR review search returned HTTP ${prRes.status}`;
      }
    } catch {
      prWarning = 'PR review search unavailable';
    }

    const seen = new Set();
    const merged = [];
    for (const item of [...assignedIssues, ...prReviewItems]) {
      const key = `${item.repo}#${item.number}:${item.kind}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }

    return {
      configured: true,
      mode: 'live',
      source: tokenSource,
      issues: merged,
      warning: prWarning,
      error: null,
    };
  } catch {
    return {
      configured: true,
      mode: 'offline',
      source: tokenSource,
      error: 'OFFLINE',
      message:
        'Não foi possível conectar à API do GitHub (offline ou timeout). Exibindo itens demonstrativos.',
      hint: 'Verifique sua conexão de rede para sincronizar com api.github.com.',
      issues: DEMO_ISSUES.map((item) => ({ ...item, labels: [...item.labels] })),
    };
  }
}

function slugifyTitle(title, maxLen = 50) {
  const ascii = String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/-+$/, '');
  return ascii || 'item';
}

function sanitizeTextForTask(text) {
  return String(text || '')
    .replace(/<[^>\n]{3,}>/g, '[valor]')
    .replace(/\b(TODO|TBD|\?\?\?)\b/g, 'a definir')
    .trim();
}

function extractChecklistFromBody(body) {
  if (typeof body !== 'string' || !body.trim()) return [];
  const items = [];
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^\s*[-*]\s+\[[ xX]\]\s+(.+)$/);
    if (match) {
      const cleaned = sanitizeTextForTask(match[1]);
      if (cleaned) items.push(cleaned);
    }
  }
  return items;
}

function extractFilesFromBody(body) {
  if (typeof body !== 'string' || !body.trim()) return [];
  const found = new Set();
  const re = /`([A-Za-z0-9_./-]+\.[A-Za-z0-9]{1,8})`/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    const candidate = match[1];
    if (!candidate.includes('..') && !candidate.startsWith('/') && !candidate.startsWith('http')) {
      found.add(candidate);
    }
  }
  return Array.from(found);
}

function inferPriority(labelsLower) {
  if (labelsLower.some((l) => /^(p0|critical|urgent|sev0)$/.test(l))) return 'P0';
  if (labelsLower.some((l) => /^(p1|high|sev1)$/.test(l))) return 'P1';
  if (labelsLower.some((l) => /^(p3|low|minor)$/.test(l))) return 'P3';
  return 'P2';
}

/**
 * Converts a GitHub issue or PR review request into the task creation payload
 * expected by `store.createTask` (compatible with `validate-task.mjs`).
 *
 * @param {object} item
 * @param {{ boardLane?: string, priority?: string, tier?: string, agent?: string, assignee?: string, reviewer?: string, type?: string }} [overrides]
 */
export function mapIssueToTaskInput(item, overrides = {}) {
  if (!item || typeof item !== 'object') {
    const err = new Error('mapIssueToTaskInput requires a GitHub item object');
    err.code = 'INVALID_ISSUE';
    err.statusCode = 400;
    throw err;
  }

  const number = Number(item.number);
  if (!Number.isInteger(number) || number <= 0) {
    const err = new Error(`Invalid GitHub item number: "${String(item.number)}"`);
    err.code = 'INVALID_ISSUE';
    err.statusCode = 400;
    throw err;
  }

  const rawTitle = String(item.title || '').trim();
  if (!rawTitle) {
    const err = new Error('GitHub item title is required');
    err.code = 'INVALID_ISSUE';
    err.statusCode = 400;
    throw err;
  }

  const kind = item.kind === 'pr_review' ? 'pr_review' : 'issue';
  const labels = Array.isArray(item.labels)
    ? item.labels
        .map((l) => (typeof l === 'string' ? l.trim() : l?.name?.trim()))
        .filter(Boolean)
    : [];
  const labelsLower = labels.map((l) => l.toLowerCase());
  const isBug = labelsLower.some((l) => /bug|hotfix|defect|regression/.test(l));
  const isSensitive = labelsLower.some((l) => /security|auth|payment|secret|cve/.test(l));
  const repo = typeof item.repo === 'string' && item.repo.trim() ? item.repo.trim() : 'unknown/repo';
  const url = typeof item.url === 'string' ? item.url.trim() : '';

  const slug = slugifyTitle(rawTitle);
  const id = kind === 'pr_review' ? `task-gh-pr-${number}-${slug}` : `task-gh-${number}-${slug}`;

  const extractedFiles = extractFilesFromBody(item.body);
  const files = extractedFiles.length > 0 ? extractedFiles : [`.specs/tasks/${id}.md`];
  const bodyClean = sanitizeTextForTask(item.body || '');

  if (kind === 'pr_review') {
    const agent = overrides.agent || 'code-reviewer';
    const assignee = overrides.assignee || (agent.startsWith('@') ? agent : `@${agent}`);
    const reviewer = overrides.reviewer || '@tech-lead';

    return {
      id,
      title: rawTitle,
      source: 'github',
      sourceDetail: `GitHub PR #${number}${url ? ` (${url})` : ''}`,
      boardLane: overrides.boardLane || 'queued',
      priority: overrides.priority || inferPriority(labelsLower),
      tier: overrides.tier || 'T2',
      type: overrides.type || 'Review',
      agent: agent.replace(/^@/, ''),
      assignee,
      reviewer,
      sensitiveSurface: isSensitive,
      problem: bodyClean
        ? `Revisão de Pull Request #${number} (${repo}): ${bodyClean}`
        : `Revisão técnica solicitada no Pull Request #${number} (${repo}): ${rawTitle}.`,
      proof: `Revisão documentada com verificação de testes automatizados (exit 0) para o PR #${number}`,
      acceptanceCriteria: [
        `Revisar 100% do diff do PR #${number} validando requisitos, regressões e casos de borda`,
        `Verificar que os testes automatizados relacionados ao PR #${number} executam com exit 0`,
        `Registrar parecer técnico objetivo (aprovação ou lista de ajustes bloqueantes) para o PR #${number}`,
      ],
      outOfScope: [
        `Alterar código fora do escopo do PR #${number} ou executar merge/push sem aprovação`,
      ],
      approach: `Inspecionar o diff do PR #${number}, validar aderência aos critérios e regras de segurança, rodar testes locais e emitir parecer estruturado.`,
      files,
      githubIssue: {
        number,
        repo,
        url,
        labels,
        kind: 'pr_review',
        syncedAt: new Date().toISOString(),
      },
    };
  }

  const checklistAcs = extractChecklistFromBody(item.body);
  const acceptanceCriteria =
    checklistAcs.length > 0
      ? checklistAcs
      : [
          `Atender aos requisitos descritos na issue #${number} com verificação automatizada retornando exit 0`,
        ];

  const agent = overrides.agent || 'developer';
  const assignee = overrides.assignee || (agent.startsWith('@') ? agent : `@${agent}`);
  const reviewer = overrides.reviewer || '@code-reviewer';

  return {
    id,
    title: rawTitle,
    source: 'github',
    sourceDetail: `GitHub issue #${number}${url ? ` (${url})` : ''}`,
    boardLane: overrides.boardLane || (isBug ? 'to_fix' : 'planned'),
    priority: overrides.priority || inferPriority(labelsLower),
    tier: overrides.tier || 'T2',
    type: overrides.type || (isBug ? 'Bug' : 'Feature'),
    agent: agent.replace(/^@/, ''),
    assignee,
    reviewer,
    sensitiveSurface: isSensitive,
    problem: bodyClean || `Resolver a issue #${number} (${repo}): ${rawTitle}.`,
    proof: 'node --test',
    acceptanceCriteria,
    outOfScope: [`Alterações não relacionadas à issue #${number} (${repo})`],
    approach: `Analisar os arquivos em escopo da issue #${number}, implementar a solução com testes automatizados e validar com os gates do harness.`,
    files,
    githubIssue: {
      number,
      repo,
      url,
      labels,
      kind: 'issue',
      syncedAt: new Date().toISOString(),
    },
  };
}
