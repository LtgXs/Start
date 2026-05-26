/* ============================================
 * Snavigation - Wallpaper Module
 * 背景视觉处理核心：缓存读写、API 密钥、
 * 主图与氛围图交替显示、淡入淡出渲染
 * 依赖：storage.js（需先加载）
 * ============================================ */

// 背景图片默认配置
var bg_img_preinstall = {
    "type": "1",          // 1~5:内置源 6:自定义URL
    "path": "",           // 自定义图片 URL 模板（可含 {key} 占位符）
    "cache": true,        // 是否缓存壁纸 (已强制开启)
    "cacheDuration": 24,  // 缓存时长（小时）
    "bg_fit": false,      // 比例自适应：完整显示图片，模糊填充边缘
};

// ── 壁纸存储键 ──────────────────────────────────────────────────
var BG_APIKEY_SESSION_KEY = 'bg_apikey';
var BG_LAST_URL_KEY = 'bg_last_url';
var BG_LAST_TYPE_KEY = 'bg_last_type';
var BG_IMG_DATA_KEY = 'bg_img_data';

// ── 缓存限制 ────────────────────────────────────────────────────
var BG_IMG_DATA_MAX = 60000000;       // base64 最大尺寸（约 60MB）
var CACHE_DURATION_DEFAULT = 24;      // 默认缓存时长（小时）
var CACHE_DURATION_MAX = 720;         // 最大缓存时长（小时）
var BG_FADE_DURATION_MS = 1500;       // 渐变过渡时长（ms）
var REVEAL_DURATION_MS = 1500;        // 揭幕动画时长（ms）

// ── 调试日志 ────────────────────────────────────────────────────
var BG_DEBUG = (function () {
    try { return localStorage.getItem('bg_debug') === '1'; } catch (e) { return true; }
})();
function bgLog() {
    if (!BG_DEBUG) return;
    var args = Array.prototype.slice.call(arguments);
    args[0] = '[bg:' + (performance.now ? performance.now().toFixed(0) : '0') + 'ms] ' + args[0];
    console.log.apply(console, args);
}

// ── 壁纸列表（type=1 内置源）────────────────────────────────────
var DEFAULT_BG_LIST = [
    './img/background1.webp', './img/background2.webp', './img/background3.webp',
    './img/background4.webp', './img/background5.webp', './img/background6.webp',
    './img/background7.webp', './img/background8.webp', './img/background9.webp',
    './img/background10.webp'
];
var FALLBACK_BG_URL = './img/background1.webp';
var ULTIMATE_FALLBACK = './img/background1.webp';

// ── IndexedDB Cache Wrapper ──────────────────────────────────────────
var dbName = "SnavigationDB";
var storeName = "wallpapers";
var dbVersion = 1;

function getDB() {
    return new Promise(function (resolve, reject) {
        var request = indexedDB.open(dbName, dbVersion);
        request.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };
        request.onsuccess = function (e) {
            resolve(e.target.result);
        };
        request.onerror = function (e) {
            reject(e.target.error);
        };
    });
}

function getIndexedDBCache(key) {
    return getDB().then(function (db) {
        return new Promise(function (resolve, reject) {
            var transaction = db.transaction([storeName], "readonly");
            var store = transaction.objectStore(storeName);
            var request = store.get(key);
            request.onsuccess = function (e) {
                resolve(e.target.result || null);
            };
            request.onerror = function (e) {
                reject(e.target.error);
            };
        });
    }).catch(function (err) {
        bgLog("IndexedDB get error:", err);
        return null;
    });
}

function setIndexedDBCache(key, val) {
    return getDB().then(function (db) {
        return new Promise(function (resolve, reject) {
            var transaction = db.transaction([storeName], "readwrite");
            var store = transaction.objectStore(storeName);
            var request = store.put(val, key);
            request.onsuccess = function () {
                resolve(true);
            };
            request.onerror = function (e) {
                reject(e.target.error);
            };
        });
    }).catch(function (err) {
        bgLog("IndexedDB put error:", err);
        return false;
    });
}

function removeIndexedDBCache(key) {
    return getDB().then(function (db) {
        return new Promise(function (resolve, reject) {
            var transaction = db.transaction([storeName], "readwrite");
            var store = transaction.objectStore(storeName);
            var request = store.delete(key);
            request.onsuccess = function () {
                resolve(true);
            };
            request.onerror = function (e) {
                reject(e.target.error);
            };
        });
    }).catch(function (err) {
        bgLog("IndexedDB delete error:", err);
        return false;
    });
}

// ══════════════════════════════════════════════════════════════════
// 壁纸配置读写
// ══════════════════════════════════════════════════════════════════

function getBgImg() {
    var bg_img_local = Storage.get('bg_img');
    if (bg_img_local && bg_img_local !== "{}") {
        try {
            var parsed = JSON.parse(bg_img_local);
            parsed.cache = true; // 强制使用缓存
            return parsed;
        } catch (e) {
            console.warn('bg_img 数据损坏，已重置:', e);
            Storage.remove('bg_img');
        }
    }
    setBgImg(bg_img_preinstall);
    return bg_img_preinstall;
}

