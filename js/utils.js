/* ============================================
 * Snavigation - Utils
 * DOM 助手、通用工具、JSONP、下载、
 * 轻量 Toast / Confirm（替代 iziToast，零外部依赖）
 * 依赖：config.js
 * ============================================ */
'use strict';

// ══════════════════════════════════════════════════════════════════
// DOM 助手
// ══════════════════════════════════════════════════════════════════

/** 查询单个元素 */
const $ = (sel, root) => (root || document).querySelector(sel);
/** 查询全部元素（返回真数组） */
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

/**
 * 事件委托：在 root 上监听 type，仅当目标匹配 selector 时触发
 * handler 内 this 指向匹配到的元素
 */
function delegate(root, type, selector, handler) {
    root.addEventListener(type, (e) => {
        const match = e.target.closest(selector);
        if (match && root.contains(match)) handler.call(match, e);
    });
}

/** 显示 / 隐藏（display 级） */
const show = (el, display) => { if (el) el.style.display = display || 'block'; };
const hide = (el) => { if (el) el.style.display = 'none'; };
/** 可见性判断（同 jQuery :visible；offsetParent 对 fixed 元素恒为 null，不可用） */
const isVisible = (el) => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

/** 简易淡入 / 淡出（基于 opacity 过渡） */
function fadeIn(el, ms = 200, display = 'block') {
    if (!el) return;
    el.style.opacity = '0';
    el.style.display = display;
    requestAnimationFrame(() => {
        el.style.transition = `opacity ${ms}ms ease`;
        el.style.opacity = '1';
    });
}
function fadeOut(el, ms = 200) {
    if (!el || el.style.display === 'none') return;
    el.style.transition = `opacity ${ms}ms ease`;
    el.style.opacity = '0';
    setTimeout(() => { el.style.display = 'none'; el.style.transition = ''; }, ms);
}

// ══════════════════════════════════════════════════════════════════
// 通用工具
// ══════════════════════════════════════════════════════════════════

/** HTML 转义，防止 XSS */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/** 仅接受 http / https 的 URL 校验 */
function isValidUrl(str) {
    if (!str) return false;
    try {
        const url = new URL(String(str).trim());
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch (e) {
        return false;
    }
}

/** 安全 JSON 解析 */
function safeJsonParse(raw, fallback) {
    if (raw === null || raw === undefined || raw === '') return fallback;
    if (typeof raw !== 'string') return raw;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
}

/** 深拷贝（现代浏览器 structuredClone，回退 JSON） */
function cloneValue(value) {
    if (value === null || typeof value !== 'object') return value;
    if (typeof structuredClone === 'function') {
        try { return structuredClone(value); } catch (e) { /* fallthrough */ }
    }
    return JSON.parse(JSON.stringify(value));
}

/** 防抖 */
function debounce(fn, wait) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

/** JSONP 请求（用于百度搜索建议） */
let _jsonpSeq = 0;
function jsonp(url, cbParam = 'cb', timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const name = '__snav_jp' + (++_jsonpSeq);
        const script = document.createElement('script');
        const timer = setTimeout(() => { cleanup(); reject(new Error('jsonp timeout')); }, timeoutMs);
        function cleanup() {
            clearTimeout(timer);
            // 不能立即 delete：慢网下超时后脚本才返回并调用回调，会抛「xx is not a function」
            window[name] = () => { };
            setTimeout(() => { try { delete window[name]; } catch (e) { /* ignore */ } }, 60000);
            script.remove();
        }
        window[name] = (data) => { cleanup(); resolve(data); };
        script.onerror = () => { cleanup(); reject(new Error('jsonp error')); };
        script.src = url + (url.includes('?') ? '&' : '?') + cbParam + '=' + name;
        document.head.appendChild(script);
    });
}

/** 带超时的 fetch（fetch 本身没有超时，慢接口会让重试逻辑长期挂起） */
function fetchWithTimeout(url, opts = {}, timeoutMs = 10000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(url, Object.assign({}, opts, { signal: ctrl.signal }))
        .finally(() => clearTimeout(timer));
}

/** 将文本下载为文件 */
function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    try { a.click(); } finally {
        a.remove();
        URL.revokeObjectURL(url);
    }
}

// ══════════════════════════════════════════════════════════════════
// Toast / Confirm 组件（替代 iziToast：无 CDN、无阻塞、与站点玻璃风格一致）
// ══════════════════════════════════════════════════════════════════

