const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js/components.js"), "utf8");

// 她 2026-08-22：「我设了文风想修改编辑不了」。
// 自定义文风以前只有「删除此预设」，没有编辑——她那份有四千字，删一次就得整份重贴。

test("四个入口都有「编辑此预设」（单人/群 × 开局页/设置页）", () => {
  assert.equal((comp.match(/编辑此预设/g) || []).length, 4);
  assert.equal((comp.match(/删除此预设/g) || []).length, 4, "删除也还在，一个都没丢");
  assert.equal((comp.match(/const editCustomStyle = key =>/g) || []).length, 2, "两个组件各一份");
});

test("编辑＝把原内容装回输入框，不是新建一条", () => {
  assert.match(comp, /setCName2\(cur\.name \|\| ""\);\n    setCPrompt\(cur\.prompt \|\| ""\);\n    setEditingStyleKey\(key\);/);
  assert.match(comp, /删一次就得重来一遍/, "为什么加这个，写在代码里");
});

test("保存时按 key 原地覆盖，正在用的那局不用重选", () => {
  assert.match(comp, /const key = editingStyleKey \|\| \("custom_" \+ Date\.now\(\)\);/);
  assert.match(comp, /\? customStyles\.map\(x => x\.key === editingStyleKey \? \{ \.\.\.x, name: nm, prompt: pr \} : x\)/);
  assert.match(comp, /: \[\.\.\.customStyles, \{ key, name: nm, prompt: pr, custom: true \}\]/, "非编辑态仍是新建");
  // 存完要清掉编辑态，否则下一次新建会误覆盖
  assert.match(comp, /setEditingStyleKey\(""\);\n    setCName2\(""\);/);
});

test("编辑态要看得见，并且能取消", () => {
  assert.equal((comp.match(/保存后原地覆盖/g) || []).length, 4);
  assert.match(comp, /正在改「" \+ \(\(customStyles\.find\(x => x\.key === editingStyleKey\) \|\| \{\}\)\.name \|\| ""\) \+ "」/);
  assert.match(comp, /setEditingStyleKey\(""\); setCName2\(""\); setCPrompt\(""\); \}, className: "active:opacity-60"[^}]*\} \}, "取消"\)/);
});

test("删除改成要确认——四千字删错一次就没了", () => {
  assert.equal((comp.match(/内容不会留档。"\)\) delCustomStyle/g) || []).length, 4);
});
