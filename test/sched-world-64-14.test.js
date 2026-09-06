// 王爷搬进公寓了（她 2026-09-05：「我之前资料丢了重新找回来然后王爷就变成在公寓里了，
// 原来是会在他府里或者去喂马之类的」）。
//
// ⚠️不是她的资料坏了——是【行程这两处的提示词自己把现代生活示范了一遍】：
//   · schemaHint 的占位值写着「起床，晨间咖啡 / 家里卧室、厨房 / 洗漱、准备睡 / 卧室」；
//   · 指令里还列着「医学生＝查房、程序员＝跑数据、老师＝备课、别硬编办公室活」。
//   模型照抄格式的时候，把那个【世界】一起抄了过去。
//   .claude/rules/prompt-no-content-samples.md 当时就点过这一条：
//   「schemaHint 里的占位值要写成【说明】，不要写成【样例内容】——那一份也会被照抄」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), eng = R("engine.js");
// 只看真代码：注释里为了说清病因照抄了那几句旧文案
const code = app.split("\n").filter(l => l.trim().indexOf("//") !== 0).join("\n");

test("两处 schemaHint 里不许再有【样例内容】", () => {
  ["起床，晨间咖啡", "家里卧室/厨房", "家里厨房", '\\"location\\":\\"卧室\\"', "洗漱、准备睡"]
    .forEach(x => assert.equal(code.indexOf(x), -1, "占位值里还写着样例内容：" + x));
  // 换成说明：两处都要
  assert.equal((code.match(/这一段他在做什么（这个身份的人真会做的具体事）/g) || []).length, 2, "两处 schemaHint 没都换过来");
  // v64.24 起分成两栏：location 写细的（具体处所），place 写粗的（城／坊市，地图靠它认人）
  assert.equal((code.match(/在哪儿（细到具体处所，贴着他那个世界）/g) || []).length, 2);
  assert.equal((code.match(/这会儿他人在哪个【大地方】/g) || []).length, 2, "两处 schemaHint 没都要 place");
});

test("指令里那串现代职业清单删干净了", () => {
  ["医学生＝上课", "程序员才写代码", "老师＝备课", "厨师＝备料", "别硬编办公室活", "工作室 → 厨房"]
    .forEach(x => assert.equal(code.indexOf(x), -1, "还留着现代示范：" + x));
  // 换成判据（换个人还成立就是没写）
  assert.match(code, /换个人也照样成立的写法（「上班」「开会」「处理事务」）就是没写/);
});

test("「先认准他属于哪个世界」独立成一条，而且两处都发", () => {
  // ⚠️独立成立的规则就让它独立成立，别挂在别人身上搭便车（v55.90 那条）
  assert.match(eng, /const SCHED_WORLD_RULE = `【先认准他属于哪个世界，再排这一天】/);
  assert.match(eng, /绝不许出现公寓、通勤、上班打卡、咖啡店、便利店、手机、电脑/);
  assert.match(eng, /这一段搬到另一个时代还成立吗/, "没写判据，只写禁令会漏");
  // type 那几个词是给图标用的，不是剧情——coffee 尤其容易被当成「他要喝咖啡」
  assert.match(eng, /coffee 只是「一段用来醒神／提神的时间」/);
  // 单天那处 + 整周那处，一处都不许漏（一层写在两处）
  assert.equal((code.match(/SCHED_WORLD_RULE/g) || []).length, 2, "两条链没都吃到");
  assert.match(code, /schedPeerBlock\(char, \[dayKey\]\) \+ "\\n" \+ SCHED_WORLD_RULE/);
  assert.match(code, /\+ "\\n" \+ SCHED_WORLD_RULE \+ "\\n" \+ SCHED_END_RULE/);
});

test("她自己重排的那个入口还在（不满意就再排一次）", () => {
  const comp = R("components.js");
  assert.match(comp, /onGenWeek && onGenWeek\(curChar\)/);
  assert.match(comp, /genWeekBusy \? "　　正在排…" : "✨　AI 排剩下这几天"/);
  // 重排要真的盖掉旧的：force + 从今天到本周日
  assert.match(app, /genScheduleWeek\(c, \{ force: true, from: today, count: 7 - dowMon \}\)/);
});
