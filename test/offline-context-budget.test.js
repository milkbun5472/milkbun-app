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
  const j = app.indexOf('      lines.reverse();', i);
  assert.ok(j > i, "收尾那几行变了");
  // lines 在函数里是【从新往旧】攒的，正式返回前才 reverse——这里对齐成正式顺序
  const body = app.slice(i, j) + '      return { lines: lines.slice().reverse(), used, usedOff };';
  return (online, offline, budget, ctxN = 50, days = 0) => new Function(
    "online", "offline", "offSummary", "settingsFor", "char", "profile", "memCfgRef", "window",
    body.replace("const ctxN = Math.max(0, Number(settingsFor(char.id).ctxN ?? 50));", "const ctxN = " + ctxN + ";")
        .replace("const budget = memCfgRef.current.recentBudget || 8000;", "const budget = " + budget + ";")
        .replace("const recentDays = Math.max(0, Number(memCfgRef.current.recentDays ?? 3));", "const recentDays = " + days + ";"))
    (online, offline, "", () => ({}), { id: "c", name: "裴照川" }, { name: "Lisa" }, { current: {} }, {});
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

// B2（她 2026-08-28 定的取法）：老拍子**只留对话符里的东西和它前后各一句**，
// 其余交给本场滚动摘要。真正影响后面接话的是「谁说了什么、说这句之前之后在干什么」，
// 写景和感官过了这一刻就只剩占字数。
const BEAT = "画的那道墨痕在夜风里彻底发硬了，笑一下都扯着皮肉。他没动，只把宣纸又往前推了半寸。"
  + "她伸手去够那块糖糕。「退什么退，你给我回来。」他终于开口，声音压得很低。"
  + "窗外更漏敲了三下，院子里有人提着灯笼走过，光在窗纸上拖出一道长影。";

test("最近三拍给原文，更早的只留对话和它前后各一句", () => {
  // 要先跑得够长、线下那份限额装不下原文，摘录才会触发（短线下一个字都不摘）
  const beats = Array.from({ length: 30 }, (_, k) => ({ role: "assistant", ts: 500 + k, _surface: "offline", content: k + "｜" + BEAT }));
  const r = recent([], beats, 16000);
  const tail = r.lines.slice(-3), head = r.lines.slice(0, -3);
  tail.forEach(l => assert.ok(l.indexOf("窗外更漏敲了三下") > 0, "最近三拍必须是原文：" + l));
  assert.ok(head.length >= 4, "老拍子太少，测不出来");
  head.forEach(l => {
    assert.ok(l.indexOf("退什么退，你给我回来") > 0, "对话被压没了：" + l);
    assert.ok(l.indexOf("她伸手去够那块糖糕") > 0, "对话前那一句该留：" + l);
    assert.ok(l.indexOf("他终于开口") > 0, "对话后那一句该留：" + l);
    assert.ok(l.indexOf("窗外更漏敲了三下") < 0, "离对话两句远的写景没被压掉：" + l);
    assert.ok(l.indexOf("画的那道墨痕") < 0, "离对话两句远的写景没被压掉：" + l);
  });
});

test("整拍一句对话都没有时只留首句——不整条丢掉，滚动摘要总落后几拍", () => {
  const mute = "他起身走到窗边，把半开的窗合上。夜风一下子断了，烛火重新立直。墙上的影子不再晃。".repeat(3);
  const beats = Array.from({ length: 30 }, (_, k) => ({ role: "assistant", ts: 600 + k, _surface: "offline", content: k + "｜" + mute }));
  const head = recent([], beats, 16000).lines.slice(0, -3);
  head.forEach(l => {
    assert.ok(l.indexOf("他起身走到窗边") > 0, "首句该留：" + l);
    assert.ok(l.indexOf("墙上的影子不再晃") < 0, "后面的写景该压掉：" + l);
  });
});

test("切句不许切进引号里——台词里的句号是台词的", () => {
  const i2 = app.indexOf("      const splitSents = t => {");
  const j2 = app.indexOf("      const offlineBeatDigest = text => {", i2);
  const splitSents = new Function(app.slice(i2, j2) + "return splitSents;")();
  const got = splitSents("他敲了一下桌子。「拿友谊堵我，倒真亏你想得出来。」她没接。");
  assert.deepEqual(got, ["他敲了一下桌子。", "「拿友谊堵我，倒真亏你想得出来。」", "她没接。"]);
});

