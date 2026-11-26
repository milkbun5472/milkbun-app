// 联机海龟汤真机那几件：署名照实写、出题要原创、提问像这个人、座位缺名不叫真人 TA、半窗小条各记各的位置
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const gsrc = read("js/netroom-games.js"), games = read("js/games.js"), cmp = read("js/components.js");
function load(GSh) { const w = {}; new Function("window", gsrc)(w); w.GameShared = GSh || {}; return w.NetGameCore; }

test("署名：自己写的写名字；空着让模型现出写「让系统现出」；系统出写「系统出的题」", async () => {
  const G = load({ guess: { newPuzzle: async () => ({ surface: "现编汤面", truth: "现编汤底" }) } });
  const A = G.ADAPTERS.haigui, api = {};
  const seats = [{ kind: "user", peer: "A", name: "Lisa" }, { kind: "npc", name: "路人甲" }];
  const inv = m => ({ key: "haigui", host: "A", seats, setter: { mode: m }, mode: "normal" });
  const own = await A.init(inv("host"), { hostApi: api, prep: { surface: "我的汤面", truth: "我的汤底" } });
  assert.strictEqual(G.byLine(own, inv("host")), "Lisa 出的题");
  const gen = await A.init(inv("host"), { hostApi: api, prep: {} });
  assert.strictEqual(G.byLine(gen, inv("host")), "Lisa 让系统现出的题");
  const sys = await A.init(inv("system"), { hostApi: api, prep: {} });
  assert.strictEqual(G.byLine(sys, inv("system")), "系统出的题");
  assert.match(A.stateText(A.view(gen), 1, inv("host"), null), /Lisa 让系统现出的题/);
  // 指定的真人出题人点「用我的线路现出一道」
  const iv = { key: "haigui", host: "A", seats, setter: { mode: "seat", peer: "A" }, mode: "normal" };
  const st0 = await A.init(iv, { hostApi: api });
  const r = await A.apply(st0, 0, { puzzle: { surface: "s", truth: "t", gen: true } }, { inv: iv, hostApi: api });
  assert.strictEqual(G.byLine(r.st, iv), "Lisa 让系统现出的题");
  const r2 = await A.apply(st0, 0, { puzzle: { surface: "s", truth: "t" } }, { inv: iv, hostApi: api });
  assert.strictEqual(G.byLine(r2.st, iv), "Lisa 出的题");
});

test("座位缺名：角色叫 TA，真人叫她，别的写第几座", () => {
  const G = load({});
  assert.strictEqual(G.seatName({ kind: "char" }, 0), "TA");
  assert.strictEqual(G.seatName({ kind: "user" }, 0), "她");
  assert.strictEqual(G.seatName({ kind: "npc" }, 2), "第 3 座");
  assert.strictEqual(G.nmOf({ seats: [{ kind: "user", name: "" }] }, 0), "她");
  assert.ok(!/\|\| "TA"/.test(read("js/netroom-debate.js").split("\n").find(l => l.includes("const nm = (inv, i)")) || ""));
});

test("出题要原创；提问只凭桌上推、用自己的嘴问；一轮连答带整段人设（单机共用）", () => {
  const cut = (a, b) => { const i = games.indexOf(a), j = games.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return games.slice(i, j); };
  assert.match(cut("  async function genGuessNext(", "  function guessSecretBlock("), /GUESS_ORIGINAL/);
  const ask = cut("  async function guessAskOne(", "  async function runGuessRound(");
  assert.match(ask, /GUESS_PLAY_FAIR/); assert.match(ask, /GUESS_ASK_VOICE/);
  const round = cut("  async function runGuessRound(", "  async function judgeGuess(");
  assert.match(round, /GUESS_PLAY_FAIR/); assert.match(round, /GUESS_ASK_VOICE/);
  assert.ok(!/voiceBrief\(s\)/.test(round), "不再只拿 220 字速写");
});

test("半窗小条：位置按 forKey 各记各的（单聊还是顶层那一对），别处不许停进顶栏那一截", () => {
  assert.match(cmp, /function halfWinPillPos\(forKey\)/);
  assert.match(cmp, /halfWinPillSave\(forKey, last\)/);
  assert.match(cmp, /const pillOwnKey = k => !k \|\| k === "chat" \? "" : k;/);
  assert.match(cmp, /topMin = pillOwnKey\(forKey\) \? PILL_TOP : 4/);
  // 跑一遍读写：单聊那一对不动，netchat 记在 by 里
  const store = {};
  const lsrc = cmp.slice(cmp.indexOf("const PILL_TOP"), cmp.indexOf("// 半窗摆在哪、多大"));
  const f = new Function("localStorage", "window", lsrc + "\nreturn { halfWinPillPos, halfWinPillSave };")({ getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } }, { innerWidth: 400, innerHeight: 800 });
  f.halfWinPillSave("chat", { x: 300, y: 10 });
  f.halfWinPillSave("netchat", { x: 100, y: 10 });
  assert.deepStrictEqual(f.halfWinPillPos("chat"), { x: 300, y: 10 });
  assert.deepStrictEqual(f.halfWinPillPos("netchat"), { x: 100, y: 96 }, "联机小条不压顶栏");
  assert.strictEqual(f.halfWinPillPos("netgame"), null, "没拖过就用默认位置");
});
