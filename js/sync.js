import { callScript } from './api.js';
import { getSettings, getOutbox, saveOutbox } from './store.js';

let online = navigator.onLine;
let bannerEl = null;
let flushing = false;
let syncHandlers = {};

export function initSync(handlers) {
  syncHandlers = handlers || {};
  window.addEventListener('online', () => {
    online = true;
    updateBanner();
    flush();
  });
  window.addEventListener('offline', () => {
    online = false;
    updateBanner();
  });
  updateBanner();
}

export function isOnline() {
  return online;
}

export function enqueue(op) {
  const outbox = getOutbox();
  outbox.push(op);
  saveOutbox(outbox);
}

export async function flush() {
  if (flushing || !online) return;
  const outbox = getOutbox();
  if (outbox.length === 0) return;

  const settings = getSettings();
  if (!settings) return;

  flushing = true;
  try {
    const res = await callScript(settings.scriptUrl, settings.accessToken, 'applyChanges', { ops: outbox });
    if (res.ok) {
      const appliedIds = new Set(res.data.applied || []);
      const conflicts = res.data.conflicts || [];
      const conflictIds = new Set(conflicts.map((c) => c.op_id));
      const remaining = outbox.filter((op) => !appliedIds.has(op.op_id) && !conflictIds.has(op.op_id));
      saveOutbox(remaining);
      const realConflicts = conflicts.filter((c) => c.server_record);
      if (realConflicts.length && syncHandlers.onConflicts) syncHandlers.onConflicts(realConflicts);
    }
  } catch (err) {
    // остава в опашката — ще пробваме пак при следващо действие или връщане на връзката
  } finally {
    flushing = false;
  }
}

function updateBanner() {
  if (!online) {
    if (bannerEl) return;
    bannerEl = document.createElement('div');
    bannerEl.className = 'offline-banner';
    bannerEl.textContent = 'Няма връзка';
    document.body.prepend(bannerEl);
  } else {
    bannerEl?.remove();
    bannerEl = null;
  }
}

const CONFLICT_FIELDS = [
  { key: 'title', label: 'Заглавие' },
  { key: 'priority', label: 'Приоритет', format: priorityLabel },
  { key: 'due_date', label: 'Срок', format: (v) => v || 'без срок' },
  { key: 'done', label: 'Статус', format: (v) => (v === true || v === 'TRUE' ? 'приключена' : 'активна') },
];

export function showConflictDialog(root, conflict, { onKeepMine, onKeepTheirs }) {
  const server = conflict.server_record || {};
  // your_fields е само промененото — показваме пълната "твоя" версия, като го наслагваме
  // върху server_record (всичко останало е еднакво, затова е вярна база за сравнение).
  const mine = { ...server, ...(conflict.your_fields || {}) };

  const rows = CONFLICT_FIELDS.map((f) => {
    const mineVal = f.format ? f.format(mine[f.key]) : mine[f.key] || '—';
    const serverVal = f.format ? f.format(server[f.key]) : server[f.key] || '—';
    const changed = String(mine[f.key]) !== String(server[f.key]);
    return `
      <div class="conflict-row ${changed ? 'conflict-row-diff' : ''}">
        <span class="conflict-row-label">${f.label}</span>
        <span class="conflict-row-value">${escapeHtml(String(mineVal))}</span>
        <span class="conflict-row-value">${escapeHtml(String(serverVal))}</span>
      </div>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.className = 'task-overlay';
  overlay.innerHTML = `
    <div class="task-panel">
      <div class="task-panel-header">
        <span>Конфликт — „${escapeHtml(server.title || mine.title || 'задача')}"</span>
      </div>
      <div class="task-panel-body">
        <p class="hint">Тази задача е променена и от друго устройство, докато ти си бил офлайн. Различното е отбелязано.</p>
        <div class="conflict-table">
          <div class="conflict-row conflict-row-header">
            <span></span>
            <span>Твоята версия</span>
            <span>Другото устройство</span>
          </div>
          ${rows}
        </div>
      </div>
      <div class="task-panel-footer conflict-footer">
        <button class="secondary mine-btn">Запази моята версия</button>
        <button class="primary theirs-btn">Запази другата версия</button>
      </div>
    </div>
  `;
  root.appendChild(overlay);

  overlay.querySelector('.mine-btn').addEventListener('click', () => {
    overlay.remove();
    onKeepMine();
  });
  overlay.querySelector('.theirs-btn').addEventListener('click', () => {
    overlay.remove();
    onKeepTheirs();
  });
}

function priorityLabel(p) {
  return { high: 'Висок', medium: 'Среден', low: 'Нисък' }[p] || p || '—';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
