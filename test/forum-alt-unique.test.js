// 群友 2026-10-14：「几个角色混在一起了，在角色 a 底下评论，结果角色 b 变成了楼主评论」——小号网名撞了
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
const cut = (a, b) => { const i = app.indexOf(a); return app.slice(i, app.indexOf(b, i)); };
const names = cut("  const FORUM_ALT_NAMES = [", "];") + "];";
const fn = cut("  const forumAltNameOf = cid => {", "\n  };\n") + "\n  };";
const make = (chars, meta) => new Function("characters", "forumCharMetaRef", "forumHash",
  names + "\n" + fn + "\nreturn forumAltNameOf;")(chars, { current: meta }, s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; });

test("没存过网名的一群人：各拿一个，互不相同", () => {
  const chars = Array.from({ length: 30 }, (_, i) => ({ id: "c" + i }));
  const f = make(chars, {});
  const got = chars.map(c => f(c.id));
  assert.equal(new Set(got).size, got.length);
});

test("存过的网名撞了：排前面的留着，后面那个换一个；没撞的原样", () => {
  const chars = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const f = make(chars, { a: { altName: "凌晨便利店" }, b: { altName: "凌晨便利店" }, c: { altName: "自己起的名" } });
  assert.equal(f("a"), "凌晨便利店");
  assert.notEqual(f("b"), "凌晨便利店");
  assert.equal(f("c"), "自己起的名");
});

test("资料卡读的就是这一份；新生成的网名撞了别人的不收", () => {
  assert.match(app, /const altName = forumAltNameOf\(c\.id\);/);
  assert.match(app, /\(d\.altName && !\(characters \|\| \[\]\)\.some\(o => o\.id !== c\.id && charForumMeta\(o\)\.altName === String\(d\.altName\)\.trim\(\)\) \? d\.altName : ""\)/);
});
