// 她 2026-10-05 转群里截图：气泡里出现「【emote：小仓鼠举起两个大拇指】」，还被切成两个气泡
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
const grab = name => { const m = app.match(new RegExp("const " + name + " = (/.+/[a-z]*);")); assert.ok(m, name); return eval(m[1]); };
test("【emote：…】整条认成表情，切成两半的先拼回去", () => {
  const OPEN = grab("WRAP_OPEN"), RE = grab("WRAP_RE");
  assert.equal("【emote：小仓鼠举起两个大拇指】".match(RE)[1], "小仓鼠举起两个大拇指");
  assert.equal("[Emote: 摸头]".match(RE)[1], "摸头");
  assert.equal("【表情包：开心】".match(RE)[1], "开心");
  assert.ok(OPEN.test("【emote：白色小狗一脸自豪"));
  assert.equal(("【emote：白色小狗一脸自豪" + "任由黄色小狗摸头夸夸 】").match(RE)[1], "白色小狗一脸自豪任由黄色小狗摸头夸夸");
  assert.ok(!RE.test("这就发"), "普通话被吃了");
  assert.match(app, /if \(mWrap && mWrap\[1\]\.trim\(\)\) \{ emoteWordKws\.push\(mWrap\[1\]\.trim\(\)\); return false; \}/);
});
