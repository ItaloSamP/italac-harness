// Private Calendar & Study/Work Planner store for Harness Hub.
// Persists personal, study, and work schedules to a gitignored local JSON file
// (`.specs/hub/private-calendar.json`) using atomic writes.
// Zero dependencies — Node.js v24 native ESM.

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { atomicWriteFile, StoreError, validateTaskId } from './store.mjs';

export const WORKSPACES = Object.freeze(['work', 'study', 'personal']);
export const EVENT_KINDS = Object.freeze(['deadline', 'study', 'delivery', 'plan', 'reminder']);
export const EVENT_STATUSES = Object.freeze(['planned', 'done']);
export const CALENDAR_REL_PATH = '.specs/hub/private-calendar.json';

const WORKSPACE_SET = new Set(WORKSPACES);
const KIND_SET = new Set(EVENT_KINDS);
const STATUS_SET = new Set(EVENT_STATUSES);

const EVENT_ID_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const MAX_TITLE_LEN = 140;
const MAX_SUBJECT_LEN = 100;
const MAX_NOTES_LEN = 2000;

export function validateEventId(id) {
  if (typeof id !== 'string' || !id) {
    throw new StoreError('INVALID_EVENT_ID', 'ID de evento inválido ou vazio.', 400);
  }
  if (
    id.includes('/') ||
    id.includes('\\') ||
    id.includes('..') ||
    id.includes('\0') ||
    !EVENT_ID_RE.test(id)
  ) {
    throw new StoreError(
      'INVALID_EVENT_ID',
      `ID de evento inválido: "${id}". Use apenas letras minúsculas, números e hífens.`,
      400,
    );
  }
  return id;
}

function validateDate(value, fieldName = 'date') {
  if (typeof value !== 'string') {
    throw new StoreError('INVALID_DATE', `Campo "${fieldName}" deve estar no formato YYYY-MM-DD.`, 400);
  }
  const trimmed = value.trim();
  const m = DATE_RE.exec(trimmed);
  if (!m) {
    throw new StoreError(
      'INVALID_DATE',
      `Data inválida em "${fieldName}": "${trimmed}". Use YYYY-MM-DD.`,
      400,
    );
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    throw new StoreError(
      'INVALID_DATE',
      `Data inexistente em "${fieldName}": "${trimmed}".`,
      400,
    );
  }
  return trimmed;
}

function validateMonth(value) {
  if (typeof value !== 'string' || !MONTH_RE.test(value.trim())) {
    throw new StoreError(
      'INVALID_MONTH',
      `Mês inválido: "${String(value)}". Use o formato YYYY-MM.`,
      400,
    );
  }
  return value.trim();
}

function validateOptionalTime(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new StoreError(
      'INVALID_TIME',
      `Horário inválido em "${fieldName}". Use o formato HH:MM.`,
      400,
    );
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!TIME_RE.test(trimmed)) {
    throw new StoreError(
      'INVALID_TIME',
      `Horário inválido em "${fieldName}": "${trimmed}". Use HH:MM (00:00-23:59).`,
      400,
    );
  }
  return trimmed;
}

function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const m = TIME_RE.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function validateTimeRange(startTime, endTime) {
  if (startTime && endTime) {
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (startMin !== null && endMin !== null && endMin < startMin) {
      throw new StoreError(
        'INVALID_TIME_RANGE',
        `Horário final (${endTime}) não pode ser anterior ao inicial (${startTime}).`,
        400,
      );
    }
  }
}

function validateTitle(value) {
  if (typeof value !== 'string') {
    throw new StoreError('INVALID_TITLE', 'Título obrigatório.', 400);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new StoreError('INVALID_TITLE', 'Título obrigatório.', 400);
  }
  if (trimmed.length > MAX_TITLE_LEN) {
    throw new StoreError(
      'INVALID_TITLE',
      `Título deve ter no máximo ${MAX_TITLE_LEN} caracteres.`,
      400,
    );
  }
  return trimmed;
}

function validateWorkspace(value, defaultValue = 'personal') {
  if (value === undefined || value === null || value === '') return defaultValue;
  const trimmed = String(value).trim();
  if (!WORKSPACE_SET.has(trimmed)) {
    throw new StoreError(
      'INVALID_WORKSPACE',
      `Ambiente inválido: "${trimmed}". Use ${WORKSPACES.join(', ')}.`,
      400,
    );
  }
  return trimmed;
}

