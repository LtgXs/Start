/* ============================================
 * Snavigation - Main（入口）
 * 时钟、天气、主题、快捷键、欢迎问候、显式启动序列
 * 依赖：前置全部模块（config → utils → storage →
 *       wallpaper → search → bookmarks → settings）
 * ============================================ */
'use strict';

// ══════════════════════════════════════════════════════════════════
// 时钟：按分钟对齐更新
// （只改文本节点，不再整块重写 innerHTML —— 旧写法会把 #point
//   重新创建，冒号闪烁动画每分钟重启一次，肉眼可见跳变）
// ══════════════════════════════════════════════════════════════════

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const NBSP = '\u00A0';

function renderClock() {
    const now = new Date();
    $('#t-hour').textContent = String(now.getHours()).padStart(2, '0');
    $('#t-min').textContent = String(now.getMinutes()).padStart(2, '0');
    if (App.prefs && App.prefs.clockSeconds) {
        $('#t-sec').textContent = String(now.getSeconds()).padStart(2, '0');
    }
    $('#day').textContent =
        `${now.getMonth() + 1}${NBSP}月${NBSP}${now.getDate()}${NBSP}日${NBSP}${WEEKDAYS[now.getDay()]}`;
    // 按小时缓慢流转的主题色相
    document.documentElement.style.setProperty('--time-hue', (now.getHours() * 15) + 'deg');
    // 倒数日跨天自动更新（widgets.js；内部有渲染缓存，内容不变不动 DOM）
    if (typeof renderCountdown === 'function') renderCountdown();
}

let _clockTimer = null;

function startClock() {
    renderClock();
    // 对齐到下一分钟（或开启秒显示时对齐到下一秒）边界更新，
    // 不显示秒时唤醒次数保持 1 次/分
    const step = (App.prefs && App.prefs.clockSeconds) ? 1000 : 60000;
    _clockTimer = setTimeout(startClock, step - (Date.now() % step) + 20);
}

/** 偏好切换「显示秒」后立即按新粒度重新调度（settings.js 调用） */
App.restartClock = function () {
    clearTimeout(_clockTimer);
    const secWrap = $('#sec-wrap');
    const on = !!(App.prefs && App.prefs.clockSeconds);
    if (secWrap) secWrap.style.display = on ? '' : 'none';
    $('.time').classList.toggle('has-sec', on);
    startClock();
};

// ══════════════════════════════════════════════════════════════════
// 天气：MSN 主源 + wttr.in 备源，统一渲染
// ══════════════════════════════════════════════════════════════════

/** 依据天气描述切换图标与氛围类 */
function applyWeatherVisual(desc) {
    const weatherEl = $('#weather-main');
    weatherEl.classList.remove('sunny', 'rainy', 'snowy', 'cloudy');
    let icon = '🌤️';
    if (desc.includes('雷')) { icon = '⛈️'; weatherEl.classList.add('rainy'); }
    else if (desc.includes('雨')) { icon = '🌧️'; weatherEl.classList.add('rainy'); }
    else if (desc.includes('雪')) { icon = '❄️'; weatherEl.classList.add('snowy'); }
    else if (desc.includes('雾') || desc.includes('霾') || desc.includes('尘') || desc.includes('沙')) { icon = '🌫️'; }
    else if (desc.includes('晴')) { icon = '☀️'; weatherEl.classList.add('sunny'); }
    else if (desc.includes('阴') || desc.includes('云')) { icon = '☁️'; weatherEl.classList.add('cloudy'); }
    $('#weather_icon').textContent = icon;
}

/** 统一渲染入口（两个数据源解析成同一形状后调用） */
function renderWeather(w) {
    const setText = (sel, v) => { if (v !== undefined && v !== null && v !== '') $(sel).textContent = v; };
    if (w.desc) {
        setText('#wea_text', w.desc);
        applyWeatherVisual(w.desc);
    }
    setText('#tem1', w.tempHi);
    setText('#tem2', w.tempLo);
    setText('#wea_city', w.city);
    setText('#wea_feels', w.feels);
    setText('#wea_hum', w.humidity);
    setText('#wea_wind', w.wind);
    setText('#wea_uv', w.uv);
    App.weather = w; // 供欢迎问候引用
}