function setBgImg(bg_img) {
    if (bg_img) {
        Storage.set('bg_img', bg_img);
        return true;
    }
    return false;
}

// ══════════════════════════════════════════════════════════════════
// API 密钥持久化
// ══════════════════════════════════════════════════════════════════

function getBgApiKey() {
    return localStorage.getItem(BG_APIKEY_SESSION_KEY) || '';
}
function setBgApiKey(key) {
    if (key) { localStorage.setItem(BG_APIKEY_SESSION_KEY, key); }
}
function clearBgApiKey() {
    localStorage.removeItem(BG_APIKEY_SESSION_KEY);
}

// ══════════════════════════════════════════════════════════════════
// 上次壁纸 URL / 类型
// ══════════════════════════════════════════════════════════════════

function getLastBgUrl() {
    var v = localStorage.getItem(BG_LAST_URL_KEY) || '';
    bgLog('getLastBgUrl() =', (v ? v.substring(0, 80) + (v.length > 80 ? '...' : '') : '(空)'));
    return v;
}
function isRandomApiUrl(url) {
    if (!url) return false;
    var u = url.toLowerCase();
    if (u.indexOf('t.mwm.moe') !== -1) return true;
    if (u.indexOf('t.alcy.cc') !== -1 && u.indexOf('?json') === -1 && u.indexOf('.jpg') === -1 && u.indexOf('.png') === -1 && u.indexOf('.webp') === -1) return true;
    if (u.indexOf('picsum.photos') !== -1 && u.indexOf('/id/') === -1 && u.indexOf('/seed/') === -1) return true;
    if (u.indexOf('bing.biturl.top') !== -1 && u.indexOf('format=image') !== -1) return true;
    return false;
}

function setLastBgUrl(url) {
    if (url) {
        if (url.indexOf('data:image/') === 0) {
            bgLog('setLastBgUrl() 跳过 base64 数据写入');
            return;
        }
        bgLog('setLastBgUrl() 写入:', url.substring(0, 80) + (url.length > 80 ? '...' : ''));
        localStorage.setItem(BG_LAST_URL_KEY, url);
    }
}

function getLastBgType() {
    var v = localStorage.getItem(BG_LAST_TYPE_KEY) || '';
    bgLog('getLastBgType() =', v || '(空)');
    return v;
}
function setLastBgType(type) {
    if (type) {
        bgLog('setLastBgType() =', type);
        localStorage.setItem(BG_LAST_TYPE_KEY, type);
    }
}

// ══════════════════════════════════════════════════════════════════
// Base64 图片缓存
// ══════════════════════════════════════════════════════════════════

function getCachedBgData() {
    return getIndexedDBCache(BG_IMG_DATA_KEY).then(function (cachedData) {
        if (!cachedData) {
            try {
                var raw = localStorage.getItem(BG_IMG_DATA_KEY);
                if (raw && raw.indexOf('data:image/') === 0) {
                    bgLog('getCachedBgData() 找到 legacy localStorage 缓存，进行迁移...');
                    setIndexedDBCache(BG_IMG_DATA_KEY, raw);
                    localStorage.removeItem(BG_IMG_DATA_KEY);
                    return raw;
                }
            } catch (e) {
                bgLog('getCachedBgData() legacy migration error:', e);
            }
            return null;
        }
        return cachedData;
    });
}

function setCachedBgData(dataUrl) {
    if (!dataUrl || dataUrl.indexOf('data:image/') !== 0) {
        bgLog('setCachedBgData() 跳过 (无效 data URL)');
        return Promise.resolve(false);
    }
    if (dataUrl.length > BG_IMG_DATA_MAX) {
        bgLog('setCachedBgData() 跳过 (过大:', (dataUrl.length / 1000000).toFixed(1), 'MB > 限制', (BG_IMG_DATA_MAX / 1000000).toFixed(0), 'MB)');
        console.warn('[bg cache] base64 数据过大，跳过缓存 (' + (dataUrl.length / 1000000).toFixed(1) + 'MB)');
        return Promise.resolve(false);
    }
    return setIndexedDBCache(BG_IMG_DATA_KEY, dataUrl).then(function (success) {
        if (success) {
            bgLog('setCachedBgData() 成功! 长度:', dataUrl.length, 'chars (', (dataUrl.length / 1000000).toFixed(2), 'MB)');
        } else {
            bgLog('setCachedBgData() IndexedDB 写入失败');
        }
        return success;
    });
}

function clearCachedBgData() {
    bgLog('clearCachedBgData() 清除 base64 缓存');
    try { localStorage.removeItem(BG_IMG_DATA_KEY); } catch (e) { }
    return removeIndexedDBCache(BG_IMG_DATA_KEY);
}

// ══════════════════════════════════════════════════════════════════
// Canvas 压缩工具
// ══════════════════════════════════════════════════════════════════

