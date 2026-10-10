// 用户 2026-09-28 报：一间「全部没勾」的房里，TA 还知道两人聊过的事；
// Lisa 打开「TA 知道什么」，看见 5 条主线记忆被"召回"。查下来是三件事：
//   ① 那 5 条其实没进模型——闸在检索【之后】才清掉 memLib；可快照是在检索那一刻记的，
//      只按 charId 存、不认房间，于是面板显示了一份根本没发出去的召回（面板自己写着
//      「只认实际送进模型的选集」，等于说了假话）。
//   ② 顺带白算一遍向量，结果整份丢掉。
//   ③ 真正还在漏的是两样【永远放行】的：主线 OOC 长期规矩、世界书常开词条。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = require("../js/chat-rooms.js");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const components = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

const main = { main: true };
const oldIso = { id: "r1", cognition: {} };                    // 老房子：没有 worldbook 这个键
const noLore = { id: "r2", cognition: { worldbook: false } };
const ctxAll = { char: { name: "x" }, worldbook: "世界设定", memory: "记忆", memLib: ["条"], directives: ["规矩"], recentChat: "房里的话" };

test("世界书成了一档可关的门，但老房子一个字不变", () => {
  assert.equal(R.allows(oldIso, "worldbook"), true, "没写这个键＝开；否则等于静默关掉所有人的世界观");
  assert.equal(R.allows(noLore, "worldbook"), false);
  assert.equal(R.gateCtx(ctxAll, oldIso).worldbook, "世界设定");
  assert.equal(R.gateCtx(ctxAll, noLore).worldbook, "");
});

test("别的档照旧「没写＝关」", () => {
  assert.equal(R.allows(oldIso, "formalMemory"), false);
  assert.equal(R.allows(oldIso, "innerLife"), false);
  assert.equal(R.gateCtx(ctxAll, oldIso).memory, "");
  assert.deepEqual(R.gateCtx(ctxAll, oldIso).memLib, []);
});

test("主房永远全开", () => {
  for (const g of ["formalMemory", "innerLife", "worldbook", "schedule", "otherScenes"]) assert.equal(R.allows(main, g), true);
});

test("「开没开某一档」只有一份判据，调用点都问它", () => {
  // 缺省语义写在一处
  const src = fs.readFileSync(path.join(__dirname, "..", "js", "chat-rooms.js"), "utf8");
  assert.match(src, /const OPT_IN_OFF = \{ worldbook: true \}/, "缺省表要收在一处");
  assert.equal((src.match(/OPT_IN_OFF/g) || []).length, 2, "一处定义、一处使用");
  // 两个调用点都走 allows，不自己认一遍
  // 2026-10-05 起多一道「只带截过的记忆库」（memOnly 也住在 chat-rooms.js 那一处，同样问 allows）
  assert.match(app, /const noMemory = !!\(window\.ChatRooms && !window\.ChatRooms\.allows\(room, "formalMemory"\) && !\(window\.ChatRooms\.memOnly/);
  assert.match(app, /noMemory: !window\.ChatRooms\.allows\(_door, "formalMemory"\)/, "邻居那条路也要省掉检索");
});

test("关了记忆就不检索：不白算，也不会记下一份没发出去的召回", () => {
  const i = app.indexOf("memLib: (() => {"), j = app.indexOf("geo: geoForPrompt(char.id)", i);
  assert.ok(i > 0 && j > i, "抠不出 memLib 那段");
  const seg = app.slice(i, j);
  assert.match(seg, /if \(ctxOpts && ctxOpts\.noMemory\) return \[\];/);
  // 这一刀必须在检索之前
  assert.ok(seg.indexOf("ctxOpts.noMemory") < seg.indexOf("retrieveMemories("), "早退要在 retrieveMemories 之前，否则快照照样记");
});

test("主线 OOC 长期规矩不跟进侧房，房间自己立的照旧", () => {
  const i = app.indexOf("const roomContextFor = (char, chatKey, room, ctxOpts)");
  const j = app.indexOf("const roomTurnsOf =", i);
  assert.ok(i > 0 && j > i, "抠不出 roomContextFor");
  const seg = app.slice(i, j);
  assert.match(seg, /ctx\.directives = \[\.\.\.\(directives\[chatKey\] \|\| \[\]\)\]/);
  assert.ok(!/ctx\.directives = \[\.\.\.\(ctx\.directives \|\| \[\]\)/.test(seg), "旧的「主线那份也拼上」要撤掉");
});

test("设置面板的开关和真实行为同一份判据（别再有说谎的开关）", () => {
  assert.match(components, /Kit\.allows \? Kit\.allows\(draft, k\) : !!draft\[key\]\[k\]/);
  assert.ok(!/h\(Toggle, \{ on: !!draft\[key\]\[k\], onChange/.test(components), "旧的直接读键要撤掉");
});

// ⚠️最狠的一处：OOC。她 2026-09-28 在一间「不带出门 · 独立线下」房里 OOC 问
// 「你能不能看到记忆库」，助手答「我确实能实时看到【记忆库】里的所有条目」，
// 还报得出聘礼单子、数石阶、红手印底稿——它没撒谎，那些真在它上下文里：
// 线下 OOC 递的是裸 ctxFor(char)，一道闸都没过。线上 OOC 早就对了，只有线下没跟上。
test("两条 OOC 都要过房间那道闸，不许有裸 ctxFor", () => {
  const i = app.indexOf("const offlineOOC = async (scopeKey, text)");
  const j = app.indexOf("const offlineDelSession =", i);
  assert.ok(i > 0 && j > i, "抠不出 offlineOOC");
  const seg = app.slice(i, j);
  assert.match(seg, /const oocRoom = offlineRoomFor\(scopeKey\);/);
  assert.match(seg, /oocAsk\(offlineApiFor\(charId\), roomContextFor\(char, scopeKey, oocRoom, \{\}\), q\)/);
  assert.ok(!/oocAsk\(offlineApiFor\(charId\), ctxFor\(char\), q\)/.test(seg), "裸 ctxFor 要撤掉");
  // 线上那条本来就是对的，别改坏
  assert.match(app, /const oocCtx = roomContextFor\(char, chatKey, room\);/);
});
