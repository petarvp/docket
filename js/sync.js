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

export function showConflictDialog(root, conflict, { onKeepMine, onKeepTheirs }) {
  const server = conflict.server_record || {};
  const mine = conflict.your_fields || {};

  const overlay = document.createElement('div');
  overlay.className = 'task-overlay';
  overlay.innerHTML = `
    <div class="task-panel">
      <div class="task-panel-header">
        <span>Конфликт при синхронизация</span>
      </div>
      <div class="task-panel-body">
        <p class="hint">Тази задача е променена и от друго устройство, докато ти си бил офлайн. Коя версия да остане?</p>
        <div class="conflict-option">
          <strong>Твоята версия</strong>
          <p>${escapeHtml(summarize(mine))}</p>
        </div>
        <div class="conflict-option">
          <strong>Версията от другото устройство</strong>
          <p>${escapeHtml(summarize(server))}</p>
        </div>
      </div>
      <div class="task-panel-footer conflict-footer">
        <button class="secondary mine-btn">Запази моята</button>
        <button class="primary theirs-btn">Запази другата</button>
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

function summarize(obj) {
  const parts = [];
  if (obj.title) parts.push(obj.title);
  if (obj.priority) parts.push('приоритет: ' + obj.priority);
  if (obj.due_date) parts.push('срок: ' + obj.due_date);
  if (obj.done !== undefined) parts.push(obj.done === true || obj.done === 'TRUE' ? 'приключена' : 'активна');
  return parts.join(' · ') || '(без промени в показаните полета)';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
