const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadPhone, FIXTURES } = require("./helpers/phone-render.js");
const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const P = new Function(SRC + "; return { tallyEntries, phoneCalmMotion, TALLY_TABS, phoneProbeSpec };")();
const view = SRC.slice(SRC.indexOf("function TallyView({"), SRC.indexOf("// 时间线视图"));

// 她 2026-09-01：「我们都没用过那种翻面设计，就是在一面显示比较正常的话，翻了页
// 就有这句话的另一面，然后可以做这种流式显示翻过来一个字一个字慢慢往外蹦」。
test("五栏各自的两面都对得上：正面是账上那一行，背面是他心里那一句", () => {
  const f = FIXTURES.tally;
  const g = k => P.tallyEntries(k, f);
  assert.equal(g("debts")[0].lead, f.debts[0].title);
  assert.equal(g("debts")[0].back.text, f.debts[0].note, "没结清的背面不是他怎么想这笔");
  assert.equal(g("policies")[0].lead, f.policies[0].name);
  assert.equal(g("policies")[0].back.text, f.policies[0].clause, "兜底的背面不是条款正文——那层落差就是这一栏的全部意义");
  assert.equal(g("statements")[0].lead, f.statements[0].text);
  assert.equal(g("statements")[0].back.text, f.statements[0].truth, "定论的背面不是这句话底下真正的意思");
  assert.equal(g("treasures")[0].lead, f.treasures[0].title);
  assert.equal(g("treasures")[0].back.text, f.treasures[0].worth, "估价的背面不是他给的估价");
  assert.equal(g("appraisals")[0].lead, f.appraisals[0].q);
  assert.equal(g("appraisals")[0].back.text, f.appraisals[0].a, "自问的背面不是他的答案");
  // key 得一栏一套，别让两栏的第 0 条撞成同一张
  assert.notEqual(g("debts")[0].key, g("policies")[0].key);
});

test("背面是空的就没有背面——不拿别的字段凑一句假的", () => {
  // 老存档的 statements 没有 truth
  const old = P.tallyEntries("statements", { statements: [{ text: "一句话", heat: "轻", who: "谁" }] });
  assert.equal(old[0].back.text, "", "老数据被别的字段凑出了一个背面");
  assert.equal(old[0].lead, "一句话");
});

test("脏数据不炸，也不把 [object Object] 印在纸上", () => {
  [null, undefined, {}, [], "字符串", { debts: "不是数组" }, { debts: [null, 3, {}] },
   { statements: [{ text: {} }] }, { treasures: [{ title: 1, worth: [] }] }, { appraisals: [{ q: {} }] }]
    .forEach((d, i) => P.TALLY_TABS.forEach(tb => {
      let out;
      assert.doesNotThrow(() => { out = P.tallyEntries(tb.k, d); }, "脏数据 " + i + " 在 " + tb.k + " 栏炸了");
      out.forEach(e => {
        assert.ok(e.lead.indexOf("[object") < 0, "正面印出了 [object Object]");
        assert.ok(e.back.text.indexOf("[object") < 0, "背面印出了 [object Object]");
      });
    }));
});

