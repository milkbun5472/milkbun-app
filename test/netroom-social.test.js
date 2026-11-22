// 联机房间第三期·第三档：狼人杀、阿瓦隆（js/netroom-social.js）。
//   每个座位的 priv 只有该看的；公开那份没有身份；任务牌只亮统计；胜负走单机那份；角色出手只拿自己那份；人数补满；终局回看全亮
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const gsrc = read("js/netroom-games.js"), ssrc = read("js/netroom-social.js"), games = read("js/games.js");
const cutr = (a, b) => { const i = games.indexOf(a), j = games.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return games.slice(i, j); };
// 规则那几段照 games.js 原样切出来（单机那一份）
const PURE = new Function([
  "function shuffle(a){ return a.slice().sort(() => Math.random() - .5); }",
  cutr("  function wolfCount(n)", "  // 战术参考"), cutr("  function wolfWinner(list, winMode)", "  function validWolfTarget("),
  cutr("  function boardState(list, dayNum)", "  // 白天发言：存活"),
  cutr("  const AV_QUEST = ", "  // 湖中仙女")].join("\n")
  + "\nreturn { wolf: { GODS, WOLF_SPECIALS, roleName, isWolfRole, isGodRole, wolfCount, standardBoard, boardLine, boardState, winner: wolfWinner, privText: wolfPrivText },"
  + " avalon: { QUEST: AV_QUEST, EVIL: AV_EVIL, ROLE_ZH: AV_ROLE_ZH, side: avSide, failsReq: avFailsReq, board: avalonBoard, secretFor: avSecretFor, revealFor: avRevealFor } };")();
function load(ai) {
  const w = {};
  new Function("window", gsrc)(w);
  w.GameShared = { wolf: Object.assign({}, PURE.wolf, ai && ai.wolf), avalon: Object.assign({}, PURE.avalon, ai && ai.avalon) };
  new Function("window", ssrc)(w);
  return w.NetGameCore;
}
const tick = () => new Promise(ok => setTimeout(ok, 2));
async function until(fn, n) { for (let i = 0; i < (n || 4000); i++) { if (fn()) return true; await tick(); } return false; }
const mkInv = (key, n) => ({ gid: "g", key, zh: key, min: n, max: n, host: "A", status: "playing", mode: "normal", npcFill: true, seats: Array.from({ length: n }, (_, i) => ({ kind: "npc", name: "N" + i })) });
const ROLE_WORDS = ["roles", "role", "mates", "sees", "seen", "pot", "grave", "act", "wolfVotes", "nq", "night", "plays", "stances"];
const badKeys = (o, at) => !o || typeof o !== "object" ? [] : Object.keys(o).flatMap(k => k === "reveal" ? [] : (ROLE_WORDS.indexOf(k) >= 0 ? [(at || "") + k] : []).concat(badKeys(o[k], (at || "") + k + ".")));
async function runHost(G, key, n, cfg, each) {
  const A = G.ADAPTERS[key], inv = mkInv(key, n);
  let st = await A.init(inv, { cfg: cfg || {} }), steps = 0;
  while (!A.result(st, inv) && steps++ < 3000) {
    const ti = A.turn(st); assert.ok(ti >= 0, key + " 卡住了");
    const v = A.view(st);
    assert.deepStrictEqual(badKeys(v), [], key + " 公开那份带了身份");
    assert.deepStrictEqual(badKeys(A.cleanView(JSON.parse(JSON.stringify(v)))), []);
    if (each) each(st, v, A, inv);
    const r = await A.apply(st, ti, await A.npcMove(st, ti, inv, {}), { inv });
    assert.ok(!r.err, r.err); st = r.st;
  }
  return { st, inv, A, res: A.result(st, inv) };
}

test("狼人杀：没线路也能靠合规随手打完；公开那份夜里不说轮到谁、不带身份", async () => {
  const G = load();
  for (let k = 0; k < 6; k++) {
    const { st, res, A } = await runHost(G, "werewolf", 9, { gods: ["seer", "witch", "guard", "hunter"], wolfRole: "wolfking" }, (s, v, A) => {
      if (s.phase === "night") { assert.strictEqual(A.turn(v), -1); assert.ok(A.turn(s) >= 0); }
    });
    assert.ok(res && /狼是/.test(res.text));
    assert.strictEqual(res.winners.length > 0, st.win !== "none");
    assert.strictEqual(st.win === "none" ? "none" : st.win, st.win);
    if (st.win !== "none") assert.strictEqual(G.ADAPTERS.werewolf.cleanView(A.view(st)).win, st.win);
  }
});

