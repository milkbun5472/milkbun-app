const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/trpg.js"), "utf8");
const { applyTurnPayload, normChoices } = require("../js/trpg.js");

// ============================================================
// 换视角拍(她 2026-09-04:跑团还是单调)——镜头交给一位队友,这一拍用他的眼睛看,
// 选项是他的选项(他的口吻、掷他的骰);她替他选了他不情愿的那条,记在羁绊上。
// ============================================================

const party = () => [{ key: "user", name: "Lisa", hp: 80, maxHp: 100, stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 } },
  { key: "c1", name: "裴照川", hp: 100, maxHp: 100, bond: 50, stats: { phy: 60, agi: 55, wit: 70, cha: 65, luck: 40 } },
  { key: "c2", name: "陆闻", hp: 100, maxHp: 100, bond: 50, stats: { phy: 40, agi: 55, wit: 70, cha: 65, luck: 40 } }];
const camp = (over) => Object.assign({ party: party(), items: [], clues: [], place: "驿站", stageIdx: 0, stageAt: 0, stages: [{ goal: "a", done: false }], choices: [], pendingStage: false, pendingEnd: false, msgs: [] }, over || {});

test("normChoices:willing 只认 true/false,别的都是 null(普通拍没这回事)", () => {
  const out = normChoices([{ text: "a", willing: true }, { text: "b", willing: false }, { text: "c", willing: "yes" }, { text: "d" }], party());
  assert.deepEqual(out.map(c => c.willing), [true, false, null, null]);
});

test("换视角拍:camp.pov 记下镜头在谁身上,别的拍一律收回", () => {
  const r = applyTurnPayload(camp(), { choices: [{ text: "他会先走", willing: true }] }, { pov: "裴照川" });
  assert.equal(r.camp.pov, "裴照川");
  assert.equal(r.camp.choices[0].willing, true);
  assert.equal(applyTurnPayload(r.camp, {}, {}).camp.pov, null);
});

test("视角收回:替他做了违心的决定,羁绊 -5 并钉角标;顺心的不扣;不会被「一拍最多两人」挤掉", () => {
  const against = applyTurnPayload(camp({ pov: "裴照川" }), { bond: [{ name: "陆闻", delta: 1, why: "替她挡了一下" }, { name: "Lisa", delta: 1, why: "x" }] }, { povPick: { who: "裴照川", against: true, text: "留下断后" } });
  const pei = against.camp.party.find(m => m.name === "裴照川");
  assert.equal(pei.bond, 45);
  assert.equal(pei.bondLog[0].why, "你替他做了他不愿的决定");
  assert.ok(against.chips.some(ch => ch.k === "hp" && /🔗 裴照川-5 · 你替他做了他不愿的决定/.test(ch.txt)));
  assert.equal(against.camp.party.find(m => m.name === "陆闻").bond, 55, "守密人报的另一位照旧");
  const willing = applyTurnPayload(camp({ pov: "裴照川" }), {}, { povPick: { who: "裴照川", against: false, text: "先走" } });
  assert.equal(willing.camp.party.find(m => m.name === "裴照川").bond, 50);
  const user = applyTurnPayload(camp(), {}, { povPick: { who: "Lisa", against: true, text: "x" } });
  assert.ok(!user.chips.some(ch => /🔗/.test(ch.txt)), "玩家自己头上不挂羁绊");
});

test("turn():换视角是特殊拍;pickChoice 带上 povPick、骰子默认掷他的", () => {
  assert.match(src, /const cc = \(mode && \([^)]*mode\.pov[^)]*\)\)/);
  assert.match(src, /const specialMode = mode && \([^)]*mode\.pov[^)]*\)/);
  assert.match(src, /pov: \(mode && mode\.pov\) \|\| null, povPick: \(mode && mode\.povPick\) \|\| null/);
  assert.match(src, /const povMode = camp\.pov \? \{ povPick: \{ who: camp\.pov, against: c\.willing === false, text: c\.text \} \} : null;/);
  assert.match(src, /if \(!m && camp\.pov\) m = findMember\(camp\.party, camp\.pov\);/);
  assert.match(src, /rollRec\(m, c\.check, res\)\)\]\), mixMode\);/, "带检定的那条也要带 povPick");
  assert.match(src, /return turn\(txt, tableRolls\.length \? tableRolls : null, mixMode \|\| \(nightWith \? \{ night: nightWith \} : null\)\);/);
});

test("提示词:换视角拍以他为视点、选项标 willing、两条要打架;收回时写他的反应;输出 JSON 有 willing", () => {
  assert.match(src, /〔换视角·" \+ mode\.pov \+ "〕这一拍镜头交给「" \+ mode\.pov \+ "」:正文以他为视点写/);
  assert.match(src, /至少一条是他自己的私念会让他选的\(willing:true\)/);
  assert.match(src, /但他自己不情愿的\(willing:false\),这两条要真的打架/);
  assert.match(src, /check 的 who 一律写「" \+ mode\.pov \+ "」/);
  assert.match(src, /〔视角收回〕上一拍是「" \+ mode\.povPick\.who \+ "」的视角/);
  assert.match(src, /他照做了,但会有反应,写进他的言行与之后几句里,别演成大度/);
  assert.match(src, /\\"payoff\\":\\"擅长换来什么\\",\\"willing\\":null,/);
});

test("界面:+ 菜单和自由活动里都能把镜头交出去;那一拍气泡带眉标;选项标他想不想", () => {
  assert.match(src, /turn\("\(镜头转到" \+ x\.name \+ "那边\)", null, \{ pov: x\.name \}\)/, "+ 菜单每位在场队友一个");
  assert.match(src, /const mt = mates\[camp\.msgs\.length % mates\.length\];/, "自由活动里轮着给一位");
  assert.match(src, /pov: nc\.pov \|\| undefined, chips:/, "写入方:gm 气泡带 pov");
  assert.match(src, /"👁 " \+ m\.pov \+ " 的视角"/);
  assert.match(src, /"—— " \+ camp\.pov \+ " 的选择 · 你替他拿主意 ——"/);
  assert.match(src, /c\.willing \? "他想这么做" : "他不情愿"/);
});
