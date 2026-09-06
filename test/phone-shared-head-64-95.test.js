// v64.95：把 js/phone.js 里手写的顶栏也换成共用 Head（接着 v64.90 的 screens.js）。
//
// 她 2026-09-06：「宝宝这个共用 head 全部套上去吧，不然以后一堆屎山代码这里改了那里没跟上」。
//
// 查手机比 screens.js 多一层病：它自己有一份 `PhoneSubPage`——**共用顶栏的第二份实现**。
// 那正是「一层写在两处」本身：Head 补了挂点（v64.87）、补了 ink 分档（v64.90），
// 这一份一次都没跟上。现在 PhoneSubPage 内部就是 Head，它下面那几页一起跟上了。
//
// ⚠️判据是【这条顶栏是不是标准紧凑标题栏】，不是「能不能塞进 Head」：
//   仿真那几个 app（微信、相册、B 站、小红书、浏览器）的顶栏长成【它在模仿的那个 app】
//   的样子，那个样子就是内容，归它自己写。下面第二个测试逐条点名。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");

test("查手机里换掉的那些顶栏，逐页点名（少一处才红）", () => {
  const want = [
    ['h(Head, { zh: title || "",', "PhoneSubPage——共用顶栏的第二份实现，换掉它就是换掉它下面那几页"],
    ['zh: isLive ? liveTitle : zh, bg: t.bg, noLine: true, onBack', "非整屏 app 的通用顶栏"],
    ['h(Head, { zh: "查手机",', "查手机首页（通讯录）"],
    ['h(Head, { zh: "手机外观", sub: (char && char.name || "TA") + " 的这一部"', "手机外观"],
    ['h(Head, { zh: "账簿", bg: "transparent", noLine: true, ink: TALLY_BG', "账簿封皮"],
    ['h(Head, { zh: "时间线", bg: "transparent", noLine: true, onBack })', "时间线"],
    ['h(Head, { zh: "邮件" + (unreadN ? " · " + unreadN + " 封未读" : ""), sub: S(me.addr)', "邮件首页"],
    ['h(Head, { zh: open._kind === "drafts" ? "草稿 · 没发出去"', "邮件详情"],
    ['h(Head, { zh: "照片", sub: photo.date || photo.time || "日期未记"', "相册里那张全屏照片"],
    ['h(Head, { zh: tab === "shelf" ? "书架" : "阅读档案"', "阅读"],
    ['h(Head, { zh: page.zh,\n    bg: "transparent",\n    noLine: true,\n    ink: SHOP_INK', "购物"],
    ['h(Head, { zh: "一直没下手的"', "购物 · 一直没下手的"],
    ['h(Head, { zh: page.zh,\n    bg: "transparent",\n    noLine: true,\n    ink: TAKE_INK', "外卖"],
    ['h(Head, { zh: page.zh, bg: "transparent", noLine: true, ink: HEALTH_INK', "健康"],
    ['h(Head, { zh: "深夜台"', "深夜台"],
    ['h(Head, { zh: open._draft ? T("他没发出去的")', "小红书详情"],
    ['h(Head, { zh: (cy === now.getFullYear() ? "" : cy + "年 ") + cm + "月"', "日历"],
    ['h(Head, { zh: "便签"', "便签"],
    ['h(Head, { zh: isHeld ? "没发出去的那张" : "复制过的那张"', "剪贴板详情"],
    ['h(Head, { zh: "剪贴板"', "剪贴板"],
    ['h(Head, { zh: page.zh, bg: "transparent", noLine: true, ink: CALL_INK', "电话"],
    ['h(Head, { zh: "歌单"', "歌单"],
    ['h(Head, { zh: open ? (open.kind === "post" ? "帖子" : "回帖") : "论坛足迹"', "论坛足迹"]
  ];
  const miss = want.filter(([needle]) => !phone.includes(needle)).map(([, why]) => why);
  assert.deepEqual(miss, [], "这几页的顶栏掉队了（改回手写的了？）：\n" + miss.join("\n"));
});

