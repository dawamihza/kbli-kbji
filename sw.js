/* ============================================================
   Service worker: menyimpan seluruh berkas aplikasi di perangkat
   agar bisa dibuka tanpa koneksi internet.
   Naikkan VERSI setiap kali ada berkas yang berubah, supaya
   peramban mengambil versi barunya.
   ============================================================ */

const VERSI = 'kbli-kbji-v2026.1';

const BERKAS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './data/kbli2025.json',
  './data/kbji2026.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(VERSI)
      .then(c => c.addAll(BERKAS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(kunci => Promise.all(
        kunci.filter(k => k !== VERSI).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;

  // Utamakan simpanan lokal; ambil dari jaringan hanya bila belum tersimpan
  ev.respondWith(
    caches.match(req, { ignoreSearch: true }).then(tersimpan => {
      if (tersimpan) return tersimpan;
      return fetch(req)
        .then(res => {
          if (res && res.ok && new URL(req.url).origin === self.location.origin) {
            const salinan = res.clone();
            caches.open(VERSI).then(c => c.put(req, salinan));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
