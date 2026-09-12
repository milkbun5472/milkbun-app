// 她 2026-09-11 截图：群里设的是 50 条，未读已经 61 了，还在自己发。
// 「修了好多次了。以前不这样的」——两句都对。
//
// 病根：**她设的是 50，她数的是屏幕上的行数**，可计数器一直数的是
// 【模型交回来几条】。一条会被 splitLongBubble 拆成好几泡、动描还要再占一行，
// 50 条轻松变成六七十行。单位不一样的两个数，看着像同一个数。
// 「以前不这样」也不是错觉：v56.27 群里才接上气泡拆分、v56.29 门槛从 34 降到 22、
// v65.19 再接上动描——三次都在放大「一条变几行」，这个数一次都没跟着改口。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const A = strip(app);

// 闸那几行是自成一体的：给它 rgOpts/gs/groupId/计数器就能跑
const gate = app.slice(app.indexOf("    const _autoCap = Math.max(1, Number(gs.autoChatMaxMsg) || 50);"),
  app.indexOf("    startLane(\"g:\" + groupId);", app.indexOf("const _autoCap")));
assert.ok(gate.length > 300, "抠不出那道闸");
const mk = (rgOpts, gs, already) => {
  const box = { groupId: "g1", rgOpts: rgOpts, gs: gs, autoChatMsgsRef: { current: { g1: already || 0 } } };
  box.addAutoChatMessages = (gid, n) => { box.autoChatMsgsRef.current[gid] = (box.autoChatMsgsRef.current[gid] || 0) + n; };
  const f = new Function("groupId", "rgOpts", "gs", "autoChatMsgsRef", "addAutoChatMessages",
    gate + "\nreturn { autoRoomLeft: autoRoomLeft, autoTook: autoTook, seen: () => autoChatMsgsRef.current[groupId] || 0 };");
  return f(box.groupId, box.rgOpts, box.gs, box.autoChatMsgsRef, box.addAutoChatMessages);
};

test("数的是【落进聊天里的行】，不是模型交回来几条", () => {
  const g = mk({ auto: true }, { autoChatMaxMsg: 50, autoChatRounds: 5 }, 0);
  assert.equal(g.autoRoomLeft(), 50);
  // 一条发言拆成 4 泡 + 1 行动描 = 5 行，就该记 5 笔
  for (let i = 0; i < 5; i++) g.autoTook();
  assert.equal(g.seen(), 5, "一泡一笔");
  assert.equal(g.autoRoomLeft(), 45);
});

test("到顶就是到顶：额度用光之后一行都不许再落", () => {
  const g = mk({ auto: true }, { autoChatMaxMsg: 50, autoChatRounds: 5 }, 49);
  assert.equal(g.autoRoomLeft(), 1);
  g.autoTook();
  assert.equal(g.autoRoomLeft(), 0, "第 50 行之后就没了");
  g.autoTook();
  assert.equal(g.autoRoomLeft(), 0, "不许变成负数绕回去");
});

test("她设多少就是多少，不是写死的 50", () => {
  assert.equal(mk({ auto: true }, { autoChatMaxMsg: 12, autoChatRounds: 4 }, 0).autoRoomLeft(), 12);
  assert.equal(mk({ auto: true }, { autoChatMaxMsg: 200, autoChatRounds: 5 }, 30).autoRoomLeft(), 170);
  // 没设过就用默认那个 50
  assert.equal(mk({ auto: true }, {}, 0).autoRoomLeft(), 50);
});

test("她自己按的那一轮（不是自发）不受这道闸管", () => {
  const g = mk({}, { autoChatMaxMsg: 50, autoChatRounds: 5 }, 999);
  assert.ok(g.autoRoomLeft() > 1000, "她按了回复键就该照常回，额度是给自发用的");
  g.autoTook();
  assert.equal(g.seen(), 999, "也不记进自发那本账");
});

