/**
 * Harness Hub — Application Controller & State Store
 * Vanilla ES Module — Zero dependencies.
 */

import { api, ApiError, HubEventStream } from './api.js';
import {
  escapeHtml,
  icon,
  isTerminalStatus,
  isBlockedStatus,
  isTransitionAllowed,
  formatElapsed,
  getTodayIso,
  renderMissionControl,
  renderKanban,
  renderGithubInbox,
  renderQueueView,
  renderScheduleView,
  renderAgentsView,
  renderAdaptersView,
  renderExecConsole,
  renderTaskDrawer,
  renderNewTaskModal,
  renderLevelCModal,
  renderBlockModal,
  renderScheduleModal,
  renderAssignAndRunModal,
  renderConflictModal,
  renderAdapterDiffModal,
  renderAgentDrawer,
  renderCardContextMenu,
  renderCommandPalette,
} from './components.js';

const VIEW_TITLES = {
  mission: 'Mission Control',
  kanban: 'Kanban & Backlog',
  github: 'GitHub Inbox',
  queue: 'Fila de Demanda',
  schedule: 'Agenda Semanal',
  agents: 'Agentes & Incidentes',
  adapters: 'Hub Multi-AI',
};

const state = {
  ok: true,
  watching: true,
  repoRoot: 'workflow',
  config: { autoRunOnInProgress: true, maxConcurrentRuns: 2, defaultEngine: 'mock' },
  tasks: [],
  queue: { eligible: [], ineligible: [] },
  roster: [],
  gates: [],
  incidents: { open: [], fixedCount: 0 },
  adapters: { inParityCount: 0, total: 4, platforms: [] },
  activeRuns: [],
  activity: [],
};

const ui = {
  view: 'mission',
  theme: loadPref('harness-hub-theme', 'dark'),
  sidebarCollapsed: loadPref('harness-hub-sidebar-collapsed', 'false') === 'true',
  kanbanMode: loadPref('harness-hub-kanban-mode', 'dual'),
  kanbanFilters: { quick: 'all', agent: '', priority: '', tier: '', engine: '' },
  quickCreateLane: null,
  showClosed: false,
  queueAgentFilter: '',
  queueTypeFilter: 'all',
  scheduleWeekOffset: 0,
  scheduleSearch: '',
  github: { loading: false, mode: 'demo', issues: [], error: null, hint: '', loaded: false },
  ghFilterSearch: '',
  ghFilterKind: 'all',
  ghSelectedKey: null,
  activeTaskId: null,
  activeAgentName: null,
  githubDrawerOpen: false,
  consoleMode: 'collapsed', // collapsed | expanded | maximized
  activeConsoleRunId: null,
  consoleSearch: '',
  consoleLevel: 'all',
  consoleAutoFollow: true,
  runs: {}, // runId -> { runId, taskId, agent, engine, status, step, startedAt, durationMs, logs: [] }
  disconnected: false,
  runningGate: false,
  syncingAdapters: false,
  paletteOpen: false,
  paletteQuery: '',
  paletteIndex: 0,
  pendingLevelC: null,
  dragContext: null, // { kind: 'task'|'github'|'schedule', id, key }
  lastFocusedEl: null,
};

const sse = new HubEventStream('/api/events');
let refreshTimer = null;

function loadPref(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val === null ? fallback : val;
  } catch {
    return fallback;
  }
}

