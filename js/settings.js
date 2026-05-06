/* ============================================
 * Snavigation - Settings Module
 * 页面设置面板控制：选项卡切换、搜索引擎 CRUD、
 *                   快捷方式 CRUD、壁纸设置交互、
 *                   数据备份（导入/导出）
 * 依赖：storage.js, search.js, bookmarks.js, wallpaper.js
 * ============================================ */

// ══════════════════════════════════════════════════════════════════
// 设置面板开关
// ══════════════════════════════════════════════════════════════════

function openSet() {
    $("#menu").addClass('on');
    openBox();
    $("#icon-menu").attr("class", "iconfont icon-home");
    $(".mark").css({ "display": "none" });
    $(".set").css({ "display": "flex" });
}

function closeSet() {
    $("#menu").removeClass('on');
    closeBox();
    $("#icon-menu").attr("class", "iconfont icon-shezhi");
    $(".set").css({ "display": "none" });
    // 刷新主页数据
    seList();
    quickData();
}

// ══════════════════════════════════════════════════════════════════
// 书签面板（box）开关
// ══════════════════════════════════════════════════════════════════

function openBox() {
    $("#content").addClass('box');
    $(".mark").css({ "display": "flex" });
    $(".tool-all").css({ "transform": 'translateY(-160%)' });
    $('#bg').css({
        "transform": 'scale(1.08)',
        "filter": "blur(10px)",
        "transition": "ease 0.3s"
    });
}

function closeBox() {
    $("#content").removeClass('box');
    $(".mark").css({ "display": "none" });
    $(".tool-all").css({ "transform": 'translateY(-120%)' });
    $('#bg').css({
        "transform": 'scale(1)',
        "filter": "blur(0px)",
        "transition": "ease 0.3s"
    });
}

// ══════════════════════════════════════════════════════════════════
// 设置面板内的列表显隐控制
// ══════════════════════════════════════════════════════════════════

function showSe() {
    $(".se_list").show();
    $(".se_add_preinstall").show();
}

function hideSe() {
    $(".se_list").hide();
    $(".se_add_preinstall").hide();
}

function showQuick() {
    $(".quick_list").show();
    $(".se_add_preinstalls").show();
}

function hideQuick() {
    $(".quick_list").hide();
    $(".se_add_preinstalls").hide();
}

// ══════════════════════════════════════════════════════════════════
// 设置页 - 搜索引擎列表渲染
// ══════════════════════════════════════════════════════════════════

function setSeInit() {
    var se_default = getSeDefault();
    var se_list = getSeList();
    var html = "";
    for (var i in se_list) {
        var safeKey = escapeHtml(i);
        var safeTitle = escapeHtml(se_list[i]["title"]);
        var tr = '<div class=\'se_list_div\'><div class=\'se_list_num\'>' + safeKey + '</div>';
        if (i === se_default) {
            tr = '<div class=\'se_list_div\'><div class=\'se_list_num\'>' +
                 '<i class=\'iconfont icon-home\'></i></div>';
        }
        tr += '<div class=\'se_list_name\'>' + safeTitle + '</div>' +
              '<div class=\'se_list_button\'>' +
              '<button class=\'set_se_default\' value=\'' + safeKey + '\' style=\'border-radius: 8px 0px 0px 8px;\'>' +
              '<i class=\'iconfont icon-home\'></i></button>' +
              '<button class=\'edit_se\' value=\'' + safeKey + '\'>' +
              '<i class=\'iconfont icon-xiugai\'></i></button>' +
              '<button class=\'delete_se\' value=\'' + safeKey + '\' style=\'border-radius: 0px 8px 8px 0px;\'>' +
              '<i class=\'iconfont icon-delete\'></i></button></div>' +
              '</div>';
        html += tr;
    }
    $(".se_list_table").html(html);
}

// ══════════════════════════════════════════════════════════════════
// 设置页 - 快捷方式列表渲染
// ══════════════════════════════════════════════════════════════════

