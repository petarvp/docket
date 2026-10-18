import { renderWelcome, renderSettings, openSettingsMenu } from './settings.js';
import { getSettings, isOnboarded, getSnapshot, saveSnapshot, getTheme, setTheme, getGenZMode, setGenZMode } from './store.js';
import { callScript } from './api.js';
import { renderBoard, renderArchiveView, renderDateView, ICON_ARCHIVE, ICON_SETTINGS } from './board.js';
import { renderSidebar, ICON_MENU, VIEWS } from './sidebar.js';
import { openChat } from './chat.js';
import { openTaskDetail, openManualForm, openNewCategoryForm } from './task.js';
import { showUndo } from './undo.js';
import { initSync, isOnline, enqueue, flush, showConflictDialog } from './sync.js';

const root = document.getElementById('app');

const appState = { categories: [], tasks: [] };
let currentView = 'board'; // 'board' | 'archive'
let boardFilter = { kind: 'kanban' }; // 'kanban' | { kind: 'date', range } | { kind: 'category', categoryId }
let sidebarMobileOpen = false;
let sidebarDesktopCollapsed = false;

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

applyTheme(getTheme());

async function start() {
  if (!(isOnboarded() && getSettings())) {
    renderWelcome(root, () => renderSettings(root, afterSettingsSaved));
    return;
  }

  const snapshot = getSnapshot();
  if (snapshot) {
    appState.categories = snapshot.categories || [];
    appState.tasks = snapshot.tasks || [];
    drawBoard();
  }

  initSync({ onConflicts: handleConflicts });
  flush();
  refreshFromServer();
}

function afterSettingsSaved() {
  initSync({ onConflicts: handleConflicts });
  refreshFromServer();
}

async function refreshFromServer() {
  if (!isOnline()) return;

  const settings = getSettings();
  const hasData = appState.categories.length > 0 || appState.tasks.length > 0;
  if (!hasData) {
    root.innerHTML = '<div class="screen"><p class="hint">Зареждам...</p></div>';
  }

  let res;
  try {
    res = await callScript(settings.scriptUrl, settings.accessToken, 'getAll', {});
  } catch (err) {
    if (!hasData) {
      root.innerHTML = '<div class="screen"><p class="hint">Не мога да се свържа със скрипта. Провери URL-а и кода.</p></div>';
    }
    return;
  }

  if (!res.ok) {
    if (!hasData) root.innerHTML = `<div class="screen"><p class="hint">${res.message || 'Грешка при зареждане.'}</p></div>`;
    return;
  }

  appState.categories = res.data.categories;
  appState.tasks = res.data.tasks;
  drawBoard();
}

function handleConflicts(conflicts) {
  conflicts.forEach((conflict) => {
    showConflictDialog(root, conflict, {
      onKeepMine: () => {
        enqueue({
          op_id: crypto.randomUUID(),
          type: 'update',
          entity: 'task',
          id: conflict.id,
          base_version: conflict.server_record.version,
          fields: conflict.your_fields,
        });
        flush();
      },
      onKeepTheirs: () => {
        const task = appState.tasks.find((t) => t.id === conflict.id);
        if (task) Object.assign(task, conflict.server_record);
        drawBoard();
      },
    });
  });
}

function topBarTitle() {
  if (currentView === 'archive') return 'Архивирани';
  if (boardFilter.kind === 'date') return (VIEWS.find((v) => v.id === boardFilter.range) || {}).label || 'Задачи';
  if (boardFilter.kind === 'category') {
    const category = appState.categories.find((c) => c.id === boardFilter.categoryId);
    return category ? category.name : 'Docket';
  }
  return 'Docket';
}

function activeTaskCounts() {
  const counts = {};
  appState.tasks.forEach((t) => {
    if (!isDoneValue(t.done)) counts[t.category_id] = (counts[t.category_id] || 0) + 1;
  });
  return counts;
}

