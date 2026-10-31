// 旁白模式「我的动作」那一档还在（单聊、群聊）；老的 who: me 旁白照旧认得、喂得对
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const R = f => fs.readFileSync(require.resolve("../js/" + f), "utf8");
const app = R("app.js"), cmp = R("components.js");
test("两边旁白栏都有「我的动作」", () => {
  assert.match(cmp, /\["event", "此刻发生了什么"\], \["act", "我的动作"\], \["dir", "往后的方向"\]\], kind: narrKind/);
  assert.match(cmp, /: \[\["event", "此刻发生了什么"\], \["act", "我的动作"\], \["dir", "往后的方向"\]\];/);
});
test("已经存下的 who: me 旁白还画得出、喂成她的动作", () => {
  assert.match(cmp, /"data-wk": "myact", "data-frame": actFrameStyle\(\)/);
  assert.match(app, /const narrTag = m => m && m\.who === "me" \?/);
});
