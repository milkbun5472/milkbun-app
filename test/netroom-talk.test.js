// 联机小游戏：牌桌上说话 + NPC 合并调用（js/netroom-games.js 文件头「牌桌上说话」「mergeNpc」两段）
//   台词只拿公开 view + 自己那份 priv；关了就不开口；say 走桌边那一路、不进出手；
//   海龟汤庄那一次顺带替 NPC 问；故事接龙前一位角色顺带写 NPC 那句、庄校验后才收、NPC 不再单独调用；有私密信息的不走 prev
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const gsrc = read("js/netroom-games.js"), csrc = read("js/netroom-cards.js"), dsrc = read("js/netroom-debate.js"), games = read("js/games.js");

function load(GSh) {
  const w = {};
  new Function("window", gsrc)(w);
  w.GameShared = GSh || {};
  new Function("window", csrc)(w);
  new Function("window", dsrc)(w);
  return { G: w.NetGameCore, w };
}
function bus(ids, mk) {
  const S = {}, log = [];
  const deliver = (from, obj, to) => { log.push({ from, obj, to }); (to ? [to] : ids.filter(x => x !== from)).forEach(id => setTimeout(() => S[id] && S[id].onMessage(JSON.parse(JSON.stringify(obj)), from), 0)); };
  ids.forEach(id => { S[id] = mk(id, (obj, to) => deliver(id, obj, to)); });
  return { S, log };
}
const tick = () => new Promise(ok => setTimeout(ok, 2));
async function until(fn, n) { for (let i = 0; i < (n || 2000); i++) { if (fn()) return true; await tick(); } return false; }
const sess = (w, id, send, extra) => w.NetGameSession(Object.assign({ me: () => id, nick: () => id, nickOf: x => x, send, fast: true, post: () => {}, patchCard: () => {},
  charOf: cid => ({ id: cid, name: cid, persona: "人设" + cid }), apiFor: cid => ({ cid }), presence: () => ({ A: "on", B: "on" }), myChars: () => [] }, extra || {}));

test("不调模型的那几盒：台词只拿公开 view 和这个座位自己那份 priv；关了「牌桌上说话」就不问", async () => {
  const scenes = [];
  const GSh = { seatTalk: async (api, who, scene) => { scenes.push({ api, who: who.map(x => x.name), scene }); return [{ name: who[0].name, text: "嘿，" + who[0].name }]; } };
  const { G, w } = load(GSh);
  G.ADAPTERS.fake = { zh: "假牌", localTalk: true, needPriv: true, seatRange: () => ({ min: 3, max: 3 }), init: () => ({ hands: ["底牌零", "底牌一", "底牌二"] }),
    view: () => ({ table: "桌面公开" }), cleanView: v => v, priv: (st, i) => ({ hand: st.hands[i] }), turn: () => -1, result: () => null,
    talkMoment: () => "关键时刻", stateText: (v, i, inv, pv) => v.table + (pv ? "｜我手里：" + pv.hand : "") };
  const opts = { b1: {}, b2: { talk: false } };
  const { S } = bus(["A", "B"], (id, send) => sess(w, id, send, { charOpts: (gid, cid) => opts[cid] || {} }));
  const gid = S.A.invite({ key: "fake", zh: "假牌", min: 3, max: 3 }, { total: 3, npcFill: false }, [{ kind: "user" }]);
  S.B.join(gid, [{ kind: "char", charId: "b1", name: "b1" }, { kind: "char", charId: "b2", name: "b2" }], "A");
  await until(() => S.A.seen(gid) == null && false, 5); await until(() => false, 20);
  assert.ok(await S.A.start(gid));
  assert.ok(await until(() => (S.A.seen(gid).side || []).some(x => x.kind === "talk")), "台词没传到庄那边");
  await until(() => false, 30);
  assert.strictEqual(scenes.length, 1, "关了的 b2 不问");
  assert.deepStrictEqual(scenes[0].who, ["b1"]);
  assert.strictEqual(scenes[0].api.cid, "b1", "用 TA 自己的线路");
  assert.ok(scenes[0].scene.includes("底牌一") && !scenes[0].scene.includes("底牌零") && !scenes[0].scene.includes("底牌二"), "只带自己那份 priv");
  const t = S.A.seen(gid).side.find(x => x.kind === "talk");
  assert.deepStrictEqual([t.name, t.text, t.seat], ["b1", "嘿，b1", 1]);
  assert.match(G.stateText(S.A.seen(gid).inv, { table: "x" }, -1, null, S.A.seen(gid).side), /牌桌上刚才说的：\n· b1：嘿，b1/);
  delete G.ADAPTERS.fake;
});

