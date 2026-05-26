/* ============================================
 * Snavigation - App Entry (main.js)
 * 入口整合：页面揭幕、欢迎问候、时钟、
 *           天气获取、键盘快捷键、全局交互
 * 依赖：所有前置模块（storage→wallpaper→search→bookmarks→settings）
 * ============================================ */

// ─── 页面揭幕 ────────────────────────────────────────────────────
var _revealed = false;
function revealPage() {
    if (_revealed) { console.log('[bg:main] revealPage() 跳过 (已揭幕)'); return; }
    _revealed = true;
    console.log('[bg:main] revealPage() 揭幕! performance.now=', (performance.now ? performance.now().toFixed(0) : '?'));
    $('body').addClass('loaded');
    $('#loading-box').addClass('loaded');
}
var _revealFallbackTimer = setTimeout(function () {
    console.log('[bg:main] ⚠ 5000ms 兜底超时触发!');
    revealPage();
}, 5000);
console.log('[bg:main] main.js 加载完成, 兜底定时器已设置 (5000ms)');

// ══════════════════════════════════════════════════════════════════
// window.load — 欢迎提示 + 字体加载（不阻塞页面展示）
// ══════════════════════════════════════════════════════════════════

window.addEventListener('load', function () {
    // 用户欢迎 Toast 全局配置
    iziToast.settings({
        timeout: 3000,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        titleColor: '#ffffff',
        messageColor: 'rgba(255, 255, 255, 0.85)',
        progressBar: false,
        close: false,
        closeOnEscape: true,
        position: 'topCenter',
        transitionIn: 'bounceInDown',
        transitionOut: 'flipOutX',
        displayMode: 'replace',
        layout: '1'
    });

    setTimeout(function () {
        var now = new Date(), hour = now.getHours();
        var hello;
        if (hour < 6)      { hello = "凌晨好"; }
        else if (hour < 9)  { hello = "早上好"; }
        else if (hour < 12) { hello = "上午好"; }
        else if (hour < 14) { hello = "中午好"; }
        else if (hour < 17) { hello = "下午好"; }
        else if (hour < 19) { hello = "傍晚好"; }
        else if (hour < 22) { hello = "晚上好"; }
        else                { hello = "夜深了"; }

        var greetMsg = '欢迎来到 Snavigation';
        if (window._weatherData && window._weatherData.current) {
            var cur = window._weatherData.current;
            var weatherBrief = '';
            if (cur.cap) weatherBrief += cur.cap;
            if (cur.temp !== undefined) weatherBrief += ' ' + cur.temp + '°C';
            if (weatherBrief) greetMsg = '当前 ' + weatherBrief;
            if (window._weatherData.location && window._weatherData.location.City) {
                greetMsg += '（' + window._weatherData.location.City + '）';
            }
        }

        iziToast.show({
            title: hello,
            message: greetMsg
        });
    }, 800);

    // 中文字体缓加载
    var font = new FontFace(
        "MiSans",
        "url(" + "./font/MiSans-Regular.woff2" + ")"
    );
    document.fonts.add(font);
}, false);

// ══════════════════════════════════════════════════════════════════
// 时钟
// ══════════════════════════════════════════════════════════════════

var t = null;
t = setTimeout(time, 1000);

function time() {
    clearTimeout(t);
    var dt = new Date();
    var mm = dt.getMonth() + 1;
    var d = dt.getDate();
    var weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    var day = dt.getDay();
    var h = dt.getHours();
    var hour = h;
    var m = dt.getMinutes();
    if (h < 10) { h = "0" + h; }
    if (m < 10) { m = "0" + m; }
    $("#time_text").html(h + '<span id="point">:</span>' + m);
    $("#day").html(mm + "&nbsp;月&nbsp;" + d + "&nbsp;日&nbsp;" + weekday[day]);
    document.documentElement.style.setProperty('--time-hue', (hour * 15) + 'deg');
    t = setTimeout(time, 1000);
}

// ══════════════════════════════════════════════════════════════════
// 天气视觉
// ══════════════════════════════════════════════════════════════════

function applyWeatherVisual(desc) {
    var $weather = $('#weather-main');
    $weather.removeClass('sunny rainy snowy cloudy');
    var icon = '🌤️';
    if (desc.indexOf('雨') !== -1) {
        icon = '🌧️';
        $weather.addClass('rainy');
    } else if (desc.indexOf('雪') !== -1) {
        icon = '❄️';
        $weather.addClass('snowy');
    } else if (desc.indexOf('晴') !== -1) {
        icon = '☀️';
        $weather.addClass('sunny');
    } else if (desc.indexOf('阴') !== -1 || desc.indexOf('云') !== -1) {
        icon = '☁️';
        $weather.addClass('cloudy');
    }
    $('#weather_icon').text(icon);
}