function savePref(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

/* ==========================================================================
   DOM References
   ========================================================================== */

const el = {
  sidebar: document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebar-overlay'),
  sidebarCollapseBtn: document.getElementById('btn-sidebar-collapse'),
  mobileMenuBtn: document.getElementById('btn-mobile-menu'),
  topbarTitle: document.getElementById('topbar-title'),
  topbarRepo: document.getElementById('topbar-repo'),
  ssePill: document.getElementById('sse-pill'),
  sseLabel: document.getElementById('sse-label'),
  disconnectedBanner: document.getElementById('disconnected-banner'),
  disconnectedBannerMsg: document.getElementById('disconnected-banner-msg'),
  main: document.getElementById('main-content'),
  console: document.getElementById('exec-console'),
  drawerBackdrop: document.getElementById('drawer-backdrop'),
  taskDrawer: document.getElementById('task-drawer'),
  githubDrawer: document.getElementById('github-drawer'),
  agentDrawer: document.getElementById('agent-drawer'),
  modalBackdrop: document.getElementById('modal-backdrop'),
  modalRoot: document.getElementById('modal-root'),
  paletteBackdrop: document.getElementById('palette-backdrop'),
  palette: document.getElementById('command-palette'),
  contextMenu: document.getElementById('context-menu'),
  toasts: document.getElementById('toast-container'),
  themeIconSlot: document.getElementById('theme-icon-slot'),
  sidebarAutoRun: document.getElementById('sidebar-autorun-switch'),
  sidebarGateHealth: document.getElementById('sidebar-gate-health'),
  topbarGhCount: document.getElementById('topbar-gh-count'),
  navBadgeKanban: document.getElementById('nav-badge-kanban'),
  navBadgeGithub: document.getElementById('nav-badge-github'),
  navBadgeQueue: document.getElementById('nav-badge-queue'),
  navBadgeSchedule: document.getElementById('nav-badge-schedule'),
  navBadgeAgents: document.getElementById('nav-badge-agents'),
  navBadgeAdapters: document.getElementById('nav-badge-adapters'),
};

/* ==========================================================================
   Toasts
   ========================================================================== */

function showToast(title, message = '', { type = 'info', persistent = false } = {}) {
  const toast = document.createElement('div');
  toast.className = `toast is-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.innerHTML = `
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${message ? `<div class="toast-msg">${escapeHtml(message)}</div>` : ''}
    </div>
    <button type="button" class="btn btn-ghost btn-icon btn-sm" aria-label="Fechar aviso">${icon('x', 14)}</button>
  `;
  const closeBtn = toast.querySelector('button');
  const remove = () => toast.remove();
  closeBtn.addEventListener('click', remove);

  // Max 3 stacked toasts
  while (el.toasts.children.length >= 3) {
    el.toasts.firstElementChild.remove();
  }
  el.toasts.appendChild(toast);

  if (!persistent) {
    setTimeout(remove, 5000);
  }
}

/* ==========================================================================
   Theme & Shell Updates
   ========================================================================== */

function applyTheme(theme) {
  ui.theme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', ui.theme);
  savePref('harness-hub-theme', ui.theme);
  if (el.themeIconSlot) {
    el.themeIconSlot.innerHTML = icon(ui.theme === 'dark' ? 'sun' : 'moon', 16);
  }
}

function applySidebarState() {
  el.sidebar.classList.toggle('is-collapsed', ui.sidebarCollapsed);
  savePref('harness-hub-sidebar-collapsed', ui.sidebarCollapsed);
}

function setMobileSidebar(open) {
  el.sidebar.classList.toggle('is-mobile-open', open);
  el.sidebarOverlay.hidden = !open;
}

function updateChrome() {
  // Active nav button
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    const active = btn.getAttribute('data-nav') === ui.view;
    btn.classList.toggle('is-active', active);
    if (active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });

  el.topbarTitle.textContent = VIEW_TITLES[ui.view] || 'Harness Hub';
  const repoName = String(state.repoRoot || 'workflow').split(/[\\/]/).filter(Boolean).pop() || 'workflow';
  el.topbarRepo.textContent = repoName;

  // Sidebar badges
  const nonTerminal = (state.tasks || []).filter((t) => !isTerminalStatus(t.status)).length;
  el.navBadgeKanban.textContent = String(nonTerminal);
  el.navBadgeQueue.textContent = String((state.queue?.eligible || []).length);

  const todayIso = getTodayIso();
  const todayScheduled = (state.tasks || []).filter((t) => t.meta?.schedule?.day === todayIso && !isTerminalStatus(t.status)).length;
  el.navBadgeSchedule.textContent = String(todayScheduled);

  const openInc = (state.incidents?.open || []).length;
  el.navBadgeAgents.textContent = String(openInc);
  el.navBadgeAgents.className = `nav-badge mono ${openInc > 0 ? 'is-danger' : ''}`;

  const inParity = state.adapters?.inParityCount ?? 0;
  const totalAdapters = state.adapters?.total ?? 4;
  el.navBadgeAdapters.textContent = `${inParity}/${totalAdapters}`;
  el.navBadgeAdapters.className = `nav-badge mono ${inParity === totalAdapters ? 'is-pass' : 'is-warn'}`;

  const ghLen = ui.github.loaded ? String(ui.github.issues.length) : '—';
  el.navBadgeGithub.textContent = ghLen;
  el.topbarGhCount.textContent = ghLen;

  // Auto-run switch
  const autoRun = Boolean(state.config?.autoRunOnInProgress);
  el.sidebarAutoRun.classList.toggle('is-checked', autoRun);
  el.sidebarAutoRun.setAttribute('aria-checked', String(autoRun));

  // Gate health pill
  const gates = state.gates || [];
  const anyFail = gates.some((g) => g.status === 'fail');
  const allPass = gates.length > 0 && gates.every((g) => g.status === 'pass');
  el.sidebarGateHealth.className = `gate-health-pill ${anyFail ? 'is-fail' : allPass ? 'is-pass' : ''}`;
  const labelEl = el.sidebarGateHealth.querySelector('.gate-health-label');
  if (labelEl) {
    labelEl.textContent = anyFail ? 'Gates: FAIL' : allPass ? 'Gates: PASS' : 'Gates: aguardando';
  }

  // Write controls when disconnected
  document.querySelectorAll('[data-write-control="true"]').forEach((ctrl) => {
    ctrl.disabled = ui.disconnected;
  });
}

function updateSseStatus(status, customMsg = '') {
  el.ssePill.className = `sse-pill is-${status}`;
  if (status === 'connected') {
    el.sseLabel.textContent = 'Conectado (SSE)';
    ui.disconnected = false;
    el.disconnectedBanner.hidden = true;
  } else if (status === 'reconnecting') {
    el.sseLabel.textContent = 'Reconectando…';
  } else {
    el.sseLabel.textContent = 'Desconectado';
    ui.disconnected = true;
    if (customMsg) el.disconnectedBannerMsg.textContent = customMsg;
    el.disconnectedBanner.hidden = false;
  }
  updateChrome();
}

/* ==========================================================================
   Rendering
   ========================================================================== */

function renderView() {
  updateChrome();
  switch (ui.view) {
    case 'mission':
      el.main.innerHTML = renderMissionControl(state, ui);
      break;
    case 'kanban':
      el.main.innerHTML = renderKanban(state, ui);
      break;
    case 'github':
      el.main.innerHTML = renderGithubInbox(state, ui, { isDrawer: false });
      break;
    case 'queue':
      el.main.innerHTML = renderQueueView(state, ui);
      break;
    case 'schedule':
      el.main.innerHTML = renderScheduleView(state, ui);
      break;
    case 'agents':
      el.main.innerHTML = renderAgentsView(state, ui);
      break;
    case 'adapters':
      el.main.innerHTML = renderAdaptersView(state, ui);
      break;
    default:
      el.main.innerHTML = renderMissionControl(state, ui);
  }

  // Autofocus quick-create input if open
  if (ui.quickCreateLane) {
    const input = el.main.querySelector('[data-quick-create-form] [data-autofocus="true"]');
    if (input) input.focus();
  }

  renderOpenDrawers();
}

function renderOpenDrawers() {
  if (ui.activeTaskId) {
    const task = (state.tasks || []).find((t) => t.id === ui.activeTaskId);
    if (task) {
      el.taskDrawer.innerHTML = renderTaskDrawer(task, state, ui);
      el.taskDrawer.hidden = false;
      el.drawerBackdrop.hidden = false;
    } else {
      closeDrawers();
    }
  } else if (ui.githubDrawerOpen) {
    el.githubDrawer.innerHTML = renderGithubInbox(state, ui, { isDrawer: true });
    el.githubDrawer.hidden = false;
    el.drawerBackdrop.hidden = false;
  } else if (ui.activeAgentName) {
    const agent = (state.roster || []).find((a) => a.name === ui.activeAgentName);
    if (agent) {
      el.agentDrawer.innerHTML = renderAgentDrawer(agent, state);
      el.agentDrawer.hidden = false;
      el.drawerBackdrop.hidden = false;
    } else {
      closeDrawers();
    }
  }
}

function renderConsole() {
  el.console.className = `exec-console is-${ui.consoleMode}`;
  el.console.innerHTML = renderExecConsole(state, ui);
  if (ui.consoleAutoFollow && ui.consoleMode !== 'collapsed') {
    const logEl = document.getElementById('console-log-stream');
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
  }
}

function closeDrawers() {
  ui.activeTaskId = null;
  ui.activeAgentName = null;
  ui.githubDrawerOpen = false;
  el.taskDrawer.hidden = true;
  el.githubDrawer.hidden = true;
  el.agentDrawer.hidden = true;
  el.drawerBackdrop.hidden = true;
  if (ui.lastFocusedEl && typeof ui.lastFocusedEl.focus === 'function') {
    try { ui.lastFocusedEl.focus(); } catch { /* ignore */ }
    ui.lastFocusedEl = null;
  }
}

function openTaskDrawer(taskId) {
  ui.lastFocusedEl = document.activeElement;
  closeContextMenu();
  ui.githubDrawerOpen = false;
  ui.activeAgentName = null;
  el.githubDrawer.hidden = true;
  el.agentDrawer.hidden = true;
  ui.activeTaskId = taskId;
  renderOpenDrawers();
}

function openGithubDrawer() {
  ui.lastFocusedEl = document.activeElement;
  closeContextMenu();
  ui.activeTaskId = null;
  ui.activeAgentName = null;
  el.taskDrawer.hidden = true;
  el.agentDrawer.hidden = true;
  ui.githubDrawerOpen = true;
  if (!ui.github.loaded) loadGithubIssues();
  renderOpenDrawers();
}

function openAgentDrawer(agentName) {
  ui.lastFocusedEl = document.activeElement;
  closeContextMenu();
  ui.activeTaskId = null;
  ui.githubDrawerOpen = false;
  el.taskDrawer.hidden = true;
  el.githubDrawer.hidden = true;
  ui.activeAgentName = agentName;
  renderOpenDrawers();
}

function openModal(html) {
  ui.lastFocusedEl = document.activeElement;
  closeContextMenu();
  el.modalRoot.innerHTML = html;
  el.modalBackdrop.hidden = false;
  const focusTarget = el.modalRoot.querySelector('[data-autofocus="true"], input, textarea, select, button');
  if (focusTarget) focusTarget.focus();
}

function closeModal() {
  el.modalBackdrop.hidden = true;
  el.modalRoot.innerHTML = '';
  ui.pendingLevelC = null;
  if (ui.lastFocusedEl && typeof ui.lastFocusedEl.focus === 'function') {
    try { ui.lastFocusedEl.focus(); } catch { /* ignore */ }
    ui.lastFocusedEl = null;
  }
}

function openPalette() {
  ui.lastFocusedEl = document.activeElement;
  ui.paletteOpen = true;
  ui.paletteQuery = '';
  ui.paletteIndex = 0;
  el.paletteBackdrop.hidden = false;
  renderPalette();
  const input = document.getElementById('palette-search-input');
  if (input) input.focus();
}

function closePalette() {
  ui.paletteOpen = false;
  el.paletteBackdrop.hidden = true;
  if (ui.lastFocusedEl && typeof ui.lastFocusedEl.focus === 'function') {
    try { ui.lastFocusedEl.focus(); } catch { /* ignore */ }
    ui.lastFocusedEl = null;
  }
}

function renderPalette() {
  el.palette.innerHTML = renderCommandPalette(state, ui);
}

function closeContextMenu() {
  el.contextMenu.hidden = true;
  el.contextMenu.innerHTML = '';
}

function openCardContextMenu(taskId, anchorEl) {
  const task = (state.tasks || []).find((t) => t.id === taskId);
  if (!task) return;
  el.contextMenu.innerHTML = renderCardContextMenu(task);
  el.contextMenu.hidden = false;

  const rect = anchorEl.getBoundingClientRect();
  const menuW = 240;
  const menuH = Math.min(420, el.contextMenu.scrollHeight || 360);
  const left = Math.min(window.innerWidth - menuW - 12, Math.max(12, rect.right - menuW));
  const top = rect.bottom + menuH > window.innerHeight ? Math.max(12, rect.top - menuH) : rect.bottom + 4;
  el.contextMenu.style.left = `${left}px`;
  el.contextMenu.style.top = `${top}px`;

  const firstItem = el.contextMenu.querySelector('button:not(:disabled)');
  if (firstItem) firstItem.focus();
}

/* ==========================================================================
   Data Fetching & Sync
   ========================================================================== */

async function fetchState({ silent = false } = {}) {
  try {
    const data = await api.getState();
    Object.assign(state, data);
    // Sync activeRuns into ui.runs buffer
    for (const run of state.activeRuns || []) {
      if (!ui.runs[run.runId]) {
        ui.runs[run.runId] = { ...run, logs: [] };
      } else {
        Object.assign(ui.runs[run.runId], run);
      }
      if (!ui.activeConsoleRunId) ui.activeConsoleRunId = run.runId;
    }
    if (!state.watching) {
      updateSseStatus('disconnected', 'Watcher de arquivos indisponível — dados podem estar desatualizados.');
    }
    renderView();
    renderConsole();
  } catch (err) {
    if (!silent) {
      showToast('Falha ao carregar estado do Hub', err.message, { type: 'error', persistent: true });
    }
  }
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => fetchState({ silent: true }), 160);
}

async function loadGithubIssues() {
  ui.github.loading = true;
  ui.github.error = null;
  if (ui.view === 'github' || ui.githubDrawerOpen) renderView();
  try {
    const res = await api.getGithubIssues();
    ui.github = {
      loading: false,
      loaded: true,
      mode: res.mode || 'demo',
      issues: res.issues || [],
      hint: res.message || res.hint || '',
      error: res.mode === 'error' ? (res.message || res.error || 'Erro ao consultar GitHub') : null,
    };
  } catch (err) {
    ui.github.loading = false;
    ui.github.error = err.message;
  }
  updateChrome();
  if (ui.view === 'github' || ui.githubDrawerOpen) renderView();
}

/* ==========================================================================
   Actions (Tasks, Move, Run, GitHub, Gates, Adapters)
   ========================================================================== */

function navigate(view) {
  if (!VIEW_TITLES[view]) return;
  ui.view = view;
  setMobileSidebar(false);
  if (view === 'github' && !ui.github.loaded) {
    loadGithubIssues();
  }
  renderView();
}

async function toggleAutoRun() {
  const next = !state.config?.autoRunOnInProgress;
  try {
    await api.updateConfig({ autoRunOnInProgress: next });
    state.config = { ...state.config, autoRunOnInProgress: next };
    showToast(next ? 'Auto-executar ativado' : 'Auto-executar desativado', next ? 'Arrastar para Em Execução dispara o agente automaticamente.' : 'Arrastar para Em Execução apenas altera o status.', { type: 'info' });
    renderView();
  } catch (err) {
    showToast('Erro ao atualizar configuração', err.message, { type: 'error' });
  }
}

async function handleMoveTask(taskId, { toLane, toStatus, reason = null, blockedNeedsUser = false, confirmLevelC = false, engine = null, skipAssignCheck = false } = {}) {
  const task = (state.tasks || []).find((t) => t.id === taskId);
  if (!task) return;

  // Level C confirmation for SHIPPED
  if (toStatus === 'SHIPPED' && !confirmLevelC) {
    ui.pendingLevelC = {
      kind: 'ship',
      taskId,
      toLane,
      toStatus,
    };
    openModal(
      renderLevelCModal({
        title: 'Confirmação Level C — Publicar Tarefa',
        description: `Mover "${task.title}" para SHIPPED marca esta entrega como publicada externamente (PR / Deploy). Esta ação exige confirmação explícita.`,
        checkboxLabel: 'Confirmo que esta tarefa foi revisada e publicada com aprovação.',
        confirmLabel: 'Confirmar publicação (SHIPPED)',
        actionId: 'ship',
      })
    );
    return;
  }

  // If dragging to in_progress with auto-run ON and no assignee, prompt user
  if (toStatus === 'IN_PROGRESS' && state.config?.autoRunOnInProgress && !task.meta?.assignee && !skipAssignCheck) {
    openModal(renderAssignAndRunModal(task, state));
    return;
  }

  try {
    const res = await api.moveTask(taskId, {
      toLane,
      toStatus,
      actor: 'user',
      reason,
      blockedNeedsUser,
      confirmLevelC,
      autoRun: toStatus === 'IN_PROGRESS' ? Boolean(state.config?.autoRunOnInProgress) : false,
      engine,
      expectedMtimeMs: task.mtimeMs,
    });

    if (res.run) {
      registerRun(res.run);
      ui.consoleMode = 'expanded';
      ui.activeConsoleRunId = res.run.runId;
      renderConsole();
      showToast('Execução iniciada automaticamente', `${res.run.agent || '@developer'} · ${res.run.engine}`, { type: 'success' });
    } else if (res.autoRunError) {
      const errMsg =
        typeof res.autoRunError === 'string'
          ? res.autoRunError
          : res.autoRunError.message || res.autoRunError.code || 'Não foi possível iniciar o Runner';
      showToast('Status atualizado (Auto-run não iniciado)', errMsg, { type: 'warn' });
    } else {
      showToast('Tarefa movida', `${task.title} → ${toStatus === 'PLANNING' ? toLane : toStatus}`, { type: 'success' });
    }

    await fetchState({ silent: true });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.code === 'CONFLICT') {
        openModal(renderConflictModal(taskId));
        return;
      }
      if (err.code === 'CONFIRM_LEVEL_C') {
        handleMoveTask(taskId, { toLane, toStatus, confirmLevelC: false });
        return;
      }
    }
    showToast('Transição bloqueada pelo Harness', err.message, { type: 'error', persistent: true });
  }
}

async function handleRunTaskNow(taskId) {
  const task = (state.tasks || []).find((t) => t.id === taskId);
  if (!task) return;
  if (!task.meta?.assignee) {
    openModal(renderAssignAndRunModal(task, state));
    return;
  }
  try {
    const res = await api.runTask(taskId, {
      engine: task.meta?.aiEngine || state.config?.defaultEngine || 'mock',
      mode: 'impl',
      agent: task.meta.assignee,
    });
    if (res.run) {
      registerRun(res.run);
      ui.consoleMode = 'expanded';
      ui.activeConsoleRunId = res.run.runId;
      renderConsole();
      showToast('Agente em execução', `${res.run.agent} · ${res.run.engine}`, { type: 'success' });
    }
    await fetchState({ silent: true });
  } catch (err) {
    showToast('Não foi possível iniciar execução', err.message, { type: 'error', persistent: true });
  }
}

async function handleStopRun(runId) {
  try {
    await api.stopRun(runId);
    showToast('Execução interrompida', `Run ${runId} encerrado com segurança.`, { type: 'warn' });
    await fetchState({ silent: true });
  } catch (err) {
    showToast('Erro ao parar execução', err.message, { type: 'error' });
  }
}

async function handleRunGates(only = null) {
  ui.runningGate = true;
  renderView();
  try {
    await api.runGates(only);
    showToast('Gates concluídos', only ? `Gate "${only}" finalizado.` : 'Todos os gates foram executados.', { type: 'success' });
    await fetchState({ silent: true });
  } catch (err) {
    showToast('Falha ao executar gate', err.message, { type: 'error', persistent: true });
  } finally {
    ui.runningGate = false;
    renderView();
  }
}

async function handleSyncAdapters(platforms = ['antigravity', 'codex', 'cursor'], confirmOverwrite = false) {
  ui.syncingAdapters = true;
  renderView();
  try {
    const res = await api.syncAdapters({ platforms, dryRun: false, confirmOverwrite });
    showToast('Multi-AI sincronizado', res.validator?.pass ? 'Todas as projeções em paridade e validador PASS.' : 'Projeções atualizadas.', { type: 'success' });
    await fetchState({ silent: true });
  } catch (err) {
    if (err instanceof ApiError && err.code === 'CONFIRM_OVERWRITE') {
      const files = (err.payload?.overwriteManual || []).join(', ');
      ui.pendingLevelC = { kind: 'adapter-overwrite', platforms };
      openModal(
        renderLevelCModal({
          title: 'Confirmação Level C — Sobrescrever Edição Manual',
          description: `Os seguintes arquivos de projeção foram editados manualmente fora do Hub: ${files || 'arquivos de projeção'}. Deseja sobrescrevê-los com a fonte canônica?`,
          checkboxLabel: 'Confirmo que desejo sobrescrever as edições manuais pela fonte canônica.',
          confirmLabel: 'Sobrescrever e sincronizar',
          actionId: 'adapter-overwrite',
        })
      );
    } else {
      showToast('Erro na sincronização Multi-AI', err.message, { type: 'error', persistent: true });
    }
  } finally {
    ui.syncingAdapters = false;
    renderView();
  }
}

async function handleGithubImport(key, { boardLane = 'planned', autoRun = false } = {}) {
  const issue = (ui.github.issues || []).find((i) => `${i.repo || ''}#${i.number}` === key);
  if (!issue) return;
  try {
    const res = await api.importGithubIssue({
      issue,
      boardLane,
      priority: 'P2',
      tier: 'T2',
      assignee: '@developer',
    });
    const createdTask = res.task;
    showToast('Issue importada', `#${issue.number} → ${createdTask?.id || 'Planejamento'}`, { type: 'success' });
    await fetchState({ silent: true });

    if (autoRun && createdTask?.id) {
      await handleMoveTask(createdTask.id, { toLane: 'in_progress', toStatus: 'IN_PROGRESS', skipAssignCheck: true });
    }
  } catch (err) {
    showToast('Erro ao importar do GitHub', err.message, { type: 'error' });
  }
}

function registerRun(run) {
  if (!run?.runId) return;
  const existing = ui.runs[run.runId] || { logs: [] };
  ui.runs[run.runId] = { ...existing, ...run, logs: existing.logs || [] };
}

/* ==========================================================================
   SSE Wiring
   ========================================================================== */

sse.onStatus((status) => {
  updateSseStatus(status);
});

sse.on('state:changed', () => {
  scheduleRefresh();
});

sse.on('gate:updated', () => {
  scheduleRefresh();
});

sse.on('adapter:updated', () => {
  scheduleRefresh();
});

sse.on('watcher:error', (payload) => {
  updateSseStatus('disconnected', payload?.message || 'Erro no watcher de arquivos.');
});

sse.on('run:started', (data) => {
  registerRun({ ...data, status: 'running' });
  ui.activeConsoleRunId = data.runId;
  if (ui.consoleMode === 'collapsed') ui.consoleMode = 'expanded';
  renderConsole();
  scheduleRefresh();
});

sse.on('run:step', (data) => {
  registerRun({ ...data, status: 'running' });
  const run = ui.runs[data.runId];
  if (run) {
    run.logs.push({ ts: new Date().toISOString(), stream: 'stdout', line: `[STEP] ${data.step}` });
  }
  renderConsole();
  scheduleRefresh();
});

sse.on('run:log', (data) => {
  registerRun({ runId: data.runId, taskId: data.taskId, status: 'running' });
  const run = ui.runs[data.runId];
  if (run) {
    run.logs.push({ ts: data.ts || new Date().toISOString(), stream: data.stream || 'stdout', line: data.line || '' });
    if (run.logs.length > 600) run.logs.splice(0, run.logs.length - 600);
  }
  if (ui.activeConsoleRunId === data.runId && ui.consoleMode !== 'collapsed') {
    renderConsole();
  }
});

sse.on('run:finished', (data) => {
  const ok = data.exitCode === 0;
  registerRun({ ...data, status: ok ? 'finished' : 'failed' });
  const run = ui.runs[data.runId];
  if (run) {
    run.logs.push({ ts: new Date().toISOString(), stream: ok ? 'stdout' : 'stderr', line: `[EXIT] code=${data.exitCode} durationMs=${data.durationMs || 0}` });
  }
  showToast(ok ? 'Execução concluída' : 'Execução falhou', `${data.taskId} (exit ${data.exitCode})`, { type: ok ? 'success' : 'error' });
  renderConsole();
  scheduleRefresh();
});

sse.on('run:stopped', (data) => {
  registerRun({ ...data, status: 'stopped' });
  const run = ui.runs[data.runId];
  if (run) {
    run.logs.push({ ts: new Date().toISOString(), stream: 'stderr', line: `[STOPPED] ${data.reason || 'Interrompido pelo usuário'}` });
  }
  renderConsole();
  scheduleRefresh();
});

/* ==========================================================================
   HTML5 Drag & Drop (Dual-Board, Unified, GitHub Drawer, Schedule)
   ========================================================================== */

document.addEventListener('dragstart', (e) => {
  const card = e.target.closest('[data-task-card]');
  if (card) {
    const taskId = card.getAttribute('data-task-card');
    ui.dragContext = { kind: 'task', id: taskId };
    card.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);

    // Highlight valid vs forbidden columns
    const task = (state.tasks || []).find((t) => t.id === taskId);
    document.querySelectorAll('[data-drop-lane]').forEach((col) => {
      const toLane = col.getAttribute('data-drop-lane');
      const toStatus = col.getAttribute('data-drop-status');
      const check = isTransitionAllowed(task, toLane, toStatus);
      col.classList.toggle('is-drop-valid', check.allowed);
      col.classList.toggle('is-drop-forbidden', !check.allowed);
    });
    return;
  }

  const ghItem = e.target.closest('[data-gh-drag]');
  if (ghItem) {
    const key = ghItem.getAttribute('data-gh-drag');
    ui.dragContext = { kind: 'github', key };
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', key);
    return;
  }

  const schedItem = e.target.closest('[data-schedule-drag]');
  if (schedItem) {
    const taskId = schedItem.getAttribute('data-schedule-drag');
    ui.dragContext = { kind: 'schedule', id: taskId };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  }
});

