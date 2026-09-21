// 「我把时间感知关掉了，但是他们好像还是从大概 11 点多开始到半夜就半死不活的聊两句，
//   就要催我睡觉」（她 2026-09-20 转来的用户反馈）。
//
// 那个开关的意思就是【这个人不知道现在几点】。时间块、行程、时刻戳三处都认它，
// 唯独睡意这一层从上线起就没接上——于是到点照样发「【此刻你快睡了】……回得比平时短、
// 比平时慢，注意力是散的」，正是她说的半死不活。
// ⚠️当时没排作息的角色还有个 8–23 的兜底：一过 23 点一律算睡着，一个都跑不掉。
//   那句 v72.22 已经整个删掉了（她：「那个 8-23 点兜底也去掉」「没有时间感知的意思
//   就是我半夜说现在是早上他也能接得上」）——见 dongnian-accumulate 那条。。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

test("关了时间感知的角色不许有睡意", () => {
  const i = app.indexOf("  const sleepPhaseOf = char => {");
  const j = app.indexOf("\n  };", i);
  assert.ok(i > 0 && j > i, "抠不出 sleepPhaseOf");
  const fn = app.slice(i, j);
  assert.match(fn, /if \(!timeAwareFor\(char\.id\)\) return "awake";/, "睡意那一层还是不认时间感知开关");
  // ⚠️要挡在【问 charAwakeState 之前】：它自带 8–23 的兜底，晚一步就已经判成睡着了
  // 顺序仍然要紧：charAwakeState 会读【排了作息的】那份日程，晚一步就已经判睡着了
  assert.ok(fn.indexOf('!timeAwareFor(char.id)') < fn.indexOf('charAwakeState(char) === "asleep"'),
    "闸挡晚了——排了作息的角色会先被 charAwakeState 判睡着");
  // 言秋那条豁免别被顺手删了
  assert.match(fn, /engineerEyes\) return "awake";/, "言秋不睡觉那条没了");
});

test("收在一处就够：睡意那一段和主动开口那道闸都只问它", () => {
  // 两个消费端都走 sleepPhaseOf，别谁再自己算一遍（one-public-mechanism）
  assert.match(app, /const sleepToneOf = char => SLEEP_TONE\[sleepPhaseOf\(char\)\] \|\| "";/, "睡意那一段不是问它拿的");
  assert.match(app, /if \(sleepPhaseOf\(c\) === "asleep"\) \{/, "主动开口那道闸不是问它拿的");
  // charAwakeState 只许 sleepPhaseOf 自己调——别处直接调就绕过了这道闸
  // 全库只许 sleepPhaseOf 自己调它一次；别处直接调就绕过了这道闸
  // （6358 那条注释记着：那儿以前就是单独调 charAwakeState，v64.66 才收回来的）
  assert.strictEqual((app.match(/charAwakeState\(char\)/g) || []).length, 1,
    "charAwakeState 被别处直接调了，那一处会绕过时间感知这道闸");
});

test("睡意那一段确实会进 system（不然这条测试什么都没守住）", () => {
  assert.match(eng, /ctx\.sleepTone && ctx\.sleepTone\.trim\(\)\) parts\.push\(ctx\.sleepTone\.trim\(\)\)/, "睡意那一段没进 bundle");
  assert.match(app, /sleepTone: sleepToneOf\(char\)/, "单聊那一路没喂");
  assert.match(app, /sleep: sleepToneOf\(c\)/, "群聊那一路没喂");
});

test("时间感知关掉时，时间那三处本来就不发——别在修这条的时候碰坏它们", () => {
  assert.match(eng, /if \(timeAware !== false\) \{/, "时间块那道闸没了");
  assert.match(app, /schedNow: timeAwareFor\(char\.id\) \? schedNowFor\(char\) : ""/, "行程那道闸没了");
  assert.match(app, /〔时间感知关闭〕/, "朋友圈那一路的说明没了");
});
