/*
作者:D.Young
主页：https://yyv.me/
github：https://github.com/5iux/sou
日期：2019-07-26
版权所有，请勿删除
========================================
由 yeetime 修改
github：https://github.com/yeetime/sou2
日期：2019-12-13
========================================
由 imsyy 二次修改
github：https://github.com/imsyy/sou2
日期：2022-03-10
*/

// HTML 转义工具函数，防止 XSS
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

// URL 验证函数
function isValidUrl(str) {
    try {
        var url = new URL(str);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch (e) {
        return false;
    }
}

// ============================================
// 存储层：localStorage 优先，自动迁移旧 Cookie 数据
// ============================================
var Storage = {
    get: function (key) {
        var val = localStorage.getItem(key);
        if (val !== null) return val;
        // 兼容迁移：若 localStorage 无数据则尝试从 Cookie 读取
        var cookieVal = Cookies.get(key);
        if (cookieVal !== undefined) {
            localStorage.setItem(key, cookieVal);
            Cookies.remove(key);
            return cookieVal;
        }
        return null;
    },
    set: function (key, value) {
        if (typeof value === 'object') {
            value = JSON.stringify(value);
        }
        localStorage.setItem(key, value);
        // 清理同名旧 Cookie
        if (Cookies.get(key) !== undefined) {
            Cookies.remove(key);
        }
    },
    remove: function (key) {
        localStorage.removeItem(key);
        Cookies.remove(key);
    },
    getAll: function () {
        var result = {};
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            result[key] = localStorage.getItem(key);
        }
        return result;
    }
};

// 默认搜索引擎列表
var se_list_preinstall = {
    '1': {
        id: 1,
        title: "百度",
        url: "https://www.baidu.com/s",
        name: "wd",
        icon: "iconfont icon-baidu",
    },
    '2': {
        id: 2,
        title: "必应",
        url: "https://cn.bing.com/search",
        name: "q",
        icon: "iconfont icon-bing",
    },
    '3': {
        id: 3,
        title: "谷歌",
        url: "https://www.google.com/search",
        name: "q",
        icon: "iconfont icon-google",
    }
};

// 默认快捷方式
var quick_list_preinstall = {
    '1': {
        title: "哔哩哔哩",
        url: "https://www.bilibili.com/",
    },
    '2': {
        title: "Office",
        url: "https://www.office.com/",
    },
    '3': {
        title: "Main Page",
        url: "https://littlegaofx.github.io/Self/",
    },
    '4': {
        title: "Edge Surf",
        url: "https://littlegaofx.github.io/Surf/",
    },
    '5': {
        title: "New Concept Game",
        url: "https://littlegaofx.github.io/Game/",
    }
};

// 获取搜索引擎列表
function getSeList() {
    var se_list_local = Storage.get('se_list');
    if (se_list_local !== "{}" && se_list_local) {
        try {
            return JSON.parse(se_list_local);
        } catch (e) {
            console.warn('se_list 数据损坏，已重置:', e);
            Storage.remove('se_list');
        }
    }
    setSeList(se_list_preinstall);
    return se_list_preinstall;
}

// 设置搜索引擎列表
function setSeList(se_list) {
    if (se_list) {
        Storage.set('se_list', se_list);
        return true;
    }
    return false;
}

// 获得默认搜索引擎
function getSeDefault() {
    var se_default = Storage.get('se_default');
    return se_default ? se_default : "1";
}

//背景图片
var bg_img_preinstall = {
    "type": "1", // 1~5:内置源 6:自定义URL
    "path": "",  // 自定义图片 URL 模板（可含 {key} 占位符）
    "cache": false,       // 是否缓存壁纸
    "cacheDuration": 24,  // 缓存时长（小时）
    "bg_fit": false,      // 比例自适应：完整显示图片，模糊填充边缘
};

// API 密钥存储键（存储于 localStorage，持久保存）
var BG_APIKEY_SESSION_KEY = 'bg_apikey';
// 上次显示的背景图片 URL（用于下次访问时立即展示）
var BG_LAST_URL_KEY = 'bg_last_url';
// 上次使用的壁纸来源类型（用于判断是否切换了来源）
var BG_LAST_TYPE_KEY = 'bg_last_type';
// 壁纸图片的 base64 数据缓存（确保下次访问即时显示，无需网络请求）
var BG_IMG_DATA_KEY = 'bg_img_data';
// base64 缓存的最大尺寸限制（约 2MB 的 base64 字符串，对应约 1.5MB 原始图片）
var BG_IMG_DATA_MAX = 60000000;
// 缓存时长限制（小时）
var CACHE_DURATION_DEFAULT = 24;
var CACHE_DURATION_MAX = 720;
// 背景渐变过渡时长（毫秒，与 CSS 中 #bg-new 的 transition 时长保持一致）
var BG_FADE_DURATION_MS = 1500;
// 页面揭幕动画时长（毫秒，与 revealPage 中 transition: ease 1.5s 保持一致）
var REVEAL_DURATION_MS = 1500;

// ── 调试日志 ────────────────────────────────────────────────────
// 设为 true 启用详细日志；或通过浏览器控制台执行 localStorage.setItem('bg_debug','1') 后刷新
var BG_DEBUG = (function () {
    try { return localStorage.getItem('bg_debug') === '1'; } catch (e) { return true; }
})();
function bgLog() {
    if (!BG_DEBUG) return;
    var args = Array.prototype.slice.call(arguments);
    args[0] = '[bg:' + (performance.now ? performance.now().toFixed(0) : '0') + 'ms] ' + args[0];
    console.log.apply(console, args);
}

// 获取背景图片
function getBgImg() {
    var bg_img_local = Storage.get('bg_img');
    if (bg_img_local && bg_img_local !== "{}") {
        try {
            return JSON.parse(bg_img_local);
        } catch (e) {
            console.warn('bg_img 数据损坏，已重置:', e);
            Storage.remove('bg_img');
        }
    }
    setBgImg(bg_img_preinstall);
    return bg_img_preinstall;
}

// 设置背景图片
function setBgImg(bg_img) {
    if (bg_img) {
        Storage.set('bg_img', bg_img);
        return true;
    }
    return false;
}

// 获取/保存/清除 API 密钥（存于 localStorage，持久保存）
// 注意：localStorage 为明文存储，适用于个人使用场景；如需更高安全性请勿在公共设备上使用
function getBgApiKey() {
    return localStorage.getItem(BG_APIKEY_SESSION_KEY) || '';
}
function setBgApiKey(key) {
    if (key) {
        localStorage.setItem(BG_APIKEY_SESSION_KEY, key);
    }
}
function clearBgApiKey() {
    localStorage.removeItem(BG_APIKEY_SESSION_KEY);
}

// 获取/保存上次显示的背景图片 URL
function getLastBgUrl() {
    var v = localStorage.getItem(BG_LAST_URL_KEY) || '';
    bgLog('getLastBgUrl() =', (v ? v.substring(0, 80) + (v.length > 80 ? '...' : '') : '(空)'));
    return v;
}
function setLastBgUrl(url) {
    if (url) {
        bgLog('setLastBgUrl() 写入:', url.substring(0, 80) + (url.length > 80 ? '...' : ''));
        localStorage.setItem(BG_LAST_URL_KEY, url);
    }
}

// 获取/保存上次使用的壁纸来源类型
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

