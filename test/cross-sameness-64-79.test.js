const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const engine = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
test("B版移除跨角色气泡、心声与帮助比较的扫描和注入", () => {
  assert.doesNotMatch(app, /crossSameness|crossOfferHint|crossThoughtBlocklist|CROSS_SAMENESS|OFFER_MOVE/);
});
test("共享规则允许普通回应，不要求逐句独特", () => {
  assert.match(engine, /普通的附和、短答和常见表达可以自然出现/);
  assert.doesNotMatch(engine, /原样发给她手机里|你用的必须是只有你会用|只有你会用的那种教法/);
});
test("实际V2任务保留动态层，生成任务串不读取其他聊天", () => {
  const start = app.indexOf("const _normalTaskV2 = (");
  const task = app.slice(start, app.indexOf("const _roomHint", start));
  const names = ["_stateBootstrapHint", "_wearRefreshHint", "paceHint", "callHint", "proactiveHintAll", "dongnianHint", "gapHint", "crossChannelHint", "_saidElsewhereHint", "eAfterglowHint", "desireHint", "_recallHint", "capabilityHint", "_normalThoughtTurnHint", "MOOD_TURN_RULE", "_biTurnLine", "_turnClosing", "_gazeNudgeHint"];
  const forbidden = new Proxy({}, { get() { throw new Error("不该扫描其他聊天"); }, ownKeys() { throw new Error("不该扫描其他聊天"); } });
  const render = new Function("char", "uName", "chatsRef", "stateHistRef", ...names, task + "return _normalTaskV2;");
  const result = render({name: "测试角色"}, "测试用户", forbidden, forbidden, ...names.map(n => "<" + n + ">"));
  assert.ok(result.includes("测试角色"));
  for (const n of names) assert.ok(result.includes("<" + n + ">"), n + " 丢失");
  assert.ok(result.endsWith("<_turnClosing><_gazeNudgeHint>"));
});
