/*
作者:D.Young
主页：https://yyv.me/
github：https://github.com/5iux/sou
日期：2019-07-26
版权所有，请勿删除
========================================
由 yeetime 修改
github：https://github.com/yeetime/sou2
日期：2019-12-13
========================================
由 imsyy 二次修改
github：https://github.com/imsyy/sou2
日期：2022-03-10
*/

// HTML 转义工具函数，防止 XSS
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

// URL 验证函数
function isValidUrl(str) {
    try {
        var url = new URL(str);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch (e) {
        return false;
    }
}

// ============================================
// 存储层：localStorage 优先，自动迁移旧 Cookie 数据
// ============================================
var Storage = {
    get: function (key) {
        var val = localStorage.getItem(key);
        if (val !== null) return val;
        // 兼容迁移：若 localStorage 无数据则尝试从 Cookie 读取
        var cookieVal = Cookies.get(key);
        if (cookieVal !== undefined) {
            localStorage.setItem(key, cookieVal);
            Cookies.remove(key);
            return cookieVal;
        }
        return null;
    },
    set: function (key, value) {
        if (typeof value === 'object') {
            value = JSON.stringify(value);
        }
        localStorage.setItem(key, value);
        // 清理同名旧 Cookie
        if (Cookies.get(key) !== undefined) {
            Cookies.remove(key);
        }
    },
    remove: function (key) {
        localStorage.removeItem(key);
        Cookies.remove(key);
    },
    getAll: function () {
        var result = {};
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            result[key] = localStorage.getItem(key);
        }
        return result;
    }
};

function applyTheme(theme) {
    var isLight = theme === 'light';
    document.documentElement.classList.toggle('light-theme', isLight);
    $("#icon-theme").text(isLight ? "☀️" : "🌙");
}

// 默认搜索引擎列表
var se_list_preinstall = {
    '1': {
        id: 1,
        title: "百度",
        url: "https://www.baidu.com/s",
        name: "wd",
        icon: "iconfont icon-baidu",
    },
    '2': {
        id: 2,
        title: "必应",
        url: "https://cn.bing.com/search",
        name: "q",
        icon: "iconfont icon-bing",
    },
    '3': {
        id: 3,
        title: "谷歌",
        url: "https://www.google.com/search",
        name: "q",
        icon: "iconfont icon-google",
    }
};

// 默认快捷方式
var quick_list_preinstall = {
    '1': {
        title: "哔哩哔哩",
        url: "https://www.bilibili.com/",
    },
    '2': {
        title: "Office",
        url: "https://www.office.com/",
    },
    '3': {
        title: "Main Page",
        url: "https://littlegaofx.github.io/Self/",
    },
    '4': {
        title: "Edge Surf",
        url: "https://littlegaofx.github.io/Surf/",
    },
    '5': {
        title: "New Concept Game",
        url: "https://littlegaofx.github.io/Game/",
    }
};

// 获取搜索引擎列表
function getSeList() {
    var se_list_local = Storage.get('se_list');
    if (se_list_local !== "{}" && se_list_local) {
        try {
            return JSON.parse(se_list_local);
        } catch (e) {
            console.warn('se_list 数据损坏，已重置:', e);
            Storage.remove('se_list');
        }
    }
    setSeList(se_list_preinstall);
    return se_list_preinstall;
}

// 设置搜索引擎列表
function setSeList(se_list) {
    if (se_list) {
        Storage.set('se_list', se_list);
        return true;
    }
    return false;
}

// 获得默认搜索引擎
function getSeDefault() {
    var se_default = Storage.get('se_default');
    return se_default ? se_default : "1";
}

//背景图片
var bg_img_preinstall = {
    "type": "1", // 1:使用主题默认的背景图片 2:关闭背景图片 3:使用自定义的背景图片
    "path": "", //自定义图片
};

// 获取背景图片
function getBgImg() {
    var bg_img_local = Storage.get('bg_img');
    if (bg_img_local && bg_img_local !== "{}") {
        try {
            return JSON.parse(bg_img_local);
        } catch (e) {
            console.warn('bg_img 数据损坏，已重置:', e);
            Storage.remove('bg_img');
        }
    }
    setBgImg(bg_img_preinstall);
    return bg_img_preinstall;
}

