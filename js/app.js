import { renderWelcome, renderSettings } from './settings.js';
import { getSettings, isOnboarded } from './store.js';

const root = document.getElementById('app');

function renderBoardPlaceholder() {
  root.innerHTML = `
    <div class="screen">
      <h1>Свързано</h1>
      <p>Настройките са запазени. Таблото с колони и задачи идва в следващата стъпка от изграждането.</p>
    </div>
  `;
}

function start() {
  if (isOnboarded() && getSettings()) {
    renderBoardPlaceholder();
    return;
  }
  renderWelcome(root, () => renderSettings(root, renderBoardPlaceholder));
}

start();
