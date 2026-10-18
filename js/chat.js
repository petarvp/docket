import { callScript } from './api.js';
import { getGenZMode } from './store.js';

const ICON_SEND =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';

export function openChat(root, ctx) {
  const state = { previousProposal: null, lastUserText: '', correctionRound: 0 };

  const overlay = document.createElement('div');
  overlay.className = 'chat-overlay';
  overlay.innerHTML = `
    <div class="chat-panel">
      <div class="chat-header">
        <span>Нова задача</span>
        <button class="chat-close" aria-label="Затвори">×</button>
      </div>
      <div class="chat-messages"></div>
      <div class="chat-input-row">
        <textarea class="chat-input" placeholder="Постави имейл или напиши какво трябва да направиш..."></textarea>
        <button class="chat-send" aria-label="Изпрати">${ICON_SEND}</button>
      </div>
      <button class="chat-manual-link">+ ръчно</button>
    </div>
  `;
  root.appendChild(overlay);

  overlay.querySelector('.chat-close').addEventListener('click', () => closeChat(root, overlay));
  overlay.querySelector('.chat-send').addEventListener('click', () => handleSend(overlay, ctx, state));
  overlay.querySelector('.chat-manual-link').addEventListener('click', () => {
    closeChat(root, overlay);
    ctx.onManualAdd();
  });
}

function closeChat(root, overlay) {
  overlay.remove();
  root.querySelector('#fab')?.classList.remove('open');
}

function addMessage(overlay, html, role) {
  const messages = overlay.querySelector('.chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg chat-msg-' + role;
  div.innerHTML = html;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

async function handleSend(overlay, ctx, state) {
  const textarea = overlay.querySelector('.chat-input');
  const text = textarea.value.trim();
  if (!text) return;

  const isCorrection = !!state.previousProposal;
  addMessage(overlay, escapeHtml(text), 'user');
  textarea.value = '';
  textarea.disabled = true;

  const activeNames = ctx.categories.filter((c) => c.status === 'active').map((c) => c.name);
  const today = new Date().toISOString().slice(0, 10);

  const payload = { text: isCorrection ? state.lastUserText : text, active_categories: activeNames, today, gen_z_mode: getGenZMode() };
  if (isCorrection) {
    state.correctionRound += 1;
    payload.previous_proposal = state.previousProposal;
    payload.correction = text;
  } else {
    state.lastUserText = text;
  }

  const loadingEl = addMessage(overlay, 'Мисля...', 'ai-loading');

  let res;
  try {
    res = await callScript(ctx.settings.scriptUrl, ctx.settings.accessToken, 'propose', payload);
  } catch (err) {
    loadingEl.remove();
    addMessage(overlay, 'AI не отговаря, опитай пак.', 'ai-error');
    textarea.disabled = false;
    return;
  }

  loadingEl.remove();
  textarea.disabled = false;

  if (!res.ok) {
    addMessage(overlay, escapeHtml(res.message || 'AI не отговаря, опитай пак.'), 'ai-error');
    return;
  }

  const proposal = res.data;
  state.previousProposal = proposal;

  if (!proposal.has_tasks) {
    addMessage(overlay, escapeHtml(proposal.message), 'ai');
    return;
  }

  renderProposal(overlay, proposal, ctx, state);
}

function renderProposal(overlay, proposal, ctx, state) {
  const list = proposal.tasks
    .map(
      (t) => `
      <li>
        <strong>${escapeHtml(t.title)}</strong>
        — ${escapeHtml(t.category)}${t.is_new_category ? ' <em>(нова)</em>' : ''}
        ${t.due_date ? `<span class="proposal-due">${escapeHtml(t.due_date)}</span>` : ''}
      </li>`
    )
    .join('');

  const msgEl = addMessage(
    overlay,
    `<p>${escapeHtml(proposal.message)}</p>
     <ul class="proposal-list">${list}</ul>
     <button class="primary chat-confirm">Потвърди</button>`,
    'ai'
  );

  msgEl.querySelector('.chat-confirm').addEventListener('click', (e) => confirmProposal(overlay, proposal, ctx, state, e.target));
}

async function confirmProposal(overlay, proposal, ctx, state, confirmBtn) {
  confirmBtn.disabled = true;

  const ops = [];
  const newCategories = [];
  const newTasks = [];
  const newCategoryIds = {};
  const nowIso = new Date().toISOString();

  const existingActive = ctx.categories.filter((c) => c.status === 'active');

  proposal.tasks.forEach((t) => {
    let categoryId;
    const existing = existingActive.find((c) => c.name === t.category);

    if (!t.is_new_category && existing) {
      categoryId = existing.id;
    } else if (newCategoryIds[t.category]) {
      categoryId = newCategoryIds[t.category];
    } else {
      categoryId = crypto.randomUUID();
      newCategoryIds[t.category] = categoryId;
      ops.push({
        op_id: crypto.randomUUID(),
        type: 'create',
        entity: 'category',
        id: categoryId,
        base_version: 0,
        fields: { name: t.category },
      });
      newCategories.push({ id: categoryId, name: t.category, status: 'active', created_at: nowIso, archived_at: '', updated_at: nowIso, version: 1 });
    }

    const taskId = crypto.randomUUID();
    const fields = {
      category_id: categoryId,
      title: t.title,
      details: t.details,
      priority: t.priority,
      due_date: t.due_date,
      source_excerpt: t.source_excerpt,
      origin: 'ai',
    };
    ops.push({ op_id: crypto.randomUUID(), type: 'create', entity: 'task', id: taskId, base_version: 0, fields });
    newTasks.push({
      id: taskId,
      ...fields,
      due_date: fields.due_date || '',
      done: false,
      done_at: '',
      created_at: nowIso,
      updated_at: nowIso,
      version: 1,
    });
  });

  try {
    await callScript(ctx.settings.scriptUrl, ctx.settings.accessToken, 'applyChanges', { ops });
  } catch (err) {
    addMessage(overlay, 'Нещо се обърка при запазването. Опитай пак.', 'ai-error');
    confirmBtn.disabled = false;
    return;
  }

  // Логът не блокира интерфейса — записва се във фонов режим.
  callScript(ctx.settings.scriptUrl, ctx.settings.accessToken, 'logEvent', {
    action: 'confirm',
    ok: true,
    tasks_confirmed: proposal.tasks.length,
    correction_round: state.correctionRound,
    origin: 'ai',
  }).catch(() => {});

  overlay.remove();
  ctx.onConfirmed({ categories: newCategories, tasks: newTasks });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
