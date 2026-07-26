/* ============================================
 * Snavigation - Bookmarks
 * 书签面板：Tab 栏 + 内容全部数据驱动渲染
 * （首个 Tab 为用户可编辑的快捷方式，其余来自 STATIC_TABS）
 * 依赖：config.js, utils.js, storage.js
 * ============================================ */
'use strict';

// ══════════════════════════════════════════════════════════════════
// 图标：站点 favicon 优先，失败时降级为渐变首字母头像
// ══════════════════════════════════════════════════════════════════

const AVATAR_GRADIENTS = [
    'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)',  // 暖橙
    'linear-gradient(135deg, #4E54C8 0%, #8F94FB 100%)',  // 幻蓝
    'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',  // 翠绿
    'linear-gradient(135deg, #FC466B 0%, #3F5EFB 100%)',  // 玫靛
    'linear-gradient(135deg, #f857a6 0%, #ff5858 100%)'   // 绯红
];

function getDomain(url) {
    try { return new URL(url).hostname; } catch (e) { return ''; }
}

function gradientFor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

/**
 * 生成单个书签的 HTML
 * @param {string} url 目标地址
 * @param {string} title 名称
 * @param {boolean} isStatic 静态 Tab 项（样式类不同）
 * @param {number} [idx] 序号（驱动面板打开时的阶梯式入场动画）
 */
function bookmarkHtml(url, title, isStatic, idx) {
    const safeUrl = isValidUrl(url) ? escapeHtml(url) : '#';
    const safeTitle = escapeHtml(title);
    const domain = getDomain(url);
    const grad = gradientFor(title || '');
    // Array.from 按码点切分：emoji 等代理对字符不再被 charAt(0) 截成乱码
    const firstChar = escapeHtml((Array.from(title || '?')[0] || '?').toUpperCase());

    const fallback = `<div class="bookmark-icon-fallback" style="background:${grad};">${firstChar}</div>`;
    // 图标加载失败由模块级捕获监听接管，按「谷歌 s2 → 站点自身 /favicon.ico → 字母头像」逐级回退
    const iconHtml = domain
        ? `<div class="bookmark-icon-wrapper">` +
          `<img src="https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}"` +
          ` data-domain="${escapeHtml(domain)}" alt="" loading="lazy" referrerpolicy="no-referrer">` +
          `<div class="bookmark-icon-fallback" style="display:none;background:${grad};">${firstChar}</div></div>`
        : `<div class="bookmark-icon-wrapper">${fallback}</div>`;

    // title 提示：名称被省略号截断时悬停仍可读全名与去向
    return `<div class="${isStatic ? 'quicks' : 'quick'}" style="--i:${idx || 0};">` +
        `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" title="${safeTitle}${domain ? ' · ' + escapeHtml(domain) : ''}">` +
        `${iconHtml}<span class="bookmark-title-text">${safeTitle}</span></a></div>`;
}

// ══════════════════════════════════════════════════════════════════
// Tab 栏与内容渲染（原静态 HTML 约 150 行，现由数据统一生成）
// ══════════════════════════════════════════════════════════════════

/** 渲染 Tab 头（常用 + 静态 Tab） */
function renderTabBar() {
    const names = ['常用', ...STATIC_TABS.map((t) => t.name)];
    $('.mark .tab').innerHTML = names.map((name, i) =>
        `<div class="tab-item${i === 0 ? ' active' : ''}">${escapeHtml(name)}</div>`
    ).join('');
}

/** 渲染全部 Tab 内容容器 */
function renderTabPanels() {
    const staticPanels = STATIC_TABS.map((tab) =>
        `<div class="mainCont"><div class="quick-alls">` +
        tab.items.map((it, i) => bookmarkHtml(it.url, it.title, true, i)).join('') +
        `</div></div>`
    ).join('');
    $('.mark .products').innerHTML =
        `<div class="mainCont selected"><div class="quick-all"></div></div>` + staticPanels;
}

/** 渲染用户快捷方式（首个 Tab，含"添加"按钮）
 *  修复：添加按钮是无 href 的 <a>，不进入 Tab 焦点序，键盘用户无法
 *  从主页进入"新增快捷方式"；补 tabindex 并在下方绑定键盘触发 */
function quickData() {
    const keys = Object.keys(getQuickList());
    const list = getQuickList();
    const items = keys
        .map((key, i) => bookmarkHtml(list[key].url, list[key].title, false, i))
        .join('');
    $('.quick-all').innerHTML = items +
        `<div class="quick" style="--i:${keys.length};">` +
        `<a id="set-quick" class="quick-add-tile" role="button" tabindex="0" aria-label="添加快捷方式">` +
        `<i class="iconfont icon-tianjia-"></i></a></div>`;
}

// ══════════════════════════════════════════════════════════════════
// 模块初始化
// ══════════════════════════════════════════════════════════════════

/**
 * favicon 逐级回退。
 * 修复两点：内联 onerror 只有一级回退（谷歌服务在部分网络不可达时
 * 立即降级字母头像）；改为捕获阶段委托后，重渲染也无需重新绑定。
 */
function bindIconFallback(container) {
    container.addEventListener('error', (e) => {
        const img = e.target;
        if (!(img instanceof HTMLImageElement)) return;
        if (!img.closest('.bookmark-icon-wrapper')) return;
        const stage = Number(img.dataset.stage || 0);
        if (stage === 0 && img.dataset.domain) {
            img.dataset.stage = '1';
            img.src = `https://${img.dataset.domain}/favicon.ico`;
        } else {
            img.style.display = 'none';
            const fb = img.nextElementSibling;
            if (fb) fb.style.display = 'flex';
        }
    }, true); // error 事件不冒泡，必须用捕获
}

App.initBookmarksModule = function () {
    renderTabBar();
    renderTabPanels();
    quickData();
    bindIconFallback($('.mark .products'));

    // ── Tab 切换 ──────────────────────────────────────────────
    delegate($('.mark .tab'), 'click', '.tab-item', function () {
        const tabs = $$('.mark .tab .tab-item');
        const idx = tabs.indexOf(this);
        tabs.forEach((t, i) => t.classList.toggle('active', i === idx));
        $$('.products .mainCont').forEach((panel, i) => {
            panel.style.display = i === idx ? 'flex' : 'none';
        });
    });

    // ── 点击时间：开 / 关书签面板 ─────────────────────────────
    $('#time_text').addEventListener('click', () => {
        if ($('#content').classList.contains('box')) {
            App.closeBox();
            App.closeSet();
            blurWd();
        } else {
            App.openBox();
        }
    });

    // ── 主页 "+"：跳到设置里的快捷方式新增表单 ────────────────
    delegate($('.mark .products'), 'click', '#set-quick', () => {
        App.openSet();
        $('#set-quick-menu').click();
        $('.set_quick_list_add').click();
    });
    // 键盘触发（重渲染后依然有效：委托绑定在容器上）
    delegate($('.mark .products'), 'keydown', '#set-quick', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.click();
        }
    });
};