// 获取缓存的壁纸 base64 数据（用于即时显示，无需网络）
function getCachedBgData() {
    try {
        var raw = localStorage.getItem(BG_IMG_DATA_KEY);
        if (!raw) { bgLog('getCachedBgData() = null (localStorage 中无数据)'); return null; }
        if (raw.indexOf('data:image/') !== 0) { bgLog('getCachedBgData() = null (非有效 data URL, 前20字符:', raw.substring(0,20)+')'); return null; }
        bgLog('getCachedBgData() 命中! 长度:', raw.length, 'chars, 开头:', raw.substring(0,50)+'...');
        return raw;
    } catch (e) {
        bgLog('getCachedBgData() 异常:', e);
        return null;
    }
}

// 保存壁纸 base64 数据到 localStorage
function setCachedBgData(dataUrl) {
    if (!dataUrl || dataUrl.indexOf('data:image/') !== 0) {
        bgLog('setCachedBgData() 跳过 (无效 data URL)');
        return;
    }
    if (dataUrl.length > BG_IMG_DATA_MAX) {
        bgLog('setCachedBgData() 跳过 (过大:', (dataUrl.length/1000000).toFixed(1), 'MB > 限制', (BG_IMG_DATA_MAX/1000000).toFixed(0), 'MB)');
        console.warn('[bg cache] base64 数据过大，跳过缓存 (' + (dataUrl.length / 1000000).toFixed(1) + 'MB)');
        return;
    }
    try {
        localStorage.setItem(BG_IMG_DATA_KEY, dataUrl);
        bgLog('setCachedBgData() 成功! 长度:', dataUrl.length, 'chars (', (dataUrl.length/1000000).toFixed(2), 'MB)');
    } catch (e) {
        bgLog('setCachedBgData() 写入失败:', e.message, '| 清理后重试...');
        console.warn('[bg cache] 保存 base64 失败，清理后重试:', e);
        try { localStorage.removeItem(BG_IMG_DATA_KEY); } catch (e2) {}
    }
}

// 清除壁纸 base64 缓存
function clearCachedBgData() {
    bgLog('clearCachedBgData() 清除 base64 缓存');
    try { localStorage.removeItem(BG_IMG_DATA_KEY); } catch (e) {}
}

// 将已加载的 Image 对象转为 base64 data URL（Canvas 压缩）
function imageToBase64(img) {
    try {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        bgLog('imageToBase64() 原始尺寸:', w+'x'+h);
        if (!w || !h) { bgLog('imageToBase64() 失败: 尺寸无效'); return null; }
        var canvas = document.createElement('canvas');
        var maxW = 1920;
        var scale = Math.min(1, maxW / w);
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        bgLog('imageToBase64() Canvas:', canvas.width+'x'+canvas.height, '(scale:', scale.toFixed(2)+')');
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

// 将 data URL 压缩后存入缓存（通过 Canvas resize + JPEG 编码）
function compressAndCacheDataUrl(dataUrl, callback) {
    bgLog('compressAndCacheDataUrl() 输入长度:', dataUrl.length, 'chars');
    var img = new Image();
    img.onload = function () {
        var compressed = imageToBase64(img);
        if (compressed) {
            bgLog('compressAndCacheDataUrl() 压缩成功，调用 setCachedBgData');
            setCachedBgData(compressed);
        } else {
            bgLog('compressAndCacheDataUrl() 压缩失败，使用原始数据');
        }
        callback(compressed || dataUrl);
    };
    img.onerror = function () {
        bgLog('compressAndCacheDataUrl() 图片解码失败，尝试存原始数据');
        if (dataUrl.length <= BG_IMG_DATA_MAX) setCachedBgData(dataUrl);
        callback(dataUrl);
    };
    img.src = dataUrl;
}

// 设置图片 src，失败时逐级回退：url → nextFallback → ... → 终极兜底
function setWithFallback($img, url, nextFallback) {
    bgLog('setWithFallback() url=', (url||'').substring(0,60), '| next=', (nextFallback||'').substring(0,60));
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
        bgLog('setWithFallback() 图片加载失败! url=', url.substring(0,60), '→ 回退');
        if (fallback && fallback !== url) {
            setWithFallback($img, fallback, ULTIMATE_FALLBACK);
        } else {
            bgLog('setWithFallback() 到达终极兜底');
            $img.attr('src', ULTIMATE_FALLBACK);
        }
        $img[0].onerror = oldError;
    };
    $img.attr('src', url);
}

// 根据 bg_img 配置构建最终壁纸 URL（替换 {key} 占位符）
function buildBgUrl(template, apiKey) {
    var url = template || '';
    if (apiKey && url.indexOf('{key}') !== -1) {
        url = url.replace(/\{key\}/g, encodeURIComponent(apiKey));
    }
    return url;
}

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
    bgLog('setBgCache() type=', type, '| expires=', new Date(cache.expiresAt).toISOString(), '| url=', (url||'').substring(0,50));
    localStorage.setItem('bg_img_cache', JSON.stringify(cache));
}

function clearBgCache() {
    bgLog('clearBgCache() 清除缓存元数据');
    localStorage.removeItem('bg_img_cache');
}

function isBgCacheValid(cache, bg_img) {
    if (!cache || !cache.url || !cache.expiresAt) { bgLog('isBgCacheValid() = false (字段缺失)'); return false; }
    if (cache.type !== bg_img["type"]) { bgLog('isBgCacheValid() = false (类型不匹配:', cache.type, '!==', bg_img['type']+')'); return false; }
    var valid = Date.now() < cache.expiresAt;
    bgLog('isBgCacheValid() =', valid, '(剩余', Math.round((cache.expiresAt - Date.now())/1000/60), '分钟)');
    return valid;
}

// 尝试通过 fetch 获取壁纸图片的实际数据并缓存为 base64，然后渲染
// 这确保 API 返回的直接图像数据被保存到本地，下次加载即时显示
// 返回 true 表示执行了切换操作
function resolveRealBgUrl(type, fallbackUrl) {
    return new Promise(function(resolve) {
        if (type === "4" || type === "5") {
            var jsonUrl = type === "4" ? "https://t.alcy.cc/fj/?json" : "https://t.alcy.cc/mp/?json";
            fetch(jsonUrl, { cache: "no-store" })
                .then(function(res) { return res.text(); })
                .then(function(text) {
                    text = (text || "").trim();
                    if (text.indexOf("http") === 0) resolve(text);
                    else resolve(fallbackUrl);
                })
                .catch(function() { resolve(fallbackUrl); });
        } else if (type === "2") {
            var bingJson = 'https://bing.biturl.top/?resolution=1920&format=json&index=0&mkt=zh-CN';
            fetch(bingJson, { cache: "no-store" })
                .then(function(res) { return res.json(); })
                .then(function(data) {
                    if (data && data.url) resolve(data.url);
                    else resolve(fallbackUrl);
                })
                .catch(function() { resolve(fallbackUrl); });
        } else {
            resolve(fallbackUrl);
        }
    });
}

