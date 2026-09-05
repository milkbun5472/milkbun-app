const {
  useState,
  useEffect,
  useRef,
  useCallback,
  useContext,
  createContext,
  Fragment
} = React;
const h = React.createElement; // 简写，供查手机等新模块使用

// ============================================================
// TOKENS — iOS glass home + calm interior. warm neutral base.
// ============================================================
const DEFAULT_THEME = {
  bg: "#ece8e1",
  bg2: "#f6f4ef",
  ink: "#1b1a17",
  sub: "#4b493f",
  fog: "#96938a",
  line: "#ddd8cd",
  accent: "#c25a4a",
  tint: "#3f6d8c"
};
const ThemeContext = createContext(DEFAULT_THEME);
const useTheme = () => useContext(ThemeContext);
const AV_COLORS = ["#c25a4a", "#5a6357", "#4f5a63", "#7a6a5a", "#6d5a78", "#33322e"];
const F_DISPLAY = "'Fraunces',serif";
const F_BODY = "'Archivo','Noto Serif SC',system-ui,sans-serif";
// wk：主题工作室的挂点（不传就没有）。stroke 是【属性】不是行内样式，
// 所以皮肤那边 `stroke: X !important` 盖得住 color 传进来的那个值。
function Svg({
  size = 18,
  color = "currentColor",
  sw = 1.6,
  children,
  style,
  wk
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "data-wk": wk || undefined,
    style: style
  }, children);
}
const IArrow = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M19 12H5M12 19l-7-7 7-7"
}));
const IPlus = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M12 5v14M5 12h14"
}));
const IX = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M18 6L6 18M6 6l12 12"
}));
// 置顶图钉
const IPin = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 15v5"
}));
// 让角色回复：闪光/召唤感的小图标
const ISpark = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M12 4c.4 3.6 1.9 5.1 5.5 5.5C13.9 9.9 12.4 11.4 12 15c-.4-3.6-1.9-5.1-5.5-5.5C10.1 9.1 11.6 7.6 12 4z"
}), /*#__PURE__*/React.createElement("path", {
  d: "M18.5 13.5c.2 1.6.8 2.2 2.4 2.4-1.6.2-2.2.8-2.4 2.4-.2-1.6-.8-2.2-2.4-2.4 1.6-.2 2.2-.8 2.4-2.4z"
}));
const ISend = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M7 11l5-5 5 5M12 6v13"
}));
const ITrash = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
}));
const IPencil = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"
}));
const IChevD = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M6 9l6 6 6-6"
}));
const IChevR = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M9 6l6 6-6 6"
}));
const IDots = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("circle", {
  cx: "5",
  cy: "12",
  r: "1.4",
  fill: p.color || "currentColor"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "1.4",
  fill: p.color || "currentColor"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "19",
  cy: "12",
  r: "1.4",
  fill: p.color || "currentColor"
}));
const IRefresh = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M3 12a9 9 0 019-9 9 9 0 016.7 3H21M21 3v5h-5M21 12a9 9 0 01-9 9 9 9 0 01-6.7-3H3M3 21v-5h5"
}));
const ICamera = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "13",
  r: "4"
}));
const ICheck = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M20 6L9 17l-5-5"
}));
const IHeart = p => /*#__PURE__*/React.createElement(Svg, {
  ...p,
  fill: p.filled ? p.color : "none"
}, /*#__PURE__*/React.createElement("path", {
  d: "M20.8 5.6a5.4 5.4 0 00-7.7 0L12 6.7l-1.1-1.1a5.4 5.4 0 10-7.7 7.7L12 22l8.8-8.7a5.4 5.4 0 000-7.7z"
}));
const IPulse = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M3 12h4l2-6 4 12 2-6h6"
}));
const ISearch = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("circle", {
  cx: "11",
  cy: "11",
  r: "7"
}), /*#__PURE__*/React.createElement("path", {
  d: "M21 21l-4.3-4.3"
}));
// 论坛底栏 / 操作条用（与聊天、查手机同一套线性图标风格）
const IHome = p => h(Svg, p, h("path", { d: "M3 11l9-8 9 8" }), h("path", { d: "M5 10v10h5v-6h4v6h5V10" }));
const IMail = p => h(Svg, p, h("rect", { x: 3, y: 5, width: 18, height: 14, rx: 2 }), h("path", { d: "M3 7l9 6 9-6" }));
const IRepeat = p => h(Svg, p, h("path", { d: "M17 2l4 4-4 4" }), h("path", { d: "M3 11V9a4 4 0 014-4h14" }), h("path", { d: "M7 22l-4-4 4-4" }), h("path", { d: "M21 13v2a4 4 0 01-4 4H3" }));
const IBars = p => h(Svg, p, h("path", { d: "M4 20V10M10 20V4M16 20v-8M22 20H2" }));
// dock/app glyphs
const GMsg = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M21 11.5a8.4 8.4 0 01-12.3 7.5L3 21l1.9-5.7A8.4 8.4 0 1121 11.5z"
}));
const GConfig = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "3.2"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"
}));
const GForum = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M4 5h16v10H9l-4 4V5z"
}), /*#__PURE__*/React.createElement("path", {
  d: "M8 9h8M8 12h5"
}));
const GUs = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M12 21C6 16.5 3 13 3 9.2 3 6.5 5 4.5 7.5 4.5c1.7 0 3.3 1 4.5 2.6C13.2 5.5 14.8 4.5 16.5 4.5 19 4.5 21 6.5 21 9.2 21 13 18 16.5 12 21z"
}));
const GCast = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("circle", {
  cx: "9",
  cy: "8",
  r: "3.2"
}), /*#__PURE__*/React.createElement("path", {
  d: "M3.5 20a5.5 5.5 0 0111 0"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "17",
  cy: "9",
  r: "2.6"
}), /*#__PURE__*/React.createElement("path", {
  d: "M15 20a4.5 4.5 0 016.5-4"
}));
const GTies = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("circle", {
  cx: "6",
  cy: "6",
  r: "2.3"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "18",
  cy: "7",
  r: "2.3"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "18",
  r: "2.3"
}), /*#__PURE__*/React.createElement("path", {
  d: "M7.6 7.5L11 16M16.2 9L13 16M8 6.2h7.7"
}));
const GLife = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "9"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12 7v5l3 2"
}));
const GPhone = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("rect", {
  x: "6",
  y: "2.5",
  width: "12",
  height: "19",
  rx: "2.4"
}), /*#__PURE__*/React.createElement("path", {
  d: "M10 5.5h4"
}));
const GLore = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M4 4.5A1.5 1.5 0 015.5 3H12v16H5.5A1.5 1.5 0 004 20.5zM20 4.5A1.5 1.5 0 0018.5 3H12v16h6.5a1.5 1.5 0 011.5 1.5z"
}));
const GShop = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M4 7h16l-1.2 11.2a2 2 0 01-2 1.8H7.2a2 2 0 01-2-1.8L4 7zM8.5 7l3.5-4 3.5 4"
}));
const GBag = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M6 8h12l-.9 11a2 2 0 01-2 1.8H8.9a2 2 0 01-2-1.8L6 8zM9 8V6.5a3 3 0 016 0V8"
}));
const GUser = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M12 12a4 4 0 100-8 4 4 0 000 8zM5 20c0-3.3 3.1-6 7-6s7 2.7 7 6"
}));
// 地方：一扇门 + 门里透出来的光（不是房子外观——这个 app 讲的是「进去之后什么样」）
const GDwell = p => h(Svg, p, h("path", { d: "M5 21V5.5a1.5 1.5 0 011.5-1.5h11A1.5 1.5 0 0119 5.5V21" }), h("path", { d: "M3 21h18" }), h("path", { d: "M12 11.5v1.2" }), h("path", { d: "M9 8.2h6M9 16.4h6" }));
const GCarry = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M7 8V6.5A2.5 2.5 0 019.5 4h5A2.5 2.5 0 0117 6.5V8M5.5 8h13a1.5 1.5 0 011.5 1.6l-.7 9A2 2 0 0117.3 20.4H6.7a2 2 0 01-2-1.8l-.7-9A1.5 1.5 0 015.5 8zM12 12v3"
}));
// 钱包：钱夹 + 卡扣
const GWallet = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M4 7.5A2.5 2.5 0 016.5 5h11A1.5 1.5 0 0119 6.5V8M4 7.5v9A2.5 2.5 0 006.5 19h12a1.5 1.5 0 001.5-1.5V10a1.5 1.5 0 00-1.5-1.5H6.5A2.5 2.5 0 014 6.5M16 13.5a1 1 0 100 .01"
}));
// —— 行程活动图标 ——
const GCoffee = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M4 8h13v5a5 5 0 01-5 5H9a5 5 0 01-5-5V8zM17 9h2.5a2.5 2.5 0 010 5H17M7 3.5c0 1-.8 1.3-.8 2.3M11 3.5c0 1-.8 1.3-.8 2.3"
}));
const GBrief = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M4 8.5A1.5 1.5 0 015.5 7h13A1.5 1.5 0 0120 8.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5zM9 7V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V7M4 12.5h16"
}));
const GPen = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M15.5 5.5l3 3M4 20l1-4L16.5 4.5a1.5 1.5 0 012 0l1 1a1.5 1.5 0 010 2L8 19l-4 1z"
}));
const GMeal = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M6 3v7a2 2 0 004 0V3M8 10v11M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4M17 12v9"
}));
const GMoon = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"
}));
const GWalk = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M12 21s-6-4.5-6-9.5a6 6 0 0112 0c0 5-6 9.5-6 9.5zM12 9.5a2 2 0 100 .01"
}));
const GChat = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M4 6.5A1.5 1.5 0 015.5 5h13A1.5 1.5 0 0120 6.5v8a1.5 1.5 0 01-1.5 1.5H9l-4 3v-3H5.5A1.5 1.5 0 014 14.5z"
}));
const GMem = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M12 3a5 5 0 00-5 5c0 1 .3 1.7.8 2.5M12 3a5 5 0 015 5c0 1-.3 1.7-.8 2.5M12 3v18M7.8 10.5A4 4 0 006 14a4 4 0 004 4h0M16.2 10.5A4 4 0 0118 14a4 4 0 01-4 4h0M8 8H5.5M16 8H18.5M8.5 13.5H6M15.5 13.5H18"
}));
// 日记：合起来的手账本，书脊 + 书签
const GDiary = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M6.5 3.5h11a1.5 1.5 0 011.5 1.5v14a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 18.5V5a1.5 1.5 0 011.5-1.5z"
}), /*#__PURE__*/React.createElement("path", {
  d: "M9 3.5v6l2-1.4 2 1.4v-6"
}), /*#__PURE__*/React.createElement("path", {
  d: "M8.5 20.5V22"
}));
const GStudy = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M3.5 6.5l8.5-3 8.5 3-8.5 3-8.5-3z"
}), /*#__PURE__*/React.createElement("path", {
  d: "M7 8v4.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V8"
}), /*#__PURE__*/React.createElement("path", {
  d: "M20.5 6.5v4.5"
}));
// 周刊：对折的报纸（外壳 + 卷起的右页 + 栏目线）
const GWeekly = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M4 6h12a1 1 0 011 1v11a1.5 1.5 0 01-1.5 1.5h-9A2.5 2.5 0 014 18V6z"
}), /*#__PURE__*/React.createElement("path", {
  d: "M17 9h2a1 1 0 011 1v7.5a2 2 0 01-4 0V7"
}), /*#__PURE__*/React.createElement("path", {
  d: "M7 9.5h6M7 12.5h6M7 15.5h4"
}));
// 同人文：翻开的书 + 一支笔尖，寓意「续写」
const GFanfic = p => /*#__PURE__*/React.createElement(Svg, p, /*#__PURE__*/React.createElement("path", {
  d: "M4 5.5c2.5-1 4.5-1 7 0v12c-2.5-1-4.5-1-7 0v-12z"
}), /*#__PURE__*/React.createElement("path", {
  d: "M11 5.5c2.5-1 4.5-1 7 0v8"
}), /*#__PURE__*/React.createElement("path", {
  d: "M15.5 21l4-4 1.5 1.5-4 4-2 .5.5-2z"
}));
// 同人文底 nav 用：书架（三本书）、穿越（拱门/传送门）
const IShelf = p => h(Svg, p, h("path", { d: "M4 4v16M8 6v14M12 5v15" }), h("path", { d: "M15.5 6.2l4.4 1.2-3.8 13.6-4.4-1.2" }), h("path", { d: "M4 20h16" }));
const IPortal = p => h(Svg, p, h("path", { d: "M5 21V8a7 4 0 0114 0v13" }), h("path", { d: "M9 21v-9a3 2.2 0 016 0v9" }));
// 加笔：一支笔尖压在纸上（同人文底栏中间那一枚）
const IQuill = p => h(Svg, p,
  h("path", { d: "M4 20.5c1.2-4.6 3.4-8.2 6.6-11.4" }),
  h("path", { d: "M9.6 10.1l4.3 4.3" }),
  h("path", { d: "M14.2 5.5l4.3 4.3-4.6 4.6-4.3-4.3z" }),
  h("path", { d: "M4 20.5l3.9-1.1" }));