function imageToBase64(img) {
    try {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        bgLog('imageToBase64() 原始尺寸:', w + 'x' + h);
        if (!w || !h) { bgLog('imageToBase64() 失败: 尺寸无效'); return null; }
        var canvas = document.createElement('canvas');
        var maxW = 1920;
        var scale = Math.min(1, maxW / w);
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        bgLog('imageToBase64() Canvas:', canvas.width + 'x' + canvas.height, '(scale:', scale.toFixed(2) + ')');
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        var result = canvas.toDataURL('image/jpeg', 0.8);
        bgLog('imageToBase64() 成功! 结果长度:', result.length, 'chars');
        return result;
    } catch (e) {
        bgLog('imageToBase64() 失败 (可能跨域):', e.message || e);
        console.warn('[bg cache] 图片无法转为 base64（可能跨域）:', e.message || e);
        return null;
    }
}

function compressAndCacheDataUrl(dataUrl, callback) {
    bgLog('compressAndCacheDataUrl() 输入长度:', dataUrl.length, 'chars');
    var img = new Image();
    img.onload = function () {
        var compressed = imageToBase64(img);
        if (compressed) {
            bgLog('compressAndCacheDataUrl() 压缩成功，调用 setCachedBgData');
            setCachedBgData(compressed).then(function() {
                callback(compressed);
            });
        } else {
            bgLog('compressAndCacheDataUrl() 压缩失败，使用原始数据');
            callback(dataUrl);
        }
    };
    img.onerror = function () {
        bgLog('compressAndCacheDataUrl() 图片解码失败，尝试存原始数据');
        if (dataUrl.length <= BG_IMG_DATA_MAX) {
            setCachedBgData(dataUrl).then(function() {
                callback(dataUrl);
            });
        } else {
            callback(dataUrl);
        }
    };
    img.src = dataUrl;
}

// ══════════════════════════════════════════════════════════════════
// 图片加载 + 兜底回退
// ══════════════════════════════════════════════════════════════════

function setWithFallback($img, url, nextFallback) {
    bgLog('setWithFallback() url=', (url || '').substring(0, 60), '| next=', (nextFallback || '').substring(0, 60));
    if (!url) {
        if (nextFallback) {
            bgLog('setWithFallback() url 为空，跳至 next fallback');
            $img.attr('src', nextFallback);
        }
        return;
    }
    var handled = false;
    var fallback = nextFallback;
    var oldError = $img[0].onerror;
    $img[0].onerror = function () {
        if (handled) return;
        handled = true;
        bgLog('setWithFallback() 图片加载失败! url=', url.substring(0, 60), '→ 回退');
        if (fallback && fallback !== url && fallback !== ULTIMATE_FALLBACK) {
            setWithFallback($img, fallback, ULTIMATE_FALLBACK);
        } else if (fallback && fallback !== url) {
            setWithFallback($img, fallback, null);
        } else {
            bgLog('setWithFallback() 到达终极兜底');
            $img[0].onerror = null;
        }
        $img[0].onerror = oldError;
    };
    $img.attr('src', url);
}

function buildBgUrl(template, apiKey) {
    var url = template || '';
    if (apiKey && url.indexOf('{key}') !== -1) {
        url = url.replace(/\{key\}/g, encodeURIComponent(apiKey));
    }
    return url;
}

// ══════════════════════════════════════════════════════════════════
// 壁纸缓存元数据
// ══════════════════════════════════════════════════════════════════

function getBgCache() {
    var raw = localStorage.getItem('bg_img_cache');
    if (!raw) { bgLog('getBgCache() = null (无缓存元数据)'); return null; }
    try {
        var c = JSON.parse(raw);
        var valid = isBgCacheValid(c, getBgImg());
        bgLog('getBgCache() type=', c.type, '| expires=', new Date(c.expiresAt).toISOString(), '| valid=', valid);
        return c;
    } catch (e) {
        bgLog('getBgCache() 数据损坏:', e);
        console.warn('[wallpaper cache] 缓存数据损坏，已忽略:', e);
        return null;
    }
}

function setBgCache(type, url, bg_img) {
    var duration = (parseInt(bg_img["cacheDuration"], 10) || CACHE_DURATION_DEFAULT) * 3600 * 1000;
    var cache = { type: type, url: url, expiresAt: Date.now() + duration };
    bgLog('setBgCache() type=', type, '| expires=', new Date(cache.expiresAt).toISOString(), '| url=', (url || '').substring(0, 50));
    localStorage.setItem('bg_img_cache', JSON.stringify(cache));
}

function clearBgCache() {
    bgLog('clearBgCache() 清除缓存元数据');
    localStorage.removeItem('bg_img_cache');
}

function isBgCacheValid(cache, bg_img) {
    if (!cache || !cache.url || !cache.expiresAt) { bgLog('isBgCacheValid() = false (字段缺失)'); return false; }
    if (cache.type !== bg_img["type"]) { bgLog('isBgCacheValid() = false (类型不匹配:', cache.type, '!==', bg_img['type'] + ')'); return false; }
    var valid = Date.now() < cache.expiresAt;
    bgLog('isBgCacheValid() =', valid, '(剩余', Math.round((cache.expiresAt - Date.now()) / 1000 / 60), '分钟)');
    return valid;
}

// ══════════════════════════════════════════════════════════════════
// 远程壁纸获取与缓存
// ══════════════════════════════════════════════════════════════════

