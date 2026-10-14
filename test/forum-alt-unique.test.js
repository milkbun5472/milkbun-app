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

test("小号主页能换网名：查重、旧帖旧楼一起改署名、也能让它起一个", () => {
  const scr = require("fs").readFileSync(__dirname + "/../js/screens.js", "utf8");
  const fnR = cut("  const renameCharAlt = (charId, name, handle) => {", "\n  };\n");
  assert.match(fnR, /已经有人在用了/);
  assert.match(fnR, /x_forumCharMeta/);
  assert.match(fnR, /mine\(x\) \? \{ \.\.\.x, authorName: nm, authorHandle: hd \}/, "帖子署名和 @id 没跟着改");
  assert.match(fnR, /altName: nm, altHandle: hd/, "资料里的 @id 没改");
  assert.match(fnR, /mine\(r\) \? \{ \.\.\.r, authorName: nm, authorHandle: hd \}/, "楼中楼署名没跟着改");
  assert.match(app, /onRenameCharAlt: renameCharAlt, onRegenCharAlt: regenCharAlt,/);
  assert.match(scr, /"data-wk":"forumaltrename"/);
  assert.match(scr, /onRenameCharAlt\(owner\.id,altEdit\.name,altEdit\.handle\)/);
});

test("小号网名和 id 照这个人起：两处共用一条规矩，「让它起一个」读整份人设", () => {
  assert.match(app, /const FORUM_ALT_NAME_RULE = /);
  assert.equal((app.match(/FORUM_ALT_NAME_RULE/g) || []).length, 3, "首次配资料和让它起一个，两处都得用这一条");
  const fnG = cut("  const regenCharAlt = async charId => {", "\n  };\n");
  assert.match(fnG, /runProbe\(apiFor\(c\.id\), ctxFor\(c\),/);
});
