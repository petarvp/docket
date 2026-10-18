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
        <label>Приоритет
          <select class="f-priority">
            <option value="high">Висок</option>
            <option value="medium">Среден</option>
            <option value="low">Нисък</option>
          </select>
        </label>
        <label>Срок <input class="f-due" type="date" value="${task.due_date || ''}" /></label>
        ${task.source_excerpt ? `<div class="task-excerpt"><strong>От текста:</strong> „${escapeHtml(task.source_excerpt)}"</div>` : ''}
        <label class="task-done-row">
          <input type="checkbox" class="f-done" ${isDone(task) ? 'checked' : ''} /> Приключена
        </label>
      </div>
      <div class="task-panel-footer">
        <button class="danger f-delete">Изтрий</button>
      </div>
    </div>
  `;
  root.appendChild(overlay);
  closeOnOutsideClick(overlay);
  overlay.querySelector('.f-priority').value = task.priority || 'medium';

  overlay.querySelector('.task-close').addEventListener('click', () => overlay.remove());

  let saveTimer;
  const scheduleSave = (fields) => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => ctx.onUpdate(task.id, fields), 500);
  };

  overlay.querySelector('.f-title').addEventListener('input', (e) => scheduleSave({ title: e.target.value }));
  overlay.querySelector('.f-details').addEventListener('input', (e) => scheduleSave({ details: e.target.value }));
  overlay.querySelector('.f-priority').addEventListener('change', (e) => ctx.onUpdate(task.id, { priority: e.target.value }));
  overlay.querySelector('.f-due').addEventListener('change', (e) => ctx.onUpdate(task.id, { due_date: e.target.value || null }));

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
        <label>Приоритет
          <select class="f-priority">
            <option value="high">Висок</option>
            <option value="medium" selected>Среден</option>
            <option value="low">Нисък</option>
          </select>
        </label>
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
      priority: overlay.querySelector('.f-priority').value,
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