function validateKind(value, defaultValue = 'plan') {
  if (value === undefined || value === null || value === '') return defaultValue;
  const trimmed = String(value).trim();
  if (!KIND_SET.has(trimmed)) {
    throw new StoreError(
      'INVALID_KIND',
      `Tipo de evento inválido: "${trimmed}". Use ${EVENT_KINDS.join(', ')}.`,
      400,
    );
  }
  return trimmed;
}

function validateStatus(value, defaultValue = 'planned') {
  if (value === undefined || value === null || value === '') return defaultValue;
  const trimmed = String(value).trim();
  if (!STATUS_SET.has(trimmed)) {
    throw new StoreError(
      'INVALID_STATUS',
      `Status inválido: "${trimmed}". Use ${EVENT_STATUSES.join(', ')}.`,
      400,
    );
  }
  return trimmed;
}

function validateOptionalText(value, maxLen, fieldName) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new StoreError('INVALID_FIELD', `Campo "${fieldName}" deve ser texto.`, 400);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLen) {
    throw new StoreError(
      'INVALID_FIELD',
      `Campo "${fieldName}" deve ter no máximo ${maxLen} caracteres.`,
      400,
    );
  }
  return trimmed;
}

function getIsoWeekBounds(dateStr) {
  const m = DATE_RE.exec(dateStr);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  const dow = dt.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const weekStart = new Date(dt.getTime() + mondayOffset * 86_400_000);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86_400_000);
  return {
    start: weekStart.toISOString().slice(0, 10),
    end: weekEnd.toISOString().slice(0, 10),
  };
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const aTime = a.startTime || '99:99';
    const bTime = b.startTime || '99:99';
    if (aTime !== bTime) return aTime.localeCompare(bTime);
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
}

/**
 * Creates a private calendar & planner store backed by `.specs/hub/private-calendar.json`.
 *
 * @param {string} rootDir
 */
