/* ============================================
 * Snavigation - Wallpaper
 * 背景处理核心：两阶段加载（缓存秒开 → 按需换新）、
 * IndexedDB 缓存、交叉渐变、比例自适应
 * 依赖：config.js, utils.js, storage.js
 * ============================================ */
'use strict';

// ══════════════════════════════════════════════════════════════════
// IndexedDB 缓存（存放压缩后的 base64 壁纸）
// ══════════════════════════════════════════════════════════════════

const BG_DB = { name: 'SnavigationDB', store: 'wallpapers', version: 1 };

function openBgDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(BG_DB.name, BG_DB.version);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(BG_DB.store)) db.createObjectStore(BG_DB.store);
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function idbRequest(mode, action) {
    try {
        const db = await openBgDB();
        return await new Promise((resolve, reject) => {
            const store = db.transaction([BG_DB.store], mode).objectStore(BG_DB.store);
            const req = action(store);
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    } catch (err) {
        console.warn('[wallpaper] IndexedDB 操作失败:', err);
        return null;
    }
}

/** 读取 base64 缓存（自动迁移旧版 localStorage 数据） */
async function getCachedBgData() {
    const cached = await idbRequest('readonly', (s) => s.get(STORAGE_KEYS.wallpaperData));
    if (cached) return cached;
    const legacy = localStorage.getItem(STORAGE_KEYS.wallpaperData);
    if (legacy && legacy.startsWith('data:image/')) {
        idbRequest('readwrite', (s) => s.put(legacy, STORAGE_KEYS.wallpaperData));
        localStorage.removeItem(STORAGE_KEYS.wallpaperData);
        return legacy;
    }
    return null;
}

async function setCachedBgData(dataUrl) {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) return false;
    if (dataUrl.length > BG_CONST.DATA_MAX) {
        console.warn(`[wallpaper] base64 数据过大 (${(dataUrl.length / 1e6).toFixed(1)}MB)，跳过缓存`);
        return false;
    }
    return (await idbRequest('readwrite', (s) => s.put(dataUrl, STORAGE_KEYS.wallpaperData))) !== null;
}

function clearCachedBgData() {
    localStorage.removeItem(STORAGE_KEYS.wallpaperData);
    return idbRequest('readwrite', (s) => s.delete(STORAGE_KEYS.wallpaperData));
}

// ══════════════════════════════════════════════════════════════════
// 缓存元数据（URL + 过期时间，存 localStorage）
// ══════════════════════════════════════════════════════════════════

function getBgCache() {
    return safeJsonParse(localStorage.getItem(STORAGE_KEYS.wallpaperCache), null);
}

function setBgCache(type, url, bg_img) {
    const hours = parseInt(bg_img.cacheDuration, 10) || BG_CONST.CACHE_HOURS_DEFAULT;
    const cache = { type, url, expiresAt: Date.now() + hours * 3600 * 1000 };
    localStorage.setItem(STORAGE_KEYS.wallpaperCache, JSON.stringify(cache));
}

const clearBgCache = () => localStorage.removeItem(STORAGE_KEYS.wallpaperCache);

function isBgCacheValid(cache, bg_img) {
    return !!(cache && cache.url && cache.expiresAt &&
        cache.type === bg_img.type && Date.now() < cache.expiresAt);
}

// ══════════════════════════════════════════════════════════════════
// 工具：随机 API 判定、URL 模板、压缩、随机选图
// ══════════════════════════════════════════════════════════════════

/** 该 URL 每次请求都会返回不同图片（不适合作为静态首屏缓存） */
function isRandomApiUrl(url) {
    if (!url) return false;
    const u = url.toLowerCase();
    if (u.includes('t.mwm.moe')) return true;
    if (u.includes('t.alcy.cc') && !u.includes('?json') &&
        !/\.(jpg|png|webp)/.test(u)) return true;
    if (u.includes('picsum.photos') && !u.includes('/id/') && !u.includes('/seed/')) return true;
    if (u.includes('bing.biturl.top') && u.includes('format=image')) return true;
    return false;
}

/** 替换自定义 URL 模板中的 {key} 占位符 */
function buildBgUrl(template, apiKey) {
    let url = template || '';
    if (apiKey && url.includes('{key}')) {
        url = url.replace(/\{key\}/g, encodeURIComponent(apiKey));
    }
    return url;
}

/** 从内置壁纸中随机取一张（尽量避开 excludeUrl；原逻辑在两处各写了一遍） */
function pickRandomDefaultBg(excludeUrl) {
    const list = DEFAULT_BG_LIST;
    let idx = Math.floor(Math.random() * list.length);
    let tries = 0;
    while (list.length > 1 && list[idx] === excludeUrl && tries < list.length) {
        idx = Math.floor(Math.random() * list.length);
        tries++;
    }
    return list[idx];
}

/** 将已加载的 <img> 压缩为 jpeg base64（限宽 1920） */
function imageToBase64(img) {
    try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) return null;
        const scale = Math.min(1, BG_CONST.COMPRESS_MAX_W / w);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', BG_CONST.COMPRESS_QUALITY);
    } catch (e) {
        // 跨域画布会在 toDataURL 时抛错
        return null;
    }
}

