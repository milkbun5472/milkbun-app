// 钉的约会地点只在手绘那张：切在现实/架空时底下列一行、点了切回去（她 2026-10-16 转群友）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", f), "utf8");
test("现实、架空两张图底下都挂 pinsNote；聊天那句写明去哪看", () => {
  const d = R("js/dwell.js");
  assert.ok(/const pinsNote = dates\.length && mapKind !== "draw"/.test(d));
  assert.equal((d.match(/\), pinsNote\);/g) || []).length, 2);
  assert.ok(/在你们的城市地图上钉了「" \+ nm \+ "」" \+ \(nt \? "：" \+ nt : ""\) \+ "（去处 → 选 TA →「我们的城市 · 手绘」里看）"/.test(R("js/app.js")));
});