test("出手顺带的 say：从出手里拿掉、走桌边那一路；关了就丢掉", async () => {
  for (const off of [false, true]) {
    const { G, w } = load({});
    const got = [];
    G.ADAPTERS.fake2 = { zh: "假", seatRange: () => ({ min: 2, max: 2 }), init: () => ({ n: 0 }), view: st => ({ n: st.n }), cleanView: v => v, priv: () => null,
      turn: st => st.n === 0 ? 1 : -1, apply: (st, i, mv) => { got.push(mv); return { st: { n: 1 } }; }, result: () => null,
      charMove: (v, i, inv, ctx) => ({ x: 1, say: ctx.opts.talk === false ? "" : "我来了", npc: { seat: 0, line: "偷带" } }) };
    const { S } = bus(["A", "B"], (id, send) => sess(w, id, send, { charOpts: () => (off ? { talk: false } : {}) }));
    const gid = S.A.invite({ key: "fake2", zh: "假", min: 2, max: 2 }, { total: 2 }, [{ kind: "user" }]);
    S.B.join(gid, [{ kind: "char", charId: "b1", name: "b1" }], "A");
    await until(() => false, 20);
    assert.ok(await S.A.start(gid));
    assert.ok(await until(() => got.length === 1));
    assert.ok(!("say" in got[0]), "say 不进出手");
    assert.ok(!("npc" in got[0]), "没声明 mergeNpc:prev 的，带来的 NPC 那一手不收");
    await until(() => false, 20);
    const talk = (S.A.seen(gid).side || []).filter(x => x.kind === "talk");
    assert.strictEqual(talk.length, off ? 0 : 1);
    delete G.ADAPTERS.fake2;
  }
});

test("海龟汤 mergeNpc:host：庄答真人那一问的同一次，替后面连着的两个 NPC 各问一个；NPC 不再单独调用", async () => {
  const calls = { round: 0, askOne: 0, answerOne: 0 }, seen = [];
  const guess = { KINDS: { haigui: { verdicts: "是 / 不是 / 不重要 / 接近了" } }, hit: () => false,
    round: async (api, kind, ctx, q, speakers) => { calls.round++; seen.push({ q, names: speakers.map(s => s.name), secretIn: JSON.stringify(ctx) }); return { userAnswer: { verdict: "不是", note: "" }, ai: speakers.map(s => ({ name: s.name, question: s.name + "问的", verdict: "瞎编", note: "" })), solvedBy: "" }; },
    askOne: async () => { calls.askOne++; return "x"; }, answerOne: async () => { calls.answerOne++; return { verdict: "是" }; } };
  const { G, w } = load({ guess });
  const { S } = bus(["A"], (id, send) => sess(w, id, send, { hostApi: () => ({ host: 1 }) }));
  const gid = S.A.invite({ key: "haigui", zh: "海龟汤", min: 2, max: 8 }, { total: 3, npcFill: true }, [{ kind: "user" }], { surface: "汤面", truth: "汤底" }, { mode: "system" });
  assert.ok(await S.A.start(gid));
  S.A.move(gid, 0, { ask: "是人吗" });
  assert.ok(await until(() => S.A.seen(gid).view.log.length === 3));
  const v = S.A.seen(gid).view;
  assert.strictEqual(calls.round, 1); assert.strictEqual(calls.askOne, 0); assert.strictEqual(calls.answerOne, 0);
  assert.deepStrictEqual(seen[0].names, ["路人甲", "路人乙"]);
  assert.deepStrictEqual(v.log.map(l => l.q), ["是人吗", "路人甲问的", "路人乙问的"]);
  assert.strictEqual(v.log[1].verdict, "不重要", "NPC 那一手的判词照样过白名单");
  assert.strictEqual(v.turn, 0, "又轮回真人");
});