/** 主源：MSN / Bing 公开天气接口 */
async function fetchWeatherMsn() {
    const url = 'https://assets.msn.com/service/segments/recoitems/weather?'
        + 'apikey=UhJ4G66OjyLbn9mXARgajXLiLw6V75sHnfpU60aJBB'
        + '&ocid=weather-peregrine&cm=zh-cn&it=app&scn=APP_ANON'
        + '&appId=4de6fc9f-3262-47bf-9c99-e189a8234fa2'
        + '&wrapodata=false&includemapsmetadata=false&cuthour=true&days=5'
        + '&pageOcid=anaheim-ntp-peregrine&source=undefined_csr'
        + '&fdhead=prg-1sw-wxncvf&contentcount=1'
        + '&region=cn&market=zh-cn&locale=zh-cn';

    const res = await fetchWithTimeout(url, {}, 10000);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const items = await res.json();

    const summary = Array.isArray(items) && items.find((it) => it.type === 'WeatherSummary');
    if (!summary || !summary.data) throw new Error('未找到天气数据');

    const data = JSON.parse(summary.data);
    const weather = data.responses?.[0]?.weather?.[0];
    if (!weather) throw new Error('天气数据结构异常');

    const cur = weather.current || {};
    const today = weather.forecast?.days?.[0]?.daily;
    let wind;
    if (cur.windSpd !== undefined) {
        wind = (cur.windDir !== undefined ? cur.windDir + '° ' : '') + cur.windSpd + ' km/h';
    }
    renderWeather({
        desc: cur.cap,
        temp: cur.temp,
        tempHi: today ? today.tempHi : cur.temp,
        tempLo: today ? today.tempLo : cur.temp,
        city: data.userProfile?.location?.City,
        feels: cur.feels,
        humidity: cur.rh,
        wind,
        uv: cur.uvDesc !== undefined ? cur.uvDesc : cur.uv
    });
}

/** 备源：wttr.in */
async function fetchWeatherWttr() {
    // 修复：j1 输出只有在带 lang 参数时才包含 lang_zh 本地化描述，
    // 此前缺少该参数，下方读取的 lang_zh 永远不存在，只能落到英文 weatherDesc
    const res = await fetchWithTimeout('https://wttr.in/?format=j1&lang=zh', {}, 10000);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    const cc = data.current_condition?.[0];
    if (!cc) throw new Error('wttr 数据异常');
    const day = data.weather?.[0];
    let wind;
    if (cc.windspeedKmph) {
        wind = (cc.winddir16Point ? cc.winddir16Point + ' ' : '') + cc.windspeedKmph + ' km/h';
    }
    renderWeather({
        desc: cc.lang_zh?.[0]?.value || cc.weatherDesc?.[0]?.value,
        temp: cc.temp_C,
        tempHi: day ? day.maxtempC : cc.temp_C,
        tempLo: day ? day.mintempC : cc.temp_C,
        city: data.nearest_area?.[0]?.areaName?.[0]?.value,
        feels: cc.FeelsLikeC,
        humidity: cc.humidity,
        wind,
        uv: cc.uvIndex
    });
}

/**
 * 拉取天气并安排下一次轮询。
 * 修复：旧逻辑在主源失败时无条件按 5 分钟重试——即使备源已经成功，
 * 也会一直以失败节奏轮询；现在只要任一源成功就回到 30 分钟正常节奏。
 */
let _weatherOkAt = 0;       // 上次成功时间（供切回前台时判断是否已过期）
let _weatherBusy = false;   // 防止轮询与前台补拉并发
let _weatherTimer = null;
let _weatherFirstDone = null;
/** 首次天气尝试（无论成败）已完成——欢迎问候据此决定何时露面 */
const weatherFirstAttempt = new Promise((res) => { _weatherFirstDone = res; });

