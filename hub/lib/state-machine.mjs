// Dual-Board state machine, harness invariants (RN-01..08), required reviewers, and demand queue.
// Zero dependencies — Node.js v24 native ESM.

export const STATUSES = Object.freeze([
  'PLANNING',
  'IN_PROGRESS',
  'IN_REVIEW',
  'READY_TO_COMMIT',
  'COMMITTED',
  'SHIPPED',
  'BLOCKED',
  'CANCELLED',
  'SUPERSEDED',
]);

export const TERMINAL_STATUSES = new Set(['SHIPPED', 'CANCELLED', 'SUPERSEDED']);

export const BLOCKABLE_PREV_STATUSES = new Set([
  'PLANNING',
  'IN_PROGRESS',
  'IN_REVIEW',
  'READY_TO_COMMIT',
]);

export const PLANNING_LANES = Object.freeze(['planned', 'scheduled', 'to_fix', 'queued']);
export const EXECUTION_LANES = Object.freeze([
  'in_progress',
  'in_review',
  'ready',
  'done',
  'blocked',
  'closed',
]);
export const ALL_LANES = Object.freeze([...PLANNING_LANES, ...EXECUTION_LANES]);

export const PRIORITIES = Object.freeze(['P0', 'P1', 'P2', 'P3']);
export const PRIORITY_RANK = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });

export const TIERS = Object.freeze(['T2', 'T3', 'Hotfix', 'Prototype']);
export const TYPES = Object.freeze(['Feature', 'Bug', 'Hotfix', 'Prototype', 'Docs', 'Ops', 'Harness']);
export const DESTINATIONS = Object.freeze(['working_tree', 'local_commit', 'pull_request', 'deploy']);
export const LEVEL_C_DESTINATIONS = new Set(['pull_request', 'deploy']);

// Agents that never edit product code (PRD §8.5)
export const READ_ONLY_AGENTS = new Set(['@explorer', '@code-reviewer', '@security-auditor']);

export const LANE_TO_STATUS = Object.freeze({
  planned: 'PLANNING',
  scheduled: 'PLANNING',
  to_fix: 'PLANNING',
  queued: 'PLANNING',
  in_progress: 'IN_PROGRESS',
  in_review: 'IN_REVIEW',
  ready: 'READY_TO_COMMIT',
  done: 'COMMITTED',
  blocked: 'BLOCKED',
  closed: 'CANCELLED',
});

// Allowed direct status transitions (excluding BLOCKED/CANCELLED/SUPERSEDED handled explicitly)
const ALLOWED_MATRIX = Object.freeze({
  PLANNING: new Set(['IN_PROGRESS']),
  IN_PROGRESS: new Set(['PLANNING', 'IN_REVIEW']),
  IN_REVIEW: new Set(['IN_PROGRESS', 'READY_TO_COMMIT']),
  READY_TO_COMMIT: new Set(['IN_PROGRESS', 'COMMITTED']),
  COMMITTED: new Set(['SHIPPED']),
  SHIPPED: new Set(),
  CANCELLED: new Set(),
  SUPERSEDED: new Set(),
});

const STATUS_LINE_RE =
  /^(PLANNING|IN_PROGRESS|IN_REVIEW|READY_TO_COMMIT|COMMITTED|SHIPPED|BLOCKED: .+|BLOCKED\((PLANNING|IN_PROGRESS|IN_REVIEW|READY_TO_COMMIT)\): .+|CANCELLED|SUPERSEDED: .+)$/;

/**
 * Parses a raw `## Status:` value into structured fields.
 */
export function parseStatusLine(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    return {
      raw: '',
      status: 'PLANNING',
      blockedFrom: null,
      blockedReason: null,
      supersededBy: null,
      valid: false,
    };
  }

  const valid = STATUS_LINE_RE.test(trimmed);

  const blockedWithPrev = trimmed.match(/^BLOCKED\((PLANNING|IN_PROGRESS|IN_REVIEW|READY_TO_COMMIT)\):\s*(.+)$/);
  if (blockedWithPrev) {
    return {
      raw: trimmed,
      status: 'BLOCKED',
      blockedFrom: blockedWithPrev[1],
      blockedReason: blockedWithPrev[2].trim(),
      supersededBy: null,
      valid,
    };
  }

  const blockedPlain = trimmed.match(/^BLOCKED:\s*(.+)$/);
  if (blockedPlain) {
    return {
      raw: trimmed,
      status: 'BLOCKED',
      blockedFrom: null,
      blockedReason: blockedPlain[1].trim(),
      supersededBy: null,
      valid,
    };
  }

  const superseded = trimmed.match(/^SUPERSEDED:\s*(.+)$/);
  if (superseded) {
    return {
      raw: trimmed,
      status: 'SUPERSEDED',
      blockedFrom: null,
      blockedReason: null,
      supersededBy: superseded[1].trim(),
      valid,
    };
  }

  return {
    raw: trimmed,
    status: valid ? trimmed : 'PLANNING',
    blockedFrom: null,
    blockedReason: null,
    supersededBy: null,
    valid,
  };
}

