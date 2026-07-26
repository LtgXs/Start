/* ============================================
 * Snavigation - Service Worker
 * 离线可用 + 静态资源秒开。
 * 策略：
 *   - 页面导航（HTML）：网络优先（3s 超时），失败回缓存 → 离线也能打开
 *   - CSS / JS：stale-while-revalidate —— 先用缓存秒开，后台更新，
 *     下次加载即是新版（改动无需手动升版本号即可传播）
 *   - 字体 / 图片 / 图标 / manifest：缓存优先（内容基本不变）
 *   - 跨域请求（天气 / 联想 / 壁纸 API 等）：完全不拦截
 * 升级：修改 VERSION 触发旧缓存清理（正常改动无需修改，
 *       仅当希望强制丢弃已缓存的静态资源时使用）
 * ============================================ */
'use strict';

const VERSION = 'snav-v1.7.0';

const CORE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './favicon.ico',
    './css/font.css',
    './css/style.css',
    './css/loading.css',
    './css/mobile.css',
    './css/animation.css',
    './js/config.js',
    './js/utils.js',
    './js/storage.js',
    './js/wallpaper.js',
    './js/search.js',
    './js/bookmarks.js',
    './js/settings.js',
    './js/widgets.js',
    './js/main.js',
    './font/MiSans-Regular.subset.woff2',
    './font/iconfont.woff2',
    './img/background1.webp',
    './img/icon/favicon_32.png',
    './img/icon/favicon_64.png',
    './img/icon/favicon_128.png',
    './img/icon/favicon_144.png',
    './img/icon/favicon_180.png',
    './img/icon/favicon_192.png',
    './img/icon/favicon_512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(VERSION)
            .then((cache) => cache.addAll(CORE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((k) => k.startsWith('snav-') && k !== VERSION)
                    .map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

/** 带超时的 fetch（导航请求用：慢网时尽快回落缓存，避免白屏等待） */
function fetchWithTimeout(request, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('sw fetch timeout')), ms);
        fetch(request).then(
            (res) => { clearTimeout(timer); resolve(res); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
}

async function networkFirst(request) {
    const cache = await caches.open(VERSION);
    try {
        const res = await fetchWithTimeout(request, 3000);
        if (res && res.ok) cache.put(request, res.clone());
        return res;
    } catch (e) {
        const cached = await cache.match(request, { ignoreSearch: true });
        return cached || (await cache.match('./index.html')) || Response.error();
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(request);
    const network = fetch(request)
        .then((res) => {
            if (res && res.ok) cache.put(request, res.clone());
            return res;
        })
        .catch(() => null);
    if (cached) return cached;
    return (await network) || Response.error();
}

async function cacheFirst(request) {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
        const res = await fetch(request);
        if (res && res.ok) cache.put(request, res.clone());
        return res;
    } catch (e) {
        return Response.error();
    }
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // 跨域一律直连

    if (req.mode === 'navigate') {
        event.respondWith(networkFirst(req));
    } else if (/\.(css|js)$/.test(url.pathname)) {
        event.respondWith(staleWhileRevalidate(req));
    } else {
        event.respondWith(cacheFirst(req));
    }
});
