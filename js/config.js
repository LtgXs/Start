/* ============================================
 * Snavigation - Config
 * 全局唯一配置源：存储键、预设数据、壁纸源、时间常量
 * 依赖：无（必须最先加载）
 * ============================================ */
'use strict';

/** localStorage 键名 */
const STORAGE_KEYS = {
    searchList: 'se_list',
    searchDefault: 'se_default',
    quickList: 'quick_list',
    wallpaper: 'bg_img',
    wallpaperApiKey: 'bg_apikey',
    wallpaperCache: 'bg_img_cache',
    wallpaperLastUrl: 'bg_last_url',
    wallpaperLastType: 'bg_last_type',
    wallpaperData: 'bg_img_data',
    theme: 'theme', // 'auto' | 'light' | 'dark'（index.html 首屏脚本以字面量 'theme' 同步读取）
    prefs: 'prefs',                 // 偏好设置（v1.7）
    searchHistory: 'search_history',// 搜索历史（v1.7）
    hitokotoLast: 'hitokoto_last'   // 上次一言（v1.7，秒开占位）
};

/** 偏好设置默认值（v1.7；设置 → 偏好 中开关，即存即生效） */
const PREFS_PRESET = {
    hitokoto: true,       // 一言卡片
    searchHistory: true,  // 记录搜索历史
    clockSeconds: false,  // 时钟显示秒
    parallax: true,       // 背景视差跟随鼠标
    greeting: true,       // 启动问候提示
    countdownTitle: '',   // 倒数日名称（空 = 不显示）
    countdownDate: ''     // 倒数日日期（YYYY-MM-DD）
};

/** 一言卡片：接口（依次尝试）与离线兜底语录 */
const HITOKOTO_API = [
    'https://v1.hitokoto.cn/?c=d&c=i&c=k&encode=json&max_length=30',
    'https://international.v1.hitokoto.cn/?c=d&c=i&c=k&encode=json&max_length=30'
];
const HITOKOTO_FALLBACK = [
    { text: '海内存知己，天涯若比邻。', from: '王勃' },
    { text: '长风破浪会有时，直挂云帆济沧海。', from: '李白' },
    { text: '会当凌绝顶，一览众山小。', from: '杜甫' },
    { text: '山重水复疑无路，柳暗花明又一村。', from: '陆游' },
    { text: '纸上得来终觉浅，绝知此事要躬行。', from: '陆游' },
    { text: '路漫漫其修远兮，吾将上下而求索。', from: '屈原' },
    { text: '不积跬步，无以至千里。', from: '荀子' },
    { text: '宝剑锋从磨砺出，梅花香自苦寒来。', from: '警世贤文' },
    { text: '凡是过往，皆为序章。', from: '莎士比亚' },
    { text: '星光不问赶路人，时光不负有心人。', from: '大冰' }
];

/** 搜索历史条数上限 */
const SEARCH_HISTORY_MAX = 8;

/** 默认搜索引擎 */
const SE_PRESET = {
    '1': { title: '百度', url: 'https://www.baidu.com/s', name: 'wd', icon: 'iconfont icon-baidu' },
    '2': { title: '必应', url: 'https://cn.bing.com/search', name: 'q', icon: 'iconfont icon-bing' },
    '3': { title: '谷歌', url: 'https://www.google.com/search', name: 'q', icon: 'iconfont icon-google' }
};

/** 默认快捷方式（首个 Tab，可编辑） */
const QUICK_PRESET = {
    '1': { title: '哔哩哔哩', url: 'https://www.bilibili.com/' },
    '2': { title: 'Office', url: 'https://www.office.com/' },
    '3': { title: 'Main Page', url: 'https://littlegaofx.github.io/Self/' },
    '4': { title: 'Edge Surf', url: 'https://littlegaofx.github.io/Surf/' },
    '5': { title: 'New Concept Game', url: 'https://littlegaofx.github.io/Game/' }
};