/**
 * Formats a status object into a string guaranteed to match `scripts/validate-task.mjs`.
 */
export function formatStatusLine({ status, blockedFrom = null, blockedReason = '', supersededBy = '' }) {
  if (status === 'BLOCKED') {
    const reason = String(blockedReason || '').trim() || 'Bloqueada';
    if (blockedFrom && BLOCKABLE_PREV_STATUSES.has(blockedFrom)) {
      return `BLOCKED(${blockedFrom}): ${reason}`;
    }
    return `BLOCKED: ${reason}`;
  }
  if (status === 'SUPERSEDED') {
    const ref = String(supersededBy || '').trim();
    return `SUPERSEDED: ${ref}`;
  }
  return status;
}

/**
 * Maps a task status + metadata to its default Dual-Board lane.
 */
export function statusToDefaultLane(status, meta = {}) {
  if (status === 'PLANNING') {
    if (meta.boardLane && PLANNING_LANES.includes(meta.boardLane)) {
      return meta.boardLane;
    }
    if (meta.schedule?.day) return 'scheduled';
    if (meta.type === 'Bug' || meta.type === 'Hotfix') return 'to_fix';
    return 'planned';
  }
  switch (status) {
    case 'IN_PROGRESS':
      return 'in_progress';
    case 'IN_REVIEW':
      return 'in_review';
    case 'READY_TO_COMMIT':
      return 'ready';
    case 'COMMITTED':
    case 'SHIPPED':
      return 'done';
    case 'BLOCKED':
      return 'blocked';
    case 'CANCELLED':
    case 'SUPERSEDED':
      return 'closed';
    default:
      return 'planned';
  }
}

/**
 * Resolves target `{ toStatus, toLane }` from caller-provided `toLane` and/or `toStatus`.
 */
export function resolveTarget({ toLane = null, toStatus = null, currentStatus = 'PLANNING', meta = {} }) {
  let targetStatus = toStatus || null;
  let targetLane = toLane || null;

  if (targetLane && !ALL_LANES.includes(targetLane)) {
    return {
      ok: false,
      code: 'INVALID_LANE',
      statusCode: 400,
      message: `Raia inválida: "${targetLane}"`,
    };
  }

  if (targetLane && !targetStatus) {
    if (targetLane === 'done') {
      targetStatus = currentStatus === 'COMMITTED' ? 'SHIPPED' : 'COMMITTED';
    } else {
      targetStatus = LANE_TO_STATUS[targetLane];
    }
  }

  if (!targetStatus) {
    return {
      ok: false,
      code: 'MISSING_TARGET',
      statusCode: 400,
      message: 'Informe toStatus ou toLane para mover a tarefa',
    };
  }

  if (!STATUSES.includes(targetStatus)) {
    return {
      ok: false,
      code: 'INVALID_STATUS',
      statusCode: 400,
      message: `Status inválido: "${targetStatus}"`,
    };
  }

  if (!targetLane) {
    targetLane = statusToDefaultLane(targetStatus, meta);
  }

  return { ok: true, toStatus: targetStatus, toLane: targetLane };
}

/**
 * Computes required reviewers for a tier (PRD §8.3).
 */
export function getRequiredReviewers(meta = {}) {
  const tier = meta.tier || 'T2';
  if (tier === 'Prototype' || meta.type === 'Prototype') return [];

  const reviewers = new Set(['@code-reviewer']);
  if (tier === 'T3') {
    reviewers.add('@security-auditor');
    reviewers.add('@qa-engineer');
  } else if (tier === 'Hotfix') {
    reviewers.add('@qa-engineer');
    if (meta.sensitiveSurface) reviewers.add('@security-auditor');
  } else {
    // T2
    if (meta.sensitiveSurface) reviewers.add('@security-auditor');
    if (meta.userFacing) reviewers.add('@qa-engineer');
  }
  return [...reviewers];
}

