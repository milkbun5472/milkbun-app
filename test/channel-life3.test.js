// 频道第三批（她 2026-11-20「都做吧宝宝」）：赌气退频道、楼中楼、挂机房
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
const en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const fnSrc = name => { const i = en.indexOf("function " + name + "("); return en.slice(i, en.indexOf("\n}\n", i) + 3); };
const ctx = {}; vm.createContext(ctx);
vm.runInContext("const CH_LEAVE_GAP = 3 * 86400000;" + ["chLeaveOk", "subRootKey", "subThreadsOf", "subRootHit"].map(fnSrc).join("\n") + ";this.chLeaveOk=chLeaveOk;this.subRootKey=subRootKey;this.subThreadsOf=subThreadsOf;this.subRootHit=subRootHit;", ctx);
test("赌气退频道：三天里只退一回，只剩他一个人时不退", () => {
  const g = { memberIds: ["a", "b"] }, now = 10 * 86400000;
  assert.equal(ctx.chLeaveOk(g, "a", now), true);
  assert.equal(ctx.chLeaveOk({ ...g, chLeftLog: { a: now - 86400000 } }, "a", now), false);
  assert.equal(ctx.chLeaveOk({ ...g, chLeftLog: { a: now - 4 * 86400000 } }, "a", now), true);
  assert.equal(ctx.chLeaveOk({ memberIds: ["a"] }, "a", now), false);
  assert.equal(ctx.chLeaveOk(g, "z", now), false);
});
test("楼中楼：串按根那条的 ts 归，根要在主线里逐字找到", () => {
  const ms = [{ role: "assistant", senderName: "甲", content: "今天去爬山吗", ts: 100 }, { role: "user", content: "不去", ts: 101 },
    { role: "assistant", senderName: "乙", content: "我去", ts: 102, replyRoot: "100" }, { role: "user", content: "那我也去", ts: 103, replyRoot: "100" }];
  const th = ctx.subThreadsOf(ms);
  assert.equal(th["100"].n, 2);
  assert.equal(th["100"].last.content, "那我也去");
  assert.equal(ctx.subRootHit("爬山", ms).ts, 100);
  assert.equal(ctx.subRootHit("我去", ms), null);   // 串里的话不当根
  assert.equal(ctx.subRootKey(ms[0]), "100");
});
test("接线：串里那一轮新落的话挂 replyRoot；主线上下文不带串里的话；退频道、回频道、挂机房都接上了", () => {
  assert.match(ap, /const pGChat = _subRoot \? \(gid, u\) => pGChatOuter\(/);
  assert.match(ap, /_graw0\.filter\(m => !m\.replyRoot\)/);
  assert.match(ap, /chLeaveOk\(g0, spk\.id, nowL\)/);
  assert.match(ap, /if \(parsed\.rejoin && typeof parsed\.rejoin === "object"\)/);
  assert.match(ap, /const loungeSit = async gid =>/);
  assert.match(ap, /replyGroup\(gid, \{ sub: root \}\)/);
  assert.match(cs, /function SubThreadPage\(/);
  assert.match(cs, /function LoungePanel\(/);
  assert.match(cs, /if \(_m && _m\.replyRoot && onSub\) return \[\];/);
});
test("旁观频道不露她：没有回一串、退频道提示和进去坐坐", () => {
  assert.match(ap, /onSub: activeGroup\.spaceId && !groupSpectating\(activeGroup\)/);
  assert.match(ap, /const gLeaveHint = group && group\.spaceId && !groupSpectating\(group\)/);
  assert.match(ap, /if \(!g \|\| groupSpectating\(g\) \|\| loungeSitting\) return;/);
});
