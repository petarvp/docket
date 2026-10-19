import { relativeDueLabel, dueDateDiffDays } from './dates.js';
import { categoryHue } from './colors.js';

const expandedIds = new Set();
const SWIPE_REVEAL = 72;
let swipeOpenTaskId = null;
const PRIORITY_LABELS = { high: 'Висок', medium: 'Среден', low: 'Нисък' };
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
let allViewSort = 'category'; // 'category' | 'priority' | 'due'

const ICON_ARCHIVE =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>';

const ICON_SETTINGS =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';

const ICON_EDIT =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>';

const ICON_TRASH =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';

export { ICON_ARCHIVE, ICON_SETTINGS };

export function renderBoard(root, { categories, tasks }, handlers) {
  const active = categories.filter((c) => c.status === 'active');
  const previousRects = captureRects(root);

  root.innerHTML = `
    <div class="board-screen">
      <div class="board-columns" id="board-columns"></div>
      <button id="fab" class="fab" aria-label="Нова задача">+</button>
    </div>
  `;

  const columnsEl = root.querySelector('#board-columns');
  columnsEl.innerHTML =
    active.length === 0
      ? '<p class="empty-hint">Няма активни колони още. Натисни + и постави текст, за да се появят.</p>'
      : active.map((cat) => renderColumn(cat, tasks.filter((t) => t.category_id === cat.id), categoryHue(categories, cat.id))).join('');

  wireCardEvents(columnsEl, tasks, handlers);
  playFlip(columnsEl, previousRects);

  const fab = root.querySelector('#fab');
  fab.addEventListener('click', () => {
    // Чатът се добавя към целия app-root, не само към тази под-зона (board-area) —
    // затова търсим в целия документ, иначе тук никога не го намираме.
    const existingChat = document.querySelector('.chat-overlay');
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
      <div class="board-columns" id="board-columns"></div>
    </div>
  `;

  const columnsEl = root.querySelector('#board-columns');
  columnsEl.innerHTML =
    categories.length === 0
      ? '<p class="empty-hint">Все още няма архивирани колони.</p>'
      : categories.map((cat) => renderColumn(cat, tasks.filter((t) => t.category_id === cat.id), categoryHue(categories, cat.id))).join('');

  wireCardEvents(columnsEl, tasks, handlers);
}

export function renderDateView(root, { categories, tasks }, viewId, handlers) {
  const activeCategories = categories.filter((c) => c.status === 'active');
  const activeIds = new Set(activeCategories.map((c) => c.id));
  const categoryById = new Map(activeCategories.map((c) => [c.id, c]));

  let filtered = tasks.filter((t) => activeIds.has(t.category_id));

  if (viewId !== 'all' && viewId !== 'calendar') {
    filtered = filtered.filter((t) => {
      const diff = dueDateDiffDays(t.due_date);
      if (diff === null) return false;
      if (viewId === 'today') return diff === 0;
      if (viewId === 'week') return diff >= 0 && diff <= 7;
      if (viewId === 'month') return diff >= 0 && diff <= 31;
      return true;
    });
  }

  const isAllView = viewId === 'all';
  const sortMode = isAllView ? allViewSort : 'due';

  let bodyHtml;
  if (isAllView && sortMode === 'category') {
    bodyHtml =
      activeCategories
        .map((cat) => {
          const catTasks = sortForDisplay(filtered.filter((t) => t.category_id === cat.id), 'due');
          if (!catTasks.length) return '';
          return `
            <div class="all-view-group">
              <div class="all-view-group-header" style="--cat-hue: ${categoryHue(categories, cat.id)}">${escapeHtml(cat.name)}</div>
              <div class="cards">${catTasks.map((t) => renderCard(t, { hue: categoryHue(categories, cat.id) })).join('')}</div>
            </div>`;
        })
        .join('') || '<p class="empty-hint">Няма задачи в този изглед.</p>';
  } else {
    const sorted = sortForDisplay(filtered, sortMode);
    bodyHtml = sorted.length
      ? sorted
          .map((t) =>
            renderCard(t, { categoryLabel: categoryById.get(t.category_id)?.name, hue: categoryHue(categories, t.category_id) })
          )
          .join('')
      : '<p class="empty-hint">Няма задачи в този изглед.</p>';
  }

  root.innerHTML = `
    <div class="board-screen">
      ${
        isAllView
          ? `<div class="all-view-controls">
              <label class="all-sort-label">Подреди по
                <select class="all-sort">
                  <option value="category" ${sortMode === 'category' ? 'selected' : ''}>Категория</option>
                  <option value="priority" ${sortMode === 'priority' ? 'selected' : ''}>Приоритет</option>
                  <option value="due" ${sortMode === 'due' ? 'selected' : ''}>Срок</option>
                </select>
              </label>
            </div>`
          : ''
      }
      <div class="date-view-list" id="date-view-list">${bodyHtml}</div>
    </div>
  `;

  if (isAllView) {
    root.querySelector('.all-sort').addEventListener('change', (e) => {
      allViewSort = e.target.value;
      renderDateView(root, { categories, tasks }, viewId, handlers);
    });
  }

  wireCardEvents(root.querySelector('#date-view-list'), filtered, handlers);
}

function wireCardEvents(columnsEl, tasks, handlers) {
  columnsEl.querySelectorAll('.column-add').forEach((btn) => {
    if (!handlers.onQuickAdd) {
      btn.remove();
      return;
    }
    btn.addEventListener('click', () => handlers.onQuickAdd(btn.dataset.categoryId));
  });

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

    const swipeAction = el.querySelector('.task-swipe-action');
    swipeAction.addEventListener('click', (e) => {
      e.stopPropagation();
      swipeOpenTaskId = null;
      if (handlers.onDeleteTask) handlers.onDeleteTask(task.id);
    });

    const suppressNextClick = wireCardGestures(el, task, handlers);

    el.addEventListener('click', () => {
      if (suppressNextClick()) return;
      const willExpand = !el.classList.contains('expanded');
      el.classList.toggle('expanded', willExpand);
      if (willExpand) expandedIds.add(task.id);
      else expandedIds.delete(task.id);
    });
  });
}

const LONG_PRESS_MS = 380;
const DRAG_START_THRESHOLD = 8;

// setPointerCapture може да хвърли грешка в ръбови случаи (напр. pointer-ът вече
// е вдигнат) — това не трябва да чупи останалата логика на жеста.
function tryCapturePointer(el, pointerId) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // пропускаме прихващането, жестът продължава и без него
  }
}

// Един pointer-базиран жест, разпознава три различни намерения на едно и също
// място: кратко докосване (разширява картичката), бързо хоризонтално дърпане
// (разкрива изтриване), и задържане почти неподвижно (вдига картичката за
// преместване между колони). Работи еднакво с мишка и пръст.
function wireCardGestures(el, task, handlers) {
  const inner = el.querySelector('.task-card-inner');
  let startX = null;
  let startY = null;
  let baseX = swipeOpenTaskId === task.id ? -SWIPE_REVEAL : 0;
  let currentX = baseX;
  let mode = null; // null | 'swipe' | 'drag' | 'none'
  let longPressTimer = null;
  let didInteract = false;

  setInnerX(inner, baseX, false);

  inner.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
    mode = null;
    didInteract = false;

    if (handlers.onMoveTask) {
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        if (mode !== null) return;
        mode = 'drag';
        didInteract = true;
        tryCapturePointer(inner, e.pointerId);
        startCardDrag(el, inner, e.clientX, e.clientY);
      }, LONG_PRESS_MS);
    }
  });

  inner.addEventListener('pointermove', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (mode === null) {
      if (Math.abs(dx) < DRAG_START_THRESHOLD && Math.abs(dy) < DRAG_START_THRESHOLD) return;
      clearTimeout(longPressTimer);
      if (Math.abs(dx) > Math.abs(dy) * 1.5) {
        mode = 'swipe';
        didInteract = true;
        tryCapturePointer(inner, e.pointerId);
        if (swipeOpenTaskId && swipeOpenTaskId !== task.id) closeOtherSwipe(el, swipeOpenTaskId);
      } else {
        mode = 'none'; // вертикално/неясно движение — оставяме обичайния скрол
      }
      return;
    }

    if (mode === 'swipe') {
      e.preventDefault();
      currentX = Math.max(-SWIPE_REVEAL, Math.min(0, baseX + dx));
      setInnerX(inner, currentX, false);
    } else if (mode === 'drag') {
      e.preventDefault();
      updateCardDrag(e.clientX, e.clientY);
    }
  });

  const end = (e) => {
    clearTimeout(longPressTimer);
    startX = null;

    if (mode === 'swipe') {
      const open = currentX < -SWIPE_REVEAL / 2;
      baseX = open ? -SWIPE_REVEAL : 0;
      currentX = baseX;
      swipeOpenTaskId = open ? task.id : swipeOpenTaskId === task.id ? null : swipeOpenTaskId;
      setInnerX(inner, baseX, true);
    } else if (mode === 'drag') {
      const targetCategoryId = endCardDrag(e.clientX, e.clientY);
      if (targetCategoryId && targetCategoryId !== task.category_id) {
        handlers.onMoveTask(task.id, targetCategoryId);
      }
    }
    mode = null;
  };

  inner.addEventListener('pointerup', end);
  inner.addEventListener('pointercancel', end);

  return () => didInteract;
}

function closeOtherSwipe(el, taskId) {
  const other = (el.closest('.board-columns, .date-view-list, #date-view-list') || document).querySelector(
    `.task-card[data-task-id="${taskId}"] .task-card-inner`
  );
  if (other) setInnerX(other, 0, true);
}

function setInnerX(inner, x, animate) {
  inner.style.transition = animate ? 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)' : 'none';
  inner.style.transform = x ? `translateX(${x}px)` : '';
}

// --- Провлачване на картичка между колони ---

let dragGhost = null;
let dragSourceEl = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let dragOverColumn = null;

function startCardDrag(el, inner, clientX, clientY) {
  const rect = el.getBoundingClientRect();
  dragOffsetX = clientX - rect.left;
  dragOffsetY = clientY - rect.top;
  dragSourceEl = el;

  dragGhost = el.cloneNode(true);
  dragGhost.classList.add('task-card-ghost');
  dragGhost.style.width = `${rect.width}px`;
  dragGhost.style.left = `${rect.left}px`;
  dragGhost.style.top = `${rect.top}px`;
  document.body.appendChild(dragGhost);

  el.classList.add('dragging-source');

  if (navigator.vibrate) navigator.vibrate(12);
}

function updateCardDrag(clientX, clientY) {
  if (!dragGhost) return;
  dragGhost.style.left = `${clientX - dragOffsetX}px`;
  dragGhost.style.top = `${clientY - dragOffsetY}px`;

  const column = columnAtPoint(clientX, clientY);
  if (column !== dragOverColumn) {
    dragOverColumn?.classList.remove('drag-over');
    column?.classList.add('drag-over');
    dragOverColumn = column;
  }
}

function endCardDrag(clientX, clientY) {
  const column = columnAtPoint(clientX, clientY);
  dragOverColumn?.classList.remove('drag-over');
  dragGhost?.remove();
  dragSourceEl?.classList.remove('dragging-source');
  dragGhost = null;
  dragSourceEl = null;
  dragOverColumn = null;
  return column?.dataset.categoryId || null;
}

function columnAtPoint(x, y) {
  if (dragGhost) dragGhost.style.display = 'none';
  const el = document.elementFromPoint(x, y);
  if (dragGhost) dragGhost.style.display = '';
  return el?.closest('.column[data-category-id]') || null;
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

function renderColumn(category, tasks, hue) {
  const sorted = sortForDisplay(tasks, 'due');
  const firstDoneIndex = sorted.findIndex(isDone);
  const remaining = tasks.filter((t) => !isDone(t)).length;

  const cardsHtml = sorted
    .map((t, i) => (i === firstDoneIndex && i > 0 ? '<hr class="done-divider" />' : '') + renderCard(t, { hue }))
    .join('');

  return `
    <div class="column" data-category-id="${category.id}">
      <div class="column-header">
        <div class="column-title">
          ${remaining > 0 ? `<span class="column-count">${remaining}</span>` : ''}
          <h2>${escapeHtml(category.name)}</h2>
        </div>
        <button class="column-add" data-category-id="${category.id}" aria-label="Добави задача в ${escapeHtml(category.name)}">+</button>
      </div>
      <div class="cards">
        ${cardsHtml || '<p class="empty-hint">Няма задачи</p>'}
      </div>
    </div>
  `;
}

function renderCard(task, { categoryLabel, hue } = {}) {
  const due = relativeDueLabel(task.due_date);
  const expanded = expandedIds.has(task.id);
  const hueStyle = hue != null ? ` style="--cat-hue: ${hue}"` : '';

  return `
    <div class="card task-card ${isDone(task) ? 'done' : ''} ${expanded ? 'expanded' : ''}" data-task-id="${task.id}"${hueStyle}>
      <div class="task-swipe-action" aria-hidden="true">${ICON_TRASH}</div>
      <div class="task-card-inner">
        <div class="task-row">
          <button class="task-check" aria-label="Отметни като приключена"></button>
          <div class="task-main">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-meta">
              ${categoryLabel ? `<span class="task-category-tag">${escapeHtml(categoryLabel)}</span>` : ''}
              <span class="due due-${due.level}">${due.label}</span>
              <span class="priority priority-${task.priority}">●</span>
            </div>
          </div>
        </div>
        <div class="task-expand">
          <div class="task-expand-inner">
            ${task.details ? `<p class="task-expand-details">${escapeHtml(task.details)}</p>` : ''}
            <p class="task-expand-meta">Приоритет: ${PRIORITY_LABELS[task.priority] || task.priority} · Срок: ${due.label}</p>
            <button class="task-edit-btn" aria-label="Редактирай">${ICON_EDIT}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function sortForDisplay(tasks, mode) {
  return [...tasks].sort((a, b) => {
    const doneDiff = Number(isDone(a)) - Number(isDone(b));
    if (doneDiff !== 0) return doneDiff;
    if (isDone(a)) return doneAtTime(b) - doneAtTime(a); // most recently completed first

    if (mode === 'priority') {
      const prDiff = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
      if (prDiff !== 0) return prDiff;
    }

    const da = dueDateDiffDays(a.due_date);
    const db = dueDateDiffDays(b.due_date);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
}

function isDone(task) {
  return task.done === true || task.done === 'TRUE';
}

function doneAtTime(task) {
  const value = task.done_at || task.updated_at;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
