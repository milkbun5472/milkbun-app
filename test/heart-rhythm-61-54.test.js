// 心上的架构第一刀（她 2026-09-03 拿来参考文档后同意的四条里的两条）：
//   ① 节律别套二十四节气——接到这个 app 自己的【周】节律上
//   ④ 几栏各是什么层，按她自己那两问分（.claude/rules/phone-data-layers.md）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/heart.js"), "utf8");
const rule = fs.readFileSync(path.join(root, ".claude/rules/phone-data-layers.md"), "utf8");
// 跑真引擎
const HeartKit = (() => {
  const g = {}; global.window = g;
  global.document = { addEventListener() {}, readyState: "complete" };
  new Function("window", src)(g);
  return g.HeartKit;
})();
const D = 86400000, now = Date.now();
const mk = (id, status, ageDays, extra) => Object.assign(
  { id, text: "念想" + id, source: "echo", weight: .5, touches: 1,
    lastTouch: now - ageDays * D, born: now - ageDays * D, status, tracks: [] }, extra || {});
const keep = list => HeartKit.housekeep(HeartKit.boxOf({ c: { list } }, "c")).list;

test("三拍的间隔都是整周——不然会跟周次错开，看着像随机", () => {
  // 她自己的规矩，原文在 phone-data-layers.md（那儿定的是就诊 14 天）
  assert.match(rule, /必须是 7 的整数倍/, "这条规矩没了的话，下面的推理要重写");
  const nums = {};
  [["MELLOW_DAYS", /const MELLOW_DAYS = (\d+)/], ["SOLSTICE_DAYS", /SOLSTICE_DAYS = (\d+)/],
   ["OBSERVE_DAYS", /const OBSERVE_DAYS = (\d+)/]].forEach(([k, re]) => {
    const m = re.exec(src); assert.ok(m, k + " 不见了"); nums[k] = Number(m[1]);
  });
  Object.entries(nums).forEach(([k, v]) =>
    assert.equal(v % 7, 0, k + " = " + v + "，不是 7 的整数倍——会跟周次错开"));
  // 原来是 10 / 90（那份文档的「小满日」「冬至日」），二十四节气跟这个 app 没关系
  assert.notEqual(nums.MELLOW_DAYS, 10, "又退回小满日那个 10 天了");
  assert.notEqual(nums.SOLSTICE_DAYS, 90, "又退回冬至日那个 90 天了");
  // 一季那层语义要留着：13 周
  assert.equal(nums.SOLSTICE_DAYS / 7, 13, "回头看不再是一季了");
  // 盘一盘比原来疏，不是更密（她按次计费）
  assert.ok(nums.MELLOW_DAYS >= 10, "改完反而更频繁了，那是在给她加钱");
});

test("落灰不是终点站：灰得够久的会让位", () => {
  // 名册判据：这一栏里的东西会不会「不再是」。会——所以得有出口。
  const old = n => [...Array(n)].map((_, i) => mk("o" + i, "ash", 400, { ashTs: now - 400 * D }));
  assert.equal(keep(old(200)).length, 120, "该削到地板");
  assert.equal(keep(old(30)).length, 30, "盒子小的时候一条都不许清");
});

test("⚠️只削到地板，不是符合条件的全清", () => {
  // 200 条陈年落灰清成 0 条，她打开一看整个心上空了——那不像放下，像丢数据
  const out = keep([...Array(200)].map((_, i) => mk("o" + i, "ash", 400, { ashTs: now - 400 * D })));
  assert.ok(out.length > 0, "清空了");
  // 走的是灰得最久的那几条
  const gone = 200 - out.length;
  assert.ok(gone > 0 && out.every(e => e.status === "ash"), "留下的不该混进别的状态");
});

test("active 和毕业的一条都不许动", () => {
  const out = keep([
    ...[...Array(60)].map((_, i) => mk("a" + i, "active", 5)),
    ...[...Array(40)].map((_, i) => mk("g" + i, "graduated", 900, { ashTs: now - 900 * D })),
    ...[...Array(30)].map((_, i) => mk("n" + i, "ash", 100, { ashTs: now - 100 * D })),
    ...[...Array(50)].map((_, i) => mk("o" + i, "ash", 400, { ashTs: now - 400 * D }))
  ]);
  const by = st => out.filter(e => e.status === st).length;
  assert.equal(by("active"), 60, "active 被清了");
  assert.equal(by("graduated"), 40, "毕业的被清了——那是他人格的根");
  assert.equal(by("ash"), 30, "刚落灰的（100 天）不该走");
  assert.equal(out.length, 130);
});

test("⚠️升级当天不许追溯删：老存档补一个从现在起算的时刻", () => {
  // 老存档的落灰条目没有 ashTs。拿 born/lastTouch 顶替的话，它们一上来就
  // 「已经放下半年了」→ 升级当天集体消失。
  const legacy = [...Array(200)].map((_, i) => mk("o" + i, "ash", 400));  // 没有 ashTs
  const out = keep(legacy);
  assert.equal(out.length, 200, "升级当天就删了 " + (200 - out.length) + " 条——那是她角色的过去");
  assert.ok(out.every(e => e.ashTs), "没给老条目补时刻，那半年的钟永远走不起来");
});

test("几栏各是什么层，写下来了", () => {
  assert.match(src, /list 念想\s*→ 📚名册/);
  assert.match(src, /tracks 做过的\s*→ 📚日志/);
  assert.match(src, /avoid 不想碰的 → 🔒硬钉死/);
  assert.match(src, /这一栏里的东西会不会「不再是」/, "判据没写下来");
  // 那几个 last* 字段名是存进档的，不许跟着改名
  assert.match(src, /lastMellow \/ lastSolstice \/ lastObserve 这几个字段名是【存进 x_desires 的】/);
});
