// 转账卡之外又把「【附言：…】转账给 X N 元」念一遍、还被拆成几泡（2026-10-30 截图）
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
const f = new Function(s.slice(s.indexOf("  const ECHO_NOTE_HINT"), s.indexOf("  // 按角色选 API 线路")) + ";return dropEchoedNotes;")();
test("拆成几泡的转账播报整段摘掉", () => {
  assert.deepEqual(f(["【附言：把网页关了！", "不准再翻！", "全部删掉！！", "】转账给 Lisa 30000 元"]), []);
  assert.deepEqual(f(["好", "【附言：别看了】转账给 Lisa 30000 元", "哼"]), ["好", "哼"]);
});
test("TA自己说的话不动", () => {
  assert.deepEqual(f(["【嗯", "这是我想说的】", "你好"]), ["【嗯", "这是我想说的】", "你好"]);
  assert.deepEqual(f(["给你转了三万你不收？"]), ["给你转了三万你不收？"]);
});
