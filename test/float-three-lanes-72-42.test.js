// 她 2026-09-22：「api 悬浮球能不能把后台选择也加进去。然后点开悬浮球是三项收着的
//   线上线下后台，需要改哪个再打开做选择」。
//
// 原来只有线上/线下两档，而且两档【全摊开】：线路一多面板就长——v69 那次
// 「点开会跳到屏幕下面然后关不掉」正是面板长出屏幕闹的。三档收着之后，
// 无论多少条线路，默认高度就是三行。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

const comp = (() => {
  const i = app.indexOf("function ModelQuickSwitch({");
  assert.ok(i > 0, "抠不出 ModelQuickSwitch");
  return app.slice(i, app.indexOf("\n// 一起听·本地音频存 IndexedDB", i));
})();

test("三档都在，各走各的落盘口", () => {
  assert.match(comp, /profiles, activeId, offlineApiId, bgApiId, onSetOnline, onSetOffline, onSetBg/, "后台那一档没接进来");
  const i = comp.indexOf("  const LANES = [");
  assert.ok(i > 0, "三档不是同一张表——各写一份迟早只改一处");
  // 照真正在跑的那张表取，占位喂进去（不另抄一份）
  const src = comp.slice(i + "  const LANES = ".length, comp.indexOf("\n  ];", i) + 4);
  const lanes = new Function("online", "offline", "bg", "activeId", "offlineApiId", "bgApiId",
    "onSetOnline", "onSetOffline", "onSetBg", "return " + src)(
    null, null, null, null, null, null, () => {}, () => {}, () => {});
  assert.deepEqual(lanes.map(x => x.key), ["online", "offline", "bg"], "三档的顺序/名字变了");
  assert.deepEqual(lanes.map(x => x.zh), ["线上", "线下", "后台"]);
  assert.deepEqual(lanes.map(x => x.follow), [false, true, true], "线上没有「跟随主模型」那一档，线下和后台有");
  // app 那头真的传下去了，而且后台走的是设置页用的同一个 setBgApi
  assert.match(app, /bgApiId: bgApiId,\n    \/\/ 后台那一档走 setBgApi/, "渲染处没传 bgApiId");
  assert.match(app, /onSetBg: id => \{ setBgApi\(id\);/, "后台没走 setBgApi（那会跟设置页各存一份）");
});

test("默认三项都收着，点一档摊开一档", () => {
  assert.match(comp, /const \[tab, setTab\] = useState\(""\);/, "默认不是全收着");
  assert.match(comp, /setTab\(v => v === lane\.key \? "" : lane\.key\)/, "点第二下收不回去，或者摊开一档不会把别的收上去");
  assert.match(comp, /tab === lane\.key\n\s*\? h\("div"/, "摊开的那一档才列线路");
  // 收着的那一行要看得见它现在走哪条
  assert.match(comp, /\(lane\.follow && !lane\.picked \? "跟随主模型 · " : ""\) \+ label\(lane\.cur\)/, "收着的行没写当前走哪条线路");
});

// ⚠️线下/后台「跟随线上主模型」那一档的值是 null：选中态必须看【这一档自己存没存过】，
//   拿算出来的 offline/bg 去比的话，没存过时它俩就是 online 本身，一比就会把
//   主模型那一行也点亮，看着像选了两个。
test("选中态看这一档自己存的那个 id，不看算出来的结果", () => {
  assert.match(comp, /color: \(p \? lane\.picked === p\.id : !lane\.picked\) \? t\.bg2 : t\.ink/, "选中态算错了");
  assert.ok(!/=== \(kind === "online"/.test(comp), "旧的两档写法还留着");
});
