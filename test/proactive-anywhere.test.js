const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const components = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");

test("单聊主动不再依赖正在打开该聊天，也不会保留重复 thread 定时器", () => {
  const unified = app.slice(app.indexOf("单聊主动统一走下面的全局巡检"), app.indexOf("// ---- 群聊自发"));
  assert.doesNotMatch(unified, /setInterval/);
  assert.match(app, /主动发消息·主屏也能收到/);
  assert.match(app, /if \(added > 0 && !viewing\)[\s\S]*bumpUnread\(id, added\)/);
  assert.match(components, /不必打开这个聊天/);
});

test("群聊可认领动念 contact，点名动念角色并阻止旧快照再触发私聊", () => {
  assert.match(app, /urgeCharIds: urgeChars\.map\(c => c\.id\)/);
  assert.match(app, /dongnianFiredRef\.current\[c\.id\] = now/);
  assert.match(app, /setTimeout\(scanAutoGroups, 11000\)/);
  assert.match(app, /setTimeout\(tick, 14000\)/);
  assert.match(app, /这轮自然动念/);
  assert.match(app, /由 TA 自然先开口/);
  assert.match(app, /Date\.now\(\) - \(dongnianFiredRef\.current\[cid\] \|\| 0\) < 25 \* 60000/);
});
