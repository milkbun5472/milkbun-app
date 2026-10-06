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

// 群友 2026-10-06：「发完动作不会直接回复吧？发完还想多说几句；不想说再按一次发送也要能直接发出去」
test("动作只落下不请TA开口；空着按发送＝flush 让TA接", () => {
  assert.match(app, /if \(um\.act\) return;/);
  assert.match(app, /if \(!opening && !flush && \(!text \|\| !text\.trim\(\)\)\) return;/);
  assert.match(comp, /if \(actPending\) \{ stopCallAudio\(\); recResume\(\); followCallTail\.current = true; onSend\("", \{ flush: true \}\); \}/);
  assert.match(comp, /disabled: sending \|\| \(!input\.trim\(\) && !actPending\)/);
});