async function fetchWeather() {
    if (_weatherBusy) return;
    _weatherBusy = true;
    clearTimeout(_weatherTimer);
    let ok = false;
    try {
        await fetchWeatherMsn();
        ok = true;
    } catch (err) {
        console.warn('[weather] 主源失败，尝试备源:', err.message || err);
        try {
            await fetchWeatherWttr();
            ok = true;
        } catch (e) {
            console.warn('[weather] 备源也失败:', e.message || e);
        }
    }
    _weatherBusy = false;
    if (ok) _weatherOkAt = Date.now();
    _weatherFirstDone();
    _weatherTimer = setTimeout(fetchWeather, ok ? WEATHER_CONST.REFRESH_MS : WEATHER_CONST.RETRY_MS);
}

// ══════════════════════════════════════════════════════════════════
// 主题：自动（跟随系统）/ 浅色 / 深色
// 激活此前 CSS 中已存在但从未被启用的 light-theme 样式
// ══════════════════════════════════════════════════════════════════

const THEME_META = {
    auto: { icon: '🌓', label: '跟随系统' },
    light: { icon: '☀️', label: '浅色' },
    dark: { icon: '🌙', label: '深色' }
};
const _lightMq = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
const THEME_BAR_COLORS = { dark: '#121214', light: '#f4f6fa' };

function applyTheme(mode) {
    const light = mode === 'light' || (mode === 'auto' && _lightMq && _lightMq.matches);
    document.documentElement.classList.toggle('light-theme', light);
    // 修复：<meta name="theme-color"> 只按系统深浅色切换，手动强制浅/深主题时
    // 浏览器标题栏 / PWA 窗口色仍停留在系统配色，与页面主题脱节
    $$('meta[name="theme-color"]').forEach((m) => {
        m.setAttribute('content', light ? THEME_BAR_COLORS.light : THEME_BAR_COLORS.dark);
    });
    const btn = $('#theme-toggle');
    if (btn) {
        btn.querySelector('.theme-icon').textContent = THEME_META[mode].icon;
        btn.title = `主题：${THEME_META[mode].label}（点击切换）`;
        btn.setAttribute('aria-label', `切换主题，当前：${THEME_META[mode].label}`);
    }
}

App.cycleTheme = function () {
    const order = ['auto', 'light', 'dark'];
    const next = order[(order.indexOf(getTheme()) + 1) % order.length];
    setTheme(next);
    applyTheme(next);
    Toast.show(`主题：${THEME_META[next].label}`, { timeout: 1500 });
};

function initTheme() {
    applyTheme(getTheme());
    $('#theme-toggle').addEventListener('click', App.cycleTheme);
    // 跟随系统模式下响应系统深浅色切换
    if (_lightMq && _lightMq.addEventListener) {
        _lightMq.addEventListener('change', () => {
            if (getTheme() === 'auto') applyTheme('auto');
        });
    }
}

// ══════════════════════════════════════════════════════════════════
// 欢迎问候
// ══════════════════════════════════════════════════════════════════

function greet() {
    const hour = new Date().getHours();
    const hello =
        hour < 6 ? '凌晨好' : hour < 9 ? '早上好' : hour < 12 ? '上午好' :
        hour < 14 ? '中午好' : hour < 17 ? '下午好' : hour < 19 ? '傍晚好' :
        hour < 22 ? '晚上好' : '夜深了';

    let msg = '欢迎来到 Snavigation';
    const w = App.weather;
    if (w && w.desc) {
        // 修复：此前展示的是今日最低温却标注"当前"，改用真实当前温度
        const t = w.temp !== undefined && w.temp !== null ? w.temp : w.tempLo;
        msg = `当前 ${w.desc}${t !== undefined && t !== null ? ' ' + t + '°C' : ''}`;
        if (w.city) msg += `（${w.city}）`;
    }
    Toast.show(msg, { title: hello });
}

// ══════════════════════════════════════════════════════════════════
// 键盘快捷键
// ══════════════════════════════════════════════════════════════════

function toggleShortcutsModal(forceHide) {
    const modal = $('#shortcuts-modal');
    const visible = isVisible(modal);
    if (forceHide || visible) {
        fadeOut(modal, 120);
        modal.setAttribute('aria-hidden', 'true');
    } else {
        fadeIn(modal, 120, 'flex');
        modal.setAttribute('aria-hidden', 'false');
    }
}

