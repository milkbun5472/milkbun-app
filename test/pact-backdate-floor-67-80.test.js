// 她 2026-09-13 带截图：情侣空间「说好的事」挪到今天，他下午一点自己开口了，
// 可那两条气泡上写的是 09:00，而且排在 13:05 那几条【下面】。
//
// 病根有两层：
//   ① 选日期那一栏定不出【时刻】：screens.js 里是 `new Date(v + "T09:00:00")`——
//      9 点是日期选择器的占位钟点，不是他俩约好的时间。倒填到一个假的时刻，
//      等于无中生有一段没发生的过去。
//   ② 倒填的时刻早于【这条约定被定下来的那一刻】，也早于【聊天里最后一条】，
//      于是那条气泡排到前面去了，聊天顺序当场错乱。
//
// 倒填这条路本身没错（他昨晚答应今早八点找你、你中午才开 app，那就该补到八点），
// 所以不是撤掉它，是给它一个地板。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

// 真跑那个地板：抠出来，chatsRef 按【真存档的形状】给（聊天就是一串带 ts 的消息）
const mkFloor = rows => {
  const i = app.indexOf("      const promiseBackTs = pm => {");
  const j = app.indexOf("      try {", i);
  assert.ok(i > 0 && j > i, "抠不出 promiseBackTs");
  return new Function("chatsRef", app.slice(i, j) + "\nreturn promiseBackTs;")({ current: { c1: rows } });
};
const HOUR = 3600000;

test("她今天才把约定挪到今天：9 点那个占位钟点不许倒填", () => {
  const now = Date.now();
  // 上午 9 点那个占位时刻；这条约定是【中午 12:40】才定下来的（id 里就写着）
  const due = now - 4 * HOUR;
  const floor = mkFloor([{ ts: now - 10 * 60000 }]);       // 十分钟前还在聊
  assert.equal(floor({ id: "pk_" + (now - 20 * 60000), charId: "c1", dueTs: due }), 0,
    "倒填到了约定定下来之前——那条气泡会排到她刚说的话前面去");
});

test("聊天里最后一条比「说好的那一刻」还新：也不许倒填", () => {
  const now = Date.now();
  const due = now - 4 * HOUR;
  // 约定是三天前定的（这一条没问题），可她中午刚聊过——倒填还是会插到那几条下面
  const floor = mkFloor([{ ts: now - 3 * HOUR }, { ts: now - 30 * 60000 }]);
  assert.equal(floor({ id: "pk_" + (now - 3 * 86400000), charId: "c1", dueTs: due }), 0);
});

test("原来那条路没被撤掉：他昨晚答应今早八点找你、你中午才开 app", () => {
  const now = Date.now();
  const due = now - 4 * HOUR;                               // 今早八点
  const floor = mkFloor([{ ts: now - 20 * HOUR }]);         // 最后一条是昨晚
  assert.equal(floor({ id: "pk_" + (now - 21 * HOUR), charId: "c1", dueTs: due }), due,
    "该补到他答应的那一刻，却补成了现在——她看到的就成了「他现在才想起来」");
});

test("刚到点的、没有日子的、认不出生辰的，都落回「此刻」", () => {
  const now = Date.now();
  const floor = mkFloor([]);
  assert.equal(floor({ id: "pk_1", charId: "c1", dueTs: now - 10000 }), 0, "刚到点还倒填一分钟");
  assert.equal(floor({ id: "pk_1", charId: "c1", dueTs: 0 }), 0);
  assert.equal(floor({ id: "没有下划线", charId: "c1", dueTs: now - 4 * HOUR }), now - 4 * HOUR,
    "认不出定下来的时刻时，只靠聊天那道地板兜着（这儿聊天是空的）");
});

test("接线：发消息和未接来电两条路都走这个地板", () => {
  assert.match(app, /backdateTs: promiseBackTs\(pm\) \}\);/);
  assert.match(app, /ringFromChar\(c, pm\.via, promiseBackTs\(pm\) \|\| Date\.now\(\), Math\.round\(\(Date\.now\(\) - pm\.dueTs\) \/ 60000\)\);/);
  assert.ok(!/backdateTs: pm\.dueTs < Date\.now\(\) - 60000 \? pm\.dueTs : 0/.test(app), "老的那行还在，两条路各算各的");
  // 「9 点」是日期选择器的占位钟点这件事，钉在【它真正被写出来的地方】
  assert.match(screens, /const toTs = v => \{ const d = new Date\(v \+ "T09:00:00"\); return isNaN\(d\.getTime\(\)\) \? 0 : d\.getTime\(\); \};/);
  assert.match(screens, /const planTs = v => \{ const d = new Date\(v \+ "T09:00:00"\); return isNaN\(d\.getTime\(\)\) \? 0 : d\.getTime\(\); \};/);
});
