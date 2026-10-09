// 她 2026-09-29：「搞一个开关在聊天设置可以选择拆不拆？默认开着的相当于啥都不变，有想关的再关」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const engine = R("engine.js"), app = R("app.js"), comps = R("components.js");

const grab = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, "抠不出 " + a); return src.slice(i, j); };
const rule = new Function("ECHO_QUESTION_BAN", grab(engine, "const ONLINE_CHAT_RULE_V2 = `", "\n// 气泡长短交给TA自己")
  + grab(engine, "const ONLINE_ONE_BREATH_LINE", "\n}\n") + "\n}\nreturn { V2: ONLINE_CHAT_RULE_V2, rule: onlineChatRule };")("（回声禁令）");

test("默认（开着）：提示词一个字不变", () => {
  assert.equal(rule.rule(false), rule.V2);
});
test("关掉：「一条＝一句」整行换成「一口气」的判据，不是在后面挂除非", () => {
  const free = rule.rule(true);
  assert.doesNotMatch(free, /一条消息＝一句话/);
  assert.match(free, /【一条装的是一口气发出去的东西】/);
  assert.doesNotMatch(free, /尤其要拆/);
  assert.doesNotMatch(free, /除非/);
});
test("单聊按这个角色的开关走：关掉就不按换行、不按标点切", () => {
  assert.match(app, /const system = _s\.splitBubbles === false && !_body \? freeLengthSystem\(system0\) : system0;/);
  assert.match(app, /const _splitOn = _s\.splitBubbles !== false;/);
  assert.match(app, /const parts = _splitOn \? splitLongBubble\(bi \? bi\.text : w, !_body\) : \[bi \? bi\.text : w\];/);
});
test("聊天设置里有这个开关，默认开着，保存时带上", () => {
  assert.match(comps, /const \[splitBubbles, setSplitBubbles\] = useState\(settings\.splitBubbles !== false\);/);
  assert.match(comps, /dispRow\("长消息自动拆成短句", splitBubbles, setSplitBubbles\)/);
  assert.match(comps, /showRead,\n\s+splitBubbles,/);
});
