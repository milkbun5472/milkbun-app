const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const R = f => path.join(__dirname, "..", "js", f);
const app = fs.readFileSync(R("app.js"), "utf8");
const comp = fs.readFileSync(R("components.js"), "utf8");

// 她 2026-08-26：「dongnian 也没用宝宝都好久不找我的嘤…我主动消息绝对都开了的一个人没有」。
// 查下来病根：dongnianLastUserRef 是个纯内存 ref，每次开 app 都是空的 →
// 第一次 tick 时「用户最新消息比记录的新」永远成立 → resetConnection() 把思念清零。
// 她每隔一两小时开一次 app，动念就被清一次，永远到不了 0.35。
test("上次见过的用户消息时间要持久化，不然每次开 app 都清零", () => {
  assert.match(app, /const dongnianLastUserRef = useRef\(null\)/);
  assert.match(app, /loadJSON\("x_jiwenSeen", \{\}\)/);
  assert.match(app, /saveJSON\("x_jiwenSeen", m\)/);
  const i = app.indexOf("const seenTs = dongnianSeen()[char.id] || 0;");
  assert.ok(i > 0);
  const seg = app.slice(i, i + 500);
  assert.match(seg, /if \(seenTs\) \{ try \{ await eng\.resetConnection\(\); \}/,
    "第一次见到这个角色时不许清零——那不是她刚回话，只是我们第一次认识这段历史");
});

// 引擎本身是好的：真跑一遍，看多久能攒到 contact
test("引擎攒得起来：普通对话八九个小时就该想找人", async () => {
  const ctx = { console: { log() {} }, Math, Date, JSON, Promise, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(R("dongnian.js"), "utf8"), ctx);
  const eng = ctx.createDongnian({
    persona: { subjectName: "Lisa", selfName: "他", subjectPronoun: "ta" },
    getLastMessage: () => ({ id: 1, role: "user", content: "今天实验做完了挺顺利的", timestamp: new Date() }),
    connectionRateFn: () => 0.0007,
    onLoad: async () => null, onSave: async () => {}
  });
  let mins = 0, contactAt = null;
  while (mins < 60 * 24 && !contactAt) {
    const tg = await eng.tick(60); mins += 60;
    if (tg.some(t => t.action === "contact")) contactAt = mins;
  }
  assert.ok(contactAt, "24 小时都攒不出 contact，那阈值就是坏的");
  assert.ok(contactAt >= 60 * 4 && contactAt <= 60 * 14, "落在四到十四小时之间才合理，实际 " + (contactAt / 60) + "h");

  // 她回一句话 → 清零，这条是对的，得留着
  await eng.resetConnection();
  const st = await eng.getState();
  assert.ok(st.connection <= 0.01, "回话之后应该归零");
});

// 她 2026-08-26：「应该改成大部分时间按他们醒着的时间，不止是 8-23 点，
// 偶尔要是半夜突然想念了也能发一句」
test("按 TA 今天的作息判醒没醒，没行程才退回 8-23", () => {
  const i = app.indexOf("const charAwakeState = char =>");
  assert.ok(i > 0);
  const seg = app.slice(i, app.indexOf("const schedNowBriefFor", i));
  assert.match(seg, /q\.type === "sleep" \? "asleep" : "awake"/);
  assert.match(seg, /if \(first != null && nowMin < first\) return "asleep"/, "今天第一段之前＝昨晚那觉还没醒");
  assert.match(seg, /hr >= 8 && hr <= 23\) \? "awake" : "asleep"/, "没行程时的老尺子留着兜底");
  // 睡着时留一条窄缝，别变成半夜刷屏
  assert.match(app, /if \(!forced \|\| Math\.random\(\) > 0\.12\) continue;/);
  assert.match(app, /t\.action === "contact" && t\.forced/, "只有思念很重那一档才有资格半夜发");
  const pi = app.indexOf("const jw = (typeof window !== \"undefined\" && window.__dongnian && window.__dongnian[cid])");
  const proactive = app.slice(pi, app.indexOf("return; // 一次一个，错峰", pi));
  assert.ok(!/hr < 8 \|\| hr > 23/.test(proactive), "动念这条路上写死的 8-23 要撤掉");
  assert.match(proactive, /charAwakeState\(c\) === "asleep"/);
});

