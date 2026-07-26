/* ============================================
 * Snavigation - Settings
 * 设置面板：搜索引擎 / 快捷方式 CRUD、壁纸选项、数据备份
 * 依赖：config.js, utils.js, storage.js, search.js,
 *       bookmarks.js, wallpaper.js
 * ============================================ */
'use strict';

// ══════════════════════════════════════════════════════════════════
// 面板开关（挂到 App 供各模块调用）
// ══════════════════════════════════════════════════════════════════

/** 修复：收起的面板此前仅透明并未离场，内部几十个链接 / 按钮 / 输入框
 *  仍占据 Tab 焦点序——键盘用户会依次聚焦到一整片看不见的控件。
 *  用 inert 把隐藏面板整体移出焦点序与无障碍树（不支持的老浏览器
 *  自动退化为旧行为，不影响功能） */
function setInert(sel, value) {
    const el = $(sel);
    if (el && 'inert' in el) el.inert = value;
}

App.openBox = function () {
    $('#content').classList.add('box');
    $('.mark').classList.add('show');
    setInert('.mark', false);
    setInert('.sou', true); // 面板态下透明的搜索框不该再被聚焦
};

/** 面板关闭时若焦点还留在面板内部控件上，主动释放——
 *  否则键盘焦点困在一块已不可见的区域里（也会让单选/输入态误判持续） */
function blurIfInside(sel) {
    const ae = document.activeElement;
    if (ae && ae.closest && ae.closest(sel)) ae.blur();
}

App.closeBox = function () {
    blurIfInside('.mark');
    $('#content').classList.remove('box');
    $('.mark').classList.remove('show');
    setInert('.mark', true);
    setInert('.sou', false);
};

App.openSet = function () {
    $('#menu').classList.add('on');
    App.openBox();
    $('#icon-menu').className = 'iconfont icon-home';
    $('.mark').classList.remove('show');
    setInert('.mark', true);
    $('.set').classList.add('show');
    setInert('.set', false);
    renderSeSettings();
    renderQuickSettings();
};

App.closeSet = function () {
    if (!$('#menu').classList.contains('on')) return;
    blurIfInside('.set');
    $('#menu').classList.remove('on');
    App.closeBox();
    $('#icon-menu').className = 'iconfont icon-shezhi';
    $('.set').classList.remove('show');
    setInert('.set', true);
    // 修复：新增 / 编辑表单打开时关闭设置，重开会看到残留的半填表单、
    // 列表仍被隐藏。关闭面板时统一复位到列表视图
    toggleSeList(true);
    toggleQuickList(true);
    // 设置可能已变更 → 刷新主页数据
    // （修复：此前漏掉 searchData()，编辑默认引擎的 URL 后表单 action 仍是旧值）
    searchData();
    seList();
    quickData();
};

// ── 表单 / 列表显隐（回到列表视图时连表单值一并清空，不留残稿）────
function toggleSeList(visible) {
    const disp = visible ? '' : 'none';
    $('.se_list').style.display = disp;
    $('.se_add_preinstall').style.display = disp;
    if (visible) {
        hide($('.se_add_content'));
        $$('.se_add_content input').forEach((i) => { i.value = ''; });
    }
}
function toggleQuickList(visible) {
    const disp = visible ? '' : 'none';
    $('.quick_list').style.display = disp;
    $('.se_add_preinstalls').style.display = disp;
    if (visible) {
        hide($('.quick_add_content'));
        $$('.quick_add_content input').forEach((i) => { i.value = ''; });
    }
}

// ══════════════════════════════════════════════════════════════════
// 列表渲染
// ══════════════════════════════════════════════════════════════════

function renderSeSettings() {
    const seDefault = getSeDefault();
    const list = getSeList();
    $('.se_list_table').innerHTML = Object.keys(list).map((key) => {
        const safeKey = escapeHtml(key);
        const numCell = key === seDefault
            ? `<i class="iconfont icon-home"></i>`
            : safeKey;
        return `<div class="se_list_div">` +
            `<div class="se_list_num">${numCell}</div>` +
            `<div class="se_list_name">${escapeHtml(list[key].title)}</div>` +
            `<div class="se_list_button">` +
            `<button class="set_se_default" value="${safeKey}" style="border-radius:8px 0 0 8px;" aria-label="设为默认"><i class="iconfont icon-home"></i></button>` +
            `<button class="edit_se" value="${safeKey}" aria-label="编辑"><i class="iconfont icon-xiugai"></i></button>` +
            `<button class="delete_se" value="${safeKey}" style="border-radius:0 8px 8px 0;" aria-label="删除"><i class="iconfont icon-delete"></i></button>` +
            `</div></div>`;
    }).join('');
}

