const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), core = fs.readFileSync(__dirname + "/../js/fanfic-core.js", "utf8"),
  fic = fs.readFileSync(__dirname + "/../js/fanfic.js", "utf8"), shua = fs.readFileSync(__dirname + "/../js/shua-core.js", "utf8");
test("论坛十个熟面孔在同人文书评区换成读书 id（2026-10-26）", () => {
  const reg = app.slice(app.indexOf("const FORUM_NPC_REGISTRY"), app.indexOf("];", app.indexOf("const FORUM_NPC_REGISTRY")));
  const regulars = reg.match(/id: "npc_regular_[a-z]+"[^\n]*/g);
  assert.equal(regulars.length, 10);
  regulars.forEach(l => assert.match(l, /read: \{ name: "[^"]+", habit: "[^"]+" \}/));
  const names = regulars.map(l => l.match(/read: \{ name: "([^"]+)"/)[1]);
  assert.equal(new Set(names).size, 10);
  assert.doesNotMatch(reg.slice(reg.indexOf("npc_anon_thirdcat")), /read:/);   // 匿名吧那几位不来
  assert.match(app, /ficRegulars: \(\) => \{ const book = forumPublicTies\(\);/);
  assert.match(fic, /onFicImage: props\.onFicImage, ficRegulars: props\.ficRegulars/);
  assert.match(fic, /props\.ficRegulars \? props\.ficRegulars\(\) : null\)/);
  assert.match(core, /async function genReviews\(active, fic, tab, worldbook, characters, userName, regs\)/);
  assert.match(core, /window\.ShuaKit\.regularsBlock\(regs\.list, regs\.pairs \|\| \[\], regs\.me \|\| "她", "看同人文、写书评",/);
  assert.match(shua, /function regularsBlock\(regs, pairs, me, doing, tail\)/);
});
test("regularsBlock 不给 tail 时跟原来一字不差（片刻、一起听不受影响）", () => {
  const i = shua.indexOf("  function regularsBlock"), body = shua.slice(i, shua.indexOf("\n  }\n", i) + 4);
  const rb = new Function(body + "; return regularsBlock;")();
  const regs = [{ id: "a", name: "甲", voice: "v" }];
  assert.match(rb(regs, [], "她"), /写评论时大约三分之一可以是他们/);
  assert.match(rb(regs, [], "她", "看同人文", "\n混进一两位"), /混进一两位$/);
});

test("书评里熟面孔名字后面挂小标，楼主楼中楼都挂", () => {
  assert.match(fic, /const ficRegTag = function \(r\)/);
  assert.match(fic, /r\.isAuthor \? authorTag\(t\) : null, ficRegTag\(r\)\)/);
  assert.match(fic, /penName\(rp, 11\.5\), ficRegTag\(rp\)/);
});
