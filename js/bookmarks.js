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
// 快捷方式 DOM 渲染
// ══════════════════════════════════════════════════════════════════

function quickData() {
    var html = "";
    var quick_list = getQuickList();
    Object.keys(quick_list).forEach(function (i) {
        var item = quick_list[i];
        var safeTitle = escapeHtml(item['title']);
        var rawUrl = item['url'];
        var safeUrl = isValidUrl(rawUrl) ? escapeHtml(rawUrl) : '#';
        html += '<div class="quick">' +
                    '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' + safeTitle + '</a>' +
                '</div>';
    });
    $(".quick-all").html(html + '<div class="quick"><a id="set-quick"><i class="iconfont icon-tianjia-"></i></a></div>');
}

// ══════════════════════════════════════════════════════════════════
// 模块初始化
// ══════════════════════════════════════════════════════════════════

$(function () {
    // 快捷方式数据加载
    quickData();

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
    $("#set-quick").click(function () {
        if (typeof openSet === 'function') openSet();

        // 设置内容加载
        if (typeof setSeInit === 'function') setSeInit();
        if (typeof setQuickInit === 'function') setQuickInit();

        // 触发切换到快捷方式设置并打开添加表单
        $("#set-quick-menu").trigger('click');
        $(".set_quick_list_add").trigger('click');
    });
});