// 设置背景图片
function setBgImg(bg_img) {
    if (bg_img) {
        Storage.set('bg_img', bg_img);
        return true;
    }
    return false;
}

// 设置-壁纸
function setBgImgInit() {
    var bg_img = getBgImg();
    $("input[name='wallpaper-type'][value=" + bg_img["type"] + "]").click();
    if (bg_img["type"] === "6") {
        $("#wallpaper-url").val(bg_img["path"]);
        $("#wallpaper_url").fadeIn(100);
    } else {
        $("#wallpaper_url").fadeOut(300);
    }

    switch (bg_img["type"]) {
        case "1":
            var pictures = new Array();
            pictures[0] = './img/background1.webp';
            pictures[1] = './img/background2.webp';
            pictures[2] = './img/background3.webp';
            pictures[3] = './img/background4.webp';
            pictures[4] = './img/background5.webp';
            pictures[5] = './img/background6.webp';
            pictures[6] = './img/background7.webp';
            pictures[7] = './img/background8.webp';
            pictures[8] = './img/background9.webp';
            pictures[9] = './img/background10.webp';
            var rd = Math.floor(Math.random() * 10);
            $('#bg').attr('src', pictures[rd]) //随机默认壁纸
            break;
        case "2":
            $('#bg').attr('src', 'https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN') //必应每日
            break;
        case "3":
            $('#bg').attr('src', 'https://picsum.photos/1920/1080') //随机风景（Lorem Picsum）
            break;
        case "4":
            $('#bg').attr('src', 'https://t.mwm.moe/fj') //随机二次元（樱花 API）
            break;
        case "5":
            $('#bg').attr('src', 'https://t.mwm.moe/mp') //随机猫片
            break;
        case "6":
            if (bg_img["path"]) {
                $('#bg').attr('src', bg_img["path"]);
            }
            break;
    }
}

// 搜索框高亮
function focusWd() {
    $("body").addClass("onsearch");
}

// 搜索框取消高亮
function blurWd() {
    $("body").removeClass("onsearch");
    //隐藏输入
    $(".wd").val("");
    //隐藏搜索建议
    $("#keywords").hide();
}

// 搜索建议提示（带防抖）
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
                if (currentSeq !== _jsonpSeqId) return; // 忽略过时的响应
                //获取宽度
                $("#keywords").css("width", $('.sou').width());
                $("#keywords").empty().show();
                $.each(data.s, function (i, val) {
                    $('#keywords').append(`<div class="keyword" data-id="${i + 1}"><i class='iconfont icon-sousuo'></i>${escapeHtml(val)}</div>`);
                });
                $("#keywords").attr("data-length", data.s.length);
            },
            error: function () {
                $("#keywords").empty().hide();
            }
        })
    } else {
        $("#keywords").empty().hide();
    }
}

// 搜索框数据加载
function searchData() {
    var se_default = getSeDefault();
    var se_list = getSeList();
    var defaultSe = se_list[se_default];
    if (defaultSe) {
        $(".search").attr("action", defaultSe["url"]);
        $("#icon-se").attr("class", defaultSe["icon"]);
        $(".wd").attr("name", defaultSe["name"]);
    }

    // 判断窗口大小，添加输入框自动完成
    // var wid = $("body").width();
    // if (wid < 640) {
    //     $(".wd").attr('autocomplete', 'off');
    // } else {
    //     $(".wd").focus();
    //     focusWd();
    // }
}

// 搜索引擎列表加载
function seList() {
    var html = "";
    var se_list = getSeList();
    for (var i in se_list) {
        var safeTitle = escapeHtml(se_list[i]["title"]);
        var safeUrl = escapeHtml(se_list[i]["url"]);
        var safeName = escapeHtml(se_list[i]["name"]);
        var safeIcon = escapeHtml(se_list[i]["icon"]);
        html += `<div class='se-li' data-url='${safeUrl}' data-name='${safeName}' data-icon='${safeIcon}'>
        <a class='se-li-text'><i class='icon-sou-list ${safeIcon}'></i><span>${safeTitle}</span></a></div>`;
    }
    $(".search-engine-list").html(html);
}

