// v61.16 她 2026-09-03：「我明明没开时间感知为啥他还是知道现在几点」。
//
// 病因：关掉时间感知后，system 里那块【当前真实时间】确实不发了 —— 但每一条聊天历史
// 前面还盖着〔今天14:32〕，而最后一条就是她刚发出去的那句。等于把当前时刻原样告诉了他，
// 比直接发那一行还准。单聊线上还额外有一句「这些戳供你感知每句话是什么时候说的」在教他读。
//
// 这是【五处一样喂】的老形状：戳这一层当初在五处各写了一份，
// 群聊那份甚至挂在 gs.memoryInterop（闭群开关）上，跟时间感知半点关系没有。
// 所以这条按五处一起钉：单聊线上 / 单聊线下 / 群聊线上 / 群聊线下 / 通话（走单聊那条）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

const app = fs.readFileSync("js/app.js", "utf8");
const eng = fs.readFileSync("js/engine.js", "utf8");

test("单聊线上：时刻戳和日期锚都跟着 roomClockOn 走", () => {
  assert.match(app, /const stp = \(roomClockOn && m\.ts && typeof fmtStampAI === "function"\)/);
  assert.match(app, /\(roomClockOn && window\.TemporalAnchor \? window\.TemporalAnchor\.anchor\(m\.content, m\.ts\)/);
});

test("单聊线上：关了就别再教他读那些戳", () => {
  // 「聊天历史每条开头的〔今天14:32〕…供你感知」这句必须挂在 roomClockOn 上，
  // 否则戳没了、话还在，模型会去找一个不存在的东西。
  const i = app.indexOf("聊天历史每条开头的〔今天14:32〕");
  assert.ok(i > 0, "那句提示不见了");
  assert.ok(app.slice(i - 40, i).indexOf("roomClockOn ?") >= 0, "那句提示没跟着开关走");
});

test("群聊线上：改挂时间感知，不再挂闭群开关 memoryInterop", () => {
  assert.match(app, /const _gClockAny = members\.some\(c => !c\.npc && timeAwareFor\(c\.id\)\);/);
  assert.match(app, /\(_gClockAny && ts \? "\[" \+ fmtStampAI\(ts\)/);
  assert.match(app, /const ta = _gClockAny && /);
  // 老写法不许再出现
  assert.ok(app.indexOf('gs.memoryInterop && ts ? "["') < 0, "群聊的时刻戳还挂在闭群开关上");
});

test("两处线下：offlineHistory / offlineGroupHistory 都收 clock", () => {
  assert.match(eng, /function offlineHistory\(msgs, userName, charName, clock\)/);
  assert.match(eng, /function offlineGroupHistory\(msgs, userName, clock\)/);
  // 调用处真的把 ctx 那一层传下去了（声明了没人传＝白写，v55.95 那个形状）
  assert.match(eng, /offlineHistory\(session\.msgs, userName, char\.name, ctx\.timeAware !== false\)/);
  assert.match(eng, /offlineGroupHistory\(session\.msgs, userName, ctx\.timeAware !== false\)/);
  assert.equal((eng.match(/const stamp = \(ts && clock !== false\)/g) || []).length, 2);
  assert.equal((eng.match(/clock !== false && window\.TemporalAnchor/g) || []).length, 2);
});

test("相对间隔留着，只砍掉绝对时刻", () => {
  // 「中间隔了约三小时」说的是对话连不连得上，不是现实几点；砍掉它会让线下断片。
  assert.equal((eng.match(/中间隔了约 " \+ gapPhrase\(ts - prevTs\) \+ \(clock === false \? "" : "，到 "/g) || []).length, 2);
  assert.match(app, /gapPhrase\(ts - _gprev\) \+ \(_gClockAny \? "，到 "/);
});
