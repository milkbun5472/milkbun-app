const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const components = fs.readFileSync(require.resolve("../js/components.js"), "utf8");
const engine = fs.readFileSync(require.resolve("../js/engine.js"), "utf8");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");

test("单人线下代写开关保存并传到生成器", () => {
  const single = components.slice(components.indexOf("function OfflineMode("), components.indexOf("function GroupOfflineMode("));
  assert.match(single, /const \[sDesc, setSDesc\] = useState\(!!os\.describeMe\)/);
  assert.match(single, /让角色描写我的行动/);
  assert.match(single, /describeMe: sDesc/);
  assert.match(app, /narr: osNarr\(charId\)/);
});

test("代写权限在单人线下生成尾部明确重申", () => {
  assert.match(engine, /session\.narr && session\.narr\.describeMe === true/);
  assert.match(engine, /本场叙事权限·已开启/);
  assert.match(engine, /可观察的】动作、神态、即时反应和说出口的话/);
  assert.match(engine, /不替 Ta 宣布重大决定、长期承诺或内心真实想法/);
  assert.match(engine, /本场叙事权限·未开启/);
  assert.match(engine, /const finalNudge = tailNudge/);
});