function applyBgWithCache(type, url, bg_img, forceRefresh, silentMode) {
    bgLog('applyBgWithCache() 入口 type=', type, '| forceRefresh=', forceRefresh, '| silent=', !!silentMode, '| cache.enabled=', bg_img['cache']);
    var cache = getBgCache();
    if (!forceRefresh && bg_img["cache"] && isBgCacheValid(cache, bg_img)) {
        bgLog('applyBgWithCache() 缓存有效 → 使用缓存');
        var cachedData = getCachedBgData();
        if (cachedData) {
            bgLog('applyBgWithCache() 有 base64 缓存，直接渲染');
            if (silentMode) { bgLog('applyBgWithCache() silentMode → 跳过渲染'); return false; }
            return applyBgNew(cachedData, false);
        }
        bgLog('applyBgWithCache() 无 base64 缓存，使用缓存 URL');
        if (silentMode) { bgLog('applyBgWithCache() silentMode → 跳过渲染'); return false; }
        return applyBgNew(cache.url, false);
    }

    if (!bg_img["cache"] && !forceRefresh && !silentMode) {
        bgLog('applyBgWithCache() cache关闭且非强刷非静默 → 直接 URL 渲染');
        return applyBgNew(url, false);
    }

    bgLog('applyBgWithCache() 需要获取新数据，提前解析真实 URL...');
    resolveRealBgUrl(type, url).then(function(realUrl) {
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
                            bgLog('applyBgWithCache() compress 回调，最终长度:', (compressed||dataUrl).length);
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
            if (silentMode) { bgLog('applyBgWithCache() silentMode → 仅缓存，不渲染'); return; }
            applyBgNew(result.dataUrl, forceRefresh);
        })
        .catch(function (err) {
            bgLog('applyBgWithCache() fetch→blob 失败!', err.message || err, '| 存在 base64?', !!getCachedBgData());
            console.warn('[wallpaper cache] fetch/blob 失败，回退到真实静态 URL 模式:', err);
            if (bg_img["cache"]) setBgCache(type, realUrl, bg_img);
            if (silentMode) { bgLog('applyBgWithCache() silentMode → 回退也跳过渲染'); return; }
            var base64Fallback = getCachedBgData();
            if (base64Fallback && !forceRefresh) {
                bgLog('applyBgWithCache() 回退到 base64 缓存');
                applyBgNew(base64Fallback, false);
            } else {
                bgLog('applyBgWithCache() 回退到直接 URL 加载');
                applyBgNew(realUrl, forceRefresh);
            }
        });
    });
    return true;
}

// 切换到新背景图片，若已有上次图片则渐变过渡
// forceRefresh=true 时附加时间戳强制绕过浏览器图片缓存（适用于 refreshOnLoad 场景）
// 返回 true 表示执行了切换，false 表示无需切换（URL 相同）
function applyBgNew(url, forceRefresh) {
    bgLog('applyBgNew() 入口 url=', (url||'').substring(0,80), '| forceRefresh=', forceRefresh);
    if (!url) { bgLog('applyBgNew() 跳过: url 为空'); return false; }
    var lastUrl = getLastBgUrl();
    var $bg = $('#bg');

    var displayUrl = url;
    if (forceRefresh) {
        displayUrl = url + (url.indexOf('?') >= 0 ? '&' : '?') + '_t=' + Date.now();
        bgLog('applyBgNew() forceRefresh: 附加时间戳 →', displayUrl.substring(0,80));
    }

    // ── 当前 DOM 已显示相同图片 → 完全跳过 ──────────────────────
    var currentDomSrc = ($bg[0] && $bg[0].src) || '';
    if (!forceRefresh && currentDomSrc === displayUrl) {
        bgLog('applyBgNew() 当前 DOM 已显示此图 → 跳过');
        return false;
    }

    // ── 需要渐变切换 ────────────────────────────────────────────
    // 所有其他情况一律走交叉渐变，不再做"同图直接设"优化
    // （因为 Phase1 可能显示了兜底图，即使 lastUrl===url 也需要渐变过渡）
    bgLog('applyBgNew() 需要渐变切换! lastUrl=', (lastUrl||'').substring(0,60), '→ newUrl=', url.substring(0,60), '| 当前DOM结尾=', currentDomSrc.slice(-30));
    var oldLastUrl = lastUrl;
    setLastBgUrl(url);

    var $bgNew = $('#bg-new');
    var newImg = new Image();
    // 不设置 crossOrigin —— 确保 CORS 受限的 API（如 t.mwm.moe）也能正常加载显示
    // base64 缓存由 cacheCurrentBgAsync 通过 fetch→blob 方式独立尝试
    newImg.onload = function () {
        bgLog('applyBgNew() newImg.onload 触发! naturalSize:', newImg.naturalWidth+'x'+newImg.naturalHeight);
        var bgEl = $bg[0];
        
        if ($('body').hasClass('bg-fit')) {
            $('#bg-ambient').css({ backgroundImage: 'url(' + displayUrl + ')', display: 'block', opacity: 1 });
        }

        var cs = bgEl ? window.getComputedStyle(bgEl) : null;
        var inheritFilter    = cs ? cs.filter    : 'none';
        var inheritTransform = cs ? cs.transform : 'none';
        if (inheritFilter === 'none' || inheritFilter === '') inheritFilter = '';

        $bgNew.attr('src', displayUrl).css({
            display:   'block',
            opacity:   0,
            filter:    inheritFilter,
            transform: inheritTransform,
            transition: 'none'
        });
        bgLog('applyBgNew() #bg-new 就绪, filter:', inheritFilter, '| transform:', inheritTransform);

        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                $bgNew.css({
                    transition: 'opacity ' + (BG_FADE_DURATION_MS / 1000) + 's ease',
                    opacity: 1
                });
                bgLog('applyBgNew() 交叉渐变开始 (opacity 0→1)');
                setTimeout(function () {
                    // 用 #bg-new 的实际加载结果 src（重定向后的最终 URL）
                    // 避免重新请求 API 端点导致拿到另一张不同的图
                    var finalSrc = $bgNew.attr('src') || displayUrl;
                    $bg.attr('src', finalSrc);
                    bgLog('applyBgNew() 交叉渐变完成, #bg.src =', finalSrc.substring(0,80));
                    syncAmbientBg();
                    $bgNew.css({ transition: 'opacity 0.3s ease', opacity: 0 });
                    setTimeout(function () {
                        $bgNew.css({ display: 'none', filter: '', transform: '' });
                        bgLog('applyBgNew() #bg-new 退场完成');
                    }, 350);
                }, BG_FADE_DURATION_MS);
            });
        });

        // 尝试保存 base64 缓存（用 fetch→blob 方式，不受 CORS 限制）
        cacheCurrentBgAsync(url);
    };
    newImg.onerror = function () {
        bgLog('applyBgNew() newImg.onerror! url=', displayUrl.substring(0,80));
        console.warn('[wallpaper] 图片加载失败:', displayUrl);
        // 优先回退到 base64 缓存（如果有的话），其次 oldLastUrl，最后本地兜底
        var base64Fallback = getCachedBgData();
        var fb = base64Fallback || oldLastUrl || FALLBACK_BG_URL;
        bgLog('applyBgNew() onerror fallback: base64=', !!base64Fallback, '| oldLastUrl=', (oldLastUrl||'').substring(0,40));
        setWithFallback($bg, fb, ULTIMATE_FALLBACK);
    };
    newImg.src = displayUrl;
    bgLog('applyBgNew() 开始加载 newImg.src=', displayUrl.substring(0,80));
    return true;
}

// 通过 fetch→blob→FileReader 异步缓存图片为 base64（用于已显示的图片后台缓存）
// 与 cacheCurrentBgAsync 不同，此方法不依赖 CORS，能处理大多数 API
function cacheCurrentBgAsync(url) {
    bgLog('cacheCurrentBgAsync() 入口 url=', (url||'').substring(0,80));
    if (!url || url.indexOf('http') !== 0) { bgLog('cacheCurrentBgAsync() 跳过: 非 http(s) URL'); return; }
    // 避免重复缓存已存在的 base64
    if (getCachedBgData()) { bgLog('cacheCurrentBgAsync() 跳过: 已有 base64 缓存'); return; }
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
                    bgLog('cacheCurrentBgAsync() 缓存完成, 长度:', (compressed||reader.result).length);
                });
            };
            reader.onerror = function () { bgLog('cacheCurrentBgAsync() FileReader 失败'); };
            reader.readAsDataURL(blob);
        })
        .catch(function (err) {
            bgLog('cacheCurrentBgAsync() fetch 失败 (可能 CORS 受限):', err.message || err);
            // CORS 受限的 API 无法通过 JS 获取图像数据，缓存跳过但显示不受影响
        });
}

