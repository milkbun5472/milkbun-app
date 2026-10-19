// 群友：线下顶栏「挂点和线上不一样」，照线上写的顶栏代码在线下一条都对不上。单人、群线下顶栏都挂同名挂点。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js/components.js"), "utf8");

test("线下顶栏：离开=chatback，名字=headname，设置=chatmore（单人、群各一处）", () => {
  const n = re => (comp.match(re) || []).length;
  assert.equal(n(/"data-wk": "chatback", onClick: exit/g), 2);
  assert.equal(n(/"data-wk": "headname", onClick: \(\) => setModeOpen\(true\)/g), 2);
  assert.equal(n(/"data-wk": "chatmore", onClick: \(\) => setSetOpen\(true\)/g), 2);
});
