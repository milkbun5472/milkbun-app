// 她 2026-09-13：「要时间」——「说好的事」原来只能挑到【哪一天】，挑不到【几点】。
//
// 上一版（v67.80）修的是「倒填到一个没发生过的九点」；那个九点是哪来的，
// 这一版才是根治：日期选择器没处放钟点，代码就写死 `T09:00:00`。
// 现在她挑几点就是几点；不改钟点仍然落回九点，老存档和老习惯一个字不变。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

// 真跑那两个公共函数
const mk = () => {
  const i = screens.indexOf('const COUPLE_DUE_DEFAULT_HM = "09:00";');
  const j = screens.indexOf("// 情侣空间·我们说好的（v58.83", i);
  assert.ok(i > 0 && j > i, "抠不出那两个公共函数");
  return new Function(screens.slice(i, j) + "\nreturn { coupleDueTs, coupleDueClock, COUPLE_DUE_DEFAULT_HM };")();
};

test("挑了几点就是几点", () => {
  const K = mk();
  const ts = K.coupleDueTs("2026-09-20", "20:30");
  const d = new Date(ts);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth() + 1, 9);
  assert.equal(d.getDate(), 20);
  assert.equal(d.getHours(), 20);
  assert.equal(d.getMinutes(), 30);
  assert.equal(K.coupleDueClock(ts), "20:30");
});

test("不改钟点＝还是早上九点（老存档、老习惯一个字不变）", () => {
  const K = mk();
  assert.equal(K.COUPLE_DUE_DEFAULT_HM, "09:00");
  [undefined, "", null, "乱填的", "25:99", "8点"].forEach(bad => {
    assert.equal(new Date(K.coupleDueTs("2026-09-20", bad)).getHours(), 9, "钟点填成 " + bad + " 时没落回九点");
  });
});

test("没挑日子就什么都不是：不许自己造一个今天出来", () => {
  const K = mk();
  assert.equal(K.coupleDueTs("", "20:00"), 0);
  assert.equal(K.coupleDueTs(null, "20:00"), 0);
  assert.equal(K.coupleDueTs("不是日子", "20:00"), 0);
  assert.equal(K.coupleDueClock(0), "00:00");   // 只在有日子的时候才拿去显示
});

test("两处都从这一份要时刻，不再各写一遍", () => {
  assert.match(screens, /const toTs = \(v, hm\) => coupleDueTs\(v, hm\);/);
  assert.match(screens, /const planTs = \(v, hm\) => coupleDueTs\(v, hm\);/);
  // 真正写死那一行不许再出现（注释里提到不算）
  const live = screens.split("\n").filter(l => l.indexOf("T09:00:00") >= 0 && l.trim().indexOf("//") !== 0);
  assert.deepEqual(live, [], "还有地方自己拼 09:00：" + live.join(" | "));
});

test("界面上：两处都能挑几点，而且挑完要看得见", () => {
  // 说好的事：自己记一条、给一条挑日子，两处各一个「几点」
  assert.match(screens, /h\("input", \{ type: "time", value: dayHm, disabled: !day, "aria-label": "几点"/);
  assert.match(screens, /h\("input", \{ type: "time", value: dueHm, "aria-label": "几点"/);
  // 心愿那一处
  assert.match(screens, /h\("input", \{ type: "time", value: planHm, "aria-label": "几点"/);
  // 挑完要写出来——只写「就是今天」的话，她挑的那个钟点等于没挑过
  assert.match(screens, /leftOf\(d\.dueTs\) \+ " " \+ coupleDueClock\(d\.dueTs\)/);
  assert.match(screens, /return when \+ " " \+ coupleDueClock\(ts\);/);
  // 改日子时要把原来那个钟点带出来，不是每次都跳回九点
  assert.match(screens, /setDueHm\(d \? coupleDueClock\(d\.dueTs\) : COUPLE_DUE_DEFAULT_HM\)/);
});
