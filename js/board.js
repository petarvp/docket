import { relativeDueLabel } from './dates.js';

export function renderBoard(root, { categories, tasks }, handlers) {
  const active = categories.filter((c) => c.status === 'active');

  root.innerHTML = `
    <div class="board-screen">
      <header class="board-header">
        <h1>Docket</h1>
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

  root.querySelector('#fab').addEventListener('click', handlers.onOpenChat);
}

function renderColumn(category, tasks) {
  const sorted = [...tasks].sort((a, b) => Number(isDone(a)) - Number(isDone(b)));
  return `
    <div class="column">
      <h2>${escapeHtml(category.name)}</h2>
      <div class="cards">
        ${sorted.map(renderCard).join('') || '<p class="empty-hint">Няма задачи</p>'}
      </div>
    </div>
  `;
}

function renderCard(task) {
  const due = relativeDueLabel(task.due_date);
  return `
    <div class="card task-card ${isDone(task) ? 'done' : ''}">
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-meta">
        <span class="due due-${due.level}">${due.label}</span>
        <span class="priority priority-${task.priority}">●</span>
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