// 设置-搜索引擎列表加载
function setSeInit() {
    var se_default = getSeDefault();
    var se_list = getSeList();
    var html = "";
    for (var i in se_list) {
        var safeKey = escapeHtml(i);
        var safeTitle = escapeHtml(se_list[i]["title"]);
        var tr = `<div class='se_list_div'><div class='se_list_num'>${safeKey}</div>`;
        if (i === se_default) {
            tr = `<div class='se_list_div'><div class='se_list_num'>
            <i class='iconfont icon-home'></i></div>`;
        }
        tr += `<div class='se_list_name'>${safeTitle}</div>
        <div class='se_list_button'>
        <button class='set_se_default' value='${safeKey}' style='border-radius: 8px 0px 0px 8px;'>
        <i class='iconfont icon-home'></i></button>
        <button class='edit_se' value='${safeKey}'>
        <i class='iconfont icon-xiugai'></i></button>
        <button class='delete_se' value='${safeKey}' style='border-radius: 0px 8px 8px 0px;'>
        <i class='iconfont icon-delete'></i></button></div>
        </div>`;
        html += tr;
    }
    $(".se_list_table").html(html);
}

// 获取快捷方式列表
function getQuickList() {
    var quick_list_local = Storage.get('quick_list');
    if (quick_list_local !== "{}" && quick_list_local) {
        try {
            return JSON.parse(quick_list_local);
        } catch (e) {
            console.warn('quick_list 数据损坏，已重置:', e);
            Storage.remove('quick_list');
        }
    }
    setQuickList(quick_list_preinstall);
    return quick_list_preinstall;
}

// 设置快捷方式列表
function setQuickList(quick_list) {
    if (quick_list) {
        Storage.set('quick_list', quick_list);
        return true;
    }
    return false;
}

// 快捷方式数据加载
function quickData() {
    var html = "";
    var quick_list = getQuickList();
    for (var i in quick_list) {
        var safeTitle = escapeHtml(quick_list[i]['title']);
        var rawUrl = quick_list[i]['url'];
        var safeUrl = isValidUrl(rawUrl) ? escapeHtml(rawUrl) : '#';
        html += `<div class="quick">
                    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeTitle}</a>
                </div>`;
    }
    $(".quick-all").html(html + `<div class="quick"><a id="set-quick"><i class="iconfont icon-tianjia-"></i></a></div>`);
}

// 设置-快捷方式加载
function setQuickInit() {
    var quick_list = getQuickList();
    var html = "";
    for (var i in quick_list) {
        var safeKey = escapeHtml(i);
        var safeTitle = escapeHtml(quick_list[i]['title']);
        var tr = `
        <div class='quick_list_div'>
            <div class='quick_list_div_num'>${safeKey}</div>
            <div class='quick_list_div_name'>${safeTitle}</div>
            <div class='quick_list_div_button'>
                <button class='edit_quick' value='${safeKey}' style='border-radius: 8px 0px 0px 8px;'>
                <i class='iconfont icon-xiugai'></i></button>
                <button class='delete_quick' value='${safeKey}' style='border-radius: 0px 8px 8px 0px;'>
                <i class='iconfont icon-delete'></i></button>
            </div>
        </div>`;
        html += tr;
    }
    $(".quick_list_table").html(html);
}

/**
 * 下载文本为文件
 * @param filename 文件名
 * @param text     内容
 */
function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var element = document.createElement('a');
    element.href = url;
    element.download = filename;
    element.style.display = 'none';
    document.body.appendChild(element);
    try {
        element.click();
    } finally {
        document.body.removeChild(element);
        URL.revokeObjectURL(url);
    }
}

// 打开设置
function openSet() {
    $("#menu").addClass('on');

    openBox();

    //更改设置图标
    $("#icon-menu").attr("class", "iconfont icon-home");

    //隐藏书签打开设置
    $(".mark").css({
        "display": "none",
    });
    $(".set").css({
        "display": "flex",
    });
}

// 关闭设置
function closeSet() {
    $("#menu").removeClass('on');

    closeBox();

    //更改设置图标
    $("#icon-menu").attr("class", "iconfont icon-shezhi");

    //隐藏设置
    $(".set").css({
        "display": "none",
    });

    // 刷新主页数据
    seList();
    quickData();
}

// 书签显示
function openBox() {
    $("#content").addClass('box');
    $(".mark").css({
        "display": "flex",
    });
    //时间上移
    $(".tool-all").css({
        "transform": 'translateY(-160%)'
    });
    //背景模糊
    $('#bg').css({
        "transform": 'scale(1.08)',
        "filter": "blur(10px)",
        "transition": "ease 0.3s",
    });
}