// 作者榜：一叠稿纸，最上面那张有一道签名
const IAuthors = p => h(Svg, p,
  h("path", { d: "M7 3.5h10.5v14H7z" }),
  h("path", { d: "M4.5 6.5v14H15" }),
  h("path", { d: "M9.5 7h5.5M9.5 10h5.5" }),
  h("path", { d: "M9.8 14c1-1.1 1.9-1.1 2.6 0s1.6 1.1 2.6 0" }));
// 擂台：一个搭起来的台子——台面＋台腿＋台上两个人，上方吊着记分牌。
// （原来是天平，那是「辩论」的图；改名之后天平只说得了「判胜负」这一半，说不了「上台吵」那一半。）
const GDebate = p => h(Svg, p, h("path", { d: "M9.5 2.6v1.8M14.5 2.6v1.8" }), h("rect", { x: 8, y: 4.4, width: 8, height: 4.6, rx: 1 }), h("circle", { cx: 9, cy: 13.4, r: 1.7 }), h("circle", { cx: 15, cy: 13.4, r: 1.7 }), h("path", { d: "M3 16.4h18" }), h("path", { d: "M5.5 16.4V21M18.5 16.4V21" }));
// 梦境：弯月 + 星
const GDream = p => h(Svg, p, h("path", { d: "M20 14.5A8 8 0 019.5 4 7 7 0 1020 14.5z" }), h("path", { d: "M16.5 3.6l.5 1.6 1.6.5-1.6.5-.5 1.6-.5-1.6-1.6-.5 1.6-.5z" }));
// 塔罗：两张摊开的牌 + 星
const GTarot = p => h(Svg, p, h("rect", { x: 4, y: 6, width: 9, height: 13, rx: 1.4, transform: "rotate(-11 8.5 12.5)" }), h("rect", { x: 11, y: 5, width: 9, height: 13, rx: 1.4, transform: "rotate(9 15.5 11.5)" }), h("path", { d: "M15.3 8.4l.45 1.35 1.35.45-1.35.45-.45 1.35-.45-1.35-1.35-.45 1.35-.45z" }));
// 番茄钟：计时器（表身 + 顶钮 + 指针）
const GFocus = p => h(Svg, p, h("circle", { cx: 12, cy: 14, r: 7.5 }), h("path", { d: "M12 14V9.5" }), h("path", { d: "M12 3.5v2.4M9.6 4.2h4.8" }), h("path", { d: "M17.8 7.6l1.3-1.3" }));
// 小游戏：游戏手柄（机身 + 十字键 + 两个圆钮）
const GGame = p => h(Svg, p, h("rect", { x: 3, y: 8, width: 18, height: 9, rx: 4.5 }), h("path", { d: "M7.5 10.8v3.4M5.8 12.5h3.4" }), h("circle", { cx: 16, cy: 11.8, r: 1 }), h("circle", { cx: 18, cy: 14, r: 1 }));
// 互救台：带十字的救生圈；值班室：常亮的服务器；会客室：三把座椅围桌。
const GRescue = p => h(Svg, p, h("circle", { cx: 12, cy: 12, r: 8.5 }), h("circle", { cx: 12, cy: 12, r: 3.2 }), h("path", { d: "M12 3.5v5.3M12 15.2v5.3M3.5 12h5.3M15.2 12h5.3" }));
const GDuty = p => h(Svg, p, h("rect", { x: 4, y: 4.5, width: 16, height: 6, rx: 1.6 }), h("rect", { x: 4, y: 13.5, width: 16, height: 6, rx: 1.6 }), h("circle", { cx: 7.2, cy: 7.5, r: .8 }), h("circle", { cx: 7.2, cy: 16.5, r: .8 }), h("path", { d: "M10 7.5h6.5M10 16.5h6.5" }));
const GLounge = p => h(Svg, p, h("circle", { cx: 12, cy: 12, r: 3.2 }), h("circle", { cx: 12, cy: 4.8, r: 2.1 }), h("circle", { cx: 5.7, cy: 15.8, r: 2.1 }), h("circle", { cx: 18.3, cy: 15.8, r: 2.1 }), h("path", { d: "M10.2 7.1l.8 1.9M7.8 14.3l1.9-1M16.2 14.3l-1.9-1" }));
// 备忘录：便签清单（板身 + 顶夹 + 两行勾选）
// 时光胶囊：沙漏
const GCapsule = p => h(Svg, p, h("path", { d: "M7 3.5h10M7 20.5h10" }), h("path", { d: "M8.2 3.5v2.2c0 2.6 2.3 3.9 3.8 5.3 1.5-1.4 3.8-2.7 3.8-5.3V3.5M8.2 20.5v-2.2c0-2.6 2.3-3.9 3.8-5.3 1.5 1.4 3.8 2.7 3.8 5.3v2.2" }), h("path", { d: "M10.4 18.6h3.2" }));

