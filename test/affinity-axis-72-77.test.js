// 她 2026-09-22 转来的两条：「那个好感我就没涨过，只有情侣空间开通和关系填情侣加了，
// 到80就不动了」；另一头「小柯聊了一天涨了十几点」。
//
// 80 不是上限（上限 100），是「恋人」这条关系的【起点】——她卡住的是起点，说明一点没长过。
// 涨一点要过三道闸，每一道都往 0 推：
//   ① 单聊和线下都写着「仅当本轮确实足以改变长期关系感受时填写；普通愉快、关心和日常聊天
//      不改变长期关系」——那是一句判决，模型只会往安全那边缩，日常一律交 0；
//   ② v72.51 那次又在开头加了「affinityDelta…没有真实变化时不要为了填字段制造内容」，同向说第二遍；
//   ③ 代码再乘 0.2（一轮最多 ±1），显示取整。模型最常给的 1 → 实际 +0.2 → 界面纹丝不动。
// 改的是①②（判据换成一条每轮都答得出来的轴），③留着——天花板是对的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
// ⚠️数的是【真的发出去的字】，不是注释里提到的旧写法：旁边那段注释就抄着那句判决，
//   一提它这条断言就红（同 persona-register 那一处的 live()）。剥掉整行注释再看。
const live = x => x.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
const SENT = live(engine) + live(app);

test("那句判决删掉了，不是在后面挂一句「不过日常也可以填」", () => {
  // 施工规则/no-yes-unless.md：说错了就删掉重写
  assert.equal(SENT.indexOf("足以改变长期关系"), -1, "那句判决还在");
  assert.equal(SENT.indexOf("普通愉快、关心和日常聊天不改变长期关系"), -1);
});

test("换上的是一条轴，不是另一个门槛", () => {
  const i = engine.indexOf("const AFFINITY_DELTA_SPEC = ");
  const spec = engine.slice(i, engine.indexOf("\n", i));
  assert.ok(i > 0, "抠不出这条轴");
  assert.match(spec, /往哪边动了一点点，就填 ±1/, "日常那一档得够得着");
  assert.match(spec, /±3~5/, "转折那一档还在");
  assert.match(spec, /确实什么都没发生才 0/);
});

test("四条路共用这一份，没有谁自己又写了一版", () => {
  // 单聊线上 / 单人线下 / 群线上（两处：心声提示 + 字段表）/ 群线下 beats
  assert.match(app, /affinityDelta: \$\{AFFINITY_DELTA_SPEC\}/, "单聊线上");
  assert.match(engine, /affinityDelta: \$\{AFFINITY_DELTA_SPEC\}/, "单人线下");
  assert.equal((app.match(/AFFINITY_DELTA_SPEC/g) || []).length, 3, "群那两处也要吃到");
  assert.equal((engine.match(/AFFINITY_DELTA_SPEC/g) || []).length, 3, "1 处定义 + 单人线下 + 群线下");
  // 旧的三种各写一版的写法不许回来
  assert.equal(SENT.indexOf("通常小幅、没波动就 0"), -1);
  assert.equal(SENT.indexOf("通常小幅、没波动就0"), -1);
  assert.equal(SENT.indexOf('affinityDelta\\":\\"（可选）整数-5到5'), -1);
});

test("天花板没动：一轮最多 ±1，那一步是故意的", () => {
  assert.match(app, /Math\.max\(-5, Math\.min\(5, d\)\) \* 0\.2 \* 1000/);
  assert.match(app, /内部存 3 位小数，显示时取整/);
});
