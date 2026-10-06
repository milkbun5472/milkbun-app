// 她 2026-09-11 截图：群里设的是 50 条，未读已经 61 了，还在自己发。
//   病根：她数的是屏幕上的行，计数器数的是模型交回来几条——所以 v67.20 改成每落一行记一笔。
// 她 2026-10-06：「群聊自己聊到了条数就会截断吗？能不能改成那一轮到了条数照样放行，只是不会开新轮」
//   → v74.885 起这一道【不再在一轮中间停手】：每行照旧记账，记满了巡检那头就不开下一轮。
//     所以屏幕上最多多出最后那一轮的几行——那是她要的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const A = strip(app);

const gate = app.slice(app.indexOf("    const autoRoomLeft = () => 1e9;"),
  app.indexOf("    const _abort = laneAbortBegin(\"g:\" + groupId);", app.indexOf("const autoRoomLeft")));
assert.ok(gate.length > 50, "抠不出那道闸");
const mk = (rgOpts, already) => {
  const ref = { current: { g1: already || 0 } };
  const add = (gid, n) => { ref.current[gid] = (ref.current[gid] || 0) + n; };
  const f = new Function("groupId", "rgOpts", "autoChatMsgsRef", "addAutoChatMessages",
    gate + "\nreturn { autoRoomLeft: autoRoomLeft, autoTook: autoTook, seen: () => autoChatMsgsRef.current[groupId] || 0 };");
  return f("g1", rgOpts, ref, add);
};

test("数的是【落进聊天里的行】，一泡一笔", () => {
  const g = mk({ auto: true }, 0);
  for (let i = 0; i < 5; i++) g.autoTook();
  assert.equal(g.seen(), 5);
});

test("到了条数，这一轮照样说完；账照记，下一轮由巡检那头不开", () => {
  const g = mk({ auto: true }, 49);
  g.autoTook(); g.autoTook(); g.autoTook();
  assert.ok(g.autoRoomLeft() > 0, "一轮中间不许再停手");
  assert.equal(g.seen(), 52, "超出的那几行也记上，巡检才知道到顶了");
  assert.match(app, /const capped = rounds >= roundCap \|\| msgsSoFar >= totalCap;/, "下一轮还得被总条数拦住");
});

test("她自己按的那一轮（不是自发）不记进自发那本账；借来的那一轮也不记总账", () => {
  const g = mk({}, 999); g.autoTook(); assert.equal(g.seen(), 999);
  const b = mk({ auto: true, borrowed: true }, 50); b.autoTook(); assert.equal(b.seen(), 50);
});

test("按条记的那一笔撤掉了，只有一处往上加", () => {
  assert.ok(A.indexOf("addAutoChatMessages(groupId, safeArr.length)") < 0);
  assert.equal((A.match(/addAutoChatMessages\(groupId, 1\)/g) || []).length, 1);
});

test("每一种真落地的行，紧接着就得记一笔", () => {
  [["拆出来的每一泡", /ReactDOM\.flushSync\(reveal\); else reveal\(\);\n\s*autoTook\(\);/],
   ["红包", /rp\.message \|\| "恭喜发财，大吉大利", rp\.to\);\n\s*autoTook\(\);/],
   ["撤回的那条", /content: item\.text, mid, ts: Date\.now\(\), turnId: gTurnId \}\]\);\n\s*autoTook\(\);/],
   ["语音", /mid: "gvm_" \+ Date\.now\(\) \+ "_" \+ i, ts: Date\.now\(\), turnId: gTurnId \}\]\);\n\s*autoTook\(\);/],
   ["自拍", /photoKind: gPhotoKind, ts: Date\.now\(\), turnId: gTurnId \}\]\);\n\s*autoTook\(\);/],
   ["动描", /mid: "gm_" \+ Date\.now\(\) \+ "_" \+ i \+ "_act", ts: Date\.now\(\), turnId: gTurnId\n\s*\}\]\);\n\s*autoTook\(\);/]]
    .forEach(([what, re]) => assert.match(A, re, what + "那一行没紧跟着记进额度"));
});

test("正常那一轮不再被剩余条数缩短；借来的那一轮还是一轮正常的长度", () => {
  assert.match(A, /replyGroup\(gid, \{ auto: true, urgeCharIds:/);
  assert.match(A, /replyGroup\(gid, \{ auto: true, borrowed: true, msgBudget: Math\.max\(2, Math\.round\(totalCap \/ roundCap\)\)/);
});