test("故事接龙 mergeNpc:prev：角色那台一次写两句，庄只收紧跟着的 NPC 座位；那个 NPC 不再单独调用", async () => {
  const calls = { next: 0, npcWrite: 0 };
  let k = 0;
  const story = {
    newGame: (players) => ({ status: "playing", laps: 3, turn: 0, opener: "开头。", lines: [], players, word: "词" + (k++) }),
    act: (st, key, line) => { const p = st.players[st.turn]; st.lines.push({ key: p.key, name: p.name, text: line, word: st.word, used: line.indexOf(st.word) >= 0 }); if (st.lines.length >= st.players.length * st.laps) { st.status = "finished"; return; } st.turn = (st.turn + 1) % st.players.length; st.word = "词" + (k++); },
    text: st => st.lines.map(l => l.text).join(""),
    writeLine: async (api) => { if (api.host) calls.npcWrite++; return { line: "单写", say: "" }; },
    writeLineNext: async (api, st, who, next, nextWord) => { calls.next++; return { line: "角色句", say: "嘿", next: { line: "NPC句用" + nextWord, say: "" } }; }
  };
  const { G, w } = load({ story });
  const { S } = bus(["A", "B"], (id, send) => sess(w, id, send, { hostApi: () => ({ host: 1 }) }));
  const gid = S.A.invite({ key: "story", zh: "故事接龙", min: 2, max: 8 }, { total: 3, npcFill: true }, [{ kind: "user" }]);
  S.B.join(gid, [{ kind: "char", charId: "b1", name: "b1" }], "A");
  await until(() => false, 20);
  assert.ok(await S.A.start(gid));
  const nw = S.A.seen(gid).view.nextWord;
  S.A.move(gid, 0, { line: "我写的" });
  assert.ok(await until(() => S.A.seen(gid).view.lines.length >= 3));
  const v = S.A.seen(gid).view;
  assert.deepStrictEqual(v.lines.slice(0, 3).map(l => l.text), ["我写的", "角色句", "NPC句用" + v.lines[2].word]);
  assert.ok(v.lines[2].used, "NPC 那句拿到的是提前亮出来的那个词");
  assert.strictEqual(calls.next, 1); assert.strictEqual(calls.npcWrite, 0, "NPC 没再单独调用");
  assert.strictEqual(v.turn, 0);
  assert.ok(nw);
});

test("各盒声明的合并方式：有私密信息的、不调模型的不走 prev；文件头写着接口", () => {
  const { G } = load({});
  const A = G.ADAPTERS;
  assert.strictEqual(A.haigui.mergeNpc, "host"); assert.strictEqual(A.q25.mergeNpc, "host");
  ["story", "tod", "debate"].forEach(k => assert.strictEqual(A[k].mergeNpc, "prev", k));
  ["spy", "lingxi", "uno", "poker", "doudizhu", "mahjong", "gomoku", "chess", "go", "monopoly"].forEach(k => assert.ok(A[k] && A[k].mergeNpc !== "prev", k + " 不许 prev"));
  Object.keys(A).filter(k => A[k].needPriv).forEach(k => assert.notStrictEqual(A[k].mergeNpc, "prev", k));
  ["gomoku", "chess", "go", "monopoly", "uno", "mahjong"].forEach(k => assert.ok(A[k].localTalk, k));
  assert.ok(gsrc.indexOf("mergeNpc: \"host\" | \"prev\" | null") > 0);
  assert.ok(G.charOptKinds("spy").indexOf("talk") >= 0);
  assert.strictEqual(G.cleanTalk({ text: " ", name: "x" }), null);
  assert.deepStrictEqual(Object.keys(G.cleanTalk({ kind: "talk", name: "a", text: "b", hand: "底牌" })).sort(), ["kind", "name", "npc", "peer", "seat", "text"]);
});

test("单机那几份：顺带台词／合并都是可选参数，不带就照旧；公共函数里不提联机", () => {
  const i = games.indexOf("  async function seatTalk("), j = games.indexOf("  function useBoardTalk(", i);
  assert.ok(i > 0 && j > i);
  const k = games.indexOf("  async function storyWriteLineNext("), l = games.indexOf("  function StoryChainGame(", k);
  assert.ok(k > 0 && l > k);
  [games.slice(i, j), games.slice(k, l)].forEach(src => assert.ok(!/联机|netroom/i.test(src)));
  assert.match(games, /return who && who\.withSay \? \{ question: q, say:/);
  assert.match(games, /round: runGuessRound/);
});