test("被摘掉的那些不是丢了：本场滚动摘要要带上来", () => {
  assert.match(app, /offSummary = \(active && active\.summary \? String\(active\.summary\)\.trim\(\) : ""\)\.slice\(-1200\)/);
  assert.match(app, /if \(offSummary\) lines\.unshift\("【这场线下前面发生过的（摘要）】/);
});

test("她自己在线下打的字不占「最近三拍」的名额", () => {
  assert.match(app, /if \(isOff && m\.role !== "user"\) offSeen\+\+;/);
});

// ---- 短期窗覆盖天数：这根拉条以前是纯摆设 ----
// 她 2026-08-28 问「记忆库这些拉条是摆设吗」。recentDays 只出现在默认值、滑条和滑条
// 底下那句「最近这些天说的话一定带进上下文（消死区）」里，从来没有一行代码读过它。
const DAY = 86400000;
const spread = (n, prefix, agoDays, now) =>
  Array.from({ length: n }, (_, k) => ({
    role: k % 2 ? "user" : "assistant", content: prefix + k, _surface: "online",
    ts: now - agoDays * DAY + k * Math.floor((agoDays * DAY) / (n + 1))
  }));

test("recentDays 必须真的被读到，不是只躺在默认值和滑条里", () => {
  assert.match(app, /Number\(memCfgRef\.current\.recentDays \?\? 3\)/, "没人读它就等于没写");
  assert.match(app, /const floorTs = recentDays \? Date\.now\(\) - recentDays \* 86400000 : 0;/);
  assert.match(app, /if \(!inFloor && used \+ cost > budget && lines\.length\) break;/, "地板要能顶住字符预算");
});

test("落在这几天里的聊天记录，既不受 ctxN 条数限制、也不被预算挤掉", () => {
  const now = Date.now();
  const recentMsgs = spread(200, "新", 6, now);
  const oldMsgs = spread(300, "老", 20, now).map(m => ({ ...m, ts: now - 20 * DAY + (m.ts % 1000) }));
  const all = oldMsgs.concat(recentMsgs).sort((a, b) => a.ts - b.ts);
  const off = recent(all, [], 1000, 50, 0);   // 地板关：ctxN 说了算
  const on7 = recent(all, [], 1000, 50, 7);   // 地板 7 天
  assert.equal(off.lines.length, 50, "地板关掉时仍按 ctxN 走");
  assert.equal(on7.lines.filter(l => l.indexOf(": 新") > 0).length, 200, "最近六天的两百条没全带进来");
  assert.ok(on7.used > 1000, "地板没顶住字符预算，被 1000 字截了");
});

test("地板只保聊天记录，不保线下描写——线下仍受自己那份限额", () => {
  const now = Date.now();
  const on = spread(50, "聊", 6, now);
  const off = Array.from({ length: 40 }, (_, k) => ({
    role: k % 2 ? "user" : "assistant", content: "描".repeat(k % 2 ? 15 : 300),
    ts: now - 3600000 + k * 1000, _surface: "offline"
  }));
  const r = recent(on, off, 8000, 50, 7);
  assert.ok(r.usedOff <= Math.min(Math.round(8000 * 0.3), 3000), "线下跟着地板一起免检了：" + r.usedOff);
});

test("地板不是无底洞：几天里聊了五百条，取最近三百条", () => {
  const now = Date.now();
  const chatty = spread(500, "多", 2, now);
  assert.equal(recent(chatty, [], 1000, 50, 7).lines.length, 300);
  assert.match(app, /const FLOOR_MAX = 300;/);
});

// 她 2026-08-28 问：「一次线下只跑了六轮没到摘要门槛，回到线上是怎么喂进去的？」
// ——滚动摘要要攒够 50 条才跑，六轮时一个字都没有。所以短线下什么都不能丢。
test("短线下一个字都不摘：装得下就全给原文", () => {
  const short = Array.from({ length: 12 }, (_, k) => ({ role: "assistant", ts: 700 + k, _surface: "offline", content: k + "｜" + BEAT }));
  recent([], short, 16000).lines.forEach(l =>
    assert.ok(l.indexOf("窗外更漏敲了三下") > 0, "短线下不该摘：" + l));
  assert.match(app, /const offNeedsDigest = offSlice\.reduce/);
});

test("摘录换来的是往回看得更远，不只是省字数", () => {
  assert.match(app, /const OFF_BEATS = 40;/);
  const long = Array.from({ length: 30 }, (_, k) => ({ role: "assistant", ts: 800 + k, _surface: "offline", content: k + "｜" + BEAT }));
  const r = recent([], long, 16000);
  assert.ok(r.lines.length >= 15, "摘完之后带进来的拍数反而变少了：" + r.lines.length);
  assert.ok(r.usedOff <= 3000, "线下仍要卡在自己那份限额里：" + r.usedOff);
});