document.addEventListener('dragend', () => {
  ui.dragContext = null;
  document.querySelectorAll('.is-dragging, .is-drop-valid, .is-drop-forbidden, .is-drop-hover').forEach((node) => {
    node.classList.remove('is-dragging', 'is-drop-valid', 'is-drop-forbidden', 'is-drop-hover');
  });
});

document.addEventListener('dragover', (e) => {
  if (!ui.dragContext) return;
  const col = e.target.closest('[data-drop-lane]');
  if (col && (ui.dragContext.kind === 'task' || ui.dragContext.kind === 'github')) {
    e.preventDefault();
    col.classList.add('is-drop-hover');
    return;
  }
  const dayCol = e.target.closest('[data-schedule-drop-day]');
  if (dayCol && ui.dragContext.kind === 'schedule') {
    e.preventDefault();
    dayCol.classList.add('is-drop-hover');
  }
});

document.addEventListener('dragleave', (e) => {
  const col = e.target.closest('[data-drop-lane], [data-schedule-drop-day]');
  if (col && !col.contains(e.relatedTarget)) {
    col.classList.remove('is-drop-hover');
  }
});

document.addEventListener('drop', async (e) => {
  if (!ui.dragContext) return;
  const ctx = ui.dragContext;
  ui.dragContext = null;

  document.querySelectorAll('.is-drop-valid, .is-drop-forbidden, .is-drop-hover').forEach((n) => {
    n.classList.remove('is-drop-valid', 'is-drop-forbidden', 'is-drop-hover');
  });

  const col = e.target.closest('[data-drop-lane]');
  if (col) {
    e.preventDefault();
    const toLane = col.getAttribute('data-drop-lane');
    const toStatus = col.getAttribute('data-drop-status');

    if (ctx.kind === 'github') {
      const targetLane = ['planned', 'scheduled', 'to_fix', 'queued'].includes(toLane) ? toLane : 'planned';
      await handleGithubImport(ctx.key, { boardLane: targetLane, autoRun: toStatus === 'IN_PROGRESS' });
      return;
    }

    if (ctx.kind === 'task') {
      const task = (state.tasks || []).find((t) => t.id === ctx.id);
      const check = isTransitionAllowed(task, toLane, toStatus);
      if (!check.allowed) {
        showToast('Transição não permitida', check.reason, { type: 'error', persistent: true });
        return;
      }
      if (toLane === 'scheduled' && !task?.meta?.schedule?.day) {
        await handleMoveTask(ctx.id, { toLane, toStatus });
        const fresh = (state.tasks || []).find((t) => t.id === ctx.id);
        if (fresh) openModal(renderScheduleModal(fresh, state, getTodayIso()));
        return;
      }
      await handleMoveTask(ctx.id, { toLane, toStatus });
    }
    return;
  }

  const dayCol = e.target.closest('[data-schedule-drop-day]');
  if (dayCol && ctx.kind === 'schedule') {
    e.preventDefault();
    const dayIso = dayCol.getAttribute('data-schedule-drop-day');
    const task = (state.tasks || []).find((t) => t.id === ctx.id);
    if (!task) return;
    try {
      const prev = task.meta?.schedule || {};
      await api.updateTask(task.id, {
        expectedMtimeMs: task.mtimeMs,
        meta: {
          boardLane: task.status === 'PLANNING' ? 'scheduled' : task.meta?.boardLane,
          schedule: {
            day: dayIso,
            agent: prev.agent || task.meta?.assignee || '@developer',
            aiEngine: prev.aiEngine || task.meta?.aiEngine || state.config?.defaultEngine || 'mock',
            destination: prev.destination || 'working_tree',
            note: prev.note || '',
          },
        },
      });
      showToast('Tarefa agendada', `${task.title} → ${dayIso}`, { type: 'success' });
      await fetchState({ silent: true });
    } catch (err) {
      showToast('Erro ao agendar tarefa', err.message, { type: 'error' });
    }
  }
});