/** 压缩 dataUrl 并写入缓存；失败时退回原始数据（isStale 时跳过写缓存） */
function compressAndCacheDataUrl(dataUrl, isStale) {
    const fresh = () => !isStale || !isStale();
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = async () => {
            const compressed = imageToBase64(img);
            if (compressed) {
                if (fresh()) await setCachedBgData(compressed);
                resolve(compressed);
            } else {
                resolve(dataUrl);
            }
        };
        img.onerror = async () => {
            if (fresh() && dataUrl.length <= BG_CONST.DATA_MAX) await setCachedBgData(dataUrl);
            resolve(dataUrl);
        };
        img.src = dataUrl;
    });
}

/** 给 <img> 设置 src，失败时沿 fallback 链回退（修复原版回退链被覆盖的问题） */
function setWithFallback(imgEl, url, fallbacks) {
    const chain = [url, ...(fallbacks || []), FALLBACK_BG_URL]
        .filter((u, i, arr) => u && arr.indexOf(u) === i);
    let idx = 0;
    const tryNext = () => {
        if (idx >= chain.length) { imgEl.onerror = null; return; }
        const next = chain[idx++];
        imgEl.onerror = tryNext;
        imgEl.src = next;
    };
    tryNext();
}

// ══════════════════════════════════════════════════════════════════
// 远程壁纸解析与获取
// ══════════════════════════════════════════════════════════════════

/** 部分随机源提供 json 接口，可先解析出真实图片地址（利于缓存与去重） */
async function resolveRealBgUrl(type, fallbackUrl) {
    try {
        if (type === '4' || type === '5') {
            const jsonUrl = type === '4' ? 'https://t.alcy.cc/fj/?json' : 'https://t.alcy.cc/mp/?json';
            const text = (await (await fetchWithTimeout(jsonUrl, { cache: 'no-store' }, 10000)).text()).trim();
            if (text.startsWith('http')) return text;
        } else if (type === '2') {
            const data = await (await fetchWithTimeout(
                'https://bing.biturl.top/?resolution=1920&format=json&index=0&mkt=zh-CN',
                { cache: 'no-store' }, 10000
            )).json();
            if (data && data.url) return data.url;
        }
    } catch (e) { /* 解析失败即用兜底 */ }
    return fallbackUrl;
}

/**
 * fetch 图片 → base64（不受 canvas 跨域限制）。
 * 修复：此前用裸 fetch 没有超时，网络挂起时手动刷新的加载指示会永远转圈，
 * isRefreshingBg 也一直为 true，刷新按钮从此失效；现 20s 超时兜底。
 */
async function fetchImageAsDataUrl(url) {
    const res = await fetchWithTimeout(url, { method: 'GET', redirect: 'follow', cache: 'no-store' }, 20000);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
    return { dataUrl, finalUrl: res.url || url };
}

// 壁纸加载代际：每个新的"换壁纸意图"（切换类型 / 手动刷新 / 初始化换新）自增。
// 修复：设置里快速连续切换壁纸时，先发出但网络较慢的旧请求可能最后完成，
// 把用户已选定的新壁纸又盖回旧的（旧版只抑制了过期 Toast，没拦截应用本身）；
// 现在旧代际的抓取结果一律丢弃，也不再写入缓存造成"图数据与元数据错位"。
let _bgLoadGen = 0;

