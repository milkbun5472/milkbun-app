// TA 自己一只钟（她 2026-10-16「单独暂停某个角色的时间过剧情」）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", f), "utf8");
const app = R("js/app.js"), eng = R("js/engine.js"), comp = R("js/components.js");
test("钟的键按时段认：开着那段走 c:角色id，关了照旧面具；旧消息按当时那只钟", () => {
  const i = app.indexOf("const clockKeyOf = (id, ts) =>"), j = app.indexOf("\n  };", i);
  const clockKeyOf = new Function("settingsFor", "maskKeyOf", "return " + app.slice(i + "const clockKeyOf = ".length, j + 4))(
    id => ({ ownClockSpans: id === "c1" ? [{ from: 100, until: 200 }, { from: 500, until: null }] : [] }), () => "m2");
  assert.equal(clockKeyOf("c1", 150), "c:c1");
  assert.equal(clockKeyOf("c1", 300), "m2");
  assert.equal(clockKeyOf("c1", 600), "c:c1");
  assert.equal(clockKeyOf("c2", 150), "m2");
  assert.equal(clockKeyOf("g:x", 150), "m2");
});
// 2026-10-18 起 vclockMap 拆成「挑哪只钟」+ vclockMapBy「照这只钟换算」（周刊要用主面具那只），按消息时间问键这件事不变
test("接线：引擎按消息时间问键；悬浮球拨的是这只；设置里有开关、存 spans", () => {
  assert.ok(/W\.maskOf\(String\(who\), ts\)/.test(eng) && /function vclockMap\(ts, id\) \{ return vclockMapBy\(vclockCfg\(id, ts\), ts\); \}/.test(eng));
  assert.ok(/maskOf: clockKeyOf \}/.test(app));
  assert.equal((app.match(/activeChar && clockKeyOf\(activeChar\.id\)\) \|\| "main"/g) || []).length, 2);
  assert.ok(/ownClockSpans: ownClockSpansNext\(activeChar\.id, s\.ownClock\)/.test(app));
  assert.ok(/"data-wk": "ownclock"/.test(comp) && /ownClock,\n/.test(comp));
});

// 她 2026-10-20：「这个写错了吧，现实也是一周一次啊」——开关底下那句说明把现实那半写成了「一天排一份」。
//   真的在 app.js 的 schedGenAllToday：周日排下一周七天；今天没日程就补到本周日。两边都是一次排一周。
test("「日程照这只钟的日子排」那句说明：别把现实那半说成一天排一份", () => {
  const comp = R("js/components.js"), man = R("js/assistant-manual.js");
  // 只查【给人看的字】：注释里记着「原来写成什么」是对的，不该被这条拦住
  const nocom = t => t.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(!/一天排一份/.test(nocom(comp)), "界面上还写着「一天排一份」");
  assert.ok(!/一天排一份/.test(man), "攻略里还写着「一天排一份」");
  assert.match(comp, /关着就照现实的日子排。两边都是一次排一周/, "没说清两边都是一周一次");
  // 代码确实是一周一次：周日排下一周，缺今天就补到本周日
  assert.match(app, /if \(dowMon === 6\) pick\("schedule\|" \+ c\.id \+ "\|next", nextMon, nextMon, 7\)/);
});
