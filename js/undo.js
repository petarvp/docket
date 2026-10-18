let current = null;

/**
 * Показва лента "Отмени" за `delay` ms. Ако изтече без клик, вика onCommit;
 * ако потребителят натисне "Отмени", вика onUndo. Само една лента наведнъж —
 * нова лента веднага потвърждава предходната.
 */
export function showUndo(root, message, { onUndo, onCommit, delay = 5000 }) {
  if (current) current.commit();

  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  toast.innerHTML = `<span>${message}</span><button class="undo-btn">Отмени</button>`;
  root.appendChild(toast);

  let done = false;
  const finish = (fn) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    toast.remove();
    if (current === api) current = null;
    fn();
  };

  const commit = () => finish(onCommit);
  const undo = () => finish(onUndo);
  const timer = setTimeout(commit, delay);

  toast.querySelector('.undo-btn').addEventListener('click', undo);

  const api = { commit, undo };
  current = api;
  return api;
}