/**
 * 带缓存的壁纸应用主流程
 * @param {string} type 壁纸类型
 * @param {string} url 源地址（模板已展开）
 * @param {object} bg_img 壁纸配置
 * @param {boolean} forceRefresh 忽略缓存强制换新
 * @param {function} [onDone] 完成回调
 * @param {number} [gen] 加载代际（不传则自开新代际）
 */
async function applyBgWithCache(type, url, bg_img, forceRefresh, onDone, gen) {
    if (gen === undefined) gen = ++_bgLoadGen;
    const stale = () => gen !== _bgLoadGen;
    const done = (res) => { if (typeof onDone === 'function') onDone(res); };
    const cache = getBgCache();

    // 缓存命中：直接用本地数据 / 缓存 URL
    if (!forceRefresh && bg_img.cache && isBgCacheValid(cache, bg_img)) {
        const cachedData = await getCachedBgData();
        if (stale()) { done(false); return; }
        applyBgNew(cachedData || cache.url, false, done, cache.url);
        return;
    }

    // 缓存失效或强刷：解析真实地址后抓取新图
    const realUrl = await resolveRealBgUrl(type, url);
    if (stale()) { done(false); return; }
    const fetchUrl = forceRefresh
        ? realUrl + (realUrl.includes('?') ? '&' : '?') + '_t=' + Date.now()
        : realUrl;

    try {
        const { dataUrl, finalUrl } = await fetchImageAsDataUrl(fetchUrl);
        if (stale()) { done(false); return; }
        const compressed = await compressAndCacheDataUrl(dataUrl, stale);
        if (stale()) { done(false); return; }
        if (bg_img.cache) setBgCache(type, finalUrl, bg_img);
        applyBgNew(compressed, forceRefresh, done, finalUrl);
    } catch (err) {
        if (stale()) { done(false); return; }
        // fetch 失败（多为 CORS）：回退 base64 缓存或直接 URL 加载
        console.warn('[wallpaper] 抓取失败，回退直连模式:', err.message || err);
        if (bg_img.cache) setBgCache(type, realUrl, bg_img);
        if (forceRefresh) await clearCachedBgData();
        const base64Fallback = forceRefresh ? null : await getCachedBgData();
        if (stale()) { done(false); return; }
        applyBgNew(base64Fallback || realUrl, forceRefresh, done, realUrl);
    }
}

// ══════════════════════════════════════════════════════════════════
// 交叉渐变切换（#bg 常驻，#bg-new 做过渡层）
// ══════════════════════════════════════════════════════════════════

/** 相对路径 → 绝对 URL（img.src 读取到的永远是绝对地址） */
function toAbsUrl(u) {
    try { return new URL(u, location.href).href; } catch (e) { return u || ''; }
}

// 渐变代际令牌：并发触发时（如初始化换新与手动刷新重叠）只让最新一次生效，
// 避免旧一轮的收尾定时器把新一轮的过渡层提前藏起来造成闪烁
let _bgFadeToken = 0;

