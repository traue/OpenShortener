/* OpenShortener service worker
 * - Network-first for HTML, JS, CSS, JSON (anything that evolves with a
 *   deploy — old JS + stale i18n breaks the UI, so we always try the
 *   network first and only fall back to cache when offline)
 * - Cache-first for images, fonts, icons, manifest (rarely change)
 * - Network-only for /api/*, /qr/*, and short-code redirects
 *
 * Bump CACHE_VERSION whenever the precache list changes so old caches are
 * cleaned up on the next activate.
 */
const CACHE_VERSION = 'os-v4';
const STATIC_CACHE  = 'os-static-' + CACHE_VERSION;
const RUNTIME_CACHE = 'os-runtime-' + CACHE_VERSION;

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/my-links.html',
    '/admin.html',
    '/terms.html',
    '/expired.html',
    '/styles.css',
    '/app.js',
    '/my-links.js',
    '/admin.js',
    '/i18n/en.json',
    '/i18n/pt-BR.json',
    '/i18n/es.json',
    '/site.webmanifest',
    '/favicon.ico',
    '/assets/favicon-16.png',
    '/assets/favicon-32.png',
    '/assets/favicon-48.png',
    '/assets/favicon-96.png',
    '/assets/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
                .map((k) => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

function isHtmlRequest(request) {
    return request.mode === 'navigate' ||
        (request.headers.get('accept') || '').includes('text/html');
}

// Long-lived assets that almost never change between deploys.
function isImmutableAsset(url) {
    return /\.(png|jpg|jpeg|gif|svg|ico|webmanifest|woff2?|ttf)$/i.test(url.pathname);
}

// Deploy-coupled assets — must follow the same version as the HTML/JS
// that references them. Stale copies of any of these break the UI
// (e.g. old i18n + new JS shows raw keys).
function isDeployAsset(url) {
    return /\.(css|js|json)$/i.test(url.pathname) || url.pathname.startsWith('/i18n/');
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Don't touch cross-origin (e.g. Turnstile)
    if (url.origin !== self.location.origin) return;

    // Pass through API, QR, short-code redirects, and admin POST endpoints
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/qr/')) return;

    if (isImmutableAsset(url)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    if (isDeployAsset(url) || isHtmlRequest(request)) {
        event.respondWith(networkFirst(request));
    }
});

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (_) {
        return cached || Response.error();
    }
}

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (_) {
        const cached = await caches.match(request);
        if (cached) return cached;
        // As a final fallback, serve the cached index for navigation requests
        const fallback = await caches.match('/index.html');
        if (fallback) return fallback;
        return Response.error();
    }
}
