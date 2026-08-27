const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// v55.95 那个形状：常量声明了、读起来像已经在发了，实际【从没被引用过】。
// 这一条是 v50.80 加的「线上群聊里开启成长的成员不冻在原卡里」，一直只有声明。
test("成长准则真的拼进了群聊 system，不是只声明一次就没人管", () => {
  const decl = (app.match(/const gGrowthHint =/g) || []).length;
  const used = (app.match(/\+ gGrowthHint/g) || []).length;
  assert.equal(decl, 1, "只该有一处声明");
  assert.ok(used >= 1, "声明了却没人引用——就是 v55.95 那个形状");
});

test("挨着成员名单发：这条准则点名说的就是名单里那几个人", () => {
  assert.match(app, /\+ memberDesc \+ gGrowthHint \+/, "得紧跟在【成员】那一段后面，别飘到别处");
});

test("只对开了成长的成员，名单为空时一个字都不发", () => {
  const i = app.indexOf("const gGrowthHint =");
  const seg = app.slice(i, i + 260);
  assert.match(seg, /gEvolveNames\.length \?/, "没人开成长就该是空串");
  assert.match(seg, /gEvolveNames\.join/, "要点名说是谁");
});

test("其余成员照旧贴原卡——别让这条准则漫到全群", () => {
  const i = app.indexOf("const gGrowthHint =");
  const seg = app.slice(i, app.indexOf("\n", i));
  assert.match(seg, /其余在场成员照旧严格贴合各自原卡/, "边界那句不能丢");
});
