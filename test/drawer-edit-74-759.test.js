// 情侣空间抽屉里拆开的那一样能改字（她 2026-10-05：「悄悄话能不能修改」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = R("js/app.js"), scr = R("js/screens.js");
test("写的那一头：只换这一条，悄悄话顺手清掉旧 title，落盘同一个键", () => {
  const i = app.indexOf("const editDrawerItem = (id, text) =>"), j = app.indexOf("const cSnip =", i);
  assert.ok(i > 0 && j > i);
  const b = app.slice(i, j);
  assert.match(b, /x\.id === id \? \{ \.\.\.x, text: v, edited: Date\.now\(\), \.\.\.\(x\.kind === "whisper" \? \{ title: "" \} : \{\}\) \} : x/);
  assert.match(b, /saveJSON\("x_coupleDrawer", n\)/);
  assert.match(app, /onEditDrawer: editDrawerItem,/);
});
test("界面那一头：拆开的纸底下一颗「改一改」，封着的不给改", () => {
  assert.match(scr, /onOpen: onOpenDrawer, onDrop: onDropDrawer, onEdit: onEditDrawer,/);
  assert.match(scr, /requestAppPrompt\("改这一张", "改完就照新的留着。", x\.text \|\| "",/);
  const i = scr.indexOf("if (sealed) {"), j = scr.indexOf("// 拆开的：摊平的那张纸", i);
  assert.ok(i > 0 && j > i);
  assert.doesNotMatch(scr.slice(i, j), /改一改/);
});