// 借来的那几轮是她 2026-09-04 点头的设计：额度到顶之后，真有人想说话才借几轮。
// 借的账单独记，所以不受总数管——但那一轮自己得有个行上限，不然借一次就跑飞。
test("借来的那一轮：单独一份行额度，用的还是她设的那两个数", () => {
  const g = mk({ auto: true, borrowed: true }, { autoChatMaxMsg: 50, autoChatRounds: 5 }, 50);
  assert.equal(g.autoRoomLeft(), 10, "50 ÷ 5 = 一轮 10 行");
  for (let i = 0; i < 10; i++) g.autoTook();
  assert.equal(g.autoRoomLeft(), 0, "借来的那一轮也有底");
  assert.equal(g.seen(), 50, "借的行数不记进总账（借的账另记在 borrowLeft 上）");
  // 轮数设得大一点，一轮就该少几行
  assert.equal(mk({ auto: true, borrowed: true }, { autoChatMaxMsg: 50, autoChatRounds: 10 }, 50).autoRoomLeft(), 5);
  // 再小也留两行，不然借了等于没借
  assert.equal(mk({ auto: true, borrowed: true }, { autoChatMaxMsg: 2, autoChatRounds: 50 }, 2).autoRoomLeft(), 2);
});

// ── 闸真的接在每一条落地的路上 ──────────────────────────────────
test("按条记的那一笔撤掉了（撤就是删）", () => {
  assert.ok(A.indexOf("addAutoChatMessages(groupId, safeArr.length)") < 0,
    "按【模型交回来几条】记的那一笔还在，她设的数就永远对不上屏幕");
  assert.equal((A.match(/addAutoChatMessages\(groupId, 1\)/g) || []).length, 1, "只许有一处往上加");
});

test("每一种真落地的行，紧接着就得记一笔", () => {
  // ⚠️断言要贴着那一行写。原来用的是「这一行后面 700 字里有没有 autoTook」——
  //   隔壁分支的那一笔就在窗口里，于是把自己这一行的删掉照样绿（写这条测试时当场撞见）。
  [["拆出来的每一泡", /ReactDOM\.flushSync\(reveal\); else reveal\(\);\n\s*autoTook\(\);/],
   ["红包", /rp\.message \|\| "恭喜发财，大吉大利"\);\n\s*autoTook\(\);/],
   ["撤回的那条", /content: item\.text, mid, ts: Date\.now\(\), turnId: gTurnId \}\]\);\n\s*autoTook\(\);/],
   ["语音", /mid: "gvm_" \+ Date\.now\(\) \+ "_" \+ i, ts: Date\.now\(\), turnId: gTurnId \}\]\);\n\s*autoTook\(\);/],
   ["自拍", /photoKind: gPhotoKind, ts: Date\.now\(\), turnId: gTurnId \}\]\);\n\s*autoTook\(\);/],
   ["动描", /mid: "gm_" \+ Date\.now\(\) \+ "_" \+ i \+ "_act", ts: Date\.now\(\), turnId: gTurnId\n\s*\}\]\);\n\s*autoTook\(\);/]]
    .forEach(([what, re]) => assert.match(A, re, what + "那一行没紧跟着记进额度"));
  // 动描那一行也占一行、也进未读，所以额度满了连它都不该摆
  assert.match(A, /if \(!sameActLine\(gActionNow, _gprevAct\) && autoRoomLeft\(\) > 0\) \{/, "额度满了还摆动描");
});

test("两道口子都要当场停手：一条发言之间、一泡一泡之间", () => {
  assert.match(A, /if \(!spk\) continue;\n\s*if \(autoRoomLeft\(\) <= 0\) break;/, "下一条发言之前要看一眼");
  assert.match(A, /for \(let j = 0; j < gBubbles\.length; j\+\+\) \{\n\s*if \(autoRoomLeft\(\) <= 0\) break;/,
    "一条被拆成好几泡时，泡与泡之间也要看一眼——不然一条就能冲过头");
});

test("借来的那一轮要认得出自己是借来的", () => {
  assert.match(A, /replyGroup\(gid, \{ auto: true, borrowed: true, msgBudget: Math\.max\(2, Math\.round\(totalCap \/ roundCap\)\)/,
    "不标出来的话，借的那几轮会被总额度直接掐死，等于把她点头的那个设计撤了");
  // 正常那一路不许也标成借来的
  assert.match(A, /replyGroup\(gid, \{ auto: true, msgBudget: totalCap - msgsSoFar/, "正常那一路照旧");
});

test("一轮最多几条发言那一刀照旧留着（跟总行数是两件事）", () => {
  assert.match(A, /const safeArr = _autoBudget \? \(guarded\.items \|\| \[\]\)\.slice\(0, _autoBudget\) : guarded\.items;/);
});
