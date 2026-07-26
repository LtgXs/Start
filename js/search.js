/* ============================================
 * Snavigation - Search
 * 搜索引擎切换（选择即记住）、下拉列表、
 * 百度联想建议（input 事件 + IME 组合保护 + 防抖 + 竞态保护）
 * 依赖：config.js, utils.js, storage.js
 * ============================================ */
'use strict';

// ══════════════════════════════════════════════════════════════════
// 搜索框焦点状态
// ══════════════════════════════════════════════════════════════════

function focusWd() {
    document.body.classList.add('onsearch');
}

function blurWd() {
    document.body.classList.remove('onsearch');
    const wd = $('.wd');
    // 同步移除元素焦点：否则 Esc 退出后输入框仍持有焦点，
    // 单键快捷键（isTyping 判定）全部失效，视觉状态与焦点状态脱节
    if (document.activeElement === wd) wd.blur();
    wd.value = '';
    hideKeywordsBox();
}

/** 引擎下拉开合统一入口：随开合同步 inert，
 *  修复：收起的下拉仅透明，列表项仍留在 Tab 焦点序里 */
function setEnginePanelOpen(open) {
    const panel = $('.search-engine');
    panel.classList.toggle('show', !!open);
    if ('inert' in panel) panel.inert = !open;
}

// ══════════════════════════════════════════════════════════════════
// 搜索历史（v1.7）：聚焦空搜索框时展示，与联想框共用容器与方向键循环
// ══════════════════════════════════════════════════════════════════

function hideKeywordsBox() {
    const box = $('#keywords');
    // 一并清空内容：历史视图里有可聚焦的小按钮（✕ / 清空），
    // 只摘 show 类会把它们留在焦点序里
    box.innerHTML = '';
    box.classList.remove('show');
}

/** 渲染搜索历史到联想容器；无历史或已关闭该功能时返回 false */
function renderSearchHistory() {
    if (App.prefs && App.prefs.searchHistory === false) return false;
    const hist = getSearchHistory();
    if (!hist.length) return false;
    const box = $('#keywords');
    box.innerHTML =
        `<div class="kw-history-head"><span>搜索历史</span>` +
        `<span class="kw-history-clear" role="button" tabindex="0" aria-label="清空搜索历史">清空</span></div>` +
        hist.map((v, i) =>
            `<div class="keyword kw-history" data-id="${i + 1}"><i class="iconfont icon-sousuo"></i>` +
            `<span class="kw-text">${escapeHtml(v)}</span>` +
            `<span class="kw-del" role="button" tabindex="0" aria-label="删除该条历史" title="删除">✕</span></div>`
        ).join('');
    box.dataset.length = String(hist.length);
    box.dataset.original = ''; // 方向键越过首尾时恢复空输入
    box.classList.add('show');
    return true;
}

// ══════════════════════════════════════════════════════════════════
// 联想建议（防抖 250ms + 序号竞态保护）
// ══════════════════════════════════════════════════════════════════

let _suggestSeq = 0;

async function fetchSuggestions() {
    const keyword = $('.wd').value.trim();
    const box = $('#keywords');
    if (!keyword) {
        // 清空输入：有历史则回到历史视图，否则收起
        _suggestSeq++; // 作废在途联想请求，避免迟到结果盖掉历史
        if (!renderSearchHistory()) hideKeywordsBox();
        return;
    }
    const seq = ++_suggestSeq;
    try {
        const data = await jsonp(
            'https://suggestion.baidu.com/su?wd=' + encodeURIComponent(keyword), 'cb'
        );
        if (seq !== _suggestSeq) return; // 已有更新的请求，丢弃过期结果
        const list = (data && data.s) || [];
        if (!list.length) {
            box.innerHTML = '';
            box.classList.remove('show');
            return;
        }
        box.innerHTML = list.map((val, i) =>
            `<div class="keyword" data-id="${i + 1}"><i class="iconfont icon-sousuo"></i>${escapeHtml(val)}</div>`
        ).join('');
        box.dataset.length = String(list.length);
        box.dataset.original = keyword; // 供方向键循环回"原始输入"状态
        box.classList.add('show');
    } catch (e) {
        if (seq !== _suggestSeq) return;
        box.innerHTML = '';
        box.classList.remove('show');
    }
}

const keywordReminder = debounce(fetchSuggestions, 250);

// ══════════════════════════════════════════════════════════════════
// 搜索表单与引擎列表渲染
// ══════════════════════════════════════════════════════════════════

