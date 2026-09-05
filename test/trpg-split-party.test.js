const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/trpg.js"), "utf8");
const { applyTurnPayload, foldHist } = require("../js/trpg.js");

// ============================================================
// 分头行动(她 2026-09-04:跑团还是单调)——队伍分两路,一次调用写两条线:
// 她这边照常;另一路以队友视点写真正发生了什么(truth),回来只带他们口里的说法(report)。
// 照私念该瞒的瞒——她只看得到 report,truth 落幕才亮。走的人各掷一颗最拿手的骰。
// ============================================================

const camp = (over) => Object.assign({
  party: [{ key: "user", name: "Lisa", hp: 80, maxHp: 100, stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 } },
          { key: "c1", name: "裴照川", hp: 100, maxHp: 100, stats: { phy: 60, agi: 55, wit: 70, cha: 65, luck: 40 } }],
  items: [], clues: [], place: "驿站", stageIdx: 0, stageAt: 0, stages: [{ goal: "a", done: false }],
  choices: [], pendingStage: false, pendingEnd: false, msgs: []
}, over || {});

test("分头拍:apart 落成 report/truth/hidden;没 report 就当没说;不是分头拍一律丢", () => {
  const r = applyTurnPayload(camp(), { apart: { report: "没什么,人没找到。", truth: "他找到了那个人,并放他走了。", hidden: true } }, { split: { who: ["裴照川"], task: "找人" } });
  assert.deepEqual(r.apart, { who: ["裴照川"], report: "没什么,人没找到。", truth: "他找到了那个人,并放他走了。", hidden: true });
  assert.ok(r.chips.some(ch => ch.txt === "⑂ 裴照川回来了"));
  assert.equal(applyTurnPayload(camp(), { apart: { truth: "x", hidden: true } }, { split: { who: ["裴照川"] } }).apart, null);
  assert.equal(applyTurnPayload(camp(), { apart: { report: "x", hidden: true } }, { split: { who: ["裴照川"] } }).apart.hidden, false, "没有真相就谈不上瞒");
  assert.equal(applyTurnPayload(camp(), { apart: { report: "x", truth: "y" } }, {}).apart, null);
});

test("写入方:另一路的说法单独一张 apart 卡,真相跟着存;历史里守密人两个版本都看得到", () => {
  assert.match(src, /if \(r\.apart\) msgs\.push\(\{ id: rid\("rm_"\), role: "apart", who: r\.apart\.who, content: r\.apart\.report, truth: r\.apart\.truth, hidden: r\.apart\.hidden, ts: Date\.now\(\) \}\);/);
  const hist = foldHist([{ role: "gm", content: "a" }, { role: "apart", who: ["裴照川"], content: "没找到", truth: "放走了" }]);
  assert.equal(hist[1].content, "〔分头·裴照川那边真正发生的(玩家只听到了他们的说法)〕放走了\n〔他们回来对玩家说的〕没找到");
});

test("turn():分头是特殊拍;提示词两条线、report 可以和 truth 不一样;输出 JSON 有 apart", () => {
  assert.match(src, /const cc = \(mode && \([^)]*mode\.split[^)]*\)\) \|\| tailHasCC/);
  assert.match(src, /const specialMode = mode && \([^)]*mode\.split[^)]*\)/);
  assert.match(src, /split: \(mode && mode\.split\) \|\| null,/);
  assert.match(src, /〔分头行动〕队伍分成两路:" \+ mode\.split\.who\.join\("、"\)/);
  assert.match(src, /truth 是他们那边【真正发生了什么】/);
  assert.match(src, /照各人的私念,该瞒的瞒、该编的编、该说漏的说漏——瞒了或编了就 hidden 给 true/);
  assert.match(src, /\\"letter\\":null,\\"apart\\":null,/);
});

test("界面:+ 菜单挑人和任务;走的人各掷一颗最拿手的骰;卡上落幕之后才亮真相", () => {
  assert.match(src, /const \[splitWho, setSplitWho\] = useState\(\[\]\);/);
  assert.match(src, /"⑂ 分头行动"/);
  assert.match(src, /const stat = STATS\.map\(x => x\[0\]\)\.sort\(\(a, b\) => \(\(m\.stats \|\| \{\}\)\[b\] \|\| 0\) - \(\(m\.stats \|\| \{\}\)\[a\] \|\| 0\)\)\[0\];/, "最拿手=本事值最高那项");
  assert.match(src, /turn\("\(分头行动:" \+ who\.join\("、"\) \+ \(task \? " 去" \+ task : " 各自去办自己的事"\) \+ ";我留在这边\)", rolls, \{ split: \{ who, task \} \}\)/);
  assert.match(src, /camp\.ended && m\.truth \? h\("div"/, "真相只在落幕后亮");
  assert.match(src, /m\.hidden \? "那边真正发生的\(他们没全说\)" : "那边真正发生的\(他们说的是实话\)"/);
});
