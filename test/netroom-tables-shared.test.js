// 联机牌桌换成单机的样子：心有灵犀、擂台、故事接龙、大富翁、斗地主出牌区、麻将牌河、卧底描述和投票都拿 GameShared／DebateShared 那一份画，
//   单机自己也改调同一份（公共组件里不许有「联机」「netroom」）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const gsrc = read("js/netroom-games.js"), csrc = read("js/netroom-cards.js"), dsrc = read("js/netroom-debate.js"), games = read("js/games.js"), deb = read("js/debate.js");

// 极简 React：函数组件当场展开，记下每个公共组件被用到时拿到的 props
function fakeReact(used) {
  const el = (type, props, ...kids) => {
    props = props || {};
    if (typeof type === "function") { if (type.__shared) { used.push([type.__shared, props]); return { shared: type.__shared }; } return type(Object.assign({}, props, { children: kids })); }
    return { type, props, kids };
  };
  return { createElement: el, Fragment: "frag", useState: v => [typeof v === "function" ? v() : v, () => {}], useEffect: () => {}, useRef: v => ({ current: v }) };
}
const mark = (name) => { const f = () => null; f.__shared = name; return f; };
function load(used) {
  const w = { LingxiCore: require("../js/lingxi-core.js"), MahjongCore: require("../js/mahjong-core.js") };
  const R = fakeReact(used);
  const env = { React: R, useTheme: () => ({ ink: "#000", bg: "#fff", bg2: "#eee", line: "#ccc", fog: "#999", sub: "#666", tint: "#c00" }), F_BODY: "a", F_DISPLAY: "b", Avatar: mark("Avatar"), fitTextarea: () => {} };
  const run = src => new Function("window", "React", "useTheme", "F_BODY", "F_DISPLAY", "Avatar", "fitTextarea", src)(w, R, env.useTheme, "a", "b", env.Avatar, env.fitTextarea);
  w.GameShared = { avatarFor: () => () => null, GameVsBar: mark("GameVsBar"), story: { Paper: mark("story.Paper") }, lingxi: { Chip: mark("lingxi.Chip"), RevCard: mark("lingxi.RevCard") },
    mono: { Board: mark("mono.Board"), Roster: mark("mono.Roster"), BOARD: [], maxMoves: () => 22, tokenColor: () => "#000" },
    spy: { Clue: mark("spy.Clue"), VotePick: mark("spy.VotePick") },
    cards: { Seats: mark("cards.Seats"), Log: mark("cards.Log"), PlayCard: mark("PlayCard"), MjTile: mark("MjTile"), MjTable: mark("cards.MjTable"), felt: (kids) => ({ felt: kids }), ddz: { Mid: mark("ddz.Mid"), TYPE_ZH: {}, analyze: () => null } } };
  w.DebateShared = { TurnCard: mark("deb.TurnCard"), SideBlock: mark("deb.SideBlock"), VerdictBoard: mark("deb.VerdictBoard"), Closings: mark("deb.Closings") };
  run(gsrc); run(csrc); run(dsrc);
  return w;
}
const flat = o => JSON.stringify(o, (k, v) => typeof v === "function" ? undefined : v);

