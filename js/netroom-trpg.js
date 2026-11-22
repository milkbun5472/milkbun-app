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
  const nm = (inv, i) => ((inv.seats || [])[i] || {}).name || "TA";
  const clone = x => JSON.parse(JSON.stringify(x));
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
    : st.phase === "act" ? st.members.map((m, i) => st.acts[i] ? -1 : i).filter(i => i >= 0) : [];
  // 一位一位跟上的那一座：角色先（它们自己会动），再 NPC／托管，最后真人（真人在自己那台随时能交，不用等轮到）
  function turnOf(st, seats) {
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
      choices: (c.choices || []).slice(0, 4).map(x => ({ text: cut(x.text, 80), stat: x.check && STAT_ZH[x.check.stat] ? x.check.stat : "", who: cut(x.check && x.check.who, 16), risk: cut(x.risk, 36), payoff: cut(x.payoff, 36), cost: cut(x.cost, 36) })),
      ended: !!c.ended };
  }
  function view(st) {
    return Object.assign(tableOf(st), {
      phase: st.phase, beat: st.beat, seatKinds: st.seatKinds.slice(), busy: !!st.busy, err: cut(st.err, 200),
      party: st.members.map(m => ({ name: m.name, hp: int(m.hp, 0, 999, 100), maxHp: int(m.maxHp, 1, 999, 100), stats: m.stats ? Object.assign({}, m.stats) : null, guest: !!m.guest })),
      done: st.members.map((m, i) => st.phase === "roll" ? !!m.stats : !!st.acts[i]),
      apart: st.apartWho.slice(), log: publicLog(st.camp, st.logFrom)
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
    return Object.keys(o).length ? o : null;
  }

  // ── 收行动 ──
  function takeAct(st, i, mv) {
    if (mv.pass) return { kind: "pass" };
    if (mv.decl && typeof mv.decl === "object") return { kind: "decl", decl: { say: cut(mv.decl.say, 300), do: cut(mv.decl.do, 200), try: cut(mv.decl.try, 120) } };
    const pick = int(mv.pick, -1, 3, -1), text = cut(mv.say, 400).trim();
    if (pick < 0 && !text) return null;
    return { kind: pick >= 0 ? "pick" : "text", pick, text, whisper: cut(mv.whisper, 200).trim(), apart: !!mv.apart };
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

  // 守密人这一拍要多知道的几件事：几位真人、谁交了什么、谁咬了耳朵、谁单独走开
  function tableTail(st, inv, o) {
    const T = TS(), players = st.members.filter((m, i) => st.seatKinds[i] === "user").map(m => m.name);
    const lines = ["\n\n〔联桌〕这一桌有 " + (players.length || 0) + " 位真人玩家" + (players.length ? ":" + players.join("、") : "") + "。每位玩家的行动、台词和决定只由 Ta 本人交上来(见上一条〔这一拍大家的行动〕),你只写世界、NPC 和结果;队友的〔亲笔·〕行是那位队友本人交的,照亲笔纪律叙入。几个人同时在读:正文用名字称呼每位玩家;choices 是给全队的几条路,每位玩家会各挑各的。历史里的〔检定〕结果是铁的事实,照其等级叙事;状态变化必须写进字段。"];
    (o.whispers || []).forEach(w => lines.push("〔咬耳朵·来自" + w.from + "〕" + w.text + "——只有你和 Ta 知道:正文里别点破;要只回 Ta 一句,写进 whisper:[{\"to\":\"" + w.from + "\",\"text\":\"一两句\"}]。"));
    if (o.split && o.split.length) lines.push("〔分头行动〕" + o.split.join("、") + " 这一拍单独走开去办自己交上来的那件事,其余人留在原地。scene 只写留下的那一路;走开那一路写进 apart 字段——truth 是 Ta 们那边真正发生了什么(3-5句),report 是 Ta 们回来以后对大家的说法(可以和 truth 不一样),who 写走开的人名。");
    if (o.resolve) lines.push("〔续写检定结果〕上面最新的〔检定〕就是刚才那个动作的命运:按其等级把结果写完,接着往下走;这个动作不再需要检定,绝不再报 needCheck。");
    const camp = st.camp;
    lines.push(T.paceTurnLines(camp, { burst: o.burst, pressure: o.pressure, away: false, explore: false, hasMap: !!(camp.mapRegions && T.nodesOfCamp(camp).length) }));
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

  // 结算：掷骰（只在这台）→ 拼这一拍的史 → 守密人一枪 → 单机那一份落账（钟、进度表、压力拍、爆发拍都在里面）→ 写回房主的团
  async function resolve(st, inv, ctx) {
    const T = TS(); if (!T) return Object.assign({}, st, { busy: false, err: "跑团没装上,这一拍结算不了" });
    if (!ctx.hostApi) return Object.assign({}, st, { busy: false, phase: "stuck", err: "房主这台没配线下线路,守密人写不了这一拍" });
    let camp = Object.assign({}, st.camp, { party: st.members.map(m => Object.assign({}, m)), msgs: (st.camp.msgs || []).slice() });
    const n = Object.assign({}, st, { whisper: Object.assign({}, st.whisper), truth: Object.assign({}, st.truth), err: "" });
    let whispers = [], split = [], typed = false, tryers = [];
    if (st.phase !== "stuck") {
      const add = [], rolls = [], says = [];
      st.members.forEach((m, i) => {
        const a = st.acts[i] || { kind: "pass" };
        if (a.kind === "decl") { const line = T.declareLineOf(m.name, a.decl); if (line) add.push({ id: T.rid("rm_"), role: "sys", content: "亲笔·" + line, ts: Date.now() }); else says.push(m.name + " 这一拍没出声,跟着大家"); if (a.decl.try) tryers.push(m); return; }
        if (a.kind === "pass") { says.push(m.name + " 这一拍跟着大家"); return; }
        const ch = a.kind === "pick" ? (camp.choices || [])[a.pick] : null;
        if (ch && ch.check && STAT_ZH[ch.check.stat]) {
          const res = T.autoRoll(m, ch.check.stat);
          rolls.push(Object.assign({ id: T.rid("rm_"), role: "roll", content: T.rollLine("", m, ch.check, res), ts: Date.now() }, T.rollRec(m, ch.check, res)));
        }
        if (a.kind === "text") { typed = true; tryers.push(m); }
        says.push(m.name + (ch ? " 选了「" + ch.text + "」" : ":" + a.text) + (a.text && ch ? "(" + a.text + ")" : "") + (a.apart ? "(单独走开去办)" : ""));
        if (a.whisper) whispers.push({ from: m.name, text: a.whisper });
        if (a.apart) split.push(m.name);
      });
      add.push({ id: T.rid("rm_"), role: "user", content: "〔这一拍大家的行动〕\n" + says.join("\n"), ts: Date.now() });
      camp.msgs = camp.msgs.concat(rolls, add);
      n.pend = { whispers, split, typed, tryers: tryers.map(m => m.name) };
    } else ({ whispers, split, typed } = n.pend || { whispers: [], split: [], typed: false }), tryers = ((n.pend || {}).tryers || []).map(x => T.findMember(camp.party, x)).filter(Boolean);
    // 骰子、宣言一落地就是铁案：先存，守密人失败了也不回滚（单机同一条）；重试只重跑叙事
    n.camp = camp; n.acts = {}; n.members = camp.party; writeBack(n);
    const burst = camp.burst ? T.burstCost(camp, camp.burst.clock) : null;
    const pressure = !burst && T.paceOn(camp) && (camp.pace.idle || 0) >= T.PACE_IDLE_MAX;
    const call = async (c, o) => {
      const sys = T.buildGmSys(c, { uName: st.members.filter((m, i) => st.seatKinds[i] === "user").map(m => m.name).join("、") || "各位玩家", personas: personasOf(st, ctx.prep) });
      const hist = T.foldHist(c.msgs.slice(c.sumCount || 0)).slice(-40), tail = tableTail(Object.assign({}, st, { camp: c }), inv, o);
      if (hist.length && hist[hist.length - 1].role === "user") hist[hist.length - 1] = { role: "user", content: hist[hist.length - 1].content + tail };
      else hist.push({ role: "user", content: "(继续)" + tail });
      const raw = await root.callAI(ctx.hostApi, sys, hist, { maxTokens: T.TOK_MAX, timeout: 300000 });
      return T.parseTurnPayload(raw);
    };
    const land = (c, p, o) => {
      const lastRoll = c.msgs.filter(m => m.role === "roll").slice(-1)[0] || null;
      const r = T.applyTurnPayload(c, p, { nodes: T.nodesOfCamp(c), roll: lastRoll, burst: o.burst, pressure: o.pressure, typed: o.typed, split: o.split && o.split.length ? { who: o.split, task: "" } : null, paceSkip: !!o.resolve });
      return { r, c: Object.assign({}, r.camp, { msgs: c.msgs.concat(T.beatMsgsOf(r.camp, p, r)) }) };
    };
    let p = null, why = "";
    try { p = await call(camp, { whispers, split, burst, pressure }); if (!p) why = "回的不是一拍剧情"; } catch (e) { p = null; why = String((e && e.message) || e).slice(0, 80); }
    if (!p) return Object.assign(n, { busy: false, phase: "stuck", err: "守密人这一拍没写出来(" + why + ");骰子和大家的行动都记下了,房主点「继续这一拍」重试" });
    let out = land(camp, p, { burst, pressure, typed, split });
    // 自己写的那一下要碰运气：守密人停在悬点报 needCheck → 这台掷，再续写一枪（单机同一条：只认这一拍确有人自己写或想赌）
    const nck = T.normCheckObj(p.needCheck);
    if (nck && tryers.length && !out.c.ended) {
      const m = (nck.who ? T.findMember(out.c.party, nck.who) : null) || T.findMember(out.c.party, tryers[0].name) || out.c.party[0];
      const res = T.autoRoll(m, nck.stat);
      const c2 = Object.assign({}, out.c, { msgs: out.c.msgs.concat([Object.assign({ id: T.rid("rm_"), role: "roll", content: T.rollLine("", m, nck, res), ts: Date.now() }, T.rollRec(m, nck, res))]) });
      let p2 = null; try { p2 = await call(c2, { resolve: true }); } catch (e) { p2 = null; }
      out = p2 ? land(c2, p2, { resolve: true }) : { r: out.r, c: c2 };
    }
    // 守密人只回给某一位的话、另一路的真相：进 priv
    (Array.isArray(p.whisper) ? p.whisper : []).slice(0, 4).forEach(w => {
      const k = st.members.findIndex(m => w && m.name === cut(w.to, 16)); if (k < 0 || !cut(w.text, 300).trim()) return;
      n.whisper[k] = (n.whisper[k] || []).concat([cut(w.text, 300)]);
    });
    if (out.r.apart) (out.r.apart.who || split).forEach(nmx => { const k = st.members.findIndex(m => m.name === nmx || String(out.r.apart.who || "").indexOf(m.name) >= 0); if (k >= 0 && out.r.apart.truth) n.truth[k] = (n.truth[k] || []).concat([cut(out.r.apart.truth, 800)]); });
    n.apartWho = split.slice();
    n.camp = out.c; n.members = out.c.party; n.beat = st.beat + 1; n.pend = null; n.busy = false;
    n.phase = out.c.ended ? "done" : "act";
    writeBack(n);
    return n;
  }

  const A = {
    zh: "跑团", hostRoute: "offline",
    charOpts: ["recent"],
    seatRange: () => ({ min: 1, max: 5 }),
    // 最后一个人交完、房主点「不等了」或「继续这一拍」：那一下要等守密人，先亮「守密人在写」
    slow(st, seat, mv) {
      if (!st || st.busy) return false;
      if (seat < 0) return !!(mv && (mv.op === "resolve" || mv.op === "retry"));
      if (st.phase !== "act" || st.acts[seat]) return false;
      return pendingOf(st).filter(i => i !== seat).length === 0;
    },
    async init(inv, ctx) {
      await ensure(); const T = TS();
      if (!T) throw new Error("跑团没装上");
      const pz = ctx.prep || {}, camp = (T.loadCamps() || []).find(c => c.id === pz.campId);
      if (!camp) throw new Error("房主这台找不到要开的那个团了（删掉了？）");
      if (camp.ended) throw new Error("这个团已经落幕了，换一个还在演的");
      const members = seatParty(camp, inv);
      return { camp: clone(camp), members, seatKinds: inv.seats.map(s => s.kind), phase: members.some(m => !m.stats) ? "roll" : "act",
        acts: {}, beat: 0, busy: false, err: "", whisper: {}, truth: {}, apartWho: [], logFrom: Math.max(0, (camp.msgs || []).length - 6), pend: null };
    },
    view, priv,
    // 庄那份和各台收到的 view 都认：view 里带着 done（谁交了）和 seatKinds
    turn(x) {
      if (x.members) return turnOf(x, x.seatKinds.map(k => ({ kind: k })));
      if (x.busy || (x.phase !== "roll" && x.phase !== "act")) return -1;
      const kinds = x.seatKinds || [], rank = i => kinds[i] === "char" ? 0 : kinds[i] === "npc" ? 1 : 2;
      const p = (x.done || []).map((d, i) => d ? -1 : i).filter(i => i >= 0);
      return p.length ? p.sort((a, b) => rank(a) - rank(b))[0] : -1;
    },
    waiting: v => v.phase === "roll" || v.phase === "act" ? (v.done || []).map((d, i) => d ? -1 : i).filter(i => i >= 0) : [],
    async apply(st, seatIdx, mv, ctx) {
      const inv = ctx.inv;
      if (st.phase === "done") return { err: "这一团今晚已经收桌了" };
      mv = mv || {};
      if (seatIdx < 0) {
        if (mv.op === "stop") { writeBack(st); return { st: Object.assign({}, st, { phase: "done", stopped: true, busy: false }) }; }
        if (mv.op === "retry" && st.phase === "stuck") return { st: await resolve(st, inv, ctx) };
        if (mv.op === "resolve" && st.phase === "act") return { st: await resolve(st, inv, ctx) };   // 不等了：没交的人这一拍跟着大家
        return { err: "现在不用这一下" };
      }
      if (st.phase === "roll") {
        if (st.members[seatIdx].stats) return { err: "这一位的数值已经掷过了" };
        const s = cleanStats(mv.stats); if (!s) return { err: "数值不对" };
        const members = st.members.map((m, i) => i === seatIdx ? Object.assign({}, m, { stats: s, fate: TS().fateOf(s.luck) }) : m);
        return { st: Object.assign({}, st, { members, phase: members.some(m => !m.stats) ? "roll" : "act", busy: false }) };
      }
      if (st.phase !== "act") return { err: "守密人还在写，等这一拍写完" };
      if (st.acts[seatIdx]) return { err: "这一拍你已经交过了" };
      const a = takeAct(st, seatIdx, mv); if (!a) return { err: "挑一条路，或者写一句你做什么" };
      const n = Object.assign({}, st, { acts: Object.assign({}, st.acts, { [seatIdx]: a }), busy: false });
      return { st: pendingOf(n).length ? n : await resolve(n, inv, ctx) };
    },
    // 角色队友：带 TA 来的那台，TA 自己的线路和人设；只看公开那一份局面和 TA 自己的私念
    async charMove(view, i, inv, ctx) {
      await ensure(); const T = TS(); if (!T) return { pass: true };
      if (view.phase === "roll") return { stats: T.personaNudge(T.rollStats(), (ctx.char && ctx.char.persona) || "") };
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
    async npcMove(st) { await ensure(); return st.phase === "roll" ? { stats: TS().rollStats() } : { pass: true }; },
    result(st, inv) {
      if (st.phase !== "done") return null;
      const c = st.camp, last = (c.msgs || []).filter(m => m.role === "gm").slice(-1)[0];
      return { winners: [], text: "「" + cut(c.title, 20) + "」这一晚跑了 " + st.beat + " 拍" + (c.ended ? ",落幕了。" : ",团还没完,存在房主那里,下次接着跑。") + (last ? "停在:" + cut(last.content, 60) : ""),
        replay: { title: cut(c.title, 30), log: publicLog(c, st.logFrom).slice(-40) } };
    },
    cleanLog: a => (Array.isArray(a) ? a : []).slice(-40).map(x => ({ role: ["gm", "roll", "user", "sys", "apart", "letter"].indexOf(x && x.role) >= 0 ? x.role : "sys", text: cut(x && x.text, 3000), who: cut(x && x.who, 16) })),
    cleanReplay(r) { return { title: cut(r.title, 30), log: this.cleanLog(r.log) }; },
    cleanView(v) {
      const arr = (a, n) => (Array.isArray(a) ? a : []).slice(0, n);
      return { title: cut(v.title, 30), world: cut(v.world, 300), place: cut(v.place, 30), goal: cut(v.goal, 120), objective: cut(v.objective, 120), stakes: cut(v.stakes, 120),
        pace: v.pace && typeof v.pace === "object" ? { beat: int(v.pace.beat, 0, 9, 0), done: int(v.pace.done, 0, 9, 0), total: int(v.pace.total, 0, 9, 0), got: int(v.pace.got, 0, 20, 0), clues: int(v.pace.clues, 0, 20, 0) } : null,
        clocks: arr(v.clocks, 3).map(x => ({ name: cut(x && x.name, 16), filled: int(x && x.filled, 0, 12, 0), max: int(x && x.max, 1, 12, 4) })),
        clues: int(v.clues, 0, 999, 0), clueList: arr(v.clueList, 8).map(x => cut(x, 80)),
        choices: arr(v.choices, 4).map(x => ({ text: cut(x && x.text, 80), stat: x && STAT_ZH[x.stat] ? x.stat : "", who: cut(x && x.who, 16), risk: cut(x && x.risk, 36), payoff: cut(x && x.payoff, 36), cost: cut(x && x.cost, 36) })),
        ended: !!v.ended, phase: ["roll", "act", "stuck", "done"].indexOf(v.phase) >= 0 ? v.phase : "act", beat: int(v.beat, 0, 9999, 0), busy: !!v.busy, err: cut(v.err, 200),
        party: arr(v.party, 5).map(m => ({ name: cut(m && m.name, 16), hp: int(m && m.hp, 0, 999, 100), maxHp: int(m && m.maxHp, 1, 999, 100), stats: cleanStats(m && m.stats), guest: !!(m && m.guest) })),
        done: arr(v.done, 5).map(Boolean), seatKinds: arr(v.seatKinds, 5).map(k => ["user", "char", "npc"].indexOf(k) >= 0 ? k : "user"), apart: arr(v.apart, 5).map(x => cut(x, 16)), log: this.cleanLog(v.log) };
    },
    stateText(v, i, inv, pv) {
      const who = (v.party || []).map((m, k) => m.name + "(HP" + m.hp + "/" + m.maxHp + ((v.apart || []).indexOf(m.name) >= 0 ? ",单独走开了" : "") + ")").join("、");
      const clocks = (v.clocks || []).map(x => "「" + x.name + "」" + x.filled + "/" + x.max).join(" ");
      const wait = (v.done || []).map((d, k) => d ? "" : nm(inv, k)).filter(Boolean);
      const last = (v.log || []).filter(x => x.role === "gm").slice(-1)[0];
      return "跑团「" + v.title + "」第 " + (v.beat + 1) + " 拍,在「" + v.place + "」。" + (v.goal ? "这一章要办成:" + v.goal + "。" : "") + (v.objective ? "眼下:" + v.objective + "。" : "")
        + "\n队伍:" + who + "。线索 " + v.clues + " 条" + (v.pace ? ",这一场第 " + v.pace.beat + "/" + v.pace.total + " 拍" : "") + (clocks ? ",钟:" + clocks : "") + "。"
        + (last ? "\n守密人刚写到:" + cut(last.text, 200) : "")
        + (v.phase === "act" && wait.length ? "\n还没交这一拍的:" + wait.join("、") + "。" : v.phase === "done" ? "\n今晚收桌了。" : "")
        + (pv && pv.mate ? "\n(只你知道)你心里揣着的:想要" + pv.mate.want + ",最怕" + pv.mate.fear + "。" : "");
    }
  };
  C.ADAPTERS.trpg = A;
  A.shelf = { key: "trpg", zh: "跑团", en: "TRPG", min: 1, max: 5, rule: "房主开团当庄 · 最多 5 人上桌" };
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
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(15), color: t.ink } }, "「" + v.title + "」", h("span", { style: Object.assign(small(t), { marginLeft: 6 }) }, v.place + " · 第 " + (v.beat + 1) + " 拍")),
      v.goal ? h("div", { style: small(t) }, "这一章：" + v.goal + (p ? "　这一场 " + p.beat + "/" + p.total + " 拍 · 线索 " + p.got + "/" + p.clues : "")) : null,
      v.objective ? h("div", { style: small(t) }, "眼下：" + v.objective + (v.stakes ? "　代价：" + v.stakes : "")) : null,
      (v.clocks || []).length ? h("div", { "data-wk": "nrtrpgclocks", className: "flex flex-wrap", style: { gap: 6 } }, v.clocks.map((x, i) => h("span", { key: i, style: Object.assign(small(t), { border: "1px solid " + t.line, borderRadius: 999, padding: "0 8px" }) }, "⏰ " + x.name + " " + x.filled + "/" + x.max))) : null,
      h("div", { "data-wk": "nrtrpgparty", className: "flex flex-wrap", style: { gap: 6 } }, (v.party || []).map((m, i) => h("span", { key: i, "data-done": v.done[i] ? "1" : "0",
        style: Object.assign(small(t), { border: "1px solid " + (mine.indexOf(i) >= 0 ? t.ink : t.line), borderRadius: 10, padding: "2px 8px", color: t.ink }) },
        m.name + (inv.seats[i] && inv.seats[i].kind === "char" ? "（角色）" : "") + " HP" + m.hp + ((v.phase === "act" || v.phase === "roll") ? (v.done[i] ? " ✓" : " …") : "")))),
      v.clues ? h("div", { style: small(t) }, "线索 " + v.clues + " 条：" + (v.clueList || []).join("；")) : null);
  }
  function Act({ t, v, seat, onMove }) {
    const [pick, setPick] = useState(-1), [say, setSay] = useState(""), [wh, setWh] = useState(""), [whOn, setWhOn] = useState(false), [apart, setApart] = useState(false);
    const go = () => { onMove(seat, { pick, say: say.trim(), whisper: whOn ? wh.trim() : "", apart }); setPick(-1); setSay(""); setWh(""); setWhOn(false); setApart(false); };
    return h("div", { "data-wk": "nrtrpgact", style: { display: "flex", flexDirection: "column", gap: 8 } },
      v.choices.map((c, k) => h("button", { key: k, "data-wk": "nrtrpgchoice", onClick: () => setPick(pick === k ? -1 : k),
        style: { textAlign: "left", borderRadius: 12, border: "1px solid " + (pick === k ? t.ink : t.line), background: pick === k ? t.bg : t.bg2, color: t.ink, padding: "8px 12px", fontFamily: F_BODY, fontSize: fs(13.5) } },
        c.text, h("div", { style: small(t) }, [c.stat ? "要过「" + STAT_ZH[c.stat] + "」检定" + (c.who ? "（" + c.who + "）" : "") : "", c.payoff ? "换来：" + c.payoff : "", c.risk ? "风险：" + c.risk : "", c.cost ? "代价：" + c.cost : ""].filter(Boolean).join("　")))),
      h("textarea", { "data-wk": "nrtrpginput", value: say, rows: 2, onChange: e => { setSay(e.target.value.slice(0, 400)); fit(e); }, placeholder: pick >= 0 ? "补一句怎么做（可空）" : "或者自己写：你做什么、说什么", style: box(t) }),
      h("div", { className: "flex flex-wrap", style: { gap: 6 } },
        h("button", { "data-wk": "nrtrpgwhisper", onClick: () => setWhOn(!whOn), style: Object.assign(pill(t, whOn), { minHeight: 32, padding: "0 12px" }) }, "咬耳朵"),
        h("button", { "data-wk": "nrtrpgapart", onClick: () => setApart(!apart), style: Object.assign(pill(t, apart), { minHeight: 32, padding: "0 12px" }) }, "单独走开")),
      whOn && h("textarea", { "data-wk": "nrtrpgwhisperin", value: wh, rows: 2, onChange: e => { setWh(e.target.value.slice(0, 200)); fit(e); }, placeholder: "只有守密人看得到；TA 要回也只回你", style: box(t) }),
      apart && h("div", { style: small(t) }, "这一拍你离开大家去办你写的那件事；那边真正发生了什么只有你看得到，大家只听到你回来怎么说。"),
      h("button", { "data-wk": "nrtrpgsend", disabled: pick < 0 && !say.trim(), onClick: go, style: pill(t, true) }, "交这一拍"));
  }
  function TrpgTable({ inv, view: v, priv: pv, me, isHost, onMove }) {
    const t = useTheme();
    const mine = inv.seats.map((s, i) => C.actorOf(s, me, inv.host) === "mine-user" ? i : -1).filter(i => i >= 0);
    const myPend = mine.filter(i => !v.done[i]);
    const [rolled, setRolled] = useState(null);
    const wait = v.done.map((d, i) => d ? "" : (v.party[i] || {}).name).filter(Boolean);
    const status = v.busy ? "守密人在写这一拍…" : v.phase === "done" ? "今晚收桌了" : v.phase === "stuck" ? (v.err || "这一拍卡住了") : v.phase === "roll" ? "上桌前先掷数值" + (wait.length ? "，还在等：" + wait.join("、") : "")
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
      v.phase === "act" && !v.busy && myPend.slice(0, 1).map(i => h(Act, { key: i, t, v, seat: i, onMove })),
      isHost && v.phase === "act" && !v.busy && wait.length && h("button", { "data-wk": "nrtrpgnowait", onClick: () => onMove(-1, { op: "resolve" }), style: Object.assign(pill(t, false), { alignSelf: "flex-start" }) }, "不等了，先结算（没交的这一拍跟着大家）"),
      isHost && v.phase === "stuck" && !v.busy && h("button", { "data-wk": "nrtrpgretry", onClick: () => onMove(-1, { op: "retry" }), style: Object.assign(pill(t, true), { alignSelf: "flex-start" }) }, "继续这一拍"),
      isHost && v.phase !== "done" && !v.busy && h("button", { "data-wk": "nrtrpgstop", onClick: () => onMove(-1, { op: "stop" }), style: Object.assign(pill(t, false), { alignSelf: "flex-start" }) }, "今晚先到这儿（进度存在你的团里）"));
  }
  function TrpgReplay({ rec }) {
    const t = useTheme(), r = rec.replay || {};
    return h("div", { style: { padding: "8px 16px", display: "flex", flexDirection: "column", gap: 10 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(15), color: t.ink } }, "「" + (r.title || "") + "」"), h(Log, { t, log: r.log }));
  }
  // 房主开局：挑自己的一个团（在单机跑团里开好的），自己上不上桌、带哪几位角色、给别人留几个座位
  function TrpgPrep({ myChars, nick, onSend }) {
    const t = useTheme();
    const [camps, setCamps] = useState(null);
    const [p, setP] = useState({ campId: "", me: true, chars: {}, open: 2 });
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
      h("button", { "data-wk": "nrtrpggo", disabled: !camp || total < 1, onClick: () => onSend({ total: Math.max(1, total), mode: "normal", npcFill: false, picks }, { campId: p.campId, personas }), style: Object.assign(pill(t, true), { marginTop: 8 }) }, "发邀请卡"));
  }
  A.Table = TrpgTable; A.Replay = TrpgReplay; A.Prep = TrpgPrep;
})(typeof window !== "undefined" ? window : globalThis);