// 书签关闭
function closeBox() {
    $("#content").removeClass('box');
    $(".mark").css({
        "display": "none",
    });
    //时间下移
    $(".tool-all").css({
        "transform": 'translateY(-120%)'
    });
    //背景模糊
    $('#bg').css({
        "transform": 'scale(1)',
        "filter": "blur(0px)",
        "transition": "ease 0.3s",
    });
}

//显示设置搜索引擎列表
function showSe() {
    $(".se_list").show();
    $(".se_add_preinstall").show();
}

//隐藏设置搜索引擎列表
function hideSe() {
    $(".se_list").hide();
    $(".se_add_preinstall").hide();
}

//显示设置快捷方式列表
function showQuick() {
    $(".quick_list").show();
    $(".se_add_preinstalls").show();
}

//隐藏设置快捷方式列表
function hideQuick() {
    $(".quick_list").hide();
    $(".se_add_preinstalls").hide();
}


$(document).ready(function () {
    // 主题加载
    applyTheme(Storage.get('theme') || 'dark');


    // 搜索框数据加载
    searchData();

    // 搜索引擎列表加载
    seList();

    // 快捷方式数据加载
    quickData();

    // 壁纸数据加载
    setBgImgInit();

    // 点击事件
    $(document).on('click', function (e) {
        // 选择搜索引擎点击
        if ($(".search-engine").is(":hidden") && $(".se").is(e.target) || $(".search-engine").is(":hidden") && $("#icon-se").is(e.target)) {
            if ($(".se").is(e.target) || $("#icon-se").is(e.target)) {
                //获取宽度
                $(".search-engine").css("width", $('.sou').width() - 30);
                //出现动画
                $(".search-engine").slideDown(160);
            }
        } else {
            if (!$(".search-engine").is(e.target) && $(".search-engine").has(e.target).length === 0) {
                $(".search-engine").slideUp(160);
            }
        }

        // 自动提示隐藏
        if (!$(".sou").is(e.target) && $(".sou").has(e.target).length === 0) {
            $("#keywords").hide();
        }
    });

    // 时间点击
    $("#time_text").click(function () {
        if ($("#content").hasClass('box')) {
            closeBox();
            closeSet();
            blurWd();
        } else {
            openBox();
        }
    });

    // 搜索引擎列表点击
    $(".search-engine-list").on("click", ".se-li", function () {
        var url = $(this).attr('data-url');
        var name = $(this).attr('data-name');
        var icon = $(this).attr('data-icon');
        $(".search").attr("action", url);
        $(".wd").attr("name", name);
        $("#icon-se").attr("class", icon);
        $(".search-engine").slideUp(160);
    });

    // 搜索框点击事件
    $(document).on('click', '.sou', function () {
        focusWd();
        $(".search-engine").slideUp(160);
    });

    $(document).on('click', '.wd', function () {
        focusWd();
        keywordReminder();
        $(".search-engine").slideUp(160);
    });

    // 点击其他区域关闭事件
    $(document).on('click', '.close_sou', function () {
        blurWd();
        closeSet();
    });

    // 点击搜索引擎时隐藏自动提示
    $(document).on('click', '.se', function () {
        $('#keywords').toggle();
    });

    // 恢复自动提示
    $(document).on('click', '.se-li', function () {
        $('#keywords').show();
    });

    // 自动提示 (调用百度 api）
    $('.wd').keyup(function (event) {
        var key = event.keyCode;
        // 屏蔽上下键
        var shieldKey = [38, 40];
        if (shieldKey.includes(key)) return;
        keywordReminder();
    });

    // 点击自动提示的搜索建议
    $("#keywords").on("click", ".keyword", function () {
        var wd = $(this).text();
        $(".wd").val(wd);
        $("#search-submit").click();
    });

    // 自动提示键盘方向键选择操作
    $(".wd").keydown(function (event) { //上下键获取焦点
        var key = event.keyCode;
        if ($(this).val().trim().length === 0) return;

        var id = $(".choose").attr("data-id");
        if (id === undefined) id = 0;
        id = parseInt(id, 10);

        if (key === 38) {
            /*向上按钮*/
            id--;
        } else if (key === 40) {
            /*向下按钮*/
            id++;
        } else {
            return;
        }
        var length = parseInt($("#keywords").attr("data-length"), 10);
        if (isNaN(length) || length === 0) return;
        if (id > length) id = 1;
        if (id < 1) id = length;

        $(".keyword[data-id=" + id + "]").addClass("choose").siblings().removeClass("choose");
        $(".wd").val($(".keyword[data-id=" + id + "]").text());
    });

    // 菜单点击
    $("#menu").click(function () {
        if ($(this).hasClass('on')) {
            closeSet();
        } else {
            openSet();

            // 设置内容加载
            setSeInit(); //搜索引擎设置
            setQuickInit(); //快捷方式设置
        }
    });

    // 主题切换
    $("#theme-toggle").click(function () {
        var current = Storage.get('theme') || 'dark';
        var next = current === 'light' ? 'dark' : 'light';
        Storage.set('theme', next);
        applyTheme(next);
        iziToast.show({
            timeout: 1500,
            message: next === 'light' ? '已切换为浅色主题' : '已切换为深色主题'
        });
    });

    // 快捷方式添加按钮点击
    $("#set-quick").click(function () {
        openSet();

        // 设置内容加载
        setSeInit(); //搜索引擎设置
        setQuickInit(); //快捷方式设置

        //添加快捷方式
        $("#set-quick-menu").trigger('click');
        $(".set_quick_list_add").trigger('click');
    });

    // 修改默认搜索引擎
    $(".se_list_table").on("click", ".set_se_default", function () {
        var name = $(this).val();
        iziToast.show({
            timeout: 8000,
            message: '是否设置为默认搜索引擎？',
            buttons: [
                ['<button>确认</button>', function (instance, toast) {
                    Storage.set('se_default', name);
                    setSeInit();
                    instance.hide({
                        transitionOut: 'flipOutX',
                    }, toast, 'buttonName');
                    iziToast.show({
                        message: '设置成功'
                    });
                    setTimeout(function () {
                        window.location.reload()
                    }, 1000);
                }, true],
                ['<button>取消</button>', function (instance, toast) {
                    instance.hide({
                        transitionOut: 'flipOutX',
                    }, toast, 'buttonName');
                }]
            ]
        });
    });

    // 搜索引擎添加
    $(".set_se_list_add").click(function () {
        $(".se_add_content input").val("");

        hideSe();
        $(".se_add_content").show();
    });

    // 搜索引擎保存
    $(".se_add_save").click(function () {
        var key_inhere = $(".se_add_content input[name='key_inhere']").val();
        var key = $(".se_add_content input[name='key']").val();
        var title = $(".se_add_content input[name='title']").val();
        var url = $(".se_add_content input[name='url']").val();
        var name = $(".se_add_content input[name='name']").val();
        var icon = "iconfont icon-wangluo";

        var num = /^\+?[1-9][0-9]*$/;
        if (!num.test(key)) {
            iziToast.show({
                timeout: 2000,
                message: '序号 ' + key + ' 不是正整数'
            });
            return;
        }

        if (!url || !isValidUrl(url)) {
            iziToast.show({
                timeout: 2000,
                message: '请输入有效的搜索引擎 URL（以 http/https 开头）'
            });
            return;
        }

        var se_list = getSeList();

        if (se_list[key]) {
            iziToast.show({
                timeout: 8000,
                message: '搜索引擎 ' + key + ' 已有数据，是否覆盖？',
                buttons: [
                    ['<button>确认</button>', function (instance, toast) {
                        se_list[key] = {
                            title: title,
                            url: url,
                            name: name,
                            icon: icon,
                        };
                        setSeList(se_list);
                        setSeInit();
                        $(".se_add_content").hide();
                        //显示列表
                        showSe();

                        instance.hide({
                            transitionOut: 'flipOutX',
                        }, toast, 'buttonName');
                        iziToast.show({
                            message: '覆盖成功'
                        });
                    }, true],
                    ['<button>取消</button>', function (instance, toast) {
                        instance.hide({
                            transitionOut: 'flipOutX',
                        }, toast, 'buttonName');
                    }]
                ]
            });
            return;
        }

        if (key_inhere && key !== key_inhere) {
            delete se_list[key_inhere];
        }

        se_list[key] = {
            title: title,
            url: url,
            name: name,
            icon: icon,
        };
        setSeList(se_list);
        setSeInit();
        iziToast.show({
            timeout: 2000,
            message: '添加成功'
        });
        $(".se_add_content").hide();
        showSe();
    });

    // 关闭表单
    $(".se_add_cancel").click(function () {
        $(".se_add_content").hide();

        //显示列表
        showSe();
    });

    // 搜索引擎修改
    $(".se_list").on("click", ".edit_se", function () {

        var se_list = getSeList();
        var key = $(this).val();
        $(".se_add_content input[name='key_inhere']").val(key);
        $(".se_add_content input[name='key']").val(key);
        $(".se_add_content input[name='title']").val(se_list[key]["title"]);
        $(".se_add_content input[name='url']").val(se_list[key]["url"]);
        $(".se_add_content input[name='name']").val(se_list[key]["name"]);
        // $(".se_add_content input[name='icon']").val("iconfont icon-Earth");

        //隐藏列表
        hideSe();

        $(".se_add_content").show();
    });

    // 搜索引擎删除
    $(".se_list").on("click", ".delete_se", function () {
        var se_default = getSeDefault();
        var key = $(this).val();
        if (key == se_default) {
            iziToast.show({
                message: '默认搜索引擎不可删除'
            });
        } else {
            iziToast.show({
                timeout: 8000,
                message: '搜索引擎 ' + key + ' 是否删除？',
                buttons: [
                    ['<button>确认</button>', function (instance, toast) {
                        var se_list = getSeList();
                        delete se_list[key];
                        setSeList(se_list);
                        setSeInit();
                        instance.hide({
                            transitionOut: 'flipOutX',
                        }, toast, 'buttonName');
                        iziToast.show({
                            message: '删除成功'
                        });
                    }, true],
                    ['<button>取消</button>', function (instance, toast) {
                        instance.hide({
                            transitionOut: 'flipOutX',
                        }, toast, 'buttonName');
                    }]
                ]
            });
        }
    });

    // 恢复预设搜索引擎
    $(".set_se_list_preinstall").click(function () {
        iziToast.show({
            timeout: 8000,
            message: '现有搜索引擎数据将被清空',
            buttons: [
                ['<button>确认</button>', function (instance, toast) {
                    setSeList(se_list_preinstall);
                    Storage.set('se_default', '1');
                    setSeInit();
                    instance.hide({
                        transitionOut: 'flipOutX',
                    }, toast, 'buttonName');
                    iziToast.show({
                        message: '重置成功'
                    });
                    setTimeout(function () {
                        window.location.reload()
                    }, 1000);
                }, true],
                ['<button>取消</button>', function (instance, toast) {
                    instance.hide({
                        transitionOut: 'flipOutX',
                    }, toast, 'buttonName');
                }]
            ]
        });
    });

    // 设置-快捷方式添加
    $(".set_quick_list_add").click(function () {
        $(".quick_add_content input").val("");
        $(".quick_add_content").show();

        //隐藏列表
        hideQuick();
    });

    // 设置-快捷方式保存
    $(".quick_add_save").click(function () {
        var key_inhere = $(".quick_add_content input[name='key_inhere']").val();
        var key = $(".quick_add_content input[name='key']").val();
        var title = $(".quick_add_content input[name='title']").val();
        var url = $(".quick_add_content input[name='url']").val();
        var img = $(".quick_add_content input[name='img']").val();

        var num = /^\+?[1-9][0-9]*$/;
        if (!num.test(key)) {
            iziToast.show({
                timeout: 2000,
                message: '快捷方式 ' + key + ' 不是正整数'
            });
            return;
        }

        if (!url || !isValidUrl(url)) {
            iziToast.show({
                timeout: 2000,
                message: '请输入有效的 URL（以 http/https 开头）'
            });
            return;
        }

        var quick_list = getQuickList();

        if (quick_list[key]) {
            iziToast.show({
                timeout: 8000,
                message: '快捷方式 ' + key + ' 已有数据，是否覆盖？',
                buttons: [
                    ['<button>确认</button>', function (instance, toast) {
                        quick_list[key] = {
                            title: title,
                            url: url,
                            img: img,
                        };
                        setQuickList(quick_list);
                        setQuickInit();
                        $(".quick_add_content").hide();
                        //显示列表
                        showQuick();

                        instance.hide({
                            transitionOut: 'flipOutX',
                        }, toast, 'buttonName');
                        iziToast.show({
                            message: '覆盖成功'
                        });
                    }, true],
                    ['<button>取消</button>', function (instance, toast) {
                        instance.hide({
                            transitionOut: 'flipOutX',
                        }, toast, 'buttonName');
                    }]
                ]
            });
            return;
        }

        if (key_inhere && key !== key_inhere) {
            delete quick_list[key_inhere];
        }

        quick_list[key] = {
            title: title,
            url: url,
            img: img,
        };
        setQuickList(quick_list);
        setQuickInit();
        $(".quick_add_content").hide();
        iziToast.show({
            timeout: 2000,
            message: '添加成功'
        });

        //显示列表
        showQuick();
    });

    // 设置-快捷方式关闭添加表单
    $(".quick_add_cancel").click(function () {
        $(".quick_add_content").hide();

        //显示列表
        showQuick();
    });

    //恢复预设快捷方式
    $(".set_quick_list_preinstall").click(function () {
        iziToast.show({
            timeout: 8000,
            message: '快捷方式数据将被清空',
            buttons: [
                ['<button>确认</button>', function (instance, toast) {
                    setQuickList(quick_list_preinstall);
                    setQuickInit();
                    instance.hide({
                        transitionOut: 'flipOutX',
                    }, toast, 'buttonName');
                    iziToast.show({
                        timeout: 2000,
                        message: '重置成功'
                    });
                    // setTimeout(function () {
                    //     window.location.reload()
                    // }, 1000);
                }, true],
                ['<button>取消</button>', function (instance, toast) {
                    instance.hide({
                        transitionOut: 'flipOutX',
                    }, toast, 'buttonName');
                }]
            ]
        });
    });

    // 快捷方式修改
    $(".quick_list").on("click", ".edit_quick", function () {

        var quick_list = getQuickList();
        var key = $(this).val();
        $(".quick_add_content input[name='key_inhere']").val(key);
        $(".quick_add_content input[name='key']").val(key);
        $(".quick_add_content input[name='title']").val(quick_list[key]["title"]);
        $(".quick_add_content input[name='url']").val(quick_list[key]["url"]);
        $(".quick_add_content input[name='img']").val(quick_list[key]["img"]);

        //隐藏列表
        hideQuick();

        $(".quick_add_content").show();
    });

    // 快捷方式删除
    $(".quick_list").on("click", ".delete_quick", function () {

        var key = $(this).val();

        iziToast.show({
            timeout: 8000,
            message: '快捷方式 ' + key + ' 是否删除？',
            buttons: [
                ['<button>确认</button>', function (instance, toast) {
                    var quick_list = getQuickList();
                    delete quick_list[key];
                    setQuickList(quick_list);
                    setQuickInit();
                    instance.hide({
                        transitionOut: 'flipOutX',
                    }, toast, 'buttonName');
                    iziToast.show({
                        timeout: 2000,
                        message: '删除成功'
                    });
                }, true],
                ['<button>取消</button>', function (instance, toast) {
                    instance.hide({
                        transitionOut: 'flipOutX',
                    }, toast, 'buttonName');
                }]
            ]
        });
    });

    // 壁纸设置
    $("#wallpaper").on("click", ".set-wallpaper", function () {
        var type = $(this).val();
        var bg_img = getBgImg();
        bg_img["type"] = type;

        var descriptions = {
            "1": "显示默认壁纸，刷新页面以生效",
            "2": "显示必应每日一图，每天更新，刷新页面以生效 | API @ Bing",
            "3": "显示随机风景照片，每次刷新更换，刷新页面以生效 | API @ Lorem Picsum",
            "4": "显示随机二次元图片，每次刷新更换，刷新页面以生效 | API @ 樱花",
            "5": "显示随机猫咪照片，治愈系壁纸，刷新页面以生效 | API @ 樱花",
            "6": "使用自定义图片 URL，请在下方填入地址后保存"
        };

        $('#wallpaper_text').html(descriptions[type] || "");
        setBgImg(bg_img);

        if (type === "6") {
            $("#wallpaper_url").fadeIn(200);
            // 恢复已保存的 URL
            if (bg_img["path"]) {
                $("#wallpaper-url").val(bg_img["path"]);
            }
        } else {
            $("#wallpaper_url").fadeOut(200);
            iziToast.show({
                message: '壁纸设置成功，刷新生效',
            });
        }
    });

    // 自定义壁纸 URL 保存
    $(".wallpaper_save").click(function () {
        var url = $("#wallpaper-url").val();
        if (!url || !isValidUrl(url)) {
            iziToast.show({
                timeout: 2000,
                message: '请输入有效的图片 URL（以 http/https 开头）'
            });
            return;
        }
        var bg_img = getBgImg();
        bg_img["type"] = "6";
        bg_img["path"] = url;
        setBgImg(bg_img);
        iziToast.show({
            message: '自定义壁纸设置成功，刷新生效',
        });
    });

    // 我的数据导出
    $("#my_data_out").click(function () {
        var allData = Storage.getAll();
        var json = JSON.stringify(allData);
        download("Snavigation-back-up-" + Date.now() + ".json", json);
        iziToast.show({
            timeout: 2000,
            message: '已导出备份文件至下载目录'
        });
    });

    // 我的数据导入 点击触发文件选择
    $("#my_data_in").click(function () {
        $("#my_data_file").click();
    });

    // 选择文件后读取文件内容
    $("#my_data_file").change(function () {
        var selectedFile = document.getElementById('my_data_file').files[0];
        //var name = selectedFile.name;//读取选中文件的文件名
        //var size = selectedFile.size;//读取选中文件的大小
        //console.log("文件名:"+name+" 大小:"+size);

        var reader = new FileReader(); //这是核心,读取操作就是由它完成.
        reader.readAsText(selectedFile); //读取文件的内容,也可以读取文件的URL
        reader.onload = function () {
            //当读取完成后回调这个函数,然后此时文件的内容存储到了result中,直接操作即可
            //console.log(this.result);

            // json 格式校验
            var mydata;
            try {
                mydata = JSON.parse(this.result);
            } catch (e) {
                iziToast.show({
                    timeout: 2000,
                    message: '数据解析异常'
                });
                return;
            }
            if (typeof mydata != 'object') {
                iziToast.show({
                    timeout: 2000,
                    message: '数据格式错误'
                });
                return;
            }

            iziToast.show({
                timeout: 8000,
                message: '当前数据将会被覆盖！是否继续导入？',
                buttons: [
                    ['<button>确认</button>', function (instance, toast) {
                        // 只允许导入白名单内的数据键
                        var allowedKeys = ['se_list', 'quick_list', 'bg_img', 'se_default'];
                        for (var key in mydata) {
                            if (allowedKeys.indexOf(key) !== -1) {
                                // 验证导入数据中的 URL 安全性
                                if (key === 'se_list' || key === 'quick_list') {
                                    try {
                                        var list = typeof mydata[key] === 'string' ? JSON.parse(mydata[key]) : mydata[key];
                                        for (var k in list) {
                                            if (list[k].url && !isValidUrl(list[k].url)) {
                                                iziToast.show({ timeout: 3000, message: '导入数据包含无效 URL，已拒绝导入' });
                                                return;
                                            }
                                        }
                                    } catch (e) {
                                        iziToast.show({ timeout: 2000, message: '导入数据格式异常' });
                                        return;
                                    }
                                }
                                // 验证 bg_img 中的 URL
                                if (key === 'bg_img') {
                                    try {
                                        var bgData = typeof mydata[key] === 'string' ? JSON.parse(mydata[key]) : mydata[key];
                                        if (bgData.path && !isValidUrl(bgData.path)) {
                                            iziToast.show({ timeout: 3000, message: '导入壁纸 URL 无效，已拒绝导入' });
                                            return;
                                        }
                                    } catch (e) {
                                        iziToast.show({ timeout: 2000, message: '壁纸数据格式异常' });
                                        return;
                                    }
                                }
                                Storage.set(key, mydata[key]);
                            }
                        }
                        instance.hide({
                            transitionOut: 'flipOutX',
                        }, toast, 'buttonName');
                        iziToast.show({
                            timeout: 2000,
                            message: '导入成功'
                        });
                        setTimeout(function () {
                            window.location.reload()
                        }, 1000);
                    }, true],
                    ['<button>取消</button>', function (instance, toast) {
                        instance.hide({
                            transitionOut: 'flipOutX',
                        }, toast, 'buttonName');
                    }]
                ]
            });
        }
    });
});