// 默认壁纸图片列表（type=1 的内置源）
var DEFAULT_BG_LIST = [
    './img/background1.webp', './img/background2.webp', './img/background3.webp',
    './img/background4.webp', './img/background5.webp', './img/background6.webp',
    './img/background7.webp', './img/background8.webp', './img/background9.webp',
    './img/background10.webp'
];
// 默认兜底壁纸（确保首次访问也不会灰屏）
var FALLBACK_BG_URL = './img/background1.webp';
// 终极兜底：1x1 灰色 SVG（当所有本地图片都不可用时使用）
var ULTIMATE_FALLBACK = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">' +
    '<rect width="1920" height="1080" fill="#2a2a2a"/></svg>'
);

// 手动刷新背景（右上角刷新按钮调用）
function refreshBg() {
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
            applyBgNew(DEFAULT_BG_LIST[rd], true);
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
            applyBgWithCache(currentType, baseUrls[currentType], bg_img, true);
            break;
        case "6":
            if (bg_img["path"]) {
                var finalUrl = buildBgUrl(bg_img["path"], getBgApiKey());
                applyBgWithCache("6", finalUrl, bg_img, true);
            }
            break;
    }
}

// 比例自适应：完整显示图片 + 模糊边缘填充（ambient mode）
function applyFitMode(enabled) {
    var $body = $('body');
    var $ambient = $('#bg-ambient');
    var $bg = $('#bg');
    if (enabled) {
        $body.addClass('bg-fit');
        // 用当前 #bg 的图片作为模糊背景
        var bgSrc = ($bg[0] && $bg[0].src) || '';
        if (bgSrc && bgSrc.indexOf('data:image/gif;base64,R0lGODlh') === -1) {
            $ambient.css({ backgroundImage: 'url(' + bgSrc + ')', display: 'block', opacity: 1 });
        }
    } else {
        $body.removeClass('bg-fit');
        $ambient.css({ opacity: 0 });
        setTimeout(function () { $ambient.css({ display: 'none', backgroundImage: 'none' }); }, 1000);
    }
}

// 当 #bg 图片更新后同步 ambient 背景
function syncAmbientBg() {
    if (!$('body').hasClass('bg-fit')) return;
    var bgSrc = ($('#bg')[0] && $('#bg')[0].src) || '';
    if (!bgSrc || bgSrc.indexOf('data:image/gif;base64,R0lGODlh') === -1) {
        $('#bg-ambient').css({ backgroundImage: 'url(' + bgSrc + ')', display: 'block', opacity: 1 });
    }
}