/**
 * 把默认（或选中）搜索引擎应用到表单。
 * 修复：GET 表单提交时，action 里自带的查询参数会被表单数据整体替换——
 * 诸如 https://www.google.com/search?tbm=isch 这类含固定参数的自定义引擎，
 * 提交后参数被静默丢弃。现将 action 的原有参数拆成隐藏字段随表单一起提交。
 */
function applySearchEngine(engine) {
    if (!engine) return;
    const form = $('.search');
    $$('.se-extra-param', form).forEach((el) => el.remove()); // 清理上一引擎的注入参数
    let action = engine.url;
    try {
        const u = new URL(engine.url);
        if (u.search) {
            action = u.origin + u.pathname;
            u.searchParams.forEach((v, k) => {
                if (k === engine.name) return; // 搜索词字段以输入框为准
                const hidden = document.createElement('input');
                hidden.type = 'hidden';
                hidden.className = 'se-extra-param';
                hidden.name = k;
                hidden.value = v;
                form.appendChild(hidden);
            });
        }
    } catch (e) { /* 非法 URL：保持原样交给浏览器处理 */ }
    form.setAttribute('action', action);
    $('#icon-se').className = engine.icon;
    $('.wd').setAttribute('name', engine.name);
}

function searchData() {
    const list = getSeList();
    // 存储的默认项可能已被删除 / 数据损坏，回落到第一项，避免表单停留在失效引擎上；
    // 同时把默认键自愈回写，否则设置面板与下拉高亮会一直指向不存在的幽灵项
    let key = getSeDefault();
    if (!list[key]) {
        key = Object.keys(list)[0];
        if (key) setSeDefault(key);
    }
    applySearchEngine(list[key]);
}

/** 渲染搜索引擎下拉列表（当前使用项高亮）
 *  修复：列表项此前是纯 div，键盘用户能用 Enter 打开下拉，却无法选中任何
 *  引擎；现在每项可 Tab 聚焦并用 Enter / 空格选择 */
function seList() {
    const list = getSeList();
    const current = getSeDefault();
    $('.search-engine-list').innerHTML = Object.keys(list).map((key) => {
        const item = list[key];
        const safeKey = escapeHtml(key);
        const icon = escapeHtml(item.icon);
        const title = escapeHtml(item.title);
        return `<div class="se-li${key === current ? ' active' : ''}" data-key="${safeKey}"` +
            ` role="button" tabindex="0" aria-label="使用${title}搜索">` +
            `<a class="se-li-text"><i class="icon-sou-list ${icon}"></i><span>${title}</span></a></div>`;
    }).join('');
}

// ══════════════════════════════════════════════════════════════════
// 模块初始化
// ══════════════════════════════════════════════════════════════════

