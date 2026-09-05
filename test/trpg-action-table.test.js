const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/trpg.js"), "utf8");
const { applyTurnPayload, normOrder } = require("../js/trpg.js");

// ============================================================
// 险境行动表(她 2026-09-04:跑团还是单调)——原来危险拍的 order 只是一枚「⚔ 顺序」角标。
// 现在守密人给每人一行 {who, act, stat}:谁、这一拍要做的那一下、要过哪项检定;
// 她一点选项,表上队友的骰子各自落(不开仪式),连她的一起入史,守密人一拍结算整桌。
// ============================================================

const party = () => [{ key: "user", name: "Lisa", hp: 80, maxHp: 100, stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 } },
  { key: "c1", name: "裴照川", hp: 100, maxHp: 100, stats: { phy: 60, agi: 55, wit: 70, cha: 65, luck: 40 } },
  { key: "c2", name: "陆闻", hp: 0, maxHp: 100, stats: { phy: 40, agi: 55, wit: 70, cha: 65, luck: 40 } }];
const camp = (over) => Object.assign({ party: party(), items: [], clues: [], place: "驿站", stageIdx: 0, stageAt: 0, stages: [{ goal: "a", done: false }], choices: [], pendingStage: false, pendingEnd: false, msgs: [] }, over || {});

test("normOrder:认名字也认 {who,act,stat};只认队伍成员、同一人一行;玩家那一行永远没有 stat", () => {
  const rows = normOrder(["裴照川", { who: "Lisa", act: "不该有", stat: "agi" }, { who: "陆闻", act: "从侧面绕过去", stat: "agi" }, { who: "裴照川", act: "重复" }, { who: "路人", act: "x" }, { name: "陆闻" }], party());
  assert.deepEqual(rows, [{ who: "裴照川", act: "", stat: null }, { who: "Lisa", act: "不该有", stat: null }, { who: "陆闻", act: "从侧面绕过去", stat: "agi" }]);
  assert.deepEqual(normOrder([{ who: "裴照川", stat: "xyz" }], party())[0].stat, null, "不合法的 stat 当不用过检定");
  assert.deepEqual(normOrder(null, party()), []);
});

test("applyTurnPayload:两行以上才成桌,存成 table 并钉顺序角标;别的拍撤桌", () => {
  const r = applyTurnPayload(camp(), { order: [{ who: "裴照川", act: "掀桌", stat: "phy" }, "Lisa"] });
  assert.deepEqual(r.camp.table, [{ who: "裴照川", act: "掀桌", stat: "phy" }, { who: "Lisa", act: "", stat: null }]);
  assert.ok(r.chips.some(ch => ch.txt === "⚔ 顺序:裴照川→Lisa"));
  assert.equal(applyTurnPayload(r.camp, {}).camp.table, null, "下一拍没排表就撤");
  assert.equal(applyTurnPayload(camp(), { order: ["裴照川"] }).camp.table, null, "一个人不成桌");
});

test("pickChoice:表上有 stat 的队友各掷各的骰(倒下的不掷、玩家不掷),连她的检定一起入史", () => {
  assert.match(src, /const tableRolls = \(camp\.table \|\| \[\]\)\.filter\(r => r\.stat\)\.map\(r => \{/);
  assert.match(src, /if \(!m \|\| m\.key === "user" \|\| m\.hp <= 0\) return null;/);
  assert.match(src, /const res = autoRoll\(m, r\.stat\);/);
  assert.match(src, /content: \(r\.act \? "〔" \+ r\.act \+ "〕" : ""\) \+ rollLine\("", m, \{ stat: r\.stat \}, res\)/, "骰子行前头带上他要做的那一下");
  assert.match(src, /return turn\(txt, tableRolls\.length \? tableRolls : null, mixMode/, "没检定的选项也带队友的骰");
  assert.match(src, /turn\(txt, tableRolls\.concat\(\[Object\.assign\(\{ id: rid\("rm_"\), role: "roll", content: line/, "她的骰排在队友之后");
  // autoRoll 的形状要和仪式掷出来的一样(rollLine/rollRec 都照吃),并且吃羁绊加成
  assert.match(src, /const autoRoll = \(m, stat\) => \{[\s\S]*?const bond = bondBoost\(m\);[\s\S]*?grade: gradeCheck\(roll, effVal\), effVal, feat: null, assist: null, bond/);
});

test("提示词:行动表每行 who/act/stat,玩家那行留空;结算拍告诉守密人队友的骰已经掷过", () => {
  assert.match(src, /【行动表】危险或交战的拍,在 order 里排本拍的行动表/);
  assert.match(src, /act 是他这一拍打算做的那一下\(≤20字,用他自己的路数,不是泛泛的『进攻』\)/);
  assert.match(src, /那一行 act 留空、stat 给 null——那一下由 Ta 自己选/);
  assert.match(src, /\\"order\\":\[\{\\"who\\":\\"成员名\\",\\"act\\":\\"他这一拍要做的那一下\\",\\"stat\\":null\}\]/);
  assert.match(src, /〔行动表结算〕上一拍排了行动表,这一拍每人各动一下,按表上的先后写:队友的检定已经在上面掷过/);
  assert.match(src, /失败就真失败,别替他圆/);
});

test("界面:一张排好先后的桌,每人一行,她那一行指向底下的选项,倒下的划掉", () => {
  assert.match(src, /"⚔ 行动表 · 你一动,各自落骰"/);
  assert.match(src, /mine \? "轮到你——底下选" : r\.act \|\| "见机行事"/);
  assert.match(src, /textDecoration: m && m\.hp <= 0 \? "line-through" : "none"/);
  assert.match(src, /"🎲 " \+ STAT_ZH\[r\.stat\] \+ " " \+ \(m && m\.stats \? m\.stats\[r\.stat\] : ""\)/);
});