test("七张桌都拿单机那份部件画", () => {
  const used = [], w = load(used), C = w.NetGameCore, me = "A";
  const seats2 = [{ kind: "user", peer: "A", name: "甲" }, { kind: "npc", name: "路人甲" }];
  const T = (key, view, extra) => { used.length = 0; C.ADAPTERS[key].Table(Object.assign({ inv: { key, host: "A", status: "playing", seats: (extra && extra.seats) || seats2 }, view, me, priv: null, onMove: () => {}, onReveal: () => {}, isHost: true }, extra || {})); return used.map(u => u[0]); };
  const lx = { phase: "round", sent: [false, true], start: ["山", "海"], pair: ["山", "海"], rounds: [{ n: 1, pair: ["山", "海"], w: ["水", "水"], hit: true }], log: [] };
  assert.deepStrictEqual(T("lingxi", lx).filter(n => n.startsWith("lingxi") || n === "GameVsBar"), ["GameVsBar", "lingxi.Chip", "lingxi.Chip", "lingxi.RevCard"]);
  assert.ok(T("story", { players: [{ key: "s0", name: "甲" }, { key: "s1", name: "路人甲" }], laps: 3, turn: 0, opener: "从前", word: "雨", status: "playing", lines: [], say: [] }).indexOf("story.Paper") >= 0);
  const mono = T("monopoly", { players: [{ key: "s0", name: "甲", cash: 1, pos: 0 }, { key: "s1", name: "乙", cash: 1, pos: 0 }], owners: {}, levels: {}, moves: 0, turn: 0, pending: null, log: [], done: false });
  assert.ok(mono.indexOf("mono.Board") >= 0 && mono.indexOf("mono.Roster") >= 0);
  const ddz = T("doudizhu", { phase: "play", bidTurn: 0, turn: 0, players: [{ n: 17, pts: 0 }, { n: 17, pts: 0 }, { n: 17, pts: 0 }], bottom: [], last: null, bid: { n: 1 }, log: [], status: "playing" }, { seats: [seats2[0], seats2[1], { kind: "npc", name: "路人乙" }] });
  assert.ok(ddz.indexOf("ddz.Mid") >= 0, ddz.join());
  const mj = T("mahjong", { phase: "discard", turn: 0, variant: "guobiao", handNo: 1, hands: 4, wallN: 80, players: [0, 1, 2, 3].map(i => ({ name: "p" + i, n: 13, pts: 0, melds: [], river: [], flowers: [] })), log: [], status: "playing" }, { seats: [seats2[0], seats2[1], { kind: "npc", name: "c" }, { kind: "npc", name: "d" }] });
  assert.ok(mj.indexOf("cards.MjTable") >= 0);
  const spy = T("spy", { phase: "vote", round: 1, alive: [true, true, true], clues: [{ seat: 1, round: 1, text: "圆的" }], voted: [], queue: [0, 1, 2], qi: 0, outRoles: [], log: [] }, { seats: [seats2[0], seats2[1], { kind: "npc", name: "c" }] });
  assert.ok(spy.indexOf("spy.Clue") >= 0, spy.join());
  const deb = T("debate", { topic: "早起", mode: "serious", rounds: 3, round: 0, pos: 0, order: [0, 1], sides: ["pro", "con"], pickBy: [false, false], stances: ["", ""], turns: [{ seat: 1, name: "路人甲", side: "con", round: 0, text: "不" }], verdict: { winner: "甲", reason: "好", crux: "" }, busy: false, phase: "done" }, { side: [{ kind: "dm", name: "乙", text: "哈" }, { kind: "aw", name: "路人甲", text: "不服" }] });
  ["deb.TurnCard", "deb.VerdictBoard", "deb.Closings", "deb.SideBlock"].forEach(n => assert.ok(deb.indexOf(n) >= 0, n));
});

test("单机改调同一份；公共组件里不许有「联机」「netroom」", () => {
  [["StoryPaper", "h(StoryPaper, {"], ["LingxiChip", "h(LingxiChip, {"], ["LingxiRevCard", "h(LingxiRevCard, {"], ["MonoBoard", "h(MonoBoard,{"], ["MonoRoster", "h(MonoRoster,{"], ["DdzMid", "h(DdzMid, {"], ["SpyClue", "h(SpyClue, {"], ["SpyVotePick", "h(SpyVotePick, {"]].forEach(([fn, use]) => {
    const i = games.indexOf("  function " + fn + "("), j = games.indexOf("\n  }\n", i);
    assert.ok(i > 0, fn); assert.ok(games.indexOf(use) > 0, "单机没改调 " + fn);
    assert.ok(!/联机|netroom/i.test(games.slice(i, j)), fn + " 里出现联机");
  });
  ["DebTurnCard", "DebSideBlock", "DebVerdictBoard", "DebClosings"].forEach(fn => {
    const i = deb.indexOf("  function " + fn + "("), j = deb.indexOf("\n  }\n", i);
    assert.ok(i > 0, fn); assert.ok(!/联机|netroom/i.test(deb.slice(i, j)), fn);
  });
  assert.match(deb, /h\(DebTurnCard, \{/); assert.match(deb, /h\(DebVerdictBoard, \{/); assert.match(deb, /h\(DebClosings, \{/); assert.match(deb, /h\(DebSideBlock, \{/);
});
