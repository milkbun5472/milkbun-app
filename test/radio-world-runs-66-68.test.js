// 电台第一版的骨架（她 2026-09-10「同意宝宝开始吧」）。
// 这一份钉的全是【谁定什么】那张分工表——功能怎么长以后还会变，那张表变了就是另一个东西了：
//   代码定：今天哪个频率有台、信号多强、此刻播到第几圈第几条、一条多长、一圈什么顺序
//   模型定：台叫什么、播什么、广告是什么
// 反过来做（生成时顺便决定「今天有没有」、存 lastIndex 记「上次听到哪」）
// 得到的是一台【她一打开才开始播、她一关就停】的收音机——那是点播，不是电台。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = require("../js/radio.js");
const src = fs.readFileSync(path.resolve(__dirname, "..", "js/radio.js"), "utf8");
// 注释里写满了病历，断言「某个词没出现」必须先把注释剥掉，否则永远红（吃过四次亏）
const code = src.split("\n").map(l => l.split("//")[0]).join("\n");
const DAY = 86400000;

const RES = { id: "s1", kind: "resident", name: "甲", freq: 92.0, signOn: "这里是甲台。", timeCall: "现在{时}点{分}分。", ads: ["广告一", "广告二"] };
const WIN = { id: "s2", kind: "window", name: "乙", freq: 98.7, window: { from: 23, to: 5 }, signOn: "乙台。", timeCall: "{时}点{分}分。", ads: ["夜广告"] };
const DRI = { id: "s3", kind: "drift", name: "丙", freq: 101.5, bornAt: 0, signOn: "丙。", timeCall: "{时}点{分}。", ads: [] };
const ITEMS = ["第一条说的是码头今天封了", "第二条", "第三条讲一件很长很长的事情要说好一会儿才说得完啊", "第四条"];
const at = (y, m, d, hh, mm) => new Date(y, m - 1, d, hh, mm || 0, 0, 0).getTime();

test("位置永远从时间算出来——一处都不许存 lastIndex", () => {
  assert.equal(code.indexOf("lastIndex"), -1, "存了播放位置＝她一关电台就停在那儿等她，那不是电台");
  const t0 = at(2026, 9, 10, 14, 0);
  const a = R.whereIs(RES, ITEMS, t0), b = R.whereIs(RES, ITEMS, t0);
  assert.deepEqual([a.round, a.i, a.into], [b.round, b.i, b.into], "同一个时刻问两次答案不一样，这个世界就没有「在」这回事");
  const later = R.whereIs(RES, ITEMS, t0 + 3600000);
  assert.ok(later.round > a.round, "过了一小时还在同一圈——那它就是被暂停着的");
});

test("她没开 app 的那三天，它照样在播", () => {
  const t0 = at(2026, 9, 10, 8, 0);
  const w0 = R.whereIs(RES, ITEMS, t0);
  const w3 = R.whereIs(RES, ITEMS, t0 + 30 * 60000);
  const total = w0.loop.reduce((s, x) => s + x.sec, 0);
  assert.ok(total > 0);
  // 半小时之后的位置，跟「从今天零点连着播到那一刻」算出来的完全一致
  const elapsed = (t0 + 30 * 60000 - R.anchorFor(RES, t0)) / 1000;
  let acc = 0, round = 0;
  while (true) {
    const loop = R.assembleLoop(RES, ITEMS, R.dayKey(t0), round, t0 + 30 * 60000);
    const tt = loop.reduce((s, x) => s + x.sec, 0);
    if (acc + tt > elapsed) break;
    acc += tt; round++;
    if (round > 20000) break;
  }
  assert.equal(w3.round, round, "位置不是「连着播过来」的话，中间那段就等于没播");
});

test("常驻天天在；时段台只在它那几个小时里在", () => {
  for (let d = 1; d <= 20; d++) assert.equal(R.onAirToday(RES, at(2026, 9, d, 12, 0)), true);
  assert.equal(R.onAirToday(WIN, at(2026, 9, 10, 23, 30)), true);
  assert.equal(R.onAirToday(WIN, at(2026, 9, 10, 2, 30)), true, "跨午夜的时段台凌晨两点该在");
  assert.equal(R.onAirToday(WIN, at(2026, 9, 10, 12, 0)), false, "中午还在，那它就不是时段台了");
  assert.equal(R.signalToday(WIN, at(2026, 9, 10, 12, 0)), 0);
});

