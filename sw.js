const CACHE_NAME = 'veritylang-shell-v1.10.1';
const STATIC_SHELL_ASSETS = ['./manifest.webmanifest', './icon-192.png', './icon-512.png'];
const BYPASS_HOSTS = [
  'github.com',
  'githubusercontent.com',
  'generativelanguage.googleapis.com',
  'deepl.com',
  'openai.com',
  'deepseek.com',
  'translate.googleapis.com',
  'clients5.google.com',
  'mymemory.translated.net'
];

function isBypassHost(hostname) {
  const host = (hostname || '').toLowerCase();
  return BYPASS_HOSTS.some((h) => host === h || host.endsWith('.' + h));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const urlsToCache = new Set(STATIC_SHELL_ASSETS);
      let cachedIndexHtml = false;

      try {
        const htmlRes = await fetch('./index.html', { cache: 'no-store' });
        if (htmlRes && htmlRes.ok) {
          await cache.put('./index.html', htmlRes.clone());
          await cache.put('./', htmlRes.clone());
          cachedIndexHtml = true;

          const html = await htmlRes.text();
          const assetRe = /(?:src|href)=["'](\.?\/assets\/[^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi;
          let match;
          while ((match = assetRe.exec(html)) !== null) {
            if (match[1]) urlsToCache.add(match[1]);
          }
        }
      } catch {
        // Ağ geçici olarak erişilemezse temel kabuk önbelleklemesiyle devam et
      }

      if (!cachedIndexHtml) {
        urlsToCache.add('./');
        urlsToCache.add('./index.html');
      }

      await Promise.allSettled(
        Array.from(urlsToCache).map(async (assetUrl) => {
          const res = await fetch(assetUrl, { cache: 'reload' });
          if (res && res.ok) {
            await cache.put(assetUrl, res);
          }
        })
      );
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('authorization')) return;

  const url = new URL(req.url);
  const lowerPath = url.pathname.toLowerCase();

  // Canlı çeviri/AI API'lerini, kimlik doğrulamalı istekleri, OTA yapılandırmasını ve ikili indirmeleri her zaman ağdan taze çek
  if (
    url.origin !== self.location.origin ||
    isBypassHost(url.hostname) ||
    lowerPath.startsWith('/api/') ||
    lowerPath.startsWith('/v1/') ||
    lowerPath.startsWith('/v2/') ||
    lowerPath.startsWith('/v1beta/') ||
    lowerPath.endsWith('/ota-config.json') ||
    lowerPath.endsWith('/update-manifest.json') ||
    lowerPath.endsWith('/ota-rules.json') ||
    lowerPath.includes('/ota/') ||
    lowerPath.endsWith('.exe') ||
    lowerPath.endsWith('.zip') ||
    lowerPath.endsWith('.apk')
  ) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {})
          );
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const shell = await caches.match('./index.html');
          if (shell) return shell;
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});
