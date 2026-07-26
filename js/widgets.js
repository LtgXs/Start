/* ============================================
 * Snavigation - Widgets（v1.7 新增）
 * 一言卡片、倒数日、背景视差，以及全局偏好快照
 * 依赖：config.js, utils.js, storage.js
 * ============================================ */
'use strict';

// 偏好快照：模块加载即就绪（storage.js 已前置加载），
// 供时钟 / 搜索历史 / 问候等模块同步读取，避免层层传参
App.prefs = getPrefs();

/** 更新单项偏好并持久化 */
App.setPref = function (key, value) {
    App.prefs[key] = value;
    setPrefs(App.prefs);
};

// ══════════════════════════════════════════════════════════════════
// 一言卡片：接口在线取句，离线回落本地语录；点击复制、按钮换一条
// ══════════════════════════════════════════════════════════════════

let _hitokotoBusy = false;

function renderHitokoto(item, save) {
    if (!item || !item.text) return;
    $('#hitokoto-text').textContent = item.text;
    $('#hitokoto-from').textContent = item.from ? '—— ' + item.from : '';
    // 记住本次内容：下次打开先展示上一句（秒开），再后台换新
    if (save) lsSet(STORAGE_KEYS.hitokotoLast, JSON.stringify({ text: item.text, from: item.from || '' }));
}

function pickFallbackHitokoto(excludeText) {
    const pool = HITOKOTO_FALLBACK.filter((q) => q.text !== excludeText);
    const list = pool.length ? pool : HITOKOTO_FALLBACK;
    return list[Math.floor(Math.random() * list.length)];
}

async function fetchHitokoto() {
    for (const api of HITOKOTO_API) {
        try {
            const res = await fetchWithTimeout(api, {}, 6000);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (data && data.hitokoto) {
                return { text: data.hitokoto, from: data.from_who || data.from || '' };
            }
        } catch (e) { /* 换下一个源 */ }
    }
    return null;
}

async function refreshHitokoto(manual) {
    if (_hitokotoBusy) return;
    _hitokotoBusy = true;
    const btn = $('#hitokoto-refresh');
    if (manual && btn) btn.style.animation = 'spin-continuous 0.8s linear infinite';
    const current = $('#hitokoto-text').textContent;
    const item = (await fetchHitokoto()) || pickFallbackHitokoto(current);
    renderHitokoto(item, true);
    if (btn) btn.style.animation = '';
    _hitokotoBusy = false;
}

function applyHitokotoVisible(on) {
    const card = $('#hitokoto');
    if (!card) return;
    if (on) {
        const last = safeJsonParse(localStorage.getItem(STORAGE_KEYS.hitokotoLast), null);
        renderHitokoto(last || pickFallbackHitokoto(), false);
        show(card, 'flex');
        refreshHitokoto(false);
    } else {
        hide(card);
    }
}

async function copyHitokoto() {
    const text = $('#hitokoto-text').textContent;
    const from = $('#hitokoto-from').textContent;
    const full = from ? `${text} ${from}` : text;
    let ok = false;
    try {
        await navigator.clipboard.writeText(full);
        ok = true;
    } catch (e) {
        // 剪贴板 API 不可用（旧浏览器 / 权限受限）时回退 execCommand
        try {
            const ta = document.createElement('textarea');
            ta.value = full;
            ta.style.cssText = 'position:fixed;opacity:0;';
            document.body.appendChild(ta);
            ta.select();
            ok = document.execCommand('copy');
            ta.remove();
        } catch (e2) { /* ignore */ }
    }
    Toast.show(ok ? '已复制到剪贴板' : '复制失败，请长按 / 选中文字手动复制', { timeout: 1500 });
}

// ══════════════════════════════════════════════════════════════════
// 倒数日：显示在日期下方的小胶囊，点击进设置编辑
// ══════════════════════════════════════════════════════════════════

/** 目标日与今天的整天差（未来为正、今天为 0、过去为负；非法日期返回 null） */
function daysUntil(dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
    if (!m) return null;
    const target = new Date(+m[1], +m[2] - 1, +m[3]);
    if (isNaN(target.getTime())) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target - today) / 86400000);
}

let _countdownCache = null; // 渲染缓存：时钟每次心跳都会调用，内容没变就不动 DOM

function renderCountdown(force) {
    const pill = $('#countdown-pill');
    if (!pill) return;
    const title = App.prefs.countdownTitle;
    const days = daysUntil(App.prefs.countdownDate);
    let html = '';
    if (title && days !== null) {
        const safe = escapeHtml(title);
        if (days > 0) html = `距 <b>${safe}</b> 还有 <b>${days}</b> 天`;
        else if (days === 0) html = `<b>${safe}</b> 就是今天 🎉`;
        else html = `<b>${safe}</b> 已过去 <b>${-days}</b> 天`;
    }
    if (!force && html === _countdownCache) return;
    _countdownCache = html;
    if (!html) { hide(pill); return; }
    pill.innerHTML = html;
    show(pill, 'inline-flex');
}

// ══════════════════════════════════════════════════════════════════
// 背景视差：鼠标位置驱动 CSS 变量，背景反向轻移（rAF 节流）
// 自动跳过：触屏设备、系统「减少动态效果」偏好
// ══════════════════════════════════════════════════════════════════

function applyParallaxEnabled(on) {
    document.body.classList.toggle('parallax-on', !!on);
    if (!on) {
        document.documentElement.style.setProperty('--par-x', '0px');
        document.documentElement.style.setProperty('--par-y', '0px');
    }
}

function initParallax() {
    if (!window.matchMedia) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!matchMedia('(pointer: fine)').matches) return;
    let raf = 0;
    window.addEventListener('mousemove', (e) => {
        if (!App.prefs.parallax || raf) return;
        raf = requestAnimationFrame(() => {
            raf = 0;
            // 回调内需再验一次开关：移动瞬间关闭偏好时，
            // 已排队的这帧不该在归零之后又写入一个旧偏移
            if (!App.prefs.parallax) return;
            const nx = e.clientX / window.innerWidth - 0.5;  // -0.5 ~ 0.5
            const ny = e.clientY / window.innerHeight - 0.5;
            document.documentElement.style.setProperty('--par-x', (nx * -16).toFixed(1) + 'px');
            document.documentElement.style.setProperty('--par-y', (ny * -10).toFixed(1) + 'px');
        });
    }, { passive: true });
}

// ══════════════════════════════════════════════════════════════════
// 模块初始化
// ══════════════════════════════════════════════════════════════════

App.initWidgetsModule = function () {
    // 一言卡片
    applyHitokotoVisible(App.prefs.hitokoto !== false);
    $('#hitokoto').addEventListener('click', (e) => {
        if (e.target.closest('#hitokoto-refresh')) return; // 刷新按钮单独处理
        copyHitokoto();
    });
    $('#hitokoto-refresh').addEventListener('click', () => refreshHitokoto(true));

    // 倒数日
    renderCountdown(true);
    $('#countdown-pill').addEventListener('click', () => {
        App.openSet();
        const prefTab = $('#set-pref-menu');
        if (prefTab) prefTab.click();
    });

    // 背景视差
    applyParallaxEnabled(App.prefs.parallax !== false);
    initParallax();
};
