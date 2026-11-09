// 她 2026-11-02「必须要说情头才会换吗」：说法放宽；一句不说、这一轮连发两张也交给他看图判断（默认不换）。
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8");
const re = new RegExp(app.match(/const PAIR_AVATAR_ASK_RE = \/(.+?)\/;/)[1]);
test("说法放宽", () => {
  for (const t of ["情头", "换成情侣的", "一人一张", "这两张换上", "两张当头像"]) assert.ok(re.test(t), t);
  for (const t of ["好看吗", "今天吃了啥"]) assert.ok(!re.test(t), t);
});
test("这一轮连发两张才算，中间她说过话就不算", () => {
  const a = app.indexOf("const pairInLastTurn"), b = app.indexOf("\n  };", a) + 4;
  const f = new Function(app.slice(a, b) + ";return pairInLastTurn;")();
  const p = (r) => ({ role: "user", kind: "photo", imageRef: r });
  assert.equal(f([{ role: "char", content: "x" }, p("a"), p("b")]).length, 2);
  assert.equal(f([p("a"), { role: "char", content: "x" }, p("b")]), null);
  assert.equal(f([{ role: "char" }, p("a")]), null);
});
test("没开口的那一版：默认不换、他看图判断；他单张换自己头像不被挡", () => {
  assert.match(app, /_pairPick = _pairAsked \? freshPhotoPairIn\([^)]*\) : _pairAuto;/);
  assert.match(app, /刚连着发来两张照片，没说要做什么/);
  assert.match(app, /_pairPick && !_pairAuto && _avatarMsg/);
});
test("没开口的两张只标第几张，不先叫成情头；换不换是他自己的主意", () => {
  assert.match(app, /const _pn = _pairAuto \? "【第 " : "【情头·第 ";/);
  assert.doesNotMatch(app, /她多半是想你俩一起换上/);
});
