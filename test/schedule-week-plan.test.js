const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = read("app.js"), engine = read("engine.js"), screens = read("screens.js");

const i = screens.indexOf("function schedFillEnds(");
const _sched = new Function('function pad2(n){return String(n).padStart(2,"0")}\n'
  + screens.slice(i, screens.indexOf("\nfunction schedActIcon")) + "\nreturn { schedFillEnds, schedSleepCarry };")();
const schedFillEnds = _sched.schedFillEnds, schedSleepCarry = _sched.schedSleepCarry;

test("每段都有结束时刻，块才画得出高度", () => {
  const r = schedFillEnds([{ time: "08:00", title: "a" }, { time: "10:00", end: "12:00", title: "b" }]);
  assert.equal(r[0].end, "10:00", "顶到下一段开始");
  assert.equal(r[1].end, "12:00", "模型自己填的不许被改写");
});

test("自动补的时长最多三小时——中间空着的是没排事，不是干了一下午", () => {
  const r = schedFillEnds([{ time: "13:30", title: "x" }, { time: "23:40", title: "y" }]);
  assert.equal(r[0].end, "16:30");
});

test("跨午夜收口写 24:00，不绕回 00:00（那会画成负高度）", () => {
  assert.equal(schedFillEnds([{ time: "23:40", title: "睡" }])[0].end, "24:00");
});

test("没有时刻的段落原样放过，不硬编一个 end", () => {
  const r = schedFillEnds([{ title: "没写时间" }]);
  assert.equal(r[0].end, undefined);
});

// 她 2026-08-26：「有时候会以发生了的口吻排日程，不知道是不是模型不够聪明」——
// 不是模型的锅：schemaHint 里仅有的两个具体样例本身就是过去时，模型能抄的只有它们。
test("schema 里不许有样例内容，更不许是过去时", () => {
  const bad = ["扫了遍报错日志", "洗漱后睡了"];
  bad.forEach(x => assert.ok(!app.includes(x), "这个过去时样例还在：" + x));
  // v64.14：占位值从【样例内容】改成了【说明】——样例会连着那个世界一起被抄走
  //（王爷搬进公寓那次；.claude/rules/prompt-no-content-samples.md）。
  // 时态改由 SCHED_TENSE_RULE 明写，不再靠一句中性样例暗示（见下一条）。
  assert.ok(!app.includes('\\"title\\":\\"洗漱、准备睡\\"'), "又用样例内容当占位值了");
  assert.match(app, /写的是【要做什么】，不是【做完了】/, "那句时态的尺子丢了");
});

test("时态与结束时刻是明写的规矩，不是靠样例暗示", () => {
  assert.match(engine, /const SCHED_TENSE_RULE = /);
  assert.match(engine, /const SCHED_END_RULE = /);
  const tense = engine.slice(engine.indexOf("const SCHED_TENSE_RULE"), engine.indexOf("const SCHED_END_RULE"));
  assert.match(tense, /这一段的开始时刻在此刻之后吗/, "要给一句可判定的尺子");
});

// 三处生成日程的路子都得吃这两条：当天推演 / 一周计划 / 白天自发改计划
test("三条生成路径都发时态和结束时刻规矩", () => {
  const code = app.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  const hits = (code.match(/SCHED_END_RULE/g) || []).length;
  assert.equal(hits, 3, "当天推演 / 一周计划 / 自发改计划，一处都不能漏，实际 " + hits);
  assert.equal((code.match(/SCHED_TENSE_RULE/g) || []).length, 3);
});

