// 旧地址到点关门（她 2026-10-28）：只留云同步和导入导出；只认公共版挂的 window.QQ_MOVE，家里那版走不进来
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "../js", f), "utf8");
const ui = rd("screens-ui.js"), app = rd("app.js");
test("搬家页只留云同步和导入与导出，用的就是「设置 → 数据」那两格本身", () => {
  // ⚠️MoveShell 必须在 DataConfig 后面：公共版有一刀从 HomeLayoutProbe 切到 DataConfig，夹在中间就被切没了
  const i = ui.indexOf("function MoveShell("), j = ui.indexOf("window.MoveShell = MoveShell;", i);
  assert.ok(ui.indexOf("function DataConfig(") < i, "MoveShell 跑到 DataConfig 前面去了");
  assert.ok(i > 0 && j > i, "抠不出 MoveShell");
  assert.match(ui.slice(i, j), /h\(DataConfig, Object\.assign\(\{\}, dataProps, \{ only: \["cloud", "backup"\] \}\)\)/);
  assert.match(ui, /window\.MoveShell = MoveShell;/, "懒加载那组要把它挂到 window 上，不然公共版压缩后找不到");
  assert.match(ui, /\]\.filter\(x => !only \|\| only\.indexOf\(x\.id\) >= 0\);/);
});
test("只有公共版旧地址、过了点才换整页；家里那版没有 QQ_MOVE", () => {
  assert.match(app, /if \(_mv && _mv\.host === location\.hostname && Date\.now\(\) >= _mv\.at\) \{\n\s*body = h\(LazyGate, \{ key: "lazy-move", group: "screens",[^\n]*render: \(\) => h\(window\.MoveShell,/);
  assert.doesNotMatch(app, /QQ_MOVE\s*=/, "家里那份不许自己挂 QQ_MOVE");
});
// ⚠️她 2026-11-05 当场抓到：旧站的搬家页上明晃晃印着新门牌，还留着一颗按钮直接跳过去。
//   换地址图的就是别人找不到，旧门上贴新门牌＝白搬。搬家页只准说「去群公告看」。
test("搬家页既不写新地址、也不留跳过去的那颗键", () => {
  const i = ui.indexOf("function MoveShell("), j = ui.indexOf("window.MoveShell = MoveShell;", i);
  const body = ui.slice(i, j);
  assert.doesNotMatch(body, /href|location\.href|window\.open|去新家/, "搬家页不许有任何跳转或「去新家」的键");
  assert.match(body, /群公告/, "得告诉她们去群公告里找");
  assert.doesNotMatch(ui, /autumn-drawer/, "公共版新地址一个字都不许写进 js");
  assert.doesNotMatch(app, /autumn-drawer/, "公共版新地址一个字都不许写进 js");
});
