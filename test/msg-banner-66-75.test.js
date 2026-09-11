// App 内消息提醒（她 2026-09-11）：
// 「我发了消息然后退出聊天去别的玩法里玩，顶上也会有提醒，一个气泡出一条叠加在上面，
//   然后给这个搞个开关选择开不开。群聊单聊旁观群都要。然后和提醒一样过几秒就上翻消失，
//   点击也可以快速到达聊天界面」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const ap = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const co = fs.readFileSync(path.join(root, "js", "components.js"), "utf8");
const sc = fs.readFileSync(path.join(root, "js", "screens.js"), "utf8");

test("只挂在 bumpUnread 这一处：单聊、群聊、旁观群、线下冒泡全都从这儿过", () => {
  // ⚠️五个来处早就各自算过「来了新消息、而且她没在看这一屏」，在那五处各挂一次
  //   就是同一层规则活在五个地方（施工规则/one-public-mechanism.md）。
  assert.match(ap, /const bumpUnread = \(id, k\) => \{\s*\n\s*pushBanner\(id, k\);/,
    "没挂在 bumpUnread 上");
  const pb = ap.slice(ap.indexOf("const pushBanner = (id, count)"), ap.indexOf("// 未读小红点 +k"));
  assert.ok(pb.length > 400, "找不到 pushBanner");
  // 群和单聊各认各的那份消息；旁观群标出来（她本来就不在场）
  assert.match(pb, /groupChatsRef\.current/);
  assert.match(pb, /chatsRef\.current/);
  assert.match(pb, /spectate.*\?\s*"旁观"\s*:\s*"群"/);
  // 认不出是谁就不弹
  assert.match(pb, /if \(!g && !c\) return;/);
  // 开机补账本那一摞旧消息不许糊在顶上
  assert.match(pb, /Date\.now\(\) - last\.ts > 120000\) return;/);
});

test("开关：默认开着，关了就一条都不弹", () => {
  assert.match(ap, /msgBanner: true\s+\/\/ App 内消息提醒/, "useState 里没有默认值");
  assert.match(ap, /setPrefs\(loadJSON\("x_prefs", \{[\s\S]{0,120}msgBanner: true/, "开机读存档时没给默认值");
  assert.match(ap, /if \(prefsRef\.current && prefsRef\.current\.msgBanner === false\) return;/,
    "关了还照弹");
  assert.match(sc, /"App 内消息提醒"/, "设置里没有这颗开关");
  assert.match(sc, /on: p\.msgBanner !== false,\s*\n\s*onChange: v => save\(\{ \.\.\.p, msgBanner: v \}\)/);
  assert.match(sc, /" · 顶上提醒 " \+ onOff\(p\.msgBanner !== false\)/, "设置首页那行没报它的状态");
});

test("过几秒自己往上翻走，不用她动手", () => {
  assert.match(ap, /const BANNER_MS = 4200;/);
  assert.match(ap, /setBanners\(p => p\.map\(x => x\.key === b\.key \? \{ \.\.\.x, leaving: true \} : x\)\), BANNER_MS\)/,
    "没有【先标上要走了】那一步，出场动画放不出来");
  assert.match(ap, /setBanners\(p => p\.filter\(x => x\.key !== b\.key\)\), BANNER_MS \+ BANNER_OUT_MS\)/);
  assert.match(co, /@keyframes msgb-out\{from\{opacity:1;transform:none\}to\{opacity:0;transform:translateY\(-18px\)\}\}/,
    "翻上去那一下不是往上翻");
  // 组件拆了之后定时器要清，不然它还往没了的 state 里写
  assert.match(ap, /bannerTimers\.current\.forEach\(clearTimeout\)/);
});

test("点一下直接到那条聊天，走的是现成那一处", () => {
  // ⚠️主屏「捎来的字条」本来就有一份一模一样的三行，现在合成 openChatById 一处。
  assert.match(ap, /const openChatById = \(id, type\) => \{/);
  assert.match(ap, /onOpenChat: openChatById,/, "主屏那份没搬过来，就成了两处各改各的");
  assert.ok(ap.indexOf('if (type === "group") { const g = groups.find(x => x.id === id); if (!g) return; setActiveGroup(g); clearUnread(id); setScreen("gthread"); return; }') < 0,
    "主屏那份旧的还留在原地");
  assert.match(ap, /onOpen: b => \{ setBanners\(p => p\.filter\(x => x\.key !== b\.key\)\); openChatById\(b\.id, b\.type\); \}/);
});

test("顶上那张卡跟来电横幅同一个形状，不另发明一种", () => {
  assert.ok(co.indexOf("function MsgBanners(") > 0);
  const mb = co.slice(co.indexOf("function MsgBanners("), co.indexOf("function Toggle("));
  assert.match(mb, /top: safeTop\(8\), left: 10, right: 10/, "安全区没照来电横幅那套");
  assert.match(mb, /ReactDOM\.createPortal/);
  assert.match(mb, /zIndex: APP_OVERLAY_LAYERS\.banner/);
  assert.match(co, /banner: 1220/, "层级没登记在那张表里");
  // 一摞：最多三条，后面的往后缩
  assert.match(mb, /\.slice\(0, 3\)/);
  assert.match(mb, /transform: "scale\(" \+ \(1 - i \* 0\.03\) \+ "\)"/);
  assert.match(mb, /h\(Avatar, \{ character: b\.who/, "没有头像，认不出是谁发的");
});
