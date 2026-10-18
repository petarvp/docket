import { renderWelcome, renderSettings, openSettingsMenu } from './settings.js';
import { getSettings, isOnboarded, getSnapshot, saveSnapshot, getTheme, setTheme } from './store.js';
import { callScript } from './api.js';
import { renderBoard, renderArchiveView } from './board.js';
import { openChat } from './chat.js';
import { openTaskDetail, openManualForm } from './task.js';
import { showUndo } from './undo.js';
import { initSync, isOnline, enqueue, flush, showConflictDialog } from './sync.js';

const root = document.getElementById('app');

const appState = { categories: [], tasks: [] };
let currentView = 'board';

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

function drawBoard() {
  saveSnapshot(appState.categories, appState.tasks);

  if (currentView === 'archive') {
    drawArchive();
    return;
  }

  const activeCategories = appState.categories.filter((c) => c.status === 'active');

  renderBoard(root, appState, {
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
      openTaskDetail(root, task, {
        onUpdate: updateTask,
        onToggleDone: toggleDone,
        onDelete: deleteTask,
      });
    },
    onOpenArchive: () => {
      currentView = 'archive';
      drawBoard();
    },
    onQuickAdd: (categoryId) => openManualForm(root, activeCategories, { onCreate: createManualTask }, categoryId),
    onOpenSettings: () => {
      openSettingsMenu(root, {
        theme: getTheme(),
        onThemeChange: (theme) => {
          setTheme(theme);
          applyTheme(theme);
        },
      });
    },
  });
}

function drawArchive() {
  const archived = appState.categories.filter((c) => c.status === 'archived');

  renderArchiveView(
    root,
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

function createManualTask(fields) {
  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  appState.tasks.push({
    id,
    ...fields,
    due_date: fields.due_date || '',
    done: false,
    done_at: '',
    created_at: nowIso,
    updated_at: nowIso,
    version: 1,
  });
  drawBoard();

  enqueue({ op_id: crypto.randomUUID(), type: 'create', entity: 'task', id, base_version: 0, fields });
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

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

start();
