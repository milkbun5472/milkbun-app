// 群友 2026-10-11：「小手机有自定义虚拟时间的功能么？包括年月日时间。平时主玩线下，经常需要调整时间」
// 她：「直接在时间感知那里搞个虚拟时间和流逝速度…悬浮球要是开了可以在这里面直接调」
//    「不要戏里现在，就当成这个世界观的真实时间」「自创一个时间名号」「分面具决定时间感知是真实还是虚拟」
//    「日记照现实写但显示的日期跟随虚拟时间」「日程按现实框架排但也用角色的时间系统」「记忆库也要改」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const engine = R("engine.js"), app = R("app.js"), screens = (R("screens.js") + "\n" + R("screens-ui.js")), comps = R("components.js");
const grab = name => { const i = engine.indexOf("function " + name + "("); assert.ok(i >= 0, name); return engine.slice(i, engine.indexOf("\n}\n", i) + 3); };
const win = {};
const E = new Function("window", ["vclockState", "vclockUse", "vclockCfg", "vclockSeg", "vclockMap", "vclockMapBy", "vclockMainMap", "vclockNow", "vclockYear", "vclockLabel", "fmtClock", "fmtStampAI"].map(grab).join("")
  + "\nreturn { vclockUse, vclockCfg, vclockMap, vclockMainMap, vclockNow, vclockYear, vclockLabel, fmtStampAI };")(win);

test("一张面具一只钟：TA 认哪张面具就走哪只；没开就是现实", () => {
  const now = Date.now(), base = new Date(1999, 11, 31, 23, 0).getTime();
  win.__vclock = { active: null, maskOf: id => id === "b" ? "m2" : "", clocks: { main: { on: true, base, at: now - 3600e3, speed: 2 }, m2: { on: false } } };
  assert.equal(E.vclockMap(now, "a"), base + 7200e3, "主面具那只：现实一小时、两倍速＝两小时");
  assert.equal(E.vclockMap(now, "b"), now, "另一张面具没开：照现实");
  win.__vclock.active = "b";
  assert.equal(E.vclockMainMap(now), base + 7200e3, "周刊这类不属于谁的：永远照主面具，不看这一轮在替谁拼");
  win.__vclock.active = null;
  win.__vclock.clocks.main.speed = 0;
  assert.equal(E.vclockMap(now, "a"), base, "停住");
  E.vclockUse("a");
  assert.match(E.fmtStampAI(now), /^今天23:00$/, "没带 id 的时间戳读这一轮在替谁拼");
  E.vclockUse("b");
  assert.doesNotMatch(E.fmtStampAI(now), /23:00/);
});

test("自创年号：天启从 1997 年算元年，1999 年叫天启3年", () => {
  const now = Date.now(), base = new Date(1999, 11, 31, 23, 0).getTime();
  win.__vclock = { active: "a", maskOf: () => "", clocks: { main: { on: true, base, at: now, speed: 0, era: { name: "天启", from: 1997 } } } };
  assert.equal(E.vclockLabel(now, "a"), "天启3年12月31日 周五 23:00");
  assert.equal(E.vclockLabel(now, "a", false), "天启3年12月31日 周五");
  assert.equal(E.vclockYear(2026, null), "2026年");
});

