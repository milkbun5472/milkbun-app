// js/mahjong-core.js — 广东麻将（她 2026-11-09「做吧」，群里许愿）：纯规则 + 本地牌手，不碰界面、不调模型。
//   一桌四人：她和三个角色／路人。摸打、吃碰杠、食糊、算番、找牌全在这儿，零调用；
//   角色只在碰杠食糊这几下开口（games.js 那边的 useCardTableTalk 管）。
//   牌：万筒索各 1-9（m/p/s），东南西北（E/S/W/N），中发白（C/F/P），每样 4 张，共 136；
//   另有花牌 8 张（梅兰菊竹 f1-f4、春夏秋冬 g1-g4），摸到就亮出来、补一张。
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MahjongCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const SUITS = ["m", "p", "s"], WINDS = ["E", "S", "W", "N"], DRAGONS = ["C", "F", "P"];
  const KINDS = [].concat(
    ...SUITS.map(s => [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => s + n)), WINDS, DRAGONS);   // 34 种
  const FLOWERS = ["f1", "f2", "f3", "f4", "g1", "g2", "g3", "g4"];
  const NUM_ZH = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const SUIT_ZH = { m: "萬", p: "筒", s: "索" };
  const HONOR_ZH = { E: "東", S: "南", W: "西", N: "北", C: "中", F: "發", P: "白" };
  const FLOWER_ZH = { f1: "梅", f2: "蘭", f3: "菊", f4: "竹", g1: "春", g2: "夏", g3: "秋", g4: "冬" };
  const WIND_ZH = { E: "东", S: "南", W: "西", N: "北" };
  function name(k) {
    if (FLOWER_ZH[k]) return FLOWER_ZH[k];
    if (HONOR_ZH[k]) return HONOR_ZH[k];
    return NUM_ZH[+k[1]] + SUIT_ZH[k[0]];
  }
  const isHonor = k => WINDS.indexOf(k) >= 0 || DRAGONS.indexOf(k) >= 0;
  const isFlower = k => FLOWERS.indexOf(k) >= 0;
  const idx = k => KINDS.indexOf(k);
  const sortKey = k => idx(k);
  const sortTiles = arr => arr.slice().sort((a, b) => sortKey(a) - sortKey(b));
  function counts(tiles) { const c = new Array(34).fill(0); tiles.forEach(k => { const i = idx(k); if (i >= 0) c[i]++; }); return c; }

  // ── 胡牌：四组一对（标准）或十三幺 ────────────────────────────────
  const ORPHANS = ["m1", "m9", "p1", "p9", "s1", "s9", "E", "S", "W", "N", "C", "F", "P"].map(idx);
  function isThirteen(c) {
    let pair = false;
    for (let i = 0; i < 34; i++) {
      if (ORPHANS.indexOf(i) >= 0) { if (!c[i]) return false; if (c[i] === 2) { if (pair) return false; pair = true; } else if (c[i] > 2) return false; }
      else if (c[i]) return false;
    }
    return pair;
  }
  // 把手里的牌拆成 sets 组 + 一对，返回所有拆法（每种拆法：[{t:"pung"|"chow", i}], pair）
  function decompose(c, sets) {
    const out = [];
    for (let p = 0; p < 34; p++) {
      if (c[p] < 2) continue;
      const cc = c.slice(); cc[p] -= 2;
      walk(cc, 0, [], s => out.push({ pair: p, sets: s }));
    }
    function walk(cc, from, acc, done) {
      let i = from; while (i < 34 && !cc[i]) i++;
      if (i >= 34) { if (acc.length === sets) done(acc.slice()); return; }
      if (cc[i] >= 3) { cc[i] -= 3; acc.push({ t: "pung", i }); walk(cc, i, acc, done); acc.pop(); cc[i] += 3; }
      if (i < 27 && i % 9 <= 6 && cc[i + 1] && cc[i + 2]) { cc[i]--; cc[i + 1]--; cc[i + 2]--; acc.push({ t: "chow", i }); walk(cc, i, acc, done); acc.pop(); cc[i]++; cc[i + 1]++; cc[i + 2]++; }
    }
    return out;
  }
  function canWin(concealed, melds) {
    const c = counts(concealed);
    if (!melds.length && concealed.length === 14 && isThirteen(c)) return true;
    return decompose(c, 4 - melds.length).length > 0;
  }

  // ── 番：常见广东牌（香港规则简化）。起糊番数开局时挑 ─────────────────
  //   鸡糊 0 · 平糊 1 · 对对糊 3 · 混一色 3 · 清一色 7 · 字一色 10 · 十三幺 13（满）
  //   自摸 +1 · 门前清 +1 · 中发白刻 各 +1 · 门风、圈风刻 各 +1 · 正花 各 +1 · 无花 +1 · 杠上开花 +1 · 海底捞月 +1
  const MAX_FAN = 10;
  function fanOf(p, winTile, o) {
    o = o || {};
    const concealed = p.hand.concat(o.zimo ? [] : [winTile]);
    const melds = p.melds || [];
    const items = [];
    const c = counts(concealed);
    if (!melds.length && concealed.length === 14 && isThirteen(c)) return { fan: 13, capped: MAX_FAN, items: [["十三幺", 13]] };
    const all = concealed.concat(...melds.map(m => m.tiles));
    const suits = new Set(all.filter(k => !isHonor(k)).map(k => k[0]));
    const hasHonor = all.some(isHonor);
    let best = null;
    decompose(c, 4 - melds.length).forEach(d => {
      const its = [];
      const sets = d.sets.map(s => ({ t: s.t, k: KINDS[s.i] })).concat(melds.map(m => ({ t: m.type === "chow" ? "chow" : "pung", k: m.tiles[0] })));
      const allChow = sets.every(s => s.t === "chow"), allPung = sets.every(s => s.t === "pung");
      if (!suits.size) its.push(["字一色", 10]);
      else if (suits.size === 1 && !hasHonor) its.push(["清一色", 7]);
      else if (suits.size === 1) its.push(["混一色", 3]);
      if (allPung && suits.size) its.push(["对对糊", 3]);
      if (allChow && !isHonor(KINDS[d.pair])) its.push(["平糊", 1]);
      sets.forEach(s => {
        if (s.t !== "pung") return;
        if (DRAGONS.indexOf(s.k) >= 0) its.push([name(s.k) + "刻", 1]);
        if (s.k === o.seatWind) its.push(["门风 " + name(s.k), 1]);
        if (s.k === o.roundWind) its.push(["圈风 " + name(s.k), 1]);
      });
      const f = its.reduce((n, x) => n + x[1], 0);
      if (!best || f > best.f) best = { f, its };
    });
    if (!best) return { fan: -1, capped: -1, items: [] };
    items.push(...best.its);
    if (o.zimo) items.push(["自摸", 1]);
    if (!melds.some(m => m.type !== "ckong")) items.push(["门前清", 1]);
    const fl = p.flowers || [];
    if (!fl.length) items.push(["无花", 1]);
    fl.forEach(k => { if (+k[1] === o.seatNo) items.push(["正花 " + name(k), 1]); });
    if (o.kongDraw) items.push(["杠上开花", 1]);
    if (o.lastTile) items.push(["海底捞月", 1]);
    const fan = items.reduce((n, x) => n + x[1], 0);
    return { fan, capped: Math.min(fan, MAX_FAN), items: items.length ? items : [["鸡糊", 0]] };
  }
  const PAY = [1, 2, 4, 8, 16, 32, 48, 64, 96, 128, 192];
  const payOf = fan => PAY[Math.max(0, Math.min(MAX_FAN, fan))];

  // ── 一局 ─────────────────────────────────────────────────────
  function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function newGame(players, opts, rnd) {
    opts = opts || {};
    const st = {
      id: "mj" + Date.now().toString(36), status: "playing", hands: opts.hands || 4, handNo: 0, minFan: opts.minFan != null ? opts.minFan : 0,
      dealer: 0, roundWind: "E", log: [], players: players.slice(0, 4).map(p => Object.assign({}, p, { pts: 0, hand: [], melds: [], flowers: [], river: [] }))
    };
    startHand(st, rnd);
    return st;
  }
  function seatWindOf(st, i) { return WINDS[(i - st.dealer + 4) % 4]; }
  function startHand(st, rnd) {
    rnd = rnd || Math.random;
    st.handNo++;
    const wall = [];
    KINDS.forEach(k => { for (let n = 0; n < 4; n++) wall.push(k); });
    FLOWERS.forEach(k => wall.push(k));
    st.wall = shuffle(wall, rnd);
    st.players.forEach(p => { p.hand = []; p.melds = []; p.flowers = []; p.river = []; });
    st.result = null; st.claim = null; st.last = null; st.flags = {};
    for (let r = 0; r < 13; r++) for (let s = 0; s < 4; s++) drawInto(st, (st.dealer + s) % 4);
    st.turn = st.dealer; st.phase = "discard";
    drawInto(st, st.dealer);
    st.players.forEach(p => { p.hand = sortTiles(p.hand); });
    st.log.push({ kind: "sys", text: "第 " + st.handNo + " / " + st.hands + " 盘 · " + st.players[st.dealer].name + " 坐庄（" + WIND_ZH[st.roundWind] + "圈）" });
  }
  // 摸一张；花牌亮出来补一张。返回真正摸到的那张（墙空了返回 null）
  function drawInto(st, i) {
    const p = st.players[i];
    while (st.wall.length) {
      const k = st.wall.pop();
      if (isFlower(k)) { p.flowers.push(k); if (st.phase) st.log.push({ kind: "flower", player: p.key, text: p.name + " 补花 " + name(k) }); continue; }
      p.hand.push(k); st.drawn = k; st.drawnBy = i; return k;
    }
    return null;
  }

  // 这一家此刻能干嘛
  function selfOptions(st, i) {
    const p = st.players[i], out = [];
    if (st.phase !== "discard" || st.turn !== i) return out;
    if (canWin(p.hand, p.melds)) {
      const f = fanOf(p, null, { zimo: true, seatWind: seatWindOf(st, i), roundWind: st.roundWind, seatNo: (i - st.dealer + 4) % 4 + 1, kongDraw: st.flags.kongDraw, lastTile: !st.wall.length });
      if (f.fan >= st.minFan) out.push({ kind: "zimo", fan: f });
    }
    const c = counts(p.hand);
    c.forEach((n, j) => { if (n === 4) out.push({ kind: "ckong", k: KINDS[j] }); });
    p.melds.forEach(m => { if (m.type === "pong" && p.hand.indexOf(m.tiles[0]) >= 0) out.push({ kind: "akong", k: m.tiles[0] }); });
    return out;
  }
  function claimOptions(st, i) {
    const cl = st.claim; if (!cl || i === cl.from) return [];
    const p = st.players[i], k = cl.k, out = [];
    if (canWin(p.hand.concat([k]), p.melds)) {
      const f = fanOf(p, k, { zimo: false, seatWind: seatWindOf(st, i), roundWind: st.roundWind, seatNo: (i - st.dealer + 4) % 4 + 1, lastTile: !st.wall.length });
      if (f.fan >= st.minFan) out.push({ kind: "ron", fan: f });
    }
    const n = p.hand.filter(x => x === k).length;
    if (n >= 2 && st.wall.length) out.push({ kind: "pong" });
    if (n >= 3 && st.wall.length) out.push({ kind: "kong" });
    if ((cl.from + 1) % 4 === i && !isHonor(k) && st.wall.length) {
      const s = k[0], v = +k[1], has = x => p.hand.indexOf(x) >= 0;
      [[v - 2, v - 1], [v - 1, v + 1], [v + 1, v + 2]].forEach(pr => {
        if (pr[0] >= 1 && pr[1] <= 9 && has(s + pr[0]) && has(s + pr[1])) out.push({ kind: "chow", use: [s + pr[0], s + pr[1]] });
      });
    }
    return out;
  }
  function take(arr, k) { const j = arr.indexOf(k); if (j < 0) throw new Error("手里没有 " + name(k)); arr.splice(j, 1); }

  // 打出一张 → 进入「别家要不要」
  function discard(st, i, k) {
    if (st.phase !== "discard" || st.turn !== i) throw new Error("还没轮到");
    const p = st.players[i];
    take(p.hand, k); p.hand = sortTiles(p.hand); p.river.push(k); st.flags = {};
    st.last = { by: i, k };
    st.log.push({ kind: "discard", player: p.key, text: p.name + " 打 " + name(k) });
    const pending = {};
    for (let j = 0; j < 4; j++) { const o = claimOptions(Object.assign({}, st, { claim: { k, from: i } }), j); if (o.length) pending[j] = o; }
    st.claim = { k, from: i, pending, decided: {} };
    st.phase = "claim";
    if (!Object.keys(pending).length) passAll(st);
  }
  // 自己这一手：自摸／暗杠／加杠
  function selfAct(st, i, a) {
    const p = st.players[i];
    const ok = selfOptions(st, i).find(o => o.kind === a.kind && (!o.k || o.k === a.k));
    if (!ok) throw new Error("现在不能这样");
    if (a.kind === "zimo") return win(st, i, null, ok.fan, true);
    if (a.kind === "ckong") { for (let n = 0; n < 4; n++) take(p.hand, a.k); p.melds.push({ type: "ckong", tiles: [a.k, a.k, a.k, a.k] }); st.log.push({ kind: "kong", player: p.key, text: p.name + " 暗杠" }); }
    if (a.kind === "akong") { take(p.hand, a.k); const m = p.melds.find(x => x.type === "pong" && x.tiles[0] === a.k); m.type = "kong"; m.tiles.push(a.k); st.log.push({ kind: "kong", player: p.key, text: p.name + " 加杠 " + name(a.k) }); }
    if (!drawInto(st, i)) return exhaust(st);
    p.hand = sortTiles(p.hand); st.flags = { kongDraw: true };
  }
  // 别家打的那张：食糊／碰／杠／吃／过。全部表完态才结算：糊 > 碰杠 > 吃，同时几家糊照下家顺序
  function decide(st, i, a) {
    const cl = st.claim; if (!cl || !cl.pending[i]) throw new Error("这张跟你没关系");
    if (a.kind !== "pass" && !cl.pending[i].some(o => o.kind === a.kind && (a.kind !== "chow" || String(o.use) === String(a.use)))) throw new Error("现在不能这样");
    cl.decided[i] = a;
    if (Object.keys(cl.pending).every(j => cl.decided[j])) resolveClaim(st);
  }
  function resolveClaim(st) {
    const cl = st.claim, order = [1, 2, 3].map(d => (cl.from + d) % 4);
    const pick = kinds => order.find(j => cl.decided[j] && kinds.indexOf(cl.decided[j].kind) >= 0);
    let j = pick(["ron"]);
    if (j != null) { const o = cl.pending[j].find(x => x.kind === "ron"); return win(st, j, cl.k, o.fan, false); }
    j = pick(["pong", "kong"]);
    if (j == null) j = pick(["chow"]);
    if (j == null) return passAll(st);
    const a = cl.decided[j], p = st.players[j], k = cl.k, from = st.players[cl.from];
    from.river.pop();
    if (a.kind === "chow") { a.use.forEach(x => take(p.hand, x)); p.melds.push({ type: "chow", tiles: sortTiles(a.use.concat([k])), from: cl.from }); st.log.push({ kind: "chow", player: p.key, text: p.name + " 吃 " + name(k) }); }
    else if (a.kind === "pong") { take(p.hand, k); take(p.hand, k); p.melds.push({ type: "pong", tiles: [k, k, k], from: cl.from }); st.log.push({ kind: "pong", player: p.key, from: from.key, text: p.name + " 碰 " + from.name + " 的 " + name(k) }); }
    else { take(p.hand, k); take(p.hand, k); take(p.hand, k); p.melds.push({ type: "kong", tiles: [k, k, k, k], from: cl.from }); st.log.push({ kind: "kong", player: p.key, from: from.key, text: p.name + " 杠 " + from.name + " 的 " + name(k) }); }
    st.claim = null; st.turn = j; st.phase = "discard"; st.flags = {}; st.drawnBy = null;
    if (a.kind === "kong") { if (!drawInto(st, j)) return exhaust(st); st.flags = { kongDraw: true }; }
    p.hand = sortTiles(p.hand);
  }
  function passAll(st) {
    const nx = (st.claim.from + 1) % 4;
    st.claim = null;
    if (!drawInto(st, nx)) return exhaust(st);
    st.turn = nx; st.phase = "discard";
    st.players[nx].hand = sortTiles(st.players[nx].hand);
  }
  function win(st, i, k, fan, zimo) {
    const p = st.players[i], pay = payOf(fan.capped);
    if (k) p.hand.push(k);
    p.hand = sortTiles(p.hand);
    const moves = {};
    if (zimo) st.players.forEach((q, j) => { if (j !== i) { const x = Math.ceil(pay / 2); q.pts -= x; p.pts += x; moves[j] = -x; } });
    else { const q = st.players[st.claim.from]; q.pts -= pay; p.pts += pay; moves[st.claim.from] = -pay; }
    st.result = { winner: i, zimo, from: zimo ? null : st.claim.from, k: k || st.drawn, fan, pay, moves };
    st.log.push({ kind: "win", player: p.key, text: p.name + (zimo ? " 自摸 " : " 食糊（" + st.players[st.claim.from].name + " 出铳）") + name(k || st.drawn) + " · " + fan.fan + " 番：" + fan.items.map(x => x[0]).join("、") });
    st.claim = null; st.phase = "done";
  }
  function exhaust(st) { st.result = { winner: null }; st.claim = null; st.phase = "done"; st.log.push({ kind: "sys", text: "摸完了，流局" }); }
  // 下一盘：庄家糊了或流局就连庄，不然下家坐庄；打满了算总分
  function nextHand(st, rnd) {
    if (st.phase !== "done") return;
    const r = st.result || {};
    if (!(r.winner === st.dealer || r.winner == null)) st.dealer = (st.dealer + 1) % 4;
    if (st.handNo >= st.hands) {
      st.status = "finished";
      const best = st.players.slice().sort((a, b) => b.pts - a.pts)[0];
      st.winner = best && best.key;
      st.log.push({ kind: "sys", text: "打完了：" + st.players.map(p => p.name + " " + (p.pts > 0 ? "+" : "") + p.pts).join("，") });
      return;
    }
    startHand(st, rnd);
  }

  // ── 本地牌手 ──────────────────────────────────────────────────
  //   留牌看「这张跟手里别的牌连得上多少」：对子、搭子值钱，孤张字牌最先打。不偷看别人的牌。
  function tileWorth(c, j, st, i) {
    const n = c[j];
    if (j >= 27) {
      const k = KINDS[j];
      const lucky = DRAGONS.indexOf(k) >= 0 || (st && (k === seatWindOf(st, i) || k === st.roundWind));
      return n >= 2 ? 9 + n : (lucky ? 1.2 : 0.4);
    }
    const v = j % 9;
    let w = n * 4;
    if (v >= 1) w += c[j - 1] * 2; if (v <= 7) w += c[j + 1] * 2;
    if (v >= 2) w += c[j - 2]; if (v <= 6) w += c[j + 2];
    if (v === 0 || v === 8) w -= 0.6;
    return w;
  }
  function botDiscard(st, i, soft) {
    const p = st.players[i], c = counts(p.hand);
    const ranked = p.hand.map(k => ({ k, w: tileWorth(c, idx(k), st, i) })).sort((a, b) => a.w - b.w);
    if (soft && ranked.length > 3 && Math.random() < 0.35) return ranked[Math.floor(Math.random() * 3)].k;
    return ranked[0].k;
  }
  // 轮到自己：能自摸就摸，能杠就杠，不然打最没用的那张
  function botSelf(st, i, soft) {
    const o = selfOptions(st, i);
    const z = o.find(x => x.kind === "zimo"); if (z) return { kind: "zimo" };
    const kg = o.find(x => x.kind === "ckong" || x.kind === "akong"); if (kg && !soft) return { kind: kg.kind, k: kg.k };
    return { kind: "discard", k: botDiscard(st, i, soft) };
  }
  // 别家打的：能糊就糊（放水的人对她打出来的那张不食）；字牌值钱的、或已经开了门的才碰；吃只在已经开门、而且吃完不拆对子时吃
  function botClaim(st, i, soft, fromUser) {
    const o = (st.claim && st.claim.pending[i]) || [];
    const p = st.players[i], k = st.claim && st.claim.k;
    if (o.some(x => x.kind === "ron") && !(soft && fromUser)) return { kind: "ron" };
    if (o.some(x => x.kind === "kong")) return { kind: "kong" };
    if (o.some(x => x.kind === "pong")) {
      const valued = isHonor(k) && (DRAGONS.indexOf(k) >= 0 || k === seatWindOf(st, i) || k === st.roundWind);
      const pairs = counts(p.hand).filter(n => n >= 2).length;
      if (valued || p.melds.length || pairs >= 3) return { kind: "pong" };
    }
    const ch = o.filter(x => x.kind === "chow");
    if (ch.length && p.melds.length) {
      const c = counts(p.hand);
      const good = ch.find(x => x.use.every(t => c[idx(t)] === 1));
      if (good) return { kind: "chow", use: good.use };
    }
    return { kind: "pass" };
  }

  // 给角色看的局面（只有桌上看得见的，不给别人的手牌）
  function publicView(st, forI) {
    return st.players.map((p, i) => p.name + "（" + WIND_ZH[seatWindOf(st, i)] + "位" + (i === st.dealer ? "·庄" : "") + "）："
      + (p.melds.length ? "亮着 " + p.melds.map(m => m.tiles.map(name).join("")).join(" ") + "；" : "门前清；")
      + (p.flowers.length ? "花 " + p.flowers.map(name).join("") + "；" : "")
      + "打过 " + (p.river.slice(-8).map(name).join(" ") || "还没打") + (i === forI ? "；手里 " + p.hand.map(name).join(" ") : "") + "；总分 " + p.pts).join("\n")
      + "\n牌墙还剩 " + (st.wall || []).length + " 张";
  }

  return { KINDS, FLOWERS, name, isHonor, isFlower, sortTiles, counts, canWin, isThirteen, decompose, fanOf, payOf, MAX_FAN,
    newGame, startHand, seatWindOf, selfOptions, claimOptions, discard, selfAct, decide, nextHand,
    botSelf, botClaim, botDiscard, publicView, WIND_ZH };
});