function applyBgNew(url, forceRefresh, onDone, originalUrl) {
    let called = false;
    const done = (res) => {
        if (called) return;
        called = true;
        if (typeof onDone === 'function') onDone(res);
    };
    if (!url) { done(false); return; }

    const bgEl = $('#bg');
    const bgNewEl = $('#bg-new');
    const lastUrl = getLastBgUrl();

    let displayUrl = url;
    if (forceRefresh && /^https?:/i.test(url)) {
        // 仅远程图需要防缓存参数；本地内置图（./img/*）追加查询串反而可能加载失败
        displayUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    }

    // 已在展示同一张图 → 跳过
    // （修复：旧版用相对路径与 img.src 的绝对地址直接比较，本地壁纸永远判不相等，
    //   每次进入该分支都会对同一张图再做一次完整交叉渐变。
    //   另需当前图确实解码成功：若 src 相同但其实加载失败，
    //   跳过会短路掉重试与坏缓存清理路径）
    if (!forceRefresh && toAbsUrl(bgEl.src) === toAbsUrl(displayUrl) &&
        bgEl.complete && bgEl.naturalWidth > 0) { done(false); return; }

    const token = ++_bgFadeToken;
    const newImg = new Image();
    newImg.onload = () => {
        if (token !== _bgFadeToken) { done(false); return; } // 已被更新一轮取代
        // 修复：上次壁纸记录此前在加载发起前就写入，加载失败的坏地址
        // 也会被记成"上次壁纸"——下次启动首屏先展示坏地址、失败、再回退，
        // 每次访问都白白闪一下。现在只记录真正加载成功的图
        setLastBgUrl(originalUrl || url);
        const isFitMode = document.body.classList.contains('bg-fit');
        const ambientNew = $('#bg-ambient-new');

        const prep = { display: 'block', opacity: '0', transition: 'none' };
        if (isFitMode) {
            Object.assign(ambientNew.style, prep, { backgroundImage: `url("${displayUrl}")` });
        }
        bgNewEl.src = displayUrl;
        Object.assign(bgNewEl.style, prep);

        // 强制布局，确保 transition 从 opacity 0 起效
        void bgNewEl.offsetHeight;
        if (isFitMode) void ambientNew.offsetHeight;

        requestAnimationFrame(() => {
            if (token !== _bgFadeToken) { done(false); return; }
            const trans = { transition: `opacity ${BG_CONST.FADE_MS / 1000}s ease`, opacity: '1' };
            Object.assign(bgNewEl.style, trans);
            if (isFitMode) Object.assign(ambientNew.style, trans);

            setTimeout(() => {
                if (token !== _bgFadeToken) { done(false); return; }
                bgEl.src = bgNewEl.src || displayUrl;
                syncAmbientBg();
                // 稍等 #bg 渲染完成再撤过渡层，避免闪烁
                setTimeout(() => {
                    if (token !== _bgFadeToken) { done(false); return; }
                    Object.assign(bgNewEl.style, { transition: 'none', opacity: '0', display: 'none' });
                    if (isFitMode) {
                        Object.assign(ambientNew.style, { transition: 'none', opacity: '0', display: 'none' });
                    }
                    done(true);
                }, 100);
            }, BG_CONST.FADE_MS);
        });

        cacheCurrentBgAsync(url); // 后台缓存，不阻塞过渡
    };
    newImg.onerror = async () => {
        if (token !== _bgFadeToken) { done(false); return; } // 过期失败不干扰新一轮
        console.warn('[wallpaper] 图片加载失败:', displayUrl);
        // 修复：失效地址可能刚被写入缓存元数据，若不清除，
        // 之后 24 小时内每次加载都会命中这个坏 URL 并再次失败
        const cache = getBgCache();
        if (cache && toAbsUrl(cache.url) === toAbsUrl(url)) clearBgCache();
        // 修复：当前展示的背景健康时不要动它——旧逻辑一律重走回退链，
        // 把好端端的背景换成了兜底图，"失败保留当前背景"名不副实
        if (bgEl.complete && bgEl.naturalWidth > 0 && !bgEl.src.startsWith(BLANK_GIF_PREFIX)) {
            done(false);
            return;
        }
        const base64Fallback = await getCachedBgData();
        setWithFallback(bgEl, base64Fallback || lastUrl || FALLBACK_BG_URL, [lastUrl]);
        done(false);
    };
    newImg.src = displayUrl;
}

/** 后台把当前展示的远程图抓下来压缩缓存（已有缓存则跳过；换代后放弃写入） */
async function cacheCurrentBgAsync(url) {
    if (!url || !url.startsWith('http')) return;
    const gen = _bgLoadGen;
    const staleNow = () => gen !== _bgLoadGen;
    if (await getCachedBgData()) return;
    try {
        const { dataUrl } = await fetchImageAsDataUrl(url);
        if (staleNow()) return; // 用户已切换壁纸：别把旧图写进新配置的缓存
        await compressAndCacheDataUrl(dataUrl, staleNow);
    } catch (e) { /* CORS 受限时静默放弃 */ }
}

// ══════════════════════════════════════════════════════════════════
// 按类型加载壁纸（refreshBg 与初始化共用；原版此段逻辑写了两遍）
// ══════════════════════════════════════════════════════════════════