function resolveRealBgUrl(type, fallbackUrl) {
    return new Promise(function (resolve) {
        if (type === "4" || type === "5") {
            var jsonUrl = type === "4" ? "https://t.alcy.cc/fj/?json" : "https://t.alcy.cc/mp/?json";
            fetch(jsonUrl, { cache: "no-store" })
                .then(function (res) { return res.text(); })
                .then(function (text) {
                    text = (text || "").trim();
                    if (text.indexOf("http") === 0) resolve(text);
                    else resolve(fallbackUrl);
                })
                .catch(function () { resolve(fallbackUrl); });
        } else if (type === "2") {
            var bingJson = 'https://bing.biturl.top/?resolution=1920&format=json&index=0&mkt=zh-CN';
            fetch(bingJson, { cache: "no-store" })
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (data && data.url) resolve(data.url);
                    else resolve(fallbackUrl);
                })
                .catch(function () { resolve(fallbackUrl); });
        } else {
            resolve(fallbackUrl);
        }
    });
}

function applyBgWithCache(type, url, bg_img, forceRefresh, silentMode, callback) {
    bgLog('applyBgWithCache() 入口 type=', type, '| forceRefresh=', forceRefresh, '| silent=', !!silentMode, '| cache.enabled=', bg_img['cache']);
    var cache = getBgCache();
    
    function doneCb(res) {
        if (typeof callback === 'function') callback(res);
    }

    if (!forceRefresh && bg_img["cache"] && isBgCacheValid(cache, bg_img)) {
        bgLog('applyBgWithCache() 缓存有效 → 使用缓存');
        getCachedBgData().then(function (cachedData) {
            if (cachedData) {
                bgLog('applyBgWithCache() 有 base64 缓存，直接渲染');
                if (silentMode) { bgLog('applyBgWithCache() silentMode → 跳过渲染'); doneCb(false); return; }
                applyBgNew(cachedData, false, doneCb, cache.url);
            } else {
                bgLog('applyBgWithCache() 无 base64 缓存，使用缓存 URL');
                if (silentMode) { bgLog('applyBgWithCache() silentMode → 跳过渲染'); doneCb(false); return; }
                applyBgNew(cache.url, false, doneCb, cache.url);
            }
        });
        return true;
    }

    if (!bg_img["cache"] && !forceRefresh && !silentMode) {
        bgLog('applyBgWithCache() cache关闭且非强刷非静默 → 直接 URL 渲染');
        return applyBgNew(url, false, doneCb, url);
    }

    bgLog('applyBgWithCache() 需要获取新数据，提前解析真实 URL...');
    resolveRealBgUrl(type, url).then(function (realUrl) {
        bgLog('applyBgWithCache() 目标真实地址:', realUrl);
        var fetchUrl = forceRefresh
            ? (realUrl + (realUrl.indexOf('?') >= 0 ? '&' : '?') + '_t=' + Date.now())
            : realUrl;
        fetch(fetchUrl, { method: 'GET', redirect: 'follow', cache: 'no-store' })
            .then(function (res) {
                bgLog('applyBgWithCache() fetch 响应:', res.status, '| content-type:', res.headers.get('content-type'), '| finalUrl:', res.url);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.blob().then(function (blob) {
                    bgLog('applyBgWithCache() blob 大小:', blob.size, 'bytes | type:', blob.type);
                    var reader = new FileReader();
                    return new Promise(function (resolve, reject) {
                        reader.onload = function () {
                            var dataUrl = reader.result;
                            bgLog('applyBgWithCache() FileReader 完成，dataUrl 长度:', dataUrl.length);
                            compressAndCacheDataUrl(dataUrl, function (compressed) {
                                bgLog('applyBgWithCache() compress 回调，最终长度:', (compressed || dataUrl).length);
                                resolve({ dataUrl: compressed || dataUrl, finalUrl: res.url || realUrl });
                            });
                        };
                        reader.onerror = function (e) {
                            bgLog('applyBgWithCache() FileReader 错误!', e);
                            reject(e);
                        };
                        reader.readAsDataURL(blob);
                      });
                });
            })
            .then(function (result) {
                bgLog('applyBgWithCache() 成功获取数据, dataUrl 长度:', result.dataUrl.length);
                if (bg_img["cache"]) setBgCache(type, result.finalUrl, bg_img);
                if (silentMode) { bgLog('applyBgWithCache() silentMode → 仅缓存，不渲染'); doneCb(false); return; }
                applyBgNew(result.dataUrl, forceRefresh, doneCb, result.finalUrl);
            })
            .catch(function (err) {
                bgLog('applyBgWithCache() fetch→blob 失败!', err.message || err);
                console.warn('[wallpaper cache] fetch/blob 失败，回退到真实静态 URL 模式:', err);
                if (bg_img["cache"]) setBgCache(type, realUrl, bg_img);
                if (forceRefresh) clearCachedBgData(); // 强制刷新且请求失败时，清空过期缓存以免持续兜底
                if (silentMode) { bgLog('applyBgWithCache() silentMode → 回退也跳过渲染'); doneCb(false); return; }
                getCachedBgData().then(function (base64Fallback) {
                    if (base64Fallback && !forceRefresh) {
                        bgLog('applyBgWithCache() 回退到 base64 缓存');
                        applyBgNew(base64Fallback, false, doneCb, realUrl);
                    } else {
                        bgLog('applyBgWithCache() 回退到直接 URL 加载');
                        applyBgNew(realUrl, forceRefresh, doneCb, realUrl);
                    }
                });
            });
    });
    return true;
}