/** 点击面板外的暗色遮罩也可关闭（此前只能靠 ? / H / Esc） */
function bindShortcutsModalDismiss() {
    $('#shortcuts-modal').addEventListener('click', (e) => {
        if (!e.target.closest('.shortcuts-panel')) toggleShortcutsModal(true);
    });
}

/**
 * Esc 逐层关闭（快捷键面板 → 下拉/联想 → 设置 → 书签 → 搜索态）。
 * 修复：面板上一直写着「Esc 关闭弹层」，旧实现却只关快捷键面板。
 */
function handleEscape() {
    if (isVisible($('#shortcuts-modal'))) { toggleShortcutsModal(true); return; }

    const enginePanel = $('.search-engine');
    const keywordsBox = $('#keywords');
    if (enginePanel.classList.contains('show') || keywordsBox.classList.contains('show')) {
        setEnginePanelOpen(false);
        hideKeywordsBox();
        return;
    }
    if ($('#menu').classList.contains('on')) { App.closeSet(); return; }
    if ($('#content').classList.contains('box')) { App.closeBox(); return; }
    if (document.body.classList.contains('onsearch')) blurWd();
}

function bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        if (e.isComposing) return; // 输入法组合中不处理任何快捷键
        const active = document.activeElement;
        // "正在打字"只应涵盖文本类控件：单选 / 复选框等获得焦点时
        // （如刚用键盘选完壁纸类型）不该吞掉单键快捷键
        const NON_TEXT_INPUT = ['radio', 'checkbox', 'button', 'submit', 'reset', 'range', 'file', 'color', 'hidden'];
        const isTyping = active && (
            active.tagName === 'TEXTAREA' || active.isContentEditable ||
            (active.tagName === 'INPUT' && !NON_TEXT_INPUT.includes(active.type))
        );

        if (e.key === 'Escape') {
            handleEscape();
            return;
        }
        // 搜索态下阻止空内容回车提交（form submit 监听里还有一道兜底）
        if (e.key === 'Enter') {
            if (document.body.classList.contains('onsearch') && $('.wd').value.trim() === '') {
                e.preventDefault();
            }
            return;
        }
        if (isTyping) return; // 打字时不响应任何单键快捷键
        if (e.ctrlKey || e.metaKey || e.altKey) return; // 不劫持浏览器组合键

        switch (e.key) {
            case '?':
            case 'h': case 'H':
                e.preventDefault();
                toggleShortcutsModal();
                break;
            case '/':
                e.preventDefault();
                // 面板打开时先关面板再聚焦：此前会聚焦到面板底下看不见的输入框
                App.closeSet();
                App.closeBox();
                $('.wd').focus();
                focusWd();
                break;
            case 's': case 'S':
                $('#menu').click(); // 菜单按钮本身即开关
                break;
            case 'b': case 'B':
                if ($('#menu').classList.contains('on')) {
                    App.closeSet();
                    App.openBox();
                } else if ($('#content').classList.contains('box')) {
                    App.closeBox();
                } else {
                    App.openBox();
                }
                break;
            case 't': case 'T':
                App.cycleTheme();
                break;
            case 'r': case 'R':
                $('#bg-refresh').click(); // 换一张壁纸
                break;
        }
    });
}

// ══════════════════════════════════════════════════════════════════
// 其余全局交互
// ══════════════════════════════════════════════════════════════════

