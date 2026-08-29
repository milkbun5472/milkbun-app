// 每周自动刷一次手机
//
// ⚠️不是闹钟：PWA 后台不跑代码，半夜没人替你调模型。真实含义是
// 「进入新的一周之后，第一次打开 App 或切回前台时补刷」——跟行程和钱包补账
// 同一个形状，靠「上次刷到哪一周」的游标防重复。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");

const sweep = app.match(/const phoneWeeklySweep = async \(\) => \{[\s\S]*?\n  \};/);

test("靠周次游标防重复，不靠闹钟", () => {
  assert.ok(sweep, "找不到 phoneWeeklySweep");
  assert.match(sweep[0], /phoneWeekKey\(Date\.now\(\)\)/);
  assert.match(sweep[0], /\(box\.done \|\| \{\}\)\[c\.id\] !== wk/, "没比对「这一周刷过没有」");
  // 代码里不许出现定时器式的写法
  assert.ok(sweep[0].indexOf("setTimeout") < 0 && sweep[0].indexOf("setInterval") < 0,
    "别用定时器——PWA 后台不跑代码，半夜那一拍根本不会响");
});

test("默认全关，一个一个角色自己开", () => {
  assert.match(app, /useState\(\{ on: \{\}, done: \{\} \}\)/, "默认不该是开的——她按次计费");
  assert.match(app, /const phoneAutoToggle = charId =>/);
  assert.match(phone, /autoOn,\n  onToggleAuto,/, "开关没传进查手机界面");
  assert.match(phone, /onToggleAuto\(c\.id\)/, "通讯录那一行上没有开关");
});

test("一次唤起只补一个角色", () => {
  // 全刷是十几次串行调用，五个角色一起补要跑几分钟，还一次把这一周的钱花完
  assert.match(sweep[0], /liveChars\.find\(/, "用了 forEach/map 会把所有人一起刷");
  assert.ok(sweep[0].indexOf("for (const") < 0);
  assert.match(sweep[0], /phoneWeekRunRef\.current = true/, "没有并发闸，来回切前台会叠着跑");
});

test("先记游标再刷：中途失败不会下次又整份重刷", () => {
  const i = sweep[0].indexOf("setPhoneAuto");
  const j = sweep[0].indexOf("genPhoneAll");
  assert.ok(i >= 0 && j >= 0 && i < j, "游标得在真正开刷之前落下");
  assert.match(sweep[0], /genPhoneAll\(due, true\)/, "没告诉生成侧这是例行刷新");
});

test("挂在三拍上，和行程那条链一样多", () => {
  // 「一层写在三处，第四处没跟上」是这个库反复犯的病，钱包刚栽过一次
  const mine = (app.match(/phoneWeeklySweep\(\)/g) || []).length;
  const sched = (app.match(/schedMaybeSelfRevise\(\)/g) || []).length;
  assert.equal(mine, sched, "每周刷新的挂点数和行程那条链对不上（自己 " + mine + " / 行程 " + sched + "）");
});

test("没配 API、没开开关、这周刷过了，都不动", () => {
  assert.match(sweep[0], /if \(phoneWeekRunRef\.current \|\| !active\) return;/);
  assert.match(sweep[0], /box\.on && box\.on\[c\.id\]/);
  assert.match(sweep[0], /if \(!due\) return;/);
});
