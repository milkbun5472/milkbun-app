// 群里一个模型同时写所有人：每个成员的行程、动作、心声都得标成「只有本人知道」
// （她 2026-10-02 修罗场截图：互不认识的人张口就是「某人刚还在实验室对着报错」）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
const i = app.indexOf("  const groupNowSegs = (c, opts) => {"), j = app.indexOf("  const memberPrivLines = (", i);
assert.ok(i > 0 && j > i, "抠不出 groupNowSegs");
const seg = app.slice(i, j);

test("行程那一格有围栏", () => {
  assert.match(seg, /〔此刻在做什么 · 只有 " \+ c\.name \+ " 本人知道/);
});

test("动作／心声／穿着那一格有围栏", () => {
  assert.match(seg, /live: privateTo\(c, liveStateContext\(st,/);
  assert.match(seg, /const privateTo = \(who, seg\) => seg \? "\\n〔以下只有 " \+ who\.name \+ " 本人知道，别的成员看不见〕" \+ seg : "";/);
});

// v74.441：修罗场只公开【跟用户的关系】那一段；共用一句「只有本人知道」的话，行程和心声会跟着一起被公开
test("关系那一段的标签跟行程/状态的围栏分开，修罗场只点名关系那段", () => {
  assert.match(seg, /"\\n〔以下是 " \+ c\.name \+ " 跟用户的关系 · 只有 " \+ c\.name \+ " 本人知道，别的成员并不知情〕" \+ l/);
  const d = app.slice(app.indexOf("  const groupDramaRule = gid =>"), app.indexOf("  const saveGroupSettings = ("));
  assert.match(d, /上面那些标着〔以下是某某跟用户的关系〕的段落/);
  assert.match(d, /各人的行程、此刻在干嘛、心声，照旧只有本人知道/);
});
