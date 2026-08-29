// 全局搜索 + 我收着的
//
// 搜索：所有偷看动作里最真的一个是【在他手机里搜自己的名字】。零调用——
// 时间线已经把各 app 的碎片规范化了，再补上它不收的那几栏就够了。
// 收着：转发是【摆到他面前】，收着是【我自己留一份】——不进他的上下文。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadPhone, FIXTURES } = require("./helpers/phone-render.js");
const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const P = new Function(SRC + "; return { phoneSearch, phoneSearchExtra, phoneTimeline, PHONE_APPS, PHONE_LIVE_KEYS };")();
const NOW = new Date(2026, 7, 29, 15, 0).getTime();

const rows = () => Array.from(P.phoneTimeline(FIXTURES, null, NOW));
const extra = () => Array.from(P.phoneSearchExtra(FIXTURES, null));

test("搜自己的名字，能在他手机的好几个角落找到", () => {
  const hit = Array.from(P.phoneSearch(rows(), extra(), "Lisa"));
  assert.ok(hit.length >= 1, "搜不到她自己");
  assert.ok(hit.some(x => x.app === "wechat" && /备注/.test(x.tag)), "他给她的备注该被搜到——这是最该找到的一条");
});

test("搜索覆盖时间线不收的那几栏（名单、想买、口味、账本、书）", () => {
  const ex = extra();
  const apps = new Set(Array.from(ex, x => x.app));
  ["wechat", "shopping", "takeout", "reading", "tally"].forEach(k =>
    assert.ok(apps.has(k), k + " 那几栏没进搜索"));
  // 联系人只在这一层（时间线不收它）
  assert.ok(ex.some(x => x.tag === "联系人"), "微信联系人搜不到");
  assert.ok(ex.some(x => x.tag === "没结清"), "账本搜不到");
});

test("搜得到就跳得回去：每条都带 app，能落回某个 app", () => {
  const keys = new Set(P.PHONE_APPS.map(a => a.key));
  Array.from(P.phoneSearch(rows(), extra(), "羊")).forEach(x =>
    assert.ok(keys.has(x.app), "搜出来一条落不回任何 app：" + x.app));
});

test("不区分大小写、忽略空白；空词不返回全部", () => {
  const a = Array.from(P.phoneSearch(rows(), extra(), "lisa")).length;
  const b = Array.from(P.phoneSearch(rows(), extra(), "  L i s a  ")).length;
  assert.ok(a > 0 && a === b);
  ["", "   ", null, undefined].forEach(q =>
    assert.equal(Array.from(P.phoneSearch(rows(), extra(), q)).length, 0, "空词该返回空，不是全部"));
});

test("同一条不会因为既在时间线又在补充层而出现两遍", () => {
  const hit = Array.from(P.phoneSearch(rows(), extra(), "羊"));
  const ids = hit.map(x => x.id);
  assert.equal(ids.length, new Set(ids).size);
});

test("搜索不调模型", () => {
  const fn = SRC.match(/function phoneSearch\(rows, extra, q\) \{[\s\S]*?\n\}/)[0]
    + SRC.match(/function phoneSearchExtra\(charData, live\) \{[\s\S]*?\n\}/)[0];
  ["runProbe", "fetch(", "await "].forEach(w => assert.ok(fn.indexOf(w) < 0, "搜索里出现了 " + w));
});

test("脏数据不炸", () => {
  [null, undefined, {}, "字符串", { wechat: null }, { wechat: { contacts: "x" } }, { tally: { debts: [null, 3] } }]
    .forEach(d => assert.doesNotThrow(() => P.phoneSearchExtra(d, null)));
  assert.doesNotThrow(() => P.phoneSearch(null, null, "x"));
});

// ── 我收着的 ──────────────────────────────────────────────

test("收着 ≠ 转发：两个按钮，两件事", () => {
  // 转发是摆到他面前（进他的上下文）；收着是她自己留一份（谁都不喂）
  assert.match(SRC, /收着 · 只有你看得到/);
  assert.match(SRC, /转发给 TA · 他会知道你翻了手机/);
  assert.match(SRC, /onToggleKeep \&\& h\("button"/, "详情里没有收着按钮");
});

test("收着只写 x_phoneKeep，不碰任何会喂给模型的东西", () => {
  const fn = SRC.match(/const toggleKeep = id => setKept\(p => \{[\s\S]*?\n  \}\);/)[0];
  assert.match(fn, /saveJSON\("x_phoneKeep", n\)/);
  ["onPeek", "x_phone\"", "x_phoneArch", "runProbe"].forEach(w =>
    assert.ok(fn.indexOf(w) < 0, "收着动了不该动的：" + w));
  // 再点一次取消
  assert.match(fn, /if \(box\[id\]\) delete box\[id\]; else box\[id\] = 1;/);
});

test("时间线三档：全部 / 只看新增 / 我收着的", () => {
  assert.match(SRC, /const \[mode, setMode\] = useState\("all"\)/);
  assert.match(SRC, /mode === "new" \? list\.filter\(isNew\) : mode === "keep" \? list\.filter\(isKept\) : list/);
  // 没收过东西时不显示那个按钮
  assert.match(SRC, /keptCount > 0 && h\("button"/);
});

test("三档都渲染得出来", () => {
  const live = { forumAccounts: [], playlist: null };
  const tl = Array.from(P.phoneTimeline(FIXTURES, live, NOW));
  const props = { rows: tl, char: { name: "x" }, t: {}, onBack: () => {}, onOpenApp: () => {}, onPeek: () => {},
    newIds: { [tl[0] && tl[0].id]: 1 }, newCount: 1, onMarkRead: () => {},
    kept: { [tl[0] && tl[0].id]: 1 }, onToggleKeep: () => {} };
  ["all", "new", "keep"].forEach(m =>
    assert.doesNotThrow(() => loadPhone({ 0: m }).TimelineView(props), m + " 那一档炸了"));
  assert.doesNotThrow(() => loadPhone({ 0: "keep" }).TimelineView({ ...props, kept: null, onToggleKeep: null }));
});