test("说给 TA 的是这个世界的真实时间，不说「戏里」；四处报时都走这只钟", () => {
  const vsec = ["vclockCfg", "vclockLabel"].map(grab).join("") + engine.slice(engine.indexOf("if (vclockCfg()) timeBlock.push("), engine.indexOf("if (vclockCfg()) timeBlock.push(") + 300);
  assert.doesNotMatch(vsec, /戏里/);
  assert.doesNotMatch(comps, /"戏里现在/);
  assert.match(comps, /"这个世界现在：" \+ vclockShow\(v, cur\)/);
  assert.match(engine, /if \(vclockCfg\(\)\) timeBlock\.push\("【当前真实时间】" \+ vclockLabel\(Date\.now\(\)\)/, "缓存切点那几个字不能动");
  assert.match(engine, /vclockUse\(char && char\.id\);\n  const now = vclockNow\(\);/);
  assert.match(engine, /vclockUse\(ctx\.clockId != null \? ctx\.clockId : null\);   \/\/ 群线下走群挑的那张面具的钟/);
  assert.match(app, /const _replyTurn = async \(charId, extraText, mode, opts\) => \{\n    if \(typeof vclockUse === "function"\) vclockUse\(charId\);/);
  assert.match(app, /const replyGroup = async \(groupId, rgOpts = \{\}\) => \{\n    if \(typeof vclockUse === "function"\) vclockUse\("g:" \+ groupId\);/);
});

test("日记、日程、记忆上的日子都照那个人的钟", () => {
  assert.match(app, /const dateStr = typeof vclockCfg === "function" && vclockCfg\(charId\) \? vclockLabel\(targetTs, charId, false\)/);
  assert.match(screens, /const d = new Date\(!isMe && char && typeof vclockMap === "function" \? vclockMap\(entry\.ts, char\.id\) : entry\.ts\);/);
  assert.match(screens, /function schedDateParts\(k, id\) \{/);
  assert.match(app, /const dp = schedDateParts\(dayKey, char && char\.id\);/);
  assert.match(engine, /window\.TemporalAnchor\.stamp\(_vm\(e\.ts\), _vm\(Date\.now\(\)\)\)/);
  assert.match(screens, /vclockMap\(e\.ts \|\| Date\.now\(\), who == null \? null : who\)/);
});

test("设置页按面具挑钟，悬浮球拨的是这个人认的那张面具；旧的那一只并进主面具", () => {
  assert.match(comps, /function VClockMasks\(\{ masks, primaryId, clocks, onChange \}\)/);
  assert.match(screens, /h\(VClockMasks, \{ masks, primaryId: maskPrimary,/);
  assert.match(app, /window\.__vclock = Object\.assign\(/);
  assert.match(app, /const _clocks = \{ \.\.\.\(prefs\.vclock \? \{ main: prefs\.vclock \} : \{\}\), \.\.\.\(prefs\.vclocks \|\| \{\}\) \};/);
  assert.match(app, /onVClock: v => \{ const k = \(screen === "thread" && activeChar && clockKeyOf\(activeChar\.id\)\) \|\| "main";/);   // 2026-10-16：他自己一只钟开着时拨他那只，没开照旧面具
});

// 她 2026-10-11：「查手机看看能不能也跟着虚拟时间」
test("查手机：TA 翻我的手机时「今天是哪天」、TA 手机的锁屏和日历都照那只钟", () => {
  const phone = (R("phone.js") + "\n" + R("phone-ui.js"));
  assert.match(app, /if \(typeof vclockCfg === "function" && vclockCfg\(charId\)\) return "\\n今天是" \+ vclockLabel\(Date\.now\(\), charId\)/);
  assert.equal((phone.match(/const now = new Date\(char && typeof vclockMap === "function" \? vclockMap\(Date\.now\(\), char\.id\) : Date\.now\(\)\);/g) || []).length, 2);
  // TA 手机里的内容走 runProbe → buildBundle，那一处本来就照这只钟报时
  assert.match(engine, /buildBundle\(ctx\) \+ "\\n\\n【" \+ \(probe\.voice/);
});

// 她 2026-10-11：「往前拨和流逝速度不能自定义吗」
test("速度能自己填，拨多少能自己填（分钟到年，月和年按日历拨）", () => {
  assert.match(comps, /placeholder: "自己填",/);
  assert.match(comps, /const VCLOCK_UNITS = \[\["分钟", 60e3\], \["小时", 3600e3\], \["天", 86400e3\], \["月", 30 \* 86400e3\], \["年", 365 \* 86400e3\]\];/);
  assert.match(comps, /h\(VClockJump, \{ field, fs, onJump: f => put\(\{ base: f\(cur\) \}\) \}\)/);
  assert.match(comps, /d\.setDate\(Math\.min\(day, new Date\(d\.getFullYear\(\), d\.getMonth\(\) \+ 1, 0\)\.getDate\(\)\)\);/);
});

// 群友 2026-10-11：「设置里改成了 11 月，小手机上还是显示现实的日期」「离开小手机后能设置时间静止么」
test("主屏的钟和日历照主面具那只钟；离开小手机时停住", () => {
  assert.match(app, /now: typeof vclockMap === "function" && vclockCfg\(null\) \? new Date\(vclockMap\(/);
  assert.match(comps, /"离开小手机时停住"/);
  assert.match(app, /document\.addEventListener\("visibilitychange", onVis\);/);
  const now = Date.now(), base = new Date(2026, 10, 21, 1, 10).getTime();
  win.__vclock = { active: "a", maskOf: () => "", clocks: { main: { on: true, base, at: now - 3600e3, speed: 1, pauseAway: true, awayAt: now - 3600e3 } } };
  assert.equal(E.vclockMap(now, "a"), base, "走开那一小时不算");
});

// 群友 2026-10-11：「char 感应到的是调整完的时间，就是聊天页面的时间戳还是现实时间」
test("聊天页的时间条、消息列表上的时间照那只钟", () => {
  assert.match(comps, /map: typeof vclockMap === "function" && character \? \(ts => vclockMap\(ts, character\.id\)\) : undefined/);
  assert.match(comps, /map: typeof vclockMap === "function" \? \(ts => vclockMap\(ts, group && group\.id \? "g:" \+ group\.id : null\)\) : undefined/);
  assert.match(comps, /fmtStamp\(last\.ts, c\.id\)/);
  assert.match(comps, /fmtStamp\(last\.ts, "g:" \+ g\.id\)/);
  assert.match(engine, /function fmtStamp\(ts, id\) \{/);
});
