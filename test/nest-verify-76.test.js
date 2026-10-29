// 进群验证（她 2026-10-28：「上传支付宝年龄截图，过 18 给 Q 群链接；用她们自己的 API 读图，正好验证会不会接 API」）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
const nest = fs.readFileSync(path.join(__dirname, "../js/nest.js"), "utf8");
const i = nest.indexOf("function VerifyPanel("), j = nest.indexOf("function Login(", i);
const V = nest.slice(i, j);
test("记录只在管理中看得到，入口挂在管理那一行", () => {
  assert.ok(i > 0 && j > i, "抠不出 VerifyPanel");
  assert.match(nest, /onVerify: \(\) => push\(\{ v: "verify" \}\)/);
  assert.match(nest, /if \(top && top\.v === "verify"\) return h\(VerifyPanel,/);
  for (const p of ['"/verify/log?off="', '"/verify/conf"', '"/verify/shot?id="', '"/verify/drop"']) assert.ok(V.includes(p), "少了 " + p);
});
test("留底那张：点开才取、能单张删、能一键清空，删之前都问一句", () => {
  assert.match(V, /const openShot = async id =>/, "没有「点开才取」那一步");
  assert.doesNotMatch(V, /d\.rows[^\n]*\.data/, "名单不该把图一起发下来");
  assert.match(V, /requestAppConfirm\(all \? "清空留底" : "删掉这一张"/);
  assert.match(V, /body: all \? \{ all: true \} : \{ id \}/);
});
test("说清楚了这儿看不到是谁，以及开关关了会怎样", () => {
  assert.ok(V.includes("手写那张和她们的密钥都不到这儿来。留底那张只有你看得到，"));
  assert.ok(V.includes("谁来都只看到「去群里找群主」"));
  assert.ok(V.includes("还没设群号：验过了也拿不到"));
});
