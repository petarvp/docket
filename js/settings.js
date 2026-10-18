import { callScript } from './api.js';
import { getSettings, saveSettings as persistSettings, setOnboarded } from './store.js';

const WELCOME_CARDS = [
  {
    title: 'Пиши както мислиш',
    text: 'Постави цял имейл или напиши свободен текст — AI открива задачите вместо теб.',
  },
  {
    title: 'Колоните се появяват сами',
    text: 'Задачите отиват в подходяща колона по тема. Нова тема — нова колона, автоматично.',
  },
  {
    title: 'Свършеното изчезва',
    text: 'Когато приключиш всичко в една колона, тя сама отива в „Архивирани".',
  },
];

export function renderWelcome(root, onContinue) {
  root.innerHTML = `
    <div class="screen welcome-screen">
      <h1>Docket</h1>
      <div class="card-row">
        ${WELCOME_CARDS.map(
          (c) => `
          <div class="card">
            <h3>${c.title}</h3>
            <p>${c.text}</p>
          </div>`
        ).join('')}
      </div>
      <button id="welcome-continue" class="primary">Продължи към настройка</button>
    </div>
  `;
  root.querySelector('#welcome-continue').addEventListener('click', onContinue);
}

export function renderSettings(root, onSaved) {
  const existing = getSettings() || {};

  root.innerHTML = `
    <div class="screen settings-screen">
      <h1>Настройка</h1>
      <p class="hint">
        Следвай <a href="SETUP.md" target="_blank" rel="noopener">SETUP.md</a>, за да вземеш своя
        Script URL и код за достъп от Google Apps Script, и своя Groq ключ.
      </p>

      <label>
        Apps Script URL
        <input id="input-url" type="text" placeholder="https://script.google.com/macros/s/.../exec" value="${existing.scriptUrl || ''}" />
      </label>

      <label>
        Код за достъп
        <input id="input-token" type="text" placeholder="код от setup()" value="${existing.accessToken || ''}" />
      </label>

      <label>
        Groq ключ
        <input id="input-groq" type="password" placeholder="gsk_..." />
      </label>

      <button id="btn-test" class="primary">Провери връзка</button>
      <p id="status-msg" class="status"></p>
    </div>
  `;

  const statusEl = root.querySelector('#status-msg');
  const setStatus = (text, kind) => {
    statusEl.textContent = text;
    statusEl.className = 'status ' + (kind || '');
  };

  root.querySelector('#btn-test').addEventListener('click', async () => {
    const scriptUrl = root.querySelector('#input-url').value.trim();
    const accessToken = root.querySelector('#input-token').value.trim();
    const groqKey = root.querySelector('#input-groq').value.trim();

    if (!scriptUrl || !accessToken) {
      setStatus('Попълни Script URL и код за достъп.', 'error');
      return;
    }

    setStatus('Проверявам връзка...', '');
    try {
      const pingRes = await callScript(scriptUrl, accessToken, 'ping', {});
      if (!pingRes.ok) {
        setStatus('Не мога да се свържа със скрипта. Провери URL-а и кода.', 'error');
        return;
      }

      if (groqKey) {
        const saveRes = await callScript(scriptUrl, accessToken, 'saveSettings', { groq_api_key: groqKey });
        if (!saveRes.ok) {
          setStatus('Връзката работи, но Groq ключът не се запази: ' + saveRes.message, 'error');
          return;
        }
      }

      persistSettings({ scriptUrl, accessToken });
      setOnboarded();
      setStatus('Свързано успешно.', 'success');
      setTimeout(() => onSaved(), 600);
    } catch (err) {
      setStatus('Не мога да се свържа със скрипта. Провери URL-а и кода.', 'error');
    }
  });
}

const THEME_CHOICES = [
  { value: 'system', label: 'Системна' },
  { value: 'light', label: 'Светла' },
  { value: 'dark', label: 'Тъмна' },
];

export function openSettingsMenu(root, { theme, onThemeChange }) {
  const overlay = document.createElement('div');
  overlay.className = 'task-overlay';
  overlay.innerHTML = `
    <div class="task-panel">
      <div class="task-panel-header">
        <span>Настройки</span>
        <button class="task-close" aria-label="Затвори">×</button>
      </div>
      <div class="task-panel-body">
        <p class="hint">Тема</p>
        <div class="theme-options">
          ${THEME_CHOICES.map((c) => `<button class="theme-option" data-theme="${c.value}">${c.label}</button>`).join('')}
        </div>
      </div>
    </div>
  `;
  root.appendChild(overlay);

  const markActive = (current) => {
    overlay.querySelectorAll('.theme-option').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.theme === current);
    });
  };
  markActive(theme);

  overlay.querySelector('.task-close').addEventListener('click', () => overlay.remove());
  overlay.querySelectorAll('.theme-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      onThemeChange(btn.dataset.theme);
      markActive(btn.dataset.theme);
    });
  });
}
