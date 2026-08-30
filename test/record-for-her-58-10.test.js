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

test("按需开放：她没开口让人记的轮次，这两个字段一个字都不发", () => {
  assert.match(app, /const _askedRecord = \(function \(\) \{/);
  // 只看最近三条她说的话
  assert.match(app, /i >= history\.length - 3/);
  assert.match(app, /if \(_askedRecord && typeof window\.memoAddByChar === "function"\)/);
  assert.match(app, /if \(_askedRecord && typeof window\.ledgerAddByChar === "function"\)/);
  // 字段字典那两行也跟着开关走，不是常驻
  assert.match(app, /\$\{_askedRecord \? "memo:\{/);
  // 币种/分类清单必须真发下去，不发的话模型只能瞎猜
  assert.match(app, /window\.ledgerChoices\(\)/);
  assert.match(ledSrc, /window\.ledgerChoices = function \(\)/);
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
  const i = app.indexOf("【四处一样喂 · 差异登记】");
  assert.ok(i > 0, "没登记差异");
  const seg = app.slice(i, i + 500);
  assert.match(seg, /单聊线上 ✅/);
  assert.match(seg, /单聊线下 ❌/);
  assert.match(seg, /这是欠的，不是有理由不给/, "线下这处是欠的，别粉饰成有理由");
  assert.match(seg, /群聊 ❌ 有真理由/);
  assert.match(seg, /三个人各记一条就是三条重复账/);
});
