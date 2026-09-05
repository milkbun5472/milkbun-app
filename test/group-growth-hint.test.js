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

// ⚠️口径改了（v63.63，审计意见 #8）：这两条原来钉的是【群线上那一行里的内联实现】。
//   而那段长文当时在群线上（app.js）和群线下（engine.js）各抄了一份——
//   典型的「一层写在两处」，改一处另一处必然落单；群通话更是第三处群路、一个字都没有。
//   现在提成 engine.js 的 groupGrowthLine 一份、三处共用，所以改成对着那份函数问。
//   ⚠️而且要【真跑一次】：只钉「函数在、三处都调了」的话，把函数体改成永远
//   return "" 也全绿——三处都还在调，那一层却一个字都没发出去。
const vm = require("node:vm");
const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const growthFn = (() => {
  const src = engine.slice(engine.indexOf("function groupGrowthLine(names) {"),
                           engine.indexOf("\n\nconst OFFLINE_NARRATIVE_RUNTIME"));
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src + "\nthis.f = groupGrowthLine;", ctx);
  return ctx.f;
})();

test("只对开了成长的成员，名单为空时一个字都不发", () => {
  assert.equal(growthFn([]), "", "没人开成长就该是空串");
  assert.equal(growthFn(null), "", "名单压根没传也一样");
  assert.match(growthFn(["顾朝", "陆闻"]), /顾朝、陆闻/, "要点名说是谁");
});

test("其余成员照旧贴原卡——别让这条准则漫到全群", () => {
  assert.match(growthFn(["顾朝"]), /其余在场成员照旧严格贴合各自原卡/, "边界那句不能丢");
});
