/* ============================================
 * Snavigation - Search Module
 * 搜索引擎功能：默认列表、DOM 渲染、下拉提示、
 *              自动补全（百度 jsonp）
 * 依赖：storage.js（需先加载）
 * ============================================ */

// 获取搜索引擎列表
function getSeList() {
    return readStoredObject(APP_STORAGE_KEYS.searchList, se_list_preinstall);
}

// 设置搜索引擎列表
function setSeList(se_list) {
    return writeStoredObject(APP_STORAGE_KEYS.searchList, se_list);
}

// 获得默认搜索引擎
function getSeDefault() {
    var se_default = Storage.get(APP_STORAGE_KEYS.searchDefault);
    return se_default ? se_default : "1";
}

// ══════════════════════════════════════════════════════════════════
// 搜索框焦点控制
// ══════════════════════════════════════════════════════════════════

function focusWd() {
    $("body").addClass("onsearch");
}

function blurWd() {
    $("body").removeClass("onsearch");
    $(".wd").val("");
    $("#keywords").removeClass("show");
}

// ══════════════════════════════════════════════════════════════════
// 搜索建议（百度 jsonp 自动补全，带防抖）
// ══════════════════════════════════════════════════════════════════

var _keywordTimer = null;
var _jsonpSeqId = 0;

function keywordReminder() {
    clearTimeout(_keywordTimer);
    _keywordTimer = setTimeout(_doKeywordReminder, 250);
}

function _doKeywordReminder() {
    var keyword = $(".wd").val();
    if (keyword !== "") {
        var currentSeq = ++_jsonpSeqId;
        $.ajax({
            url: 'https://suggestion.baidu.com/su?wd=' + encodeURIComponent(keyword),
            dataType: 'jsonp',
            jsonp: 'cb',
            success: function (data) {
                if (currentSeq !== _jsonpSeqId) return;
                if (data.s && data.s.length > 0) {
                    $("#keywords").css("width", $('.sou').width());
                    $("#keywords").empty().addClass("show");
                    $.each(data.s, function (i, val) {
                        $('#keywords').append('<div class="keyword" data-id="' + (i + 1) + '"><i class=\'iconfont icon-sousuo\'></i>' + escapeHtml(val) + '</div>');
                    });
                    $("#keywords").attr("data-length", data.s.length);
                } else {
                    $("#keywords").empty().removeClass("show");
                }
            },
            error: function () {
                $("#keywords").empty().removeClass("show");
            }
        });
    } else {
        $("#keywords").empty().removeClass("show");
    }
}

// ══════════════════════════════════════════════════════════════════
// 搜索框 DOM 数据加载
// ══════════════════════════════════════════════════════════════════

function searchData() {
    var se_default = getSeDefault();
    var se_list = getSeList();
    var defaultSe = se_list[se_default];
    if (defaultSe) {
        $(".search").attr("action", defaultSe["url"]);
        $("#icon-se").attr("class", defaultSe["icon"]);
        $(".wd").attr("name", defaultSe["name"]);
    }
}

// 搜索引擎下拉列表渲染
function seList() {
    var html = "";
    var se_list = getSeList();
    Object.keys(se_list).forEach(function (i) {
        var item = se_list[i];
        var safeTitle = escapeHtml(item["title"]);
        var safeUrl = escapeHtml(item["url"]);
        var safeName = escapeHtml(item["name"]);
        var safeIcon = escapeHtml(item["icon"]);
        html += '<div class=\'se-li\' data-url=\'' + safeUrl + '\' data-name=\'' + safeName + '\' data-icon=\'' + safeIcon + '\'>' +
            '<a class=\'se-li-text\'><i class=\'icon-sou-list ' + safeIcon + '\'></i><span>' + safeTitle + '</span></a></div>';
    });
    $(".search-engine-list").html(html);
}

// ══════════════════════════════════════════════════════════════════
// 模块初始化：绑定所有搜索交互事件
// ══════════════════════════════════════════════════════════════════

$(function () {
    // 搜索框数据加载
    searchData();

    // 搜索引擎列表加载
    seList();

    // ── 全局点击：搜索引擎下拉 & 自动提示 ─────────────────────
    $(document).on('click', function (e) {
        // 选择搜索引擎点击
        if ((!$(".search-engine").hasClass("show") && $(".se").is(e.target)) || (!$(".search-engine").hasClass("show") && $("#icon-se").is(e.target))) {
            if ($(".se").is(e.target) || $("#icon-se").is(e.target)) {
                $(".search-engine").css("width", $('.sou').width() - 30);
                $(".search-engine").addClass("show");
            }
        } else {
            if (!$(".search-engine").is(e.target) && $(".search-engine").has(e.target).length === 0) {
                $(".search-engine").removeClass("show");
            }
        }

        // 自动提示隐藏
        if (!$(".sou").is(e.target) && $(".sou").has(e.target).length === 0) {
            $("#keywords").removeClass("show");
        }
    });

    // ── 搜索引擎列表点击 ─────────────────────────────────────
    $(".search-engine-list").on("click", ".se-li", function () {
        var url = $(this).attr('data-url');
        var name = $(this).attr('data-name');
        var icon = $(this).attr('data-icon');
        $(".search").attr("action", url);
        $(".wd").attr("name", name);
        $("#icon-se").attr("class", icon);
        $(".search-engine").removeClass("show");
    });

    // ── 搜索框点击事件 ──────────────────────────────────────
    $(document).on('click', '.sou', function () {
        focusWd();
        $(".search-engine").removeClass("show");
    });

    $(document).on('click', '.wd', function () {
        focusWd();
        keywordReminder();
        $(".search-engine").removeClass("show");
    });

    // ── 关闭搜索区域 ────────────────────────────────────────
    $(document).on('click', '.close_sou', function () {
        blurWd();
        if (typeof closeSet === 'function') closeSet();
    });

    // ── 点击搜索引擎图标时隐藏/显示自动提示 ─────────────────
    $(document).on('click', '.se', function () {
        $('#keywords').toggleClass("show");
    });

    $(document).on('click', '.se-li', function () {
        $('#keywords').addClass("show");
    });

    // ── 自动提示键盘事件（百度 API）─────────────────────────
    $('.wd').keyup(function (event) {
        var key = event.keyCode;
        var shieldKey = [38, 40];
        if (shieldKey.includes(key)) return;
        keywordReminder();
    });

    // ── 点击搜索建议 ────────────────────────────────────────
    $("#keywords").on("click", ".keyword", function () {
        var wd = $(this).text();
        $(".wd").val(wd);
        $("#search-submit").click();
    });

    // ── 自动提示方向键操作 ──────────────────────────────────
    $(".wd").keydown(function (event) {
        var key = event.keyCode;
        if ($(this).val().trim().length === 0) return;

        var id = $(".choose").attr("data-id");
        if (id === undefined) id = 0;
        id = parseInt(id, 10);

        if (key === 38) { id--; }
        else if (key === 40) { id++; }
        else { return; }

        var length = parseInt($("#keywords").attr("data-length"), 10);
        if (isNaN(length) || length === 0) return;
        if (id > length) id = 1;
        if (id < 1) id = length;

        $(".keyword[data-id=" + id + "]").addClass("choose").siblings().removeClass("choose");
        $(".wd").val($(".keyword[data-id=" + id + "]").text());
    });
});