function setQuickInit() {
    var quick_list = getQuickList();
    var html = "";
    for (var i in quick_list) {
        var safeKey = escapeHtml(i);
        var safeTitle = escapeHtml(quick_list[i]['title']);
        var tr = '<div class=\'quick_list_div\'>' +
                 '<div class=\'quick_list_div_num\'>' + safeKey + '</div>' +
                 '<div class=\'quick_list_div_name\'>' + safeTitle + '</div>' +
                 '<div class=\'quick_list_div_button\'>' +
                 '<button class=\'edit_quick\' value=\'' + safeKey + '\' style=\'border-radius: 8px 0px 0px 8px;\'>' +
                 '<i class=\'iconfont icon-xiugai\'></i></button>' +
                 '<button class=\'delete_quick\' value=\'' + safeKey + '\' style=\'border-radius: 0px 8px 8px 0px;\'>' +
                 '<i class=\'iconfont icon-delete\'></i></button>' +
                 '</div></div>';
        html += tr;
    }
    $(".quick_list_table").html(html);
}

// ══════════════════════════════════════════════════════════════════
// 模块初始化：绑定所有设置面板事件
// ══════════════════════════════════════════════════════════════════

$(function () {
    // ── 设置面板选项卡切换 ────────────────────────────────────
    $(".set .tabs .tab-items").click(function () {
        $(this).addClass("actives").siblings().removeClass("actives");
        $(".productss .mainConts").eq($(this).index()).css("display", "flex").siblings().css("display", "none");
    });

    // ── 菜单按钮：打开/关闭设置 ───────────────────────────────
    $("#menu").click(function () {
        if ($(this).hasClass('on')) {
            closeSet();
        } else {
            openSet();
            setSeInit();
            setQuickInit();
        }
    });

    // ═══════════════════════════════════════════════════════════
    // 搜索引擎设置 事件
    // ═══════════════════════════════════════════════════════════

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
                    instance.hide({ transitionOut: 'flipOutX' }, toast, 'buttonName');
                    iziToast.show({ message: '设置成功' });
                    setTimeout(function () { window.location.reload(); }, 1000);
                }, true],
                ['<button>取消</button>', function (instance, toast) {
                    instance.hide({ transitionOut: 'flipOutX' }, toast, 'buttonName');
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
            iziToast.show({ timeout: 2000, message: '序号 ' + key + ' 不是正整数' });
            return;
        }

        if (!url || !isValidUrl(url)) {
            iziToast.show({ timeout: 2000, message: '请输入有效的搜索引擎 URL（以 http/https 开头）' });
            return;
        }

        var se_list = getSeList();

        if (se_list[key]) {
            iziToast.show({
                timeout: 8000,
                message: '搜索引擎 ' + key + ' 已有数据，是否覆盖？',
                buttons: [
                    ['<button>确认</button>', function (instance, toast) {
                        se_list[key] = { title: title, url: url, name: name, icon: icon };
                        setSeList(se_list);
                        setSeInit();
                        $(".se_add_content").hide();
                        showSe();
                        instance.hide({ transitionOut: 'flipOutX' }, toast, 'buttonName');
                        iziToast.show({ message: '覆盖成功' });
                    }, true],
                    ['<button>取消</button>', function (instance, toast) {
                        instance.hide({ transitionOut: 'flipOutX' }, toast, 'buttonName');
                    }]
                ]
            });
            return;
        }

        if (key_inhere && key !== key_inhere) {
            delete se_list[key_inhere];
        }

        se_list[key] = { title: title, url: url, name: name, icon: icon };
        setSeList(se_list);
        setSeInit();
        iziToast.show({ timeout: 2000, message: '添加成功' });
        $(".se_add_content").hide();
        showSe();
    });

    // 关闭搜索引擎表单
    $(".se_add_cancel").click(function () {
        $(".se_add_content").hide();
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
        hideSe();
        $(".se_add_content").show();
    });

    // 搜索引擎删除
    $(".se_list").on("click", ".delete_se", function () {
        var se_default = getSeDefault();
        var key = $(this).val();
        if (key == se_default) {
            iziToast.show({ message: '默认搜索引擎不可删除' });
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
                        instance.hide({ transitionOut: 'flipOutX' }, toast, 'buttonName');
                        iziToast.show({ message: '删除成功' });
                    }, true],
                    ['<button>取消</button>', function (instance, toast) {
                        instance.hide({ transitionOut: 'flipOutX' }, toast, 'buttonName');
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
                    instance.hide({ transitionOut: 'flipOutX' }, toast, 'buttonName');
                    iziToast.show({ message: '重置成功' });
                    setTimeout(function () { window.location.reload(); }, 1000);
                }, true],
                ['<button>取消</button>', function (instance, toast) {
                    instance.hide({ transitionOut: 'flipOutX' }, toast, 'buttonName');
                }]
            ]
        });
    });

    // ═══════════════════════════════════════════════════════════
    // 快捷方式设置 事件
    // ═══════════════════════════════════════════════════════════

    // 快捷方式添加
    $(".set_quick_list_add").click(function () {
        $(".quick_add_content input").val("");
        $(".quick_add_content").show();
        hideQuick();
    });

    // 快捷方式保存
    $(".quick_add_save").click(function () {
        var key_inhere = $(".quick_add_content input[name='key_inhere']").val();
        var key = $(".quick_add_content input[name='key']").val();
        var title = $(".quick_add_content input[name='title']").val();
        var url = $(".quick_add_content input[name='url']").val();
        var img = $(".quick_add_content input[name='img']").val();

        var num = /^\+?[1-9][0-9]*$/;
        if (!num.test(key)) {
            iziToast.show({ timeout: 2000, message: '快捷方式 ' + key + ' 不是正整数' });
            return;
        }

        if (!url || !isValidUrl(url)) {
            iziToast.show({ timeout: 2000, message: '请输入有效的 URL（以 http/https 开头）' });
            return;
        }

        var quick_list = getQuickList();

        if (quick_list[key]) {
            iziToast.show({
                timeout: 8000,
                message: '快捷方式 ' + key + ' 已有数据，是否覆盖？',
                buttons: [
                    ['<button>确认</button>', function (instance, toast) {
                        quick_list[key] = { title: title, url: url, img: img };
                        setQuickList(quick_list);
                        setQuickInit();
                        $(".quick_add_content").hide();
                        showQuick();
                        instance.hide({ transitionOut: 'flipOutX' }, toast, 'buttonName');
                        iziToast.show({ message: '覆盖成功' });
                    }, true],
                    ['<button>取消</button>', function (instance, toast) {
                        instance.hide({ transitionOut: 'flipOutX' }, toast, 'buttonName');
                    }]
                ]
            });
            return;
        }

        if (key_inhere && key !== key_inhere) {
            delete quick_list[key_inhere];
        }

        quick_list[key] = { title: title, url: url, img: img };
        setQuickList(quick_list);
        setQuickInit();
        $(".quick_add_content").hide();
        iziToast.show({ timeout: 2000, message: '添加成功' });
        showQuick();
    });

    // 关闭快捷方式添加表单
    $(".quick_add_cancel").click(function () {
        $(".quick_add_content").hide();
        showQuick();
    });

    // 恢复预设快捷方式
    $(".set_quick_list_preinstall").click(function () {
        iziToast.show({
            timeout: 8000,
            message: '快捷方式数据将被清空',
            buttons: [
                ['<button>确认</button>', function (instance, toast) {
                    setQuickList(quick_list_preinstall);
                    setQuickInit();
                    instance.hide({ transitionOut: 'flipOutX' }, toast, 'buttonName');
                    iziToast.show({ timeout: 2000, message: '重置成功' });
                }, true],
                ['<button>取消</button>', function (instance, toast) {
                    instance.hide({ transitionOut: 'flipOutX' }, toast, 'buttonName');
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
                    instance.hide({ transitionOut: 'flipOutX' }, toast, 'buttonName');
                    iziToast.show({ timeout: 2000, message: '删除成功' });
                }, true],
                ['<button>取消</button>', function (instance, toast) {
                    instance.hide({ transitionOut: 'flipOutX' }, toast, 'buttonName');
                }]
            ]
        });
    });

    // ═══════════════════════════════════════════════════════════
    // 壁纸设置 事件
    // ═══════════════════════════════════════════════════════════

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
        clearBgCache();
        clearCachedBgData();
        localStorage.removeItem(BG_LAST_URL_KEY);
        localStorage.removeItem(BG_LAST_TYPE_KEY);

        if (type === "6") {
            $("#wallpaper_url").fadeIn(200);
            if (bg_img["path"]) { $("#wallpaper-url").val(bg_img["path"]); }
            if (getBgApiKey()) { $("#wallpaper-apikey").attr("placeholder", "API 密钥已保存（输入新值以更新）"); }
        } else {
            $("#wallpaper_url").fadeOut(200);
            iziToast.show({ message: '壁纸设置成功，刷新生效' });
        }
    });

    // 自定义壁纸 URL 保存
    $(".wallpaper_save").click(function () {
        var url = $("#wallpaper-url").val().trim();
        var urlForValidation = url.replace(/\{key\}/g, 'testkey');
        if (!url || !isValidUrl(urlForValidation)) {
            iziToast.show({ timeout: 2000, message: '请输入有效的图片 URL（以 http/https 开头）' });
            return;
        }
        var bg_img = getBgImg();
        bg_img["type"] = "6";
        bg_img["path"] = url;
        setBgImg(bg_img);
        var apiKeyInput = $("#wallpaper-apikey").val();
        if (apiKeyInput) {
            setBgApiKey(apiKeyInput);
            $("#wallpaper-apikey").val("").attr("placeholder", "API 密钥已保存（输入新值以更新）");
        }
        clearBgCache();
        clearCachedBgData();
        localStorage.removeItem(BG_LAST_URL_KEY);
        localStorage.removeItem(BG_LAST_TYPE_KEY);
        iziToast.show({ message: '自定义壁纸设置成功，刷新生效' });
    });

    // 每次刷新更换背景 切换
    $("#wallpaper-refresh-enable").on("change", function () {
        var bg_img = getBgImg();
        bg_img["refreshOnLoad"] = !!$(this).is(":checked");
        setBgImg(bg_img);
        iziToast.show({
            message: bg_img["refreshOnLoad"] ? '已开启每次刷新更换背景，刷新生效' : '已关闭每次刷新更换背景，刷新生效'
        });
    });

    // 比例自适应切换
    $("#wallpaper-fit-enable").on("change", function () {
        var bg_img = getBgImg();
        var enabled = !!$(this).is(":checked");
        bg_img["bg_fit"] = enabled;
        setBgImg(bg_img);
        applyFitMode(enabled);
        iziToast.show({
            message: enabled ? '已开启比例自适应（完整显示 + 模糊填充）' : '已关闭比例自适应（铺满裁剪）'
        });
    });
    // ═══════════════════════════════════════════════════════════
    // 数据备份 事件
    // ═══════════════════════════════════════════════════════════

    // 我的数据导出
    $("#my_data_out").click(function () {
        var allData = Storage.getAll();
        var json = JSON.stringify(allData);
        download("Snavigation-back-up-" + Date.now() + ".json", json);
        iziToast.show({ timeout: 2000, message: '已导出备份文件至下载目录' });
    });

    // 我的数据导入 点击触发文件选择
    $("#my_data_in").click(function () {
        $("#my_data_file").click();
    });

    // 选择文件后读取文件内容
    $("#my_data_file").change(function () {
        var selectedFile = document.getElementById('my_data_file').files[0];
        var reader = new FileReader();
        reader.readAsText(selectedFile);
        reader.onload = function () {
            var mydata;
            try {
                mydata = JSON.parse(this.result);
            } catch (e) {
                iziToast.show({ timeout: 2000, message: '数据解析异常' });
                return;
            }
            if (typeof mydata != 'object') {
                iziToast.show({ timeout: 2000, message: '数据格式错误' });
                return;
            }

            iziToast.show({
                timeout: 8000,
                message: '当前数据将会被覆盖！是否继续导入？',
                buttons: [
                    ['<button>确认</button>', function (instance, toast) {
                        var allowedKeys = ['se_list', 'quick_list', 'bg_img', 'se_default'];
                        for (var key in mydata) {
                            if (allowedKeys.indexOf(key) !== -1) {
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
                        instance.hide({ transitionOut: 'flipOutX' }, toast, 'buttonName');
                        iziToast.show({ timeout: 2000, message: '导入成功' });
                        setTimeout(function () { window.location.reload(); }, 1000);
                    }, true],
                    ['<button>取消</button>', function (instance, toast) {
                        instance.hide({ transitionOut: 'flipOutX' }, toast, 'buttonName');
                    }]
                ]
            });
        };
    });
});
