// 楼主回我的时候，也要显示「回复 @我」（她 2026-10-01）
//
// 她原话：「楼主回复我的时候显示不出来回复，而是直接写的」。
// 她那张截图里：摸鱼办主任「回复 @Lisa」✓、沙发不是我的「回复 @Lisa」✓，
// 偏偏带【楼主】小标的齐周那条直接就是正文，看上去像在自言自语。
//
// 病根在 genRepliesToMe（「我回了一句，谁来回我」那条路）：
//   层主那一支写着 toName: meNow，帖主那两支【漏了】——
//   同一个形状手写四遍，漏一处不报任何错。
// 这一版收成一份 toMe（施工规则/one-public-mechanism）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");

const seg = (() => {
  const i = app.indexOf("  const genRepliesToMe = async");
  const j = app.indexOf("const keptReps = reps.filter", i);
  assert.ok(i > 0 && j > i, "抠不出 genRepliesToMe 拼回复那一段");
  return app.slice(i, j);
})();

test("① 「回复的是我」这件事只写一处", () => {
  assert.match(seg, /const toMe = \{ replyToMe: true, toName: meNow \};/,
    "没收成一处，就还是四份各写各的");
  assert.equal((seg.match(/replyToMe: true,\s*toName: meNow/g) || []).length, 1,
    "除了那一份公共的，不许再手写第二份");
});

test("② 层主和帖主两支都带上它（原来只有层主有）", () => {
  const owner = (seg.match(/isOwner: true, \.\.\.toMe,/g) || []).length;
  const op = (seg.match(/isOp: true, \.\.\.toMe,/g) || []).length;
  assert.equal(owner, 2, "层主那两处（角色/路人）都要带");
  assert.equal(op, 2, "⚠️帖主那两处就是她报的那个 bug，必须带");
});

test("③ 不许有哪一支带了 replyToMe 却没有 toName", () => {
  // 把每个 return 对象切出来逐个看
  const bad = [];
  for (const m of seg.matchAll(/return \{[^;]*?replyToMe: true[^;]*?\};/g)) {
    const o = m[0];
    if (!/\.\.\.toMe/.test(o) && !/toName/.test(o)) bad.push(o.slice(0, 110));
  }
  assert.deepEqual(bad, [],
    "这几条说是在回她、却没写回复谁，渲染出来就是一段自言自语：\n  " + bad.join("\n  "));
});

test("④ 路人那一支照旧按模型填的 to 走，别被一刀切成「都在回我」", () => {
  assert.match(seg, /forumValidTo\(x\.to, \[meNow\]\.concat\(/,
    "路人可以回这层里别的人，不该强行写成回我");
});
