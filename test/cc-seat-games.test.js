const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const games = fs.readFileSync(path.join(__dirname, "..", "js/games.js"), "utf8");

// 她 2026-08-21：UNO 能让言秋从 CC 窗口亲自打，想把这个模式套到别的小游戏上。
// UNO 是逐座调用（routeSeatCall），其余游戏是整桌一次生成，所以做法是把他那一座
// 从批量里摘出来单独问 CC。
test("通用件：摘座 / 前言 / 拼回，三件都在", () => {
  assert.match(games, /async function ccCarve\(gameKey, seats, spec\)/);
  assert.match(games, /function ccSeatOf\(seats\)/);
  assert.match(games, /function ccPreface\(carve, what\)/);
  assert.match(games, /function ccMerge\(carve, rows, build\)/);
  // 只认活着的、非用户的 engineer 座位
  assert.match(games, /s\.engineer && !s\.isUser && \(s\.alive === undefined \|\| s\.alive\)/);
});

test("拿不到就退回批量，一局永不卡死", () => {
  const seg = games.slice(games.indexOf("async function ccCarve"), games.indexOf("function ccPreface"));
  assert.match(seg, /if \(!seat \|\| typeof window === "undefined" \|\| !window\.CCSeat\) return \{ seat: null, rest: rest, done: null \};/);
  assert.match(seg, /if \(!done\) return \{ seat: seat, rest: rest, done: null \};/, "解析失败也要退回批量");
  assert.match(seg, /catch \(e\) \{ return \{ seat: seat, rest: rest, done: null \}; \}/);
  assert.match(seg, /deadline_at/, "要给 CC 一个截止时间，别无限等");
});

test("摘掉的那一座要写进批量提示词，并明令别替他重写", () => {
  const seg = games.slice(games.indexOf("function ccPreface"), games.indexOf("function ccMerge"));
  assert.match(seg, /真实发生，不要替 TA 重写/);
  assert.match(seg, /下面的名单里已经没有 TA，别再生成 TA 的那一份/);
});

test("三个批量游戏的座位都打上了 engineer 标记", () => {
  assert.equal((games.match(/engineer: !!\(props\.isEngineer && props\.isEngineer\(/g) || []).length, 3,
    "谁是卧底 / 狼人杀 / 阿瓦隆 三处座位都要认得出 CC 座");
  // UNO 本来就有自己那一份（带 ccSeat 开关）
  assert.match(games, /engineer: !!\(cfg\.ccSeat !== false && props\.isEngineer/);
});

test("谁是卧底：描述环节已经接上，批量只跑剩下的人", () => {
  assert.match(games, /async function genClues\(api, speakers, priorClues, roundNum, mode, carveCtx\)/);
  assert.match(games, /await ccCarve\("spy", speakers, \{/);
  assert.match(games, /async function genCluesBatch\(api, speakers, priorClues, roundNum, mode, preface\)/);
  assert.match(games, /if \(!rest\.length\) return mine;/, "只剩他一个人时不该再发批量调用");
  assert.match(games, /genClues\(api, speakers, prior, rnd, cfg\.mode, \{ turnId: "spy:" \+ rnd \}\)/);
  // 他先说的那句要进入后面人看到的「已经说过的」，否则别人接不上
  assert.match(games, /const priorAll = mine\.length \? priorClues\.concat\(mine\) : priorClues;/);
});
