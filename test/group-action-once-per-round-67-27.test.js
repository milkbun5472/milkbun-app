// 她 2026-09-12（v67.26 之后当场）：「不行啊宝宝还是一句一个动作」。
//
// 前三版我一直在改【字】：v67.18 统一更新策略、v67.26 统一定义本身——一次都没治住。
// 因为病根不在字上，在**形状**上：
//   单聊一轮只有【一个】action 字段 → 天然「一个人一轮一个动作」；
//   群聊的 JSON 是一个数组，**action 挂在每一个元素上** → schema 本身就在说
//   「一条发言一个动作」。一轮八条，就是八个 action 字段，模型填满每一格是它在照做。
//
// 所以这一道只能是代码（规则只降概率，代码才保证）：
// 一轮里每个人的动描只认他第一次给的那个，后面的一律不看。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const A = strip(app);

// 把那道闸单独跑起来：一轮里若干条发言，看落出几行动描
const runRound = items => {
  const rows = [];                 // 已经落在聊天里的动描（跨轮的游标就是它）
  const seed = items._prev || [];
  seed.forEach(r => rows.push(r));
  const _actOnce = new Set();
  const sameActLine = (a, b) => {
    const norm = x => String(x == null ? "" : x).trim().replace(/[\s，,。.、！!？?；;：:…—～~-]/g, "").replace(/[了着过呢吧啊呀嘛哦噢的]+$/, "");
    const x = norm(a), y = norm(b);
    return !!x && x === y;
  };
  const drawn = [];
  items.forEach(it => {
    if (!it.action || _actOnce.has(it.who)) return;
    _actOnce.add(it.who);
    let prev = "";
    for (let k = rows.length - 1; k >= 0; k--) if (rows[k].who === it.who) { prev = rows[k].act; break; }
    if (!sameActLine(it.action, prev)) { rows.push({ who: it.who, act: it.action }); drawn.push(it.who + "：" + it.action); }
  });
  return drawn;
};

test("一个人一轮只摆一行动描——哪怕他这一轮说了三条", () => {
  const r = runRound([
    { who: "A", action: "靠在窗边", text: "嗯" },
    { who: "B", action: "在厨房", text: "我来" },
    { who: "A", action: "转过身", text: "不用" },
    { who: "A", action: "把杯子放下", text: "真的" }
  ]);
  assert.equal(r.length, 2, "A 说了三条就摆三行＝她说的「一句一个动作」：" + JSON.stringify(r));
  assert.deepEqual(r, ["A：靠在窗边", "B：在厨房"], "只认每个人第一次给的那个");
});

test("认的是【第一次给的】，不是最后一次", () => {
  const r = runRound([
    { who: "A", action: "靠在窗边" },
    { who: "A", action: "在楼下等车" }
  ]);
  assert.deepEqual(r, ["A：靠在窗边"]);
});

// ⚠️这一条最容易写漏：第一条没变被闸挡住了，可这个人这一轮的机会也用掉了
test("第一条跟上一轮一样被挡住，后面那条也不许再挤出一行", () => {
  const items = [
    { who: "A", action: "靠在窗边" },
    { who: "A", action: "突然站起来" }
  ];
  items._prev = [{ who: "A", act: "靠在窗边" }];   // 上一轮摆过同一句
  const r = runRound(items);
  assert.deepEqual(r, [], "把「用掉机会」写进 if 里面就会漏成这样");
});

test("没变还是不摆：跨轮那道闸照旧管用", () => {
  const items = [{ who: "A", action: "靠在窗边。" }, { who: "B", action: "在厨房" }];
  items._prev = [{ who: "A", act: "靠在窗边" }];
  assert.deepEqual(runRound(items), ["B：在厨房"], "A 没变就不该再摆一行");
});

test("真换了一件事照样摆出来", () => {
  const items = [{ who: "A", action: "在楼下等车" }];
  items._prev = [{ who: "A", act: "靠在窗边" }];
  assert.deepEqual(runRound(items), ["A：在楼下等车"]);
});

test("没给动作的那几条不占名额", () => {
  const r = runRound([
    { who: "A", text: "嗯" },
    { who: "A", action: "靠在窗边", text: "我在" }
  ]);
  assert.deepEqual(r, ["A：靠在窗边"], "第一条压根没给动作，不该把机会用掉");
});

// ── 接到代码里了没有 ──────────────────────────────────────────
test("那道闸真的写在群回复里，而且一轮一清", () => {
  assert.match(A, /const _actOnce = new Set\(\);/, "一轮一个新的 Set，不许挂到轮外面去");
  assert.match(A, /if \(_gActDesc && gActionNow && spk && !_actOnce\.has\(spk\.id\)\) \{/, "没接上这道闸");
  // ⚠️记账必须在 if 外面：写进 if 里，第一条被挡住时机会就没用掉
  const i = A.indexOf("if (_gActDesc && gActionNow && spk && !_actOnce.has(spk.id)) {");
  const blk = A.slice(i, i + 700);
  assert.match(blk, /\{\n\s*_actOnce\.add\(spk\.id\);/, "用掉机会这一笔得紧跟在进门那一下，不能等到画完再记");
  assert.ok(blk.indexOf("_actOnce.add") < blk.indexOf("if (!sameActLine"), "记账排在去重闸后面了");
});

test("跨轮那道闸和额度那道闸都还在", () => {
  const i = A.indexOf("if (_gActDesc && gActionNow && spk && !_actOnce.has(spk.id)) {");
  const blk = A.slice(i, i + 900);
  assert.match(blk, /String\(mm\.senderId\) === String\(spk\.id\)/, "比的是这个人自己上一次那条");
  assert.match(blk, /if \(!sameActLine\(gActionNow, _gprevAct\) && autoRoomLeft\(\) > 0\) \{/, "跨轮闸或额度闸掉了一个");
});

// 这一条推翻了她 2026-09-09 那句，理由要留在代码里，别让下一个人又改回去
test("为什么不再「一轮变两次都放进来」，理由写在代码里", () => {
  const i = app.indexOf("const _actOnce = new Set();");
  const doc = app.slice(Math.max(0, i - 1400), i);
  assert.match(doc, /action 挂在每一个元素上/, "得说清病根在形状不在字");
  assert.match(doc, /2026-09-09/, "得写明这条推翻了哪一句");
  assert.match(doc, /单聊可以一个人一轮一个动作/, "得写明新标准是照单聊来的");
});