function bindGlobalEvents() {
    // 天气点击展开 / 收起详情
    $('#weather-main').addEventListener('click', function () {
        const detail = $('#weather-detail');
        const expanding = !detail.classList.contains('show');
        if (expanding) {
            detail.style.display = 'flex';
            void detail.offsetWidth; // 触发 reflow 保证过渡生效
            detail.classList.add('show');
            this.setAttribute('aria-expanded', 'true');
            $('.tool-all').classList.add('weather-open');
        } else {
            detail.classList.remove('show');
            this.setAttribute('aria-expanded', 'false');
            $('.tool-all').classList.remove('weather-open');
            setTimeout(() => {
                if (!detail.classList.contains('show')) detail.style.display = 'none';
            }, 350);
        }
    });

    // role="button" 的自定义按钮支持键盘（Enter / 空格）。
    // 增补 .se（引擎切换）与 #time_text（书签开关）：此前二者只能鼠标操作
    const A11Y_LABELS = { '.se': '切换搜索引擎', '#time_text': '打开或关闭书签面板' };
    ['#weather-main', '#bg-refresh', '#menu', '#theme-toggle', '.se', '#time_text',
        '#hitokoto', '#hitokoto-refresh', '#countdown-pill'].forEach((sel) => {
        const el = $(sel);
        if (!el) return;
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
        if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
        if (!el.hasAttribute('aria-label') && A11Y_LABELS[sel]) {
            el.setAttribute('aria-label', A11Y_LABELS[sel]);
        }
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                el.click();
            }
        });
    });

    // 搜索按钮
    $('.sou-button').addEventListener('click', () => {
        if (document.body.classList.contains('onsearch') && $('.wd').value.trim() !== '') {
            $('#search-submit').click();
        }
    });

    // 鼠标中键：仅在空白背景上切换书签面板。
    // 修复：旧实现只排除 <a>，会拦截输入框里的中键粘贴（Linux）、
    // 面板与按钮上的中键操作。
    window.addEventListener('mousedown', (e) => {
        if (e.button !== 1) return;
        if (e.target.closest(
            'a, input, textarea, select, button, .sou, .mark, .set, .tool-all,' +
            ' #menu, #bg-refresh, #theme-toggle, .toast-container, .shortcuts-modal,' +
            ' #hitokoto, #countdown-pill'
        )) return;
        e.preventDefault();
        $('#time_text').click();
    });

    // 从后台标签页切回时立即校正时钟（后台定时器会被浏览器节流）。
    // 修复：起始页常年躺在后台标签页里，浏览器会把后台定时器节流到
    // 几乎停摆——切回来时天气可能已陈旧数小时、下一次轮询还遥遥无期；
    // 现在切回前台时若距上次成功已超正常周期，立即补拉一次
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) return;
        renderClock();
        if (Date.now() - _weatherOkAt > WEATHER_CONST.REFRESH_MS) fetchWeather();
    });

    // 页脚年份（替代 document.write）
    const yearEl = $('#copyright-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
}

// ══════════════════════════════════════════════════════════════════
// Service Worker：离线可用 + 静态资源秒开（file:// 或纯 http 环境自动跳过）
// ══════════════════════════════════════════════════════════════════

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    if (location.protocol !== 'https:' && !isLocalhost) return;
    navigator.serviceWorker.register('./sw.js')
        .catch((e) => console.warn('[sw] 注册失败:', e.message || e));
}

// ══════════════════════════════════════════════════════════════════
// 启动序列（显式、可读的模块初始化顺序）
// ══════════════════════════════════════════════════════════════════

function boot() {
    initTheme();                 // 与首屏内联脚本衔接，接管后续切换
    App.initWallpaperModule();   // 尽早启动：负责首屏揭幕
    App.initSearchModule();
    App.initBookmarksModule();
    App.initSettingsModule();
    App.initWidgetsModule();     // 一言 / 倒数日 / 视差（依赖偏好快照）

    App.restartClock();          // 按偏好（是否显示秒）启动时钟
    fetchWeather();
    bindKeyboardShortcuts();
    bindShortcutsModalDismiss();
    bindGlobalEvents();
    registerServiceWorker();

    // 修复：问候此前固定在 800ms 露面，而天气几乎不可能在 800ms 内返回，
    // 于是"当前天气 xx°C"的问候形同虚设，永远只显示兜底文案。
    // 现等待首次天气尝试完成（上限 2.5s），最早也不早于 800ms
    const bootAt = Date.now();
    Promise.race([
        weatherFirstAttempt,
        new Promise((res) => setTimeout(res, 2500))
    ]).then(() => {
        if (App.prefs && App.prefs.greeting === false) return; // 偏好里可关闭问候
        setTimeout(greet, Math.max(0, 800 - (Date.now() - bootAt)));
    });

    console.log('%cSnavigation%c  https://github.com/imsyy/Snavigation',
        'font-size:18px;font-weight:600;color:rgb(244,167,89);',
        'color:rgb(30,152,255);');
}

// defer 脚本在 DOM 解析完成后按序执行，此处直接启动即可
boot();