function renderQuickSettings() {
    const list = getQuickList();
    $('.quick_list_table').innerHTML = Object.keys(list).map((key) => {
        const safeKey = escapeHtml(key);
        return `<div class="quick_list_div">` +
            `<div class="quick_list_div_num">${safeKey}</div>` +
            `<div class="quick_list_div_name">${escapeHtml(list[key].title)}</div>` +
            `<div class="quick_list_div_button">` +
            `<button class="edit_quick" value="${safeKey}" style="border-radius:8px 0 0 8px;" aria-label="编辑"><i class="iconfont icon-xiugai"></i></button>` +
            `<button class="delete_quick" value="${safeKey}" style="border-radius:0 8px 8px 0;" aria-label="删除"><i class="iconfont icon-delete"></i></button>` +
            `</div></div>`;
    }).join('');
}

// ══════════════════════════════════════════════════════════════════
// 通用 CRUD 保存流程（搜索引擎 / 快捷方式共用骨架）
// ══════════════════════════════════════════════════════════════════

/**
 * 校验并保存一条记录
 * @param {object} p { formSel, keyMax, buildItem, getList, setList, rerender,
 *                     closeForm, label, validate?, afterSave? }
 */
async function saveEntry(p) {
    const val = (name) => $(`${p.formSel} input[name="${name}"]`).value.trim();
    const keyInhere = val('key_inhere');
    const rawKey = val('key');
    const url = val('url');

    if (!/^\+?[1-9][0-9]*$/.test(rawKey) || parseInt(rawKey, 10) > p.keyMax) {
        Toast.show(`序号 ${rawKey || '(空)'} 需为 1 ~ ${p.keyMax} 的正整数`, { timeout: 2000 });
        return;
    }
    // 规范化序号（修复：输入 "+5" 会以字符串 "+5" 存储，与 "5" 并存为两条）
    const key = String(parseInt(rawKey, 10));
    if (!isValidUrl(url)) {
        Toast.show('请输入有效的 URL（以 http/https 开头）', { timeout: 2000 });
        return;
    }
    // 各类记录的额外校验（修复：此前可保存空名称 / 空字段名的条目）
    if (p.validate) {
        const err = p.validate(val);
        if (err) {
            Toast.show(err, { timeout: 2500 });
            return;
        }
    }

    const list = p.getList();
    const item = p.buildItem(val, list, keyInhere);

    // 覆盖已有序号需确认（编辑自身除外）
    if (list[key] && key !== keyInhere) {
        const ok = await Toast.confirm(`${p.label} ${key} 已有数据，是否覆盖？`);
        if (!ok) return;
    }
    if (keyInhere && key !== keyInhere) delete list[keyInhere];
    list[key] = item;
    p.setList(list);
    if (p.afterSave) p.afterSave(key, keyInhere); // 在重渲染前执行（可能修正默认项指向）
    p.rerender();
    p.closeForm();
    Toast.show('保存成功', { timeout: 2000 });
}

// ══════════════════════════════════════════════════════════════════
// 模块初始化：绑定所有设置面板事件
// ══════════════════════════════════════════════════════════════════

