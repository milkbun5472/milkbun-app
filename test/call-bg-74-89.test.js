// 她 2026-10-05：「搞个聊天设置里可以改通话背景的吧」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
test("聊天设置能选通话背景，存回这个人；单人通话铺在底下，群通话不吃", () => {
  assert.match(comp, /const \[callBg, setCallBg\] = useState\(settings\.callBg \|\| ""\);/);
  assert.match(comp, /show\("dress", \{ title: "背景 · 聊天和通话"/);
  assert.match(comp, /describeMe,\n\s+chatBg,\n\s+callBg,/, "没随聊天设置一起存");
  assert.match(app, /callBg: s\.callBg \|\| "",/, "存的时候被白名单丢掉了");
  assert.match(app, /fixedBg: \(!call\.groupId && call\.participants && call\.participants\.length === 1\) \? \(settingsFor\(call\.participants\[0\]\.id\)\.callBg \|\| ""\) : "",/);
  assert.match(comp, /background: fixedBg \? CALL_BG_SHADE \+ ", center\/cover no-repeat url/);
});