function drawBoard() {
  saveSnapshot(appState.categories, appState.tasks);

  root.innerHTML = `
    <div class="app-shell">
      <div class="sidebar-container ${sidebarMobileOpen ? 'mobile-open' : ''} ${sidebarDesktopCollapsed ? 'desktop-collapsed' : ''}" id="sidebar-container"></div>
      <div class="main-area">
        <header class="top-bar">
          <button class="menu-toggle icon-button" aria-label="Меню">${ICON_MENU}</button>
          <h1 class="top-bar-title">${escapeHtml(topBarTitle())}</h1>
          <div class="header-actions">
            <button id="archive-link" class="icon-button" aria-label="Архивирани">${ICON_ARCHIVE}</button>
            <button id="settings-link" class="icon-button" aria-label="Настройки">${ICON_SETTINGS}</button>
          </div>
        </header>
        <div class="board-area" id="board-area"></div>
      </div>
    </div>
  `;

  const sidebarContainer = root.querySelector('#sidebar-container');
  const boardArea = root.querySelector('#board-area');

  root.querySelector('#archive-link').addEventListener('click', () => {
    currentView = 'archive';
    drawBoard();
  });
  root.querySelector('#settings-link').addEventListener('click', () => openSettings());

  renderSidebar(
    sidebarContainer,
    {
      categories: appState.categories,
      activeView: currentView === 'board' && boardFilter.kind !== 'category' ? (boardFilter.kind === 'kanban' ? 'board' : boardFilter.range) : null,
      activeCategoryId: boardFilter.kind === 'category' ? boardFilter.categoryId : null,
      taskCounts: activeTaskCounts(),
    },
    {
      onSelectView: (viewId) => {
        currentView = 'board';
        boardFilter = viewId === 'board' ? { kind: 'kanban' } : { kind: 'date', range: viewId };
        sidebarMobileOpen = false;
        drawBoard();
      },
      onSelectCategory: (categoryId) => {
        currentView = 'board';
        boardFilter = { kind: 'category', categoryId };
        sidebarMobileOpen = false;
        drawBoard();
      },
      onAddCategory: () => {
        sidebarMobileOpen = false;
        drawBoard();
        openNewCategoryForm(root, { onCreate: createCategoryOnly });
      },
      onClose: () => {
        sidebarMobileOpen = false;
        drawBoard();
      },
    }
  );

  root.querySelector('.menu-toggle').addEventListener('click', () => {
    if (window.innerWidth < 900) {
      sidebarMobileOpen = true;
    } else {
      sidebarDesktopCollapsed = !sidebarDesktopCollapsed;
    }
    drawBoard();
  });

  if (currentView === 'archive') {
    drawArchive(boardArea);
    return;
  }

  if (boardFilter.kind === 'date') {
    renderDateView(boardArea, appState, boardFilter.range, {
      onToggleDone: toggleDone,
      onOpenTask: (task) => {
        openTaskDetail(root, task, { onUpdate: updateTask, onToggleDone: toggleDone, onDelete: deleteTask });
      },
    });
    return;
  }

  const boardCategories =
    boardFilter.kind === 'category' ? appState.categories.filter((c) => c.id === boardFilter.categoryId) : appState.categories;
  const activeCategories = boardCategories.filter((c) => c.status === 'active');

  renderBoard(
    boardArea,
    { categories: boardCategories, tasks: appState.tasks },
    {
      onOpenChat: () => {
        if (!isOnline()) {
          openManualForm(root, activeCategories, { onCreate: createManualTask });
          return;
        }
        openChat(root, {
          categories: appState.categories,
          settings: getSettings(),
          onConfirmed: (added) => {
            appState.categories = [...appState.categories, ...added.categories];
            appState.tasks = [...appState.tasks, ...added.tasks];
            drawBoard();
          },
          onManualAdd: () => openManualForm(root, activeCategories, { onCreate: createManualTask }),
        });
      },
      onToggleDone: toggleDone,
      onOpenTask: (task) => {
        openTaskDetail(root, task, { onUpdate: updateTask, onToggleDone: toggleDone, onDelete: deleteTask });
      },
      onQuickAdd: (categoryId) => openManualForm(root, appState.categories.filter((c) => c.status === 'active'), { onCreate: createManualTask }, categoryId),
    }
  );
}

function openSettings() {
  openSettingsMenu(root, {
    theme: getTheme(),
    onThemeChange: (theme) => {
      setTheme(theme);
      applyTheme(theme);
    },
    genZMode: getGenZMode(),
    onGenZModeChange: (value) => setGenZMode(value),
  });
}

function drawArchive(boardArea) {
  const archived = appState.categories.filter((c) => c.status === 'archived');

  renderArchiveView(
    boardArea,
    { categories: archived, tasks: appState.tasks },
    {
      onBack: () => {
        currentView = 'board';
        drawBoard();
      },
      onToggleDone: toggleDoneInArchive,
      onOpenTask: (task) => {
        openTaskDetail(root, task, {
          onUpdate: updateTask,
          onToggleDone: toggleDoneInArchive,
          onDelete: deleteTask,
        });
      },
    }
  );
}

function isDoneValue(done) {
  return done === true || done === 'TRUE';
}