// ══════════════════════════════════════════════════════════════════
// 获取天气 - MSN/Bing 公开 API（每 30 分钟刷新）
// ══════════════════════════════════════════════════════════════════

(function fetchWeather() {
    var weatherApiUrl = 'https://assets.msn.com/service/segments/recoitems/weather?'
        + 'apikey=UhJ4G66OjyLbn9mXARgajXLiLw6V75sHnfpU60aJBB'
        + '&ocid=weather-peregrine'
        + '&cm=zh-cn'
        + '&it=app'
        + '&scn=APP_ANON'
        + '&appId=4de6fc9f-3262-47bf-9c99-e189a8234fa2'
        + '&wrapodata=false'
        + '&includemapsmetadata=false'
        + '&cuthour=true'
        + '&days=5'
        + '&pageOcid=anaheim-ntp-peregrine'
        + '&source=undefined_csr'
        + '&fdhead=prg-1sw-wxncvf'
        + '&contentcount=1'
        + '&region=cn'
        + '&market=zh-cn'
        + '&locale=zh-cn';

    fetch(weatherApiUrl)
        .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(function (items) {
            var weatherItem = null;
            if (Array.isArray(items)) {
                for (var i = 0; i < items.length; i++) {
                    if (items[i].type === 'WeatherSummary') {
                        weatherItem = items[i];
                        break;
                    }
                }
            }
            if (!weatherItem || !weatherItem.data) {
                throw new Error('未找到天气数据');
            }

            var data;
            try {
                data = JSON.parse(weatherItem.data);
            } catch (e) {
                throw new Error('天气数据解析失败');
            }

            if (!data.responses || !data.responses[0] ||
                !data.responses[0].weather || !data.responses[0].weather[0]) {
                throw new Error('天气数据结构异常');
            }

            var weather = data.responses[0].weather[0];
            var current = weather.current;
            var today = weather.forecast && weather.forecast.days && weather.forecast.days[0]
                ? weather.forecast.days[0].daily : null;

            if (current && current.cap) {
                $('#wea_text').text(current.cap);
                applyWeatherVisual(current.cap);
            }
            if (today) {
                $('#tem1').text(today.tempHi);
                $('#tem2').text(today.tempLo);
            } else if (current) {
                $('#tem1').text(current.temp);
                $('#tem2').text(current.temp);
            }

            if (data.userProfile && data.userProfile.location && data.userProfile.location.City) {
                $('#wea_city').text(data.userProfile.location.City);
            }

            window._weatherData = {
                current: current,
                forecast: weather.forecast,
                location: data.userProfile ? data.userProfile.location : null,
                updatedAt: new Date().toLocaleTimeString()
            };

            if (current) {
                if (current.feels !== undefined) $('#wea_feels').text(current.feels);
                if (current.rh !== undefined) $('#wea_hum').text(current.rh);
                if (current.windSpd !== undefined) {
                    var windText = current.windSpd + ' km/h';
                    if (current.windDir) windText = current.windDir + '° ' + windText;
                    $('#wea_wind').text(windText);
                }
                if (current.uvDesc !== undefined) {
                    $('#wea_uv').text(current.uvDesc);
                } else if (current.uv !== undefined) {
                    $('#wea_uv').text(current.uv);
                }
            }
            setTimeout(fetchWeather, 10 * 60 * 1000);
        })
        .catch(function (err) {
            console.warn('MSN 天气数据获取失败:', err);
            fetchWeatherFallback();
            setTimeout(fetchWeather, 5 * 60 * 1000);
        });
})();

// wttr.in 备用天气源
function fetchWeatherFallback() {
    fetch('https://wttr.in/?format=j1')
        .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(function (data) {
            if (data.current_condition && data.current_condition[0]) {
                var cc = data.current_condition[0];
                var desc = cc.lang_zh && cc.lang_zh[0] ? cc.lang_zh[0].value : cc.weatherDesc[0].value;
                $('#wea_text').text(desc);
                applyWeatherVisual(desc);
                $('#tem1').text(cc.temp_C);
                $('#tem2').text(cc.temp_C);
                if (cc.FeelsLikeC) $('#wea_feels').text(cc.FeelsLikeC);
                if (cc.humidity) $('#wea_hum').text(cc.humidity);
                if (cc.windspeedKmph) {
                    var windInfo = cc.windspeedKmph + ' km/h';
                    if (cc.winddir16Point) windInfo = cc.winddir16Point + ' ' + windInfo;
                    $('#wea_wind').text(windInfo);
                }
                if (cc.uvIndex) $('#wea_uv').text(cc.uvIndex);
            }
            if (data.weather && data.weather[0]) {
                $('#tem1').text(data.weather[0].maxtempC);
                $('#tem2').text(data.weather[0].mintempC);
            }
            if (data.nearest_area && data.nearest_area[0]) {
                var area = data.nearest_area[0];
                var city = area.areaName && area.areaName[0] ? area.areaName[0].value : '';
                if (city) $('#wea_city').text(city);
            }
        })
        .catch(function (err) {
            console.warn('备用天气源也获取失败:', err);
        });
}