const Toast = (() => {
    let container = null;

    function ensureContainer() {
        if (container) return container;
        container = document.createElement('div');
        container.className = 'toast-container';
        container.setAttribute('role', 'status');
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
        return container;
    }

    function dismiss(el) {
        if (!el || el.dataset.leaving) return;
        el.dataset.leaving = '1';
        el.classList.add('toast-leave');
        el.addEventListener('transitionend', () => el.remove(), { once: true });
        setTimeout(() => el.remove(), 400); // 兜底
    }

    /**
     * 显示轻提示
     * @param {string} message 内容
     * @param {{title?:string, timeout?:number}} [opts]
     */
    function showToast(message, opts = {}) {
        const root = ensureContainer();
        // 与原 displayMode:'replace' 一致：新提示顶替旧提示
        $$('.toast', root).forEach(dismiss);

        const el = document.createElement('div');
        el.className = 'toast';
        if (opts.title) {
            const t = document.createElement('strong');
            t.className = 'toast-title';
            t.textContent = opts.title;
            el.appendChild(t);
        }
        const msg = document.createElement('span');
        msg.textContent = message;
        el.appendChild(msg);
        root.appendChild(el);

        requestAnimationFrame(() => el.classList.add('toast-enter'));
        const timeout = opts.timeout === undefined ? 3000 : opts.timeout;
        if (timeout > 0) setTimeout(() => dismiss(el), timeout);
        return el;
    }

    /**
     * 确认框（替代 iziToast 按钮弹窗）
     * @param {string} message
     * @param {{confirmText?:string, cancelText?:string, timeout?:number}} [opts]
     * @returns {Promise<boolean>} 确认 true / 取消或超时 false
     */
    function confirm(message, opts = {}) {
        return new Promise((resolve) => {
            const root = ensureContainer();
            $$('.toast', root).forEach(dismiss);

            const el = document.createElement('div');
            el.className = 'toast toast-confirm';
            el.setAttribute('role', 'alertdialog');

            const msg = document.createElement('span');
            msg.textContent = message;
            el.appendChild(msg);

            const btns = document.createElement('div');
            btns.className = 'toast-buttons';
            let settled = false;
            // 修复：确认框把焦点抢到自己的按钮上，关闭后焦点落回 body，
            // 键盘用户回不到刚才操作的位置（如设置里的删除按钮）。
            // 记录弹出前的焦点元素，结束时若其仍在文档中则归还焦点
            const prevFocus = document.activeElement;
            const timer = setTimeout(() => finish(false), opts.timeout || 8000);
            // 修复：确认框弹出时按 Esc 此前会穿透到全局快捷键，把下层
            // 设置 / 书签面板关掉，确认框本身却纹丝不动。捕获阶段先于
            // 全局监听执行，在此拦截并将其解释为"取消"
            function onEsc(e) {
                if (e.key !== 'Escape') return;
                e.preventDefault();
                e.stopPropagation();
                finish(false);
            }
            window.addEventListener('keydown', onEsc, true);
            function finish(result) {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                window.removeEventListener('keydown', onEsc, true);
                dismiss(el);
                // 焦点归还（元素可能已随列表重渲染被移除，需判存活）
                if (prevFocus && prevFocus !== document.body &&
                    document.contains(prevFocus) && typeof prevFocus.focus === 'function') {
                    try { prevFocus.focus(); } catch (e) { /* ignore */ }
                }
                resolve(result);
            }
            const mkBtn = (text, result) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = text;
                b.addEventListener('click', () => finish(result));
                return b;
            };
            const confirmBtn = mkBtn(opts.confirmText || '确认', true);
            btns.appendChild(confirmBtn);
            btns.appendChild(mkBtn(opts.cancelText || '取消', false));
            el.appendChild(btns);
            root.appendChild(el);
            requestAnimationFrame(() => el.classList.add('toast-enter'));
            // 键盘可达：把焦点移到确认按钮上，回车确认、Tab 可切到取消。
            // 稍作延迟，避免"按住回车触发保存"的按键连发瞬间误触确认
            setTimeout(() => { if (!settled) confirmBtn.focus(); }, 250);
        });
    }

    return { show: showToast, confirm };
})();

// ══════════════════════════════════════════════════════════════════
// 页面揭幕（壁纸就绪或 5s 兜底后移除加载屏）
// ══════════════════════════════════════════════════════════════════

const App = window.App = window.App || {};

let _revealed = false;
App.reveal = function () {
    if (_revealed) return;
    _revealed = true;
    clearTimeout(App._revealTimer);
    document.body.classList.add('loaded');
    const loading = $('#loading-box');
    if (loading) loading.classList.add('loaded');
};
/** 兜底：脚本执行起 5 秒内必定揭幕，避免任何异常导致白屏 */
App._revealTimer = setTimeout(() => App.reveal(), 5000);
