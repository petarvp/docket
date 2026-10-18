const VIEWS = [
  { id: 'board', label: 'Табло' },
  { id: 'today', label: 'Днес' },
  { id: 'week', label: 'Следващите 7 дни' },
  { id: 'month', label: 'Този месец' },
  { id: 'calendar', label: 'Календар' },
  { id: 'all', label: 'Всички задачи' },
];

const ICON_MENU =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>';

export { ICON_MENU };

export function renderSidebar(container, { categories, activeView, activeCategoryId }, handlers) {
  const active = categories.filter((c) => c.status === 'active');

  container.innerHTML = `
    <div class="sidebar-overlay-backdrop"></div>
    <nav class="sidebar">
      <div class="sidebar-top">
        <span class="sidebar-title">Docket</span>
        <button class="sidebar-close icon-button" aria-label="Затвори менюто">×</button>
      </div>
      <div class="sidebar-section">
        ${VIEWS.map(
          (v) =>
            `<button class="sidebar-item ${activeView === v.id && !activeCategoryId ? 'active' : ''}" data-view="${v.id}">${v.label}</button>`
        ).join('')}
      </div>
      <div class="sidebar-section">
        <div class="sidebar-section-header">
          <span>Категории</span>
          <button class="sidebar-add-category" aria-label="Нова категория">+</button>
        </div>
        ${
          active
            .map(
              (c) =>
                `<button class="sidebar-item ${activeCategoryId === c.id ? 'active' : ''}" data-category="${c.id}">${escapeHtml(c.name)}</button>`
            )
            .join('') || '<p class="hint sidebar-empty-hint">Все още няма категории.</p>'
        }
      </div>
    </nav>
  `;

  container.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => handlers.onSelectView(btn.dataset.view));
  });
  container.querySelectorAll('[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => handlers.onSelectCategory(btn.dataset.category));
  });
  container.querySelector('.sidebar-add-category').addEventListener('click', handlers.onAddCategory);
  container.querySelector('.sidebar-close').addEventListener('click', handlers.onClose);
  container.querySelector('.sidebar-overlay-backdrop').addEventListener('click', handlers.onClose);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