// ══════════════════════════════════════════════════════════════════
// DOM Ready：绑定全局交互事件
// ══════════════════════════════════════════════════════════════════

$(function () {
    // ── 天气点击展开/收起详情 ──────────────────────────────────
    $("#weather-main").click(function () {
        var $main = $(this);
        var $detail = $("#weather-detail");
        var isExpanding = !$detail.hasClass("show");

        if (isExpanding) {
            $detail.css("display", "flex");
            // Force layout reflow
            $detail[0].offsetWidth;
            $detail.addClass("show");
            $main.attr('aria-expanded', true);
            $(".tool-all").addClass("weather-open");
        } else {
            $detail.removeClass("show");
            $main.attr('aria-expanded', false);
            $(".tool-all").removeClass("weather-open");
            setTimeout(function() {
                if (!$detail.hasClass("show")) {
                    $detail.css("display", "none");
                }
            }, 350);
        }
    });

    // ── 键盘快捷键 ─────────────────────────────────────────────
    $(window).keydown(function (e) {
        if (e.key === "Escape") {
            if ($("#shortcuts-modal").is(':visible')) {
                $("#shortcuts-modal").fadeOut(120).attr('aria-hidden', 'true');
                return;
            }
        } else if (e.key === "Enter") {
            if ($("body").hasClass("onsearch") && $(".wd").val() === "") {
                e.preventDefault();
                return false;
            }
        }
        if (e.key === "?") {
            e.preventDefault();
            var show = $("#shortcuts-modal").is(':hidden');
            $("#shortcuts-modal").fadeToggle(120).attr('aria-hidden', show ? 'false' : 'true');
        } else if (e.key === "h" || e.key === "H") {
            e.preventDefault();
            var showAlt = $("#shortcuts-modal").is(':hidden');
            $("#shortcuts-modal").fadeToggle(120).attr('aria-hidden', showAlt ? 'false' : 'true');
        } else if (e.key === "/") {
            e.preventDefault();
            $(".wd").focus();
            if (typeof focusWd === 'function') focusWd();
        } else if (e.key === "s" || e.key === "S") {
            var active = document.activeElement;
            var isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
            if (isTyping) return;
            if (!$("#menu").hasClass('on')) $("#menu").trigger('click');
        } else if (e.key === "b" || e.key === "B") {
            var activeEl = document.activeElement;
            var typing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
            if (typing) return;
            if ($("#menu").hasClass('on')) $("#menu").trigger('click');
            if (!$("#content").hasClass('box')) $("#time_text").trigger('click');
        }
    });

    // ── 搜索按钮点击 ───────────────────────────────────────────
    $(".sou-button").click(function () {
        if ($("body").hasClass("onsearch")) {
            if ($(".wd").val() !== "") {
                $("#search-submit").click();
            }
        }
    });

    // ── 鼠标中键点击（切换书签面板）────────────────────────────
    $(window).mousedown(function (event) {
        if (event.button === 1 && !$(event.target).closest('a').length) {
            $("#time_text").click();
        }
    });
});

// ══════════════════════════════════════════════════════════════════
// 控制台欢迎输出
// ══════════════════════════════════════════════════════════════════

var styleTitle1 = 'font-size: 20px; font-weight: 600; color: rgb(244,167,89);';
var styleTitle2 = 'font-size:12px; color: rgb(244,167,89);';
var styleContent = 'color: rgb(30,152,255);';
var title1 = 'Snavigation';
var title2 = '\n\n/$$               /$$            /$$$$$$ \n| $$              | $$           /$$__  $$\n| $$             /$$$$$$        | $$  \\__/\n| $$            |_  $$_/        | $$ /$$$$\n| $$              | $$          | $$|_  $$\n| $$              | $$ /$$      | $$  \\ $$\n| $$$$$$$$        |  $$$$/      |  $$$$$$/\n|________/         \\___/         \\______/ \n\n';
var content = 'Github:  https://github.com/imsyy/Snavigation\n';
console.log('%c' + title1 + ' %c' + title2 + '%c' + content, styleTitle1, styleTitle2, styleContent);
