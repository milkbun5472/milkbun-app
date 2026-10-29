// 导进手机之前先给老师点个心（她 2026-10-29：「确实不喜欢为什么要导入呢」）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
const nest = fs.readFileSync(path.join(__dirname, "../js/nest.js"), "utf8");
const D = nest.slice(nest.indexOf("function Detail("), nest.indexOf("function Shots("));
test("没点过心的那颗键先问一句，点过的照旧一下导入", () => {
  assert.match(D, /const importWithHeart = \(\) => \{\n\s*if \(it\.liked\) \{ doImport\(\); return; \}/);
  assert.match(D, /requestAppConfirm\("先给老师点个心"/);
  assert.match(D, /await toggle\("like"\); doImport\(\);/);
  assert.match(D, /onClick: importWithHeart, wk: "nestimport" \}, busy \? "……" : it\.liked \? "导进我的手机" : "点个心并导入"/);
});
test("点心不用登录（收藏照旧要账号）", () => {
  assert.match(D, /if \(!me && which !== "like"\) \{ onLogin\(\); return; \}/);
});
test("心点不成也别把人挡在外面：导入照跑", () => {
  // toggle 自己会 catch 并提示；这儿不许因为点心失败就 return，不然服务器一抖她就拿不到文件
  const seg = D.slice(D.indexOf("const importWithHeart"), D.indexOf("const doFollow"));
  assert.ok(seg.indexOf("if (!ok) return") < 0 && seg.indexOf("catch") < 0, "点心失败被拿来挡导入了");
});
