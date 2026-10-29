// 进群验证（她 2026-10-28：「上传支付宝年龄截图，过 18 给 Q 群链接；用她们自己的 API 读图，正好验证会不会接 API」）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
const nest = fs.readFileSync(path.join(__dirname, "../js/nest.js"), "utf8");
const i = nest.indexOf("function VerifyPanel("), j = nest.indexOf("function Login(", i);
const V = nest.slice(i, j);
test("记录只在管理中看得到，入口挂在管理那一行", () => {
  assert.ok(i > 0 && j > i, "抠不出 VerifyPanel");
  assert.match(nest, /onVerify: \(\) => push\(\{ v: "verify" \}\)/);
  assert.match(nest, /if \(top && top\.v === "verify"\) return h\(VerifyPanel,/);
  for (const p of ['"/verify/log?off="', '"/verify/conf"']) assert.ok(V.includes(p), "少了 " + p);
});
test("说清楚了这儿看不到是谁，以及开关关了会怎样", () => {
  assert.ok(V.includes("截图和她们的密钥都不到这儿来，所以这儿看不到是谁。"));
  assert.ok(V.includes("谁来都只看到「去群里找群主」"));
  assert.ok(V.includes("还没设群链接：验过了也拿不到"));
});