function updateTask(taskId, fields) {
  const task = appState.tasks.find((t) => t.id === taskId);
  if (!task) return;
  Object.assign(task, fields);
  drawBoard();
  persistTaskChange(taskId, fields);
}

function toggleDone(taskId, done) {
  const task = appState.tasks.find((t) => t.id === taskId);
  if (!task) return;
  const wasDone = isDoneValue(task.done);
  task.done = done;
  drawBoard();

  if (!done) {
    persistTaskChange(taskId, { done: false });
    return;
  }

  const category = appState.categories.find((c) => c.id === task.category_id);
  const remainingActive = appState.tasks.filter(
    (t) => t.category_id === task.category_id && t.id !== taskId && !isDoneValue(t.done)
  );
  const willArchive = !!category && category.status === 'active' && remainingActive.length === 0;

  showUndo(root, willArchive ? 'Последната задача е отметната — колоната отива в архив.' : 'Задачата е отметната.', {
    onUndo: () => {
      task.done = wasDone;
      drawBoard();
    },
    onCommit: () => {
      persistTaskChange(taskId, { done: true });
      if (willArchive) archiveCategory(category.id);
    },
  });
}

function toggleDoneInArchive(taskId, done) {
  const task = appState.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.done = done;

  if (!done) {
    const category = appState.categories.find((c) => c.id === task.category_id);
    if (category && category.status === 'archived') {
      category.status = 'active';
      category.archived_at = '';
      persistCategoryStatus(category.id, 'reactivateCategory', category.version);
    }
  }

  drawBoard();
  persistTaskChange(taskId, { done });
}

function archiveCategory(categoryId) {
  const category = appState.categories.find((c) => c.id === categoryId);
  if (!category) return;
  category.status = 'archived';
  category.archived_at = new Date().toISOString();
  drawBoard();
  persistCategoryStatus(categoryId, 'archiveCategory', category.version);
}

function persistCategoryStatus(categoryId, opType, baseVersion) {
  enqueue({ op_id: crypto.randomUUID(), type: opType, entity: 'category', id: categoryId, base_version: baseVersion || 0, fields: {} });
  flush();
}

function deleteTask(taskId) {
  const index = appState.tasks.findIndex((t) => t.id === taskId);
  if (index === -1) return;
  const [removed] = appState.tasks.splice(index, 1);
  drawBoard();

  showUndo(root, 'Задачата е изтрита.', {
    onUndo: () => {
      appState.tasks.splice(index, 0, removed);
      drawBoard();
    },
    onCommit: () => persistTaskDelete(taskId),
  });
}

function createCategoryOnly(name) {
  const nowIso = new Date().toISOString();
  const categoryId = crypto.randomUUID();
  appState.categories.push({
    id: categoryId,
    name,
    status: 'active',
    created_at: nowIso,
    archived_at: '',
    updated_at: nowIso,
    version: 1,
  });
  drawBoard();

  enqueue({ op_id: crypto.randomUUID(), type: 'create', entity: 'category', id: categoryId, base_version: 0, fields: { name } });
  flush();
}

function createManualTask(fields) {
  const nowIso = new Date().toISOString();
  let { category_id, new_category_name, ...rest } = fields;

  if (new_category_name) {
    category_id = crypto.randomUUID();
    appState.categories.push({
      id: category_id,
      name: new_category_name,
      status: 'active',
      created_at: nowIso,
      archived_at: '',
      updated_at: nowIso,
      version: 1,
    });
    enqueue({
      op_id: crypto.randomUUID(),
      type: 'create',
      entity: 'category',
      id: category_id,
      base_version: 0,
      fields: { name: new_category_name },
    });
  }

  const taskFields = { ...rest, category_id };
  const id = crypto.randomUUID();
  appState.tasks.push({
    id,
    ...taskFields,
    due_date: taskFields.due_date || '',
    done: false,
    done_at: '',
    created_at: nowIso,
    updated_at: nowIso,
    version: 1,
  });
  drawBoard();

  enqueue({ op_id: crypto.randomUUID(), type: 'create', entity: 'task', id, base_version: 0, fields: taskFields });
  flush();
}

function persistTaskChange(taskId, fields) {
  const task = appState.tasks.find((t) => t.id === taskId);
  enqueue({ op_id: crypto.randomUUID(), type: 'update', entity: 'task', id: taskId, base_version: task ? task.version : 0, fields });
  flush();
}

function persistTaskDelete(taskId) {
  enqueue({ op_id: crypto.randomUUID(), type: 'delete', entity: 'task', id: taskId, base_version: 0, fields: {} });
  flush();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

start();
