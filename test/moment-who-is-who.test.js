// 朋友圈评论区两个角色互相叫老婆（群友 2026-10-11）：她给的备注像爱称，模型当成了她。
// 回评论那条路补「谁是谁」；发朋友圈那条路给模型真名、显示时再换回备注。
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("node:fs").readFileSync(require.resolve("../js/app.js"), "utf8");
test("回评论：备注对回真人，点明只有她本人那一个是她", () => {
  assert.match(app, /【评论区里谁是谁】/);
  assert.match(app, /这是她给TA存的备注，不是TA的名字，也不是她/);
  assert.match(app, /\+ whoLines/);
});
test("发朋友圈：名单用真名，评论作者显示时换回备注", () => {
  assert.match(app, /const n = o\.name \|\| o\.remark;/);
  assert.match(app, /\.map\(c => \(\{ \.\.\.c, author: momentWho\(c\.author\) \}\)\)/);
});
