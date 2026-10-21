// 动描那一行的落点（她 2026-10-21：「害羞所有人都是死死攥着手机盯着屏幕」）——跟心声 THOUGHT_VOICE 同一个做法
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), eng = R("engine.js");
test("ACT_VOICE 只说事实，接在单聊、群聊线上，同处一室时不接", () => {
  assert.match(eng, /const ACT_VOICE = "你们是隔着手机在聊/);
  assert.match(app, /action: string，每轮回复完成后\$\{ACT_MEANING\}。\$\{typeof ACT_VOICE === "string" && !\(sameRoomFor\(charId\) && !offlineTogetherNow\(charId\)\) \? ACT_VOICE : ""\}/);
  assert.match(app, /const G_ACTION_SPEC = ACT_MEANING \+ [^\n]*!gSameRoomFor\(groupId\) \? ACT_VOICE/);
});
