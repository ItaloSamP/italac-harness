/**
 * Harness Hub — Pure UI Renderers, Inline SVG Icons & Domain Helpers
 * Vanilla ES Module — Zero dependencies, strict HTML escaping (XSS-safe).
 */

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeHttpUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

const ICONS = {
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><line x1="12" y1="12" x2="18.36" y2="5.64"/>',
  columns: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>',
  'list-ordered': '<line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
  github: '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>',
  terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  play: '<polygon points="6 4 20 12 6 20 6 4"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  'x-circle': '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  'alert-triangle': '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  ban: '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'git-commit': '<circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/>',
  'git-pr': '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  bug: '<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M19 8l-3 2"/><path d="M5 8l3 2"/><path d="M19 16l-3-2"/><path d="M5 16l3-2"/><path d="M20 12h-4"/><path d="M4 12h4"/><path d="M10 6V4"/><path d="M14 6V4"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  'more-vertical': '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  'chevron-down': '<polyline points="6 9 12 15 18 9"/>',
  'chevron-up': '<polyline points="18 15 12 9 6 15"/>',
  'chevron-left': '<polyline points="15 18 9 12 15 6"/>',
  'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  'external-link': '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  maximize: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
  spinner: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  'arrow-up-right': '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  'folder-open': '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M2 10h20"/>',
  'git-branch': '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
};

export function icon(name, size = 16, extraClass = '') {
  const body = ICONS[name] || ICONS.radar;
  const cls = extraClass ? ` class="${escapeHtml(extraClass)}"` : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls}>${body}</svg>`;
}

/* ==========================================================================
   Domain Helpers
   ========================================================================== */

export const PLANNING_LANES = [
  { id: 'planned', title: 'Planejado', status: 'PLANNING', accent: 'var(--life-planning)', hint: 'Backlog estruturado' },
  { id: 'scheduled', title: 'Agendado', status: 'PLANNING', accent: 'var(--accent-text)', hint: 'Com dia na agenda' },
  { id: 'to_fix', title: 'A Corrigir', status: 'PLANNING', accent: 'var(--status-warn-text)', hint: 'Bugs e ajustes' },
];

export const EXECUTION_LANES = [
  { id: 'queued', title: 'Executar (Fila)', status: 'PLANNING', accent: 'var(--status-info-text)', hint: 'Pronto na fila' },
  { id: 'in_progress', title: 'Em Execução', status: 'IN_PROGRESS', accent: 'var(--life-in-progress)', hint: 'Agente trabalhando' },
  { id: 'in_review', title: 'Em Revisão', status: 'IN_REVIEW', accent: 'var(--life-in-review)', hint: 'Revisão independente' },
  { id: 'ready', title: 'Pronto', status: 'READY_TO_COMMIT', accent: 'var(--life-ready)', hint: 'Aguardando @committer' },
  { id: 'done', title: 'Feito', status: 'COMMITTED', accent: 'var(--life-committed)', hint: 'Comitado / Publicado' },
];

export const UNIFIED_COLUMNS = [
  { id: 'PLANNING', title: 'PLANNING', lane: 'planned', status: 'PLANNING', accent: 'var(--life-planning)' },
  { id: 'IN_PROGRESS', title: 'IN_PROGRESS', lane: 'in_progress', status: 'IN_PROGRESS', accent: 'var(--life-in-progress)' },
  { id: 'IN_REVIEW', title: 'IN_REVIEW', lane: 'in_review', status: 'IN_REVIEW', accent: 'var(--life-in-review)' },
  { id: 'READY_TO_COMMIT', title: 'READY_TO_COMMIT', lane: 'ready', status: 'READY_TO_COMMIT', accent: 'var(--life-ready)' },
  { id: 'COMMITTED', title: 'COMMITTED', lane: 'done', status: 'COMMITTED', accent: 'var(--life-committed)' },
  { id: 'SHIPPED', title: 'SHIPPED', lane: 'done', status: 'SHIPPED', accent: 'var(--life-shipped)' },
];

export const ENGINES = [
  { id: 'mock', label: 'mock (simulador)' },
  { id: 'claude', label: 'claude' },
  { id: 'antigravity', label: 'antigravity (agy)' },
  { id: 'codex', label: 'codex' },
  { id: 'cursor', label: 'cursor (agent)' },
];

export const DESTINATIONS = [
  { id: 'working_tree', label: 'Working tree local', levelC: false },
  { id: 'local_commit', label: 'Commit local', levelC: false },
  { id: 'pull_request', label: 'Pull Request', levelC: true },
  { id: 'deploy', label: 'Deploy', levelC: true },
];

export function isTerminalStatus(status) {
  return status === 'CANCELLED' || status === 'SUPERSEDED';
}

export function isBlockedStatus(status) {
  return typeof status === 'string' && status.startsWith('BLOCKED');
}

export function getTaskLane(task) {
  const status = task?.status || 'PLANNING';
  if (isBlockedStatus(status)) return 'blocked';
  if (isTerminalStatus(status)) return 'closed';
  if (status === 'IN_PROGRESS') return 'in_progress';
  if (status === 'IN_REVIEW') return 'in_review';
  if (status === 'READY_TO_COMMIT') return 'ready';
  if (status === 'COMMITTED' || status === 'SHIPPED') return 'done';

  // PLANNING maps to one of the 4 planning/queue lanes
  const explicit = task?.meta?.boardLane;
  if (explicit && ['planned', 'scheduled', 'to_fix', 'queued'].includes(explicit)) {
    return explicit;
  }
  if (task?.meta?.schedule?.day) return 'scheduled';
  if (task?.meta?.type === 'Bug' || task?.meta?.type === 'Hotfix') return 'to_fix';
  return 'planned';
}

export function getStatusLabel(status) {
  const map = {
    PLANNING: 'Planejamento',
    IN_PROGRESS: 'Em Execução',
    IN_REVIEW: 'Em Revisão',
    READY_TO_COMMIT: 'Pronto p/ Commit',
    COMMITTED: 'Comitado',
    SHIPPED: 'Publicado',
    BLOCKED: 'Bloqueada',
    CANCELLED: 'Cancelada',
    SUPERSEDED: 'Supersedida',
  };
  if (isBlockedStatus(status)) return 'Bloqueada';
  return map[status] || status || 'Planejamento';
}

export function getDestinationLabel(dest) {
  return DESTINATIONS.find((d) => d.id === dest)?.label || 'Working tree local';
}

export function isLevelCDestination(dest) {
  return dest === 'pull_request' || dest === 'deploy';
}

export function isTransitionAllowed(task, toLane, toStatus) {
  if (!task) return { allowed: false, reason: 'Tarefa inválida' };
  const from = task.status || 'PLANNING';
  if (isTerminalStatus(from)) {
    return { allowed: false, reason: 'Tarefas encerradas não podem ser movidas' };
  }
  if (isBlockedStatus(from)) {
    return { allowed: false, reason: 'Desbloqueie a tarefa antes de mover' };
  }

  // Moving among planning lanes
  if (['planned', 'scheduled', 'to_fix', 'queued'].includes(toLane) && toStatus === 'PLANNING') {
    if (from === 'PLANNING' || from === 'IN_PROGRESS') {
      return { allowed: true };
    }
    return { allowed: false, reason: `Não é possível voltar de ${from} para Planejamento` };
  }

  if (toStatus === 'IN_PROGRESS') {
    if (!task.valid) return { allowed: false, reason: 'Arquivo da tarefa possui erros de validação' };
    if (from === 'PLANNING' || from === 'IN_REVIEW' || from === 'IN_PROGRESS') return { allowed: true };
    return { allowed: false, reason: `Transição ${from} → IN_PROGRESS proibida` };
  }

  if (toStatus === 'IN_REVIEW') {
    if (from === 'IN_PROGRESS' || from === 'IN_REVIEW') return { allowed: true };
    return { allowed: false, reason: `Só é possível mover para Revisão a partir de Em Execução` };
  }

  if (toStatus === 'READY_TO_COMMIT') {
    if (task.meta?.tier === 'Prototype') {
      return { allowed: false, reason: 'Protótipos precisam ser promovidos para T2/T3 antes de Pronto' };
    }
    if (from === 'IN_REVIEW' || from === 'READY_TO_COMMIT') return { allowed: true };
    return { allowed: false, reason: `Transição ${from} → READY_TO_COMMIT proibida` };
  }

  if (toStatus === 'COMMITTED') {
    if (from === 'COMMITTED') return { allowed: true };
    return { allowed: false, reason: 'Somente @committer pode mover para COMMITTED' };
  }

  if (toStatus === 'SHIPPED') {
    if (from === 'COMMITTED') return { allowed: true, levelC: true };
    return { allowed: false, reason: 'Somente tarefas COMMITTED podem ser publicadas (SHIPPED)' };
  }

  return { allowed: true };
}

export function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatTimeShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatElapsed(isoStart) {
  if (!isoStart) return '00:00';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(isoStart).getTime()) / 1000));
  const mins = String(Math.floor(diff / 60)).padStart(2, '0');
  const secs = String(diff % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

export function formatRelativeTime(iso) {
  if (!iso) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'agora';
  if (diffSec < 3600) return `há ${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `há ${Math.floor(diffSec / 3600)}h`;
  return `há ${Math.floor(diffSec / 86400)}d`;
}

export function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayIso() {
  return toIsoDate(new Date());
}

export function getWeekDays(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat
  const diffToMon = (day === 0 ? -6 : 1 - day) + offsetWeeks * 7;
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
  const names = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const days = [];
  const todayIso = getTodayIso();
  for (let i = 0; i < 7; i++) {
    const dt = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
    const iso = toIsoDate(dt);
    days.push({
      iso,
      shortName: names[i],
      dayNum: String(dt.getDate()).padStart(2, '0'),
      monthShort: dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      isToday: iso === todayIso,
    });
  }
  return days;
}

