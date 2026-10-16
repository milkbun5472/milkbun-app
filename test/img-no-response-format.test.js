// 群里 2026-10-16：出图报 Unknown parameter: 'response_format' —— 去掉它再发一次，按站记住
const test = require("node:test");
const assert = require("node:assert/strict");
const e = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
test("response_format 被打回：去掉重发一次，按站记住，出图接口和编辑接口都管", () => {
  assert.ok(e.includes("unknown parameter[^\\n]{0,20}response_format"), "认不出那句报错");
  assert.match(e, /saveJSON\("x_imgNoRespFmt", m\)/);
  assert.match(e, /if \(!noRf\) fd\.append\("response_format", "b64_json"\)/);
  assert.match(e, /if \(!rfOff && await rfRejected\(r\)\) r = await sendEdits\(true\);/);
  assert.match(e, /delete body\.response_format; r = await sendGen\(\);/);
});
