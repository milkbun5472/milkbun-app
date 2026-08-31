const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), memoSrc = R("memo.js"), ledSrc = R("ledger.js"), comp = R("components.js");
// 两个写入 API 真跑（loadJSON/saveJSON 换成内存桩）
function boot(src) {
  const store = {};
  const w = {};
  const fn = new Function("loadJSON", "saveJSON", "window", "ANTI_CLICHE", "NARRATIVE_ANTI_CLICHE", src);
  fn((k, d) => store[k] !== undefined ? JSON.parse(JSON.stringify(store[k])) : d,
     (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); }, w, "", "");
  return { w, store };
}
const M = boot(memoSrc).w, L = boot(ledSrc).w;

// 她 2026-08-30：「我跟他们说帮我记下周三十点的会，他们就真的能帮我记」
test("备忘录：日期必须是真日期，记不下就别假装记下了", () => {
  const ok = M.memoAddByChar("c1", { title: "跟导师开会", date: "2026-09-02", time: "10:00" });
  assert.ok(ok && ok.id);
  assert.equal(ok.anchor, "2026-09-02");
  assert.equal(ok.startTime, "10:00");
  assert.deepEqual(ok.visibleTo, ["c1"], "记好默认他自己看得到");
  assert.equal(ok.byChar, "c1");
  // 模型把「下周三」原样填进来＝这一条作废，绝不能落盘
  assert.equal(M.memoAddByChar("c1", { title: "开会", date: "下周三" }), null);
  assert.equal(M.memoAddByChar("c1", { title: "开会" }), null, "没日期不许记");
  // 没补零的也不行：存进去 anchor 就成了 "2026-9-2"，后面按字符串比日期的地方全歪
  assert.equal(M.memoAddByChar("c1", { title: "开会", date: "2026-9-2" }), null, "日期必须补零成 YYYY-MM-DD");
  assert.equal(M.memoAddByChar("c1", { date: "2026-09-02" }), null, "没标题不许记");
  // repeat 只收认得的几个，乱填退回 none
  assert.equal(M.memoAddByChar("c1", { title: "组会", date: "2026-09-02", repeat: "weekly" }).repeat, "weekly");
  assert.equal(M.memoAddByChar("c1", { title: "x", date: "2026-09-02", repeat: "每天" }).repeat, "none");
});

