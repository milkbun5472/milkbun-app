// 联机小游戏：跑团（设计单第八节）
//
// 挂法：在 netroom-games.js 之后加载，往 NetGameCore.ADAPTERS 里登记 trpg 这一盒（接口照那份文件顶上那张表）。
//   · 开团人＝房主＝庄：开局页挑房主自己的一个团（在单机跑团里开好的：生成设定／导入剧本／收藏的世界都在那儿开），
//     守密人跑在房主那台、走线下线路（hostRoute:"offline"，跟单机跑团同一条）；骰子也只在房主那台掷。
//   · 这一团的进度就存在房主那个团里（x_trpg）：每一拍写回去，下次联机或者单机都接着这一拍往下。
//     别人和别人带来的角色是这一晚的「客串」，HP、数值不进那个团的队伍；单机接着玩时，队伍还是房主原来那支。
//   · 报名：别人自己当调查员上桌、和／或派自己带来的角色当队友。数值在各自那台按单机组队规则掷（角色按人设轻推），
//     只把名字和五项数值发给庄；人设留在自己手机。
//   · 每一拍：守密人写完，桌上每个人在自己那台交这一拍的行动（挑选项／自己写／咬耳朵／单独走开）；
//     角色队友由带 TA 来的那台用 TA 的线路＋人设写一行亲笔（单机队友交一拍那一份 seatDeclareSys），只看得到公开的局面和 TA 自己的私念；
//     全都交了（或房主点「不等了」）庄才掷骰、请守密人结算——单机「她一动整桌一起结算」那一拍，换成「大家都交了才结算」。
//   · 进度表、钟、压力拍、爆发拍、落账全走单机那一份（js/trpg.js 的 TrpgShared），这里只管座位、收行动和桌面。
//   · 私密：单独走开那一路的真相、守密人只回给某一位的悄悄话、角色的私念，都走 priv（只发给那一座的主人）。
//   · 选项下那一排「别的能做的事」（跟谁说话／看看什么／地点动作／去「?」地点／歇一会／接队友的话头／换到某位队友的一拍）
//     照单机那张单（TrpgShared.sideMenu）摆；整桌一起走的那一样按人头定：挑它的人比挑选项、自己写的人多，这一拍就是它
//     （赶路花团内时辰、走钟，全照单机 beatGate／modeTail／landOpts）；没成整桌的那一样只算 Ta 自己的：
//     找人说话就是私下攀谈，守密人只回给 Ta（走 priv）。
//   · 真人一直不交：到点（房主开局定，默认 3 分钟，可关）庄按「稳妥」那条替她交，桌上写明；掉线照框架的托管。
//   · 角色队友同时想（turns）：各主人那台一起想，庄按到达先后收齐。
//   · 每位客串这一晚做了什么，记进战绩卡那段话（进房间记录，退房勾记忆时记得住）。
(function (root) {
  "use strict";
  const C = root.NetGameCore;
  if (!C) return;
  const cut = (v, n) => String(v == null ? "" : v).slice(0, n);
  const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const TS = () => root.TrpgShared || null;
  const ensure = () => TS() || !root.LazyMods ? Promise.resolve() : root.LazyMods.load("trpg").catch(() => {});
  const STAT_KEYS = ["phy", "agi", "wit", "cha", "luck"];
  const STAT_ZH = { phy: "体魄", agi: "身手", wit: "头脑", cha: "谈吐", luck: "气运" };
  const nm = (inv, i) => root.NetGameCore.seatName((inv.seats || [])[i], i);
  const clone = x => JSON.parse(JSON.stringify(x));
  const MIN = 60000, TIMEOUTS = [0, 2, 3, 5];
  const playersOf = st => st.members.filter((m, i) => st.seatKinds[i] === "user").map(m => m.name);
  const edgesOf = c => { const T = TS(); if (!T || !c.mapRegions || !T.mapBuild) return []; try { const b = T.mapBuild(c.id, c.mapRegions); return b ? b.edges : []; } catch (e) { return []; } };
  const menuOf = st => { const T = TS(); return T && T.sideMenu ? T.sideMenu(Object.assign({}, st.camp, { party: st.members }), edgesOf(st.camp), playersOf(st)) : []; };
  const sideKey = o => o ? o.kind + ":" + (o.arg || "") : "";
  // 到点替交：「稳妥」那条（approach safe），没有就挑不用过检定的，再没有就第一条；一条路都没有就跟着大家
  const safePick = c => { const ch = c.choices || []; let k = ch.findIndex(x => x && x.approach === "safe"); if (k < 0) k = ch.findIndex(x => x && !x.check); return ch.length ? Math.max(0, k) : -1; };
  const cleanStats = s => s && typeof s === "object" && STAT_KEYS.every(k => Number.isFinite(Number(s[k]))) ? STAT_KEYS.reduce((o, k) => (o[k] = int(s[k], 15, 90, 50), o), {}) : null;

  // ── 座位 ↔ 队伍成员 ──
  // 房主自己＝团里的「user」；房主带来、本来就在这支队里的角色＝团里那一位；其余都是这一晚的客串（guest），数值要现掷
  function seatParty(camp, inv) {
    const used = new Set(), names = new Set();
    const members = inv.seats.map((s, i) => {
      let m = null;
      if (s.peer === inv.host && s.kind === "user") m = (camp.party || []).find(x => x.key === "user");
      else if (s.peer === inv.host && s.kind === "char") m = (camp.party || []).find(x => x.key === s.charId);
      if (m && !used.has(m.key)) { used.add(m.key); names.add(m.name); return Object.assign({}, m); }
      return null;
    });
    return members.map((m, i) => {
      if (m) return m;
      const s = inv.seats[i]; let name = cut(s.name, 16) || "客人"; while (names.has(name)) name += "·";
      names.add(name);
      return { key: "nr:" + i, name, hp: 100, maxHp: 100, stats: null, fate: 2, effects: [], feats: [], guest: true, player: s.kind === "user" };
    });
  }
  const pendingOf = st => st.phase === "roll" ? st.members.map((m, i) => m.stats ? -1 : i).filter(i => i >= 0)
    : st.phase === "act" ? st.members.map((m, i) => st.acts[i] ? -1 : i).filter(i => i >= 0)
    : st.phase === "check" ? [ckWho(st)].filter(i => i >= 0) : [];
  // 一位一位跟上的那一座：角色先（它们自己会动），再 NPC／托管，最后真人（真人在自己那台随时能交，不用等轮到）
  function turnOf(st, seats) {
    if (st.phase === "check") return st.busy ? -1 : ckWho(st);
    if (st.busy || (st.phase !== "roll" && st.phase !== "act")) return -1;
    const p = pendingOf(st), rank = i => seats[i].kind === "char" && !seats[i].away ? 0 : seats[i].kind === "npc" || seats[i].away ? 1 : 2;
    return p.length ? p.slice().sort((a, b) => rank(a) - rank(b))[0] : -1;
  }

  // ── 公开那一份：从团里摘桌面上看得到的东西，秘典、私念、另一路的真相一个字都不带 ──
  function publicLog(camp, from) {
    return (camp.msgs || []).slice(from).filter(m => ["gm", "roll", "user", "sys", "apart", "letter"].indexOf(m.role) >= 0).slice(-30)
      .map(m => ({ role: m.role, text: cut(m.role === "sys" ? String(m.content || "").replace(/^亲笔·/, "") : m.content, 3000), who: cut(m.who || m.from, 16) }));
  }
  function tableOf(st) {
    const c = st.camp, T = TS(), stage = (c.stages || [])[c.stageIdx || 0];
    return { title: cut(c.title, 30), world: cut(c.world, 300), place: cut(c.pos || c.place, 30), goal: stage && (c.stageIdx || 0) < c.stages.length ? cut(stage.goal, 120) : "",
      objective: cut(c.sceneMeta && c.sceneMeta.objective, 120), stakes: cut(c.sceneMeta && c.sceneMeta.stakes, 120),
      pace: T && T.paceView ? T.paceView(c.pace) : null, clocks: (c.clocks || []).slice(0, 3).map(x => ({ name: cut(x.name, 16), filled: int(x.filled, 0, 12, 0), max: int(x.max, 1, 12, 4) })),
      clues: (c.clues || []).length, clueList: (c.clues || []).slice(-8).map(x => cut(x, 80)),
      choices: (c.choices || []).slice(0, 4).map(x => ({ text: cut(x.text, 80), stat: x.check && STAT_ZH[x.check.stat] ? x.check.stat : "", who: cut(x.check && x.check.who, 16), risk: cut(x.risk, 36), payoff: cut(x.payoff, 36), cost: cut(x.cost, 36), safe: x.approach === "safe" })),
      time: c.time ? "第" + int(c.time.day, 1, 999, 1) + "日·" + cut(c.time.part, 2) : "", pov: cut(c.pov, 16), canEnd: !c.ended && (!!c.pendingEnd || (c.stageIdx || 0) >= (c.stages || []).length),
      side: c.ended ? [] : menuOf(st).slice(0, 14).map(x => ({ kind: x.kind, arg: cut(x.arg, 30), label: cut(x.label, 40) })),
      epi: c.ended && c.epilogue ? { paras: (c.epilogue.paras || []).slice(0, 10).map(x => cut(x, 600)), closing: cut(c.epilogue.closing, 60), untold: (c.epilogue.untold || []).slice(0, 6).map(x => cut(x, 160)),
        truth: cut(c.dossier && c.dossier.truth, 400), twist: cut(c.dossier && c.dossier.twist, 300), apart: Object.keys(st.truth || {}).map(k => ({ who: cut((st.members[k] || {}).name, 16), text: cut((st.truth[k] || []).slice(-1)[0], 400) })).filter(x => x.text) } : null,
      ended: !!c.ended };
  }
  // 台面上大家都看得到的那一份（跟单机仪式浮层吃同一个形状）
  const ckPublic = c => c ? { who: cut(c.who, 16), statKey: c.statKey, statZh: STAT_ZH[c.statKey] || "", base: int(c.base, 1, 99, 1), feat: c.feat ? cut(c.feat, 8) : null,
    assist: c.assist ? { key: cut(c.assist.key, 4), name: cut(c.assist.name, 16) } : null, declined: c.declined ? cut(c.declined, 16) : null, bond: int(c.bond, -5, 5, 0), bargainText: c.bargainText ? cut(c.bargainText, 24) : null, bargainOn: !!c.bargainOn,
    vs: c.vs ? { name: cut(c.vs.name, 8), val: int(c.vs.val, 20, 90, 50) } : null, harm: !!c.harm, fate: int(c.fate, 0, 9, 0), phase: ["ready", "done", "final"].indexOf(c.phase) >= 0 ? c.phase : "ready",
    roll: int(c.roll, 0, 100, 0), rolls: (c.rolls || []).slice(0, 3).map(x => int(x, 1, 100, 1)), grade: c.grade ? { tier: cut(c.grade.tier, 8), zh: cut(c.grade.zh, 12) } : null,
    vsRoll: c.vsRoll == null ? null : int(c.vsRoll, 1, 100, 1), vsGrade: c.vsGrade ? { tier: cut(c.vsGrade.tier, 8), zh: cut(c.vsGrade.zh, 12) } : null, opposed: c.opposed === "win" || c.opposed === "lose" ? c.opposed : null,
    harmRoll: c.harmRoll == null ? null : int(c.harmRoll, 1, 20, 1), offer: !!c.offer, spent: (c.spent || []).slice(0, 2).map(x => cut(x, 12)), mates: [] } : null;
  function view(st) {
    return Object.assign(tableOf(st), {
      phase: st.phase, beat: st.beat, seatKinds: st.seatKinds.slice(), busy: !!st.busy, err: cut(st.err, 200),
      party: st.members.map(m => ({ name: m.name, hp: int(m.hp, 0, 999, 100), maxHp: int(m.maxHp, 1, 999, 100), stats: m.stats ? Object.assign({}, m.stats) : null, guest: !!m.guest })),
      done: st.members.map((m, i) => st.phase === "roll" ? !!m.stats : !!st.acts[i]),
      apart: st.apartWho.slice(), log: publicLog(st.camp, st.logFrom),
      deadline: st.phase === "act" && st.timeout > 0 && st.actAt ? st.actAt + st.timeout : 0, timeoutMin: Math.round((st.timeout || 0) / MIN), autoed: (st.autoed || []).slice(),
      fate: st.members.map(m => int(m.fate, 0, 9, 0)),
      ck: st.ck ? { n: st.ckN || 0, seat: st.ck.seat, ask: st.ck.ask, stage: st.ck.stage, rolledAt: st.ck.rolledAt || 0, c: ckPublic(st.ck.c) } : null,
      pendingStage: !st.camp.ended && st.camp.pendingStage ? cut(typeof st.camp.pendingStage === "string" ? st.camp.pendingStage : "这一章看起来到落点了", 80) : "",
      growth: (((st.camp.epilogue || {}).growth) || []).concat(st.guestGrowth || []).slice(0, 12).map(growZh)
    });
  }
  // 只给这一座主人的：角色的私念（主人那台替 TA 想这一拍时用）、守密人只回给 TA 的悄悄话、单独走开那一路真正发生了什么
  function priv(st, i) {
    const m = st.members[i]; if (!m) return null;
    const mate = ((st.camp.dossier || {}).mates || []).find(x => x && x.name === m.name);
    const o = {};
    if (mate && st.seatKinds[i] === "char") o.mate = { want: cut(mate.want, 120), fear: cut(mate.fear, 120), line: cut(mate.line, 120), clash: cut(mate.clash, 120) };
    if ((st.whisper[i] || []).length) o.whisper = st.whisper[i].slice(-6);
    if ((st.truth[i] || []).length) o.truth = st.truth[i].slice(-4);
    // 检定仪式：「这一下要过什么检定」只发给该掷的那一座；被请去协力的那一座只收到一句「Ta 请你搭手」
    const k = st.ck;
    if (k && k.seat === i && (k.stage === "pre" || k.stage === "fate")) o.ckAsk = { n: st.ckN || 0, stage: k.stage, statZh: STAT_ZH[k.chk.stat], feat: k.c.feat, bargain: k.c.bargainText, fate: int(k.c.fate, 0, 9, 0), tier: k.c.grade ? k.c.grade.tier : "",
      mates: k.c.mates.map(x => ({ seat: mateSeat(x.key), name: cut(x.name, 16) })) };
    if (k && k.stage === "ask" && k.ask === i) o.ckHelp = { n: st.ckN || 0, who: cut(st.members[k.seat].name, 16), statZh: STAT_ZH[k.chk.stat] };
    return Object.keys(o).length ? o : null;
  }

  // ── 收行动 ──
  function takeAct(st, i, mv, isHost) {
    const dice = !!(isHost && mv.dice);
    if (mv.pass) return { kind: "pass", dice };
    // 选项下那一排里挑的那一样：只认这一刻那张单上真有的
    if (mv.side && typeof mv.side === "object") {
      const o = menuOf(st).find(x => sideKey(x) === sideKey({ kind: cut(mv.side.kind, 10), arg: cut(mv.side.arg, 30) }));
      if (!o) return null;
      const text = cut(mv.say, 400).trim();
      if (o.kind === "talk" && !text) return null;
      return { kind: "side", side: { kind: o.kind, arg: o.arg, label: o.label }, text, whisper: cut(mv.whisper, 200).trim(), dice };
    }
    if (mv.decl && typeof mv.decl === "object") return { kind: "decl", decl: { say: cut(mv.decl.say, 300), do: cut(mv.decl.do, 200), try: cut(mv.decl.try, 120) } };
    const pick = int(mv.pick, -1, 3, -1), text = cut(mv.say, 400).trim();
    if (pick < 0 && !text) return null;
    return { kind: pick >= 0 ? "pick" : "text", pick, text, whisper: cut(mv.whisper, 200).trim(), apart: !!mv.apart, auto: !!mv.auto, dice };
  }
  // 这一拍整桌一起走的那一样：选项下那一排里票最多的那一样（平票看座位先后），票数比挑选项／自己写的人多（或者没人挑选项）才算整桌的
  function tableMode(st) {
    const votes = {}, order = [];
    let regular = 0;
    st.members.forEach((m, i) => {
      const a = st.acts[i]; if (!a) return;
      if (a.kind === "side") { const k = sideKey(a.side); if (!votes[k]) { votes[k] = { side: a.side, n: 0, seats: [] }; order.push(k); } votes[k].n++; votes[k].seats.push(i); }
      else if (a.kind === "pick" || a.kind === "text" || a.kind === "decl") regular++;
    });
    const top = order.map(k => votes[k]).sort((a, b) => b.n - a.n)[0];
    return top && (top.n > regular || !regular) ? top : null;
  }
  // 每位客串这一拍做了什么（记进战绩卡）
  function diaryLine(a, ch) {
    if (!a || a.kind === "pass") return "跟着大家";
    if (a.kind === "decl") return cut([a.decl.say ? "说「" + a.decl.say + "」" : "", a.decl.do, a.decl.try ? "想赌:" + a.decl.try : ""].filter(Boolean).join(","), 60) || "跟着大家";
    if (a.kind === "side") return cut(a.side.label + (a.text ? ":" + a.text : ""), 60);
    return cut((ch ? "选了「" + ch.text + "」" : a.text) + (a.auto ? "(到点替交)" : ""), 60);
  }
  // 写回房主那个团：客串的人不进队伍；没带进房间的队友原样留着；其余（史、钟、进度表、线索、位置）照这一拍
  function writeBack(st) {
    const T = TS(); if (!T || !T.loadCamps) return;
    const list = T.loadCamps(), k = list.findIndex(c => c.id === st.camp.id); if (k < 0) return;
    const byKey = {}; st.members.filter(m => !m.guest).forEach(m => { byKey[m.key] = m; });
    const party = (list[k].party || []).map(m => byKey[m.key] ? Object.assign({}, m, { hp: byKey[m.key].hp, fate: byKey[m.key].fate, effects: byKey[m.key].effects, bond: byKey[m.key].bond, bondLog: byKey[m.key].bondLog }) : m);
    list[k] = Object.assign({}, st.camp, { party });
    T.saveCamps(list);
  }

  // 守密人这一拍要多知道的几件事：几位真人、谁咬了耳朵、谁私下找谁说话、谁单独走开；其余（这一拍的戏法、进度表）照单机那一份 modeTail
  function tableTail(st, c, o) {
    const T = TS(), players = playersOf(st);
    const uName = players.join("、") || "各位玩家";
    const lines = ["\n\n〔联桌〕这一桌有 " + (players.length || 0) + " 位真人玩家" + (players.length ? ":" + players.join("、") : "") + "。每位玩家的行动、台词和决定只由 Ta 本人交上来(见上一条〔这一拍大家的行动〕),你只写世界、NPC 和结果;队友的〔亲笔·〕行是那位队友本人交的,照亲笔纪律叙入。几个人同时在读:正文用名字称呼每位玩家;choices 是给全队的几条路,每位玩家会各挑各的。标着「到点替交」的那一位只是没来得及交,照那条路写、别替 Ta 加戏。"];
    (o.whispers || []).forEach(w => lines.push("〔咬耳朵·来自" + w.from + "〕" + w.text + "——只有你和 Ta 知道:正文里别点破;要只回 Ta 一句,写进 whisper:[{\"to\":\"" + w.from + "\",\"text\":\"一两句\"}]。"));
    (o.talks || []).forEach(w => lines.push("〔私下攀谈·" + w.from + " 找 " + w.to + "〕" + w.from + " 走到一边对「" + w.to + "」说:「" + w.text + "」——" + w.to + " 照自己的身份与立场回 Ta(可以露口风、打太极,不知道的就是不知道)。这段对话只写进 whisper:[{\"to\":\"" + w.from + "\",\"text\":\"" + w.to + " 怎么回的(两三句)\"}],正文里至多一笔带过两人走到一边说话;真情报照常进 clue。"));
    if (o.split && o.split.length) lines.push("〔分头行动〕" + o.split.join("、") + " 这一拍单独走开去办自己交上来的那件事,其余人留在原地。scene 只写留下的那一路;走开那一路写进 apart 字段——truth 是 Ta 们那边真正发生了什么(3-5句),report 是 Ta 们回来以后对大家的说法(可以和 truth 不一样),who 写走开的人名。");
    lines.push(T.modeTail(c, o.mode, { uName, extra: o.extra, dice: o.dice, scriptEv: o.scriptEv, burst: o.burst, pressure: o.pressure }));
    return lines.join("\n");
  }
  function personasOf(st, prep) {
    const pz = (prep && prep.personas) || {};
    return st.members.map((m, i) => {
      if (st.seatKinds[i] !== "char") return "";
      if (!m.guest && pz[m.key]) return "【队友人设·" + m.name + "(性格与声纹的根基,保持不变)】\n" + cut(pz[m.key], 6000);
      return "【队友·" + m.name + "】别的玩家带来的角色,人设在 Ta 主人的手机上。Ta 的话和动作以〔亲笔·〕行为准;你写 Ta 做那件事的结果和旁人的反应,口气跟着 Ta 亲笔里的样子走。";
    }).filter(Boolean).join("\n\n");
  }

  // ── 检定仪式：庄把「这一下要过什么检定」只发给该掷的那一座（priv），那位在自己那台过一遍单机同款的台面
  //    （专长照单机自动算、请谁协力、接不接魔鬼交易、按「掷」；落定后失败了要不要花命运点），选择交回庄；
  //    骰子只在庄这台掷（TrpgShared 的 ceremonyRollOnce／ceremonyFate／ceremonyTail），结果进公开那一份，大家同时看它滚。
  //    请的协力是别人那一座的：先问那位一句（priv），同意了才算。超时／托管：不请人、不接交易、不花命运点。
  const CK_SHOW = 2600;   // 最后一颗落定后停这么久再请守密人，大家先看清骰子
  // 这一下由谁掷：守密人点了在队的人就是那位，换视角拍是镜头上那位，否则是挑这条路的人自己
  function ckRoller(st, i, ch) {
    const T = TS(), c = st.camp;
    let m = ch.check.who ? T.findMember(st.members, ch.check.who) : null;
    if (!m && c.pov) m = T.findMember(st.members, c.pov);
    const k = m ? st.members.indexOf(m) : i;
    return k >= 0 && st.members[k].hp > 0 ? k : i;
  }
  function ckOpen(st, list) {
    const T = TS();
    if (!list.length) return null;
    const [x] = list, m = st.members[x.mi];
    const party = st.members.map((y, k) => Object.assign({}, y, { key: "s" + k }));
    const c = T.ceremonyBase(Object.assign({}, m, { key: "s" + x.mi }), x.chk, party);
    return Object.assign({}, st, { phase: "check", busy: false, cks: list.slice(1), ckN: (st.ckN || 0) + 1,
      ck: { seat: x.mi, act: x.act, src: x.src, chk: x.chk, c, stage: "pre", ask: -1, at: Date.now(), rolledAt: 0 } });
  }
  // 这一拍挑了带检定那条路的每一位，各过一遍台面；没有就直接结算
  function ckQueue(st) {
    const out = [];
    st.members.forEach((m, i) => {
      const a = st.acts[i], ch = a && a.kind === "pick" ? (st.camp.choices || [])[a.pick] : null;
      if (ch && ch.check && STAT_ZH[ch.check.stat]) out.push({ act: i, mi: ckRoller(st, i, ch), chk: ch.check, src: "pick" });
    });
    return out;
  }
  const mateSeat = key => Number(String(key || "").slice(1));
  // 不花资源的默认：不请人、不接交易、不花命运点（到点替交、托管、角色那台没想出来都走它）
  function ckDefault(st) {
    const k = st.ck; if (!k) return null;
    return k.stage === "ask" ? { ck: "assist", ok: false, auto: true } : k.stage === "fate" ? { ck: "fate", use: "no", auto: true } : { ck: "roll", assist: -1, bargain: false, auto: true };
  }
  const ckWho = st => !st.ck || st.ck.stage === "shown" ? -1 : st.ck.stage === "ask" ? st.ck.ask : st.ck.seat;
  function ckSettled(st, k) {
    const T = TS();
    const spent = (k.c.spent || []).length;
    const members = spent ? st.members.map((m, i) => i === k.seat ? Object.assign({}, m, { fate: Math.max(0, (m.fate || 0) - spent) }) : m) : st.members;
    return Object.assign({}, st, { members, ckRes: Object.assign({}, st.ckRes || {}, { [k.src === "need" ? "need" : k.act]: { mi: k.seat, chk: k.chk, res: T.ceremonyRes(k.c) } }),
      ck: Object.assign({}, k, { c: Object.assign({}, k.c, { fate: Math.max(0, (st.members[k.seat].fate || 0) - spent) }), stage: "shown", at: Date.now() }) });
  }
  // 庄这台掷：我方那颗 → 失败了等那位决定命运点 → 对抗、伤害
  function ckThrow(st, k) {
    const T = TS();
    const c = T.ceremonyRollOnce(k.c);
    const k2 = Object.assign({}, k, { c, rolledAt: Date.now(), at: Date.now() });
    if (c.offer) return Object.assign({}, st, { ck: Object.assign(k2, { stage: "fate" }) });
    return ckSettled(st, Object.assign(k2, { c: T.ceremonyTail(c) }));
  }
  function ckMove(st, seatIdx, mv, inv) {
    const T = TS(), k = st.ck;
    if (!k || k.stage === "shown") return { err: "骰子已经落定了" };
    if (seatIdx !== ckWho(st)) return { err: k.stage === "ask" ? "在等 " + st.members[k.ask].name + " 回话" : "这一下轮到 " + st.members[k.seat].name + " 掷" };
    if (k.stage === "pre") {
      if (mv.ck !== "roll") return { err: "先在台面上按「掷」" };
      const as = int(mv.assist, -1, st.members.length - 1, -1);
      const mates = k.c.mates.map(x => mateSeat(x.key));
      const c = Object.assign({}, k.c, { bargainOn: !!(mv.bargain && k.c.bargainText), assist: null });
      if (as >= 0 && mates.indexOf(as) >= 0) {
        const s = inv.seats[as], me = inv.seats[k.seat];
        // 请的是别人那一座的人（或别人带来的角色）：先问那位同不同意；自己带来的、托管的、NPC 直接算
        if (s && s.peer && !s.away && s.kind !== "npc" && (!me || s.peer !== me.peer)) return { st: Object.assign({}, st, { ck: Object.assign({}, k, { c, stage: "ask", ask: as, at: Date.now() }) }) };
        return { st: ckThrow(st, Object.assign({}, k, { c: Object.assign(c, { assist: { key: "s" + as, name: st.members[as].name } }) })) };
      }
      return { st: ckThrow(st, Object.assign({}, k, { c })) };
    }
    if (k.stage === "ask") {
      if (mv.ck !== "assist") return { err: "回一句搭不搭手" };
      const c = Object.assign({}, k.c, { assist: mv.ok ? { key: "s" + k.ask, name: st.members[k.ask].name } : null, declined: mv.ok ? null : st.members[k.ask].name });
      return { st: ckThrow(st, Object.assign({}, k, { c, ask: -1 })) };
    }
    if (mv.ck !== "fate") return { err: "命运点花不花,选一个" };
    const use = ["reroll", "soften"].indexOf(mv.use) >= 0 ? mv.use : "no";
    let c = T.ceremonyFate(k.c, use);
    if (c.offer) c = Object.assign({}, c, { offer: false });
    return { st: ckSettled(st, Object.assign({}, k, { c: T.ceremonyTail(c), rolledAt: use === "reroll" ? Date.now() : k.rolledAt })) };
  }

  // 守密人一枪、落账（单机那一份）
  async function gmCall(st, ctx, c, o) {
    const T = TS(), uName = playersOf(st).join("、") || "各位玩家";
    const sys = T.buildGmSys(c, { uName, personas: personasOf(st, ctx.prep) });
    const hist = T.foldHist(c.msgs.slice(c.sumCount || 0)).slice(-40), tail = tableTail(st, c, o);
    if (hist.length && hist[hist.length - 1].role === "user") hist[hist.length - 1] = { role: "user", content: hist[hist.length - 1].content + tail };
    else hist.push({ role: "user", content: "(继续)" + tail });
    const raw = await root.callAI(ctx.hostApi, sys, hist, { maxTokens: T.TOK_MAX, timeout: 300000 });
    return T.parseTurnPayload(raw);
  }
  function gmLand(c, p, o) {
    const T = TS();
    const lo = Object.assign(T.landOpts(c, o.mode, { extra: o.extra, burst: o.burst, pressure: o.pressure, hops: o.hops }), { nodes: T.nodesOfCamp(c) });
    if (o.split && o.split.length) lo.split = { who: o.split, task: "" };
    const r = T.applyTurnPayload(c, p, lo);
    const beat = T.beatMsgsOf(r.camp, p, r);
    if (o.mode && o.mode.explore && !o.mode.seed && beat[0]) beat[0].lull = true;
    return { r, c: Object.assign({}, r.camp, { msgs: c.msgs.concat(beat) }) };
  }
  const ckRollMsg = (T, m, chk, res) => Object.assign({ id: T.rid("rm_"), role: "roll", content: T.rollLine("", m, chk, res), ts: Date.now() }, T.rollRec(m, chk, res));

  // 结算：骰子（检定仪式已在这台掷完）→ 拼这一拍的史 → 定这一拍的戏法 → 守密人一枪 → 单机那一份落账（钟、进度表、时辰、压力拍、爆发拍都在里面）→ 写回房主的团
  async function resolve(st, inv, ctx) {
    const T = TS(); if (!T) return Object.assign({}, st, { busy: false, err: "跑团没装上,这一拍结算不了" });
    if (!ctx.hostApi) return Object.assign({}, st, { busy: false, phase: "stuck", err: "房主这台没配线下线路,守密人写不了这一拍" });
    if (st.phase === "stuck" && st.mid) return afterNeed(st, inv, ctx);
    let camp = Object.assign({}, st.camp, { party: st.members.map(m => Object.assign({}, m)), msgs: (st.camp.msgs || []).slice() });
    const n = Object.assign({}, st, { whisper: Object.assign({}, st.whisper), truth: Object.assign({}, st.truth), diary: Object.assign({}, st.diary || {}), err: "", ck: null, cks: [] });
    let pend;
    if (st.phase !== "stuck") {
      const add = [], rolls = [], says = [], whispers = [], talks = [], split = [], tryers = [], autoed = [];
      let typed = false, dice = false, povPick = null;
      const top = tableMode(st);
      let mode = top ? T.sideMove(camp, top.side).mode : null;
      // 行动表：表上的队友（不是真人玩家的那几位）各掷各的骰（单机同一条）
      (camp.table || []).filter(r => r.stat).forEach(r => {
        const k = st.members.findIndex(m => m.name === r.who), m = st.members[k];
        if (!m || m.hp <= 0 || st.seatKinds[k] === "user") return;
        const res = T.autoRoll(m, r.stat);
        rolls.push(Object.assign({ id: T.rid("rm_"), role: "roll", content: (r.act ? "〔" + r.act + "〕" : "") + T.rollLine("", m, { stat: r.stat }, res), ts: Date.now() }, T.rollRec(m, { stat: r.stat }, res)));
      });
      st.members.forEach((m, i) => {
        const a = st.acts[i] || { kind: "pass" };
        if (a.dice) dice = true;
        const ch = a.kind === "pick" ? (camp.choices || [])[a.pick] : null;
        if (m.guest) n.diary[i] = (n.diary[i] || []).concat(["第" + (st.beat + 1) + "拍:" + diaryLine(a, ch)]).slice(-12);
        if (a.kind === "decl") { const line = T.declareLineOf(m.name, a.decl); if (line) add.push({ id: T.rid("rm_"), role: "sys", content: "亲笔·" + line, ts: Date.now() }); else says.push(m.name + " 这一拍没出声,跟着大家"); if (a.decl.try) tryers.push(m.name); return; }
        if (a.kind === "pass") { says.push(m.name + " 这一拍跟着大家"); return; }
        if (a.kind === "side") {
          const mine = top && sideKey(top.side) === sideKey(a.side);
          if (a.side.kind === "talk" && !mine) { talks.push({ from: m.name, to: a.side.arg, text: a.text }); says.push(m.name + " 走到一边找" + a.side.arg + "说话"); }
          else says.push(m.name + ":" + a.side.label + (a.text ? "——「" + a.text + "」" : "") + (mine ? "" : "(大家没跟上,这一拍没成)"));
          if (a.whisper) whispers.push({ from: m.name, text: a.whisper });
          return;
        }
        // 这条路要过检定：仪式里那位自己定的那一颗（没过台面的——比如房主「不等了」——照单机行动表那样直接掷）
        if (ch && ch.check && STAT_ZH[ch.check.stat]) {
          const got = (st.ckRes || {})[i], rm = got ? st.members[got.mi] : m;
          rolls.push(ckRollMsg(T, rm, ch.check, got ? got.res : T.autoRoll(m, ch.check.stat)));
        }
        // 换视角那一拍：替那位队友拿主意（单机同一条：带上是不是违心）；那位自己那座挑的优先
        if (ch && camp.pov && (!povPick || m.name === camp.pov)) povPick = { who: camp.pov, against: ch.willing === false, text: ch.text };
        if (a.kind === "text") { typed = true; tryers.push(m.name); }
        if (a.auto) autoed.push(m.name);
        says.push(m.name + (ch ? " 选了「" + ch.text + "」" : ":" + a.text) + (a.text && ch ? "(" + a.text + ")" : "") + (a.apart ? "(单独走开去办)" : "") + (a.auto ? "(到点没交,庄按稳妥那条替她交的)" : ""));
        if (a.whisper) whispers.push({ from: m.name, text: a.whisper });
        if (a.apart) split.push(m.name);
      });
      if (!mode && povPick) mode = { povPick };
      if (typed && (!mode || typeof mode === "object")) mode = Object.assign({}, mode || {}, { typed: true });
      add.push({ id: T.rid("rm_"), role: "user", content: "〔这一拍大家的行动〕\n" + says.join("\n"), ts: Date.now() });
      camp.msgs = camp.msgs.concat(rolls, add);
      // 剧情骰（房主那座点的）：剧本事件池先抽，抽过的记下
      let scriptEv = null;
      if (dice) { const left = T.scriptEventsLeft(camp, true); scriptEv = left.length ? left[Math.floor(Math.random() * left.length)] : null; if (scriptEv) camp.eventPool = camp.eventPool.map(e => e.text === scriptEv.text ? Object.assign({}, e, { used: true }) : e); }
      pend = { whispers, talks, split, tryers, mode, dice, scriptEv, rolls, autoed };
      n.pend = pend; n.autoed = autoed;
    } else pend = n.pend || { whispers: [], talks: [], split: [], tryers: [], mode: null, rolls: [] };
    // 骰子、宣言一落地就是铁案：先存，守密人失败了也不回滚（单机同一条）；重试只重跑叙事
    n.camp = camp; n.acts = {}; n.ckRes = {}; n.members = camp.party; writeBack(n);
    const gate = T.beatGate(camp, pend.mode, edgesOf(camp));
    const o1 = { whispers: pend.whispers, talks: pend.talks, split: pend.split, mode: gate.mode, burst: gate.burst, pressure: gate.pressure, hops: gate.hops, extra: pend.rolls, dice: pend.dice, scriptEv: pend.scriptEv };
    let p = null, why = "";
    try { p = await gmCall(st, ctx, camp, o1); if (!p) why = "回的不是一拍剧情"; } catch (e) { p = null; why = String((e && e.message) || e).slice(0, 80); }
    if (!p) return Object.assign(n, { busy: false, phase: "stuck", err: "守密人这一拍没写出来(" + why + ");骰子和大家的行动都记下了,房主点「继续这一拍」重试" });
    const out = gmLand(camp, p, o1);
    // 自己写的那一下要碰运气：守密人停在悬点报 needCheck → 该掷的那位过一遍台面（单机同一条：只认这一拍确有人自己写或想赌），掷完再续写一枪
    const nck = T.normCheckObj(p.needCheck), tryers = (pend.tryers || []).map(x => T.findMember(out.c.party, x)).filter(Boolean);
    if (nck && tryers.length && !out.c.ended) {
      const m = (nck.who ? T.findMember(out.c.party, nck.who) : null) || tryers[0] || out.c.party[0];
      const mid = { whisper: Array.isArray(p.whisper) ? p.whisper.slice(0, 6) : [], apart: out.r.apart || null, split: (pend.split || []).slice() };
      const n2 = Object.assign(n, { camp: out.c, members: out.c.party, mid });
      writeBack(n2);
      return ckOpen(n2, [{ act: -1, mi: Math.max(0, out.c.party.indexOf(m)), chk: nck, src: "need" }]);
    }
    return wrapUp(n, ctx, out, p.whisper, out.r.apart, pend.split);
  }
  // needCheck 那一颗落定：入史，续写一枪
  async function afterNeed(st, inv, ctx) {
    const T = TS(), got = (st.ckRes || {}).need, mid = st.mid || {};
    const n = Object.assign({}, st, { whisper: Object.assign({}, st.whisper), truth: Object.assign({}, st.truth), err: "", ck: null, cks: [] });
    let c2 = st.camp;
    if (got) { c2 = Object.assign({}, st.camp, { msgs: st.camp.msgs.concat([ckRollMsg(T, st.members[got.mi], got.chk, got.res)]) }); n.ckRes = {}; n.camp = c2; writeBack(n); }
    const o2 = { mode: "resolve", extra: c2.msgs.slice(-1).filter(m => m.role === "roll") };
    let p2 = null; try { p2 = await gmCall(st, ctx, c2, o2); } catch (e) { p2 = null; }
    if (!p2) return Object.assign(n, { busy: false, phase: "stuck", err: "骰子落定了,守密人续写没写出来;房主点「继续这一拍」重试" });
    const out = gmLand(c2, p2, o2);
    return wrapUp(Object.assign(n, { mid: null }), ctx, out, (mid.whisper || []).concat(Array.isArray(p2.whisper) ? p2.whisper : []), out.r.apart || mid.apart, mid.split || []);
  }
  // 一拍收尾：守密人只回给某一位的话（咬耳朵、私下攀谈）、另一路的真相进 priv；前情账本；下一拍
  async function wrapUp(n, ctx, out, whisper, apart, split) {
    const T = TS(), st = n;
    (Array.isArray(whisper) ? whisper : []).slice(0, 6).forEach(w => {
      const k = st.members.findIndex(m => w && m.name === cut(w.to, 16)); if (k < 0 || !cut(w.text, 300).trim()) return;
      n.whisper[k] = (n.whisper[k] || []).concat([cut(w.text, 300)]);
    });
    if (apart) (apart.who || split).forEach(nmx => { const k = st.members.findIndex(m => m.name === nmx || String(apart.who || "").indexOf(m.name) >= 0); if (k >= 0 && apart.truth) n.truth[k] = (n.truth[k] || []).concat([cut(apart.truth, 800)]); });
    // 前情账本：超过 48 条把最老的压进账本（单机那一份），失败就下回再试
    const uName = playersOf(st).join("、") || "各位玩家";
    const job = T.summaryJob ? T.summaryJob(out.c, uName) : null;
    if (job) { try { const raw = await root.callAI(ctx.hostApi, T.SUMMARY_SYS, [{ role: "user", content: T.summaryUser(job) }], { maxTokens: T.TOK_MAX, timeout: 120000 }); const patch = T.summaryPatch(job, raw); if (patch) out.c = Object.assign({}, out.c, patch); } catch (e) { /* 下回再试 */ } }
    n.apartWho = (split || []).slice();
    n.camp = out.c; n.members = out.c.party; n.beat = st.beat + 1; n.pend = null; n.mid = null; n.busy = false; n.ck = null; n.cks = []; n.ckRes = {};
    n.phase = out.c.ended ? "done" : "act"; n.actAt = Date.now();
    writeBack(n);
    return n;
  }
  // 落幕的成长骰（单机那一份 growthRolls：这团用过且成功过的本事才有资格长，结算卡点过高光的那项掷两颗取高）：
  //   房主原队伍里这一晚上了桌的，照单机写回房主那支小分队；客串的人和角色也掷，但只写进战绩卡那段话，不进任何队伍
  //   （客串的数值是这一晚现掷的，跟 Ta 主人那边哪支队都对不上，写过去就是凭空改人家的老卡）
  function growthOf(st, c) {
    const T = TS(); if (!T || !T.growthRolls) return { team: [], guests: [] };
    const recs = (c.msgs || []).filter(m => m.role === "roll" && m.who && m.statKey);
    const marks = (c.cards || []).flatMap(k => k.lit || []);
    const seated = st.members.filter(m => m.stats);
    const all = T.growthRolls(seated, recs, Math.random, marks);
    const guestNames = seated.filter(m => m.guest).map(m => m.name);
    return { team: all.filter(g => guestNames.indexOf(g.name) < 0), guests: all.filter(g => guestNames.indexOf(g.name) >= 0), home: seated.filter(m => !m.guest) };
  }
  const growZh = g => g.name + "的" + STAT_ZH[g.stat] + (g.to > g.from ? g.from + "→" + g.to : "没长(d100=" + g.roll + ")");
  // 落幕：终章那一枪（单机那一份 epilogueAsk），秘典跟着揭开
  async function finale(st, inv, ctx, mv) {
    const T = TS(); if (!T || !T.epilogueAsk) return { err: "跑团没装上" };
    if (!ctx.hostApi) return { err: "房主这台没配线下线路,写不了终章" };
    const c = Object.assign({ dossier: { truth: "", twist: "" } }, st.camp, { party: st.members.map(m => Object.assign({}, m)) });
    const { sys, user } = T.epilogueAsk(c, playersOf(st).join("、") || "各位玩家", !c.pendingEnd && (c.stageIdx || 0) < (c.stages || []).length, cut(mv.finalAct, 400));
    let p = null;
    try { p = T.parseObj(await root.callAI(ctx.hostApi, sys, [{ role: "user", content: user }], { maxTokens: T.TOK_MAX, timeout: 300000 })); } catch (e) { p = null; }
    if (!p || !Array.isArray(p.paras) || !p.paras.length) return { st: Object.assign({}, st, { busy: false, err: "终章没写出来,再点一次" }) };
    const gr = growthOf(st, c);
    const n = Object.assign({}, st, { camp: Object.assign({}, c, { ended: true, pendingEnd: false, epilogue: T.epilogueRec(p, gr.team) }), guestGrowth: gr.guests, phase: "done", busy: false, err: "" });
    // 先把团记成落幕、再写小分队：中途断了，接回来看见团已落幕就不再重写一遍终章，小分队的出团次数不会多记一次
    writeBack(n);
    if (T.squadWriteBack && gr.home.length) T.squadWriteBack(c, gr.home, gr.team);
    return { st: n };
  }

  // 角色那一座的台面：主人那台按 TA 的人设定——请不请人搭手、接不接魔鬼交易、失手了花不花命运点；被请去协力的照 TA 的性子答
  async function ckCharMove(view, i, ctx) {
    const pv = ctx.priv || {}, me = (view.party[i] || {}).name || "", vk = view.ck || {};
    if (vk.stage === "ask") return { ck: "assist", ok: vk.ask === i && (view.party[i] || {}).hp > 0 };
    const dflt = vk.stage === "fate" ? { ck: "fate", use: "no" } : { ck: "roll", assist: -1, bargain: false };
    // 那份 priv 还没跟上这一张台面：按不花资源的默认交，不让桌子卡住
    const q = pv.ckAsk; if (!q || q.n !== vk.n || q.stage !== vk.stage) return dflt;
    if (!ctx.api || !ctx.char) return dflt;
    const k = view.ck && view.ck.c;
    const sys = ["你是「" + me + "」,正在一场文字跑团里,轮到你掷一次「" + q.statZh + "」检定。按你自己的性子拿主意,只输出 JSON。",
      "【你是谁(人设)】\n" + cut(ctx.char.persona || ctx.char.name, 6000),
      q.stage === "fate"
        ? "【眼下】骰子落定:" + (k && k.grade ? k.grade.zh : "失败") + "。你手上还有 " + q.fate + " 枚命运点。重掷(花1枚,新结果必须认)" + (q.tier === "fumble" ? "、把大失败当失败论(花1枚)" : "") + ",或者认了。\n输出:{\"use\":\"reroll|" + (q.tier === "fumble" ? "soften|" : "") + "no\"}"
        : "【眼下】" + (q.feat ? "你的专长「" + q.feat + "」用得上(+15,自动算)。" : "") + (q.mates.length ? "可以请人搭手(+10,对方要共担后果):" + q.mates.map(x => x.name).join("、") + "。" : "") + (q.bargain ? "守密人开了魔鬼交易:+15,代价无论成败都兑现——" + q.bargain + "。" : "")
          + "\n输出:{\"assist\":\"要请的人名,不请就空\",\"bargain\":true或false}"].join("\n\n");
    let p = null;
    try { const raw = await root.callAI(ctx.api, sys, [{ role: "user", content: "拿主意吧。" }], { maxTokens: 12000, timeout: 120000 }); p = typeof parseJSONLoose === "function" ? parseJSONLoose(raw) : JSON.parse(raw); } catch (e) { p = null; }
    if (!p || typeof p !== "object") return dflt;
    if (q.stage === "fate") return { ck: "fate", use: ["reroll", "soften"].indexOf(p.use) >= 0 ? p.use : "no" };
    const mt = q.mates.find(x => x.name && String(p.assist || "").trim() && (x.name === String(p.assist).trim() || String(p.assist).indexOf(x.name) >= 0));
    return { ck: "roll", assist: mt ? mt.seat : -1, bargain: p.bargain === true };
  }
  // 这一晚的客串（别人自己上桌、别人带来的角色、房主带来的临时队员）各做了什么
  const guestsOf = st => st.members.map((m, i) => m.guest ? { name: cut(m.name, 16), kind: st.seatKinds[i], did: ((st.diary || {})[i] || []).map(x => cut(x, 70)) } : null).filter(Boolean);
  const A = {
    zh: "跑团", hostRoute: "offline",
    charOpts: ["recent"],
    seatRange: () => ({ min: 1, max: 5 }),
    // 最后一个人交完、房主点「不等了」或「继续这一拍」：那一下要等守密人，先亮「守密人在写」
    slow(st, seat, mv) {
      if (!st || st.busy) return false;
      if (seat < 0) return !!(mv && (mv.op === "resolve" || mv.op === "retry" || mv.op === "finale" || (mv.op === "go" && st.phase === "check" && !(st.cks || []).length)));
      if (st.phase !== "act" || st.acts[seat]) return false;
      // 这一拍有人挑了要过检定的路：先开台面，不先亮「守密人在写」
      const ckPick = a => { const ch = a && int(a.pick, -1, 3, -1) >= 0 ? (st.camp.choices || [])[int(a.pick, -1, 3, -1)] : null; return !!(ch && ch.check); };
      if (ckPick(mv) || Object.keys(st.acts).some(k => st.acts[k].kind === "pick" && ckPick(st.acts[k]))) return false;
      return pendingOf(st).filter(i => i !== seat).length === 0;
    },
    async init(inv, ctx) {
      await ensure(); const T = TS();
      if (!T) throw new Error("跑团没装上");
      const pz = ctx.prep || {}, camp = (T.loadCamps() || []).find(c => c.id === pz.campId);
      if (!camp) throw new Error("房主这台找不到要开的那个团了（删掉了？）");
      if (camp.ended) throw new Error("这个团已经落幕了，换一个还在演的");
      const members = seatParty(camp, inv);
      const tm = TIMEOUTS.indexOf(Number(pz.timeout)) >= 0 ? Number(pz.timeout) : 3;
      return { camp: clone(camp), members, seatKinds: inv.seats.map(s => s.kind), phase: members.some(m => !m.stats) ? "roll" : "act",
        acts: {}, beat: 0, busy: false, err: "", whisper: {}, truth: {}, diary: {}, autoed: [], apartWho: [], logFrom: Math.max(0, (camp.msgs || []).length - 6), pend: null,
        timeout: tm * MIN, actAt: Date.now() };
    },
    view, priv,
    // 庄那份和各台收到的 view 都认：view 里带着 done（谁交了）和 seatKinds
    turn(x) {
      if (x.members) return turnOf(x, x.seatKinds.map(k => ({ kind: k })));
      if (x.phase === "check") return !x.busy && x.ck && x.ck.stage !== "shown" ? (x.ck.stage === "ask" ? x.ck.ask : x.ck.seat) : -1;
      if (x.busy || (x.phase !== "roll" && x.phase !== "act")) return -1;
      const kinds = x.seatKinds || [], rank = i => kinds[i] === "char" ? 0 : kinds[i] === "npc" ? 1 : 2;
      const p = (x.done || []).map((d, i) => d ? -1 : i).filter(i => i >= 0);
      return p.length ? p.sort((a, b) => rank(a) - rank(b))[0] : -1;
    },
    waiting: v => v.phase === "check" ? [A.turn(v)].filter(i => i >= 0) : v.phase === "roll" || v.phase === "act" ? (v.done || []).map((d, i) => d ? -1 : i).filter(i => i >= 0) : [],
    // 角色队友、托管座位同时想：这一刻还没交的都给（真人那几座框架不替她们动）；同一拍同一座只想一次
    turns: x => x.phase === "check" ? [A.turn(x)].filter(i => i >= 0) : x.busy || (x.phase !== "roll" && x.phase !== "act") ? [] : (x.members ? pendingOf(x) : (x.done || []).map((d, i) => d ? -1 : i).filter(i => i >= 0)),
    roundOf: x => x.phase + ":" + x.beat + (x.phase === "check" && x.ck ? ":" + (x.members ? x.ckN : x.ck.n) + ":" + x.ck.stage : ""),
    // 真人一直不交：到点庄按「稳妥」那条替她交（掷数值那一步就替她掷），桌上写明是到点替交的
    onTick(st, now) {
      if (st && !st.busy && st.phase === "check" && st.ck) {
        // 最后一颗落定、大家看过了：接着请守密人（或开下一位的台面）
        if (st.ck.stage === "shown") return now - st.ck.at >= CK_SHOW ? [{ seat: -1, mv: { op: "go" } }] : [];
        const w = ckWho(st);
        return st.timeout > 0 && now - st.ck.at >= st.timeout && w >= 0 && st.seatKinds[w] !== "npc" ? [{ seat: w, mv: ckDefault(st) }] : [];
      }
      if (!st || st.busy || !(st.timeout > 0) || !st.actAt || now - st.actAt < st.timeout || (st.phase !== "act" && st.phase !== "roll")) return [];
      const T = TS(); if (!T) return [];
      return pendingOf(st).filter(i => st.seatKinds[i] === "user").map(i => ({ seat: i, mv: st.phase === "roll" ? { stats: T.rollStats(), auto: true } : (k => k >= 0 ? { pick: k, auto: true } : { pass: true, auto: true })(safePick(st.camp)) }));
    },
    recordMax: 900,
    // 开局的人重进房间、从存档接回这一团：团本来就一拍一拍写回房主的团（writeBack 是整份换上，不是追加），
    //   断的那一刻正在等守密人的那一拍重新请一次，不会多落一份账；只有终章已经写进团里（落幕了）的，不再重写终章
    async restore(st, inflight) {
      await ensure(); const T = TS(), c = T && T.loadCamps ? (T.loadCamps() || []).find(x => x && st.camp && x.id === st.camp.id) : null;
      if (c && c.ended && !st.camp.ended) return { st: Object.assign({}, st, { camp: c, phase: "done", busy: false, err: "" }), inflight: null };
      return { st, inflight };
    },
    async apply(st, seatIdx, mv, ctx) {
      const inv = ctx.inv;
      if (st.phase === "done") return { err: "这一团今晚已经收桌了" };
      mv = mv || {};
      if (seatIdx < 0) {
        if (mv.op === "stop") { writeBack(st); return { st: Object.assign({}, st, { phase: "done", stopped: true, busy: false }) }; }
        if (mv.op === "retry" && st.phase === "stuck") return { st: await resolve(st, inv, ctx) };
        if (mv.op === "resolve" && st.phase === "act") { const q = ckQueue(st); return { st: q.length ? ckOpen(st, q) : await resolve(st, inv, ctx) }; }   // 不等了：没交的人这一拍跟着大家
        // 房主「不等了」：台面上那一位按不花资源的默认交
        if (mv.op === "ckskip" && st.phase === "check" && ckWho(st) >= 0) return ckMove(st, ckWho(st), ckDefault(st), inv);
        if (mv.op === "go" && st.phase === "check" && st.ck && st.ck.stage === "shown") {
          if ((st.cks || []).length) return { st: ckOpen(st, st.cks) };
          return { st: st.ck.src === "need" ? await afterNeed(st, inv, ctx) : await resolve(st, inv, ctx) };
        }
        // 房主翻章：这一章记完成，场终结算卡进史（单机那一份 stageAdvance）；「还没有」写一条幕后回执
        if (mv.op === "stage" && st.phase === "act" && st.camp.pendingStage) {
          const T = TS(), c0 = Object.assign({}, st.camp, { party: st.members.map(m => Object.assign({}, m)) });
          const c = mv.ok ? T.stageAdvance(c0) : Object.assign({}, c0, { pendingStage: false, msgs: c0.msgs.concat([{ id: T.rid("rm_"), role: "sys", content: "房主判定:本章目标还没有真实达成,继续演;没有新的实质进展前不要再报 stageDone", ts: Date.now() }]) });
          const n = Object.assign({}, st, { camp: c, members: c.party });
          writeBack(n);
          return { st: n };
        }
        if (mv.op === "finale" && st.phase === "act") return await finale(st, inv, ctx, mv);
        return { err: "现在不用这一下" };
      }
      if (st.phase === "roll") {
        if (st.members[seatIdx].stats) return { err: "这一位的数值已经掷过了" };
        const s = cleanStats(mv.stats); if (!s) return { err: "数值不对" };
        const members = st.members.map((m, i) => i === seatIdx ? Object.assign({}, m, { stats: s, fate: TS().fateOf(s.luck) }) : m);
        const go = !members.some(m => !m.stats);
        return { st: Object.assign({}, st, { members, phase: go ? "act" : "roll", busy: false, actAt: go ? Date.now() : st.actAt }) };
      }
      if (st.phase === "check") return ckMove(st, seatIdx, mv, inv);
      if (st.phase !== "act") return { err: "守密人还在写，等这一拍写完" };
      if (st.acts[seatIdx]) return mv.auto ? { st } : { err: "这一拍你已经交过了" };
      const isHost = !!(inv && inv.seats[seatIdx] && inv.seats[seatIdx].peer === inv.host);
      const a = takeAct(st, seatIdx, mv, isHost); if (!a) return { err: "挑一条路，或者写一句你做什么（找人说话要写上说什么）" };
      const n = Object.assign({}, st, { acts: Object.assign({}, st.acts, { [seatIdx]: a }), busy: false });
      if (pendingOf(n).length) return { st: n };
      const q = ckQueue(n);
      return { st: q.length ? ckOpen(n, q) : await resolve(n, inv, ctx) };
    },
    // 角色队友：带 TA 来的那台，TA 自己的线路和人设；只看公开那一份局面和 TA 自己的私念
    async charMove(view, i, inv, ctx) {
      await ensure(); const T = TS(); if (!T) return { pass: true };
      if (view.phase === "roll") return { stats: T.personaNudge(T.rollStats(), (ctx.char && ctx.char.persona) || "") };
      if (view.phase === "check") return ckCharMove(view, i, ctx);
      if (!ctx.api || !ctx.char) return { pass: true };
      const me = view.party[i] || { name: nm(inv, i) };
      const c = { world: view.world, place: view.place, party: view.party.map(m => ({ key: m.name === me.name ? "self" : "x", name: m.name, hp: m.hp, maxHp: m.maxHp, stats: m.stats || {} })) };
      const mate = ctx.priv && ctx.priv.mate;
      const sys = [T.seatDeclareSys(c, me.name),
        "【你是谁(人设)】\n" + cut(ctx.char.persona || ctx.char.name, 6000),
        mate ? "【你心里揣着的(只有你自己知道)】想要:" + mate.want + ";最怕:" + mate.fear + ";底线:" + mate.line + ";会唱反调:" + mate.clash : "",
        "【眼下】" + (view.objective ? "这一幕:" + view.objective : "") + (view.stakes ? ";代价:" + view.stakes : "") + (view.choices.length ? "\n摆在面前的几条路:" + view.choices.map((x, k) => (k + 1) + "." + x.text).join(" ") : ""),
        ctx.opts && ctx.opts.recent && ctx.opts.recentText ? "【你平时说话的样子(只借口气,不引用里面的事)】\n" + cut(ctx.opts.recentText, 600) : ""].filter(Boolean).join("\n\n");
      const hist = T.foldHist((view.log || []).map(x => ({ role: x.role === "gm" ? "gm" : x.role === "user" ? "user" : "sys", content: x.text, who: x.who }))).slice(-16);
      if (!hist.length || hist[hist.length - 1].role !== "user") hist.push({ role: "user", content: "轮到你了。" });
      let p = null;
      try { const raw = await root.callAI(ctx.api, sys, hist, { maxTokens: 12000, timeout: 180000 }); p = typeof parseJSONLoose === "function" ? parseJSONLoose(raw) : JSON.parse(raw); } catch (e) { p = null; }
      return p && typeof p === "object" && (p.say || p.do || p.try) ? { decl: { say: p.say || "", do: p.do || "", try: p.try || "" } } : { pass: true };
    },
    // NPC／掉线托管：掷数值、这一拍跟着大家
    async npcMove(st) { await ensure(); return st.phase === "roll" ? { stats: TS().rollStats() } : st.phase === "check" ? ckDefault(st) : { pass: true }; },
    result(st, inv) {
      if (st.phase !== "done") return null;
      const c = st.camp, last = (c.msgs || []).filter(m => m.role === "gm").slice(-1)[0];
      const guests = guestsOf(st);
      return { winners: [], text: "「" + cut(c.title, 20) + "」这一晚跑了 " + st.beat + " 拍" + (c.ended ? ",落幕了。" : ",团还没完,存在房主那里,下次接着跑。") + (last ? "停在:" + cut(last.content, 60) : "")
          + (guests.length ? "\n客串:" + guests.map(g => g.name + "——" + g.did.slice(-5).join(";")).join("\n") : "")
          + (c.ended && ((c.epilogue || {}).growth || []).length ? "\n成长(写回房主的小分队):" + c.epilogue.growth.map(growZh).join("、") : "")
          + ((st.guestGrowth || []).length ? "\n客串这一晚的成长(只记在这里,不进谁的队伍):" + st.guestGrowth.map(growZh).join("、") : ""),
        replay: { title: cut(c.title, 30), log: publicLog(c, st.logFrom).slice(-40), guests, epi: c.epilogue ? { paras: (c.epilogue.paras || []).slice(0, 10), closing: c.epilogue.closing || "" } : null } };
    },
    cleanLog: a => (Array.isArray(a) ? a : []).slice(-40).map(x => ({ role: ["gm", "roll", "user", "sys", "apart", "letter"].indexOf(x && x.role) >= 0 ? x.role : "sys", text: cut(x && x.text, 3000), who: cut(x && x.who, 16) })),
    cleanReplay(r) {
      const arr = (a, n) => (Array.isArray(a) ? a : []).slice(0, n);
      return { title: cut(r.title, 30), log: this.cleanLog(r.log),
        guests: arr(r.guests, 5).map(g => ({ name: cut(g && g.name, 16), kind: ["user", "char", "npc"].indexOf(g && g.kind) >= 0 ? g.kind : "user", did: arr(g && g.did, 12).map(x => cut(x, 70)) })),
        epi: r.epi && typeof r.epi === "object" ? { paras: arr(r.epi.paras, 10).map(x => cut(x, 600)), closing: cut(r.epi.closing, 60) } : null };
    },
    cleanView(v) {
      const arr = (a, n) => (Array.isArray(a) ? a : []).slice(0, n);
      return { title: cut(v.title, 30), world: cut(v.world, 300), place: cut(v.place, 30), goal: cut(v.goal, 120), objective: cut(v.objective, 120), stakes: cut(v.stakes, 120),
        pace: v.pace && typeof v.pace === "object" ? { beat: int(v.pace.beat, 0, 9, 0), done: int(v.pace.done, 0, 9, 0), total: int(v.pace.total, 0, 9, 0), got: int(v.pace.got, 0, 20, 0), clues: int(v.pace.clues, 0, 20, 0) } : null,
        clocks: arr(v.clocks, 3).map(x => ({ name: cut(x && x.name, 16), filled: int(x && x.filled, 0, 12, 0), max: int(x && x.max, 1, 12, 4) })),
        clues: int(v.clues, 0, 999, 0), clueList: arr(v.clueList, 8).map(x => cut(x, 80)),
        choices: arr(v.choices, 4).map(x => ({ text: cut(x && x.text, 80), stat: x && STAT_ZH[x.stat] ? x.stat : "", who: cut(x && x.who, 16), risk: cut(x && x.risk, 36), payoff: cut(x && x.payoff, 36), cost: cut(x && x.cost, 36) })),
        ended: !!v.ended, phase: ["roll", "act", "check", "stuck", "done"].indexOf(v.phase) >= 0 ? v.phase : "act", beat: int(v.beat, 0, 9999, 0), busy: !!v.busy, err: cut(v.err, 200),
        party: arr(v.party, 5).map(m => ({ name: cut(m && m.name, 16), hp: int(m && m.hp, 0, 999, 100), maxHp: int(m && m.maxHp, 1, 999, 100), stats: cleanStats(m && m.stats), guest: !!(m && m.guest) })),
        done: arr(v.done, 5).map(Boolean), seatKinds: arr(v.seatKinds, 5).map(k => ["user", "char", "npc"].indexOf(k) >= 0 ? k : "user"), apart: arr(v.apart, 5).map(x => cut(x, 16)), log: this.cleanLog(v.log),
        time: cut(v.time, 12), pov: cut(v.pov, 16), canEnd: !!v.canEnd,
        side: arr(v.side, 14).map(x => ({ kind: ["talk", "look", "site", "search", "go", "rest", "pov", "night"].indexOf(x && x.kind) >= 0 ? x.kind : "rest", arg: cut(x && x.arg, 30), label: cut(x && x.label, 40) })),
        epi: v.epi && typeof v.epi === "object" ? { paras: arr(v.epi.paras, 10).map(x => cut(x, 600)), closing: cut(v.epi.closing, 60), untold: arr(v.epi.untold, 6).map(x => cut(x, 160)), truth: cut(v.epi.truth, 400), twist: cut(v.epi.twist, 300),
          apart: arr(v.epi.apart, 5).map(x => ({ who: cut(x && x.who, 16), text: cut(x && x.text, 400) })) } : null,
        deadline: int(v.deadline, 0, 9e15, 0), timeoutMin: int(v.timeoutMin, 0, 60, 0), autoed: arr(v.autoed, 5).map(x => cut(x, 16)),
        fate: arr(v.fate, 5).map(x => int(x, 0, 9, 0)), pendingStage: cut(v.pendingStage, 80), growth: arr(v.growth, 12).map(x => cut(x, 40)),
        ck: v.ck && typeof v.ck === "object" ? { n: int(v.ck.n, 0, 1e6, 0), seat: int(v.ck.seat, 0, 4, 0), ask: int(v.ck.ask, -1, 4, -1), stage: ["pre", "ask", "fate", "shown"].indexOf(v.ck.stage) >= 0 ? v.ck.stage : "pre", rolledAt: int(v.ck.rolledAt, 0, 9e15, 0), c: ckPublic(v.ck.c) } : null };
    },
    stateText(v, i, inv, pv) {
      const who = (v.party || []).map((m, k) => m.name + "(HP" + m.hp + "/" + m.maxHp + ((v.apart || []).indexOf(m.name) >= 0 ? ",单独走开了" : "") + ")").join("、");
      const clocks = (v.clocks || []).map(x => "「" + x.name + "」" + x.filled + "/" + x.max).join(" ");
      const wait = (v.done || []).map((d, k) => d ? "" : nm(inv, k)).filter(Boolean);
      const last = (v.log || []).filter(x => x.role === "gm").slice(-1)[0];
      return "跑团「" + v.title + "」第 " + (v.beat + 1) + " 拍,在「" + v.place + "」" + (v.time ? "(" + v.time + ")" : "") + "。" + (v.goal ? "这一章要办成:" + v.goal + "。" : "") + (v.objective ? "眼下:" + v.objective + "。" : "")
        + "\n队伍:" + who + "。线索 " + v.clues + " 条" + (v.pace ? ",这一场第 " + v.pace.beat + "/" + v.pace.total + " 拍" : "") + (clocks ? ",钟:" + clocks : "") + "。"
        + (last ? "\n守密人刚写到:" + cut(last.text, 200) : "")
        + (v.phase === "act" && wait.length ? "\n还没交这一拍的:" + wait.join("、") + "。" : v.phase === "done" ? "\n今晚收桌了。" : "")
        + (pv && pv.mate ? "\n(只你知道)你心里揣着的:想要" + pv.mate.want + ",最怕" + pv.mate.fear + "。" : "");
    }
  };
  C.ADAPTERS.trpg = A;
  A.shelf = { key: "trpg", zh: "跑团", en: "TRPG", min: 1, max: 5, rule: "开团的人当庄 · 最多 5 人上桌" };
  A._test = { seatParty, pendingOf, turnOf, takeAct, publicLog };

  // ───────────── 界面 ─────────────
  if (typeof React === "undefined") return;
  const h = React.createElement;
  const { useState, useEffect } = React;
  const fs = px => "calc(" + px + "px * var(--app-fs, 1))";
  const pill = (t, on) => ({ minHeight: 40, padding: "0 16px", borderRadius: 999, border: "1px solid " + (on ? t.ink : t.line), background: on ? t.ink : t.bg2, color: on ? t.bg : t.ink, fontFamily: F_BODY, fontSize: fs(13) });
  const box = t => ({ width: "100%", resize: "none", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, padding: "9px 12px", fontFamily: F_BODY, fontSize: fs(14) });
  const fit = e => { if (typeof fitTextarea === "function") fitTextarea(e.target, 160); };
  const small = t => ({ fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, lineHeight: 1.6 });

  function Log({ t, log }) {
    return h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, (log || []).map((x, i) => h("div", { key: i, "data-wk": "nrtrpgline", "data-role": x.role,
      style: x.role === "gm" ? { fontFamily: F_BODY, fontSize: fs(14), color: t.ink, lineHeight: 1.75, whiteSpace: "pre-wrap" }
        : x.role === "apart" ? { border: "1px dashed " + t.line, borderRadius: 10, padding: "6px 10px", fontFamily: F_BODY, fontSize: fs(13), color: t.ink, lineHeight: 1.6 }
        : Object.assign(small(t), { whiteSpace: "pre-wrap" }) },
      x.role === "apart" ? "〔" + x.who + " 那一路回来说〕" + x.text : x.role === "letter" ? "〔" + x.who + " 捎来的信〕" + x.text : x.role === "sys" ? "✎ " + x.text : x.text)));
  }
  function Board({ t, v, inv, mine }) {
    const p = v.pace;
    return h("div", { "data-wk": "nrtrpgboard", style: { display: "flex", flexDirection: "column", gap: 6 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(15), color: t.ink } }, "「" + v.title + "」", h("span", { style: Object.assign(small(t), { marginLeft: 6 }) }, v.place + (v.time ? " · " + v.time : "") + " · 第 " + (v.beat + 1) + " 拍")),
      v.pov ? h("div", { style: small(t) }, "这一拍镜头在 " + v.pov + " 身上：下面几条是 TA 的选择，你们替 TA 拿主意") : null,
      v.goal ? h("div", { style: small(t) }, "这一章：" + v.goal + (p ? "　这一场 " + p.beat + "/" + p.total + " 拍 · 线索 " + p.got + "/" + p.clues : "")) : null,
      v.objective ? h("div", { style: small(t) }, "眼下：" + v.objective + (v.stakes ? "　代价：" + v.stakes : "")) : null,
      (v.clocks || []).length ? h("div", { "data-wk": "nrtrpgclocks", className: "flex flex-wrap", style: { gap: 6 } }, v.clocks.map((x, i) => h("span", { key: i, style: Object.assign(small(t), { border: "1px solid " + t.line, borderRadius: 999, padding: "0 8px" }) }, "⏰ " + x.name + " " + x.filled + "/" + x.max))) : null,
      h("div", { "data-wk": "nrtrpgparty", className: "flex flex-wrap", style: { gap: 6 } }, (v.party || []).map((m, i) => h("span", { key: i, "data-done": v.done[i] ? "1" : "0",
        style: Object.assign(small(t), { border: "1px solid " + (mine.indexOf(i) >= 0 ? t.ink : t.line), borderRadius: 10, padding: "2px 8px", color: t.ink }) },
        m.name + (inv.seats[i] && inv.seats[i].kind === "char" ? "（角色）" : "") + " HP" + m.hp + ((v.fate || [])[i] ? " ✦×" + v.fate[i] : "") + ((v.phase === "act" || v.phase === "roll") ? (v.done[i] ? " ✓" : " …") : "")))),
      v.clues ? h("div", { style: small(t) }, "线索 " + v.clues + " 条：" + (v.clueList || []).join("；")) : null);
  }
  const SIDE_ICON = { talk: "💬 ", look: "🔍 ", site: "◇ ", search: "🔍 ", go: "? ", rest: "🏕 ", pov: "👁 ", night: "🌙 " };
  function Act({ t, v, seat, isHost, onMove }) {
    const [pick, setPick] = useState(-1), [side, setSide] = useState(null), [say, setSay] = useState(""), [wh, setWh] = useState(""), [whOn, setWhOn] = useState(false), [apart, setApart] = useState(false), [dice, setDice] = useState(false);
    const reset = () => { setPick(-1); setSide(null); setSay(""); setWh(""); setWhOn(false); setApart(false); setDice(false); };
    const go = () => { onMove(seat, side ? { side: { kind: side.kind, arg: side.arg }, say: say.trim(), whisper: whOn ? wh.trim() : "", dice } : { pick, say: say.trim(), whisper: whOn ? wh.trim() : "", apart, dice }); reset(); };
    const ready = side ? (side.kind !== "talk" || !!say.trim()) : (pick >= 0 || !!say.trim());
    const sideOn = x => side && side.kind === x.kind && side.arg === x.arg;
    return h("div", { "data-wk": "nrtrpgact", style: { display: "flex", flexDirection: "column", gap: 8 } },
      v.choices.map((c, k) => h("button", { key: k, "data-wk": "nrtrpgchoice", onClick: () => { setSide(null); setPick(pick === k ? -1 : k); },
        style: { textAlign: "left", borderRadius: 12, border: "1px solid " + (pick === k ? t.ink : t.line), background: pick === k ? t.bg : t.bg2, color: t.ink, padding: "8px 12px", fontFamily: F_BODY, fontSize: fs(13.5) } },
        c.text, h("div", { style: small(t) }, [c.safe ? "稳妥" : "", c.stat ? "要过「" + STAT_ZH[c.stat] + "」检定" + (c.who ? "（" + c.who + "）" : "") : "", c.payoff ? "换来：" + c.payoff : "", c.risk ? "风险：" + c.risk : "", c.cost ? "代价：" + c.cost : ""].filter(Boolean).join("　")))),
      (v.side || []).length ? h("div", { style: small(t) }, "别的能做的事（挑的人比挑上面那几条的多，这一拍就整桌一起做它；不然只算你自己的——找人说话就是私下说，回话只有你看得到）") : null,
      (v.side || []).length ? h("div", { "data-wk": "nrtrpgside", className: "flex flex-wrap", style: { gap: 6 } }, v.side.map((x, k) => h("button", { key: k, "data-wk": "nrtrpgsidebtn", "data-kind": x.kind, onClick: () => { setPick(-1); setApart(false); setSide(sideOn(x) ? null : x); },
        style: Object.assign(pill(t, sideOn(x)), { minHeight: 32, padding: "0 12px" }) }, (SIDE_ICON[x.kind] || "") + x.label))) : null,
      h("textarea", { "data-wk": "nrtrpginput", value: say, rows: 2, onChange: e => { setSay(e.target.value.slice(0, 400)); fit(e); }, placeholder: side ? (side.kind === "talk" ? "对 " + side.arg + " 说什么" : "补一句（可空）") : pick >= 0 ? "补一句怎么做（可空）" : "或者自己写：你做什么、说什么", style: box(t) }),
      h("div", { className: "flex flex-wrap", style: { gap: 6 } },
        h("button", { "data-wk": "nrtrpgwhisper", onClick: () => setWhOn(!whOn), style: Object.assign(pill(t, whOn), { minHeight: 32, padding: "0 12px" }) }, "咬耳朵"),
        !side && h("button", { "data-wk": "nrtrpgapart", onClick: () => setApart(!apart), style: Object.assign(pill(t, apart), { minHeight: 32, padding: "0 12px" }) }, "单独走开"),
        isHost && h("button", { "data-wk": "nrtrpgdice", onClick: () => setDice(!dice), style: Object.assign(pill(t, dice), { minHeight: 32, padding: "0 12px" }) }, "剧情骰")),
      whOn && h("textarea", { "data-wk": "nrtrpgwhisperin", value: wh, rows: 2, onChange: e => { setWh(e.target.value.slice(0, 200)); fit(e); }, placeholder: "只有守密人看得到；TA 要回也只回你", style: box(t) }),
      apart && h("div", { style: small(t) }, "这一拍你离开大家去办你写的那件事；那边真正发生了什么只有你看得到，大家只听到你回来怎么说。"),
      dice && h("div", { style: small(t) }, "这一拍守密人要放进一件意外（剧本里写了事件的先从那里抽）。"),
      h("button", { "data-wk": "nrtrpgsend", disabled: !ready, onClick: go, style: pill(t, true) }, "交这一拍"));
  }
  // 落幕那一页：终章、秘典揭开、各路真相
  function Epi({ t, e, growth }) {
    return h("div", { "data-wk": "nrtrpgepi", style: { display: "flex", flexDirection: "column", gap: 8 } },
      (growth || []).length ? h("div", { "data-wk": "nrtrpggrowth", style: small(t) }, "成长骰（房主队里的写回那支小分队；客串的只记在这一晚）：" + growth.join("、")) : null,
      (e.paras || []).map((x, i) => h("div", { key: i, style: { fontFamily: F_BODY, fontSize: fs(14), color: t.ink, lineHeight: 1.75 } }, x)),
      e.closing ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(14.5), color: t.ink, textAlign: "center" } }, e.closing) : null,
      e.truth || e.twist || (e.untold || []).length || (e.apart || []).length ? h("div", { "data-wk": "nrtrpgsecret", style: { border: "1px dashed " + t.line, borderRadius: 12, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(13.5), color: t.ink } }, "秘典揭开"),
        e.truth ? h("div", { style: small(t) }, "真相：" + e.truth) : null,
        e.twist ? h("div", { style: small(t) }, "翻转：" + e.twist) : null,
        (e.untold || []).length ? h("div", { style: small(t) }, "到最后也没揭开的：" + e.untold.join("；")) : null,
        (e.apart || []).map((x, i) => h("div", { key: i, style: small(t) }, x.who + " 那一路其实是：" + x.text))) : null);
  }
  // 房主的「写终章」：章都走完了（或守密人说到了能落幕的地方）才亮在明处；别的时候收在「提前收团」里
  function EndBtn({ t, v, onMove }) {
    const [open, setOpen] = useState(false), [fa, setFa] = useState("");
    if (!open) return h("button", { "data-wk": "nrtrpgend", onClick: () => setOpen(true), style: Object.assign(pill(t, v.canEnd), { alignSelf: "flex-start" }) }, v.canEnd ? "写终章落幕" : "提前收团（写终章）");
    return h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
      h("div", { style: small(t) }, "守密人会就此写终章，秘典跟着揭开，这个团就落幕了（单机里也是落幕的）。"),
      h("textarea", { "data-wk": "nrtrpgfinal", value: fa, rows: 2, onChange: e => { setFa(e.target.value.slice(0, 400)); fit(e); }, placeholder: "最后，你们做什么（可空；空着就只写画面，不替谁做决定）", style: box(t) }),
      h("div", { className: "flex", style: { gap: 6 } },
        h("button", { "data-wk": "nrtrpgendok", onClick: () => { onMove(-1, { op: "finale", finalAct: fa.trim() }); setOpen(false); }, style: pill(t, true) }, "写终章"),
        h("button", { onClick: () => setOpen(false), style: pill(t, false) }, "先不")));
  }
  // 检定台面：单机那一层浮层（TrpgShared.ceremonyPanel），掷骰的那位在自己这台挑协力、交易、按「掷」，失手了决定花不花命运点；
  //   别的人看同一张台面滚（骰子落定那一刻各台各自滚一秒再亮，数字是庄那台掷的）
  function Ceremony({ t, v, pv, mine, onMove }) {
    const k = v.ck, T = TS();
    const [as, setAs] = useState(-1), [bg, setBg] = useState(false), [hide, setHide] = useState(false), [spin, setSpin] = useState(0);
    const key = k ? k.n + ":" + k.rolledAt : "";
    useEffect(() => { setAs(-1); setBg(false); setHide(false); }, [k && k.n]);
    useEffect(() => {
      if (!k || !k.rolledAt) return;
      const t0 = Date.now(); setSpin(1 + Math.floor(Math.random() * 100));
      const iv = setInterval(() => { if (Date.now() - t0 > 900) { clearInterval(iv); setSpin(0); } else setSpin(1 + Math.floor(Math.random() * 100)); }, 55);
      return () => clearInterval(iv);
    }, [key]);
    if (!k || !k.c || !T || !T.ceremonyPanel) return null;
    const mineSeat = mine.indexOf(k.seat) >= 0, q = pv && pv.ckAsk && pv.ckAsk.n === k.n ? pv.ckAsk : null;
    const asker = mineSeat && q && (k.stage === "pre" || k.stage === "fate");
    const mates = (q && q.mates) || [];
    const c = Object.assign({}, k.c, {
      phase: spin ? "rolling" : k.stage === "pre" || k.stage === "ask" ? "ready" : k.c.phase, roll: spin || k.c.roll,
      mates: asker && k.stage === "pre" ? mates.map(x => ({ key: "s" + x.seat, name: x.name })) : [],
      assist: asker && k.stage === "pre" ? (as >= 0 ? { key: "s" + as, name: (mates.find(x => x.seat === as) || {}).name || "" } : null) : k.c.assist,
      bargainOn: asker && k.stage === "pre" ? bg : k.c.bargainOn,
      bargainText: asker || k.c.bargainOn ? k.c.bargainText : null,
      vsRoll: spin ? null : k.c.vsRoll, opposed: spin ? null : k.c.opposed, harmRoll: spin ? null : k.c.harmRoll, offer: !spin && k.c.offer
    });
    if (hide && !asker) return h("button", { "data-wk": "nrtrpgckpeek", onClick: () => setHide(false), style: Object.assign(pill(t, false), { alignSelf: "center", minHeight: 32 }) }, "🎲 " + c.who + " · " + c.statZh + "检定 · 点开看");
    const who = i => ((v.party || [])[i] || {}).name || "";
    const note = k.stage === "ask" ? "在等 " + who(k.ask) + " 回话：搭不搭这把手" : k.stage === "shown" ? (k.c.declined ? k.c.declined + " 没搭手。" : "") + "骰子落定，守密人接着写"
      : !asker ? "这一下是 " + c.who + " 的，Ta 在自己那台拿主意" + (k.stage === "fate" ? "（花不花命运点）" : "") : k.stage === "pre" && k.c.feat ? "专长「" + k.c.feat + "」对得上，+15 已经算上了" : "";
    return T.ceremonyPanel(c, {
      lock: !asker || !!spin, note, close: asker ? null : () => setHide(true),
      roll: () => onMove(k.seat, { ck: "roll", assist: as, bargain: bg }),
      assist: mt => { const sIdx = Number(String(mt.key).slice(1)); setAs(as === sIdx ? -1 : sIdx); },
      bargain: () => setBg(!bg),
      reroll: () => onMove(k.seat, { ck: "fate", use: "reroll" }), soften: () => onMove(k.seat, { ck: "fate", use: "soften" }), accept: () => onMove(k.seat, { ck: "fate", use: "no" })
    });
  }
  // 被请去协力的那一位：一句话、两个按钮
  function HelpAsk({ t, v, pv, mine, onMove }) {
    const k = v.ck, q = pv && pv.ckHelp;
    if (!k || k.stage !== "ask" || !q || q.n !== k.n || mine.indexOf(k.ask) < 0) return null;
    return h("div", { "data-wk": "nrtrpghelp", style: { position: "fixed", left: 16, right: 16, bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)", zIndex: 170, borderRadius: 14, border: "1px solid " + t.line, background: t.bg2, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(13.5), color: t.ink } }, q.who + " 要过「" + q.statZh + "」检定，请你搭把手：Ta 的目标 +10，可这一下的后果你也要一起担（大失败会连累你）。"),
      h("div", { className: "flex", style: { gap: 8 } },
        h("button", { "data-wk": "nrtrpghelpok", onClick: () => onMove(k.ask, { ck: "assist", ok: true }), style: pill(t, true) }, "搭手"),
        h("button", { "data-wk": "nrtrpghelpno", onClick: () => onMove(k.ask, { ck: "assist", ok: false }), style: pill(t, false) }, "这次不了")));
  }
  function TrpgTable({ inv, view: v, priv: pv, me, isHost, onMove }) {
    const t = useTheme();
    const mine = inv.seats.map((s, i) => C.actorOf(s, me, inv.host) === "mine-user" ? i : -1).filter(i => i >= 0);
    const myPend = mine.filter(i => !v.done[i]);
    const [rolled, setRolled] = useState(null);
    const wait = v.done.map((d, i) => d ? "" : (v.party[i] || {}).name).filter(Boolean);
    const status = v.busy ? "守密人在写这一拍…" : v.phase === "done" ? "今晚收桌了" : v.phase === "check" && v.ck ? (v.party[v.ck.seat] || {}).name + " 在过「" + (v.ck.c ? v.ck.c.statZh : "") + "」检定" : v.phase === "stuck" ? (v.err || "这一拍卡住了") : v.phase === "roll" ? "上桌前先掷数值" + (wait.length ? "，还在等：" + wait.join("、") : "")
      : myPend.length ? "轮到大家交这一拍" + (wait.length > myPend.length ? "（还在等：" + wait.join("、") + "）" : "") : wait.length ? "你交了，还在等：" + wait.join("、") : "";
    const T = TS();
    return h("div", { "data-wk": "nrgametable", "data-game": "trpg", style: { padding: "8px 16px 10px", display: "flex", flexDirection: "column", gap: 10 } },
      h(Board, { t, v, inv, mine }),
      h(Log, { t, log: v.log }),
      pv && pv.truth ? h("div", { "data-wk": "nrtrpgtruth", style: Object.assign(small(t), { color: t.ink }) }, "（只你看得到）你那一路真正发生的：" + pv.truth.slice(-1)[0]) : null,
      pv && pv.whisper ? h("div", { "data-wk": "nrtrpgwhisperback", style: Object.assign(small(t), { color: t.ink }) }, "（守密人只跟你说）" + pv.whisper.slice(-1)[0]) : null,
      pv && pv.mate ? h("div", { "data-wk": "nrtrpgmate", style: small(t) }, "（只你看得到）你带来的这位心里揣着：想要" + pv.mate.want + "；最怕" + pv.mate.fear) : null,
      h("div", { "data-wk": "nrgamestatus", style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: fs(14.5), color: t.ink } }, status),
      v.phase === "roll" && !v.busy && myPend.map(i => h("div", { key: i, className: "flex items-center", style: { gap: 8, flexWrap: "wrap" } },
        h("span", { style: small(t) }, (v.party[i] || {}).name + "：" + (rolled && rolled.i === i ? Object.keys(STAT_ZH).map(k => STAT_ZH[k] + rolled.s[k]).join(" ") : "单机组队那一套，3d6×5")),
        rolled && rolled.i === i ? h("button", { "data-wk": "nrtrpgstatsend", onClick: () => { onMove(i, { stats: rolled.s }); setRolled(null); }, style: pill(t, true) }, "就这样上桌")
          : h("button", { "data-wk": "nrtrpgroll", disabled: !T, onClick: () => setRolled({ i, s: T.rollStats() }), style: pill(t, false) }, "掷五项"))),
      v.phase === "act" && !v.busy && v.deadline && wait.length ? h("div", { "data-wk": "nrtrpgdeadline", style: Object.assign(small(t), { textAlign: "center" }) }, "这一拍 " + v.timeoutMin + " 分钟内没交的，庄按「稳妥」那条替她交（桌上会写明）") : null,
      (v.autoed || []).length ? h("div", { style: Object.assign(small(t), { textAlign: "center" }) }, "上一拍到点替交的：" + v.autoed.join("、")) : null,
      v.phase === "act" && !v.busy && myPend.slice(0, 1).map(i => h(Act, { key: i, t, v, seat: i, isHost, onMove })),
      v.phase === "check" && !v.busy ? h(Ceremony, { t, v, pv, mine, onMove }) : null,
      v.phase === "check" && !v.busy ? h(HelpAsk, { t, v, pv, mine, onMove }) : null,
      isHost && v.phase === "check" && !v.busy && v.ck && v.ck.stage !== "shown" ? h("button", { "data-wk": "nrtrpgckskip", onClick: () => onMove(-1, { op: "ckskip" }), style: Object.assign(pill(t, false), { alignSelf: "flex-start", position: "relative", zIndex: 171 }) }, "不等了，这一下按不花资源的默认掷") : null,
      isHost && v.phase === "act" && !v.busy && v.pendingStage ? h("div", { "data-wk": "nrtrpgstage", style: { border: "1px solid " + t.ink, borderRadius: 12, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 } },
        h("div", { style: small(t) }, "这一章可能到落点了：" + v.goal + "（" + v.pendingStage + "）。翻过去会出一张这一章的结算卡（得到、失去、关系变化、下一章的钩子），进桌上和你的团里。"),
        h("div", { className: "flex", style: { gap: 6 } },
          h("button", { "data-wk": "nrtrpgstageok", onClick: () => onMove(-1, { op: "stage", ok: true }), style: pill(t, true) }, "翻过这一章"),
          h("button", { onClick: () => onMove(-1, { op: "stage", ok: false }), style: pill(t, false) }, "还没有"))) : null,
      v.epi ? h(Epi, { t, e: v.epi, growth: v.growth }) : null,
      isHost && v.phase === "act" && !v.busy && h(EndBtn, { t, v, onMove }),
      isHost && v.phase === "act" && !v.busy && wait.length && h("button", { "data-wk": "nrtrpgnowait", onClick: () => onMove(-1, { op: "resolve" }), style: Object.assign(pill(t, false), { alignSelf: "flex-start" }) }, "不等了，先结算（没交的这一拍跟着大家）"),
      isHost && v.phase === "stuck" && !v.busy && h("button", { "data-wk": "nrtrpgretry", onClick: () => onMove(-1, { op: "retry" }), style: Object.assign(pill(t, true), { alignSelf: "flex-start" }) }, "继续这一拍"),
      isHost && v.phase !== "done" && !v.busy && h("button", { "data-wk": "nrtrpgstop", onClick: () => onMove(-1, { op: "stop" }), style: Object.assign(pill(t, false), { alignSelf: "flex-start" }) }, "今晚先到这儿（进度存在你的团里）"));
  }
  function TrpgReplay({ rec }) {
    const t = useTheme(), r = rec.replay || {};
    return h("div", { style: { padding: "8px 16px", display: "flex", flexDirection: "column", gap: 10 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(15), color: t.ink } }, "「" + (r.title || "") + "」"), h(Log, { t, log: r.log }),
      r.epi ? h(Epi, { t, e: r.epi }) : null,
      (r.guests || []).length ? h("div", { "data-wk": "nrtrpgguests", style: { display: "flex", flexDirection: "column", gap: 4 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(13.5), color: t.ink } }, "这一晚的客串"),
        r.guests.map((g, i) => h("div", { key: i, style: small(t) }, g.name + (g.kind === "char" ? "（角色）" : "") + "：" + (g.did.join("；") || "一直跟着大家")))) : null);
  }
  // 房主开局：挑自己的一个团（在单机跑团里开好的），自己上不上桌、带哪几位角色、给别人留几个座位
  function TrpgPrep({ myChars, nick, onSend }) {
    const t = useTheme();
    const [camps, setCamps] = useState(null);
    const [p, setP] = useState({ campId: "", me: true, chars: {}, open: 2, timeout: 3 });
    useEffect(() => { ensure().then(() => setCamps(TS() ? (TS().loadCamps() || []).filter(c => !c.ended) : [])); }, []);
    const set = o => setP(x => Object.assign({}, x, o));
    const camp = (camps || []).find(c => c.id === p.campId);
    const inParty = id => !!(camp && (camp.party || []).some(m => m.key === id));
    const label = s => h("div", { style: { fontFamily: F_BODY, fontSize: fs(12), color: t.fog, margin: "4px 0 2px" } }, s);
    const picks = (p.me ? [{ kind: "user" }] : []).concat((myChars || []).filter(c => p.chars[c.id]).map(c => ({ kind: "char", charId: c.id, name: c.remark || c.name })));
    const total = Math.min(5, picks.length + p.open);
    const personas = {}; (myChars || []).forEach(c => { if (p.chars[c.id] && inParty(c.id)) personas[c.id] = String(c.persona || c.name || "").slice(0, 6000); });
    return h("div", { "data-wk": "nrtrpgprep", style: { display: "flex", flexDirection: "column", gap: 8 } },
      h("div", { style: small(t) }, "你开团、你当庄：守密人用你的线下线路，骰子在你这台掷，每一拍都存回你挑的那个团——下次联机或者自己单机都能接着跑。别人在邀请卡上报名：自己上桌，和／或派带来的角色当队友（数值各自那台掷，人设留在各自手机）。"),
      label("开哪一个团"),
      camps == null ? h("div", { style: small(t) }, "在读你的团…")
        : !camps.length ? h("div", { style: small(t) }, "你还没有在演的团。先去「跑团」开一个（生成设定、导入剧本、收藏的世界都在那儿），开好了回来挑它。")
        : h("div", { "data-wk": "nrtrpgcamps", style: { display: "flex", flexDirection: "column", gap: 6 } }, camps.map(c => h("button", { key: c.id, onClick: () => set({ campId: c.id }),
          style: { textAlign: "left", borderRadius: 12, border: "1px solid " + (p.campId === c.id ? t.ink : t.line), background: t.bg2, color: t.ink, padding: "8px 12px", fontFamily: F_BODY, fontSize: fs(13.5) } },
          c.title || "无题", h("div", { style: small(t) }, (c.party || []).map(m => m.name).join("、") + " · " + (c.msgs || []).filter(m => m.role === "gm").length + " 拍")))),
      label("你自己"),
      h("div", { className: "flex", style: { gap: 6 } }, [[true, "我上桌"], [false, "我只当守密人那一边（不上桌）"]].map(([k, zh]) => h("button", { key: String(k), onClick: () => set({ me: k }), style: Object.assign(pill(t, p.me === k), { minHeight: 34, padding: "0 12px" }) }, zh))),
      (myChars || []).length ? label("你带来的角色（本来在这支队里的照队里的数值；不在队里的这一晚临时入队、开局现掷）") : null,
      (myChars || []).map(c => h("button", { key: c.id, "data-wk": "nrtrpgchar", onClick: () => set({ chars: Object.assign({}, p.chars, { [c.id]: !p.chars[c.id] }) }), style: Object.assign(pill(t, !!p.chars[c.id]), { alignSelf: "flex-start", minHeight: 34 }) },
        (c.remark || c.name) + (camp ? (inParty(c.id) ? " · 队里的" : " · 临时入队") : ""))),
      label("给别人留几个座位（整桌最多 5 人）"),
      h("div", { className: "flex", style: { gap: 6 } }, [0, 1, 2, 3, 4].map(n => h("button", { key: n, onClick: () => set({ open: n }), style: Object.assign(pill(t, p.open === n), { minHeight: 34, padding: "0 12px" }) }, String(n)))),
      label("这一拍几分钟没交，庄按「稳妥」那条替她交（掉线的照常由庄托管）"),
      h("div", { "data-wk": "nrtrpgtimeout", className: "flex", style: { gap: 6 } }, TIMEOUTS.map(n => h("button", { key: n, onClick: () => set({ timeout: n }), style: Object.assign(pill(t, p.timeout === n), { minHeight: 34, padding: "0 12px" }) }, n ? n + " 分钟" : "不替交"))),
      h("button", { "data-wk": "nrtrpggo", disabled: !camp || total < 1, onClick: () => onSend({ total: Math.max(1, total), mode: "normal", npcFill: false, picks }, { campId: p.campId, personas, timeout: p.timeout }), style: Object.assign(pill(t, true), { marginTop: 8 }) }, "发邀请卡"));
  }
  A.Table = TrpgTable; A.Replay = TrpgReplay; A.Prep = TrpgPrep;
})(typeof window !== "undefined" ? window : globalThis);
