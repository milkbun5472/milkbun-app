// 她 2026-09-10 留给这个窗口的四条里的前两条：
//  ⑥ 敲完他行为不变——那个梯度（knockStep）写得很好，可它只管【那一句话】：
//    她敲了三下，他心里说「知道你在看」，然后继续若无其事地刷。
//  ⑦ 没有暂停键——他打了一句又删掉、心声一闪而过，想看清楚只能按 1× 或者错过。
//
// ⚠️另一个窗口交班时点名的那条：截掉剩下的动作要小心，别把已经该落盘的那几下演漏
//   （边演边落是她定的）。所以这一段【只插不删】，也不插 lock/home。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const phone = R("js/phone.js"), wk = R("js/phone-watch.js");
const W = require("../js/phone-watch.js");

test("⑥ 敲完插一段真的停住，梯度跟 knockStep 那四档对得上", () => {
  const b1 = W.knockBeat(1, "嗯？", "");
  const b2 = W.knockBeat(2, "", "");
  const b4 = W.knockBeat(4, "行吧", "");
  assert.equal(b1[0].kind, "pause", "第一下没有停住那一拍");
  assert.ok(b4[0].ms > b2[0].ms && b2[0].ms > b1[0].ms, "敲得越多停得越久这条没成立");
  // 那句话跟着这一段一起演（走同一条退场路），不是直接压在 thought 上
  assert.deepEqual(b1[b1.length - 1], { kind: "think", text: "嗯？" });
  assert.equal(b2.length, 1, "他没吭声时不许硬塞一句空心声");
});

test("⑥ 第三下起他被看得打不下去：手上那半句删光", () => {
  assert.deepEqual(W.knockBeat(3, "", "打了一半"), [{ kind: "pause", ms: 2200 }, { kind: "erase" }]);
  assert.deepEqual(W.knockBeat(3, "", "   "), [{ kind: "pause", ms: 2200 }], "手上没在打字也硬删");
  assert.deepEqual(W.knockBeat(2, "", "打了一半"), [{ kind: "pause", ms: 1500 }], "第二下就开始删了");
  // ⚠️不给 n＝整段划光；后面那一下 send 遇到空草稿本来就什么都不做，
  //   所以「他没发出去」是白得的，不用另外截断
  assert.match(wk, /if \(k >= 3 && S\(typing\)\.trim\(\)\) out\.push\(\{ kind: "erase" \}\);/);
});

test("⑥ 只插不删，也不许把他弹回桌面", () => {
  // 截掉剩下的动作＝把本该落盘的那几下整段演漏（边演边落是她定的）
  assert.deepEqual(W.spliceBeat([{ kind: "a" }, { kind: "b" }, { kind: "c" }], 1, [{ kind: "X" }]),
    [{ kind: "a" }, { kind: "b" }, { kind: "X" }, { kind: "c" }], "没插在当前这一下的后面");
  assert.equal(W.spliceBeat([{ kind: "a" }], 0, []).length, 1, "空的一段不许动原来那串");
  const beats = [1, 2, 3, 4, 5].flatMap(n => W.knockBeat(n, "x", "y"));
  ["lock", "home", "back", "open"].forEach(k =>
    assert.ok(!beats.some(b => b.kind === k), "插了 " + k + "：后面那串动作是按「他还在这个 app 里」写的，会全落空"));
  assert.match(wk, /只【插】不【删】/, "那条教训的注释没留下");
  // 播放器那一头真用上了
  assert.match(phone, /acts: WK\.spliceBeat\(p\.acts, p\.i, beat\)/, "算出来了却没插进去");
  assert.match(phone, /const beat = \(say && WK && WK\.knockBeat\) \? WK\.knockBeat\(n, say, p\.typing\) : \[\];/);
});

test("⑦ 暂停只拦「往下走那一脚」，绝不挂进 effect 的 deps", () => {
  // ⚠️deps 一变整段 effect 重跑，这一下的效果会再做一遍——发出去的再发一次、
  //   打过的字再打一遍。这是这个改动唯一会出大事的地方。
  assert.match(phone, /\}, \[watch && watch\.i, watch && watch\.speed, watch && watch\.done\]\);/,
    "暂停挂进 deps 了——这一下的效果会重做一遍");
  assert.match(phone, /const advance = \(\) => \{\s*\n\s*if \(watchRef\.current && watchRef\.current\.paused\) \{ hold = setTimeout\(advance, 200\); return; \}/,
    "到点没先看一眼旗子");
  assert.match(phone, /const tid = setTimeout\(advance, Math\.max\(120, WK\.actDuration\(a\) \/ speed\)\);/);
  // 清理要连着新排的那一发一起收，不然退出去还有一串定时器在往没了的 state 里写
  assert.match(phone, /clearTimeout\(tid\); if \(hold\) clearTimeout\(hold\);/, "暂停那一发定时器漏了");
});

test("⑦ 停着的时候：字不许再往下打，心声不许溜走", () => {
  assert.match(phone, /if \(watchRef\.current && watchRef\.current\.paused\) return;[^\n]*\n\s*n \+= 1;/, "暂停了还在逐字打");
  assert.match(phone, /const bye = \(\) => \{\s*\n\s*if \(watchRef\.current && watchRef\.current\.paused\) \{ id = setTimeout\(bye, 200\); return; \}/,
    "她按暂停多半就是为了把那句话看完，结果它照样溜走");
});

test("⑦ 那颗键在栏上，而且「跳到最后」会顺手放开暂停", () => {
  assert.match(wk, /onClick: p\.onPause/, "栏上没有暂停键");
  assert.match(wk, /p\.paused \? "继续" : "暂停"/, "看不出此刻是停着还是在走");
  assert.match(wk, /p\.done \? "看完了" : p\.paused \? "停住了"/, "进度那一栏没说清停住了");
  assert.match(phone, /onPause: \(\) => setWatch\(w => w \? \{ \.\.\.w, paused: !w\.paused \} : w\)/);
  // ⚠️停着的时候倍速再快也不往下走：跳到最后必须顺手把旗子放下，否则按了没反应
  assert.match(phone, /onSkip: \(\) => setWatch\(w => w \? \{ \.\.\.w, speed: 8, paused: false \} : w\)/,
    "暂停着按「跳到最后」会一动不动");
  assert.match(phone, /knocking: false, paused: false, done: false \}\);/, "开场没把旗子放下");
});