// 设置-壁纸（核心初始化函数）
function setBgImgInit() {
    var bg_img = getBgImg();
    bgLog('══════════ setBgImgInit() 开始 ══════════');
    bgLog('  bg_img.type=', bg_img['type'], '| refreshOnLoad=', bg_img['refreshOnLoad'], '| cache=', bg_img['cache'], '| cacheDuration=', bg_img['cacheDuration']);

    // ── 阶段一：立即展示一张确定存在的图片 ────
    var cachedData = getCachedBgData();
    var lastUrl = getLastBgUrl();
    var bgEl = document.getElementById('bg');
    bgLog('  Phase1: cachedData=', cachedData ? ('存在, 长度='+cachedData.length) : '(无)', '| lastUrl=', (lastUrl||'(无)').substring(0,60), '| bgEl=', !!bgEl);

    // 有 base64 缓存则直接使用无延迟；否则如果有上一次保留的图片源（通常已在浏览器缓存），也作为首选；最后才会退到兜底图
    var initUrl = cachedData || (lastUrl && typeof lastUrl === 'string' && lastUrl.indexOf('http') === 0 ? lastUrl : null) || FALLBACK_BG_URL;
    bgLog('  Phase1: initUrl =', initUrl.substring(0, 80), '| 来源:', cachedData ? 'base64缓存' : (initUrl === lastUrl ? '上一次 URL缓存' : '本地兜底图'));

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
            bgLog('  Phase1: bgEl.onerror! src=', (bgEl.src||'').substring(0,80));
            bgEl.onerror = null;
            setWithFallback($('#bg'), fb1 || ULTIMATE_FALLBACK, ULTIMATE_FALLBACK);
        };
        bgEl.src = initUrl;
        bgLog('  Phase1: 设置 bgEl.src =', initUrl.substring(0,80));
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
    $("input[name='wallpaper-type'][value=" + bg_img["type"] + "]").click();
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
    // 比例自适应初始化
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
        // 有 base64 缓存 → 交叉渐变到缓存的真实壁纸
        if (cachedData) {
            bgLog('  Phase2: 交叉渐变到 base64 缓存');
            applyBgNew(cachedData, false);
        } else if (lastUrl && lastUrl.indexOf('http') === 0) {
            // 远程 API：fetch 获取图像数据（成功则缓存 base64），同时交叉渐变显示
            bgLog('  Phase2: fetch API 并交叉渐变显示');
            applyBgWithCache(currentType, lastUrl, bg_img, false, false);
        } else if (lastUrl) {
            // 本地文件：直接交叉渐变
            bgLog('  Phase2: 交叉渐变到本地文件');
            applyBgNew(lastUrl, false);
        }
        return;
    }

    setLastBgType(currentType);
    bgLog('  Phase2: 需要更换壁纸! 原因:', typeChanged?'来源变更':'', refreshOnLoad?'强刷':'', noLastImg?'首次访问':'');
    var deferredSwitch = function () {
        bgLog('  Phase2: deferredSwitch 执行! type=', currentType);
        switch (currentType) {
            case "1":
                var cache1 = getBgCache();
                if (!refreshOnLoad && bg_img["cache"] && isBgCacheValid(cache1, bg_img)) {
                    applyBgNew(cache1.url, false);
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
                    applyBgNew(picUrl, refreshOnLoad);
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
}

// 搜索框高亮
function focusWd() {
    $("body").addClass("onsearch");
}

// 搜索框取消高亮
function blurWd() {
    $("body").removeClass("onsearch");
    //隐藏输入
    $(".wd").val("");
    //隐藏搜索建议
    $("#keywords").hide();
}

// 搜索建议提示（带防抖）
var _keywordTimer = null;
var _jsonpSeqId = 0;
function keywordReminder() {
    clearTimeout(_keywordTimer);
    _keywordTimer = setTimeout(_doKeywordReminder, 250);
}
function _doKeywordReminder() {
    var keyword = $(".wd").val();
    if (keyword !== "") {
        var currentSeq = ++_jsonpSeqId;
        $.ajax({
            url: 'https://suggestion.baidu.com/su?wd=' + encodeURIComponent(keyword),
            dataType: 'jsonp',
            jsonp: 'cb',
            success: function (data) {
                if (currentSeq !== _jsonpSeqId) return; // 忽略过时的响应
                //获取宽度
                $("#keywords").css("width", $('.sou').width());
                $("#keywords").empty().show();
                $.each(data.s, function (i, val) {
                    $('#keywords').append(`<div class="keyword" data-id="${i + 1}"><i class='iconfont icon-sousuo'></i>${escapeHtml(val)}</div>`);
                });
                $("#keywords").attr("data-length", data.s.length);
            },
            error: function () {
                $("#keywords").empty().hide();
            }
        })
    } else {
        $("#keywords").empty().hide();
    }
}

// 搜索框数据加载
function searchData() {
    var se_default = getSeDefault();
    var se_list = getSeList();
    var defaultSe = se_list[se_default];
    if (defaultSe) {
        $(".search").attr("action", defaultSe["url"]);
        $("#icon-se").attr("class", defaultSe["icon"]);
        $(".wd").attr("name", defaultSe["name"]);
    }

    // 判断窗口大小，添加输入框自动完成
    // var wid = $("body").width();
    // if (wid < 640) {
    //     $(".wd").attr('autocomplete', 'off');
    // } else {
    //     $(".wd").focus();
    //     focusWd();
    // }
}

// 搜索引擎列表加载
function seList() {
    var html = "";
    var se_list = getSeList();
    for (var i in se_list) {
        var safeTitle = escapeHtml(se_list[i]["title"]);
        var safeUrl = escapeHtml(se_list[i]["url"]);
        var safeName = escapeHtml(se_list[i]["name"]);
        var safeIcon = escapeHtml(se_list[i]["icon"]);
        html += `<div class='se-li' data-url='${safeUrl}' data-name='${safeName}' data-icon='${safeIcon}'>
        <a class='se-li-text'><i class='icon-sou-list ${safeIcon}'></i><span>${safeTitle}</span></a></div>`;
    }
    $(".search-engine-list").html(html);
}

// 设置-搜索引擎列表加载
function setSeInit() {
    var se_default = getSeDefault();
    var se_list = getSeList();
    var html = "";
    for (var i in se_list) {
        var safeKey = escapeHtml(i);
        var safeTitle = escapeHtml(se_list[i]["title"]);
        var tr = `<div class='se_list_div'><div class='se_list_num'>${safeKey}</div>`;
        if (i === se_default) {
            tr = `<div class='se_list_div'><div class='se_list_num'>
            <i class='iconfont icon-home'></i></div>`;
        }
        tr += `<div class='se_list_name'>${safeTitle}</div>
        <div class='se_list_button'>
        <button class='set_se_default' value='${safeKey}' style='border-radius: 8px 0px 0px 8px;'>
        <i class='iconfont icon-home'></i></button>
        <button class='edit_se' value='${safeKey}'>
        <i class='iconfont icon-xiugai'></i></button>
        <button class='delete_se' value='${safeKey}' style='border-radius: 0px 8px 8px 0px;'>
        <i class='iconfont icon-delete'></i></button></div>
        </div>`;
        html += tr;
    }
    $(".se_list_table").html(html);
}

// 获取快捷方式列表
function getQuickList() {
    var quick_list_local = Storage.get('quick_list');
    if (quick_list_local !== "{}" && quick_list_local) {
        try {
            return JSON.parse(quick_list_local);
        } catch (e) {
            console.warn('quick_list 数据损坏，已重置:', e);
            Storage.remove('quick_list');
        }
    }
    setQuickList(quick_list_preinstall);
    return quick_list_preinstall;
}

// 设置快捷方式列表
function setQuickList(quick_list) {
    if (quick_list) {
        Storage.set('quick_list', quick_list);
        return true;
    }
    return false;
}

// 快捷方式数据加载
function quickData() {
    var html = "";
    var quick_list = getQuickList();
    for (var i in quick_list) {
        var safeTitle = escapeHtml(quick_list[i]['title']);
        var rawUrl = quick_list[i]['url'];
        var safeUrl = isValidUrl(rawUrl) ? escapeHtml(rawUrl) : '#';
        html += `<div class="quick">
                    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeTitle}</a>
                </div>`;
    }
    $(".quick-all").html(html + `<div class="quick"><a id="set-quick"><i class="iconfont icon-tianjia-"></i></a></div>`);
}

// 设置-快捷方式加载
function setQuickInit() {
    var quick_list = getQuickList();
    var html = "";
    for (var i in quick_list) {
        var safeKey = escapeHtml(i);
        var safeTitle = escapeHtml(quick_list[i]['title']);
        var tr = `
        <div class='quick_list_div'>
            <div class='quick_list_div_num'>${safeKey}</div>
            <div class='quick_list_div_name'>${safeTitle}</div>
            <div class='quick_list_div_button'>
                <button class='edit_quick' value='${safeKey}' style='border-radius: 8px 0px 0px 8px;'>
                <i class='iconfont icon-xiugai'></i></button>
                <button class='delete_quick' value='${safeKey}' style='border-radius: 0px 8px 8px 0px;'>
                <i class='iconfont icon-delete'></i></button>
            </div>
        </div>`;
        html += tr;
    }
    $(".quick_list_table").html(html);
}

/**
 * 下载文本为文件
 * @param filename 文件名
 * @param text     内容
 */
function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var element = document.createElement('a');
    element.href = url;
    element.download = filename;
    element.style.display = 'none';
    document.body.appendChild(element);
    try {
        element.click();
    } finally {
        document.body.removeChild(element);
        URL.revokeObjectURL(url);
    }
}

// 打开设置
function openSet() {
    $("#menu").addClass('on');

    openBox();

    //更改设置图标
    $("#icon-menu").attr("class", "iconfont icon-home");

    //隐藏书签打开设置
    $(".mark").css({
        "display": "none",
    });
    $(".set").css({
        "display": "flex",
    });
}

// 关闭设置
function closeSet() {
    $("#menu").removeClass('on');

    closeBox();

    //更改设置图标
    $("#icon-menu").attr("class", "iconfont icon-shezhi");

    //隐藏设置
    $(".set").css({
        "display": "none",
    });

    // 刷新主页数据
    seList();
    quickData();
}

// 书签显示
function openBox() {
    $("#content").addClass('box');
    $(".mark").css({
        "display": "flex",
    });
    //时间上移
    $(".tool-all").css({
        "transform": 'translateY(-160%)'
    });
    //背景模糊
    $('#bg').css({
        "transform": 'scale(1.08)',
        "filter": "blur(10px)",
        "transition": "ease 0.3s",
    });
}

// 书签关闭
function closeBox() {
    $("#content").removeClass('box');
    $(".mark").css({
        "display": "none",
    });
    //时间下移
    $(".tool-all").css({
        "transform": 'translateY(-120%)'
    });
    //背景模糊
    $('#bg').css({
        "transform": 'scale(1)',
        "filter": "blur(0px)",
        "transition": "ease 0.3s",
    });
}

//显示设置搜索引擎列表
function showSe() {
    $(".se_list").show();
    $(".se_add_preinstall").show();
}

//隐藏设置搜索引擎列表
function hideSe() {
    $(".se_list").hide();
    $(".se_add_preinstall").hide();
}

//显示设置快捷方式列表
function showQuick() {
    $(".quick_list").show();
    $(".se_add_preinstalls").show();
}

//隐藏设置快捷方式列表
function hideQuick() {
    $(".quick_list").hide();
    $(".se_add_preinstalls").hide();
}


$(document).ready(function () {

    // 搜索框数据加载
    searchData();

    // 搜索引擎列表加载
    seList();

    // 快捷方式数据加载
    quickData();

    // 壁纸数据加载
    setBgImgInit();

    // 点击事件
    $(document).on('click', function (e) {
        // 选择搜索引擎点击
        if ($(".search-engine").is(":hidden") && $(".se").is(e.target) || $(".search-engine").is(":hidden") && $("#icon-se").is(e.target)) {
            if ($(".se").is(e.target) || $("#icon-se").is(e.target)) {
                //获取宽度
                $(".search-engine").css("width", $('.sou').width() - 30);
                //出现动画
                $(".search-engine").slideDown(160);
            }
        } else {
            if (!$(".search-engine").is(e.target) && $(".search-engine").has(e.target).length === 0) {
                $(".search-engine").slideUp(160);
            }
        }

        // 自动提示隐藏
        if (!$(".sou").is(e.target) && $(".sou").has(e.target).length === 0) {
            $("#keywords").hide();
        }
    });

    // 时间点击
    $("#time_text").click(function () {
        if ($("#content").hasClass('box')) {
            closeBox();
            closeSet();
            blurWd();
        } else {
            openBox();
        }
    });

    // 搜索引擎列表点击
    $(".search-engine-list").on("click", ".se-li", function () {
        var url = $(this).attr('data-url');
        var name = $(this).attr('data-name');
        var icon = $(this).attr('data-icon');
        $(".search").attr("action", url);
        $(".wd").attr("name", name);
        $("#icon-se").attr("class", icon);
        $(".search-engine").slideUp(160);
    });

    // 搜索框点击事件
    $(document).on('click', '.sou', function () {
        focusWd();
        $(".search-engine").slideUp(160);
    });

    $(document).on('click', '.wd', function () {
        focusWd();
        keywordReminder();
        $(".search-engine").slideUp(160);
    });

    // 点击其他区域关闭事件
    $(document).on('click', '.close_sou', function () {
        blurWd();
        closeSet();
    });

    // 点击搜索引擎时隐藏自动提示
    $(document).on('click', '.se', function () {
        $('#keywords').toggle();
    });

    // 恢复自动提示
    $(document).on('click', '.se-li', function () {
        $('#keywords').show();
    });

    // 自动提示 (调用百度 api）
    $('.wd').keyup(function (event) {
        var key = event.keyCode;
        // 屏蔽上下键
        var shieldKey = [38, 40];
        if (shieldKey.includes(key)) return;
        keywordReminder();
    });

    // 点击自动提示的搜索建议
    $("#keywords").on("click", ".keyword", function () {
        var wd = $(this).text();
        $(".wd").val(wd);
        $("#search-submit").click();
    });

    // 自动提示键盘方向键选择操作
    $(".wd").keydown(function (event) { //上下键获取焦点
        var key = event.keyCode;
        if ($(this).val().trim().length === 0) return;

        var id = $(".choose").attr("data-id");
        if (id === undefined) id = 0;
        id = parseInt(id, 10);

        if (key === 38) {
            /*向上按钮*/
            id--;
        } else if (key === 40) {
            /*向下按钮*/
            id++;
        } else {
            return;
        }
        var length = parseInt($("#keywords").attr("data-length"), 10);
        if (isNaN(length) || length === 0) return;
        if (id > length) id = 1;
        if (id < 1) id = length;

        $(".keyword[data-id=" + id + "]").addClass("choose").siblings().removeClass("choose");
        $(".wd").val($(".keyword[data-id=" + id + "]").text());
    });

    // 刷新背景按钮
    $("#bg-refresh").click(function () {
        var $btn = $(this);
        // 旋转动画反馈
        $btn.css({ transition: 'transform 0.6s ease', transform: 'rotate(360deg)' });
        setTimeout(function () {
            $btn.css({ transition: 'none', transform: 'rotate(0deg)' });
        }, 650);
        refreshBg();
    });

    // 菜单点击
    $("#menu").click(function () {
        if ($(this).hasClass('on')) {
            closeSet();
        } else {
            openSet();

            // 设置内容加载
            setSeInit(); //搜索引擎设置
            setQuickInit(); //快捷方式设置
        }
    });

    // 快捷方式添加按钮点击
    $("#set-quick").click(function () {
        openSet();

        // 设置内容加载
        setSeInit(); //搜索引擎设置
        setQuickInit(); //快捷方式设置

        //添加快捷方式
        $("#set-quick-menu").trigger('click');
        $(".set_quick_list_add").trigger('click');
    });

    // 修改默认搜索引擎
    $(".se_list_table").on("click", ".set_se_default", function () {
        var name = $(this).val();
        iziToast.show({
            timeout: 8000,
            message: '是否设置为默认搜索引擎？',
            buttons: [
                ['<button>确认</button>', function (instance, toast) {
                    Storage.set('se_default', name);
                    setSeInit();
                    instance.hide({
                        transitionOut: 'flipOutX',
                    }, toast, 'buttonName');
                    iziToast.show({
                        message: '设置成功'
                    });
                    setTimeout(function () {
                        window.location.reload()
                    }, 1000);
                }, true],
                ['<button>取消</button>', function (instance, toast) {
                    instance.hide({
                        transitionOut: 'flipOutX',
                    }, toast, 'buttonName');
                }]
            ]
        });
    });

    // 搜索引擎添加
    $(".set_se_list_add").click(function () {
        $(".se_add_content input").val("");

        hideSe();
        $(".se_add_content").show();
    });

    // 搜索引擎保存
    $(".se_add_save").click(function () {
        var key_inhere = $(".se_add_content input[name='key_inhere']").val();
        var key = $(".se_add_content input[name='key']").val();
        var title = $(".se_add_content input[name='title']").val();
        var url = $(".se_add_content input[name='url']").val();
        var name = $(".se_add_content input[name='name']").val();
        var icon = "iconfont icon-wangluo";

        var num = /^\+?[1-9][0-9]*$/;
        if (!num.test(key)) {
            iziToast.show({
                timeout: 2000,
                message: '序号 ' + key + ' 不是正整数'
            });
            return;
        }

        if (!url || !isValidUrl(url)) {
            iziToast.show({
                timeout: 2000,
                message: '请输入有效的搜索引擎 URL（以 http/https 开头）'
            });
            return;
        }

        var se_list = getSeList();

        if (se_list[key]) {
            iziToast.show({
                timeout: 8000,
                message: '搜索引擎 ' + key + ' 已有数据，是否覆盖？',
                buttons: [
                    ['<button>确认</button>', function (instance, toast) {
                        se_list[key] = {
                            title: title,
                            url: url,
                            name: name,
                            icon: icon,
                        };
                        setSeList(se_list);
                        setSeInit();
                        $(".se_add_content").hide();
                        //显示列表
                        showSe();

                        instance.hide({
                            transitionOut: 'flipOutX',
                        }, toast, 'buttonName');
                        iziToast.show({
                            message: '覆盖成功'
                        });
                    }, true],
                    ['<button>取消</button>', function (instance, toast) {
                        instance.hide({
                            transitionOut: 'flipOutX',
                        }, toast, 'buttonName');
                    }]
                ]
            });
            return;
        }

        if (key_inhere && key !== key_inhere) {
            delete se_list[key_inhere];
        }

        se_list[key] = {
            title: title,
            url: url,
            name: name,
            icon: icon,
        };
        setSeList(se_list);
        setSeInit();
        iziToast.show({
            timeout: 2000,
            message: '添加成功'
        });
        $(".se_add_content").hide();
        showSe();
    });

    // 关闭表单
    $(".se_add_cancel").click(function () {
        $(".se_add_content").hide();

        //显示列表
        showSe();
    });

    // 搜索引擎修改
    $(".se_list").on("click", ".edit_se", function () {

        var se_list = getSeList();
        var key = $(this).val();
        $(".se_add_content input[name='key_inhere']").val(key);
        $(".se_add_content input[name='key']").val(key);
        $(".se_add_content input[name='title']").val(se_list[key]["title"]);
        $(".se_add_content input[name='url']").val(se_list[key]["url"]);
        $(".se_add_content input[name='name']").val(se_list[key]["name"]);
        // $(".se_add_content input[name='icon']").val("iconfont icon-Earth");

        //隐藏列表
        hideSe();

        $(".se_add_content").show();
    });

    // 搜索引擎删除
    $(".se_list").on("click", ".delete_se", function () {
        var se_default = getSeDefault();
        var key = $(this).val();
        if (key == se_default) {
            iziToast.show({
                message: '默认搜索引擎不可删除'
            });
        } else {
            iziToast.show({
                timeout: 8000,
                message: '搜索引擎 ' + key + ' 是否删除？',
                buttons: [
                    ['<button>确认</button>', function (instance, toast) {
                        var se_list = getSeList();
                        delete se_list[key];
                        setSeList(se_list);
                        setSeInit();
                        instance.hide({
                            transitionOut: 'flipOutX',
                        }, toast, 'buttonName');
                        iziToast.show({
                            message: '删除成功'
                        });
                    }, true],
                    ['<button>取消</button>', function (instance, toast) {
                        instance.hide({
                            transitionOut: 'flipOutX',
                        }, toast, 'buttonName');
                    }]
                ]
            });
        }
    });

    // 恢复预设搜索引擎
    $(".set_se_list_preinstall").click(function () {
        iziToast.show({
            timeout: 8000,
            message: '现有搜索引擎数据将被清空',
            buttons: [
                ['<button>确认</button>', function (instance, toast) {
                    setSeList(se_list_preinstall);
                    Storage.set('se_default', '1');
                    setSeInit();
                    instance.hide({
                        transitionOut: 'flipOutX',
                    }, toast, 'buttonName');
                    iziToast.show({
                        message: '重置成功'
                    });
                    setTimeout(function () {
                        window.location.reload()
                    }, 1000);
                }, true],
                ['<button>取消</button>', function (instance, toast) {
                    instance.hide({
                        transitionOut: 'flipOutX',
                    }, toast, 'buttonName');
                }]
            ]
        });
    });

    // 设置-快捷方式添加
    $(".set_quick_list_add").click(function () {
        $(".quick_add_content input").val("");
        $(".quick_add_content").show();

        //隐藏列表
        hideQuick();
    });

    // 设置-快捷方式保存
    $(".quick_add_save").click(function () {
        var key_inhere = $(".quick_add_content input[name='key_inhere']").val();
        var key = $(".quick_add_content input[name='key']").val();
        var title = $(".quick_add_content input[name='title']").val();
        var url = $(".quick_add_content input[name='url']").val();
        var img = $(".quick_add_content input[name='img']").val();

        var num = /^\+?[1-9][0-9]*$/;
        if (!num.test(key)) {
            iziToast.show({
                timeout: 2000,
                message: '快捷方式 ' + key + ' 不是正整数'
            });
            return;
        }

        if (!url || !isValidUrl(url)) {
            iziToast.show({
                timeout: 2000,
                message: '请输入有效的 URL（以 http/https 开头）'
            });
            return;
        }

        var quick_list = getQuickList();

        if (quick_list[key]) {
            iziToast.show({
                timeout: 8000,
                message: '快捷方式 ' + key + ' 已有数据，是否覆盖？',
                buttons: [
                    ['<button>确认</button>', function (instance, toast) {
                        quick_list[key] = {
                            title: title,
                            url: url,
                            img: img,
                        };
                        setQuickList(quick_list);
                        setQuickInit();
                        $(".quick_add_content").hide();
                        //显示列表
                        showQuick();

                        instance.hide({
                            transitionOut: 'flipOutX',
                        }, toast, 'buttonName');
                        iziToast.show({
                            message: '覆盖成功'
                        });
                    }, true],
                    ['<button>取消</button>', function (instance, toast) {
                        instance.hide({
                            transitionOut: 'flipOutX',
                        }, toast, 'buttonName');
                    }]
                ]
            });
            return;
        }

        if (key_inhere && key !== key_inhere) {
            delete quick_list[key_inhere];
        }

        quick_list[key] = {
            title: title,
            url: url,
            img: img,
        };
        setQuickList(quick_list);
        setQuickInit();
        $(".quick_add_content").hide();
        iziToast.show({
            timeout: 2000,
            message: '添加成功'
        });

        //显示列表
        showQuick();
    });

    // 设置-快捷方式关闭添加表单
    $(".quick_add_cancel").click(function () {
        $(".quick_add_content").hide();

        //显示列表
        showQuick();
    });

    //恢复预设快捷方式
    $(".set_quick_list_preinstall").click(function () {
        iziToast.show({
            timeout: 8000,
            message: '快捷方式数据将被清空',
            buttons: [
                ['<button>确认</button>', function (instance, toast) {
                    setQuickList(quick_list_preinstall);
                    setQuickInit();
                    instance.hide({
                        transitionOut: 'flipOutX',
                    }, toast, 'buttonName');
                    iziToast.show({
                        timeout: 2000,
                        message: '重置成功'
                    });
                    // setTimeout(function () {
                    //     window.location.reload()
                    // }, 1000);
                }, true],
                ['<button>取消</button>', function (instance, toast) {
                    instance.hide({
                        transitionOut: 'flipOutX',
                    }, toast, 'buttonName');
                }]
            ]
        });
    });

    // 快捷方式修改
    $(".quick_list").on("click", ".edit_quick", function () {

        var quick_list = getQuickList();
        var key = $(this).val();
        $(".quick_add_content input[name='key_inhere']").val(key);
        $(".quick_add_content input[name='key']").val(key);
        $(".quick_add_content input[name='title']").val(quick_list[key]["title"]);
        $(".quick_add_content input[name='url']").val(quick_list[key]["url"]);
        $(".quick_add_content input[name='img']").val(quick_list[key]["img"]);

        //隐藏列表
        hideQuick();

        $(".quick_add_content").show();
    });

    // 快捷方式删除
    $(".quick_list").on("click", ".delete_quick", function () {

        var key = $(this).val();

        iziToast.show({
            timeout: 8000,
            message: '快捷方式 ' + key + ' 是否删除？',
            buttons: [
                ['<button>确认</button>', function (instance, toast) {
                    var quick_list = getQuickList();
                    delete quick_list[key];
                    setQuickList(quick_list);
                    setQuickInit();
                    instance.hide({
                        transitionOut: 'flipOutX',
                    }, toast, 'buttonName');
                    iziToast.show({
                        timeout: 2000,
                        message: '删除成功'
                    });
                }, true],
                ['<button>取消</button>', function (instance, toast) {
                    instance.hide({
                        transitionOut: 'flipOutX',
                    }, toast, 'buttonName');
                }]
            ]
        });
    });

    // 壁纸设置
    $("#wallpaper").on("click", ".set-wallpaper", function () {
        var type = $(this).val();
        var bg_img = getBgImg();
        bg_img["type"] = type;

        var descriptions = {
            "1": "显示默认壁纸，刷新页面以生效",
            "2": "显示必应每日一图，每天更新，刷新页面以生效 | API @ Bing",
            "3": "显示随机风景照片，每次刷新更换，刷新页面以生效 | API @ Lorem Picsum",
            "4": "显示随机二次元图片，每次刷新更换，刷新页面以生效 | API @ 樱花",
            "5": "显示随机猫咪照片，治愈系壁纸，刷新页面以生效 | API @ 樱花",
            "6": "使用自定义图片 URL，请在下方填入地址后保存"
        };

        $('#wallpaper_text').html(descriptions[type] || "");
        setBgImg(bg_img);
        clearBgCache(); // 切换壁纸类型时清除旧缓存
        clearCachedBgData(); // 清除 base64 图片缓存
        localStorage.removeItem(BG_LAST_URL_KEY); // 切换类型时清除上次图片缓存
        localStorage.removeItem(BG_LAST_TYPE_KEY); // 切换类型时清除上次类型记录

        if (type === "6") {
            $("#wallpaper_url").fadeIn(200);
            // 恢复已保存的 URL
            if (bg_img["path"]) {
                $("#wallpaper-url").val(bg_img["path"]);
            }
            if (getBgApiKey()) {
                $("#wallpaper-apikey").attr("placeholder", "API 密钥已保存（输入新值以更新）");
            }
        } else {
            $("#wallpaper_url").fadeOut(200);
            iziToast.show({
                message: '壁纸设置成功，刷新生效',
            });
        }
    });

    // 自定义壁纸 URL 保存
    $(".wallpaper_save").click(function () {
        var url = $("#wallpaper-url").val().trim();
        // 验证去除 {key} 占位符后的 URL 格式
        var urlForValidation = url.replace(/\{key\}/g, 'testkey');
        if (!url || !isValidUrl(urlForValidation)) {
            iziToast.show({
                timeout: 2000,
                message: '请输入有效的图片 URL（以 http/https 开头）'
            });
            return;
        }
        var bg_img = getBgImg();
        bg_img["type"] = "6";
        bg_img["path"] = url;
        setBgImg(bg_img);
        // API 密钥存于 localStorage，持久保存
        var apiKeyInput = $("#wallpaper-apikey").val();
        if (apiKeyInput) {
            setBgApiKey(apiKeyInput);
            $("#wallpaper-apikey").val("").attr("placeholder", "API 密钥已保存（输入新值以更新）");
        }
        clearBgCache(); // URL 变更时清除旧缓存
        clearCachedBgData(); // 清除 base64 图片缓存
        localStorage.removeItem(BG_LAST_URL_KEY); // 清除上次图片缓存
        localStorage.removeItem(BG_LAST_TYPE_KEY); // 清除上次类型记录
        iziToast.show({
            message: '自定义壁纸设置成功，刷新生效',
        });
    });

    // 每次刷新更换背景 切换
    $("#wallpaper-refresh-enable").on("change", function () {
        var bg_img = getBgImg();
        bg_img["refreshOnLoad"] = !!$(this).is(":checked");
        setBgImg(bg_img);
        iziToast.show({
            message: bg_img["refreshOnLoad"] ? '已开启每次刷新更换背景，刷新生效' : '已关闭每次刷新更换背景，刷新生效',
        });
    });

    // 比例自适应切换
    $("#wallpaper-fit-enable").on("change", function () {
        var bg_img = getBgImg();
        var enabled = !!$(this).is(":checked");
        bg_img["bg_fit"] = enabled;
        setBgImg(bg_img);
        applyFitMode(enabled);
        iziToast.show({
            message: enabled ? '已开启比例自适应（完整显示 + 模糊填充）' : '已关闭比例自适应（铺满裁剪）',
        });
    });

    // 缓存启用切换
    $("#wallpaper-cache-enable").on("change", function () {
        if ($(this).is(":checked")) {
            $("#wallpaper_cache_duration").show();
            $("#wallpaper_cache_save_row").show();
        } else {
            $("#wallpaper_cache_duration").hide();
            $("#wallpaper_cache_save_row").hide();
        }
    });

    // 缓存设置保存
    $(".wallpaper_cache_save").click(function () {
        var bg_img = getBgImg();
        var enabled = !!$("#wallpaper-cache-enable").is(":checked");
        bg_img["cache"] = enabled;
        if (enabled) {
            var hours = parseInt($("#wallpaper-cache-hours").val(), 10);
            if (isNaN(hours) || hours < 1) hours = CACHE_DURATION_DEFAULT;
            if (hours > CACHE_DURATION_MAX) hours = CACHE_DURATION_MAX;
            bg_img["cacheDuration"] = hours;
        } else {
            clearBgCache();
        }
        setBgImg(bg_img);
        iziToast.show({
            message: enabled ? ('壁纸缓存已启用，有效期 ' + bg_img["cacheDuration"] + ' 小时，刷新生效') : '壁纸缓存已关闭，刷新生效',
        });
    });


    // 我的数据导出
    $("#my_data_out").click(function () {
        var allData = Storage.getAll();
        var json = JSON.stringify(allData);
        download("Snavigation-back-up-" + Date.now() + ".json", json);
        iziToast.show({
            timeout: 2000,
            message: '已导出备份文件至下载目录'
        });
    });

    // 我的数据导入 点击触发文件选择
    $("#my_data_in").click(function () {
        $("#my_data_file").click();
    });

    // 选择文件后读取文件内容
    $("#my_data_file").change(function () {
        var selectedFile = document.getElementById('my_data_file').files[0];
        //var name = selectedFile.name;//读取选中文件的文件名
        //var size = selectedFile.size;//读取选中文件的大小
        //console.log("文件名:"+name+" 大小:"+size);

        var reader = new FileReader(); //这是核心,读取操作就是由它完成.
        reader.readAsText(selectedFile); //读取文件的内容,也可以读取文件的URL
        reader.onload = function () {
            //当读取完成后回调这个函数,然后此时文件的内容存储到了result中,直接操作即可
            //console.log(this.result);

            // json 格式校验
            var mydata;
            try {
                mydata = JSON.parse(this.result);
            } catch (e) {
                iziToast.show({
                    timeout: 2000,
                    message: '数据解析异常'
                });
                return;
            }
            if (typeof mydata != 'object') {
                iziToast.show({
                    timeout: 2000,
                    message: '数据格式错误'
                });
                return;
            }

            iziToast.show({
                timeout: 8000,
                message: '当前数据将会被覆盖！是否继续导入？',
                buttons: [
                    ['<button>确认</button>', function (instance, toast) {
                        // 只允许导入白名单内的数据键
                        var allowedKeys = ['se_list', 'quick_list', 'bg_img', 'se_default'];
                        for (var key in mydata) {
                            if (allowedKeys.indexOf(key) !== -1) {
                                // 验证导入数据中的 URL 安全性
                                if (key === 'se_list' || key === 'quick_list') {
                                    try {
                                        var list = typeof mydata[key] === 'string' ? JSON.parse(mydata[key]) : mydata[key];
                                        for (var k in list) {
                                            if (list[k].url && !isValidUrl(list[k].url)) {
                                                iziToast.show({ timeout: 3000, message: '导入数据包含无效 URL，已拒绝导入' });
                                                return;
                                            }
                                        }
                                    } catch (e) {
                                        iziToast.show({ timeout: 2000, message: '导入数据格式异常' });
                                        return;
                                    }
                                }
                                // 验证 bg_img 中的 URL
                                if (key === 'bg_img') {
                                    try {
                                        var bgData = typeof mydata[key] === 'string' ? JSON.parse(mydata[key]) : mydata[key];
                                        if (bgData.path && !isValidUrl(bgData.path)) {
                                            iziToast.show({ timeout: 3000, message: '导入壁纸 URL 无效，已拒绝导入' });
                                            return;
                                        }
                                    } catch (e) {
                                        iziToast.show({ timeout: 2000, message: '壁纸数据格式异常' });
                                        return;
                                    }
                                }
                                Storage.set(key, mydata[key]);
                            }
                        }
                        instance.hide({
                            transitionOut: 'flipOutX',
                        }, toast, 'buttonName');
                        iziToast.show({
                            timeout: 2000,
                            message: '导入成功'
                        });
                        setTimeout(function () {
                            window.location.reload()
                        }, 1000);
                    }, true],
                    ['<button>取消</button>', function (instance, toast) {
                        instance.hide({
                            transitionOut: 'flipOutX',
                        }, toast, 'buttonName');
                    }]
                ]
            });
        }
    });

    // 窗口尺寸变化时同步 ambient 背景
    var _ambientResizeTimer = null;
    $(window).on('resize', function () {
        clearTimeout(_ambientResizeTimer);
        _ambientResizeTimer = setTimeout(syncAmbientBg, 200);
    });

});