// ══════════════════════════════════════════════════════════════════
// 交叉渐变切换背景
// ══════════════════════════════════════════════════════════════════

function applyBgNew(url, forceRefresh, callback, originalUrl) {
    bgLog('applyBgNew() 入口 url=', (url || '').substring(0, 80), '| forceRefresh=', forceRefresh);
    
    function doneCb(res) {
        if (typeof callback === 'function') callback(res);
    }

    if (!url) { bgLog('applyBgNew() 跳过: url 为空'); doneCb(false); return false; }
    var lastUrl = getLastBgUrl();
    var $bg = $('#bg');

    var displayUrl = url;
    if (forceRefresh && url.indexOf('data:image/') !== 0) {
        displayUrl = url + (url.indexOf('?') >= 0 ? '&' : '?') + '_t=' + Date.now();
        bgLog('applyBgNew() forceRefresh: 附加时间戳 →', displayUrl.substring(0, 80));
    }

    // 当前 DOM 已显示相同图片 → 完全跳过
    var currentDomSrc = ($bg[0] && $bg[0].src) || '';
    if (!forceRefresh && currentDomSrc === displayUrl) {
        bgLog('applyBgNew() 当前 DOM 已显示此图 → 跳过');
        doneCb(false);
        return false;
    }

    bgLog('applyBgNew() 需要渐变切换! lastUrl=', (lastUrl || '').substring(0, 60), '→ newUrl=', url.substring(0, 60), '| 当前DOM结尾=', currentDomSrc.slice(-30));
    var oldLastUrl = lastUrl;
    setLastBgUrl(originalUrl || url);

    var $bgNew = $('#bg-new');
    var newImg = new Image();
    newImg.onload = function () {
        bgLog('applyBgNew() newImg.onload 触发! naturalSize:', newImg.naturalWidth + 'x' + newImg.naturalHeight);
        var bgEl = $bg[0];
        var isFitMode = $('body').hasClass('bg-fit');
        var $bgAmbientNew = $('#bg-ambient-new');

        if (isFitMode) {
            $bgAmbientNew.css({
                backgroundImage: 'url(' + displayUrl + ')',
                display: 'block',
                opacity: 0,
                transition: 'none'
            });
        }

        var cs = bgEl ? window.getComputedStyle(bgEl) : null;
        var inheritFilter = cs ? cs.filter : 'none';
        var inheritTransform = cs ? cs.transform : 'none';
        if (inheritFilter === 'none' || inheritFilter === '') inheritFilter = '';

        $bgNew.attr('src', displayUrl).css({
            display: 'block',
            opacity: 0,
            filter: inheritFilter,
            transform: inheritTransform,
            transition: 'none'
        });
        bgLog('applyBgNew() #bg-new 就绪, filter:', inheritFilter, '| transform:', inheritTransform);

        // 强行触发布局重绘
        $bgNew[0].offsetHeight;
        if (isFitMode) $bgAmbientNew[0].offsetHeight;

        requestAnimationFrame(function () {
            $bgNew.css({
                transition: 'opacity ' + (BG_FADE_DURATION_MS / 1000) + 's ease',
                opacity: 1
            });
            if (isFitMode) {
                $bgAmbientNew.css({
                    transition: 'opacity ' + (BG_FADE_DURATION_MS / 1000) + 's ease',
                    opacity: 1
                });
            }
            bgLog('applyBgNew() 交叉渐变开始 (opacity 0→1)');
            setTimeout(function () {
                var finalSrc = $bgNew.attr('src') || displayUrl;
                $bg.attr('src', finalSrc);
                bgLog('applyBgNew() 交叉渐变完成, #bg.src =', finalSrc.substring(0, 80));
                syncAmbientBg();
                
                // 延迟隐藏 bg-new，确保 bg 的 src 已经被浏览器渲染出来，避免闪烁
                setTimeout(function () {
                    $bgNew.css({ transition: 'none', opacity: 0, display: 'none', filter: '', transform: '' });
                    if (isFitMode) {
                        $bgAmbientNew.css({ transition: 'none', opacity: 0, display: 'none' });
                    }
                    bgLog('applyBgNew() #bg-new 退场完成');
                    doneCb(true);
                }, 100);
            }, BG_FADE_DURATION_MS);
        });

        // 后台异步缓存
        cacheCurrentBgAsync(url);
    };
    newImg.onerror = function () {
        bgLog('applyBgNew() newImg.onerror! url=', displayUrl.substring(0, 80));
        console.warn('[wallpaper] 图片加载失败:', displayUrl);
        getCachedBgData().then(function (base64Fallback) {
            var fb = base64Fallback || oldLastUrl || FALLBACK_BG_URL;
            bgLog('applyBgNew() onerror fallback: base64=', !!base64Fallback, '| oldLastUrl=', (oldLastUrl || '').substring(0, 40));
            
            var nextFb = (fb !== FALLBACK_BG_URL) ? FALLBACK_BG_URL : ULTIMATE_FALLBACK;
            setWithFallback($bg, fb, nextFb);
            doneCb(false);
        });
    };
    newImg.src = displayUrl;
    bgLog('applyBgNew() 开始加载 newImg.src=', displayUrl.substring(0, 80));
    return true;
}

