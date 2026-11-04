// 论坛网友提到女角色写成「他」（她 2026-11-04 转群友）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("论坛网友那份上下文照档案性别标代词", () => {
  const i = app.indexOf("  const forumPronounLine"), j = app.indexOf("  const forumWorldCtx", i);
  const f = new Function("characters", "window", app.slice(i, j) + "return forumPronounLine;")(
    [{ name: "阿芙", gender: "她" }, { name: "陆衍", gender: "他" }, { name: "配角", npc: true }], { CharacterPronoun: { ta: c => c.gender } });
  const line = f();
  assert.match(line, /阿芙（女，用「她」）/); assert.match(line, /陆衍（男，用「他」）/); assert.ok(!/配角/.test(line));
  assert.match(app, /forumLoreLine\(world === undefined \? forumCurWorld\(\) : world\) \+ forumPronounLine\(\) \}/);
});
