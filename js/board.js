import { relativeDueLabel } from './dates.js';

const expandedIds = new Set();
const PRIORITY_LABELS = { high: 'Висок', medium: 'Среден', low: 'Нисък' };

const ICON_ARCHIVE =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>';

const ICON_SETTINGS =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';

export function renderBoard(root, { categories, tasks }, handlers) {
  const active = categories.filter((c) => c.status === 'active');
  const previousRects = captureRects(root);

  root.innerHTML = `
    <div class="board-screen">
      <header class="board-header">
        <h1>Docket</h1>
        <div class="header-actions">
          <button id="archive-link" class="icon-button" aria-label="Архивирани">${ICON_ARCHIVE}</button>
          <button id="settings-link" class="icon-button" aria-label="Настройки">${ICON_SETTINGS}</button>
        </div>
      </header>
      <div class="board-columns" id="board-columns"></div>
      <button id="fab" class="fab" aria-label="Нова задача">+</button>
    </div>
  `;

  const columnsEl = root.querySelector('#board-columns');
  columnsEl.innerHTML =
    active.length === 0
      ? '<p class="empty-hint">Няма активни колони още. Натисни + и постави текст, за да се появят.</p>'
      : active.map((cat) => renderColumn(cat, tasks.filter((t) => t.category_id === cat.id))).join('');

  wireCardEvents(columnsEl, tasks, handlers);
  playFlip(columnsEl, previousRects);

  root.querySelector('#archive-link').addEventListener('click', handlers.onOpenArchive);
  root.querySelector('#settings-link').addEventListener('click', handlers.onOpenSettings);

  const fab = root.querySelector('#fab');
  fab.addEventListener('click', () => {
    const existingChat = root.querySelector('.chat-overlay');
    if (existingChat) {
      existingChat.remove();
      fab.classList.remove('open');
    } else {
      fab.classList.add('open');
      handlers.onOpenChat();
    }
  });
}

export function renderArchiveView(root, { categories, tasks }, handlers) {
  root.innerHTML = `
    <div class="board-screen">
      <header class="board-header">
        <button id="back-link" class="archive-link">‹ Назад</button>
        <h1>Архивирани</h1>
      </header>
      <div class="board-columns" id="board-columns"></div>
    </div>
  `;

  const columnsEl = root.querySelector('#board-columns');
  columnsEl.innerHTML =
    categories.length === 0
      ? '<p class="empty-hint">Все още няма архивирани колони.</p>'
      : categories.map((cat) => renderColumn(cat, tasks.filter((t) => t.category_id === cat.id))).join('');

  wireCardEvents(columnsEl, tasks, handlers);
  root.querySelector('#back-link').addEventListener('click', handlers.onBack);
}

function wireCardEvents(columnsEl, tasks, handlers) {
  columnsEl.querySelectorAll('.task-card').forEach((el) => {
    const task = tasks.find((t) => t.id === el.dataset.taskId);
    if (!task) return;

    el.querySelector('.task-check').addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onToggleDone(task.id, !isDone(task));
    });

    const editBtn = el.querySelector('.task-edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onOpenTask(task);
      });
    }

    el.addEventListener('click', () => {
      const willExpand = !el.classList.contains('expanded');
      el.classList.toggle('expanded', willExpand);
      if (willExpand) expandedIds.add(task.id);
      else expandedIds.delete(task.id);
    });
  });
}

function captureRects(root) {
  const map = new Map();
  root.querySelectorAll('.task-card').forEach((el) => {
    map.set(el.dataset.taskId, el.getBoundingClientRect());
  });
  return map;
}

function playFlip(columnsEl, previousRects) {
  columnsEl.querySelectorAll('.task-card').forEach((el) => {
    const prev = previousRects.get(el.dataset.taskId);
    if (!prev) return;
    const next = el.getBoundingClientRect();
    const dx = prev.left - next.left;
    const dy = prev.top - next.top;
    if (!dx && !dy) return;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transition = '';
      el.style.transform = '';
    });
  });
}

function renderColumn(category, tasks) {
  const sorted = [...tasks].sort((a, b) => Number(isDone(a)) - Number(isDone(b)));
  const firstDoneIndex = sorted.findIndex(isDone);

  const cardsHtml = sorted
    .map((t, i) => (i === firstDoneIndex && i > 0 ? '<hr class="done-divider" />' : '') + renderCard(t))
    .join('');

  return `
    <div class="column">
      <h2>${escapeHtml(category.name)}</h2>
      <div class="cards">
        ${cardsHtml || '<p class="empty-hint">Няма задачи</p>'}
      </div>
    </div>
  `;
}

function renderCard(task) {
  const due = relativeDueLabel(task.due_date);
  const expanded = expandedIds.has(task.id);

  return `
    <div class="card task-card ${isDone(task) ? 'done' : ''} ${expanded ? 'expanded' : ''}" data-task-id="${task.id}">
      <div class="task-row">
        <button class="task-check" aria-label="Отметни като приключена"></button>
        <div class="task-main">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-meta">
            <span class="due due-${due.level}">${due.label}</span>
            <span class="priority priority-${task.priority}">●</span>
          </div>
        </div>
      </div>
      <div class="task-expand">
        <div class="task-expand-inner">
          ${task.details ? `<p class="task-expand-details">${escapeHtml(task.details)}</p>` : ''}
          <p class="task-expand-meta">Приоритет: ${PRIORITY_LABELS[task.priority] || task.priority} · Срок: ${due.label}</p>
          <button class="task-edit-btn">Редактирай</button>
        </div>
      </div>
    </div>
  `;
}

function isDone(task) {
  return task.done === true || task.done === 'TRUE';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
