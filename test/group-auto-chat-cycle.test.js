const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const components = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

test("群聊自发额度持久化且到顶后按小时自动刷新", () => {
  assert.match(app, /lisa_group_auto_cycle_v1/);
  assert.match(app, /now >= cycle\.resetAt/);
  assert.match(app, /now \+ resetHours \* 3600000/);
  assert.match(app, /rounds >= roundCap \|\| msgsSoFar >= totalCap/);
});

test("用户新发言和黑色回复键都能立即刷新额度", () => {
  assert.match(app, /last\.role === "user"[\s\S]*resetAutoChatCycle\(gid, last\.ts\)/);
  assert.match(app, /if \(!rgOpts\.auto\) \{[\s\S]*?resetAutoChatCycle\(groupId, _lastUserTs, true\);/);
  assert.match(app, /lastUserTs/);
});

test("群设置可配置 1 至 48 小时刷新周期并保存", () => {
  assert.match(components, /autoChatResetHours/);
  assert.match(components, /"额度刷新周期"/);
  assert.match(components, /setAutoChatResetHours, 1, 48, 1, " 小时"/);
});

test("不必盯着群聊页也能自发，并由既有群消息路径挂未读", () => {
  const autoBlock = app.slice(app.indexOf("// ---- 群聊自发"), app.indexOf("// ---- 群线下 jiwen"));
  assert.doesNotMatch(autoBlock, /screen !== "gthread" \|\| !activeGroup/);
  assert.match(autoBlock, /for \(const group of groups\)/);
  assert.match(autoBlock, /replyGroup\(gid, \{ auto: true/);
  assert.match(app, /if \(added > 0 && !viewing\)[\s\S]*bumpUnread\(id, added\)/);
});

test("app 使用发布版本，组件保留独立缓存指纹", () => {
  const componentVersion = index.match(/components\.js\?v=([^"']+)/);
  const appVersion = index.match(/app\.js\?v=([^"']+)/);
  assert.ok(componentVersion && appVersion);
  const published = app.match(/APP_VERSION\s*=\s*"v([^"]+)"/);
  assert.ok(published);
  assert.equal(appVersion[1], published[1]);
  assert.match(componentVersion[1], /^\d+\.\d+$/);
});
