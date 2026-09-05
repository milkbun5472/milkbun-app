const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/trpg.js"), "utf8");
const { applyTurnPayload, awayClocks, AWAY_CLOCK_MAX, AWAY_DAY_MAX, foldHist } = require("../js/trpg.js");

// ============================================================
// 离线这几天(她 2026-09-04:「4 要是我一周不玩咋办」)——隔了一天以上回来,世界没停:
// 钟按真实天数走,但至多两格、永远不走满(走满要爆发,那得她在场);团内时间跟着跳;
// 名册里有人情账的那位可能捎来一封信。一次调用,由她在「休团回来」那张卡上自己点。
// ============================================================

const camp = (over) => Object.assign({
  party: [{ key: "user", name: "Lisa", hp: 80, maxHp: 100, stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 } }],
  items: [], clues: [], place: "驿站", stageIdx: 0, stageAt: 0, stages: [{ goal: "a", done: false }],
  choices: [], pendingStage: false, pendingEnd: false, msgs: [], time: { day: 3, part: "暮" },
  clocks: [{ name: "追兵", filled: 2, max: 6 }, { name: "瘟疫", filled: 4, max: 6 }],
  npcs: [{ name: "老掌柜", role: "掌柜", stance: "友", alive: true, debt: { side: "owe", note: "赊的药" } }, { name: "死人", role: "x", alive: false, debt: { side: "owed" } }, { name: "路人", role: "x", alive: true }]
}, over || {});

test("awayClocks:最紧的先走、至多两格、永远不走满;一周不玩也只是两格", () => {
  assert.equal(AWAY_CLOCK_MAX, 2);
  const one = awayClocks(camp().clocks, 1);
  assert.deepEqual(one.moved, [{ name: "瘟疫", from: 4, to: 5, max: 6 }]);
  const week = awayClocks(camp().clocks, 7);
  assert.deepEqual(week.clocks.map(c => c.filled), [3, 5], "瘟疫到 5/6 就停(不走满),第二格给追兵");
  assert.equal(week.moved.length, 2);
  const full = awayClocks([{ name: "a", filled: 5, max: 6 }], 9);
  assert.deepEqual(full.moved, [], "只差一格就满的钟,离线不动");
  assert.deepEqual(awayClocks([], 3).moved, []);
  assert.equal(awayClocks(camp().clocks, 0).moved.length, 0);
  assert.equal(camp().clocks[1].filled, 4, "不改传进来的那份");
});

test("离线拍:钟由时间走、守密人的 clock 字段这一拍不算;团内时间跳真实天数(封顶一周)", () => {
  const r = applyTurnPayload(camp(), { clock: [{ name: "追兵", delta: 3 }], time: { day: 2, part: "晨" } }, { away: { days: 3 }, calm: true });
  assert.deepEqual(r.camp.clocks.map(c => c.filled), [3, 5]);
  assert.ok(r.chips.some(ch => ch.txt === "⏰ 瘟疫 5/6·这几天"));
  assert.equal(r.camp.time.day, 6, "第3日 + 3天");
  assert.ok(r.chips.some(ch => /🕯 第6日·暮·隔了3天/.test(ch.txt)));
  const long = applyTurnPayload(camp(), {}, { away: { days: 30 } });
  assert.equal(long.camp.time.day, 3 + AWAY_DAY_MAX);
  // 守密人报的 time 从跳过之后那天起算,照旧只许再往前两天
  const fwd = applyTurnPayload(camp(), { time: { day: 20, part: "夜" } }, { away: { days: 3 } });
  assert.equal(fwd.camp.time.day, 8);
});

test("捎信:只有名册里活着、有人情账的那位写得出来;信单独落成一条 letter", () => {
  const ok = applyTurnPayload(camp(), { letter: { from: "老掌柜", text: "药钱不急,人先回来。" } }, { away: { days: 2 } });
  assert.deepEqual(ok.letter, { from: "老掌柜", text: "药钱不急,人先回来。" });
  assert.ok(ok.chips.some(ch => ch.txt === "✉ 老掌柜捎来一封信"));
  assert.equal(applyTurnPayload(camp(), { letter: { from: "路人", text: "x" } }, { away: { days: 2 } }).letter, null, "没人情账的不写信");
  assert.equal(applyTurnPayload(camp(), { letter: { from: "死人", text: "x" } }, { away: { days: 2 } }).letter, null, "死了的不写信");
  assert.equal(applyTurnPayload(camp(), { letter: { from: "老掌柜", text: "x" } }, {}).letter, null, "不是离线拍没有信");
  assert.match(src, /if \(r\.letter\) msgs\.push\(\{ id: rid\("rm_"\), role: "letter", from: r\.letter\.from, content: r\.letter\.text, ts: Date\.now\(\) \}\);/, "写入方");
  const hist = foldHist([{ role: "gm", content: "a" }, { role: "letter", from: "老掌柜", content: "b" }]);
  assert.equal(hist[1].content, "〔老掌柜 捎来的信〕b", "信也要喂回历史,守密人得知道他写过什么");
});

test("turn():离线拍是特殊拍、场景钉 interlude、钟不锈死;提示词点名走过的钟和有人情账的人", () => {
  assert.match(src, /mode\.pov \|\| mode\.away\)\) \|\| tailHasCC/);
  assert.match(src, /mode\.pov \|\| mode\.away \|\| mode\.travel/);
  assert.match(src, /\(mode && \(mode\.night \|\| mode\.away\)\)\) \? "interlude"/);
  assert.match(src, /away: mode && mode\.away \? \{ days: mode\.away \} : null,/);
  assert.match(src, /〔离线这几天〕sceneMeta\.type 固定 interlude。队伍在「/);
  assert.match(src, /各自要有看得见的征兆\(风声、来人、价钱、封锁、伤口\),但都【没有爆发】/);
  assert.match(src, /clock 字段留空\(钟已由时间走过了\)/);
  assert.match(src, /\\"letter\\":null,/);
});

test("休团回来那张卡:隔了一天以上、世界有东西会动,才递「看看这几天」;点掉也记住,不反复递", () => {
  assert.match(src, /const awayDays = Math\.floor\(\(Date\.now\(\) - lastTs\) \/ 86400000\);/);
  assert.match(src, /const offerAway = awayDays >= 1 && worldMoves && camp\.awayAck !== lastTs;/);
  assert.match(src, /turn\("\(隔了 " \+ awayDays \+ " 天回来\)", null, \{ away: awayDays \}\)/);
  assert.match(src, /offerAway \? "当没发生过,接上" : "接上,继续"/);
  assert.match(src, /"钟会跟着走\(最多两格,不会走满\)"/);
  assert.match(src, /m\.role === "letter"\n\s*\? h\("div"/);
});