function loadWallpaperByType(type, bg_img, forceRefresh, onDone) {
    const gen = ++_bgLoadGen; // 开启新代际：立即作废所有仍在途的旧壁纸请求
    const done = (res) => { if (typeof onDone === 'function') onDone(res); };
    switch (type) {
        case '1': {
            const cache = getBgCache();
            if (!forceRefresh && bg_img.cache && isBgCacheValid(cache, bg_img)) {
                applyBgNew(cache.url, false, done, cache.url);
            } else {
                // 无论手动刷新还是缓存到期换新，都排除当前展示的图，
                // 避免随机到同一张时"换了个寂寞"
                const picUrl = pickRandomDefaultBg(getLastBgUrl());
                // 修复：手动刷新（forceRefresh）时也要更新缓存元数据，
                // 否则缓存里仍是旧图地址，与实际展示不一致
                if (bg_img.cache) setBgCache('1', picUrl, bg_img);
                applyBgNew(picUrl, forceRefresh, done, picUrl);
            }
            break;
        }
        case '2': case '3': case '4': case '5':
            applyBgWithCache(type, WALLPAPER_SOURCES[type].url, bg_img, forceRefresh, done, gen);
            break;
        case '6':
            if (bg_img.path) {
                applyBgWithCache('6', buildBgUrl(bg_img.path, getBgApiKey()), bg_img, forceRefresh, done, gen);
            } else {
                done(false);
            }
            break;
        default:
            done(false);
    }
}

// ══════════════════════════════════════════════════════════════════
// 手动刷新（右上角按钮）
// ══════════════════════════════════════════════════════════════════

let isRefreshingBg = false;

function refreshBg() {
    if (isRefreshingBg) return;
    isRefreshingBg = true;

    const btn = $('#bg-refresh');
    const icon = btn.querySelector('.refresh-icon') || btn;
    icon.style.animation = 'spin-continuous 1s linear infinite';

    loadWallpaperByType(getBgImg().type, getBgImg(), true, () => {
        isRefreshingBg = false;
        icon.style.animation = '';
    });
}

// ══════════════════════════════════════════════════════════════════
// 比例自适应（ambient 模糊填充）
// ══════════════════════════════════════════════════════════════════

const BLANK_GIF_PREFIX = 'data:image/gif;base64,R0lGODlh';

// 修复：关闭 fit 后 1 秒才隐藏 ambient 层；若期间又重新开启，
// 旧定时器会把刚显示出来的层再藏掉。改为可取消的定时器。
let _fitHideTimer = null;

function applyFitMode(enabled) {
    const ambient = $('#bg-ambient');
    const ambientNew = $('#bg-ambient-new');
    clearTimeout(_fitHideTimer);
    if (enabled) {
        document.body.classList.add('bg-fit');
        const bgSrc = $('#bg').src || '';
        if (bgSrc && !bgSrc.startsWith(BLANK_GIF_PREFIX)) {
            Object.assign(ambient.style, {
                backgroundImage: `url("${bgSrc}")`, display: 'block', opacity: '1'
            });
        }
    } else {
        document.body.classList.remove('bg-fit');
        ambient.style.opacity = '0';
        ambientNew.style.opacity = '0';
        _fitHideTimer = setTimeout(() => {
            Object.assign(ambient.style, { display: 'none', backgroundImage: 'none' });
            Object.assign(ambientNew.style, { display: 'none', backgroundImage: 'none' });
        }, 1000);
    }
}

function syncAmbientBg() {
    if (!document.body.classList.contains('bg-fit')) return;
    const bgSrc = $('#bg').src || '';
    if (bgSrc && !bgSrc.startsWith(BLANK_GIF_PREFIX)) {
        Object.assign($('#bg-ambient').style, {
            backgroundImage: `url("${bgSrc}")`, display: 'block', opacity: '1'
        });
    }
}

// ══════════════════════════════════════════════════════════════════
// 初始化：两阶段加载
//   Phase 1（秒开）：缓存 base64 / 上次静态 URL / 本地兜底 → 揭幕
//   Phase 2（按需）：类型变更、开启随刷新更换或首次访问时换新图
// ══════════════════════════════════════════════════════════════════

