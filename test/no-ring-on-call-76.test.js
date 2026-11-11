const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("正打着电话：不响铃；跟别人通着就落占线卡，正文写明占线", () => {
  assert.match(app, /const onCallNow = \(\) => !!\(callRef\.current && !callRef\.current\.endTs\);/);
  assert.match(app, /content: "\[" \+ \(m === "video" \? "视频" : "语音"\) \+ "通话邀请——占线没打通：她那会儿正在跟别人打电话\]"/);
  assert.match(app, /if \(_callWant && onCallNow\(\) && !onCallWith\(charId\)\) pChat\(chatKey, p => \[\.\.\.p, busyCallCard\(_callWant, \{ turnId \}\)\]\);/);
  assert.match(app, /const callMode = !onCallNow\(\) && _callWant;/);
  assert.match(app, /if \(_gcWant && onCallNow\(\) && !onCallWith\(spk\.id\)\) pGChat\(groupId/);
  assert.match(app, /if \(onCallNow\(\)\) \{ drop\(\); if \(!onCallWith\(pm\.charId\)\) \{[^}]*busyCallCard\(pm\.via\)/);
  assert.match(comp, /m\.lineBusy \? \(who \|\| "TA"\) \+ "打过来，你在通话中 · 占线"/);
});
