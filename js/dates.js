export function relativeDueLabel(dueDate) {
  if (!dueDate) return { label: 'без срок', level: 'none' };

  const today = startOfDay(new Date());
  const due = startOfDay(new Date(dueDate + 'T00:00:00'));
  const diffDays = Math.round((due - today) / 86400000);

  if (diffDays < 0) return { label: 'просрочено', level: 'overdue' };
  if (diffDays === 0) return { label: 'днес', level: 'soon' };
  if (diffDays === 1) return { label: 'утре', level: 'soon' };
  return { label: `след ${diffDays} дни`, level: 'normal' };
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