App.initSearchModule = function () {
    searchData();
    seList();
    setEnginePanelOpen(false); // 初始收起：同步 inert，移出焦点序

    const wd = $('.wd');
    const form = $('.search');
    const enginePanel = $('.search-engine');
    const keywordsBox = $('#keywords');
    const seBtn = $('.se');
    const sou = $('.sou');

    // ── 全局点击：控制下拉与联想框的展开 / 收起 ────────────────
    document.addEventListener('click', (e) => {
        // 修复：点历史词的 ✕ 时面板会整体消失——内层删除处理器先重渲染
        // 列表，事件冒泡到这里时 target 已从文档中摘除，contains 判定
        // 一律为 false，被误判成"点击了面板外部"而收起联想框
        if (!e.target.isConnected) return;
        if (seBtn.contains(e.target)) {
            // 点击引擎图标：切换引擎面板，收起联想
            setEnginePanelOpen(!enginePanel.classList.contains('show'));
            hideKeywordsBox();
        } else if (!enginePanel.contains(e.target)) {
            setEnginePanelOpen(false);
        }
        if (!sou.contains(e.target)) {
            hideKeywordsBox();
        }
    });

    // ── 选中搜索引擎：立即应用并持久化（下次打开保持所选） ─────
    delegate($('.search-engine-list'), 'click', '.se-li', function () {
        const key = this.dataset.key;
        const engine = getSeList()[key];
        if (!engine) return;
        setSeDefault(key);
        applySearchEngine(engine);
        seList(); // 刷新高亮
        setEnginePanelOpen(false);
        // 选完引擎顺手把光标交还输入框：此前会停在"搜索态但无焦点"的
        // 悬空状态，得再点一次输入框才能打字
        wd.focus();
    });
    // 键盘选择引擎（Enter / 空格）
    delegate($('.search-engine-list'), 'keydown', '.se-li', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.click();
        }
    });

    // ── 进入搜索态 ─────────────────────────────────────────────
    sou.addEventListener('click', (e) => {
        focusWd();
        // 点击搜索胶囊的空白区域也把光标交给输入框
        if (e.target.closest('.all-search') && !e.target.closest('.se, .sou-button')) {
            wd.focus();
        }
    });

    // 修复：Tab / 快捷键等非点击途径聚焦时也要进入搜索态，
    // 否则空查询回车会直接提交到搜索引擎
    wd.addEventListener('focus', () => {
        focusWd();
        if (wd.value.trim()) keywordReminder();
        else renderSearchHistory(); // 空输入聚焦：展示搜索历史（若有）
    });

    // ── 遮罩层点击：关闭搜索 / 设置 / 书签面板 ─────────────────
    $('.close_sou').addEventListener('click', () => {
        blurWd();
        App.closeSet(); // 设置打开时（含图标复位）
        App.closeBox(); // 仅书签面板打开时
    });

    // ── 输入联想 ───────────────────────────────────────────────
    // 修复：旧版监听 keyup，中文输入法组合过程中的拼音也会触发请求，
    // Escape / Enter 等控制键同样会触发。改用 input 事件并在组合期间挂起。
    let composing = false;
    wd.addEventListener('compositionstart', () => { composing = true; });
    wd.addEventListener('compositionend', () => { composing = false; keywordReminder(); });
    wd.addEventListener('input', () => { if (!composing) keywordReminder(); });

    // ── 提交兜底：空查询不提交，提交前去除首尾空白并收起联想 ───
    form.addEventListener('submit', (e) => {
        const v = wd.value.trim();
        if (!v) { e.preventDefault(); return; }
        wd.value = v;
        if (!App.prefs || App.prefs.searchHistory !== false) addSearchHistory(v);
        hideKeywordsBox();
    });

    // ── 点击联想词 / 历史词直接搜索 ────────────────────────────
    delegate(keywordsBox, 'click', '.keyword', function (e) {
        if (e.target.closest('.kw-del')) return; // 删除按钮另有归属
        const t = $('.kw-text', this);           // 历史项的词在 .kw-text 里
        wd.value = t ? t.textContent : this.textContent;
        $('#search-submit').click();
    });

    // ── 历史条目删除 / 全部清空 ────────────────────────────────
    delegate(keywordsBox, 'click', '.kw-del', function (e) {
        e.stopPropagation(); // 删除即重渲染，不让全局收起逻辑再看到已摘除的旧节点
        const t = $('.kw-text', this.closest('.keyword'));
        if (t) setSearchHistory(getSearchHistory().filter((s) => s !== t.textContent));
        if (!renderSearchHistory()) hideKeywordsBox();
    });
    delegate(keywordsBox, 'click', '.kw-history-clear', function () {
        clearSearchHistory();
        hideKeywordsBox();
        Toast.show('搜索历史已清空', { timeout: 1500 });
    });
    // 历史面板内的小按钮键盘可达
    delegate(keywordsBox, 'keydown', '.kw-del, .kw-history-clear', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.click();
        }
    });

    // ── 方向键在联想词 / 历史词间移动（循环含"原始输入"位）──────
    wd.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        if (e.isComposing) return;                           // 组合中方向键归输入法
        if (!keywordsBox.classList.contains('show')) return; // 面板未展开时不劫持
        const length = parseInt(keywordsBox.dataset.length, 10);
        if (!length) return;
        e.preventDefault();

        const current = $('.keyword.choose', keywordsBox);
        let id = current ? parseInt(current.dataset.id, 10) : 0;
        id += (e.key === 'ArrowDown' ? 1 : -1);
        // 0 = 原始输入位：向下越过最后一项、或从第一项向上时，
        // 恢复用户自己键入的关键词而非硬性跳到另一端（与主流搜索框一致）
        if (id > length) id = 0;
        if (id < 0) id = length;

        $$('.keyword', keywordsBox).forEach((el) => {
            el.classList.toggle('choose', id !== 0 && el.dataset.id === String(id));
        });
        if (id === 0) {
            // 历史视图的原始输入是空串，需用 ?? 而非 ||，否则恢复不回去
            wd.value = keywordsBox.dataset.original ?? wd.value;
        } else {
            const chosen = $(`.keyword[data-id="${id}"]`, keywordsBox);
            if (chosen) wd.value = ($('.kw-text', chosen) || chosen).textContent;
        }
    });
};
