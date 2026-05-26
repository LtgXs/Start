/* ============================================
 * Snavigation - Bookmarks Module
 * 快捷书签功能：常用网站数据操作、DOM 渲染、
 *              Tab 栏切换、时间点击打开/关闭书签
 * 依赖：storage.js（需先加载）
 * ============================================ */

// 获取快捷方式列表
function getQuickList() {
    return readStoredObject(APP_STORAGE_KEYS.quickList, quick_list_preinstall);
}

// 设置快捷方式列表
function setQuickList(quick_list) {
    return writeStoredObject(APP_STORAGE_KEYS.quickList, quick_list);
}

// ══════════════════════════════════════════════════════════════════
// 辅助工具：提取域名、生成渐变色首字母头像与富媒体 HTML
// ══════════════════════════════════════════════════════════════════

function getDomain(url) {
    try {
        var a = document.createElement('a');
        a.href = url;
        return a.hostname;
    } catch (e) {
        return "";
    }
}

// 莫兰迪高级渐变色组
var AVATAR_GRADIENTS = [
    "linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)",  // 暖橙
    "linear-gradient(135deg, #4E54C8 0%, #8F94FB 100%)",  // 幻蓝
    "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",  // 翠绿
    "linear-gradient(135deg, #FC466B 0%, #3F5EFB 100%)",  // 玫靛
    "linear-gradient(135deg, #f857a6 0%, #ff5858 100%)"   // 绯红
];

function getGradientIndex(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % AVATAR_GRADIENTS.length;
}

function generateBookmarkHtml(url, title, isStatic) {
    var safeUrl = isValidUrl(url) ? escapeHtml(url) : '#';
    var safeTitle = escapeHtml(title);
    var domain = getDomain(url);
    
    var faviconUrl = "";
    if (domain) {
        // 首选 Google Favicon API 高清图，若不可达则触发 onerror 降级
        faviconUrl = 'https://www.google.com/s2/favicons?sz=64&domain=' + domain;
    }
    
    var grad = AVATAR_GRADIENTS[getGradientIndex(title)];
    var firstChar = title ? title.charAt(0).toUpperCase() : '?';
    
    var iconHtml = "";
    if (faviconUrl) {
        iconHtml = '<div class="bookmark-icon-wrapper">' +
            '<img src="' + faviconUrl + '" alt="" ' +
            'onerror="this.style.display=\'none\'; $(this).siblings(\'.bookmark-icon-fallback\').show();">' +
            '<div class="bookmark-icon-fallback" style="display:none; background:' + grad + ';">' + firstChar + '</div>' +
        '</div>';
    } else {
        iconHtml = '<div class="bookmark-icon-wrapper">' +
            '<div class="bookmark-icon-fallback" style="background:' + grad + ';">' + firstChar + '</div>' +
        '</div>';
    }
    
    var itemClass = isStatic ? 'quicks' : 'quick';
    
    return '<div class="' + itemClass + '">' +
        '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' +
            iconHtml +
            '<span class="bookmark-title-text">' + safeTitle + '</span>' +
        '</a>' +
    '</div>';
}

// 格式化静态书签（开发、学习等 Tab 项）
function formatStaticBookmarks() {
    $(".quick-alls .quicks").each(function () {
        var $el = $(this);
        var $a = $el.find("a");
        if ($a.length > 0) {
            var url = $a.attr("href");
            var title = $a.text().trim();
            if ($a.find(".bookmark-icon-wrapper").length === 0) {
                var newHtml = generateBookmarkHtml(url, title, true);
                $el.replaceWith(newHtml);
            }
        }
    });
}

// ══════════════════════════════════════════════════════════════════
// 快捷方式 DOM 渲染
// ══════════════════════════════════════════════════════════════════

function quickData() {
    var html = "";
    var quick_list = getQuickList();
    Object.keys(quick_list).forEach(function (i) {
        var item = quick_list[i];
        html += generateBookmarkHtml(item['url'], item['title'], false);
    });
    $(".quick-all").html(html + '<div class="quick"><a id="set-quick" style="display:flex; justify-content:center; align-items:center; width:100%; height:100%;"><i class="iconfont icon-tianjia-"></i></a></div>');
}

// ══════════════════════════════════════════════════════════════════
// 模块初始化
// ══════════════════════════════════════════════════════════════════

$(function () {
    // 快捷方式数据加载
    quickData();
    
    // 格式化其它 Tab 中的静态书签
    formatStaticBookmarks();

    // ── 书签 Tab 切换 ─────────────────────────────────────────
    $(".mark .tab .tab-item").click(function () {
        $(this).addClass("active").siblings().removeClass("active");
        $(".products .mainCont").eq($(this).index()).css("display", "flex").siblings().css("display", "none");
    });

    // ── 时间点击：打开/关闭书签面板 ───────────────────────────
    $("#time_text").click(function () {
        if ($("#content").hasClass('box')) {
            if (typeof closeBox === 'function') closeBox();
            if (typeof closeSet === 'function') closeSet();
            if (typeof blurWd === 'function') blurWd();
        } else {
            if (typeof openBox === 'function') openBox();
        }
    });

    // ── 快捷方式添加按钮点击（主页面 "+" 号）─────────────────
    $(document).on('click', '#set-quick', function () {
        if (typeof openSet === 'function') openSet();

        // 设置内容加载
        if (typeof setSeInit === 'function') setSeInit();
        if (typeof setQuickInit === 'function') setQuickInit();

        // 触发切换到快捷方式设置并打开添加表单
        $("#set-quick-menu").trigger('click');
        $(".set_quick_list_add").trigger('click');
    });
});