/** 静态书签 Tab（第 2 个起，只读；新增 Tab 只需在此追加） */
const STATIC_TABS = [
    {
        name: '开发',
        items: [
            { title: 'DevDocs', url: 'https://devdocs.io/' },
            { title: 'Can I Use', url: 'https://caniuse.com/' },
            { title: 'CodePen', url: 'https://codepen.io/' },
            { title: '站长之家', url: 'https://tool.chinaz.com/' },
            { title: 'MSDN', url: 'https://next.itellyou.cn/' },
            { title: 'Regex101', url: 'https://regex101.com/' },
            { title: 'JSON 格式化', url: 'https://www.json.cn/' },
            { title: 'NPM 查询', url: 'https://npm.devtool.tech/' },
            { title: '表格生成', url: 'https://www.tablesgenerator.com/' },
            { title: 'Squoosh 压图', url: 'https://squoosh.app/' },
            { title: 'TinyPNG', url: 'https://tinypng.com/' },
            { title: 'Excalidraw', url: 'https://excalidraw.com/' }
        ]
    },
    {
        name: '学习',
        items: [
            { title: 'GitHub', url: 'https://github.com/' },
            { title: 'MDN 文档', url: 'https://developer.mozilla.org/zh-CN/' },
            { title: '菜鸟教程', url: 'https://www.runoob.com/' },
            { title: '力扣 LeetCode', url: 'https://leetcode.cn/' },
            { title: 'Coursera', url: 'https://www.coursera.org/' },
            { title: 'Stack Overflow', url: 'https://stackoverflow.com/' },
            { title: 'B站学习', url: 'https://www.bilibili.com/' },
            { title: '稀土掘金', url: 'https://juejin.cn/' },
            { title: '知乎', url: 'https://www.zhihu.com/' },
            { title: '思否', url: 'https://segmentfault.com/' }
        ]
    }
];

/** 壁纸默认配置 */
const BG_PRESET = {
    type: '1',           // 见 WALLPAPER_SOURCES
    path: '',            // 自定义 URL 模板（可含 {key} 占位符）
    cache: true,         // 缓存壁纸（强制开启）
    cacheDuration: 24,   // 缓存时长（小时）
    bg_fit: false,       // 比例自适应：完整显示 + 模糊填充
    refreshOnLoad: false // 每次刷新更换背景
};

/**
 * 壁纸源定义（唯一出处；此前 baseUrl 与描述在两个文件中各重复一份）
 * url 为空 = 本地默认列表 / 自定义
 */
const WALLPAPER_SOURCES = {
    '1': { url: '', desc: '显示内置本地壁纸，切换后立即生效' },
    '2': { url: 'https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN', desc: '显示必应每日一图，每天自动更新，切换后立即生效 | API @ Bing' },
    '3': { url: 'https://picsum.photos/1920/1080', desc: '显示随机风景照片，切换后立即生效 | API @ Lorem Picsum' },
    '4': { url: 'https://t.mwm.moe/fj', desc: '显示随机二次元图片，切换后立即生效 | API @ 樱花' },
    '5': { url: 'https://t.mwm.moe/mp', desc: '显示随机猫咪照片，治愈系壁纸，切换后立即生效 | API @ 樱花' },
    '6': { url: '', desc: '使用自定义图片 URL，填入地址保存后立即生效' }
};

/** 本地内置壁纸（type = 1） */
const DEFAULT_BG_LIST = Array.from({ length: 10 }, (_, i) => `./img/background${i + 1}.webp`);
const FALLBACK_BG_URL = './img/background1.webp';

/** 壁纸缓存 / 动画常量 */
const BG_CONST = {
    DATA_MAX: 60000000,        // base64 缓存上限（约 60MB）
    CACHE_HOURS_DEFAULT: 24,   // 默认缓存时长（小时）
    FADE_MS: 1500,             // 背景交叉渐变时长
    COMPRESS_MAX_W: 1920,      // 缓存压缩最大宽度
    COMPRESS_QUALITY: 0.8      // JPEG 压缩质量
};

/** 天气刷新节奏（毫秒） */
const WEATHER_CONST = {
    REFRESH_MS: 30 * 60 * 1000, // 正常轮询：30 分钟
    RETRY_MS: 5 * 60 * 1000     // 失败重试：5 分钟
};
