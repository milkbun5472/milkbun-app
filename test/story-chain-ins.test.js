// 限时动态照 ins 翻（她 2026-11-24）：按聊天列表的顺序；点粉圈只串还有没看过的人、从没看过的那条起；点灰圈全都能翻
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const c = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const i = c.indexOf("  const storyChain = id => {"), j = c.indexOf("  const storyRing = (id, kid) => {", i);
const mk = (chatItems, characters, stories) => new Function("chatItems", "characters", "SK", c.slice(i, j) + "\nreturn storyChain;")(
  chatItems, characters, { activeOf: by => stories.filter(s => s.by === by) });
const S = (id, by, seen) => ({ id, by, seen: seen ? { me: 1 } : {} });
const chars = [{ id: "a" }, { id: "b" }, { id: "c" }];          // 档案顺序 a b c
const chat = [{ id: "c", c: {} }, { id: "a", c: {} }, { id: "b", c: {} }];   // 聊天顺序 c a b
const st = [S("a1", "a", 1), S("a2", "a", 0), S("b1", "b", 1), S("c1", "c", 0), S("m1", "me", 0)];

test("点粉圈：只串有粉圈的人，按聊天顺序，从没看过的那条起", () => {
  const r = mk(chat, chars, st)("a");
  assert.deepStrictEqual(r.list.map(x => x.id), ["a2", "c1"]);
  assert.strictEqual(r.k, 0);
});

test("点灰圈：全部能翻，按聊天顺序，从这个人开始", () => {
  const r = mk(chat, chars, st)("b");
  assert.deepStrictEqual(r.list.map(x => x.id), ["m1", "c1", "a1", "a2", "b1"]);
  assert.strictEqual(r.list[r.k].id, "b1");
});