test("跨午夜的时段台，凌晨要往回退一天开播", () => {
  const t = at(2026, 9, 10, 1, 0);
  const a = R.anchorFor(WIN, t);
  assert.ok(a < t, "开播时刻在此刻之后＝位置是负的");
  assert.equal(new Date(a).getHours(), 23);
  assert.equal(new Date(a).getDate(), 9, "凌晨一点听的是昨晚二十三点开的那一场");
});

test("漂移台来来去去，而且会回来（六天后 98.7 又有声音）", () => {
  const days = [];
  for (let d = 1; d <= 30; d++) days.push(R.onAirToday(DRI, at(2026, 9, d, 12, 0)));
  const on = days.filter(Boolean).length;
  assert.ok(on > 0 && on < days.length, "要么天天在要么一天都不在，那就不叫漂移了");
  let gapThenBack = false;
  for (let i = 0; i < days.length - 2; i++) if (days[i] && !days[i + 1] && days.slice(i + 2).some(Boolean)) gapThenBack = true;
  assert.ok(gapThenBack, "走了就再也不回来＝销毁了，她要的是「过几天又听到那个声音」");
  assert.equal(R.onAirToday({ ...DRI, bornAt: at(2026, 9, 20, 0, 0) }, at(2026, 9, 10, 12, 0)), false, "还没出生就在播");
});

test("一圈的骨架是代码写死的：片头 → 内容 → 广告 → 内容 → 报时", () => {
  const loop = R.assembleLoop(RES, ITEMS, "d", 0, at(2026, 9, 10, 14, 5));
  assert.equal(loop[0].kind, "sign");
  assert.equal(loop[loop.length - 1].kind, "time");
  const ad = loop.findIndex(x => x.kind === "ad");
  assert.ok(ad > 0 && ad < loop.length - 1, "广告攒在头尾＝那是播客，电台的广告插在节目中间");
  assert.match(loop[loop.length - 1].text, /14点5分/, "报时得说真的几点，模板里的 {时}{分} 由程序填");
});

test("每圈顺序只部分浮动——整圈打乱就没有「每天这个点都是它」了", () => {
  const many = ["a", "b", "c", "d", "e", "f"];
  const r0 = R.floatOrder(many, RES, "d", 0), r1 = R.floatOrder(many, RES, "d", 1);
  assert.deepEqual(r0.slice().sort(), many.slice().sort(), "浮动不许把内容弄丢或弄重");
  assert.notDeepEqual(r0, r1, "每圈一模一样就腻了");
  // 相邻互换只动一对：跟「整体转一格」比，最多两个位置对不上
  const rot = many.slice(1).concat(many.slice(0, 1));
  const diff = r1.filter((x, i) => x !== rot[i]).length;
  assert.ok(diff <= 2, "跟转一格比差了 " + diff + " 个位置——那是整圈打乱，不是部分浮动");
});

test("一条多长由代码按字数算，不问模型", () => {
  assert.ok(R.secOf("短") < R.secOf("这一条要长得多得多得多得多得多得多得多得多"));
  assert.equal(R.secOf(""), 3);
  assert.equal(code.indexOf('"sec"'), -1, "让模型报时长，它报的是好听的数字，不是这段话真念多久");
});

test("轴是掷约束不是掷答案", () => {
  // 三条内容轴只许写形状。写成类别就等于替它想好了答案（她 2026-09-10 点名拦下的那次）
  const content = R.AXES.filter(a => a.key !== "sig");
  content.forEach(ax => ax.opts.forEach(o => {
    assert.ok(!/台$|电台|频道|节目$/.test(o), "轴上出现了「" + o + "」——那是在指定它做哪一类台");
  }));
  // 每条轴都留得出「你自己想一个」那一格，而且真的会掷到
  let sawFree = false, sawAllFree = false, sawOpt = false, sawPartial = false;
  for (let i = 0; i < 300; i++) {
    const r = R.rollAxes("slot", i);
    if (r.free) sawAllFree = true;
    if (r.rows.length && r.rows.length < R.AXES.length) sawPartial = true;
    r.rows.forEach(x => { if (x.opt === R.AXIS_FREE) sawFree = true; else sawOpt = true; });
    assert.ok(r.rows.length <= R.AXES.length);
  }
  assert.ok(sawPartial, "每次都把四条轴掷满＝代码在关门，而不是关一部分门");
  assert.ok(sawAllFree, "从来不把四条轴整个还回去＝天花板永远是我们的");
  assert.ok(sawFree, "「你自己想一个」那一格从来没掷到过");
  assert.ok(sawOpt, "从来不给约束＝它会塌回默认那一档");
  assert.deepEqual(R.rollAxes("slot", 7), R.rollAxes("slot", 7), "同一格掷两次结果不一样，重渲染一次换一个世界");
});