// 天气：一套线条画的天象（她 2026-09-04：「一起换了吧」——主屏上最后几个 emoji）。
// kind 由 wmoKind(code) 给：sun / partly / cloud / fog / storm / snow / rain。
// ⚠️和别的图标同一套画法（24 格、只描边、颜色从外面传），换主题跟着走。
const GWx = p => {
  const k = p && p.kind;
  const cloud = h("path", { d: "M7.6 19h9.1a3.4 3.4 0 000-6.8 4.8 4.8 0 00-9.2 1.1 2.9 2.9 0 00.1 5.7z" });
  const sun = h(React.Fragment, null,
    h("circle", { cx: "12", cy: "9.5", r: "3.6" }),
    h("path", { d: "M12 2.4v1.8M12 14.8v1.8M4.6 9.5h1.8M17.6 9.5h1.8M6.8 4.3l1.3 1.3M15.9 13.4l1.3 1.3M17.2 4.3l-1.3 1.3M8.1 13.4l-1.3 1.3" }));
  if (k === "sun") return h(Svg, p, sun);
  if (k === "cloud") return h(Svg, p, cloud);
  if (k === "fog") return h(Svg, p, cloud, h("path", { d: "M5 21.4h6M13.5 21.4h5.5" }));
  if (k === "storm") return h(Svg, p, cloud, h("path", { d: "M12.6 20.4l-2 2.9h3l-2 3" }));
  if (k === "snow") return h(Svg, p, cloud, h("path", { d: "M8.5 21.4v2.2M7.5 22.5h2M14.5 21.4v2.2M13.5 22.5h2" }));
  if (k === "rain") return h(Svg, p, cloud, h("path", { d: "M9 21v2.4M12.5 21v2.4M16 21v2.4" }));
  // partly：云后面露半个太阳
  return h(Svg, p,
    h("circle", { cx: "9.4", cy: "8.2", r: "3" }),
    h("path", { d: "M9.4 2.6v1.5M4.9 8.2H3.4M5.9 4.7L4.8 3.6M12.9 4.7L14 3.6M14.9 8.2h1" }),
    h("path", { d: "M10.6 19.6h6.6a3.1 3.1 0 000-6.2 4.4 4.4 0 00-8.4 1 2.7 2.7 0 001.8 5.2z" }));
};
// 「来这儿第几天」——名片底下那个数，开屏那行日子也是它。
// ⚠️数的是【日历天】，不是【过了几个 24 小时】。
//   原来写的是 floor((now - first) / 86400000) + 1：起点如果是晚上 9 点，
//   那这个数就在每天晚上 9 点翻，白天一整天都还停在昨天那个数
//   （她 2026-09-05 早上 9:29 报「昨天就是 63 天了，今天还显示 63」）。
//   翻页的时刻必须是【午夜】，所以两边都先落到当地的那一天上再相减。
// ⚠️用 round 不用 floor：夏令时那两天差的是 23 或 25 小时，floor 会少算一天。
// ── 梦里带出来的东西留不住（她 2026-09-05 同意的那一条）──────────────────
// 那几件不是买来的，是她从他梦里拿出来的：所以它们该像梦一样，一段时间没人提起就淡掉。
// 这也顺手治了「只进不出」——名册里唯一自己会走的一类。
// 「提起过」＝这个名字出现在最近的对话里，那时把 keepTs 续上（见 app.js 那个 effect）。
// ⚠️只管 source==="dream" 的那些。买的和他送的都是真东西，不许自己消失。
const DREAM_FADE_DAYS = 14;   // 这么久没被提起：开始变浅
const DREAM_GONE_DAYS = 30;   // 再没被提起：它自己回梦里去了
function dreamStage(item, now) {
  if (!item || item.source !== "dream") return "keep";
  const base = Number(item.keepTs || item.addedTs || 0);
  if (!base) return "keep";                       // 认不出日子的不删（照相册回收站那条）
  const d = ((now || Date.now()) - base) / 86400000;
  if (d >= DREAM_GONE_DAYS) return "gone";
  if (d >= DREAM_FADE_DAYS) return "fading";
  return "keep";
}
function homeDayNo(firstTs, now) {
  const f = Number(firstTs) || 0;
  if (!f) return 1;
  const a = new Date(f), b = now instanceof Date ? now : new Date(now || Date.now());
  const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.max(1, Math.round((B - A) / 86400000) + 1);
}
// wmo 天气码 → 上面那七种画法（和 engine.js 的 wmoEmoji 一一对应）
function wmoKind(c) {
  if (c === 0 || c === 1) return "sun";
  if (c === 2) return "partly";
  if (c === 3) return "cloud";
  if (c === 45 || c === 48) return "fog";
  if (c >= 95) return "storm";
  if (c >= 71 && c <= 86 && c !== 80 && c !== 81 && c !== 82) return "snow";
  if (c >= 51) return "rain";
  return "partly";
}