test("狼人杀 priv：狼人互知、预言家结果只给预言家、女巫只在她轮到时看到倒下的人", async () => {
  const G = load(), A = G.ADAPTERS.werewolf, inv = mkInv("werewolf", 8);
  let st = await A.init(inv, { cfg: { gods: ["seer", "witch", "guard"] } });
  const wolves = st.roles.map((r, i) => /wolf/.test(r) ? i : -1).filter(i => i >= 0);
  st.roles.forEach((r, i) => {
    const p = A.priv(st, i);
    assert.strictEqual(p.role, r);
    if (wolves.indexOf(i) >= 0) assert.deepStrictEqual(p.mates.slice().sort(), wolves.filter(x => x !== i).sort());
    else assert.deepStrictEqual(p.mates, []);
    assert.ok(!("seen" in p) || r === "seer"); assert.ok(!("pot" in p) || r === "witch");
  });
  const seer = st.roles.indexOf("seer"), witch = st.roles.indexOf("witch");
  while (st.phase === "night") {
    const ti = A.turn(st), cur = st.nq[st.qi];
    st.roles.forEach((r, i) => { const p = A.priv(st, i); assert.strictEqual(!!p.act, i === ti, "只有轮到的座位那份带 act"); if (p.act && p.act.stage !== "witch") assert.ok(!("victim" in p.act)); });
    if (cur.stage === "wolf") st.roles.forEach((r, i) => assert.strictEqual("wolfVotes" in A.priv(st, i), wolves.indexOf(i) >= 0));
    if (cur.stage === "witch") assert.ok("victim" in A.priv(st, witch).act);
    st = (await A.apply(st, ti, { pass: true }, { inv })).st;
  }
  const sp = A.priv(st, seer);
  assert.strictEqual(sp.seen.length, 1);
  st.roles.forEach((r, i) => { if (i !== seer) assert.ok(!A.priv(st, i).seen); });
});

test("狼人杀：守了的人不倒，同守同救照样倒（单机同一条）", async () => {
  const G = load(), A = G.ADAPTERS.werewolf, inv = mkInv("werewolf", 8);
  for (const both of [false, true]) {
    let st = await A.init(inv, { cfg: { gods: ["seer", "witch", "guard"] } });
    const target = st.roles.indexOf("seer");
    while (st.phase === "night") {
      const ti = A.turn(st), cur = st.nq[st.qi];
      const mv = cur.stage === "guard" ? { target } : cur.stage === "wolf" ? { target } : cur.stage === "witch" ? { save: both } : { pass: true };
      st = (await A.apply(st, ti, mv, { inv })).st;
    }
    assert.strictEqual(st.alive[target], !both);
  }
});

test("狼人杀胜负：走单机那份 wolfWinner（屠边／屠城）", () => {
  const W = PURE.wolf;
  const L = roles => roles.map(r => ({ role: r, alive: true }));
  assert.strictEqual(W.winner(L(["villager", "seer"]), "side"), "good");
  const l = L(["wolf", "seer", "villager", "villager"]); l[1].alive = false;
  assert.strictEqual(W.winner(l, "side"), "wolf");
  assert.strictEqual(W.winner(l, "all"), null);
  assert.ok(/wolfWinner\(list, cfg\.winMode\)/.test(games), "单机也走同一个函数");
});

test("角色出手只拿自己那份：喂给模型的那一句照 TA 自己的 priv 写，狼只认得队友", async () => {
  const seen = [];
  const G = load({ wolf: { speeches: async (api, sp) => { seen.push(sp[0].priv); return { speeches: [{ name: sp[0].name, text: "我是好人" }], claims: [], stances: [] }; } } });
  const A = G.ADAPTERS.werewolf, inv = mkInv("werewolf", 8);
  let st = await A.init(inv, { cfg: {} });
  while (st.phase === "night") st = (await A.apply(st, A.turn(st), { pass: true }, { inv })).st;
  if (st.phase !== "speech") return;
  const ti = A.turn(st), pv = A.priv(st, ti), v = A.cleanView(JSON.parse(JSON.stringify(A.view(st))));
  const mv = await A.charMove(v, ti, inv, { api: {}, char: { name: "N" + ti, persona: "p" }, opts: {}, priv: pv });
  assert.strictEqual(mv.text, "我是好人");
  const wolves = st.roles.map((r, i) => /wolf/.test(r) ? i : -1).filter(i => i >= 0);
  if (wolves.indexOf(ti) >= 0) wolves.filter(x => x !== ti && st.alive[x]).forEach(x => assert.ok(seen[0].indexOf("N" + x) >= 0));
  else assert.ok(!/狼队友/.test(seen[0]));
  assert.strictEqual((await A.charMove(v, ti, inv, { api: {}, char: {}, opts: {}, priv: null })).pass, true);
});

