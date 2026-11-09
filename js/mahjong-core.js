// js/mahjong-core.js — 麻将：纯规则 + 本地牌手，不碰界面、不调模型。三种玩法共用一套摸打碰杠（她 2026-11-09）：
//   · canton 广东麻将：136 张 + 8 张花，能吃碰杠、能食糊，算番（起糊番数可挑）
//   · sichuan 四川麻将·血战到底：只有万筒条 108 张，不能吃；开局定缺一门，缺的那门打完才能糊；
//       七对也算；一炮可以多响；一家糊了离桌，剩下的接着打，三家糊了或者摸完才散
//   · hongzhong 红中麻将：万筒条 108 张 + 4 张红中，红中是癞子、能顶任何牌；不能吃，只能自摸
//   一桌四人：她和三个角色／路人。角色只在碰杠糊这几下开口（games.js 那边的 useCardTableTalk 管）。
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
  const SUIT_NAME = { m: "万", p: "筒", s: "条" };
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
  const sortTiles = arr => arr.slice().sort((a, b) => idx(a) - idx(b));
  function counts(tiles) { const c = new Array(34).fill(0); tiles.forEach(k => { const i = idx(k); if (i >= 0) c[i]++; }); return c; }

  // ── 三种玩法各自的规矩 ─────────────────────────────────────────
  const VARIANTS = {
    canton: { zh: "广东麻将", short: "广东", honors: true, flowers: true, chow: true, ron: true, seven: false, que: false, blood: false, joker: null, maxFan: 10 },
    sichuan: { zh: "四川麻将·血战到底", short: "四川", honors: false, flowers: false, chow: false, ron: true, seven: true, que: true, blood: true, joker: null, maxFan: 4 },
    hongzhong: { zh: "红中麻将", short: "红中", honors: false, flowers: false, chow: false, ron: false, seven: true, que: false, blood: false, joker: "C", maxFan: 4 },
    // 2026-11-09 她「剩下几个麻将也做了吧」
    //   台湾十六张：每人 16 张，凑五组一对；算「台」（庄家、门清、自摸、花、刻子、清一色……），底 3 加台数
    //   国标：144 张，常见三十来种番，8 番起和（花不算进起和）；点和的那家付「8+番」，另两家各付 8
    //   日本麻将（立直）：没有花；要有役才能和（立直、门清自摸、断幺、役牌……）；宝牌加番；点数制，起始 25000；振听不能荣和
    taiwan: { zh: "台湾麻将·十六张", short: "台湾", honors: true, flowers: true, chow: true, ron: true, seven: false, que: false, blood: false, joker: null, sets: 5, scoring: "tai", unit: "台" },
    guobiao: { zh: "国标麻将", short: "国标", honors: true, flowers: true, chow: true, ron: true, seven: true, que: false, blood: false, joker: null, scoring: "gb", unit: "番", minFan: 8 },
    riichi: { zh: "日本麻将·立直", short: "日麻", honors: true, flowers: false, chow: true, ron: true, seven: true, que: false, blood: false, joker: null, scoring: "jp", unit: "番", startPts: 25000 }
  };
  const SETS = st => V(st).sets || 4;
  const V = st => VARIANTS[(st && st.variant) || "canton"] || VARIANTS.canton;

  // ── 胡牌 ───────────────────────────────────────────────────────
  const ORPHANS = ["m1", "m9", "p1", "p9", "s1", "s9", "E", "S", "W", "N", "C", "F", "P"].map(idx);
  function isThirteen(c) {
    let pair = false;
    for (let i = 0; i < 34; i++) {
      if (ORPHANS.indexOf(i) >= 0) { if (!c[i]) return false; if (c[i] === 2) { if (pair) return false; pair = true; } else if (c[i] > 2) return false; }
      else if (c[i]) return false;
    }
    return pair;
  }
  // 把手里的牌拆成 sets 组 + 一对，返回所有拆法（每种拆法：[{t:"pung"|"chow", i}], pair）——没有癞子的玩法用
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
  // 带癞子的拆法：J 张癞子随便顶。pungOnly＝只许刻子（碰碰胡）
  function fitJ(c, sets, J, pungOnly) {
    const cc = c.slice();
    function walk2(j, left) {
      let i = 0; while (i < 34 && !cc[i]) i++;
      if (i >= 34) return j % 3 === 0 && j / 3 === left;
      if (!left) return false;
      const n = Math.min(cc[i], 3), need = 3 - n;
      if (need <= j) { cc[i] -= n; const ok = walk2(j - need, left - 1); cc[i] += n; if (ok) return true; }
      if (!pungOnly && i < 27 && i % 9 <= 6) {
        const a = cc[i + 1] > 0, b = cc[i + 2] > 0, miss = (a ? 0 : 1) + (b ? 0 : 1);
        if (miss <= j) {
          cc[i]--; if (a) cc[i + 1]--; if (b) cc[i + 2]--;
          const ok = walk2(j - miss, left - 1);
          cc[i]++; if (a) cc[i + 1]++; if (b) cc[i + 2]++;
          if (ok) return true;
        }
      }
      return false;
    }
    for (let p = 0; p < 34; p++) {
      const use = Math.min(cc[p], 2), needJ = 2 - use;
      if (!use || needJ > J) continue;
      cc[p] -= use; const ok = walk2(J - needJ, sets); cc[p] += use;
      if (ok) return true;
    }
    if (J >= 2) return walk2(J - 2, sets);   // 一对全是癞子
    return false;
  }
  // 七对：七个对子（癞子能补单张）；龙七对＝里头有四张一样的
  function sevenPairs(c, J) {
    let singles = 0, tiles = J;
    c.forEach(n => { tiles += n; if (n % 2) singles++; });
    return tiles === 14 && J >= singles && (J - singles) % 2 === 0;
  }
  // 手牌拆成「真牌计数 + 癞子张数」：红中玩法的红中是癞子，其余玩法没有
  function splitJ(st, tiles) {
    const v = V(st), real = v.joker ? tiles.filter(k => k !== v.joker) : tiles;
    return { c: counts(real), J: tiles.length - real.length };
  }
  function shapeOk(st, concealed, melds) {
    const v = V(st), s = splitJ(st, concealed);
    if (v.seven && !melds.length && concealed.length === 14 && SETS(st) === 4 && sevenPairs(s.c, s.J)) return true;
    if (v.joker) return fitJ(s.c, SETS(st) - melds.length, s.J, false);
    if (v.honors && SETS(st) === 4 && !melds.length && concealed.length === 14 && isThirteen(s.c)) return true;
    return decompose(s.c, SETS(st) - melds.length).length > 0;
  }
  // 四川：缺的那门一张都不能留
  function queClear(st, p, extra) {
    if (!V(st).que || !p.que) return true;
    return !p.hand.concat(extra ? [extra] : [], ...p.melds.map(m => m.tiles)).some(k => k[0] === p.que);
  }
  function canWin(concealed, melds, st) { return shapeOk(st, concealed, melds || []); }

  // ── 番 ─────────────────────────────────────────────────────────
  //   广东：鸡糊 0 · 平糊 1 · 对对糊 3 · 混一色 3 · 清一色 7 · 字一色 10 · 十三幺 13（10 番封顶）
  //         自摸、门前清、中发白刻、门风圈风刻、正花、无花、杠上开花、海底捞月 各 +1
  //   四川：平胡 0 · 对对胡 1 · 清一色 2 · 七对 2 · 龙七对 3 · 每个杠 +1 · 自摸、杠上花、海底 各 +1（4 番封顶）
  //   红中：胡了 1 · 没用红中（硬胡）+1 · 七对 +1 · 清一色 +1 · 碰碰胡 +1 · 每个杠 +1 · 杠上开花 +1（4 番封顶）
  function fanCanton(st, p, winTile, o) {
    const concealed = p.hand.concat(o.zimo ? [] : [winTile]);
    const melds = p.melds || [];
    const items = [];
    const c = counts(concealed);
    if (!melds.length && concealed.length === 14 && isThirteen(c)) return [["十三幺", 13]];
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
    if (!best) return null;
    items.push(...best.its);
    if (o.zimo) items.push(["自摸", 1]);
    if (!melds.some(m => m.type !== "ckong")) items.push(["门前清", 1]);
    const fl = p.flowers || [];
    if (!fl.length) items.push(["无花", 1]);
    fl.forEach(k => { if (+k[1] === o.seatNo) items.push(["正花 " + name(k), 1]); });
    if (o.kongDraw) items.push(["杠上开花", 1]);
    if (o.lastTile) items.push(["海底捞月", 1]);
    return items.length ? items : [["鸡糊", 0]];
  }
  function fanSuited(st, p, winTile, o) {
    const v = V(st), concealed = p.hand.concat(o.zimo ? [] : [winTile]), melds = p.melds || [];
    const s = splitJ(st, concealed);
    const all = concealed.concat(...melds.map(m => m.tiles)).filter(k => k !== v.joker);
    const items = [];
    const seven = v.seven && !melds.length && concealed.length === 14 && sevenPairs(s.c, s.J);
    const pungs = !seven && melds.every(m => m.type !== "chow") && fitJ(s.c, 4 - melds.length, s.J, true);
    const pure = new Set(all.map(k => k[0])).size === 1;
    const kongs = melds.filter(m => m.type === "kong" || m.type === "ckong").length;
    if (st.variant === "sichuan") {
      if (seven) items.push(s.c.some(n => n === 4) ? ["龙七对", 3] : ["七对", 2]);
      else if (pungs) items.push(["对对胡", 1]);
      if (pure) items.push(["清一色", 2]);
      if (kongs) items.push(["杠 ×" + kongs, kongs]);
      if (o.zimo) items.push(["自摸", 1]);
      if (o.kongDraw) items.push(["杠上花", 1]);
      if (o.lastTile) items.push(["海底", 1]);
      return items.length ? items : [["平胡", 0]];
    }
    items.push(["胡", 1]);
    if (!s.J) items.push(["硬胡（没用红中）", 1]);
    if (seven) items.push(["七对", 1]);
    else if (pungs) items.push(["碰碰胡", 1]);
    if (pure) items.push(["清一色", 1]);
    if (kongs) items.push(["杠 ×" + kongs, kongs]);
    if (o.kongDraw) items.push(["杠上开花", 1]);
    return items;
  }
  // ── 台湾、国标、日麻三种的算分（2026-11-09）─────────────────────────
  //   都先把整副牌拆成「几组 + 一对」，每种拆法各算一遍，取分最高的那种。
  const TERM = k => !isHonor(k) && (k[1] === "1" || k[1] === "9");
  const YAOJIU = k => isHonor(k) || TERM(k);
  const nextKind = k => isHonor(k) ? (WINDS.indexOf(k) >= 0 ? WINDS[(WINDS.indexOf(k) + 1) % 4] : DRAGONS[(DRAGONS.indexOf(k) + 1) % 3]) : k[0] + (k[1] === "9" ? 1 : +k[1] + 1);
  // 所有拆法：sets＝[{t:"pung"|"chow", k, open, kong}]，pair＝那一对；ron 时拿来凑成刻子的那组算明的
  function layouts(st, p, winTile, zimo) {
    const concealed = p.hand.concat(zimo ? [] : [winTile]), melds = p.melds || [];
    const c = counts(concealed), out = [];
    const mset = melds.map(m => ({ t: m.type === "chow" ? "chow" : "pung", k: m.tiles[0], open: m.type !== "ckong", kong: m.type === "kong" || m.type === "ckong" }));
    decompose(c, SETS(st) - melds.length).forEach(d => {
      let usedOpen = false;
      const sets = d.sets.map(x => {
        const k = KINDS[x.i];
        const open = !zimo && !usedOpen && x.t === "pung" && k === winTile && KINDS[d.pair] !== winTile ? (usedOpen = true) : false;
        return { t: x.t, k, open, kong: false };
      }).concat(mset);
      out.push({ sets, pair: KINDS[d.pair] });
    });
    return out;
  }
  function allTilesOf(p, winTile, zimo) { return p.hand.concat(zimo ? [] : [winTile], ...(p.melds || []).map(m => m.tiles)); }
  // 台湾：底 3 + 台数
  function fanTai(st, p, winTile, o) {
    const all = allTilesOf(p, winTile, o.zimo), closed = !(p.melds || []).some(m => m.type !== "ckong");
    const suits = new Set(all.filter(k => !isHonor(k)).map(k => k[0])), honors = all.some(isHonor);
    let best = null;
    layouts(st, p, winTile, o.zimo).forEach(L => {
      const its = [];
      const pungs = L.sets.filter(x => x.t === "pung");
      const drag = pungs.filter(x => DRAGONS.indexOf(x.k) >= 0).length, wind = pungs.filter(x => WINDS.indexOf(x.k) >= 0).length;
      if (drag === 3) its.push(["大三元", 8]); else if (drag === 2 && DRAGONS.indexOf(L.pair) >= 0) its.push(["小三元", 4]); else pungs.forEach(x => { if (DRAGONS.indexOf(x.k) >= 0) its.push([name(x.k) + "刻", 1]); });
      if (wind === 4) its.push(["大四喜", 16]); else if (wind === 3 && WINDS.indexOf(L.pair) >= 0) its.push(["小四喜", 8]);
      else pungs.forEach(x => { if (x.k === o.seatWind) its.push(["门风 " + name(x.k), 1]); if (x.k === o.roundWind) its.push(["圈风 " + name(x.k), 1]); });
      if (!suits.size) its.push(["字一色", 16]); else if (suits.size === 1 && !honors) its.push(["清一色", 8]); else if (suits.size === 1) its.push(["混一色", 4]);
      if (L.sets.every(x => x.t === "pung")) its.push(["碰碰胡", 4]);
      if (L.sets.every(x => x.t === "chow") && !isHonor(L.pair) && !(p.flowers || []).length && !o.zimo) its.push(["平胡", 2]);
      const f = its.reduce((n, x) => n + x[1], 0);
      if (!best || f > best.f) best = { f, its };
    });
    if (!best) return null;
    const items = best.its.slice();
    if (o.dealer) items.push(["庄家", 1]);
    if (closed && o.zimo) items.push(["门清自摸", 3]); else { if (closed) items.push(["门清", 1]); if (o.zimo) items.push(["自摸", 1]); }
    if (!closed && (p.melds || []).length === SETS(st) && !o.zimo) items.push(["全求人", 2]);
    (p.flowers || []).forEach(k => { if (+k[1] === o.seatNo) items.push(["正花 " + name(k), 1]); });
    if (o.kongDraw) items.push(["杠上开花", 1]);
    if (o.lastTile) items.push(["海底", 1]);
    return items.length ? items : [["平胡（0 台）", 0]];
  }
  // 国标：常见三十来种番；花牌每张 1 番但不算进 8 番起和
  function fanGB(st, p, winTile, o) {
    const concealed = p.hand.concat(o.zimo ? [] : [winTile]), melds = p.melds || [];
    const all = allTilesOf(p, winTile, o.zimo), closed = !melds.some(m => m.type !== "ckong");
    const c = counts(concealed);
    const suits = new Set(all.filter(k => !isHonor(k)).map(k => k[0])), honors = all.some(isHonor);
    const flowerItems = (p.flowers || []).map(k => ["花牌 " + name(k), 1, "flower"]);
    if (!melds.length && concealed.length === 14 && isThirteen(c)) return [["十三幺", 88]].concat(flowerItems);
    const seven = !melds.length && concealed.length === 14 && sevenPairs(c, 0);
    let best = null;
    const add = (its, nm, f) => its.push([nm, f]);
    if (seven) {
      const its = [["七对", 24]];
      if (suits.size === 1 && !honors) add(its, "清一色", 24); else if (suits.size === 1) add(its, "混一色", 6);
      if (!all.some(YAOJIU)) add(its, "断幺", 2);
      if (!honors) add(its, "无字", 1);
      best = { f: its.reduce((n, x) => n + x[1], 0), its };
    }
    layouts(st, p, winTile, o.zimo).forEach(L => {
      const its = [];
      const pungs = L.sets.filter(x => x.t === "pung"), chows = L.sets.filter(x => x.t === "chow");
      const drag = pungs.filter(x => DRAGONS.indexOf(x.k) >= 0).length, wind = pungs.filter(x => WINDS.indexOf(x.k) >= 0).length;
      const conPungs = pungs.filter(x => !x.open).length;
      let bigDrag = false, bigWind = false;
      if (drag === 3) { add(its, "大三元", 88); bigDrag = true; } else if (drag === 2 && DRAGONS.indexOf(L.pair) >= 0) { add(its, "小三元", 64); bigDrag = true; } else if (drag === 2) add(its, "双箭刻", 6);
      if (wind === 4) { add(its, "大四喜", 88); bigWind = true; } else if (wind === 3 && WINDS.indexOf(L.pair) >= 0) { add(its, "小四喜", 64); bigWind = true; }
      if (!suits.size) add(its, "字一色", 64);
      else if (suits.size === 1 && !honors) add(its, "清一色", 24); else if (suits.size === 1) add(its, "混一色", 6);
      if (conPungs === 4) add(its, "四暗刻", 64); else if (conPungs === 3) add(its, "三暗刻", 16); else if (conPungs === 2) add(its, "双暗刻", 2);
      if (all.every(YAOJIU) && suits.size) add(its, "混幺九", 32);
      else if (pungs.length === SETS(st) && suits.size) add(its, "碰碰和", 6);
      // 清龙：同一门 123 456 789
      SUITS.forEach(su => { if (["1", "4", "7"].every(n => chows.some(x => x.k === su + n))) add(its, "清龙", 16); });
      if (L.sets.every(x => (x.t === "chow" ? (x.k[1] === "1" || x.k[1] === "7") : YAOJIU(x.k))) && YAOJIU(L.pair)) add(its, "全带幺", 4);
      if (chows.length === SETS(st) && !isHonor(L.pair)) add(its, "平和", 2);
      if (!all.some(YAOJIU)) add(its, "断幺", 2);
      if (!bigDrag) pungs.forEach(x => { if (DRAGONS.indexOf(x.k) >= 0 && drag < 2) add(its, "箭刻 " + name(x.k), 2); });
      if (!bigWind) pungs.forEach(x => { if (x.k === o.roundWind) add(its, "圈风刻", 2); if (x.k === o.seatWind) add(its, "门风刻", 2); });
      pungs.forEach(x => { if (YAOJIU(x.k) && DRAGONS.indexOf(x.k) < 0 && x.k !== o.roundWind && x.k !== o.seatWind && !bigWind) add(its, "幺九刻", 1); });
      const kongs = melds.filter(m => m.type === "kong").length, ckongs = melds.filter(m => m.type === "ckong").length;
      if (ckongs) add(its, "暗杠", 2 * ckongs); if (kongs) add(its, "明杠", kongs);
      if (!honors) add(its, "无字", 1);
      const f = its.reduce((n, x) => n + x[1], 0);
      if (!best || f > best.f) best = { f, its };
    });
    if (!best) return null;
    const items = best.its.slice();
    if (closed && o.zimo) add(items, "不求人", 4); else { if (closed) add(items, "门前清", 2); if (o.zimo) add(items, "自摸", 1); }
    if (melds.length === SETS(st) && !closed && !o.zimo) add(items, "全求人", 6);
    if (o.kongDraw) add(items, "杠上开花", 8);
    if (o.lastTile) add(items, o.zimo ? "妙手回春" : "海底捞月", 8);
    return items.concat(flowerItems);
  }
  // 日麻：役（不含宝牌）够 1 番才能和；宝牌加番；役满另算
  function doraKinds(st) { return (st.doraInd || []).map(nextKind); }
  function fanJP(st, p, winTile, o) {
    const concealed = p.hand.concat(o.zimo ? [] : [winTile]), melds = p.melds || [];
    const all = allTilesOf(p, winTile, o.zimo), closed = !melds.some(m => m.type !== "ckong");
    const c = counts(concealed);
    const suits = new Set(all.filter(k => !isHonor(k)).map(k => k[0])), honors = all.some(isHonor);
    const cand = [];
    const base = [];
    if (o.riichi) base.push(["立直", 1]);
    if (closed && o.zimo) base.push(["门前清自摸和", 1]);
    if (o.lastTile) base.push([o.zimo ? "海底摸月" : "河底捞鱼", 1]);
    if (o.kongDraw) base.push(["岭上开花", 1]);
    if (!melds.length && concealed.length === 14 && isThirteen(c)) cand.push({ ym: 1, its: [["国士无双", 13]] });
    if (!melds.length && concealed.length === 14 && sevenPairs(c, 0)) {
      const its = base.slice(); its.push(["七对子", 2]);
      if (!all.some(YAOJIU)) its.push(["断幺九", 1]);
      if (suits.size === 1 && !honors) its.push(["清一色", 6]); else if (suits.size === 1) its.push(["混一色", 3]);
      if (all.every(YAOJIU)) its.push(["混老头", 2]);
      if (!suits.size) cand.push({ ym: 1, its: [["字一色", 13]] });
      cand.push({ fu: 25, its });
    }
    layouts(st, p, winTile, o.zimo).forEach(L => {
      const its = base.slice(), ym = [];
      const pungs = L.sets.filter(x => x.t === "pung"), chows = L.sets.filter(x => x.t === "chow");
      const drag = pungs.filter(x => DRAGONS.indexOf(x.k) >= 0).length, wind = pungs.filter(x => WINDS.indexOf(x.k) >= 0).length;
      const conPungs = pungs.filter(x => !x.open).length;
      if (drag === 3) ym.push(["大三元", 13]);
      if (wind === 4) ym.push(["大四喜", 13]); else if (wind === 3 && WINDS.indexOf(L.pair) >= 0) ym.push(["小四喜", 13]);
      if (!suits.size) ym.push(["字一色", 13]);
      if (conPungs === 4) ym.push(["四暗刻", 13]);
      if (ym.length) { cand.push({ ym: ym.length, its: ym }); return; }
      if (!all.some(YAOJIU)) its.push(["断幺九", 1]);
      pungs.forEach(x => { if (DRAGONS.indexOf(x.k) >= 0) its.push(["役牌 " + name(x.k), 1]); if (x.k === o.roundWind) its.push(["场风 " + name(x.k), 1]); if (x.k === o.seatWind) its.push(["自风 " + name(x.k), 1]); });
      const pairValued = DRAGONS.indexOf(L.pair) >= 0 || L.pair === o.roundWind || L.pair === o.seatWind;
      const pinfu = closed && chows.length === 4 && !pairValued;
      if (pinfu) its.push(["平和", 1]);
      if (closed && chows.some((x, j) => chows.some((y, k2) => k2 > j && y.k === x.k))) its.push(["一盃口", 1]);
      ["1", "2", "3", "4", "5", "6", "7"].forEach(n => { if (SUITS.every(su => chows.some(x => x.k === su + n))) its.push(["三色同顺", closed ? 2 : 1]); });
      SUITS.forEach(su => { if (["1", "4", "7"].every(n => chows.some(x => x.k === su + n))) its.push(["一气通贯", closed ? 2 : 1]); });
      if (pungs.length === 4) its.push(["对对和", 2]);
      if (conPungs === 3) its.push(["三暗刻", 2]);
      if (drag === 2 && DRAGONS.indexOf(L.pair) >= 0) its.push(["小三元", 2]);
      if (all.every(YAOJIU)) its.push(["混老头", 2]);
      else if (chows.length && L.sets.every(x => x.t === "chow" ? (x.k[1] === "1" || x.k[1] === "7") : YAOJIU(x.k)) && YAOJIU(L.pair)) its.push(["混全带幺九", closed ? 2 : 1]);
      if (suits.size === 1 && !honors) its.push(["清一色", closed ? 6 : 5]); else if (suits.size === 1) its.push(["混一色", closed ? 3 : 2]);
      cand.push({ fu: pinfu && o.zimo ? 20 : 30, its });
    });
    if (!cand.length) return null;
    const score = x => x.ym ? 1000 * x.ym : x.its.reduce((n, y) => n + y[1], 0);
    const best = cand.sort((a, b) => score(b) - score(a))[0];
    const yakuHan = best.ym ? 13 * best.ym : best.its.reduce((n, y) => n + y[1], 0);
    if (!yakuHan) return { items: [], gate: 0 };
    const items = best.its.slice();
    if (!best.ym) { const dk = doraKinds(st); const n = all.filter(k => dk.indexOf(k) >= 0).length; if (n) items.push(["宝牌", n]); }
    return { items, gate: yakuHan, fu: best.fu || 30, yakuman: best.ym || 0 };
  }
  // 日麻点数：基本点 → 满贯／跳满／倍满／三倍满／役满
  function jpBase(han, fu, ym) {
    if (ym) return { base: 8000 * ym, label: ym > 1 ? ym + "倍役满" : "役满" };
    if (han >= 13) return { base: 8000, label: "累计役满" };
    if (han >= 11) return { base: 6000, label: "三倍满" };
    if (han >= 8) return { base: 4000, label: "倍满" };
    if (han >= 6) return { base: 3000, label: "跳满" };
    const b = fu * Math.pow(2, han + 2);
    if (han >= 5 || b >= 2000) return { base: 2000, label: "满贯" };
    return { base: b, label: han + " 番 " + fu + " 符" };
  }
  const up100 = x => Math.ceil(x / 100) * 100;
  // 一家和了怎么付：各玩法自己的规矩；返回 {j: -付多少}
  function settle(st, i, zimo, from, fan) {
    const v = V(st), moves = {};
    const pay = (j, x) => { st.players[j].pts -= x; st.players[i].pts += x; moves[j] = -x; };
    const others = st.players.map((q, j) => j).filter(j => j !== i && !st.players[j].out);
    if (v.scoring === "tai") { const x = 3 + fan.fan; if (zimo) others.forEach(j => pay(j, x)); else pay(from, x); return moves; }
    if (v.scoring === "gb") { if (zimo) others.forEach(j => pay(j, 8 + fan.fan)); else others.forEach(j => pay(j, j === from ? 8 + fan.fan : 8)); return moves; }
    if (v.scoring === "jp") {
      const b = fan.base, dealer = i === st.dealer;
      if (!zimo) pay(from, up100(b * (dealer ? 6 : 4)));
      else others.forEach(j => pay(j, up100(b * (dealer || j === st.dealer ? 2 : 1))));
      if (st.pot) { st.players[i].pts += st.pot; moves.pot = st.pot; st.pot = 0; }
      return moves;
    }
    return null;
  }
  function fanOf(p, winTile, o, st) {
    o = o || {};
    const v = V(st);
    if (v.scoring === "jp") {
      const r = fanJP(st, p, winTile, o);
      if (!r || !r.gate) return { fan: -1, capped: -1, items: [], gate: -1 };
      const han = r.items.reduce((n, x) => n + x[1], 0), b = jpBase(han, r.fu, r.yakuman);
      return { fan: han, capped: han, items: r.items, gate: r.gate, fu: r.fu, base: b.base, label: b.label };
    }
    if (v.scoring === "tai" || v.scoring === "gb") {
      const items = v.scoring === "tai" ? fanTai(st, p, winTile, o) : fanGB(st, p, winTile, o);
      if (!items) return { fan: -1, capped: -1, items: [], gate: -1 };
      const fan = items.reduce((n, x) => n + x[1], 0);
      return { fan, capped: fan, items: items.map(x => [x[0], x[1]]), gate: items.filter(x => x[2] !== "flower").reduce((n, x) => n + x[1], 0) };
    }
    const items = st && st.variant && st.variant !== "canton" ? fanSuited(st, p, winTile, o) : fanCanton(st, p, winTile, o);
    if (!items) return { fan: -1, capped: -1, items: [] };
    const fan = items.reduce((n, x) => n + x[1], 0);
    return { fan, capped: Math.min(fan, v.maxFan), items };
  }
  const MAX_FAN = 10;
  const PAY = [1, 2, 4, 8, 16, 32, 48, 64, 96, 128, 192];
  const payOf = (fan, st) => st && st.variant && st.variant !== "canton" ? Math.pow(2, Math.max(0, Math.min(V(st).maxFan, fan))) : PAY[Math.max(0, Math.min(MAX_FAN, fan))];

  // ── 一局 ─────────────────────────────────────────────────────
  function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function newGame(players, opts, rnd) {
    opts = opts || {};
    const variant = VARIANTS[opts.variant] ? opts.variant : "canton";
    const st = {
      id: "mj" + Date.now().toString(36), status: "playing", variant, hands: opts.hands || 4, handNo: 0,
      // 起和：广东自己挑（默认鸡糊）；国标默认 8 番（可调）；日麻要有 1 番役；其余不设
      minFan: variant === "canton" ? (opts.minFan != null ? opts.minFan : 0) : variant === "guobiao" ? (opts.minFan != null ? opts.minFan : 8) : variant === "riichi" ? 1 : 0, pot: 0,
      // 她自己点牌墙摸牌（她 2026-11-09「打的时候没有大桌子给我们抽牌嘛」）：轮到她就停在 draw，等她点；别家照旧自动摸
      handDraw: !!opts.handDraw,
      // 四川换三张（她 2026-11-09「加吧」）：默认开
      swap: variant === "sichuan" && opts.swap !== false,
      dealer: 0, roundWind: "E", log: [], players: players.slice(0, 4).map(p => Object.assign({}, p, { pts: VARIANTS[variant].startPts || 0, hand: [], melds: [], flowers: [], river: [] }))
    };
    startHand(st, rnd);
    return st;
  }
  function seatWindOf(st, i) { return WINDS[(i - st.dealer + 4) % 4]; }
  const active = (st, i) => !st.players[i].out;
  function nextActive(st, i) { for (let d = 1; d <= 4; d++) { const j = (i + d) % 4; if (active(st, j)) return j; } return i; }
  function startHand(st, rnd) {
    rnd = rnd || Math.random;
    const v = V(st);
    st.handNo++;
    const wall = [];
    (v.honors ? KINDS : KINDS.slice(0, 27)).forEach(k => { for (let n = 0; n < 4; n++) wall.push(k); });
    if (v.joker) for (let n = 0; n < 4; n++) wall.push(v.joker);
    if (v.flowers) FLOWERS.forEach(k => wall.push(k));
    st.wall = shuffle(wall, rnd);
    st.players.forEach(p => { p.hand = []; p.melds = []; p.flowers = []; p.river = []; p.out = false; p.que = null; p.riichi = false; });
    // 日麻：翻一张宝牌指示牌（从牌墙另一头拿，不进人手）
    st.doraInd = v.scoring === "jp" ? [st.wall.shift()] : [];
    st.result = null; st.claim = null; st.last = null; st.flags = {}; st.wins = []; st.phase = null;
    for (let r = 0; r < SETS(st) * 3 + 1; r++) for (let s = 0; s < 4; s++) drawInto(st, (st.dealer + s) % 4);
    st.turn = st.dealer; st.phase = "discard";
    drawInto(st, st.dealer);
    st.players.forEach(p => { p.hand = sortTiles(p.hand); });
    st.log.push({ kind: "sys", text: v.zh + " · 第 " + st.handNo + " / " + st.hands + " 盘 · " + st.players[st.dealer].name + " 坐庄" + (v.honors ? "（" + WIND_ZH[st.roundWind] + "圈）" : "") });
    // 四川：先换三张（开着的话），再定缺。手机替别家挑；她自己那家等她点
    if (v.que) {
      st.swapPick = {}; st.swapGot = {};
      if (st.swap) {
        st.swapDir = ["cw", "ccw", "across"][Math.floor(rnd() * 3)];
        st.players.forEach((p, i) => { if (!p.isUser) st.swapPick[i] = autoSwap(st, i); });
        st.log.push({ kind: "sys", text: "换三张：" + SWAP_ZH[st.swapDir] });
        if (st.players.some(p => p.isUser)) { st.phase = "swap"; return; }
        doSwap(st);
      }
      startQue(st);
    }
  }
  const SWAP_ZH = { cw: "顺时针换（给下家）", ccw: "逆时针换（给上家）", across: "跟对家换" };
  function swapTarget(st, i) { return st.swapDir === "cw" ? (i + 1) % 4 : st.swapDir === "ccw" ? (i + 3) % 4 : (i + 2) % 4; }
  // 换出去的三张：张数最少、但凑得出三张的那门里最没用的三张
  function autoSwap(st, i) {
    const p = st.players[i], c = counts(p.hand);
    const by = SUITS.map(su => ({ su, tiles: p.hand.filter(k => k[0] === su) })).filter(x => x.tiles.length >= 3).sort((a, b) => a.tiles.length - b.tiles.length);
    const pick = by[0].tiles.slice().sort((a, b) => tileWorth(c, idx(a), st, i) - tileWorth(c, idx(b), st, i));
    return pick.slice(0, 3);
  }
  function setSwap(st, i, tiles) {
    if (st.phase !== "swap") throw new Error("现在不是换牌的时候");
    const p = st.players[i];
    if (!Array.isArray(tiles) || tiles.length !== 3 || new Set(tiles.map(k => k[0])).size !== 1) throw new Error("挑同一门的三张");
    const left = p.hand.slice(); tiles.forEach(k => take(left, k));
    st.swapPick[i] = tiles.slice();
    if (st.players.every((q, j) => st.swapPick[j])) { doSwap(st); startQue(st); }
  }
  function doSwap(st) {
    st.players.forEach((p, i) => st.swapPick[i].forEach(k => take(p.hand, k)));
    st.players.forEach((p, i) => { const to = swapTarget(st, i); st.players[to].hand.push(...st.swapPick[i]); st.swapGot[to] = st.swapPick[i].slice(); });
    st.players.forEach(p => { p.hand = sortTiles(p.hand); });
    st.log.push({ kind: "sys", text: "三张换好了" });
  }
  function startQue(st) {
    st.phase = "discard";
    st.players.forEach((p, i) => { if (!p.isUser) setQue(st, i, autoQue(p)); });
    if (st.players.some(p => p.isUser && !p.que)) st.phase = "que";
  }
  // 刮风下雨：四川开杠当场收钱——暗杠（下雨）还在桌上的每家付 2，加杠（刮风）每家付 1，明杠点杠的那家付 2
  function kongPay(st, i, type, from) {
    if (st.variant !== "sichuan") return;
    const p = st.players[i], payers = type === "kong" ? [from] : st.players.map((q, j) => j).filter(j => j !== i && !st.players[j].out);
    const x = type === "akong" ? 1 : 2;
    payers.forEach(j => { st.players[j].pts -= x; p.pts += x; });
    st.log.push({ kind: "sys", text: (type === "ckong" ? "下雨" : "刮风") + "：" + payers.map(j => st.players[j].name).join("、") + " 各付 " + p.name + " " + x });
  }
  // 摸完了：查花猪（手里还留着缺的那门）、查叫（没听牌的赔给听牌的）——只算还在桌上的人
  function readyBest(st, i) {
    const p = st.players[i];
    let best = -1;
    KINDS.slice(0, 27).forEach(k => {
      if (p.que && k[0] === p.que) return;
      if (shapeOk(st, p.hand.concat([k]), p.melds) && queClear(st, p, k)) {
        const f = fanOf(p, k, fanCtx(st, i, false), st);
        if (f.capped > best) best = f.capped;
      }
    });
    return best;
  }
  function settleExhaust(st) {
    if (st.variant !== "sichuan") return;
    const live = st.players.map((p, i) => i).filter(i => !st.players[i].out);
    const pig = live.filter(i => !queClear(st, st.players[i]));
    const ready = {}; live.forEach(i => { if (pig.indexOf(i) < 0) ready[i] = readyBest(st, i); });
    const top = payOf(V(st).maxFan, st);
    pig.forEach(i => live.filter(j => pig.indexOf(j) < 0).forEach(j => { st.players[i].pts -= top; st.players[j].pts += top; }));
    if (pig.length) st.log.push({ kind: "sys", text: "查花猪：" + pig.map(i => st.players[i].name).join("、") + " 手里还有缺的那门，赔每家 " + top });
    const tin = live.filter(i => ready[i] >= 0), notin = live.filter(i => pig.indexOf(i) < 0 && ready[i] < 0);
    notin.forEach(i => tin.forEach(j => { const x = payOf(ready[j], st); st.players[i].pts -= x; st.players[j].pts += x; }));
    if (tin.length && notin.length) st.log.push({ kind: "sys", text: "查叫：" + notin.map(i => st.players[i].name).join("、") + " 没听牌，赔给听牌的 " + tin.map(i => st.players[i].name).join("、") });
  }
  function autoQue(p) { const n = { m: 0, p: 0, s: 0 }; p.hand.forEach(k => { if (n[k[0]] != null) n[k[0]]++; }); return Object.keys(n).sort((a, b) => n[a] - n[b])[0]; }
  function setQue(st, i, suit) {
    const p = st.players[i];
    if (!V(st).que || SUITS.indexOf(suit) < 0) throw new Error("挑万、筒、条其中一门");
    p.que = suit;
    st.log.push({ kind: "que", player: p.key, text: p.name + " 定缺：" + SUIT_NAME[suit] });
    if (st.phase === "que" && st.players.every(q => q.que)) st.phase = "discard";
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
  function fanCtx(st, i, zimo) { return { zimo, seatWind: seatWindOf(st, i), roundWind: st.roundWind, seatNo: (i - st.dealer + 4) % 4 + 1, kongDraw: zimo && st.flags.kongDraw, lastTile: !st.wall.length, dealer: i === st.dealer, riichi: !!st.players[i].riichi }; }
  const gateOk = (st, f) => (f.gate != null ? f.gate : f.fan) >= st.minFan && f.fan >= 0;
  // 听哪几张（日麻立直、振听要用）
  function tenpaiWaits(st, hand, melds) { const c = counts(hand); return KINDS.filter((k, j) => (V(st).honors || j < 27) && c[j] < 4 && shapeOk(st, hand.concat([k]), melds || [])); }

  // 这一家此刻能干嘛
  function selfOptions(st, i) {
    const p = st.players[i], v = V(st), out = [];
    if (st.phase !== "discard" || st.turn !== i || p.out) return out;
    if (shapeOk(st, p.hand, p.melds) && queClear(st, p)) {
      const f = fanOf(p, null, fanCtx(st, i, true), st);
      if (gateOk(st, f)) out.push({ kind: "zimo", fan: f });
    }
    if (!st.wall.length) return out;
    const c = counts(p.hand);
    c.forEach((n, j) => { const k = KINDS[j]; if (n === 4 && k !== v.joker && !(v.que && k[0] === p.que)) out.push({ kind: "ckong", k }); });
    p.melds.forEach(m => { if (m.type === "pong" && p.hand.indexOf(m.tiles[0]) >= 0) out.push({ kind: "akong", k: m.tiles[0] }); });
    // 立直：门清、听牌、点数够 1000、牌墙还有 4 张以上；列出打哪几张还能听
    if (v.scoring === "jp" && !p.riichi && !p.melds.some(m => m.type !== "ckong") && p.pts >= 1000 && st.wall.length >= 4) {
      const ks = [...new Set(p.hand)].filter(k => { const h2 = p.hand.slice(); h2.splice(h2.indexOf(k), 1); return tenpaiWaits(st, h2, p.melds).length; });
      if (ks.length) out.push({ kind: "riichi", ks });
    }
    if (v.scoring === "jp" && p.riichi) return out.filter(o => o.kind !== "akong");   // 立直以后不改牌型
    return out;
  }
  // 振听：听的牌自己打过，就不能荣和
  function furiten(st, i) { const p = st.players[i]; const w = tenpaiWaits(st, p.hand, p.melds); return p.river.some(k => w.indexOf(k) >= 0); }
  function claimOptions(st, i) {
    const cl = st.claim; if (!cl || i === cl.from || st.players[i].out) return [];
    const p = st.players[i], k = cl.k, v = V(st), out = [];
    if (v.ron && shapeOk(st, p.hand.concat([k]), p.melds) && queClear(st, p, k)) {
      const f = fanOf(p, k, fanCtx(st, i, false), st);
      if (gateOk(st, f) && !(V(st).scoring === "jp" && furiten(st, i))) out.push({ kind: "ron", fan: f });
    }
    if (k === v.joker || (v.que && k[0] === p.que)) return out;   // 癞子不能碰；四川缺的那门碰了也是白碰
    const n = p.hand.filter(x => x === k).length;
    if (n >= 2 && st.wall.length) out.push({ kind: "pong" });
    if (n >= 3 && st.wall.length) out.push({ kind: "kong" });
    if (v.chow && nextActive(st, cl.from) === i && !isHonor(k) && st.wall.length) {
      const s = k[0], val = +k[1], has = x => p.hand.indexOf(x) >= 0;
      [[val - 2, val - 1], [val - 1, val + 1], [val + 1, val + 2]].forEach(pr => {
        if (pr[0] >= 1 && pr[1] <= 9 && has(s + pr[0]) && has(s + pr[1])) out.push({ kind: "chow", use: [s + pr[0], s + pr[1]] });
      });
    }
    return out;
  }
  function take(arr, k) { const j = arr.indexOf(k); if (j < 0) throw new Error("手里没有 " + name(k)); arr.splice(j, 1); }
  // 四川：手里还有缺的那门，只能先打那门
  function mustDiscardQue(st, i) { const p = st.players[i]; return V(st).que && p.que && p.hand.some(k => k[0] === p.que); }

  // 打出一张 → 进入「别家要不要」
  function discard(st, i, k) {
    if (st.phase !== "discard" || st.turn !== i) throw new Error("还没轮到");
    const p = st.players[i];
    if (mustDiscardQue(st, i) && k[0] !== p.que) throw new Error("手里还有缺的「" + SUIT_NAME[p.que] + "」，先打那门");
    if (p.riichi && !st.riichiNow && st.drawnBy === i && k !== st.drawn) throw new Error("立直以后只能打摸到的那张");
    st.riichiNow = false;
    take(p.hand, k); p.hand = sortTiles(p.hand); p.river.push(k); st.flags = {};
    st.last = { by: i, k };
    st.log.push({ kind: "discard", player: p.key, text: p.name + " 打 " + name(k) });
    const pending = {};
    for (let j = 0; j < 4; j++) { const o = claimOptions(Object.assign({}, st, { claim: { k, from: i } }), j); if (o.length) pending[j] = o; }
    st.claim = { k, from: i, pending, decided: {} };
    st.phase = "claim";
    if (!Object.keys(pending).length) passAll(st);
  }
  // 她点了牌墙：摸一张（花牌照样补），进入出牌
  function drawTile(st, i) {
    if (st.phase !== "draw" || st.turn !== i) throw new Error("还没轮到你摸");
    if (!drawInto(st, i)) return exhaust(st);
    st.phase = "discard";
  }
  // 自己这一手：自摸／暗杠／加杠
  function selfAct(st, i, a) {
    const p = st.players[i];
    const ok = selfOptions(st, i).find(o => o.kind === a.kind && (!o.k || o.k === a.k));
    if (!ok) throw new Error("现在不能这样");
    if (a.kind === "zimo") return win(st, i, null, ok.fan, true);
    if (a.kind === "riichi") {
      if (ok.ks.indexOf(a.k) < 0) throw new Error("打这张就不听了");
      p.riichi = true; p.pts -= 1000; st.pot = (st.pot || 0) + 1000; st.riichiNow = true;
      st.log.push({ kind: "riichi", player: p.key, text: p.name + " 立直！" });
      return discard(st, i, a.k);
    }
    if (a.kind === "ckong") { for (let n = 0; n < 4; n++) take(p.hand, a.k); p.melds.push({ type: "ckong", tiles: [a.k, a.k, a.k, a.k] }); st.log.push({ kind: "kong", player: p.key, text: p.name + " 暗杠" }); kongPay(st, i, "ckong"); kanDora(st); }
    if (a.kind === "akong") { take(p.hand, a.k); const m = p.melds.find(x => x.type === "pong" && x.tiles[0] === a.k); m.type = "kong"; m.tiles.push(a.k); st.log.push({ kind: "kong", player: p.key, text: p.name + " 加杠 " + name(a.k) }); kongPay(st, i, "akong"); kanDora(st); }
    if (!drawInto(st, i)) return exhaust(st);
    p.hand = sortTiles(p.hand); st.flags = { kongDraw: true };
  }
  // 别家打的那张：糊／碰／杠／吃／过。全部表完态才结算：糊 > 碰杠 > 吃；
  //   广东同时几家糊照下家顺序只算第一家；四川一炮多响，几家都糊
  function decide(st, i, a) {
    const cl = st.claim; if (!cl || !cl.pending[i]) throw new Error("这张跟你没关系");
    if (a.kind !== "pass" && !cl.pending[i].some(o => o.kind === a.kind && (a.kind !== "chow" || String(o.use) === String(a.use)))) throw new Error("现在不能这样");
    cl.decided[i] = a;
    if (Object.keys(cl.pending).every(j => cl.decided[j])) resolveClaim(st);
  }
  function resolveClaim(st) {
    const cl = st.claim, v = V(st), order = [1, 2, 3].map(d => (cl.from + d) % 4);
    const pick = kinds => order.find(j => cl.decided[j] && kinds.indexOf(cl.decided[j].kind) >= 0);
    const rons = order.filter(j => cl.decided[j] && cl.decided[j].kind === "ron");
    if (rons.length) {
      const who = v.blood ? rons : [rons[0]];
      who.forEach(j => { const o = cl.pending[j].find(x => x.kind === "ron"); win(st, j, cl.k, o.fan, false, true); });
      return afterWin(st, who[who.length - 1]);
    }
    let j = pick(["pong", "kong"]);
    if (j == null) j = pick(["chow"]);
    if (j == null) return passAll(st);
    const a = cl.decided[j], p = st.players[j], k = cl.k, from = st.players[cl.from];
    from.river.pop();
    if (a.kind === "chow") { a.use.forEach(x => take(p.hand, x)); p.melds.push({ type: "chow", tiles: sortTiles(a.use.concat([k])), from: cl.from }); st.log.push({ kind: "chow", player: p.key, text: p.name + " 吃 " + name(k) }); }
    else if (a.kind === "pong") { take(p.hand, k); take(p.hand, k); p.melds.push({ type: "pong", tiles: [k, k, k], from: cl.from }); st.log.push({ kind: "pong", player: p.key, from: from.key, text: p.name + " 碰 " + from.name + " 的 " + name(k) }); }
    else { take(p.hand, k); take(p.hand, k); take(p.hand, k); p.melds.push({ type: "kong", tiles: [k, k, k, k], from: cl.from }); st.log.push({ kind: "kong", player: p.key, from: from.key, text: p.name + " 杠 " + from.name + " 的 " + name(k) }); kongPay(st, j, "kong", cl.from); kanDora(st); }
    st.claim = null; st.turn = j; st.phase = "discard"; st.flags = {}; st.drawnBy = null;
    if (a.kind === "kong") { if (!drawInto(st, j)) return exhaust(st); st.flags = { kongDraw: true }; }
    p.hand = sortTiles(p.hand);
  }
  // 下一家摸牌（跳过已经糊了离桌的）
  function drawNext(st, nx) {
    if (!st.wall.length) return exhaust(st);
    if (st.handDraw && st.players[nx].isUser) { st.turn = nx; st.phase = "draw"; return; }
    if (!drawInto(st, nx)) return exhaust(st);
    st.turn = nx; st.phase = "discard";
    st.players[nx].hand = sortTiles(st.players[nx].hand);
  }
  function passAll(st) {
    const nx = nextActive(st, st.claim.from);
    st.claim = null;
    drawNext(st, nx);
  }
  // 一家糊了：记下来、付钱。血战到底的那家离桌（手牌亮着），别家接着打；别的玩法这一盘就散
  function win(st, i, k, fan, zimo, batch) {
    const p = st.players[i], pay = payOf(fan.capped, st), v = V(st);
    const from = zimo ? null : st.claim.from;
    if (k) p.hand.push(k);
    p.hand = sortTiles(p.hand);
    let moves = v.scoring ? settle(st, i, zimo, from, fan) : null;
    if (!moves) {
      moves = {};
      if (zimo) st.players.forEach((q, j) => { if (j !== i && !q.out) { const x = v.blood || st.variant === "hongzhong" ? pay : Math.ceil(pay / 2); q.pts -= x; p.pts += x; moves[j] = -x; } });
      else { const q = st.players[from]; q.pts -= pay; p.pts += pay; moves[from] = -pay; }
    }
    const got = Object.keys(moves).reduce((n, j) => n + (j === "pot" ? moves[j] : -moves[j]), 0);
    const w = { winner: i, zimo, from, k: k || st.drawn, fan, pay: v.scoring ? got : pay, moves };
    st.wins.push(w);
    st.log.push({ kind: "win", player: p.key, text: p.name + (zimo ? " 自摸 " : (st.variant === "canton" ? " 食糊（" : " 胡（") + (zimo ? "" : st.players[from].name + " 点炮）")) + name(k || st.drawn) + " · " + (fan.label || fan.fan + " " + (v.unit || "番")) + "：" + fan.items.map(x => x[0]).join("、") });
    if (v.blood) p.out = true;
    if (!batch) return afterWin(st, i);
  }
  function afterWin(st, last) {
    const v = V(st);
    st.claim = null;
    const left = st.players.filter(p => !p.out).length;
    if (!v.blood || left <= 1) return endHand(st);
    // 血战到底：从糊的那家的下家接着摸
    drawNext(st, nextActive(st, last));
  }
  function endHand(st) {
    const first = st.wins[0];
    st.result = first ? Object.assign({}, first, { wins: st.wins.slice() }) : { winner: null, wins: [] };
    st.claim = null; st.phase = "done";
  }
  function kanDora(st) { if (V(st).scoring === "jp" && st.wall.length > 1) { st.doraInd.push(st.wall.shift()); st.log.push({ kind: "sys", text: "杠宝牌：翻开 " + name(st.doraInd[st.doraInd.length - 1]) }); } }
  // 日麻流局：没听的一共付 3000，听牌的平分
  function notenPay(st) {
    if (V(st).scoring !== "jp") return;
    const ten = st.players.map((p, i) => i).filter(i => tenpaiWaits(st, st.players[i].hand, st.players[i].melds).length);
    const no = [0, 1, 2, 3].filter(i => ten.indexOf(i) < 0);
    if (!ten.length || !no.length) return;
    no.forEach(i => { st.players[i].pts -= 3000 / no.length; }); ten.forEach(i => { st.players[i].pts += 3000 / ten.length; });
    st.log.push({ kind: "sys", text: "流局罚符：" + no.map(i => st.players[i].name).join("、") + " 没听，付给听牌的 " + ten.map(i => st.players[i].name).join("、") });
  }
  function exhaust(st) {
    st.log.push({ kind: "sys", text: st.wins.length ? "摸完了，这一盘结束" : "摸完了，流局" });
    settleExhaust(st); notenPay(st);
    endHand(st);
  }
  // 下一盘：广东庄家糊了或流局就连庄，不然下家坐庄；四川／红中第一个糊的人下一盘坐庄。打满了算总分
  function nextHand(st, rnd) {
    if (st.phase !== "done") return;
    const r = st.result || {};
    if (st.variant === "canton") { if (!(r.winner === st.dealer || r.winner == null)) st.dealer = (st.dealer + 1) % 4; }
    else if (r.winner != null) st.dealer = r.winner;
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
    const n = c[j], v = V(st), k = KINDS[j];
    if (v.joker && k === v.joker) return 99;   // 癞子留着
    if (v.que && st.players[i].que === k[0]) return -10 - n;   // 缺的那门最先打
    if (j >= 27) {
      const lucky = DRAGONS.indexOf(k) >= 0 || (st && (k === seatWindOf(st, i) || k === st.roundWind));
      return n >= 2 ? 9 + n : (lucky ? 1.2 : 0.4);
    }
    const val = j % 9;
    let w = n * 4;
    if (val >= 1) w += c[j - 1] * 2; if (val <= 7) w += c[j + 1] * 2;
    if (val >= 2) w += c[j - 2]; if (val <= 6) w += c[j + 2];
    if (val === 0 || val === 8) w -= 0.6;
    if (v.seven && n === 2) w += 3;   // 七对的玩法，对子更值钱
    return w;
  }
  // slip：牌手水平（新手 .4／普通 .12／高手 0）——这么大的机会不打最没用那张，从最没用的三四张里随手拿一张
  function botDiscard(st, i, soft, slip) {
    const p = st.players[i], c = counts(p.hand), v = V(st);
    let pool = p.hand;
    if (mustDiscardQue(st, i)) pool = p.hand.filter(k => k[0] === p.que);
    const ranked = pool.map(k => ({ k, w: tileWorth(c, idx(k), st, i) })).sort((a, b) => a.w - b.w);
    const safe = ranked.filter(x => x.k !== v.joker);
    const list = safe.length ? safe : ranked;
    const miss = Math.max(soft ? 0.35 : 0, slip || 0);
    if (miss && list.length > 3 && Math.random() < miss) return list[Math.floor(Math.random() * Math.min(4, list.length))].k;
    return list[0].k;
  }
  // 轮到自己：能自摸就摸，能杠就杠，不然打最没用的那张
  function botSelf(st, i, soft, slip) {
    const o = selfOptions(st, i);
    const z = o.find(x => x.kind === "zimo"); if (z) return { kind: "zimo" };
    const p = st.players[i];
    if (p.riichi && st.drawnBy === i) { const ck = o.find(x => x.kind === "ckong"); if (ck && ck.k === st.drawn) return { kind: "ckong", k: ck.k }; return { kind: "discard", k: st.drawn }; }
    const rc = o.find(x => x.kind === "riichi");
    if (rc && !soft) { const c = counts(p.hand); const k = rc.ks.slice().sort((a, b) => tileWorth(c, idx(a), st, i) - tileWorth(c, idx(b), st, i))[0]; return { kind: "riichi", k }; }
    const kg = o.find(x => x.kind === "ckong" || x.kind === "akong"); if (kg && !soft) return { kind: kg.kind, k: kg.k };
    return { kind: "discard", k: botDiscard(st, i, soft, slip) };
  }
  // 别家打的：能糊就糊（放水的人对她打出来的那张不糊）；字牌值钱的、或已经开了门的才碰；吃只在已经开门、而且吃完不拆对子时吃
  function botClaim(st, i, soft, fromUser, slip) {
    const o = (st.claim && st.claim.pending[i]) || [];
    const p = st.players[i], k = st.claim && st.claim.k, v = V(st);
    if (o.some(x => x.kind === "ron") && !(soft && fromUser)) return { kind: "ron" };
    if (v.scoring === "jp") {   // 日麻：要留门清才有立直，只碰值钱的字牌（役牌），不吃不杠别人的
      const valued = isHonor(k) && (DRAGONS.indexOf(k) >= 0 || k === seatWindOf(st, i) || k === st.roundWind);
      return o.some(x => x.kind === "pong") && valued && !(slip && Math.random() < slip) ? { kind: "pong" } : { kind: "pass" };
    }
    if (o.some(x => x.kind === "kong")) return { kind: "kong" };
    if (slip && Math.random() < slip) return { kind: "pass" };   // 新手看漏：该碰该吃的没反应过来（能糊的照样糊）
    if (o.some(x => x.kind === "pong")) {
      const valued = isHonor(k) && (DRAGONS.indexOf(k) >= 0 || k === seatWindOf(st, i) || k === st.roundWind);
      const pairs = counts(p.hand).filter(n => n >= 2).length;
      if (v.seven && !p.melds.length && pairs >= 4) return { kind: "pass" };   // 在做七对，别碰
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
    const v = V(st);
    return v.zh + "\n" + st.players.map((p, i) => p.name + (v.honors ? "（" + WIND_ZH[seatWindOf(st, i)] + "位" + (i === st.dealer ? "·庄" : "") + "）" : (i === st.dealer ? "（庄）" : "")) + "："
      + (p.out ? "已经糊了离桌；" : "")
      + (p.que ? "定缺" + SUIT_NAME[p.que] + "；" : "")
      + (p.melds.length ? "亮着 " + p.melds.map(m => m.tiles.map(name).join("")).join(" ") + "；" : "门前清；")
      + (p.flowers.length ? "花 " + p.flowers.map(name).join("") + "；" : "")
      + "打过 " + (p.river.slice(-8).map(name).join(" ") || "还没打") + (i === forI ? "；手里 " + p.hand.map(name).join(" ") : "") + "；总分 " + p.pts).join("\n")
      + "\n牌墙还剩 " + (st.wall || []).length + " 张";
  }

  return { KINDS, FLOWERS, VARIANTS, SUIT_NAME, name, isHonor, isFlower, sortTiles, counts, canWin, isThirteen, decompose, fitJ, sevenPairs, fanOf, payOf, MAX_FAN,
    newGame, startHand, seatWindOf, selfOptions, claimOptions, discard, selfAct, decide, nextHand, drawTile, setQue, mustDiscardQue, setSwap, SWAP_ZH, swapTarget, tenpaiWaits, doraKinds, jpBase,
    botSelf, botClaim, botDiscard, publicView, WIND_ZH, variantOf: V };
});
