const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), scr = R("screens.js");
const grab = (src, a, b, cap) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return src.slice(i, j);
};

// ── ③ 纪念日那天他主动来找你 ──────────────────────────────────────────────
// 她 2026-08-31 选的第 ③ 条。以前纪念日只在他上下文里躺着一句，得她先开聊天他才说得上话；
// 而生日是会主动发的。同一件事一个主动一个被动——照生日那条现成的路补上。
const anniv = grab(app, "      // —— 纪念日主动（v58.83", "      // —— 备忘录·到期提醒主动");
test("纪念日走的是生日那条现成的路，防重复的闸一个不少", () => {
  assert.match(anniv, /window\.DeliveryCommit\.once\("anniv:" \+ cid \+ ":" \+ key,/, "没走 DeliveryCommit——会重复发");
  assert.match(anniv, /markGreet\(cid, "a", key\)/, "发完没记账,同一天会一直发");
  // 同一年同一个纪念日只发一次；一年里几个纪念日各发各的，所以 key 里要有名字
  assert.match(anniv, /const key = String\(nowD\.getFullYear\(\)\) \+ ":" \+ \(it\.name \|\| "在一起"\);/, "key 没按「年+哪一个纪念日」区分");
  assert.match(anniv, /if \(\(greetLogRef\.current\[cid\] \|\| \{\}\)\.a === key\) continue;/, "没查今年发过没有");
  ["laneBusy", "viewRef.current.charId === cid", "hist(c).length < 2", "hr < 8 || hr > 23", "currentlyTogetherWithChar"].forEach(g =>
    assert.ok(anniv.indexOf(g) > 0, "少了生日那条路上的这道闸：" + g));
  assert.match(anniv, /if \(!cp \|\| cp\.status !== "together"\) continue;/, "没在一起的也发——那不叫纪念日");
  assert.match(anniv, /return;\s*\/\/ 一次一个，错峰/, "一次可能叫起好几个,会同秒并发烧调用");
});

test("在一起满周年 和 她自己加的纪念日，两种都算", () => {
  assert.match(anniv, /if \(yrs >= 1\) aToday\.push/, "在一起那一天没接（当天开始那天不算周年,对）");
  assert.match(anniv, /\(coupleAnnivRef\.current \|\| \[\]\)\.forEach\(an => \{/, "她自己加的纪念日没接");
  assert.match(anniv, /an\.month === nowD\.getMonth\(\) \+ 1 && an\.day === nowD\.getDate\(\)/, "日期比错了");
});

// ⚠️声明了没人引用比不写更坏（v55.95 那一课）
test("纪念日那段提示词真的拼进了 system", () => {
  assert.match(app, /const annivHint = opts\.anniv \?/, "没写");
  assert.match(app, /opts\.bday \? bdayHint : opts\.anniv \? annivHint :/, "写了却没接进 proactiveHint 那条链");
  assert.match(app, /opts\.anniv \? "anniversary" :/, "出口没标,账上分不出这一条是从哪儿来的");
  const hint = grab(app, "      const annivHint = opts.anniv ?", "      const wxHint = opts.wx ?");
  // prompt-no-content-samples.md：只许给判据，不许塞例句
  assert.ok(!/如『|例如|比如/.test(hint), "提示词里塞了内容示范,送的东西会被照抄成同一批");
  assert.match(hint, /从你记得的那件具体的事说起/, "没给「这一条算不算写好了」的判据");
  assert.match(hint, /只有你会想到送给 Ta 的东西/, "送礼那一栏没写判据");
});

// ── ② 我们说好的 ─────────────────────────────────────────────────────────
// 不新造存储：记忆库里 open:true 的开环（线下/通话自动抽出来的）+ 已有的「约回」链。
const pacts = grab(app, "  const pactsFor = charId => ({", "  const addMemEntry = e => {");
test("料是从两样已有的东西接来的，没有第三个存储", () => {
  assert.match(pacts, /\(memLibRef\.current \|\| \[\]\)\.filter\(m => m && m\.open && \(m\.charIds \|\| \[\]\)\.includes\(charId\)\)/, "开环不是从记忆库里取的");
  assert.match(pacts, /\(promisesRef\.current \|\| \[\]\)\.filter\(x => x && x\.charId === charId\)/, "约回那条链没接进来");
  assert.ok(!/localStorage\.setItem\("x_pact/.test(app), "又新造了一个存储");
});

test("给一条约定挑日子＝往约回里塞一条，到期那条现成的链会让他自己提起", () => {
  assert.match(pacts, /\{ id: "pk_" \+ Date\.now\(\), charId, about: String\(about \|\| ""\)\.slice\(0, 60\), dueTs, memId \}/, "没写进约回,挑了日子也没人会提");
  assert.match(pacts, /saveJSON\("x_promises", n\)/, "没存盘");
  // memId 是两边的绳子：了结的时候要靠它把那条约回一起摘掉
  assert.match(pacts, /p\.filter\(x => x\.memId !== memId\)/, "改日子/不催了没先摘掉旧的,会攒出好几条");
  const due = grab(app, "  const setPactDue = (memId, charId, about, dueTs) => {", "  const addMemEntry = e => {");
  assert.match(due, /if \(!dueTs\) \{[\s\S]{0,180}toast\("不催了"\); return; \}/, "取消日子那一路没写");
});

test("了结一条：记忆库那条关掉，挂着的约回一起摘掉", () => {
  const close = grab(app, "  const closePact = memId => {", "  const addPact = (charId, text, dueTs) => {");
  assert.match(close, /saveMemLib\(\(memLibRef\.current \|\| \[\]\)\.map\(m => m\.id === memId \? \{ \.\.\.m, open: false \} : m\)\)/, "没把那条开环关掉");
  assert.match(close, /p\.filter\(x => x\.memId !== memId\)/, "约回没摘掉——事都了了他还会来催");
  // addMemEntry 得把新条目还回来，不然加约定时拿不到 id 去挂日子
  assert.match(app, /return entry;   \/\/ v58\.83/, "addMemEntry 不回传 entry,挂日子就没有 id 可用");
});

test("和心愿单是两回事，别混", () => {
  assert.match(scr, /sub === "pacts"/, "没有入口分发");
  assert.match(scr, /sub === "wishes"/, "把心愿单挤掉了");
  assert.match(scr, /tile\("pacts", \{ e: "🤝", zh: "我们说好的"/, "网格里没有这一格,等于进不去");
  const c = grab(scr, "function CouplePacts({", "function CoupleWishes({");
  assert.match(c, /不是你手打的愿望（那是心愿单）/, "界面上没跟她讲清两者的区别");
  assert.match(c, /到期他会自己提起|到那天他会自己提起|到那天他会主动来找你/, "没说清挑日子会发生什么");
  assert.ok(!/h\(Sheet/.test(c), "用了半窗——见 .claude/rules/no-half-sheet.md");
  assert.match(app, /couplePactsOf: pactsFor,/, "props 没递下去");
});