test("他自己记的那条，哪怕还有十天也得记得——不然刚答应完就忘", () => {
  const far = new Date(Date.now() + 10 * 86400000);
  const ymd = far.getFullYear() + "-" + String(far.getMonth() + 1).padStart(2, "0") + "-" + String(far.getDate()).padStart(2, "0");
  M.memoAddByChar("c9", { title: "跟导师开会", date: ymd, time: "10:00" });
  const note = M.memoNoteFor("c9");
  assert.match(note, /是你替 .* 记下的/, "十天后的事他完全不知道，等于记完就忘");
  assert.match(note, /10:00/, "时刻没带上");
  assert.equal(M.memoNoteFor("c_other"), "", "别人不该看到");
  // 原来只有【今天/两天内/逾期】才进上下文，这一支是补的
  assert.match(memoSrc, /else if \(r\.byChar === charId\) lines\.push\("是你替 "/);
});

test("账本：币种和分类只能从她已有的里挑，挑不中退回默认", () => {
  const a = L.ledgerAddByChar("c1", { amount: 24.5, currency: "加币", category: "餐饮", note: "跟他吃饭" });
  assert.equal(a.currency, "CAD", "「加币」要认成 CAD");
  assert.equal(a.category, "餐饮");
  assert.equal(a.type, "expense");
  assert.equal(a.byChar, "c1");
  assert.match(a.date, /^\d{4}-\d{2}-\d{2}$/);
  // 模型自己造的币种/分类：归不进任何汇总，所以必须收敛掉
  const b = L.ledgerAddByChar("c1", { amount: 9, currency: "CAD$", category: "吃饭" });
  assert.equal(b.currency, "CAD");
  assert.equal(b.category, "其他", "造出来的分类要落到兜底那一栏");
  assert.equal(L.ledgerAddByChar("c1", { amount: 0, currency: "CAD" }), null, "0 元不许落盘");
  assert.equal(L.ledgerAddByChar("c1", { amount: -5 }), null, "负数走 type=income，不许靠负号");
  assert.equal(L.ledgerAddByChar("c1", null), null);
  // 收入那一路
  assert.equal(L.ledgerAddByChar("c1", { type: "income", amount: 100, currency: "CNY", category: "工资" }).type, "income");
});

test("「他能看到这笔」＝只看到这一笔，不是整本账开给他", () => {
  const own = L.ledgerNoteFor("c1");
  assert.match(own, /你替 Ta 记下的几笔/);
  assert.match(own, /餐饮/);
  // 没被授权、也没替她记过的人：一个字都看不到
  assert.equal(L.ledgerNoteFor("c_stranger"), "");
  // ⚠️绝不许顺手把全局可见开关打开——那等于把她所有开销一次交出去
  assert.doesNotMatch(ledSrc, /settings\.visibleTo\.push/);
  assert.doesNotMatch(ledSrc, /visibleTo = \[\]\.concat\(.*charId/);
  assert.match(ledSrc, /function ledgerOwnLines\(charId\)/);
});

// 她 2026-08-30 追问：「宝宝 / 帮我记一下 / 下周三10点开会 这样三个气泡可以吗」
test("触发词表：拆成几个气泡说也认得出，而且不误伤「我记得」这类", () => {
  // ⚠️抠【真正在跑的那一份】出来，不许在测试里另抄一份正则——
  // 抄一份的话，改了代码没改测试，测的就是那份抄件
  const i = app.indexOf("      const _askedRecord = (function () {");
  const j = app.indexOf("})();", i) + 5;
  assert.ok(i > 0 && j > i, "抠不出触发判据");
  const gate = new Function("history", app.slice(i, j).replace("const _askedRecord =", "return"));
  const U = t => ({ role: "user", content: t });
  const A = t => ({ role: "assistant", content: t });
  // 她举的例子：关键那句在中间
  assert.equal(gate([U("宝宝"), U("帮我记一下"), U("下周三10点开会")]), true);
  // 关键那句后面还跟几句也行；只数【她说的】，中间夹他的回复不占额度
  assert.equal(gate([U("帮我记一下"), U("下周三10点"), U("开会"), U("哦对"), U("跟导师"), U("就这样")]), true);
  assert.equal(gate([U("帮我记一下"), A("好"), U("下周三10点"), A("嗯"), U("开会")]), true);
  // 六条以外就不看了——再宽就等于常驻
  assert.equal(gate([U("帮我记一下"), U("a"), U("b"), U("c"), U("d"), U("e"), U("f")]), false);
  // 该开的各种说法
  ["帮我记一下", "记一下下周三开会", "帮我记加币24吃东西", "记个账", "记着下周三有个会",
   "写进备忘录", "存进账本", "提醒我下周三开会", "别忘了下周三开会", "给我记一笔", "加个提醒"]
    .forEach(x => assert.equal(gate([U(x)]), true, "这句该开却没开：" + x));
  // ⚠️最容易误伤的：「记」字在这些词里跟「记下来」没关系
  ["宝宝", "下周三10点开会", "我记得你说过", "你还记得吗", "我不记得了", "我记性不好",
   "这个月花了好多啊", "我今天买了杯咖啡", "今天好累"]
    .forEach(x => assert.equal(gate([U(x)]), false, "这句不该开却开了：" + x));
});

test("按需开放：她没开口让人记的轮次，这两个字段一个字都不发", () => {
  assert.match(app, /const _askedRecord = \(function \(\) \{/);
  // 只看最近六条【她说的话】（他的回复不占额度）
  assert.match(app, /let seen = 0;/);
  assert.match(app, /i >= 0 && seen < 6/);
  assert.match(app, /if \(!m \|\| m\.role !== "user"\) continue;\n\s*seen\+\+;/, "得只数她说的那几条");
  assert.match(app, /if \(_askedRecord && typeof window\.memoAddByChar === "function"\)/);
  assert.match(app, /if \(_askedRecord && typeof window\.ledgerAddByChar === "function"\)/);
  // 字段字典那两行也跟着开关走，不是常驻
  assert.match(app, /\$\{_askedRecord \? "memo:\{/);
  // 币种/分类清单必须真发下去，不发的话模型只能瞎猜
  assert.match(app, /window\.ledgerChoices\(\)/);
  assert.match(ledSrc, /window\.ledgerChoices = function \(\)/);
});

test("言秋本人专线也拿到同一张真记录凭证，不会只在话里说记好了", () => {
  const i = app.indexOf("const _digitalRecordHint");
  const j = app.indexOf("const _normalTaskFull", i);
  assert.ok(i > 0 && j > i, "找不到本人专线的记录字段");
  const seg = app.slice(i, j);
  assert.match(seg, /openCaps\.includes\("memo"\)/);
  assert.match(seg, /openCaps\.includes\("ledger"\)/);
  assert.match(seg, /memo:\{\\"title\\"/);
  assert.match(seg, /ledger:\{\\"type\\"/);
  assert.match(seg, /不能只在 word 里说‘记好了’/);
  assert.match(seg, /_digitalRecordHint/);
  // 只补 App 传输字段，不许把普通角色的整份能力/人格作业塞回言秋专线。
  assert.doesNotMatch(seg, /_digitalTaskFull[^;]+capabilityHint/);
});

test("落盘成功才出卡片——显示「已记下」其实没记，比不记更坏", () => {
  const i = app.indexOf("      if (parsed.memo && typeof parsed.memo === \"object\"");
  assert.ok(i > 0, "memo 那一支没接上");
  const seg = app.slice(i, i + 1600);
  assert.match(seg, /const _mo = window\.memoAddByChar\(charId, parsed\.memo\);\n\s*if \(_mo\) \{/, "没判返回值就出卡片");
  assert.match(seg, /const _lx = window\.ledgerAddByChar\(charId, parsed\.ledger\);\n\s*if \(_lx\) \{/);
  assert.match(seg, /kind: "recorded", what: "memo"/);
  assert.match(seg, /kind: "recorded", what: "ledger"/);
  assert.match(comp, /function RecordedCard\(\{ m \}\)/);
  assert.match(comp, /if \(m\.kind === "recorded"\) return h\("div"/);
  // 卡片是 role:"system"，不进历史窗口（那层由 memoNoteFor/ledgerNoteFor 负责）
  assert.match(seg, /role: "system", kind: "recorded"/);
});

test("四处一样喂：接不上的那两处写清楚了为什么", () => {
  // 规则要求差异必须是显式的、写着理由的，不能是忘了
  // ⚠️锚要落在【本功能自己那一份】登记上。app.js 里不止一处「差异登记」
  //（v58.98 看照片那件也写了一份，而且排在前面），拿第一处当锚会验到别人头上。
  const _from = app.indexOf("── 替她记一笔 / 记备忘");
  assert.ok(_from > 0, "找不到「替她记一笔」那一段");
  const i = app.indexOf("【四处一样喂 · 差异登记】", _from);
  assert.ok(i > 0, "没登记差异");
  const seg = app.slice(i, i + 500);
  assert.match(seg, /单聊线上 ✅/);
  assert.match(seg, /单聊线下 ❌/);
  assert.match(seg, /这是欠的，不是有理由不给/, "线下这处是欠的，别粉饰成有理由");
  assert.match(seg, /群聊 ❌ 有真理由/);
  assert.match(seg, /三个人各记一条就是三条重复账/);
});
