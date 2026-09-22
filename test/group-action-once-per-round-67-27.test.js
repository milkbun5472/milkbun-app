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
  const ACT_PER_TURN = 2;
  const _actOnce = new Map();
  const sameActLine = (a, b) => {
    const norm = x => String(x == null ? "" : x).trim().replace(/[\s，,。.、！!？?；;：:…—～~-]/g, "").replace(/[了着过呢吧啊呀嘛哦噢的]+$/, "");
    const x = norm(a), y = norm(b);
    return !!x && x === y;
  };
  const drawn = [];
  items.forEach(it => {
    if (!it.action || (_actOnce.get(it.who) || 0) >= ACT_PER_TURN) return;
    _actOnce.set(it.who, (_actOnce.get(it.who) || 0) + 1);
    let prev = "";
    for (let k = rows.length - 1; k >= 0; k--) if (rows[k].who === it.who) { prev = rows[k].act; break; }
    if (!sameActLine(it.action, prev)) { rows.push({ who: it.who, act: it.action }); drawn.push(it.who + "：" + it.action); }
  });
  return drawn;
};

// v68.12：额度从 1 提到 2。她 2026-09-14 报「群聊为了多写对话，一个人一轮说好几次，
// 中间动作真的变了，可只有第一次显示出来」。一次太少，不封顶又会每条都换一个。
test("一个人一轮最多摆两行动描——哪怕他这一轮说了四条", () => {
  const r = runRound([
    { who: "A", action: "靠在窗边", text: "嗯" },
    { who: "B", action: "在厨房", text: "我来" },
    { who: "A", action: "转过身", text: "不用" },
    { who: "A", action: "把杯子放下", text: "真的" }
  ]);
  assert.equal(r.length, 3, "A 说了四条就摆四行＝又回到「一句一个动作」：" + JSON.stringify(r));
  assert.deepEqual(r, ["A：靠在窗边", "B：在厨房", "A：转过身"], "第三次那个「把杯子放下」超额了");
});

// v68.12：两次额度就是给「他这一轮真的换了个地方」留的——这正是她报的那种
test("一轮里真的变了，第二次也摆得出来", () => {
  const r = runRound([
    { who: "A", action: "靠在窗边" },
    { who: "A", action: "在楼下等车" }
  ]);
  assert.deepEqual(r, ["A：靠在窗边", "A：在楼下等车"]);
  // 第三次就没了：额度是上限，不是「每条都摆」
  const r3 = runRound([
    { who: "A", action: "靠在窗边" },
    { who: "A", action: "在楼下等车" },
    { who: "A", action: "上了车" }
  ]);
  assert.equal(r3.length, 2);
});

// ⚠️这一条最容易写漏：第一条没变被闸挡住了，可这个人这一轮的【额度】也用掉了一格
test("被挡住的那一次也算用掉一格额度", () => {
  const items = [
    { who: "A", action: "靠在窗边" },     // 跟上一轮一样 → 挡住，但花掉一格
    { who: "A", action: "突然站起来" },   // 真变了 → 摆出来，额度用完
    { who: "A", action: "走出门" }        // 没额度了
  ];
  items._prev = [{ who: "A", act: "靠在窗边" }];   // 上一轮摆过同一句
  const r = runRound(items);
  assert.deepEqual(r, ["A：突然站起来"], "把「用掉额度」写进 if 里面，三条会全摆出来");
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
  assert.match(A, /const _actOnce = new Map\(\);/, "一轮一个新的 Map，不许挂到轮外面去");
  assert.match(A, /const ACT_PER_TURN = 2;/);
  assert.match(A, /_gActDesc && gActionNow && spk && \(_actOnce\.get\(spk\.id\) \|\| 0\) < ACT_PER_TURN\) \{/, "没接上这道闸");
  // ⚠️记账必须在 if 外面：写进 if 里，第一条被挡住时机会就没用掉
  const i = A.indexOf("_gActDesc && gActionNow && spk && (_actOnce.get(spk.id) || 0) < ACT_PER_TURN) {");
  const blk = A.slice(i, i + 1400);   // v68.42 中间多了「动描不许当最后一行」那段注释
  assert.match(blk, /\{\n\s*_actOnce\.set\(spk\.id, \(_actOnce\.get\(spk\.id\) \|\| 0\) \+ 1\);/, "用掉机会这一笔得紧跟在进门那一下，不能等到画完再记");
  assert.ok(blk.indexOf("_actOnce.set") < blk.indexOf("if (!sameActLine"), "记账排在去重闸后面了");
});

test("跨轮那道闸和额度那道闸都还在", () => {
  const i = A.indexOf("_gActDesc && gActionNow && spk && (_actOnce.get(spk.id) || 0) < ACT_PER_TURN) {");
  const blk = A.slice(i, i + 1600);
  assert.match(blk, /String\(mm\.senderId\) === String\(spk\.id\)/, "比的是这个人自己上一次那条");
  // v68.42：额度那道闸从「有一格就摆」改成「还得给他留一格说话」
  assert.match(blk, /if \(!sameActLine\(gActionNow, _gprevAct\) && autoRoomLeft\(\) >= _actNeed\) \{/, "跨轮闸或额度闸掉了一个");
});

// 这一条推翻了她 2026-09-09 那句，理由要留在代码里，别让下一个人又改回去
test("为什么不再「一轮变两次都放进来」，理由写在代码里", () => {
  const i = app.indexOf("const ACT_PER_TURN = 2;");
  const doc = app.slice(Math.max(0, i - 1600), i);
  assert.match(doc, /action 挂在每一个元素上/, "得说清病根在形状不在字");
  assert.match(doc, /2026-09-12/, "改过的那两回都要写明是哪一句、哪一天");
  assert.match(doc, /2026-09-14/);
  assert.match(doc, /一次太少/, "得写明为什么从 1 抬到 2");
});