// 后台异步缓存已显示的图片（fetch→blob 方式，不受 CORS 限制）
function cacheCurrentBgAsync(url) {
    bgLog('cacheCurrentBgAsync() 入口 url=', (url || '').substring(0, 80));
    if (!url || url.indexOf('http') !== 0) { bgLog('cacheCurrentBgAsync() 跳过: 非 http(s) URL'); return; }
    getCachedBgData().then(function (cachedData) {
        if (cachedData) { bgLog('cacheCurrentBgAsync() 跳过: 已有 base64 缓存'); return; }
        fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.blob();
            })
            .then(function (blob) {
                bgLog('cacheCurrentBgAsync() blob:', blob.size, 'bytes');
                var reader = new FileReader();
                reader.onload = function () {
                    compressAndCacheDataUrl(reader.result, function (compressed) {
                        bgLog('cacheCurrentBgAsync() 缓存完成, 长度:', (compressed || reader.result).length);
                    });
                };
                reader.onerror = function () { bgLog('cacheCurrentBgAsync() FileReader 失败'); };
                reader.readAsDataURL(blob);
            })
            .catch(function (err) {
                bgLog('cacheCurrentBgAsync() fetch 失败 (可能 CORS 受限):', err.message || err);
            });
    });
}

// ══════════════════════════════════════════════════════════════════
// 刷新背景（右上角按钮调用）
// ══════════════════════════════════════════════════════════════════

var isRefreshingBg = false;

function refreshBg() {
    if (isRefreshingBg) {
        bgLog('refreshBg() 正在刷新中，忽略点击');
        return;
    }
    isRefreshingBg = true;
    
    var $btn = $("#bg-refresh");
    var $icon = $btn.find('.refresh-icon, i');
    if ($icon.length === 0) $icon = $btn;
    $icon.css('animation', 'spin-continuous 1s linear infinite');
    
    function done() {
        isRefreshingBg = false;
        $icon.css('animation', '');
        bgLog('refreshBg() 刷新流程完成');
    }

    var bg_img = getBgImg();
    var currentType = bg_img["type"];
    bgLog('refreshBg() 手动刷新! type=', currentType);
    switch (currentType) {
        case "1":
            var lastBg = getLastBgUrl();
            var rd = Math.floor(Math.random() * DEFAULT_BG_LIST.length);
            if (DEFAULT_BG_LIST.length > 1) {
                var tries = 0;
                while (DEFAULT_BG_LIST[rd] === lastBg && tries < DEFAULT_BG_LIST.length) {
                    rd = Math.floor(Math.random() * DEFAULT_BG_LIST.length);
                    tries++;
                }
            }
            applyBgNew(DEFAULT_BG_LIST[rd], true, done);
            break;
        case "2":
        case "3":
        case "4":
        case "5":
            var baseUrls = {
                "2": 'https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN',
                "3": 'https://picsum.photos/1920/1080',
                "4": 'https://t.mwm.moe/fj',
                "5": 'https://t.mwm.moe/mp',
            };
            applyBgWithCache(currentType, baseUrls[currentType], bg_img, true, false, done);
            break;
        case "6":
            if (bg_img["path"]) {
                var finalUrl = buildBgUrl(bg_img["path"], getBgApiKey());
                applyBgWithCache("6", finalUrl, bg_img, true, false, done);
            } else {
                done(); 
            }
            break;
        default:
            done();
            break;
    }
}

// ══════════════════════════════════════════════════════════════════
// 比例自适应（ambient mode）
// ══════════════════════════════════════════════════════════════════

function applyFitMode(enabled) {
    var $body = $('body');
    var $ambient = $('#bg-ambient');
    var $ambientNew = $('#bg-ambient-new');
    var $bg = $('#bg');
    if (enabled) {
        $body.addClass('bg-fit');
        var bgSrc = ($bg[0] && $bg[0].src) || '';
        if (bgSrc && bgSrc.indexOf('data:image/gif;base64,R0lGODlh') === -1) {
            $ambient.css({ backgroundImage: 'url(' + bgSrc + ')', display: 'block', opacity: 1 });
        }
    } else {
        $body.removeClass('bg-fit');
        $ambient.css({ opacity: 0 });
        $ambientNew.css({ opacity: 0 });
        setTimeout(function () { 
            $ambient.css({ display: 'none', backgroundImage: 'none' });
            $ambientNew.css({ display: 'none', backgroundImage: 'none' });
        }, 1000);
    }
}

function syncAmbientBg() {
    if (!$('body').hasClass('bg-fit')) return;
    var bgSrc = ($('#bg')[0] && $('#bg')[0].src) || '';
    if (!bgSrc || bgSrc.indexOf('data:image/gif;base64,R0lGODlh') === -1) {
        $('#bg-ambient').css({ backgroundImage: 'url(' + bgSrc + ')', display: 'block', opacity: 1 });
    }
}