/**
 * Validates assignee and reviewer rules (RN-01, RN-02, RN-03, PRD §8.5).
 */
export function validateReviewerAssignment({ tier = 'T2', assignee = null, reviewer = null } = {}) {
  if (assignee === '@committer' || reviewer === '@committer') {
    return {
      ok: false,
      code: 'COMMITTER_ONLY_READY',
      statusCode: 422,
      message: '@committer só atua em READY_TO_COMMIT',
    };
  }

  if (assignee && READ_ONLY_AGENTS.has(assignee)) {
    return {
      ok: false,
      code: 'READ_ONLY_ASSIGNEE',
      statusCode: 422,
      message: `${assignee} não altera código e não pode ser responsável por Construir`,
    };
  }

  if (tier !== 'Prototype' && assignee && reviewer && assignee === reviewer) {
    return {
      ok: false,
      code: 'SELF_REVIEW_FORBIDDEN',
      statusCode: 422,
      message: 'O autor não revisa o próprio trabalho T2+',
    };
  }

  return { ok: true };
}

/**
 * Normalizes a file path for cross-platform overlap comparison (RN-05).
 */
export function normalizeFilePath(rawPath) {
  if (typeof rawPath !== 'string') return '';
  let cleaned = rawPath.trim();
  // Strip leading markdown bullet
  cleaned = cleaned.replace(/^[-*]\s+/, '');
  // Strip trailing description after em-dash or spaced hyphen
  cleaned = cleaned.split(/\s+[—–]\s+|\s+-\s+/)[0].trim();
  // Strip surrounding backticks or quotes
  cleaned = cleaned.replace(/^[`'"]+|[`'"]+$/g, '');
  // Normalize separators and leading ./
  cleaned = cleaned.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
  return cleaned;
}

/**
 * Finds RN-05 file overlaps between `task` and any other task currently `IN_PROGRESS`.
 */
export function findFileOverlaps(task, allTasks = []) {
  const myFiles = new Set(
    (task.files || []).map(normalizeFilePath).filter(Boolean),
  );
  if (myFiles.size === 0) return [];

  const overlaps = [];
  for (const other of allTasks) {
    if (!other || other.id === task.id) continue;
    if (other.status !== 'IN_PROGRESS') continue;
    const shared = [];
    for (const f of other.files || []) {
      const norm = normalizeFilePath(f);
      if (norm && myFiles.has(norm)) shared.push(norm);
    }
    if (shared.length > 0) {
      overlaps.push({
        taskId: other.id,
        title: other.title || other.id,
        files: [...new Set(shared)],
      });
    }
  }
  return overlaps;
}

/**
 * Validates a Dual-Board / status transition according to PRD §8.2 and spec §2.2.1.
 */
export function validateTransition(task, options = {}, context = {}) {
  const {
    toLane = null,
    toStatus = null,
    actor = 'user',
    reason = null,
    supersededBy = null,
    confirmLevelC = false,
  } = options;
  const { allTasks = [] } = context;

  const fromStatus = task.status;
  const resolved = resolveTarget({
    toLane,
    toStatus,
    currentStatus: fromStatus,
    meta: task.meta || {},
  });
  if (!resolved.ok) return resolved;

  const targetStatus = resolved.toStatus;
  const targetLane = resolved.toLane;

  // 1. Free movement between Planning lanes while staying PLANNING
  if (
    fromStatus === 'PLANNING' &&
    targetStatus === 'PLANNING' &&
    PLANNING_LANES.includes(targetLane)
  ) {
    return {
      ok: true,
      fromStatus,
      toStatus: 'PLANNING',
      toLane: targetLane,
      isLaneOnlyMove: true,
    };
  }

  // No-op transition to the same non-planning status
  if (fromStatus === targetStatus) {
    return {
      ok: false,
      code: 'SAME_STATUS',
      statusCode: 400,
      message: `A tarefa já está em ${fromStatus}`,
    };
  }

  // 2. Terminal states cannot move anywhere
  if (TERMINAL_STATUSES.has(fromStatus)) {
    return {
      ok: false,
      code: 'TERMINAL_STATUS',
      statusCode: 422,
      message: `Tarefas em ${fromStatus} são terminais e não podem ser movidas`,
    };
  }

  // 3. Transitions TO CANCELLED / SUPERSEDED
  if (targetStatus === 'CANCELLED') {
    if (fromStatus === 'COMMITTED') {
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        statusCode: 422,
        message: 'Não é permitido cancelar uma tarefa já COMMITTED',
      };
    }
    return { ok: true, fromStatus, toStatus: 'CANCELLED', toLane: 'closed', isLaneOnlyMove: false };
  }

  if (targetStatus === 'SUPERSEDED') {
    if (fromStatus === 'COMMITTED') {
      return {
        ok: false,
        code: 'INVALID_TRANSITION',
        statusCode: 422,
        message: 'Não é permitido superseder uma tarefa já COMMITTED',
      };
    }
    const ref = typeof supersededBy === 'string' ? supersededBy.trim() : '';
    if (!ref) {
      return {
        ok: false,
        code: 'SUPERSEDED_REF_REQUIRED',
        statusCode: 400,
        message: 'Superseder exige informar outra tarefa existente',
      };
    }
    if (ref === task.id || ref === `.specs/tasks/${task.id}.md`) {
      return {
        ok: false,
        code: 'SELF_SUPERSEDE_FORBIDDEN',
        statusCode: 422,
        message: 'Uma tarefa não pode superseder a si mesma',
      };
    }
    if (allTasks.length > 0) {
      const exists = allTasks.some(
        (t) => t.id === ref || t.filePath === ref || `.specs/tasks/${t.id}.md` === ref,
      );
      if (!exists) {
        return {
          ok: false,
          code: 'SUPERSEDED_TARGET_NOT_FOUND',
          statusCode: 422,
          message: `Tarefa de referência não encontrada: ${ref}`,
        };
      }
    }
    return {
      ok: true,
      fromStatus,
      toStatus: 'SUPERSEDED',
      toLane: 'closed',
      supersededBy: ref,
      isLaneOnlyMove: false,
    };
  }

  // 4. Transitions TO BLOCKED
  if (targetStatus === 'BLOCKED') {
    const cleanReason = typeof reason === 'string' ? reason.trim() : '';
    if (!cleanReason) {
      return {
        ok: false,
        code: 'REASON_REQUIRED',
        statusCode: 400,
        message: 'Bloquear uma tarefa exige motivo não vazio',
      };
    }
    return {
      ok: true,
      fromStatus,
      toStatus: 'BLOCKED',
      toLane: 'blocked',
      blockedFrom: fromStatus,
      blockedReason: cleanReason,
      isLaneOnlyMove: false,
    };
  }

  // 5. Transitions FROM BLOCKED (unblocking restores previous status only)
  if (fromStatus === 'BLOCKED') {
    const expectedPrev = task.blockedFrom || task.meta?.blockedFrom || 'PLANNING';
    if (targetStatus !== expectedPrev) {
      return {
        ok: false,
        code: 'INVALID_UNBLOCK',
        statusCode: 422,
        message: `Desbloquear restaura apenas o status anterior (${expectedPrev})`,
        details: { expectedPrev, requested: targetStatus },
      };
    }
    if (targetStatus === 'IN_PROGRESS') {
      const overlaps = findFileOverlaps(task, allTasks);
      if (overlaps.length > 0) {
        return {
          ok: false,
          code: 'FILE_CONFLICT',
          statusCode: 409,
          message: `Conflito de arquivos (RN-05) com ${overlaps[0].taskId}: ${overlaps[0].files.join(', ')}`,
          details: { overlaps },
        };
      }
    }
    return {
      ok: true,
      fromStatus,
      toStatus: targetStatus,
      toLane: statusToDefaultLane(targetStatus, task.meta || {}),
      isLaneOnlyMove: false,
    };
  }

  // 6. Standard matrix check
  const allowedTargets = ALLOWED_MATRIX[fromStatus];
  if (!allowedTargets || !allowedTargets.has(targetStatus)) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      statusCode: 422,
      message: `Transição proibida pela matriz: ${fromStatus} → ${targetStatus}`,
    };
  }

  // 7. Gate g1: PLANNING -> IN_PROGRESS
  if (fromStatus === 'PLANNING' && targetStatus === 'IN_PROGRESS') {
    if (task.valid === false) {
      return {
        ok: false,
        code: 'TASK_INVALID',
        statusCode: 422,
        message: 'Arquivo de tarefa reprovado pelo validador — corrija antes de iniciar',
        details: { validationErrors: task.validationErrors || [] },
      };
    }
    const overlaps = findFileOverlaps(task, allTasks);
    if (overlaps.length > 0) {
      return {
        ok: false,
        code: 'FILE_CONFLICT',
        statusCode: 409,
        message: `Conflito de arquivos (RN-05) com ${overlaps[0].taskId}: ${overlaps[0].files.join(', ')}`,
        details: { overlaps },
      };
    }
  }

  // 8. Gate g2: IN_REVIEW -> READY_TO_COMMIT
  if (fromStatus === 'IN_REVIEW' && targetStatus === 'READY_TO_COMMIT') {
    const meta = task.meta || {};
    if (meta.tier === 'Prototype' || meta.type === 'Prototype') {
      return {
        ok: false,
        code: 'PROTOTYPE_NOT_PROMOTED',
        statusCode: 422,
        message: 'Protótipo não é comitado — promova para T2/T3',
      };
    }

    const acs = task.acceptanceCriteria || [];
    const missingAcs = acs.filter((ac) => !ac.done || !String(ac.evidence || '').trim());
    if (acs.length === 0 || missingAcs.length > 0) {
      return {
        ok: false,
        code: 'INCOMPLETE_ACS',
        statusCode: 422,
        message:
          acs.length === 0
            ? 'Nenhum critério de aceite encontrado'
            : `${missingAcs.length} critério(s) de aceite sem conclusão ou sem evidência`,
        details: { missingIndices: missingAcs.map((a) => a.index) },
      };
    }

    const assignee = meta.assignee || null;
    const reviewer = meta.reviewer || null;
    const approved = Array.isArray(meta.reviewersApproved) ? meta.reviewersApproved : [];

    // RN-02 / RN-03: author cannot review own T2+ work
    if (assignee && (reviewer === assignee || approved.includes(assignee))) {
      return {
        ok: false,
        code: 'SELF_REVIEW_FORBIDDEN',
        statusCode: 422,
        message: 'O autor não revisa o próprio trabalho T2+',
      };
    }

    const requiredReviewers = getRequiredReviewers(meta);
    const missingReviewers = requiredReviewers.filter((r) => !approved.includes(r));
    if (missingReviewers.length > 0) {
      return {
        ok: false,
        code: 'MISSING_APPROVALS',
        statusCode: 422,
        message: `Falta aprovação de revisor(es) obrigatório(s): ${missingReviewers.join(', ')}`,
        details: { requiredReviewers, missingReviewers, reviewersApproved: approved },
      };
    }
  }

  // 9. Lock rule: READY_TO_COMMIT -> COMMITTED (only @committer)
  if (fromStatus === 'READY_TO_COMMIT' && targetStatus === 'COMMITTED') {
    if (actor !== '@committer') {
      return {
        ok: false,
        code: 'COMMITTER_ONLY',
        statusCode: 403,
        message: 'Somente @committer move para COMMITTED',
      };
    }
  }

  // 10. Level C confirmation: COMMITTED -> SHIPPED
  if (fromStatus === 'COMMITTED' && targetStatus === 'SHIPPED') {
    if (confirmLevelC !== true) {
      return {
        ok: false,
        code: 'CONFIRM_LEVEL_C',
        statusCode: 409,
        message: 'Confirmação Level C obrigatória para mover COMMITTED → SHIPPED',
      };
    }
  }

  return {
    ok: true,
    fromStatus,
    toStatus: targetStatus,
    toLane: targetLane,
    isLaneOnlyMove: false,
  };
}

