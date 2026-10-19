import { PRESET_HUES, categoryHue } from './colors.js';

export function openCategoryEditForm(root, category, categories, ctx) {
  const currentHue = categoryHue(categories, category.id);
  const hasManualHue = category.hue !== undefined && category.hue !== null && category.hue !== '';
  let selectedHue = hasManualHue ? Number(category.hue) : null;

  const overlay = document.createElement('div');
  overlay.className = 'task-overlay';
  overlay.innerHTML = `
    <div class="task-panel">
      <div class="task-panel-header">
        <span>Редактирай категория</span>
        <button class="task-close" aria-label="Затвори">×</button>
      </div>
      <div class="task-panel-body">
        <label>Име <input class="f-category-name" value="${escapeAttr(category.name)}" /></label>
        <label>Цвят</label>
        <div class="color-palette">
          <button type="button" class="color-swatch color-swatch-auto ${!hasManualHue ? 'active' : ''}" data-hue="" style="--cat-hue: ${currentHue}">Авто</button>
          ${PRESET_HUES.map(
            (h) =>
              `<button type="button" class="color-swatch ${hasManualHue && Number(category.hue) === h ? 'active' : ''}" data-hue="${h}" style="--cat-hue: ${h}" aria-label="Цвят ${h}"></button>`
          ).join('')}
        </div>
      </div>
      <div class="task-panel-footer">
        <button class="danger f-delete-category">Архивирай</button>
        <button class="primary f-save">Запази</button>
      </div>
    </div>
  `;
  root.appendChild(overlay);
  closeOnOutsideClick(overlay);

  const input = overlay.querySelector('.f-category-name');
  const swatches = overlay.querySelectorAll('.color-swatch');
  swatches.forEach((btn) => {
    btn.addEventListener('click', () => {
      swatches.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedHue = btn.dataset.hue === '' ? null : Number(btn.dataset.hue);
    });
  });

  overlay.querySelector('.task-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('.f-delete-category').addEventListener('click', () => {
    overlay.remove();
    ctx.onArchive(category.id);
  });
  overlay.querySelector('.f-save').addEventListener('click', () => {
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }
    overlay.remove();
    ctx.onSave(category.id, { name, hue: selectedHue });
  });
}

export function openNewCategoryForm(root, ctx) {
  const overlay = document.createElement('div');
  overlay.className = 'task-overlay';
  overlay.innerHTML = `
    <div class="task-panel">
      <div class="task-panel-header">
        <span>Нова категория</span>
        <button class="task-close" aria-label="Затвори">×</button>
      </div>
      <div class="task-panel-body">
        <label>Име <input class="f-category-name" /></label>
      </div>
      <div class="task-panel-footer">
        <button class="primary f-save">Добави</button>
      </div>
    </div>
  `;
  root.appendChild(overlay);
  closeOnOutsideClick(overlay);

  const input = overlay.querySelector('.f-category-name');
  input.focus();
  autoCapitalizeFirstLetter(input);

  overlay.querySelector('.task-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('.f-save').addEventListener('click', () => {
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }
    overlay.remove();
    ctx.onCreate(name);
  });
}