async function initWallpaper() {
    const bg_img = getBgImg();
    const cachedData = await getCachedBgData();
    const lastUrl = getLastBgUrl();
    const bgEl = $('#bg');

    // ── Phase 1：确定首屏图并尽快揭幕 ────────────────────────────
    let initUrl = cachedData;
    if (!initUrl) {
        initUrl = (lastUrl && !isRandomApiUrl(lastUrl)) ? lastUrl : FALLBACK_BG_URL;
    }

    if (bgEl && initUrl) {
        bgEl.onerror = () => {
            bgEl.onerror = null;
            setWithFallback(bgEl, FALLBACK_BG_URL, []);
        };
        bgEl.src = initUrl;

        // decode() 完成或 300ms 超时即揭幕，避免长时间白屏
        let revealed = false;
        const revealOnce = () => { if (!revealed) { revealed = true; App.reveal(); } };
        const decodeTimeout = setTimeout(revealOnce, 300);
        (bgEl.decode ? bgEl.decode() : Promise.resolve())
            .catch(() => { })
            .finally(() => { clearTimeout(decodeTimeout); revealOnce(); });
    } else {
        App.reveal();
    }

    if (!lastUrl) setLastBgUrl(initUrl);

    // ── 设置面板 UI 状态恢复 ─────────────────────────────────────
    const radio = $(`input[name="wallpaper-type"][value="${bg_img.type}"]`);
    if (radio) radio.checked = true;
    const descEl = $('#wallpaper_text');
    if (descEl) descEl.textContent = (WALLPAPER_SOURCES[bg_img.type] || {}).desc || '';
    if (bg_img.type === '6') {
        $('#wallpaper-url').value = bg_img.path || '';
        if (getBgApiKey()) {
            $('#wallpaper-apikey').placeholder = 'API 密钥已保存（输入新值以更新）';
        }
        fadeIn($('#wallpaper_url'), 100);
    }
    $('#wallpaper-refresh-enable').checked = bg_img.refreshOnLoad === true;
    const fitEnabled = bg_img.bg_fit === true;
    $('#wallpaper-fit-enable').checked = fitEnabled;
    applyFitMode(fitEnabled);

    // ── Phase 2：判断是否要换新图 ────────────────────────────────
    const lastType = getLastBgType();
    const typeChanged = !!lastType && lastType !== bg_img.type;
    const refreshOnLoad = !!bg_img.refreshOnLoad;
    const firstVisit = !lastUrl;
    // 修复：此前只要 IndexedDB 里有缓存图就直接沿用，cacheDuration 的
    // 过期时间从未被消费——「每日必应」会永远停在第一次缓存的那张。
    // 现在缓存过期同样触发换新（loadWallpaperByType 会重新抓取并续期）。
    const cacheExpired = !isBgCacheValid(getBgCache(), bg_img);
    setLastBgType(bg_img.type);

    if (!typeChanged && !refreshOnLoad && !firstVisit && !cacheExpired) {
        // 无需换图：把真实壁纸交叉渐变上来（首屏可能是兜底图）
        if (cachedData) {
            applyBgNew(cachedData, false, null, lastUrl);
        } else if (lastUrl.startsWith('http')) {
            applyBgWithCache(bg_img.type, lastUrl, bg_img, false);
        } else if (lastUrl) {
            applyBgNew(lastUrl, false, null, lastUrl);
        }
        return;
    }

    // 需要换新：稍作延迟，让首屏先稳定呈现
    // （回调内重读配置：万一用户在延迟窗口内已改设置，不用启动时的过期快照）
    setTimeout(() => {
        const cur = getBgImg();
        loadWallpaperByType(cur.type, cur, refreshOnLoad);
    }, (refreshOnLoad || firstVisit) ? 300 : 100);
}

// ══════════════════════════════════════════════════════════════════
// 模块初始化
// ══════════════════════════════════════════════════════════════════

App.initWallpaperModule = function () {
    $('#bg-refresh').addEventListener('click', refreshBg);
    window.addEventListener('resize', debounce(syncAmbientBg, 200));
    // 任何初始化异常都不应阻塞揭幕（utils 里另有 5 秒兜底，这里先行处理）
    initWallpaper().catch((e) => {
        console.warn('[wallpaper] 初始化异常:', e);
        App.reveal();
    });
};
