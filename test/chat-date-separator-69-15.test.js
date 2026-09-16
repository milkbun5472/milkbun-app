// 她 2026-09-16：「群聊没跟上单聊，不会有日期隔离，过多久界面都是像同一天没有中间那条时间」。
//
// 查下来这件事库里写了两遍，分寸和文案都各写各的：
//   · 单聊：i===0 || 换轮 || 间隔>3分钟；文案 fmtStamp——跨天只给「9/15 14:30」
//   · 群聊：有上一条 && 不同轮 && (跨天 || ≥30分钟)；文案自己现拼，
//     而且对「今天」只给裸时刻——跨天那条跟同一天里隔半小时长得一模一样。
// 30 分钟那道门群里天天过不去，于是整屏一条时间都没有；偶尔过去了也看不出隔了夜。
//
// 改法：判据抽成 js/chat-stamp.js 一份公共的，两处都搬过去
// （施工规则/one-public-mechanism.md：开了公共的就把已有的也搬过来）。
// ⚠️同一条规矩的下半句——搬的时候不许顺手改行为：两处的 minGap 各传各的
// （单聊 3 分钟、群聊 30 分钟），只有【跨天必须看得出来】这一档两处一样。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../js/chat-stamp.js");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

const D = 86400000;
// 桩照【写存档的那段】写：pGChat / pChat 的 push 都是 { role, content, ts: Date.now(), turnId }
// （施工规则/stub-from-the-writer.md）
const msg = (ts, turnId) => (turnId ? { role: "assistant", content: "x", ts: ts, turnId: turnId } : { role: "user", content: "x", ts: ts });
const NOW = Date.parse("2026-09-16T12:00:00");

test("跨天必须出一条带日期的，不看间隔也不看是不是同一轮", () => {
  const prev = msg(NOW - D + 60000);          // 昨天 12:01
  const cur = msg(NOW - D + 120000 + D);      // 今天 12:02，离上一条只隔一分钟
  const r = S.decide(prev, cur, { now: NOW, minGap: 30 * 60000 });
  assert.equal(r.show, true, "跨天了还不显示");
  assert.equal(r.day, true);
  assert.match(r.text, /^今天 /, "跨天那条必须把哪一天写在脸上");
});

test("同一轮里连发也挡不住跨天那一条", () => {
  const prev = { role: "assistant", content: "x", ts: NOW - D, turnId: "t9" };
  const cur = { role: "assistant", content: "x", ts: NOW, turnId: "t9" };
  assert.equal(S.decide(prev, cur, { now: NOW, minGap: 30 * 60000 }).day, true);
});

test("整段第一条就是这天的开头，写清是哪天", () => {
  const r = S.decide(null, msg(NOW - 2 * D), { now: NOW });
  assert.equal(r.show, true);
  assert.equal(r.day, true);
  assert.match(r.text, /^9月14日 /);
});

test("文案：今天 / 昨天 / 几月几日 / 跨年带年份", () => {
  assert.match(S.label(NOW, NOW), /^今天 12:00$/);
  assert.match(S.label(NOW - D, NOW), /^昨天 12:00$/);
  assert.match(S.label(NOW - 3 * D, NOW), /^9月13日 12:00$/);
  assert.match(S.label(Date.parse("2025-12-31T23:10:00"), NOW), /^2025年12月31日 23:10$/);
  // 同一天里那一档只给时刻——不然满屏都是「今天」
  assert.equal(S.clockOnly(NOW), "12:00");
});

test("同一天里：两处各守各的分寸，搬家没顺手抹平", () => {
  const base = msg(NOW - 10 * 60000);
  const cur = msg(NOW, "t2");
  // 单聊 3 分钟：隔了 10 分钟 → 出一条时刻
  const one = S.decide(base, cur, { now: NOW, minGap: 180000 });
  assert.equal(one.show, true); assert.equal(one.day, false);
  assert.equal(one.text, "12:00", "同一天那一档只给时刻");
  // 群聊 30 分钟：同样这两条 → 不出
  assert.equal(S.decide(base, cur, { now: NOW, minGap: 30 * 60000 }).show, false);
});

test("同一轮里连发不各带一个时刻（群里一轮好几个人说话）", () => {
  const a = { role: "assistant", content: "x", ts: NOW - 40 * 60000, turnId: "t1" };
  const b = { role: "assistant", content: "x", ts: NOW, turnId: "t1" };
  assert.equal(S.decide(a, b, { now: NOW, minGap: 30 * 60000 }).show, false);
});

test("没有 ts 的消息不能顶替基准，往前找第一条真带时间的", () => {
  const list = [msg(NOW - D), { role: "system", content: "无时间" }, msg(NOW)];
  assert.equal(S.prevTimed(list, 2), list[0], "拿了那条没时间的当基准，跨没跨天就是假的");
  assert.equal(S.prevTimed(list, 0), null);
  // ts 是 ISO 串的老消息也认（chat_archive 导回来的那批）
  assert.equal(S.timeOf({ ts: "2026-09-16T12:00:00" }), NOW);
  assert.ok(Number.isNaN(S.timeOf({})));
});

test("时间倒着走的坏数据不出条（导入的存档里有过）", () => {
  assert.equal(S.decide(msg(NOW), msg(NOW - 60000), { now: NOW }).show, false);
});

// ── 两处都真的搬过去了 ──────────────────────────────────────
test("单聊和群聊都改用公共那一份，没有第二套算法留在原地", () => {
  assert.match(comp, /window\.ChatStamp\.decide\(window\.ChatStamp\.prevTimed\(messages, i\), m, \{ minGap: 180000 \}\)/, "单聊没搬");
  assert.match(comp, /window\.ChatStamp\.decide\(window\.ChatStamp\.prevTimed\(messages, i\), m, \{ minGap: 30 \* 60 \* 1000 \}\)/, "群聊没搬");
  // 旧的两套手写算法一行都不许留下（施工规则：只开公共的、旧的留原地是最坏的一种）
  assert.ok(!/const sameTurn = previousTimed/.test(comp), "群聊那套手写判据还在");
  assert.ok(!/messages\[i - 1\]\.turnId !== m\.turnId \|\| m\.ts - \(messages\[i - 1\]\.ts \|\| 0\) > 180000/.test(comp), "单聊那套手写判据还在");
  assert.ok(!/groupTimeLabel = sameToday \? clock/.test(comp), "群聊还在自己拼文案");
});

test("新的一天那一条画得比普通时刻明显（data-day 挂着，主题工作室也认得）", () => {
  assert.match(comp, /"data-day": gStamp\.day \? "1" : "0"/);
  assert.match(comp, /"data-day": st\.day \? "1" : "0"/);
});

test("index.html 里挂上了，而且排在 components.js 前面", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const a = html.indexOf("js/chat-stamp.js");
  const b = html.indexOf("js/components.js");
  assert.ok(a > 0, "没挂进去——挂不上就是 window.ChatStamp undefined，整屏白");
  assert.ok(a < b, "得排在 components.js 前面");
});
