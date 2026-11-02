const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
const a=fs.readFileSync(__dirname+"/../js/app.js","utf8"),c=fs.readFileSync(__dirname+"/../js/components.js","utf8");
test("进群记住几条没看，群里挂一颗跳到第一条没看的",()=>{
  assert.ok(a.includes("setGOpenUnread(was > 0 ? { id: id, n: was } : null)"));
  assert.ok(a.includes("openUnread: gOpenUnread && gOpenUnread.id === activeGroup.id ? gOpenUnread.n : 0"));
  assert.ok(c.includes('"data-wk": "gunreadjump"'));
  // 第一条没看的：照数未读的同一个判断往回数（2026-11-02 起；原来 length - 未读数，夹着系统行就往下偏）
  assert.ok(c.includes("const idx = gFirstUnreadIdx(messages, openUnread);"));
});

// 窗口还没撑开到那条（她 2026-11-02「点那个新消息也跳转不上去」）：不拿旧的 start 放弃，过一会儿再找那一条本身
{
  const assert = require("node:assert/strict");
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
  assert.match(src, /if \(o\.single && i < start\) return;/, "群聊不靠 start 放弃");
  assert.match(src, /if \(left > 0\) setTimeout\(\(\) => tryFind\(left - 1\), 150\);/);
  assert.match(src, /tryFind\(10\);/);
  // 窗口里还没有那一条、它前面也没有气泡：不能先跳到窗口最上面那条（那是错的位置）
  assert.match(src, /if \(!node && \(inWin \|\| left <= 0\)\) for \(let j = i \+ 1;/);
}

// 数未读和找第一条用同一个判断：夹在中间的系统灰字不算（她 2026-11-02：「跳不准，往上还有三条」）
{
  const assert = require("node:assert/strict");
  const fs = require("fs"), path = require("path");
  const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const seg = comp.slice(comp.indexOf("function gUnreadCounts("), comp.indexOf("function RoomWorldBanner("));
  const { gFirstUnreadIdx } = new Function(seg + "; return { gFirstUnreadIdx };")();
  const A = { role: "assistant", content: "x" }, S = { role: "system", kind: "system", content: "某某收下了转账" }, U = { role: "user", content: "我" };
  // 旧的 3 条，然后新：A S A S S A（未读 3）
  const msgs = [A, U, A, A, S, A, S, S, A];
  assert.equal(gFirstUnreadIdx(msgs, 3), 3, "落在第一条新的上，不是 length-3=6");
  assert.equal(gFirstUnreadIdx(msgs, 99), 0);
  assert.match(comp, /const idx = gFirstUnreadIdx\(messages, openUnread\);/);
  assert.match(app, /const added = n\.slice\(pl\.length\)\.filter\(gUnreadCounts\)\.length;/);
}
