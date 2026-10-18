import { renderWelcome, renderSettings } from './settings.js';
import { getSettings, isOnboarded } from './store.js';
import { callScript } from './api.js';
import { renderBoard } from './board.js';
import { openChat } from './chat.js';
import { openTaskDetail, openManualForm } from './task.js';
import { showUndo } from './undo.js';

const root = document.getElementById('app');

const appState = { categories: [], tasks: [] };

async function loadBoard() {
  const settings = getSettings();
  root.innerHTML = '<div class="screen"><p class="hint">Зареждам...</p></div>';

  let res;
  try {
    res = await callScript(settings.scriptUrl, settings.accessToken, 'getAll', {});
  } catch (err) {
    root.innerHTML = '<div class="screen"><p class="hint">Не мога да се свържа със скрипта. Провери URL-а и кода.</p></div>';
    return;
  }

  if (!res.ok) {
    root.innerHTML = `<div class="screen"><p class="hint">${res.message || 'Грешка при зареждане.'}</p></div>`;
    return;
  }

  appState.categories = res.data.categories;
  appState.tasks = res.data.tasks;
  drawBoard();
}

function drawBoard() {
  const activeCategories = appState.categories.filter((c) => c.status === 'active');

  renderBoard(root, appState, {
    onOpenChat: () => {
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
  });
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

  showUndo(root, 'Задачата е отметната.', {
    onUndo: () => {
      task.done = wasDone;
      drawBoard();
    },
    onCommit: () => persistTaskChange(taskId, { done: true }),
  });
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

  const settings = getSettings();
  callScript(settings.scriptUrl, settings.accessToken, 'applyChanges', {
    ops: [{ op_id: crypto.randomUUID(), type: 'create', entity: 'task', id, base_version: 0, fields }],
  }).catch(() => {});
}

function persistTaskChange(taskId, fields) {
  const settings = getSettings();
  const task = appState.tasks.find((t) => t.id === taskId);
  callScript(settings.scriptUrl, settings.accessToken, 'applyChanges', {
    ops: [{ op_id: crypto.randomUUID(), type: 'update', entity: 'task', id: taskId, base_version: task ? task.version : 0, fields }],
  }).catch(() => {});
}

function persistTaskDelete(taskId) {
  const settings = getSettings();
  callScript(settings.scriptUrl, settings.accessToken, 'applyChanges', {
    ops: [{ op_id: crypto.randomUUID(), type: 'delete', entity: 'task', id: taskId, base_version: 0, fields: {} }],
  }).catch(() => {});
}

function start() {
  if (isOnboarded() && getSettings()) {
    loadBoard();
    return;
  }
  renderWelcome(root, () => renderSettings(root, loadBoard));
}

start();