test("阿瓦隆 priv：梅林看坏人不含莫德雷德，派西维尔看到两个，坏人互认不含奥伯伦", async () => {
  const G = load(), A = G.ADAPTERS.avalon, inv = mkInv("avalon", 10);
  const st = await A.init(inv, { cfg: { av: { percival: true, mordred: true, oberon: true } } });
  const at = r => st.roles.indexOf(r), evil = st.roles.map((r, i) => PURE.avalon.side(r) === "evil" ? i : -1).filter(i => i >= 0);
  assert.deepStrictEqual(A.priv(st, at("merlin")).sees.sort(), evil.filter(i => st.roles[i] !== "mordred").sort());
  assert.deepStrictEqual(A.priv(st, at("percival")).sees.sort(), [at("merlin"), at("morgana")].sort());
  assert.deepStrictEqual(A.priv(st, at("oberon")).sees, []);
  assert.ok(A.priv(st, at("assassin")).sees.indexOf(at("oberon")) < 0);
  st.roles.forEach((r, i) => { if (r === "loyal") assert.deepStrictEqual(A.priv(st, i).sees, []); });
});

test("阿瓦隆：打完一局；任务牌只亮几张失败；终局回看亮全部", async () => {
  const G = load();
  for (let k = 0; k < 6; k++) {
    const { st, res } = await runHost(G, "avalon", 7, { av: { percival: true } }, (s, v) => {
      if (s.phase === "quest") { assert.strictEqual(typeof v.played, "number"); assert.ok(!("plays" in v)); }
      (v.results || []).forEach(r => assert.deepStrictEqual(Object.keys(r).sort(), ["fails", "ok", "team"]));
    });
    assert.ok(/梅林是/.test(res.text));
    assert.strictEqual(res.replay.rows.length, 7);
    assert.ok(res.replay.log.some(x => /^【暗里】/.test(x)));
    assert.ok(["good", "evil"].indexOf(st.win) >= 0);
  }
});

test("人数补满、只发给座位主人：两台手机各自只收到自己座位那份", async () => {
  const G = load(), S = {}, got = { A: [], B: [] };
  const ids = ["A", "B"];
  const deliver = (from, obj, to) => (to ? [to] : ids.filter(x => x !== from)).forEach(id => { if (obj.op === "priv") got[id].push(obj.seat); setTimeout(() => S[id].onMessage(JSON.parse(JSON.stringify(obj)), from), 0); });
  const w = {}; new Function("window", gsrc)(w); w.GameShared = PURE; new Function("window", ssrc)(w);
  ids.forEach(id => { S[id] = w.NetGameSession({ me: () => id, nick: () => id, nickOf: x => x, fast: true, send: (o, to) => deliver(id, o, to), post: () => {}, patchCard: () => {}, hostApi: () => null, apiFor: () => null, charOf: () => null, presence: () => ({ A: "on", B: "on" }) }); });
  const gid = S.A.invite({ key: "werewolf", zh: "狼人杀", min: 5, max: 12 }, { total: 6 }, [{ kind: "user" }]);
  S.B.join(gid, [{ kind: "user" }], "A");
  await until(() => S.A.seen(gid) || true);
  await tick(); await tick();
  assert.ok(await S.A.start(gid));
  assert.ok(await until(() => S.B.seen(gid) && S.B.seen(gid).priv));
  const inv = S.A.seen(gid).inv;
  assert.strictEqual(inv.seats.length, 6);
  assert.strictEqual(inv.seats.filter(s => s.kind === "npc").length, 4);
  const bSeat = inv.seats.findIndex(s => s.peer === "B");
  assert.ok(got.B.length && got.B.every(x => x === bSeat), "B 只收到自己座位那份");
  assert.strictEqual(got.A.length, 0, "庄自己那份不走网络");
});

test("单机入口：开局页能收起白狼王、湖中仙女；联机那页把它们收起", () => {
  assert.ok(/hid\("wolf_" \+ o\.key\)/.test(games) && /hid\("av_" \+ o\.k\)/.test(games));
  const nr = read("js/netroom.js");
  assert.ok(nr.indexOf('"wolf_whitewolf"') > 0 && nr.indexOf('"av_lady"') > 0);
  assert.ok(read("index.html").indexOf("js/netroom-social.js") > read("index.html").indexOf("js/netroom-cards.js"));
});
