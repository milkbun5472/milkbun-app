// v62.99 合龙（她 2026-09-05：「我觉得都可以做，按顺序来吧」——第一件）：
// 梦境 app 里的梦原来只能凭三个关键词编；梦回路（内在生活 D）每晚给角色真做一场梦、却只能在解梦馆里读。
// 现在解梦馆那场梦多一扇门，推开就是梦境 app 里的一场戏，材料是他昨天真过过的一天；
// 她在梦里走到哪儿，决定他早上讲不讲（x_dreamSeen.mode → ctxFor）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const shadow = read("js/dream-loop-shadow.js"), journal = read("js/dreamjournal.js"), dream = read("js/dream.js"), app = read("js/app.js");

test("取材只写一处：解梦馆和梦境都问 DreamLoop.excerptsFor", () => {
  assert.match(shadow, /function excerptsFor\(row, limit\)/);
  assert.match(shadow, /window\.DreamLoop = \{ observe, report, clearAll, listDreams, saveGenerated, excerptsFor, markEntered \}/);
  assert.match(journal, /const excerpts = window\.DreamLoop\.excerptsFor\(row, 12\);/, "解梦馆没用共用那份");
  assert.doesNotMatch(journal, /refMatches\(ref, m\.content\)/, "解梦馆里那份自己捞材料的循环还在——两份迟早走散");
  assert.match(dream, /window\.DreamLoop\.excerptsFor\(row, 12\)/, "梦境没用共用那份");
});

test("两扇门：解梦馆那栏有「推门进这场梦」，梦境落地页列「他昨晚真做的梦」", () => {
  assert.match(journal, /props\.onEnterDream\(d\)/, "解梦馆没有那扇门");
  assert.match(journal, /"推门进这场梦"/);
  assert.match(journal, /你进去过这场梦：/, "进去过的没标出来");
  assert.match(dream, /"他昨晚真做的梦 · 还没进过"/);
  assert.match(dream, /r\.status === "queued" \|\| r\.status === "generated"/, "无梦之夜也给门了？");
  assert.match(dream, /!enteredKeys\.has\(r\.key\) && !\(r\.entered && r\.entered\.outcome\)/, "进过的还列着");
  // App 那根线：解梦馆 → 梦境 带 key；Dream 用完就清
  assert.match(app, /onEnterDream: row => \{ setDreamEnterKey\(row && row\.key \|\| null\); setScreen\("dream"\); \}/);
  assert.match(app, /enterLoopKey: dreamEnterKey,\s*\n\s*onEnterConsumed: \(\) => setDreamEnterKey\(null\)/);
  assert.match(app, /couples: couples,\s*\n\s*\/\/ 合龙/, "Dream 没拿到 couples，现实关系边界写不出来");
});

// 把 dream.js 装进假窗口，拿到那两把纯函数
function loadDream() {
  const store = {};
  const g = {
    window: null, loadJSON: (k, fb) => (k in store ? JSON.parse(store[k]) : fb), saveJSON: (k, v) => { store[k] = JSON.stringify(v); return true; },
    useState: v => [typeof v === "function" ? v() : v, () => {}], useRef: () => ({ current: null }), useEffect: () => {}, React: { Fragment: "f" },
    h: () => null, Head: () => null, Avatar: () => null, F_BODY: "a", F_DISPLAY: "b", requestAppConfirm: () => {}, isOocMsg: () => false,
    __store: store
  };
  g.window = g;
  g.DreamLoop = { calls: [], excerptsFor: () => ["昨天你说下雨天想去看海", "我说等你放假"], markEntered: (k, info) => { g.DreamLoop.calls.push([k, info]); return Promise.resolve(); }, listDreams: () => Promise.resolve([]) };
  vm.runInNewContext(dream, g);
  return g;
}

