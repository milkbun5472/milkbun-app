const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("论坛常驻网友使用稳定 id，并且匿名身份不与公开身份混池", () => {
  const block = app.match(/const FORUM_NPC_REGISTRY = \[([\s\S]*?)\n\];/);
  assert.ok(block, "missing forum NPC registry");
  const ids = [...block[1].matchAll(/id: "([^"]+)"/g)].map(m => m[1]);
  assert.ok(ids.length >= 12, "常驻网友数量不足");
  assert.equal(new Set(ids).size, ids.length, "常驻网友 id 必须唯一");
  assert.match(app, /exact\.length \? exact : FORUM_NPC_REGISTRY\.filter\(n => !\(n\.boards \|\| \[\]\)\.includes\("匿名吧"\)\)/);
});

test("发帖、评论和楼中楼都按 npcId 回填稳定公开身份", () => {
  assert.match(app, /authorId: npc\.id, authorType: "npc"/);
  assert.match(app, /authorName: npc\.name, authorHandle: npc\.handle/);
  assert.match(app, /同一 npcId 必须保持对应网名、账号和说话习惯/);
  assert.match(app, /schemaHint: "\{\\"comments\\":\[\{\\"npcId\\"/);
  assert.match(app, /const rn = rc \? null : forumNpcOf\(r,/);
});

test("常驻网友档案只存公开习惯，不接入私聊或记忆库", () => {
  const block = app.match(/const FORUM_NPC_REGISTRY = \[([\s\S]*?)\n\];/)[1];
  assert.doesNotMatch(block, /memory|memLib|chat|private|私聊|记忆/);
  assert.match(app, /saveJSON\("x_forumNpcs", \{ version: 1, items: FORUM_NPC_REGISTRY \}\)/);
});