export function openTaskDetail(root, task, ctx) {
  const pending = {};

  const overlay = document.createElement('div');
  overlay.className = 'task-overlay';
  overlay.innerHTML = `
    <div class="task-panel">
      <div class="task-panel-header">
        <span>Задача</span>
        <button class="task-close" aria-label="Затвори">×</button>
      </div>
      <div class="task-panel-body">
        <label>Заглавие <input class="f-title" value="${escapeAttr(task.title)}" /></label>
        <label>Детайли <textarea class="f-details">${escapeHtml(task.details || '')}</textarea></label>
        <label>Приоритет</label>
        ${renderPriorityButtons(task.priority || 'medium')}
        <label>Срок <input class="f-due" type="date" value="${task.due_date || ''}" /></label>
        ${task.source_excerpt ? `<div class="task-excerpt"><strong>От текста:</strong> „${escapeHtml(task.source_excerpt)}"</div>` : ''}
        <label class="task-done-row">
          <input type="checkbox" class="f-done" ${isDone(task) ? 'checked' : ''} /> Приключена
        </label>
      </div>
      <div class="task-panel-footer">
        <button class="danger f-delete">Изтрий</button>
        <button class="primary f-save">Запази</button>
      </div>
    </div>
  `;
  root.appendChild(overlay);
  closeOnOutsideClick(overlay);

  overlay.querySelector('.task-close').addEventListener('click', () => overlay.remove());

  overlay.querySelector('.f-title').addEventListener('input', (e) => {
    pending.title = e.target.value;
  });
  overlay.querySelector('.f-details').addEventListener('input', (e) => {
    pending.details = e.target.value;
  });
  wirePriorityButtons(overlay, (value) => {
    pending.priority = value;
  });
  overlay.querySelector('.f-due').addEventListener('change', (e) => {
    pending.due_date = e.target.value || null;
  });

  overlay.querySelector('.f-save').addEventListener('click', () => {
    overlay.remove();
    if (Object.keys(pending).length > 0) ctx.onUpdate(task.id, pending);
  });

  overlay.querySelector('.f-done').addEventListener('change', (e) => {
    const nowDone = e.target.checked;
    overlay.remove();
    ctx.onToggleDone(task.id, nowDone);
  });

  overlay.querySelector('.f-delete').addEventListener('click', () => {
    overlay.remove();
    ctx.onDelete(task.id);
  });
}

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'Висок' },
  { value: 'medium', label: 'Среден' },
  { value: 'low', label: 'Нисък' },
];

function renderPriorityButtons(selected) {
  return `
    <div class="priority-buttons">
      ${PRIORITY_OPTIONS.map(
        (o) =>
          `<button type="button" class="priority-btn priority-btn-${o.value} ${o.value === selected ? 'active' : ''}" data-priority="${o.value}">${o.label}</button>`
      ).join('')}
    </div>
  `;
}

function wirePriorityButtons(overlay, onChange) {
  const buttons = overlay.querySelectorAll('.priority-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(btn.dataset.priority);
    });
  });
}

const NEW_CATEGORY_VALUE = '__new__';

export function openManualForm(root, activeCategories, ctx, preselectedCategoryId) {
  const noCategories = activeCategories.length === 0;

  const overlay = document.createElement('div');
  overlay.className = 'task-overlay';
  overlay.innerHTML = `
    <div class="task-panel">
      <div class="task-panel-header">
        <span>Нова задача (ръчно)</span>
        <button class="task-close" aria-label="Затвори">×</button>
      </div>
      <div class="task-panel-body">
        <label>Заглавие <input class="f-title" /></label>
        <label>Детайли <textarea class="f-details"></textarea></label>
        <label>Категория
          <select class="f-category">
            ${activeCategories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
            <option value="${NEW_CATEGORY_VALUE}">+ Нова категория</option>
          </select>
        </label>
        <input class="f-new-category" placeholder="Име на новата категория" style="${noCategories ? '' : 'display:none'}" />
        <label>Приоритет</label>
        ${renderPriorityButtons('medium')}
        <label>Срок <input class="f-due" type="date" /></label>
        <div class="quick-chips">
          <button type="button" class="chip" data-days="0">Днес</button>
          <button type="button" class="chip" data-days="1">Утре</button>
          <button type="button" class="chip" data-days="7">След седмица</button>
        </div>
      </div>
      <div class="task-panel-footer">
        <button class="primary f-save">Добави</button>
      </div>
    </div>
  `;
  root.appendChild(overlay);
  closeOnOutsideClick(overlay);

  let selectedPriority = 'medium';
  wirePriorityButtons(overlay, (value) => {
    selectedPriority = value;
  });

  const categorySelect = overlay.querySelector('.f-category');
  const newCategoryInput = overlay.querySelector('.f-new-category');
  autoCapitalizeFirstLetter(newCategoryInput);

  if (noCategories) {
    categorySelect.value = NEW_CATEGORY_VALUE;
  } else if (preselectedCategoryId) {
    categorySelect.value = preselectedCategoryId;
  }

  categorySelect.addEventListener('change', () => {
    const isNew = categorySelect.value === NEW_CATEGORY_VALUE;
    newCategoryInput.style.display = isNew ? '' : 'none';
    if (isNew) newCategoryInput.focus();
  });

  overlay.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      overlay.querySelector('.f-due').value = isoDateIn(Number(chip.dataset.days));
      overlay.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  overlay.querySelector('.task-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('.f-save').addEventListener('click', () => {
    const title = overlay.querySelector('.f-title').value.trim();
    if (!title) return;

    const isNewCategory = categorySelect.value === NEW_CATEGORY_VALUE;
    const newCategoryName = newCategoryInput.value.trim();
    if (isNewCategory && !newCategoryName) {
      newCategoryInput.focus();
      return;
    }

    const fields = {
      title,
      details: overlay.querySelector('.f-details').value.trim(),
      category_id: isNewCategory ? null : categorySelect.value,
      new_category_name: isNewCategory ? newCategoryName : undefined,
      priority: selectedPriority,
      due_date: overlay.querySelector('.f-due').value || null,
      source_excerpt: '',
      origin: 'manual',
    };
    overlay.remove();
    ctx.onCreate(fields);
  });
}

function closeOnOutsideClick(overlay) {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// Капитализира само първата буква, която потребителят въведе — еднократно, за да
// остане полето с главна буква по подразбиране, без да пречи ако той нарочно го
// редактира/препише с малка.
function autoCapitalizeFirstLetter(input) {
  let applied = false;
  input.addEventListener('input', () => {
    if (applied || !input.value) return;
    applied = true;
    input.value = input.value.charAt(0).toUpperCase() + input.value.slice(1);
  });
}

function isoDateIn(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isDone(task) {
  return task.done === true || task.done === 'TRUE';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}
