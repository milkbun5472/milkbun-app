// v62.57 审美审计还债⑩：聊天门面五页。
// 这几页是整个聊天的门面，病都是同一类：外壳从来没写过 background（父层给什么是什么）、
// 顶上一块自写的大标题不走公共 Head（mobile-ui-layout §1）、
// 底纹铺了顶栏却压回一条平色带（§3.5）。修法先问「这一页现实里是什么东西」：
// 消息列表是手机上的聊天 app（灰地白格），朋友圈是一张白纸的信息流，
// 线下是那间已经铺好氛围底的屋子——顶栏该让它透上来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "锚没了：" + a.slice(0, 40)); return s.slice(i, s.indexOf(b, i + a.length)); };

test("消息列表：灰地白格，顶栏走公共 Head，24px 自写大标题退场", () => {
  const seg = cut(comp, "function Messages({", "function MomentCompose({");
  // 外壳是地（t.bg），聊天格子是白的（t.bg2）——手机聊天 app 的层次
  // ⚠️口径改了（v64.15）：那块地起了名字（msgAppBg），因为**朋友圈个人页也要铺同一块**。
  //   起名字还有第二个作用：`style: { background: t.bg }` 那种裸写法跟「忘了装修」
  //   长得一模一样，而 last-flat-shells 那道闸拦的正是后者——有名字，闸才分得清。
  assert.match(seg, /className: "h-full flex flex-col",\s*style: msgAppBg\(t\)/, "外壳不是灰地了");
  assert.match(comp, /function msgAppBg\(t\) \{ return \{ background: t\.bg \}; \}/, "那块地的定义没了");
  assert.match(seg, /pinnedSet\.has\(id\) \? "linear-gradient\(rgba\(0,0,0,0\.035\),rgba\(0,0,0,0\.035\)\) " \+ t\.bg2 : t\.bg2/,
    "聊天格子不再是白格，或者置顶那层淡灰丢了");
  // 顶栏是公共 Head（透明让地透上来），不再自己写一条
  assert.match(seg, /h\(Head, \{\s*zh: TITLES\[tab\],\s*onBack: onBack,\s*bg: "transparent"/, "顶栏没走公共 Head");
  assert.ok(!/fontSize: 24/.test(seg), "24px 的自写大标题还在");
  // 建群的 ＋ 还在（挪进了 Head 右槽），可点区不缩水
  assert.match(seg, /tab === "chats" \? h\("button", \{\s*onClick: onNewGroup/, "聊天 tab 右上的 ＋ 丢了");
  assert.match(cut(seg, "onClick: onNewGroup", "IPlus"), /height: 34/, "＋ 的可点高度没了");
  // 「我」那页的卡片跟着翻过来：白卡压灰地（原来是 t.bg 卡压 t.bg2 壳，翻壳必须翻卡）
  const me = cut(seg, 'tab === "me"', 'tab === "contacts"');
  assert.ok(!/background: t\.bg,/.test(me), "「我」那页还有随旧壳配色的灰卡");
  assert.equal((me.match(/background: t\.bg2,?\s/g) || []).length >= 5 ? 5 : 0, 5, "「我」那页的白卡不足五张");
});

test("朋友圈信息流：自己铺白纸，英文眉标退场", () => {
  const seg = cut(comp, "function MomentsFeed({", "function MomentsProfile({");
  assert.match(seg, /className: "pb-8 min-h-full",\s*style: \{ background: t\.bg2 \}/, "信息流没有自己的白底");
  // ⚠️函数自己就叫这个名，只匹配【带引号的字符串】那种出现——那才是渲染出来的字
  assert.ok(!/"Moments/.test(seg) && seg.indexOf("Eyebrow, null") < 0, "「Moments」那行英文眉标还在（no-english-titles）");
  // 两个动作键还在
  assert.match(seg, /发朋友圈/);
  assert.match(seg, /角色发/);
});

test("个人朋友圈主页：封面以下自己铺底", () => {
  const seg = cut(comp, "function MomentsProfile({", "function VoiceEarComposer");
  // ⚠️口径改了（v64.15，她 2026-09-05：「对齐吧」）：这一条钉的【意图】是
  //   「封面底下自己铺底，别靠父层给什么是什么」——意图没变，只是那块底不再是
  //   自成一格的 t.bg2，而是跟它所属的【消息】那个 app 共用同一份（msgAppBg）。
  //   原来个人页 t.bg2、列表 t.bg，同一个 app 里两种底，点进点出颜色会跳一下。
  assert.match(seg, /className: "h-full flex flex-col", style: msgAppBg\(t\)/, "封面底下还是父层给什么是什么");
});

test("日历：外壳自己铺底，月名收成 20px", () => {
  const seg = cut(comp, "function Calendar({", "\n}\n");
  // ⚠️口径改了（v64.00，她 2026-09-05：「特别是那些比较深的子页面」）：
  //   这一条原来钉的是「外壳自己铺底、别靠父层透过来」，写法是平色 t.bg2。
  //   那个【意图】没变，只是底从平色换成了真的纸——所以钉的东西跟着往前挪一格：
  //   还是要求外壳自己带底，只是现在要求它带的是 pageSkin 那一份。
  assert.match(seg, /className: "h-full flex flex-col", style: Object\.assign\(\{ position: "relative" \}/, "日历外壳没铺底");
  assert.match(seg, /pageSkin\("paper", t, \{ base: t\.bg2/, "外壳铺的不是纸");
  assert.ok(!/style: \{ position: "relative", background: t\.bg2 \}/.test(seg), "又退回平色了");
  assert.match(seg, /fontSize: 20, color: t\.ink, letterSpacing: "0\.02em"/, "月名不是 20px 了");
  assert.ok(!/fontSize: 34/.test(seg), "34px 的月名还在");
});

test("线下两间屋：没图时顶栏透明，别再压一条平色带", () => {
  // 外壳铺的是那层氛围底（没图时），顶栏原来写死一块米白——底纹从它底下才开始，
  // 顶上横着一条没盖住的带子（mobile-ui-layout §3.5 同一条病）
  const hits = (comp.match(/background: os\.bg \? "rgba\(255,255,255,0\.5\)" : "transparent", backdropFilter/g) || []).length;
  assert.equal(hits, 2, "单人 + 多人两条顶栏都要透，现在只有 " + hits + " 条");
  assert.ok(!/os\.bg \? "rgba\(255,255,255,0\.5\)" : t\.bg2/.test(comp), "还有顶栏没图时压米白");
  // 顶栏底下那条「此刻行程」同一个病
  assert.match(comp, /schedNow\.dev \? "rgba\(194,90,74,0\.08\)" : \(os\.bg \? "rgba\(255,255,255,0\.45\)" : "transparent"\)/,
    "行程那条没图时还压着米白");
  // 顺手清掉的英文（no-english-titles）：小字副题只留中文
  assert.ok(comp.indexOf("OFFLINE · ") < 0, "线下顶栏那行英文还在");
  assert.match(comp, /"线下 · 轻触切换"/);
  assert.match(comp, /"多人线下 · 轻触切换"/);
});
