// 邮票对局的界面（她 2026-11-07「开工」→ 同日「邮戳能不能放卡面还有写是谁的卡、放错了能取消、UI 弄好看点」）。
//   规则全在 js/stamp-duel.js；这里只摆出来、接她的手指。从邮票册右上「对局」进来。
//   票上放这张卡的卡面（缩略图走邮票册那一份 useStampThumb，由 stamps.js 递进来），底下写卡名和是谁的卡。
//   打完一把选「再来一把」还是「结束」；结束时才问要不要让 TA 记得（几把合成一句）。
(function () {
  "use strict";
  const { useState, useRef, useMemo, useLayoutEffect } = React;
  const h = React.createElement;
  const D = () => window.StampDuel;
  const INK = "#2f2a22", SUB = "rgba(47,42,34,.6)", RED = "#b23a2e", GREEN = "#4f7a66", PAPER = "#fbf6ea";
  const RC = { R: "#5a5248", SR: "#3f6fb0", SSR: "#c8962e" };
  const ROLE_COLOR = { 投递: "#b23a2e", 火漆: "#8a3a4a", 补票: "#4f7a66", 集邮: "#3f6fb0", 邮戳: "#6a4f8a" };
  const ROLE_TIP = { 投递: "打同一列对面最前面那张，空着就打信封；打得最狠", 火漆: "厚，每回合给自己封一层护，再打一半", 补票: "给最残的那张回血、擦掉雨渍和退回，再打四成", 集邮: "攒胶水、多抽牌，再打四成", 邮戳: "给对面同一列盖戳，再打一半" };
  // 新手教学关（她 2026-11-08「直接做一个新手指引关，可以随便回玩学习」）：一把写好的练习局，
  //   上面一块教练条一步一步说，要她动手的那几步等她做到了才往下走。不存档、不进记忆、不花调用
  const TUT = [
    { say: "下面是你的信封，上面是对面的。两边都往自己信封上贴邮票，贴上的票会自己去打对面。谁的信封耐久先被打空，谁输。", next: true },
    { say: "手里有一张「火漆」票（右上角写着火漆）。点它，再点你信封最上面一排的一个空格，把它贴上去。火漆血厚，放前排挡着。", done: st => [0, 1, 2].some(i => st.me.board[i] && st.me.board[i].role === "火漆") },
    { say: "再把「投递」贴到最下面一排。前面有火漆挡着，它挨不着打，在后排攻击还 +2。", done: st => [6, 7, 8].some(i => st.me.board[i] && st.me.board[i].role === "投递") },
    { say: "胶水花完了（底下那几滴）。点「寄出」：你的票先动手，然后对面照它亮出来的那一步走。", done: st => st.turn >= 2 },
    { say: "看上面那张写着「下一步」的条子：对面这回合要贴什么、贴在哪、会打你多少，都提前写着。它往哪一列放投递，你就在那一列前面挡着。", next: true },
    { say: "你那张投递票底下的小点亮满了（我帮你攒的）。点它，再点「盖章」——花 1 胶水放它的技能。", enter: st => { const u = st.me.board.find(x => x && x.role === "投递"); if (u) u.charge = u.need; st.me.postage = Math.max(st.me.postage, 2); }, done: st => st.log.some(l => l.kind === "stamp" && l.who === "me") },
    { say: "长按任何一张票（你的、对面的、手里的都行），能看它的特质、盖章技和羁绊。长按一张试试，看完点空白处关掉。", done: (st, x) => x.infoSeen },
    { say: "手里来了四张同一个人的票，胶水也给你添够了。把它们贴成 2×2 的一个方块，触发「四方连」觉醒。", enter: (st, x) => x.giveFour(), done: st => st.log.some(l => l.kind === "wake" && l.who === "me") },
    { say: "要领就这些。还有撕票、挪票、留牌、格子和邮局公告，打着打着会碰到，右上角「怎么玩」随时查。现在把这一把打完吧！", next: true, last: true }
  ];
  // 彩头（她 2026-11-08「都可以」）：开局前约好输了干嘛，打完 TA 照约定兑现或来讨
  const WAGERS = ["输的人回答一个真心话", "输的人给对方写一封信", "输的人喂对方吃一口", "输的人陪对方看一部片", "输的人叫一声好听的", "输的人答应对方一件小事"];
  // 每周轮一个规则局
  const RULES = {
    mirror: { zh: "镜像局", desc: "两边用同一套卡组，只比谁摆得好" },
    reverse: { zh: "反着来", desc: "你用 TA 的卡，TA 用你的" },
    fancy: { zh: "华丽局", desc: "卡组只从 SR 和 SSR 里抽" },
    quick: { zh: "快局", desc: "各 25 血，最多 7 回合" }
  };
  const ruleOfWeek = () => { const keys = Object.keys(RULES); return keys[Math.floor(Date.now() / 604800000) % keys.length]; };
  // 快捷表情：一点就发，TA 拿卡上那句回你，不花调用
  const EMOTES = ["哼", "再来", "手下留情", "好厉害", "等着瞧", "让我一下嘛"];
  const STATS_KEY = "x_stampDuelStats";
  const SIEGE_KEY = "x_stampSiegeBest";
  // 材料和专属信物（她 2026-11-08）：材料匣、信物册、物品栏（带几件）。对局、守城、远信共用这一份
  // 远信做过的信物收进信物册（只是收着翻看，效果只在做它的那一趟里）
  const KEEP_KEY = "x_stampKeeps";
  const ld = (k, d) => { try { const v = typeof loadJSON === "function" ? loadJSON(k, d) : d; return v == null ? d : v; } catch (e) { return d; } };
  const sv = (k, v) => { try { saveJSON(k, v); } catch (e) {} };
  const Keeps = {
    all: () => ld(KEEP_KEY, []),
    add: k => { const a = Keeps.all(); a.push(k); sv(KEEP_KEY, a.slice(-200)); },
    fxLine: (fx, v) => (D().KEEP_FX[fx] ? D().KEEP_FX[fx].zh + " · " + D().KEEP_FX[fx].say(v) : "")
  };
  window.StampKeeps = Keeps;
  // 打赢的奖励（她 2026-11-08「奖励可以 弄一下」）：每天第一次赢给一点；各玩法的里程碑第一次达成给一笔、盖一枚纪念戳。
  //   印泥、邮资直接进邮票册那份（StampsCore），量控制在比抽卡、升级花得少
  const REWARD_KEY = "x_stampDuelRewards";
  // 「今天」按她手机上的日子算（她 2026-11-09「下午也打了」）：原来用 toISOString 是格林尼治的日子，北美傍晚就跨到第二天了
  const localDay = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const MILESTONES = [
    ...[0, 1, 2, 3, 4].map(t => ({ id: "siege" + t, zh: "守住护信第 " + (t + 1) + " 档", ink: 150 * (t + 1), postage: 100, test: x => x.siege && x.win && x.tier === t })),
    ...[5, 10, 15, 20].map((n, i) => ({ id: "edict" + n, zh: "封缄令危险 " + n, ink: [150, 300, 500, 800][i], postage: 100, test: x => x.edict && x.win && x.pts >= n })),
    ...[200, 400, 700, 1000].map((n, i) => ({ id: "raid" + n, zh: "积压件打出 " + n + " 伤害", ink: [150, 300, 500, 800][i], postage: 100, test: x => x.raid && !x.endless && x.dealt >= n })),
    ...[10, 15, 20].map((n, i) => ({ id: "endless" + n, zh: "无尽撑过 " + n + " 回合", ink: [200, 400, 700][i], postage: 100, test: x => x.raid && x.endless && x.turn >= n })),
    ...[10, 20, 30].map((n, i) => ({ id: "puzzle" + n, zh: "死信过 " + n + " 关", ink: [300, 500, 800][i], postage: 100, test: x => x.puzzle && x.solved >= n })),
    ...[100, 200, 300].map((n, i) => ({ id: "patrol" + n, zh: "邮区巡查 " + n + " 分", ink: [200, 400, 700][i], postage: 100, test: x => x.patrol && x.pts >= n })),
    ...[4, 8].map((n, i) => ({ id: "shift" + n, zh: "邮局值班撑到第 " + n + " 轮", ink: [300, 700][i], postage: 100, test: x => x.shift && x.round >= n })),
    ...[1, 2, 3, 4, 5, 6, 7, 8].map(l => ({ id: "run" + l, zh: "远信 " + l + " 级送到", ink: 100 * l, postage: 100, test: x => x.run && x.win && x.level >= l }))
  ];
  const DAILY = { ink: 60, postage: 60 };
  const Rewards = {
    MILESTONES,
    got: () => ld(REWARD_KEY, { got: {}, day: "" }),
    // x：这一把的结果 { win, siege, tier, edict, pts, raid, endless, dealt, turn, run, level }；返回这次拿到的几样
    settle: x => {
      const C = window.StampsCore; if (!C) return [];
      try { Pact.add(x); } catch (e) {}
      const r = Rewards.got(), out = []; let ink = 0, post = 0;
      const today = localDay();
      if (x.win && r.day !== today) { r.day = today; ink += DAILY.ink; post += DAILY.postage; out.push("今天第一次赢：" + DAILY.ink + " 印泥、" + DAILY.postage + " 邮资"); }
      MILESTONES.forEach(m => { if (!r.got[m.id] && m.test(x)) { r.got[m.id] = Date.now(); ink += m.ink; post += m.postage; out.push("✦ " + m.zh + "：" + m.ink + " 印泥、" + m.postage + " 邮资"); } });
      if (ink || post) { try { const st = C.load(); st.ink += ink; st.postage += post; C.save(st); } catch (e) {} sv(REWARD_KEY, r); }
      return out;
    }
  };
  // 每周约定（她 2026-11-08「互动感强一点」）：每周陪打的那个人在集邮社首页提一个小目标，进度从各玩法打完的结果里攒；
  //   做到了点一下，TA 写一封短信、留一样东西进小物册（花一次调用）。只在集邮社里，不进记忆、不进聊天
  const PACT_KEY = "x_stampPact";
  const PACT_GOALS = [
    { id: "win", n: 6, zh: n => "这周一起赢 " + n + " 把（什么玩法都算）", add: x => x.win ? 1 : 0 },
    { id: "puzzle", n: 4, zh: n => "这周解开 " + n + " 道死信", add: x => x.puzzle && x.win ? 1 : 0 },
    { id: "siege", n: 2, zh: n => "护信守住 " + n + " 回", add: x => x.siege && x.win ? 1 : 0 },
    { id: "raid", n: 400, zh: n => "积压件一共打出 " + n + " 伤害", add: x => x.raid ? (x.dealt || 0) : 0 },
    { id: "patrol", n: 40, zh: n => "巡查一共拿 " + n + " 分", add: x => x.patrol ? (x.pts || 0) : 0 },
    { id: "shift", n: 8, zh: n => "邮局值班一共撑过 " + n + " 轮", add: x => x.shift ? (x.round || 0) : 0 }
  ];
  const Pact = {
    week: () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4 - 3 * 864e5) / 6048e5),
    // 这周的：换周就按这周陪打的人重新定一个；同一周里换陪打的人，约定还是原来那个人的
    now: () => {
      let p = ld(PACT_KEY, null); const w = Pact.week();
      if (!p || p.week !== w) { const who = ld("x_stampCoach", "") || ""; if (!who) return null;
        let hsh = 0; for (const ch of String(who) + "|" + w) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
        p = { week: w, charId: who, goal: PACT_GOALS[hsh % PACT_GOALS.length].id, prog: 0, done: false, opened: false }; sv(PACT_KEY, p); }
      return p;
    },
    goalOf: p => PACT_GOALS.find(g => g.id === p.goal) || PACT_GOALS[0],
    add: x => { const p = Pact.now(); if (!p || p.done) return; const g = Pact.goalOf(p), v = g.add(x || {}); if (!v) return;
      p.prog = Math.min(g.n, p.prog + v); if (p.prog >= g.n) p.done = true; sv(PACT_KEY, p); },
    open: () => { const p = Pact.now(); if (p) { p.opened = true; sv(PACT_KEY, p); } }
  };
  // 谁能在聊天里提集邮社（她 2026-11-08）：按人两个开关，默认全关。
  //   know：TA 聊天时知道一小段集邮社近况（不写记忆、每次现算；小包裹、信物也才进记忆）
  //   invite：TA 偶尔在私聊里发邀请卡（对局、护信、死信、巡查、邮局）
  const LINK_KEY = "x_stampChatLink";
  const ChatLink = {
    all: () => ld(LINK_KEY, {}) || {},
    of: id => Object.assign({ know: false, invite: false }, ChatLink.all()[id] || {}),
    set: (id, k, v) => { const a = ChatLink.all(); a[id] = Object.assign({ know: false, invite: false }, a[id] || {}, { [k]: !!v }); sv(LINK_KEY, a); },
    // 只写跟 TA 本人有关的；没有的那行不出现
    brief: id => {
      if (!ChatLink.of(id).know) return "";
      const out = [];
      try { const p = ld(PACT_KEY, null); if (p && p.charId === id && p.week === Pact.week()) { const g = Pact.goalOf(p); out.push("这周你们约好：「" + g.zh(g.n) + "」，现在 " + p.prog + "／" + g.n + (p.done ? "，已经做到了" : "") + "。"); } } catch (e) {}
      try { const sh = ld("x_stampShop", null), d = new Date(), today = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
        if (sh && sh.date === today && sh.phase !== "plan") { const post = Object.keys(sh.roster || {}).find(k => String(sh.roster[k]) === String(id)); out.push("她的邮局小店今天：" + (post ? "你在" + post + "上班" : "你今天没排班") + (sh.phase === "closed" ? "，已经打烊了" : "") + "。"); } } catch (e) {}
      try { const r = (ld(STATS_KEY, {}) || {})[id]; if (r && r.last && Date.now() - r.last.at < 7 * 864e5) { const dd = Math.floor((Date.now() - r.last.at) / 864e5); out.push("最近一次跟你打对局：" + (dd ? dd + " 天前" : "今天") + "，" + (r.last.win === "me" ? "她赢了" : r.last.win === "foe" ? "你赢了" : "打平") + "。"); } } catch (e) {}
      return out.length ? "【集邮社近况】这是她在邮票册「集邮社」里跟你们玩的小游戏，你知道这些。想提就自然地提，不提也行，别每次都绕回来。\n- " + out.join("\n- ") : "";
    }
  };
  window.StampChatLink = ChatLink;
  // 派遣回来给邮资和印泥（她 2026-11-09「为啥没有奖励」）：按派出去多久给，每天第一趟双份
  const DISPATCH_PAY = { 1: 30, 4: 90, 8: 160 };
  const dispatchPay = hours => {
    const C = window.StampsCore; if (!C) return null;
    const r = Rewards.got(), today = localDay(), first = r.dpDay !== today, n = (DISPATCH_PAY[hours] || 30) * (first ? 2 : 1);
    try { const st = C.load(); st.ink += n; st.postage += n; C.save(st); r.dpDay = today; sv(REWARD_KEY, r); } catch (e) { return null; }
    return { ink: n, postage: n, first };
  };
  // 外语那句：跟邮票册同一个「原文大字、中文小字、没带中文的旁边一颗译」
  const BT = t => window.StampBiText && typeof t === "string" && t ? h(window.StampBiText, { text: t }) : t;
  window.StampRewards = Rewards;
  // TA 的小物（她 2026-11-08「陪同角色能收集到和他相关的东西，全部玩法都是」）：有人陪着打就掉 TA 的小包裹，
  //   攒着，在小物册里拆（花一次调用，TA 写一样跟你们有关的东西）；只是收藏，不加数值
  const PARCEL_KEY = "x_stampParcels", TRINKET_KEY = "x_stampTrinkets";
  const Trinkets = {
    parcels: () => ld(PARCEL_KEY, {}),
    // ids：这一把陪着的人；win 必掉、输一半几率；extra 额外多掉几个（巡查宝箱、远信送到）
    drop: (ids, win, extra) => { const P = Trinkets.parcels(), got = []; (ids || []).filter(Boolean).forEach(id => { const n = (win ? 1 : Math.random() < 0.5 ? 1 : 0) + (extra || 0); if (n > 0) { P[id] = (P[id] || 0) + n; got.push([id, n]); } }); if (got.length) sv(PARCEL_KEY, P); return got; },
    take: id => { const P = Trinkets.parcels(); if (!(P[id] > 0)) return false; P[id]--; sv(PARCEL_KEY, P); return true; },
    giveBack: id => { const P = Trinkets.parcels(); P[id] = (P[id] || 0) + 1; sv(PARCEL_KEY, P); },
    all: () => ld(TRINKET_KEY, []),
    add: t => { const a = Trinkets.all(); a.push(t); sv(TRINKET_KEY, a); }
  };
  window.StampTrinkets = Trinkets;
  // 派遣（她 2026-11-08）：最多三队在外面；派出去的票这段时间别处用不了
  const DISPATCH_KEY = "x_stampDispatch";
  const DISPATCH_PLACES = ["雪国", "海边", "旧城", "夜车", "花季", "沙漠", "雨季", "山路", "梦里"];
  const Dispatch = {
    all: () => ld(DISPATCH_KEY, []),
    save: a => sv(DISPATCH_KEY, a.slice(-60)),
    out: () => { const ids = new Set(); Dispatch.all().forEach(t => { if (!t.report) (t.cardIds || []).forEach(id => ids.add(id)); }); return ids; },
    filter: cards => { const o = Dispatch.out(); return o.size ? (cards || []).filter(c => !o.has(c.id)) : cards; }
  };
  window.StampDispatch = Dispatch;   // 守城最好成绩：{ waves, wins }
  // 念台词（她 2026-11-08「搞个开关播放语音，然后可以设置选哪些的台词战斗中可以读出来，战斗的时候会显示台词念出来」）
  const VOICE_KEY = "x_stampDuelVoice";
  const VOICE_KINDS = [["place", "贴上场"], ["stamp", "盖章"], ["wake", "觉醒"], ["fall", "被打掉"]];
  const VOICE_DEF = { on: false, place: true, stamp: true, wake: true, fall: true, me: true, foe: true };
  const ttsOk = () => typeof ttsSpeak === "function" && typeof ttsReady === "function" && typeof loadTtsApi === "function" && ttsReady(loadTtsApi());
  // 一次只念一句：排着队念，排太长就丢掉旧的（动画快，别让声音拖到下一回合）
  const voiceQ = { list: [], busy: false };
  function speakQ(text, vid) {
    voiceQ.list.push({ text, vid }); if (voiceQ.list.length > 2) voiceQ.list.splice(0, voiceQ.list.length - 2);
    const next = () => { const it = voiceQ.list.shift(); if (!it) { voiceQ.busy = false; return; } voiceQ.busy = true;
      ttsSpeak(it.text, it.vid).then(b => { const u = URL.createObjectURL(b), a = new Audio(u); a.onended = a.onerror = () => { URL.revokeObjectURL(u); next(); }; a.play().catch(() => next()); }).catch(() => next()); };
    if (!voiceQ.busy) next();
  }
  const GUIDE = [
    ["一句话", "你和 TA 各有一个信封。轮流往自己信封上贴邮票，贴上的票会自己去打对面。谁的信封先被打空，谁就输。"],
    ["每回合你做什么", "回合开始，你有 3 点胶水（第 4 回合起 4 点，第 7 回合起 5 点，对面也一样），手里摸到 4 张票。", "点手里一张，再点自己信封上的空格，就贴上去了。贴一张要花它的面值那么多胶水：R 是 1，SR 是 2，SSR 是 3。", "胶水花完、或者不想贴了，点「寄出」。你的票先动手，然后 TA 照着亮出来的那一步走。", "没用掉的牌回合结束就扔了。想留，选中它点「留到下回合」，最多留两张。", "放错了点「撤回」，一步一步退，胶水也退回来。点了「寄出」就退不回了。"],
    ["五种票各干嘛", "每种票寄出后都会打同一列对面最前面那张（那一列空着就打信封），区别是打几成、顺手还干什么：", "投递：打人的，打满，攻击也最高。", "火漆：肉盾。血厚，每回合给自己封一层护，再打一半。", "补票：奶妈。给最残的那张回血、擦掉身上的戳，再打四成。", "集邮：管钱的。下回合多给胶水、多摸牌，再打四成。", "邮戳：捣乱的。给对面盖戳，再打一半：雨渍攻击 -2，退回停一回合，折角挨打多掉 2，撕口每回合掉 2 血，封口盖不了章也不攒章，延误让对面下回合少 1 胶水；加急是盖给自己人的，让旁边的投递行动两遍。", "对局里对面的等级照你这副牌的平均等级来，不会出现 1 级打 50 级；护信、远信是固定难度档，写着建议等级，卡练强了去打高档；卡升级以后攻击、血涨得比以前多，信封也跟着卡组等级变厚。", "票是哪一种，看卡上写了什么：写打架的多半是投递，写撑伞的多半是火漆。"],
    ["站位：前排挨打，后排输出", "信封第一排是前排。对面打一列，从前排往后找，所以前面有人挡着，后排就挨不着。", "常见摆法：火漆放前排顶着，投递和邮戳放最后一排（后排它们攻击 +2）。", "对面哪一列空着，你那一列的投递就能直接打到 TA 的信封。"],
    ["凑组合", "连张：同一个人的两张票挨着，攻击 +2。", "整版：同一个人的三张票排满一整行或一整列，觉醒一次，打对面信封、全员充章。", "四方连：四张同一个人（或同一种卡，比如都是生日卡）凑成 2×2，觉醒一次，打对面信封、全员加护。", "每种组合每个人一局只觉醒一次。想好凑哪个再贴。", "开局前在「带谁上场」挑一两个人，他们的卡就多，好凑。"],
    ["盖章：每张票的大招", "票底下那排小点每回合亮一格，亮满变金色，就能盖章了。", "点那张票，再点「盖章」，花 1 胶水放它的技能。同一种票有四种技能，SSR 的更猛。", "所以每回合都要想：胶水拿去贴新票，还是去给老票盖章？"],
    ["特质和羁绊", "每张票还有一个特质，是被动：比如「醉意」一半几率打双份、一半几率落空，「锋利」打票不管护盾，「倔强」第一次被打倒会硬撑着留一口气。", "每个人有一个羁绊，看人设来的：护短、好胜、温柔、冷淡、偏执，都不沾就是默契。同一个人的票在信封上有两张以上就生效。", "看不明白哪张票是干嘛的？长按它，什么都写着。对面的票也能长按。"],
    ["别的小东西", "溢出：一下打死一张票，多出来的伤害一半落到同一列后面那张，这一列没票了就落到信封；补血补满了还多出来的，一半补到自家信封（补票、群补、洗戳才算）。", "挪票：点自己一张票，再点旁边的空格，花 1 胶水挪过去，用来凑组合或补前排。", "撕票：点一张票点「撕下」，每回合能撕一张，撕的那一下会触发一次效果。信封贴满了也靠它腾地方。", "格子：邮筒格贴着票每回合多 1 胶水；护封格上的票什么戳都盖不上；破损格贴不上。", "邮局公告：每三回合一条全场规则（涨价、大雨、集邮节……），上一回合就会预告。"],
    ["明牌还是盲打", "明牌：TA 下一步要贴什么、贴哪、打你多少，开回合就亮给你看：两边每张票底下都写着它这回合干什么（打几、打信封几、攒胶水、加护……）；你要挨打的那格套红框写「要挨几」，你能打到的对面那格套绿框写「挨几」，打信封的合起来写在信封边上。手里的牌也摊开。适合慢慢算。", "选着手里一张票时，你这边空格里写着贴那儿会打谁、打多少，能凑组合的会亮出来。", "盲打：TA 照样提前想好了，只是不给你看。更刺激。"],
    ["几个上手小招", "开头先贴集邮攒家底，或者先上便宜的火漆把前排顶住。", "看 TA 的下一步：TA 要往哪列贴投递，你就在那一列前面放火漆。", "SSR 别急着上，等胶水够了再贴，顺手凑连张。", "快输了别慌：补票的群补、火漆的加固都能拖回合。"],
    ["远信：一路打过去", "从挑玩法页进「远信」：给一个人寄一封信，信要走一段邮路，最后一站是 TA 本人。", "信封血带着走：一场打完不回满，到驿站、岔路、邮局才回得来。", "路线：雪国、海边、旧城、夜车、花季、沙漠、雨季、山路、梦里、TA 的城市，节日那条只在节日前后开。每条一条棋盘规则，对局顶上写着。默认是 TA 照人设推荐的那条。"],
    ["护信：一波一波守住", "从挑玩法页进「护信」，先挑一档（五档，各写建议等级）：没有对手，卡组从你的邮票册里配，对面是一波一波压过来的麻烦。", "敌人贴在对面后排，一回合往前走一格；走到前排的会打你那一列，在前排站过一回合还没被打掉，下回合就闯过去撞你的信封（写着「要闯过去」）。", "守过第 10 波、场上清空就赢；信封打空就信丢了。每守住三波，信封回 5、下回合多摸一张。", "跟对局同一套：贴票、胶水、盖章、组合都照旧。你的票照样打同一列最前面那个，所以在敌人走到前排之前就能先打它。"],
    ["远信的信物", "远信路上打赢会掉材料（走主题路线掉那条路的，打赢终点掉「TA 的东西」），只在这一趟里用。", "路线图上点「做信物」：挑三样材料（能混着）、挑收信的人或陪你走的人，请 TA 做一件，花一次调用。TA 照自己的人设和你们聊过的事写名字、一两句来历、看着它说的一句话。", "效果从三样材料的偏向里挑，同一种偏向的越多越强，「TA 的东西」再加一档；做好当场就能带上，这一趟后面每一站都生效。一开始只能带一件，路上的「旧行李箱」能多开一格，最多三格。", "做过的信物都收进开头页的「信物册」。下一趟跟同一个人出发（TA 收信或陪你走），能在开头挑一件旧信物带上，占一格。"],
    ["邮局小店", "挑玩法页「和 TA 一起」里的「邮局小店」：每天先排班（柜台、分拣、送信、看店），谁擅长哪个岗会标 ✦；一个角色也能开。", "开门接客：路人招待前看 TA 要什么，挑对岗位的人或橱窗里对的卡，多给 30%，难缠的要打一局（赢了收一倍半）；没上班的角色会来当客人，可以听 TA 跟店员说两句。打烊花一次调用，写今天店里所有上班的人一小段。钱买装修，收入变多。店里的事不进记忆。"],
    ["剧情闯关：一起走一段故事", "挑玩法页「和 TA 一起」里的「剧情闯关」：挑一个人、挑个开头（或者让 TA 起一个），一共五章。", "每章 TA 先写一段，写到遇上拦路的对手；你用卡跟它打一场，打完挑一条路往下走。打赢打输、选哪条路，后面的走向和结局都会跟着变。第五章打完 TA 写结局，整段收进故事集。每章花一次调用，结局一次。走到一半退出，下次接着。"],
    ["接力：你一回合、TA 一回合", "挑玩法页「和 TA 一起」里的「接力」：挑一个人，你们轮流下同一块棋盘打审查局，单数回合你下、双数回合 TA 下。", "TA 那回合照自己的性子出牌：护短的先顶前排，好胜的抢着贴投递，冷淡的一回合最多贴两张，温柔的有人受伤先上补票。信封是你们共用的，卡组多从 TA 的卡里来。能边打边跟 TA 说话，打完能听 TA 评一把。"],
    ["死信：找最好的一手", "怎么算：每张票只打自己这一列、对面最靠前的那张（后排的票打的也是对面前排），这一列空了才打信封；寄出后按格子上的小圆号依次出手——前排从左到右，再中排、后排，所以同一列前面的先把对面那张打掉，后面的就打下一张或信封。目标后面写着「现在寄出能打多少」，摆一张看一眼；选着手里一张时空格上写着贴那儿会打谁、打多少。「有几种放法都能打满」是把所有放法都试过、正好打到最高的有几种（换个等效的格子也算一种）。", "挑玩法页进「死信」：30 关，一关一关开，人人题目一样；30 关全过了接着打「无限关」（难度封顶，记最远第几关）。另有「每日死信」：一天一题、每个人的都不一样，连着解有连续天数。每关棋盘、手牌、胶水都摆好了，只有这一回合，寄出时要把对面信封打空。", "对面信封正好是这一手最好能打出的伤害，所以得找到最好的放法：贴哪几张、贴哪格（连张、后排、组合）、先给谁盖章。随手往空格里贴的那种放法一定不够。", "卡住了点「提示」，一次给一步；「重来」把这一关摆回原样。"],
    ["邮区巡查：自己挑路", "挑玩法页进「邮区巡查」：一张 5×5 的地图，每周自动换一张、每个人的都不一样。从最下面中间出发，只能走到上下左右挨着的格子，走到哪翻开到哪，一共 14 步。", "格子：普通仗、硬仗、宝箱、岔路、驿站，最上面一排藏着巡查长。信封血一路带着，驿站回 15。打赢、开宝箱、打倒巡查长加分；打输了算败退：信封留 1 点、扣 2 步，接着走。步数用完、打倒巡查长或者提前收工就结束，这周记最高分。"],
    ["邮局值班：买票凑阵容", "挑玩法页进「邮局值班」：开局没票、10 枚邮花。每一轮先在柜台买票（R 2、SR 3、SSR 5 枚，刷新 1 枚），买进值班卡组。", "同一张票买两份合成「＋」（攻击 +2、血 +3），最多「＋＋」；同一个人的票凑满 3 张，这个人的票攻击 +1。点值班卡组里一张能卖，退一半。", "买好点「开打」跟这一轮的审查局打一局，最多 8 回合；输了掉一条命，一共三条，撑满八轮算完成。每轮收入 5 枚，手上每攒 5 枚多给 1 枚利息（最多 3）。中途退出，下次点进来接着值。"],
    ["封缄令：自己加难度", "挑玩法页进「封缄令」：对面是等级固定的审查局。先勾难度条（对面攻击 +2、你少 1 胶水、不能撕票……），每条有分。", "打赢了，勾的分加起来就是这一把的「危险」，记最高的。打输不扣分。勾的那几条打的时候写在「下一步」那块上。"],
    ["积压件：冲伤害", "挑玩法页进「积压件」：对面是打不死的邮政总局，比你打出多少伤害（打人、打信封都算）。分「8 回合」和「无尽（打到你信封空）」两种，各记最高分。", "总局每回合派人顶在前排；第 4、第 7 回合换阶段，人更多、更硬。总局每回合还盖一记大章砸你的信封，明牌会算进「你的信封要挨」。", "封条：有的人贴着封条（签上写「封条·」），封着的时候怎么打都只掉 1。用邮戳打到它、或盖章打到它，封条撕开，接下来两回合虚弱（「虚弱·」）、挨打翻倍。先撕封条再集火最划算。"],
    ["挑战陪打", "护信、积压件、封缄令、邮局值班开始前，在「谁陪你打」挑一个人。打的时候底下聊天条是跟 TA 说的：问这张放哪、先打谁，或者点「帮我看看这一步」。打完点「听 TA 评评这一把」；值班柜台能问 TA 买哪张。说一句花一次调用。"],
    ["小物册", "有人陪你打（对局的对手、挑战里陪打的人、远信里陪你走和收信的人），打完会掉 TA 的小包裹：赢了必掉，输了一半几率。", "在挑玩法页「小物册」里拆，花一次调用：TA 留一样跟你们有关的小东西，写名字、来历和 TA 看着它说的话，不会跟以前的重样。只是收着，不加数值。"],
    ["奖励", "每天第一次赢任何玩法给一点印泥和邮资；各玩法的里程碑（护信每一档、封缄令危险、积压件伤害、无尽回合、远信等级）第一次达成另给一笔，只给一次。挑玩法页的「战功邮戳」能看拿过哪些。"],
    ["打完以后", "选「再来一把」接着打，或者「结束」。结束时问要不要让 TA 记得，记的话这几把合成一句进 TA 的记忆。", "打到一半想走，直接返回就行，会存着。下次进来点「接着打」。", "手牌上面那条能跟 TA 聊天，你说一句 TA 回几句，发一句花一次调用。"]
  ];
  const fz = n => "calc(" + n + "px * var(--app-fs, 1))";
  const F = typeof F_BODY !== "undefined" ? F_BODY : "inherit";
  const FD = typeof F_DISPLAY !== "undefined" ? F_DISPLAY : F;
  // 邮票的齿孔边：跟邮票册那枚同一个画法
  const perf = bg => "radial-gradient(circle at 4px 4px, transparent 2.6px, " + bg + " 2.8px) -4px -4px / 7px 7px";
  // 集邮社各页共用的区块（她 2026-11-08「这一批新界面弄好看点」）：一块信纸，顶上一条同色斜纹边；标题前斜贴一枚小票
  const secBox = (c, extra) => Object.assign({ position: "relative", marginBottom: 12, padding: "16px 14px 12px", borderRadius: 6,
    background: "repeating-linear-gradient(135deg, " + c + " 0 8px, transparent 8px 14px) top / 100% 5px no-repeat, linear-gradient(#fffdf8, #fbf5e8)", boxShadow: "0 2px 10px rgba(47,42,34,.12)", border: "1px solid rgba(47,42,34,.06)" }, extra || {});
  const secTitle = (c, glyph, title, note) => h("div", { className: "flex items-center", style: { gap: 9, marginBottom: 9 } },
    h("span", { style: { width: 24, height: 28, padding: 2, flexShrink: 0, background: perf(PAPER), transform: "rotate(-6deg)", filter: "drop-shadow(0 1px 2px rgba(47,42,34,.25))" } },
      h("span", { style: { display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: c, color: "#fff", fontFamily: FD, fontSize: fz(11) } }, glyph)),
    h("span", { style: { fontFamily: FD, fontSize: fz(15), color: INK } }, title), note ? h("span", { style: { marginLeft: "auto", fontSize: fz(11), color: SUB } }, note) : null);
  // 顶上那一排数字格
  const statRow = (list, c) => h("div", { className: "flex", style: { gap: 8, marginBottom: 12 } }, list.map(([k, v, c2]) => h("div", { key: k, style: { flex: 1, minWidth: 0, padding: "7px 10px 6px", borderRadius: 6, background: "linear-gradient(#fffdf8, #f6eedc)", boxShadow: "0 1px 5px rgba(47,42,34,.12)", borderBottom: "2px solid " + (c2 || c) } },
    h("div", { style: { fontSize: fz(10), color: SUB, letterSpacing: ".1em" } }, k), h("div", { style: { fontFamily: FD, fontSize: fz(17), color: c2 || c, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, v))));
  // 信封边上的航空条纹
  const AIRMAIL = "repeating-linear-gradient(135deg, #b23a2e 0 10px, " + PAPER + " 10px 16px, #3f6fb0 16px 26px, " + PAPER + " 26px 32px)";
  const noThumb = () => [null, { current: null }];
  // 特效（她 2026-11-07「做一些特效」）：寄出以后按这一回合的记录一步步放——挨打的票闪红、掉血数字飘起来、
  //   回血飘绿、觉醒和盖章整张发金光、中间弹一句台词、信封挨打时整个抖一下。只是放给她看，结算早就算完了
  const FX_CSS = "@keyframes duelPulse{0%,100%{opacity:.95}50%{opacity:.45}}@keyframes duelHit{0%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}100%{transform:translateX(0)}}"
    + "@keyframes duelFloat{0%{opacity:0;transform:translate(-50%,0) scale(.8)}20%{opacity:1;transform:translate(-50%,-6px) scale(1.15)}100%{opacity:0;transform:translate(-50%,-26px) scale(1)}}"
    + "@keyframes duelGlow{0%{box-shadow:0 0 0 0 rgba(255,207,107,.0)}40%{box-shadow:0 0 14px 5px rgba(255,207,107,.95)}100%{box-shadow:0 0 0 0 rgba(255,207,107,0)}}"
    + "@keyframes diaryOlder{0%{transform:perspective(900px) rotateY(-35deg) translateX(30px);opacity:0}100%{transform:none;opacity:1}}@keyframes diaryNewer{0%{transform:perspective(900px) rotateY(35deg) translateX(-30px);opacity:0}100%{transform:none;opacity:1}}"
    + "@keyframes duelSweep{0%{transform:translate(-120%,-50%) skewX(-12deg);opacity:0}14%{transform:translate(-50%,-50%) skewX(-12deg);opacity:1}78%{transform:translate(-46%,-50%) skewX(-12deg);opacity:1}100%{transform:translate(130%,-50%) skewX(-12deg);opacity:0}}"
    + "@keyframes duelSweepTxt{0%{letter-spacing:.6em;opacity:0}20%{letter-spacing:.08em;opacity:1}100%{letter-spacing:.02em}}"
    + "@keyframes duelShine{0%{left:-40%}100%{left:140%}}"
    + "@keyframes duelPop{0%{transform:scale(.4) rotate(-8deg);opacity:0}60%{transform:scale(1.08) rotate(2deg);opacity:1}100%{transform:scale(1) rotate(0)}}"
    + "@keyframes duelBanner{0%{opacity:0;transform:translate(-50%,-40%) scale(.9)}15%{opacity:1;transform:translate(-50%,-50%) scale(1)}85%{opacity:1}100%{opacity:0;transform:translate(-50%,-56%)}}"
    + "@keyframes duelInk{0%{transform:scale(2.2) rotate(-20deg);opacity:0}50%{transform:scale(.9) rotate(-8deg);opacity:1}100%{transform:scale(1) rotate(-8deg);opacity:1}}";
  const FX_COLOR = { hit: RED, heal: GREEN, gain: "#3f6fb0", wake: "#c8962e", stamp: "#c8962e", ink: "#6a4f8a", place: INK, fall: RED, skip: SUB };
  // 一条记录落在哪一边：挨打、掉了落在挨的那一边，别的落在动手那一边
  const fxSide = l => (l.kind === "hit" ? (l.who === "me" ? "foe" : "me") : l.who);

  // 一枚贴在信封上的票（或手里的一张）：卡面、稀有度、作用、名字、是谁的卡、攻击／血、章
  // 长按看这张票的底细（她 2026-11-08「长按我的和对手的卡可以看到技能特质」）：按住半秒弹出，松手那一下不算点
  function useLongPress(onLong, onTap) {
    const tm = useRef(0), fired = useRef(false), xy = useRef(null);
    const clear = () => { clearTimeout(tm.current); tm.current = 0; };
    return {
      onPointerDown: e => { fired.current = false; xy.current = [e.clientX, e.clientY]; clear(); if (onLong) tm.current = setTimeout(() => { fired.current = true; onLong(); }, 450); },
      onPointerMove: e => { if (xy.current && Math.abs(e.clientX - xy.current[0]) + Math.abs(e.clientY - xy.current[1]) > 10) clear(); },
      onPointerUp: clear, onPointerLeave: clear, onPointerCancel: clear,
      onContextMenu: e => { e.preventDefault(); },
      onClick: e => { if (fired.current) { fired.current = false; return; } onTap && onTap(e); }
    };
  }
  // 大招横幅里那张整张放大的卡面（她 2026-11-08「要整个卡面和图放大」）
  function CutFace({ card, useThumb, ssr }) {
    const [url, el] = (useThumb || noThumb)(card ? (card.cover || card.face) : null);
    const name = card && card.text && card.text.name || "";
    return h("div", { ref: el, style: { width: "100%", aspectRatio: "3 / 4", padding: 5, background: perf(PAPER), boxShadow: ssr ? "0 0 0 2px #f0c86e, 0 0 26px rgba(255,210,120,.9)" : "0 0 0 2px #9fb4ea, 0 0 22px rgba(150,180,255,.85)" } },
      h("div", { style: { width: "100%", height: "100%", background: url ? "#2a2520 center/cover no-repeat url(" + url + ")" : "linear-gradient(160deg, #efe6d2, #e2d6bd)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: fz(15), color: "#6a5f4e", textAlign: "center", padding: 8 } }, url ? null : name));
  }
  function Ticket({ u, card, owner, useThumb, sel, onTap, small, foe, terrain, wk, fx, onLong, lift }) {
    const press = useLongPress(onLong, onTap);
    const [url, el] = (useThumb || noThumb)(card ? (card.cover || card.face) : null);
    const col = RC[u.rarity] || RC.R, marks = Object.keys(u.marks || {});
    const ready = u.charge != null && u.charge >= u.need;
    return h("button", { ref: el, "data-wk": wk || "duelcell", "data-rarity": u.rarity, "data-foe": foe ? "1" : "0", "data-sel": sel ? "1" : "0", ...press, className: "active:scale-95",
      style: { position: "relative", width: "100%", aspectRatio: small ? "3 / 4" : "1 / 1", padding: 4, border: "none", background: perf(PAPER), transition: "transform .15s", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none", touchAction: "manipulation",
        transform: lift ? "translateY(" + (foe ? 12 : -12) + "px) scale(1.16) rotate(" + (foe ? 3 : -3) + "deg)" : sel ? "translateY(-4px)" : "none", zIndex: lift ? 6 : "auto", transition: "transform .22s cubic-bezier(.2,.9,.3,1.3)", animation: fx ? (fx.kind === "hit" || fx.kind === "skip" ? "duelHit .45s" : fx.kind === "place" ? "duelPop .4s" : "none") : "none", filter: lift ? "drop-shadow(0 10px 12px rgba(47,42,34,.45)) drop-shadow(0 0 6px rgba(255,207,107,.9))" : "drop-shadow(0 " + (sel ? 5 : 2) + "px " + (sel ? 6 : 3) + "px rgba(47,42,34," + (sel ? .35 : .22) + "))" } },
      h("div", { style: { position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: 2, outline: sel ? "2px solid " + RED : "1px solid " + col + "88",
        background: url ? "#2a2520 center/cover no-repeat url(" + url + ")" : "linear-gradient(160deg, #efe6d2, #e2d6bd)" } },
        !url ? h("div", { style: { position: "absolute", inset: "18% 6% 30%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: FD, fontSize: fz(small ? 10 : 10.5), color: "#6a5f4e", lineHeight: 1.25, overflow: "hidden" } }, u.name) : null,
        // 左上稀有度、右上作用
        h("span", { style: { position: "absolute", left: 3, top: 3, padding: "0 4px", borderRadius: 3, background: col, color: "#fff", fontFamily: F, fontSize: fz(8.5), fontWeight: 700 } }, u.rarity),
        h("span", { "data-wk": "duelrole", style: { position: "absolute", right: 3, top: 3, padding: "0 4px", borderRadius: 3, background: ROLE_COLOR[u.role], color: "#fff", fontFamily: F, fontSize: fz(8.5) } }, u.role),
        // 手里的票：右上角下面印面值，像真邮票的面额
        small ? h("span", { style: { position: "absolute", right: 4, top: 19, fontFamily: FD, fontSize: fz(15), fontWeight: 700, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,.6)" } }, u.face) : null,
        marks.length ? h("div", { style: { position: "absolute", left: 3, top: 20, display: "flex", flexDirection: "column", gap: 2 } }, marks.map(m => h("span", { key: m, style: { padding: "0 3px", borderRadius: 999, border: "1px solid " + RED, color: RED, background: "rgba(251,246,234,.92)", fontSize: fz(8) } }, m))) : null,
        // 底下：名字、谁的卡、攻击和血
        h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "12px 4px 3px", background: "linear-gradient(transparent, rgba(20,16,12,.78))", color: "#fff", fontFamily: F } },
          h("div", { style: { fontSize: fz(small ? 9.5 : 9), lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, url ? u.name : ""),
          h("div", { style: { fontSize: fz(8), opacity: .82, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, owner || "通用票"),
          h("div", { className: "flex items-center", style: { gap: 5, fontSize: fz(9), marginTop: 1 } },
            h("span", null, "⚔" + u.pow),
            h("span", null, "♥" + Math.max(0, u.hp != null ? u.hp : u.maxHp) + (u.shield ? "·🛡" + u.shield : "")),
            u.charge != null ? h("span", { className: "flex", style: { marginLeft: "auto", gap: 2 } }, Array.from({ length: u.need }, (_, k) => h("i", { key: k, style: { width: 5, height: 5, borderRadius: 999, background: k < u.charge ? (ready ? "#ffcf6b" : "#fff") : "rgba(255,255,255,.3)" } }))) : null)),
        ready ? h("div", { style: { position: "absolute", inset: 0, boxShadow: "inset 0 0 0 2px #ffcf6b", pointerEvents: "none" } }) : null,
        fx && fx.kind === "hit" ? h("div", { style: { position: "absolute", inset: 0, background: "rgba(178,58,46,.38)", pointerEvents: "none" } }) : null,
        fx && fx.kind === "ink" ? h("div", { style: { position: "absolute", left: "22%", top: "22%", width: "56%", height: "56%", borderRadius: 999, border: "3px double " + FX_COLOR.ink, color: FX_COLOR.ink, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: fz(11), background: "rgba(251,246,234,.7)", animation: "duelInk .5s forwards", pointerEvents: "none" } }, fx.ink || "戳") : null),
      fx && (fx.kind === "wake" || fx.kind === "stamp") ? h("div", { style: { position: "absolute", inset: 2, borderRadius: 3, animation: "duelGlow .9s", pointerEvents: "none" } }) : null,
      fx && fx.txt ? h("span", { "data-wk": "duelfloat", style: { position: "absolute", left: "50%", top: "30%", fontFamily: FD, fontWeight: 700, fontSize: fz(16), color: FX_COLOR[fx.kind] || INK, textShadow: "0 1px 0 #fff, 0 0 4px #fff", animation: "duelFloat .8s forwards", pointerEvents: "none", zIndex: 2 } }, fx.txt) : null,
      terrain ? h("span", { style: { position: "absolute", left: "50%", bottom: -8, transform: "translateX(-50%)", padding: "0 4px", borderRadius: 3, background: PAPER, color: GREEN, fontFamily: F, fontSize: fz(8) } }, terrain) : null);
  }
  function EmptySlot({ terrain, onTap, armed }) {
    const broken = terrain === "破损" || terrain === "冰封";
    return h("button", { "data-wk": "duelcell", "data-empty": "1", onClick: onTap, className: "active:opacity-70",
      style: { position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: 3, border: "1.5px dashed " + (armed && !broken ? RED : "rgba(47,42,34,.25)"),
        background: broken ? "repeating-linear-gradient(45deg, rgba(178,58,46,.10) 0 5px, transparent 5px 10px)" : armed ? "rgba(178,58,46,.05)" : "rgba(255,255,255,.28)",
        display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F, fontSize: fz(9.5), color: broken ? RED : terrain ? GREEN : "rgba(47,42,34,.32)" } },
      terrain || (armed ? "贴这里" : ""));
  }
  // 一个信封：外圈航空条纹、里面 3×3；对面的倒过来摆，两边前排面对面
  function Envelope({ sd, foe, sel, onTap, armed, cardOf, ownerOf, useThumb, fx, onLong }) {
    const fxOf = i => fx && fx.side === (foe ? "foe" : "me") && (fx.slot === i || (fx.slots || []).includes(i)) ? fx : null;
    // 动手的那张拿起来（她 2026-11-08「把卡拿起来，看得到是哪张打了哪张」）
    const liftOf = i => !!(fx && fx.from && fx.from.who === (foe ? "foe" : "me") && fx.from.slot === i && fx.kind !== "place");
    const order = foe ? [6, 7, 8, 3, 4, 5, 0, 1, 2] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
    return h("div", { "data-wk": "duelboard", "data-foe": foe ? "1" : "0", style: { padding: 5, borderRadius: 6, background: AIRMAIL, maxWidth: 300, margin: "0 auto", boxShadow: "0 2px 6px rgba(47,42,34,.18)", position: "relative",
      animation: fx && fx.kind === "hitEnv" && fx.side === (foe ? "foe" : "me") ? "duelHit .5s" : "none" } },
      fx && fx.kind === "hitEnv" && fx.side === (foe ? "foe" : "me") ? h("span", { style: { position: "absolute", left: "50%", top: "40%", zIndex: 3, fontFamily: FD, fontWeight: 700, fontSize: fz(24), color: RED, textShadow: "0 1px 0 #fff, 0 0 6px #fff", animation: "duelFloat .9s forwards", pointerEvents: "none" } }, "-" + fx.n) : null,
      h("div", { style: { position: "relative", padding: "10px 9px", borderRadius: 3, background: PAPER } },
        h("div", { style: { position: "absolute", left: 3, [foe ? "bottom" : "top"]: 2, fontFamily: F, fontSize: fz(8), color: SUB } }, "前排"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 9 } },
          order.map(i => { const u = sd.board[i];
            const f = fxOf(i);
            if (!u && f && f.kind === "fall") return h("div", { key: i, "data-slot": i, style: { position: "relative" } }, h(EmptySlot, { terrain: sd.terrain[i], onTap: () => onTap(i) }), h("span", { style: { position: "absolute", left: "50%", top: "30%", fontFamily: FD, fontSize: fz(12), color: RED, animation: "duelFloat .9s forwards", whiteSpace: "nowrap" } }, "掉了"));
            return h("div", { key: i, "data-slot": i }, u ? h(Ticket, { u, card: cardOf(u.cardId), owner: ownerOf(u.charId), useThumb, sel: sel === i, onTap: () => onTap(i), onLong: onLong ? () => onLong(u, foe, sd.terrain[i]) : null, fx: f, lift: liftOf(i), foe, terrain: sd.terrain[i] })
              : h(EmptySlot, { terrain: sd.terrain[i], onTap: () => onTap(i), armed: armed && !foe })); }))));
  }
  // 明牌时的虚线（她 2026-11-08「不止是文字说」）：对面每张会出手的票，从它那格拉一条虚线到要打的那格；
  //   打信封的指到你信封底下。选着手里一张票时，你这边每个空格写上「贴这儿会打谁、多少」
  // 明牌时对面要打哪儿（她 2026-11-08「不止是文字说」→ 先画了虚线，她：「这一堆虚线看得出来个鬼」）：
  //   对面只打同一列，不用拉线——直接在要挨打的那格套红框、写「要挨 5」，打信封的合起来写在你信封底下；
  //   对面会出手的那张标「出手 ↓」，这回合才贴的那格写「要贴这儿」。选着手里一张票时空格写「贴这儿打谁」
  // 明牌时两边每张票这回合干什么（她 2026-11-08：先画虚线「看不出来个鬼」→ 改红框只标了挨打的那格 →
  //   「看不到他另外两张卡打多少，或者我能打他多少」）：每张票底下一颗签写它要干嘛；
  //   你这边要挨打的格子套红框写「要挨几」，你要打到的对面那格套绿框写「挨几」；打信封的合起来写在信封边上
  function AimLayer({ host, foeAims, meAims, foeActs, meActs, foeStamps, myPrev, tick, order }) {
    const [g, setG] = useState(null);
    useLayoutEffect(() => {
      const el = host.current; if (!el) return;
      const run = () => {
        const b = el.getBoundingClientRect(), box = (foe, i) => { const c = el.querySelector('[data-wk="duelboard"][data-foe="' + (foe ? 1 : 0) + '"] [data-slot="' + i + '"]'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }; };
        const sum = list => { const hit = {}; let env = 0; (list || []).forEach(a => { if (a.kind === "env") env += a.dmg || 0; else { const t = hit[a.to] = hit[a.to] || { dmg: 0, inks: [] }; if (a.kind === "ink") t.inks.push(a.ink); t.dmg += a.dmg || 0; } }); return { hit, env }; };
        const fa = sum(foeAims), ma = sum(meAims), stamped = {}; (foeStamps || []).forEach(x => { stamped[x.slot] = 1; });
        const planned = {}; (foeAims || []).forEach(a => { if (a.planned) planned[a.from] = 1; });
        const brd = foe => { const e = el.querySelector('[data-wk="duelboard"][data-foe="' + (foe ? 1 : 0) + '"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left - b.left + r.width / 2, top: r.top - b.top, bottom: r.bottom - b.top }; };
        const mb = brd(false), fb = brd(true), tags = [], acts = [];
        Object.keys(fa.hit).forEach(k => { const at = box(false, +k); if (at) tags.push({ at, t: fa.hit[k], c: RED, pre: "要挨 " }); });
        Object.keys(ma.hit).forEach(k => { const at = box(true, +k); if (at) tags.push({ at, t: ma.hit[k], c: GREEN, pre: "挨 " }); });
        Object.keys(foeActs || {}).forEach(k => { const at = box(true, +k), t = foeActs[k]; if (at && t) acts.push({ at, txt: (planned[k] ? "新贴·" : "") + (stamped[k] ? "盖章·" : "") + t, c: stamped[k] ? "#b8862a" : RED }); });
        Object.keys(meActs || {}).forEach(k => { const at = box(false, +k), t = meActs[k]; if (at && t) acts.push({ at, txt: t, c: GREEN }); });
        setG({ w: b.width, h: b.height, tags, acts,
          envMe: fa.env && mb ? { x: mb.x, y: mb.bottom, n: fa.env } : null, envFoe: ma.env && fb ? { x: fb.x, y: fb.top, n: ma.env } : null,
          badges: (myPrev || []).map(pv => ({ at: box(false, pv.slot), pv })).filter(x => x.at),
          // 死信：自己这边每张票的出手顺序（前排从左到右，再往后排）
          order: order ? order.map((sl, k) => ({ at: box(false, sl), n: k + 1 })).filter(x => x.at) : [] });
      };
      run(); const t = setTimeout(run, 120); window.addEventListener("resize", run);
      return () => { clearTimeout(t); window.removeEventListener("resize", run); };
    }, [tick]);
    if (!g) return null;
    const pill = (bg, txt) => h("span", { style: { display: "inline-block", padding: "0 6px", borderRadius: 999, background: bg, color: "#fff", fontFamily: FD, fontSize: fz(10.5), lineHeight: "18px", whiteSpace: "nowrap", boxShadow: "0 1px 3px rgba(0,0,0,.3)" } }, txt);
    return h("div", { "data-wk": "duelaims", style: { position: "absolute", left: 0, top: 0, width: g.w, height: g.h, pointerEvents: "none", zIndex: 4 } },
      g.tags.map((t, k) => h("div", { key: "t" + k, "data-wk": "duelwillhit", style: { position: "absolute", left: t.at.x - 2, top: t.at.y - 2, width: t.at.w + 4, height: t.at.h + 4, borderRadius: 5, border: "2px solid " + t.c, animation: "duelPulse 1.4s ease-in-out infinite" } },
        h("div", { style: { position: "absolute", left: 0, right: 0, top: -9, textAlign: "center" } }, pill(t.c, [t.t.dmg ? t.pre + t.t.dmg : "", t.t.inks.length ? "盖" + t.t.inks.join("、") : ""].filter(Boolean).join(" · "))))),
      g.acts.map((a, k) => h("div", { key: "a" + k, "data-wk": "duelact", style: { position: "absolute", left: a.at.x, top: a.at.y + a.at.h - 9, width: a.at.w, textAlign: "center" } }, pill(a.c, a.txt))),
      g.envMe ? h("div", { key: "em", "data-wk": "duelwillhit", style: { position: "absolute", left: g.envMe.x, top: g.envMe.y - 9, transform: "translateX(-50%)" } }, pill(RED, "你的信封要挨 " + g.envMe.n)) : null,
      g.envFoe ? h("div", { key: "ef", "data-wk": "duelwillhit", style: { position: "absolute", left: g.envFoe.x, top: g.envFoe.y - 9, transform: "translateX(-50%)" } }, pill(GREEN, "TA 的信封要挨 " + g.envFoe.n)) : null,
      (g.order || []).map(o => h("div", { key: "o" + o.n, "data-wk": "duelorder", style: { position: "absolute", left: o.at.x - 6, top: o.at.y - 6, width: 18, height: 18, borderRadius: 99, background: "#6a5a3a", color: "#fff", fontFamily: FD, fontSize: fz(10.5), lineHeight: "18px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,.3)" } }, o.n)),
      g.badges.map((bd, k) => { const pv = bd.pv, a = pv.aim, txt = !a ? "" : a.kind === "ink" ? "盖" + a.ink + "·打 " + a.dmg : a.kind === "env" ? "打信封 " + a.dmg : "打 " + a.dmg;
        return h("div", { key: "b" + k, "data-wk": "duelpreview", style: { position: "absolute", left: bd.at.x, top: bd.at.y + 4, width: bd.at.w, textAlign: "center", fontSize: fz(9.5), lineHeight: 1.3, color: GREEN, fontFamily: F } },
          txt ? h("div", null, txt) : null, pv.combo.length ? h("div", { style: { color: "#c8962e", fontFamily: FD } }, pv.combo.join("＋") + "！") : null); }));
  }
  const Seal = (label, hp, max, color, sub) => h("div", { "data-wk": "duelhp", className: "flex items-center", style: { gap: 8, fontFamily: F, color: INK, margin: "4px 2px" } },
    h("div", { style: { width: 26, height: 26, borderRadius: 999, background: "radial-gradient(circle at 35% 30%, " + color + "dd, " + color + ")", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: fz(11), boxShadow: "0 1px 3px rgba(0,0,0,.25)" } }, label.slice(0, 1)),
    h("div", { className: "flex-1 min-w-0" },
      h("div", { className: "flex", style: { fontSize: fz(11.5), justifyContent: "space-between" } }, h("span", null, label, sub ? h("span", { style: { color: SUB, marginLeft: 6, fontSize: fz(10.5) } }, sub) : null), h("span", { style: { fontFamily: FD } }, Math.max(0, hp) + " / " + max)),
      h("div", { style: { height: 5, borderRadius: 3, marginTop: 3, background: "rgba(47,42,34,.12)", overflow: "hidden" } }, h("div", { style: { width: Math.max(0, 100 * hp / max) + "%", height: "100%", background: color, transition: "width .4s" } }))));
  const btn = (bg, fg, line) => ({ padding: "7px 14px", borderRadius: 4, background: bg, color: fg, border: line ? "1px solid " + line : "none", fontFamily: F, fontSize: fz(12.5) });

  // runBattle（远信那一层递进来）：直接开这一场，不走开局页；打完只有「继续」，交回 runBattle.onDone
  // 长按一张票的底细卡：对局和远信共用这一份（她 2026-11-08「选上路的时候长按也能看到卡面数值介绍那一堆」）
  function StampInfo({ u, foe, terrain, live, bonds, cardOf, ownerOf, nameOf, useThumb, onClose }) {
        const inf = D().unitInfo(u, bonds), col = RC[u.rarity] || RC.R, info = { foe, terrain }, setInfo = onClose;
        cardOf = cardOf || (() => null); ownerOf = ownerOf || (() => ""); nameOf = nameOf || ownerOf;
        // 底细卡（她 2026-11-08「这个页面也做好看点」）：像一张夹着邮票的明信片——左边斜贴着那枚票，右边写名字和面额；
        //   下面一排数值像邮局的小标签，再往下一条条说明，最底下是卡上那句话
        const stat = (k, v) => h("div", { style: { flex: 1, minWidth: 0, padding: "5px 0 4px", borderRadius: 3, background: "rgba(47,42,34,.05)", border: "1px solid rgba(47,42,34,.1)", textAlign: "center" } },
          h("div", { style: { fontFamily: FD, fontSize: fz(17), lineHeight: 1.1 } }, v), h("div", { style: { fontSize: fz(9.5), color: SUB, letterSpacing: ".1em" } }, k));
        const sec = (tag, c, title, body) => h("div", { style: { display: "flex", gap: 10, padding: "9px 0", borderTop: "1px dashed rgba(47,42,34,.16)" } },
          h("div", { style: { width: 34, flexShrink: 0, paddingTop: 1 } }, h("div", { style: { width: 34, height: 34, borderRadius: 999, border: "1.5px solid " + c, color: c, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: fz(11), transform: "rotate(-8deg)", background: "rgba(255,255,255,.5)" } }, tag)),
          h("div", { className: "min-w-0", style: { flex: 1 } }, title ? h("div", { style: { fontFamily: FD, fontSize: fz(13.5), color: c } }, title) : null, h("div", { style: { fontSize: fz(12), color: INK, lineHeight: 1.6 } }, body)));
        return h("div", { "data-wk": "duelinfo", onClick: () => setInfo(null), style: { position: "absolute", inset: 0, zIndex: 30, background: "rgba(30,24,18,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
          h("div", { onClick: e => e.stopPropagation(), style: { position: "relative", width: "100%", maxWidth: 350, maxHeight: "86%", display: "flex", flexDirection: "column", borderRadius: 6, background: PAPER, fontFamily: F, color: INK, boxShadow: "0 14px 36px rgba(0,0,0,.35)", overflow: "hidden" } },
            h("div", { style: { height: 7, flexShrink: 0, background: AIRMAIL } }),
            h("button", { onClick: () => setInfo(null), "aria-label": "关掉", style: { position: "absolute", right: 8, top: 12, width: 28, height: 28, borderRadius: 999, color: SUB, fontSize: fz(16), zIndex: 2 } }, "✕"),
            h("div", { style: { overflowY: "auto", padding: "14px 16px 12px" } },
              h("div", { className: "flex", style: { gap: 14, alignItems: "flex-start" } },
                h("div", { style: { width: 104, flexShrink: 0, transform: "rotate(-3deg)", marginTop: 4 } }, h(Ticket, { u, card: cardOf(u.cardId), owner: ownerOf(u.charId), useThumb, small: true, foe: info.foe })),
                h("div", { className: "min-w-0", style: { flex: 1, paddingRight: 22 } },
                  h("div", { style: { fontSize: fz(10), color: info.foe ? RED : GREEN, letterSpacing: ".15em" } }, info.foe ? "对面的票" : "我的票"),
                  h("div", { style: { fontFamily: FD, fontSize: fz(18), lineHeight: 1.3, margin: "2px 0 6px" } }, u.name),
                  h("div", { className: "flex flex-wrap", style: { gap: 5 } },
                    h("span", { style: { padding: "1px 7px", borderRadius: 3, background: col, color: "#fff", fontSize: fz(10.5) } }, u.rarity),
                    h("span", { style: { padding: "1px 7px", borderRadius: 3, background: ROLE_COLOR[u.role], color: "#fff", fontSize: fz(10.5) } }, u.role),
                    h("span", { style: { padding: "1px 7px", borderRadius: 3, border: "1px solid rgba(47,42,34,.3)", fontSize: fz(10.5) } }, ownerOf(u.charId) || "通用票")),
                  // 面额：右下角一个圆章
                  h("div", { style: { marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, fontSize: fz(11), color: SUB } },
                    h("span", { style: { width: 30, height: 30, borderRadius: 999, border: "2px solid " + col, color: col, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: fz(14) } }, u.face), "面值 · 贴它要的胶水"))),
              h("div", { className: "flex", style: { gap: 6, margin: "14px 0 6px" } },
                stat("攻击", u.pow), stat("血", (live ? Math.max(0, u.hp) + "/" : "") + u.maxHp), stat("护", u.shield || 0), stat("章", (u.charge != null ? u.charge + "/" : "") + u.need)),
              sec("作用", ROLE_COLOR[u.role], u.role, ROLE_TIP[u.role]),
              sec("特质", "#8a7a5a", inf.trait.zh, h("span", null, inf.trait.desc, h("div", { style: { color: SUB, fontSize: fz(10.5) } }, inf.trait.from))),
              sec("盖章", "#b8862a", inf.skill.zh + (u.rarity === "SSR" ? " · " + inf.skill.base : ""), inf.skill.desc),
              inf.bond ? sec("羁绊", GREEN, inf.bond.zh, inf.bond.desc + "。" + (nameOf(u.charId) || "这个人") + "的票在同一个信封上有两张以上时生效。") : null,
              u.role === "邮戳" ? sec("戳", "#6a4f8a", "会盖「" + u.ink + "」", (D().MARKS[u.ink] || {}).note || "") : null,
              Object.keys(u.marks || {}).length ? sec("身上", RED, "挂着的戳", Object.keys(u.marks).map(m => m + "：" + ((D().MARKS[m] || {}).note || "")).join("；")) : null,
              info.terrain ? sec("格子", "#5a5248", info.terrain, D().TERRAIN[info.terrain]) : null,
              u.lines && u.lines.enter ? h("div", { style: { marginTop: 6, padding: "10px 12px", borderRadius: 3, background: "rgba(47,42,34,.05)", borderLeft: "3px solid " + col, fontFamily: FD, fontSize: fz(12.5), color: "#5a4f40", lineHeight: 1.7 } }, "「" + u.lines.enter + "」") : null)));
  }
  function StampDuelPage({ characters, cards: cardsAll, onBack, onRemember, closeOf, meName, toast, useThumb, onChat, onReport, preset, onRun, runBattle, initialMode, onEntryBack, onShop3D }) {
    const cards = Dispatch.filter(cardsAll);   // 派遣在外的票这段时间不能上场
    const [dpPick, setDpPick] = useState([]), [dpPlace, setDpPlace] = useState("海边"), [dpHours, setDpHours] = useState(4), [dpBusy, setDpBusy] = useState(""), [dpShow, setDpShow] = useState(""), [, dpBump] = useState(0);
    const [foeId, setFoeId] = useState(() => { if (runBattle) return runBattle.foeId || ""; if (preset && preset.foeId) return preset.foeId; const has = (characters || []).find(c => (cards || []).some(x => x.charId === c.id)); return (has || (characters || [])[0] || {}).id; });
    const [blind, setBlind] = useState(false);
    const [st, setSt] = useState(() => { if (!runBattle) return null;
      const b = runBattle, x = D().newDuel(b.meDeck, b.foeDeck, b.seed, b); x.run = true; x.events = x.events || []; return x; });
    const [, bump] = useState(0);
    const [handSel, setHandSel] = useState(-1), [boardSel, setBoardSel] = useState(-1);
    const [series, setSeries] = useState(null), [asking, setAsking] = useState(false);
    const [cut, setCut] = useState(null), [fx, setFx] = useState(null), [banner, setBanner] = useState(null), playing = useRef(0), [bubble, setBubble] = useState(null);
    const lastBubble = useRef(0);   // 钩子都放在这儿：下面有几处提前 return，钩子不许跟着条件走
    // 滑到下面点寄出，页面别自己跳回顶上（她 2026-11-08）：记住她手指滑到的位置；
    //   每次重画以后，位置要是变了、而她刚才没在滑，就放回去
    //   只在「寄出、贴票、回放」这些我们自己引起重画的那一阵里看着（guard），平时她怎么滑都不管
    const bodyEl = useRef(null), keepY = useRef(0), touchAt = useRef(0), guard = useRef(0);
    const boardsEl = useRef(null);   // 两个信封外面那层，虚线量位置用
    const guarding = () => Date.now() < guard.current && Date.now() - touchAt.current > 1200;
    useLayoutEffect(() => {
      const el = bodyEl.current; if (!el || !guarding()) return;
      if (Math.abs(el.scrollTop - keepY.current) > 4) el.scrollTop = keepY.current;
    });
    const [info, setInfo] = useState(null), [guide, setGuide] = useState(false);
    // 先挑玩法（她 2026-11-08「点对战先出个选择界面：对局模式还是远信模式，再选设定」）；从聊天里点进来、远信里打仗的直接跳过
    const [mode, setMode] = useState(() => (preset || runBattle) ? "duel" : initialMode === "siege" ? "siegepick" : ["shop", "puzzle", "patrol"].includes(initialMode) ? initialMode : "");
    const [voice, setVoice0] = useState(() => { try { return Object.assign({}, VOICE_DEF, (typeof loadJSON === "function" ? loadJSON(VOICE_KEY, {}) : {}) || {}); } catch (e) { return Object.assign({}, VOICE_DEF); } });
    const [voicePanel, setVoicePanel] = useState(false);
    const setVoice = patch => setVoice0(v => { const n = Object.assign({}, v, patch); try { saveJSON(VOICE_KEY, n); } catch (e) {} return n; });
    const voiceOf = id => { const c = (characters || []).find(x => x.id === id); return (c && c.voiceId) || (typeof ttsDefaultVoice === "function" ? ttsDefaultVoice(loadTtsApi()) : ""); };
    const voiceBtn = h("button", { "data-wk": "duelvoicebtn", onClick: () => setVoicePanel(v => !v), className: "active:opacity-60", style: { padding: "4px 6px", color: voice.on ? RED : SUB, fontFamily: F, fontSize: fz(12.5) } }, voice.on ? "🔊" : "🔈");
    const guideBtn0 = h("button", { "data-wk": "duelguidebtn", onClick: () => setGuide(true), className: "active:opacity-60", style: { padding: "4px 8px", color: INK, fontFamily: F, fontSize: fz(12.5) } }, "怎么玩");
    const guideBtn = h("span", { className: "flex items-center" }, voiceBtn, guideBtn0);
    const voicePanelEl = voicePanel ? h("div", { key: "vp", "data-wk": "duelvoice", style: { margin: "4px 0 8px", padding: "10px 12px", borderRadius: 5, background: "rgba(255,253,247,.95)", boxShadow: "0 2px 8px rgba(47,42,34,.12)", fontFamily: F, fontSize: fz(12), color: INK } },
      h("label", { className: "flex items-center", style: { gap: 8, fontFamily: FD, fontSize: fz(14) } }, h("input", { type: "checkbox", "data-wk": "duelvoiceon", checked: !!voice.on, onChange: e => setVoice({ on: e.target.checked }) }), "打的时候念台词"),
      h("div", { style: { color: SUB, fontSize: fz(11), margin: "4px 0 8px", lineHeight: 1.6 } }, ttsOk() ? "票上场、盖章、觉醒、被打掉时，卡上那句台词会冒出来，开着就用这个人的声音念（声音在角色档案里设，没设用默认的）。念过的存着，再念不花钱。" : "还没配语音：去「设置 → 语音」配好才念得出来。不开也会照样显示台词。"),
      h("div", { style: { color: SUB, fontSize: fz(11), marginBottom: 4 } }, "念哪些时候的"),
      h("div", { className: "flex flex-wrap", style: { gap: 6, marginBottom: 8 } }, VOICE_KINDS.map(([k, zh]) => h("button", { key: k, "data-wk": "duelvoicekind", "data-on": voice[k] ? "1" : "0", onClick: () => setVoice({ [k]: !voice[k] }), style: { padding: "2px 10px", borderRadius: 999, border: "1px solid " + (voice[k] ? RED : "rgba(47,42,34,.25)"), color: voice[k] ? RED : SUB, background: voice[k] ? "rgba(178,58,46,.07)" : "transparent" } }, zh))),
      h("div", { style: { color: SUB, fontSize: fz(11), marginBottom: 4 } }, "念谁的票"),
      h("div", { className: "flex flex-wrap", style: { gap: 6 } }, [["foe", "对面的"], ["me", "我这边的"]].map(([k, zh]) => h("button", { key: k, "data-wk": "duelvoiceside", "data-on": voice[k] ? "1" : "0", onClick: () => setVoice({ [k]: !voice[k] }), style: { padding: "2px 10px", borderRadius: 999, border: "1px solid " + (voice[k] ? GREEN : "rgba(47,42,34,.25)"), color: voice[k] ? GREEN : SUB, background: voice[k] ? "rgba(79,122,102,.08)" : "transparent" } }, zh)))) : null;
    const openInfo = (u, foe, terrain) => { setInfo({ u, foe, terrain }); if (tutSeen && tutSeen.current) tutSeen.current.infoSeen = true; };
    const [core, setCore] = useState([]);
    // 每个人的羁绊看人设里的字（不花调用）
    const bondsOf = () => { const m = {}; (characters || []).forEach(c => { m[c.id] = D().bondOf([c.persona, c.description, c.desc, c.personality, c.tags && [].concat(c.tags).join(" ")].filter(Boolean).join(" ")); }); return m; };
    const [chatOpen, setChatOpen] = useState(false), [draft, setDraft] = useState(""), [chatBusy, setChatBusy] = useState(false);
    const seedRef = useRef(Date.now() >>> 0);
    const byId = useMemo(() => { const m = {}; (cards || []).forEach(c => { if (c && c.id) m[c.id] = c; }); return m; }, [cards]);
    const nameOf = id => { if (id === "tut_pair") return "小练"; const c = (characters || []).find(x => x.id === id); return c ? (c.remark || c.name) : ""; };
    const cardOf = id => byId[id] || null, ownerOf = id => id && nameOf(id) ? nameOf(id) + "的卡" : "";
    let foeName = (st && st.shopFight && st.shopFight.name) || (st && st.story && st.story.foe) || (st && st.relay && "审查局") || (st && st.puzzle && "死信") || (st && st.patrol && (st.patrol === "boss" ? "巡查长" : "巡查站")) || (st && st.shift && "审查局") || (st && st.edict && "审查局") || (st && st.siege && "城外") || (st && st.raid && "邮政总局") || (runBattle && runBattle.foeName) || nameOf(runBattle ? runBattle.foeId : foeId) || "TA";
    // 没打完退出去也留着（她 2026-11-07「没打完暂退能不能存档跟小游戏一样」）：每动一步就存一份，打完、放弃才清
    const SAVE_KEY = "x_stampDuelSave";
    const [saved, setSaved] = useState(() => { try { const v = typeof loadJSON === "function" ? loadJSON(SAVE_KEY, null) : null; return v && v.st && !v.st.over ? v : null; } catch (e) { return null; } });
    const persist = (x, sr) => { try { if (typeof saveJSON !== "function" || (x && (x.tutorial || x.run || x.siege || x.raid || x.edict || x.shift || x.patrol || x.puzzle || x.relay || x.story || x.shopFight)) || runBattle) return; if (x && !x.over) saveJSON(SAVE_KEY, { st: x, series: sr || null, foeId, at: Date.now() }); else saveJSON(SAVE_KEY, null); } catch (e) {} };
    const redraw = () => { persist(st, series); bump(x => x + 1); };
    const resume = () => { if (!saved) return; setFoeId(saved.foeId); setSt(saved.st); setSeries(saved.series || D().newSeries()); setSaved(null); setHandSel(-1); setBoardSel(-1); };
    const drop = () => { persist(null); setSaved(null); };
    const [tut, setTut] = useState(-1), tutSeen = useRef({ infoSeen: false });
    // 教学关用的票：照邮票册卡的样子造，名字直接写它是干嘛的
    const tutCard = (i, role, extra) => Object.assign(D().stampOf({ id: "tut_" + i, rarity: extra && extra.rarity || "R", lv: 10, text: { name: extra && extra.name || ("练习·" + role) } }), { role, trait: role === "火漆" ? "守护" : role === "投递" ? "锋利" : "冷静", traitFrom: "", skill: Object.keys(D().SKILLS[role])[0] }, extra || {});
    // 守城（她 2026-11-08「先做守城」）：不挑对手，卡组从邮票册里配，对面一波一波压过来
    const [siegeTier, setSiegeTier] = useState(0);
    const startSiege = tier0 => {
      const tier = typeof tier0 === "number" ? tier0 : siegeTier, s = (seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0);
      setSiegeTier(tier);
      const nd = D().newDuel(D().deckFrom(cards, s, D().DECK_SIZE, core), [], s, { siege: true, siegeLv: D().SIEGE_TIERS[tier], bonds: bondsOf() }); nd.siegeTier = tier;
      setSt(nd); setMode("siege"); setHandSel(-1); setBoardSel(-1); setSiegeSaved(false);
    };
    const [siegeSaved, setSiegeSaved] = useState(false);
    // 讨伐（她 2026-11-08「做讨伐吧」）：打不死的邮政总局，比打出多少伤害；normal 打满 8 回合，endless 打到信封空
    const RAID_KEY = "x_stampRaidBest";
    const raidBest = m => { try { return ((typeof loadJSON === "function" ? loadJSON(RAID_KEY, {}) : {}) || {})[m] || { dealt: 0, turn: 0 }; } catch (e) { return { dealt: 0, turn: 0 }; } };
    const [raidSaved, setRaidSaved] = useState(false);
    // 封缄令（她 2026-11-08）：开局勾难度条，打赢了勾的分就是这一把的「危险」
    const EDICT_KEY = "x_stampEdictBest";
    const [edictPick, setEdictPick] = useState([]), [edictSaved, setEdictSaved] = useState(false);
    const edictBest = () => { try { return (typeof loadJSON === "function" ? loadJSON(EDICT_KEY, null) : null) || { pts: 0, tags: [] }; } catch (e) { return { pts: 0, tags: [] }; } };
    const startEdict = tags => {
      const s = (seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0);
      const nd = D().newDuel(D().deckFrom(cards, s, D().DECK_SIZE, core), D().edictDeck(s), s, { edict: tags, fair: false, bonds: bondsOf() });
      setSt(nd); setMode("edict"); setHandSel(-1); setBoardSel(-1); setEdictSaved(false);
    };
    // 邮局值班（她 2026-11-08）：柜台买票、凑阵容、一轮一轮打；值班进度存着，退出去下次接着
    // 挑战陪打（她 2026-11-08「挑战类能不能跟他聊天，推荐怎么放、评论战局」「可以选谁陪我打」）
    const COACH_KEY = "x_stampCoach";
    const [coachId, setCoach0] = useState(() => { try { const v = typeof loadJSON === "function" ? loadJSON(COACH_KEY, null) : null; if (v != null) return v; } catch (e) {} const c = (characters || []).find(x => (cards || []).some(k => k.charId === x.id)); return c ? c.id : ""; });
    const setCoach = id => { setCoach0(id); try { saveJSON(COACH_KEY, id); } catch (e) {} };
    const [coachTip, setCoachTip] = useState(null), [coachBusy, setCoachBusy] = useState(false);
    const [tkWho, setTkWho] = useState(""), [tkBusy, setTkBusy] = useState(false), [tkOpen, setTkOpen] = useState(""), [, tkBump] = useState(0);
    // 邮区巡查（她 2026-11-08）：每个人每周一张自己的地图；进度存着，这一周里能接着走
    // 残局（她 2026-11-08）：30 关，一关一关开；过了记下来
    const PZ_KEY = "x_stampPuzzle";
    const pzDone = () => { try { return ((typeof loadJSON === "function" ? loadJSON(PZ_KEY, null) : null) || {}).solved || {}; } catch (e) { return {}; } };
    const [pzHint, setPzHint] = useState(0);
    // 每日残局（她 2026-11-08）：日期 × 各人自己的随机数，一天一题、人人不一样；难度固定在 22 关那档
    const dayKey = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
    const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    const pzDaily = () => { try { return ((typeof loadJSON === "function" ? loadJSON(PZ_KEY, null) : null) || {}).daily || {}; } catch (e) { return {}; } };
    const pzStreak = () => { const d = pzDaily(); let n = 0; for (let k = 0; k < 400; k++) { const t = new Date(Date.now() - k * 86400000), key = t.getFullYear() + "-" + (t.getMonth() + 1) + "-" + t.getDate(); if (d[key]) n++; else if (k > 0) break; } return n; };
    const startPuzzle = (lv, daily) => { const nd = daily ? D().puzzleOf(22, ((dayNum() * 2654435761) ^ patrolSalt()) >>> 0) : D().puzzleOf(lv); if (!nd) { toast && toast("这一关没出好，换一关试试"); return; } if (daily) nd.puzzle.daily = dayKey(); setPzHint(0); setSt(nd); setMode("puzzle"); setHandSel(-1); setBoardSel(-1); };
    // 接力（她 2026-11-08）：你和 TA 轮流下同一块棋盘；单数回合你、双数回合 TA（照 TA 的性子出牌）
    // 剧情闯关（她 2026-11-08）：五章，每章 TA 写一段→打一场→她选一条路；第五章打完写结局，收进故事集
    const STORY_KEY = "x_stampStory", STORIES_KEY = "x_stampStories";
    const STORY_HOOKS = ["一封寄错的信", "暴雪封路的邮局", "失踪的邮差", "最后一班夜车", "抽屉里的旧明信片", "让 TA 起一个"];
    const [story, setStory0] = useState(() => { try { const v = typeof loadJSON === "function" ? loadJSON(STORY_KEY, null) : null; return v && !v.done ? v : null; } catch (e) { return null; } });
    const setStory = v => { setStory0(v ? Object.assign({}, v) : null); try { saveJSON(STORY_KEY, v && !v.done ? v : null); } catch (e) {} };
    const [sHook, setSHook] = useState(STORY_HOOKS[0]), [sBusy, setSBusy] = useState(false), [sOpen, setSOpen] = useState("");
    const storyPast = sv0 => sv0.chapters.map((c, i) => "第 " + (i + 1) + " 章「" + c.title + "」：" + c.lines.join("").slice(0, 400) + "。拦路的是" + c.foe.name + (c.won == null ? "" : c.won ? "，她闯过去了" : "，她没闯过去") + (c.pick ? "；打完她选了：" + c.pick : "")).join("\n");
    const storyNext = async sv0 => {
      if (sBusy || !onChat) return; setSBusy(true);
      try { const end = sv0.chapters.length >= 5, r = await onChat(sv0.charId, { mode: end ? "storyend" : "storych", hook: sv0.hook, ch: sv0.chapters.length + 1, past: storyPast(sv0) });
        if (!r || !r.lines) { toast && toast("没写出来，再点一次试试"); return; }
        if (end) { sv0.ending = r; sv0.done = true; setSOpen(sv0.id); try { const all = (typeof loadJSON === "function" ? loadJSON(STORIES_KEY, []) : []) || []; all.push(Object.assign({}, sv0, { ts: Date.now() })); saveJSON(STORIES_KEY, all.slice(-50)); } catch (e) {} }
        else sv0.chapters.push(Object.assign({ won: null, pick: "" }, r));
        setStory(sv0); }
      catch (e) { toast && toast("没成：" + ((e && e.message) || e)); } finally { setSBusy(false); }
    };
    const storyFight = sv0 => {
      const c = sv0.chapters[sv0.chapters.length - 1], s = (seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0), me = D().deckFrom(cards, s, D().DECK_SIZE, [sv0.charId]);
      const foeDeck = D().edictDeck(s).map((u, k) => Object.assign(u, { name: c.foe.name + (k ? "·" + (k + 1) : "") }));
      const nd = D().newDuel(me, foeDeck, s, { foeLv: Math.max(3, Math.round(D().avgLv(me) * (0.85 + sv0.chapters.length * 0.06))), bonds: bondsOf() });
      nd.story = { foe: c.foe.name, charId: sv0.charId }; setSt(nd); setMode("story"); setHandSel(-1); setBoardSel(-1);
    };
    // 邮局小店（她 2026-11-08）：排班→开门接客→打烊（一天一次调用写所有上班的人）→明天
    const SHOP_KEY = window.StampShop.KEY;
    const [shopSt, setShop0] = useState(() => window.StampShop.read());
    const shopLatest=useRef(null);shopLatest.current={characters,cards,onChat,expected:window.StampShop.token(shopSt)};
    const shopOptions = () => shopLatest.current;
    const shopAct = async (action, options = {}) => { try { const out=await window.StampShop.run(action,{...shopOptions(),...options});setShop0(window.StampShop.read());return out;}catch(e){toast&&toast(e.message);throw e;} };
    React.useEffect(()=>{const sync=()=>setShop0(window.StampShop.read());window.addEventListener('stamp-shop-change',sync);return()=>window.removeEventListener('stamp-shop-change',sync);},[]);
    React.useEffect(()=>{if(mode!=='shop')return;const sync=()=>window.StampShop.sync(shopOptions()).then(setShop0).catch(e=>toast&&toast(e.message));sync();const id=setInterval(sync,2000);return()=>clearInterval(id);},[mode]);
    const [diaryRegs, setDiaryRegs] = useState(false), [diaryD, setDiaryD] = useState(""), [diaryFlip, setDiaryFlip] = useState(""), diaryX = useRef(0), [dpWho, setDpWho] = useState({}), [svPrice, setSvPrice] = useState("mid"), [svPick, setSvPick] = useState(""), [shBusy, setShBusy] = useState(""), [shMeet, setShMeet] = useState(null), [winF, setWinF] = useState({ who: "", rar: "", q: "" }), [dpF, setDpF] = useState({ who: "", rar: "", q: "" }), [bgPost, setBgPost] = useState(""), [bgF, setBgF] = useState({ who: "", rar: "", q: "" });
    // 挑卡的筛选条（橱窗、派遣共用，她 2026-11-08「派遣那页挑卡也加个筛选」）：搜卡名、按人、按稀有度
    const cardFilterHit = (f,k) => window.StampShop.filterCards([k],f).length>0;
    const cardFilterBar = (f,setF,wk,noWho,fit) => h(window.StampShopFilters,{characters,cards,filter:f,onChange:setF,wk,noWho,fit});
    const RANK = { SSR: 3, SR: 2, R: 1 }, cardSort = (a, b) => (RANK[b.rarity] || 0) - (RANK[a.rarity] || 0) || (Number(b.lv) || 0) - (Number(a.lv) || 0);
    const personaOf = id => { const c = (characters || []).find(x => x.id === id) || {}; return [c.persona, c.description, c.desc, c.personality].filter(Boolean).join(" "); };
    const RELAY_KEY = "x_stampRelay";
    const relayRec = () => { try { return (typeof loadJSON === "function" ? loadJSON(RELAY_KEY, null) : null) || {}; } catch (e) { return {}; } };
    const startRelay = () => {
      if (!coachId) { toast && toast("先挑一个人跟你接力"); return; }
      const s = (seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0), me = D().deckFrom(cards, s, D().DECK_SIZE, [coachId]);
      const nd = D().newDuel(me, D().edictDeck(s), s, { foeLv: Math.max(3, Math.round(D().avgLv(me) * 1.05)), bonds: bondsOf() });
      nd.relay = { ta: coachId, style: bondsOf()[coachId] || "默契" }; setSt(nd); setMode("relay"); setHandSel(-1); setBoardSel(-1);
    };
    const PATROL_KEY = "x_stampPatrol", PATROL_BEST = "x_stampPatrolBest", PATROL_SALT = "x_stampPatrolSalt";
    const patrolSalt = () => window.StampShop.seed();
    const [patrol, setPatrol0] = useState(() => { try { const v = typeof loadJSON === "function" ? loadJSON(PATROL_KEY, null) : null; return v && v.week === D().weekNo() ? v : null; } catch (e) { return null; } });
    const setPatrol = v => { setPatrol0(v ? Object.assign({}, v) : null); try { saveJSON(PATROL_KEY, v || null); } catch (e) {} };
    const patrolBest = () => { try { const v = (typeof loadJSON === "function" ? loadJSON(PATROL_BEST, null) : null) || {}; return { week: v.week === D().weekNo() ? v.week : 0, score: v.week === D().weekNo() ? v.score || 0 : 0, ever: v.ever || 0 }; } catch (e) { return { score: 0, ever: 0 }; } };
    const patrolFinish = p => { const b = patrolBest(); try { saveJSON(PATROL_BEST, { week: D().weekNo(), score: Math.max(b.score || 0, p.score), ever: Math.max(b.ever || 0, p.score) }); } catch (e) {} p.rewards = Rewards.settle({ patrol: true, win: p.done && p.done.why === "boss", pts: p.score }); };
    const SHIFT_KEY = "x_stampShift", SHIFT_BEST = "x_stampShiftBest";
    const [shift, setShift0] = useState(() => { try { const v = typeof loadJSON === "function" ? loadJSON(SHIFT_KEY, null) : null; return v && !v.done ? v : null; } catch (e) { return null; } });
    const [shiftSel, setShiftSel] = useState(-1), [, shiftBump] = useState(0);
    const setShift = v => { setShift0(v ? Object.assign({}, v) : null); try { saveJSON(SHIFT_KEY, v && !v.done ? v : null); } catch (e) {} shiftBump(x => x + 1); };
    const shiftBestOf = () => { try { return (typeof loadJSON === "function" ? loadJSON(SHIFT_BEST, null) : null) || { round: 0, done: 0 }; } catch (e) { return { round: 0, done: 0 }; } };
    const startShiftBattle = sh => {
      const s = ((sh.seed ^ (sh.round * 2654435761)) >>> 0) || 1;
      const nd = D().newDuel(D().shiftDeck(sh), D().edictDeck(s), s, { foeLv: D().shiftFoeLv(sh), cap: 8, bonds: bondsOf() }); nd.shift = true;
      setSt(nd); setMode("shift"); setHandSel(-1); setBoardSel(-1);
    };
    const shiftNext = win => {
      const sh = Object.assign({}, shift); D().shiftAfter(sh, win);
      if (sh.done) { const b = shiftBestOf(); try { saveJSON(SHIFT_BEST, { round: Math.max(b.round || 0, sh.done.round), done: (b.done || 0) + (sh.done.win ? 1 : 0) }); } catch (e) {}
        sh.rewards = Rewards.settle({ shift: true, win: sh.done.win, round: sh.done.win ? sh.done.round : sh.done.round - 1 }); }
      else D().shiftRoll(sh, cards);
      setShift(sh); setShiftSel(-1); setCoachTip(null); setSt(null); setMode("shift");
    };
    const patrolGo = (r, c) => {
      const p = patrol; if (!p) return; const res = D().patrolMove(p, r, c); if (!res) return;
      if (["fight", "elite", "boss"].includes(res.type)) {
        const deck = p.deck, b = D().patrolBattle(p, deck, res.type), nd = D().newDuel(deck.map(x => Object.assign({}, x)), b.foeDeck, b.seed, Object.assign({ bonds: bondsOf() }, b.opts)); nd.patrol = res.type;
        setPatrol(p); setSt(nd); setMode("patrol"); setHandSel(-1); setBoardSel(-1); return;
      }
      if (p.log.length) toast && toast(p.log[p.log.length - 1]);
      if (res.type === "tparcel" && p.ta) Trinkets.drop([p.ta], true, 0);
      if (res.ask && p.ta) p.ask = { kind: res.type };
      if (p.done) patrolFinish(p); setPatrol(p);
    };
    // TA 的格子：要不要听（花一次调用）；听了的收在这一趟的 notes 里，地图上摊开看
    const [paBusy, setPaBusy] = useState(false);
    const patrolListen = async () => {
      const p = patrol; if (!p || !p.ask || paBusy || !onChat) return; setPaBusy(true);
      try {
        const board = "这是第 " + p.week % 100 + " 周的「" + p.theme + "」邮区，走了 " + (D().PATROL.STEPS - p.steps) + " 步、还剩 " + p.steps + " 步，信封 " + p.hp + "/" + p.max + "，巡查分 " + p.score + "。一路上：" + p.log.slice(-6).join("；");
        const lines = await onChat(p.ta, { mode: "patrolta", kind: p.ask.kind, board });
        if (!lines || !lines.length) { toast && toast("没接上，再点一次试试"); return; }
        p.notes = (p.notes || []).concat({ kind: p.ask.kind, lines, ts: Date.now() }); p.show = p.notes.length - 1; p.ask = null; setPatrol(p);
      } catch (e) { toast && toast("没成：" + ((e && e.message) || e)); } finally { setPaBusy(false); }
    };
    const patrolBack = () => { const p = patrol; if (p && st && st.over) { D().patrolAfter(p, st.patrol, st.over.winner === "me", st.me.hp); if (p.done) patrolFinish(p); setPatrol(p); } setSt(null); setMode("patrol"); };
    const startRaid = m => {
      const s = (seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0);
      const nd = D().newDuel(D().deckFrom(cards, s, D().DECK_SIZE, core), [], s, { raid: m, bonds: bondsOf() });
      setSt(nd); setMode("raid"); setHandSel(-1); setBoardSel(-1); setRaidSaved(false);
    };
    // 最好成绩按档记：{ tiers: { 0: { waves, wins } } }
    const siegeAll = () => { try { return (typeof loadJSON === "function" ? loadJSON(SIEGE_KEY, null) : null) || {}; } catch (e) { return {}; } };
    const siegeBest = t => ((siegeAll().tiers || {})[t == null ? siegeTier : t]) || { waves: 0, wins: 0 };
    const startTut = () => {
      const meDeck = [tutCard(1, "火漆", { pow: 3, maxHp: 16 }), tutCard(2, "投递", { pow: 6 }), tutCard(3, "补票"), tutCard(4, "集邮"), tutCard(5, "邮戳")].concat(Array.from({ length: 7 }, (_, k) => tutCard(10 + k, ["投递", "火漆", "补票"][k % 3])));
      const foeDeck = Array.from({ length: 12 }, (_, k) => tutCard(50 + k, k % 2 ? "火漆" : "投递", { pow: 2, maxHp: 7, name: "陪练票" }));
      const nd = D().newDuel(meDeck, foeDeck, 7, { foeId: "" });
      nd.tutorial = true; nd.events = []; nd.me.terrain = nd.me.terrain.map(() => ""); nd.foe.terrain = nd.foe.terrain.map(() => "");
      // 第一手固定：火漆和投递一定在手里，胶水够贴这两张
      nd.me.hand = [meDeck[0], meDeck[1], meDeck[2], meDeck[3]]; nd.me.draw = nd.me.draw.filter(x => !nd.me.hand.includes(x)); nd.me.postage = 2;
      nd.intent = D().planFoe(nd);
      tutSeen.current = { infoSeen: false, giveFour: () => {
        nd.me.hand = Array.from({ length: 4 }, (_, k) => tutCard(80 + k, "火漆", { charId: "tut_pair", name: "同一个人的票" }));
        nd.me.postage = Math.max(nd.me.postage, 4);
        // 腾出一块 2×2：最上两排右边两列
        [1, 2, 4, 5].forEach(i => { if (nd.me.board[i]) { const v = nd.me.board[i]; const free = [0, 3, 6, 7, 8].find(j => !nd.me.board[j]); if (free != null) { nd.me.board[free] = v; nd.me.board[i] = null; } } });
      } };
      setSt(nd); setTut(0); setHandSel(-1); setBoardSel(-1); setSeries(null);
    };
    const [wager, setWager] = useState(() => preset && preset.wager ? (WAGERS.includes(preset.wager) ? preset.wager : "自己写") : ""), [wagerDraft, setWagerDraft] = useState(() => preset && preset.wager && !WAGERS.includes(preset.wager) ? preset.wager : "");
    const [reported, setReported] = useState(false);
    const [handi, setHandi] = useState("none"), [hard, setHard] = useState(false), [useRule, setUseRule] = useState(false);
    const [after, setAfter] = useState({ wager: null, review: null, busy: "" });
    const [stats, setStats] = useState(() => { try { return (typeof loadJSON === "function" ? loadJSON(STATS_KEY, {}) : {}) || {}; } catch (e) { return {}; } });
    // 战绩：一把打完记一次（谁赢、连胜、TA 最常贴哪张、谁打你最狠）
    const record = x => {
      if (!x || !x.over || x.tutorial || x.recorded) return; x.recorded = true;
      setStats(prev => {
        const all = Object.assign({}, prev), r = Object.assign({ w: 0, l: 0, d: 0, streak: 0, best: 0, used: {}, hurt: {} }, all[foeId] || {});
        r.used = Object.assign({}, r.used); r.hurt = Object.assign({}, r.hurt);
        if (x.over.winner === "me") { r.w++; r.streak = Math.max(0, r.streak) + 1; r.best = Math.max(r.best, r.streak); }
        else if (x.over.winner === "foe") { r.l++; r.streak = Math.min(0, r.streak) - 1; } else r.d++;
        x.log.forEach(l => { if (l.kind === "place" && l.who === "foe" && l.name) r.used[l.name] = (r.used[l.name] || 0) + 1;
          if ((l.kind === "hit" || l.kind === "hitEnv") && l.who === "foe" && l.from && l.from.name) r.hurt[l.from.name] = (r.hurt[l.from.name] || 0) + (l.n || 0); });
        r.last = { at: Date.now(), win: x.over.winner };
        all[foeId] = r; try { saveJSON(STATS_KEY, all); } catch (e) {} return all;
      });
    };
    const start = () => {
      const s = (seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0);
      const rule = useRule ? ruleOfWeek() : "";
      const pool = rule === "fancy" ? (cards || []).filter(c => c.rarity !== "R") : cards;
      let me = D().deckFrom(pool, s, D().DECK_SIZE, core), them = D().foeDeckFrom(pool, foeId, closeOf ? closeOf(foeId) : [], s);
      if (rule === "mirror") them = me.map(x => Object.assign({}, x));
      if (rule === "reverse") { const t = me; me = them; them = t; }
      const hp = rule === "quick" ? 25 : D().envFor(me);
      const nd = D().newDuel(me, them, s, { blind, bonds: bondsOf(), foeId, hard, rule, wager: wager === "自己写" ? wagerDraft.trim() : wager,
        meHp: handi === "meMore" ? hp + 12 : hp, foeHp: handi === "foeLess" ? hp - 12 : hp, cap: rule === "quick" ? 7 : undefined });
      setAfter({ wager: null, review: null, busy: "" }); setReported(false); setSt(nd); setHandSel(-1); setBoardSel(-1); setSaved(null);
      setTimeout(() => persist(nd, series), 0);
      setSeries(sr => sr || D().newSeries());
    };
    const fail = r => { if (r && !r.ok && r.why) toast && toast(r.why); return r && r.ok; };
    const shell = (kids) => h("div", { "data-wk": "duelpage", className: "h-full flex flex-col", style: { position: "relative", background: "repeating-linear-gradient(0deg, transparent 0 27px, rgba(47,42,34,.05) 27px 28px), linear-gradient(#f3ebdb, #e8dcc4)" } }, [h("style", { key: "fxcss" }, FX_CSS)].concat(kids));

    // 人话版攻略（她 2026-11-08「对战页面里也写一个人话版攻略」）：整页，右上「怎么玩」进来
    if (guide) {
      const chip = (txt, c) => h("span", { style: { display: "inline-block", padding: "0 6px", marginRight: 6, borderRadius: 3, background: c, color: "#fff", fontSize: fz(11.5), lineHeight: "20px", fontFamily: FD, verticalAlign: 1 } }, txt);
      // 一行「投递：……」把冒号前那个词做成一枚小签，五种票照票上的颜色
      const lineOf = (line, j) => { const m = /^([^：，。]{1,8})：(.+)$/.exec(line);
        return h("div", { key: j, style: { padding: "7px 0", borderTop: j ? "1px dashed rgba(47,42,34,.14)" : "none" } },
          m ? [chip(m[1], ROLE_COLOR[m[1]] || "rgba(47,42,34,.55)"), m[2]] : line); };
      const goSec = k => { const el = typeof document !== "undefined" && document.querySelector('[data-wk="duelguidesec"][data-k="' + k + '"]'); el && el.scrollIntoView({ behavior: "smooth", block: "start" }); };
      return shell([
        h(Head, { key: "hd", zh: "怎么玩", bg: "transparent", ink: INK, onBack: () => setGuide(false) }),
        h("div", { key: "bd", "data-wk": "duelguide", className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, fontSize: fz(13), lineHeight: 1.8, paddingBottom: 28 } },
          // 开头：一句话写在一个信封上
          h("div", { style: { borderRadius: 6, overflow: "hidden", background: PAPER, boxShadow: "0 4px 14px rgba(47,42,34,.16)", margin: "4px 0 12px" } },
            h("div", { style: { height: 7, background: AIRMAIL } }),
            h("div", { style: { position: "relative", padding: "14px 16px 16px" } },
              h("div", { style: { position: "absolute", right: 12, top: 10, width: 46, height: 54, background: perf(RED), display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(6deg)" } }, h("span", { style: { width: 38, height: 46, background: RED, color: "#fff", fontFamily: FD, fontSize: fz(12), display: "flex", alignItems: "center", justifyContent: "center" } }, "攻略")),
              h("div", { style: { fontFamily: FD, fontSize: fz(17), color: RED, marginBottom: 6 } }, GUIDE[0][0]),
              h("div", { style: { marginRight: 56, fontSize: fz(13.5) } }, GUIDE[0].slice(1).join("")))),
          // 目录：一排小签，点了跳过去
          h("div", { "data-wk": "duelguideindex", className: "flex flex-wrap", style: { gap: 6, marginBottom: 14 } },
            GUIDE.slice(1).map((sec, k) => h("button", { key: k, onClick: () => goSec(k + 1), style: { padding: "2px 9px", borderRadius: 999, border: "1px solid rgba(47,42,34,.22)", background: "rgba(255,255,255,.5)", fontSize: fz(11.5), color: INK } }, (k + 1) + " · " + sec[0].replace(/[：:].*$/, "")))),
          GUIDE.slice(1).map((sec, k) => h("div", { key: k, "data-wk": "duelguidesec", "data-k": k + 1, style: { position: "relative", marginBottom: 12, padding: "12px 14px 8px 14px", borderRadius: 5, background: "rgba(255,253,247,.92)", boxShadow: "0 2px 8px rgba(47,42,34,.10)", borderLeft: "3px solid " + (k % 2 ? "#3f6fb0" : RED), scrollMarginTop: 8 } },
            h("div", { className: "flex items-center", style: { gap: 8, marginBottom: 4 } },
              h("span", { style: { width: 26, height: 26, flexShrink: 0, borderRadius: 999, border: "1.5px solid " + (k % 2 ? "#3f6fb0" : RED), color: k % 2 ? "#3f6fb0" : RED, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: fz(12), transform: "rotate(-8deg)" } }, k + 1),
              h("div", { style: { fontFamily: FD, fontSize: fz(15.5) } }, sec[0])),
            sec.slice(1).map(lineOf))))]);
    }
    // ── 先挑玩法 ──
    // 挑玩法页做成一面邮票墙（她 2026-11-08「这些选择页面能不能做好看点」）：每种玩法一枚齿孔邮票，
    //   大字是面额那样的一个字，下面玩法名和一句话，最底下一行战绩；说明长的放进各自那一页的封面头里
    const modeTile = (wk, color, glyph, title, tag, rec, onTap, tilt) => h("button", { key: wk, "data-wk": wk, onClick: onTap, className: "text-left active:scale-[.97]",
      style: { display: "block", padding: 5, background: perf(PAPER), border: "none", transform: "rotate(" + (tilt || 0) + "deg)", filter: "drop-shadow(0 3px 6px rgba(47,42,34,.22))", transition: "transform .15s" } },
      h("div", { style: { position: "relative", height: 124, padding: "10px 11px", overflow: "hidden", background: "linear-gradient(155deg, rgba(255,255,255,.14), rgba(0,0,0,.14)), " + color, color: "#fff", display: "flex", flexDirection: "column" } },
        h("div", { style: { position: "absolute", right: -6, top: -14, fontFamily: FD, fontSize: fz(78), lineHeight: 1, opacity: .16 } }, glyph),
        h("div", { style: { position: "absolute", inset: 4, border: "1px solid rgba(255,255,255,.35)", pointerEvents: "none" } }),
        h("div", { style: { fontSize: fz(9.5), letterSpacing: ".2em", opacity: .85 } }, "集邮社"),
        h("div", { style: { fontFamily: FD, fontSize: fz(21), marginTop: 4, letterSpacing: ".06em" } }, title),
        h("div", { style: { fontSize: fz(11), lineHeight: 1.45, marginTop: 3, opacity: .92 } }, tag),
        h("div", { style: { flex: 1 } }),
        rec ? h("div", { style: { alignSelf: "flex-start", padding: "1px 7px", borderRadius: 999, background: "rgba(255,255,255,.22)", fontSize: fz(10) } }, rec) : null));
    // 各玩法自己那一页的封面头：同色航空条、一枚斜贴的小票、玩法名和说明
    const modeHero = (color, glyph, title, desc) => h("div", { key: "hero", "data-wk": "duelmodehero", style: { position: "relative", margin: "4px 0 14px", borderRadius: 6, overflow: "hidden", background: PAPER, boxShadow: "0 3px 10px rgba(47,42,34,.14)" } },
      h("div", { style: { height: 6, background: "repeating-linear-gradient(135deg, " + color + " 0 10px, " + PAPER + " 10px 16px)" } }),
      h("div", { style: { position: "relative", padding: "12px 14px 13px 76px", minHeight: 76 } },
        h("div", { style: { position: "absolute", left: 12, top: 12, width: 50, height: 58, padding: 3, background: perf(PAPER), transform: "rotate(-6deg)", filter: "drop-shadow(0 2px 3px rgba(47,42,34,.25))" } },
          h("div", { style: { width: "100%", height: "100%", background: color, color: "#fff", fontFamily: FD, fontSize: fz(24), display: "flex", alignItems: "center", justifyContent: "center" } }, glyph)),
        h("div", { style: { fontFamily: FD, fontSize: fz(17), color } }, title),
        h("div", { style: { fontSize: fz(11.5), color: SUB, lineHeight: 1.7, marginTop: 3 } }, desc)));
    // 陪打的人帮你挑卡组（她 2026-11-08）：TA 自己 + 跟 TA 最近的一个人，再点名一张 TA 这周最想带的卡；不花调用
    const taDeck = () => {
      if (!coachId) return null;
      const own = (cards || []).filter(k => k.charId === coachId && k.text);
      if (!own.length) return null;
      const rank = k => ({ SSR: 3, SR: 2, R: 1 }[k.rarity] || 0) * 100 + (Number(k.lv) || 1), top = own.slice().sort((a, b) => rank(b) - rank(a)).slice(0, 3);
      const wk = Math.floor(Date.now() / 6048e5), fav = top[(wk + String(coachId).length) % top.length];
      const near = ((closeOf ? closeOf(coachId) : []) || []).find(id => id !== coachId && (cards || []).some(k => k.charId === id));
      const u = D().stampOf(fav);
      return { core: [coachId].concat(near ? [near] : []).concat(["card:" + fav.id]), fav, near, line: u.lines.enter || u.lines.wake || "" };
    };
    const taDeckBox = () => { const t = taDeck(); if (!t) return null; const on = core.includes("card:" + t.fav.id);
      return h("div", { "data-wk": "duelcoachdeck", style: { marginTop: 8, paddingTop: 8, borderTop: "1px dashed rgba(47,42,34,.15)", fontSize: fz(11.5), lineHeight: 1.6 } },
        h("div", null, h("b", { style: { fontFamily: FD, fontWeight: 400, color: GREEN } }, nameOf(coachId) + " 想带"), "：TA 自己" + (t.near ? "和 " + nameOf(t.near) : "") + " 的卡，再加上「" + ((t.fav.text && t.fav.text.name) || "那张") + "」。"),
        t.line ? h("div", { style: { color: SUB, fontStyle: "italic" } }, "「" + t.line + "」") : null,
        h("button", { "data-wk": "duelcoachdeckgo", onClick: () => setCore(on ? [] : t.core), style: Object.assign(btn(on ? "rgba(79,122,102,.12)" : "transparent", GREEN, GREEN), { marginTop: 6, padding: "4px 12px", fontSize: fz(11.5) }) }, on ? "已经按 TA 的带了（点一下取消）" : "听 TA 的")); };
    const coachPick = () => onChat ? h("div", { key: "coach", "data-wk": "duelcoachpick", style: { margin: "-4px 0 14px", padding: "9px 12px", borderRadius: 6, background: "rgba(255,253,247,.85)", border: "1px solid rgba(47,42,34,.1)" } },
      h("div", { style: { fontSize: fz(12), color: INK, marginBottom: 6 } }, "谁陪你打", h("span", { style: { color: SUB, fontSize: fz(10.5), marginLeft: 6 } }, "打的时候能问 TA 怎么放、打完听 TA 评论；说一句花一次调用")),
      h("div", { className: "flex flex-wrap", style: { gap: 6 } }, [{ id: "" }].concat((characters || []).filter(c => (cards || []).some(k => k.charId === c.id))).map(c => { const on = (coachId || "") === (c.id || "");
        return h("button", { key: c.id || "none", "data-wk": "duelcoachwho", "data-on": on ? "1" : "0", onClick: () => setCoach(c.id || ""), style: { padding: "3px 10px", borderRadius: 999, border: "1px solid " + (on ? GREEN : "rgba(47,42,34,.22)"), background: on ? "rgba(79,122,102,.1)" : "transparent", color: on ? GREEN : INK, fontSize: fz(12) } }, c.id ? (c.remark || c.name) : "不用人陪"); })), taDeckBox()) : null;
    const modeCard = (wk, color, title, sub, desc, onTap) => h("button", { "data-wk": wk, onClick: onTap, className: "w-full text-left active:scale-[.99]",
      style: { display: "block", marginBottom: 14, padding: 0, borderRadius: 6, overflow: "hidden", background: PAPER, boxShadow: "0 3px 10px rgba(47,42,34,.18)", border: "1px solid " + color + "55", color: INK } },
      h("div", { style: { height: 6, background: AIRMAIL } }),
      h("div", { style: { position: "relative", padding: "14px 16px 14px" } },
        h("div", { style: { position: "absolute", right: 14, top: 12, width: 42, height: 42, borderRadius: 999, background: "radial-gradient(circle at 35% 30%, " + color + "cc, " + color + ")", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: fz(12), transform: "rotate(-8deg)", boxShadow: "0 2px 4px rgba(0,0,0,.25)" } }, sub),
        h("div", { style: { fontFamily: FD, fontSize: fz(18), color, marginRight: 52 } }, title),
        h("div", { style: { fontSize: fz(12), color: SUB, lineHeight: 1.7, marginTop: 4, marginRight: 40 } }, desc)));
    // 守城挑档（她 2026-11-08「后面难度比我的卡都高我怎么赢」→ 固定难度档）
    // 小物册（她 2026-11-08）：按人分页；上面写攒了几个没拆的包裹，点「拆一个」花一次调用
    if (!st && mode === "shop") {
      const C = "#8a6a2a", sh = shopSt;
      const ppl = (characters || []).filter(c => (cards || []).some(k => k.charId === c.id)), POSTS = D().SHOP.POSTS;
      const period = D().shopPeriod(), mul = D().shopMul(sh, sh.roster, personaOf, cardOf), onDuty = POSTS.map(p=>sh.roster[p]).filter(Boolean);
      const staffLine = () => POSTS.filter(p=>sh.roster[p]).map(p=>(nameOf(sh.roster[p])||'')+'在'+p).join('、');
      const open = () => shopAct('open').catch(()=>{});
      const winHas = id => sh.window.some(cid=>cardOf(cid)?.charId===id);
      // 招待先挑人或挑卡（她 2026-11-08）：只有一个人上班、橱窗空着，就直接招待
      const serve = (c, pick) => {
        if (pick) { setSvPick(""); shopAct('serve', Object.assign({ id: c.id, price: svPrice }, pick)).catch(() => {}); setSvPrice("mid"); return; }
        if (c.visitor) { shopAct('serve', { id: c.id }).catch(() => {}); return; }
        setSvPrice("mid"); setSvPick(svPick === c.id ? "" : c.id);
      };
      // 招待：先开价（便宜点／照价／收贵点），再挑交给谁或从橱窗挑一张；不用挑的就直接「就这样招待」
      // 一键全部招待：每位自动挑对的人或卡，对上算 ×1.15（自己挑是 ×1.3）；难缠客人、来坐坐的角色、稀客不在里面
      const serveAll = async () => { if (shBusy) return; setShBusy("all"); try {
        for (const c of sh.customers.filter(x => !x.done && !x.tough && !x.visitor && !x.rareId)) {
          const win = (sh.window || []).map(id => (cards || []).find(k => k.id === id)).filter(Boolean);
          const pick = c.need && c.need.post ? { staffId: sh.roster[c.need.post] || POSTS.map(p => sh.roster[p]).find(Boolean) } : c.wantChar ? { cardId: (win.find(k => k.charId === c.wantChar) || {}).id } : c.need && c.need.card ? { cardId: (win.find(k => D().shopCardFits(c.need, k)) || {}).id } : {};
          await shopAct('serve', Object.assign({ id: c.id, auto: true, price: "mid" }, pick)).catch(() => {});
        } } finally { setShBusy(""); } };
      const servePicker = c => { if (svPick !== c.id || c.done) return null;
        const chip = (key, label, on, sel) => h("button", { key, "data-wk": "duelshopservepick", "data-on": sel ? "1" : "0", onClick: on, style: { padding: "3px 10px", borderRadius: 999, border: "1px solid " + (sel ? C : "rgba(47,42,34,.25)"), background: sel ? "rgba(79,122,102,.1)" : "#fff", fontSize: fz(11.5), color: sel ? C : INK } }, label);
        const duty = POSTS.filter(p => sh.roster[p]), win = (sh.window || []).map(id => (cards || []).find(k => k.id === id)).filter(Boolean);
        const askPost = c.need && c.need.post && duty.length > 1, askCard = (c.need && c.need.card || c.wantChar) && win.length;
        return h("div", { "data-wk": "duelshopservepicks", style: { marginTop: 6 } },
          h("div", { "data-wk": "duelshopprice", className: "flex flex-wrap items-center", style: { gap: 6, marginBottom: 6 } }, h("span", { style: { fontSize: fz(10.5), color: SUB } }, "开价："),
            [["low", "便宜点"], ["mid", "照价"], ["high", "收贵点"]].map(([k, zh]) => chip(k, zh, () => setSvPrice(k), svPrice === k))),
          h("div", { className: "flex flex-wrap", style: { gap: 6 } },
            h("span", { style: { width: "100%", fontSize: fz(10.5), color: SUB } }, askPost ? "交给谁接待？" : askCard ? "从橱窗挑一张给 TA：" : ""),
            askPost ? duty.map(p => chip(p, nameOf(sh.roster[p]) + " · " + p, () => serve(c, { staffId: sh.roster[p] })))
              : askCard ? win.map(k => chip(k.id, ((k.text && k.text.name) || "一枚邮票") + " · " + k.rarity + " · " + D().stampOf(k).role, () => serve(c, { cardId: k.id })))
              : chip("go", "就这样招待", () => serve(c, { staffId: duty.length === 1 ? sh.roster[duty[0]] : undefined }))));
      };
      const fight = c => { const s0 = (seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0), me = D().deckFrom(cards, s0, D().DECK_SIZE, onDuty), fd = D().edictDeck(s0).map((u, k) => Object.assign(u, { name: c.name + (k ? "·" + (k + 1) : "") }));
        const nd = D().newDuel(me, fd, s0, { foeLv: Math.max(3, Math.round(D().avgLv(me) * 0.9)), cap: 8, bonds: bondsOf() }); nd.shopFight = { id: c.id, name: c.name, fee: c.fee, expected:window.StampShop.token(sh), staff: onDuty.slice() }; setSt(nd); setMode("shop"); setHandSel(-1); setBoardSel(-1); };
      const meet = async c => {if(shBusy)return;setShBusy(c.id);try{await shopAct('meet',{id:c.id});setShMeet(c.id);}catch{}finally{setShBusy('');}};
      const close = async () => {if(shBusy)return;setShBusy('close');try{await shopAct('close');}catch{}finally{setShBusy('');}};
      const card = (key, kids, color) => h("div", { key, style: secBox(color || C) }, kids);
      const para = lines => lines.map((t, k) => h("p", { key: k, style: { fontFamily: FD, fontSize: fz(13.5), lineHeight: 1.85, margin: "0 0 8px", whiteSpace: "pre-wrap" } }, BT(t)));
      return shell([
        h(Head, { key: "hd", zh: "邮局小店 · 第 " + sh.day + " 天 · " + period, bg: "transparent", ink: INK, onBack: onEntryBack || (() => setMode("")), right: guideBtn }),
        h("div", { key: "bd", "data-wk": "duelshop", className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, paddingTop: 4, paddingBottom: 24 } },
          // 文字店 → 3D 店（她 2026-11-08「没办法从文字进 3d」）：同一份存档，进去看店里的样子
          onShop3D ? h("button", { key: "3d", "data-wk": "duelshop3d", onClick: onShop3D, className: "w-full", style: Object.assign(btn("rgba(79,122,102,.08)", GREEN, GREEN), { margin: "6px 0 10px", padding: "9px 0" }) }, "进小世界里的邮局看看（同一家店）") : null,
          sh.day === 1 && sh.phase === "plan" && !sh.decor.length ? modeHero(C, "店", "邮局小店", "你开了一家小邮局。每天先排班：柜台、分拣、送信、看店四个岗，你的角色谁来上；排对擅长的岗收入多。开门接客：路人寄东西直接收钱，难缠的要打一局；没上班的角色也会来当客人，可以听他们跟店员碰上说两句。打烊时花一次调用，写今天在店里的所有人一小段（不管几个人上班都只花这一次）。钱拿去买装修，装修让收入变多，打烊那段也会写到。店里的事不进记忆。") : null,
          sh.missed ? card("missed", [h("div", { key: "t", style: { fontFamily: FD, fontSize: fz(14), color: RED } }, "第 " + sh.missed.day + " 天忘了打烊"),
            h("div", { key: "s", style: { fontSize: fz(11.5), color: SUB, margin: "3px 0 8px" } }, "那天收的 " + sh.missed.earned + " 枚照算。要补写那天晚上的打烊吗——你没来，是店里的人帮着关的门。"),
            sh.missed.lines ? h("div", { key: "l" }, para(sh.missed.lines)) : null,
            h("div", { key: "b", className: "flex", style: { gap: 8 } },
              !sh.missed.lines ? h("button", { "data-wk": "duelshopmissed", disabled: !!shBusy || !onChat || !sh.missed.first, onClick: async () => {setShBusy('missed');try{await shopAct('missed');}catch{}finally{setShBusy('');}}, className: "flex-1 disabled:opacity-50", style: btn(C, "#fff") }, shBusy === "missed" ? "在写…" : "补写那天的打烊（花一次调用）") : null,
              h("button", { onClick: () => shopAct("missedClear").catch(()=>{}), className: "flex-1", style: btn("transparent", INK, "rgba(47,42,34,.3)") }, sh.missed.lines ? "收起来" : "算了"))], RED) : null,
          statRow([["邮花", sh.coins], ["今天收入", sh.earned || 0], ["收入倍数", "×" + mul.toFixed(2)]], C),
          sh.phase === "plan" ? card("plan", [h("div", { key: "t" }, secTitle(C, "班", "排班", "第 " + sh.day + " 天")),
            POSTS.map(p => h("div", { key: p, "data-wk": "duelshoppost", style: { marginBottom: 8 } }, h("div", { style: { fontSize: fz(12), marginBottom: 4 } }, p,
              sh.roster[p] ? h("span", { "data-wk": "duelshoptitle", style: { marginLeft: 8, fontSize: fz(10.5), color: "#9a6a4a" } }, (nameOf(sh.roster[p]) || "") + " · " + D().shopSkillTitle(p, D().shopSkillOf(sh, sh.roster[p], p)) + "（" + D().shopSkillOf(sh, sh.roster[p], p) + " 天）") : null),
              h("div", { className: "flex flex-wrap", style: { gap: 5 } }, [{ id: "" }].concat(ppl).map(c => { const on = (sh.roster[p] || "") === (c.id || ""), busy = c.id && Object.keys(sh.roster).some(q => q !== p && sh.roster[q] === c.id), apt = c.id && D().shopApt(personaOf(c.id), p);
                return h("button", { key: c.id || "none", disabled: busy, onClick: () => shopAct("assign",{post:p,charId:c.id||"",expectedId:sh.roster[p]||""}).catch(()=>{}), className: "disabled:opacity-35", style: { padding: "2px 9px", borderRadius: 999, border: "1px solid " + (on ? C : "rgba(47,42,34,.22)"), color: on ? C : INK, background: on ? "rgba(138,106,42,.1)" : "transparent", fontSize: fz(11.5) } }, c.id ? (c.remark || c.name) + (apt ? " ✦" : "") : "空着"); })),
              sh.roster[p] ? h("div", { "data-wk": "duelshopbadge", className: "flex items-center flex-wrap", style: { gap: 5, marginTop: 4, fontSize: fz(11) } }, h("span", { style: { color: SUB } }, "工牌："),
                // 原来只露最近 6 张，别的挑不到（她 2026-11-08）：挂着的那张排最前，再给「挑别的」翻全部
                (() => { const mine = (cards || []).filter(k => k.charId === sh.roster[p] && k.text), cur = mine.find(k => k.id === sh.badge[p]);
                  return (cur ? [cur] : []).concat(mine.slice(-6).reverse().filter(k => k !== cur).slice(0, cur ? 4 : 5)); })().map(k => { const on = sh.badge[p] === k.id; return h("button", { key: k.id, onClick: () => shopAct("badge",{post:p,cardId:on?"":k.id}).catch(()=>{}), style: { padding: "1px 7px", borderRadius: 4, border: "1px solid " + (on ? "#3f6fb0" : "rgba(47,42,34,.2)"), color: on ? "#3f6fb0" : INK, background: on ? "rgba(63,111,176,.08)" : "transparent", fontSize: fz(11) } }, (k.text.name || "") + " · " + k.rarity + (D().shopBadgeFit(p, k) ? " ✦" : "")); }),
                (cards || []).filter(k => k.charId === sh.roster[p] && k.text).length > 5 ? h("button", { "data-wk": "duelshopbadgemore", onClick: () => { setBgPost(bgPost === p ? "" : p); setBgF({ who: "", rar: "", q: "" }); }, style: { padding: "1px 7px", borderRadius: 4, border: "1px dashed rgba(47,42,34,.35)", color: SUB, background: "transparent", fontSize: fz(11) } }, bgPost === p ? "收起" : "挑别的…") : null,
                bgPost === p ? h("div", { "data-wk": "duelshopbadgepick", style: { width: "100%", minWidth: 0, marginTop: 4 } },
                  h("div", { style: { fontSize: fz(10.5), color: SUB, margin: "2px 0 6px" } }, "工牌 R +6%、SR +10%、SSR +15%，等级高再多一点；✦ 是作用对上这个岗（" + D().SHOP_BADGE_FIT[p].join("／") + "），再 +5%。"),
                  cardFilterBar(bgF, setBgF, "duelshopbadgefilter", true, D().SHOP_BADGE_FIT[p]),
                  h("div", { style: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 5, maxHeight: 210, overflowY: "auto" } },
                    window.StampShop.sortedCards(cards, sh.badge[p] ? [sh.badge[p]] : [], Object.assign({}, bgF, { who: sh.roster[p] })).filter(k => k.text).map(k => h("div", { key: k.id, style: { position: "relative" } }, D().shopBadgeFit(p, k) ? h("span", { style: { position: "absolute", zIndex: 2, right: 2, bottom: 2, padding: "0 4px", borderRadius: 6, background: "rgba(251,246,234,.92)", color: "#a0522d", fontSize: fz(11) } }, "✦") : null, h(Ticket, { key: k.id, u: D().stampOf(k), card: k, owner: ownerOf(k.charId), useThumb, small: true, sel: sh.badge[p] === k.id, onTap: () => { shopAct("badge", { post: p, cardId: sh.badge[p] === k.id ? "" : k.id }).catch(() => {}); setBgPost(""); } }))))) : null) : null)),
            h("div", { key: "n", style: { fontSize: fz(11), color: SUB, marginBottom: 8 } }, "✦ 是 TA 擅长这个岗（看人设）。每排一个人收入 +15%，擅长的再 +10%，挂了工牌（TA 自己的卡）按稀有度再 +6%～15%，卡的作用对上岗位（✦）再 +5%。"),
            h("button", { key: "go", "data-wk": "duelshopopen", onClick: open, disabled: period === "半夜", className: "w-full disabled:opacity-45", style: Object.assign(btn(C, "#fff"), { padding: "11px 0", fontFamily: FD, fontSize: fz(15) }) }, period === "半夜" ? "半夜不开门，早上 6 点再来" : "开门 · " + period)]) : null,
          sh.phase === "open" ? card("day", [h("div", { key: "t" }, secTitle(C, "客", period === "半夜" ? "半夜了，店门关着" : period + "的客人", period === "半夜" ? "" : sh.customers.filter(c => !c.done).length + " 位在等")),
            h("div", { key: "s", style: { fontSize: fz(11), color: SUB, marginBottom: 8 } }, period === "半夜" ? "早上 6 点再开门。今天还没打烊的话，可以在下面打个烊。" : "上班：" + staffLine() + "。" + ({ 上午: "12 点", 下午: "18 点", 傍晚: "半夜 12 点" }[period] || "") + "前你没招待的普通客人，店员会按原价招待掉（难缠客人没人打就走了）；上午多寄信的路人，下午难缠的多，傍晚来坐坐的人多。"),
            period !== "半夜" && sh.customers.some(x => !x.done && !x.tough && !x.visitor && !x.rareId) ? h("button", { key: "all", "data-wk": "duelshopserveall", onClick: serveAll, disabled: !!shBusy, className: "w-full disabled:opacity-50", style: Object.assign(btn("transparent", C, C), { marginBottom: 8, padding: "7px 0", fontSize: fz(12) }) }, shBusy === "all" ? "在招待…" : "全部招待（自动挑，对上 ×1.15；自己挑是 ×1.3）") : null,
            (period === "半夜" ? [] : sh.customers).map(c => h("div", { key: c.id, "data-wk": "duelshopcustomer", style: { marginBottom: 8, padding: "8px 10px", borderRadius: 5, background: c.done ? "rgba(47,42,34,.05)" : "#fffdf7", border: "1px solid " + (c.tough ? "rgba(178,58,46,.35)" : c.visitor ? "rgba(154,106,74,.4)" : "rgba(47,42,34,.12)"), opacity: c.done ? .7 : 1 } },
              h("div", { className: "flex items-center", style: { gap: 8 } }, h("div", { className: "flex-1", style: { fontSize: fz(12.5) } }, h("b", { style: { fontFamily: FD, fontWeight: 400, color: c.tough ? RED : c.visitor ? "#9a6a4a" : c.wantChar ? "#3f6fb0" : INK } }, c.visitor ? nameOf(c.charId) + "（没上班，来店里坐坐）" : c.wantChar ? "点名的客人" : c.name), c.rareId ? h("span", { "data-wk": "duelshoprare", style: { marginLeft: 4, padding: "0 5px", borderRadius: 3, background: "linear-gradient(90deg,#d8b45a,#b8862a)", color: "#fff", fontSize: fz(10) } }, "稀客") : c.regularId && sh.regulars && sh.regulars[c.regularId] && sh.regulars[c.regularId].bond ? h("span", { "data-wk": "duelshopregular", style: { marginLeft: 4, padding: "0 5px", borderRadius: 3, background: "rgba(154,106,74,.15)", color: "#9a6a4a", fontSize: fz(10) } }, "熟客 · 来过 " + sh.regulars[c.regularId].bond + " 回") : null, c.urgent ? h("span", { style: { marginLeft: 4, padding: "0 5px", borderRadius: 3, background: RED, color: "#fff", fontSize: fz(9.5) } }, "急件 ×2") : null, c.visitor ? "" : c.wantChar ? "：想要一张" + (nameOf(c.wantChar) || "TA") + "的明信片" + (winHas(c.wantChar) ? "（橱窗里有）" : "（橱窗里没有）") : "：" + c.want),
                c.done ? h("span", { style: { fontSize: fz(11), color: SUB } }, c.tough && !c.won ? "没打过" : c.miss ? "没有，走了" : "+" + (c.got || 0)) : c.tough ? h("button", { "data-wk": "duelshopfight", onClick: () => fight(c), style: btn(RED, "#fff") }, "打一局") : h("button", { "data-wk": "duelshopserve", onClick: () => serve(c), style: btn(c.wantChar && !winHas(c.wantChar) ? "transparent" : C, c.wantChar && !winHas(c.wantChar) ? SUB : "#fff", c.wantChar && !winHas(c.wantChar) ? "rgba(47,42,34,.3)" : null) }, c.wantChar ? (winHas(c.wantChar) ? "卖明信片" : "送客") : "招待")),
              !c.done && (c.hint || c.need) ? h("div", { "data-wk": "duelshopneed", style: { fontSize: fz(11.5), color: "#3f6fb0", marginTop: 3, fontStyle: c.hint ? "italic" : "normal" } }, c.hint ? "「" + c.hint + "」" : D().shopNeedZh(c.need)) : null,
              c.done && c.need && c.hint ? h("div", { style: { fontSize: fz(10.5), color: SUB, marginTop: 2 } }, "原来是" + D().shopNeedZh(c.need)) : null,
              c.done && c.priceSay ? h("div", { style: { fontSize: fz(11), color: c.left ? RED : "#9a6a4a", marginTop: 2 } }, c.priceSay) : null,
              c.done && c.match ? h("div", { style: { fontSize: fz(11), color: GREEN, marginTop: 3 } }, "对上了 ×1.3" + (c.thanks ? " · " + c.thanks : "")) : null,
              c.done && (c.story || c.gift) ? h("div", { style: { fontSize: fz(11), color: "#9a6a4a", marginTop: 3 } }, [c.story ? "这回 TA " + c.story : "", c.gift ? "还留下 " + c.gift + " 枚邮花当谢礼" : ""].filter(Boolean).join("，")) : null,
              servePicker(c),
              c.visitor && !c.meet ? h("button", { "data-wk": "duelshopmeet", onClick: () => meet(c), disabled: !!shBusy, className: "disabled:opacity-50", style: Object.assign(btn("transparent", "#9a6a4a", "rgba(154,106,74,.5)"), { marginTop: 6, fontSize: fz(11.5) }) }, shBusy === c.id ? "在聊…" : "听 TA 跟店员说两句（花一次调用）") : null,
              // 来访对话：每句前面标上是谁说的；看完能直接去小世界看他们演（她 2026-11-09）
              c.meet && shMeet === c.id ? h("div", { "data-wk": "duelshopmeettext", style: { marginTop: 6 } }, para((c.meetTurns && c.meetTurns.length ? c.meetTurns : c.meet.map(t => ({ text: t }))).map(t => (t.speakerId && nameOf(t.speakerId) ? nameOf(t.speakerId) + "：" : "") + t.text))) : c.meet ? h("button", { onClick: () => setShMeet(c.id), style: { marginTop: 4, fontSize: fz(11), color: "#9a6a4a" } }, "再看一遍他们说的") : null,
              c.meet && onShop3D ? h("button", { "data-wk": "duelshopmeet3d", onClick: () => { window.__shopReplayMeet = c.id; onShop3D(); }, style: Object.assign(btn("transparent", GREEN, GREEN), { marginTop: 6, fontSize: fz(11.5), width: "100%" }) }, "去小世界看他们演这段（不再调用）") : null)),
            h("button", { key: "cl", "data-wk": "duelshopclose", onClick: close, disabled: shBusy === "close", className: "w-full disabled:opacity-50", style: Object.assign(btn(INK, PAPER), { marginTop: 6, padding: "10px 0" }) }, shBusy === "close" ? "在打烊…" : window.StampShop.hasResult("close")?"保存已写好的打烊（不再调用）":"打烊（花一次调用，写今天店里的一段）"), h("button",{key:"plain",onClick:()=>shopAct('closeLocal').catch(()=>{}),style:{...btn("transparent",INK),minHeight:40}},"只关门（不写故事）")]) : null,
          sh.phase === "closed" ? card("closed", [h("div", { key: "t" }, secTitle(INK, "烊", "打烊了", "第 " + sh.day + " 天 · 收了 " + (sh.earned || 0) + " 枚")),
            sh.closing ? h("div", { key: "c", "data-wk": "duelshopclosing" }, h(window.StampShopStories,{shop:sh,inlineCurrent:true,name:nameOf})) : null,
            // 店员下班留的便条：一人一张，跟打烊那段一起写的
            h(window.StampShopNotes,{key:"nt",notes:sh.notes||[],name:nameOf,font:FD,size:fz(12),titleSize:fz(11)}),
            h("div", { key: "n", "data-wk": "duelshopnext", style: { marginTop: 6, fontSize: fz(12), color: SUB, textAlign: "center" } }, "明天早上 6 点以后再来开门。")]) : null,
          // 店铺日记（她 2026-11-09）：打烊留底、来访对话按天收成一本
          window.StampShop.diary(sh).length ? h("button", { key: "diary", "data-wk": "duelshopdiarygo", onClick: () => setMode("shopdiary"), className: "w-full flex items-center active:opacity-80", style: { gap: 10, marginBottom: 12, padding: "10px 14px", borderRadius: 6, background: "rgba(154,106,74,.1)", border: "1px solid rgba(154,106,74,.35)", color: INK } },
            h("span", { style: { fontFamily: FD, fontSize: fz(18), color: "#9a6a4a" } }, "记"), h("span", { className: "flex-1 text-left", style: { fontSize: fz(12) } }, h("b", { style: { fontFamily: FD, fontWeight: 400, color: "#9a6a4a" } }, "店铺日记"), " · 记了 " + window.StampShop.diary(sh).length + " 天"), h("span", { style: { color: SUB } }, "›")) : null,
          // 口碑和这周的大单（她 2026-11-09「能一直玩下去」）：口碑不封顶，只让店变大；大单每周一换，做完下一周更大
          (() => { const R0 = D().shopRepLeft(sh); return card("rep", [h("div", { key: "t" }, secTitle("#b8862a", "誉", "口碑 · 第 " + R0.lv + " 级", "收入 +" + Math.round(D().shopRepBonus(R0.lv) * 100) + "%")),
            h("div", { key: "b", "data-wk": "duelshoprep", style: { height: 7, borderRadius: 4, background: "rgba(47,42,34,.1)", overflow: "hidden" } }, h("div", { style: { width: Math.round(100 * R0.xp / R0.need) + "%", height: "100%", background: "linear-gradient(90deg,#d8b45a,#b8862a)" } })),
            h("div", { key: "s", style: { fontSize: fz(11), color: SUB, marginTop: 4 } }, "离下一级还差 " + (R0.need - R0.xp) + "。招待一位 +10（对上需求 +15），打赢难缠客人 +25，做完大单另加。口碑越高客人越多、收入越高；难缠客人的强弱只照你卡组的等级，不跟口碑涨。")], "#b8862a"); })(),
          sh.orders && sh.orders.list && sh.orders.list.length ? card("orders", [h("div", { key: "t" }, secTitle("#6a4a8a", "单", "这周的大单", sh.orders.list.filter(o => o.done).length + " / " + sh.orders.list.length + " 做完")),
            sh.orders.list.map(o => h("div", { key: o.id, "data-wk": "duelshoporder", "data-done": o.done ? "1" : "0", style: { marginBottom: 8, padding: "7px 10px", borderRadius: 5, background: o.done ? "rgba(79,122,102,.08)" : "#fffdf7", border: "1px solid " + (o.done ? "rgba(79,122,102,.3)" : "rgba(47,42,34,.12)") } },
              h("div", { className: "flex", style: { justifyContent: "space-between", fontSize: fz(12.5) } }, h("span", null, (o.done ? "✓ " : "") + D().shopOrderZh(o)), h("span", { style: { color: "#b8862a", fontSize: fz(11) } }, o.pay + " 枚 · 口碑 +" + o.rep)),
              h("div", { style: { height: 5, borderRadius: 3, marginTop: 5, background: "rgba(47,42,34,.1)", overflow: "hidden" } }, h("div", { style: { width: Math.round(100 * Math.min(1, (o.prog || 0) / o.n)) + "%", height: "100%", background: o.done ? GREEN : "#6a4a8a" } })),
              h("div", { style: { fontSize: fz(10.5), color: SUB, marginTop: 2 } }, (o.prog || 0) + " / " + o.n))),
            h("div", { key: "n", style: { fontSize: fz(10.5), color: SUB } }, "每周一换三张，口碑越高单子越大、给得越多；没做完也不罚。")], "#6a4a8a") : null,
          card("window", [h("div", { key: "t" }, secTitle("#3f6fb0", "窗", "橱窗", sh.window.length + " / " + D().shopWinSlots(sh))),
            h("div", { key: "s", style: { fontSize: fz(11), color: SUB, marginBottom: 8 } }, "摆你抽到的卡。R +3%、SR +6%、SSR +10% 收入，等级高再多一点；点名要某人明信片的客人，橱窗里有那个人的卡才卖得出。买「整面墙的信格」多 2 格。点一张摆上／撤下。"),
            // 卡多了找不到（她 2026-11-08）：按人、稀有度筛，搜卡名；已经摆上的永远在最前
            cardFilterBar(winF, setWinF, "duelshopwinfilter"),
            h("div", { key: "g", "data-wk": "duelshopwindow", style: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 5, maxHeight: 300, overflowY: "auto" } },
              window.StampShop.sortedCards(cards,sh.window,winF).slice(0, winF.who || winF.rar || winF.q ? 300 : 60).map(k => { const on = sh.window.includes(k.id);
                return h(Ticket, { key: k.id, u: D().stampOf(k), card: k, owner: ownerOf(k.charId), useThumb, small: true, sel: on, wk: "duelshopwincard", onTap: () => shopAct('window',{cardId:k.id}).catch(()=>{}) }); }))], "#3f6fb0"),
          card("decor", [h("div", { key: "t" }, secTitle("#5a7a4a", "装", "装修", (sh.decor || []).length + " 样")), h("div", { key: "s", style: { fontSize: fz(11), color: SUB, marginBottom: 8 } }, sh.decor.length ? "店里现在有：" + sh.decor.join("、") + "。买过的能翻新两次（★），每月还有两样限定。" : "店里还空着。买的东西会摆进店里，打烊那段会写到；每月有两样限定，买过的还能翻新。"),
            (() => { const mon = new Date().getMonth() + 1, list = D().SHOP.DECOR.map(d => d.k).concat(D().SHOP.MONTHLY[mon].map(x => x[0]), sh.decor.filter(k => !D().SHOP.DECOR.some(d => d.k === k) && !D().SHOP.MONTHLY[mon].some(x => x[0] === k)));
              return h("div", { key: "g", "data-wk": "duelshopdecors", style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 } }, list.filter(k=>D().shopDecorOf(k)).map(k => { const d = D().shopDecorOf(k), has = sh.decor.includes(k), lv = (sh.decorLv || {})[k] || 1, up = has ? D().shopUpPrice(sh, k) : 0, monthly = !!d.month, limited = monthly && d.month === mon;
                const act = () => shopAct('decor',{name:k}).catch(()=>{});
                return h("button", { key: k, "data-wk": "duelshopdecor", disabled: has && !up, onClick: act, className: "text-left disabled:opacity-60", style: { position: "relative", padding: "7px 9px", borderRadius: 5, border: "1px solid " + (has ? C : limited ? "#b23a2e" : "rgba(47,42,34,.18)"), background: has ? "rgba(138,106,42,.08)" : "#fffdf7", color: INK, fontSize: fz(12) } }, k + (has && lv > 1 ? " ·" + "★".repeat(lv - 1) : ""),
                  limited && !has ? h("span", { style: { position: "absolute", right: 4, top: 3, fontSize: fz(9), color: "#b23a2e" } }, mon + " 月限定") : null,
                  h("div", { style: { fontSize: fz(10.5), color: SUB } }, !has ? d.price + " 枚 · 收入 +" + Math.round(d.bonus * 100) + "%" : up ? "翻新 " + up + " 枚 · 加成多一半" : "翻新到头了")); })); })()], "#5a7a4a"))]);
    }
    if (!st && mode === "story") {
      const sv0 = story, C = "#7a3b5a", stories = (() => { try { return (typeof loadJSON === "function" ? loadJSON(STORIES_KEY, []) : []) || []; } catch (e) { return []; } })();
      const para = (lines, k0) => lines.map((t, k) => h("p", { key: k0 + k, style: { fontFamily: FD, fontSize: fz(13.5), lineHeight: 1.85, margin: "0 0 9px", whiteSpace: "pre-wrap" } }, BT(t)));
      if (!sv0) return shell([
        h(Head, { key: "hd", zh: "剧情闯关", bg: "transparent", ink: INK, onBack: () => setMode(""), right: guideBtn }),
        h("div", { key: "bd", "data-wk": "duelstorystart", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingTop: 6, paddingBottom: 24 } },
          modeHero(C, "章", "剧情闯关", "跟一个人一起走一段五章的故事。每章 TA 先写一段，写到遇上拦路的对手，你用卡跟它打一场；打完挑一条路往下走。选的不一样、打赢打输，后面的走向和结局都不一样。走完收进故事集。每章花一次调用，结局再花一次。"),
          coachPick(),
          h("div", { style: { fontSize: fz(12), color: INK, margin: "0 0 6px" } }, "故事从哪儿开始"),
          h("div", { className: "flex flex-wrap", style: { gap: 6, marginBottom: 14 } }, STORY_HOOKS.map(k => h("button", { key: k, "data-wk": "duelstoryhook", "data-on": sHook === k ? "1" : "0", onClick: () => setSHook(k), style: { padding: "3px 11px", borderRadius: 999, border: "1px solid " + (sHook === k ? C : "rgba(47,42,34,.22)"), color: sHook === k ? C : INK, background: sHook === k ? "rgba(122,59,90,.08)" : "transparent", fontSize: fz(12) } }, k))),
          h("button", { "data-wk": "duelstorygo", disabled: !coachId || sBusy, onClick: () => storyNext({ id: "sy_" + Date.now().toString(36), charId: coachId, hook: sHook === "让 TA 起一个" ? "由你来起：照你们的关系想一个合适的开头" : sHook, chapters: [] }), className: "w-full disabled:opacity-40", style: Object.assign(btn(C, "#fff"), { padding: "12px 0", fontFamily: FD, fontSize: fz(15) }) }, sBusy ? (nameOf(coachId) || "TA") + " 在写第一章…" : coachId ? "跟 " + (nameOf(coachId) || "TA") + " 开始这段故事" : "先挑一个人"),
          stories.length ? h("div", { "data-wk": "duelstorybook", style: { marginTop: 20 } }, h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 6 } }, "故事集 · " + stories.length + " 段"),
            stories.slice().reverse().map(x => { const op = sOpen === x.id;
              return h("div", { key: x.id, style: { marginBottom: 8, borderRadius: 5, background: PAPER, border: "1px solid rgba(122,59,90,.25)", borderLeft: "3px solid " + C } },
                h("button", { onClick: () => setSOpen(op ? "" : x.id), className: "w-full text-left", style: { padding: "9px 12px" } }, h("div", { style: { fontFamily: FD, fontSize: fz(14) } }, (x.ending && x.ending.title) || x.hook), h("div", { style: { fontSize: fz(10.5), color: SUB } }, (nameOf(x.charId) || "TA") + " · " + new Date(x.ts).toLocaleDateString())),
                op ? h("div", { style: { padding: "0 14px 12px" } }, x.chapters.map((c, i) => h("div", { key: i }, h("div", { style: { fontFamily: FD, color: C, margin: "8px 0 4px" } }, "第 " + (i + 1) + " 章 · " + c.title), para(c.lines, "c" + i), c.pick ? h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 6 } }, (c.won ? "闯过去了" : "没闯过去") + " · 选了：" + c.pick) : null)),
                  x.ending ? h("div", null, h("div", { style: { fontFamily: FD, color: C, margin: "10px 0 4px" } }, "结局 · " + x.ending.title), para(x.ending.lines, "e")) : null) : null); })) : null)]);
      const cur = sv0.chapters[sv0.chapters.length - 1], n = sv0.chapters.length;
      return shell([
        h(Head, { key: "hd", zh: "剧情闯关 · 第 " + n + " / 5 章", bg: "transparent", ink: INK, onBack: () => setMode(""), right: guideBtn }),
        h("div", { key: "bd", "data-wk": "duelstoryread", className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, paddingTop: 4, paddingBottom: 24 } },
          n > 1 ? h("details", { style: { marginBottom: 10, fontSize: fz(12), color: SUB } }, h("summary", null, "前面几章"), sv0.chapters.slice(0, -1).map((c, i) => h("div", { key: i, style: { marginTop: 6 } }, h("div", { style: { fontFamily: FD, color: C } }, "第 " + (i + 1) + " 章 · " + c.title), para(c.lines, "p" + i)))) : null,
          h("div", { "data-wk": "duelstorychapter", style: { padding: "16px 16px 10px", borderRadius: 4, background: PAPER, boxShadow: "0 3px 10px rgba(47,42,34,.15)", borderTop: "4px solid " + C } },
            h("div", { style: { fontSize: fz(10.5), color: SUB, letterSpacing: ".15em" } }, sv0.hook.indexOf("由你来起") === 0 ? (nameOf(sv0.charId) || "TA") + " 起的头" : "「" + sv0.hook + "」 · " + (nameOf(sv0.charId) || "TA")),
            h("div", { style: { fontFamily: FD, fontSize: fz(17), color: C, margin: "4px 0 10px" } }, "第 " + n + " 章 · " + cur.title),
            para(cur.lines, "cur"),
            cur.foe.say ? h("div", { style: { margin: "4px 0 8px", padding: "7px 11px", borderLeft: "3px solid " + RED, background: "rgba(178,58,46,.06)", fontFamily: FD, fontSize: fz(13) } }, BT(cur.foe.name + "：" + cur.foe.say)) : null),
          cur.won == null ? h("button", { "data-wk": "duelstoryfight", onClick: () => storyFight(sv0), className: "w-full", style: Object.assign(btn(RED, "#fff"), { marginTop: 14, padding: "12px 0", fontFamily: FD, fontSize: fz(15) }) }, "迎战「" + cur.foe.name + "」")
          : h("div", { "data-wk": "duelstorychoose", style: { marginTop: 14 } },
              h("div", { style: { fontFamily: FD, fontSize: fz(14), color: cur.won ? GREEN : RED, marginBottom: 8 } }, cur.won ? "闯过去了。接下来往哪儿走？" : "没闯过去……故事还得往下走。接下来往哪儿走？"),
              (n >= 5 ? ["看结局"] : (cur.choices.length ? cur.choices : ["接着往下走"])).map((c, k) => h("button", { key: k, "data-wk": "duelstorypick", disabled: sBusy, onClick: () => { cur.pick = n >= 5 ? "" : c; storyNext(sv0); }, className: "w-full text-left disabled:opacity-50", style: { display: "block", marginBottom: 8, padding: "10px 13px", borderRadius: 6, background: "#fffdf7", border: "1px solid rgba(122,59,90,.35)", color: INK, fontSize: fz(13) } }, (n >= 5 ? "" : "→ ") + c)),
              sBusy ? h("div", { style: { fontSize: fz(12), color: SUB } }, (nameOf(sv0.charId) || "TA") + " 在写…") : null),
          h("button", { onClick: () => { if (typeof requestAppConfirm === "function") requestAppConfirm("不走这段故事了？", "写好的几章不会收进故事集。", () => setStory(null), "不走了"); else setStory(null); }, className: "w-full", style: Object.assign(btn("transparent", SUB, "rgba(47,42,34,.25)"), { marginTop: 18 }) }, "放下这段故事"))]);
    }
    if (!st && mode === "dispatch") {
      const all = Dispatch.all(), active = all.filter(t => !t.report), now = Date.now(), C = "#3f7a8a";
      const fullCard = id => (cardsAll || []).find(c => c.id === id);
      const story = c => { const tx = (c && c.text) || {}; return "「" + (tx.name || "") + "」" + (c.charId && nameOf(c.charId) ? "（" + nameOf(c.charId) + "的卡）" : "") + "：" + [tx.gist, tx.narration, tx.open, tx.highlight, tx.line ? "说：" + tx.line : ""].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 220); };
      const left = t => Math.max(0, t.end - now), fmt = ms => { const m = Math.ceil(ms / 60000); return m >= 60 ? Math.floor(m / 60) + " 小时 " + (m % 60) + " 分" : m + " 分"; };
      const send = () => {
        if (!dpPick.length) { toast && toast("先挑几张票"); return; } if (active.length >= 3) { toast && toast("最多三队在外面"); return; }
        const t = { id: "dp_" + now.toString(36), cardIds: dpPick.slice(), place: dpPlace, hours: dpHours, start: now, end: now + dpHours * 3600000, report: null };
        Dispatch.save(all.concat(t)); setDpPick([]); toast && toast("派去「" + dpPlace + "」了，" + dpHours + " 小时后回来"); dpBump(x => x + 1);
      };
      // 谁来写见闻：默认票最多的那个人；队里有不同的人时可以点头像换（她 2026-11-09）
      const teamOf = t => { const cnt = {}; t.cardIds.map(fullCard).filter(Boolean).forEach(c => { if (c.charId) cnt[c.charId] = (cnt[c.charId] || 0) + 1; }); return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]); };
      const back = async t => {
        if (dpBusy || !onChat) return; const cs = t.cardIds.map(fullCard).filter(Boolean), team = teamOf(t);
        const who = (dpWho[t.id] && team.includes(dpWho[t.id]) ? dpWho[t.id] : team[0]) || (characters || [])[0] && characters[0].id; if (!who) return; setDpBusy(t.id);
        try { const r = await onChat(who, { mode: "dispatch", place: t.place, hours: t.hours, cards: cs.map(story).join("\n"), with: Array.from(new Set(cs.map(c => nameOf(c.charId)).filter(Boolean))).join("、") });
          if (!r || !r.lines) { toast && toast("没写出来，再点一次试试"); return; }
          const pay = dispatchPay(t.hours);
          const a2 = Dispatch.all(), x = a2.find(y => y.id === t.id); if (x) { x.report = Object.assign({ who, ts: Date.now(), pay }, r); Dispatch.save(a2); }
          if (r.item) Trinkets.add(Object.assign({ id: "tk_" + Date.now().toString(36), charId: who, ts: Date.now(), from: "派遣·" + t.place }, r.item));
          setDpShow(t.id); }
        catch (e) { toast && toast("没成：" + ((e && e.message) || e)); } finally { setDpBusy(""); dpBump(x => x + 1); }
      };
      const shown = all.find(t => t.id === dpShow && t.report);
      return shell([
        h(Head, { key: "hd", zh: "派遣", bg: "transparent", ink: INK, onBack: () => setMode(""), right: guideBtn }),
        h("div", { key: "bd", "data-wk": "dueldispatch", className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, paddingTop: 4, paddingBottom: 24 } },
          modeHero(C, "派", "派遣", "挑几张票派去一个地方送信，过几个小时回来，带回一份见闻、一样小东西（收进小物册）和一笔邮资、印泥（1 小时 30、4 小时 90、8 小时 160，每天第一趟双份）。派出去的票这段时间别处用不了；最多三队同时在外面。派的时候不花钱，回来看见闻花一次调用。"),
          shown ? h("div", { "data-wk": "dueldispatchreport", style: { marginBottom: 14, padding: "14px 16px", borderRadius: 4, background: PAPER, boxShadow: "0 3px 10px rgba(47,42,34,.15)", borderTop: "4px solid " + C } },
            h("div", { style: { fontSize: fz(10.5), color: SUB, letterSpacing: ".15em" } }, shown.place + " · " + shown.hours + " 小时 · " + (nameOf(shown.report.who) || "TA") + " 写的"),
            shown.report.pay ? h("div", { "data-wk": "dueldispatchpay", style: { margin: "4px 0 2px", fontSize: fz(11.5), color: "#9a6a4a" } }, "这一趟带回 " + shown.report.pay.postage + " 邮资、" + shown.report.pay.ink + " 印泥" + (shown.report.pay.first ? "（今天第一趟，双份）" : "")) : null,
            h("div", { style: { fontFamily: FD, fontSize: fz(16), margin: "4px 0 8px", color: C } }, shown.report.title || "这一趟"),
            shown.report.lines.map((t2, k) => h("p", { key: k, style: { fontFamily: FD, fontSize: fz(13.5), lineHeight: 1.85, margin: "0 0 8px", whiteSpace: "pre-wrap" } }, BT(t2))),
            shown.report.item ? h("div", { style: { marginTop: 6, padding: "8px 11px", borderLeft: "3px solid #9a6a4a", background: "rgba(154,106,74,.07)", fontSize: fz(12.5), lineHeight: 1.7 } }, h("b", { style: { fontFamily: FD, fontWeight: 400 } }, "带回来：" + shown.report.item.name), h("div", null, BT(shown.report.item.story)), shown.report.item.say ? h("div", { style: { fontFamily: FD, color: "#5a4030" } }, (nameOf(shown.report.who) || "TA") + "：", BT(shown.report.item.say)) : null) : null,
            h("button", { onClick: () => setDpShow(""), style: Object.assign(btn("transparent", SUB, "rgba(47,42,34,.25)"), { marginTop: 8 }) }, "收起来")) : null,
          active.length ? h("div", { style: secBox(C) }, secTitle(C, "外", "在外面", active.length + " / 3 队"),
            active.map(t => { const l = left(t), cs = t.cardIds.map(fullCard).filter(Boolean);
              return h("div", { key: t.id, "data-wk": "dueldispatchteam", style: { marginBottom: 8, padding: "9px 12px", borderRadius: 6, background: PAPER, boxShadow: "0 1px 5px rgba(47,42,34,.12)", borderLeft: "4px solid " + C } },
                h("div", { className: "flex items-center", style: { justifyContent: "space-between" } }, h("span", { style: { fontFamily: FD, fontSize: fz(14) } }, "去了「" + t.place + "」"), h("span", { style: { fontSize: fz(11.5), color: l ? SUB : GREEN } }, l ? "还要 " + fmt(l) : "回来了")),
                h("div", { style: { fontSize: fz(11), color: SUB, margin: "2px 0 6px" } }, cs.map(c => (c.text && c.text.name) || "").join("、")),
                l ? h("div", { style: { height: 4, borderRadius: 2, background: "rgba(47,42,34,.1)", overflow: "hidden" } }, h("div", { style: { width: Math.round(100 * (1 - l / (t.end - t.start))) + "%", height: "100%", background: C } }))
                  : h("div", null, (() => { const team = teamOf(t); if (team.length < 2) return null; const cur = dpWho[t.id] && team.includes(dpWho[t.id]) ? dpWho[t.id] : team[0];
                      return h("div", { "data-wk": "dueldispatchwho", className: "flex flex-wrap items-center", style: { gap: 6, marginBottom: 6 } }, h("span", { style: { fontSize: fz(11), color: SUB } }, "谁来写："),
                        team.map(id => h("button", { key: id, "data-on": cur === id ? "1" : "0", onClick: () => setDpWho(m => Object.assign({}, m, { [t.id]: id })), style: { padding: "2px 10px", borderRadius: 999, border: "1px solid " + (cur === id ? C : "rgba(47,42,34,.22)"), background: cur === id ? "rgba(79,122,102,.1)" : "transparent", color: cur === id ? C : INK, fontSize: fz(11.5) } }, nameOf(id) || "TA"))); })(),
                    h("button", { "data-wk": "dueldispatchback", onClick: () => back(t), disabled: !!dpBusy, className: "w-full disabled:opacity-50", style: btn(C, "#fff") }, dpBusy === t.id ? "在写见闻…" : "看见闻（花一次调用）"))); })) : null,
          active.length < 3 ? h("div", { "data-wk": "dueldispatchnew", style: secBox(C) },
            secTitle(C, "派", "派一队出去", "还能派 " + (3 - active.length) + " 队"),
            h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 4 } }, "去哪"),
            h("div", { className: "flex flex-wrap", style: { gap: 6, marginBottom: 10 } }, DISPATCH_PLACES.map(pl => h("button", { key: pl, "data-wk": "dueldispatchplace", "data-on": dpPlace === pl ? "1" : "0", onClick: () => setDpPlace(pl), style: { padding: "2px 10px", borderRadius: 999, border: "1px solid " + (dpPlace === pl ? C : "rgba(47,42,34,.22)"), color: dpPlace === pl ? C : INK, background: dpPlace === pl ? "rgba(63,122,138,.08)" : "transparent", fontSize: fz(12) } }, pl))),
            h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 4 } }, "去多久"),
            h("div", { className: "flex", style: { gap: 6, marginBottom: 10 } }, [1, 4, 8].map(hh => h("button", { key: hh, "data-wk": "dueldispatchhours", onClick: () => setDpHours(hh), style: { flex: 1, padding: "5px 0", borderRadius: 5, border: "1px solid " + (dpHours === hh ? C : "rgba(47,42,34,.22)"), color: dpHours === hh ? C : INK, fontSize: fz(12.5) } }, hh + " 小时"))),
            h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 4 } }, "派谁（最多 3 张，点卡选上）"),
            cardFilterBar(dpF, setDpF, "dueldispatchfilter"),
            h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6, maxHeight: 300, overflowY: "auto", marginBottom: 10 } }, (cards || []).filter(c => c.text && (dpPick.includes(c.id) || cardFilterHit(dpF, c))).slice().sort((a, b) => (dpPick.includes(b.id) ? 1 : 0) - (dpPick.includes(a.id) ? 1 : 0) || cardSort(a, b)).slice(0, dpF.who || dpF.rar || dpF.q ? 300 : 60).map(c => { const u = D().stampOf(c), on = dpPick.includes(c.id);
              return h(Ticket, { key: c.id, u, card: c, owner: ownerOf(c.charId), useThumb, small: true, sel: on, wk: "dueldispatchcard", onTap: () => setDpPick(p => on ? p.filter(x => x !== c.id) : p.concat(c.id).slice(-3)) }); })),
            h("button", { "data-wk": "dueldispatchgo", onClick: send, disabled: !dpPick.length, className: "w-full disabled:opacity-40", style: Object.assign(btn(C, "#fff"), { padding: "11px 0", fontFamily: FD, fontSize: fz(14) }) }, "派去「" + dpPlace + "」· " + dpHours + " 小时")) : null,
          all.filter(t => t.report).length ? h("div", { style: secBox("#9a6a4a", { marginTop: 4 }) }, secTitle("#9a6a4a", "闻", "见闻集", all.filter(t => t.report).length + " 篇"),
            all.filter(t => t.report).slice().reverse().map(t => h("button", { key: t.id, onClick: () => setDpShow(t.id), className: "w-full text-left", style: { display: "block", marginBottom: 6, padding: "7px 11px", borderRadius: 5, background: "#fffdf7", border: "1px solid rgba(63,122,138,.25)", fontSize: fz(12.5) } }, (t.report.title || "这一趟") + " · " + t.place + " · " + new Date(t.report.ts).toLocaleDateString()))) : null)]);
    }
    if (!st && mode === "relay") {
      const rec = relayRec(), C = "#a0522d", sty = coachId ? (bondsOf()[coachId] || "默契") : "";
      return shell([
        h(Head, { key: "hd", zh: "接力", bg: "transparent", ink: INK, onBack: () => setMode(""), right: guideBtn }),
        h("div", { key: "bd", "data-wk": "duelrelaystart", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingTop: 6, paddingBottom: 24 } },
          modeHero(C, "接", "接力", "你和 TA 轮流下同一块棋盘，一起打审查局：单数回合你下，双数回合 TA 下。TA 照自己的性子出牌——不一定是你想的那样，你得接住 TA 留下的局面。卡组多从 TA 的卡里来，信封是你们俩共用的一个。打的时候能跟 TA 说话。不说话不花调用。"),
          coachPick(),
          coachId ? h("div", { style: { fontSize: fz(11.5), color: SUB, margin: "-6px 2px 12px" } }, (nameOf(coachId) || "TA") + " 的打法：" + (D().STYLE_ZH[sty] || "稳扎稳打")) : null,
          rec[coachId] ? h("div", { style: { fontSize: fz(12), color: "#b8862a", marginBottom: 10 } }, "跟 " + (nameOf(coachId) || "TA") + " 接力赢过 " + (rec[coachId].win || 0) + " 次、打过 " + (rec[coachId].n || 0) + " 次") : null,
          h("button", { "data-wk": "duelrelaygo", disabled: !coachId, onClick: startRelay, className: "w-full disabled:opacity-40", style: Object.assign(btn(C, "#fff"), { padding: "12px 0", fontFamily: FD, fontSize: fz(15), letterSpacing: ".1em" }) }, coachId ? "跟 " + (nameOf(coachId) || "TA") + " 开始接力" : "先挑一个人"))]);
    }
    if (!st && mode === "puzzle") {
      const done = pzDone(), open = Math.min(D().PUZZLE_MAX, Object.keys(done).length + 1), C = "#6a5a3a";
      return shell([
        h(Head, { key: "hd", zh: "死信", bg: "transparent", ink: INK, onBack: () => setMode(""), right: guideBtn }),
        h("div", { key: "bd", "data-wk": "duelpuzzles", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingTop: 6, paddingBottom: 24 } },
          modeHero(C, "死", "死信", "每一关棋盘、手牌、胶水都摆好了，只有这一回合：寄出时要把对面信封打空。对面信封正好是这一手最好能打出的伤害，得找到最好的放法——往哪格贴、贴哪几张、先给谁盖章。卡住了点「提示」。过一关开下一关，人人题目一样。不花调用。"),
          coachPick(),
          h("div", { style: { fontSize: fz(12), color: SUB, marginBottom: 10 } }, "过了 " + Object.keys(done).length + " / " + D().PUZZLE_MAX + " 关"),
          h("div", { "data-wk": "duelpuzzlegrid", style: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 } }, Array.from({ length: D().PUZZLE_MAX }, (_, k) => k + 1).map(lv => { const ok = !!done[lv], can = lv <= open;
            return h("button", { key: lv, "data-wk": "duelpuzzlelv", "data-ok": ok ? "1" : "0", disabled: !can, onClick: () => startPuzzle(lv), className: "disabled:opacity-35", style: { aspectRatio: "1 / 1", padding: 3, background: perf(PAPER), border: "none", filter: "drop-shadow(0 1px 2px rgba(47,42,34,.2))" } },
              h("div", { style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: ok ? C : can ? "#fffdf7" : "#e8e0cf", color: ok ? "#fff" : INK, fontFamily: FD, fontSize: fz(16) } }, lv, h("span", { style: { fontFamily: F, fontSize: fz(8.5), opacity: .8 } }, ok ? "过了" : can ? "" : "🔒"))); })),
          // 无限关：30 关全过了接着出，难度封顶；记最远到第几关
          (() => { const far = Math.max(0, ...Object.keys(done).map(Number)), allBase = Array.from({ length: D().PUZZLE_MAX }, (_, k) => k + 1).every(k => done[k]), next = Math.max(D().PUZZLE_MAX + 1, far + 1);
            return h("button", { "data-wk": "duelpuzzleendless", disabled: !allBase, onClick: () => startPuzzle(next), className: "w-full text-left disabled:opacity-45", style: { display: "flex", alignItems: "center", gap: 10, marginTop: 16, padding: "11px 14px", borderRadius: 6, background: PAPER, boxShadow: "0 2px 8px rgba(47,42,34,.12)", borderLeft: "4px solid " + C, color: INK } },
              h("span", { style: { fontFamily: FD, fontSize: fz(20), color: C } }, "∞"),
              h("span", { className: "flex-1" }, h("div", { style: { fontFamily: FD, fontSize: fz(14) } }, "无限关 · 第 " + next + " 关"), h("div", { style: { fontSize: fz(11), color: SUB } }, allBase ? "难度保持最高档，一直往下打；最远到第 " + Math.max(far, D().PUZZLE_MAX) + " 关" : "30 关全过了才开")), h("span", { style: { color: SUB } }, "›")); })(),
          // 每日残局：一天一题、人人不一样，解开盖一枚日戳，连着解有连续天数
          (() => { const today = !!pzDaily()[dayKey()], streak = pzStreak();
            return h("button", { "data-wk": "duelpuzzledaily", onClick: () => startPuzzle(0, true), className: "w-full text-left", style: { display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: "11px 14px", borderRadius: 6, background: today ? "rgba(79,122,102,.1)" : PAPER, boxShadow: "0 2px 8px rgba(47,42,34,.12)", borderLeft: "4px solid " + GREEN, color: INK } },
              h("span", { style: { width: 34, height: 34, borderRadius: 999, border: "2px solid " + GREEN, color: GREEN, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: fz(11), transform: "rotate(-8deg)" } }, (new Date().getMonth() + 1) + "." + new Date().getDate()),
              h("span", { className: "flex-1" }, h("div", { style: { fontFamily: FD, fontSize: fz(14) } }, "每日死信" + (today ? " · 今天解开了" : "")), h("div", { style: { fontSize: fz(11), color: SUB } }, "一天一题、每个人的都不一样" + (streak ? " · 连续 " + streak + " 天" : ""))), h("span", { style: { color: SUB } }, "›")); })())]);
    }
    // 谁能在聊天里提集邮社（她 2026-11-08）：按人两个开关，默认全关
    // 店铺日记：按月翻，一天一页（谁上班、收了多少、来过谁、打烊全文和便条、来访对话）
    if (!st && mode === "shopdiary") {
      // 店铺日记（她 2026-11-09「弄好看点」）：一本横线日记本——左边装订孔、顶上纸胶带、日期盖成邮戳，
      //   谁上班是一排小名牌，收入是一枚圆章，打烊是正文，来访对话是夹进来的小信笺，便条贴在页尾
      const sh = window.StampShop.read(), days = window.StampShop.diary(sh);
      const monthOf = d => { const [y, m] = String(d.date).split("-"); return y && m ? y + " 年 " + Number(m) + " 月" : "更早"; };
      // 一天一页翻着看（她 2026-11-09「像日记一样翻页、可以选天看」）：diaryD 是正翻着的那天；换月翻到那月最新一天
      const curDay = days.find(d => d.date === diaryD) || days[0], curM = curDay ? monthOf(curDay) : "", months = Array.from(new Set(days.map(monthOf)));
      const at = days.indexOf(curDay), go = k => { const d = days[at + k]; if (d) { setDiaryFlip(k > 0 ? "older" : "newer"); setDiaryD(d.date); } };
      const swipe = { onTouchStart: e => { diaryX.current = e.touches[0].clientX; }, onTouchEnd: e => { const dx = e.changedTouches[0].clientX - (diaryX.current || 0); if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); } };
      const said = (turns, lines) => (Array.isArray(turns) && turns.length ? turns.map(t => ({ who: t.speakerId && nameOf(t.speakerId), text: t.text })) : (lines || []).map(t => ({ who: "", text: t })));
      const BROWN = "#9a6a4a", RULE = "rgba(63,111,176,.13)", TAPE = ["rgba(214,170,120,.55)", "rgba(150,180,160,.55)", "rgba(190,150,170,.5)"];
      const lineOf = (x, k) => h("p", { key: k, style: { fontFamily: FD, fontSize: fz(13.5), lineHeight: "28px", margin: 0, whiteSpace: "pre-wrap" } },
        x.who ? h("span", { style: { color: BROWN, marginRight: 4 } }, x.who + "：") : null, BT(x.text));
      const label = (t, color) => h("div", { style: { display: "flex", alignItems: "center", gap: 6, margin: "14px 0 4px", fontSize: fz(11), letterSpacing: ".2em", color: color || SUB } },
        h("span", { style: { width: 14, height: 1, background: "currentColor", opacity: .5 } }), t, h("span", { style: { flex: 1, height: 1, background: "currentColor", opacity: .2 } }));
      const wkDay = d => { const [y, m, dd] = String(d.date).split("-").map(Number); const t = new Date(y, m - 1, dd); return isNaN(t) ? "" : "周" + "日一二三四五六"[t.getDay()]; };
      return shell([
        h(Head, { key: "hd", zh: diaryRegs ? "熟客簿" : "店铺日记", bg: "transparent", ink: INK, onBack: () => diaryRegs ? setDiaryRegs(false) : setMode("shop"), right: !diaryRegs && Object.keys(sh.regulars || {}).length ? h("button", { "data-wk": "duelshopregbook", onClick: () => setDiaryRegs(true), style: { padding: "4px 10px", color: BROWN, fontFamily: FD, fontSize: fz(13) } }, "熟客簿") : null }),
        // 熟客簿：来过的熟客，交情从高到低；每人的小事按日子记着
        diaryRegs ? h("div", { key: "rb", "data-wk": "duelshopregs", className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, paddingBottom: 24 } },
          h("div", { style: { fontSize: fz(11.5), color: SUB, margin: "6px 0 12px", lineHeight: 1.7 } }, "招待过的路人会变成熟客，再来时认得出；交情每满 3 回冒一件小事，满 5 回留一笔谢礼。熟客多了，交情最浅的会搬走，空出位置给新面孔。"),
          // 稀客：凑上条件才偶尔来；没见过的只给一句线索
          h("div", { "data-wk": "duelshoprares", style: { marginBottom: 14 } }, h("div", { style: { fontFamily: FD, fontSize: fz(14), color: "#b8862a", margin: "2px 0 6px" } }, "稀客 · " + D().RARE_GUESTS.filter(g => (sh.rareSeen || {})[g.id]).length + " / " + D().RARE_GUESTS.length),
            h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 } }, D().RARE_GUESTS.map(g => { const seen = (sh.rareSeen || {})[g.id];
              return h("div", { key: g.id, "data-wk": "duelshoprareone", "data-seen": seen ? "1" : "0", style: { padding: "8px 10px", borderRadius: 4, background: seen ? "linear-gradient(160deg,#fff8e6,#f3e2b8)" : "rgba(47,42,34,.05)", border: "1px solid " + (seen ? "#d8b45a" : "rgba(47,42,34,.12)") } },
                h("div", { style: { fontFamily: FD, fontSize: fz(13), color: seen ? INK : SUB } }, seen ? g.name : "？？？"),
                h("div", { style: { fontSize: fz(10.5), color: SUB, marginTop: 2, lineHeight: 1.5 } }, seen ? g.want + " · 来过 " + seen.n + " 回" : "线索：" + g.tip)); }))),
          Object.values(sh.regulars || {}).sort((a, b) => (!!a.gone - !!b.gone) || (b.bond || 0) - (a.bond || 0)).map(r => h("div", { key: r.id, "data-wk": "duelshopreg", style: { marginBottom: 10, padding: "10px 12px", borderRadius: 4, background: PAPER, boxShadow: "0 2px 8px rgba(47,42,34,.12)", borderLeft: "3px solid " + (r.gone ? "rgba(47,42,34,.2)" : BROWN), opacity: r.gone ? .6 : 1 } },
            h("div", { className: "flex", style: { justifyContent: "space-between", alignItems: "baseline" } }, h("span", { style: { fontFamily: FD, fontSize: fz(15) } }, r.name), h("span", { style: { fontSize: fz(11), color: BROWN } }, r.gone ? "搬走了" : "来过 " + (r.bond || 0) + " 回")),
            h("div", { style: { fontSize: fz(11), color: SUB, marginTop: 2 } }, "常来" + (r.want || "寄东西") + (r.since ? " · " + r.since + " 第一次来" : "")),
            (r.stories || []).length ? h("div", { style: { marginTop: 6 } }, r.stories.slice().reverse().map((x, k) => h("div", { key: k, style: { fontSize: fz(12), lineHeight: 1.7 } }, h("span", { style: { color: SUB, marginRight: 6, fontSize: fz(10.5) } }, x.date), x.text))) : null))) :
        h("div", { key: "bd", "data-wk": "duelshopdiary", className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, paddingBottom: 28 } },
          // 月份做成书签
          months.length ? h("div", { "data-wk": "duelshopdiarymonths", className: "flex overflow-x-auto", style: { gap: 4, margin: "6px 0 0", paddingLeft: 26 } }, months.map(m => { const on = m === curM;
            return h("button", { key: m, "data-on": on ? "1" : "0", onClick: () => { const d = days.find(x => monthOf(x) === m); if (d) { setDiaryFlip(""); setDiaryD(d.date); } }, style: { flexShrink: 0, padding: on ? "7px 14px 9px" : "5px 12px 6px", marginTop: on ? 0 : 3, borderRadius: "6px 6px 0 0", background: on ? BROWN : "rgba(154,106,74,.16)", color: on ? "#fff8ec" : BROWN, fontFamily: FD, fontSize: fz(12.5), boxShadow: on ? "0 -2px 6px rgba(47,42,34,.12)" : "none" } }, m); })) : null,
          // 这个月的每一天：一排小日子，点哪天翻到哪天
          curDay ? h("div", { "data-wk": "duelshopdiarydays", className: "flex overflow-x-auto", style: { gap: 6, padding: "8px 2px 10px 26px", background: "rgba(154,106,74,.08)" } }, days.filter(d => monthOf(d) === curM).slice().reverse().map(d => { const on = d === curDay, n = String(d.date).split("-")[2];
            return h("button", { key: d.date, "data-on": on ? "1" : "0", onClick: () => { setDiaryFlip(days.indexOf(d) > at ? "older" : "newer"); setDiaryD(d.date); }, style: { flexShrink: 0, width: 34, height: 34, borderRadius: 99, border: "1.5px solid " + (on ? BROWN : "rgba(154,106,74,.35)"), background: on ? BROWN : PAPER, color: on ? "#fff8ec" : BROWN, fontFamily: FD, fontSize: fz(13), position: "relative" } }, n,
              d.story ? h("span", { style: { position: "absolute", right: -1, top: -1, width: 7, height: 7, borderRadius: 99, background: on ? "#f0c86e" : RED } }) : null); })) : null,
          [curDay].filter(Boolean).map((d, di) => {
            const st0 = d.story, today = d.today, cast = (st0 && st0.cast) || (today && today.cast) || {}, served = (st0 && st0.served) || (today && today.served) || [], earned = st0 && st0.earned != null ? st0.earned : today ? today.earned : null;
            const staff = Object.keys(cast).filter(p => cast[p]);
            return h("div", Object.assign({ key: d.date, "data-wk": "duelshopdiaryday" }, swipe, { style: { animation: diaryFlip ? (diaryFlip === "older" ? "diaryOlder" : "diaryNewer") + " .38s ease-out" : "none", transformOrigin: diaryFlip === "older" ? "left center" : "right center", position: "relative", margin: di ? "22px 0 0" : "0", padding: "22px 16px 16px 34px", borderRadius: di ? 3 : "0 3px 3px 3px",
                background: "linear-gradient(90deg, transparent 25px, rgba(178,58,46,.25) 25px 26px, transparent 26px), repeating-linear-gradient(" + PAPER + " 0 27px, " + RULE + " 27px 28px), " + PAPER,
                backgroundPosition: "0 0, 0 14px, 0 0", boxShadow: "0 4px 14px rgba(47,42,34,.16), 0 1px 0 rgba(47,42,34,.06)" } }),
              // 装订孔
              [0, 1, 2].map(k => h("span", { key: "h" + k, style: { position: "absolute", left: 8, top: 34 + k * 70, width: 10, height: 10, borderRadius: 99, background: "#e9dfca", boxShadow: "inset 0 1px 2px rgba(47,42,34,.35)" } })),
              // 纸胶带
              h("span", { style: { position: "absolute", top: -9, left: "42%", width: 74, height: 20, background: TAPE[di % 3], transform: "rotate(" + (di % 2 ? 3 : -4) + "deg)", boxShadow: "0 1px 2px rgba(47,42,34,.1)" } }),
              // 日期邮戳 + 收入圆章
              h("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 4 } },
                h("div", { style: { width: 62, height: 62, flexShrink: 0, borderRadius: 99, border: "2px solid " + BROWN, color: BROWN, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: "rotate(-8deg)", fontFamily: FD, lineHeight: 1.1, boxShadow: "inset 0 0 0 3px " + PAPER + ", inset 0 0 0 4px rgba(154,106,74,.45)" } },
                  h("span", { style: { fontSize: fz(9), letterSpacing: ".1em" } }, String(d.date).split("-").slice(0, 2).join(".")),
                  h("span", { style: { fontSize: fz(20) } }, String(d.date).split("-")[2] || ""),
                  h("span", { style: { fontSize: fz(9) } }, wkDay(d))),
                h("div", { className: "flex-1", style: { minWidth: 0 } },
                  h("div", { style: { fontFamily: FD, fontSize: fz(16), color: INK } }, "开店第 " + d.day + " 天"),
                  served.length ? h("div", { style: { fontSize: fz(11), color: SUB, marginTop: 2 } }, "来过 " + served.length + " 位客人") : null),
                earned != null ? h("div", { style: { flexShrink: 0, padding: "4px 9px", border: "1.5px dashed " + RED, color: RED, borderRadius: 4, transform: "rotate(4deg)", fontFamily: FD, fontSize: fz(12), textAlign: "center", lineHeight: 1.2 } }, h("div", { style: { fontSize: fz(9), letterSpacing: ".15em" } }, "收入"), earned + " 枚") : null),
              staff.length ? h("div", { className: "flex flex-wrap", style: { gap: 5, marginTop: 6 } }, staff.map(p => h("span", { key: p, style: { padding: "1px 8px", borderRadius: 3, background: "rgba(79,122,102,.1)", border: "1px solid rgba(79,122,102,.3)", color: GREEN, fontSize: fz(11) } }, p + " · " + (nameOf(cast[p]) || "店员")))) : null,
              served.length ? h("div", { style: { fontSize: fz(11.5), color: SUB, lineHeight: 1.7, marginTop: 6 } }, served.map(c => (c.charId ? nameOf(c.charId) : c.name || "点名要明信片的客人") + (c.tough ? (c.won ? "（打赢了）" : "（没打过）") : "")).join(" · ")) : null,
              st0 ? h("div", { key: "st" }, label("打烊", INK), said(st0.turns, st0.lines).map(lineOf), (st0.notes || []).length ? h("div", { style: { marginTop: 10 } }, h(window.StampShopNotes, { notes: st0.notes, name: nameOf, font: FD, size: fz(12), titleSize: fz(11) })) : null) : null,
              d.visits.map((v, k) => h("div", { key: "v" + k },
                label((v.period ? v.period + " · " : "") + "来访", BROWN),
                h("div", { style: { position: "relative", padding: "10px 12px 10px 14px", margin: "4px 0 0", background: "#fffdf6", borderLeft: "3px solid " + BROWN, boxShadow: "0 2px 6px rgba(47,42,34,.1)", transform: "rotate(" + (k % 2 ? .4 : -.4) + "deg)" } },
                  h("div", { style: { fontSize: fz(11), color: BROWN, marginBottom: 4, fontFamily: FD } }, (nameOf(v.visitorId) || "客人") + " 来店里，碰上 " + (nameOf(v.staffId) || "店员")),
                  said(v.turns, v.lines).map(lineOf)))),
              !st0 && !d.visits.length ? h("div", { style: { marginTop: 12, fontFamily: FD, fontSize: fz(12.5), color: SUB, fontStyle: "italic" } }, "这天没写打烊。") : null);
          }),
          days.length ? h("div", { "data-wk": "duelshopdiarynav", className: "flex items-center", style: { justifyContent: "space-between", margin: "14px 2px 0", fontFamily: FD } },
            h("button", { onClick: () => go(-1), disabled: at <= 0, className: "disabled:opacity-30", style: { padding: "6px 12px", color: BROWN, fontSize: fz(13) } }, "‹ 后一天"),
            h("span", { style: { fontSize: fz(11), color: SUB } }, (at + 1) + " / " + days.length),
            h("button", { onClick: () => go(1), disabled: at >= days.length - 1, className: "disabled:opacity-30", style: { padding: "6px 12px", color: BROWN, fontSize: fz(13) } }, "前一天 ›")) : h("div", { style: { marginTop: 30, textAlign: "center", color: SUB, fontSize: fz(12.5) } }, "还没有写过的日子。打烊写一段、或者听一回来访对话，就会记在这儿。"))
      ]);
    }
    if (!st && mode === "chatlink") {
      const sw = (on, fn, wk) => h("button", { "data-wk": wk, "data-on": on ? "1" : "0", role: "switch", "aria-checked": on, onClick: fn, style: { flexShrink: 0, width: 46, height: 26, borderRadius: 999, background: on ? GREEN : "rgba(47,42,34,.2)", position: "relative", transition: "background .2s" } },
        h("span", { style: { position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" } }));
      const rowOf = (c, k, label, note, wk) => { const on = ChatLink.of(c.id)[k]; return h("div", { className: "flex items-center", style: { gap: 10, padding: "6px 0" } },
        h("div", { className: "flex-1", style: { minWidth: 0 } }, h("div", { style: { fontSize: fz(12.5) } }, label), h("div", { style: { fontSize: fz(10.5), color: SUB, lineHeight: 1.5 } }, note)),
        sw(on, () => { ChatLink.set(c.id, k, !on); tkBump(x => x + 1); }, wk)); };
      return shell([
        h(Head, { key: "hd", zh: "谁能在聊天里提", bg: "transparent", ink: INK, onBack: () => setMode("") }),
        h("div", { key: "bd", "data-wk": "duelchatlink", className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, paddingBottom: 24 } },
          h("div", { style: { fontSize: fz(11.5), color: SUB, lineHeight: 1.7, margin: "6px 0 12px" } }, "默认谁都不提，集邮社里的事只留在集邮社。给谁打开，TA 在你们的私聊里才会知道、才会来约。你自己点「把战报发到聊天里」「发给他看」不受这里管；你在聊天里说要打一把，TA 也照样能发邀请。"),
          (characters || []).filter(c => (cardsAll || []).some(k => k && k.charId === c.id)).map(c => h("div", { key: c.id, style: { marginBottom: 10, padding: "8px 12px", borderRadius: 6, background: "#fffdf7", boxShadow: "0 1px 4px rgba(47,42,34,.08)" } },
            h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 2 } }, c.remark || c.name),
            rowOf(c, "know", "聊天时知道", "TA 知道这周你们的约定、今天店里有没有排 TA、最近跟 TA 打的那把；想提才提。拆 TA 的小包裹、做的信物也会记进 TA 的记忆。", "duelchatlinkknow"),
            rowOf(c, "invite", "会发邀请", "TA 偶尔在私聊里约你：打一把对局、守一回护信、解死信、去巡查、来邮局排班；几天最多一次，忙或睡着时不发。", "duelchatlinkinvite"))))
      ]);
    }
    if (!st && mode === "trinkets") {
      const P = Trinkets.parcels(), all = Trinkets.all();
      const ppl = (characters || []).filter(c => P[c.id] > 0 || all.some(t => t.charId === c.id));
      const who = ppl.some(c => c.id === tkWho) ? tkWho : (ppl[0] || {}).id || "", mine = all.filter(t => t.charId === who).slice().reverse(), left = P[who] || 0;
      const open = async () => {
        if (tkBusy || !who || !onChat || !Trinkets.take(who)) return; setTkBusy(true); tkBump(x => x + 1);
        try { const r = await onChat(who, { mode: "trinket" });
          if (!r || !r.name) { Trinkets.giveBack(who); toast && toast("没拆出来，包裹还在，再点一次"); return; }
          const t = Object.assign({ id: "tk_" + Date.now().toString(36), charId: who, ts: Date.now() }, r); Trinkets.add(t); setTkOpen(t.id); }
        catch (e) { Trinkets.giveBack(who); toast && toast("没成：" + ((e && e.message) || e)); } finally { setTkBusy(false); tkBump(x => x + 1); }
      };
      return shell([
        h(Head, { key: "hd", zh: "小物册", bg: "transparent", ink: INK, onBack: () => setMode(""), right: guideBtn }),
        h("div", { key: "bd", "data-wk": "dueltrinkets", className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, paddingTop: 4, paddingBottom: 24 } },
          modeHero("#9a6a4a", "物", "小物册", "有人陪你打的时候（对局的对手、挑战里陪你打的人、远信里收信和陪你走的人），打完会掉 TA 的小包裹：赢了必掉，输了一半几率。在这儿拆开，TA 照自己的人设和你们真聊过的事留一样小东西给你：名字、来历、TA 看着它说的话。拆一个花一次调用；只是收着，不加数值。"),
          ppl.length ? h("div", { className: "flex flex-wrap", style: { gap: 6, marginBottom: 12 } }, ppl.map(c => { const on = c.id === who;
            return h("button", { key: c.id, "data-wk": "dueltrinketwho", "data-on": on ? "1" : "0", onClick: () => setTkWho(c.id), style: { padding: "3px 11px", borderRadius: 999, border: "1px solid " + (on ? "#9a6a4a" : "rgba(47,42,34,.22)"), background: on ? "rgba(154,106,74,.1)" : "transparent", color: on ? "#9a6a4a" : INK, fontSize: fz(12) } }, (c.remark || c.name) + (P[c.id] ? " · " + P[c.id] + " 个包裹" : "")); }))
            : h("div", { style: { fontSize: fz(12), color: SUB } }, "还没有包裹。挑个人陪你打几局就有了。"),
          who ? h("div", { style: secBox("#9a6a4a", { display: "flex", alignItems: "center", gap: 10 }) },
            h("div", { style: { width: 42, height: 42, borderRadius: 4, background: "repeating-linear-gradient(45deg, #c9a27a 0 6px, #b8906a 6px 12px)", position: "relative", flexShrink: 0 } }, h("div", { style: { position: "absolute", left: "50%", top: 0, bottom: 0, width: 6, marginLeft: -3, background: RED } }), h("div", { style: { position: "absolute", top: "50%", left: 0, right: 0, height: 6, marginTop: -3, background: RED } })),
            h("div", { className: "flex-1", style: { fontSize: fz(12.5) } }, (nameOf(who) || "TA") + " 留给你的包裹 · 还有 " + left + " 个没拆"),
            h("button", { "data-wk": "dueltrinketopen", onClick: open, disabled: tkBusy || !left || !onChat, className: "disabled:opacity-40", style: btn("#9a6a4a", "#fff") }, tkBusy ? "在拆…" : "拆一个")) : null,
          mine.map(t => { const op = tkOpen === t.id;
            return h("div", { key: t.id, "data-wk": "dueltrinket", style: { marginBottom: 8, borderRadius: 5, background: "#fffdf7", border: "1px solid rgba(154,106,74,.3)", borderLeft: "3px solid #9a6a4a" } },
              h("button", { onClick: () => setTkOpen(op ? "" : t.id), className: "w-full text-left", style: { padding: "9px 12px" } },
                h("div", { style: { fontFamily: FD, fontSize: fz(14) } }, t.name), h("div", { style: { fontSize: fz(10.5), color: SUB } }, new Date(t.ts).toLocaleDateString())),
              op ? h("div", { style: { padding: "0 12px 11px", fontSize: fz(12.5), lineHeight: 1.75 } }, t.story ? h("div", null, BT(t.story)) : null,
                t.say ? h("div", { style: { marginTop: 6, padding: "6px 10px", borderLeft: "3px solid #9a6a4a", background: "rgba(154,106,74,.07)", fontFamily: FD, color: "#5a4030", whiteSpace: "pre-wrap" } }, (nameOf(t.charId) || "TA") + "：", BT(t.say)) : null) : null); }))]);
    }
    if (!st && mode === "patrol") {
      const p = patrol, N = D().PATROL.N, COL = "#5a7a4a";
      if (!p || p.done) { const b = patrolBest();
        return shell([
          h(Head, { key: "hd", zh: "邮区巡查", bg: "transparent", ink: INK, onBack: () => setMode(""), right: guideBtn }),
          h("div", { key: "bd", "data-wk": "duelpatrolstart", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingTop: 6, paddingBottom: 24 } },
            modeHero(COL, "巡", "邮区巡查", "一张 5×5 的邮区地图，从最下面中间出发，只能走到上下左右挨着的格子，走到哪翻开到哪，一共 " + D().PATROL.STEPS + " 步。格子里有普通仗、硬仗、宝箱、岔路、驿站，最上面一排藏着巡查长；挑了陪你打的人，图上还会有 3 个 TA 的格子（包裹、TA 在等你、明信片、小剧场、回忆）。信封血一路带着；打赢、开宝箱、打倒巡查长加分。打输了不会结束，算败退：信封留 1 点、扣 2 步。步数用完、打倒巡查长或提前收工就结束。地图每周自动换一张，每个人的都不一样。不花调用。"),
            coachPick(),
            p && p.done ? h("div", { "data-wk": "duelpatroldone", style: { textAlign: "center", margin: "0 0 14px", padding: 14, borderRadius: 6, background: PAPER, boxShadow: "0 2px 8px rgba(47,42,34,.12)" } },
              h("div", { style: { fontFamily: FD, fontSize: fz(22), color: COL } }, p.score + " 分"),
              h("div", { style: { fontSize: fz(11.5), color: SUB } }, p.done.why === "boss" ? "打倒了巡查长" : p.done.why === "hp" ? "信封打空了" : "步数走完了"),
              (p.rewards || []).length ? h("div", { style: { marginTop: 8, fontSize: fz(11.5), color: "#7a5a1a", lineHeight: 1.6 } }, p.rewards.map((t, k) => h("div", { key: k }, t))) : null) : null,
            h("div", { style: { fontSize: fz(12), color: b.score ? "#b8862a" : SUB, marginBottom: 12 } }, (b.score ? "这周最高 " + b.score + " 分" : "这周还没巡查过") + (b.ever ? " · 历史最高 " + b.ever : "")),
            h("button", { "data-wk": "duelpatrolgo", onClick: () => { const deck = D().deckFrom(cards, (Date.now() >>> 0), D().DECK_SIZE, core); const n = D().patrolNew(deck, new Date(), patrolSalt(), !!coachId); n.ta = coachId || ""; n.deck = deck; setPatrol(n); }, className: "w-full", style: Object.assign(btn(COL, "#fff"), { padding: "12px 0", fontFamily: FD, fontSize: fz(15), letterSpacing: ".1em" }) }, p && p.done ? "这周的图再走一遍" : "出发巡查"))]); }
      const ICON = { tparcel: ["包", "#9a6a4a", "包裹"], twait: ["候", "#9a6a4a", "TA 等你"], tpostcard: ["信", "#9a6a4a", "明信片"], tscene: ["戏", "#9a6a4a", "小剧场"], tmemory: ["忆", "#9a6a4a", "回忆"], fight: ["✉", RED, "仗"], elite: ["✦", "#8a3a4a", "硬仗"], boss: ["♛", "#5a4f8a", "巡查长"], chest: ["宝", "#b8862a", "宝箱"], event: ["?", GREEN, "岔路"], rest: ["☕", "#4f6a8a", "驿站"], empty: ["·", SUB, "空"], start: ["起", INK, "起点"] };
      const tile = null;
      return shell([
        h(Head, { key: "hd", zh: "邮区巡查 · " + p.theme, bg: "transparent", ink: INK, onBack: () => setMode(""), right: guideBtn }),
        h("div", { key: "bd", "data-wk": "duelpatrolmap", className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, paddingTop: 4, paddingBottom: 20 } },
          statRow([["步数", p.steps], ["信封", Math.max(0, p.hp) + "/" + p.max, RED], ["巡查分", p.score, "#b8862a"]], COL),
          h("div", { "data-wk": "duelpatrolgrid", style: { display: "grid", gridTemplateColumns: "repeat(" + N + ", minmax(0, 1fr))", gap: 6, padding: 8, borderRadius: 8, background: "repeating-linear-gradient(135deg, rgba(90,122,74,.08) 0 8px, transparent 8px 16px), " + PAPER, boxShadow: "inset 0 0 0 1px rgba(47,42,34,.12)" } },
            p.cells.map((cl, i) => { const here = p.pos[0] === cl.r && p.pos[1] === cl.c, can = D().patrolCan(p, cl.r, cl.c), ic = ICON[cl.type] || ICON.empty;
              return h("button", { key: i, "data-wk": "duelpatrolcell", "data-open": can ? "1" : "0", "data-type": cl.open ? cl.type : "", onClick: () => can && patrolGo(cl.r, cl.c), disabled: !can,
                style: { position: "relative", aspectRatio: "1 / 1", borderRadius: 4, border: here ? "2px solid " + RED : can ? "2px dashed " + COL : "1px solid rgba(47,42,34,.15)", background: !cl.open ? "repeating-linear-gradient(45deg, #d9cfb8 0 5px, #e4dbc6 5px 10px)" : cl.done && !here ? "rgba(47,42,34,.06)" : "#fffdf7",
                  color: ic[1], fontFamily: FD, fontSize: fz(18), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: cl.done && !here && cl.type !== "start" ? .55 : 1, animation: can ? "duelPulse 1.6s ease-in-out infinite" : "none" } },
                cl.open ? ic[0] : "", cl.open ? h("span", { style: { fontFamily: F, fontSize: fz(8.5), color: SUB, marginTop: 1 } }, here ? "你在这" : cl.done && cl.type !== "start" ? "✓" : ic[2]) : null); })),
          h("div", { style: { fontSize: fz(11), color: SUB, margin: "8px 2px", lineHeight: 1.6 } }, (p.ta ? "棕色字的是 " + (nameOf(p.ta) || "TA") + " 的格子：包裹、等你（回 10、多 2 步）、明信片 +10、小剧场 +15、回忆 +15。" : "") + "虚线框是能走的格子；斜纹是还没翻开的。普通仗 +" + D().PATROL.PTS.fight + "、硬仗 +" + D().PATROL.PTS.elite + "、宝箱 +" + D().PATROL.PTS.chest + "、巡查长 +" + D().PATROL.PTS.boss + "；驿站回 " + D().PATROL.HEAL + "。"),
          p.ask ? h("div", { "data-wk": "duelpatrolask", style: { margin: "10px 0", padding: "11px 13px", borderRadius: 6, background: "rgba(154,106,74,.1)", border: "1px solid rgba(154,106,74,.35)" } },
            h("div", { style: { fontFamily: FD, fontSize: fz(14), color: "#9a6a4a" } }, (nameOf(p.ta) || "TA") + (p.ask.kind === "tpostcard" ? " 寄到这一格的明信片" : p.ask.kind === "tscene" ? " 在这一格" : " 想起一件事")),
            h("div", { style: { fontSize: fz(11.5), color: SUB, margin: "3px 0 8px" } }, "分已经拿到了。要" + (p.ask.kind === "tpostcard" ? "翻过来看" : p.ask.kind === "tscene" ? "看这一小段" : "听 TA 讲") + "吗？花一次调用。"),
            h("div", { className: "flex", style: { gap: 8 } },
              h("button", { "data-wk": "duelpatrollisten", onClick: patrolListen, disabled: paBusy, className: "flex-1 disabled:opacity-50", style: btn("#9a6a4a", "#fff") }, paBusy ? (nameOf(p.ta) || "TA") + " 在写…" : "要"),
              h("button", { onClick: () => { p.ask = null; setPatrol(p); }, className: "flex-1", style: btn("transparent", INK, "rgba(47,42,34,.3)") }, "跳过"))) : null,
          p.show != null && (p.notes || [])[p.show] ? (() => { const n = p.notes[p.show];
            return h("div", { "data-wk": "duelpatrolnote", style: { margin: "10px 0", padding: "14px 16px", borderRadius: 4, background: PAPER, boxShadow: "0 3px 10px rgba(47,42,34,.15)", borderTop: "4px solid #9a6a4a" } },
              h("div", { style: { fontSize: fz(10.5), color: SUB, letterSpacing: ".15em", marginBottom: 6 } }, (nameOf(p.ta) || "TA") + " · " + (n.kind === "tpostcard" ? "明信片" : n.kind === "tscene" ? "小剧场" : "回忆")),
              n.lines.map((t, k) => h("p", { key: k, style: { fontFamily: FD, fontSize: fz(13.5), lineHeight: 1.85, margin: "0 0 8px", whiteSpace: "pre-wrap" } }, BT(t))),
              h("button", { onClick: () => { p.show = null; setPatrol(p); }, style: btn("transparent", SUB, "rgba(47,42,34,.25)") }, "收起来")); })() : null,
          (p.notes || []).length > 0 && p.show == null ? h("div", { className: "flex flex-wrap", style: { gap: 6, margin: "8px 0" } }, p.notes.map((n, k) => h("button", { key: k, onClick: () => { p.show = k; setPatrol(p); }, style: { padding: "2px 9px", borderRadius: 999, border: "1px solid rgba(154,106,74,.4)", color: "#9a6a4a", fontSize: fz(11) } }, (n.kind === "tpostcard" ? "明信片" : n.kind === "tscene" ? "小剧场" : "回忆") + " " + (k + 1)))) : null,
          p.log.length ? h("div", { "data-wk": "duelpatrollog", style: { fontSize: fz(11.5), color: INK, lineHeight: 1.7, padding: "6px 10px", borderRadius: 5, background: "rgba(255,253,247,.8)" } }, p.log.slice(-4).reverse().map((t, k) => h("div", { key: k, style: { opacity: k ? .6 : 1 } }, t))) : null,
          h("button", { "data-wk": "duelpatrolend", onClick: () => { if (typeof requestAppConfirm === "function") requestAppConfirm("结束这次巡查？", "按现在的 " + p.score + " 分算。", () => { p.done = { why: "steps" }; patrolFinish(p); setPatrol(p); }, "结束"); else { p.done = { why: "steps" }; patrolFinish(p); setPatrol(p); } }, className: "w-full", style: Object.assign(btn("transparent", SUB, "rgba(47,42,34,.3)"), { marginTop: 12 }) }, "提前收工"))]);
    }
    if (!st && mode === "shift") {
      const sh = shift;
      if (!sh || sh.done) {
        const b = shiftBestOf();
        return shell([
          h(Head, { key: "hd", zh: "邮局值班", bg: "transparent", ink: INK, onBack: () => { setShift(null); setMode(""); }, right: guideBtn }),
          h("div", { key: "bd", "data-wk": "duelshiftstart", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingTop: 6, paddingBottom: 24 } },
            sh && sh.done ? h("div", { "data-wk": "duelshiftdone", style: { textAlign: "center", margin: "6px 0 16px", padding: "14px", borderRadius: 6, background: PAPER, boxShadow: "0 2px 8px rgba(47,42,34,.12)" } },
              h("div", { style: { fontFamily: FD, fontSize: fz(20), color: sh.done.win ? GREEN : RED } }, sh.done.win ? "值完了 8 轮" : "撑到第 " + sh.done.round + " 轮"),
              h("div", { style: { fontSize: fz(11.5), color: SUB, marginTop: 4 } }, sh.log.map(l => l.win ? "胜" : "负").join(" · ")),
              (sh.rewards || []).length ? h("div", { style: { marginTop: 8, fontSize: fz(11.5), color: "#7a5a1a", lineHeight: 1.6 } }, sh.rewards.map((t, k) => h("div", { key: k }, t))) : null) : null,
            modeHero("#4f6a8a", "值", "邮局值班", "开局手里没票，只有 " + D().SHIFT.START + " 枚邮花。每一轮先到柜台：柜台摆 5 张你邮票册里的票（R " + D().SHIFT.PRICE.R + "、SR " + D().SHIFT.PRICE.SR + "、SSR " + D().SHIFT.PRICE.SSR + " 枚），买进值班卡组；同一张买两份合成「＋」，最多「＋＋」；同一个人的票凑满 3 张，这个人的票攻击 +1。买好点「开打」跟这一轮的审查局打一局（最多 8 回合），输了掉一条命，一共 " + D().SHIFT.LIVES + " 条，撑满 " + D().SHIFT.ROUNDS + " 轮算完成。每轮收入 5 枚，手上每攒 5 枚多给 1 枚利息（最多 3）。不花调用。"),
          coachPick(),
            h("div", { style: { fontSize: fz(12), color: b.round ? "#b8862a" : SUB, marginBottom: 12 } }, b.round ? "最好撑到第 " + b.round + " 轮" + (b.done ? "，值完过 " + b.done + " 次" : "") : "还没值过班"),
            h("button", { "data-wk": "duelshiftgo", onClick: () => { const n = D().shiftNew((Date.now() ^ seedRef.current) >>> 0); D().shiftRoll(n, cards); setShift(n); }, className: "w-full", style: Object.assign(btn("#4f6a8a", "#fff"), { padding: "12px 0", fontFamily: FD, fontSize: fz(15), letterSpacing: ".1em" }) }, "开始值班"))]);
      }
      const bonds = D().shiftBonds(sh), sel = sh.bench[shiftSel];
      const act = r => { if (r && r.ok === false) { toast && toast(r.why); return; } if (r && r.merged) toast && toast("合成了「" + r.merged + "」"); setShift(sh); };
      return shell([
        h(Head, { key: "hd", zh: "邮局值班 · 第 " + sh.round + " / " + D().SHIFT.ROUNDS + " 轮", bg: "transparent", ink: INK, onBack: () => setMode(""), right: guideBtn }),
        h("div", { key: "bd", "data-wk": "duelshiftshop", className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, paddingTop: 4, paddingBottom: 20 } },
          statRow([["命", "♥".repeat(sh.lives) + "♡".repeat(Math.max(0, D().SHIFT.LIVES - sh.lives)), RED], ["邮花", sh.coins, "#b8862a"], ["卡组", sh.bench.length + " / " + D().SHIFT.BENCH]], "#4f6a8a"),
          h("div", { className: "flex items-center", style: { justifyContent: "space-between", margin: "4px 0 6px" } }, h("span", { style: { fontFamily: FD, fontSize: fz(14) } }, "柜台"), h("button", { "data-wk": "duelshiftroll", onClick: () => { if (!D().shiftRoll(sh, cards, true)) toast && toast("邮花不够"); else setShift(sh); }, style: btn("transparent", INK, "rgba(47,42,34,.3)") }, "刷新（" + D().SHIFT.REROLL + " 枚）")),
          h("div", { "data-wk": "duelshiftcounter", style: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6, marginBottom: 14 } }, sh.shop.map((u, i) => h("div", { key: i, style: { position: "relative" } },
            h(Ticket, { u, card: cardOf(u.cardId), owner: ownerOf(u.charId), useThumb, small: true, wk: "duelshiftbuy", onTap: () => act(D().shiftBuy(sh, i)), onLong: () => openInfo(u, false) }),
            h("div", { style: { textAlign: "center", fontFamily: FD, fontSize: fz(12), color: sh.coins >= D().shiftPrice(u) ? "#b8862a" : SUB } }, D().shiftPrice(u) + " 枚" + (sh.bench.some(b => b.cardId === u.cardId) ? " · 可合成" : ""))))),
          h("div", { style: { fontFamily: FD, fontSize: fz(14), margin: "4px 0 4px" } }, "值班卡组"),
          Object.keys(bonds).length ? h("div", { className: "flex flex-wrap", style: { gap: 5, marginBottom: 6 } }, Object.keys(bonds).map(id => h("span", { key: id, style: { padding: "1px 8px", borderRadius: 999, fontSize: fz(11), border: "1px solid " + (bonds[id] >= 3 ? GREEN : "rgba(47,42,34,.2)"), color: bonds[id] >= 3 ? GREEN : SUB } }, (nameOf(id) || "通用") + " ×" + bonds[id] + (bonds[id] >= 3 ? " · 攻击 +1" : "")))) : null,
          sh.bench.length ? h("div", { "data-wk": "duelshiftbench", style: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 } }, sh.bench.map((u, i) => h(Ticket, { key: i, u, card: cardOf(u.cardId), owner: ownerOf(u.charId), useThumb, small: true, sel: shiftSel === i, wk: "duelshiftunit", onTap: () => setShiftSel(shiftSel === i ? -1 : i), onLong: () => openInfo(u, false) })))
            : h("div", { style: { fontSize: fz(12), color: SUB } }, "还没买票。点柜台上的票买进来；长按看底细。"),
          coachId && onChat ? h("div", { "data-wk": "duelshiftcoach", style: { marginTop: 12 } },
            h("button", { onClick: async () => { if (coachBusy) return; setCoachBusy(true);
                try { const shopTxt = "她在玩「邮局值班」，第 " + sh.round + " / " + D().SHIFT.ROUNDS + " 轮，还剩 " + sh.lives + " 条命，手上 " + sh.coins + " 枚邮花，现在在柜台挑票（R " + D().SHIFT.PRICE.R + "、SR " + D().SHIFT.PRICE.SR + "、SSR " + D().SHIFT.PRICE.SSR + " 枚，刷新 " + D().SHIFT.REROLL + " 枚；同一张买两份合成更强，同一个人凑满 3 张攻击 +1）。柜台上：" + sh.shop.map(u => "「" + u.name + "」" + u.rarity + " " + u.role + " 攻" + u.pow + " 血" + u.maxHp + "（" + (nameOf(u.charId) || "通用") + "的卡，" + D().shiftPrice(u) + " 枚）").join("；") + "。她的值班卡组：" + (sh.bench.map(u => "「" + u.name + "」" + u.role + "（" + (nameOf(u.charId) || "通用") + "）").join("、") || "空的") + "。打过的轮：" + (sh.log.map(l => l.win ? "胜" : "负").join("") || "还没打");
                  const lines = await onChat(coachId, { mode: "coach", text: "", board: shopTxt, history: "" }); setCoachTip(lines && lines.length ? lines : ["（没接上话，再点一次）"]); }
                catch (e) { toast && toast("没成：" + ((e && e.message) || e)); } finally { setCoachBusy(false); } }, disabled: coachBusy, className: "w-full disabled:opacity-50", style: btn("transparent", GREEN, GREEN) }, coachBusy ? (nameOf(coachId) || "TA") + " 在看…" : "问 " + (nameOf(coachId) || "TA") + " 买哪张"),
            coachTip ? h("div", { style: { marginTop: 6, padding: "7px 11px", borderRadius: "4px 12px 12px 12px", background: "#fff", fontSize: fz(12.5), lineHeight: 1.6 } }, h("span", { style: { color: GREEN, fontFamily: FD, marginRight: 6 } }, nameOf(coachId) || "TA"), coachTip.join(" ")) : null) : null,
          sel ? h("button", { "data-wk": "duelshiftsell", onClick: () => { const back = D().shiftSell(sh, shiftSel); toast && toast("卖了「" + sel.name + "」，退 " + back + " 枚"); setShiftSel(-1); setShift(sh); }, className: "w-full", style: Object.assign(btn("transparent", RED, RED), { marginTop: 8 }) }, "卖掉「" + sel.name + "」") : null,
          h("button", { "data-wk": "duelshiftfight", disabled: !sh.bench.length, onClick: () => startShiftBattle(sh), className: "w-full disabled:opacity-40", style: Object.assign(btn("#4f6a8a", "#fff"), { marginTop: 14, padding: "12px 0", fontFamily: FD, fontSize: fz(15) }) }, "开打 · 第 " + sh.round + " 轮")),
        info ? h(StampInfo, { key: "info", u: info.u, foe: false, bonds: bondsOf(), cardOf, ownerOf, nameOf, useThumb, onClose: () => setInfo(null) }) : null]);
    }
    if (!st && mode === "edictpick") {
      const E = D().EDICTS, pts = edictPick.reduce((a, k) => a + E[k].pt, 0), b = edictBest(), my = Math.round(D().avgLv(cards || []));
      return shell([
        h(Head, { key: "hd", zh: "封缄令", bg: "transparent", ink: INK, onBack: () => setMode(""), right: guideBtn }),
        h("div", { key: "bd", "data-wk": "dueledictpick", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingTop: 6, paddingBottom: 24 } },
          modeHero("#5a4f8a", "封", "封缄令", "对面是「审查局」，等级固定 " + D().EDICT_LV + " 级（你的卡平均 " + my + " 级）。下面每一条都是给自己加的难度，后面写着分：勾得越多越难，打赢了勾的分加起来就是这一把的「危险」，记最高的。一条不勾也能打，算 0 分。"),
          coachPick(),
          h("div", { "data-wk": "duelediclist", style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 } }, Object.keys(E).map(k => { const on = edictPick.includes(k);
            return h("button", { key: k, "data-wk": "duelediccheck", "data-on": on ? "1" : "0", onClick: () => setEdictPick(p => on ? p.filter(x => x !== k) : p.concat(k)), className: "text-left",
              style: { position: "relative", padding: "9px 10px 9px 12px", borderRadius: 5, background: on ? "rgba(138,58,74,.1)" : "rgba(255,253,247,.9)", border: "1.5px solid " + (on ? "#8a3a4a" : "rgba(47,42,34,.15)"), color: INK, fontSize: fz(12), lineHeight: 1.45, minHeight: 52 } },
              E[k].zh, h("span", { style: { position: "absolute", right: 6, bottom: 4, fontFamily: FD, fontSize: fz(12), color: on ? "#8a3a4a" : SUB } }, "+" + E[k].pt)); })),
          h("div", { className: "flex items-baseline", style: { justifyContent: "space-between", margin: "14px 2px 8px" } },
            h("span", { style: { fontSize: fz(12), color: SUB } }, b.pts ? "最高 危险 " + b.pts : "还没通过过"),
            h("span", { "data-wk": "duelediccpts", style: { fontFamily: FD, fontSize: fz(22), color: "#8a3a4a" } }, "危险 " + pts)),
          h("button", { "data-wk": "duelediccgo", onClick: () => startEdict(edictPick), className: "w-full", style: Object.assign(btn("#8a3a4a", "#fff"), { padding: "12px 0", fontFamily: FD, fontSize: fz(15), letterSpacing: ".1em" }) }, "盖上封缄，开打"))]);
    }
    if (!st && mode === "raidpick") {
      const card = (m, title, desc, c) => { const b = raidBest(m);
        return h("button", { key: m, "data-wk": "duelraidgo", "data-mode": m, onClick: () => startRaid(m), className: "w-full text-left active:scale-[.99]", style: { display: "block", marginBottom: 12, padding: "14px 16px", borderRadius: 6, background: PAPER, boxShadow: "0 2px 8px rgba(47,42,34,.12)", borderLeft: "4px solid " + c, color: INK } },
          h("div", { style: { fontFamily: FD, fontSize: fz(17), color: c } }, title),
          h("div", { style: { fontSize: fz(12), color: SUB, lineHeight: 1.7, marginTop: 4 } }, desc),
          h("div", { style: { fontSize: fz(11.5), marginTop: 6, color: b.dealt ? "#b8862a" : SUB } }, b.dealt ? "最高 " + b.dealt + " 伤害" + (m === "endless" ? "，撑了 " + b.turn + " 回合" : "") : "还没打过")); };
      return shell([
        h(Head, { key: "hd", zh: "积压件", bg: "transparent", ink: INK, onBack: () => setMode(""), right: guideBtn }),
        h("div", { key: "bd", "data-wk": "duelraidpick", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingTop: 6, paddingBottom: 24 } },
          modeHero("#8a3a4a", "积", "积压件", "对面是打不死的「邮政总局」，比的是你能打出多少伤害。总局每回合派人顶在前排，有的贴着「封条」：封着的时候怎么打都只掉 1，用邮戳打、或者盖章打到它，封条就撕开，接下来两回合虚弱、挨打翻倍。总局每回合还会盖一记大章砸你的信封，越往后越重。第 4、第 7 回合换阶段。"),
          coachPick(),
          card("normal", "积压件 · 8 回合", "打满 8 回合算总伤害。信封被砸空就提前结束，分照算。", RED),
          card("endless", "无尽", "不设回合数，一直打到你的信封空。8 回合以后大章越砸越重，看能撑几回合、打出多少。", "#6a4f8a"))]);
    }
    if (!st && mode === "siegepick") { const my = Math.round(D().avgLv(cards || []));
      return shell([
        h(Head, { key: "hd", zh: "护信", bg: "transparent", ink: INK, onBack: () => setMode(""), right: guideBtn }),
        h("div", { key: "bd", "data-wk": "duelsiegepick", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingTop: 6, paddingBottom: 24 } },
          modeHero("#3f6fb0", "护", "护信", "挑一档守。每档敌人的等级是定的，第 1 波比建议等级低一半，越往后越高，第 10 波高出三成。你这些卡平均 " + my + " 级：比建议低的档也能守，靠站位、组合和盖章；卡练强了再去打高档。"),
          coachPick(),
          D().SIEGE_TIERS.map((lv, t) => { const b = siegeBest(t), easy = my >= lv, c = easy ? GREEN : my >= lv * 0.7 ? "#b8862a" : RED;
            return h("button", { key: t, "data-wk": "duelsiegetier", onClick: () => startSiege(t), className: "w-full text-left active:scale-[.99]", style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 10, padding: "12px 14px", borderRadius: 6, background: PAPER, boxShadow: "0 2px 8px rgba(47,42,34,.12)", borderLeft: "4px solid " + c, color: INK } },
              h("div", { style: { fontFamily: FD, fontSize: fz(20), color: c, width: 30, textAlign: "center" } }, t + 1),
              h("div", { className: "flex-1 min-w-0" },
                h("div", { style: { fontFamily: FD, fontSize: fz(14) } }, "第 " + (t + 1) + " 档 · 建议 " + lv + " 级"),
                h("div", { style: { fontSize: fz(11), color: SUB } }, (easy ? "你的卡够了" : my >= lv * 0.7 ? "差一点，要动脑子" : "比你高不少，硬仗") + (b.waves ? " · 最好守住 " + b.waves + " 波" + (b.wins ? "，守住过 " + b.wins + " 次" : "") : ""))));
          }))]); }
    if (!st && !mode) return shell([
      h(Head, { key: "hd", zh: "集邮社", bg: "transparent", ink: INK, onBack, right: guideBtn }),
      h("div", { key: "bd", "data-wk": "duelmodes", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingTop: 6, paddingBottom: 24 } },
        h("div", { key: "intro", style: { fontSize: fz(12), color: SUB, margin: "0 0 10px" } }, "拿邮票册里的卡来玩。挑一枚："),
        h("div", { key: "sec1", style: { fontFamily: FD, fontSize: fz(13), color: INK, margin: "4px 2px 8px", letterSpacing: ".1em" } }, "和 TA 一起"),
        h("div", { key: "g1", "data-wk": "duelmodegrid", style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 16 } },
          modeTile("duelmodeduel", RED, "对", "对局", "跟一个人面对面打一把", saved ? "有一把没打完" : "", () => setMode("duel"), -1.5),
          onRun ? modeTile("duelgorun", "#b8862a", "远", "远信", "寄一封信，一路打过去", "", onRun, 1.2) : null,
          modeTile("duelmoderelay", "#a0522d", "接", "接力", "你一回合、TA 一回合", "", () => setMode("relay"), 1),
          modeTile("duelmodestory", "#7a3b5a", "章", "剧情闯关", "一起走一段五章的故事", story ? "走到第 " + story.chapters.length + " 章" : "", () => setMode("story"), -1),
          modeTile("duelmodeshop", "#8a6a2a", "店", "邮局小店", "按现实时间开店", shopSt ? "开到第 " + shopSt.day + " 天" : "", () => setMode("shop"), 1.1)),
        h("div", { key: "sec2", style: { fontFamily: FD, fontSize: fz(13), color: INK, margin: "4px 2px 8px", letterSpacing: ".1em" } }, "挑战"),
        h("div", { key: "g2", "data-wk": "duelmodegrid", style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 16 } },
          (() => { const t = [0, 1, 2, 3, 4].filter(k => siegeBest(k).wins).pop(); return modeTile("duelmodesiege", "#3f6fb0", "护", "护信", "一波一波守住信封", t != null ? "守住过第 " + (t + 1) + " 档" : "", () => setMode("siegepick"), 1); })(),
          (() => { const b = raidBest("normal"); return modeTile("duelmoderaid", "#8a3a4a", "积", "积压件", "打不死的总局，冲伤害", b.dealt ? "最高 " + b.dealt + " 伤害" : "", () => setMode("raidpick"), -1); })(),
          (() => { const b = edictBest(); return modeTile("duelmodeedict", "#5a4f8a", "封", "封缄令", "自己加难度，冲危险分", b.pts ? "最高 危险 " + b.pts : "", () => setMode("edictpick"), -1.2); })(),
          (() => { const n = Object.keys(pzDone()).length; return modeTile("duelmodepuzzle", "#6a5a3a", "死", "死信", "一回合打空，找最好的一手", n ? "过了 " + n + " / " + D().PUZZLE_MAX + " 关" : "", () => setMode("puzzle"), 0.9); })(),
          (() => { const b = patrolBest(); return modeTile("duelmodepatrol", "#5a7a4a", "巡", "邮区巡查", "每周一张图，自己挑路走", patrol && !patrol.done ? "这周走到一半" : b.score ? "这周最高 " + b.score + " 分" : "", () => setMode("patrol"), -0.8); })(),
          (() => { const b = shiftBestOf(); return modeTile("duelmodeshift", "#4f6a8a", "值", "邮局值班", "柜台买票，凑阵容", shift ? "值到第 " + shift.round + " 轮" : b.round ? "最好第 " + b.round + " 轮" : "", () => setMode("shift"), 1.4); })()),
        (() => { const a = Dispatch.all(), act = a.filter(t => !t.report), ready = act.filter(t => t.end <= Date.now()).length;
          return h("button", { key: "dp", "data-wk": "dueldispatchgo0", onClick: () => setMode("dispatch"), className: "w-full flex items-center active:opacity-80", style: { gap: 10, marginBottom: 10, padding: "10px 14px", borderRadius: 6, background: "rgba(63,122,138,.1)", border: "1px solid rgba(63,122,138,.35)", color: INK } },
            h("span", { style: { fontFamily: FD, fontSize: fz(18), color: "#3f7a8a" } }, "派"), h("span", { className: "flex-1 text-left", style: { fontSize: fz(12) } }, h("b", { style: { fontFamily: FD, fontWeight: 400, color: "#3f7a8a" } }, "派遣"), act.length ? " · 在外面 " + act.length + " 队" + (ready ? "，" + ready + " 队回来了" : "") : " · 派几张票出去送信，回来带见闻"), h("span", { style: { color: SUB } }, "›")); })(),
        (() => { const P = Trinkets.parcels(), n = Object.values(P).reduce((a, b) => a + b, 0), m = Trinkets.all().length;
          return h("button", { key: "tk", "data-wk": "dueltrinketgo", onClick: () => setMode("trinkets"), className: "w-full flex items-center active:opacity-80", style: { gap: 10, marginBottom: 10, padding: "10px 14px", borderRadius: 6, background: "rgba(154,106,74,.1)", border: "1px solid rgba(154,106,74,.35)", color: INK } },
            h("span", { style: { fontFamily: FD, fontSize: fz(18), color: "#9a6a4a" } }, "物"), h("span", { className: "flex-1 text-left", style: { fontSize: fz(12) } }, h("b", { style: { fontFamily: FD, fontWeight: 400, color: "#9a6a4a" } }, "小物册"), " · 收了 " + m + " 样" + (n ? "，还有 " + n + " 个包裹没拆" : "")), h("span", { style: { color: SUB } }, "›")); })(),
        (() => { const L = ChatLink.all(), n = Object.values(L).filter(x => x && (x.know || x.invite)).length;
          return h("button", { key: "cl", "data-wk": "duelchatlinkgo", onClick: () => setMode("chatlink"), className: "w-full flex items-center active:opacity-80", style: { gap: 10, marginBottom: 10, padding: "10px 14px", borderRadius: 6, background: "rgba(63,111,176,.08)", border: "1px solid rgba(63,111,176,.3)", color: INK } },
            h("span", { style: { fontFamily: FD, fontSize: fz(18), color: "#3f6fb0" } }, "聊"), h("span", { className: "flex-1 text-left", style: { fontSize: fz(12) } }, h("b", { style: { fontFamily: FD, fontWeight: 400, color: "#3f6fb0" } }, "谁能在聊天里提"), n ? " · 开了 " + n + " 个人" : " · 现在都不提"), h("span", { style: { color: SUB } }, "›")); })(),
        h("button", { key: "tut", "data-wk": "duelturorial", onClick: startTut, className: "w-full flex items-center active:opacity-80", style: { gap: 10, marginBottom: 14, padding: "10px 14px", borderRadius: 6, background: "rgba(79,122,102,.1)", border: "1px dashed " + GREEN, color: INK } },
          h("span", { style: { fontFamily: FD, fontSize: fz(18), color: GREEN } }, "教"), h("span", { className: "flex-1 text-left", style: { fontSize: fz(12) } }, h("b", { style: { fontFamily: FD, fontWeight: 400, color: GREEN } }, "新手教学关"), " · 第一次玩先来这儿，一步步教"), h("span", { style: { color: SUB } }, "›")),
        (() => { const p = Pact.now(); if (!p) return null; const g = Pact.goalOf(p), who = nameOf(p.charId) || "TA";
          const write = async () => {
            if (tkBusy || !onChat) return; setTkBusy(true);
            try { const r = await onChat(p.charId, { mode: "trinket", pact: g.zh(g.n) });
              if (!r || !r.name) { toast && toast("TA 还没写好，再点一次"); return; }
              const t = Object.assign({ id: "tk_" + Date.now().toString(36), charId: p.charId, ts: Date.now(), from: "每周约定" }, r); Trinkets.add(t); Pact.open(); setTkWho(p.charId); setTkOpen(t.id); setMode("trinkets"); }
            catch (e) { toast && toast("没成：" + ((e && e.message) || e)); } finally { setTkBusy(false); } };
          return h("div", { key: "pact", "data-wk": "duelpact", "data-done": p.done ? "1" : "0", style: { marginBottom: 14, padding: "10px 14px", borderRadius: 6, background: p.done ? "rgba(79,122,102,.1)" : "rgba(255,253,247,.9)", border: "1px dashed " + (p.done ? GREEN : "rgba(47,42,34,.2)") } },
            h("div", { style: { fontFamily: FD, fontSize: fz(14), color: INK } }, "这周和 " + who + " 的约定"),
            h("div", { style: { fontSize: fz(12), margin: "3px 0 6px" } }, g.zh(g.n)),
            h("div", { style: { height: 6, borderRadius: 3, background: "rgba(47,42,34,.1)", overflow: "hidden" } }, h("div", { style: { width: Math.round(100 * p.prog / g.n) + "%", height: "100%", background: GREEN } })),
            h("div", { style: { fontSize: fz(10.5), color: SUB, marginTop: 4 } }, p.prog + " / " + g.n + (p.opened ? " · 信已经收进小物册了" : p.done ? "" : " · 做到了 TA 给你写封信，进小物册")),
            p.done && !p.opened ? h("button", { "data-wk": "duelpactopen", onClick: write, disabled: tkBusy, className: "w-full disabled:opacity-50", style: Object.assign(btn(GREEN, "#fff"), { marginTop: 8 }) }, tkBusy ? who + " 在写…" : "做到了，拆 " + who + " 的信（花一次调用）") : null); })(),
        (() => { const g = Rewards.got().got || {}, n = MILESTONES.filter(m => g[m.id]).length;
          return h("details", { key: "ms", "data-wk": "duelmilestones", style: { marginBottom: 14, padding: "10px 14px", borderRadius: 6, background: "rgba(255,253,247,.9)", boxShadow: "0 2px 8px rgba(47,42,34,.10)" } },
            h("summary", { style: { fontFamily: FD, fontSize: fz(14), cursor: "pointer", color: INK } }, "战功邮戳 · " + n + " / " + MILESTONES.length),
            h("div", { style: { fontSize: fz(11), color: SUB, margin: "4px 0 8px", lineHeight: 1.6 } }, "每个第一次达成给一笔印泥和邮资，只给一次；每天第一次赢任何玩法另给 " + DAILY.ink + " 印泥、" + DAILY.postage + " 邮资。"),
            h("div", { className: "flex flex-wrap", style: { gap: 6 } }, MILESTONES.map(m => { const on = !!g[m.id]; return h("span", { key: m.id, "data-wk": "duelmilestone", "data-on": on ? "1" : "0", style: { padding: "2px 9px", borderRadius: 999, fontSize: fz(11), border: "1px " + (on ? "solid #b8862a" : "dashed rgba(47,42,34,.25)"), color: on ? "#b8862a" : SUB, background: on ? "rgba(184,134,42,.08)" : "transparent" } }, (on ? "✦ " : "") + m.zh + (on ? "" : " · " + m.ink)); }))); })(),
        null)]);
    // ── 开局前：挑对手、明牌还是盲打 ──
    if (!st) return shell([
      h(Head, { key: "hd", zh: "对局", bg: "transparent", ink: INK, onBack: preset ? onBack : () => setMode(""), right: guideBtn }),
      h("div", { key: "bd", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingBottom: 24 } },
        modeHero(RED, "对", "对局", "跟一个人面对面打一把。每局从你的收藏里随机抽 12 张。对面用 TA 自己的卡，加上跟 TA 有关系的人的卡；不够的用普通邮票补。不花调用。"),
        saved ? h("div", { "data-wk": "duelresume", style: { marginBottom: 16, padding: "10px 12px", borderRadius: 4, border: "1px dashed " + RED, background: "rgba(178,58,46,.05)" } },
          h("div", { style: { fontSize: fz(13), marginBottom: 8 } }, "上次那一把还没打完：对 " + (nameOf(saved.foeId) || "TA") + "，第 " + saved.st.turn + " 回合，信封 " + Math.max(0, saved.st.me.hp) + " : " + Math.max(0, saved.st.foe.hp)),
          h("div", { className: "flex", style: { gap: 8 } },
            h("button", { onClick: resume, className: "flex-1", style: btn(RED, "#fff") }, "接着打"),
            h("button", { onClick: () => { if (typeof requestAppConfirm === "function") requestAppConfirm("放弃这一把？", "放弃了就接不回来了。", drop, "放弃"); else drop(); }, className: "flex-1", style: btn("transparent", INK, INK) }, "放弃"))) : null,
        h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 4 } }, "带谁上场"),
        h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 8 } }, "最多挑两个人：卡组三分之二从他们的卡里抽，好凑连张、四方连和羁绊。不挑就全随机。"),
        h("div", { className: "flex flex-wrap", style: { gap: 8, marginBottom: 18 } }, (characters || []).filter(c => (cards || []).some(x => x.charId === c.id)).map(c => {
          const on = core.includes(c.id), n = (cards || []).filter(x => x.charId === c.id).length;
          return h("button", { key: c.id, "data-wk": "duelcore", "data-on": on ? "1" : "0", onClick: () => setCore(p => on ? p.filter(x => x !== c.id) : p.concat(c.id).slice(-2)), className: "active:opacity-70",
            style: { padding: "5px 11px", borderRadius: 999, border: "1px solid " + (on ? GREEN : "rgba(47,42,34,.25)"), background: on ? "rgba(79,122,102,.12)" : "rgba(255,255,255,.4)", color: on ? GREEN : INK, fontSize: fz(12.5) } },
            (c.remark || c.name) + " · " + n + " 张");
        })),
        h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 8 } }, "跟谁打"),
        h("div", { className: "flex flex-wrap", style: { gap: 8, marginBottom: 18 } }, (characters || []).map(c => {
          const n = (cards || []).filter(x => x.charId === c.id).length, on = foeId === c.id;
          return h("button", { key: c.id, "data-wk": "duelfoe", "data-on": on ? "1" : "0", onClick: () => setFoeId(c.id), className: "active:opacity-70",
            style: { padding: "6px 12px 6px 6px", borderRadius: 999, display: "flex", alignItems: "center", gap: 6, border: "1px solid " + (on ? RED : "rgba(47,42,34,.25)"), background: on ? "rgba(178,58,46,.07)" : "rgba(255,255,255,.4)", color: on ? RED : INK, fontSize: fz(12.5) } },
            h("span", { style: { width: 22, height: 22, borderRadius: 999, background: c.avatarImage || c.avatar ? "#ccc center/cover url(" + (typeof resolveImg === "function" ? resolveImg(c.avatarImage || c.avatar) : (c.avatarImage || c.avatar)) + ")" : "#d8ccb4" } }),
            (c.remark || c.name) + (n ? " · " + n : ""));
        })),
        // 跟这个人的战绩
        (() => { const r = stats[foeId]; if (!r || !(r.w + r.l + r.d)) return null;
          const top = o => Object.keys(o || {}).sort((a, b) => o[b] - o[a])[0];
          return h("div", { "data-wk": "duelstats", style: { marginBottom: 16, padding: "9px 12px", borderRadius: 4, background: "rgba(255,255,255,.5)", border: "1px solid rgba(47,42,34,.15)", fontSize: fz(12), lineHeight: 1.7 } },
            h("div", { style: { fontFamily: FD, fontSize: fz(13) } }, "跟 " + foeName + "：" + r.w + " 胜 " + r.l + " 负" + (r.d ? " " + r.d + " 平" : "") + (r.streak > 1 ? " · 你正 " + r.streak + " 连胜" : r.streak < -1 ? " · 你连输 " + (-r.streak) + " 把了" : "")),
            r.best > 1 ? h("div", { style: { color: SUB } }, "最长连胜 " + r.best) : null,
            top(r.used) ? h("div", { style: { color: SUB } }, foeName + " 最常贴：「" + top(r.used) + "」") : null,
            top(r.hurt) ? h("div", { style: { color: SUB } }, "打你最狠的宿敌卡：「" + top(r.hurt) + "」") : null); })(),
        // 彩头
        h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 4 } }, "彩头"),
        h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 8 } }, "约好输了干嘛。打完 TA 照约定兑现，或者来向你讨（兑现那一下花一次调用，会记进 TA 的记忆）。不选就是不赌。"),
        h("div", { className: "flex flex-wrap", style: { gap: 6, marginBottom: wager === "自己写" ? 6 : 16 } }, ["", ...WAGERS, "自己写"].map(w => h("button", { key: w || "none", "data-wk": "duelwager", "data-on": wager === w ? "1" : "0", onClick: () => setWager(w),
          style: { padding: "4px 10px", borderRadius: 999, border: "1px solid " + (wager === w ? RED : "rgba(47,42,34,.25)"), background: wager === w ? "rgba(178,58,46,.07)" : "rgba(255,255,255,.4)", color: wager === w ? RED : INK, fontSize: fz(12) } }, w || "不赌"))),
        wager === "自己写" ? h("input", { value: wagerDraft, onChange: e => setWagerDraft(e.target.value), placeholder: "输的人要……", style: { width: "100%", marginBottom: 16, padding: "7px 10px", borderRadius: 4, border: "1px solid rgba(47,42,34,.25)", background: "#fff", fontSize: fz(12.5) } }) : null,
        // 让子 / 认真 / 本周规则局
        h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 8 } }, "难度"),
        h("div", { className: "flex flex-wrap", style: { gap: 6, marginBottom: 8 } }, [["none", "不让"], ["foeLess", "让 TA 少 12 血"], ["meMore", "我多 12 血"]].map(([k, zh]) => h("button", { key: k, "data-wk": "duelhandi", "data-on": handi === k ? "1" : "0", onClick: () => setHandi(k),
          style: { padding: "4px 10px", borderRadius: 999, border: "1px solid " + (handi === k ? INK : "rgba(47,42,34,.25)"), background: handi === k ? INK : "transparent", color: handi === k ? PAPER : INK, fontSize: fz(12) } }, zh)),
          h("button", { "data-wk": "duelhard", "data-on": hard ? "1" : "0", onClick: () => setHard(v => !v), style: { padding: "4px 10px", borderRadius: 999, border: "1px solid " + (hard ? RED : "rgba(47,42,34,.25)"), background: hard ? RED : "transparent", color: hard ? "#fff" : INK, fontSize: fz(12) } }, "认真模式")),
        h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 12 } }, hard ? "认真模式：TA 每回合多 1 点胶水。" : "认真模式下 TA 每回合多 1 点胶水，难一点。"),
        h("button", { "data-wk": "duelrule", "data-on": useRule ? "1" : "0", onClick: () => setUseRule(v => !v), className: "w-full text-left", style: { marginBottom: 18, padding: "8px 12px", borderRadius: 4, border: "1px " + (useRule ? "solid " + GREEN : "dashed rgba(47,42,34,.3)"), background: useRule ? "rgba(79,122,102,.08)" : "transparent", color: INK } },
          h("div", { style: { fontFamily: FD, fontSize: fz(13), color: useRule ? GREEN : INK } }, (useRule ? "✓ " : "") + "本周规则局 · " + RULES[ruleOfWeek()].zh),
          h("div", { style: { fontSize: fz(11.5), color: SUB } }, RULES[ruleOfWeek()].desc + "。每周换一个，点一下打开。")),
        h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 8 } }, "看不看得见 TA 的下一步"),
        h("div", { className: "flex", style: { gap: 8, marginBottom: 6 } }, [[false, "明牌"], [true, "盲打"]].map(([v, zh]) => h("button", { key: zh, "data-wk": "duelblind", "data-on": blind === v ? "1" : "0", onClick: () => setBlind(v),
          style: Object.assign(btn(blind === v ? INK : "transparent", blind === v ? PAPER : INK, INK), { flex: 1 }) }, zh))),
        h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 20 } }, blind ? "TA 照样提前想好下一步，只是不给你看。" : "每回合开头就亮出 TA 要贴哪几张、贴在哪、要盖什么章。"),
        h("button", { "data-wk": "duelstart", onClick: start, disabled: !foeId, className: "w-full active:opacity-80 disabled:opacity-40", style: Object.assign(btn(RED, "#fff"), { padding: "12px 0", fontFamily: FD, fontSize: fz(15), letterSpacing: ".2em" }) }, "开局"),
        h("button", { "data-wk": "duelrules", onClick: () => setGuide(true), className: "w-full text-left active:opacity-70", style: { marginTop: 20, padding: "10px 12px", borderRadius: 4, background: "rgba(255,255,255,.45)", fontSize: fz(12), color: SUB, lineHeight: 1.7 } },
          "第一次玩？点这里看「怎么玩」——三分钟看懂。打的时候右上角也能随时点开。"))]);

    if (st.tutorial) foeName = "陪练";
    const me = st.me, them = st.foe, it = st.intent || {}, over = st.over;
    const meSlot = i => {
      if (over) return;
      if (playing.current) return;
      if (handSel >= 0) { doMine(() => D().place(st, "me", handSel, i)); return; }
      if (boardSel >= 0 && boardSel !== i && !me.board[i]) { doMine(() => D().move(st, "me", boardSel, i)); return; }
      setBoardSel(me.board[i] ? (boardSel === i ? -1 : i) : -1);
    };
    const selU = boardSel >= 0 ? me.board[boardSel] : null;
    // 把某一刻之后的记录一条条放出来（她 2026-11-08「四连觉醒出现太快看不到」：觉醒是贴票那一下触发的，原来只放寄出那一段）
    const skip = () => { playing.current = 0; setFx(null); setBanner(null); setCut(null); redraw(); };
    const play = n0 => {
      const evs = st.log.slice(n0).filter(l => ["hit", "hitEnv", "fall", "heal", "gain", "ink", "wake", "stamp", "place", "skip", "event", "attack"].includes(l.kind));
      if (!evs.length) return;
      const run = ++playing.current; let k = 0;
      const step = () => {
        if (playing.current !== run) return;
        if (k >= evs.length) { guard.current = Date.now() + 800; setFx(null); setBanner(null); setCut(null); playing.current = 0; redraw(); setTimeout(() => setBubble(b => (b && b.key === lastBubble.current ? null : b)), 2600); return; }
        const l = evs[k++], side = l.kind === "hitEnv" ? (l.who === "me" ? "foe" : "me") : fxSide(l);
        const txt = l.kind === "hit" ? "-" + l.n : l.kind === "heal" ? "+" : l.kind === "gain" ? "+胶" : l.kind === "skip" ? (l.text.indexOf("退回") >= 0 ? "退回" : "落空") : "";
        setFx({ kind: l.kind, side, slot: l.slot, slots: l.slots, n: l.n, ink: l.ink, txt, from: l.from, text: l.text, who: l.who });
        // 他开口：他的票上场、被打掉、觉醒、盖章时说卡上那句；打掉她一张时说他卡上戳一戳时那句（她 2026-11-08 同意「像他」）
        // 说这句的是哪张票的主人（她 2026-11-09「整个集邮社检查同样的问题」）：打掉她一张时说话的是对面那张，不是她掉的那张；
        //   声音也照那个人，不再一律用对局挑的对手（小店、剧情、挑战里对面是路人）
        const winU = l.kind === "fall" && l.who === "me" ? them.board.find(x => x && x.lines && x.lines.win) : null;
        const foeLine = l.who === "foe" && l.line ? l.line : (winU ? winU.lines : null), sayer = winU ? winU.charId : l.char;
        const said = typeof foeLine === "string" ? foeLine : foeLine && foeLine.win;
        // 这一下的台词要不要冒出来、念出来：照她在 🔊 里勾的（哪种时候、哪一边）
        const want = l.line && voice[l.kind] && voice[l.who === "foe" ? "foe" : "me"];
        if (want && voice.on && ttsOk()) speakQ(l.line, voiceOf(l.char));
        if (want && l.who === "me") { const key = Math.random(); lastBubble.current = key; setBubble({ text: l.line, key, me: true, who: nameOf(l.char) || meName || "我" }); }
        else if (said) { const key = Math.random(); lastBubble.current = key; setBubble({ text: said, key, who: sayer ? nameOf(sayer) : "" }); if (!want && voice.on && voice.foe && ttsOk() && foeLine && foeLine.win && sayer) speakQ(said, voiceOf(sayer)); }
        // 远信终点：TA 的信封掉到一半时开一次口（她 2026-11-08「打到一半 TA 冒台词，像在拦你又舍不得拦」）
        else if (runBattle && runBattle.boss && !st.halfSaid && them.hp <= (them.max || 40) / 2) {
          st.halfSaid = 1; const pool = them.board.concat(them.hand).filter(Boolean).map(u => u.lines && (u.lines.wake || u.lines.enter)).filter(Boolean);
          if (pool.length) { const key = Math.random(); lastBubble.current = key; setBubble({ text: pool[Math.floor(Math.random() * pool.length)], key }); }
        }
        // 挑战类陪打的人跟着出声（她 2026-11-08「互动感强一点」）：盖大招、觉醒、自家票被打掉、两边信封见底时
        //   从 TA 自己卡上的话里挑一句，一回合最多一句，不花调用
        else if (chal && mateId && !st.relay && st.coachSaid !== st.turn) {
          const ev = l.who === "me" && (l.kind === "wake" || l.kind === "stamp") ? "wake" : l.kind === "fall" && l.who === "foe" ? "fall"
            : st.me.hp <= (st.me.max || 40) * 0.3 && !st.lowMe ? "low" : st.foe.hp <= (st.foe.max || 40) * 0.3 && !st.lowFoe ? "near" : "";
          if (ev) {
            const pool = (cardsAll || []).filter(c => c && c.charId === mateId && c.text).map(c => D().stampOf(c).lines).map(x => ev === "wake" ? x.wake : ev === "fall" || ev === "low" ? x.fall : x.win || x.enter).filter(Boolean);
            if (pool.length) { st.coachSaid = st.turn; if (ev === "low") st.lowMe = 1; if (ev === "near") st.lowFoe = 1; const key = Math.random(); lastBubble.current = key; setBubble({ text: pool[Math.floor(Math.random() * pool.length)], key, me: true, who: nameOf(mateId) || "TA" }); }
          }
        }
        // SR / SSR 放大招、觉醒：整条横幅带着名字和台词从屏幕中间扫过去（她 2026-11-08「花里胡哨的特效」）
        const cutIn = (l.kind === "stamp" || l.kind === "wake" || l.kind === "attack") && (l.rarity === "SR" || l.rarity === "SSR") && l.cutLine;
        if (cutIn) setCut({ key: Math.random(), rarity: l.rarity, name: l.name || "", cardId: l.cardId, line: l.cutLine, who: l.who, char: l.char, sub: l.kind === "wake" ? (l.combo || "") + "觉醒" : l.kind === "attack" ? "出手" : "盖章 · " + (l.skill || "") });
        const big = l.kind === "wake" || l.kind === "stamp" || l.kind === "event";
        if (big && !cutIn) setBanner({ text: l.text, line: l.line || "", who: l.who, key: Math.random() }); else setBanner(null);
        setTimeout(step, cutIn ? 2700 : l.kind === "wake" ? 2600 : big ? 1800 : l.kind === "place" ? 380 : 520);
      };
      step();
    };
    // 她自己这一下（贴、挪、盖章、撕）也放：觉醒、盖章多半就在这时候
    const doMine = fn => { guard.current = Math.max(guard.current, Date.now() + 4000); const n0 = st.log.length; const ok = fail(fn()); if (ok) { setHandSel(-1); setBoardSel(-1); redraw(); play(n0); } return ok; };
    // 寄出：先结算完，再把这一回合的记录一条条放出来
    const send = () => {
      if (playing.current) return;
      guard.current = Date.now() + 15000;
      const n0 = st.log.length; D().endTurn(st); setHandSel(-1); setBoardSel(-1); redraw(); play(n0);
    };
    const back1 = () => { if (fail(D().undo(st))) { setHandSel(-1); setBoardSel(-1); redraw(); } };
    const finish = remember => {
      const sr = series && st.over ? D().addGame(series, st) : series;
      if (remember && onRemember && sr && sr.games.length) onRemember(foeId, D().memoryLine(sr, foeName, meName));
      setAsking(false); setSeries(null); setSt(null); persist(null);
    };
    const again = () => { D().addGame(series, st); start(); };
    const log = st.log.slice(-4);
    if (over && !playing.current && !st.run && !st.siege && !st.raid && !st.edict && !st.shift && !st.patrol && !st.puzzle && !st.relay && !st.story && !st.shopFight) record(st);
    const chalNow = !!(st.siege || st.raid || st.edict || st.shift || st.patrol || st.puzzle || st.relay || st.story);
    // 接力：轮到 TA（双数回合）就自动替 TA 下，放完动画再交回给她
    const taTurn = !!(st.relay && !over && st.turn % 2 === 0);
    if (taTurn && !playing.current && !st.relayRunning) { st.relayRunning = true;
      setTimeout(() => { if (st.over) { st.relayRunning = false; return; } const n0 = st.log.length, acts = D().autoMe(st, st.relay.style);
        const mine = st.me.board.filter(u => u && u.charId === st.relay.ta && u.lines && u.lines.enter); if (acts.length && mine.length) { const key = Math.random(); lastBubble.current = key; setBubble({ text: mine[Math.floor(Math.random() * mine.length)].lines.enter, key, me: true, who: nameOf(st.relay.ta) || "TA" }); }
        D().endTurn(st); st.relayRunning = false; setHandSel(-1); setBoardSel(-1); redraw(); play(n0); }, 900); }
    if (over && st.relay && !st.relaySaved) { st.relaySaved = 1; try { const v = relayRec(), r0 = v[st.relay.ta] || { n: 0, win: 0 }; v[st.relay.ta] = { n: r0.n + 1, win: r0.win + (over.winner === "me" ? 1 : 0) }; saveJSON(RELAY_KEY, v); } catch (e) {} }
    if (over && st.puzzle && over.winner === "me" && !st.pzSaved) { st.pzSaved = 1; try { const v = (typeof loadJSON === "function" ? loadJSON(PZ_KEY, null) : null) || {}; if (st.puzzle.daily) v.daily = Object.assign({}, v.daily, { [st.puzzle.daily]: Date.now() }); else v.solved = Object.assign({}, v.solved, { [st.puzzle.lv]: Date.now() }); saveJSON(PZ_KEY, v); } catch (e) {} }
    if (over && !playing.current && !st.run && !st.tutorial && !st.parcels) st.parcels = Trinkets.drop([st.shopFight ? (st.shopFight.staff || [])[Math.floor(Math.random() * ((st.shopFight.staff || []).length || 1))] : st.story ? st.story.charId : chalNow ? coachId : foeId], over.winner === "me", st.patrol === "boss" && over.winner === "me" ? 1 : 0);
    if (over && !playing.current && !st.run && !st.tutorial && !st.rewards) st.rewards = Rewards.settle({ puzzle: !!st.puzzle, solved: st.puzzle ? Object.keys(pzDone()).length : 0, win: over.winner === "me", siege: !!st.siege, tier: st.siegeTier || 0, edict: !!st.edict, pts: st.edictPts || 0, raid: !!st.raid, endless: !!(st.raid && st.raid.endless), dealt: st.raid ? st.raid.dealt : 0, turn: st.turn });
    if (over && st.edict && !edictSaved) { const b0 = edictBest(); st.edictPrev = b0.pts || 0; if (over.winner === "me" && (st.edictPts || 0) > (b0.pts || 0)) { try { saveJSON(EDICT_KEY, { pts: st.edictPts, tags: st.edict }); } catch (e) {} } setTimeout(() => setEdictSaved(true), 0); }
    if (over && st.raid && !raidSaved) { const m = st.raid.endless ? "endless" : "normal", b0 = raidBest(m); try { const all = (typeof loadJSON === "function" ? loadJSON(RAID_KEY, {}) : {}) || {}; if (st.raid.dealt > (b0.dealt || 0)) { all[m] = { dealt: st.raid.dealt, turn: st.turn }; saveJSON(RAID_KEY, all); } st.raid.prev = b0.dealt || 0; } catch (e) {} setTimeout(() => setRaidSaved(true), 0); }
    if (over && st.siege && !siegeSaved) { const all = siegeAll(), t = st.siegeTier || 0, b0 = siegeBest(t), w = st.siege.cleared; all.tiers = Object.assign({}, all.tiers, { [t]: { waves: Math.max(b0.waves || 0, w), wins: (b0.wins || 0) + (over.winner === "me" ? 1 : 0) } }); try { saveJSON(SIEGE_KEY, all); } catch (e) {} setTimeout(() => setSiegeSaved(true), 0); }
    // 教练条：这一步做到了就往下走（进下一步时先跑它的 enter）
    const step = tut >= 0 ? TUT[tut] : null;
    const goStep = n => { if (n >= TUT.length) { setTut(-1); return; } const nx = TUT[n]; if (nx.enter) { nx.enter(st, tutSeen.current); redraw(); } setTut(n); };
    if (step && step.done && !playing.current && step.done(st, tutSeen.current)) setTimeout(() => setTut(t => { if (t !== tut) return t; const n = t + 1; if (n < TUT.length && TUT[n].enter) TUT[n].enter(st, tutSeen.current); bump(x => x + 1); return n < TUT.length ? n : -1; }), 600);
    const coach = step ? h("div", { key: "coach", "data-wk": "duelcoach", style: { position: "sticky", top: 0, zIndex: 5, margin: "0 0 8px", padding: "9px 12px 9px 46px", borderRadius: 4, background: "rgba(79,122,102,.95)", color: "#fff", fontSize: fz(12.5), lineHeight: 1.65, boxShadow: "0 4px 12px rgba(47,42,34,.25)" } },
      h("span", { style: { position: "absolute", left: 9, top: 9, width: 28, height: 28, borderRadius: 999, background: PAPER, color: GREEN, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: fz(11) } }, (tut + 1) + "/" + TUT.length),
      step.say,
      step.next ? h("div", { style: { textAlign: "right", marginTop: 4 } }, h("button", { "data-wk": "duelcoachnext", onClick: () => goStep(tut + 1), style: { padding: "3px 12px", borderRadius: 999, background: PAPER, color: GREEN, fontSize: fz(12) } }, step.last ? "好，开打" : "下一步")) : null) : null;
    // 边打边聊：记在这一局里（跟着存档走），她发一句才叫 TA 一次
    st.chat = st.chat || [];
    const boardLine = () => "第 " + st.turn + " 回合，信封耐久她 " + Math.max(0, me.hp) + "/" + (me.max || D().ENVELOPE_HP) + "、你 " + Math.max(0, them.hp) + "/" + (them.max || D().ENVELOPE_HP) + ""
      + (st.wager ? "；这一把赌的彩头：" + st.wager : "")
      + "；她信封上有 " + me.board.filter(Boolean).length + " 张，你有 " + them.board.filter(Boolean).length + " 张"
      + (over ? "；这一把已经打完，" + (over.winner === "me" ? "她赢了" : over.winner === "foe" ? "你赢了" : "打平") : "")
      // 两边信封上贴着的票和卡上那句话（她 2026-11-08「角色对战时也能看到自己卡的台词和我这边上场了的卡的台词」）
      + "。你信封上贴着：" + (them.board.filter(Boolean).map(u => "「" + u.name + "」（" + (nameOf(u.charId) || "通用票") + "的卡" + (u.lines && u.lines.enter ? "，卡上那句：" + u.lines.enter : "") + "）").join("；") || "还没有")
      + "。她信封上贴着：" + (me.board.filter(Boolean).map(u => "「" + u.name + "」（" + (nameOf(u.charId) || "通用票") + "的卡" + (u.lines && u.lines.enter ? "，卡上那句：" + u.lines.enter : "") + "）").join("；") || "还没有")
      // 她手里的牌、你下一步打算（她 2026-11-08「每一个聊天的地方都接上状态，不会答非所问」）
      + "。她手里的牌：" + (me.hand.map(u => "「" + u.name + "」（" + u.role + "，面值 " + u.face + "）").join("、") || "没有") + "，还剩 " + me.postage + " 点胶水"
      + (st.intent && !st.blind ? "。你这回合打算：" + [].concat((st.intent.stamp || []).map(x => "给「" + x.name + "」盖章"), (st.intent.place || []).map(x => "贴「" + x.name + "」")).join("、") : "")
      + "。最近发生的：" + st.log.slice(-6).map(l => (l.who === "foe" ? "你：" : l.who === "me" ? "她：" : "") + l.text).join("；");
    // 挑战（守城、讨伐、封缄令、值班）里聊天的是陪你打的人，不是对面
    // 这一局身边的人：剧情闯关是走这段故事的那位、接力是一起接力的那位，别的挑战是「谁陪你打」挑的
    const mateId = st.story ? st.story.charId : st.relay ? st.relay.ta : coachId;
    const chal = !!(st.siege || st.raid || st.edict || st.shift || st.patrol || st.puzzle || st.relay || st.story), talkId = chal ? mateId : foeId, talkName = chal ? (nameOf(mateId) || "TA") : foeName;
    const chalName = st.story ? "剧情闯关（你们俩在走一段故事，这一章拦路的是「" + st.story.foe + "」）" : st.relay ? "接力（你和她轮流下同一块棋盘打审查局：单数回合她下，双数回合你下；信封是你们俩共用的）" : st.puzzle ? "死信第 " + st.puzzle.lv + " 关（只有这一回合，寄出时要把对面信封 " + st.puzzle.best + " 点打空）" : st.patrol ? "邮区巡查" : st.siege ? "护信" : st.raid ? (st.raid.endless ? "积压件·无尽" : "积压件") : st.edict ? "封缄令" : st.shift ? "邮局值班" : "";
    const coachBoard = () => "她在玩「" + chalName + "」，第 " + st.turn + " 回合"
      + (st.siege ? "，第 " + Math.min(st.turn, st.siege.waves) + " / " + st.siege.waves + " 波，已守住 " + st.siege.cleared + " 波" : "")
      + (st.raid ? "，已经打出 " + st.raid.dealt + " 伤害" + (st.raid.endless ? "（无尽，打到她信封空为止）" : "（打满 " + D().RAID_TURNS + " 回合算分）") : "")
      + (st.edict ? "，勾的难度：" + (st.edict.map(k => D().EDICTS[k].zh).join("、") || "没勾") + "（危险 " + (st.edictPts || 0) + "）" : "")
      + (st.patrol && patrol ? "，这一格是" + (st.patrol === "boss" ? "巡查长" : st.patrol === "elite" ? "硬仗" : "普通仗") + "，巡查分 " + patrol.score + "，还剩 " + patrol.steps + " 步" : "")
      + (st.shift && shift ? "，值班第 " + shift.round + " 轮，还剩 " + shift.lives + " 条命" : "")
      + "。她的信封 " + Math.max(0, me.hp) + "/" + (me.max || D().ENVELOPE_HP) + (st.siege || st.raid ? "" : "，对面信封 " + Math.max(0, them.hp) + "/" + (them.max || D().ENVELOPE_HP))
      + "。对面（" + foeName + "，游戏里代码造的敌人，不是你）场上：" + (them.board.map((u, i) => u ? "「" + u.name + "」" + u.role + " 攻" + u.pow + " 血" + Math.max(0, u.hp) + (u.seal ? " 带封条" : "") + (u.weak ? " 虚弱" : "") + "（第" + (Math.floor(i / 3) + 1) + "排第" + (i % 3 + 1) + "列）" : "").filter(Boolean).join("；") || "空")
      + "。她场上：" + (me.board.map((u, i) => u ? "「" + u.name + "」" + u.role + " 攻" + u.pow + " 血" + Math.max(0, u.hp) + "（第" + (Math.floor(i / 3) + 1) + "排第" + (i % 3 + 1) + "列）" : "").filter(Boolean).join("；") || "空")
      + "。她手里：" + (me.hand.map(u => "「" + u.name + "」" + u.role + " 面值" + u.face + " 攻" + u.pow).join("、") || "没有") + "，还剩 " + me.postage + " 点胶水"
      + (st.intent ? "。对面这回合要做：" + Object.values(D().actsOf(st, "foe")).filter(Boolean).join("、") : "")
      + "。最近发生的：" + st.log.slice(-6).map(l => (l.who === "foe" ? "对面：" : l.who === "me" ? "她：" : "") + l.text).join("；")
      + (st.over ? "。这一把已经打完：" + (st.over.winner === "me" ? "她赢了" : "她输了") : "");
    const talk = async (ask) => {
      const text = ask ? "" : draft.trim(); if ((!text && !ask) || chatBusy || !onChat || !talkId) return;
      if (text) st.chat.push({ who: "me", text }); if (!ask) setDraft(""); setChatOpen(true); setChatBusy(true); redraw();
      try {
        const hist = st.chat.slice(-9, text ? -1 : undefined).map(m => (m.who === "me" ? (meName || "她") : talkName) + "：" + m.text).join("\n");
        const lines = await onChat(talkId, chal ? { mode: ask === "review" ? "coachreview" : "coach", text, board: coachBoard(), history: hist } : { text, board: boardLine(), history: hist });
        (lines || []).forEach(x => st.chat.push({ who: "foe", text: x }));
        if (!(lines || []).length) toast && toast(talkName + " 没接上话，再说一句试试");
      } catch (e) { toast && toast("没聊成：" + ((e && e.message) || e)); }
      finally { setChatBusy(false); redraw(); }
    };
    // 快捷表情：她点一下，TA 从自己场上（没有就手里）的票里挑一句卡上的话回她
    const quick = e => {
      st.chat.push({ who: "me", text: e });
      const pool = them.board.filter(Boolean).concat(them.hand).map(u => u && u.lines && (u.lines.win || u.lines.enter || u.lines.wake)).filter(Boolean);
      if (pool.length) st.chat.push({ who: "foe", text: pool[Math.floor(Math.random() * pool.length)] });
      setChatOpen(true); redraw();
    };
    const chatBox = h("div", { key: "chat", "data-wk": "duelchat", className: "shrink-0 px-3", style: { paddingTop: 6, borderTop: "1px solid rgba(47,42,34,.12)", background: "rgba(251,246,234,.7)", fontFamily: F, color: INK } },
      h("button", { onClick: () => setChatOpen(v => !v), className: "w-full text-left", style: { fontSize: fz(11.5), color: SUB, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } },
        (chatOpen ? "▾ " : "▸ ") + (st.chat.length ? (st.chat[st.chat.length - 1].who === "me" ? "我：" : talkName + "：") + st.chat[st.chat.length - 1].text : chal ? "问 " + talkName + " 怎么打（发一句花一次调用）" : "跟 " + foeName + " 说两句（发一句花一次调用）")),
      chatOpen ? h("div", { style: { maxHeight: 150, overflowY: "auto", margin: "4px 0", display: "flex", flexDirection: "column", gap: 4 } },
        st.chat.slice(-12).map((m, k) => h("div", { key: k, "data-wk": "duelchatmsg", "data-me": m.who === "me" ? "1" : "0", style: { alignSelf: m.who === "me" ? "flex-end" : "flex-start", maxWidth: "80%", padding: "4px 9px", borderRadius: 10,
          background: m.who === "me" ? "rgba(79,122,102,.16)" : "#fff", fontSize: fz(12.5), lineHeight: 1.5 } }, BT(m.text))),
        chatBusy ? h("div", { style: { fontSize: fz(11), color: SUB } }, talkName + " 在打字…") : null) : null,
      // 收起时只留一行（她 2026-11-08「把屏幕都撑爆了」）：按钮和输入框都跟着展开才出现
      !chatOpen ? null : chal ? h("div", { className: "flex", style: { gap: 6, paddingTop: 4 } }, h("button", { "data-wk": "duelcoachask", onClick: () => talk(true), disabled: chatBusy, className: "disabled:opacity-40", style: { padding: "2px 10px", borderRadius: 999, border: "1px solid " + GREEN, color: GREEN, background: "rgba(79,122,102,.08)", fontSize: fz(11.5) } }, "帮我看看这一步")) :
      h("div", { "data-wk": "duelemotes", className: "flex overflow-x-auto", style: { gap: 5, paddingTop: 4 } }, EMOTES.map(e => h("button", { key: e, onClick: () => quick(e), style: { flexShrink: 0, padding: "2px 9px", borderRadius: 999, border: "1px solid rgba(47,42,34,.2)", background: "rgba(255,255,255,.6)", fontSize: fz(11.5), color: INK } }, e))),
      !chatOpen ? h("div", { style: { height: 6 } }) : h("div", { className: "flex items-center", style: { gap: 6, padding: "4px 0 6px" } },
        h("input", { "data-wk": "duelchatinput", value: draft, onChange: e => setDraft(e.target.value), onKeyDown: e => { if (e.key === "Enter") talk(); }, placeholder: chal ? "问 " + talkName + "：这张放哪？先打谁？" : "边打边说…",
          style: { flex: 1, minWidth: 0, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(47,42,34,.25)", background: "#fff", fontSize: fz(12.5) } }),
        h("button", { onClick: () => talk(), disabled: chatBusy || !draft.trim(), className: "disabled:opacity-40", style: btn(INK, PAPER) }, "说")));
    const ev = st.events[st.turn];
    const intentText = [].concat((it.stamp || []).map(x => "给「" + x.name + "」盖章"), (it.place || []).map(x => "贴「" + x.name + "」" + x.role)).join("、") || "这回合不贴票";

    return shell([
      h(Head, { key: "hd", zh: st.shopFight ? "邮局小店 · 对「" + st.shopFight.name + "」" : st.story ? "剧情闯关 · 对「" + st.story.foe + "」" : st.relay ? "接力 · 第 " + st.turn + " 回合 · " + (st.turn % 2 ? "你下" : (nameOf(st.relay.ta) || "TA") + " 下") : st.puzzle ? (st.puzzle.daily ? "每日死信 · " + st.puzzle.daily : "死信 · 第 " + st.puzzle.lv + " 关") : st.patrol ? "邮区巡查 · " + (st.patrol === "boss" ? "巡查长" : st.patrol === "elite" ? "硬仗" : "普通仗") + " · 第 " + st.turn + " 回合" : st.shift ? "邮局值班 · 第 " + (shift ? shift.round : 1) + " 轮 · 第 " + st.turn + " 回合" : st.edict ? "封缄令 · 危险 " + (st.edictPts || 0) + " · 第 " + st.turn + " 回合" : st.raid ? (st.raid.endless ? "无尽" : "积压件") + " · 第 " + st.turn + " 回合" : st.siege ? "护信 " + ((st.siegeTier || 0) + 1) + " 档 · 第 " + Math.min(st.turn, st.siege.waves) + " 波" : "第 " + st.turn + " 回合", sub: st.siege ? "" : "对 " + foeName + (st.blind ? " · 盲打" : ""), bg: "transparent", ink: INK, right: guideBtn,
        onBack: () => { if (st.shopFight) { setSt(null); setMode("shop"); return; } if (st.story) { setSt(null); setMode("story"); return; } if (st.relay) { setSt(null); setMode("relay"); return; } if (st.puzzle) { setSt(null); setMode("puzzle"); return; } if (st.patrol) { if (typeof requestAppConfirm === "function") requestAppConfirm("先离开这一场？", "这一格算没打赢，信封照现在的血算。", () => { st.over = st.over || { winner: "foe", turn: st.turn, me: st.me.hp, foe: st.foe.hp }; patrolBack(); }, "离开"); else { st.over = st.over || { winner: "foe" }; patrolBack(); } return; } if (st.shift) { setSt(null); setMode("shift"); return; } if (st.edict) { setSt(null); setMode("edictpick"); return; } if (st.raid) { setSt(null); setMode("raidpick"); return; } if (st.siege) { setSt(null); setMode("siegepick"); return; } if (st.run) { runBattle.onQuit && runBattle.onQuit(); return; } if (st.tutorial) { setSt(null); setTut(-1); return; } if (!over) { persist(st, series); setSaved({ st, series, foeId, at: Date.now() }); } else persist(null); setSt(null); setSeries(null); } }),
      h("div", { key: "bd", ref: bodyEl, className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, paddingBottom: 14, overflowAnchor: "none" },
          onTouchStart: () => { touchAt.current = Date.now(); }, onTouchMove: () => { touchAt.current = Date.now(); }, onTouchEnd: () => { touchAt.current = Date.now(); }, onWheel: () => { touchAt.current = Date.now(); },
          onScroll: e => { if (!guarding()) keepY.current = e.currentTarget.scrollTop; else if (Math.abs(e.currentTarget.scrollTop - keepY.current) > 4) e.currentTarget.scrollTop = keepY.current; } },
        coach,
        st.raid ? h("div", { key: "rd", "data-wk": "duelraidscore", style: { margin: "4px 2px", padding: "8px 12px", borderRadius: 6, background: "linear-gradient(90deg, rgba(138,58,74,.12), rgba(138,58,74,.03))", fontFamily: F, color: INK } },
            h("div", { className: "flex items-baseline", style: { justifyContent: "space-between" } },
              h("span", { style: { fontSize: fz(11.5), color: SUB } }, "邮政总局 · 第 " + (st.turn <= 3 ? 1 : st.turn <= 6 ? 2 : 3) + " 阶段" + (st.raid.endless ? "" : " · " + Math.min(st.turn, D().RAID_TURNS) + " / " + D().RAID_TURNS)),
              h("span", { style: { fontFamily: FD, fontSize: fz(20), color: "#8a3a4a" } }, st.raid.dealt, h("span", { style: { fontSize: fz(11), marginLeft: 3, color: SUB } }, "伤害"))),
            h("div", { style: { fontSize: fz(10.5), color: SUB, marginTop: 2 } }, "带「封条」的只掉 1：用邮戳或盖章撕开，它虚弱两回合、挨打翻倍。"))
        : st.siege ? (() => { const n = Math.min(st.turn, st.siege.waves), left = them.board.filter(Boolean).length;
          return h("div", { key: "wv", "data-wk": "duelsiegewave", style: { margin: "4px 2px", fontFamily: F, fontSize: fz(11.5), color: INK } },
            h("div", { className: "flex", style: { justifyContent: "space-between" } }, h("span", null, "城外 · 第 " + n + " / " + st.siege.waves + " 波"), h("span", { style: { color: SUB } }, "场上 " + left + " 个 · 走到前排站一回合就闯过去撞信封")),
            h("div", { className: "flex", style: { gap: 3, marginTop: 4 } }, Array.from({ length: st.siege.waves }, (_, k) => h("div", { key: k, style: { flex: 1, height: 6, borderRadius: 2, background: k < st.siege.cleared ? GREEN : k < n ? RED : "rgba(47,42,34,.12)" } })))); })()
        : Seal(foeName, them.hp, them.max || D().ENVELOPE_HP, RED, series && series.games.length ? "第 " + (series.games.length + 1) + " 把" : ""),
        voicePanelEl,
        bubble && !bubble.me ? h("div", { key: "bb" + bubble.key, "data-wk": "duelsay", style: { position: "relative", margin: "4px 0 2px 34px", padding: "6px 11px", borderRadius: "4px 12px 12px 12px", background: "#fff", boxShadow: "0 2px 6px rgba(47,42,34,.15)", fontSize: fz(12.5), lineHeight: 1.55, color: INK, animation: "duelPop .3s" } },
          h("span", { style: { color: RED, fontFamily: FD, marginRight: 6 } }, bubble.who || foeName), BT(bubble.text)) : null,
        // 对面的下一步：像一张电报条（盲打时不给看）
        h("div", { "data-wk": "duelintent", style: { position: "relative", margin: "6px 0 10px", padding: "7px 10px 7px 46px", borderRadius: 3, border: "1px dashed rgba(47,42,34,.35)", background: "rgba(255,255,255,.5)", fontSize: fz(11.5), lineHeight: 1.6 } },
          h("span", { style: { position: "absolute", left: 7, top: 7, padding: "1px 4px", border: "1.5px solid " + RED, color: RED, borderRadius: 3, fontFamily: FD, fontSize: fz(10), transform: "rotate(-6deg)" } }, "下一步"),
          st.puzzle ? h("div", { "data-wk": "duelpuzzlegoal", style: { color: "#6a5a3a", fontSize: fz(11.5), fontFamily: FD } }, "目标：这一回合寄出时，把对面信封 " + st.puzzle.best + " 点打空。", !over ? h("span", { "data-wk": "duelpuzzlesim", style: { marginLeft: 6, color: D().simSend(st) >= st.puzzle.best ? GREEN : SUB } }, "现在寄出能打 " + D().simSend(st) + "／" + st.puzzle.best) : null,
            !over ? h("button", { "data-wk": "duelpuzzlehint", onClick: () => setPzHint(x => Math.min(x + 1, (st.puzzle.plan.stamps.length + st.puzzle.plan.place.length))), style: { marginLeft: 8, padding: "0 8px", borderRadius: 999, border: "1px solid #6a5a3a", color: "#6a5a3a", fontFamily: F, fontSize: fz(10.5) } }, pzHint ? "再提示一步" : "提示") : null,
            !over ? h("button", { "data-wk": "duelpuzzlereset", onClick: () => startPuzzle(st.puzzle.lv, st.puzzle.daily), style: { marginLeft: 6, padding: "0 8px", borderRadius: 999, border: "1px solid rgba(47,42,34,.3)", color: SUB, fontFamily: F, fontSize: fz(10.5) } }, "重来") : null,
            pzHint ? h("div", { style: { fontFamily: F, fontSize: fz(11), color: INK, marginTop: 3 } }, (() => { const pl = st.puzzle.plan, steps = pl.stamps.map(i => "给场上「" + ((st.me.board[i] || {}).name || "那张") + "」盖章").concat(pl.place.map(x => { const u = st.me.hand.find(h0 => h0.cardId === x.cardId) || st.me.board.find(b0 => b0 && b0.cardId === x.cardId) || {}; return "把「" + (u.name || "那张") + "」贴到第 " + (Math.floor(x.slot / 3) + 1) + " 排第 " + (x.slot % 3 + 1) + " 列"; }));
              return steps.slice(0, pzHint).map((t, k) => (k + 1) + ". " + t).join("　"); })()) : null) : null,
          st.edict && st.edict.length ? h("div", { "data-wk": "duelediccline", style: { color: "#5a4f8a", fontSize: fz(10.5) } }, "封缄：" + st.edict.map(k => D().EDICTS[k].zh).join("、")) : null,
          it.styleZh && !st.siege && !st.raid && !st.edict && !st.puzzle && !st.shift && !st.patrol && !st.relay ? h("div", { style: { color: SUB, fontSize: fz(10.5) } }, foeName + " 的打法：" + it.styleZh) : null,
          runBattle && runBattle.themeRuleZh ? h("div", { "data-wk": "duelthemerule", style: { color: GREEN, fontSize: fz(11) } }, runBattle.theme + " · " + runBattle.themeRuleZh) : null,
          runBattle && runBattle.bossRuleZh ? h("div", { "data-wk": "duelbossrule", style: { color: RED, fontSize: fz(11) } }, "终点规则 · " + runBattle.bossRule + "：" + runBattle.bossRuleZh) : null,
          st.blind ? "盲打：TA 的下一步看不见。" : intentText + (it.toEnvelope ? "；空着的列会打你信封约 " + it.toEnvelope : "") + ((it.inks || []).length ? "；会盖：" + it.inks.join("、") : ""),
          it.nextEvent ? h("div", { style: { color: GREEN } }, "下回合公告：" + it.nextEvent + "——" + D().EVENTS[it.nextEvent]) : null,
          // 明牌：TA 手里那几张也摊开给她看，要贴的那几张标上「要贴」
          !st.blind && them.hand.length ? h("div", { "data-wk": "duelfoehand", className: "flex", style: { gap: 6, marginTop: 6, overflowX: "auto", paddingTop: 6 } }, them.hand.map((s2, k) => {
            const go = (it.place || []).some(p => p.cardId === s2.cardId);
            return h("div", { key: s2.cardId + "_" + k, style: { flex: "0 0 52px", position: "relative", opacity: go ? 1 : 0.6 } },
              h(Ticket, { u: s2, card: cardOf(s2.cardId), owner: ownerOf(s2.charId), useThumb, small: true, foe: true, wk: "duelfoecard", onTap: () => openInfo(s2, true), onLong: () => openInfo(s2, true) }),
              go ? h("span", { style: { position: "absolute", left: "50%", top: -6, transform: "translateX(-50%)", padding: "0 4px", borderRadius: 3, background: RED, color: "#fff", fontSize: fz(8), whiteSpace: "nowrap" } }, "要贴") : null); })) : null),
        h("div", { ref: boardsEl, style: { position: "relative" } },
        h(Envelope, { sd: them, foe: true, sel: -1, onTap: () => {}, cardOf, ownerOf, useThumb, fx, onLong: openInfo }),
        h("div", { className: "flex items-center", style: { gap: 8, margin: "10px 0", color: SUB, fontSize: fz(10.5) } }, h("div", { className: "flex-1", style: { borderTop: "1px dashed rgba(47,42,34,.3)" } }), fx && fx.from && fx.text ? h("span", { "data-wk": "duelcaption", style: { color: fx.from.who === "foe" ? RED : GREEN, fontFamily: FD, fontSize: fz(12.5) } }, (fx.from.who === "foe" ? foeName + "：" : "我：") + fx.text) : ev ? h("span", { style: { color: GREEN } }, "公告 · " + ev + "：" + D().EVENTS[ev]) : "前排对前排", h("div", { className: "flex-1", style: { borderTop: "1px dashed rgba(47,42,34,.3)" } })),
        h(Envelope, { sd: me, foe: false, sel: boardSel, onTap: meSlot, armed: handSel >= 0, cardOf, ownerOf, useThumb, fx, onLong: openInfo }),
        !over && !fx ? h(AimLayer, { host: boardsEl, foeAims: st.blind ? [] : D().aims(st, "foe"), foeStamps: st.blind ? [] : (it.stamp || []), foeActs: st.blind ? {} : D().actsOf(st, "foe"), meAims: D().aims(st, "me"), meActs: D().actsOf(st, "me"), myPrev: handSel >= 0 ? me.board.map((u, i) => u ? null : Object.assign({ slot: i }, D().previewPlace(st, "me", handSel, i) || {})).filter(x => x && x.combo) : [],
          tick: st.turn + "|" + handSel + "|" + me.board.map(u => u ? u.uid : 0).join(",") + "|" + them.board.map(u => u ? u.uid : 0).join(",") + "|" + me.hand.length, order: st.puzzle ? me.board.map((u, i) => u ? i : -1).filter(i => i >= 0) : null }) : null),
        Seal(meName || "我", me.hp, me.max || D().ENVELOPE_HP, GREEN),
        bubble && bubble.me ? h("div", { key: "bm" + bubble.key, "data-wk": "duelsay", "data-me": "1", style: { position: "relative", margin: "4px 34px 2px auto", maxWidth: "86%", width: "fit-content", padding: "6px 11px", borderRadius: "12px 4px 12px 12px", background: "#f1f7f3", boxShadow: "0 2px 6px rgba(47,42,34,.15)", fontSize: fz(12.5), lineHeight: 1.55, color: INK, animation: "duelPop .3s" } },
          h("span", { style: { color: GREEN, fontFamily: FD, marginRight: 6 } }, bubble.who), BT(bubble.text)) : null,
        // 选中场上一张：盖章 / 撕下；点旁边空格＝挪过去
        selU ? h("div", { "data-wk": "duelactions", style: { marginTop: 8, padding: "8px 10px", borderRadius: 4, background: "rgba(255,255,255,.55)", fontSize: fz(12) } },
          h("div", { style: { marginBottom: 6 } }, h("b", null, selU.name), h("span", { style: { color: SUB } }, " · " + (ownerOf(selU.charId) || "通用票") + " · " + selU.role + "：" + ROLE_TIP[selU.role])),
          h("div", { className: "flex items-center flex-wrap", style: { gap: 6 } },
            h("button", { onClick: () => doMine(() => D().stamp(st, "me", boardSel)), disabled: selU.charge < selU.need, className: "disabled:opacity-40", style: btn(RED, "#fff") }, "盖章（1 胶水）"),
            h("button", { onClick: () => doMine(() => D().tear(st, "me", boardSel)), style: btn("transparent", INK, INK) }, "撕下"),
            h("span", { style: { color: SUB, fontSize: fz(11) } }, "点旁边空格＝挪过去（1 胶水）"))) : null,
        h("div", { "data-wk": "duellog", style: { marginTop: 10, fontSize: fz(11), color: SUB, lineHeight: 1.65 } }, log.map((l, k) => h("div", { key: k }, (l.who === "foe" ? foeName + "：" : l.who === "me" ? "我：" : "") + l.text + (l.line ? "「" + l.line + "」" : ""))))),
      onChat && !st.tutorial && (chal ? !!mateId : foeId) ? chatBox : null,
      info ? h(StampInfo, { key: "info", u: info.u, foe: info.foe, terrain: info.terrain, live: (info.foe ? them : me).board.some(x => x && x.uid && x.uid === info.u.uid), bonds: st.bonds, cardOf, ownerOf, nameOf, useThumb, onClose: () => setInfo(null) }) : null,
      // 中间弹出的那块（她 2026-11-08「这种黄框也做好看点」）：像一封电报——上面一枚火漆封印写是什么事，
      //   中间大字是哪张票／哪条公告，台词另起一行像手写；觉醒是金色、盖章是红色、公告是绿色
      cut ? (() => {
        const ssr = cut.rarity === "SSR", foe = cut.who === "foe"; const cutCard = cut.cardId ? (cardsAll || []).find(c => c && c.id === cut.cardId) : null;
        const bg = ssr ? "linear-gradient(100deg, rgba(120,72,10,.0) 0%, rgba(176,120,30,.92) 12%, rgba(240,200,110,.95) 50%, rgba(176,120,30,.92) 88%, rgba(120,72,10,0) 100%)"
          : "linear-gradient(100deg, rgba(40,60,120,0) 0%, rgba(63,90,160,.9) 12%, rgba(120,150,220,.92) 50%, rgba(63,90,160,.9) 88%, rgba(40,60,120,0) 100%)";
        return h("div", { key: "cutw" + cut.key, style: { position: "absolute", inset: 0, zIndex: 25, overflow: "hidden", pointerEvents: "none" } }, h("div", { "data-wk": "duelcutin", "data-rarity": cut.rarity, style: { position: "absolute", left: "50%", top: "44%", zIndex: 25, width: "140%", padding: "22px 0 20px", background: bg, overflow: "visible", pointerEvents: "none",
            boxShadow: ssr ? "0 0 30px rgba(240,190,90,.6)" : "0 0 24px rgba(110,140,220,.5)", borderTop: "2px solid rgba(255,255,255,.7)", borderBottom: "2px solid rgba(255,255,255,.7)", animation: "duelSweep 2.5s cubic-bezier(.2,.8,.3,1) forwards" } },
          h("div", { style: { position: "absolute", top: 0, bottom: 0, width: "30%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)", animation: "duelShine 1.1s .25s ease-out" } }),
h("div", { style: { transform: "skewX(12deg)", display: "flex", alignItems: "center", gap: 14, width: "62%", margin: "0 auto" } },
            cutCard ? h("div", { style: { flexShrink: 0, width: "40%", maxWidth: 170, margin: "-46px 0", transform: "rotate(-5deg)", animation: "duelPop .5s ease-out" } }, h(CutFace, { card: cutCard, useThumb, ssr })) : null,
                      h("div", { style: { flex: 1, minWidth: 0, textAlign: "center", color: "#fff", textShadow: ssr ? "0 0 10px rgba(255,220,140,.9), 0 2px 3px rgba(90,50,0,.6)" : "0 0 10px rgba(170,200,255,.9), 0 2px 3px rgba(20,30,80,.6)" } },
            h("div", { style: { fontSize: fz(11), letterSpacing: ".3em", opacity: .9 } }, (foe ? (foeName || "TA") + " 那边 · " : "") + cut.rarity + " · " + cut.sub),
            h("div", { style: { fontFamily: FD, fontSize: fz(ssr ? 30 : 25), lineHeight: 1.2, margin: "2px 0 4px", animation: "duelSweepTxt .9s ease-out both" } }, cut.name),
            h("div", { style: { fontFamily: FD, fontStyle: "italic", fontSize: fz(14), maxWidth: "100%", margin: "0 auto", lineHeight: 1.5 } }, BT(cut.line))))));
      })() : null,
      banner ? (() => {
        const kind = banner.text.indexOf("觉醒") >= 0 ? "wake" : banner.text.indexOf("公告") >= 0 ? "event" : "stamp";
        const c = kind === "wake" ? "#b8862a" : kind === "event" ? GREEN : RED;
        const tag = kind === "wake" ? "觉醒" : kind === "event" ? "公告" : "盖章";
        const parts = String(banner.text).split(/[：:]/), head = parts.length > 1 ? parts.slice(1).join("：") : banner.text;
        const sub = kind === "event" ? "" : banner.who === "foe" ? foeName + " 那边" : banner.who === "me" ? "你这边" : "";
        return h("div", { key: "bn" + banner.key, "data-wk": "duelbanner", "data-kind": kind, style: { position: "absolute", left: "50%", top: "46%", zIndex: 20, width: "84%", maxWidth: 330, textAlign: "center",
          animation: "duelBanner " + (kind === "wake" ? 2.6 : 1.8) + "s forwards", pointerEvents: "none", filter: "drop-shadow(0 10px 22px rgba(47,42,34,.35))" } },
          h("div", { style: { position: "relative", padding: "26px 16px 14px", borderRadius: 4, background: PAPER, border: "1px solid " + c + "66" } },
            h("div", { style: { position: "absolute", inset: 5, borderRadius: 2, border: "1px dashed " + c + "55", pointerEvents: "none" } }),
            // 火漆封印
            h("div", { style: { position: "absolute", left: "50%", top: -18, transform: "translateX(-50%) rotate(-6deg)", width: 40, height: 40, borderRadius: 999,
              background: "radial-gradient(circle at 35% 30%, " + c + "cc, " + c + ")", boxShadow: "0 2px 4px rgba(0,0,0,.3), inset 0 -2px 3px rgba(0,0,0,.25)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: fz(11) } }, tag),
            sub ? h("div", { style: { fontFamily: F, fontSize: fz(10.5), color: SUB, letterSpacing: ".2em", marginBottom: 2 } }, sub) : null,
            h("div", { style: { fontFamily: FD, fontSize: fz(kind === "event" ? 15 : 18), color: c, lineHeight: 1.45 } }, head),
            banner.line ? h("div", { style: { margin: "8px auto 0", maxWidth: "92%", paddingTop: 8, borderTop: "1px solid " + c + "33", fontFamily: FD, fontStyle: "italic", fontSize: fz(12.5), color: "#5a4f40", lineHeight: 1.7 } }, "「" + banner.line + "」") : null)); })() : null,
      over ? h("div", { key: "ft", "data-wk": "duelover", className: "shrink-0 px-4", style: { paddingTop: 12, paddingBottom: "calc(12px + env(safe-area-inset-bottom) * 0.4)", fontFamily: F, color: INK, borderTop: "1px solid rgba(47,42,34,.18)", background: "rgba(251,246,234,.92)" } },
          chal && mateId && onChat ? h("button", { "data-wk": "duelcoachreview", onClick: () => talk("review"), disabled: chatBusy, className: "w-full disabled:opacity-50", style: Object.assign(btn("transparent", GREEN, GREEN), { marginBottom: 8, fontSize: fz(12) }) }, chatBusy ? talkName + " 在想…" : "听 " + talkName + " 评评这一把") : null,
          st.parcels && st.parcels.length ? h("div", { "data-wk": "duelparcel", style: { textAlign: "center", fontSize: fz(11.5), color: GREEN, marginBottom: 6 } }, st.parcels.map(([id, n]) => (nameOf(id) || "TA") + " 留了 " + n + " 个小包裹").join("、") + "（在「小物册」里拆）") : null,
          st.rewards && st.rewards.length ? h("div", { "data-wk": "duelreward", style: { margin: "0 0 8px", padding: "6px 10px", borderRadius: 5, background: "rgba(184,134,42,.1)", border: "1px solid rgba(184,134,42,.35)", fontSize: fz(11.5), lineHeight: 1.6, color: "#7a5a1a", textAlign: "center" } }, st.rewards.map((t, k) => h("div", { key: k }, t))) : null,
          st.puzzle ? h("div", { key: "pzo", "data-wk": "duelpuzzleover", style: { textAlign: "center", marginBottom: 10 } }, h("div", { style: { fontFamily: FD, fontSize: fz(20), color: over.winner === "me" ? GREEN : RED } }, over.winner === "me" ? (st.puzzle.daily ? "今天的死信解开了" : "解开了 · 第 " + st.puzzle.lv + " 关") : "差一点"), h("div", { style: { fontSize: fz(11.5), color: SUB } }, over.winner === "me" ? "这一手有 " + st.puzzle.ways + " 种放法能打满" : "对面信封还剩 " + Math.max(0, st.foe.hp) + "，换个放法，或点「提示」")) : null,
          st.edict ? h("div", { key: "edo", "data-wk": "duelediccover", style: { textAlign: "center", marginBottom: 10 } }, h("div", { style: { fontFamily: FD, fontSize: fz(20), color: over.winner === "me" ? "#5a4f8a" : RED } }, over.winner === "me" ? "通过 · 危险 " + (st.edictPts || 0) : "没过"), h("div", { style: { fontSize: fz(11.5), color: SUB } }, over.winner === "me" ? ((st.edictPts || 0) > (st.edictPrev || 0) ? "新纪录！" : "最高 危险 " + (st.edictPrev || 0)) : "少勾几条再试，或者换个打法")) : null,
          st.raid ? h("div", { key: "rdo", "data-wk": "duelraidover", style: { textAlign: "center", marginBottom: 10 } }, h("div", { style: { fontFamily: FD, fontSize: fz(22), color: "#8a3a4a" } }, st.raid.dealt + " 伤害"), h("div", { style: { fontSize: fz(11.5), color: SUB } }, (st.raid.endless ? "无尽 · 撑了 " + st.turn + " 回合" : over.winner === "me" ? "打满 8 回合" : "第 " + st.turn + " 回合信封被砸空了") + (st.raid.prev != null ? (st.raid.dealt > st.raid.prev ? " · 新纪录！" : " · 最高 " + st.raid.prev) : ""))) : null,
          st.siege ? h("div", { key: "sgo", "data-wk": "duelsiegeover", style: { textAlign: "center", marginBottom: 10 } }, h("div", { style: { fontFamily: FD, fontSize: fz(18), color: over.winner === "me" ? GREEN : RED } }, over.winner === "me" ? "守住了" : "信丢了"), h("div", { style: { fontSize: fz(11.5), color: SUB } }, "第 " + ((st.siegeTier || 0) + 1) + " 档 · 守住 " + st.siege.cleared + " / " + st.siege.waves + " 波 · 信封剩 " + Math.max(0, over.me) + " · 这档最好 " + Math.max(siegeBest(st.siegeTier || 0).waves || 0, st.siege.cleared) + " 波")) : null,
          st.siege || st.raid || st.edict || st.puzzle ? null : h("div", { style: { fontFamily: FD, fontSize: fz(18), textAlign: "center", marginBottom: 2, color: over.winner === "me" ? GREEN : over.winner === "foe" ? RED : INK } }, over.winner === "me" ? "你赢了" : over.winner === "foe" ? foeName + " 赢了" : "打平了"),
          st.siege || st.raid || st.edict || st.puzzle ? null : h("div", { style: { fontSize: fz(11), textAlign: "center", color: SUB, marginBottom: 10 } }, over.turn + " 回合 · 信封剩 " + over.me + " : " + over.foe + (over.byCap ? " · 打满回合比剩下的" : "")),
          // 彩头兑现、赛后复盘（她 2026-11-08）：各点一次叫 TA 一次
          // 对面是路人／关卡 NPC（挑战类、剧情闯关、小店难缠客人）时没有人可以复盘、发战报（她 2026-11-08）
          !st.tutorial && !st.run && !chal && !st.shopFight && onChat ? (() => {
            const ask = async mode => {
              if (after.busy) return; setAfter(a => Object.assign({}, a, { busy: mode }));
              try { const lines = await onChat(foeId, { mode, wager: st.wager, winner: over.winner, board: boardLine(), history: st.chat.slice(-6).map(m => (m.who === "me" ? (meName || "她") : foeName) + "：" + m.text).join("\n") });
                setAfter(a => Object.assign({}, a, { [mode]: lines && lines.length ? lines : ["（没接上话，再点一次试试）"], busy: "" })); }
              catch (e) { toast && toast("没成：" + ((e && e.message) || e)); setAfter(a => Object.assign({}, a, { busy: "" })); }
            };
            const box = (title, lines) => h("div", { style: { margin: "0 0 8px", padding: "8px 11px", borderRadius: 4, background: "#fff", fontSize: fz(12.5), lineHeight: 1.65 } }, h("div", { style: { fontFamily: FD, fontSize: fz(11), color: SUB, marginBottom: 2 } }, title), lines.map((x, k) => h("div", { key: k }, BT(x))));
            return h("div", { "data-wk": "duelafter" },
              st.wager ? (after.wager ? box("彩头 · " + st.wager, after.wager)
                : h("button", { "data-wk": "duelwagergo", onClick: () => ask("wager"), disabled: !!after.busy, className: "w-full disabled:opacity-50", style: Object.assign(btn("rgba(178,58,46,.08)", RED, RED), { marginBottom: 8 }) }, after.busy === "wager" ? foeName + " 在想…" : (over.winner === "foe" ? foeName + " 来讨彩头：" : over.winner === "me" ? "让 " + foeName + " 兑现：" : "打平了，彩头怎么算：") + st.wager)) : null,
              after.review ? box(foeName + " 复盘", after.review)
                : h("button", { "data-wk": "duelreview", onClick: () => ask("review"), disabled: !!after.busy, className: "w-full disabled:opacity-50", style: Object.assign(btn("transparent", SUB, "rgba(47,42,34,.25)"), { marginBottom: 8, fontSize: fz(11.5) }) }, after.busy === "review" ? foeName + " 在想…" : "听 " + foeName + " 复盘这一把（花一次调用）"));
          })() : null,
          // 战报发进聊天（她 2026-11-08）
          !st.tutorial && !st.run && !chal && !st.shopFight && onReport ? h("button", { "data-wk": "duelreportgo", disabled: reported, onClick: () => {
              const dealt = {}; st.log.forEach(l => { if ((l.kind === "hit" || l.kind === "hitEnv") && l.who === "me" && l.from && l.from.name) dealt[l.from.name] = (dealt[l.from.name] || 0) + (l.n || 0); });
              const mvp = Object.keys(dealt).sort((a, b) => dealt[b] - dealt[a])[0] || "";
              const games = (series ? series.games.length : 0) + 1;
              const res = over.winner === "me" ? (meName || "她") + "赢了" : over.winner === "foe" ? foeName + "赢了" : "打平了";
              onReport(foeId, { winner: over.winner, turn: over.turn, meHp: over.me, foeHp: over.foe, mvp, wager: st.wager || "", games,
                line: "跟" + foeName + "用邮票册的卡打了一把，" + res + "（" + over.turn + " 回合，信封剩 " + over.me + " : " + over.foe + "）" + (mvp ? "，最争气的是「" + mvp + "」" : "") + (st.wager ? "，赌的是「" + st.wager + "」" : "") + "。" });
              setReported(true);
            }, className: "w-full disabled:opacity-50", style: Object.assign(btn("transparent", INK, "rgba(47,42,34,.35)"), { marginBottom: 8, fontSize: fz(12) }) }, reported ? "已经发到聊天了" : "把战报发到跟 " + foeName + " 的聊天里") : null,
          st.run ? h("button", { "data-wk": "duelrunnext", onClick: () => runBattle.onDone(st), className: "w-full", style: Object.assign(btn(over.winner === "me" ? GREEN : INK, "#fff"), { padding: "10px 0", fontFamily: FD, fontSize: fz(14) }) }, over.winner === "me" ? (runBattle.boss ? "把信交给 TA" : "继续赶路") : "信寄丢了……")
          : st.tutorial ? h("div", { className: "flex", style: { gap: 8 } },
              h("button", { onClick: startTut, className: "flex-1", style: btn(INK, PAPER) }, "再练一次"),
              h("button", { onClick: () => { setSt(null); setTut(-1); }, className: "flex-1", style: btn("transparent", INK, INK) }, "去正式对局"))
          : st.shopFight ? h("button", { "data-wk": "duelshopback", onClick: async () => {try{await shopAct('fight',{id:st.shopFight.id,won:over.winner==='me',expected:st.shopFight.expected});setSt(null);setMode('shop');}catch{}}, style: Object.assign(btn(over.winner === "me" ? GREEN : INK, "#fff"), { padding: "10px 0", fontFamily: FD, fontSize: fz(14) }) }, over.winner === "me" ? "打发走了，回店里（收双倍）" : "没打过，回店里")
          : st.story ? h("button", { "data-wk": "duelstoryback", onClick: () => { const sv0 = story; if (sv0) { sv0.chapters[sv0.chapters.length - 1].won = over.winner === "me"; setStory(sv0); } setSt(null); setMode("story"); }, className: "w-full", style: Object.assign(btn(over.winner === "me" ? GREEN : INK, "#fff"), { padding: "10px 0", fontFamily: FD, fontSize: fz(14) }) }, "回到故事")
          : st.relay ? h("div", { className: "flex", style: { gap: 8 } },
              h("button", { "data-wk": "duelrelayagain", onClick: startRelay, className: "flex-1", style: btn(INK, PAPER) }, "再接力一局"),
              h("button", { onClick: () => { setSt(null); setMode("relay"); }, className: "flex-1", style: btn("transparent", INK, INK) }, "回去"))
          : st.puzzle ? h("div", { className: "flex", style: { gap: 8 } },
              over.winner === "me" && !st.puzzle.daily ? h("button", { "data-wk": "duelpuzzlenext", onClick: () => startPuzzle(st.puzzle.lv + 1), className: "flex-1", style: btn(GREEN, "#fff") }, "下一关") : h("button", { "data-wk": "duelpuzzleretry", onClick: () => startPuzzle(st.puzzle.lv, st.puzzle.daily), className: "flex-1", style: btn(INK, PAPER) }, over.winner === "me" ? "再玩一次" : "再试一次"),
              h("button", { onClick: () => { setSt(null); setMode("puzzle"); }, className: "flex-1", style: btn("transparent", INK, INK) }, "回关卡"))
          : st.patrol ? h("button", { "data-wk": "duelpatrolnext", onClick: patrolBack, className: "w-full", style: Object.assign(btn(over.winner === "me" ? GREEN : INK, "#fff"), { padding: "10px 0", fontFamily: FD, fontSize: fz(14) }) }, over.winner === "me" ? "赢了，回地图" : "没打过，回地图")
          : st.shift ? h("button", { "data-wk": "duelshiftnext", onClick: () => shiftNext(over.winner === "me"), className: "w-full", style: Object.assign(btn(over.winner === "me" ? GREEN : INK, "#fff"), { padding: "10px 0", fontFamily: FD, fontSize: fz(14) }) }, over.winner === "me" ? "赢了，回柜台" : "输了，掉一条命，回柜台")
          : st.edict ? h("div", { className: "flex", style: { gap: 8 } },
              h("button", { "data-wk": "duelediccagain", onClick: () => startEdict(st.edict), className: "flex-1", style: btn(INK, PAPER) }, "同样的再来"),
              h("button", { onClick: () => { setSt(null); setMode("edictpick"); }, className: "flex-1", style: btn("transparent", INK, INK) }, "改封缄"))
          : st.raid ? h("div", { className: "flex", style: { gap: 8 } },
              h("button", { "data-wk": "duelraidagain", onClick: () => startRaid(st.raid.endless ? "endless" : "normal"), className: "flex-1", style: btn(INK, PAPER) }, "再打一次"),
              h("button", { onClick: () => { setSt(null); setMode("raidpick"); }, className: "flex-1", style: btn("transparent", INK, INK) }, "回积压件"))
          : st.siege ? h("div", { className: "flex", style: { gap: 8 } },
              h("button", { "data-wk": "duelsiegeagain", onClick: () => startSiege(st.siegeTier || 0), className: "flex-1", style: btn(INK, PAPER) }, "再守一次"),
              h("button", { onClick: () => { setSt(null); setMode("siegepick"); }, className: "flex-1", style: btn("transparent", INK, INK) }, "换一档"))
          : asking ? h("div", null,
            h("div", { style: { fontSize: fz(12.5), textAlign: "center", marginBottom: 8 } }, "要让 " + foeName + " 记得这 " + ((series ? series.games.length : 0) + 1) + " 把吗？"),
            h("div", { className: "flex", style: { gap: 8 } },
              h("button", { "data-wk": "duelremember", onClick: () => finish(true), className: "flex-1", style: btn(INK, PAPER) }, "记得"),
              h("button", { onClick: () => finish(false), className: "flex-1", style: btn("transparent", INK, INK) }, "不用记")))
            : h("div", { className: "flex", style: { gap: 8 } },
              h("button", { "data-wk": "duelagain", onClick: again, className: "flex-1", style: btn(INK, PAPER) }, "再来一把"),
              h("button", { onClick: () => setAsking(true), className: "flex-1", style: btn("transparent", INK, INK) }, "结束")))
        : taTurn ? h("div", { key: "ft", "data-wk": "duelrelaywait", className: "shrink-0", style: { padding: "18px 0 calc(18px + env(safe-area-inset-bottom) * 0.4)", textAlign: "center", borderTop: "1px solid rgba(47,42,34,.18)", background: "rgba(251,246,234,.92)", fontFamily: FD, fontSize: fz(14), color: "#a0522d" } }, (nameOf(st.relay.ta) || "TA") + " 在下这一回合…")
        : h("div", { key: "ft", "data-wk": "duelhand", className: "shrink-0", style: { paddingTop: 8, paddingBottom: "calc(8px + env(safe-area-inset-bottom) * 0.4)", borderTop: "1px solid rgba(47,42,34,.18)", background: "rgba(251,246,234,.92)", fontFamily: F, color: INK } },
          // 选着什么就告诉她现在能干嘛（她 2026-11-08「不好上手」→ 做 2、3）
          (() => { const hs = handSel >= 0 ? me.hand[handSel] : null, bu = boardSel >= 0 ? me.board[boardSel] : null;
            let tip = "";
            if (hs) { const c = hs.face + (st.events[st.turn] === "涨价" ? 1 : 0); tip = me.postage >= c ? "「" + hs.name + "」" + hs.role + "，贴一张花 " + c + " 胶水 → 点上面亮着的空格；格子里写着贴那儿会打谁" : "「" + hs.name + "」要 " + c + " 胶水，你只剩 " + me.postage + "，这回合贴不了，可以「留到下回合」"; }
            else if (bu) tip = bu.charge >= bu.need ? "「" + bu.name + "」章攒满了，点「盖章」放大招" : "「" + bu.name + "」章 " + bu.charge + "/" + bu.need + "，攒满才能盖；点旁边空格能挪过去";
            // 通用那句只在第一回合说，之后不再占地方
            else if (me.hand.length && st.turn <= 1) tip = "点一张手里的票，再点上面的空格贴上去；贴完点「寄出」，" + (st.blind ? "对面再动手" : "每张票底下写着它这回合干什么，红框是你要挨打的、绿框是你能打到的");
            return tip ? h("div", { "data-wk": "dueltip", className: "px-3", style: { marginBottom: 5, fontSize: fz(11), color: GREEN, lineHeight: 1.5 } }, tip) : null; })(),
          h("div", { className: "flex items-center px-3", style: { gap: 8, marginBottom: 6, fontSize: fz(12) } },
            h("span", { "data-wk": "duelglue", className: "flex items-center", style: { gap: 3 } }, "胶水", Array.from({ length: Math.max(me.postage, 0) }, (_, k) => h("i", { key: k, style: { width: 8, height: 10, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", background: "#d9a441" } })), me.postage ? null : h("span", { style: { color: SUB } }, " 0")),
            h("span", { className: "flex-1" }),
            handSel >= 0 ? h("button", { onClick: () => { fail(D().keep(st, "me", handSel)); redraw(); }, style: btn("transparent", INK, "rgba(47,42,34,.5)") }, me.kept.includes(handSel) ? "不留了" : "留到下回合") : null,
            h("button", { "data-wk": "duelundo", onClick: back1, disabled: !D().canUndo(st), className: "disabled:opacity-30", style: btn("transparent", INK, INK) }, "撤回"),
            fx ? h("button", { "data-wk": "duelskip", onClick: skip, style: btn("transparent", INK, "rgba(47,42,34,.5)") }, "跳过动画") : null,
            h("button", { "data-wk": "duelsend", onClick: send, disabled: !!fx, className: "disabled:opacity-50", style: Object.assign(btn(RED, "#fff"), { fontFamily: FD, letterSpacing: ".15em" }) }, "寄出")),
          h("div", { className: "flex overflow-x-auto px-3", style: { gap: 8, paddingTop: 6, paddingBottom: 2 } }, me.hand.map((s, k) => h("div", { key: s.cardId + "_" + k, style: { flex: "0 0 74px", opacity: me.postage < s.face ? 0.55 : 1, position: "relative" } },
            h(Ticket, { u: s, card: cardOf(s.cardId), owner: ownerOf(s.charId), useThumb, small: true, sel: handSel === k, wk: "duelcard", onLong: () => openInfo(s, false), onTap: () => { setBoardSel(-1); setHandSel(handSel === k ? -1 : k); } }),
            me.kept.includes(k) ? h("span", { style: { position: "absolute", left: "50%", top: -6, transform: "translateX(-50%)", padding: "0 5px", borderRadius: 3, background: GREEN, color: "#fff", fontSize: fz(8.5) } }, "留") : null))))]);
  }
  window.StampDuelPage = StampDuelPage;
  window.StampInfoCard = StampInfo; window.StampLongPress = useLongPress;
})();
