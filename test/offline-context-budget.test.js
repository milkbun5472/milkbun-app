const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const { select, costOf } = require(path.join(root, "js/chat-context-window.js"));

// 她 2026-08-28：「跑了很多长线下，一堆没用的描写占着字数，本来可以带更多密度的
// 聊天记录都被描写占满了咋办」。两个口子：
// ① 开着的线下和聊天记录抢同一份短期窗预算，而且还抢 ctxN 的名额；
// ② 已结束线下那条 offlinelog 的 transcript（最多 6000 字）压根不计费。

// ---- A：窗口预算要把挂在别的字段上的大头算进去 ----
test("transcript / sum / ccToolResultData 都要计费，不能白嫖窗口", () => {
  assert.equal(costOf({ content: "abc" }), 3 + 48);
  assert.equal(costOf({ content: "abc", transcript: "x".repeat(6000) }), 3 + 48 + 6000);
  assert.equal(costOf({ content: "", sum: "y".repeat(120) }), 48 + 120);
  assert.equal(costOf({ content: "", ccToolResultData: { a: "z".repeat(50) } }),
    48 + JSON.stringify({ a: "z".repeat(50) }).length);
  // 拼 prompt 那边是 slice(0,16000)，估价按同一个上限封顶
  assert.equal(costOf({ content: "", ccToolResultData: { a: "z".repeat(40000) } }), 48 + 16000);
});

test("三场结束的线下不再把 prompt 撑到预算的 1.6 倍", () => {
  let ts = 0;
  const chat = () => ({ role: "user", content: "字".repeat(13), ts: ++ts });
  const log = () => ({ role: "system", kind: "offlinelog", content: "你们刚在线下见了一面。", transcript: "描".repeat(6000), ts: ++ts });
  const msgs = [];
  for (let i = 0; i < 40; i++) msgs.push(chat());
  msgs.push(log());
  for (let i = 0; i < 15; i++) msgs.push(chat());
  msgs.push(log());
  for (let i = 0; i < 15; i++) msgs.push(chat());
  msgs.push(log());
  for (let i = 0; i < 10; i++) msgs.push(chat());
  const picked = select(msgs, { maxChars: 14000, maxMessages: 80 });
  const real = picked.reduce((s, m) => s + String(m.content || "").length + String(m.transcript || "").length + 48, 0);
  assert.ok(real <= 14000, "实际拼进 prompt 的字数仍然超了预算：" + real);
});

// ---- B1 + C：短期窗里线下另算一份，且只有最近几拍给原文 ----
const recent = (() => {
  const i = app.indexOf("      const ctxN = Math.max(0, Number(settingsFor(char.id).ctxN ?? 50));");
  assert.ok(i > 0, "recentChat 那段没了");
  const j = app.indexOf('      return lines.reverse().join("\\n");', i);
  // lines 在函数里是【从新往旧】攒的，正式返回前才 reverse——这里对齐成正式顺序
  const body = app.slice(i, j) + '      return { lines: lines.slice().reverse(), used, usedOff };';
  return (online, offline, budget, ctxN = 50) => new Function(
    "online", "offline", "settingsFor", "char", "profile", "memCfgRef", "window",
    body.replace("const ctxN = Math.max(0, Number(settingsFor(char.id).ctxN ?? 50));", "const ctxN = " + ctxN + ";")
        .replace("const budget = memCfgRef.current.recentBudget || 8000;", "const budget = " + budget + ";"))
    (online, offline, () => ({}), { id: "c", name: "裴照川" }, { name: "Lisa" }, { current: {} }, {});
})();

let ts = 0;
const mk = (role, len, surface) => ({ role, content: "字".repeat(len), ts: ++ts, _surface: surface });
const ONLINE = Array.from({ length: 50 }, (_, k) => mk(k % 2 ? "user" : "assistant", 13, "online"));
const OFFLINE = Array.from({ length: 40 }, (_, k) => mk(k % 2 ? "user" : "assistant", k % 2 ? 15 : 300, "offline"));

test("线下不再占掉 ctxN 的名额：五十条聊天记录一条都不许被挤掉", () => {
  const withOff = recent(ONLINE, OFFLINE, 16000);
  const onlineChars = withOff.used - withOff.usedOff;
  const alone = recent(ONLINE, [], 16000);
  assert.equal(onlineChars, alone.used, "开着线下之后，线上拿到的字数变少了");
});

test("线下最多拿走三成预算、封顶 3000 字", () => {
  assert.match(app, /const offCap = Math\.min\(Math\.round\(budget \* 0\.3\), 3000\);/);
  [8000, 16000].forEach(b => {
    const r = recent(ONLINE, OFFLINE, b);
    assert.ok(r.usedOff <= Math.min(Math.round(b * 0.3), 3000), b + " 预算下线下超额：" + r.usedOff);
  });
});

test("线下超了自己那份要继续往回找线上的，不是整个循环停掉", () => {
  const fat = Array.from({ length: 40 }, (_, k) => mk("assistant", 2000, "offline"));
  const r = recent(ONLINE, fat, 16000);
  assert.ok(r.used - r.usedOff > 0, "线下吃爆之后线上一条都没进来");
  assert.match(app, /if \(isOff && usedOff && usedOff \+ cost > offCap\) continue;/);
});

test("最近三拍给原文，更早的压成摘录——有对话留对话，没有就留句首", () => {
  const beat = "他把宣纸推过去，指节在桌沿敲了一下。「拿友谊堵我，倒真亏你想得出来。」夜风从半开的窗缝里挤进来，把烛火压得矮了一截，墙上的影子跟着晃了晃，屋里安静得能听见糖糕碎在齿间的声音。";
  const beats = Array.from({ length: 8 }, (_, k) => ({ role: "assistant", ts: 500 + k, _surface: "offline", content: k + "｜" + beat }));
  const r = recent([], beats, 16000);
  const tail = r.lines.slice(-3), head = r.lines.slice(0, -3);
  tail.forEach(l => assert.ok(l.indexOf("夜风从半开的窗缝里") > 0, "最近三拍必须是原文：" + l));
  head.forEach(l => {
    assert.ok(l.indexOf("夜风从半开的窗缝里") < 0, "老拍子的描写没被压掉：" + l);
    assert.ok(l.indexOf("拿友谊堵我") > 0, "对话被压没了：" + l);
    assert.ok(l.indexOf("他把宣纸推过去") > 0, "这一拍做了什么被压没了：" + l);
  });
});

test("她自己在线下打的字不占「最近三拍」的名额", () => {
  assert.match(app, /if \(isOff && m\.role !== "user"\) offSeen\+\+;/);
});