test("剩下的手写顶栏只有这几条，而且每条都是【它在模仿的那个 app 的样子】", () => {
  // 判据：这条顶栏长的是紧凑标题栏，还是它在模仿的那个 app 自己的 chrome？
  // 后者的话，那个样子就是内容——归它自己写，塞进 Head 等于把仿真抹平。
  const OK = [
    "微信 · 会话/公众号：iOS 那根细尖角是画出来的",
    "微信 · 聊天页：搜索条 + 刷新，中间不是标题",
    "微信 · 通讯录：灰底 + 「‹」 + 底下再挂一条搜索",
    "微信 · 朋友圈/我：灰底 + 「‹」",
    "相册：iOS 的「‹」和 #e5e5ea 分割线",
    "视频 · 封面上那颗返回键：压在封面上，没有标题",
    "B 站：中间是搜索框不是标题",
    "小红书首页：中间是一排频道 tab",
    "浏览器 · 文章：标题左对齐、可换行，不是一行截断的居中标题",
    "浏览器 · 地址栏：中间是地址栏不是标题",
    "查手机 · 通讯录条：搜索框 + 切角色的头像"
  ];
  const hand = [];
  phone.split("\n").forEach((ln, i) => {
    if (/h\(IArrow, \{ size: 1[89]|"aria-label": "返回"/.test(ln)) hand.push(i + 1);
  });
  assert.equal(hand.length, OK.length,
    "手写顶栏还剩 " + hand.length + " 条（该是 " + OK.length + " 条）。\n" +
    "多了＝有新写的没走 Head；少了＝上面那几条里有一条被换掉了，把它从名单里删掉。\n" +
    "行号：" + hand.join(", "));
  // 各自的记号，换掉哪一条这里就红
  assert.match(phone, /const innerHead = \(title, sub, back\) =>/, "微信会话页那条");
  assert.match(phone, /const searchHead = h\("div"/, "微信聊天页那条");
  assert.match(phone, /const contactsHead = h\("div"/, "微信通讯录那条");
  assert.match(phone, /const plainHead = h\("div"/, "微信朋友圈/我那条");
  assert.match(phone, /const chrome = \(title, sub, back\) =>[\s\S]{0,400}"‹"/, "相册那条");
  assert.match(phone, /const chans = \["发现"\]\.concat/, "小红书那排频道 tab");
});

test("刘海只让一次：Head 外面那层不许再自己垫 safeTop", () => {
  // ⚠️两层都垫的话顶栏被顶下去一截（账簿封皮 v64.95 第一版就是这样）。
  const lines = phone.split("\n");
  const bad = [];
  lines.forEach((ln, i) => {
    if (ln.includes("h(Head, {") && i > 0 && /safeTop\(/.test(lines[i - 1])) bad.push(i + 1);
  });
  assert.deepEqual(bad, [], "这几处的 Head 外面还垫着一层刘海：" + bad.join(", "));
  const i = phone.indexOf("background: TALLY_INK");
  assert.ok(i > 0, "账簿那块墨色封皮没了");
  assert.doesNotMatch(phone.slice(i, i + 200), /safeTop/, "账簿封皮又自己垫了一份刘海");
});

test("PhoneSubPage 只剩一份，而且就是共用 Head", () => {
  const i = phone.indexOf("function PhoneSubPage({");
  assert.ok(i > 0, "PhoneSubPage 不见了");
  const seg = phone.slice(i, phone.indexOf("\n}\n", i));
  assert.match(seg, /h\(Head, \{ zh: title \|\| "",[\s\S]{0,140}ink: ink,[\s\S]{0,40}onBack: onClose/, "它没走共用 Head");
  assert.doesNotMatch(seg, /IArrow/, "还自己画着返回箭头");
  assert.doesNotMatch(seg, /safeTop/, "还自己吃着刘海");
  assert.ok(phone.split("h(PhoneSubPage").length - 1 >= 5, "用它的地方少了，先弄清为什么");
});