test("有背面的才折角，没背面的连点都点不动", () => {
  assert.match(view, /const on = flip === e\.key, has = !!e\.back\.text;/, "没有先问一句「这张有没有背面」");
  assert.match(view, /h\(has \? "button" : "div", \{/, "没背面的那张也做成了按钮，点下去什么都不会发生");
  assert.match(view, /has \? h\("span", \{ "aria-hidden": "true", style: \{[\s\S]{0,200}?linear-gradient\(135deg/,
    "折角不看有没有背面——空折角等于骗人点一下");
  assert.match(view, /if \(!e\.back\.text\) return;/, "点没背面的那张也会翻");
});

test("一个字一个字往外蹦，蹦到一半点一下当场蹦完", () => {
  assert.match(view, /setTyped\(v => \{[\s\S]{0,160}\}\), 32\);/, "不是逐字往外蹦，或者间隔被改了");
  assert.match(view, /if \(typed < e\.back\.text\.length\) \{ setTyped\(e\.back\.text\.length\); return; \}/,
    "蹦到一半点一下会直接翻回去——逼人干等着");
  // 关了动效的人不该被一个字一个字地喂
  assert.match(view, /if \(phoneCalmMotion\(\)\) \{ setTyped\(n\); return; \}/, "没认系统里的「减少动态效果」");
  assert.match(view, /transition: phoneCalmMotion\(\) \? "none" :/, "翻面动画也没认「减少动态效果」");
  assert.equal(typeof P.phoneCalmMotion(), "boolean");
  // 还没蹦出来的那半留在原地、只是透明：不然卡片一行一行长高，字在跳
  assert.match(view, /style: \{ color: "transparent" \} \}, txt\.slice\(n\)\)/, "没蹦出来的那半没占住位置，卡片会一行行往下长");
});

test("同一时刻只翻开一张，换栏就收回去", () => {
  assert.match(view, /const \[flip, setFlip\] = useState\(null\);/, "翻开状态不是全局的一张");
  assert.match(view, /onClick: \(\) => \{ setTab\(x\.k\); setFlip\(null\); \}/, "换栏时上一栏那张还翻着");
  assert.match(view, /useEffect\(\(\)[\s\S]{0,120}clearInterval\(typeRef\.current\)/, "换张时上一个计时器没停");
  assert.match(view, /return \(\) => \{ if \(typeRef\.current\) clearInterval\(typeRef\.current\); typeRef\.current = null; \};/,
    "退出这一页时计时器还在跑");
});

test("光标和「摆到他面前」只长在真翻开的那一张上", () => {
  // 背面一直在 DOM 里（backface-hidden 挡着），两样都得认「翻开的是不是我」
  assert.match(view, /const txt = e\.back\.text, n = on \? typed : 0, typing = on && n < txt\.length;/,
    "没认翻开的是哪一张");
  assert.match(view, /typing \? h\("span", \{ "aria-hidden": "true", style: \{ opacity: \.55 \} \}, "▏"\)/,
    "没翻开的每一张背面上都在闪一根竖线");
  assert.match(view, /\(on && !typing\) \? peekBtn\(/,
    "每一张背面都挂着一个「摆到他面前」——读屏读不到，但键盘能 Tab 上去按下它");
  // 背对着人的那一面不许念给读屏
  assert.match(view, /"aria-hidden": on \? "true" : null, style: faceStyle\(true\)/, "正面没随翻面让开读屏");
  assert.match(view, /"aria-hidden": on \? null : "true", style: faceStyle\(false\)/, "背面没随翻面让开读屏");
});

test("两面长短不一样也不切不空", () => {
  // 在流里的那一面撑起高度，另一面绝对定位压上去
  assert.match(view, /position: \(front !== on\) \? "relative" : "absolute",\s*inset: \(front !== on\) \? "auto" : 0,/,
    "两面都绝对定位或都在流里，短的那面会空一大截、长的那面被切掉");
  assert.match(view, /backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden"/, "背面会透过正面显出来");
  assert.match(view, /transformStyle: "preserve-3d"/, "没有真的翻面，只是换了内容");
});

test("五栏各长各的样子，不是同一张白卡", () => {
  const face = view.slice(view.indexOf("const faceOf = e =>"), view.indexOf("const backOf = e =>"));
  ["debts", "policies", "statements", "treasures"].forEach(k =>
    assert.ok(face.indexOf('e.kind === "' + k + '"') > 0, k + " 没有自己的正面"));
  // v63.01 no-english-titles：POLICY 01 / LOT 01 换成「第 01 条」「第 01 号」
  assert.match(face, /"第 " \+ String\(e\.i \+ 1\)\.padStart\(2, "0"\) \+ " 条"/, "兜底不是一张保单");
  assert.match(face, /"第 " \+ String\(e\.i \+ 1\)\.padStart\(2, "0"\) \+ " 号"/, "估价不是一张拍品签");
  assert.match(face, /承保范围[\s\S]{0,40}理赔条件/, "保单上没有条目表");
});

// 参考的那个是「翻过去是一张机密档案」：黑底、朱字、大写 CLASSIFIED 水印、
// 角上一行 TAP TO FLIP、顶上一行 FILE DATE。那一套骨架一个都不许抄。
test("背面是同一张纸的背面，不是另一个东西", () => {
  ["CLASSIFIED", "TAP TO FLIP", "FILE DATE", "TOP SECRET"].forEach(bad =>
    assert.ok(SRC.indexOf(bad) < 0, "抄了参考里那套壳：" + bad));
  const slip = view.slice(view.indexOf("const slip = e =>"), view.indexOf("return h(\"div\", { className: \"h-full"));
  assert.equal((slip.match(/background: TALLY_PAPER/g) || []).length, 1,
    "两面用了两种纸——翻的就不是一张纸了");
  assert.match(view, /折了角的那几张有背面 · 点一下翻过来/, "折角没有一句话交代，没人会去点");
});

test("定论那一栏新加的 truth 写进了推演任务，而且要求两句话之间有落差", () => {
  const spec = P.phoneProbeSpec("tally", { name: "某人" }, [], "", []);
  assert.match(spec.instruction, /truth 这句话底下真正的意思/, "truth 没写进推演任务");
  assert.match(spec.instruction, /truth 不是把 text 换个说法再讲一遍/, "没挡住「把原话复述一遍」这个最容易犯的错");
  assert.match(spec.instruction, /没有落差就说明这一条写坏了/, "没给判据");
  assert.match(spec.schemaHint, /"truth":"这句话底下真正的意思"/, "schemaHint 里没有 truth，或者写成了样例内容");
  // 施工规则/prompt-no-content-samples.md：占位值只能是说明，不能是可照抄的内容
  ["嘴上是硬的、底下是软的"].forEach(s =>
    assert.ok(spec.schemaHint.indexOf(s) < 0, "schemaHint 里塞了可照抄的内容示范"));
});

test("五栏都渲染得出来，翻开的那张也渲染得出来", () => {
  const props = { d: FIXTURES.tally, char: { name: "某人" }, t: {}, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
  P.TALLY_TABS.forEach(tb => {
    // useState 第 0 个是 tab、第 1 个是翻开的那张、第 2 个是蹦了几个字
    assert.doesNotThrow(() => loadPhone({ 0: tb.k }).TallyView(props), tb.k + " 那一栏炸了");
    const open = P.tallyEntries(tb.k, FIXTURES.tally).filter(e => e.back.text)[0];
    if (!open) return;
    let tree;
    assert.doesNotThrow(() => { tree = loadPhone({ 0: tb.k, 1: open.key, 2: 3 }).TallyView(props); }, tb.k + " 翻开那张炸了");
    const s = JSON.stringify(tree);
    assert.ok(s.includes(open.back.text.slice(0, 3)), tb.k + " 翻开之后背面是空的");
    assert.ok(s.includes(open.back.label), tb.k + " 背面没写这是什么");
  });
});
