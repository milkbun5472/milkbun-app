// 联机房间第三期·第三档：藏着身份、夜里分头行动（狼人杀、阿瓦隆）（设计单第七节）
//
// 接在 netroom-games.js 那张 ADAPTERS 表上，接口一样（文件头那一段）。这一档多出来的：
//   · 身份一律走 priv：庄（开局的人那台）手里有全桌身份，每个座位只收到自己那一份——
//       狼人杀：狼队友是谁只写进狼的那几份；预言家验出来的、女巫今晚看到谁倒下、守卫守了谁，只写进那一个座位那一份。
//       阿瓦隆：梅林看到的坏人（不含莫德雷德）、派西维尔看到的两个人、坏人互相认得（不含奥伯伦），各写进各自那一份。
//     公开的 view 里只有谁还活着、白天说了什么、票怎么投的；cleanView 一样一样挑字段。终局 reveal 才亮全桌身份，回看里连夜里的事一起亮。
//   · 夜里谁睁眼不能让大家知道：公开那份 turn 是 -1（大家看到「天黑请闭眼」），轮到的那个座位自己那份 priv 里带 act，
//     框架的 secretTurn 认这个；庄那台的 turn(st) 照样给真座位（NPC、掉线托管照常跑）。
//   · 角色、NPC 想这一手用的是同一个函数（think）：只拿这个座位自己那份 priv＋公开那份 view，
//     提示词是单机那几枪（window.GameShared.wolf / .avalon）。角色用带 TA 来的那台、TA 自己的线路和人设；NPC 用庄的线路。
//   · 阿瓦隆的任务牌：公开那份只说交了几张，全交齐才亮「几张失败」，不亮是谁出的。
// 已知漏洞（设计单写过）：庄那台手机上有全部信息；帮人转发的那台技术上看得到经过它的 priv。熟人之间玩，防不了改代码的人。
(function (root) {
  "use strict";
  const NC = root.NetGameCore; if (!NC) return;
  const ADAPTERS = NC.ADAPTERS, nmOf = NC.nmOf, charWho = NC.charWho, NPC_WHO = NC.NPC_WHO;
  const GS = () => root.GameShared || null;
  const W = () => GS().wolf, AV = () => GS().avalon;
  const cut = (v, n) => String(v == null ? "" : v).slice(0, n);
  const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const clone = o => JSON.parse(JSON.stringify(o));
  const arr = (a, n) => (Array.isArray(a) ? a : []).slice(0, n);
  const seatList = (a, n) => arr(a, 12).map(x => int(x, -1, (n || 12) - 1, -1)).filter(x => x >= 0);
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; };
  const pickOne = a => a.length ? a[Math.floor(Math.random() * a.length)] : -1;
  // 模型回来的是名字：照座位名找回第几个座位（先找一模一样的，再找包含的）
  const seatByName = (inv, name, ok) => {
    const s = String(name == null ? "" : name).trim(); if (!s) return -1;
    const idx = inv.seats.map((x, i) => i).filter(i => !ok || ok(i));
    const eq = idx.find(i => nmOf(inv, i) === s); if (eq != null) return eq;
    const inc = idx.find(i => s.indexOf(nmOf(inv, i)) >= 0); return inc != null ? inc : -1;
  };
  const pub = (st, text) => st.log.push({ text: cut(text, 300) });
  // 一轮完了的那句：日志最后一行
  const lastLine = st => { const L = (st && st.log) || []; const x = L[L.length - 1]; return x ? cut(x.text, 200) : ""; };
  const secret = (st, text) => st.log.push({ text: cut(text, 300), night: true });
  const pubLog = log => arr(log, 400).filter(x => x && !x.night).slice(-40).map(x => ({ text: cut(x.text, 300) }));

  // ═════════════ 狼人杀 ═════════════
  //   板子、身份那一句、胜负都是单机那一份；夜里依次：守卫 → 每头狼各报一刀（后报的看得到先报的）→ 预言家 → 女巫。
  //   白天：昨晚倒下的人亮出来（不说怎么死的），猎人／狼王被刀可以开枪；然后依次发言、依次投票（都投完才亮票），平票不放逐。
  //   白狼王（白天自爆）联机这边不做，开局页收起来了；单机存过的配置里带着它就当普通狼。
  const WW_DAYS = 12;
  const SHOOTERS = ["hunter", "wolfking"];
  const wolfy = r => W().isWolfRole(r);
  const alives = st => st.alive.map((a, i) => a ? i : -1).filter(i => i >= 0);
  const wolfSeats = st => st.roles.map((r, i) => wolfy(r) ? i : -1).filter(i => i >= 0);
  const roleZh = r => W().roleName(r);
  function wwBoard(n, cfg) {
    const Wf = W(), nW = Wf.wolfCount(n), room = Math.max(1, n - nW - 1);
    const gods = (Array.isArray(cfg.gods) && cfg.gods.length ? cfg.gods : Wf.standardBoard(n)).filter(k => Wf.GODS.some(g => g.key === k)).slice(0, room);
    const wolfRole = cfg.wolfRole === "wolfking" ? "wolfking" : null;
    const roles = [];
    for (let k = 0; k < nW; k++) roles.push(k === 0 && wolfRole ? wolfRole : "wolf");
    gods.forEach(g => roles.push(g));
    while (roles.length < n) roles.push("villager");
    return { roles: shuffle(roles), gods, wolfRole };
  }
  // 公开的那张名单（单机 boardState / 胜负 用的形状）：只有名字、死活、怎么出局的
  const pubList = (v, inv) => inv.seats.map((s, i) => { const o = (v.out || []).find(x => x.seat === i); return { name: nmOf(inv, i), alive: !!v.alive[i], idiotRevealed: !!(v.idiotRev || [])[i], out: o ? { day: o.day, how: o.how === "vote" ? "vote" : "night" } : null }; });
  function wwKill(st) {
    const cnt = {}, order = [];
    Object.keys(st.night.votes).forEach(k => { const t = st.night.votes[k]; if (t >= 0 && st.alive[t] && !wolfy(st.roles[t])) { if (!cnt[t]) order.push(t); cnt[t] = (cnt[t] || 0) + 1; } });
    let best = -1; order.forEach(t => { if (best < 0 || cnt[t] > cnt[best]) best = t; });   // 平票照先报的那一刀
    return best;
  }
  function wwWin(st) { return W().winner(st.roles.map((r, i) => ({ role: r, alive: st.alive[i] })), st.winMode); }
  function wwDie(st, i, how) { st.alive[i] = false; st.out.push({ seat: i, day: st.day, how }); }
  function wwNight(st, inv) {
    st.phase = "night"; st.night = { guard: -1, votes: {}, check: -1, save: false, poison: -1 };
    const a = alives(st), has = r => a.filter(i => st.roles[i] === r);
    const q = [];
    has("guard").forEach(i => q.push({ stage: "guard", seat: i }));
    a.filter(i => wolfy(st.roles[i])).forEach(i => q.push({ stage: "wolf", seat: i }));
    has("seer").forEach(i => q.push({ stage: "seer", seat: i }));
    has("witch").forEach(i => { if (st.pot.heal || st.pot.poison) q.push({ stage: "witch", seat: i }); });
    st.nq = q; st.qi = 0; st.shoot = [];
    pub(st, "—— 第 " + (st.day + 1) + " 夜，天黑请闭眼 ——");
    if (!q.length) return wwDawn(st, inv);
    return st;
  }
  function wwDawn(st, inv) {
    const nt = st.night, k = wwKill(st), dead = [];
    secret(st, k >= 0 ? "狼人刀了 " + nmOf(inv, k) : "狼人空刀");
    // 守了或救了才活；同守同救互相抵消，照样倒下（单机同一条）
    if (k >= 0 && (nt.guard === k) === !!nt.save) dead.push({ i: k, how: "wolf" });
    if (nt.poison >= 0 && st.alive[nt.poison] && !dead.some(d => d.i === nt.poison)) dead.push({ i: nt.poison, how: "poison" });
    st.lastGuard = nt.guard;
    st.day += 1; st.nq = null;
    dead.forEach(d => wwDie(st, d.i, d.how));
    st.deaths = dead.length ? dead.map(d => nmOf(inv, d.i)).join("、") + " 倒下了" : "平安夜，没人倒下";
    pub(st, "天亮了，第 " + st.day + " 天：" + st.deaths + "。");
    st.shoot = dead.filter(d => d.how === "wolf" && SHOOTERS.indexOf(st.roles[d.i]) >= 0).map(d => d.i);
    st.after = "day";
    return wwNext(st, inv);
  }
  // 死了人之后：先看分没分出胜负，再看有没有人要开枪，然后接着往下走
  function wwNext(st, inv) {
    const w = wwWin(st);
    if (w) { st.phase = "done"; st.win = w; pub(st, w === "good" ? "狼全出局了，好人赢。" : "狼人赢了。"); return st; }
    if (st.shoot.length) { st.phase = "shoot"; return st; }
    if (st.after === "day") return wwDay(st, inv);
    return wwNight(st, inv);
  }
  function wwDay(st, inv) {
    if (st.day > WW_DAYS) { st.phase = "done"; st.win = "none"; pub(st, "打了 " + WW_DAYS + " 天还没分出胜负，到这儿收桌。"); return st; }
    const a = alives(st), n = st.roles.length, s0 = (st.day - 1) % n;
    st.phase = "speech"; st.queue = a.slice().sort((x, y) => ((x - s0 + n) % n) - ((y - s0 + n) % n)); st.qi = 0; st.votes = {};
    pub(st, "—— 第 " + st.day + " 天发言 ——");
    return st;
  }
  function wwTally(st, inv) {
    const cnt = {}; Object.keys(st.votes).forEach(k => { const t = st.votes[k]; if (t >= 0) cnt[t] = (cnt[t] || 0) + 1; });
    st.lastVotes = Object.keys(st.votes).map(k => ({ seat: +k, target: st.votes[k] }));
    pub(st, "亮票：" + st.lastVotes.map(x => nmOf(inv, x.seat) + "→" + (x.target >= 0 ? nmOf(inv, x.target) : "弃票")).join("，"));
    const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]), best = top[0] != null ? cnt[top[0]] : 0;
    st.after = "night"; st.shoot = [];
    if (!best || (top[1] != null && cnt[top[1]] === best)) { pub(st, "平票，今天没人被放逐。"); return wwNext(st, inv); }
    const o = +top[0];
    if (st.roles[o] === "idiot" && !st.idiotRev[o]) { st.idiotRev[o] = true; pub(st, nmOf(inv, o) + " 被投出来，翻牌：白痴，免死留场，从此不能投票。"); return wwNext(st, inv); }
    wwDie(st, o, "vote"); pub(st, nmOf(inv, o) + " 被放逐了。");
    alives(st).filter(i => st.roles[i] === "gravekeeper").forEach(g => { st.grave.push({ seat: o, isWolf: wolfy(st.roles[o]) }); secret(st, "守墓人 " + nmOf(inv, g) + " 得知 " + nmOf(inv, o) + " 是" + (wolfy(st.roles[o]) ? "狼" : "好人")); });
    if (SHOOTERS.indexOf(st.roles[o]) >= 0) st.shoot = [o];
    return wwNext(st, inv);
  }
  // 这一手合不合规：不合规的、空着的（角色那台没想出来）都换成一手随手的合规操作
  function wwLegal(st, i, mv) {
    const a = alives(st), others = a.filter(x => x !== i);
    if (st.phase === "night") {
      const cur = st.nq[st.qi];
      if (cur.stage === "guard") { const t = int(mv.target, -1, 11, -1); return { target: a.indexOf(t) >= 0 && t !== st.lastGuard ? t : pickOne(a.filter(x => x !== st.lastGuard)) }; }
      if (cur.stage === "wolf") { const ok = a.filter(x => !wolfy(st.roles[x])); const t = int(mv.target, -2, 11, -2); return { target: t === -1 ? -1 : ok.indexOf(t) >= 0 ? t : pickOne(ok) }; }
      if (cur.stage === "seer") { const done = st.seen.map(x => x.seat); const ok = others.filter(x => done.indexOf(x) < 0); const t = int(mv.target, -1, 11, -1); return { target: ok.indexOf(t) >= 0 ? t : pickOne(ok.length ? ok : others) }; }
      if (cur.stage === "witch") { const k = wwKill(st), save = !!mv.save && st.pot.heal && k >= 0; const p = int(mv.poison, -1, 11, -1); return { save, poison: !save && st.pot.poison && others.indexOf(p) >= 0 ? p : -1 }; }
    }
    if (st.phase === "speech") return { text: cut(mv.text, 300).trim() || "（过）", claim: cut(mv.claim, 80), stance: mv.stance && typeof mv.stance === "object" ? { claim: cut(mv.stance.claim, 80), reads: cut(mv.stance.reads, 160), plan: cut(mv.stance.plan, 120) } : null };
    if (st.phase === "vote") { const t = int(mv.target, -1, 11, -1); return { target: others.indexOf(t) >= 0 ? t : -1 }; }
    if (st.phase === "shoot") { const t = int(mv.target, -1, 11, -1); return { target: others.indexOf(t) >= 0 ? t : -1 }; }
    return {};
  }
  function wwPriv(st, i) {
    const r = st.roles[i], o = { role: r, mates: [], act: null };
    if (wolfy(r)) o.mates = wolfSeats(st).filter(x => x !== i);
    if (r === "seer") o.seen = st.seen.slice();
    if (r === "witch") o.pot = Object.assign({}, st.pot);
    if (r === "guard") o.lastGuard = st.lastGuard;
    if (r === "gravekeeper") o.grave = st.grave.slice();
    if (st.stances[i]) o.stance = st.stances[i];
    if (st.phase === "night" && st.nq) {
      const cur = st.nq[st.qi];
      if (wolfy(r)) o.wolfVotes = Object.keys(st.night.votes).map(k => ({ seat: +k, target: st.night.votes[k] }));
      if (cur && cur.seat === i) {
        o.act = { stage: cur.stage };
        if (cur.stage === "guard") o.act.last = st.lastGuard;
        if (cur.stage === "witch") Object.assign(o.act, { victim: wwKill(st), heal: st.pot.heal, poison: st.pot.poison });
      }
    }
    return o;
  }
  // 这个座位自己知道的那一句（喂模型用）：单机那一份，只是名单照这个座位知道的拼——狼只认得队友，别的人在 TA 眼里都是「平民」
  function wwPrivText(v, pv, i, inv) {
    const list = inv.seats.map((s, j) => ({ name: nmOf(inv, j), alive: !!v.alive[j], role: j === i ? pv.role : (pv.mates || []).indexOf(j) >= 0 ? "wolf" : "villager" }));
    const me = Object.assign({}, list[i], { idiotRevealed: !!(v.idiotRev || [])[i] });
    return W().privText(me, list, { seerKnown: (pv.seen || []).map(x => ({ name: nmOf(inv, x.seat), isWolf: x.isWolf })), pot: pv.pot || {}, graveKnown: (pv.grave || []).map(x => ({ name: nmOf(inv, x.seat), isWolf: x.isWolf })) });
  }
  const wwLogText = (v, inv) => pubLog(v.log).map(x => x.text).concat((v.speeches || []).slice(-24).map(s => "第" + s.day + "天 " + nmOf(inv, s.seat) + "发言：" + s.text)).slice(-40).join("\n");
  // 一个座位这一手（角色、NPC 都走这里）：只拿公开那份＋这个座位自己那份
  async function wwThink(v, pv, i, inv, api, who) {
    if (!api || !pv) return { pass: true };
    const Wf = W(), name = nmOf(inv, i), list = pubList(v, inv), aliveNames = list.filter(p => p.alive).map(p => p.name);
    const priv = wwPrivText(v, pv, i, inv), log = wwLogText(v, inv), me = { name, skill: "普通", persona: who.persona, priv, role: pv.role, seerKnown: (pv.seen || []).map(x => ({ name: nmOf(inv, x.seat), isWolf: x.isWolf })) };
    const act = pv.act;
    if (act) {
      const note = "【你知道的】" + priv;
      if (act.stage === "wolf") {
        const told = (pv.wolfVotes || []).map(x => "· " + nmOf(inv, x.seat) + " 报了刀 " + (x.target >= 0 ? nmOf(inv, x.target) : "空刀")).join("\n");
        const out = await Wf.night(api, { needWolf: true, wolfTeam: [me], aliveNames, nightNote: note + (told ? "\n【狼队友已经报的刀】\n" + told : ""), log });
        const t = ((out && out.wolfVotes) || [])[0];
        if (t && /空刀|不刀/.test(String(t.target || ""))) return { target: -1 };
        return { target: seatByName(inv, t && t.target, j => v.alive[j] && (pv.mates || []).indexOf(j) < 0 && j !== i) };
      }
      if (act.stage === "seer") { const out = await Wf.night(api, { needSeer: true, seer: { name, known: me.seerKnown }, aliveNames, nightNote: note, log }); return { target: seatByName(inv, out && out.seerCheck, j => v.alive[j] && j !== i) }; }
      if (act.stage === "guard") { const out = await Wf.night(api, { needGuard: true, guard: { name, last: act.last >= 0 ? nmOf(inv, act.last) : "" }, aliveNames, nightNote: note, log }); return { target: seatByName(inv, out && out.guardProtect, j => v.alive[j]) }; }
      if (act.stage === "witch") {
        const out = await Wf.witch(api, { witchName: name, victim: act.victim >= 0 ? nmOf(inv, act.victim) : "", hasHeal: act.heal, hasPoison: act.poison, aliveNames, log });
        return { save: !!(out && out.save), poison: seatByName(inv, out && out.poison, j => v.alive[j] && j !== i) };
      }
    }
    const board = Wf.boardState(list, v.day), claims = (v.claims || []).map(c => ({ day: c.day, name: nmOf(inv, c.seat), text: c.text }));
    const stances = pv.stance ? { [name]: pv.stance } : {};
    if (v.phase === "speech") {
      const prior = (v.speeches || []).filter(s => s.day === v.day).map(s => ({ name: nmOf(inv, s.seat), text: s.text }));
      const r = await Wf.speeches(api, [me], v.day, prior, v.deaths || "", inv.mode, "", stances, v.gods, board, v.wolfRole, claims, "");
      const sp = ((r && r.speeches) || [])[0], cl = ((r && r.claims) || [])[0], stc = ((r && r.stances) || [])[0];
      return { text: cut(sp && sp.text, 300), claim: cut(cl && cl.text, 80), stance: stc || null };
    }
    if (v.phase === "vote") {
      const sp = (v.speeches || []).filter(s => s.day === v.day).map(s => ({ name: nmOf(inv, s.seat), text: s.text }));
      const rows = await Wf.votes(api, [me], sp, aliveNames.filter(x => x !== name), inv.mode, "", stances, v.gods, board, v.wolfRole, claims, null);
      const t = ((rows || [])[0] || {}).target;
      return { target: /弃/.test(String(t || "")) ? -1 : seatByName(inv, t, j => v.alive[j] && j !== i) };
    }
    if (v.phase === "shoot") {
      const out = await Wf.hunter(api, { roleZh: roleZh(pv.role), isWolf: wolfy(pv.role), hunterName: name, teammates: (pv.mates || []).filter(j => v.alive[j]).map(j => nmOf(inv, j)), aliveNames: aliveNames.filter(x => x !== name), log });
      return { target: seatByName(inv, out && out.target, j => v.alive[j] && j !== i) };
    }
    return { pass: true };
  }
  const OUT_HOW = ["wolf", "poison", "vote", "shot"];
  ADAPTERS.werewolf = {
    // 天亮了（夜里结算完，进白天发言）、天黑了（白天投完）：各停一下
    roundEnd: (p, n) => p.phase !== n.phase && ((n.phase === "speech" && p.phase === "night") || (n.phase === "night" && p.phase !== "night")) ? (lastLine(n) || (n.phase === "night" ? "白天结束了" : "天亮了")) : "",
    zh: "狼人杀", needPriv: true, mustFill: true,
    seatRange: () => ({ min: 5, max: 12 }),
    note: "身份只发到各人自己的手机，狼人之间互相认得；夜里轮到谁，谁那台弹出行动，别人看到「天黑请闭眼」。发言、投票轮流来，角色用带 TA 来的那台、TA 自己的线路。没有白狼王和遗言。",
    init(inv, ctx) {
      if (!GS() || !GS().wolf) throw new Error("小游戏没装上，回去再点一次试试");
      const cfg = (ctx && ctx.cfg) || {}, n = inv.seats.length, b = wwBoard(n, cfg);
      const st = { roles: b.roles, gods: b.gods, wolfRole: b.wolfRole, winMode: cfg.winMode === "all" ? "all" : "side", alive: b.roles.map(() => true), idiotRev: b.roles.map(() => false),
        day: 0, phase: "night", nq: null, qi: 0, queue: [], votes: {}, lastVotes: [], night: null, lastGuard: -1, pot: { heal: true, poison: true }, seen: [], grave: [],
        stances: {}, speeches: [], claims: [], out: [], shoot: [], after: "day", deaths: "", win: "", log: [] };
      pub(st, "本局 " + n + " 人：" + W().wolfCount(n) + " 狼" + (b.wolfRole ? "（其中一头是狼王）" : "") + "，神职【" + b.gods.map(roleZh).join("、") + "】，其余平民；" + (st.winMode === "all" ? "屠城" : "屠边") + "。");
      inv.seats.forEach((s, i) => secret(st, nmOf(inv, i) + " 是" + roleZh(st.roles[i])));
      return wwNight(st, inv);
    },
    view(st) {
      const done = st.phase === "done";
      return { phase: st.phase, day: st.day, n: st.roles.length, gods: st.gods.slice(), wolfRole: st.wolfRole, winMode: st.winMode, alive: st.alive.slice(), idiotRev: st.idiotRev.slice(),
        out: st.out.map(o => ({ seat: o.seat, day: o.day, how: o.how === "poison" || o.how === "wolf" ? "night" : o.how })),
        queue: st.phase === "speech" || st.phase === "vote" ? st.queue.slice() : [], qi: st.phase === "speech" || st.phase === "vote" ? st.qi : 0,
        voted: st.phase === "vote" ? Object.keys(st.votes).map(Number) : [], lastVotes: st.lastVotes.slice(), shoot: st.phase === "shoot" ? st.shoot.slice(0, 1) : [],
        speeches: st.speeches.slice(-60), claims: st.claims.slice(-24), deaths: st.deaths, win: st.win,
        reveal: done ? { roles: st.roles.slice() } : null, log: pubLog(st.log) };
    },
    priv: (st, i) => wwPriv(st, i),
    // 夜里公开那份没有 nq：谁在睁眼只有那个座位自己那份 priv 知道
    turn(v) {
      if (v.phase === "night") return v.nq && v.nq[v.qi] ? v.nq[v.qi].seat : -1;
      if (v.phase === "speech" || v.phase === "vote") return v.queue[v.qi] != null ? v.queue[v.qi] : -1;
      if (v.phase === "shoot") return v.shoot[0] != null ? v.shoot[0] : -1;
      return -1;
    },
    secretTurn: pv => !!(pv && pv.act),
    apply(st, i, mv, ctx) {
      const inv = ctx.inv;
      if (st.phase === "done") return { err: "这一局已经结束了" };
      if (mv && (mv.reveal || mv.end)) { const n = clone(st); n.phase = "done"; n.win = n.win || "none"; pub(n, "开局的人收桌，亮身份。"); return { st: n }; }
      if (i !== this.turn(st)) return { err: "还没轮到这一位" };
      const n = clone(st), m = wwLegal(n, i, mv && !mv.pass ? mv : {}), nm = nmOf(inv, i);
      if (n.phase === "night") {
        const cur = n.nq[n.qi];
        if (cur.stage === "guard") { n.night.guard = m.target; secret(n, "守卫 " + nm + " 守了 " + (m.target >= 0 ? nmOf(inv, m.target) : "没人")); }
        if (cur.stage === "wolf") { n.night.votes[i] = m.target; secret(n, "狼 " + nm + " 报刀 " + (m.target >= 0 ? nmOf(inv, m.target) : "空刀")); }
        if (cur.stage === "seer") { if (m.target >= 0) { n.seen.push({ seat: m.target, isWolf: wolfy(n.roles[m.target]) }); secret(n, "预言家 " + nm + " 验了 " + nmOf(inv, m.target) + "：" + (wolfy(n.roles[m.target]) ? "狼" : "好人")); } }
        if (cur.stage === "witch") {
          if (m.save) { n.night.save = true; n.pot.heal = false; secret(n, "女巫 " + nm + " 用解药救了 " + nmOf(inv, wwKill(n))); }
          else if (m.poison >= 0) { n.night.poison = m.poison; n.pot.poison = false; secret(n, "女巫 " + nm + " 毒了 " + nmOf(inv, m.poison)); }
          else secret(n, "女巫 " + nm + " 没用药");
        }
        n.qi++;
        return { st: n.qi >= n.nq.length ? wwDawn(n, inv) : n };
      }
      if (n.phase === "speech") {
        n.speeches.push({ day: n.day, seat: i, text: m.text });
        if (m.claim) n.claims.push({ day: n.day, seat: i, text: m.claim });
        if (m.stance) n.stances[i] = m.stance;
        n.qi++;
        if (n.qi >= n.queue.length) { n.phase = "vote"; n.qi = 0; n.queue = alives(n).filter(x => !n.idiotRev[x]); n.votes = {}; pub(n, "—— 投票放逐（大家都投完才亮票）——"); }
        return { st: n };
      }
      if (n.phase === "vote") { n.votes[i] = m.target; n.qi++; return { st: n.qi < n.queue.length ? n : wwTally(n, inv) }; }
      if (n.phase === "shoot") {
        n.shoot.shift();
        if (m.target >= 0) { wwDie(n, m.target, "shot"); pub(n, nm + " 亮出" + roleZh(n.roles[i]) + "，开枪带走了 " + nmOf(inv, m.target) + "。"); if (SHOOTERS.indexOf(n.roles[m.target]) >= 0) n.shoot.push(m.target); }
        else pub(n, nm + " 没开枪。");
        return { st: wwNext(n, inv) };
      }
      return { err: "这一步没看懂" };
    },
    npcMove(st, i, inv, ctx) { return wwThink(this.view(st), wwPriv(st, i), i, inv, ctx.hostApi, NPC_WHO(nmOf(inv, i))).catch(() => ({ pass: true })); },
    charMove(view, i, inv, ctx) { if (!ctx.priv || !ctx.api) return { pass: true }; return wwThink(view, ctx.priv, i, inv, ctx.api, charWho(ctx.char, ctx.opts)).catch(() => ({ pass: true })); },
    result(st, inv) {
      if (st.phase !== "done") return null;
      const good = st.roles.map((r, i) => wolfy(r) ? -1 : i).filter(i => i >= 0), bad = wolfSeats(st);
      const text = "狼是 " + bad.map(i => nmOf(inv, i)).join("、") + "，" + (st.win === "good" ? "好人赢了" : st.win === "wolf" ? "狼人赢了" : "提前收桌") + "，打了 " + st.day + " 天。";
      return { winners: st.win === "good" ? good : st.win === "wolf" ? bad : [], text,
        replay: { rows: st.roles.map((r, i) => nmOf(inv, i) + "：" + roleZh(r) + (st.alive[i] ? "" : "（出局）")), log: st.log.map(x => (x.night ? "【夜里】" : "") + x.text) } };
    },
    cleanReplay: r => ({ rows: arr(r.rows, 12).map(x => cut(x, 120)), log: arr(r.log, 400).map(x => cut(x, 320)) }),
    cleanView(v) {
      const n = int(v.n, 5, 12, 5), rv = v.reveal, R = ["wolf", "wolfking", "villager", "seer", "witch", "hunter", "guard", "idiot", "gravekeeper"];
      return { phase: ["night", "speech", "vote", "shoot", "done"].indexOf(v.phase) >= 0 ? v.phase : "night", day: int(v.day, 0, 99, 0), n,
        gods: arr(v.gods, 6).map(x => cut(x, 12)), wolfRole: v.wolfRole === "wolfking" ? "wolfking" : null, winMode: v.winMode === "all" ? "all" : "side",
        alive: arr(v.alive, 12).map(Boolean), idiotRev: arr(v.idiotRev, 12).map(Boolean),
        out: arr(v.out, 12).map(o => ({ seat: int(o && o.seat, 0, 11, 0), day: int(o && o.day, 0, 99, 0), how: ["night", "vote", "shot"].indexOf(o && o.how) >= 0 ? o.how : "night" })),
        queue: seatList(v.queue, n), qi: int(v.qi, 0, 12, 0), voted: seatList(v.voted, n), shoot: seatList(v.shoot, n).slice(0, 1),
        lastVotes: arr(v.lastVotes, 12).map(x => ({ seat: int(x && x.seat, 0, 11, 0), target: int(x && x.target, -1, 11, -1) })),
        speeches: arr(v.speeches, 60).map(s => ({ day: int(s && s.day, 0, 99, 0), seat: int(s && s.seat, 0, 11, 0), text: cut(s && s.text, 300) })),
        claims: arr(v.claims, 24).map(s => ({ day: int(s && s.day, 0, 99, 0), seat: int(s && s.seat, 0, 11, 0), text: cut(s && s.text, 80) })),
        deaths: cut(v.deaths, 120), win: ["good", "wolf", "none", ""].indexOf(v.win) >= 0 ? v.win : "",
        reveal: rv && v.phase === "done" ? { roles: arr(rv.roles, 12).map(r => R.indexOf(r) >= 0 ? r : "villager") } : null, log: pubLog(v.log) };
    },
    stateText(v, i, inv, pv) {
      const now = v.phase === "done" ? "这一局结束了：" + (v.win === "good" ? "好人赢" : v.win === "wolf" ? "狼人赢" : "提前收桌") + "。" + (v.reveal ? "身份：" + v.reveal.roles.map((r, j) => nmOf(inv, j) + "=" + roleZh(r)).join("、") : "")
        : v.phase === "night" ? "现在是夜里，天黑请闭眼。" : v.phase === "speech" ? "第 " + v.day + " 天发言，轮到 " + nmOf(inv, v.queue[v.qi]) + "。" : v.phase === "vote" ? "第 " + v.day + " 天投票中。" : nmOf(inv, v.shoot[0]) + " 在决定开不开枪。";
      return "还在场的：" + v.alive.map((a, j) => a ? nmOf(inv, j) : null).filter(Boolean).join("、") + "。\n今天的发言：\n" + (v.speeches || []).filter(s => s.day === v.day).slice(-12).map(s => "· " + nmOf(inv, s.seat) + "：" + s.text).join("\n") + "\n" + now
        + (pv && pv.role && v.phase !== "done" ? "\n你自己知道的（别说漏，也别替别人说出身份）：" + wwPrivText(v, pv, i, inv) : "");
    }
  };
  NC.CHAR_OPTS.werewolf = ["recent"];

  // ═════════════ 阿瓦隆 ═════════════
  //   队长组队 → 全桌依次投赞成／反对（都投完才亮）→ 通过就让队员依次交任务牌（好人只能交成功），交齐了只亮「几张失败」；
  //   连续 5 次组队被否坏人赢；3 次任务成功进刺杀（刺客点一个人，点中梅林坏人翻盘）；3 次失败坏人赢。湖中仙女联机这边不做。
  const AV_EVILS = ["assassin", "morgana", "mordred", "oberon", "minion"], AV_GOODS = ["merlin", "percival", "loyal"];
  const avEvil = r => AV_EVILS.indexOf(r) >= 0;
  const score = st => ({ good: st.results.filter(r => r.ok).length, evil: st.results.filter(r => !r.ok).length });
  function avTeamPhase(st, inv) {
    st.phase = "team"; st.team = []; st.votes = {}; st.plays = {}; st.queue = []; st.qi = 0; st.reason = "";
    pub(st, "—— 第 " + (st.qn + 1) + " 个任务：队长 " + nmOf(inv, st.leader) + " 选 " + AV().QUEST[st.n][st.qn] + " 人" + (AV().failsReq(st.n, st.qn) === 2 ? "（要 2 张失败才算失败）" : "") + "，第 " + (st.track + 1) + " 次组队 ——");
    return st;
  }
  // 每个座位看得到谁（座位号）：梅林看坏人（莫德雷德除外）、派西维尔看梅林和莫甘娜（分不清）、坏人互认（奥伯伦除外）
  function avSees(st, i) {
    const r = st.roles[i], all = st.roles.map((x, j) => j).filter(j => j !== i);
    if (r === "merlin") return all.filter(j => avEvil(st.roles[j]) && st.roles[j] !== "mordred");
    if (r === "percival") return all.filter(j => st.roles[j] === "merlin" || st.roles[j] === "morgana");
    if (avEvil(r) && r !== "oberon") return all.filter(j => avEvil(st.roles[j]) && st.roles[j] !== "oberon");
    return [];
  }
  // 这个座位自己知道的那一句：单机那一份（avSecretFor），名单照 TA 知道的拼——看到的人填个能让那一句写对的身份，别的人一律当忠臣
  function avSecret(pv, i, inv) {
    const seen = pv.sees || [];
    const list = inv.seats.map((s, j) => {
      let role = "loyal";
      if (j === i) role = pv.role;
      else if (seen.indexOf(j) >= 0) role = pv.role === "percival" ? (seen.indexOf(j) === 0 ? "merlin" : "morgana") : "minion";
      return { name: nmOf(inv, j), role, side: avEvil(role) ? "evil" : "good" };
    });
    return { list, text: AV().secretFor(list[i], list) };
  }
  const avHist = (v, inv) => (v.results || []).map((r, k) => "第" + (k + 1) + "个任务 队伍[" + r.team.map(j => nmOf(inv, j)).join("、") + "] " + (r.ok ? "成功" : "失败（" + r.fails + " 张失败）")).concat(pubLog(v.log).slice(-14).map(x => x.text)).join("\n");
  async function avThink(v, pv, i, inv, api, who) {
    if (!api || !pv) return { pass: true };
    const A = AV(), name = nmOf(inv, i), sc = avSecret(pv, i, inv), hist = avHist(v, inv);
    const me = { name, skill: "普通", persona: who.persona, secret: sc.text, role: pv.role, side: avEvil(pv.role) ? "evil" : "good" };
    const names = inv.seats.map((s, j) => nmOf(inv, j));
    if (v.phase === "team") {
      const need = A.QUEST[v.n][v.qn], out = await A.propose(api, me, sc.list, need, v.qn, A.failsReq(v.n, v.qn), hist, names);
      const team = []; ((out && out.team) || []).forEach(x => { const j = seatByName(inv, x); if (j >= 0 && team.indexOf(j) < 0) team.push(j); });
      return { team, reason: cut(out && out.reason, 120) };
    }
    if (v.phase === "vote") {
      const rows = await A.votes(api, [me], v.team.map(j => nmOf(inv, j)), nmOf(inv, v.leader), sc.list, v.qn, hist, null);
      const r = (rows || [])[0] || {};
      return { vote: /反/.test(String(r.vote || "")) ? "no" : "yes", reason: cut(r.reason, 80) };
    }
    if (v.phase === "quest") {
      if (me.side !== "evil") return { play: "success" };
      const rows = await A.quest(api, [me], sc.list, v.qn, A.failsReq(v.n, v.qn), { good: v.results.filter(r => r.ok).length, evil: v.results.filter(r => !r.ok).length });
      return { play: /失/.test(String(((rows || [])[0] || {}).play || "")) ? "fail" : "success" };
    }
    if (v.phase === "assassin") {
      const out = await A.assassin(api, me, sc.list, hist);
      return { target: seatByName(inv, out && out.target, j => j !== i && (pv.sees || []).indexOf(j) < 0) };
    }
    return { pass: true };
  }
  function avLegal(st, i, mv) {
    const all = st.roles.map((r, j) => j);
    if (st.phase === "team") {
      const need = AV().QUEST[st.n][st.qn], team = [];
      seatList(mv.team, st.n).forEach(j => { if (team.length < need && team.indexOf(j) < 0) team.push(j); });
      if (team.length < need && team.indexOf(i) < 0) team.push(i);
      shuffle(all).forEach(j => { if (team.length < need && team.indexOf(j) < 0) team.push(j); });
      return { team: team.sort((a, b) => a - b), reason: cut(mv.reason, 120).trim() };
    }
    if (st.phase === "vote") return { vote: mv.vote === "no" ? "no" : mv.vote === "yes" ? "yes" : Math.random() < .6 ? "yes" : "no", reason: cut(mv.reason, 80).trim() };
    if (st.phase === "quest") return { play: avEvil(st.roles[i]) && mv.play === "fail" ? "fail" : "success" };
    if (st.phase === "assassin") { const ok = all.filter(j => !avEvil(st.roles[j])); const t = int(mv.target, -1, st.n - 1, -1); return { target: ok.indexOf(t) >= 0 ? t : pickOne(ok) }; }
    return {};
  }
  ADAPTERS.avalon = {
    // 一个任务做完：停一下
    roundEnd: (p, n) => (n.results || []).length > (p.results || []).length ? (lastLine(n) || "这个任务做完了") : "",
    zh: "阿瓦隆", needPriv: true, mustFill: true,
    seatRange: () => ({ min: 5, max: 10 }),
    note: "身份只发到各人自己的手机，谁认得谁照规则只写进那几台。组队投票公开，任务牌只亮几张失败、不亮是谁出的。角色用带 TA 来的那台、TA 自己的线路。没有湖中仙女。",
    init(inv, ctx) {
      if (!GS() || !GS().avalon) throw new Error("小游戏没装上，回去再点一次试试");
      const cfg = (ctx && ctx.cfg) || {}, n = inv.seats.length, av = cfg.av || {};
      const roles = AV().board(n, { percival: !!av.percival, mordred: !!av.mordred, oberon: !!av.oberon });
      const st = { n, roles, qn: 0, leader: Math.floor(Math.random() * n), track: 0, results: [], phase: "team", team: [], votes: {}, lastVotes: [], plays: {}, queue: [], qi: 0, reason: "", win: "", killed: -1, log: [] };
      pub(st, "本局 " + n + " 人：好人 " + roles.filter(r => !avEvil(r)).length + "、坏人 " + roles.filter(avEvil).length + "。身份牌：" + Array.from(new Set(roles)).map(r => AV().ROLE_ZH[r]).join("、") + "。");
      inv.seats.forEach((s, i) => secret(st, nmOf(inv, i) + " 是" + AV().ROLE_ZH[roles[i]]));
      return avTeamPhase(st, inv);
    },
    view(st) {
      const done = st.phase === "done";
      return { phase: st.phase, n: st.n, qn: st.qn, leader: st.leader, track: st.track, team: st.team.slice(), reason: st.reason,
        results: st.results.map(r => ({ team: r.team.slice(), fails: r.fails, ok: r.ok })), voted: st.phase === "vote" ? Object.keys(st.votes).map(Number) : [], lastVotes: st.lastVotes.slice(),
        played: st.phase === "quest" ? Object.keys(st.plays).length : 0, queue: st.queue.slice(), qi: st.qi, win: st.win, killed: st.killed,
        assassin: st.phase === "assassin" || done ? st.roles.indexOf("assassin") : -1, reveal: done ? { roles: st.roles.slice() } : null, log: pubLog(st.log) };
    },
    priv: (st, i) => ({ role: st.roles[i], sees: avSees(st, i) }),
    turn(v) {
      if (v.phase === "team") return v.leader;
      if (v.phase === "vote" || v.phase === "quest") return v.queue[v.qi] != null ? v.queue[v.qi] : -1;
      if (v.phase === "assassin") return v.roles ? v.roles.indexOf("assassin") : v.assassin;
      return -1;
    },
    apply(st, i, mv, ctx) {
      const inv = ctx.inv;
      if (st.phase === "done") return { err: "这一局已经结束了" };
      if (mv && (mv.reveal || mv.end)) { const n = clone(st); n.phase = "done"; n.win = n.win || "none"; pub(n, "开局的人收桌，亮身份。"); return { st: n }; }
      if (i !== this.turn(st)) return { err: "还没轮到这一位" };
      const n = clone(st), m = avLegal(n, i, mv && !mv.pass ? mv : {}), nm = nmOf(inv, i);
      if (n.phase === "team") {
        n.team = m.team; n.reason = m.reason; n.phase = "vote"; n.votes = {}; n.queue = n.roles.map((r, j) => (n.leader + j) % n.n); n.qi = 0;
        pub(n, nm + " 提议队伍：" + n.team.map(j => nmOf(inv, j)).join("、") + (m.reason ? "——" + m.reason : "") + "。大家投票（都投完才亮）。");
        return { st: n };
      }
      if (n.phase === "vote") {
        n.votes[i] = m.vote; if (m.reason) n.votes["r" + i] = m.reason;
        n.qi++;
        if (n.qi < n.queue.length) return { st: n };
        const seats = n.queue.slice(), yes = seats.filter(j => n.votes[j] === "yes").length;
        n.lastVotes = seats.map(j => ({ seat: j, vote: n.votes[j], reason: n.votes["r" + j] || "" }));
        pub(n, "亮票：" + n.lastVotes.map(x => nmOf(inv, x.seat) + (x.vote === "yes" ? " 赞成" : " 反对")).join("，") + "（" + yes + " : " + (seats.length - yes) + "）");
        if (yes * 2 > seats.length) { n.phase = "quest"; n.queue = n.team.slice(); n.qi = 0; n.plays = {}; pub(n, "队伍通过，队员去做任务（任务牌只亮几张失败）。"); return { st: n }; }
        n.track++;
        if (n.track >= 5) { n.phase = "done"; n.win = "evil"; pub(n, "连续 5 次组队被否，坏人赢。"); return { st: n }; }
        n.leader = (n.leader + 1) % n.n; pub(n, "队伍被否。"); return { st: avTeamPhase(n, inv) };
      }
      if (n.phase === "quest") {
        n.plays[i] = m.play; n.qi++;
        if (n.qi < n.queue.length) return { st: n };
        const fails = Object.keys(n.plays).filter(k => n.plays[k] === "fail").length, ok = fails < AV().failsReq(n.n, n.qn);
        secret(n, "第 " + (n.qn + 1) + " 个任务出失败的：" + (Object.keys(n.plays).filter(k => n.plays[k] === "fail").map(k => nmOf(inv, +k)).join("、") || "没人"));
        n.results.push({ team: n.team.slice(), fails, ok }); n.plays = {}; n.track = 0;
        pub(n, "第 " + (n.qn + 1) + " 个任务" + (ok ? "成功" : "失败") + "：" + fails + " 张失败。");
        const s = score(n);
        if (s.evil >= 3) { n.phase = "done"; n.win = "evil"; pub(n, "三个任务失败，坏人赢。"); return { st: n }; }
        if (s.good >= 3) { n.phase = "assassin"; n.queue = []; n.qi = 0; pub(n, "三个任务成功。刺客 " + nmOf(inv, n.roles.indexOf("assassin")) + " 亮身份，指认一个人是梅林——点中坏人翻盘。"); return { st: n }; }
        n.qn++; n.leader = (n.leader + 1) % n.n; return { st: avTeamPhase(n, inv) };
      }
      if (n.phase === "assassin") {
        n.killed = m.target; n.phase = "done"; const hit = n.roles[m.target] === "merlin"; n.win = hit ? "evil" : "good";
        pub(n, nm + " 刺向 " + nmOf(inv, m.target) + "——" + (hit ? "正是梅林，坏人翻盘。" : "不是梅林，好人赢。"));
        return { st: n };
      }
      return { err: "这一步没看懂" };
    },
    npcMove(st, i, inv, ctx) { return avThink(this.view(st), { role: st.roles[i], sees: avSees(st, i) }, i, inv, ctx.hostApi, NPC_WHO(nmOf(inv, i))).catch(() => ({ pass: true })); },
    charMove(view, i, inv, ctx) { if (!ctx.priv || !ctx.api) return { pass: true }; return avThink(view, ctx.priv, i, inv, ctx.api, charWho(ctx.char, ctx.opts)).catch(() => ({ pass: true })); },
    result(st, inv) {
      if (st.phase !== "done") return null;
      const good = st.roles.map((r, i) => avEvil(r) ? -1 : i).filter(i => i >= 0), bad = st.roles.map((r, i) => avEvil(r) ? i : -1).filter(i => i >= 0), s = score(st);
      const text = "坏人是 " + bad.map(i => nmOf(inv, i)).join("、") + "，梅林是 " + nmOf(inv, st.roles.indexOf("merlin")) + "；任务 " + s.good + " 成 " + s.evil + " 败，" + (st.win === "good" ? "好人赢了" : st.win === "evil" ? "坏人赢了" : "提前收桌") + "。";
      return { winners: st.win === "good" ? good : st.win === "evil" ? bad : [], text,
        replay: { rows: st.roles.map((r, i) => nmOf(inv, i) + "：" + AV().ROLE_ZH[r]), log: st.log.map(x => (x.night ? "【暗里】" : "") + x.text) } };
    },
    cleanReplay: r => ({ rows: arr(r.rows, 12).map(x => cut(x, 120)), log: arr(r.log, 400).map(x => cut(x, 320)) }),
    cleanView(v) {
      const n = int(v.n, 5, 10, 5), rv = v.reveal, R = AV_EVILS.concat(AV_GOODS);
      return { phase: ["team", "vote", "quest", "assassin", "done"].indexOf(v.phase) >= 0 ? v.phase : "team", n, qn: int(v.qn, 0, 4, 0), leader: int(v.leader, 0, n - 1, 0), track: int(v.track, 0, 5, 0),
        team: seatList(v.team, n), reason: cut(v.reason, 120),
        results: arr(v.results, 5).map(r => ({ team: seatList(r && r.team, n), fails: int(r && r.fails, 0, 5, 0), ok: !!(r && r.ok) })), voted: seatList(v.voted, n),
        lastVotes: arr(v.lastVotes, 10).map(x => ({ seat: int(x && x.seat, 0, n - 1, 0), vote: x && x.vote === "no" ? "no" : "yes", reason: cut(x && x.reason, 80) })),
        played: int(v.played, 0, 5, 0), queue: seatList(v.queue, n), qi: int(v.qi, 0, 10, 0), win: ["good", "evil", "none", ""].indexOf(v.win) >= 0 ? v.win : "", killed: int(v.killed, -1, n - 1, -1),
        assassin: int(v.assassin, -1, n - 1, -1), reveal: rv && v.phase === "done" ? { roles: arr(rv.roles, 10).map(r => R.indexOf(r) >= 0 ? r : "loyal") } : null, log: pubLog(v.log) };
    },
    stateText(v, i, inv, pv) {
      const Z = AV().ROLE_ZH, s = { good: v.results.filter(r => r.ok).length, evil: v.results.filter(r => !r.ok).length };
      const now = v.phase === "done" ? "这一局结束了：" + (v.win === "good" ? "好人赢" : v.win === "evil" ? "坏人赢" : "提前收桌") + "。" + (v.reveal ? "身份：" + v.reveal.roles.map((r, j) => nmOf(inv, j) + "=" + Z[r]).join("、") : "")
        : v.phase === "team" ? "队长 " + nmOf(inv, v.leader) + " 在选人。" : v.phase === "vote" ? "大家在给队伍 [" + v.team.map(j => nmOf(inv, j)).join("、") + "] 投票。" : v.phase === "quest" ? "队员在做任务。" : "刺客在挑梅林。";
      return "第 " + (v.qn + 1) + " 个任务，任务 " + s.good + " 成 " + s.evil + " 败，这一轮已否决 " + v.track + " 次。\n" + avHist(v, inv) + "\n" + now
        + (pv && pv.role && v.phase !== "done" ? "\n你自己知道的（别说漏）：" + avSecret(pv, i, inv).text : "");
    }
  };
  NC.CHAR_OPTS.avalon = ["recent"];
  ADAPTERS.werewolf.roundLabel = v => v.day ? "第 " + v.day + " 天" : "第一夜";
  ADAPTERS.avalon.roundLabel = v => "第 " + ((v.qn | 0) + 1) + " 个任务";

  // ───────────── 界面 ─────────────
  if (typeof React === "undefined" || !root.NetGameUI) return;
  const h = React.createElement, { useState, useEffect } = React;
  const K = root.NetGameUI.kit, pill = K.pill, note = K.note, box = K.box, fs = K.fs;
  const actorOf = NC.actorOf;
  const small = (t, on) => Object.assign(pill(t, on), { minHeight: 34, padding: "0 12px", fontSize: fs(12.5) });
  const sub = (t, s) => h("div", { style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, lineHeight: 1.55, textAlign: "center" } }, s);
  const wrap = (game, kids) => h("div", { "data-wk": "nrgametable", "data-game": game, style: { padding: "6px 14px 12px", display: "flex", flexDirection: "column", gap: 10 } }, kids);
  const Log = ({ t, log, n }) => h("div", { "data-wk": "nrsoclog", style: { fontFamily: F_BODY, fontSize: fs(12), color: t.sub, lineHeight: 1.6 } }, (log || []).slice(-(n || 8)).map((x, i) => h("div", { key: i }, x.text)));
  const mySeatOf = (inv, me) => inv.seats.findIndex(s => s.kind === "user" && s.peer === me);
  const waitLine = (inv, ti, verb) => { const s = inv.seats[ti]; return ti < 0 ? "" : s && s.away ? nmOf(inv, ti) + " 掉线了，NPC 先替着…" : nmOf(inv, ti) + " " + (verb || "在想…"); };
  // 我的身份那张小卡
  const RoleCard = ({ t, title, lines }) => h("div", { "data-wk": "nrsocrole", style: { border: "1px solid " + t.line, borderRadius: 12, background: t.bg2, padding: "8px 12px", textAlign: "center" } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(17), color: t.ink } }, title), lines.filter(Boolean).map((x, i) => h("div", { key: i, style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, lineHeight: 1.55, marginTop: 2 } }, x)));
  // 一排座位：谁出局了划掉，轮到谁描深，tag 是每个人旁边那几个字
  //   座位圈是单机牌桌那一份 CardSeats（头像、轮到谁亮圈、出局的淡掉）；头像走 NetGameUI 的 faceChar（不带人设）
  const SeatRow = ({ t, inv, alive, on, tag }) => h("div", { "data-wk": "nrsocseats" }, h(root.GameShared.cards.Seats, { t, log: [], seats: inv.seats.map((s, i) => ({ key: "s" + i, name: (i + 1) + " " + (s.name || "?"),
    char: K.faceChar ? K.faceChar(s) : { name: s.name || "?" }, isUser: s.kind === "user", on: i === on, out: !!alive && !alive[i], sub: tag ? String(tag(i) || "").trim() : "" })) }));
  // 点一个人：一排人名钮（opts 是能点的座位）＋可选的「不选」
  const Picks = ({ t, inv, opts, onPick, none, sel }) => h("div", { "data-wk": "nrsocact", className: "flex flex-wrap justify-center", style: { gap: 6 } },
    opts.map(i => h("button", { key: i, onClick: () => onPick(i), style: small(t, sel ? sel.indexOf(i) >= 0 : false) }, inv.seats[i].name)).concat(none ? [h("button", { key: "x", onClick: () => onPick(-1), style: small(t, false) }, none)] : []));

  function WolfTable({ inv, view, priv, me, onMove, onReveal, isHost }) {
    const t = useTheme(), A = ADAPTERS.werewolf, mine = mySeatOf(inv, me), ti = A.turn(view);
    const myTurn = ti >= 0 && actorOf(inv.seats[ti], me, inv.host) === "mine-user";
    const act = priv && priv.act && mine >= 0 && !(inv.seats[mine] || {}).away && !(inv.seats[mine] || {}).held ? priv.act : null;
    const [d, setD] = useState(""), [save, setSave] = useState(null); useEffect(() => { setD(""); setSave(null); }, [view.log.length, view.phase, view.qi]);
    const alive = view.alive.map((a, i) => a ? i : -1).filter(i => i >= 0), others = alive.filter(i => i !== mine);
    const role = priv && priv.role, mates = (priv && priv.mates) || [];
    const lines = !priv ? [] : [mates.length ? "狼队友：" + mates.map(i => nmOf(inv, i) + (view.alive[i] ? "" : "（出局）")).join("、") : wolfy(role) ? "只有你一头狼" : "",
      (priv.seen || []).length ? "你验过：" + priv.seen.map(x => nmOf(inv, x.seat) + (x.isWolf ? " 是狼" : " 是好人")).join("，") : "",
      priv.pot ? "解药" + (priv.pot.heal ? "还在" : "用掉了") + "，毒药" + (priv.pot.poison ? "还在" : "用掉了") : "",
      role === "guard" && priv.lastGuard >= 0 ? "上一晚守的是 " + nmOf(inv, priv.lastGuard) : "",
      (priv.grave || []).length ? "被放逐的人：" + priv.grave.map(x => nmOf(inv, x.seat) + (x.isWolf ? " 是狼" : " 是好人")).join("，") : ""];
    const R = view.reveal && view.reveal.roles;
    const tag = i => R ? "（" + roleZh(R[i]) + "）" : view.idiotRev[i] ? "（白痴）" : view.phase === "vote" && view.voted.indexOf(i) >= 0 ? " ✓" : mates.indexOf(i) >= 0 ? " 🐺" : "";
    let panel;
    if (view.phase === "done") panel = note(t, view.win === "good" ? "好人赢了" : view.win === "wolf" ? "狼人赢了" : "提前收桌");
    else if (view.phase === "night") {
      if (!act) panel = h("div", { "data-wk": "nrsocnight", style: { textAlign: "center", padding: "18px 0", fontFamily: F_DISPLAY, fontSize: fs(16), color: t.ink } }, "天黑请闭眼…");
      else if (act.stage === "wolf") {
        const told = (priv.wolfVotes || []).map(x => nmOf(inv, x.seat) + " 想刀 " + (x.target >= 0 ? nmOf(inv, x.target) : "空刀")).join("，");
        panel = h("div", { "data-wk": "nrsocnight", style: { display: "flex", flexDirection: "column", gap: 8 } }, note(t, "狼人请睁眼：今晚刀谁？" + (told ? "（" + told + "）" : "")), h(Picks, { t, inv, opts: alive.filter(i => mates.indexOf(i) < 0 && i !== mine), onPick: i => onMove(mine, { target: i }), none: "空刀" }));
      } else if (act.stage === "seer") {
        const done = (priv.seen || []).map(x => x.seat);
        panel = h("div", { "data-wk": "nrsocnight", style: { display: "flex", flexDirection: "column", gap: 8 } }, note(t, "预言家请睁眼：验一个人"), h(Picks, { t, inv, opts: others.filter(i => done.indexOf(i) < 0), onPick: i => onMove(mine, { target: i }) }));
      } else if (act.stage === "guard") {
        panel = h("div", { "data-wk": "nrsocnight", style: { display: "flex", flexDirection: "column", gap: 8 } }, note(t, "守卫请睁眼：守一个人（可以守自己，不能连着两晚守同一个）"), h(Picks, { t, inv, opts: alive.filter(i => i !== act.last), onPick: i => onMove(mine, { target: i }) }));
      } else if (act.stage === "witch") {
        const v = act.victim;
        panel = h("div", { "data-wk": "nrsocnight", style: { display: "flex", flexDirection: "column", gap: 8 } }, note(t, "女巫请睁眼：今晚倒下的是 " + (v >= 0 ? nmOf(inv, v) : "——没人（平安夜）") + "。一晚最多用一瓶。"),
          h("div", { "data-wk": "nrsocact", className: "flex flex-wrap justify-center", style: { gap: 6 } },
            act.heal && v >= 0 ? h("button", { onClick: () => onMove(mine, { save: true }), style: small(t, true) }, "用解药救" + nmOf(inv, v)) : null,
            act.poison ? h("button", { onClick: () => setSave(save === "p" ? null : "p"), style: small(t, save === "p") }, "用毒药…") : null,
            h("button", { onClick: () => onMove(mine, { save: false, poison: -1 }), style: small(t, false) }, "都不用")),
          save === "p" ? h(Picks, { t, inv, opts: others, onPick: i => onMove(mine, { save: false, poison: i }) }) : null);
      }
    } else if (view.phase === "speech") panel = myTurn ? h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, note(t, "轮到你发言"),
        h("textarea", { "data-wk": "nrsocinput", value: d, rows: 3, onChange: e => setD(e.target.value.slice(0, 300)), placeholder: "说你的判断：站谁、怀疑谁、要不要跳身份", style: Object.assign(box(t), { resize: "none" }) }),
        h("button", { "data-wk": "nrsocsend", onClick: () => onMove(ti, { text: d.trim() }), disabled: !d.trim(), style: Object.assign(pill(t, true), { alignSelf: "center" }) }, "说完了"))
      : note(t, waitLine(inv, ti, "在发言…"));
    else if (view.phase === "vote") panel = myTurn ? h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, note(t, "投一个你要放逐的人（都投完才亮票）"), h(Picks, { t, inv, opts: alive.filter(i => i !== ti), onPick: i => onMove(ti, { target: i }), none: "弃票" }))
      : note(t, waitLine(inv, ti, "在投票…"));
    else if (view.phase === "shoot") panel = myTurn ? h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, note(t, "你出局了，可以开枪带走一个人"), h(Picks, { t, inv, opts: alive.filter(i => i !== ti), onPick: i => onMove(ti, { target: i }), none: "不开枪" }))
      : note(t, waitLine(inv, ti, "出局了，在决定开不开枪…"));
    const today = (view.speeches || []).filter(s => s.day === view.day);
    return wrap("werewolf", [
      mine >= 0 && priv ? h(RoleCard, { key: "r", t, title: "你是" + roleZh(role), lines }) : sub(t, "你在旁边看，看不到任何人的身份"),
      h(SeatRow, { key: "s", t, inv, alive: view.alive, on: ti, tag }),
      sub(t, (view.day ? "第 " + view.day + " 天" : "第一夜") + " · " + view.n + " 人 · 神职：" + view.gods.map(roleZh).join("、") + (view.deaths ? " · " + view.deaths : "")),
      panel,
      today.length ? h("div", { key: "sp", "data-wk": "nrsocspeech", style: { display: "flex", flexDirection: "column", gap: 4, fontFamily: F_BODY, fontSize: fs(12.5), color: t.ink, lineHeight: 1.6 } }, today.map((s, j) => h("div", { key: j }, h("b", null, nmOf(inv, s.seat) + "："), s.text))) : null,
      h(Log, { key: "l", t, log: view.log }),
      isHost && view.phase !== "done" ? h("button", { key: "e", onClick: onReveal, style: Object.assign(small(t, false), { alignSelf: "flex-start" }) }, "到这儿收桌（亮身份）") : null]);
  }

  function AvalonTable({ inv, view, priv, me, onMove, onReveal, isHost }) {
    const t = useTheme(), A = ADAPTERS.avalon, Z = AV().ROLE_ZH, mine = mySeatOf(inv, me), ti = A.turn(view);
    const myTurn = ti >= 0 && actorOf(inv.seats[ti], me, inv.host) === "mine-user";
    const [pick, setPick] = useState([]), [d, setD] = useState(""); useEffect(() => { setPick([]); setD(""); }, [view.log.length, view.phase]);
    const need = AV().QUEST[view.n][view.qn], R = view.reveal && view.reveal.roles, role = priv && priv.role;
    const seeLine = !priv ? "" : role === "merlin" ? "你看得到的坏人：" + (priv.sees.map(i => nmOf(inv, i)).join("、") || "没有") + "。别暴露自己，终局刺客会找你。"
      : role === "percival" ? (priv.sees.length >= 2 ? priv.sees.map(i => nmOf(inv, i)).join(" 和 ") + " 里一个是梅林、一个是莫甘娜，你分不清。" : "梅林是 " + (priv.sees.map(i => nmOf(inv, i)).join("、") || "—") + "。")
      : avEvil(role) && role !== "oberon" ? "你的同伙：" + (priv.sees.map(i => nmOf(inv, i)).join("、") || "只有你") + "。任务里可以出失败。" : role === "oberon" ? "你是坏人，但不认得同伙，同伙也不认得你。任务里可以出失败。" : "你不知道任何人的身份，靠组队和投票找坏人。";
    const tag = i => (R ? "（" + Z[R[i]] + "）" : "") + (i === view.leader && view.phase !== "done" ? " 👑" : "") + (view.team.indexOf(i) >= 0 && view.phase !== "team" ? " ⚔" : "") + (view.phase === "vote" && view.voted.indexOf(i) >= 0 ? " ✓" : "");
    const quests = h("div", { key: "q", "data-wk": "nrsocquest", className: "flex justify-center", style: { gap: 8 } }, AV().QUEST[view.n].map((k, j) => { const r = view.results[j];
      return h("div", { key: j, "data-on": j === view.qn && view.phase !== "done" ? "1" : "0", style: { width: 36, height: 36, borderRadius: 18, border: "1.5px solid " + (j === view.qn ? t.ink : t.line), background: r ? (r.ok ? t.ink : "transparent") : t.bg2, color: r && r.ok ? t.bg : t.ink,
        display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: fs(12), textDecoration: r && !r.ok ? "line-through" : "none" } }, r ? (r.ok ? "成" : "败" + r.fails) : k + (AV().failsReq(view.n, j) === 2 ? "*" : "")); }));
    let panel;
    if (view.phase === "done") panel = note(t, (view.win === "good" ? "好人赢了" : view.win === "evil" ? "坏人赢了" : "提前收桌") + (view.killed >= 0 ? "（刺客刺了 " + nmOf(inv, view.killed) + "）" : ""));
    else if (view.phase === "team") panel = myTurn ? h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, note(t, "你是队长：选 " + need + " 个人去做任务（已选 " + pick.length + "）"),
        h(Picks, { t, inv, opts: inv.seats.map((s, i) => i), sel: pick, onPick: i => setPick(p => p.indexOf(i) >= 0 ? p.filter(x => x !== i) : p.length < need ? p.concat([i]) : p) }),
        h("input", { "data-wk": "nrsocinput", value: d, onChange: e => setD(e.target.value.slice(0, 120)), placeholder: "一句理由（可空）", style: box(t) }),
        h("button", { "data-wk": "nrsocsend", disabled: pick.length !== need, onClick: () => onMove(ti, { team: pick, reason: d.trim() }), style: Object.assign(pill(t, true), { alignSelf: "center", opacity: pick.length === need ? 1 : .45 }) }, "提议这支队"))
      : note(t, waitLine(inv, ti, "（队长）在选人…"));
    else if (view.phase === "vote") panel = h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, note(t, "队伍：" + view.team.map(j => nmOf(inv, j)).join("、") + (view.reason ? "——" + view.reason : "")),
      myTurn ? h("div", { "data-wk": "nrsocact", className: "flex justify-center", style: { gap: 8 } }, h("button", { onClick: () => onMove(ti, { vote: "yes" }), style: small(t, true) }, "赞成"), h("button", { onClick: () => onMove(ti, { vote: "no" }), style: small(t, false) }, "反对")) : sub(t, waitLine(inv, ti, "在投票…") + "（都投完才亮）"));
    else if (view.phase === "quest") panel = myTurn ? h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, note(t, "交一张任务牌（只亮几张失败，不亮是谁）"),
        h("div", { "data-wk": "nrsocact", className: "flex justify-center", style: { gap: 8 } }, h("button", { onClick: () => onMove(ti, { play: "success" }), style: small(t, true) }, "成功"), avEvil(role) ? h("button", { onClick: () => onMove(ti, { play: "fail" }), style: small(t, false) }, "失败") : null))
      : note(t, "队员在做任务：交了 " + view.played + " / " + view.team.length);
    else if (view.phase === "assassin") panel = myTurn ? h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, note(t, "你是刺客：指认梅林"), h(Picks, { t, inv, opts: inv.seats.map((s, i) => i).filter(i => i !== ti && (priv.sees || []).indexOf(i) < 0), onPick: i => onMove(ti, { target: i }) }))
      : note(t, waitLine(inv, ti, "（刺客）在找梅林…"));
    return wrap("avalon", [
      mine >= 0 && priv ? h(RoleCard, { key: "r", t, title: "你是" + Z[role] + (avEvil(role) ? "（坏人）" : "（好人）"), lines: [seeLine] }) : sub(t, "你在旁边看，看不到任何人的身份"),
      quests, sub(t, "第 " + (view.qn + 1) + " 个任务 · 这一轮否决 " + view.track + " / 5" + (view.lastVotes.length ? " · 上次投票：" + view.lastVotes.map(x => nmOf(inv, x.seat) + (x.vote === "yes" ? "✓" : "✗")).join(" ") : "")),
      h(SeatRow, { key: "s", t, inv, on: ti, tag }),
      panel,
      h(Log, { key: "l", t, log: view.log }),
      isHost && view.phase !== "done" ? h("button", { key: "e", onClick: onReveal, style: Object.assign(small(t, false), { alignSelf: "flex-start" }) }, "到这儿收桌（亮身份）") : null]);
  }

  function SocialReplay({ rec }) {
    const t = useTheme(), r = rec.replay || {};
    return h("div", { "data-wk": "nrsocreplay", style: { padding: "8px 16px", fontFamily: F_BODY, fontSize: fs(13), color: t.ink, lineHeight: 1.7 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog } }, "全桌身份"),
      (r.rows || []).map((x, i) => h("div", { key: "r" + i }, x)),
      h("div", { style: { borderTop: "1px solid " + t.line, marginTop: 8, paddingTop: 8, color: t.sub, fontSize: fs(12) } }, (r.log || []).map((x, i) => h("div", { key: i, style: { color: /^【(夜里|暗里)】/.test(x) ? t.fog : t.sub } }, x))));
  }
  ADAPTERS.werewolf.Table = WolfTable; ADAPTERS.avalon.Table = AvalonTable;
  ADAPTERS.werewolf.Replay = SocialReplay; ADAPTERS.avalon.Replay = SocialReplay;
})(typeof window !== "undefined" ? window : globalThis);