export function formatDayShort(iso) {
  if (!iso) return '';
  const parts = String(iso).split('-').map(Number);
  if (parts.length !== 3) return iso;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  const wd = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${wd} ${String(parts[2]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}`;
}

export function isOverdue(task) {
  const day = task?.meta?.schedule?.day;
  if (!day) return false;
  if (['COMMITTED', 'SHIPPED', 'CANCELLED', 'SUPERSEDED'].includes(task.status)) return false;
  return day < getTodayIso();
}

function prioClass(prio) {
  const p = String(prio || 'P2').toLowerCase();
  if (['p0', 'p1', 'p2', 'p3'].includes(p)) return `badge-${p}`;
  return 'badge-p2';
}

function getPlatformStatusInfo(platform) {
  const raw = String(platform?.status || '').toLowerCase();
  if (raw === 'in_parity' || raw === 'synced' || raw === 'ok') {
    return { cls: 'badge-pass', label: platform.id === 'claude' ? 'Em paridade (canônica)' : 'Em paridade', iconName: 'check-circle' };
  }
  if (raw === 'drift' || raw === 'drifted') {
    return { cls: 'badge-warn', label: 'Drift detectado', iconName: 'alert-triangle' };
  }
  return { cls: 'badge-neutral', label: 'Não gerado', iconName: 'x-circle' };
}

/* ==========================================================================
   Reusable Collapsible Section ("Gaveta") — Progressive Disclosure
   ========================================================================== */

export function isAccordionOpen(ui, id, defaultOpen = false) {
  if (ui?.accordions && Object.prototype.hasOwnProperty.call(ui.accordions, id)) {
    return Boolean(ui.accordions[id]);
  }
  return Boolean(defaultOpen);
}

function renderAccordion({
  id,
  title,
  subtitle = '',
  iconName = '',
  badgesHtml = '',
  actionsHtml = '',
  bodyHtml = '',
  open = false,
  domId = '',
  className = '',
}) {
  const safeId = escapeHtml(id);
  const panelId = `acc-panel-${safeId}`;
  return `
    <section class="hub-accordion ${open ? 'is-open' : ''}${className ? ` ${escapeHtml(className)}` : ''}" ${domId ? `id="${escapeHtml(domId)}"` : ''} data-accordion="${safeId}">
      <div class="hub-accordion-head">
        <button
          type="button"
          class="hub-accordion-trigger"
          data-action="toggle-accordion"
          data-accordion-id="${safeId}"
          data-accordion-open="${open ? 'true' : 'false'}"
          aria-expanded="${open ? 'true' : 'false'}"
          aria-controls="${panelId}"
        >
          <span class="hub-accordion-chevron" aria-hidden="true">${icon('chevron-right', 15)}</span>
          ${iconName ? `<span class="hub-accordion-icon" aria-hidden="true">${icon(iconName, 15)}</span>` : ''}
          <span class="hub-accordion-heading">
            <span class="hub-accordion-title">${escapeHtml(title)}</span>
            ${subtitle ? `<span class="hub-accordion-sub">${escapeHtml(subtitle)}</span>` : ''}
          </span>
          ${badgesHtml ? `<span class="hub-accordion-badges">${badgesHtml}</span>` : ''}
        </button>
        ${actionsHtml ? `<div class="hub-accordion-actions">${actionsHtml}</div>` : ''}
      </div>
      <div class="hub-accordion-body" id="${panelId}" ${open ? '' : 'hidden'}>
        ${bodyHtml}
      </div>
    </section>
  `;
}

/* ==========================================================================
   View 1: Mission Control
   ========================================================================== */

export function renderMissionControl(state, ui) {
  const tasks = state.tasks || [];
  const activeRuns = state.activeRuns || [];
  const gates = state.gates || [];
  const incidents = state.incidents || { open: [], fixedCount: 0 };
  const adapters = state.adapters || { inParityCount: 0, total: 4, platforms: [] };
  const activity = state.activity || [];

  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const inReviewCount = tasks.filter((t) => t.status === 'IN_REVIEW').length;
  const blockedTasks = tasks.filter((t) => isBlockedStatus(t.status));
  const waitingUser = tasks.filter((t) => (t.needsFromUser && t.needsFromUser.trim()) || (isBlockedStatus(t.status) && t.meta?.blockedNeedsUser));
  const p0Open = tasks.filter((t) => t.meta?.priority === 'P0' && !['COMMITTED', 'SHIPPED', 'CANCELLED', 'SUPERSEDED'].includes(t.status)).length;
  const acTotal = tasks.reduce((acc, t) => acc + (t.acceptanceCriteria?.length || 0), 0);
  const acDone = tasks.reduce((acc, t) => acc + (t.acceptanceCriteria?.filter((a) => a.done).length || 0), 0);
  const acPct = acTotal > 0 ? Math.round((acDone / acTotal) * 100) : 0;

  const anyGateFail = gates.some((g) => g.status === 'fail');
  const passGateCount = gates.filter((g) => g.status === 'pass').length;
  const allGatesPass = gates.length > 0 && passGateCount === gates.length;
  const gateSummaryLabel = anyGateFail ? 'FAIL' : allGatesPass ? 'PASS' : 'Aguardando';
  const gateSummaryClass = anyGateFail ? 'is-danger' : allGatesPass ? 'is-pass' : '';

  const gatesPillHtml = anyGateFail
    ? `<span class="badge badge-danger mono">FAIL ${passGateCount}/${gates.length}</span>`
    : allGatesPass
    ? `<span class="badge badge-pass mono">PASS ${passGateCount}/${gates.length}</span>`
    : `<span class="badge badge-neutral mono">${passGateCount}/${gates.length}</span>`;

  const mcGatesOpen = isAccordionOpen(ui, 'mc-gates', anyGateFail);
  const mcIncidentsOpen = isAccordionOpen(ui, 'mc-incidents', (incidents.open || []).length > 0);
  const mcActivityOpen = isAccordionOpen(ui, 'mc-activity', false);

  const countsByStatus = {
    PLANNING: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    READY_TO_COMMIT: 0,
    COMMITTED: 0,
    SHIPPED: 0,
    BLOCKED: 0,
    CANCELLED: 0,
    SUPERSEDED: 0,
  };
  let bugCount = 0;
  let protoCount = 0;
  for (const t of tasks) {
    if (isBlockedStatus(t.status)) countsByStatus.BLOCKED += 1;
    else if (countsByStatus[t.status] !== undefined) countsByStatus[t.status] += 1;
    if (t.meta?.type === 'Bug' || t.meta?.type === 'Hotfix') bugCount += 1;
    if (t.meta?.tier === 'Prototype' || t.meta?.type === 'Prototype') protoCount += 1;
  }

  const lifecycleItems = [
    { key: 'PLANNING', label: 'Planejamento', color: 'var(--life-planning)', count: countsByStatus.PLANNING },
    { key: 'IN_PROGRESS', label: 'Em Execução', color: 'var(--life-in-progress)', count: countsByStatus.IN_PROGRESS },
    { key: 'IN_REVIEW', label: 'Em Revisão', color: 'var(--life-in-review)', count: countsByStatus.IN_REVIEW },
    { key: 'READY_TO_COMMIT', label: 'Pronto', color: 'var(--life-ready)', count: countsByStatus.READY_TO_COMMIT },
    { key: 'COMMITTED', label: 'Comitado', color: 'var(--life-committed)', count: countsByStatus.COMMITTED },
    { key: 'SHIPPED', label: 'Publicado', color: 'var(--life-shipped)', count: countsByStatus.SHIPPED },
    { key: 'BLOCKED', label: 'Bloqueadas', color: 'var(--life-blocked)', count: countsByStatus.BLOCKED },
    { key: 'CANCELLED', label: 'Canceladas', color: 'var(--life-terminal)', count: countsByStatus.CANCELLED + countsByStatus.SUPERSEDED },
  ];

  const writeDisabled = ui.disconnected ? 'disabled' : '';

  return `
    <div class="mc-stack">
      <!-- Quick Actions Bar -->
      <div class="mc-quick-actions">
        <div class="mc-quick-actions-left">
          <span class="badge badge-pill badge-neutral mono">${tasks.length} tarefas no repositório</span>
          <span class="badge badge-pill ${activeRuns.length > 0 ? 'badge-running' : 'badge-neutral'}">
            ${activeRuns.length > 0 ? '<span class="pulse-dot"></span>' : ''}
            ${activeRuns.length} ${activeRuns.length === 1 ? 'execução ativa' : 'execuções ativas'}
          </span>
          ${p0Open > 0 ? `<span class="badge badge-pill badge-p0">${p0Open} P0 abertas</span>` : ''}
        </div>
        <div class="mc-quick-actions-right">
          <button type="button" class="btn btn-primary btn-sm" data-action="open-new-task" ${writeDisabled}>
            ${icon('plus', 14)} Nova tarefa
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="run-gates" ${ui.runningGate || ui.disconnected ? 'disabled' : ''}>
            ${icon(ui.runningGate ? 'spinner' : 'play', 14, ui.runningGate ? 'spin' : '')} Rodar Gate
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="sync-all-adapters" ${ui.syncingAdapters || ui.disconnected ? 'disabled' : ''}>
            ${icon(ui.syncingAdapters ? 'spinner' : 'refresh', 14, ui.syncingAdapters ? 'spin' : '')} Sincronizar Multi-AI
          </button>
        </div>
      </div>

      <!-- KPI Row -->
      <div class="kpi-grid">
        <button type="button" class="kpi-card" data-action="goto-kanban-filter" data-filter="all">
          <div class="kpi-label"><span>Em Execução</span>${icon('play', 14)}</div>
          <div class="kpi-value ${inProgressCount + activeRuns.length > 0 ? 'is-running' : ''}">${inProgressCount}</div>
          <div class="kpi-sub">${inReviewCount} em revisão · ${activeRuns.length} runs</div>
        </button>

        <button type="button" class="kpi-card" data-action="goto-kanban-filter" data-filter="blocked">
          <div class="kpi-label"><span>Bloqueadas</span>${icon('ban', 14)}</div>
          <div class="kpi-value ${blockedTasks.length > 0 ? 'is-danger' : ''}">${blockedTasks.length}</div>
          <div class="kpi-sub">${waitingUser.length} aguardando você</div>
        </button>

        <button type="button" class="kpi-card" data-action="goto-kanban-filter" data-filter="in_review">
          <div class="kpi-label"><span>Em Revisão</span>${icon('check-circle', 14)}</div>
          <div class="kpi-value ${inReviewCount > 0 ? 'is-warn' : ''}">${inReviewCount}</div>
          <div class="kpi-sub">${countsByStatus.READY_TO_COMMIT} prontas p/ commit</div>
        </button>

        <button type="button" class="kpi-card" data-action="jump-gates">
          <div class="kpi-label"><span>Saúde dos Gates</span>${icon('terminal', 14)}</div>
          <div class="kpi-value ${gateSummaryClass}">${escapeHtml(gateSummaryLabel)}</div>
          <div class="kpi-sub">${gates.length} gates monitorados</div>
        </button>

        <button type="button" class="kpi-card" data-action="goto-kanban-filter" data-filter="all">
          <div class="kpi-label"><span>Progresso de ACs</span><span class="mono">${acPct}%</span></div>
          <div class="kpi-value">${acDone}<span style="font-size:var(--text-md);color:var(--text-muted)">/${acTotal}</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${acPct}%"></div></div>
        </button>

        <button type="button" class="kpi-card" data-nav-jump="adapters">
          <div class="kpi-label"><span>Paridade Multi-AI</span>${icon('cpu', 14)}</div>
          <div class="kpi-value ${adapters.inParityCount === adapters.total ? 'is-pass' : 'is-warn'}">${adapters.inParityCount}/${adapters.total}</div>
          <div class="kpi-sub">${adapters.inParityCount === adapters.total ? 'Todas sincronizadas' : 'Drift detectado'}</div>
        </button>
      </div>

      <!-- Lifecycle Strip -->
      <div class="lifecycle-strip" aria-label="Distribuição por status do ciclo">
        ${lifecycleItems
          .map(
            (item) => `
          <button type="button" class="lifecycle-chip" data-action="goto-kanban-filter" data-filter="status:${escapeHtml(item.key)}">
            <span class="lifecycle-dot" style="background:${item.color}"></span>
            <span>${escapeHtml(item.label)}</span>
            <strong class="mono tabular">${item.count}</strong>
          </button>
        `
          )
          .join('')}
        <button type="button" class="lifecycle-chip" data-action="goto-kanban-filter" data-filter="bug">
          ${icon('bug', 13)} <span>Correção</span> <strong class="mono tabular">${bugCount}</strong>
        </button>
        <button type="button" class="lifecycle-chip" data-action="goto-kanban-filter" data-filter="prototype">
          ${icon('flask', 13)} <span>Protótipo</span> <strong class="mono tabular">${protoCount}</strong>
        </button>
      </div>

      <!-- Asymmetric 2-Column Operational Grid -->
      <div class="mc-grid">
        <div class="mc-col">
          <!-- Em execução agora -->
          <section class="panel" aria-label="Em execução agora">
            <div class="panel-header">
              <h2 class="panel-title">${icon('play', 16)} Em execução agora</h2>
              <button type="button" class="btn btn-ghost btn-sm" data-action="toggle-console">Abrir Console</button>
            </div>
            ${
              tasks.length === 0
                ? `<div class="empty-state">
                    <div class="empty-state-icon">${icon('columns', 28)}</div>
                    <div class="empty-state-title">Nenhuma tarefa no repositório ainda</div>
                    <div class="empty-state-desc">Crie sua primeira tarefa ou importe issues abertas diretamente do GitHub Inbox.</div>
                    <div class="empty-state-actions">
                      <button type="button" class="btn btn-primary btn-sm" data-action="open-new-task" ${writeDisabled}>${icon('plus', 14)} Criar primeira tarefa</button>
                      <button type="button" class="btn btn-secondary btn-sm" data-nav-jump="github">${icon('github', 14)} Importar do GitHub Inbox</button>
                    </div>
                  </div>`
                : activeRuns.length === 0
                ? `<div class="empty-state">
                    <div class="empty-state-icon">${icon('terminal', 24)}</div>
                    <div class="empty-state-title">Nenhuma execução ativa no momento</div>
                    <div class="empty-state-desc">Arraste um card para Em Execução no Kanban com Auto-executar ativo para iniciar um agente.</div>
                    <div class="empty-state-actions">
                      <button type="button" class="btn btn-secondary btn-sm" data-nav-jump="kanban">Ir para o Kanban</button>
                    </div>
                  </div>`
                : `<div class="live-list">
                    ${activeRuns
                      .slice(0, 5)
                      .map((run) => {
                        const task = tasks.find((t) => t.id === run.taskId);
                        return `
                        <div class="live-row">
                          <div class="live-row-main">
                            <div class="live-row-title">${escapeHtml(task?.title || run.taskId)}</div>
                            <div class="live-row-meta">
                              <span class="badge badge-running"><span class="pulse-dot"></span> ${escapeHtml(run.step || 'Executando')}</span>
                              <span class="mono">${escapeHtml(run.agent || '@developer')}</span>
                              <span class="badge badge-neutral mono">${escapeHtml(run.engine || 'mock')}</span>
                              <span class="mono tabular" data-elapsed-start="${escapeHtml(run.startedAt)}">${formatElapsed(run.startedAt)}</span>
                            </div>
                          </div>
                          <div style="display:flex;gap:6px;">
                            <button type="button" class="btn btn-secondary btn-sm" data-action="focus-run" data-run-id="${escapeHtml(run.runId)}">Ver log</button>
                            <button type="button" class="btn btn-danger-outline btn-sm" data-action="stop-run" data-run-id="${escapeHtml(run.runId)}">${icon('stop', 12)} Parar</button>
                          </div>
                        </div>`;
                      })
                      .join('')}
                  </div>`
            }
          </section>

          <!-- Bloqueadas & Aguardando decisão -->
          <section class="panel" aria-label="Bloqueadas e aguardando decisão">
            <div class="panel-header">
              <h2 class="panel-title">${icon('ban', 16)} Bloqueadas &amp; Aguardando decisão</h2>
              <span class="badge ${blockedTasks.length > 0 ? 'badge-danger' : 'badge-neutral'} mono">${blockedTasks.length}</span>
            </div>
            ${
              blockedTasks.length === 0 && waitingUser.length === 0
                ? `<div class="panel-body"><p class="panel-subtitle">Nenhuma tarefa bloqueada ou aguardando decisão humana.</p></div>`
                : `<div class="live-list">
                    ${[...new Map([...blockedTasks, ...waitingUser].map((t) => [t.id, t])).values()]
                      .slice(0, 6)
                      .map(
                        (t) => `
                      <div class="live-row">
                        <div class="live-row-main">
                          <div class="live-row-title">${escapeHtml(t.title)}</div>
                          <div class="live-row-meta">
                            ${t.blockedFrom ? `<span class="badge badge-danger">estava em ${escapeHtml(t.blockedFrom)}</span>` : '<span class="badge badge-warn">Aguardando você</span>'}
                            <span>${escapeHtml(t.blockedReason || t.needsFromUser || 'Sem motivo registrado')}</span>
                          </div>
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm" data-action="open-task" data-task-id="${escapeHtml(t.id)}">Abrir tarefa</button>
                      </div>
                    `
                      )
                      .join('')}
                  </div>`
            }
          </section>

          <!-- Gates de Qualidade (Gaveta) -->
          ${renderAccordion({
            id: 'mc-gates',
            domId: 'mc-gates-panel',
            title: 'Gates de Qualidade',
            iconName: 'check-circle',
            badgesHtml: gatesPillHtml,
            open: mcGatesOpen,
            actionsHtml: `<button type="button" class="btn btn-secondary btn-sm" data-action="run-gates" ${ui.runningGate || ui.disconnected ? 'disabled' : ''}>
              ${icon(ui.runningGate ? 'spinner' : 'play', 13, ui.runningGate ? 'spin' : '')} Rodar todos
            </button>`,
            bodyHtml:
              gates.length === 0
                ? `<div class="panel-body"><p class="panel-subtitle">Nenhum gate declarado em CLAUDE.md.</p></div>`
                : `<div style="overflow-x:auto;">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Gate</th>
                          <th>Comando</th>
                          <th>Resultado</th>
                          <th>Última execução</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        ${gates
                          .map((g) => {
                            const badge =
                              g.status === 'pass'
                                ? `<span class="badge badge-pass">${icon('check-circle', 12)} PASS${g.warnings ? ` · ${g.warnings}w` : ''}</span>`
                                : g.status === 'fail'
                                ? `<span class="badge badge-danger">${icon('x-circle', 12)} FAIL</span>`
                                : `<span class="badge badge-neutral">Nunca executado</span>`;
                            return `
                            <tr>
                              <td><strong>${escapeHtml(g.name)}</strong></td>
                              <td class="mono" style="font-size:11px;color:var(--text-secondary)">${escapeHtml(g.command)}</td>
                              <td>${badge}</td>
                              <td class="mono tabular" style="font-size:11px;color:var(--text-muted)">${g.lastRunAt ? formatTimeShort(g.lastRunAt) : '—'}</td>
                              <td style="text-align:right">
                                <button type="button" class="btn btn-secondary btn-sm" data-action="run-gate-one" data-gate="${escapeHtml(g.name)}" ${ui.runningGate || ui.disconnected ? 'disabled' : ''}>Rodar</button>
                              </td>
                            </tr>
                            ${
                              g.status === 'fail' && g.tail
                                ? `<tr><td colspan="5"><details open><summary style="cursor:pointer;font-size:12px;color:var(--status-danger-text);font-weight:600;">Saída do erro (últimas linhas)</summary><pre class="gate-tail">${escapeHtml(g.tail)}</pre></details></td></tr>`
                                : ''
                            }`;
                          })
                          .join('')}
                      </tbody>
                    </table>
                  </div>`,
          })}
        </div>

        <div class="mc-col">
          <!-- Incidentes Recentes (Gaveta) -->
          ${renderAccordion({
            id: 'mc-incidents',
            title: 'Incidentes Recentes',
            iconName: 'alert-triangle',
            badgesHtml: `<span class="badge ${(incidents.open || []).length > 0 ? 'badge-danger' : 'badge-pass'} mono">${(incidents.open || []).length} abertos</span>${incidents.fixedCount ? `<span class="badge badge-neutral mono">${incidents.fixedCount} resolvidos</span>` : ''}`,
            open: mcIncidentsOpen,
            actionsHtml: `<button type="button" class="btn btn-ghost btn-sm" data-nav-jump="agents">Ver todos</button>`,
            bodyHtml:
              (incidents.open || []).length === 0
                ? `<div class="panel-body"><p class="panel-subtitle">Nenhum incidente aberto em <span class="mono">.specs/harness/incidents.jsonl</span>.</p></div>`
                : `<div class="live-list">
                    ${(incidents.open || [])
                      .slice(0, 4)
                      .map(
                        (inc) => `
                      <div class="live-row">
                        <div class="live-row-main">
                          <div class="live-row-title mono" style="font-size:12px;">${escapeHtml(inc.key || inc.id || 'incidente')}</div>
                          <div class="live-row-meta">
                            <span class="badge badge-warn">${escapeHtml(inc.layer || 'harness')}</span>
                            <span>${escapeHtml(inc.what || inc.summary || inc.description || '')}</span>
                          </div>
                        </div>
                      </div>
                    `
                      )
                      .join('')}
                  </div>`,
          })}

          <!-- Atividade Recente (Gaveta) -->
          ${renderAccordion({
            id: 'mc-activity',
            title: 'Atividade Recente',
            iconName: 'radar',
            badgesHtml: `<span class="badge badge-neutral mono">${Math.min(activity.length, 20)} eventos</span>`,
            open: mcActivityOpen,
            bodyHtml:
              activity.length === 0
                ? `<div class="panel-body"><p class="panel-subtitle">Nenhuma atividade registrada ainda.</p></div>`
                : `<div class="activity-feed">
                    ${activity
                      .slice(0, 20)
                      .map(
                        (evt) => `
                      <div class="activity-item">
                        <span class="activity-time mono">${formatTimeShort(evt.ts)}</span>
                        <div class="activity-body">
                          <span class="activity-actor">${escapeHtml(evt.actor === 'user' ? 'Usuário' : evt.actor || 'Sistema')}</span>
                          ${evt.engine ? `<span class="mono" style="color:var(--text-muted)"> · ${escapeHtml(evt.engine)}</span>` : ''}
                          — ${escapeHtml(evt.message || evt.type)}
                        </div>
                      </div>
                    `
                      )
                      .join('')}
                  </div>`,
          })}
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   View 2: Kanban & Backlog (Dual-Board + Unified)
   ========================================================================== */

function filterTasks(tasks, filters) {
  return tasks.filter((t) => {
    if (filters.quick === 'blocked' && !isBlockedStatus(t.status)) return false;
    if (filters.quick === 'bug' && t.meta?.type !== 'Bug' && t.meta?.type !== 'Hotfix') return false;
    if (filters.quick === 'prototype' && t.meta?.tier !== 'Prototype' && t.meta?.type !== 'Prototype') return false;
    if (filters.quick === 'waiting' && !(t.needsFromUser && t.needsFromUser.trim()) && !(isBlockedStatus(t.status) && t.meta?.blockedNeedsUser)) return false;
    if (filters.quick === 'p0' && t.meta?.priority !== 'P0') return false;
    if (filters.quick === 'closed' && !isTerminalStatus(t.status)) return false;
    if (filters.quick === 'in_review' && t.status !== 'IN_REVIEW') return false;
    if (filters.quick.startsWith('status:')) {
      const target = filters.quick.slice(7);
      if (target === 'BLOCKED') {
        if (!isBlockedStatus(t.status)) return false;
      } else if (target === 'CANCELLED') {
        if (!isTerminalStatus(t.status)) return false;
      } else if (t.status !== target) {
        return false;
      }
    }

    if (filters.agent && (t.meta?.assignee || '') !== filters.agent) return false;
    if (filters.priority && (t.meta?.priority || '') !== filters.priority) return false;
    if (filters.tier && (t.meta?.tier || '') !== filters.tier) return false;
    if (filters.engine && (t.meta?.aiEngine || '') !== filters.engine) return false;
    return true;
  });
}

export function renderTaskCard(task, state, ui, { compact = false } = {}) {
  const activeRun = (state.activeRuns || []).find((r) => r.taskId === task.id && r.status === 'running') || task.activeRun;
  const isRunning = Boolean(activeRun);
  const isInvalid = task.valid === false;
  const isTerminal = isTerminalStatus(task.status);
  const draggable = !isTerminal && !ui.disconnected;
  const prio = task.meta?.priority || 'P2';
  const tier = task.meta?.tier || 'T2';
  const acTotal = task.acceptanceCriteria?.length || 0;
  const acDone = task.acceptanceCriteria?.filter((a) => a.done).length || 0;
  const dest = task.meta?.schedule?.destination;
  const showLevelC = isLevelCDestination(dest) || task.status === 'COMMITTED';
  const overdue = isOverdue(task);

  const classes = ['task-card'];
  if (isRunning) classes.push('is-running');
  if (isInvalid) classes.push('is-invalid');

  return `
    <article
      class="${classes.join(' ')}"
      data-task-card="${escapeHtml(task.id)}"
      data-priority="${escapeHtml(prio)}"
      draggable="${draggable ? 'true' : 'false'}"
      tabindex="0"
      aria-label="${escapeHtml(task.title)} (${escapeHtml(prio)}, ${escapeHtml(getStatusLabel(task.status))})"
    >
      <div class="task-card-top">
        <div class="task-card-badges">
          <span class="badge ${prioClass(prio)} mono">${escapeHtml(prio)}</span>
          <span class="badge badge-neutral mono">${escapeHtml(tier)}</span>
          ${task.meta?.type === 'Bug' || task.meta?.type === 'Hotfix' ? `<span class="badge badge-warn">${icon('bug', 11)} Correção</span>` : ''}
          ${task.meta?.tier === 'Prototype' ? `<span class="badge badge-info">${icon('flask', 11)} Protótipo</span>` : ''}
          ${task.status === 'COMMITTED' ? `<span class="badge badge-pass">${icon('lock', 11)} Comitado</span>` : ''}
          ${task.status === 'SHIPPED' ? `<span class="badge badge-pass">${icon('rocket', 11)} Publicado</span>` : ''}
          ${showLevelC && task.status !== 'COMMITTED' ? `<span class="badge badge-warn">Level C</span>` : ''}
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-icon btn-sm"
          data-action="open-card-menu"
          data-task-id="${escapeHtml(task.id)}"
          aria-label="Ações da tarefa ${escapeHtml(task.title)}"
          title="Mover ou gerenciar tarefa (M)"
        >${icon('more-vertical', 14)}</button>
      </div>

      <div>
        <div class="task-card-title" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</div>
        <div class="task-card-id mono">
          <span>${escapeHtml(task.id)}</span>
          ${task.meta?.githubIssue?.number ? `<span class="badge badge-neutral mono">#${escapeHtml(task.meta.githubIssue.number)}</span>` : ''}
        </div>
      </div>

      ${
        isInvalid
          ? `<div class="task-card-invalid-msg">
              <span>${icon('x-circle', 12)} <strong>Inválido</strong> — ${escapeHtml(task.validationErrors?.[0] || 'Erro de schema')}</span>
              <span class="mono" style="opacity:0.85">${escapeHtml(task.filePath || '')}</span>
            </div>`
          : ''
      }

      ${
        isRunning
          ? `<div class="task-card-running-bar">
              <span style="display:inline-flex;align-items:center;gap:6px;min-width:0;overflow:hidden;text-overflow:ellipsis;">
                <span class="pulse-dot"></span>
                <span>${escapeHtml(activeRun.step || 'Executando')}</span>
              </span>
              <span style="display:inline-flex;align-items:center;gap:6px;">
                <span class="mono tabular" data-elapsed-start="${escapeHtml(activeRun.startedAt)}">${formatElapsed(activeRun.startedAt)}</span>
                <button type="button" class="btn btn-ghost btn-sm" style="height:20px;padding:0 6px;color:inherit;" data-action="focus-run" data-run-id="${escapeHtml(activeRun.runId)}">Log</button>
              </span>
            </div>`
          : ''
      }

      ${
        !compact
          ? `<div class="task-card-footer">
              <div class="task-card-footer-left">
                <span class="mono" style="color:${task.meta?.assignee ? 'var(--text-primary)' : 'var(--text-muted)'}">
                  ${escapeHtml(task.meta?.assignee || 'Sem agente')}
                </span>
                ${task.meta?.aiEngine ? `<span class="badge badge-neutral mono">${escapeHtml(task.meta.aiEngine)}</span>` : ''}
              </div>
              <div class="task-card-footer-right">
                ${acTotal > 0 ? `<span class="mono tabular" title="Critérios de aceite">${icon('check-circle', 11)} ${acDone}/${acTotal}</span>` : ''}
                ${
                  task.meta?.schedule?.day
                    ? `<span class="badge ${overdue ? 'badge-danger' : 'badge-neutral'} mono">${overdue ? 'Atrasada · ' : ''}${escapeHtml(formatDayShort(task.meta.schedule.day))}</span>`
                    : ''
                }
              </div>
            </div>`
          : ''
      }
    </article>
  `;
}

function renderInlineQuickCreate(laneId, roster) {
  const assignable = (roster || []).filter((a) => !a.readOnly && a.name !== '@committer');
  return `
    <form class="quick-create-card" data-quick-create-form="${escapeHtml(laneId)}">
      <input
        type="text"
        name="title"
        class="input input-sm"
        placeholder="Título da tarefa… (Enter cria)"
        required
        autocomplete="off"
        data-autofocus="true"
      />
      <div class="quick-create-row">
        <select name="priority" class="select select-sm" aria-label="Prioridade">
          <option value="P0">P0</option>
          <option value="P1">P1</option>
          <option value="P2" selected>P2</option>
          <option value="P3">P3</option>
        </select>
        <select name="assignee" class="select select-sm" aria-label="Agente responsável">
          <option value="">Sem agente</option>
          ${assignable.map((a) => `<option value="${escapeHtml(a.name)}" ${a.name === '@developer' ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
        </select>
      </div>
      <div class="quick-create-actions">
        <div style="display:flex;gap:6px;">
          <button type="submit" class="btn btn-primary btn-sm">Criar</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="close-quick-create">Cancelar</button>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-action="open-new-task" data-lane="${escapeHtml(laneId)}">Formulário</button>
      </div>
    </form>
  `;
}

function renderKanbanColumn(col, cards, state, ui, { allowQuickCreate = false } = {}) {
  const autoRunOn = Boolean(state.config?.autoRunOnInProgress);
  const isQuickOpen = ui.quickCreateLane === col.id;
  const writeDisabled = ui.disconnected ? 'disabled' : '';

  return `
    <div
      class="kanban-col"
      data-drop-lane="${escapeHtml(col.lane || col.id)}"
      data-drop-status="${escapeHtml(col.status)}"
      aria-label="Coluna ${escapeHtml(col.title)} (${cards.length})"
    >
      <div class="kanban-col-header" style="border-top-color:${col.accent};">
        <div class="kanban-col-title-wrap">
          <span class="kanban-col-title">${escapeHtml(col.title)}</span>
          <span class="kanban-col-count mono">${cards.length}</span>
        </div>
        ${
          allowQuickCreate
            ? `<button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="open-quick-create" data-lane="${escapeHtml(col.id)}" title="Nova tarefa em ${escapeHtml(col.title)}" aria-label="Nova tarefa em ${escapeHtml(col.title)}" ${writeDisabled}>${icon('plus', 14)}</button>`
            : ''
        }
      </div>
      ${
        (col.id === 'in_progress' || col.id === 'IN_PROGRESS') && autoRunOn
          ? `<div class="kanban-col-hint">Solte aqui para auto-executar agente</div>`
          : ''
      }
      <div class="kanban-col-body">
        ${isQuickOpen ? renderInlineQuickCreate(col.id, state.roster) : ''}
        ${
          cards.length === 0 && !isQuickOpen
            ? `<div class="kanban-col-empty">${escapeHtml(col.hint || 'Solte uma tarefa aqui')}</div>`
            : cards.map((t) => renderTaskCard(t, state, ui)).join('')
        }
      </div>
      ${
        allowQuickCreate && !isQuickOpen
          ? `<div class="kanban-col-footer">
              <button type="button" class="btn btn-ghost btn-sm col-quick-add-btn" data-action="open-quick-create" data-lane="${escapeHtml(col.id)}" ${writeDisabled}>
                ${icon('plus', 13)} Nova tarefa
              </button>
            </div>`
          : ''
      }
    </div>
  `;
}

export function renderKanban(state, ui) {
  const allTasks = state.tasks || [];
  const filtered = filterTasks(allTasks, ui.kanbanFilters);
  const blockedAll = allTasks.filter((t) => isBlockedStatus(t.status));
  const closedAll = allTasks.filter((t) => isTerminalStatus(t.status));
  const filteredBlocked = filtered.filter((t) => isBlockedStatus(t.status));
  const filteredClosed = filtered.filter((t) => isTerminalStatus(t.status));

  const autoRun = Boolean(state.config?.autoRunOnInProgress);
  const roster = state.roster || [];
  const hasFilters =
    ui.kanbanFilters.quick !== 'all' ||
    ui.kanbanFilters.agent ||
    ui.kanbanFilters.priority ||
    ui.kanbanFilters.tier ||
    ui.kanbanFilters.engine;

  const ghCount = ui.github?.loaded ? String((ui.github.issues || []).length) : '—';

  const toolbar = `
    <div class="kanban-toolbar">
      <div class="kanban-toolbar-row">
        <div class="segmented" role="tablist" aria-label="Modo de visualização do Kanban">
          <button type="button" role="tab" aria-selected="${ui.kanbanMode === 'dual'}" class="segmented-btn ${ui.kanbanMode === 'dual' ? 'is-active' : ''}" data-action="set-kanban-mode" data-mode="dual">
            Dois Quadros: Planejamento + Execução
          </button>
          <button type="button" role="tab" aria-selected="${ui.kanbanMode === 'unified'}" class="segmented-btn ${ui.kanbanMode === 'unified' ? 'is-active' : ''}" data-action="set-kanban-mode" data-mode="unified">
            Kanban Unificado
          </button>
        </div>

        <div class="kanban-ops">
          <label class="toggle-row" title="Quando ativo, mover um card para Em Execução dispara automaticamente o agente e abre o Console ao Vivo">
            <span class="toggle-label-text">Auto-executar</span>
            <button type="button" role="switch" aria-checked="${autoRun}" class="toggle ${autoRun ? 'is-checked' : ''}" data-action="toggle-autorun">
              <span class="toggle-thumb"></span>
            </button>
          </label>
          <button type="button" class="btn btn-secondary btn-sm" data-action="open-github-drawer">
            ${icon('github', 14)} GitHub Inbox <span class="badge badge-neutral mono">${escapeHtml(ghCount)}</span>
          </button>
          <button type="button" class="btn btn-primary btn-sm" data-action="open-new-task" ${ui.disconnected ? 'disabled' : ''}>
            ${icon('plus', 14)} Nova tarefa
          </button>
        </div>
      </div>

      <div class="kanban-toolbar-row">
        <div class="filter-pills" role="group" aria-label="Filtros rápidos">
          ${[
            { id: 'all', label: 'Todas' },
            { id: 'blocked', label: `Bloqueadas (${blockedAll.length})` },
            { id: 'bug', label: 'Em correção' },
            { id: 'prototype', label: 'Em prototipagem' },
            { id: 'waiting', label: 'Aguardando você' },
            { id: 'p0', label: 'P0' },
            { id: 'closed', label: `Canceladas / Descartadas (${closedAll.length})` },
          ]
            .map(
              (f) => `<button type="button" class="filter-pill ${ui.kanbanFilters.quick === f.id ? 'is-active' : ''}" data-action="set-quick-filter" data-filter="${f.id}">${escapeHtml(f.label)}</button>`
            )
            .join('')}
        </div>

        <div class="filter-selects">
          <select class="select select-sm" data-filter-select="agent" aria-label="Filtrar por agente">
            <option value="">Todos agentes</option>
            ${roster.map((a) => `<option value="${escapeHtml(a.name)}" ${ui.kanbanFilters.agent === a.name ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
          </select>
          <select class="select select-sm" data-filter-select="priority" aria-label="Filtrar por prioridade">
            <option value="">Prioridade</option>
            ${['P0', 'P1', 'P2', 'P3'].map((p) => `<option value="${p}" ${ui.kanbanFilters.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
          <select class="select select-sm" data-filter-select="tier" aria-label="Filtrar por tier">
            <option value="">Tier</option>
            ${['T2', 'T3', 'Hotfix', 'Prototype'].map((t) => `<option value="${t}" ${ui.kanbanFilters.tier === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
          <select class="select select-sm" data-filter-select="engine" aria-label="Filtrar por IA alvo">
            <option value="">IA alvo</option>
            ${ENGINES.map((e) => `<option value="${e.id}" ${ui.kanbanFilters.engine === e.id ? 'selected' : ''}>${e.id}</option>`).join('')}
          </select>
          ${hasFilters ? `<button type="button" class="btn btn-ghost btn-sm" data-action="clear-kanban-filters">Limpar</button>` : ''}
        </div>
      </div>
    </div>
  `;

  // If user specifically filtered for Canceladas / Descartadas
  if (ui.kanbanFilters.quick === 'closed') {
    return `
      ${toolbar}
      <section class="panel">
        <div class="panel-header">
          <h2 class="panel-title">${icon('ban', 16)} Canceladas &amp; Descartadas (${filteredClosed.length})</h2>
          <span class="panel-subtitle">Tarefas que você escolheu não executar ou substituiu por outra</span>
        </div>
        <div class="panel-body">
          ${
            filteredClosed.length === 0
              ? `<div class="empty-state"><div class="empty-state-title">Nenhuma tarefa cancelada ou supersedida</div></div>`
              : `<div class="closed-grid">${filteredClosed.map((t) => renderTaskCard(t, state, ui)).join('')}</div>`
          }
        </div>
      </section>
    `;
  }

  const blockedStrip =
    filteredBlocked.length > 0
      ? `
      <div class="blocked-strip" aria-label="Tarefas bloqueadas">
        <div class="blocked-strip-header">
          <span>${icon('ban', 15)} Bloqueadas (${filteredBlocked.length})</span>
          <span style="font-weight:500;font-size:12px;">Resolva o bloqueio e clique em Desbloquear para restaurar o status anterior</span>
        </div>
        <div class="blocked-cards-row">
          ${filteredBlocked
            .map(
              (t) => `
            <div class="task-card" data-task-card="${escapeHtml(t.id)}" data-priority="${escapeHtml(t.meta?.priority || 'P2')}">
              <div class="task-card-top">
                <div class="task-card-badges">
                  <span class="badge badge-danger">estava em ${escapeHtml(t.blockedFrom || 'PLANNING')}</span>
                  <span class="badge ${prioClass(t.meta?.priority)} mono">${escapeHtml(t.meta?.priority || 'P2')}</span>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" data-action="unblock-task" data-task-id="${escapeHtml(t.id)}" ${ui.disconnected ? 'disabled' : ''}>Desbloquear</button>
              </div>
              <div class="task-card-title">${escapeHtml(t.title)}</div>
              <div style="font-size:12px;color:var(--status-danger-text);">${escapeHtml(t.blockedReason || 'Motivo não informado')}</div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>`
      : '';

  const closedOpen = isAccordionOpen(ui, 'kanban-closed', Boolean(filteredClosed.length > 0 && ui.showClosed));
  const closedCollapsible = renderAccordion({
    id: 'kanban-closed',
    title: 'Canceladas / Descartadas',
    subtitle: 'O que você escolheu não fazer',
    iconName: 'ban',
    badgesHtml: `<span class="badge badge-neutral mono">${filteredClosed.length}</span>`,
    open: closedOpen,
    bodyHtml: `<div class="closed-grid" style="padding-top:12px;">
      ${
        filteredClosed.length === 0
          ? `<p class="panel-subtitle">Nenhuma tarefa cancelada ou supersedida.</p>`
          : filteredClosed.map((t) => renderTaskCard(t, state, ui)).join('')
      }
    </div>`,
  });

  if (ui.kanbanMode === 'unified') {
    return `
      ${toolbar}
      <div class="boards-stack">
        <section class="board-section board-unified">
          <div class="board-section-header">
            <div class="board-section-title-group">
              <h2 class="board-section-title">Kanban Unificado do Ciclo</h2>
              <span class="board-section-sub">6 colunas estritas do harness</span>
            </div>
          </div>
          <div class="kanban-columns">
            ${UNIFIED_COLUMNS.map((col) => {
              const cards = filtered.filter((t) => t.status === col.status);
              return renderKanbanColumn(col, cards, state, ui, { allowQuickCreate: col.status === 'PLANNING' });
            }).join('')}
          </div>
          ${blockedStrip}
        </section>
        ${closedCollapsible}
      </div>
    `;
  }

  // Dual-board default
  const planningTasksCount = filtered.filter((t) => ['planned', 'scheduled', 'to_fix'].includes(getTaskLane(t))).length;
  const execTasksCount = filtered.filter((t) => ['queued', 'in_progress', 'in_review', 'ready', 'done'].includes(getTaskLane(t))).length;
  const planningOpen = isAccordionOpen(ui, 'kanban-planning', true);
  const executionOpen = isAccordionOpen(ui, 'kanban-execution', true);

  return `
    ${toolbar}
    <div class="boards-stack">
      <!-- Quadro 1: Planejamento -->
      <section class="board-section board-planning ${planningOpen ? '' : 'is-collapsed'}" aria-label="Quadro de Planejamento">
        <div class="board-section-header">
          <div class="board-section-head-left">
            <button
              type="button"
              class="board-collapse-btn"
              data-action="toggle-accordion"
              data-accordion-id="kanban-planning"
              data-accordion-open="${planningOpen ? 'true' : 'false'}"
              aria-expanded="${planningOpen ? 'true' : 'false'}"
              aria-controls="board-body-planning"
              title="${planningOpen ? 'Recolher Quadro de Planejamento' : 'Expandir Quadro de Planejamento'}"
              aria-label="${planningOpen ? 'Recolher Quadro de Planejamento' : 'Expandir Quadro de Planejamento'}"
            >
              <span class="board-collapse-chevron" aria-hidden="true">${icon('chevron-right', 15)}</span>
            </button>
            <div class="board-section-title-group">
              <h2 class="board-section-title">Planejamento — O que eu quero fazer</h2>
              <span class="badge badge-neutral mono">${planningTasksCount}</span>
              <span class="board-section-sub">${planningOpen ? 'Arraste livremente entre colunas ou para Execução' : 'Recolhido · clique na seta para expandir'}</span>
            </div>
          </div>
          <div class="board-section-head-right">
            <button type="button" class="btn btn-secondary btn-sm" data-action="open-quick-create" data-lane="planned" ${ui.disconnected ? 'disabled' : ''}>
              ${icon('plus', 13)} Adição rápida
            </button>
          </div>
        </div>
        <div id="board-body-planning" ${planningOpen ? '' : 'hidden'}>
          <div class="kanban-columns">
            ${PLANNING_LANES.map((col) => {
              const cards = filtered.filter((t) => getTaskLane(t) === col.id);
              return renderKanbanColumn(col, cards, state, ui, { allowQuickCreate: true });
            }).join('')}
          </div>
        </div>
      </section>

      <!-- Quadro 2: Execução -->
      <section class="board-section board-execution ${executionOpen ? '' : 'is-collapsed'}" aria-label="Quadro de Execução dos Agentes">
        <div class="board-section-header">
          <div class="board-section-head-left">
            <button
              type="button"
              class="board-collapse-btn"
              data-action="toggle-accordion"
              data-accordion-id="kanban-execution"
              data-accordion-open="${executionOpen ? 'true' : 'false'}"
              aria-expanded="${executionOpen ? 'true' : 'false'}"
              aria-controls="board-body-execution"
              title="${executionOpen ? 'Recolher Quadro de Execução' : 'Expandir Quadro de Execução'}"
              aria-label="${executionOpen ? 'Recolher Quadro de Execução' : 'Expandir Quadro de Execução'}"
            >
              <span class="board-collapse-chevron" aria-hidden="true">${icon('chevron-right', 15)}</span>
            </button>
            <div class="board-section-title-group">
              <h2 class="board-section-title">Execução — O que está sendo feito pelos agentes</h2>
              <span class="badge badge-neutral mono">${execTasksCount}</span>
              <span class="board-section-sub">${executionOpen ? 'Pipeline vivo de agentes' : 'Recolhido · clique na seta para expandir'}</span>
            </div>
          </div>
          <div class="board-section-head-right">
            ${
              blockedAll.length > 0
                ? `<button type="button" class="badge badge-pill badge-danger" data-action="set-quick-filter" data-filter="blocked">${icon('ban', 12)} Bloqueadas (${blockedAll.length})</button>`
                : ''
            }
          </div>
        </div>
        <div id="board-body-execution" ${executionOpen ? '' : 'hidden'}>
          <div class="kanban-columns">
            ${EXECUTION_LANES.map((col) => {
              const cards = filtered.filter((t) => getTaskLane(t) === col.id);
              return renderKanbanColumn(col, cards, state, ui, { allowQuickCreate: col.id === 'queued' });
            }).join('')}
          </div>
          ${blockedStrip}
        </div>
      </section>

      ${closedCollapsible}
    </div>
  `;
}

/* ==========================================================================
   View 3: GitHub Inbox (Full View & Side Drawer)
   ========================================================================== */

export function renderGithubInbox(state, ui, { isDrawer = false } = {}) {
  const gh = ui.github || { loading: false, mode: 'demo', issues: [], error: null, hint: '' };
  const importedNums = new Set(
    (state.tasks || [])
      .map((t) => t.meta?.githubIssue ? `${t.meta.githubIssue.repo || ''}#${t.meta.githubIssue.number}` : null)
      .filter(Boolean)
  );

  const search = (ui.ghFilterSearch || '').toLowerCase();
  const kindFilter = ui.ghFilterKind || 'all';

  const issues = (gh.issues || []).filter((iss) => {
    const isPr = iss.kind === 'pr_review' || Boolean(iss.pull_request) || Boolean(iss.isPullRequest);
    if (kindFilter === 'issue' && isPr) return false;
    if (kindFilter === 'pr_review' && !isPr) return false;
    if (search) {
      const hay = `#${iss.number} ${iss.title} ${iss.repo || ''} ${(iss.labels || []).join(' ')}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const selected = issues.find((i) => `${i.repo}#${i.number}` === ui.ghSelectedKey) || issues[0] || null;
  const writeDisabled = ui.disconnected ? 'disabled' : '';

  const demoBanner =
    gh.mode === 'demo'
      ? `
      <div class="gh-banner">
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;align-items:center;gap:6px;">
            ${icon('alert-triangle', 15)}
            <strong>Modo Demo — GITHUB_TOKEN não configurado</strong>
          </div>
          <span>${escapeHtml(gh.hint || 'Defina GITHUB_TOKEN ou faça login com gh auth login para sincronizar issues reais.')}</span>
          <code class="mono" style="font-size:11px;opacity:0.9;">$env:GITHUB_TOKEN="ghp_..."</code>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-action="refresh-github">Testar conexão</button>
      </div>`
      : gh.mode === 'offline'
      ? `
      <div class="gh-banner">
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;align-items:center;gap:6px;">
            ${icon('alert-triangle', 15)}
            <strong>GitHub Offline</strong>
          </div>
          <span>${escapeHtml(gh.hint || 'Sem conexão com a API do GitHub no momento.')}</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-action="refresh-github">Tentar novamente</button>
      </div>`
      : '';

  const filtersBar = `
    <div class="gh-filters">
      <input type="search" class="input input-sm" style="flex:1;min-width:150px;" placeholder="Filtrar por #número, título ou label…" value="${escapeHtml(ui.ghFilterSearch || '')}" data-gh-search="true" />
      <select class="select select-sm" style="width:auto;" data-gh-kind="true" aria-label="Filtrar por tipo">
        <option value="all" ${kindFilter === 'all' ? 'selected' : ''}>Issues &amp; PRs</option>
        <option value="issue" ${kindFilter === 'issue' ? 'selected' : ''}>Somente Issues</option>
        <option value="pr_review" ${kindFilter === 'pr_review' ? 'selected' : ''}>PRs p/ Review</option>
      </select>
      <button type="button" class="btn btn-secondary btn-sm" data-action="refresh-github" ${gh.loading ? 'disabled' : ''}>
        ${icon(gh.loading ? 'spinner' : 'refresh', 13, gh.loading ? 'spin' : '')} Atualizar
      </button>
    </div>
  `;

  const listHtml = gh.loading
    ? `<div class="skeleton-page"><div class="skeleton-box" style="height:82px;"></div><div class="skeleton-box" style="height:82px;"></div><div class="skeleton-box" style="height:82px;"></div></div>`
    : gh.error
    ? `<div class="error-box"><strong>Erro ao consultar GitHub</strong><span>${escapeHtml(gh.error)}</span><div><button type="button" class="btn btn-secondary btn-sm" data-action="refresh-github">Tentar novamente</button></div></div>`
    : issues.length === 0
    ? `<div class="empty-state">
        <div class="empty-state-icon">${icon('github', 28)}</div>
        <div class="empty-state-title">Nenhum item encontrado no Inbox</div>
        <div class="empty-state-desc">Nenhuma issue aberta ou PR aguardando review corresponde ao filtro atual.</div>
      </div>`
    : `<div class="gh-list">
        ${issues
          .map((iss) => {
            const key = `${iss.repo || ''}#${iss.number}`;
            const isPr = iss.kind === 'pr_review' || Boolean(iss.pull_request) || Boolean(iss.isPullRequest);
            const already = importedNums.has(key);
            const isSel = !isDrawer && selected && `${selected.repo || ''}#${selected.number}` === key;
            const labels = (iss.labels || []).slice(0, 3);
            return `
            <article class="gh-item ${isSel ? 'is-selected' : ''}" data-gh-select="${escapeHtml(key)}" draggable="${!already && !ui.disconnected ? 'true' : 'false'}" data-gh-drag="${escapeHtml(key)}">
              <div class="gh-item-header">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  ${isPr ? `<span class="badge badge-info">${icon('git-pr', 11)} PR p/ Review</span>` : `<span class="badge badge-neutral">Issue</span>`}
                  <span class="mono" style="font-size:12px;color:var(--text-muted)">#${escapeHtml(iss.number)}</span>
                  ${iss.repo ? `<span class="mono" style="font-size:11px;color:var(--text-muted)">${escapeHtml(iss.repo)}</span>` : ''}
                  ${iss.demo ? `<span class="badge badge-warn">Demo</span>` : ''}
                </div>
                ${iss.updatedAt ? `<span style="font-size:11px;color:var(--text-muted)">${formatRelativeTime(iss.updatedAt)}</span>` : ''}
              </div>
              <div class="gh-item-title">${escapeHtml(iss.title)}</div>
              ${
                labels.length > 0
                  ? `<div style="display:flex;gap:5px;flex-wrap:wrap;">${labels.map((l) => `<span class="badge badge-neutral">${escapeHtml(typeof l === 'string' ? l : l.name)}</span>`).join('')}</div>`
                  : ''
              }
              <div class="gh-item-actions">
                ${
                  already
                    ? `<span class="badge badge-pass">${icon('check-circle', 11)} Importada</span>`
                    : `<button type="button" class="btn btn-secondary btn-sm" data-action="gh-import" data-gh-key="${escapeHtml(key)}" data-auto-run="false" ${writeDisabled}>
                        ${icon('plus', 12)} Importar p/ Planejamento
                      </button>
                      <button type="button" class="btn btn-primary btn-sm" data-action="gh-import" data-gh-key="${escapeHtml(key)}" data-auto-run="true" ${writeDisabled}>
                        ${icon('play', 12)} Importar e Executar
                      </button>`
                }
                ${(() => {
                  const safeUrl = safeHttpUrl(iss.url);
                  return safeUrl
                    ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" style="margin-left:auto;">${icon('external-link', 12)} GitHub</a>`
                    : '';
                })()}
              </div>
            </article>`;
          })
          .join('')}
      </div>`;

  if (isDrawer) {
    return `
      <div class="drawer-header">
        <div>
          <h2 class="modal-title">${icon('github', 18)} GitHub Inbox</h2>
          <p class="panel-subtitle">Importe em 1 clique ou arraste para Planejamento</p>
        </div>
        <button type="button" class="btn btn-ghost btn-icon" data-action="close-drawers" aria-label="Fechar GitHub Inbox">${icon('x', 16)}</button>
      </div>
      <div class="drawer-body">
        ${demoBanner}
        ${filtersBar}
        ${listHtml}
      </div>
    `;
  }

  return `
    <div>
      ${demoBanner}
      <div class="gh-layout">
        <div>
          ${filtersBar}
          ${listHtml}
        </div>
        <div class="panel">
          <div class="panel-header">
            <h2 class="panel-title">Prévia do Item</h2>
            ${selected?.mode === 'live' ? `<span class="badge badge-pass">Live GitHub</span>` : ''}
          </div>
          <div class="panel-body">
            ${
              !selected
                ? `<div class="empty-state"><div class="empty-state-title">Selecione uma issue ou PR</div></div>`
                : `<div style="display:flex;flex-direction:column;gap:12px;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                      <span class="mono" style="color:var(--text-muted)">#${escapeHtml(selected.number)}</span>
                      <span class="mono" style="color:var(--text-muted)">${escapeHtml(selected.repo || '')}</span>
                      ${selected.kind === 'pr_review' || selected.pull_request ? `<span class="badge badge-info">${icon('git-pr', 11)} PR aguardando review</span>` : '<span class="badge badge-neutral">Issue</span>'}
                    </div>
                    <h3 style="font-size:var(--text-md);">${escapeHtml(selected.title)}</h3>
                    <div class="gh-preview-body">${escapeHtml(selected.body || 'Sem descrição detalhada.')}</div>
                  </div>`
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   View 4: Fila de Demanda
   ========================================================================== */

export function renderQueueView(state, ui) {
  const queue = state.queue || { eligible: [], ineligible: [] };
  const agentFilter = ui.queueAgentFilter || '';
  const typeFilter = ui.queueTypeFilter || 'all';
  const roster = state.roster || [];

  const filterItem = (item) => {
    const agent = item.targetAgent || item.agent;
    const dType = item.kind || item.demandType || item.type || 'build';
    if (agentFilter && agent !== agentFilter) return false;
    if (typeFilter !== 'all' && dType !== typeFilter) return false;
    return true;
  };

  const eligible = (queue.eligible || []).filter(filterItem);
  const ineligible = (queue.ineligible || []).filter(filterItem);

  const seenAgentFirst = new Set();

  return `
    <div style="display:flex;flex-direction:column;gap:var(--space-4);">
      <div class="queue-toolbar">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <select class="select select-sm" style="width:auto;" data-queue-agent="true" aria-label="Filtrar fila por agente">
            <option value="">Todos os agentes</option>
            ${roster.map((a) => `<option value="${escapeHtml(a.name)}" ${agentFilter === a.name ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
          </select>
          <div class="filter-pills">
            ${[
              { id: 'all', label: 'Todos' },
              { id: 'build', label: 'Construir' },
              { id: 'review', label: 'Revisar' },
              { id: 'commit', label: 'Comitar' },
            ]
              .map(
                (t) => `<button type="button" class="filter-pill ${typeFilter === t.id ? 'is-active' : ''}" data-action="set-queue-type" data-type="${t.id}">${t.label}</button>`
              )
              .join('')}
          </div>
        </div>
        <span class="queue-legend">Ordenação: Prioridade P0→P3 · Hoje primeiro · Ordem manual · Mais antiga</span>
      </div>

      <section class="panel">
        <div class="panel-header">
          <h2 class="panel-title">${icon('list-ordered', 16)} Elegíveis na Fila (${eligible.length})</h2>
        </div>
        ${
          eligible.length === 0
            ? `<div class="empty-state">
                <div class="empty-state-icon">${icon('list-ordered', 28)}</div>
                <div class="empty-state-title">Fila vazia — nenhuma tarefa elegível no momento</div>
                <div class="empty-state-desc">Atribua um agente a uma tarefa válida em Planejamento para que ela apareça aqui.</div>
                <div class="empty-state-actions"><button type="button" class="btn btn-secondary btn-sm" data-nav-jump="kanban">Ir para o Kanban</button></div>
              </div>`
            : `<div style="overflow-x:auto;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Posição</th>
                      <th>Demanda</th>
                      <th>Tarefa</th>
                      <th>Agente</th>
                      <th>IA / Agenda</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${eligible
                      .map((item, idx) => {
                        const agent = item.targetAgent || item.agent;
                        const dType = item.kind || item.demandType || item.type || 'build';
                        const isFirstForAgent = Boolean(item.isNext) || (Boolean(agent) && !seenAgentFirst.has(agent));
                        if (agent) seenAgentFirst.add(agent);
                        const schedDay = item.scheduleDay || item.scheduledDay;
                        const typeBadge =
                          dType === 'commit'
                            ? `<span class="badge badge-pass">${icon('lock', 11)} Comitar</span>`
                            : dType === 'review'
                            ? `<span class="badge badge-warn">Revisar</span>`
                            : `<span class="badge badge-accent">Construir</span>`;
                        return `
                        <tr>
                          <td class="mono tabular">
                            #${idx + 1}
                            ${isFirstForAgent ? `<span class="badge badge-pass" style="margin-left:4px;">Próximo</span>` : ''}
                          </td>
                          <td>${typeBadge}</td>
                          <td>
                            <div style="font-weight:600;">${escapeHtml(item.title || item.taskId)}</div>
                            <div style="display:flex;gap:5px;margin-top:3px;">
                              <span class="badge ${prioClass(item.priority)} mono">${escapeHtml(item.priority || 'P2')}</span>
                              <span class="badge badge-neutral mono">${escapeHtml(item.tier || 'T2')}</span>
                            </div>
                          </td>
                          <td class="mono">${escapeHtml(agent || '—')}</td>
                          <td class="mono" style="font-size:12px;color:var(--text-secondary)">
                            ${escapeHtml(item.aiEngine || 'mock')} ${schedDay ? `· ${escapeHtml(formatDayShort(schedDay))}` : ''}
                          </td>
                          <td style="text-align:right;white-space:nowrap;">
                            <button type="button" class="btn btn-secondary btn-sm" data-action="open-task" data-task-id="${escapeHtml(item.taskId)}">Abrir</button>
                            <button type="button" class="btn btn-primary btn-sm" data-action="run-task-now" data-task-id="${escapeHtml(item.taskId)}" ${ui.disconnected ? 'disabled' : ''}>${icon('play', 12)} Executar</button>
                          </td>
                        </tr>`;
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>`
        }
      </section>

      <details class="panel" ${ineligible.length > 0 ? 'open' : ''}>
        <summary class="panel-header" style="cursor:pointer;list-style:none;">
          <h2 class="panel-title">${icon('alert-triangle', 16)} Não Elegíveis (${ineligible.length})</h2>
          <span class="panel-subtitle">Tarefas bloqueadas por regra, sem agente ou agendadas para data futura</span>
        </summary>
        ${
          ineligible.length === 0
            ? `<div class="panel-body"><p class="panel-subtitle">Nenhum item inelegível.</p></div>`
            : `<div class="live-list">
                ${ineligible
                  .map(
                    (item) => `
                  <div class="live-row">
                    <div class="live-row-main">
                      <div class="live-row-title">${escapeHtml(item.title || item.taskId)}</div>
                      <div class="live-row-meta">
                        <span class="badge badge-danger">${escapeHtml(item.reason || 'Inelegível')}</span>
                        <span class="mono">${escapeHtml(item.taskId)}</span>
                      </div>
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm" data-action="open-task" data-task-id="${escapeHtml(item.taskId)}">Corrigir</button>
                  </div>
                `
                  )
                  .join('')}
              </div>`
        }
      </details>
    </div>
  `;
}

/* ==========================================================================
   View 5: Agenda Semanal (Seg–Dom)
   ========================================================================== */

export function renderScheduleView(state, ui) {
  const days = getWeekDays(ui.scheduleWeekOffset || 0);
  const rangeLabel = `${days[0].dayNum} ${days[0].monthShort} – ${days[6].dayNum} ${days[6].monthShort}`;
  const tasks = (state.tasks || []).filter((t) => !isTerminalStatus(t.status));
  const unscheduled = tasks.filter((t) => !t.meta?.schedule?.day);

  const search = (ui.scheduleSearch || '').toLowerCase();
  const filteredUnscheduled = unscheduled.filter((t) =>
    !search || t.title.toLowerCase().includes(search) || t.id.toLowerCase().includes(search)
  );

  return `
    <div>
      <div class="schedule-header">
        <div class="schedule-nav">
          <button type="button" class="btn btn-secondary btn-sm" data-action="schedule-week" data-delta="-1">${icon('chevron-left', 14)} Anterior</button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="schedule-week" data-delta="0">Hoje</button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="schedule-week" data-delta="1">Próxima ${icon('chevron-right', 14)}</button>
          <strong style="margin-left:8px;font-size:var(--text-base);">${escapeHtml(rangeLabel)}</strong>
        </div>
        <span class="panel-subtitle">Arraste uma tarefa para qualquer dia ou clique em um bloco para reagendar</span>
      </div>

      <div class="schedule-layout">
        <!-- Unscheduled Sidebar -->
        <aside class="panel unscheduled-panel" aria-label="Tarefas não agendadas">
          <div class="panel-header">
            <h2 class="panel-title">Não agendadas (${unscheduled.length})</h2>
          </div>
          <div style="padding:10px 10px 0;">
            <input type="search" class="input input-sm" placeholder="Buscar tarefa…" value="${escapeHtml(ui.scheduleSearch || '')}" data-schedule-search="true" />
          </div>
          <div class="unscheduled-list">
            ${
              filteredUnscheduled.length === 0
                ? `<p class="panel-subtitle" style="padding:8px;">Todas as tarefas abertas estão agendadas.</p>`
                : filteredUnscheduled
                    .map(
                      (t) => `
                  <div class="sched-card" draggable="${!ui.disconnected ? 'true' : 'false'}" data-schedule-drag="${escapeHtml(t.id)}" data-action="open-schedule-modal" data-task-id="${escapeHtml(t.id)}">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                      <span class="badge ${prioClass(t.meta?.priority)} mono">${escapeHtml(t.meta?.priority || 'P2')}</span>
                      <span class="mono" style="color:var(--text-muted)">${escapeHtml(t.meta?.assignee || 'Sem agente')}</span>
                    </div>
                    <div class="sched-card-title">${escapeHtml(t.title)}</div>
                  </div>
                `
                    )
                    .join('')
            }
          </div>
        </aside>

        <!-- 7-Day Grid -->
        <div class="schedule-grid">
          ${days
            .map((day) => {
              const dayTasks = tasks.filter((t) => t.meta?.schedule?.day === day.iso);
              return `
              <div class="day-col ${day.isToday ? 'is-today' : ''}" data-schedule-drop-day="${escapeHtml(day.iso)}">
                <div class="day-col-header">
                  <span class="day-col-name">${escapeHtml(day.shortName)} <span class="mono tabular">${escapeHtml(day.dayNum)}</span></span>
                  ${day.isToday ? `<span class="badge badge-accent">Hoje</span>` : `<span class="mono tabular" style="font-size:11px;color:var(--text-muted)">${dayTasks.length}</span>`}
                </div>
                <div class="day-col-body">
                  ${
                    dayTasks.length === 0
                      ? `<span style="font-size:11px;color:var(--text-muted);text-align:center;padding:18px 4px;">Livre</span>`
                      : dayTasks
                          .map((t) => {
                            const sch = t.meta?.schedule || {};
                            const dest = sch.destination || 'working_tree';
                            const levelC = isLevelCDestination(dest);
                            const overdue = isOverdue(t);
                            const done = t.status === 'COMMITTED' || t.status === 'SHIPPED';
                            return `
                            <article class="sched-card" draggable="${!ui.disconnected ? 'true' : 'false'}" data-schedule-drag="${escapeHtml(t.id)}" data-action="open-schedule-modal" data-task-id="${escapeHtml(t.id)}">
                              <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;flex-wrap:wrap;">
                                <span class="badge ${prioClass(t.meta?.priority)} mono">${escapeHtml(t.meta?.priority || 'P2')}</span>
                                ${done ? `<span class="badge badge-pass">Concluída</span>` : overdue ? `<span class="badge badge-danger">Atrasada</span>` : ''}
                              </div>
                              <div class="sched-card-title">${escapeHtml(t.title)}</div>
                              <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
                                <span class="mono" style="color:var(--text-secondary)">${escapeHtml(sch.agent || t.meta?.assignee || 'Sem agente')}</span>
                                <span class="badge badge-neutral mono">${escapeHtml(sch.aiEngine || t.meta?.aiEngine || 'mock')}</span>
                              </div>
                              <div>
                                <span class="badge ${levelC ? 'badge-warn' : 'badge-neutral'}">
                                  ${levelC ? icon('alert-triangle', 11) : ''} ${escapeHtml(getDestinationLabel(dest))}${levelC ? ' · Level C' : ''}
                                </span>
                              </div>
                            </article>`;
                          })
                          .join('')
                  }
                </div>
              </div>`;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   View 6: Agentes & Incidentes
   ========================================================================== */

export function renderAgentsView(state, ui = {}) {
  const roster = state.roster || [];
  const incidents = state.incidents || { open: [], fixed: [], fixedCount: 0 };
  const openIncidents = Array.isArray(incidents.open) ? incidents.open : [];
  const fixedIncidents = Array.isArray(incidents.fixed) ? incidents.fixed : [];
  const fixedCount = incidents.fixedCount ?? fixedIncidents.length;
  const activeRuns = state.activeRuns || [];
  const tasks = state.tasks || [];

  const enrichedRoster = roster.map((agent) => {
    const run = activeRuns.find((r) => r.agent === agent.name && r.status === 'running');
    const isRunning = Boolean(run) || agent.status === 'active' || agent.status === 'running';
    const isBlocked = agent.status === 'blocked';
    const currentTask = tasks.find((t) => t.id === (run?.taskId || agent.currentTaskId));
    return { agent, run, isRunning, isBlocked, currentTask };
  });

  const activeCount = enrichedRoster.filter((x) => x.isRunning).length;
  const idleCount = Math.max(0, enrichedRoster.length - activeCount);

  const rosterOpen = isAccordionOpen(ui, 'agents-roster', activeCount > 0);
  const openIncOpen = isAccordionOpen(ui, 'agents-incidents-open', openIncidents.length > 0);
  const fixedIncOpen = isAccordionOpen(ui, 'agents-incidents-fixed', false);

  // Active agents first, then alphabetical/roster order
  const sortedRoster = [
    ...enrichedRoster.filter((x) => x.isRunning),
    ...enrichedRoster.filter((x) => !x.isRunning && x.isBlocked),
    ...enrichedRoster.filter((x) => !x.isRunning && !x.isBlocked),
  ];

  const sortedFixed = [...fixedIncidents].sort((a, b) =>
    String(b.fixed || b.last || b.date || '').localeCompare(String(a.fixed || a.last || a.date || ''))
  );

  const rosterBody =
    sortedRoster.length === 0
      ? `<div class="panel-body"><p class="panel-subtitle">Nenhum agente encontrado em <span class="mono">AGENTS.md</span>.</p></div>`
      : `<div class="agent-roster-list" role="list">
          ${sortedRoster
            .map(({ agent, isRunning, isBlocked, currentTask }) => {
              const statusBadge = isRunning
                ? `<span class="badge badge-running"><span class="pulse-dot"></span> Executando</span>`
                : isBlocked
                ? `<span class="badge badge-danger">${icon('ban', 11)} Bloqueado</span>`
                : `<span class="badge badge-neutral">Ocioso</span>`;

              const roleText = currentTask
                ? `${agent.role || 'Especialista'} · ${currentTask.title}`
                : agent.role || 'Especialista do time';

              return `
              <button type="button" class="agent-row ${isRunning ? 'is-running' : ''}" role="listitem" data-action="open-agent-drawer" data-agent="${escapeHtml(agent.name)}" title="Abrir histórico e detalhes de ${escapeHtml(agent.name)}">
                <span class="agent-row-name mono">${escapeHtml(agent.name)}</span>
                <span class="agent-row-role">${escapeHtml(roleText)}</span>
                <span class="agent-row-status">
                  ${statusBadge}
                  <span class="agent-row-chevron" aria-hidden="true">${icon('chevron-right', 14)}</span>
                </span>
              </button>`;
            })
            .join('')}
        </div>`;

  const openIncBody =
    openIncidents.length === 0
      ? `<div class="panel-body"><p class="panel-subtitle">Nenhum incidente aberto em <span class="mono">.specs/harness/incidents.jsonl</span>.</p></div>`
      : `<div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Chave</th>
                <th>Camada</th>
                <th>Descrição</th>
                <th>Local</th>
              </tr>
            </thead>
            <tbody>
              ${openIncidents
                .map(
                  (inc) => `
                <tr>
                  <td class="mono" style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${escapeHtml(String(inc.last || inc.first || inc.ts || inc.date || '').slice(0, 10) || '—')}</td>
                  <td class="mono" style="font-weight:600;">${escapeHtml(inc.key || inc.id || '—')}</td>
                  <td><span class="badge badge-warn">${escapeHtml(inc.layer || 'harness')}</span></td>
                  <td>${escapeHtml(inc.what || inc.summary || inc.description || inc.message || '')}</td>
                  <td class="mono" style="font-size:11px;color:var(--text-muted)">${escapeHtml(inc.where || inc.location || inc.file || '—')}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

  const fixedIncBody =
    sortedFixed.length === 0
      ? `<div class="panel-body"><p class="panel-subtitle">${fixedCount > 0 ? `${fixedCount} incidentes corrigidos registrados no histórico.` : 'Nenhum incidente resolvido registrado.'}</p></div>`
      : `<div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Corrigido</th>
                <th>Chave</th>
                <th>Camada</th>
                <th>Correção / Descrição</th>
              </tr>
            </thead>
            <tbody>
              ${sortedFixed
                .map(
                  (inc) => `
                <tr>
                  <td class="mono" style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${escapeHtml(String(inc.fixed || inc.last || inc.date || '').slice(0, 10) || '—')}</td>
                  <td class="mono" style="font-weight:600;">${escapeHtml(inc.key || inc.id || '—')}</td>
                  <td><span class="badge badge-neutral">${escapeHtml(inc.layer || 'harness')}</span></td>
                  <td>${escapeHtml(inc.fix || inc.what || inc.summary || inc.description || '—')}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

  return `
    <div class="agents-stack">
      <!-- Compact Top Summary Bar -->
      <div class="agents-summary-strip" aria-label="Resumo de agentes e incidentes">
        <div class="agents-stat-chip">
          <span class="agents-stat-label">Ativos</span>
          <span class="agents-stat-val mono tabular ${activeCount > 0 ? 'is-running' : ''}">${activeCount}</span>
        </div>
        <div class="agents-stat-chip">
          <span class="agents-stat-label">Ociosos</span>
          <span class="agents-stat-val mono tabular">${idleCount}</span>
        </div>
        <div class="agents-stat-chip">
          <span class="agents-stat-label">Incidentes Abertos</span>
          <span class="agents-stat-val mono tabular ${openIncidents.length > 0 ? 'is-danger' : 'is-pass'}">${openIncidents.length}</span>
        </div>
        <div class="agents-stat-chip">
          <span class="agents-stat-label">Resolvidos</span>
          <span class="agents-stat-val mono tabular">${fixedCount}</span>
        </div>
      </div>

      <!-- Gaveta 1: Elenco de Agentes -->
      ${renderAccordion({
        id: 'agents-roster',
        title: 'Elenco de Agentes',
        subtitle: 'Clique em um especialista para ver histórico, modelo e governança',
        iconName: 'users',
        badgesHtml: `<span class="badge badge-neutral mono">${roster.length} especialistas</span>${
          activeCount > 0
            ? `<span class="badge badge-running"><span class="pulse-dot"></span> ${activeCount} ${activeCount === 1 ? 'ativo' : 'ativos'}</span>`
            : ''
        }`,
        open: rosterOpen,
        bodyHtml: rosterBody,
      })}

      <!-- Gaveta 2: Incidentes Abertos -->
      ${renderAccordion({
        id: 'agents-incidents-open',
        title: 'Incidentes Abertos',
        subtitle: openIncidents.length > 0 ? 'Falhas de harness pendentes de correção' : 'Nenhum bloqueio de harness aberto',
        iconName: 'alert-triangle',
        badgesHtml: `<span class="badge ${openIncidents.length > 0 ? 'badge-danger' : 'badge-pass'} mono">${openIncidents.length}</span>`,
        open: openIncOpen,
        bodyHtml: openIncBody,
      })}

      <!-- Gaveta 3: Histórico de Incidentes Resolvidos -->
      ${renderAccordion({
        id: 'agents-incidents-fixed',
        title: 'Histórico de Incidentes Resolvidos',
        subtitle: 'Registro histórico de correções aplicadas ao harness',
        iconName: 'check-circle',
        badgesHtml: `<span class="badge badge-pass mono">${fixedCount}</span>`,
        open: fixedIncOpen,
        bodyHtml: fixedIncBody,
      })}
    </div>
  `;
}

/* ==========================================================================
   View 7: Hub Multi-AI & Prompt Amplifier
   ========================================================================== */

export function renderAdaptersView(state, ui) {
  const adapters = state.adapters || { inParityCount: 0, total: 4, platforms: [], includesPromptAmplifier: true };
  const platforms = adapters.platforms || [];
  const canonicalOpen = isAccordionOpen(ui, 'adapters-canonical', false);

  const hashRows = [];
  if (adapters.canonicalHash) {
    hashRows.push({
      platform: 'Fonte Canônica',
      path: 'CLAUDE.md + .claude/rules/*.md',
      hash: adapters.canonicalHash,
      state: 'in_parity',
    });
  }
  for (const p of platforms) {
    for (const f of p.files || []) {
      const h = f.actualSha256 || f.canonicalSha256 || '';
      if (h) {
        hashRows.push({
          platform: p.name || p.id,
          path: f.path,
          hash: h,
          state: f.state || 'ok',
        });
      }
    }
  }

  const canonicalDrawerBody = `
    <div class="amplifier-drawer-body">
      <div class="amplifier-grid">
        <div class="amplifier-step">
          <span class="amplifier-num">01 · UNASKED EXPERTISE</span>
          <div class="amplifier-step-title">Especialista de topo</div>
          <div class="amplifier-step-desc">O que um especialista sênior faria aqui que não foi pedido explicitamente?</div>
        </div>
        <div class="amplifier-step">
          <span class="amplifier-num">02 · RAWEST MATERIAL</span>
          <div class="amplifier-step-title">Fonte mais crua primeiro</div>
          <div class="amplifier-step-desc">Qual fonte primária ler antes de propor? Código rodando, logs reais, erro real, schema.</div>
        </div>
        <div class="amplifier-step">
          <span class="amplifier-num">03 · METHODS AND TOOLS</span>
          <div class="amplifier-step-title">Métodos e ferramentas</div>
          <div class="amplifier-step-desc">Quais técnicas e validadores nomeados aplicar (ex.: validate-task, gate.mjs, node --test)?</div>
        </div>
        <div class="amplifier-step">
          <span class="amplifier-num">04 · EXTERNAL PROOF</span>
          <div class="amplifier-step-title">Oráculo externo</div>
          <div class="amplifier-step-desc">O que, além do agente ou do usuário, prova objetivamente que o resultado funciona?</div>
        </div>
      </div>

      <div class="amplifier-footer">
        <code class="mono">Amplified: &lt;tarefa reescrita&gt; · proof: &lt;oráculo&gt;</code>
        <span style="color:#94A3B8;">Deeper, not bigger — aguça método, fontes e prova sem inflar escopo.</span>
      </div>

      ${
        hashRows.length > 0
          ? `<div class="adapters-hashes-block">
              <div class="adapters-hashes-title">Hashes SHA-256 de Paridade</div>
              <div style="overflow-x:auto;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Plataforma</th>
                      <th>Arquivo</th>
                      <th>SHA-256</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${hashRows
                      .map(
                        (r) => `
                      <tr>
                        <td><strong>${escapeHtml(r.platform)}</strong></td>
                        <td class="mono" style="font-size:11px;color:var(--text-secondary)">${escapeHtml(r.path)}</td>
                        <td class="mono" style="font-size:11px;color:var(--text-muted)">${escapeHtml(String(r.hash).slice(0, 20))}…</td>
                      </tr>`
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </div>`
          : ''
      }
    </div>
  `;

  return `
    <div class="adapters-stack">
      <div class="adapters-header">
        <div>
          <h2 style="font-size:var(--text-md);">Hub Multi-AI — Paridade &amp; Projeções</h2>
          <p class="panel-subtitle">
            <strong class="mono">${adapters.inParityCount}/${adapters.total}</strong> plataformas em paridade com a fonte canônica
          </p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary btn-sm" data-action="refresh-adapters">
            ${icon('refresh', 13)} Reverificar CLIs
          </button>
          <button type="button" class="btn btn-primary btn-sm" data-action="sync-all-adapters" ${ui.syncingAdapters || ui.disconnected ? 'disabled' : ''}>
            ${icon(ui.syncingAdapters ? 'spinner' : 'refresh', 14, ui.syncingAdapters ? 'spin' : '')} Sincronizar todas as IAs
          </button>
        </div>
      </div>

      <div class="adapters-grid">
        ${platforms
          .map((p) => {
            const st = getPlatformStatusInfo(p);
            const files = p.files || [];
            const targetPaths =
              files.length === 0
                ? [{ path: 'CLAUDE.md + .claude/rules/*.md', badge: '<span class="badge badge-pass">canônica</span>' }]
                : files.map((f) => {
                    const fState = String(f.state || 'ok').toLowerCase();
                    const fBadge =
                      fState === 'in_parity' || fState === 'synced' || fState === 'ok'
                        ? '<span class="badge badge-pass">synced</span>'
                        : fState === 'missing'
                        ? '<span class="badge badge-neutral">missing</span>'
                        : `<span class="badge badge-warn">${f.manuallyEdited ? 'editado' : 'drifted'}</span>`;
                    return { path: f.path, badge: fBadge };
                  });

            return `
            <article class="adapter-card">
              <div class="adapter-card-head">
                <div style="min-width:0;">
                  <div class="adapter-name">${escapeHtml(p.name || p.id)}</div>
                  <div class="mono" style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                    ${escapeHtml(p.binary || p.id)}${p.installed ? ` · ${p.version ? escapeHtml(p.version) : 'instalada'}` : ' · CLI ausente'}
                  </div>
                </div>
                <span class="badge badge-pill ${st.cls}">${icon(st.iconName, 12)} ${escapeHtml(st.label)}</span>
              </div>

              <div class="adapter-files">
                ${targetPaths
                  .map(
                    (row) => `
                  <div class="adapter-file-row">
                    <span class="mono" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(row.path)}</span>
                    ${row.badge}
                  </div>`
                  )
                  .join('')}
              </div>

              <div class="adapter-actions">
                ${
                  p.id !== 'claude'
                    ? `<button type="button" class="btn btn-secondary btn-sm" data-action="sync-one-adapter" data-platform="${escapeHtml(p.id)}" ${ui.syncingAdapters || ui.disconnected ? 'disabled' : ''}>
                        ${icon('refresh', 13)} Sincronizar
                      </button>`
                    : ''
                }
                <button type="button" class="btn btn-ghost btn-sm" data-action="view-adapter-diff" data-platform="${escapeHtml(p.id)}">
                  Ver detalhes
                </button>
              </div>
            </article>`;
          })
          .join('')}
      </div>

      <!-- Gaveta: Regra Canônica (Prompt Amplifier 4 passos) & Hashes SHA-256 -->
      ${renderAccordion({
        id: 'adapters-canonical',
        title: 'Prévia da Regra Canônica & Hashes SHA-256',
        subtitle: 'Prompt Amplifier (4 passos) + assinatura criptográfica de paridade',
        iconName: 'sliders',
        badgesHtml: `<span class="badge badge-neutral mono">.claude/rules/80-prompt-amplifier.md</span><span class="badge ${adapters.inParityCount === adapters.total ? 'badge-pass' : 'badge-warn'} mono">${adapters.inParityCount}/${adapters.total}</span>`,
        open: canonicalOpen,
        bodyHtml: canonicalDrawerBody,
      })}
    </div>
  `;
}

/* ==========================================================================
   Live Execution Console Dock
   ========================================================================== */

const CONSOLE_STEPS = [
  { id: 'amplify', label: '1. Amplificando Prompt', match: /amplif/i },
  { id: 'decompose', label: '2. Decompondo', match: /decomp/i },
  { id: 'execute', label: '3. Executando', match: /execut|run/i },
  { id: 'gate', label: '4. Gate', match: /gate|valid/i },
];

function resolveStepIndex(stepStr) {
  if (!stepStr) return 0;
  for (let i = CONSOLE_STEPS.length - 1; i >= 0; i--) {
    if (CONSOLE_STEPS[i].match.test(stepStr)) return i;
  }
  return 2;
}

export function renderExecConsole(state, ui) {
  const runsMap = ui.runs || {};
  const allRuns = Object.values(runsMap).sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));
  const activeRun = allRuns.find((r) => r.runId === ui.activeConsoleRunId) || allRuns[0] || null;
  const isRunning = activeRun?.status === 'running';
  const isCompleted = activeRun?.status === 'finished' || activeRun?.status === 'completed';
  const mode = ui.consoleMode || 'collapsed'; // collapsed | expanded | maximized

  const barLeft = activeRun
    ? `
      <span class="badge ${isRunning ? 'badge-running' : isCompleted ? 'badge-pass' : 'badge-danger'}">
        ${isRunning ? '<span class="pulse-dot"></span> Executando' : isCompleted ? 'Concluído' : activeRun.status === 'stopped' ? 'Interrompido' : 'Falhou'}
      </span>
      <span class="mono" style="font-size:12px;color:#F1F5F9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        ${escapeHtml(activeRun.taskId)}
      </span>
      <span class="mono hide-mobile" style="font-size:11px;color:#94A3B8;">
        ${escapeHtml(activeRun.agent || '@developer')} · ${escapeHtml(activeRun.engine || 'mock')}
      </span>
      <span class="mono tabular" style="font-size:11px;color:#94A3B8;" ${isRunning ? `data-elapsed-start="${escapeHtml(activeRun.startedAt)}"` : ''}>
        ${isRunning ? formatElapsed(activeRun.startedAt) : activeRun.durationMs ? `${(activeRun.durationMs / 1000).toFixed(1)}s` : ''}
      </span>
    `
    : `
      ${icon('terminal', 15)}
      <span style="font-size:12px;color:#94A3B8;">Console de Execução ao Vivo · Ocioso</span>
    `;

  const barRight = `
    ${
      isRunning
        ? `<button type="button" class="btn btn-danger btn-sm" data-action="stop-run" data-run-id="${escapeHtml(activeRun.runId)}">
            ${icon('stop', 12)} Parar execução
          </button>`
        : ''
    }
    ${
      mode !== 'collapsed'
        ? `<button type="button" class="btn btn-ghost btn-icon btn-sm" style="color:#CBD5E1;" data-action="set-console-mode" data-mode="${mode === 'maximized' ? 'expanded' : 'maximized'}" title="${mode === 'maximized' ? 'Restaurar tamanho' : 'Maximizar console'}">
            ${icon('maximize', 14)}
          </button>`
        : ''
    }
    <button type="button" class="btn btn-ghost btn-icon btn-sm" style="color:#CBD5E1;" data-action="toggle-console" aria-label="${mode === 'collapsed' ? 'Expandir console' : 'Recolher console'}">
      ${icon(mode === 'collapsed' ? 'chevron-up' : 'chevron-down', 15)}
    </button>
  `;

  if (mode === 'collapsed') {
    return `
      <div class="console-bar">
        <div class="console-bar-left">${barLeft}</div>
        <div class="console-bar-right">${barRight}</div>
      </div>
    `;
  }

  const currentStepIdx = activeRun ? (isCompleted ? 4 : resolveStepIndex(activeRun.step)) : -1;
  const logSearch = (ui.consoleSearch || '').toLowerCase();
  const logFilter = ui.consoleLevel || 'all';
  const rawLogs = activeRun?.logs || [];
  const filteredLogs = rawLogs.filter((entry) => {
    const stream = String(entry.stream || '').toLowerCase();
    if (logFilter === 'stderr' && stream !== 'stderr') return false;
    if (logFilter === 'stdout' && stream !== 'stdout') return false;
    if (logFilter === 'gate' && !/gate|validate|pass|fail/i.test(entry.line || '')) return false;
    if (logSearch && !(entry.line || '').toLowerCase().includes(logSearch)) return false;
    return true;
  });

  return `
    <div class="console-bar">
      <div class="console-bar-left">${barLeft}</div>
      <div class="console-bar-right">${barRight}</div>
    </div>
    ${
      allRuns.length > 1
        ? `<div class="console-tabs">
            ${allRuns
              .slice(0, 8)
              .map(
                (r) => `
              <button type="button" class="console-tab ${r.runId === activeRun?.runId ? 'is-active' : ''}" data-action="focus-run" data-run-id="${escapeHtml(r.runId)}">
                ${r.status === 'running' ? '<span class="pulse-dot"></span>' : ''}
                <span class="mono">${escapeHtml(r.agent || '@dev')} · ${escapeHtml(r.taskId)}</span>
              </button>
            `
              )
              .join('')}
          </div>`
        : ''
    }
    <div class="console-stepper" aria-label="Etapas da execução">
      ${CONSOLE_STEPS.map((st, idx) => {
        let cls = 'stepper-item';
        let ic = '';
        if (activeRun) {
          if (idx < currentStepIdx) {
            cls += ' is-done';
            ic = icon('check-circle', 13);
          } else if (idx === currentStepIdx) {
            if (activeRun.status === 'failed' || activeRun.status === 'stopped') {
              cls += ' is-failed';
              ic = icon('x-circle', 13);
            } else {
              cls += ' is-active';
              ic = '<span class="pulse-dot"></span>';
            }
          }
        }
        return `${idx > 0 ? '<span class="stepper-sep">→</span>' : ''}<span class="${cls}">${ic} ${escapeHtml(st.label)}</span>`;
      }).join('')}
    </div>
    <div class="console-tools">
      <div class="console-tools-left">
        <input type="search" class="console-search" placeholder="Filtrar logs…" value="${escapeHtml(ui.consoleSearch || '')}" data-console-search="true" />
        ${['all', 'stdout', 'stderr', 'gate']
          .map(
            (lvl) => `<button type="button" class="console-tab ${logFilter === lvl ? 'is-active' : ''}" data-action="set-console-level" data-level="${lvl}">${lvl === 'all' ? 'Todos' : lvl}</button>`
          )
          .join('')}
      </div>
      <div class="console-tools-right">
        <button type="button" class="console-tab ${ui.consoleAutoFollow ? 'is-active' : ''}" data-action="toggle-console-follow">Seguir fim</button>
        <button type="button" class="console-tab" data-action="copy-console-log">${icon('copy', 11)} Copiar</button>
      </div>
    </div>
    <pre class="console-log" id="console-log-stream" role="log" aria-live="off">${
      filteredLogs.length === 0
        ? `<span style="color:#64748B;">${activeRun ? 'Aguardando saída do processo…' : 'Nenhuma execução selecionada. Arraste um card para Em Execução ou clique em Executar.'}</span>`
        : filteredLogs
            .map((entry) => {
              const line = entry.line || '';
              const stream = String(entry.stream || '').toLowerCase();
              let cls = 'log-line';
              if (/\[STEP\]/i.test(line)) cls += ' is-step';
              else if (/\[AMPLIFY\]|Amplified:/i.test(line)) cls += ' is-amplify';
              else if (/PASS|EXIT.*code=0/i.test(line)) cls += ' is-pass';
              else if (stream === 'stderr' || /ERROR|FAIL/i.test(line)) cls += ' is-error';
              return `<div class="${cls}"><span class="log-ts">${formatTime(entry.ts)}</span><span class="log-msg">${escapeHtml(line)}</span></div>`;
            })
            .join('')
    }</pre>
  `;
}

/* ==========================================================================
   Task Detail Drawer (S3)
   ========================================================================== */

export function renderTaskDrawer(task, state, ui) {
  if (!task) return '';
  const roster = state.roster || [];
  const assignable = roster.filter((a) => !a.readOnly && a.name !== '@committer');
  const reviewers = roster.filter((a) => a.name !== '@committer');
  const m = task.meta || {};
  const sch = m.schedule || {};
  const isBlocked = isBlockedStatus(task.status);
  const isTerminal = isTerminalStatus(task.status);
  const writeDisabled = ui.disconnected ? 'disabled' : '';
  const cliCmd = `node scripts/hub.mjs claim ${task.id} --agent ${m.assignee || '@developer'} --engine ${m.aiEngine || 'claude'}`;

  return `
    <div class="drawer-header">
      <div style="min-width:0;display:flex;flex-direction:column;gap:4px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="mono" style="font-size:12px;color:var(--text-muted)">${escapeHtml(task.id)}</span>
          <span class="badge ${isBlocked ? 'badge-danger' : 'badge-accent'}">${escapeHtml(getStatusLabel(task.status))}</span>
          ${task.valid === false ? `<span class="badge badge-danger">Arquivo inválido</span>` : ''}
        </div>
        <h2 style="font-size:var(--text-md);line-height:1.3;">${escapeHtml(task.title)}</h2>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button type="button" class="btn btn-secondary btn-sm" data-action="copy-text" data-copy="${escapeHtml(cliCmd)}" title="Copiar comando CLI">
          ${icon('copy', 13)} CLI
        </button>
        <button type="button" class="btn btn-ghost btn-icon" data-action="close-drawers" aria-label="Fechar detalhes">${icon('x', 16)}</button>
      </div>
    </div>

    <div class="drawer-body">
      ${
        task.needsFromUser && task.needsFromUser.trim()
          ? `<div class="needs-user-card"><strong>Aguardando você:</strong> ${escapeHtml(task.needsFromUser)}</div>`
          : ''
      }

      ${
        isBlocked
          ? `<div class="error-box">
              <strong>Tarefa Bloqueada (estava em ${escapeHtml(task.blockedFrom || 'PLANNING')})</strong>
              <span>${escapeHtml(task.blockedReason || 'Motivo não informado')}</span>
            </div>`
          : ''
      }

      <!-- Editable Metadata -->
      <div class="section-block">
        <span class="section-heading">Metadados &amp; Atribuição</span>
        <div class="meta-grid">
          <div class="field">
            <label class="field-label" for="td-priority">Prioridade</label>
            <select id="td-priority" class="select select-sm" data-task-meta="priority" data-task-id="${escapeHtml(task.id)}" ${writeDisabled}>
              ${['P0', 'P1', 'P2', 'P3'].map((p) => `<option value="${p}" ${m.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="td-tier">Tier</label>
            <select id="td-tier" class="select select-sm" data-task-meta="tier" data-task-id="${escapeHtml(task.id)}" ${writeDisabled}>
              ${['T2', 'T3', 'Hotfix', 'Prototype'].map((t) => `<option value="${t}" ${m.tier === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="td-assignee">Agente responsável</label>
            <select id="td-assignee" class="select select-sm" data-task-meta="assignee" data-task-id="${escapeHtml(task.id)}" ${writeDisabled}>
              <option value="">Sem agente</option>
              ${assignable.map((a) => `<option value="${escapeHtml(a.name)}" ${m.assignee === a.name ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="td-reviewer">Revisor</label>
            <select id="td-reviewer" class="select select-sm" data-task-meta="reviewer" data-task-id="${escapeHtml(task.id)}" ${writeDisabled}>
              <option value="">Sem revisor</option>
              ${reviewers.map((a) => `<option value="${escapeHtml(a.name)}" ${m.reviewer === a.name ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="td-engine">IA alvo</label>
            <select id="td-engine" class="select select-sm" data-task-meta="aiEngine" data-task-id="${escapeHtml(task.id)}" ${writeDisabled}>
              ${ENGINES.map((e) => `<option value="${e.id}" ${(m.aiEngine || 'mock') === e.id ? 'selected' : ''}>${escapeHtml(e.label)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="td-type">Tipo</label>
            <select id="td-type" class="select select-sm" data-task-meta="type" data-task-id="${escapeHtml(task.id)}" ${writeDisabled}>
              ${['Feature', 'Bug', 'Hotfix', 'Prototype', 'Docs', 'Ops', 'Harness'].map((tp) => `<option value="${tp}" ${(m.type || 'Feature') === tp ? 'selected' : ''}>${tp}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="td-sched-day">Dia agendado</label>
            <input id="td-sched-day" type="date" class="input input-sm" value="${escapeHtml(sch.day || '')}" data-task-schedule="day" data-task-id="${escapeHtml(task.id)}" ${writeDisabled} />
          </div>
          <div class="field">
            <label class="field-label" for="td-sched-dest">Destino</label>
            <select id="td-sched-dest" class="select select-sm" data-task-schedule="destination" data-task-id="${escapeHtml(task.id)}" ${writeDisabled}>
              ${DESTINATIONS.map((d) => `<option value="${d.id}" ${(sch.destination || 'working_tree') === d.id ? 'selected' : ''}>${escapeHtml(d.label)}${d.levelC ? ' (Level C)' : ''}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Problem & Source -->
      <div class="section-block">
        <span class="section-heading">Problema</span>
        <div style="font-size:var(--text-sm);color:var(--text-secondary);white-space:pre-wrap;">${escapeHtml(task.problem || 'Sem descrição de problema.')}</div>
        ${task.source ? `<div class="field-hint">Origem: <span class="mono">${escapeHtml(task.source)}</span></div>` : ''}
        ${task.proof ? `<div class="field-hint">Prova: <span class="mono">${escapeHtml(task.proof)}</span></div>` : ''}
      </div>

      <!-- Interactive Acceptance Criteria -->
      <div class="section-block">
        <span class="section-heading">Critérios de Aceite (${(task.acceptanceCriteria || []).filter((a) => a.done).length}/${(task.acceptanceCriteria || []).length})</span>
        ${
          (task.acceptanceCriteria || []).length === 0
            ? `<p class="panel-subtitle">Nenhum critério de aceite listado.</p>`
            : (task.acceptanceCriteria || [])
                .map(
                  (ac, idx) => `
              <div class="ac-item ${ac.done ? 'is-done' : ''}">
                <input type="checkbox" ${ac.done ? 'checked' : ''} data-ac-toggle="${idx}" data-task-id="${escapeHtml(task.id)}" aria-label="Critério ${idx + 1}" ${writeDisabled} />
                <div class="ac-content">
                  <span class="ac-text">${escapeHtml(ac.text)}</span>
                  <input type="text" class="input input-sm mono" placeholder="Evidência obrigatória para concluir…" value="${escapeHtml(ac.evidence || '')}" data-ac-evidence="${idx}" data-task-id="${escapeHtml(task.id)}" ${writeDisabled} />
                </div>
              </div>
            `
                )
                .join('')
        }
      </div>

      <!-- Files -->
      ${
        (task.files || []).length > 0
          ? `<div class="section-block">
              <span class="section-heading">Arquivos em escopo</span>
              <div style="display:flex;flex-wrap:wrap;gap:6px;">
                ${task.files.map((f) => `<span class="badge badge-neutral mono">${escapeHtml(f)}</span>`).join('')}
              </div>
            </div>`
          : ''
      }

      <!-- Log -->
      ${
        (task.log || []).length > 0
          ? `<div class="section-block">
              <span class="section-heading">Histórico do arquivo</span>
              <div style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-secondary);" class="mono">
                ${task.log.slice(-8).map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
              </div>
            </div>`
          : ''
      }
    </div>

    <div class="drawer-footer">
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${
          !isTerminal && !isBlocked
            ? `<button type="button" class="btn btn-primary btn-sm" data-action="run-task-now" data-task-id="${escapeHtml(task.id)}" ${writeDisabled}>${icon('play', 13)} Executar agora</button>`
            : ''
        }
        ${
          isBlocked
            ? `<button type="button" class="btn btn-primary btn-sm" data-action="unblock-task" data-task-id="${escapeHtml(task.id)}" ${writeDisabled}>Desbloquear</button>`
            : !isTerminal
            ? `<button type="button" class="btn btn-secondary btn-sm" data-action="open-block-modal" data-task-id="${escapeHtml(task.id)}" ${writeDisabled}>${icon('ban', 13)} Bloquear</button>`
            : ''
        }
      </div>
      <div style="display:flex;gap:6px;">
        ${
          !isTerminal
            ? `<button type="button" class="btn btn-danger-outline btn-sm" data-action="cancel-task" data-task-id="${escapeHtml(task.id)}" ${writeDisabled}>Cancelar tarefa</button>`
            : ''
        }
      </div>
    </div>
  `;
}

/* ==========================================================================
   Modals & Context Menu & Command Palette
   ========================================================================== */

export function renderNewTaskModal(state, opts = {}) {
  const roster = (state.roster || []).filter((a) => !a.readOnly && a.name !== '@committer');
  const lane = opts.lane || 'planned';
  const defaultType = lane === 'to_fix' ? 'Bug' : 'Feature';

  return `
    <form class="modal" id="form-new-task">
      <div class="modal-header">
        <h2 class="modal-title">${icon('plus', 18)} Nova Tarefa</h2>
        <button type="button" class="btn btn-ghost btn-icon" data-action="close-modal" aria-label="Fechar">${icon('x', 16)}</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label class="field-label" for="nt-title">Título *</label>
          <input id="nt-title" name="title" class="input" required placeholder="Ex.: Implementar filtro por agente na fila" autofocus />
        </div>
        <div class="meta-grid">
          <div class="field">
            <label class="field-label" for="nt-lane">Coluna inicial</label>
            <select id="nt-lane" name="boardLane" class="select">
              <option value="planned" ${lane === 'planned' ? 'selected' : ''}>Planejado</option>
              <option value="scheduled" ${lane === 'scheduled' ? 'selected' : ''}>Agendado</option>
              <option value="to_fix" ${lane === 'to_fix' ? 'selected' : ''}>A Corrigir</option>
              <option value="queued" ${lane === 'queued' ? 'selected' : ''}>Executar (Fila)</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="nt-prio">Prioridade</label>
            <select id="nt-prio" name="priority" class="select">
              <option value="P0">P0 — Crítica</option>
              <option value="P1">P1 — Alta</option>
              <option value="P2" selected>P2 — Normal</option>
              <option value="P3">P3 — Baixa</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="nt-tier">Tier</label>
            <select id="nt-tier" name="tier" class="select">
              <option value="T2" selected>T2 — Padrão</option>
              <option value="T3">T3 — Complexa</option>
              <option value="Hotfix">Hotfix</option>
              <option value="Prototype">Prototype</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="nt-type">Tipo</label>
            <select id="nt-type" name="type" class="select">
              ${['Feature', 'Bug', 'Hotfix', 'Prototype', 'Docs', 'Ops', 'Harness'].map((t) => `<option value="${t}" ${t === defaultType ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="nt-assignee">Agente responsável</label>
            <select id="nt-assignee" name="assignee" class="select">
              <option value="">Sem agente</option>
              ${roster.map((a) => `<option value="${escapeHtml(a.name)}" ${a.name === '@developer' ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="nt-engine">IA alvo</label>
            <select id="nt-engine" name="aiEngine" class="select">
              ${ENGINES.map((e) => `<option value="${e.id}" ${e.id === (state.config?.defaultEngine || 'mock') ? 'selected' : ''}>${escapeHtml(e.label)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="nt-problem">Problema</label>
          <textarea id="nt-problem" name="problem" class="textarea" placeholder="Descreva o contexto e o problema a resolver…"></textarea>
        </div>
        <div class="field">
          <label class="field-label" for="nt-acs">Critérios de Aceite (1 por linha) *</label>
          <textarea id="nt-acs" name="acceptanceCriteria" class="textarea" placeholder="Ex.: Testes automatizados passam com exit 0"></textarea>
        </div>
        <div class="field">
          <label class="field-label" for="nt-proof">Prova / Oráculo de verificação</label>
          <input id="nt-proof" name="proof" class="input mono" placeholder="Ex.: node --test hub/tests/store.test.mjs" />
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-action="close-modal">Cancelar</button>
        <button type="submit" class="btn btn-primary">Criar tarefa</button>
      </div>
    </form>
  `;
}

export function renderLevelCModal({ title, description, checkboxLabel, confirmLabel, actionId }) {
  return `
    <div class="modal modal-level-c" role="alertdialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="modal-header">
        <h2 class="modal-title" style="color:var(--status-warn-text);">${icon('alert-triangle', 18)} ${escapeHtml(title)}</h2>
        <button type="button" class="btn btn-ghost btn-icon" data-action="close-modal" aria-label="Fechar">${icon('x', 16)}</button>
      </div>
      <div class="modal-body">
        <p style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.5;">${escapeHtml(description)}</p>
        <label style="display:flex;align-items:flex-start;gap:8px;padding:10px;border-radius:var(--radius-md);background:var(--status-warn-bg);border:1px solid var(--status-warn-border);cursor:pointer;font-size:var(--text-sm);">
          <input type="checkbox" id="level-c-checkbox" style="margin-top:3px;" />
          <span>${escapeHtml(checkboxLabel)}</span>
        </label>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-action="close-modal" data-autofocus="true">Cancelar</button>
        <button type="button" class="btn btn-danger" id="btn-level-c-confirm" data-action="confirm-level-c" data-level-c-id="${escapeHtml(actionId)}" disabled>
          ${escapeHtml(confirmLabel)}
        </button>
      </div>
    </div>
  `;
}

export function renderBlockModal(task) {
  return `
    <form class="modal" id="form-block-task" data-task-id="${escapeHtml(task.id)}">
      <div class="modal-header">
        <h2 class="modal-title">${icon('ban', 18)} Bloquear Tarefa</h2>
        <button type="button" class="btn btn-ghost btn-icon" data-action="close-modal" aria-label="Fechar">${icon('x', 16)}</button>
      </div>
      <div class="modal-body">
        <p class="panel-subtitle">A tarefa <strong class="mono">${escapeHtml(task.id)}</strong> ficará em <code class="mono">BLOCKED(${escapeHtml(task.status)})</code>.</p>
        <div class="field">
          <label class="field-label" for="block-reason">Motivo do bloqueio *</label>
          <textarea id="block-reason" name="reason" class="textarea" required placeholder="Descreva exatamente o que impede o avanço…" data-autofocus="true"></textarea>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:var(--text-sm);cursor:pointer;">
          <input type="checkbox" name="blockedNeedsUser" checked />
          <span>Requer decisão humana (exibir em "Aguardando você")</span>
        </label>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-action="close-modal">Cancelar</button>
        <button type="submit" class="btn btn-danger">Confirmar bloqueio</button>
      </div>
    </form>
  `;
}

export function renderScheduleModal(task, state, prefillDay = '') {
  const roster = (state.roster || []).filter((a) => !a.readOnly && a.name !== '@committer');
  const sch = task.meta?.schedule || {};
  const dayVal = prefillDay || sch.day || getTodayIso();

  return `
    <form class="modal" id="form-schedule-task" data-task-id="${escapeHtml(task.id)}">
      <div class="modal-header">
        <h2 class="modal-title">${icon('calendar', 18)} Agendar Tarefa</h2>
        <button type="button" class="btn btn-ghost btn-icon" data-action="close-modal" aria-label="Fechar">${icon('x', 16)}</button>
      </div>
      <div class="modal-body">
        <div style="font-weight:600;">${escapeHtml(task.title)}</div>
        <div class="meta-grid">
          <div class="field">
            <label class="field-label" for="sch-day">Dia</label>
            <input id="sch-day" name="day" type="date" class="input" value="${escapeHtml(dayVal)}" required />
          </div>
          <div class="field">
            <label class="field-label" for="sch-agent">Agente</label>
            <select id="sch-agent" name="agent" class="select">
              <option value="">Sem agente</option>
              ${roster.map((a) => `<option value="${escapeHtml(a.name)}" ${(sch.agent || task.meta?.assignee) === a.name ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="sch-engine">IA alvo</label>
            <select id="sch-engine" name="aiEngine" class="select">
              ${ENGINES.map((e) => `<option value="${e.id}" ${(sch.aiEngine || task.meta?.aiEngine || 'mock') === e.id ? 'selected' : ''}>${escapeHtml(e.label)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="sch-dest">Destino</label>
            <select id="sch-dest" name="destination" class="select">
              ${DESTINATIONS.map((d) => `<option value="${d.id}" ${(sch.destination || 'working_tree') === d.id ? 'selected' : ''}>${escapeHtml(d.label)}${d.levelC ? ' (Level C)' : ''}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="sch-note">Observação (opcional)</label>
          <input id="sch-note" name="note" class="input" value="${escapeHtml(sch.note || '')}" placeholder="Ex.: Focar na manhã" />
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        ${
          sch.day
            ? `<button type="button" class="btn btn-danger-outline btn-sm" data-action="remove-schedule" data-task-id="${escapeHtml(task.id)}">Remover agendamento</button>`
            : '<span></span>'
        }
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar agenda</button>
        </div>
      </div>
    </form>
  `;
}

export function renderAssignAndRunModal(task, state) {
  const roster = (state.roster || []).filter((a) => !a.readOnly && a.name !== '@committer');
  return `
    <form class="modal" id="form-assign-run" data-task-id="${escapeHtml(task.id)}">
      <div class="modal-header">
        <h2 class="modal-title">${icon('play', 18)} Escolha o Agente e a IA para Executar</h2>
        <button type="button" class="btn btn-ghost btn-icon" data-action="close-modal" aria-label="Fechar">${icon('x', 16)}</button>
      </div>
      <div class="modal-body">
        <p class="panel-subtitle">A tarefa <strong>${escapeHtml(task.title)}</strong> ainda não possui agente atribuído.</p>
        <div class="meta-grid">
          <div class="field">
            <label class="field-label" for="ar-agent">Agente</label>
            <select id="ar-agent" name="assignee" class="select" required>
              ${roster.map((a) => `<option value="${escapeHtml(a.name)}" ${a.name === '@developer' ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="ar-engine">IA alvo</label>
            <select id="ar-engine" name="aiEngine" class="select">
              ${ENGINES.map((e) => `<option value="${e.id}" ${e.id === (state.config?.defaultEngine || 'mock') ? 'selected' : ''}>${escapeHtml(e.label)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-action="close-modal">Cancelar</button>
        <button type="submit" class="btn btn-primary">${icon('play', 14)} Mover e Executar</button>
      </div>
    </form>
  `;
}

export function renderConflictModal(taskId) {
  return `
    <div class="modal modal-level-c" role="alertdialog" aria-modal="true" aria-label="Arquivo alterado fora do Hub">
      <div class="modal-header">
        <h2 class="modal-title" style="color:var(--status-warn-text);">${icon('alert-triangle', 18)} Arquivo alterado fora do Hub</h2>
        <button type="button" class="btn btn-ghost btn-icon" data-action="close-modal" aria-label="Fechar">${icon('x', 16)}</button>
      </div>
      <div class="modal-body">
        <p style="font-size:var(--text-sm);color:var(--text-secondary);">
          O arquivo <code class="mono">.specs/tasks/${escapeHtml(taskId)}.md</code> foi modificado em disco enquanto você o editava. Para evitar sobrescrita silenciosa, recarregue a versão atual.
        </p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" data-action="reload-after-conflict" data-task-id="${escapeHtml(taskId)}">Recarregar do disco</button>
      </div>
    </div>
  `;
}

export function renderAdapterDiffModal(platform) {
  const files = platform?.files || [];
  return `
    <div class="modal" style="width:620px;">
      <div class="modal-header">
        <h2 class="modal-title">${icon('cpu', 18)} Detalhes de Paridade — ${escapeHtml(platform?.name || platform?.id)}</h2>
        <button type="button" class="btn btn-ghost btn-icon" data-action="close-modal" aria-label="Fechar">${icon('x', 16)}</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <span class="badge badge-neutral mono">binário: ${escapeHtml(platform?.binary || '—')}</span>
          <span class="badge ${platform?.installed ? 'badge-pass' : 'badge-neutral'}">${platform?.installed ? 'Instalada' : 'Não instalada'}</span>
        </div>
        ${
          files.length === 0
            ? `<p class="panel-subtitle">Plataforma canônica nativa (<span class="mono">CLAUDE.md</span> + <span class="mono">.claude/rules/*.md</span>).</p>`
            : files
                .map(
                  (f) => `
              <div class="adapter-file-row" style="flex-direction:column;align-items:stretch;gap:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <strong class="mono">${escapeHtml(f.path)}</strong>
                  <span class="badge ${f.state === 'in_parity' || f.state === 'synced' ? 'badge-pass' : 'badge-warn'}">${escapeHtml(f.state)}</span>
                </div>
                <div class="mono" style="font-size:11px;color:var(--text-muted);">
                  Canônico: ${escapeHtml(f.canonicalSha256 || '—')}<br/>
                  Em disco: ${escapeHtml(f.actualSha256 || 'ausente')}
                </div>
              </div>
            `
                )
                .join('')
        }
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-action="close-modal">Fechar</button>
      </div>
    </div>
  `;
}

export function renderAgentDrawer(agent, state) {
  if (!agent) return '';
  const history = (state.activity || []).filter((e) => e.actor === agent.name).slice(0, 20);
  const assigned = (state.tasks || []).filter((t) => t.meta?.assignee === agent.name && !isTerminalStatus(t.status));

  return `
    <div class="drawer-header">
      <div>
        <h2 class="modal-title mono">${escapeHtml(agent.name)}</h2>
        <p class="panel-subtitle">${escapeHtml(agent.role || '')}</p>
      </div>
      <button type="button" class="btn btn-ghost btn-icon" data-action="close-drawers" aria-label="Fechar">${icon('x', 16)}</button>
    </div>
    <div class="drawer-body">
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <span class="badge badge-neutral mono">modelo: ${escapeHtml(agent.model || 'inherit')}</span>
        <span class="badge badge-neutral">escreve: ${escapeHtml(agent.writes || '—')}</span>
      </div>

      <div class="section-block">
        <span class="section-heading">Tarefas atribuídas (${assigned.length})</span>
        ${
          assigned.length === 0
            ? `<p class="panel-subtitle">Nenhuma tarefa aberta atribuída.</p>`
            : assigned
                .map(
                  (t) => `
              <button type="button" class="live-row" style="width:100%;text-align:left;background:var(--bg-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);cursor:pointer;" data-action="open-task" data-task-id="${escapeHtml(t.id)}">
                <div class="live-row-main">
                  <div class="live-row-title">${escapeHtml(t.title)}</div>
                  <div class="live-row-meta">
                    <span class="badge ${prioClass(t.meta?.priority)} mono">${escapeHtml(t.meta?.priority || 'P2')}</span>
                    <span>${escapeHtml(getStatusLabel(t.status))}</span>
                  </div>
                </div>
              </button>
            `
                )
                .join('')
        }
      </div>

      <div class="section-block">
        <span class="section-heading">Últimas ações (${history.length})</span>
        ${
          history.length === 0
            ? `<p class="panel-subtitle">Nenhuma ação recente registrada.</p>`
            : history
                .map(
                  (evt) => `
              <div class="activity-item" style="padding-left:0;padding-right:0;">
                <span class="activity-time mono">${formatTimeShort(evt.ts)}</span>
                <div class="activity-body">${escapeHtml(evt.message || evt.type)}</div>
              </div>
            `
                )
                .join('')
        }
      </div>
    </div>
  `;
}

export function renderCardContextMenu(task) {
  const destinations = [
    { group: 'Planejamento', items: [
      { lane: 'planned', status: 'PLANNING', label: 'Planejado' },
      { lane: 'scheduled', status: 'PLANNING', label: 'Agendado' },
      { lane: 'to_fix', status: 'PLANNING', label: 'A Corrigir' },
    ]},
    { group: 'Execução', items: [
      { lane: 'queued', status: 'PLANNING', label: 'Executar (Fila)' },
      { lane: 'in_progress', status: 'IN_PROGRESS', label: 'Em Execução' },
      { lane: 'in_review', status: 'IN_REVIEW', label: 'Em Revisão' },
      { lane: 'ready', status: 'READY_TO_COMMIT', label: 'Pronto' },
      { lane: 'done', status: 'COMMITTED', label: 'Comitado (@committer)' },
      { lane: 'done', status: 'SHIPPED', label: 'Publicado (Level C)' },
    ]},
  ];

  return `
    ${destinations
      .map(
        (grp) => `
      <div class="context-menu-label">Mover para · ${escapeHtml(grp.group)}</div>
      ${grp.items
        .map((it) => {
          const check = isTransitionAllowed(task, it.lane, it.status);
          return `
          <button
            type="button"
            role="menuitem"
            class="context-menu-item"
            data-action="menu-move-task"
            data-task-id="${escapeHtml(task.id)}"
            data-to-lane="${escapeHtml(it.lane)}"
            data-to-status="${escapeHtml(it.status)}"
            ${check.allowed ? '' : `disabled title="${escapeHtml(check.reason)}"`}
          >
            <span>${escapeHtml(it.label)}</span>
            ${!check.allowed ? `<span style="font-size:10px;color:var(--text-muted);">Bloqueado</span>` : ''}
          </button>`;
        })
        .join('')}
    `
      )
      .join('<div class="context-menu-sep"></div>')}
    <div class="context-menu-sep"></div>
    <button type="button" role="menuitem" class="context-menu-item" data-action="open-task" data-task-id="${escapeHtml(task.id)}">Abrir detalhes</button>
    <button type="button" role="menuitem" class="context-menu-item" data-action="open-block-modal" data-task-id="${escapeHtml(task.id)}">Bloquear…</button>
    <button type="button" role="menuitem" class="context-menu-item is-danger" data-action="cancel-task" data-task-id="${escapeHtml(task.id)}">Cancelar tarefa</button>
  `;
}

export function renderCommandPalette(state, ui) {
  const q = (ui.paletteQuery || '').trim().toLowerCase();
  const navItems = [
    { id: 'nav:mission', group: 'Navegar', label: 'Mission Control', hint: 'Visão Geral' },
    { id: 'nav:kanban', group: 'Navegar', label: 'Kanban & Backlog', hint: 'Dois Quadros' },
    { id: 'nav:github', group: 'Navegar', label: 'GitHub Inbox', hint: 'Issues e PRs' },
    { id: 'nav:queue', group: 'Navegar', label: 'Fila de Demanda', hint: 'Ordem de execução' },
    { id: 'nav:schedule', group: 'Navegar', label: 'Agenda Semanal', hint: 'Seg–Dom' },
    { id: 'nav:agents', group: 'Navegar', label: 'Agentes & Incidentes', hint: '14 agentes' },
    { id: 'nav:adapters', group: 'Navegar', label: 'Hub Multi-AI', hint: 'Paridade & Prompt Amplifier' },
    { id: 'nav:workspaces', group: 'Navegar', label: 'Projetos / Workspaces', hint: state.workspacesDir || 'C:\\Estudos', searchText: 'projetos workspaces ambientes pastas trocar projeto' },
    { id: 'nav:calendar', group: 'Privado', label: 'Calendário & Rotina', hint: 'Local · fora do Git', searchText: 'privado calendario rotina faculdade pessoal prazos estudo' },
  ];

  const actions = [
    { id: 'act:new-task', group: 'Ações rápidas', label: 'Nova tarefa', hint: 'N' },
    { id: 'act:new-workspace', group: 'Ações rápidas', label: 'Novo projeto / workspace', hint: 'Criar pasta', searchText: 'novo projeto workspace criar pasta git italac-harness' },
    { id: 'act:new-calendar-event', group: 'Privado', label: 'Novo item no Calendário & Rotina', hint: 'Calendário', searchText: 'novo evento prazo estudo rotina privado' },
    { id: 'act:run-gates', group: 'Ações rápidas', label: 'Rodar todos os Gates', hint: 'gate.mjs' },
    { id: 'act:sync-adapters', group: 'Ações rápidas', label: 'Sincronizar todas as IAs', hint: 'Multi-AI' },
    { id: 'act:toggle-autorun', group: 'Ações rápidas', label: 'Alternar Auto-executar', hint: state.config?.autoRunOnInProgress ? 'ON' : 'OFF' },
    { id: 'act:toggle-theme', group: 'Ações rápidas', label: 'Alternar tema Claro / Escuro', hint: 'Tema' },
    { id: 'act:toggle-console', group: 'Ações rápidas', label: 'Abrir / Fechar Console ao Vivo', hint: 'Logs' },
  ];

  const activeWsId = state.workspace?.id || '';
  const mergedWorkspaces = getMergedWorkspaces(state).sort((a, b) => {
    if (a.id === activeWsId) return -1;
    if (b.id === activeWsId) return 1;
    return String(a.name || a.id).localeCompare(String(b.name || b.id));
  });
  const wsItems = mergedWorkspaces.slice(0, 20).map((ws) => ({
    id: `ws:${ws.id}`,
    group: 'Trocar Projeto',
    label: ws.name || ws.id,
    hint: `${ws.id === activeWsId ? 'Ativo · ' : ''}${ws.gitBranch || (ws.isGit ? 'git' : 'local')}`,
    searchText: `projeto workspace abrir ambiente ${ws.name || ''} ${ws.id || ''} ${ws.gitBranch || ''} ${ws.path || ''}`.toLowerCase(),
  }));

  const taskItems = (state.tasks || []).slice(0, 30).map((t) => ({
    id: `task:${t.id}`,
    group: 'Tarefas',
    label: t.title,
    hint: `${t.meta?.priority || 'P2'} · ${t.id}`,
    searchText: `${t.title} ${t.id} ${t.meta?.assignee || ''} ${t.meta?.priority || ''}`.toLowerCase(),
  }));

  const all = [...navItems, ...actions, ...wsItems, ...taskItems].filter((item) => {
    if (!q) return true;
    return `${item.label} ${item.hint} ${item.searchText || ''}`.toLowerCase().includes(q);
  });

  const activeIdx = Math.min(ui.paletteIndex || 0, Math.max(0, all.length - 1));
  const grouped = new Map();
  all.forEach((item, idx) => {
    if (!grouped.has(item.group)) grouped.set(item.group, []);
    grouped.get(item.group).push({ ...item, idx });
  });

  return `
    <div class="palette-input-wrap">
      ${icon('search', 16)}
      <input
        type="text"
        class="palette-input"
        id="palette-search-input"
        placeholder="Digite um comando, visão ou nome de tarefa…"
        value="${escapeHtml(ui.paletteQuery || '')}"
        autocomplete="off"
      />
      <kbd class="kbd">Esc</kbd>
    </div>
    <div class="palette-results" id="palette-results">
      ${
        all.length === 0
          ? `<div class="empty-state" style="padding:24px;"><span class="panel-subtitle">Nenhum resultado para "${escapeHtml(ui.paletteQuery)}"</span></div>`
          : [...grouped.entries()]
              .map(
                ([grp, items]) => `
            <div class="palette-group-label">${escapeHtml(grp)}</div>
            ${items
              .map(
                (it) => `
              <button type="button" class="palette-item ${it.idx === activeIdx ? 'is-active' : ''}" data-palette-exec="${escapeHtml(it.id)}" data-palette-idx="${it.idx}">
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(it.label)}</span>
                <span class="mono" style="font-size:11px;color:var(--text-muted);flex-shrink:0;">${escapeHtml(it.hint)}</span>
              </button>
            `
              )
              .join('')}
          `
              )
              .join('')
      }
    </div>
  `;
}


/* ==========================================================================
   View 8: Privado — Calendário & Rotina
   ========================================================================== */

export const CALENDAR_WORKSPACES = [
  { id: 'all', label: 'Todos', iconName: 'sliders' },
  { id: 'work', label: 'Trabalho', iconName: 'briefcase' },
  { id: 'study', label: 'Faculdade', iconName: 'book-open' },
  { id: 'personal', label: 'Pessoal', iconName: 'user' },
];

export const CALENDAR_KINDS = [
  { id: 'deadline', label: 'Prazo', iconName: 'flag' },
  { id: 'study', label: 'Estudo', iconName: 'book-open' },
  { id: 'delivery', label: 'Entrega', iconName: 'check-circle' },
  { id: 'plan', label: 'Plano', iconName: 'file-text' },
  { id: 'reminder', label: 'Lembrete', iconName: 'bell' },
];

const PT_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const PT_WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const PT_WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function parseIsoDateLocal(iso) {
  const parts = String(iso || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return new Date();
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function addDaysIso(iso, delta) {
  const dt = parseIsoDateLocal(iso);
  dt.setDate(dt.getDate() + delta);
  return toIsoDate(dt);
}

function formatMonthTitle(ym) {
  const [y, m] = String(ym || getTodayIso().slice(0, 7)).split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return ym || '';
  return `${PT_MONTHS[m - 1]} ${y}`;
}

function formatFullDatePt(iso) {
  const dt = parseIsoDateLocal(iso);
  const wd = PT_WEEKDAYS_LONG[dt.getDay()] || '';
  const day = dt.getDate();
  const mon = PT_MONTHS[dt.getMonth()] || '';
  return `${wd}, ${day} de ${mon}`;
}

function formatRelativeDateChip(iso, todayIso) {
  if (iso === todayIso) return 'Hoje';
  if (iso === addDaysIso(todayIso, 1)) return 'Amanhã';
  const parts = String(iso || '').split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return iso || '';
}

function getWorkspaceMeta(ws) {
  return CALENDAR_WORKSPACES.find((w) => w.id === ws) || { id: 'personal', label: 'Pessoal', iconName: 'user' };
}

function getKindMeta(kind) {
  return CALENDAR_KINDS.find((k) => k.id === kind) || { id: 'plan', label: 'Plano', iconName: 'file-text' };
}

function formatTimeRange(startTime, endTime) {
  const s = String(startTime || '').trim();
  const e = String(endTime || '').trim();
  if (s && e) return `${s}–${e}`;
  if (s) return s;
  return 'Dia todo';
}

function sortCalendarEvents(list) {
  return [...(list || [])].sort((a, b) => {
    const da = String(a.date || '');
    const db = String(b.date || '');
    if (da !== db) return da.localeCompare(db);
    const ta = String(a.startTime || '99:99');
    const tb = String(b.startTime || '99:99');
    if (ta !== tb) return ta.localeCompare(tb);
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

function buildMonthGrid(ym, todayIso, selectedDate) {
  const [year, month] = String(ym || todayIso.slice(0, 7)).split('-').map(Number);
  const firstOfMonth = new Date(year, month - 1, 1);
  const startDow = firstOfMonth.getDay(); // 0=Dom..6=Sáb
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dt = new Date(year, month - 1, 1 - startDow + i);
    const iso = toIsoDate(dt);
    cells.push({
      iso,
      dayNum: dt.getDate(),
      inCurrentMonth: dt.getMonth() === month - 1,
      isToday: iso === todayIso,
      isSelected: iso === selectedDate,
    });
  }
  return cells;
}

function buildWeekDaysSunSat(anchorIso, todayIso, selectedDate) {
  const anchor = parseIsoDateLocal(anchorIso || todayIso);
  const dow = anchor.getDay(); // 0=Dom..6=Sáb
  const sunday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - dow);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
    const iso = toIsoDate(dt);
    days.push({
      iso,
      weekdayShort: PT_WEEKDAYS_SHORT[i],
      dayNum: String(dt.getDate()).padStart(2, '0'),
      monthShort: (PT_MONTHS[dt.getMonth()] || '').slice(0, 3),
      isToday: iso === todayIso,
      isSelected: iso === selectedDate,
    });
  }
  return days;
}

function renderCalendarItemCard(ev, { showDateChip = false, todayIso = '', writeDisabled = '' } = {}) {
  const isDone = ev.status === 'done';
  const ws = getWorkspaceMeta(ev.workspace);
  const kind = getKindMeta(ev.kind);
  const timeLabel = formatTimeRange(ev.startTime, ev.endTime);

  return `
    <article class="cal-item-card is-kind-${escapeHtml(kind.id)} ${isDone ? 'is-done' : ''}" data-cal-card="${escapeHtml(ev.id)}">
      <div class="cal-item-top">
        <label class="cal-check-wrap" title="${isDone ? 'Marcar como pendente' : 'Marcar como concluído'}">
          <input
            type="checkbox"
            class="cal-checkbox"
            data-cal-toggle-done="true"
            data-cal-id="${escapeHtml(ev.id)}"
            ${isDone ? 'checked' : ''}
            ${writeDisabled}
            aria-label="Concluir ${escapeHtml(ev.title)}"
          />
          <span class="cal-checkbox-box" aria-hidden="true">${icon('check', 11)}</span>
        </label>

        <div class="cal-item-main">
          <div class="cal-item-title-row">
            <span class="cal-item-title" title="${escapeHtml(ev.title)}">${escapeHtml(ev.title)}</span>
            ${
              showDateChip
                ? `<button type="button" class="cal-date-chip mono tabular" data-action="cal-select-day" data-date="${escapeHtml(ev.date)}" title="Ir para ${escapeHtml(ev.date)}">${escapeHtml(formatRelativeDateChip(ev.date, todayIso))}</button>`
                : ''
            }
          </div>

          <div class="cal-item-meta">
            <span class="cal-meta-tag is-kind-tag-${escapeHtml(kind.id)}">${escapeHtml(kind.label)}</span>
            <span class="cal-meta-tag">${icon(ws.iconName, 11)} ${escapeHtml(ws.label)}</span>
            <span class="cal-meta-time mono tabular">${icon('clock', 11)} ${escapeHtml(timeLabel)}</span>
            ${ev.subject ? `<span class="cal-meta-subject" title="${escapeHtml(ev.subject)}">${escapeHtml(ev.subject)}</span>` : ''}
          </div>

          ${ev.notes ? `<p class="cal-item-notes">${escapeHtml(ev.notes)}</p>` : ''}
        </div>
      </div>

      <div class="cal-item-actions">
        ${
          ev.linkedTaskId
            ? `<button type="button" class="btn btn-ghost btn-sm cal-linked-btn" data-action="open-task" data-task-id="${escapeHtml(ev.linkedTaskId)}" title="Abrir tarefa vinculada no Kanban">
                ${icon('columns', 12)}
                <span class="mono">${escapeHtml(ev.linkedTaskId)}</span>
                ${icon('arrow-up-right', 12)}
              </button>`
            : `<button type="button" class="btn btn-secondary btn-sm cal-promote-btn" data-action="cal-promote" data-cal-id="${escapeHtml(ev.id)}" ${writeDisabled} title="Criar tarefa no Kanban (Agendado) vinculada a este item">
                ${icon('arrow-up-right', 12)} Enviar p/ Kanban
              </button>`
        }
        <button type="button" class="btn btn-ghost btn-icon btn-sm cal-delete-btn" data-action="cal-delete" data-cal-id="${escapeHtml(ev.id)}" ${writeDisabled} aria-label="Excluir ${escapeHtml(ev.title)}" title="Excluir item">
          ${icon('trash', 13)}
        </button>
      </div>
    </article>
  `;
}

export function renderCalendarView(state, ui) {
  const cal = ui.calendar || {};
  const todayIso = getTodayIso();
  const selectedDate = cal.selectedDate || todayIso;
  const activeMonth = cal.month || selectedDate.slice(0, 7);
  const viewMode = cal.viewMode === 'week' ? 'week' : 'month';
  const activeWorkspace = cal.workspace || 'all';
  const writeDisabled = ui.disconnected ? 'disabled' : '';

  const allEvents = Array.isArray(cal.events) ? cal.events : [];
  const filteredEvents = activeWorkspace === 'all'
    ? allEvents
    : allEvents.filter((ev) => ev.workspace === activeWorkspace);

  const eventsByDate = new Map();
  for (const ev of sortCalendarEvents(filteredEvents)) {
    const key = String(ev.date || '');
    if (!key) continue;
    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key).push(ev);
  }

  const selectedDayEvents = eventsByDate.get(selectedDate) || [];
  const horizonIso = addDaysIso(todayIso, 14);
  const upcomingDeadlines = sortCalendarEvents(
    filteredEvents.filter(
      (ev) => ev.status !== 'done' && ev.date >= todayIso && ev.date <= horizonIso
    )
  ).slice(0, 12);

  const summary = cal.summary || {
    total: allEvents.length,
    upcomingDeadlines: upcomingDeadlines.length,
    todayCount: (eventsByDate.get(todayIso) || []).length,
    studyHoursWeek: 0,
  };

  const weekDays = buildWeekDaysSunSat(selectedDate, todayIso, selectedDate);
  const periodTitle = viewMode === 'month'
    ? formatMonthTitle(activeMonth)
    : `${weekDays[0].dayNum} ${weekDays[0].monthShort} – ${weekDays[6].dayNum} ${weekDays[6].monthShort} ${weekDays[6].iso.slice(0, 4)}`;

  const monthCells = viewMode === 'month' ? buildMonthGrid(activeMonth, todayIso, selectedDate) : [];

  return `
    <div class="cal-view">
      <!-- Top Bar -->
      <div class="cal-toolbar">
        <div class="cal-toolbar-left">
          <div class="cal-ws-pills" role="group" aria-label="Filtrar por ambiente">
            ${CALENDAR_WORKSPACES.map((ws) => `
              <button
                type="button"
                class="cal-ws-pill ${activeWorkspace === ws.id ? 'is-active' : ''}"
                data-action="cal-set-workspace"
                data-workspace="${ws.id}"
                aria-pressed="${activeWorkspace === ws.id ? 'true' : 'false'}"
              >
                ${icon(ws.iconName, 13)}
                <span>${escapeHtml(ws.label)}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="cal-toolbar-center">
          <div class="cal-nav-group">
            <button type="button" class="btn btn-secondary btn-icon btn-sm" data-action="cal-nav-period" data-delta="-1" aria-label="${viewMode === 'month' ? 'Mês anterior' : 'Semana anterior'}" title="${viewMode === 'month' ? 'Mês anterior' : 'Semana anterior'}">
              ${icon('chevron-left', 15)}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="cal-nav-period" data-delta="0">Hoje</button>
            <button type="button" class="btn btn-secondary btn-icon btn-sm" data-action="cal-nav-period" data-delta="1" aria-label="${viewMode === 'month' ? 'Próximo mês' : 'Próxima semana'}" title="${viewMode === 'month' ? 'Próximo mês' : 'Próxima semana'}">
              ${icon('chevron-right', 15)}
            </button>
          </div>
          <h2 class="cal-period-title tabular">${escapeHtml(periodTitle)}</h2>
        </div>

        <div class="cal-toolbar-right">
          <div class="cal-mode-toggle" role="group" aria-label="Modo de visualização">
            <button type="button" class="cal-mode-btn ${viewMode === 'month' ? 'is-active' : ''}" data-action="cal-set-mode" data-mode="month" aria-pressed="${viewMode === 'month' ? 'true' : 'false'}">Mês</button>
            <button type="button" class="cal-mode-btn ${viewMode === 'week' ? 'is-active' : ''}" data-action="cal-set-mode" data-mode="week" aria-pressed="${viewMode === 'week' ? 'true' : 'false'}">Semana</button>
          </div>

          <span class="cal-privacy-badge" title="Salvo localmente e ignorado pelo Git (.gitignore)">
            ${icon('lock', 12)}
            <span>Privado · fora do Git</span>
          </span>

          <button type="button" class="btn btn-primary btn-sm" data-action="cal-open-new-modal" ${writeDisabled}>
            ${icon('plus', 14)}
            <span>Novo item</span>
          </button>
        </div>
      </div>

      <!-- Compact Sober KPI Strip -->
      <div class="cal-summary-strip">
        <div class="cal-stat-chip">
          <span class="cal-stat-label">Hoje</span>
          <strong class="cal-stat-val mono tabular">${escapeHtml(summary.todayCount ?? 0)}</strong>
        </div>
        <div class="cal-stat-chip">
          <span class="cal-stat-label">Próximos prazos</span>
          <strong class="cal-stat-val mono tabular">${escapeHtml(summary.upcomingDeadlines ?? 0)}</strong>
        </div>
        <div class="cal-stat-chip">
          <span class="cal-stat-label">Estudo na semana</span>
          <strong class="cal-stat-val mono tabular">${escapeHtml(summary.studyHoursWeek ?? 0)}h</strong>
        </div>
        <div class="cal-stat-chip">
          <span class="cal-stat-label">Itens no filtro</span>
          <strong class="cal-stat-val mono tabular">${filteredEvents.length}</strong>
        </div>
      </div>

      ${
        cal.error
          ? `<div class="cal-error-banner" role="alert">
              <div class="cal-error-main">
                ${icon('alert-triangle', 16)}
                <span>Não foi possível carregar o calendário privado: <span class="mono">${escapeHtml(cal.error)}</span></span>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" data-action="cal-reload">Tentar novamente</button>
            </div>`
          : ''
      }

      ${
        cal.loading && !cal.loaded
          ? `<div class="cal-loading-grid" aria-busy="true" aria-label="Carregando calendário">
              <div class="skeleton-box" style="height: 460px;"></div>
              <div class="skeleton-box" style="height: 460px;"></div>
            </div>`
          : `
      <div class="cal-layout">
        <!-- Left: Monthly or Weekly Calendar -->
        <section class="cal-board" aria-label="${viewMode === 'month' ? 'Calendário mensal' : 'Calendário semanal'}">
          ${
            viewMode === 'month'
              ? `
            <div class="cal-month-head" role="row">
              ${PT_WEEKDAYS_SHORT.map((wd) => `<div class="cal-month-dow" role="columnheader">${wd}</div>`).join('')}
            </div>
            <div class="cal-month-grid" role="grid">
              ${monthCells.map((cell) => {
                const dayEvents = eventsByDate.get(cell.iso) || [];
                const visible = dayEvents.slice(0, 3);
                const overflow = dayEvents.length - visible.length;
                return `
                  <button
                    type="button"
                    class="cal-day-cell ${cell.inCurrentMonth ? '' : 'is-outside'} ${cell.isToday ? 'is-today' : ''} ${cell.isSelected ? 'is-selected' : ''}"
                    data-action="cal-select-day"
                    data-date="${escapeHtml(cell.iso)}"
                    aria-label="${escapeHtml(formatFullDatePt(cell.iso))}, ${dayEvents.length} ${dayEvents.length === 1 ? 'item' : 'itens'}"
                    aria-pressed="${cell.isSelected ? 'true' : 'false'}"
                  >
                    <div class="cal-day-head">
                      <span class="cal-day-num mono tabular">${cell.dayNum}</span>
                      ${dayEvents.length > 0 ? `<span class="cal-day-count mono tabular">${dayEvents.length}</span>` : ''}
                    </div>
                    <div class="cal-day-pills">
                      ${visible.map((ev) => {
                        const kind = getKindMeta(ev.kind);
                        return `
                          <span class="cal-pill is-kind-${escapeHtml(kind.id)} ${ev.status === 'done' ? 'is-done' : ''}" title="${escapeHtml(`${kind.label}: ${ev.title}${ev.startTime ? ` (${formatTimeRange(ev.startTime, ev.endTime)})` : ''}`)}">
                            ${ev.startTime ? `<span class="cal-pill-time mono tabular">${escapeHtml(ev.startTime)}</span>` : ''}
                            <span class="cal-pill-title">${escapeHtml(ev.title)}</span>
                          </span>
                        `;
                      }).join('')}
                      ${overflow > 0 ? `<span class="cal-pill-more mono tabular">+${overflow} mais</span>` : ''}
                    </div>
                  </button>
                `;
              }).join('')}
            </div>
          `
              : `
            <div class="cal-week-grid">
              ${weekDays.map((day) => {
                const dayEvents = eventsByDate.get(day.iso) || [];
                return `
                  <div class="cal-week-col ${day.isToday ? 'is-today' : ''} ${day.isSelected ? 'is-selected' : ''}">
                    <button
                      type="button"
                      class="cal-week-col-head"
                      data-action="cal-select-day"
                      data-date="${escapeHtml(day.iso)}"
                      aria-pressed="${day.isSelected ? 'true' : 'false'}"
                    >
                      <span class="cal-week-dow">${day.weekdayShort}</span>
                      <span class="cal-week-date mono tabular">${day.dayNum} ${day.monthShort}</span>
                    </button>
                    <div class="cal-week-col-body">
                      ${
                        dayEvents.length === 0
                          ? `<div class="cal-week-empty" aria-label="Sem itens">—</div>`
                          : dayEvents.map((ev) => {
                              const ws = getWorkspaceMeta(ev.workspace);
                              const kind = getKindMeta(ev.kind);
                              return `
                                <button
                                  type="button"
                                  class="cal-week-block is-kind-${escapeHtml(kind.id)} ${ev.status === 'done' ? 'is-done' : ''}"
                                  data-action="cal-select-day"
                                  data-date="${escapeHtml(day.iso)}"
                                >
                                  <div class="cal-week-block-time mono tabular">${escapeHtml(formatTimeRange(ev.startTime, ev.endTime))}</div>
                                  <div class="cal-week-block-title">${escapeHtml(ev.title)}</div>
                                  <div class="cal-week-block-meta">
                                    <span class="cal-meta-tag">${icon(ws.iconName, 10)} ${escapeHtml(ws.label)}</span>
                                    ${ev.subject ? `<span class="cal-meta-subject">${escapeHtml(ev.subject)}</span>` : ''}
                                  </div>
                                </button>
                              `;
                            }).join('')
                      }
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `
          }
        </section>

        <!-- Right: Painel do Dia & Próximos 14 dias -->
        <aside class="cal-side-panel" aria-label="Painel do dia selecionado e próximos prazos">
          <div class="cal-side-header">
            <div class="cal-side-date-group">
              <span class="cal-side-kicker mono tabular">${escapeHtml(selectedDate)}</span>
              <h3 class="cal-side-title">${escapeHtml(formatFullDatePt(selectedDate))}</h3>
            </div>
            <span class="badge badge-neutral mono tabular">${selectedDayEvents.length} ${selectedDayEvents.length === 1 ? 'item' : 'itens'}</span>
          </div>

          <!-- Inline Quick-Add Form -->
          <form class="cal-quick-form" id="form-cal-quick-add" data-cal-date="${escapeHtml(selectedDate)}">
            <div class="cal-quick-form-head">
              <span class="section-heading">Adicionar ao dia</span>
            </div>
            <input
              type="text"
              name="title"
              class="input"
              placeholder="Título (ex.: Prova de Algoritmos, Revisar PR…)"
              required
              autocomplete="off"
              ${writeDisabled}
            />
            <div class="cal-form-row-2">
              <select name="workspace" class="select" aria-label="Ambiente" ${writeDisabled}>
                <option value="work" ${activeWorkspace === 'work' ? 'selected' : ''}>Trabalho</option>
                <option value="study" ${activeWorkspace === 'study' ? 'selected' : ''}>Faculdade</option>
                <option value="personal" ${activeWorkspace === 'personal' || activeWorkspace === 'all' ? 'selected' : ''}>Pessoal</option>
              </select>
              <select name="kind" class="select" aria-label="Tipo" ${writeDisabled}>
                ${CALENDAR_KINDS.map((k) => `<option value="${k.id}">${escapeHtml(k.label)}</option>`).join('')}
              </select>
            </div>
            <div class="cal-form-row-3">
              <input type="text" name="subject" class="input" placeholder="Matéria / Projeto" autocomplete="off" ${writeDisabled} />
              <input type="time" name="startTime" class="input mono" aria-label="Horário início" title="Início" ${writeDisabled} />
              <input type="time" name="endTime" class="input mono" aria-label="Horário fim" title="Fim" ${writeDisabled} />
            </div>
            <input type="text" name="notes" class="input" placeholder="Notas rápidas (opcional)" autocomplete="off" ${writeDisabled} />
            <div class="cal-quick-form-foot">
              <button type="submit" class="btn btn-primary btn-sm" style="width:100%;" ${writeDisabled}>
                ${icon('plus', 13)} Adicionar em ${escapeHtml(formatRelativeDateChip(selectedDate, todayIso))}
              </button>
            </div>
          </form>

          <!-- Selected Day Items -->
          <div class="cal-side-section">
            <div class="cal-side-section-head">
              <span class="section-heading">Itens do dia</span>
              <span class="mono tabular cal-side-count">${selectedDayEvents.length}</span>
            </div>
            ${
              selectedDayEvents.length === 0
                ? `<div class="cal-empty-box">
                    ${icon('calendar', 20)}
                    <span>Nenhum compromisso registrado para este dia.</span>
                  </div>`
                : `<div class="cal-item-list">
                    ${selectedDayEvents.map((ev) => renderCalendarItemCard(ev, { showDateChip: false, todayIso, writeDisabled })).join('')}
                  </div>`
            }
          </div>

          <!-- Upcoming 14 Days -->
          <div class="cal-side-section">
            <div class="cal-side-section-head">
              <span class="section-heading">Próximos prazos (14 dias)</span>
              <span class="mono tabular cal-side-count">${upcomingDeadlines.length}</span>
            </div>
            ${
              upcomingDeadlines.length === 0
                ? `<div class="cal-empty-box">
                    ${icon('check-circle', 20)}
                    <span>Sem prazos pendentes nos próximos 14 dias.</span>
                  </div>`
                : `<div class="cal-item-list">
                    ${upcomingDeadlines.map((ev) => renderCalendarItemCard(ev, { showDateChip: true, todayIso, writeDisabled })).join('')}
                  </div>`
            }
          </div>
        </aside>
      </div>
          `
      }
    </div>
  `;
}

export function renderCalendarEventModal(ui) {
  const cal = ui.calendar || {};
  const defaultDate = cal.selectedDate || getTodayIso();
  const defaultWs = cal.workspace && cal.workspace !== 'all' ? cal.workspace : 'study';

  return `
    <form class="modal" id="form-cal-modal-add">
      <div class="modal-header">
        <h2 class="modal-title">${icon('calendar', 18)} Novo item — Calendário Privado</h2>
        <button type="button" class="btn btn-ghost btn-icon" data-action="close-modal" aria-label="Fechar">${icon('x', 16)}</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label class="field-label" for="cal-m-title">Título</label>
          <input id="cal-m-title" name="title" class="input" placeholder="Ex.: Entrega do trabalho de Redes, Estudar Cálculo II…" required data-autofocus="true" autocomplete="off" />
        </div>
        <div class="meta-grid">
          <div class="field">
            <label class="field-label" for="cal-m-date">Data</label>
            <input id="cal-m-date" name="date" type="date" class="input mono" value="${escapeHtml(defaultDate)}" required />
          </div>
          <div class="field">
            <label class="field-label" for="cal-m-ws">Ambiente</label>
            <select id="cal-m-ws" name="workspace" class="select">
              <option value="work" ${defaultWs === 'work' ? 'selected' : ''}>Trabalho</option>
              <option value="study" ${defaultWs === 'study' ? 'selected' : ''}>Faculdade</option>
              <option value="personal" ${defaultWs === 'personal' ? 'selected' : ''}>Pessoal</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="cal-m-kind">Tipo</label>
            <select id="cal-m-kind" name="kind" class="select">
              ${CALENDAR_KINDS.map((k) => `<option value="${k.id}">${escapeHtml(k.label)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="cal-m-subject">Matéria / Projeto</label>
            <input id="cal-m-subject" name="subject" class="input" placeholder="Ex.: Estruturas de Dados" autocomplete="off" />
          </div>
          <div class="field">
            <label class="field-label" for="cal-m-start">Início</label>
            <input id="cal-m-start" name="startTime" type="time" class="input mono" />
          </div>
          <div class="field">
            <label class="field-label" for="cal-m-end">Fim</label>
            <input id="cal-m-end" name="endTime" type="time" class="input mono" />
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="cal-m-notes">Notas (opcional)</label>
          <textarea id="cal-m-notes" name="notes" class="textarea" rows="3" placeholder="Detalhes, capítulos, links ou observações…"></textarea>
        </div>
      </div>
      <div class="modal-footer" style="justify-content:space-between;">
        <span class="cal-privacy-badge" title="Armazenado localmente e ignorado pelo Git">
          ${icon('lock', 12)}
          <span>Privado · fora do Git</span>
        </span>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn btn-secondary" data-action="close-modal">Cancelar</button>
          <button type="submit" class="btn btn-primary">${icon('plus', 14)} Salvar item</button>
        </div>
      </div>
    </form>
  `;
}

/* ==========================================================================
   View 9: Projetos / Workspaces (Multi-Workspace Switcher & Directory)
   ========================================================================== */

export const WORKSPACE_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'git', label: 'Com Git' },
  { id: 'harness', label: 'Com Harness' },
  { id: 'tasks', label: 'Com Tarefas' },
  { id: 'running', label: 'Em Execução' },
];

function getMergedWorkspaces(state) {
  const list = Array.isArray(state.workspaces) ? [...state.workspaces] : [];
  const activeWs = state.workspace || null;
  if (activeWs && activeWs.id && !list.some((w) => w.id === activeWs.id)) {
    list.unshift(activeWs);
  }
  return list;
}

export function renderWorkspaceDropdownList(state, ui) {
  const workspaces = getMergedWorkspaces(state);
  const activeId = state.workspace?.id || '';
  const query = (ui.wsDropdownQuery || '').trim().toLowerCase();
  const switchingId = ui.switchingWorkspaceId || null;

  const filtered = workspaces
    .filter((ws) => {
      if (!query) return true;
      return `${ws.name || ''} ${ws.id || ''} ${ws.gitBranch || ''} ${ws.path || ''}`.toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (a.id === activeId) return -1;
      if (b.id === activeId) return 1;
      if ((b.activeRunCount || 0) !== (a.activeRunCount || 0)) return (b.activeRunCount || 0) - (a.activeRunCount || 0);
      return String(a.name || a.id).localeCompare(String(b.name || b.id));
    });

  if (workspaces.length === 0) {
    return `<div class="ws-dropdown-empty">Nenhum projeto detectado</div>`;
  }

  if (filtered.length === 0) {
    return `<div class="ws-dropdown-empty">Nenhum projeto encontrado para "${escapeHtml(ui.wsDropdownQuery)}"</div>`;
  }

  return filtered
    .map((ws) => {
      const isActive = ws.id === activeId;
      const isSwitching = switchingId === ws.id;
      const hasRuns = (ws.activeRunCount || 0) > 0;
      const taskCount = ws.taskCount ?? 0;
      return `
        <button
          type="button"
          role="option"
          aria-selected="${isActive ? 'true' : 'false'}"
          class="ws-dropdown-item ${isActive ? 'is-active' : ''}"
          data-action="select-workspace"
          data-ws-id="${escapeHtml(ws.id)}"
          ${switchingId ? 'disabled' : ''}
        >
          <span class="ws-dropdown-item-main">
            <span class="ws-dropdown-item-top">
              <span class="ws-dropdown-item-name">${escapeHtml(ws.name || ws.id)}</span>
              ${hasRuns ? `<span class="ws-run-dot" title="${ws.activeRunCount} em execução"></span>` : ''}
            </span>
            <span class="ws-dropdown-item-meta mono">
              ${ws.isGit ? `${icon('git-branch', 11)} ${escapeHtml(ws.gitBranch || 'HEAD')}` : 'local'}
              ${taskCount > 0 ? ` · ${taskCount} ${taskCount === 1 ? 'tarefa' : 'tarefas'}` : ''}
            </span>
          </span>
          <span class="ws-dropdown-item-right">
            ${
              isSwitching
                ? icon('spinner', 13, 'spin')
                : isActive
                ? `<span class="badge badge-accent ws-dropdown-active-pill">Ativo</span>`
                : ''
            }
          </span>
        </button>
      `;
    })
    .join('');
}

export function renderWorkspacesView(state, ui) {
  const workspaces = getMergedWorkspaces(state);
  const activeWs = state.workspace || null;
  const activeId = activeWs?.id || '';
  const workspacesDir = state.workspacesDir || 'C:\\Estudos';
  const filter = ui.workspacesFilter || 'all';
  const search = (ui.workspacesSearch || '').trim().toLowerCase();
  const switchingId = ui.switchingWorkspaceId || null;

  const totalCount = workspaces.length;
  const gitCount = workspaces.filter((w) => w.isGit).length;
  const harnessCount = workspaces.filter((w) => w.hasHarness).length;
  const runningCount = workspaces.filter((w) => (w.activeRunCount || 0) > 0).length;

  const filtered = workspaces.filter((w) => {
    if (filter === 'git' && !w.isGit) return false;
    if (filter === 'harness' && !w.hasHarness) return false;
    if (filter === 'tasks' && !(w.taskCount > 0)) return false;
    if (filter === 'running' && !(w.activeRunCount > 0)) return false;
    if (search) {
      const hay = `${w.name || ''} ${w.id || ''} ${w.gitBranch || ''} ${w.path || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  // Sort: active first, then running, then with tasks, then with harness, then alphabetical
  const sorted = [...filtered].sort((a, b) => {
    if (a.id === activeId) return -1;
    if (b.id === activeId) return 1;
    if ((b.activeRunCount || 0) !== (a.activeRunCount || 0)) return (b.activeRunCount || 0) - (a.activeRunCount || 0);
    if ((b.taskCount || 0) !== (a.taskCount || 0)) return (b.taskCount || 0) - (a.taskCount || 0);
    if (Boolean(b.hasHarness) !== Boolean(a.hasHarness)) return Number(Boolean(b.hasHarness)) - Number(Boolean(a.hasHarness));
    return String(a.name || a.id).localeCompare(String(b.name || b.id));
  });

  const writeDisabled = ui.disconnected ? 'disabled' : '';

  return `
    <div class="ws-view">
      <!-- Header -->
      <div class="ws-header">
        <div class="ws-header-left">
          <h2 class="ws-title">Projetos</h2>
          <span class="ws-dir-pill mono" title="Diretório base de workspaces">${icon('folder', 12)} ${escapeHtml(workspacesDir)}</span>
        </div>
        <div class="ws-header-right">
          <button type="button" class="btn btn-secondary btn-sm" data-action="refresh-workspaces" ${ui.workspacesLoading ? 'disabled' : ''}>
            ${icon(ui.workspacesLoading ? 'spinner' : 'refresh', 13, ui.workspacesLoading ? 'spin' : '')}
            <span>Atualizar lista</span>
          </button>
          <button type="button" class="btn btn-primary btn-sm" data-action="open-new-workspace" data-write-control="true" ${writeDisabled}>
            ${icon('plus', 14)}
            <span>Novo projeto</span>
          </button>
        </div>
      </div>

      <!-- Sober KPI Strip -->
      <div class="ws-summary-strip">
        <div class="ws-stat-chip">
          <span class="ws-stat-label">Total de projetos</span>
          <strong class="ws-stat-val mono tabular">${totalCount}</strong>
        </div>
        <div class="ws-stat-chip">
          <span class="ws-stat-label">Com Git</span>
          <strong class="ws-stat-val mono tabular">${gitCount}</strong>
        </div>
        <div class="ws-stat-chip">
          <span class="ws-stat-label">Com Harness</span>
          <strong class="ws-stat-val mono tabular">${harnessCount}</strong>
        </div>
        <div class="ws-stat-chip">
          <span class="ws-stat-label">Em Execução</span>
          <strong class="ws-stat-val mono tabular">${runningCount}</strong>
        </div>
      </div>

      <!-- Search + Filter Bar -->
      <div class="ws-toolbar">
        <div class="ws-search-wrap">
          ${icon('search', 14)}
          <input
            type="search"
            class="input ws-search-input"
            id="ws-view-search"
            placeholder="Buscar projeto por nome, branch ou caminho…"
            value="${escapeHtml(ui.workspacesSearch || '')}"
            data-ws-search="true"
            autocomplete="off"
          />
        </div>
        <div class="ws-filter-pills" role="group" aria-label="Filtrar projetos">
          ${WORKSPACE_FILTERS.map((f) => `
            <button
              type="button"
              class="ws-filter-pill ${filter === f.id ? 'is-active' : ''}"
              data-action="set-ws-filter"
              data-ws-filter="${f.id}"
              aria-pressed="${filter === f.id ? 'true' : 'false'}"
            >
              ${escapeHtml(f.label)}
            </button>
          `).join('')}
        </div>
      </div>

      ${
        ui.workspacesError
          ? `<div class="cal-error-banner" role="alert">
              <div class="cal-error-main">
                ${icon('alert-triangle', 16)}
                <span>Não foi possível listar projetos: <span class="mono">${escapeHtml(ui.workspacesError)}</span></span>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" data-action="refresh-workspaces">Tentar novamente</button>
            </div>`
          : ''
      }

      <!-- Content Area -->
      <div id="ws-cards-host">
        ${renderWorkspacesGridContent(sorted, { activeId, switchingId, loading: ui.workspacesLoading && totalCount === 0, totalCount, hasFilter: filter !== 'all' || Boolean(search) })}
      </div>
    </div>
  `;
}

export function renderWorkspacesGridContent(sorted, { activeId, switchingId, loading, totalCount, hasFilter }) {
  if (loading) {
    return `
      <div class="ws-grid" aria-busy="true" aria-label="Carregando projetos">
        <div class="skeleton-box" style="height: 156px;"></div>
        <div class="skeleton-box" style="height: 156px;"></div>
        <div class="skeleton-box" style="height: 156px;"></div>
      </div>
    `;
  }

  if (sorted.length === 0) {
    return `
      <div class="ws-empty-state">
        ${icon('folder', 28)}
        <h3>${totalCount === 0 ? 'Nenhum projeto encontrado' : 'Nenhum projeto corresponde ao filtro'}</h3>
        <p>${
          totalCount === 0
            ? 'Nenhuma pasta de projeto foi detectada no diretório de workspaces configurado.'
            : 'Tente ajustar a busca ou limpar os filtros ativos para visualizar todos os ambientes.'
        }</p>
        ${
          hasFilter
            ? `<button type="button" class="btn btn-secondary btn-sm" data-action="clear-ws-filters">Limpar filtros</button>`
            : `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
                 <button type="button" class="btn btn-primary btn-sm" data-action="open-new-workspace">${icon('plus', 14)} Novo projeto</button>
                 <button type="button" class="btn btn-secondary btn-sm" data-action="refresh-workspaces">${icon('refresh', 13)} Atualizar</button>
               </div>`
        }
      </div>
    `;
  }

  return `
    <div class="ws-grid">
      ${sorted
        .map((ws) => {
          const isActive = ws.id === activeId;
          const isSwitching = switchingId === ws.id;
          const hasRuns = (ws.activeRunCount || 0) > 0;
          const taskCount = ws.taskCount ?? 0;

          return `
            <article class="ws-card ${isActive ? 'is-active' : ''}" data-ws-card="${escapeHtml(ws.id)}">
              <div class="ws-card-head">
                <div class="ws-card-title-row">
                  <span class="ws-card-icon ${isActive ? 'is-active' : ''}" aria-hidden="true">
                    ${icon(isActive ? 'folder-open' : 'folder', 16)}
                  </span>
                  <h3 class="ws-card-name" title="${escapeHtml(ws.name || ws.id)}">${escapeHtml(ws.name || ws.id)}</h3>
                </div>
                <div class="ws-card-badges">
                  ${isActive ? `<span class="badge badge-accent">Ativo</span>` : ''}
                  ${
                    hasRuns
                      ? `<span class="badge badge-running"><span class="pulse-dot"></span> ${ws.activeRunCount} em execução</span>`
                      : ''
                  }
                </div>
              </div>

              <div class="ws-card-path mono" title="${escapeHtml(ws.path || '')}">${escapeHtml(ws.path || ws.id)}</div>

              <div class="ws-card-meta">
                <span class="ws-meta-pill mono ${ws.isGit ? '' : 'is-muted'}" title="${ws.isGit ? `Branch: ${ws.gitBranch || 'HEAD'}` : 'Não é repositório Git'}">
                  ${icon('git-branch', 12)}
                  <span>${escapeHtml(ws.isGit ? ws.gitBranch || 'HEAD' : 'Sem Git')}</span>
                </span>
                <span class="ws-meta-pill ${ws.hasHarness ? 'is-harness' : 'is-muted'}" title="${ws.hasHarness ? 'Harness configurado neste projeto' : 'Sem estrutura de Harness'}">
                  ${icon(ws.hasHarness ? 'check-circle' : 'layers', 12)}
                  <span>${ws.hasHarness ? 'Harness' : 'Sem Harness'}</span>
                </span>
                <span class="ws-meta-pill mono tabular" title="Tarefas em .specs/tasks">
                  ${icon('columns', 12)}
                  <span>${taskCount} ${taskCount === 1 ? 'tarefa' : 'tarefas'}</span>
                </span>
              </div>

              <div class="ws-card-footer">
                ${
                  isActive
                    ? `<span class="ws-current-label">${icon('check', 13)} Ambiente atual</span>
                       <button type="button" class="btn btn-secondary btn-sm" data-nav-jump="kanban">Abrir Kanban</button>`
                    : `<button
                         type="button"
                         class="btn btn-primary btn-sm ws-open-btn"
                         data-action="select-workspace"
                         data-ws-id="${escapeHtml(ws.id)}"
                         ${switchingId ? 'disabled' : ''}
                       >
                         ${isSwitching ? `${icon('spinner', 13, 'spin')} Abrindo…` : `${icon('arrow-up-right', 13)} Abrir ambiente`}
                       </button>`
                }
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}

export function renderNewWorkspaceModal(state) {
  const baseDir = String(state.workspacesDir || 'C:\\Estudos').replace(/[\\/]+$/, '');
  const sep = baseDir.includes('/') && !baseDir.includes('\\') ? '/' : '\\';

  return `
    <form class="modal ws-new-modal" id="form-new-workspace" novalidate>
      <div class="modal-header">
        <h2 class="modal-title">${icon('folder', 18)} Novo projeto</h2>
        <button type="button" class="btn btn-ghost btn-icon" data-action="close-modal" aria-label="Fechar">${icon('x', 16)}</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label class="field-label" for="ws-new-name">Nome do projeto / pasta</label>
          <input
            id="ws-new-name"
            name="name"
            type="text"
            class="input"
            placeholder="ex.: meu-servico-api"
            required
            autocomplete="off"
            spellcheck="false"
            data-autofocus="true"
            data-ws-new-name="true"
            data-base-dir="${escapeHtml(baseDir)}"
            data-path-sep="${escapeHtml(sep)}"
          />
          <div class="ws-path-preview mono" id="ws-new-path-preview" aria-live="polite">
            <span class="ws-path-preview-label">Caminho:</span>
            <span class="ws-path-preview-value">${escapeHtml(baseDir)}${escapeHtml(sep)}<span class="ws-path-preview-placeholder">&lt;nome&gt;</span></span>
          </div>
        </div>

        <fieldset class="ws-options-fieldset">
          <legend class="field-label">Configuração inicial</legend>

          <label class="ws-check-row">
            <input type="checkbox" name="initGit" checked />
            <span class="ws-check-content">
              <span class="ws-check-title">Inicializar Git (<code class="mono">git init</code>)</span>
              <span class="ws-check-desc">Cria o repositório Git local na pasta do projeto.</span>
            </span>
          </label>

          <label class="ws-check-row">
            <input type="checkbox" name="installHarness" checked />
            <span class="ws-check-content">
              <span class="ws-check-title">Configurar <code class="mono">italac-harness</code> neste projeto</span>
              <span class="ws-check-desc">Instala regras, agentes, scripts de validação e adaptadores Multi-AI.</span>
            </span>
          </label>

          <label class="ws-check-row">
            <input type="checkbox" name="openAfterCreate" checked />
            <span class="ws-check-content">
              <span class="ws-check-title">Abrir projeto ao criar</span>
              <span class="ws-check-desc">Alterna o painel imediatamente para o novo ambiente.</span>
            </span>
          </label>
        </fieldset>

        <div class="ws-modal-error" id="ws-new-error" role="alert" hidden></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-action="close-modal" id="btn-cancel-new-workspace">Cancelar</button>
        <button type="submit" class="btn btn-primary" id="btn-submit-new-workspace">
          ${icon('plus', 14)}
          <span>Criar projeto</span>
        </button>
      </div>
    </form>
  `;
}
