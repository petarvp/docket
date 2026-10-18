import { renderWelcome, renderSettings } from './settings.js';
import { getSettings, isOnboarded } from './store.js';
import { callScript } from './api.js';
import { renderBoard } from './board.js';
import { openChat } from './chat.js';

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
      });
    },
  });
}

function start() {
  if (isOnboarded() && getSettings()) {
    loadBoard();
    return;
  }
  renderWelcome(root, () => renderSettings(root, loadBoard));
}

start();
