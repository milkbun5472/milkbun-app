const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const components = fs.readFileSync(require.resolve("../js/components.js"), "utf8");
const engine = fs.readFileSync(require.resolve("../js/engine.js"), "utf8");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");

test("群线下设置提供代写用户动作开关并持久化", () => {
  const groupUi = components.slice(components.indexOf("function GroupOfflineMode"));
  assert.match(groupUi, /const \[sDesc, setSDesc\] = useState\(!!os\.describeMe\)/);
  assert.match(groupUi, /让角色描写我的行动/);
  assert.match(groupUi, /describeMe: sDesc/);
  assert.match(app, /narr: osNarr\("g_" \+ group\.id\)/);
});

test("开关关闭也是明确禁令，不再被 narrativeDirective 当成未设置", () => {
  assert.match(engine, /hasOwnProperty\.call\(s, "describeMe"\)/);
  assert.match(engine, /只描写你自己的言行和心理，不要替对方决定动作或台词/);
});