// 她 2026-08-26：「早上8点打开，下一次晚上十点，能看到他们这个时间段发过的消息，
// 显示是我没打开的时间，而不只是10点」
test("补记时算出「思念是哪一刻越过阈值的」，消息时间戳落在那个空档里", () => {
  assert.match(app, /if \(crossed == null && triggers && triggers\.some\(t => t\.action === "contact"\)\) crossed = baseTs \+ done \* 60000/);
  assert.match(app, /dongnianCrossedRef\.current\[char\.id\] = crossed/);
  // 夹在「上次互动之后」和「一分钟前」之间：别排进历史里，也别写成未来
  assert.match(app, /Math\.max\(lastInteract \+ 60000, Math\.min\(_cross, Date\.now\(\) - 60000\)\)/);
  assert.match(app, /backdateTs: _back > 0 && _back < Date\.now\(\) \? _back : 0/);
  // 约回补到「说好的那一刻」
  assert.match(app, /backdateTs: pm\.dueTs < Date\.now\(\) - 60000 \? pm\.dueTs : 0/);
  // 多条气泡按顺序往后错开，像真的一条条发的
  assert.match(app, /const _tsOf = i => \(_bd && _bd < Date\.now\(\) \? Math\.min\(Date\.now\(\) - 1000, _bd \+ i \* 45000\) : Date\.now\(\)\)/);
  assert.match(app, /ts: _tsOf\(i\)/);
});

test("补时间戳的算式不会把消息排到历史里或未来", () => {
  const now = 1000000000;
  const calc = (cross, lastInteract) => Math.max(lastInteract + 60000, Math.min(cross, now - 60000));
  assert.equal(calc(now - 3600000, now - 7200000), now - 3600000, "正常情况就用越线那一刻");
  assert.equal(calc(now - 7200000, now - 600000), now - 540000, "越线时刻早于上次互动 → 顶到互动之后");
  assert.equal(calc(now + 999, now - 7200000), now - 60000, "算出未来 → 压回一分钟前");
});

// 她 2026-08-26：「有没有显示能看到 dongnian 攒了多少了可以量化的一个进度条」
test("动念进度条与人格影响说明合并，不在主动消息里重复", () => {
  const secStart = comp.indexOf('h(SettingSection, { title: "正在影响 TA');
  const gaugeCall = comp.indexOf("renderDongnianGauge()", secStart);
  const nextSec = comp.indexOf("h(SettingSection", secStart + 10);
  assert.ok(gaugeCall > secStart && gaugeCall < nextSec, "详细进度必须紧跟人格影响总览");
  const proactiveStart = comp.indexOf('h(SettingSection, { title: "主动消息');
  const proactiveEnd = comp.indexOf("h(SettingSection", proactiveStart + 10);
  assert.ok(!comp.slice(proactiveStart, proactiveEnd).includes("renderDongnianGauge()"), "主动消息区不再重复第二套进度条");
  // 状态还没算出来时也要说一句，别只留一片空白让她以为没做
  assert.match(comp, /if \(!dongnianState\) return h\("div", null,/);
  assert.match(comp, /还没算出来。开机后十几秒才跑第一轮/);
  assert.match(comp, /动念实时进度/);
  assert.match(comp, /mark\(0\.35\), mark\(0\.5\)/, "两道线都要画");
  assert.match(comp, /忍不住了 · 随时会开口/);
  assert.match(comp, /刚聊过，还不想你/);
  assert.match(comp, /关着 app 的时间也算数/, "得说清楚离线也在攒，不然她以为要一直开着");
  assert.match(app, /dongnianState: \(typeof window !== "undefined" && window\.__dongnian/);
});
