/* ============================================
 * Snavigation - Storage Module
 * 底层工具：LocalStorage 管理、HTML 转义、URL 校验、
 *           默认预设数据、文件下载
 * 依赖：js.cookie.js（需先加载）
 * ============================================ */

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

// 存储层：localStorage 优先，自动迁移旧 Cookie 数据
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

// 默认搜索引擎列表
var se_list_preinstall = {
    '1': { id: 1, title: "百度", url: "https://www.baidu.com/s", name: "wd", icon: "iconfont icon-baidu" },
    '2': { id: 2, title: "必应", url: "https://cn.bing.com/search", name: "q", icon: "iconfont icon-bing" },
    '3': { id: 3, title: "谷歌", url: "https://www.google.com/search", name: "q", icon: "iconfont icon-google" }
};

// 默认快捷方式
var quick_list_preinstall = {
    '1': { title: "哔哩哔哩", url: "https://www.bilibili.com/" },
    '2': { title: "Office", url: "https://www.office.com/" },
    '3': { title: "Main Page", url: "https://littlegaofx.github.io/Self/" },
    '4': { title: "Edge Surf", url: "https://littlegaofx.github.io/Surf/" },
    '5': { title: "New Concept Game", url: "https://littlegaofx.github.io/Game/" }
};

/**
 * 下载文本为文件
 * @param {string} filename 文件名
 * @param {string} text     文件内容
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
