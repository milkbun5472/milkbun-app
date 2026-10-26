const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("查手机微信：他自己的配角没连关系线也算熟人（群友 2026-10-26）", () => {
  const i = app.indexOf("const relatedNames = char =>");
  const src = app.slice(i, app.indexOf("return [...set];", i) + 20);
  const fn = new Function("characters", "rels", src + ";return relatedNames;");
  const cs = [{ id: "a", name: "陆" }, { id: "n", name: "小周", npc: true, ownerId: "a" }, { id: "b", name: "沈" }, { id: "m", name: "别人的", npc: true, ownerId: "b" }];
  const got = fn(cs, { "a->b": {} })(cs[0]);
  assert.deepEqual(got, ["小周", "沈"]);
});

test("只在群里一起的配角／关系网的人不进避重名单，私聊不再被整条丢掉（群友 2026-10-26）", () => {
  const i = app.indexOf("const phoneTakenNames = char =>");
  const body = app.slice(i, app.indexOf("const phoneWechatDigest", i));
  assert.match(body, /const _relKeep = \(characters \|\| \[\]\)\.filter\(o => o && o\.id !== char\.id && \(\(o\.npc && o\.ownerId === char\.id\) \|\| rels\[/);
  assert.ok(body.includes('(c.type === "group" ? (c.memberNames || []).filter(n => !_relKeep.some'), "群成员没按关系放行");
});