/**
 * Computes the deterministic demand queue (PRD §8.5 & AC-09.1..09.6).
 */
export function computeQueue(tasks = [], { agent = null, today = null } = {}) {
  const todayStr = today || new Date().toISOString().slice(0, 10);
  const eligible = [];
  const ineligible = [];

  const pushItem = (item, reasons) => {
    if (agent && item.targetAgent !== agent) return;
    if (reasons.length === 0) {
      eligible.push(item);
    } else {
      ineligible.push({ ...item, reasons, reason: reasons[0] });
    }
  };

  for (const task of tasks) {
    const meta = task.meta || {};
    const priority = PRIORITIES.includes(meta.priority) ? meta.priority : 'P2';
    const order = typeof meta.order === 'number' ? meta.order : 0;
    const createdAt = meta.createdAt || '';
    const scheduleDay = meta.schedule?.day || null;
    const isFutureScheduled = Boolean(scheduleDay && scheduleDay > todayStr);
    const isScheduledTodayOrPast = Boolean(scheduleDay && scheduleDay <= todayStr);

    if (task.status === 'PLANNING') {
      const targetAgent = meta.schedule?.agent || meta.assignee || null;
      const reasons = [];
      if (!targetAgent) reasons.push('Sem agente atribuído');
      else if (READ_ONLY_AGENTS.has(targetAgent)) {
        reasons.push(`${targetAgent} não altera código`);
      } else if (targetAgent === '@committer') {
        reasons.push('@committer só atua em READY_TO_COMMIT');
      }
      if (task.valid === false) reasons.push('Validador reprovou');
      if (task.lock) reasons.push(`Já reivindicado por ${task.lock.agent}`);
      const overlaps = findFileOverlaps(task, tasks);
      if (overlaps.length > 0) {
        reasons.push(`Conflito de arquivos com ${overlaps[0].taskId}`);
      }
      if (isFutureScheduled) reasons.push(`Agendado para ${scheduleDay}`);

      pushItem(
        {
          kind: 'build',
          taskId: task.id,
          title: task.title,
          status: task.status,
          boardLane: meta.boardLane || statusToDefaultLane(task.status, meta),
          targetAgent,
          priority,
          tier: meta.tier || 'T2',
          aiEngine: meta.schedule?.aiEngine || meta.aiEngine || 'mock',
          scheduleDay,
          isScheduledTodayOrPast,
          order,
          createdAt,
          isNext: false,
        },
        reasons,
      );
    } else if (task.status === 'IN_REVIEW') {
      const required = getRequiredReviewers(meta);
      const approved = Array.isArray(meta.reviewersApproved) ? meta.reviewersApproved : [];
      const pending = required.filter((r) => !approved.includes(r));

      for (const reviewerAgent of pending) {
        const reasons = [];
        if (task.lock && task.lock.agent !== reviewerAgent) {
          reasons.push(`Já reivindicado por ${task.lock.agent}`);
        }
        if (meta.tier !== 'Prototype' && meta.assignee && meta.assignee === reviewerAgent) {
          reasons.push('O autor não revisa o próprio trabalho T2+');
        }
        if (isFutureScheduled) reasons.push(`Agendado para ${scheduleDay}`);

        pushItem(
          {
            kind: 'review',
            taskId: task.id,
            title: task.title,
            status: task.status,
            boardLane: 'in_review',
            targetAgent: reviewerAgent,
            priority,
            tier: meta.tier || 'T2',
            aiEngine: meta.aiEngine || 'mock',
            scheduleDay,
            isScheduledTodayOrPast,
            order,
            createdAt,
            isNext: false,
          },
          reasons,
        );
      }
    } else if (task.status === 'READY_TO_COMMIT') {
      const reasons = [];
      if (task.lock && task.lock.agent !== '@committer') {
        reasons.push(`Já reivindicado por ${task.lock.agent}`);
      }
      if (isFutureScheduled) reasons.push(`Agendado para ${scheduleDay}`);

      pushItem(
        {
          kind: 'commit',
          taskId: task.id,
          title: task.title,
          status: task.status,
          boardLane: 'ready',
          targetAgent: '@committer',
          priority,
          tier: meta.tier || 'T2',
          aiEngine: meta.aiEngine || 'mock',
          scheduleDay,
          isScheduledTodayOrPast,
          order,
          createdAt,
          isNext: false,
        },
        reasons,
      );
    }
  }

  // AC-09.2 deterministic sort: priority -> scheduled today/past -> queued lane -> manual order -> oldest createdAt -> taskId
  eligible.sort((a, b) => {
    const pDiff = (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2);
    if (pDiff !== 0) return pDiff;
    if (a.isScheduledTodayOrPast !== b.isScheduledTodayOrPast) {
      return a.isScheduledTodayOrPast ? -1 : 1;
    }
    const aQueued = a.boardLane === 'queued';
    const bQueued = b.boardLane === 'queued';
    if (aQueued !== bQueued) {
      return aQueued ? -1 : 1;
    }
    if (a.order !== b.order) return a.order - b.order;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return a.taskId.localeCompare(b.taskId);
  });

  // Mark top eligible item per agent as isNext (AC-09.6)
  const seenAgent = new Set();
  for (const item of eligible) {
    if (item.targetAgent && !seenAgent.has(item.targetAgent)) {
      item.isNext = true;
      seenAgent.add(item.targetAgent);
    }
  }

  return { eligible, ineligible };
}