// ══════════════════════════════════════════════════════════════════
// 核心初始化：两阶段加载壁纸
// ══════════════════════════════════════════════════════════════════

function setBgImgInit() {
    var bg_img = getBgImg();
    bgLog('══════════ setBgImgInit() 开始 ══════════');
    bgLog('  bg_img.type=', bg_img['type'], '| refreshOnLoad=', bg_img['refreshOnLoad'], '| cache=', bg_img['cache'], '| cacheDuration=', bg_img['cacheDuration']);

    getCachedBgData().then(function (cachedData) {
        var lastUrl = getLastBgUrl();
        var bgEl = document.getElementById('bg');
        bgLog('  Phase1: cachedData=', cachedData ? ('存在, 长度=' + cachedData.length) : '(无)', '| lastUrl=', (lastUrl || '(无)').substring(0, 60), '| bgEl=', !!bgEl);

        // Determine Phase 1 initUrl
        // If we have base64 cachedData, load it.
        // Otherwise, if we have a static lastUrl (not a random API redirector), load it instantly.
        // Otherwise, fallback to the local default wallpaper.
        var initUrl = cachedData;
        if (!initUrl) {
            if (lastUrl && typeof lastUrl === 'string' && !isRandomApiUrl(lastUrl)) {
                bgLog('  Phase1: 使用上一次加载的静态URL:', lastUrl);
                initUrl = lastUrl;
            } else {
                bgLog('  Phase1: 无可用静态缓存 -> 使用本地默认兜底图');
                initUrl = FALLBACK_BG_URL;
            }
        }
        
        bgLog('  Phase1: initUrl =', initUrl.substring(0, 80), '| 来源:', cachedData ? 'base64缓存' : (initUrl === FALLBACK_BG_URL ? '本地兜底图' : '上一次静态 URL'));

        function doReveal() {
            bgLog('  Phase1: doReveal() 被调用!');
            if (typeof _revealFallbackTimer !== 'undefined') {
                clearTimeout(_revealFallbackTimer);
                bgLog('  Phase1: 已取消 fallback 定时器');
            }
            if (typeof revealPage === 'function') {
                bgLog('  Phase1: 调用 revealPage()');
                revealPage();
            }
        }

        if (bgEl && initUrl) {
            var fb1 = (initUrl === FALLBACK_BG_URL) ? null : FALLBACK_BG_URL;
            bgEl.onerror = function () {
                bgLog('  Phase1: bgEl.onerror! src=', (bgEl.src || '').substring(0, 80));
                bgEl.onerror = null;
                setWithFallback($('#bg'), fb1 || ULTIMATE_FALLBACK, ULTIMATE_FALLBACK);
            };
            bgEl.src = initUrl;
            bgLog('  Phase1: 设置 bgEl.src =', initUrl.substring(0, 80));
            var revealed = false;
            var revealOnce = function () {
                if (!revealed) { revealed = true; doReveal(); }
            };
            var decodeTimeout = setTimeout(function () {
                bgLog('  Phase1: decode 超时 (300ms) → 强制揭幕');
                revealOnce();
            }, 300);
            var decodePromise = bgEl.decode ? bgEl.decode() : Promise.resolve();
            decodePromise.then(function () {
                bgLog('  Phase1: decode 成功 → 揭幕');
                clearTimeout(decodeTimeout);
                revealOnce();
            }).catch(function () {
                bgLog('  Phase1: decode 失败 → 揭幕');
                clearTimeout(decodeTimeout);
                revealOnce();
            });
        } else {
            bgLog('  Phase1: bgEl 或 initUrl 无效 → 直接揭幕');
            doReveal();
        }

        if (!lastUrl) {
            bgLog('  Phase1: 首次访问 (无 lastUrl) → 保存 initUrl 为 lastUrl');
            setLastBgUrl(initUrl);
        }

        // ── UI 状态恢复 ─────────────────────────────────
        $("input[name='wallpaper-type'][value=" + bg_img["type"] + "]").prop("checked", true);
        var descriptions = {
            "1": "显示默认壁纸，刷新页面以生效",
            "2": "显示必应每日一图，每天更新，刷新页面以生效 | API @ Bing",
            "3": "显示随机风景照片，每次刷新更换，刷新页面以生效 | API @ Lorem Picsum",
            "4": "显示随机二次元图片，每次刷新更换，刷新页面以生效 | API @ 樱花",
            "5": "显示随机猫咪照片，治愈系壁纸，刷新页面以生效 | API @ 樱花",
            "6": "使用自定义图片 URL，请在下方填入地址后保存"
        };
        $('#wallpaper_text').html(descriptions[bg_img["type"]] || "");
        if (bg_img["type"] === "6") {
            $("#wallpaper-url").val(bg_img["path"]);
            if (getBgApiKey()) {
                $("#wallpaper-apikey").attr("placeholder", "API 密钥已保存（输入新值以更新）");
            }
            $("#wallpaper_url").fadeIn(100);
        } else {
            $("#wallpaper_url").fadeOut(300);
        }
        $("#wallpaper-refresh-enable").prop("checked", bg_img["refreshOnLoad"] === true);
        var cacheEnabled = bg_img["cache"] === true;
        $("#wallpaper-cache-enable").prop("checked", cacheEnabled);
        if (cacheEnabled) {
            $("#wallpaper-cache-hours").val(bg_img["cacheDuration"] || CACHE_DURATION_DEFAULT);
            $("#wallpaper_cache_duration").show();
            $("#wallpaper_cache_save_row").show();
        }
        var fitEnabled = bg_img["bg_fit"] === true;
        $("#wallpaper-fit-enable").prop("checked", fitEnabled);
        applyFitMode(fitEnabled);

        // ── 判断是否需要获取新壁纸 ──────────────────────
        var lastType = getLastBgType();
        var currentType = bg_img["type"];
        var typeChanged = (lastType && lastType !== currentType);
        var refreshOnLoad = !!bg_img["refreshOnLoad"];
        var noLastImg = !lastUrl;
        var needNewBg = typeChanged || refreshOnLoad || noLastImg;
        bgLog('  Phase2: lastType=', lastType, '| currentType=', currentType, '| typeChanged=', typeChanged, '| refreshOnLoad=', refreshOnLoad, '| noLastImg=', noLastImg, '| needNewBg=', needNewBg);

        if (!needNewBg) {
            bgLog('  Phase2: 无需更换壁纸 → 显示上次缓存的真实壁纸');
            setLastBgType(currentType);
            if (cachedData) {
                bgLog('  Phase2: 交叉渐变到 base64 缓存');
                applyBgNew(cachedData, false, null, lastUrl);
            } else if (lastUrl && lastUrl.indexOf('http') === 0) {
                bgLog('  Phase2: fetch API 并交叉渐变显示');
                applyBgWithCache(currentType, lastUrl, bg_img, false, false);
            } else if (lastUrl) {
                bgLog('  Phase2: 交叉渐变到本地文件');
                applyBgNew(lastUrl, false, null, lastUrl);
            }
            return;
        }

        setLastBgType(currentType);
        bgLog('  Phase2: 需要更换壁纸! 原因:', typeChanged ? '来源变更' : '', refreshOnLoad ? '强刷' : '', noLastImg ? '首次访问' : '');
        var deferredSwitch = function () {
            bgLog('  Phase2: deferredSwitch 执行! type=', currentType);
            switch (currentType) {
                case "1":
                    var cache1 = getBgCache();
                    if (!refreshOnLoad && bg_img["cache"] && isBgCacheValid(cache1, bg_img)) {
                        applyBgNew(cache1.url, false, null, cache1.url);
                    } else {
                        var lastBg = getLastBgUrl();
                        var rd = Math.floor(Math.random() * DEFAULT_BG_LIST.length);
                        if (refreshOnLoad && DEFAULT_BG_LIST.length > 1) {
                            var tries = 0;
                            while (DEFAULT_BG_LIST[rd] === lastBg && tries < DEFAULT_BG_LIST.length) {
                                rd = Math.floor(Math.random() * DEFAULT_BG_LIST.length);
                                tries++;
                            }
                        }
                        var picUrl = DEFAULT_BG_LIST[rd];
                        if (bg_img["cache"] && !refreshOnLoad) setBgCache("1", picUrl, bg_img);
                        applyBgNew(picUrl, refreshOnLoad, null, picUrl);
                    }
                    break;
                case "2":
                case "3":
                case "4":
                case "5":
                    var baseUrls = {
                        "2": 'https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN',
                        "3": 'https://picsum.photos/1920/1080',
                        "4": 'https://t.mwm.moe/fj',
                        "5": 'https://t.mwm.moe/mp',
                    };
                    applyBgWithCache(currentType, baseUrls[currentType], bg_img, refreshOnLoad);
                    break;
                case "6":
                    if (bg_img["path"]) {
                        var finalUrl = buildBgUrl(bg_img["path"], getBgApiKey());
                        applyBgWithCache("6", finalUrl, bg_img, refreshOnLoad);
                    }
                    break;
            }
        };

        if (refreshOnLoad || noLastImg) {
            bgLog('  Phase2: 延迟 300ms 后执行切换');
            setTimeout(deferredSwitch, 300);
        } else if (typeChanged) {
            bgLog('  Phase2: 延迟 100ms 后执行切换 (来源变更)');
            setTimeout(deferredSwitch, 100);
        }
        bgLog('══════════ setBgImgInit() 结束 ══════════');
    });
}

// ══════════════════════════════════════════════════════════════════
// 模块初始化：绑定事件 + 启动壁纸加载
// ══════════════════════════════════════════════════════════════════

$(function () {
    // 刷新背景按钮
    $("#bg-refresh").click(function () {
        refreshBg();
    });

    // 窗口尺寸变化时同步 ambient 背景
    var _ambientResizeTimer = null;
    $(window).on('resize', function () {
        clearTimeout(_ambientResizeTimer);
        _ambientResizeTimer = setTimeout(syncAmbientBg, 200);
    });

    // 壁纸核心初始化
    setBgImgInit();
});