/* ==========================================================================
   Event Delegation (Clicks, Changes, Submits, Keyboard)
   ========================================================================== */

document.addEventListener('click', async (e) => {
  // Close context menu if clicking outside it
  if (!el.contextMenu.hidden && !e.target.closest('#context-menu') && !e.target.closest('[data-action="open-card-menu"]')) {
    closeContextMenu();
  }

  // Sidebar navigation
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    navigate(navBtn.getAttribute('data-nav'));
    return;
  }

  const navJump = e.target.closest('[data-nav-jump]');
  if (navJump) {
    navigate(navJump.getAttribute('data-nav-jump'));
    return;
  }

  // Backdrop clicks
  if (e.target === el.drawerBackdrop) {
    closeDrawers();
    return;
  }
  if (e.target === el.modalBackdrop) {
    closeModal();
    return;
  }
  if (e.target === el.paletteBackdrop) {
    closePalette();
    return;
  }
  if (e.target === el.sidebarOverlay) {
    setMobileSidebar(false);
    return;
  }

  // Command palette item execution
  const palItem = e.target.closest('[data-palette-exec]');
  if (palItem) {
    executePaletteCommand(palItem.getAttribute('data-palette-exec'));
    return;
  }

  // GitHub item selection (full view)
  const ghSelect = e.target.closest('[data-gh-select]');
  if (ghSelect && !e.target.closest('button') && !e.target.closest('a')) {
    ui.ghSelectedKey = ghSelect.getAttribute('data-gh-select');
    if (ui.view === 'github') renderView();
    return;
  }

  // Action buttons
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    const action = actionEl.getAttribute('data-action');
    e.stopPropagation();

    switch (action) {
      case 'toggle-autorun':
        await toggleAutoRun();
        break;
      case 'jump-gates':
        navigate('mission');
        setTimeout(() => document.getElementById('mc-gates-panel')?.scrollIntoView({ behavior: 'smooth' }), 60);
        break;
      case 'open-new-task':
        openModal(renderNewTaskModal(state, { lane: actionEl.getAttribute('data-lane') || 'planned' }));
        break;
      case 'close-modal':
        closeModal();
        break;
      case 'close-drawers':
        closeDrawers();
        break;
      case 'open-github-drawer':
        openGithubDrawer();
        break;
      case 'open-task':
        openTaskDrawer(actionEl.getAttribute('data-task-id'));
        break;
      case 'open-agent-drawer':
        openAgentDrawer(actionEl.getAttribute('data-agent'));
        break;
      case 'open-card-menu':
        openCardContextMenu(actionEl.getAttribute('data-task-id'), actionEl);
        break;
      case 'menu-move-task': {
        const taskId = actionEl.getAttribute('data-task-id');
        const toLane = actionEl.getAttribute('data-to-lane');
        const toStatus = actionEl.getAttribute('data-to-status');
        closeContextMenu();
        await handleMoveTask(taskId, { toLane, toStatus });
        break;
      }
      case 'set-kanban-mode':
        ui.kanbanMode = actionEl.getAttribute('data-mode');
        savePref('harness-hub-kanban-mode', ui.kanbanMode);
        renderView();
        break;
      case 'set-quick-filter':
        ui.kanbanFilters.quick = actionEl.getAttribute('data-filter');
        renderView();
        break;
      case 'clear-kanban-filters':
        ui.kanbanFilters = { quick: 'all', agent: '', priority: '', tier: '', engine: '' };
        renderView();
        break;
      case 'goto-kanban-filter':
        ui.kanbanFilters.quick = actionEl.getAttribute('data-filter') || 'all';
        navigate('kanban');
        break;
      case 'open-quick-create':
        ui.quickCreateLane = actionEl.getAttribute('data-lane');
        renderView();
        break;
      case 'close-quick-create':
        ui.quickCreateLane = null;
        renderView();
        break;
      case 'run-gates':
        await handleRunGates(null);
        break;
      case 'run-gate-one':
        await handleRunGates(actionEl.getAttribute('data-gate'));
        break;
      case 'sync-all-adapters':
        await handleSyncAdapters(['antigravity', 'codex', 'cursor'], false);
        break;
      case 'sync-one-adapter':
        await handleSyncAdapters([actionEl.getAttribute('data-platform')], false);
        break;
      case 'refresh-adapters':
        try {
          state.adapters = await api.getAdaptersStatus();
          renderView();
          showToast('CLIs verificadas', `${state.adapters.inParityCount}/${state.adapters.total} em paridade.`, { type: 'info' });
        } catch (err) {
          showToast('Erro ao verificar adaptadores', err.message, { type: 'error' });
        }
        break;
      case 'view-adapter-diff': {
        const pid = actionEl.getAttribute('data-platform');
        const p = (state.adapters?.platforms || []).find((x) => x.id === pid);
        if (p) openModal(renderAdapterDiffModal(p));
        break;
      }
      case 'refresh-github':
        await loadGithubIssues();
        break;
      case 'gh-import':
        await handleGithubImport(actionEl.getAttribute('data-gh-key'), {
          boardLane: 'planned',
          autoRun: actionEl.getAttribute('data-auto-run') === 'true',
        });
        break;
      case 'set-queue-type':
        ui.queueTypeFilter = actionEl.getAttribute('data-type');
        renderView();
        break;
      case 'schedule-week': {
        const delta = Number(actionEl.getAttribute('data-delta'));
        ui.scheduleWeekOffset = delta === 0 ? 0 : ui.scheduleWeekOffset + delta;
        renderView();
        break;
      }
      case 'open-schedule-modal': {
        const task = (state.tasks || []).find((t) => t.id === actionEl.getAttribute('data-task-id'));
        if (task) openModal(renderScheduleModal(task, state));
        break;
      }
      case 'remove-schedule': {
        const taskId = actionEl.getAttribute('data-task-id');
        const task = (state.tasks || []).find((t) => t.id === taskId);
        if (!task) break;
        try {
          await api.updateTask(taskId, {
            expectedMtimeMs: task.mtimeMs,
            meta: { schedule: null, boardLane: task.status === 'PLANNING' ? 'planned' : task.meta?.boardLane },
          });
          closeModal();
          showToast('Agendamento removido', task.title, { type: 'info' });
          await fetchState({ silent: true });
        } catch (err) {
          showToast('Erro ao remover agendamento', err.message, { type: 'error' });
        }
        break;
      }
      case 'run-task-now':
        await handleRunTaskNow(actionEl.getAttribute('data-task-id'));
        break;
      case 'stop-run':
        await handleStopRun(actionEl.getAttribute('data-run-id'));
        break;
      case 'focus-run':
        ui.activeConsoleRunId = actionEl.getAttribute('data-run-id');
        if (ui.consoleMode === 'collapsed') ui.consoleMode = 'expanded';
        renderConsole();
        break;
      case 'toggle-console':
        ui.consoleMode = ui.consoleMode === 'collapsed' ? 'expanded' : 'collapsed';
        renderConsole();
        break;
      case 'set-console-mode':
        ui.consoleMode = actionEl.getAttribute('data-mode');
        renderConsole();
        break;
      case 'set-console-level':
        ui.consoleLevel = actionEl.getAttribute('data-level');
        renderConsole();
        break;
      case 'toggle-console-follow':
        ui.consoleAutoFollow = !ui.consoleAutoFollow;
        renderConsole();
        break;
      case 'copy-console-log': {
        const run = ui.runs[ui.activeConsoleRunId];
        const text = (run?.logs || []).map((l) => `[${l.ts}] ${l.line}`).join('\n');
        copyToClipboard(text || '(log vazio)');
        break;
      }
      case 'copy-text':
        copyToClipboard(actionEl.getAttribute('data-copy') || '');
        break;
      case 'open-block-modal': {
        const task = (state.tasks || []).find((t) => t.id === actionEl.getAttribute('data-task-id'));
        closeContextMenu();
        if (task) openModal(renderBlockModal(task));
        break;
      }
      case 'unblock-task': {
        const task = (state.tasks || []).find((t) => t.id === actionEl.getAttribute('data-task-id'));
        if (!task) break;
        try {
          await api.unblockTask(task.id, {
            actor: 'user',
            expectedMtimeMs: task.mtimeMs,
          });
          showToast('Tarefa desbloqueada', `${task.title} restaurada para ${task.blockedFrom || 'PLANNING'}.`, { type: 'success' });
          await fetchState({ silent: true });
        } catch (err) {
          if (err instanceof ApiError && err.code === 'CONFLICT') {
            openModal(renderConflictModal(task.id));
          } else {
            showToast('Erro ao desbloquear tarefa', err.message, { type: 'error', persistent: true });
          }
        }
        break;
      }
      case 'cancel-task': {
        const task = (state.tasks || []).find((t) => t.id === actionEl.getAttribute('data-task-id'));
        closeContextMenu();
        if (!task) break;
        ui.pendingLevelC = { kind: 'cancel-task', taskId: task.id };
        openModal(
          renderLevelCModal({
            title: 'Cancelar Tarefa',
            description: `A tarefa "${task.title}" será movida para CANCELLED (Canceladas / Descartadas).`,
            checkboxLabel: 'Confirmo que desejo descartar/cancelar esta tarefa.',
            confirmLabel: 'Confirmar cancelamento',
            actionId: 'cancel-task',
          })
        );
        break;
      }
      case 'confirm-level-c': {
        const pending = ui.pendingLevelC;
        closeModal();
        if (!pending) break;
        if (pending.kind === 'ship') {
          await handleMoveTask(pending.taskId, { toLane: pending.toLane, toStatus: pending.toStatus, confirmLevelC: true });
        } else if (pending.kind === 'adapter-overwrite') {
          await handleSyncAdapters(pending.platforms, true);
        } else if (pending.kind === 'cancel-task') {
          await handleMoveTask(pending.taskId, { toStatus: 'CANCELLED', reason: 'Cancelada pelo usuário' });
        }
        break;
      }
      case 'reload-after-conflict':
        closeModal();
        await fetchState({ silent: true });
        break;
    }
    return;
  }

  // Clicking a Kanban task card opens the detail drawer
  const card = e.target.closest('[data-task-card]');
  if (card && !e.target.closest('button') && !e.target.closest('a')) {
    openTaskDrawer(card.getAttribute('data-task-card'));
  }
});