export function createCalendarStore(rootDir) {
  const root = resolve(rootDir);
  const filePath = join(root, '.specs', 'hub', 'private-calendar.json');

  function readData() {
    if (!existsSync(filePath)) {
      return { version: 1, events: [] };
    }
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
      const events = Array.isArray(parsed?.events) ? parsed.events : [];
      return { version: parsed?.version || 1, events };
    } catch {
      return { version: 1, events: [] };
    }
  }

  function writeData(data) {
    const normalized = {
      version: 1,
      updatedAt: new Date().toISOString(),
      events: Array.isArray(data.events) ? data.events : [],
    };
    atomicWriteFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`);
    return normalized;
  }

  function listEvents(filters = {}) {
    const data = readData();
    const todayStr = filters.today
      ? validateDate(filters.today, 'today')
      : new Date().toISOString().slice(0, 10);

    let scoped = data.events;

    if (filters.workspace && filters.workspace !== 'all') {
      const ws = validateWorkspace(filters.workspace);
      scoped = scoped.filter((e) => e.workspace === ws);
    }

    let filtered = scoped;

    if (filters.month) {
      const month = validateMonth(filters.month);
      filtered = filtered.filter((e) => typeof e.date === 'string' && e.date.startsWith(`${month}-`));
    }

    if (filters.from) {
      const from = validateDate(filters.from, 'from');
      filtered = filtered.filter((e) => typeof e.date === 'string' && e.date >= from);
    }

    if (filters.to) {
      const to = validateDate(filters.to, 'to');
      filtered = filtered.filter((e) => typeof e.date === 'string' && e.date <= to);
    }

    const sorted = sortEvents(filtered);

    const { start: weekStart, end: weekEnd } = getIsoWeekBounds(todayStr);
    let upcomingDeadlines = 0;
    let todayCount = 0;
    let studyMinutesWeek = 0;

    for (const ev of scoped) {
      if (ev.date === todayStr) {
        todayCount += 1;
      }
      if (
        ev.status !== 'done' &&
        (ev.kind === 'deadline' || ev.kind === 'delivery') &&
        ev.date >= todayStr
      ) {
        upcomingDeadlines += 1;
      }
      if (
        (ev.workspace === 'study' || ev.kind === 'study') &&
        ev.date >= weekStart &&
        ev.date <= weekEnd &&
        ev.startTime &&
        ev.endTime
      ) {
        const sMin = timeToMinutes(ev.startTime);
        const eMin = timeToMinutes(ev.endTime);
        if (sMin !== null && eMin !== null && eMin > sMin) {
          studyMinutesWeek += eMin - sMin;
        }
      }
    }

    const studyHoursWeek = Math.round((studyMinutesWeek / 60) * 10) / 10;

    return {
      events: sorted,
      summary: {
        total: sorted.length,
        upcomingDeadlines,
        todayCount,
        studyHoursWeek,
      },
      storagePath: CALENDAR_REL_PATH,
      isGitignored: true,
    };
  }

  function getEvent(id) {
    validateEventId(id);
    const data = readData();
    return data.events.find((e) => e.id === id) || null;
  }

  function createEvent(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new StoreError('INVALID_INPUT', 'Dados do evento inválidos.', 400);
    }

    const title = validateTitle(input.title);
    const date = validateDate(input.date, 'date');
    const startTime = validateOptionalTime(input.startTime, 'startTime');
    const endTime = validateOptionalTime(input.endTime, 'endTime');
    validateTimeRange(startTime, endTime);

    const workspace = validateWorkspace(input.workspace, 'personal');
    const kind = validateKind(input.kind, 'plan');
    const status = validateStatus(input.status, 'planned');
    const subject = validateOptionalText(input.subject, MAX_SUBJECT_LEN, 'subject');
    const notes = validateOptionalText(input.notes, MAX_NOTES_LEN, 'notes');

    let linkedTaskId = null;
    if (input.linkedTaskId !== undefined && input.linkedTaskId !== null && input.linkedTaskId !== '') {
      linkedTaskId = validateTaskId(String(input.linkedTaskId).trim());
    }

    const now = new Date().toISOString();
    const event = {
      id: `cal-${Date.now()}-${randomBytes(4).toString('hex')}`,
      title,
      date,
      startTime,
      endTime,
      workspace,
      kind,
      subject,
      notes,
      status,
      linkedTaskId,
      createdAt: now,
      updatedAt: now,
    };

    const data = readData();
    data.events.push(event);
    writeData(data);

    return event;
  }

  function updateEvent(id, patch = {}) {
    validateEventId(id);
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new StoreError('INVALID_INPUT', 'Dados de atualização inválidos.', 400);
    }

    const data = readData();
    const idx = data.events.findIndex((e) => e.id === id);
    if (idx === -1) {
      throw new StoreError('NOT_FOUND', `Evento não encontrado: ${id}`, 404);
    }

    const current = data.events[idx];
    const next = { ...current };

    if (patch.title !== undefined) next.title = validateTitle(patch.title);
    if (patch.date !== undefined) next.date = validateDate(patch.date, 'date');
    if (patch.startTime !== undefined) next.startTime = validateOptionalTime(patch.startTime, 'startTime');
    if (patch.endTime !== undefined) next.endTime = validateOptionalTime(patch.endTime, 'endTime');
    validateTimeRange(next.startTime, next.endTime);

    if (patch.workspace !== undefined) next.workspace = validateWorkspace(patch.workspace);
    if (patch.kind !== undefined) next.kind = validateKind(patch.kind);
    if (patch.status !== undefined) next.status = validateStatus(patch.status);
    if (patch.subject !== undefined) next.subject = validateOptionalText(patch.subject, MAX_SUBJECT_LEN, 'subject');
    if (patch.notes !== undefined) next.notes = validateOptionalText(patch.notes, MAX_NOTES_LEN, 'notes');

    if (patch.linkedTaskId !== undefined) {
      if (patch.linkedTaskId === null || patch.linkedTaskId === '') {
        next.linkedTaskId = null;
      } else {
        next.linkedTaskId = validateTaskId(String(patch.linkedTaskId).trim());
      }
    }

    next.updatedAt = new Date().toISOString();
    data.events[idx] = next;
    writeData(data);

    return next;
  }

  function deleteEvent(id) {
    validateEventId(id);
    const data = readData();
    const idx = data.events.findIndex((e) => e.id === id);
    if (idx === -1) {
      throw new StoreError('NOT_FOUND', `Evento não encontrado: ${id}`, 404);
    }

    const [removed] = data.events.splice(idx, 1);
    writeData(data);

    return { deleted: true, id: removed.id, event: removed };
  }

  return {
    listEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    storagePath: CALENDAR_REL_PATH,
  };
}
