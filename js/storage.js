/* ============================================
 * Snavigation - Shared State Layer
 * 本地存储、默认数据、URL 校验与安全序列化
 * ============================================ */

var APP_STORAGE_KEYS = {
    searchList: 'se_list',
    searchDefault: 'se_default',
    quickList: 'quick_list',
    wallpaper: 'bg_img',
    wallpaperApiKey: 'bg_apikey',
    wallpaperCache: 'bg_img_cache',
    wallpaperLastUrl: 'bg_last_url',
    wallpaperLastType: 'bg_last_type',
    wallpaperCacheData: 'bg_img_data'
};

function cloneValue(value) {
    if (value === null || value === undefined || typeof value !== 'object') {
        return value;
    }
    if (typeof structuredClone === 'function') {
        try { return structuredClone(value); } catch (e) { }
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (e) {
        if (Array.isArray(value)) {
            return value.slice();
        }
        var out = {};
        for (var key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                out[key] = value[key];
            }
        }
        return out;
    }
}

function safeJsonParse(raw, fallback) {
    if (raw === null || raw === undefined || raw === '') {
        return fallback;
    }
    if (typeof raw !== 'string') {
        return raw;
    }
    try {
        return JSON.parse(raw);
    } catch (e) {
        return fallback;
    }
}

function safeJsonStringify(value) {
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch (e) {
        console.warn('JSON 序列化失败:', e);
        return null;
    }
}

function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}

function isEmptyObject(value) {
    return !value || !Object.keys(value).length;
}

function readStoredObject(key, fallback, options) {
    var settings = options || {};
    var raw = Storage.get(key);
    var parsed = safeJsonParse(raw, null);
    if (isPlainObject(parsed) && (settings.allowEmpty || !isEmptyObject(parsed))) {
        return cloneValue(parsed);
    }
    var clonedFallback = cloneValue(fallback);
    Storage.set(key, clonedFallback);
    return clonedFallback;
}

function writeStoredObject(key, value) {
    if (value === undefined) return false;
    Storage.set(key, cloneValue(value));
    return true;
}

// HTML 转义工具，防止 XSS
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// URL 验证工具
function isValidUrl(str) {
    if (!str) return false;
    try {
        var url = new URL(String(str).trim());
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch (e) {
        return false;
    }
}

// 存储层：localStorage 优先，自动迁移旧 Cookie 数据
var Storage = {
    get: function (key) {
        var val = localStorage.getItem(key);
        if (val !== null) return val;
        var cookieVal = Cookies.get(key);
        if (cookieVal !== undefined) {
            localStorage.setItem(key, cookieVal);
            Cookies.remove(key);
            return cookieVal;
        }
        return null;
    },
    set: function (key, value) {
        var finalValue = value;
        if (typeof value === 'object') {
            finalValue = safeJsonStringify(value);
        }
        if (finalValue === null || finalValue === undefined) return false;
        localStorage.setItem(key, finalValue);
        if (Cookies.get(key) !== undefined) {
            Cookies.remove(key);
        }
        return true;
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

// 默认搜索引擎
var se_list_preinstall = {
    '1': { id: 1, title: '百度', url: 'https://www.baidu.com/s', name: 'wd', icon: 'iconfont icon-baidu' },
    '2': { id: 2, title: '必应', url: 'https://cn.bing.com/search', name: 'q', icon: 'iconfont icon-bing' },
    '3': { id: 3, title: '谷歌', url: 'https://www.google.com/search', name: 'q', icon: 'iconfont icon-google' }
};

// 默认快捷方式
var quick_list_preinstall = {
    '1': { title: '哔哩哔哩', url: 'https://www.bilibili.com/' },
    '2': { title: 'Office', url: 'https://www.office.com/' },
    '3': { title: 'Main Page', url: 'https://littlegaofx.github.io/Self/' },
    '4': { title: 'Edge Surf', url: 'https://littlegaofx.github.io/Surf/' },
    '5': { title: 'New Concept Game', url: 'https://littlegaofx.github.io/Game/' }
};

// 默认壁纸配置
var bg_img_preinstall = {
    type: '1',
    path: '',
    cache: true,
    cacheDuration: 24,
    bg_fit: false,
    refreshOnLoad: false
};

// 壁纸相关常量
var BG_APIKEY_SESSION_KEY = 'bg_apikey';
var BG_LAST_URL_KEY = 'bg_last_url';
var BG_LAST_TYPE_KEY = 'bg_last_type';
var BG_IMG_DATA_KEY = 'bg_img_data';
var BG_IMG_DATA_MAX = 60000000;
var CACHE_DURATION_DEFAULT = 24;
var CACHE_DURATION_MAX = 720;
var BG_FADE_DURATION_MS = 1500;
var REVEAL_DURATION_MS = 1500;
var DEFAULT_BG_LIST = [
    './img/background1.webp', './img/background2.webp', './img/background3.webp',
    './img/background4.webp', './img/background5.webp', './img/background6.webp',
    './img/background7.webp', './img/background8.webp', './img/background9.webp',
    './img/background10.webp'
];
var FALLBACK_BG_URL = './img/background1.webp';
var ULTIMATE_FALLBACK = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">' +
    '<rect width="1920" height="1080" fill="#2a2a2a"/></svg>'
);

/**
 * 下载文本为文件
 * @param {string} filename 文件名
 * @param {string} text 文件内容
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