// Change events (selects, checkboxes, drawer edits)
document.addEventListener('change', async (e) => {
  // Level C checkbox enables confirm button
  if (e.target.id === 'level-c-checkbox') {
    const btn = document.getElementById('btn-level-c-confirm');
    if (btn) btn.disabled = !e.target.checked;
    return;
  }

  // Kanban filter selects
  const filterKey = e.target.getAttribute('data-filter-select');
  if (filterKey) {
    ui.kanbanFilters[filterKey] = e.target.value;
    renderView();
    return;
  }

  if (e.target.hasAttribute('data-gh-kind')) {
    ui.ghFilterKind = e.target.value;
    renderView();
    return;
  }

  if (e.target.hasAttribute('data-queue-agent')) {
    ui.queueAgentFilter = e.target.value;
    renderView();
    return;
  }

  // Task Drawer metadata edits
  const metaField = e.target.getAttribute('data-task-meta');
  if (metaField) {
    const taskId = e.target.getAttribute('data-task-id');
    const task = (state.tasks || []).find((t) => t.id === taskId);
    if (!task) return;
    try {
      await api.updateTask(taskId, {
        expectedMtimeMs: task.mtimeMs,
        meta: { [metaField]: e.target.value || null },
      });
      showToast('Salvo', `${metaField} atualizado.`, { type: 'success' });
      await fetchState({ silent: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        openModal(renderConflictModal(taskId));
      } else {
        showToast('Erro ao salvar', err.message, { type: 'error' });
        renderOpenDrawers();
      }
    }
    return;
  }

  // Task Drawer schedule edits
  const schedField = e.target.getAttribute('data-task-schedule');
  if (schedField) {
    const taskId = e.target.getAttribute('data-task-id');
    const task = (state.tasks || []).find((t) => t.id === taskId);
    if (!task) return;
    const prev = task.meta?.schedule || {
      day: getTodayIso(),
      agent: task.meta?.assignee || '@developer',
      aiEngine: task.meta?.aiEngine || 'mock',
      destination: 'working_tree',
    };
    const nextSchedule = { ...prev, [schedField]: e.target.value };
    try {
      await api.updateTask(taskId, {
        expectedMtimeMs: task.mtimeMs,
        meta: { schedule: nextSchedule.day ? nextSchedule : null },
      });
      showToast('Agenda atualizada', '', { type: 'success' });
      await fetchState({ silent: true });
    } catch (err) {
      showToast('Erro ao atualizar agenda', err.message, { type: 'error' });
    }
    return;
  }

  // Task Drawer AC checkbox toggle
  if (e.target.hasAttribute('data-ac-toggle')) {
    const idx = Number(e.target.getAttribute('data-ac-toggle'));
    const taskId = e.target.getAttribute('data-task-id');
    const task = (state.tasks || []).find((t) => t.id === taskId);
    if (!task) return;
    const evidenceInput = el.taskDrawer.querySelector(`[data-ac-evidence="${idx}"]`);
    const evidence = evidenceInput ? evidenceInput.value.trim() : '';
    const checked = e.target.checked;
    if (checked && !evidence) {
      e.target.checked = false;
      showToast('Evidência obrigatória', 'Preencha o campo de evidência antes de marcar o critério como concluído.', { type: 'warn' });
      if (evidenceInput) evidenceInput.focus();
      return;
    }
    const updatedAcs = (task.acceptanceCriteria || []).map((a, i) => (i === idx ? { ...a, done: checked, evidence } : a));
    try {
      await api.updateTask(taskId, { expectedMtimeMs: task.mtimeMs, acceptanceCriteria: updatedAcs });
      await fetchState({ silent: true });
    } catch (err) {
      showToast('Erro ao atualizar critério', err.message, { type: 'error' });
      renderOpenDrawers();
    }
  }
});

// Live search inputs
document.addEventListener('input', (e) => {
  if (e.target.id === 'palette-search-input') {
    ui.paletteQuery = e.target.value;
    ui.paletteIndex = 0;
    const resultsWrap = document.getElementById('palette-results');
    if (resultsWrap) {
      const temp = document.createElement('div');
      temp.innerHTML = renderCommandPalette(state, ui);
      const nextResults = temp.querySelector('#palette-results');
      if (nextResults) resultsWrap.replaceWith(nextResults);
    }
    return;
  }
  if (e.target.hasAttribute('data-gh-search')) {
    ui.ghFilterSearch = e.target.value;
    renderView();
    return;
  }
  if (e.target.hasAttribute('data-schedule-search')) {
    ui.scheduleSearch = e.target.value;
    renderView();
    return;
  }
  if (e.target.hasAttribute('data-console-search')) {
    ui.consoleSearch = e.target.value;
    renderConsole();
  }
});

// Form submissions (Quick Create, New Task, Block, Schedule, Assign & Run)
document.addEventListener('submit', async (e) => {
  const quickForm = e.target.closest('[data-quick-create-form]');
  if (quickForm) {
    e.preventDefault();
    const lane = quickForm.getAttribute('data-quick-create-form');
    const fd = new FormData(quickForm);
    const title = String(fd.get('title') || '').trim();
    if (!title) return;
    try {
      await api.createTask({
        title,
        boardLane: lane,
        quickCreate: true,
        priority: String(fd.get('priority') || 'P2'),
        assignee: String(fd.get('assignee') || '') || null,
        type: lane === 'to_fix' ? 'Bug' : 'Feature',
        aiEngine: state.config?.defaultEngine || 'mock',
      });
      ui.quickCreateLane = null;
      showToast('Tarefa criada', title, { type: 'success' });
      await fetchState({ silent: true });
    } catch (err) {
      showToast('Erro ao criar tarefa', err.message, { type: 'error' });
    }
    return;
  }

  if (e.target.id === 'form-new-task') {
    e.preventDefault();
    const fd = new FormData(e.target);
    const title = String(fd.get('title') || '').trim();
    const acLines = String(fd.get('acceptanceCriteria') || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const tier = String(fd.get('tier') || 'T2');
    if (!title) {
      showToast('Título obrigatório', 'Informe um título para a tarefa.', { type: 'warn' });
      return;
    }
    if (tier !== 'Prototype' && acLines.length === 0) {
      showToast('Critério de aceite obrigatório', 'Adicione ao menos 1 critério de aceite para tarefas T2/T3/Hotfix.', { type: 'warn' });
      return;
    }
    try {
      await api.createTask({
        title,
        boardLane: String(fd.get('boardLane') || 'planned'),
        quickCreate: false,
        priority: String(fd.get('priority') || 'P2'),
        tier,
        type: String(fd.get('type') || 'Feature'),
        assignee: String(fd.get('assignee') || '') || null,
        aiEngine: String(fd.get('aiEngine') || 'mock'),
        problem: String(fd.get('problem') || '').trim() || `Resolver: ${title}`,
        acceptanceCriteria: acLines.length > 0 ? acLines : [`Entrega verificável para ${title}`],
        proof: String(fd.get('proof') || '').trim() || 'node scripts/validate-harness.mjs',
      });
      closeModal();
      showToast('Tarefa criada', title, { type: 'success' });
      await fetchState({ silent: true });
    } catch (err) {
      showToast('Erro ao criar tarefa', err.message, { type: 'error', persistent: true });
    }
    return;
  }

  if (e.target.id === 'form-block-task') {
    e.preventDefault();
    const taskId = e.target.getAttribute('data-task-id');
    const fd = new FormData(e.target);
    const reason = String(fd.get('reason') || '').trim();
    if (!reason) return;
    closeModal();
    await handleMoveTask(taskId, {
      toStatus: 'BLOCKED',
      reason,
      blockedNeedsUser: fd.get('blockedNeedsUser') === 'on',
    });
    return;
  }

  if (e.target.id === 'form-schedule-task') {
    e.preventDefault();
    const taskId = e.target.getAttribute('data-task-id');
    const task = (state.tasks || []).find((t) => t.id === taskId);
    if (!task) return;
    const fd = new FormData(e.target);
    try {
      await api.updateTask(taskId, {
        expectedMtimeMs: task.mtimeMs,
        meta: {
          boardLane: task.status === 'PLANNING' ? 'scheduled' : task.meta?.boardLane,
          schedule: {
            day: String(fd.get('day') || ''),
            agent: String(fd.get('agent') || '') || null,
            aiEngine: String(fd.get('aiEngine') || 'mock'),
            destination: String(fd.get('destination') || 'working_tree'),
            note: String(fd.get('note') || '').trim(),
          },
        },
      });
      closeModal();
      showToast('Agenda salva', task.title, { type: 'success' });
      await fetchState({ silent: true });
    } catch (err) {
      showToast('Erro ao agendar', err.message, { type: 'error' });
    }
    return;
  }

  if (e.target.id === 'form-assign-run') {
    e.preventDefault();
    const taskId = e.target.getAttribute('data-task-id');
    const task = (state.tasks || []).find((t) => t.id === taskId);
    if (!task) return;
    const fd = new FormData(e.target);
    const assignee = String(fd.get('assignee') || '@developer');
    const aiEngine = String(fd.get('aiEngine') || 'mock');
    try {
      await api.updateTask(taskId, {
        expectedMtimeMs: task.mtimeMs,
        meta: { assignee, aiEngine },
      });
      closeModal();
      await fetchState({ silent: true });
      await handleMoveTask(taskId, { toLane: 'in_progress', toStatus: 'IN_PROGRESS', engine: aiEngine, skipAssignCheck: true });
    } catch (err) {
      showToast('Erro ao atribuir agente', err.message, { type: 'error' });
    }
  }
});

/* ==========================================================================
   Keyboard Shortcuts & Command Palette Execution
   ========================================================================== */

function executePaletteCommand(cmdId) {
  closePalette();
  if (!cmdId) return;
  if (cmdId.startsWith('nav:')) {
    navigate(cmdId.slice(4));
  } else if (cmdId.startsWith('task:')) {
    openTaskDrawer(cmdId.slice(5));
  } else if (cmdId === 'act:new-task') {
    openModal(renderNewTaskModal(state));
  } else if (cmdId === 'act:run-gates') {
    handleRunGates(null);
  } else if (cmdId === 'act:sync-adapters') {
    handleSyncAdapters(['antigravity', 'codex', 'cursor'], false);
  } else if (cmdId === 'act:toggle-autorun') {
    toggleAutoRun();
  } else if (cmdId === 'act:toggle-theme') {
    applyTheme(ui.theme === 'dark' ? 'light' : 'dark');
  } else if (cmdId === 'act:toggle-console') {
    ui.consoleMode = ui.consoleMode === 'collapsed' ? 'expanded' : 'collapsed';
    renderConsole();
  }
}

document.addEventListener('keydown', (e) => {
  // Ctrl+K / Cmd+K Command Palette
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (ui.paletteOpen) closePalette();
    else openPalette();
    return;
  }

  // Palette arrow navigation
  if (ui.paletteOpen) {
    const items = [...el.palette.querySelectorAll('[data-palette-exec]')];
    if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    } else if (e.key === 'ArrowDown' && items.length > 0) {
      e.preventDefault();
      ui.paletteIndex = (ui.paletteIndex + 1) % items.length;
      items.forEach((it, i) => it.classList.toggle('is-active', i === ui.paletteIndex));
      items[ui.paletteIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp' && items.length > 0) {
      e.preventDefault();
      ui.paletteIndex = (ui.paletteIndex - 1 + items.length) % items.length;
      items.forEach((it, i) => it.classList.toggle('is-active', i === ui.paletteIndex));
      items[ui.paletteIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && items[ui.paletteIndex]) {
      e.preventDefault();
      executePaletteCommand(items[ui.paletteIndex].getAttribute('data-palette-exec'));
    }
    return;
  }

  if (e.key === 'Escape') {
    if (!el.contextMenu.hidden) {
      closeContextMenu();
    } else if (!el.modalBackdrop.hidden) {
      closeModal();
    } else if (ui.activeTaskId || ui.githubDrawerOpen || ui.activeAgentName) {
      closeDrawers();
    } else if (ui.quickCreateLane) {
      ui.quickCreateLane = null;
      renderView();
    }
    return;
  }

  const tag = document.activeElement?.tagName;
  const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  // 'N' opens New Task modal outside inputs
  if (!inInput && e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    if (!ui.disconnected) openModal(renderNewTaskModal(state));
    return;
  }

  // 'M' on a focused task card opens Move menu
  if (!inInput && e.key.toLowerCase() === 'm') {
    const card = document.activeElement?.closest('[data-task-card]');
    if (card) {
      e.preventDefault();
      openCardContextMenu(card.getAttribute('data-task-card'), card);
    }
  }
});

/* ==========================================================================
   Clipboard Helper & Static Shell Bindings
   ========================================================================== */

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copiado', 'Conteúdo copiado para a área de transferência.', { type: 'success' });
  } catch {
    showToast('Cópia indisponível', 'Copie manualmente o texto.', { type: 'warn' });
  }
}