App.initSettingsModule = function () {

    // 初始均为收起状态：移出焦点序（见 setInert 说明）
    setInert('.mark', true);
    setInert('.set', true);

    // ── 设置面板选项卡切换 ────────────────────────────────────
    delegate($('.set .tabs'), 'click', '.tab-items', function () {
        const tabs = $$('.set .tabs .tab-items');
        const idx = tabs.indexOf(this);
        tabs.forEach((t, i) => t.classList.toggle('actives', i === idx));
        $$('.productss .mainConts').forEach((panel, i) => {
            panel.style.display = i === idx ? 'flex' : 'none';
        });
    });

    // ── 菜单按钮：开 / 关设置 ─────────────────────────────────
    $('#menu').addEventListener('click', () => {
        $('#menu').classList.contains('on') ? App.closeSet() : App.openSet();
    });

    // ═══════════════════ 搜索引擎 ═══════════════════

    delegate($('.se_list_table'), 'click', '.set_se_default', async function () {
        const key = this.value;
        if (await Toast.confirm('是否设置为默认搜索引擎？')) {
            setSeDefault(key);
            renderSeSettings();
            searchData(); // 即时生效，无需整页刷新
            seList();
            Toast.show('设置成功');
        }
    });

    $('.set_se_list_add').addEventListener('click', () => {
        $$('.se_add_content input').forEach((i) => { if (!i.disabled) i.value = ''; });
        toggleSeList(false);
        $('.se_add_content').style.display = 'flex';
    });

    $('.se_add_save').addEventListener('click', () => saveEntry({
        formSel: '.se_add_content',
        keyMax: 20,
        label: '搜索引擎',
        // 修复：空字段名的输入框不会随表单提交，搜索词根本带不进 URL，
        // 保存这样的引擎等于保存了一个"永远搜不到东西"的引擎
        validate: (val) => {
            if (!val('title')) return '请填写搜索引擎名称';
            if (!val('name')) return '请填写字段名（URL 中 ? 后携带搜索词的参数名，如 wd、q）';
            if (/[\s=&#?]/.test(val('name'))) return '字段名不能包含空格或 = & # ? 字符';
            return null;
        },
        // 编辑既有条目时保留其原图标（修复：编辑「百度」等预设后图标被覆盖成通用网络图标）
        buildItem: (val, list, keyInhere) => ({
            title: val('title'), url: val('url'), name: val('name'),
            icon: (keyInhere && list[keyInhere] && list[keyInhere].icon) || 'iconfont icon-wangluo'
        }),
        // 修复：编辑默认引擎并改动其序号后，se_default 仍指向已不存在的旧键，
        // 随后的自愈回落会把默认引擎悄悄改成列表第一项。默认标记应跟随移动。
        afterSave: (key, keyInhere) => {
            if (keyInhere && key !== keyInhere && getSeDefault() === keyInhere) {
                setSeDefault(key);
            }
        },
        getList: getSeList,
        setList: setSeList,
        rerender: () => { renderSeSettings(); searchData(); seList(); },
        closeForm: () => toggleSeList(true)
    }));

    $('.se_add_cancel').addEventListener('click', () => toggleSeList(true));

    delegate($('.se_list'), 'click', '.edit_se', function () {
        const list = getSeList();
        const key = this.value;
        const item = list[key];
        if (!item) return;
        const set = (name, v) => { $(`.se_add_content input[name="${name}"]`).value = v || ''; };
        set('key_inhere', key);
        set('key', key);
        set('title', item.title);
        set('url', item.url);
        set('name', item.name);
        toggleSeList(false);
        $('.se_add_content').style.display = 'flex';
    });

    delegate($('.se_list'), 'click', '.delete_se', async function () {
        const key = this.value;
        if (key === getSeDefault()) {
            Toast.show('默认搜索引擎不可删除');
            return;
        }
        if (await Toast.confirm(`搜索引擎 ${key} 是否删除？`)) {
            const list = getSeList();
            delete list[key];
            setSeList(list);
            renderSeSettings();
            searchData();
            seList();
            Toast.show('删除成功');
        }
    });

    $('.set_se_list_preinstall').addEventListener('click', async () => {
        if (await Toast.confirm('现有搜索引擎数据将被清空')) {
            setSeList(cloneValue(SE_PRESET));
            setSeDefault('1');
            renderSeSettings();
            searchData(); // 即时生效，无需整页刷新
            seList();
            Toast.show('重置成功');
        }
    });

    // ═══════════════════ 快捷方式 ═══════════════════

    $('.set_quick_list_add').addEventListener('click', () => {
        $$('.quick_add_content input').forEach((i) => { i.value = ''; });
        toggleQuickList(false);
        $('.quick_add_content').style.display = 'flex';
    });

    $('.quick_add_save').addEventListener('click', () => saveEntry({
        formSel: '.quick_add_content',
        keyMax: 99,
        label: '快捷方式',
        validate: (val) => (val('title') ? null : '请填写网站名称'),
        buildItem: (val) => ({ title: val('title'), url: val('url') }),
        getList: getQuickList,
        setList: setQuickList,
        rerender: renderQuickSettings,
        closeForm: () => toggleQuickList(true)
    }));

    $('.quick_add_cancel').addEventListener('click', () => toggleQuickList(true));

    delegate($('.quick_list'), 'click', '.edit_quick', function () {
        const list = getQuickList();
        const key = this.value;
        const item = list[key];
        if (!item) return;
        const set = (name, v) => { $(`.quick_add_content input[name="${name}"]`).value = v || ''; };
        set('key_inhere', key);
        set('key', key);
        set('title', item.title);
        set('url', item.url);
        toggleQuickList(false);
        $('.quick_add_content').style.display = 'flex';
    });

    delegate($('.quick_list'), 'click', '.delete_quick', async function () {
        const key = this.value;
        if (await Toast.confirm(`快捷方式 ${key} 是否删除？`)) {
            const list = getQuickList();
            delete list[key];
            setQuickList(list);
            renderQuickSettings();
            Toast.show('删除成功');
        }
    });

    $('.set_quick_list_preinstall').addEventListener('click', async () => {
        if (await Toast.confirm('快捷方式数据将被清空')) {
            setQuickList(cloneValue(QUICK_PRESET));
            renderQuickSettings();
            Toast.show('重置成功', { timeout: 2000 });
        }
    });

    // ═══════════════════ 壁纸设置 ═══════════════════

    // 选择即生效：切换类型 / 保存自定义 URL 后立即交叉渐变到新壁纸，
    // 不再要求整页刷新。seq 抑制快速连续切换时旧一轮的过期回调提示。
    let _wpApplySeq = 0;
    function applyWallpaperNow(bg_img) {
        const seq = ++_wpApplySeq;
        Toast.show('正在更换背景…', { timeout: 2000 });
        loadWallpaperByType(bg_img.type, bg_img, true, (ok) => {
            if (seq !== _wpApplySeq) return; // 已被更新的切换取代
            if (!ok) Toast.show('新壁纸加载失败，已保留当前背景', { timeout: 2500 });
        });
    }

    function resetWallpaperState() {
        clearBgCache();
        clearCachedBgData();
        localStorage.removeItem(STORAGE_KEYS.wallpaperLastUrl);
        localStorage.removeItem(STORAGE_KEYS.wallpaperLastType);
    }

    delegate($('#wallpaper'), 'click', '.set-wallpaper', function () {
        const type = this.value;
        const bg_img = getBgImg();
        const changed = bg_img.type !== type;

        $('#wallpaper_text').textContent = (WALLPAPER_SOURCES[type] || {}).desc || '';
        if (type === '6') {
            fadeIn($('#wallpaper_url'), 200);
            if (bg_img.path) $('#wallpaper-url').value = bg_img.path;
            if (getBgApiKey()) {
                $('#wallpaper-apikey').placeholder = 'API 密钥已保存（输入新值以更新）';
            }
        } else {
            fadeOut($('#wallpaper_url'), 200);
        }

        // 修复：点击当前已选中的选项只是查看说明，不应清空缓存与上次壁纸记录
        if (!changed) return;

        bg_img.type = type;
        setBgImg(bg_img);
        resetWallpaperState();
        if (type === '6') {
            // 自定义类型等 URL 填写保存后再应用
            if (!bg_img.path) Toast.show('请在下方填写图片地址并保存', { timeout: 2500 });
            else applyWallpaperNow(bg_img);
        } else {
            applyWallpaperNow(bg_img);
        }
    });

    $('.wallpaper_save').addEventListener('click', () => {
        const url = $('#wallpaper-url').value.trim();
        // {key} 占位符在校验时用假值替换
        if (!url || !isValidUrl(url.replace(/\{key\}/g, 'testkey'))) {
            Toast.show('请输入有效的图片 URL（以 http/https 开头）', { timeout: 2000 });
            return;
        }
        const bg_img = getBgImg();
        bg_img.type = '6';
        bg_img.path = url;
        setBgImg(bg_img);

        const apiKey = $('#wallpaper-apikey').value;
        if (apiKey) {
            setBgApiKey(apiKey);
            $('#wallpaper-apikey').value = '';
            $('#wallpaper-apikey').placeholder = 'API 密钥已保存（输入新值以更新）';
        }
        resetWallpaperState();
        applyWallpaperNow(bg_img);
    });

    $('#wallpaper-refresh-enable').addEventListener('change', function () {
        const bg_img = getBgImg();
        bg_img.refreshOnLoad = this.checked;
        setBgImg(bg_img);
        Toast.show(this.checked ? '已开启每次刷新更换背景，刷新生效' : '已关闭每次刷新更换背景');
    });

    $('#wallpaper-fit-enable').addEventListener('change', function () {
        const bg_img = getBgImg();
        bg_img.bg_fit = this.checked;
        setBgImg(bg_img);
        applyFitMode(this.checked);
        Toast.show(this.checked ? '已开启比例自适应（完整显示 + 模糊填充）' : '已关闭比例自适应（铺满裁剪）');
    });

    // ═══════════════════ 偏好设置（v1.7） ═══════════════════

    // 开关型偏好：恢复已存状态 + 变更即存即生效
    const bindPrefToggle = (sel, key, onChange) => {
        const el = $(sel);
        if (!el) return;
        el.checked = App.prefs[key] === true;
        el.addEventListener('change', function () {
            App.setPref(key, this.checked);
            if (onChange) onChange(this.checked);
        });
    };

    bindPrefToggle('#pref-hitokoto', 'hitokoto', (on) => {
        applyHitokotoVisible(on);
        Toast.show(on ? '已开启一言卡片' : '已关闭一言卡片', { timeout: 1500 });
    });
    bindPrefToggle('#pref-seconds', 'clockSeconds', (on) => {
        App.restartClock();
        Toast.show(on ? '时钟已显示秒' : '时钟已隐藏秒', { timeout: 1500 });
    });
    bindPrefToggle('#pref-parallax', 'parallax', (on) => {
        applyParallaxEnabled(on);
        Toast.show(on ? '已开启背景视差' : '已关闭背景视差', { timeout: 1500 });
    });
    bindPrefToggle('#pref-greeting', 'greeting', (on) => {
        Toast.show(on ? '已开启启动问候' : '已关闭启动问候，下次打开生效', { timeout: 1500 });
    });
    bindPrefToggle('#pref-history', 'searchHistory', (on) => {
        if (!on) hideKeywordsBox(); // 正显示着历史面板时立即收起
        Toast.show(on ? '已开启搜索历史记录' : '已关闭搜索历史记录', { timeout: 1500 });
    });

    $('#pref-history-clear').addEventListener('click', async () => {
        if (await Toast.confirm('确定清空全部搜索历史？')) {
            clearSearchHistory();
            hideKeywordsBox();
            Toast.show('搜索历史已清空', { timeout: 1500 });
        }
    });

    // 倒数日
    $('#countdown-title-input').value = App.prefs.countdownTitle || '';
    $('#countdown-date-input').value = App.prefs.countdownDate || '';
    $('.countdown_save').addEventListener('click', () => {
        const title = $('#countdown-title-input').value.trim();
        const date = $('#countdown-date-input').value;
        if (!title || !date) {
            Toast.show('请填写名称并选择日期', { timeout: 2000 });
            return;
        }
        if (Array.from(title).length > 12) {
            Toast.show('名称请控制在 12 字以内', { timeout: 2000 });
            return;
        }
        App.setPref('countdownTitle', title);
        App.setPref('countdownDate', date);
        renderCountdown(true);
        Toast.show('倒数日已保存', { timeout: 1500 });
    });
    $('.countdown_clear').addEventListener('click', () => {
        App.setPref('countdownTitle', '');
        App.setPref('countdownDate', '');
        $('#countdown-title-input').value = '';
        $('#countdown-date-input').value = '';
        renderCountdown(true);
        Toast.show('倒数日已清除', { timeout: 1500 });
    });

    // ── 表单内回车即保存（不含输入法组合中的回车） ─────────────
    const bindEnterToSave = (formSel, saveSel) => {
        delegate($(formSel), 'keydown', 'input', function (e) {
            if (e.key === 'Enter' && !e.isComposing) {
                e.preventDefault();
                $(saveSel).click();
            }
        });
    };
    bindEnterToSave('.se_add_content', '.se_add_save');
    bindEnterToSave('.quick_add_content', '.quick_add_save');
    bindEnterToSave('#wallpaper_url', '.wallpaper_save');
    bindEnterToSave('#countdown-form', '.countdown_save');

    // ═══════════════════ 数据备份 ═══════════════════

    $('#my_data_out').addEventListener('click', () => {
        download(`Snavigation-back-up-${Date.now()}.json`, JSON.stringify(Storage.getAll()));
        Toast.show('已导出备份文件至下载目录', { timeout: 2000 });
    });

    $('#my_data_in').addEventListener('click', () => $('#my_data_file').click());

    $('#my_data_file').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            this.value = ''; // 允许重复选择同一文件
            const data = safeJsonParse(reader.result, null);
            if (!data || typeof data !== 'object') {
                Toast.show('数据解析异常', { timeout: 2000 });
                return;
            }
            if (!(await Toast.confirm('当前数据将会被覆盖！是否继续导入？'))) return;

            // 白名单 + URL 校验，防止导入恶意数据
            const allowedKeys = [
                STORAGE_KEYS.searchList, STORAGE_KEYS.quickList,
                STORAGE_KEYS.wallpaper, STORAGE_KEYS.searchDefault,
                STORAGE_KEYS.wallpaperApiKey, STORAGE_KEYS.theme,
                STORAGE_KEYS.prefs, STORAGE_KEYS.searchHistory
            ];
            for (const key of Object.keys(data)) {
                if (!allowedKeys.includes(key)) continue;
                // 主题取值校验（此前备份里的主题不在白名单，恢复后会丢）
                if (key === STORAGE_KEYS.theme &&
                    !['auto', 'light', 'dark'].includes(String(data[key]))) continue;
                // 偏好设置：仅接受已知字段与匹配类型，倒数日日期需合法
                if (key === STORAGE_KEYS.prefs) {
                    const p = safeJsonParse(data[key], data[key]);
                    if (!p || typeof p !== 'object') continue;
                    const clean = {};
                    for (const k of Object.keys(PREFS_PRESET)) {
                        if (typeof PREFS_PRESET[k] === 'boolean' && typeof p[k] === 'boolean') clean[k] = p[k];
                        if (typeof PREFS_PRESET[k] === 'string' && typeof p[k] === 'string' &&
                            p[k].length <= 40) clean[k] = p[k];
                    }
                    if (clean.countdownDate && !/^\d{4}-\d{2}-\d{2}$/.test(clean.countdownDate)) {
                        delete clean.countdownDate;
                    }
                    Storage.set(key, clean);
                    continue;
                }
                // 搜索历史：仅接受字符串数组，去除超长项并截断到上限
                if (key === STORAGE_KEYS.searchHistory) {
                    const arr = safeJsonParse(data[key], data[key]);
                    if (!Array.isArray(arr)) continue;
                    const clean = arr
                        .filter((s) => typeof s === 'string' && s && s.length <= 120)
                        .slice(0, SEARCH_HISTORY_MAX);
                    Storage.set(key, clean);
                    continue;
                }
                if (key === STORAGE_KEYS.searchList || key === STORAGE_KEYS.quickList) {
                    const list = safeJsonParse(data[key], data[key]);
                    if (!list || typeof list !== 'object') {
                        Toast.show('导入数据格式异常', { timeout: 2000 });
                        return;
                    }
                    for (const k of Object.keys(list)) {
                        if (list[k] && list[k].url && !isValidUrl(list[k].url)) {
                            Toast.show('导入数据包含无效 URL，已拒绝导入', { timeout: 3000 });
                            return;
                        }
                    }
                }
                if (key === STORAGE_KEYS.wallpaper) {
                    const bg = safeJsonParse(data[key], data[key]);
                    if (bg && bg.path && !isValidUrl(String(bg.path).replace(/\{key\}/g, 'k'))) {
                        Toast.show('导入壁纸 URL 无效，已拒绝导入', { timeout: 3000 });
                        return;
                    }
                }
                Storage.set(key, data[key]);
            }
            Toast.show('导入成功', { timeout: 2000 });
            setTimeout(() => window.location.reload(), 1000);
        };
        reader.readAsText(file);
    });
};
