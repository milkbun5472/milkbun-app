// 世界线（她 2026-10-01）：不同世界的角色不在同一个帖子里碰面
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const src = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const s = src("screens.js"), a = src("app.js");

function loadStore() {
  const mem = {};
  const localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  const code = s.slice(s.indexOf("const CHAR_WORLDS_KEY"), s.indexOf("const FORUM_BOARDS"));
  return new Function("localStorage", code + "; return { charWorldsLoad, charWorldsSave, charWorldOf };")(localStorage);
}

test("世界分组单独存一份，默认所有人在同一个世界；拆掉的世界自动回到默认", () => {
  const W = loadStore();
  assert.strictEqual(W.charWorldOf("a"), "");
  W.charWorldsSave({ worlds: [{ id: "w1", name: "周周那条线" }], of: { a: "w1", b: "w_gone" } });
  assert.strictEqual(W.charWorldOf("a"), "w1");
  assert.strictEqual(W.charWorldOf("b"), "", "指向已拆世界的人回到同一个世界");
});

test("论坛：帖子里能开口的角色、认得出的角色、关系行都按世界过滤", () => {
  assert.match(a, /const forumThreadWorld = post =>/);
  assert.match(a, /const forumInWorld = \(c, post\) =>/);
  assert.match(a, /const poolChars = forumActiveChars\(\)\.filter\(c => \(!opChar \|\| c\.id !== opChar\.id\) && forumInWorld\(c, post\)\);/);
  const n = (a.match(/c\.name === (x|r)\.char && forumInWorld\(c, post\)/g) || []).length;
  assert.ok(n >= 4, "模型写了别的世界的角色名也不许落成那个角色（现在 " + n + " 处）");
  assert.match(a, /forumCharList\(post\)/);
});

test("界面在论坛设置里", () => {
  assert.match(s, /h\(ForumWorlds, \{ characters: characters \}\)/);
  assert.match(s, /"＋ 新开一个世界"/);
});

test("论坛按世界分：帖子记 world、视图只显示当前世界、世界观压进网友设定", () => {
  const W = (() => {
    const mem = {};
    const localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
    const code = s.slice(s.indexOf("const CHAR_WORLDS_KEY"), s.indexOf("const FORUM_BOARDS"));
    return new Function("localStorage", "window", code + "; return { charWorldsSave, forumCurWorld, forumSetWorld, forumPostWorld, charWorldLore };")(localStorage, { dispatchEvent() {} });
  })();
  W.charWorldsSave({ worlds: [{ id: "g", name: "古风", lore: "大梁朝" }], of: { zhou: "g" } });
  assert.strictEqual(W.forumCurWorld(), "");
  W.forumSetWorld("g");
  assert.strictEqual(W.forumCurWorld(), "g");
  assert.strictEqual(W.forumPostWorld({ world: "g" }), "g");
  assert.strictEqual(W.forumPostWorld({ authorType: "npc" }), "", "老的路人帖算默认世界");
  assert.strictEqual(W.forumPostWorld({ authorType: "character", authorId: "zhou" }), "g", "老的角色帖算TA那个世界");
  assert.strictEqual(W.charWorldLore("g"), "大梁朝");
  assert.match(a, /const _w = forumCurWorld\(\);/);
  assert.match(a, /world: charWorldOf\(char\.id\),/);
  assert.match(a, /persona: "你在推演这个世界里形形色色的普通网友，不是某个特定角色，风格各异。" \+ forumLoreLine\(/);
  assert.match(s, /filter\(p => forumPostWorld\(p, d\) === cur\)/);
});
