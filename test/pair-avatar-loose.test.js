// 她 2026-11-02「必须要说情头才会换吗」：说法放宽；她不开口就不当情头。
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8");
const re = new RegExp(app.match(/const PAIR_AVATAR_ASK_RE = \/(.+?)\/;/)[1]);
test("说法放宽", () => {
  for (const t of ["情头", "换成情侣的", "一人一张", "这两张换上", "两张当头像"]) assert.ok(re.test(t), t);
  for (const t of ["好看吗", "今天吃了啥"]) assert.ok(!re.test(t), t);
});
test("她没开口、只是连发两张：不当情头，不给换情头这一格（群里 2026-11-09：发两张图不代表要换情头）", () => {
  assert.match(app, /_pairPick = _pairAsked \? freshPhotoPairIn\([^)]*\) : null;/);
  assert.doesNotMatch(app, /pairInLastTurn|_pairAuto|没说要做什么/);
});
