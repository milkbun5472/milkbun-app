const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadPhone, FIXTURES } = require("./helpers/phone-render.js");
const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const P = new Function(SRC + "; return { TALLY_TABS, TALLY_DIR, tallyEntries };")();
const view = SRC.slice(SRC.indexOf("function TallyView({"), SRC.indexOf("// 时间线视图"));
const props = { d: FIXTURES.tally, char: { name: "某人" }, t: {}, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
const draw = tab => JSON.stringify(loadPhone({ 0: tab }).TallyView(props));

// 她 2026-09-01：「你再改改账本整体设计现在还是有点无聊」。
// 病在【整页一个色度】：米底、近白的卡、灰字，从上到下没有一处压得住，
// 五栏又是同一列白卡往下排。
test("顶上那一块是墨色的封皮，字反白出来", () => {
  const head = view.slice(view.indexOf("h(\"div\", { className: \"shrink-0\", style: { background: TALLY_INK"), view.indexOf("h(\"div\", { style: { height: 2, background: TALLY_RED"));
  assert.ok(head.length > 200, "顶上那一块不是墨色的");
  assert.match(head, /paddingTop: safeTop\(10\)/, "顶栏没自己吃刘海");
  // 反白：返回键、标题、刷新键都得是纸色的，不然墨底上是黑字
  assert.equal((head.match(/TALLY_BG/g) || []).length >= 4, true, "墨底上还留着墨字");
  assert.ok(head.indexOf("color: TALLY_INK }") < 0 || head.indexOf("tab === x.k ? TALLY_INK") > 0,
    "封皮上有一处还是墨字");
  // 五栏也在封皮里
  assert.ok(head.indexOf("TALLY_TABS.map") > 0, "五栏没在封皮里，封皮就只是一条空带子");
});

test("左边有一道朱色栏线，一栏一个印、一行一个号", () => {
  const slip = view.slice(view.indexOf("const slip = e =>"), view.indexOf("const headNote ="));
  assert.equal((slip.match(/background: "rgba\(156,63,52,\.(28|14)\)"/g) || []).length, 2,
    "栏线不是两条细朱线");
  assert.match(slip, /\}, sealOf\(e\)\)/, "栏线上没有印");
  assert.match(slip, /String\(e\.i \+ 1\)\.padStart\(2, "0"\)\)\)/, "没有一行一个号");
  // 真渲一遍：号得看得见，不能只是躺在源码里
  const d = draw("debts");
  ["\"01\"", "\"02\"", "\"03\""].forEach(n => assert.ok(d.includes(n), "第 " + n + " 行没有号"));
  assert.ok(d.indexOf("display\":\"none") < 0, "栏线上有东西被藏起来了");
  assert.match(slip, /border: "1px solid " \+ sc, color: sc/, "印没有按这一条自己的颜色");
});

test("没结清那一栏的印刻的是方向，正面就不再重复说一遍", () => {
  assert.match(view, /const DIR_SEAL = \{ mine: "欠", theirs: "记", open: "悬" \};/, "方向印不是欠／记／悬");
  assert.match(view, /const sealOf = e => e\.kind === "debts" \? \(DIR_SEAL\[e\.dir\] \|\| DIR_SEAL\.open\)/,
    "没结清那一栏的印没按方向刻");
  assert.match(view, /sealColor = e => e\.kind === "debts" \? \(\(TALLY_DIR\[e\.dir\] \|\| TALLY_DIR\.open\)\.c\)/,
    "方向印没上色，一列走下来看不出他欠得多还是记着的多");
  // 正面那块方向小牌撤了：同一句话说两遍，卡片上就只剩标签
  const face = view.slice(view.indexOf("const faceOf = e =>"), view.indexOf("const backOf = e =>"));
  assert.ok(face.indexOf("dir.zh") < 0, "正面还挂着方向小牌，跟左边那个印说的是同一句话");
  // 真渲一遍数一数：「他欠」「记着」只该在抬头那一行出现一次，
  // 卡片上再冒出来就是又把方向说了第二遍
  const d = draw("debts");
  [["他欠", 1], ["记着", 1], ["还悬着", 1]].forEach(([w, n]) =>
    assert.equal((d.match(new RegExp(w, "g")) || []).length, n, "「" + w + "」在页面上出现了不止抬头那一次"));
  // 别的栏一栏一个字
  Object.entries({ policies: "保", statements: "定", treasures: "估", appraisals: "问" }).forEach(([k, ch]) =>
    assert.match(view, new RegExp(k + ': "' + ch + '"'), k + " 没有自己的印"));
});

test("抬头那一行说的是这一栏，而且三个方向按各自的颜色写", () => {
  assert.match(view, /const headNote = \(\) => \{/, "没有这一栏的抬头");
  assert.match(view, /color: TALLY_DIR\[x\[0\]\]\.c \} \}, TALLY_DIR\[x\[0\]\]\.zh \+ " " \+ x\[1\]\)/,
    "抬头里的三个方向没上色——左边那列印就没有说明了，只能另写一条图例");
  ["个人兜着底", "句盖过章的话", "样他估过价的东西", "个他问自己的问题"].forEach(s =>
    assert.ok(view.indexOf(s) > 0, "少了一栏自己的抬头：" + s));
  // 抬头得跟着数据走，不是写死的一句
  const d = draw("debts");
  assert.ok(d.includes("他欠") && d.includes("记着"), "没结清的抬头没把方向数出来");
  assert.ok(draw("statements").includes("句盖过章的话"), "定论的抬头没出来");
});

test("账页有收口：双线一封，底下交代到此为止", () => {
  assert.equal((view.match(/background: "rgba\(156,63,52,\.30\)"/g) || []).length, 2, "收口不是双线");
  assert.match(view, /"这一栏记到这儿。他没记下的，这儿也不会有。"/, "收口没写清楚那头是什么");
  P.TALLY_TABS.forEach(tb => assert.ok(draw(tb.k).includes("这一栏记到这儿"), tb.k + " 那一栏没有收口"));
});

test("一栏空着的时候不画抬头、不画收口", () => {
  // 空列表上下各挂一条线，看着像加载坏了
  const empty = JSON.stringify(loadPhone({ 0: "debts" }).TallyView({ ...props, d: {} }));
  assert.ok(empty.includes("这一栏还是空的"), "空栏没有交代");
  assert.ok(!empty.includes("这一栏记到这儿"), "空栏也画了收口");
  assert.ok(!empty.includes("折了角的那几张有背面"), "空栏还在解释折角，一张都没有");
});

test("五栏切换和翻面没被这层壳弄坏", () => {
  P.TALLY_TABS.forEach(tb => {
    assert.doesNotThrow(() => loadPhone({ 0: tb.k }).TallyView(props), tb.k + " 那一栏炸了");
    const open = P.tallyEntries(tb.k, FIXTURES.tally).filter(e => e.back.text)[0];
    if (!open) return;
    const s = JSON.stringify(loadPhone({ 0: tb.k, 1: open.key, 2: 99 }).TallyView(props));
    assert.ok(s.includes(open.back.text), tb.k + " 翻开之后背面是空的");
  });
  // 印和号在卡片外面：翻面转的是那张纸，账上那一行不跟着转
  const slip = view.slice(view.indexOf("const slip = e =>"), view.indexOf("const headNote ="));
  const gutter = slip.slice(slip.indexOf("width: 26, flexShrink: 0"), slip.indexOf("perspective: 1000"));
  assert.ok(gutter.indexOf("rotateY") < 0, "印跟着纸一起翻过去了");
});