// ============================================================
// 页面皮肤 pageSkin —— 让每一页长成一件东西，不是一块米白
// ============================================================
// 她 2026-08-30：「不要初始的米白或者单纯换色，要有设计感」。
// 平涂是换色，加个渐变还是换色。真正把一页撑起来的是几层叠在一起：
//   ① 底色    —— 主题给的 t.bg，不动
//   ② 一束光  —— 大 radial，页面有了光源，米白才不是一张死平面
//   ③ 一层纹理—— 按这一页【是什么】选：纸／信纸／方格／织物／木／夜／柔光
//   ④ 一笔几何—— 角上一道极淡的大弧，编辑设计里让人觉得「这页是设计过的」那一笔
//
// ⚠️铁律：纹理和光的颜色必须【从主题算出来】，不许写死 rgba(0,0,0,…)。
// 主题工作台允许她把 bg 调成任何颜色（包括深底），写死的黑纹在深底上就是一层脏。
//
// 用法（摊在页面最外层那个容器上，不是滚动容器——
// 标题栏在滚动容器外面，只给滚动容器上色的话顶上会留一条没上色的白带）：
//   h("div", { className: "h-full flex flex-col", style: pageSkin("paper", t) }, ...)
function skinRGB(hex) {
  const s = String(hex || "").replace("#", "").trim();
  const f = s.length === 3 ? s.split("").map(c => c + c).join("") : s.slice(0, 6);
  const n = parseInt(f, 16);
  if (f.length !== 6 || isNaN(n)) return [236, 232, 225];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// 299/587/114：和衣柜那边判「这件衣服算不算深色」用的是同一支公式
function skinIsDark(hex) {
  const [r, g, b] = skinRGB(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

// 往黑里压 / 往白里提一档（k<0 变暗，k>0 变亮）。
// ⚠️它本来只长在 fanfic.js 的闭包里，components.js v62.06 那一版直接喊了它的名字
//   → ReferenceError，整个 App 开不了机（救援页）。所以搬到 skinIsDark 边上，
//   跟它同一个家：谁都看得见，也只有这一份。
// 两个色按比例掺一掺（k=0 全是 a，k=1 全是 b）。
// 分页底色要「这一页是那一格自己的颜色」时用：拿 t.bg 掺一点那一格的 tint 进去，
// 比调 strength 靠谱——strength 会把纹理和光一起加重，页面会脏。
function skinMix(a, b, k) {
  const x = skinRGB(a), y = skinRGB(b), m = Math.max(0, Math.min(1, Number(k) || 0));
  const v = x.map(function (n, i) { return Math.round(n + (y[i] - n) * m); });
  return "#" + v.map(function (n) { return n.toString(16).padStart(2, "0"); }).join("");
}
function skinShade(hex, k) {
  const c = skinRGB(hex).map(function (v) { return Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); });
  return "rgb(" + c.join(",") + ")";
}

// 纹理表：kind → 生成 [backgroundImage, backgroundSize] 的函数。
// ink 是「压下去的那一笔」，lit 是「提上来的那一笔」——深底浅底自动对调，
// 所以同一份纹理在米白和在墨黑上都成立。
// 主屏那 24 个图标以前是一模一样的白玻璃片，摆满一屏就是一片白
//（她 2026-08-30：「没有壁纸是米白加白色图标，有点单调」）。
// 给每个 app 一个自己的色相：底下透一层很淡的光，线条也往那个色偏一点——
// 还是同一家人（都是玻璃），但认得出谁是谁。
// ⚠️只挑【暖而闷】的十二个色相，避开荧光色：这一屏的底子是米白，跳色会很脏。
// 主屏图标的颜色：一个 app 一个固定色相（她 2026-08-30 说没壁纸时「米白加白色图标有点单调」）
// ⚠️不许用哈希算色相：12 个 key 撞成 8 个色，同一行里挨着的两个图标常常一个色。
// 这里按 key 逐个点名，摆的时候就照默认布局的行序错开——相邻两个的色相至少差 40。
const APP_TONE_HUE = {
  cast: 210, ties: 340, phone: 168, shop: 16, carry: 88, cwallet: 152, dwell: 108,
  lore: 250, memlib: 292, anon: 200, study: 328,
  fanfic: 316, theater: 186, impression: 20, weekly: 206,
  read: 158, debate: 8, dream: 248, tarot: 296,
  pomodoro: 4, games: 190, trpg: 134, dreamjournal: 224,
  yanqiu: 262, loungeapp: 106, rescue: 352, vpscodex: 130,
  assistant: 174, stylelab: 316,
  diary: 226, memo: 52, ledger: 136,
  // 底部 dock 那四个也点名（它每一页都在，不能交给哈希）
  messages: 196, forum: 112, config: 352
};
// 没点名的（文件夹、以后新加的 app）才走哈希，落进上面这张表已有的色相里
const APP_HUE_POOL = Object.keys(APP_TONE_HUE).map(function (k) { return APP_TONE_HUE[k]; })
  .filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
function appTone(key) {
  const s = String(key || "?");
  let hue = APP_TONE_HUE[s];
  if (typeof hue !== "number") {
    let x = 0;
    for (let i = 0; i < s.length; i++) x = (x * 33 + s.charCodeAt(i)) >>> 0;
    hue = APP_HUE_POOL[x % APP_HUE_POOL.length];
  }
  return {
    hue: hue,
    // 图标底下那层光：从左下角透上来，不铺满，免得变成一块色卡
    wash: "radial-gradient(125% 118% at 18% 104%, hsla(" + hue + ",56%,58%,.30), hsla(" + hue + ",50%,62%,.10) 52%, transparent 74%)",
    // 线条只往那个色偏一点点，仍然要压得住、看得清
    glyph: "hsl(" + hue + ",26%,32%)"
  };
}
// 没铺壁纸时主屏那块底。**必须由 App 根节点来画**，不是 Home 自己画——
// 根节点上面还垫着一条 env(safe-area-inset-top) 的空带（home-screen-layout.md：不许动），
// 谁画谁负责那条带子：Home 自己画就只从带子下面开始，刘海那一条留着根节点的纯色，
// 顶上就多一条颜色接不上的横杠（她 2026-08-30：「主界面的顶部又是坏的」）。
// 壁纸那一支早就是这么走的（根节点铺满、Home 透明），这一支现在跟它一模一样。
const HOME_PAPER_BG = [
  // 两道细纸纹，给玻璃一点可折的东西
  "repeating-linear-gradient(58deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 7px)",
  "repeating-linear-gradient(-32deg, rgba(27,26,23,0.022) 0px, rgba(27,26,23,0.022) 1px, transparent 1px, transparent 10px)",
  // 四团光：暖的在上、冷的在右和下
  "radial-gradient(74% 48% at 0% -2%, rgba(200,94,78,0.30), transparent 68%)",
  "radial-gradient(70% 46% at 104% 16%, rgba(52,108,150,0.30), transparent 70%)",
  "radial-gradient(80% 52% at 80% 104%, rgba(88,122,100,0.26), transparent 72%)",
  "radial-gradient(56% 38% at 28% 58%, rgba(148,114,176,0.18), transparent 74%)",
  // ⚠️打底这一层必须【接近中性】。玻璃的 saturate(1.9) 会把它背后的颜色乘上去：
  //   底色本身偏黄（色度 12）时，压在上面的组件就会被放大成色度 22 的米黄一片
  //   （她 2026-08-30：「app文件夹和组件背景都还是太米黄了，我想要透一点的高级感」）。
  //   所以颜色全交给上面那四团光——玻璃放大的是那几团光，平的地方保持干净。
  "linear-gradient(163deg, #f1efec 0%, #e8e5e1 46%, #dbd8d4 100%)"
].join(", ");
if (typeof window !== "undefined") { window.appTone = appTone; window.HOME_PAPER_BG = HOME_PAPER_BG; }
const SKIN_PATS = {
  // 纸：两道极细的斜纹交叉，看不出线，只觉得这页不是塑料
  paper: (ink, lit) => [
    ["repeating-linear-gradient(58deg," + lit(.05) + " 0px," + lit(.05) + " 1px,transparent 1px,transparent 6px)", "auto"],
    ["repeating-linear-gradient(-32deg," + ink(.022) + " 0px," + ink(.022) + " 1px,transparent 1px,transparent 9px)", "auto"]
  ],
  // 信纸：横线，行距照正文走
  lined: (ink, lit) => [
    ["repeating-linear-gradient(180deg,transparent 0px,transparent 27px," + ink(.05) + " 27px," + ink(.05) + " 28px)", "auto"],
    ["linear-gradient(90deg,transparent 0 33px," + ink(.05) + " 33px 34px,transparent 34px)", "auto"]
  ],
  // 方格：账本、日历、行程——有格子才像「记录」
  grid: (ink, lit) => [
    ["repeating-linear-gradient(90deg," + ink(.035) + " 0px," + ink(.035) + " 1px,transparent 1px,transparent 23px)", "auto"],
    ["repeating-linear-gradient(180deg," + ink(.035) + " 0px," + ink(.035) + " 1px,transparent 1px,transparent 23px)", "auto"]
  ],
  // 织物：经纬交叉，衣柜和随身物那一路
  cloth: (ink, lit) => [
    ["repeating-linear-gradient(90deg," + ink(.03) + " 0px," + ink(.03) + " 1px," + lit(.045) + " 1px," + lit(.045) + " 3px)", "auto"],
    ["repeating-linear-gradient(180deg," + ink(.028) + " 0px," + ink(.028) + " 1px,transparent 1px,transparent 3px)", "auto"]
  ],
  // 木：竖纹，宽窄不齐才像木头——等宽的是条形码
  wood: (ink, lit) => [
    ["repeating-linear-gradient(90deg," + ink(.032) + " 0px," + ink(.032) + " 1px,transparent 1px,transparent 5px," + lit(.04) + " 5px," + lit(.04) + " 6px,transparent 6px,transparent 13px)", "auto"],
    ["repeating-linear-gradient(90deg,transparent 0px,transparent 46px," + ink(.03) + " 46px," + ink(.03) + " 47px)", "auto"]
  ],
  // 夜：星点。梦、悄悄话、睡着的时候
  night: (ink, lit) => [
    ["radial-gradient(" + lit(.16) + " 1px,transparent 1.3px)", "17px 17px"],
    ["radial-gradient(" + lit(.09) + " 1px,transparent 1.2px)", "29px 23px"]
  ],
  // 柔光：一点线都没有，只有光斑。主屏、设置这种本来就该退到后面的页
  glass: (ink, lit) => [
    ["radial-gradient(46% 30% at 84% 14%," + lit(.5) + " 0%,transparent 64%)", "auto"],
    ["radial-gradient(58% 40% at 10% 74%," + ink(.045) + " 0%,transparent 68%)", "auto"],
    ["radial-gradient(34% 22% at 24% 22%," + lit(.34) + " 0%,transparent 70%)", "auto"]
  ]
};

// tint：这一页的色相（"r,g,b"）。不给就用主题的 accent —— 于是默认皮肤
// 也跟着她换的主题走，不会一换主题就有一页还挂着上一套颜色。
// ── 这个 App 有哪些页 · 全库唯一那一份（v63.44）──────────────────────────
// 谁在用它：① 主题工作台的「页面 CSS」下拉（哪几页能单独写样式）
//           ② 秋秋报「她此刻在哪一页」
// ⚠️原来这两处各存了一份名单：工作台那份只有十页（而作用域机制
//   html[data-lisa-screen="<screen>"] 是【每一页都自带】的，十页是手写的限制，
//   不是能力的限制），秋秋那份有五十页——于是「秋秋知道你在查手机，
//   却没法给查手机写样式」。而且工作台把 messages 标成了「朋友圈」，
//   实际上那一页是整个消息 app（聊天/通讯录/朋友圈/我 四栏）。
//   两份名单必然对不上，所以收成这一份。
// 加一页的规矩：这里加一行，两处自动都有；名字写【她在界面上看到的那个名字】。
// ⚠️名字要短、要能直接说出口——秋秋会拿它组一句「你正开着『XX』」。
//   有几页的【范围】跟名字对不上（写 thread 的样式，线下浮层也跟着变），
//   那种提示放 SCREEN_NOTE，只给主题工作台那个下拉用；名字这一份不背这个包袱。
const SCREEN_NOTE = {
  thread: "线下浮层也算这一页", gthread: "群线下浮层也算这一页",
  messages: "聊天 / 通讯录 / 朋友圈 / 我 四栏都算"
};
const SCREEN_ZH = {
  home: "主屏", messages: "消息",
  thread: "单聊", gthread: "群聊",
  contact: "资料卡", cast: "人格档案馆", castForm: "编角色卡", ties: "关系",
  phone: "查手机", shop: "购物", carry: "随身物", mycloset: "我的衣柜", dwell: "去处",
  cwallet: "钱包", wallet: "我的钱包", kincard: "亲属卡账单", ledger: "记账",
  calendar: "日历", memo: "备忘录", map: "好友地图",
  listen: "一起听", musiccard: "一起听那张卡的背面",
  diary: "日记", lore: "世界书", memlib: "记忆库", anon: "匿名问答",
  study: "一起学", fanfic: "同人文", read: "一起读", weekly: "周刊", debate: "擂台",
  dream: "梦境", dreamjournal: "解梦馆", tarot: "塔罗", pomodoro: "番茄钟",
  games: "小游戏", trpg: "跑团", theater: "小剧场", impression: "月度印象",
  yanqiu: "秋声", loungeapp: "三席会客", rescue: "互救台", vpscodex: "值班室",
  forum: "论坛", momprofile: "朋友圈个人页", us: "情侣空间",
  favorites: "收藏", emotes: "表情包", stylelab: "文风台",
  config: "设置", assistant: "秋秋", codex: "攻略"
};
function pageSkin(kind, t, opts) {
  const o = opts || {};
  const th = t || DEFAULT_THEME;
  // base：默认铺页面的 t.bg；传 t.bg2 就是给卡片/抽屉上同一套皮。
  // 卡片一般要 corner:false、word 留空、strength 压到 .4 上下——
  // 一页十几张卡，每张都带角上的弧和大字就成花布了。
  const bg = o.base || th.bg || DEFAULT_THEME.bg;
  const dark = skinIsDark(bg);
  // 深底上「压下去」要用白、「提上来」要用更白；浅底反过来。
  const inkRGB = dark ? "255,255,255" : skinRGB(th.ink || "#000").join(",");
  const litRGB = dark ? "255,255,255" : "255,255,255";
  const k = o.strength == null ? 1 : Number(o.strength) || 0;
  const ink = a => "rgba(" + inkRGB + "," + (a * k * (dark ? .55 : 1)).toFixed(4) + ")";
  const lit = a => "rgba(" + litRGB + "," + (a * k * (dark ? .5 : 1)).toFixed(4) + ")";
  const tint = o.tint || skinRGB(th.accent || DEFAULT_THEME.accent).join(",");
  const tinted = a => "rgba(" + tint + "," + (a * k).toFixed(4) + ")";

  // 每层 [图, size, position, repeat]，后两格不写就是默认
  const layers = [];
  // ⑤ 页脚那个特大字：拿这一页本来就有的英文眉标（FANFIC / SHELF / WARDROBE），
  // 放到左下角、大到出血、淡到只剩一个影子。这是编辑设计里最省事也最见效的一笔。
  // ⚠️做成 SVG data URI 塞进 background，不做成 DOM 节点——绝对定位的兄弟节点
  // 会盖在正文上面（定位元素永远画在非定位的在流内容之上），做成背景就没这问题，
  // 而且每一页白得这一笔，不用挨个去加 position:relative。
  // wordLift：页底压着 tab bar / 输入栏的页面，把这个词抬到栏上面去，
  // 否则它整个躲在栏后面，等于没画。传 CSS 长度，如 "58px"。
  const wm = skinWordLayer(o.word, dark ? "255,255,255" : skinRGB(th.ink).join(","), dark ? .055 : .045, o.wordLift);
  if (wm) layers.push(wm);
  // 汉字水印走同一条路：一页只印一个字，淡到只剩个影子
  const gm = skinGlyphLayer(o.glyph, dark ? "255,255,255" : skinRGB(th.ink).join(","), dark ? .07 : .055, o.glyphLift);
  if (gm) layers.push(gm);
  // ④ 角上那两笔：右下一道大弧、左上一个配重。构图里一对对角的重量，
  // 是「这页被安排过」和「这页只是铺了个底色」的分界。
  if (o.corner !== false) {
    layers.push(["radial-gradient(circle at 103% 99%," + tinted(.17) + " 0%," + tinted(.085) + " 24%,transparent 45%)", "auto"]);
    layers.push(["radial-gradient(74% 30% at -8% 2%," + tinted(.10) + " 0%,transparent 60%)", "auto"]);
  }
  // ③ 纹理
  (SKIN_PATS[kind] || SKIN_PATS.paper)(ink, lit).forEach(x => layers.push(x));
  // ② 光：顶上一束、底下一沉，页面才有上下
  layers.push(["radial-gradient(128% 62% at 50% -12%," + lit(dark ? .07 : .55) + " 0%,transparent 58%)", "auto"]);
  layers.push(["linear-gradient(180deg," + tinted(.055) + " 0%,transparent 22%,transparent 70%," + tinted(.075) + " 100%)", "auto"]);
  layers.push(["linear-gradient(180deg,transparent 0%,transparent 76%," + ink(.045) + " 100%)", "auto"]);

  return {
    backgroundColor: bg,
    backgroundImage: layers.map(x => x[0]).join(","),
    backgroundSize: layers.map(x => x[1] || "auto").join(","),
    backgroundPosition: layers.map(x => x[2] || "0 0").join(","),
    backgroundRepeat: layers.map(x => x[3] || "repeat").join(",")
  };
}

// 特大汉字。跟下面那个英文页脚字是同一招，但这个 app 的规矩是【标题不留英文】
// （.claude/rules/no-english-titles.md），所以要一个能印汉字的。
// ⚠️SVG 背景里能不能画出汉字，是【浏览器里量过】的：竖排那次（v63.66）字形全叠成
//   一坨、量出来的框却完全正常，只有截图看得出来。这次先在浏览器里画了「性」和「A」
//   两张对照，确认汉字正常才写进来。
// 印在【右下角】：英文那个在左下，两个同时出现也不会打架。
function skinGlyphLayer(ch, rgb, a, lift) {
  const c = String(ch || "").trim().slice(0, 1);
  if (!c || /[\x00-\x7F]/.test(c)) return null;   // 只印汉字；拉丁字母走下面那个
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260">'
    + '<text x="130" y="212" text-anchor="middle" font-family="Songti SC,Noto Serif CJK SC,serif"'
    + ' font-size="238" fill="rgba(' + rgb + ',' + Number(a).toFixed(3) + ')">' + c + '</text></svg>';
  // ⚠️只让它从【右边】出血一点；底下要留够，否则上下都被切就不像「有意压在角上」，
  //   像是没画完。默认抬高 76px 让开悬浮球和底部安全区。
  return ["url('data:image/svg+xml;utf8," + encodeURIComponent(svg).replace(/'/g, "%27") + "')",
    "236px 236px", "right -6px bottom " + (lift || "76px"), "no-repeat"];
}
// 特大页脚字。SVG 里加载不了 Archivo（外链字体在 img 语境不生效），
// 就让它退到系统无衬线——5% 的淡影子上没人分得出字体，但少了它页面就空。
function skinWordLayer(word, rgb, a, lift) {
  const w = String(word || "").trim().toUpperCase().replace(/[^A-Z0-9 ·]/g, "").slice(0, 13);
  if (w.length < 2) return null;
  // 字号按【字数】反推，让这个词的天然宽度正好接近 1000（粗体大写约 0.68em 一个字），
  // 再用 textLength 兜住尾差。于是不管是 SHELF 还是 WARDROBE，
  // 出来的图都恰好 1000 宽——换算成 background-size 就是「永远铺满页宽」，
  // 不会在窄屏上只剩半个词。lengthAdjust 只调字距不调字形，字母不会被压扁。
  const fs = Math.round(1000 / (w.length * 0.68));
  const hh = Math.round(fs * 0.78);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="' + hh + '">'
    + '<text x="0" y="' + Math.round(fs * 0.72) + '" textLength="1000" lengthAdjust="spacing"'
    + ' font-family="Helvetica,Arial,sans-serif" font-size="' + fs + '" font-weight="700"'
    + ' fill="rgba(' + rgb + ',' + a.toFixed(3) + ')">' + w + '</text></svg>';
  // 用单引号包 url()：payload 里的单引号已经编成 %27，而双引号包起来的话
  // 一旦这串被塞进 HTML 的 style="" 属性里就会把属性提前闭合。
  return ["url('data:image/svg+xml," + encodeURIComponent(svg).replace(/'/g, "%27") + "')",
    "104% auto", "-2% " + (lift ? "calc(100% - " + lift + ")" : "100%"), "no-repeat"];
}

// ── 纪念日的「下一次」在哪天（v62.08）─────────────────────────────────────
// 纪念日只存 月/日。每年重复的：下一次＝今年这一天，过了就是明年——永远有下一次。
// 【不重复】的：它指的就是立下它之后遇到的第一个这一天——那天过了就是过了，
// 不该再滚到明年去倒数（她 2026-09-04 拍板：过期显示「已过去 N 天」，不再倒数）。
// 四处共用这一个（我们的日子倒数列表 / 情侣空间 TODAY 卡 / 上下文当天一行 / 纪念日主动消息），
// 各写各的判断迟早对不上——「一层写在四处」那个老形状。
// 老数据没有 createdAt 的按每年重复算：宁可多提醒一次，不能让老纪念日凭空消失。
function annivNext(a, nowTs) {
  const now = new Date(nowTs || Date.now()); now.setHours(0, 0, 0, 0);
  const mk = y => { const d = new Date(y, (a.month || 1) - 1, a.day || 1); d.setHours(0, 0, 0, 0); return d; };
  const yearly = a.yearlyRepeat !== false || !a.createdAt;
  // 年份（v62.41，她 2026-09-04：「我们的日子能不能设定年份，不然……明年二月我想填
  // 今年 7 月的事情就填不了了」）。原来【只有月和日】：不重复的那一档只能拿 createdAt
  // 去猜是哪一年——猜的规矩是「从建的那一年往后找第一个」，所以站在明年二月，
  // 「7 月」永远指向明年七月，**今年七月这个日子根本表达不出来**。
  // 存了 year 就照它来，一天不猜；老存档没有 year，照旧走 createdAt 那条。
  const yr = Number(a.year);
  const hasYear = Number.isFinite(yr) && yr > 1900 && yr < 3000;
  let t;
  if (yearly) {
    t = mk(now.getFullYear());
    if (t < now) t = mk(now.getFullYear() + 1);
  } else if (hasYear) {
    t = mk(yr);
  } else {
    const c = new Date(a.createdAt); c.setHours(0, 0, 0, 0);
    t = mk(c.getFullYear());
    if (t < c) t = mk(c.getFullYear() + 1);
  }
  const days = Math.round((t - now) / 86400000);
  return { ts: t.getTime(), days: days, passed: !yearly && days < 0 };
}
