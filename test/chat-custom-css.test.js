// 每个聊天自己写 CSS，可导出导入（她 2026-09-30）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), comp = R("js/components.js");
test("限到这个人这一页、压在最上面", () => {
  assert.match(app, /const charCustomCSS = \(css, scope\) =>/);
  assert.match(app, /window\.ThemeStudio\.resolveCSSImages\(window\.ThemeStudio\.scopeCSS\(css, scope\)\)/);
  assert.match(app, /customCSS: charCustomCSS\(s\.customCSS, scope\)/);
  const i = comp.indexOf('put("wk-chat-bg-css"'), j = comp.indexOf('put("wk-char-custom-css"');
  assert.ok(i > 0 && j > i, "自己写的那层要排在背景图后面（最上面）");
});
test("设置里能写、能导出导入，存档接住且挡掉不安全的", () => {
  assert.match(comp, /"只给 TA 写 CSS"/);
  assert.match(comp, /saveTextFile\(who \+ "-聊天\.css", customCSS, "text\/css"\)/);
  assert.match(comp, /accept: "\.css,\.txt,text\/css,text\/plain"/);
  assert.match(app, /customCSS: \(window\.ThemeStudio && s\.customCSS && !window\.ThemeStudio\.unsafeReason\(s\.customCSS\)\)/);
});
