const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
// 群友 2026-10-06：「打视频的时候 char 可以写旁白，user 这里好像没有？能不能加一个，我是文字视频」
test("视频打字框有「动作」键，发出去存成她的 act", () => {
  assert.match(comp, /"data-wk": "callactkey"/);
  assert.match(comp, /onSend\(input\.trim\(\), actMode \? \{ act: true \} : undefined\)/);
  assert.match(app, /\.\.\.\(opts && opts\.act \? \{ act: true \} : \{\}\)/);
});
test("她的动作进模型时带括号，单人群视频都一样", () => {
  assert.match(app, /content: m\.act \? "（" \+ m\.content \+ "）" : m\.content \}\)\);/);
  assert.match(app, /\(m\.act \? "（" \+ m\.content \+ "）" : m\.content\) \}\)\);/);
});
test("画面上她那行动作带「你」", () => {
  assert.match(comp, /\(isU \? "你 " : \(isGroup && m\.senderName/);
});