test("三条路径落盘时都过 schedFillEnds", () => {
  // 三条生成路径各一处 + charAwakeState 拿它判「此刻是不是睡着」（v56.51）
  assert.equal((app.match(/schedFillEnds\(/g) || []).length, 4);
  ["const genScheduleDay = async", "const genScheduleWeek = async", "const schedMaybeSelfRevise = async"].forEach(anchor => {
    const k = app.indexOf(anchor);
    assert.match(app.slice(k, k + 7000), /schedFillEnds\(/, anchor + " 落盘时没过 schedFillEnds");
  });
});

// 她 2026-08-26 订正了我算错的账：一次调用生成 7 天比 7 次调用便宜
test("一周一次调用，未来那几天是计划、不许带偏差", () => {
  const j = app.indexOf("const genScheduleWeek = async");
  assert.ok(j > 0);
  const seg = app.slice(j, app.indexOf("const schedGenAllToday", j));
  assert.match(seg, /SCHED_PLAN_DAYS/);
  assert.match(seg, /deviation: \(key === today &&/, "只有今天可以有偏差");
  assert.match(seg, /kind: key === today \? "live" : "plan"/);
  assert.match(seg, /if \(!want\.includes\(key\)\) return;/, "模型自己编的日期要丢掉");
  assert.match(seg, /还没发生】整天都是计划/, "每天的性质要标死，别让模型猜");
});

test("计划日变成当天时翻牌子，不重排——落差是活人感的来源", () => {
  const j = app.indexOf("const schedGenAllToday = async");
  const seg = app.slice(j, app.indexOf("const schedMaybeSelfRevise", j));
  assert.match(seg, /p\.kind === "plan"\) saveSchedDay\(c\.id, k, \{ \.\.\.p, kind: "live" \}\)/);
  assert.ok(!/genScheduleDay\(c,/.test(seg), "自动补日程不再一天一次调用");
});

// 她 2026-08-26：「日历怎么自己不会停一直在排！我要它只有周天0点开始排下一周的」。
// 上一版判据是「未来七天里只要缺一天就重排」——模型很难一次真吐满 7 天，缺口一直在，
// 于是每次切回前台都重排一遍，烧的是她的钱。
test("按周记账：一个角色一个周次只排一次，成没成都记账", () => {
  const j = app.indexOf("const schedGenAllToday = async");
  const seg = app.slice(j, app.indexOf("const schedMaybeSelfRevise", j));
  assert.match(seg, /dowMon === 6\) pick\(nextMon, nextMon, 7\)/, "周日 0 点起排下一周");
  assert.match(seg, /if \(!have\[today\]\) pick\(thisMon, today, 7 - dowMon\)/, "引导只补到本周日");
  assert.match(seg, /m\.tries >= SCHED_WEEK_MAX_TRIES \|\| now - m\.ts < SCHED_WEEK_RETRY_MS/, "退避");
  assert.match(seg, /cur\[j\.id\] = \{ ts: Date\.now\(\), tries: ok \? SCHED_WEEK_MAX_TRIES : j\.tries \+ 1 \}/,
    "失败也必须记账，不记就会每次切回前台重来");
  assert.ok(!/some\(k => !have\[k\]\)/.test(seg), "「缺一天就重排」那条判据必须已经删掉");
  assert.match(app, /SCHED_WEEK_MARK_KEY = "x_schedWeekMark"/);
});

// 便宜池（bgActive）——她 2026-08-26 问的，日程一律不许走主池
test("三条排日程的路都走后台便宜池", () => {
  ["const genScheduleDay = async", "const genScheduleWeek = async", "const schedMaybeSelfRevise = async"].forEach(anchor => {
    const k = app.indexOf(anchor);
    assert.ok(k > 0, anchor);
    const seg = app.slice(k, k + 6000);
    const call = /runProbe(?:Retry)?\(\s*(\w+)/.exec(seg);
    assert.ok(call, anchor + " 里没找到 runProbe");
    assert.equal(call[1], "bgActive", anchor + " 走的是 " + call[1] + "，不是便宜池");
  });
});

// 周一=0…周日=6：算错一天，整档就会在错的日子触发
test("周一算 0、周日算 6，周日那天正好落在触发点上", () => {
  const dowMon = d => (d.getDay() + 6) % 7;
  assert.equal(dowMon(new Date(2026, 7, 24)), 0, "8/24 是周一");
  assert.equal(dowMon(new Date(2026, 7, 30)), 6, "8/30 是周日");
  // 引导批次的天数 = 7 - dowMon：周一补 7 天、周日只补今天这一天
  assert.equal(7 - dowMon(new Date(2026, 7, 24)), 7);
  assert.equal(7 - dowMon(new Date(2026, 7, 30)), 1);
});

// 她 2026-08-26：「先试试喂接下来3天的行程」
test("接下来三天喂给单聊，群聊仍然只有此刻那一行", () => {
  const j = app.indexOf("const schedNowFor");
  const seg = app.slice(j, app.indexOf("const schedNowBriefFor", j));
  assert.match(seg, /for \(let i = 1; i <= 3; i\+\+\)/);
  assert.match(seg, /seqs\.slice\(0, 4\)/, "每天最多四项，她按次计费");
  assert.match(seg, /还没发生，别说成已经做了/);
  const brief = app.slice(app.indexOf("const schedBriefFor"), app.indexOf("const schedBriefFor") + 700);
  assert.ok(!brief.includes("接下来"), "群聊那条只给此刻，是写着理由的显式差异");
});

// 她 2026-08-26：「睡觉都只有三个小时这对吗，大家好像都这样」
// ——v56.30 那个「自动补时长最多 3 小时」的封顶，睡觉正是唯一不该封顶的一档。
test("睡觉不封顶三小时，顶到下一段；当天最后一段就睡到 24:00", () => {
  const r1 = schedFillEnds([{ time: "23:40", title: "洗漱、准备睡", type: "sleep" }]);
  assert.equal(r1[0].end, "24:00", "最后一段睡觉要睡过午夜");
  const r2 = schedFillEnds([{ time: "13:00", title: "补觉", type: "sleep" }, { time: "18:30", title: "出门吃饭", type: "meal" }]);
  assert.equal(r2[0].end, "18:30", "睡觉一路顶到下一段，不许被 3 小时截断");
  // 别的活动照旧封顶，免得一个下午只排一件事就画成一大块
  const r3 = schedFillEnds([{ time: "13:30", title: "做实验", type: "work" }, { time: "23:00", title: "睡", type: "sleep" }]);
  assert.equal(r3[0].end, "16:30");
});

// 她同一条：「24点之后第二天凌晨也不会接上继续显示睡觉」
test("昨晚睡到跨日的，第二天凌晨接上", () => {
  const prev = { seqs: [{ time: "08:00", title: "起床", type: "coffee" }, { time: "23:40", title: "洗漱、准备睡", type: "sleep" }] };
  const c = schedSleepCarry(prev, { seqs: [{ time: "07:30", title: "起床", type: "coffee" }] });
  assert.equal(c.from, 0);
  assert.equal(c.to, 450, "睡到今天第一段开始（07:30）为止");
  assert.equal(c.carry, true);
  // 今天还没排 → 按睡到早上八点画，不留空
  assert.equal(schedSleepCarry(prev, null).to, 480);
  // 昨天不是以睡觉收尾 / 没睡过午夜 → 什么都不接
  assert.equal(schedSleepCarry({ seqs: [{ time: "20:00", title: "看剧", type: "rest" }] }, { seqs: [] }), null);
  assert.equal(schedSleepCarry({ seqs: [{ time: "22:00", end: "23:00", title: "小睡", type: "sleep" }] }, { seqs: [] }), null);
});

test("日历真的把这一截画出来了", () => {
  const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
  const seg = comp.slice(comp.indexOf("const blocksOn = dk =>"), comp.indexOf("const dayHasAnything"));
  assert.match(seg, /schedSleepCarry\(\(\(schedules \|\| \{\}\)\[view\] \|\| \{\}\)\[prevKey\], plan\)/);
  assert.match(seg, /key: "carry"/);
  assert.match(seg, /toMyMin\(carry\.from\)/, "接觉这一截也要走时差换算");
});

test("提示词也明说了就寝该多长", () => {
  assert.match(engine, /人要睡七八个小时，不是三小时/);
  assert.match(engine, /type="sleep" 那一段的 end 一律写 "24:00"/);
});