document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
  applyTheme(ui.theme === 'dark' ? 'light' : 'dark');
});

document.getElementById('btn-open-palette')?.addEventListener('click', openPalette);
document.getElementById('btn-new-task')?.addEventListener('click', () => openModal(renderNewTaskModal(state)));
document.getElementById('btn-github-drawer')?.addEventListener('click', openGithubDrawer);
document.getElementById('btn-reconnect-sse')?.addEventListener('click', () => sse.reconnect());

el.sidebarCollapseBtn?.addEventListener('click', () => {
  ui.sidebarCollapsed = !ui.sidebarCollapsed;
  applySidebarState();
});

el.mobileMenuBtn?.addEventListener('click', () => {
  setMobileSidebar(!el.sidebar.classList.contains('is-mobile-open'));
});

// Live elapsed timer tick (1s) without full re-render
setInterval(() => {
  document.querySelectorAll('[data-elapsed-start]').forEach((node) => {
    const iso = node.getAttribute('data-elapsed-start');
    if (iso) node.textContent = formatElapsed(iso);
  });
}, 1000);

/* ==========================================================================
   Bootstrap
   ========================================================================== */

applyTheme(ui.theme);
applySidebarState();
renderConsole();
sse.connect();
fetchState();
// Background preload GitHub Inbox count
loadGithubIssues();
