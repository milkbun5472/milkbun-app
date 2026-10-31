const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), ts = fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8");
test("发朋友圈能提醒谁看，提醒的人一定看得见", () => {
  assert.match(comp, /"提醒谁看"/);
  assert.match(comp, /visibleTo: vis === "pick" \? \[\.\.\.new Set\(\[\.\.\.sel, \.\.\.remind\]\)\] : null/);
  assert.match(app, /remind: Array\.isArray\(remind\) && remind\.length/);
  assert.match(app, /const momSeen = \(m, charId\) => !!m && !!m\.mine && !\(\(window\.__peekCut \|\| \{\}\)\[charId\]\) && !\(m\.hiddenFrom \|\| \[\]\)\.includes\(String\(charId\)\) && \(\(m\.remind \|\| \[\]\)\.includes\(charId\) \|\| \(m\.visibleTo/);  // 被删好友／拉黑的人刷不到（2026-10-22）；v88.812 起「不给谁看」的人也刷不到
});
test("提醒了的人：反应那一枪知道、聊天里也记得", () => {
  assert.match(app, /remindAsk/);
  assert.match(app, /她发的时候特意提醒了你看/);
});
test("「提醒了谁看」一行在动态流和个人页都挂，主题工作台登记了", () => {
  assert.equal((comp.match(/h\(MomentRemindLine, \{ m, characters \}\)/g) || []).length, 2);
  assert.match(ts, /\["moremind",/); assert.match(ts, /\["moremindline",/);
});
