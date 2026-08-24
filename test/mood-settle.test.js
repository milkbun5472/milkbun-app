const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const M = require(path.join(root, "js/mood-label.js"));
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

// 她 2026-08-24：「过好久不聊了心情还是会平复的吧。我的实时心情是不是连着人格系统的」
//
// 查下来：不会平复，而且【会衰减的东西不出口，出口的东西不衰减】——
// 积温那五根轴有随时间回归设定点的漂移，但只 stash 在 window.__jiwen 里做观测，
// 从不回流到心情标签也不进提示词；而 moods[id] 每轮被覆盖一次之后就一直躺着，
// 提示词照样把它当【你此刻的心情】原样注进去。三天前那阵气，三天后回来还在演。

const H = 3600000;
const now = 1e12;

test("三小时内还在那股劲里，一个字不改", () => {
  const r = M.settle("烦躁", now - 0.5 * H, now);
  assert.equal(r.phase, "fresh");
  assert.equal(r.label, "烦躁");
  assert.equal(r.note, "");
});

test("半天上下：还报得出来，但要说清那是上次的、别接着演", () => {
  const r = M.settle("烦躁", now - 6 * H, now);
  assert.equal(r.phase, "fading");
  assert.equal(r.label, "烦躁", "这个阶段还留着标签");
  assert.match(r.note, /6 小时前/);
  assert.match(r.note, /别一上来就接着演它/);
  // 「淡了」不等于「翻篇了」——没了结的事不该被时间一笔勾销
  assert.match(r.note, /除非那件事本身还没过去/);
});

test("隔夜以上：不再报一个假的当下心情", () => {
  const r = M.settle("生气", now - 30 * H, now);
  assert.equal(r.phase, "gone");
  assert.equal(r.label, "", "标签要清掉，不能继续假装这是「此刻」");
  assert.match(r.note, /1 天前/);
  assert.match(r.note, /此刻的心情由现在这一刻决定/);
  assert.match(M.settle("生气", now - 72 * H, now).note, /3 天前/);
});

test("没有时间戳时当新鲜处理，别凭空把心情抹掉", () => {
  assert.deepEqual(M.settle("开心", 0, now), { label: "开心", phase: "fresh", hours: 0, note: "" });
  assert.equal(M.settle("", now, now).phase, "none");
  assert.equal(M.settle(null, now, now).label, "");
});

test("英文标签照样先归中文再判", () => {
  assert.equal(M.settle("annoyed", now - 6 * H, now).label, "烦躁");
});

test("存储不动——平复只发生在注入提示词那一刻", () => {
  // settle 是纯函数，不碰 x_moods
  assert.ok(app.indexOf("window.MoodLabel.settle(m.label, m.ts, Date.now())") > 0);
  assert.match(app, /存储不动，历史照留/);
  const i = app.indexOf("const _moodSkip");
  assert.ok(app.slice(i, i + 600).indexOf("settle") < 0, "写入路径不许掺进平复逻辑");
});

test("提示词端：淡了要带上说明，彻底平复就别再报「此刻的心情」", () => {
  assert.match(engine, /\+ \(ctx\.moodNote \|\| "（这是你此刻的情绪底色/);
  assert.match(engine, /else if \(ctx\.moodNote\) parts\.push\("【心情】" \+ ctx\.moodNote\)/);
  assert.match(engine, /彻底平复之后 moodLabel 为空、只留 note，别再报一个假的当下心情/);
});

test("会衰减的和出口的接上了——这条注释是这次改动的由来，别弄丢", () => {
  const mood = fs.readFileSync(path.join(root, "js/mood-label.js"), "utf8");
  assert.match(mood, /会衰减的东西不出口，出口的东西不衰减/);
  assert.match(mood, /valenceRegress/, "说明白积温那边本来就有漂移");
});