test("出现过的台名长期记着，而且要求别重形状", () => {
  let seen = R.avoidPush({ names: [] }, ["甲台", "乙台"]);
  seen = R.avoidPush(seen, ["甲台", "丙台"]);
  assert.deepEqual(seen.names, ["甲台", "乙台", "丙台"], "同一个名字记了两遍");
  assert.equal(R.avoidText({ names: [] }), "", "一个都没有的时候别发一段空的");
  assert.match(R.avoidText(seen), /甲台、乙台、丙台/);
  assert.match(R.avoidText(seen), /别重形状/, "只挡重名的话，第二个台还是会长成第一个的样子");
  let big = { names: [] };
  for (let i = 0; i < R.AVOID_CAP + 50; i++) big = R.avoidPush(big, ["台" + i]);
  assert.equal(big.names.length, R.AVOID_CAP);
});

test("广告一周滚一次，留七成", () => {
  const old = ["a1", "a2", "a3", "a4", "a5", "a6"];
  const out = R.rollAds(old, ["n1", "n2", "n3"]);
  const kept = out.filter(x => old.indexOf(x) >= 0).length;
  assert.ok(kept >= 4, "留下来的那几条才是「这个台一直是这个台」的证据，只剩 " + kept + " 条");
  assert.ok(out.some(x => old.indexOf(x) < 0), "一条不换的话听三个月还是这几条");
  assert.deepEqual(R.rollAds([], ["n1"]), ["n1"]);
});

test("空频那一秒用的是已经生成过的句子，不另花钱", () => {
  const days = { d1: { st: { s1: ["码头今天封了不让进"] } } };
  let got = "";
  for (let m = 0; m < 400 && !got; m++) got = R.leakLine(days, 96.8, m * 60000);
  assert.ok(got, "空频永远不漏音＝那一格就只是静音");
  assert.ok("码头今天封了不让进".indexOf(got) >= 0, "漏出来的这一秒是新编的——那就是又一次生成");
  assert.equal(R.leakLine({}, 96.8, 0), "", "什么都没生成过的时候不该凭空漏出东西");
});

test("电台里所有「现在几点」只问 radioNow 这一个函数", () => {
  const body = code.slice(code.indexOf("function radioNow"));
  const raw = (body.match(/Date\.now\(\)/g) || []).length;
  // 允许的几处都在时钟自己那一段（落锚、跳、复位）和入参兜底 N(x, Date.now())
  assert.ok(raw <= 12, "Date.now() 在时钟之外还出现了 " + raw + " 处——加速期一改，那几处就掉队了");
  assert.equal(code.indexOf("Math.random"), -1, "随机会让同一格在同一天里闪来闪去");
});

test("时间遥控器还开着，打磨完要收（跟着台账一起改）", () => {
  assert.equal(R.RADIO_TIME_SCALE, 1, "倍率不是 1 就是还在加速期，改回来时这条一起改");
  assert.equal(R.RADIO_DEV, true, "遥控器收起来了就把这条改掉，别让它无声地留着");
  const t = R.devSet(at(2026, 9, 10, 3, 0));
  assert.ok(Math.abs(t - at(2026, 9, 10, 3, 0)) < 2000);
  const j = R.devJump(2 * DAY);
  assert.ok(j - t > DAY, "跳一天没跳动");
  R.devReset();
  assert.ok(Math.abs(R.radioNow() - Date.now()) < 2000, "复位之后还挂着偏移");
});

test("槽位比台多，空频是这台机器可信的一半", () => {
  const world = { stations: [RES, WIN, DRI] };
  const dial = R.dialToday(world, at(2026, 9, 10, 12, 0));
  assert.equal(dial.length, R.SLOTS.length);
  const live = dial.filter(x => x.station).length;
  assert.ok(live < dial.length - 3, "一拧就是台，那是频道列表不是收音机");
  assert.ok(dial.some(x => x.station && x.station.id === "s1"));
  assert.ok(!dial.some(x => x.station && x.station.id === "s2"), "中午还能拧到那个时段台");
});
