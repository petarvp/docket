const CACHE_NAME = 'docket-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/settings.js',
  './js/board.js',
  './js/chat.js',
  './js/task.js',
  './js/undo.js',
  './js/store.js',
  './js/sync.js',
  './js/api.js',
  './js/dates.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Заявките към Apps Script не се кешират тук — за тях отговаря опашката в store.js/sync.js.
  if (url.hostname.indexOf('script.google') !== -1 || url.hostname.indexOf('googleusercontent') !== -1) {
    return;
  }
  if (event.request.method !== 'GET') return;

  // Мрежа първо — докато разработваме, винаги искаме последната версия, ако я има.
  // Кешът е само резервен вариант, когато няма връзка.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
