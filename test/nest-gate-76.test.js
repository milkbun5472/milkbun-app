// 新地址的门（她 2026-10-28：「设一个口令，每台设备输入了就生成自己专属码」）：小窝管理页这头
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
const nest = fs.readFileSync(path.join(__dirname, "../js/nest.js"), "utf8");
const i = nest.indexOf("function GatePanel("), j = nest.indexOf("function Login(", i);
const G = nest.slice(i, j);
test("门的名单只在管理中露面：入口挂在管理那一行，页面走管理口令那几条路", () => {
  assert.ok(i > 0 && j > i, "抠不出 GatePanel");
  assert.match(nest, /adminToken\(\) \? h\(WatchLine, \{ t, onGate: \(\) => push\(\{ v: "gate" \}\) \}\) : null,/);
  assert.match(nest, /if \(top && top\.v === "gate"\) return h\(GatePanel,/);
  for (const p of ['"/gate/list?q="', '"/gate/conf"', '"/gate/device"']) assert.ok(G.includes(p), "少了 " + p);
});
test("停用是一台一台的；同名还有别的设备，再问一句要不要一起停", () => {
  assert.match(G, /await setSt\(\[r\.id\], "off"\);/);
  assert.match(G, /if \(rest\.length\) requestAppConfirm\(/);
});
test("口令和审核说清楚了什么时候生效、会不会出乎意料", () => {
  assert.ok(G.includes("已经进来的设备照常能用"));
  assert.ok(G.includes("新设备填完要你点「通过」"));
  assert.ok(G.includes("还没设口令：现在谁都进不来"));
});
