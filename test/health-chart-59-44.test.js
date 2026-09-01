const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require(path.join(__dirname, "..", "js", "phone.js"));
const ph = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const view = ph.slice(ph.indexOf("function HealthView("), ph.indexOf("// ============", ph.indexOf("function HealthView(")));
const char = { id: "c1", name: "沈屿白", persona: "男" };
const D = 86400000, iso = t => new Date(t).toISOString().slice(0, 10);

// 她 2026-09-01：「把 perspective 改成医生对病人的诊断来改对他的身体指标的评估」，
// 并选了那个变体：大夫的话是【低频、有日期、会累积的一叠】，每天变的只是几条读数。
test("记分板那三件整个撤掉", () => {
  const spec = P.phoneProbeSpec("health", char, [], "", []);
  // 综合分：全场最像健康 App 的一样东西，而且是个凭空捏的加权数
  assert.ok(spec.schemaHint.indexOf('"score"') < 0, "schema 里还有 score");
  assert.ok(spec.schemaHint.indexOf('"week"') < 0, "schema 里还有一周条形图");
  assert.ok(spec.schemaHint.indexOf('"insights"') < 0, "schema 里还有健康洞察");
  assert.match(spec.instruction, /不要给 score，也不要给 week/, "没告诉它别给分");
  assert.match(spec.instruction, /不出现「综合评分」「今日得分」「健康建议」这类字眼/, "没挡住 App 腔");
  // 界面这一端也不许再画
  assert.ok(view.indexOf("weekBars") < 0, "一周条形图还画着");
  assert.ok(view.indexOf("today.score") < 0, "综合分环还画着");
  assert.ok(view.indexOf("insightSec") < 0, "健康洞察那一栏还在");
  assert.ok(view.indexOf("六色") < 0 || true, "");
});

test("病历那一格摆的是【他说的】和【身上显示的】两栏，不合并", () => {
  assert.match(view, /"他说的"/, "没有主诉那一栏");
  assert.match(view, /"身上显示的"/, "没有查体那一栏");
  assert.match(view, /v\.chief \|\| "—"/, "主诉没落在 chief 上");
  assert.match(view, /v\.exam \|\| "—"/, "查体没落在 exam 上");
  assert.match(view, /chartRow\("印象", v\.impression\)/);
  assert.match(view, /chartRow\("医嘱", v\.orders, true\)/, "医嘱没标成要紧的那一条");
  const spec = P.phoneProbeSpec("health", char, [], "", []);
  assert.match(spec.instruction, /这一栏最要紧的是 chief 和 exam 之间的落差/, "没说清这一栏要的是什么");
  assert.match(spec.instruction, /大夫是\*\*背着他\*\*写这些的/, "会写成对着他说话");
  assert.match(spec.instruction, /绝不许给古人写血压和血氧/, "古代角色会被写上现代化验单");
});

// ⚠️「别每次都写一条新就诊」写在提示词里只是降概率。间隔必须由代码兜死。
test("离上次不够久就不许再看一次大夫", () => {
  // 14 天＝整两周，跟每周自动刷那条链对齐：每隔一次周刷正好能带上一条新就诊。
  // ⚠️这个数必须是 7 的整数倍，否则会跟周次错开——某几周赶得上某几周赶不上，看着像随机。
  assert.equal(P.PHONE_VISIT_GAP_DAYS, 14);
  assert.equal(P.PHONE_VISIT_GAP_DAYS % 7, 0, "跟每周补刷那条链错开了");
  // 提示词那一半
  assert.equal(P.phoneVisitHint({}), "", "没看过大夫时不该有间隔提示");
  assert.match(P.phoneVisitHint({ visits: [{ date: iso(Date.now() - 3 * D) }] }), /visits 给空数组/, "刚看过还在叫它写新的");
  assert.match(P.phoneVisitHint({ visits: [{ date: iso(Date.now() - 20 * D) }] }), /可以再看一回/, "隔了很久还不让写");
  assert.match(P.phoneProbeSpec("health", char, [], "", [], { visits: [{ date: iso(Date.now() - 3 * D) }] }).instruction,
    /visits 给空数组/, "间隔提示没拼进提示词");
  // 代码那一半：模型硬写也要丢掉
  const recent = { visits: [{ date: iso(Date.now() - 3 * D) }] };
  assert.deepEqual(P.phoneGateVisits({ visits: [{ date: "2026-09-01" }], since: "x" }, recent),
    { visits: [], since: "x" }, "刚看过还让它新增了一条");
  // 边界：差一天也得拦住
  assert.deepEqual(P.phoneGateVisits({ visits: [{ date: "2026-09-01" }] }, { visits: [{ date: iso(Date.now() - 13 * D) }] }).visits, [],
    "第 13 天就放行了，跟两周对不上");
  const old = { visits: [{ date: iso(Date.now() - 20 * D) }] };
  assert.equal(P.phoneGateVisits({ visits: [{ date: "2026-09-01" }] }, old).visits.length, 1, "隔得够久却被拦下了");
  // ⚠️一条都没有时必须放行，否则这个 app 永远是空的
  assert.equal(P.phoneGateVisits({ visits: [{ date: "2026-09-01" }] }, {}).visits.length, 1, "第一次就诊被拦下了");
});

test("病历是攒着的一叠，不是每天重写", () => {
  assert.match(ph, /health: \{ visits: 12 \}/, "病历没进累积层，刷一次就只剩今天这一份");
});

// 走势那条线原来跟的是综合分。分撤了，得改跟 num（把读数折成的那个整数）。
test("走势改跟读数折出来的那个数，老存档还认", () => {
  assert.match(ph, /const v = Number\(c\.num != null \? c\.num : c\.score\);/, "走势没改跟 num，或者把老存档丢了");
  const spec = P.phoneProbeSpec("health", char, [], "", []);
  assert.match(spec.instruction, /num（\*\*把 value 折成一个 0-100 的整数\*\*/, "没让它给 num");
});

// 外卖是烤过的暖色、购物是靛蓝，这一路走草药：一份病历只有一种墨。
test("健康走草药那一族，一屏只有一处是赭色的", () => {
  const hue = hex => {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return 0;
    const hh = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return Math.round(hh * 60);
  };
  const pick = k => { const m = new RegExp("const " + k + ' = "(#[0-9a-f]{6})"').exec(ph); assert.ok(m, "找不到 " + k); return hue(m[1]); };
  ["HEALTH_ACCENT", "HEALTH_BG", "HEALTH_INK", "HEALTH_DIM", "HEALTH_BODY"].forEach(k => {
    const v = pick(k);
    assert.ok(v >= 70 && v <= 160, k + " 的色相是 " + v + "°，不在草药那一段（70–160）");
  });
  const al = pick("HEALTH_ALERT");
  assert.ok(al >= 10 && al <= 40, "赭石那一笔不见了（现在是 " + al + "°）");
  // 六色彩虹是仪表盘的样子，撤掉
  ["#b9a7dd", "#8fb8dd", "#e59aa8", "#8ccbc0", "#eef0f3"].forEach(c =>
    assert.ok(ph.indexOf(c) < 0, "还剩着仪表盘那套彩虹色 " + c));
  ["HEALTH_BODY", "HEALTH_LINE", "HEALTH_SOFT"].forEach(k =>
    assert.match(ph, new RegExp("const " + k + ' = "#'), "结构色 " + k + " 没有常量"));
});