test("从梦回路那一行做出来的戏：材料齐、关系边界对、人名铁律在", () => {
  const g = loadDream();
  const row = { key: "c1|2026-09-04", charId: "c1", nightKey: "2026-09-04", status: "generated", peaks: [{ axis: "不安", value: 0.7 }], relationActiveAxes: ["试探"], motifs: ["海", "伞"], tone: "闷", narrative: "我在一个没有门的海边等她。", wakeLine: "我梦见海了" };
  const props = { characters: [{ id: "c1", name: "沈屿白", persona: "画画的", remark: "小白" }], profile: { name: "Lisa" }, couples: { c1: { status: "pending" } } };
  const s = g.Dream.sessionFromLoop(row, props);
  assert.equal(s.loopKey, row.key); assert.equal(s.fromLoop, true); assert.equal(s.charName, "沈屿白");
  assert.equal(s.material.excerpts.join("/"), "昨天你说下雨天想去看海/我说等你放假");
  assert.match(s.material.relationship, /尚未确认成为恋人/);
  assert.equal(s.material.allowedNames, "沈屿白、小白、Lisa");
  assert.equal(s.keywords.length, 0); assert.equal(s.guests.length, 0);
  const block = g.Dream.loopMaterialBlock(s);
  assert.match(block, /昨晚（2026-09-04 夜）真做的梦/);
  assert.match(block, /不安=0\.7｜关系张力：试探/);
  assert.match(block, /底稿——这场梦要从它长出来/);
  assert.match(block, /【人名铁律】梦里允许具名的人只有：沈屿白、小白、Lisa/);
  // 材料块进的是 charBlock，所以每一幕（首幕/续写/结局/梦碎）都带着
  assert.match(dream, /s \+= loopMaterialBlock\(session\);\s*\n\s*return s;/);
  // 不是从梦回路来的梦，一个字都不多
  assert.equal(g.Dream.loopMaterialBlock({ charName: "x" }), "");
});

test("结算：抵达→tell、碎→vague、自己醒→seen；记回梦回路；梦≠记忆", () => {
  const g = loadDream();
  const s = { id: "dm_1", loopKey: "c1|2026-09-04", charId: "c1", material: { wakeLine: "我梦见海了", narrative: "我在海边等她。", tone: "闷" }, dreamCore: "他怕的是等不到" };
  g.Dream.settleLoopDream(s, "fulfilled");
  let seen = JSON.parse(g.__store.x_dreamSeen).c1;
  assert.equal(seen.mode, "tell"); assert.equal(seen.line, "他怕的是等不到"); assert.equal(seen.tone, "闷");
  g.Dream.settleLoopDream({ ...s, dreamCore: "" }, "broken");
  seen = JSON.parse(g.__store.x_dreamSeen).c1; assert.equal(seen.mode, "vague"); assert.equal(seen.line, "我梦见海了");
  g.Dream.settleLoopDream(s, "left");
  seen = JSON.parse(g.__store.x_dreamSeen).c1; assert.equal(seen.mode, "seen");
  assert.deepEqual(g.DreamLoop.calls.map(x => x[1].outcome), ["fulfilled", "broken", "left"]);
  // 不从梦回路来的梦什么都不写
  g.__store.x_dreamSeen = "{}"; g.Dream.settleLoopDream({ id: "dm_2", charId: "c1" }, "fulfilled");
  assert.equal(g.__store.x_dreamSeen, "{}");
  // 梦≠记忆：结算只碰 x_dreamSeen
  assert.deepEqual(Object.keys(g.__store), ["x_dreamSeen"]);
  // 结算挂在 patchSession 上，三种结局都走它
  assert.match(dream, /patch\.status === "fulfilled" \|\| patch\.status === "broken" \|\| patch\.status === "left"/);
});

test("ctxFor 认 mode：tell 主动提一句、vague 只说做了个乱七八糟的梦、其余照旧不主动提", () => {
  const i = app.indexOf("dreamEcho: (() => {"); const fn = app.slice(i, app.indexOf("directives: directives[char.id]", i));
  assert.match(fn, /if \(d\.mode === "tell"\) return head/);
  assert.match(fn, /\*\*主动\*\*跟她提一句/);
  assert.match(fn, /if \(d\.mode === "vague"\) return head/);
  assert.match(fn, /做了个乱七八糟的梦/);
  assert.match(fn, /别主动提起、别复述梦的内容、更别问她看没看/, "默认那支（她只是翻过）不见了");
  // 桩照写入方：写的是 { line, tone, ts, mode }，读的也只认这四个
  assert.match(dream, /all\[session\.charId\] = \{ line, tone: String\(m\.tone \|\| ""\)\.slice\(0, 8\), ts: Date\.now\(\),\s*\n\s*mode:/);
  assert.match(journal, /all\[d\.charId\] = \{ line: line\.slice\(0, 120\), tone: String\(d\.tone \|\| ""\)\.slice\(0, 8\), ts: Date\.now\(\) \};/, "解梦馆那处写法变了，读的那头要跟着看");
});
