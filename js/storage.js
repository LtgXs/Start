/* ============================================
 * Snavigation - Storage
 * localStorage 存取（含旧版 Cookie 数据一次性迁移）
 * 与搜索引擎 / 快捷方式 / 壁纸配置的读写接口
 * 依赖：config.js, utils.js
 * ============================================ */
'use strict';

// ── 旧版 Cookie 兼容（替代 js.cookie.js，仅用于历史数据迁移）────────
function readLegacyCookie(name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : undefined;
}
function eraseLegacyCookie(name) {
    document.cookie = name + '=; Max-Age=-1; path=/';
}

/** localStorage.setItem 的安全封装（隐私模式 / 配额满时 setItem 会抛错） */
function lsSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.warn('[storage] 写入失败（可能是配额已满或隐私模式）:', key, e);
        return false;
    }
}

// ── 存储层：localStorage 优先，命中旧 Cookie 时自动迁移并清除 ──────
const Storage = {
    get(key) {
        const val = localStorage.getItem(key);
        if (val !== null) return val;
        const cookieVal = readLegacyCookie(key);
        if (cookieVal !== undefined) {
            lsSet(key, cookieVal);
            eraseLegacyCookie(key);
            return cookieVal;
        }
        return null;
    },
    set(key, value) {
        let finalValue = value;
        if (typeof value === 'object' && value !== null) {
            try { finalValue = JSON.stringify(value); } catch (e) {
                console.warn('[storage] JSON 序列化失败:', e);
                return false;
            }
        }
        if (finalValue === null || finalValue === undefined) return false;
        if (!lsSet(key, String(finalValue))) return false;
        if (readLegacyCookie(key) !== undefined) eraseLegacyCookie(key);
        return true;
    },
    remove(key) {
        localStorage.removeItem(key);
        eraseLegacyCookie(key);
    },
    getAll() {
        const result = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            result[key] = localStorage.getItem(key);
        }
        return result;
    }
};

// ── 对象型配置读写：损坏 / 缺失时回落预设并回写 ────────────────────
// allowEmpty：把空对象视为合法的用户状态。
// 修复：快捷方式全部删光后，下一次读取会把 {} 当作"数据损坏"而重新
// 灌入预设——刚提示"删除成功"，预设列表又整队复活。快捷方式允许为空；
// 搜索引擎必须至少有一项（否则搜索无法工作），维持非空回落。
function readStoredObject(key, fallback, allowEmpty) {
    const parsed = safeJsonParse(Storage.get(key), null);
    const isPlain = Object.prototype.toString.call(parsed) === '[object Object]';
    if (isPlain && (allowEmpty || Object.keys(parsed).length)) return parsed;
    const preset = cloneValue(fallback);
    Storage.set(key, preset);
    return preset;
}

// ══════════════════════════════════════════════════════════════════
// 业务数据接口
// ══════════════════════════════════════════════════════════════════

// 搜索引擎
const getSeList = () => readStoredObject(STORAGE_KEYS.searchList, SE_PRESET);
const setSeList = (list) => Storage.set(STORAGE_KEYS.searchList, list);
const getSeDefault = () => Storage.get(STORAGE_KEYS.searchDefault) || '1';
const setSeDefault = (key) => Storage.set(STORAGE_KEYS.searchDefault, key);

// 快捷方式（允许为空：用户可以有意删光所有快捷方式）
const getQuickList = () => readStoredObject(STORAGE_KEYS.quickList, QUICK_PRESET, true);
const setQuickList = (list) => Storage.set(STORAGE_KEYS.quickList, list);

// 壁纸配置（缺省字段自动补齐；cache 强制开启）
function getBgImg() {
    const parsed = safeJsonParse(Storage.get(STORAGE_KEYS.wallpaper), null);
    const merged = Object.assign({}, BG_PRESET, parsed || {}, { cache: true });
    if (!parsed) Storage.set(STORAGE_KEYS.wallpaper, merged);
    return merged;
}
const setBgImg = (bg) => (bg ? Storage.set(STORAGE_KEYS.wallpaper, bg) : false);

// 壁纸 API 密钥
const getBgApiKey = () => localStorage.getItem(STORAGE_KEYS.wallpaperApiKey) || '';
const setBgApiKey = (key) => { if (key) lsSet(STORAGE_KEYS.wallpaperApiKey, key); };

// 上次壁纸 URL / 类型（供下次秒开首屏）
const getLastBgUrl = () => localStorage.getItem(STORAGE_KEYS.wallpaperLastUrl) || '';
function setLastBgUrl(url) {
    // base64 数据不落 localStorage（体积大，走 IndexedDB）
    if (url && !url.startsWith('data:image/')) {
        lsSet(STORAGE_KEYS.wallpaperLastUrl, url);
    }
}
const getLastBgType = () => localStorage.getItem(STORAGE_KEYS.wallpaperLastType) || '';
const setLastBgType = (type) => { if (type) lsSet(STORAGE_KEYS.wallpaperLastType, type); };

// 主题（'auto' 跟随系统 / 'light' / 'dark'）
function getTheme() {
    const t = localStorage.getItem(STORAGE_KEYS.theme);
    return (t === 'light' || t === 'dark') ? t : 'auto';
}
const setTheme = (mode) => lsSet(STORAGE_KEYS.theme, mode);

// ── 偏好设置（v1.7；缺省字段自动补齐，未知字段透传保留）────────────
function getPrefs() {
    const parsed = safeJsonParse(Storage.get(STORAGE_KEYS.prefs), null);
    const isPlain = Object.prototype.toString.call(parsed) === '[object Object]';
    return Object.assign({}, PREFS_PRESET, isPlain ? parsed : {});
}
const setPrefs = (p) => Storage.set(STORAGE_KEYS.prefs, p);

// ── 搜索历史（v1.7；数组，最近使用在前，上限 SEARCH_HISTORY_MAX）──
function getSearchHistory() {
    const arr = safeJsonParse(Storage.get(STORAGE_KEYS.searchHistory), null);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && s) : [];
}
const setSearchHistory = (arr) => Storage.set(STORAGE_KEYS.searchHistory, arr);
function addSearchHistory(term) {
    const t = String(term || '').trim();
    if (!t) return;
    const arr = getSearchHistory().filter((s) => s !== t);
    arr.unshift(t);
    setSearchHistory(arr.slice(0, SEARCH_HISTORY_MAX));
}
const clearSearchHistory = () => Storage.remove(STORAGE_KEYS.searchHistory);
