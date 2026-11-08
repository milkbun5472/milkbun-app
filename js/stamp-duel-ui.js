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
  const MILESTONES = [
    ...[0, 1, 2, 3, 4].map(t => ({ id: "siege" + t, zh: "守住守城第 " + (t + 1) + " 档", ink: 150 * (t + 1), postage: 100, test: x => x.siege && x.win && x.tier === t })),
    ...[5, 10, 15, 20].map((n, i) => ({ id: "edict" + n, zh: "封缄令危险 " + n, ink: [150, 300, 500, 800][i], postage: 100, test: x => x.edict && x.win && x.pts >= n })),
    ...[200, 400, 700, 1000].map((n, i) => ({ id: "raid" + n, zh: "讨伐打出 " + n + " 伤害", ink: [150, 300, 500, 800][i], postage: 100, test: x => x.raid && !x.endless && x.dealt >= n })),
    ...[10, 15, 20].map((n, i) => ({ id: "endless" + n, zh: "无尽撑过 " + n + " 回合", ink: [200, 400, 700][i], postage: 100, test: x => x.raid && x.endless && x.turn >= n })),
    ...[1, 2, 3, 4, 5, 6, 7, 8].map(l => ({ id: "run" + l, zh: "远信 " + l + " 级送到", ink: 100 * l, postage: 100, test: x => x.run && x.win && x.level >= l }))
  ];
  const DAILY = { ink: 60, postage: 60 };
  const Rewards = {
    MILESTONES,
    got: () => ld(REWARD_KEY, { got: {}, day: "" }),
    // x：这一把的结果 { win, siege, tier, edict, pts, raid, endless, dealt, turn, run, level }；返回这次拿到的几样
    settle: x => {
      const C = window.StampsCore; if (!C) return [];
      const r = Rewards.got(), out = []; let ink = 0, post = 0;
      const today = new Date().toISOString().slice(0, 10);
      if (x.win && r.day !== today) { r.day = today; ink += DAILY.ink; post += DAILY.postage; out.push("今天第一次赢：" + DAILY.ink + " 印泥、" + DAILY.postage + " 邮资"); }
      MILESTONES.forEach(m => { if (!r.got[m.id] && m.test(x)) { r.got[m.id] = Date.now(); ink += m.ink; post += m.postage; out.push("✦ " + m.zh + "：" + m.ink + " 印泥、" + m.postage + " 邮资"); } });
      if (ink || post) { try { const st = C.load(); st.ink += ink; st.postage += post; C.save(st); } catch (e) {} sv(REWARD_KEY, r); }
      return out;
    }
  };
  window.StampRewards = Rewards;   // 守城最好成绩：{ waves, wins }
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
    ["每回合你做什么", "回合开始，你有 3 点胶水，手里摸到 4 张票。", "点手里一张，再点自己信封上的空格，就贴上去了。贴一张要花它的面值那么多胶水：R 是 1，SR 是 2，SSR 是 3。", "胶水花完、或者不想贴了，点「寄出」。你的票先动手，然后 TA 照着亮出来的那一步走。", "没用掉的牌回合结束就扔了。想留，选中它点「留到下回合」，最多留两张。", "放错了点「撤回」，一步一步退，胶水也退回来。点了「寄出」就退不回了。"],
    ["五种票各干嘛", "每种票寄出后都会打同一列对面最前面那张（那一列空着就打信封），区别是打几成、顺手还干什么：", "投递：打人的，打满，攻击也最高。", "火漆：肉盾。血厚，每回合给自己封一层护，再打一半。", "补票：奶妈。给最残的那张回血、擦掉身上的戳，再打四成。", "集邮：管钱的。下回合多给胶水、多摸牌，再打四成。", "邮戳：捣乱的。给对面盖戳，再打一半：雨渍攻击 -2，退回停一回合，折角挨打多掉 2，撕口每回合掉 2 血，封口盖不了章也不攒章，延误让对面下回合少 1 胶水；加急是盖给自己人的，让旁边的投递行动两遍。", "对局里对面的等级照你这副牌的平均等级来，不会出现 1 级打 50 级；守城、远信是固定难度档，写着建议等级，卡练强了去打高档；卡升级以后攻击、血涨得比以前多，信封也跟着卡组等级变厚。", "票是哪一种，看卡上写了什么：写打架的多半是投递，写撑伞的多半是火漆。"],
    ["站位：前排挨打，后排输出", "信封第一排是前排。对面打一列，从前排往后找，所以前面有人挡着，后排就挨不着。", "常见摆法：火漆放前排顶着，投递和邮戳放最后一排（后排它们攻击 +2）。", "对面哪一列空着，你那一列的投递就能直接打到 TA 的信封。"],
    ["凑组合", "连张：同一个人的两张票挨着，攻击 +2。", "整版：同一个人的三张票排满一整行或一整列，觉醒一次，打对面信封、全员充章。", "四方连：四张同一个人（或同一种卡，比如都是生日卡）凑成 2×2，觉醒一次，打对面信封、全员加护。", "每种组合每个人一局只觉醒一次。想好凑哪个再贴。", "开局前在「带谁上场」挑一两个人，他们的卡就多，好凑。"],
    ["盖章：每张票的大招", "票底下那排小点每回合亮一格，亮满变金色，就能盖章了。", "点那张票，再点「盖章」，花 1 胶水放它的技能。同一种票有四种技能，SSR 的更猛。", "所以每回合都要想：胶水拿去贴新票，还是去给老票盖章？"],
    ["特质和羁绊", "每张票还有一个特质，是被动：比如「醉意」一半几率打双份、一半几率落空，「锋利」打票不管护盾，「倔强」第一次被打倒会硬撑着留一口气。", "每个人有一个羁绊，看人设来的：护短、好胜、温柔、冷淡、偏执，都不沾就是默契。同一个人的票在信封上有两张以上就生效。", "看不明白哪张票是干嘛的？长按它，什么都写着。对面的票也能长按。"],
    ["别的小东西", "挪票：点自己一张票，再点旁边的空格，花 1 胶水挪过去，用来凑组合或补前排。", "撕票：点一张票点「撕下」，每回合能撕一张，撕的那一下会触发一次效果。信封贴满了也靠它腾地方。", "格子：邮筒格贴着票每回合多 1 胶水；护封格上的票什么戳都盖不上；破损格贴不上。", "邮局公告：每三回合一条全场规则（涨价、大雨、集邮节……），上一回合就会预告。"],
    ["明牌还是盲打", "明牌：TA 下一步要贴什么、贴哪、打你多少，开回合就亮给你看：两边每张票底下都写着它这回合干什么（打几、打信封几、攒胶水、加护……）；你要挨打的那格套红框写「要挨几」，你能打到的对面那格套绿框写「挨几」，打信封的合起来写在信封边上。手里的牌也摊开。适合慢慢算。", "选着手里一张票时，你这边空格里写着贴那儿会打谁、打多少，能凑组合的会亮出来。", "盲打：TA 照样提前想好了，只是不给你看。更刺激。"],
    ["几个上手小招", "开头先贴集邮攒家底，或者先上便宜的火漆把前排顶住。", "看 TA 的下一步：TA 要往哪列贴投递，你就在那一列前面放火漆。", "SSR 别急着上，等胶水够了再贴，顺手凑连张。", "快输了别慌：补票的群补、火漆的加固都能拖回合。"],
    ["远信：一路打过去", "从挑玩法页进「远信」：给一个人寄一封信，信要走一段邮路，最后一站是 TA 本人。", "信封血带着走：一场打完不回满，到驿站、岔路、邮局才回得来。", "路线：雪国、海边、旧城、夜车、花季、沙漠、雨季、山路、梦里、TA 的城市，节日那条只在节日前后开。每条一条棋盘规则，对局顶上写着。默认是 TA 照人设推荐的那条。"],
    ["守城：一波一波守住", "从挑玩法页进「守城」，先挑一档（五档，各写建议等级）：没有对手，卡组从你的邮票册里配，对面是一波一波压过来的麻烦。", "敌人贴在对面后排，一回合往前走一格；走到前排的会打你那一列，在前排站过一回合还没被打掉，下回合就闯过去撞你的信封（写着「要闯过去」）。", "守过第 10 波、场上清空就赢；信封打空就城破。每守住三波，信封回 5、下回合多摸一张。", "跟对局同一套：贴票、胶水、盖章、组合都照旧。你的票照样打同一列最前面那个，所以在敌人走到前排之前就能先打它。"],
    ["远信的信物", "远信路上打赢会掉材料（走主题路线掉那条路的，打赢终点掉「TA 的东西」），只在这一趟里用。", "路线图上点「做信物」：挑三样材料（能混着）、挑收信的人或陪你走的人，请 TA 做一件，花一次调用。TA 照自己的人设和你们聊过的事写名字、一两句来历、看着它说的一句话。", "效果从三样材料的偏向里挑，同一种偏向的越多越强，「TA 的东西」再加一档；做好当场就能带上，这一趟后面每一站都生效。一开始只能带一件，路上的「旧行李箱」能多开一格，最多三格。", "做过的信物都收进开头页的「信物册」。下一趟跟同一个人出发（TA 收信或陪你走），能在开头挑一件旧信物带上，占一格。"],
    ["封缄令：自己加难度", "挑玩法页进「封缄令」：对面是等级固定的审查局。先勾难度条（对面攻击 +2、你少 1 胶水、不能撕票……），每条有分。", "打赢了，勾的分加起来就是这一把的「危险」，记最高的。打输不扣分。勾的那几条打的时候写在「下一步」那块上。"],
    ["讨伐：冲伤害", "挑玩法页进「讨伐」：对面是打不死的邮政总局，比你打出多少伤害（打人、打信封都算）。分「8 回合」和「无尽（打到你信封空）」两种，各记最高分。", "总局每回合派人顶在前排；第 4、第 7 回合换阶段，人更多、更硬。总局每回合还盖一记大章砸你的信封，明牌会算进「你的信封要挨」。", "封条：有的人贴着封条（签上写「封条·」），封着的时候怎么打都只掉 1。用邮戳打到它、或盖章打到它，封条撕开，接下来两回合虚弱（「虚弱·」）、挨打翻倍。先撕封条再集火最划算。"],
    ["奖励", "每天第一次赢任何玩法给一点印泥和邮资；各玩法的里程碑（守城每一档、封缄令危险、讨伐伤害、无尽回合、远信等级）第一次达成另给一笔，只给一次。挑玩法页的「战功邮戳」能看拿过哪些。"],
    ["打完以后", "选「再来一把」接着打，或者「结束」。结束时问要不要让 TA 记得，记的话这几把合成一句进 TA 的记忆。", "打到一半想走，直接返回就行，会存着。下次进来点「接着打」。", "手牌上面那条能跟 TA 聊天，你说一句 TA 回几句，发一句花一次调用。"]
  ];
  const fz = n => "calc(" + n + "px * var(--app-fs, 1))";
  const F = typeof F_BODY !== "undefined" ? F_BODY : "inherit";
  const FD = typeof F_DISPLAY !== "undefined" ? F_DISPLAY : F;
  // 邮票的齿孔边：跟邮票册那枚同一个画法
  const perf = bg => "radial-gradient(circle at 4px 4px, transparent 2.6px, " + bg + " 2.8px) -4px -4px / 7px 7px";
  // 信封边上的航空条纹
  const AIRMAIL = "repeating-linear-gradient(135deg, #b23a2e 0 10px, " + PAPER + " 10px 16px, #3f6fb0 16px 26px, " + PAPER + " 26px 32px)";
  const noThumb = () => [null, { current: null }];
  // 特效（她 2026-11-07「做一些特效」）：寄出以后按这一回合的记录一步步放——挨打的票闪红、掉血数字飘起来、
  //   回血飘绿、觉醒和盖章整张发金光、中间弹一句台词、信封挨打时整个抖一下。只是放给她看，结算早就算完了
  const FX_CSS = "@keyframes duelPulse{0%,100%{opacity:.95}50%{opacity:.45}}@keyframes duelHit{0%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}100%{transform:translateX(0)}}"
    + "@keyframes duelFloat{0%{opacity:0;transform:translate(-50%,0) scale(.8)}20%{opacity:1;transform:translate(-50%,-6px) scale(1.15)}100%{opacity:0;transform:translate(-50%,-26px) scale(1)}}"
    + "@keyframes duelGlow{0%{box-shadow:0 0 0 0 rgba(255,207,107,.0)}40%{box-shadow:0 0 14px 5px rgba(255,207,107,.95)}100%{box-shadow:0 0 0 0 rgba(255,207,107,0)}}"
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
  function AimLayer({ host, foeAims, meAims, foeActs, meActs, foeStamps, myPrev, tick }) {
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
          badges: (myPrev || []).map(pv => ({ at: box(false, pv.slot), pv })).filter(x => x.at) });
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
  function StampDuelPage({ characters, cards, onBack, onRemember, closeOf, meName, toast, useThumb, onChat, onReport, preset, onRun, runBattle }) {
    const [foeId, setFoeId] = useState(() => { if (runBattle) return runBattle.foeId || ""; if (preset && preset.foeId) return preset.foeId; const has = (characters || []).find(c => (cards || []).some(x => x.charId === c.id)); return (has || (characters || [])[0] || {}).id; });
    const [blind, setBlind] = useState(false);
    const [st, setSt] = useState(() => { if (!runBattle) return null;
      const b = runBattle, x = D().newDuel(b.meDeck, b.foeDeck, b.seed, b); x.run = true; x.events = x.events || []; return x; });
    const [, bump] = useState(0);
    const [handSel, setHandSel] = useState(-1), [boardSel, setBoardSel] = useState(-1);
    const [series, setSeries] = useState(null), [asking, setAsking] = useState(false);
    const [fx, setFx] = useState(null), [banner, setBanner] = useState(null), playing = useRef(0), [bubble, setBubble] = useState(null);
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
    const [mode, setMode] = useState(() => (preset || runBattle) ? "duel" : "");
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
    let foeName = (st && st.edict && "审查局") || (st && st.siege && "城外") || (st && st.raid && "邮政总局") || (runBattle && runBattle.foeName) || nameOf(runBattle ? runBattle.foeId : foeId) || "TA";
    // 没打完退出去也留着（她 2026-11-07「没打完暂退能不能存档跟小游戏一样」）：每动一步就存一份，打完、放弃才清
    const SAVE_KEY = "x_stampDuelSave";
    const [saved, setSaved] = useState(() => { try { const v = typeof loadJSON === "function" ? loadJSON(SAVE_KEY, null) : null; return v && v.st && !v.st.over ? v : null; } catch (e) { return null; } });
    const persist = (x, sr) => { try { if (typeof saveJSON !== "function" || (x && (x.tutorial || x.run || x.siege || x.raid || x.edict)) || runBattle) return; if (x && !x.over) saveJSON(SAVE_KEY, { st: x, series: sr || null, foeId, at: Date.now() }); else saveJSON(SAVE_KEY, null); } catch (e) {} };
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
    const modeCard = (wk, color, title, sub, desc, onTap) => h("button", { "data-wk": wk, onClick: onTap, className: "w-full text-left active:scale-[.99]",
      style: { display: "block", marginBottom: 14, padding: 0, borderRadius: 6, overflow: "hidden", background: PAPER, boxShadow: "0 3px 10px rgba(47,42,34,.18)", border: "1px solid " + color + "55", color: INK } },
      h("div", { style: { height: 6, background: AIRMAIL } }),
      h("div", { style: { position: "relative", padding: "14px 16px 14px" } },
        h("div", { style: { position: "absolute", right: 14, top: 12, width: 42, height: 42, borderRadius: 999, background: "radial-gradient(circle at 35% 30%, " + color + "cc, " + color + ")", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: fz(12), transform: "rotate(-8deg)", boxShadow: "0 2px 4px rgba(0,0,0,.25)" } }, sub),
        h("div", { style: { fontFamily: FD, fontSize: fz(18), color, marginRight: 52 } }, title),
        h("div", { style: { fontSize: fz(12), color: SUB, lineHeight: 1.7, marginTop: 4, marginRight: 40 } }, desc)));
    // 守城挑档（她 2026-11-08「后面难度比我的卡都高我怎么赢」→ 固定难度档）
    if (!st && mode === "edictpick") {
      const E = D().EDICTS, pts = edictPick.reduce((a, k) => a + E[k].pt, 0), b = edictBest(), my = Math.round(D().avgLv(cards || []));
      return shell([
        h(Head, { key: "hd", zh: "封缄令", bg: "transparent", ink: INK, onBack: () => setMode(""), right: guideBtn }),
        h("div", { key: "bd", "data-wk": "dueledictpick", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingTop: 6, paddingBottom: 24 } },
          h("div", { style: { fontSize: fz(12), color: SUB, lineHeight: 1.75, margin: "0 0 12px" } }, "对面是「审查局」，等级固定 " + D().EDICT_LV + " 级（你的卡平均 " + my + " 级）。下面每一条都是给自己加的难度，后面写着分：勾得越多越难，打赢了勾的分加起来就是这一把的「危险」，记最高的。一条不勾也能打，算 0 分。"),
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
        h(Head, { key: "hd", zh: "讨伐", bg: "transparent", ink: INK, onBack: () => setMode(""), right: guideBtn }),
        h("div", { key: "bd", "data-wk": "duelraidpick", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingTop: 6, paddingBottom: 24 } },
          h("div", { style: { fontSize: fz(12), color: SUB, lineHeight: 1.75, margin: "0 0 14px" } }, "对面是打不死的「邮政总局」，比的是你能打出多少伤害。总局每回合派人顶在前排，有的贴着「封条」：封着的时候怎么打都只掉 1，用邮戳打、或者盖章打到它，封条就撕开，接下来两回合虚弱、挨打翻倍。总局每回合还会盖一记大章砸你的信封，越往后越重。第 4、第 7 回合换阶段。"),
          card("normal", "讨伐 · 8 回合", "打满 8 回合算总伤害。信封被砸空就提前结束，分照算。", RED),
          card("endless", "无尽", "不设回合数，一直打到你的信封空。8 回合以后大章越砸越重，看能撑几回合、打出多少。", "#6a4f8a"))]);
    }
    if (!st && mode === "siegepick") { const my = Math.round(D().avgLv(cards || []));
      return shell([
        h(Head, { key: "hd", zh: "守城", bg: "transparent", ink: INK, onBack: () => setMode(""), right: guideBtn }),
        h("div", { key: "bd", "data-wk": "duelsiegepick", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingTop: 6, paddingBottom: 24 } },
          h("div", { style: { fontSize: fz(12), color: SUB, lineHeight: 1.7, margin: "0 0 12px" } }, "挑一档守。每档敌人的等级是定的，第 1 波比建议等级低一半，越往后越高，第 10 波高出三成。你这些卡平均 " + my + " 级：比建议低的档也能守，靠站位、组合和盖章；卡练强了再去打高档。"),
          D().SIEGE_TIERS.map((lv, t) => { const b = siegeBest(t), easy = my >= lv, c = easy ? GREEN : my >= lv * 0.7 ? "#b8862a" : RED;
            return h("button", { key: t, "data-wk": "duelsiegetier", onClick: () => startSiege(t), className: "w-full text-left active:scale-[.99]", style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 10, padding: "12px 14px", borderRadius: 6, background: PAPER, boxShadow: "0 2px 8px rgba(47,42,34,.12)", borderLeft: "4px solid " + c, color: INK } },
              h("div", { style: { fontFamily: FD, fontSize: fz(20), color: c, width: 30, textAlign: "center" } }, t + 1),
              h("div", { className: "flex-1 min-w-0" },
                h("div", { style: { fontFamily: FD, fontSize: fz(14) } }, "第 " + (t + 1) + " 档 · 建议 " + lv + " 级"),
                h("div", { style: { fontSize: fz(11), color: SUB } }, (easy ? "你的卡够了" : my >= lv * 0.7 ? "差一点，要动脑子" : "比你高不少，硬仗") + (b.waves ? " · 最好守住 " + b.waves + " 波" + (b.wins ? "，守住过 " + b.wins + " 次" : "") : ""))));
          }))]); }
    if (!st && !mode) return shell([
      h(Head, { key: "hd", zh: "对战", bg: "transparent", ink: INK, onBack, right: guideBtn }),
      h("div", { key: "bd", "data-wk": "duelmodes", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingTop: 6, paddingBottom: 24 } },
        h("div", { style: { fontSize: fz(12), color: SUB, margin: "0 0 14px" } }, "拿邮票册里的卡来打。先挑一种玩法："),
        modeCard("duelmodeduel", RED, "对局", "对局", "跟一个人面对面打一把：挑对手、带谁上场、彩头、难度、明牌还是盲打。能连打几把，打完让 TA 记得，或者把战报发进聊天。" + (saved ? "（有一把没打完，进去能接着打）" : ""), () => setMode("duel")),
        modeCard("duelmodeedict", "#5a4f8a", "封缄令", "封缄", "自己给自己加难度：对面攻击更高、你少胶水、不能撕票……每条有分，勾得越多越难。打赢了分加起来就是这一把的「危险」，冲最高。不花调用。", () => setMode("edictpick")),
        modeCard("duelmoderaid", "#8a3a4a", "讨伐", "讨伐", "打不死的邮政总局，比打出多少伤害。有的敌人贴着封条，用邮戳或盖章撕开，它就虚弱两回合、挨打翻倍。分 8 回合冲分和无尽两种，不花调用。", () => setMode("raidpick")),
        modeCard("duelmodesiege", "#3f6fb0", "守城", "守城", "麻烦一波一波压过来：敌人贴在对面，一回合往前走一格，在前排站过一回合还没被打掉就闯过去撞你的信封。守过 10 波就赢，每守住三波信封回 5。分五档，每档敌人的等级是定的。不花调用。", () => setMode("siegepick")),
        onRun ? modeCard("duelgorun", "#b8862a", "远信", "远信", "给一个人寄封信，一路打过去：六站路线、路上的麻烦和拦信的人、邮局、驿站、信物。信封血不回满，送到了 TA 会写回信。", onRun) : null,
        (() => { const g = Rewards.got().got || {}, n = MILESTONES.filter(m => g[m.id]).length;
          return h("details", { key: "ms", "data-wk": "duelmilestones", style: { marginBottom: 14, padding: "10px 14px", borderRadius: 6, background: "rgba(255,253,247,.9)", boxShadow: "0 2px 8px rgba(47,42,34,.10)" } },
            h("summary", { style: { fontFamily: FD, fontSize: fz(14), cursor: "pointer", color: INK } }, "战功邮戳 · " + n + " / " + MILESTONES.length),
            h("div", { style: { fontSize: fz(11), color: SUB, margin: "4px 0 8px", lineHeight: 1.6 } }, "每个第一次达成给一笔印泥和邮资，只给一次；每天第一次赢任何玩法另给 " + DAILY.ink + " 印泥、" + DAILY.postage + " 邮资。"),
            h("div", { className: "flex flex-wrap", style: { gap: 6 } }, MILESTONES.map(m => { const on = !!g[m.id]; return h("span", { key: m.id, "data-wk": "duelmilestone", "data-on": on ? "1" : "0", style: { padding: "2px 9px", borderRadius: 999, fontSize: fz(11), border: "1px " + (on ? "solid #b8862a" : "dashed rgba(47,42,34,.25)"), color: on ? "#b8862a" : SUB, background: on ? "rgba(184,134,42,.08)" : "transparent" } }, (on ? "✦ " : "") + m.zh + (on ? "" : " · " + m.ink)); }))); })(),
        modeCard("duelturorial", GREEN, "新手教学关", "教学", "第一次玩先来这儿：一把练习局，一步步教贴票、寄出、盖章、长按看底细、四方连。随时能回来再玩，不花调用。", startTut))]);
    // ── 开局前：挑对手、明牌还是盲打 ──
    if (!st) return shell([
      h(Head, { key: "hd", zh: "对局", bg: "transparent", ink: INK, onBack: preset ? onBack : () => setMode(""), right: guideBtn }),
      h("div", { key: "bd", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingBottom: 24 } },
        h("div", { style: { fontSize: fz(12), color: SUB, lineHeight: 1.7, margin: "2px 0 14px" } }, "每局从你的收藏里随机抽 12 张。对面用 TA 自己的卡，加上跟 TA 有关系的人的卡；不够的用普通邮票补。不花调用。"),
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
    const skip = () => { playing.current = 0; setFx(null); setBanner(null); redraw(); };
    const play = n0 => {
      const evs = st.log.slice(n0).filter(l => ["hit", "hitEnv", "fall", "heal", "gain", "ink", "wake", "stamp", "place", "skip", "event"].includes(l.kind));
      if (!evs.length) return;
      const run = ++playing.current; let k = 0;
      const step = () => {
        if (playing.current !== run) return;
        if (k >= evs.length) { guard.current = Date.now() + 800; setFx(null); setBanner(null); playing.current = 0; redraw(); setTimeout(() => setBubble(b => (b && b.key === lastBubble.current ? null : b)), 2600); return; }
        const l = evs[k++], side = l.kind === "hitEnv" ? (l.who === "me" ? "foe" : "me") : fxSide(l);
        const txt = l.kind === "hit" ? "-" + l.n : l.kind === "heal" ? "+" : l.kind === "gain" ? "+胶" : l.kind === "skip" ? (l.text.indexOf("退回") >= 0 ? "退回" : "落空") : "";
        setFx({ kind: l.kind, side, slot: l.slot, slots: l.slots, n: l.n, ink: l.ink, txt, from: l.from, text: l.text, who: l.who });
        // 他开口：他的票上场、被打掉、觉醒、盖章时说卡上那句；打掉她一张时说他卡上戳一戳时那句（她 2026-11-08 同意「像他」）
        const foeLine = l.who === "foe" && l.line ? l.line : (l.kind === "fall" && l.who === "me" ? (them.board.find(x => x && x.lines && x.lines.win) || {}).lines : null);
        const said = typeof foeLine === "string" ? foeLine : foeLine && foeLine.win;
        // 这一下的台词要不要冒出来、念出来：照她在 🔊 里勾的（哪种时候、哪一边）
        const want = l.line && voice[l.kind] && voice[l.who === "foe" ? "foe" : "me"];
        if (want && voice.on && ttsOk()) speakQ(l.line, voiceOf(l.char));
        if (want && l.who === "me") { const key = Math.random(); lastBubble.current = key; setBubble({ text: l.line, key, me: true, who: nameOf(l.char) || meName || "我" }); }
        else if (said) { const key = Math.random(); lastBubble.current = key; setBubble({ text: said, key, who: l.char ? nameOf(l.char) : "" }); if (!want && voice.on && voice.foe && ttsOk() && foeLine && foeLine.win) speakQ(said, voiceOf(foeId)); }
        // 远信终点：TA 的信封掉到一半时开一次口（她 2026-11-08「打到一半 TA 冒台词，像在拦你又舍不得拦」）
        else if (runBattle && runBattle.boss && !st.halfSaid && them.hp <= (them.max || 40) / 2) {
          st.halfSaid = 1; const pool = them.board.concat(them.hand).filter(Boolean).map(u => u.lines && (u.lines.wake || u.lines.enter)).filter(Boolean);
          if (pool.length) { const key = Math.random(); lastBubble.current = key; setBubble({ text: pool[Math.floor(Math.random() * pool.length)], key }); }
        }
        const big = l.kind === "wake" || l.kind === "stamp" || l.kind === "event";
        if (big) setBanner({ text: l.text, line: l.line || "", who: l.who, key: Math.random() }); else setBanner(null);
        setTimeout(step, l.kind === "wake" ? 2600 : big ? 1800 : l.kind === "place" ? 380 : 520);
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
    if (over && !playing.current && !st.run && !st.siege && !st.raid && !st.edict) record(st);
    if (over && !playing.current && !st.run && !st.tutorial && !st.rewards) st.rewards = Rewards.settle({ win: over.winner === "me", siege: !!st.siege, tier: st.siegeTier || 0, edict: !!st.edict, pts: st.edictPts || 0, raid: !!st.raid, endless: !!(st.raid && st.raid.endless), dealt: st.raid ? st.raid.dealt : 0, turn: st.turn });
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
    const talk = async () => {
      const text = draft.trim(); if (!text || chatBusy || !onChat) return;
      st.chat.push({ who: "me", text }); setDraft(""); setChatOpen(true); setChatBusy(true); redraw();
      try {
        const hist = st.chat.slice(-9, -1).map(m => (m.who === "me" ? (meName || "她") : foeName) + "：" + m.text).join("\n");
        const lines = await onChat(foeId, { text, board: boardLine(), history: hist });
        (lines || []).forEach(x => st.chat.push({ who: "foe", text: x }));
        if (!(lines || []).length) toast && toast(foeName + " 没接上话，再说一句试试");
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
        (chatOpen ? "▾ " : "▸ ") + (st.chat.length ? (st.chat[st.chat.length - 1].who === "me" ? "我：" : foeName + "：") + st.chat[st.chat.length - 1].text : "跟 " + foeName + " 说两句（发一句花一次调用）")),
      chatOpen ? h("div", { style: { maxHeight: 150, overflowY: "auto", margin: "4px 0", display: "flex", flexDirection: "column", gap: 4 } },
        st.chat.slice(-12).map((m, k) => h("div", { key: k, "data-wk": "duelchatmsg", "data-me": m.who === "me" ? "1" : "0", style: { alignSelf: m.who === "me" ? "flex-end" : "flex-start", maxWidth: "80%", padding: "4px 9px", borderRadius: 10,
          background: m.who === "me" ? "rgba(79,122,102,.16)" : "#fff", fontSize: fz(12.5), lineHeight: 1.5 } }, m.text)),
        chatBusy ? h("div", { style: { fontSize: fz(11), color: SUB } }, foeName + " 在打字…") : null) : null,
      h("div", { "data-wk": "duelemotes", className: "flex overflow-x-auto", style: { gap: 5, paddingTop: 4 } }, EMOTES.map(e => h("button", { key: e, onClick: () => quick(e), style: { flexShrink: 0, padding: "2px 9px", borderRadius: 999, border: "1px solid rgba(47,42,34,.2)", background: "rgba(255,255,255,.6)", fontSize: fz(11.5), color: INK } }, e))),
      h("div", { className: "flex items-center", style: { gap: 6, padding: "4px 0 6px" } },
        h("input", { "data-wk": "duelchatinput", value: draft, onChange: e => setDraft(e.target.value), onKeyDown: e => { if (e.key === "Enter") talk(); }, placeholder: "边打边说…",
          style: { flex: 1, minWidth: 0, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(47,42,34,.25)", background: "#fff", fontSize: fz(12.5) } }),
        h("button", { onClick: talk, disabled: chatBusy || !draft.trim(), className: "disabled:opacity-40", style: btn(INK, PAPER) }, "说")));
    const ev = st.events[st.turn];
    const intentText = [].concat((it.stamp || []).map(x => "给「" + x.name + "」盖章"), (it.place || []).map(x => "贴「" + x.name + "」" + x.role)).join("、") || "这回合不贴票";

    return shell([
      h(Head, { key: "hd", zh: st.edict ? "封缄令 · 危险 " + (st.edictPts || 0) + " · 第 " + st.turn + " 回合" : st.raid ? (st.raid.endless ? "无尽" : "讨伐") + " · 第 " + st.turn + " 回合" : st.siege ? "守城 " + ((st.siegeTier || 0) + 1) + " 档 · 第 " + Math.min(st.turn, st.siege.waves) + " 波" : "第 " + st.turn + " 回合", sub: st.siege ? "" : "对 " + foeName + (st.blind ? " · 盲打" : ""), bg: "transparent", ink: INK, right: guideBtn,
        onBack: () => { if (st.edict) { setSt(null); setMode("edictpick"); return; } if (st.raid) { setSt(null); setMode("raidpick"); return; } if (st.siege) { setSt(null); setMode("siegepick"); return; } if (st.run) { runBattle.onQuit && runBattle.onQuit(); return; } if (st.tutorial) { setSt(null); setTut(-1); return; } if (!over) { persist(st, series); setSaved({ st, series, foeId, at: Date.now() }); } else persist(null); setSt(null); setSeries(null); } }),
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
          h("span", { style: { color: RED, fontFamily: FD, marginRight: 6 } }, bubble.who || foeName), bubble.text) : null,
        // 对面的下一步：像一张电报条（盲打时不给看）
        h("div", { "data-wk": "duelintent", style: { position: "relative", margin: "6px 0 10px", padding: "7px 10px 7px 46px", borderRadius: 3, border: "1px dashed rgba(47,42,34,.35)", background: "rgba(255,255,255,.5)", fontSize: fz(11.5), lineHeight: 1.6 } },
          h("span", { style: { position: "absolute", left: 7, top: 7, padding: "1px 4px", border: "1.5px solid " + RED, color: RED, borderRadius: 3, fontFamily: FD, fontSize: fz(10), transform: "rotate(-6deg)" } }, "下一步"),
          st.edict && st.edict.length ? h("div", { "data-wk": "duelediccline", style: { color: "#5a4f8a", fontSize: fz(10.5) } }, "封缄：" + st.edict.map(k => D().EDICTS[k].zh).join("、")) : null,
          it.styleZh && !st.siege && !st.raid && !st.edict ? h("div", { style: { color: SUB, fontSize: fz(10.5) } }, foeName + " 的打法：" + it.styleZh) : null,
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
          tick: st.turn + "|" + handSel + "|" + me.board.map(u => u ? u.uid : 0).join(",") + "|" + them.board.map(u => u ? u.uid : 0).join(",") + "|" + me.hand.length }) : null),
        Seal(meName || "我", me.hp, me.max || D().ENVELOPE_HP, GREEN),
        bubble && bubble.me ? h("div", { key: "bm" + bubble.key, "data-wk": "duelsay", "data-me": "1", style: { position: "relative", margin: "4px 34px 2px auto", maxWidth: "86%", width: "fit-content", padding: "6px 11px", borderRadius: "12px 4px 12px 12px", background: "#f1f7f3", boxShadow: "0 2px 6px rgba(47,42,34,.15)", fontSize: fz(12.5), lineHeight: 1.55, color: INK, animation: "duelPop .3s" } },
          h("span", { style: { color: GREEN, fontFamily: FD, marginRight: 6 } }, bubble.who), bubble.text) : null,
        // 选中场上一张：盖章 / 撕下；点旁边空格＝挪过去
        selU ? h("div", { "data-wk": "duelactions", style: { marginTop: 8, padding: "8px 10px", borderRadius: 4, background: "rgba(255,255,255,.55)", fontSize: fz(12) } },
          h("div", { style: { marginBottom: 6 } }, h("b", null, selU.name), h("span", { style: { color: SUB } }, " · " + (ownerOf(selU.charId) || "通用票") + " · " + selU.role + "：" + ROLE_TIP[selU.role])),
          h("div", { className: "flex items-center flex-wrap", style: { gap: 6 } },
            h("button", { onClick: () => doMine(() => D().stamp(st, "me", boardSel)), disabled: selU.charge < selU.need, className: "disabled:opacity-40", style: btn(RED, "#fff") }, "盖章（1 胶水）"),
            h("button", { onClick: () => doMine(() => D().tear(st, "me", boardSel)), style: btn("transparent", INK, INK) }, "撕下"),
            h("span", { style: { color: SUB, fontSize: fz(11) } }, "点旁边空格＝挪过去（1 胶水）"))) : null,
        h("div", { "data-wk": "duellog", style: { marginTop: 10, fontSize: fz(11), color: SUB, lineHeight: 1.65 } }, log.map((l, k) => h("div", { key: k }, (l.who === "foe" ? foeName + "：" : l.who === "me" ? "我：" : "") + l.text + (l.line ? "「" + l.line + "」" : ""))))),
      onChat && !st.tutorial && !st.siege && !st.raid && !st.edict && foeId ? chatBox : null,
      info ? h(StampInfo, { key: "info", u: info.u, foe: info.foe, terrain: info.terrain, live: (info.foe ? them : me).board.some(x => x && x.uid && x.uid === info.u.uid), bonds: st.bonds, cardOf, ownerOf, nameOf, useThumb, onClose: () => setInfo(null) }) : null,
      // 中间弹出的那块（她 2026-11-08「这种黄框也做好看点」）：像一封电报——上面一枚火漆封印写是什么事，
      //   中间大字是哪张票／哪条公告，台词另起一行像手写；觉醒是金色、盖章是红色、公告是绿色
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
          st.rewards && st.rewards.length ? h("div", { "data-wk": "duelreward", style: { margin: "0 0 8px", padding: "6px 10px", borderRadius: 5, background: "rgba(184,134,42,.1)", border: "1px solid rgba(184,134,42,.35)", fontSize: fz(11.5), lineHeight: 1.6, color: "#7a5a1a", textAlign: "center" } }, st.rewards.map((t, k) => h("div", { key: k }, t))) : null,
          st.edict ? h("div", { key: "edo", "data-wk": "duelediccover", style: { textAlign: "center", marginBottom: 10 } }, h("div", { style: { fontFamily: FD, fontSize: fz(20), color: over.winner === "me" ? "#5a4f8a" : RED } }, over.winner === "me" ? "通过 · 危险 " + (st.edictPts || 0) : "没过"), h("div", { style: { fontSize: fz(11.5), color: SUB } }, over.winner === "me" ? ((st.edictPts || 0) > (st.edictPrev || 0) ? "新纪录！" : "最高 危险 " + (st.edictPrev || 0)) : "少勾几条再试，或者换个打法")) : null,
          st.raid ? h("div", { key: "rdo", "data-wk": "duelraidover", style: { textAlign: "center", marginBottom: 10 } }, h("div", { style: { fontFamily: FD, fontSize: fz(22), color: "#8a3a4a" } }, st.raid.dealt + " 伤害"), h("div", { style: { fontSize: fz(11.5), color: SUB } }, (st.raid.endless ? "无尽 · 撑了 " + st.turn + " 回合" : over.winner === "me" ? "打满 8 回合" : "第 " + st.turn + " 回合信封被砸空了") + (st.raid.prev != null ? (st.raid.dealt > st.raid.prev ? " · 新纪录！" : " · 最高 " + st.raid.prev) : ""))) : null,
          st.siege ? h("div", { key: "sgo", "data-wk": "duelsiegeover", style: { textAlign: "center", marginBottom: 10 } }, h("div", { style: { fontFamily: FD, fontSize: fz(18), color: over.winner === "me" ? GREEN : RED } }, over.winner === "me" ? "守住了" : "城破了"), h("div", { style: { fontSize: fz(11.5), color: SUB } }, "第 " + ((st.siegeTier || 0) + 1) + " 档 · 守住 " + st.siege.cleared + " / " + st.siege.waves + " 波 · 信封剩 " + Math.max(0, over.me) + " · 这档最好 " + Math.max(siegeBest(st.siegeTier || 0).waves || 0, st.siege.cleared) + " 波")) : null,
          st.siege || st.raid || st.edict ? null : h("div", { style: { fontFamily: FD, fontSize: fz(18), textAlign: "center", marginBottom: 2, color: over.winner === "me" ? GREEN : over.winner === "foe" ? RED : INK } }, over.winner === "me" ? "你赢了" : over.winner === "foe" ? foeName + " 赢了" : "打平了"),
          st.siege || st.raid || st.edict ? null : h("div", { style: { fontSize: fz(11), textAlign: "center", color: SUB, marginBottom: 10 } }, over.turn + " 回合 · 信封剩 " + over.me + " : " + over.foe + (over.byCap ? " · 打满回合比剩下的" : "")),
          // 彩头兑现、赛后复盘（她 2026-11-08）：各点一次叫 TA 一次
          !st.tutorial && !st.run && onChat ? (() => {
            const ask = async mode => {
              if (after.busy) return; setAfter(a => Object.assign({}, a, { busy: mode }));
              try { const lines = await onChat(foeId, { mode, wager: st.wager, winner: over.winner, board: boardLine(), history: st.chat.slice(-6).map(m => (m.who === "me" ? (meName || "她") : foeName) + "：" + m.text).join("\n") });
                setAfter(a => Object.assign({}, a, { [mode]: lines && lines.length ? lines : ["（没接上话，再点一次试试）"], busy: "" })); }
              catch (e) { toast && toast("没成：" + ((e && e.message) || e)); setAfter(a => Object.assign({}, a, { busy: "" })); }
            };
            const box = (title, lines) => h("div", { style: { margin: "0 0 8px", padding: "8px 11px", borderRadius: 4, background: "#fff", fontSize: fz(12.5), lineHeight: 1.65 } }, h("div", { style: { fontFamily: FD, fontSize: fz(11), color: SUB, marginBottom: 2 } }, title), lines.map((x, k) => h("div", { key: k }, x)));
            return h("div", { "data-wk": "duelafter" },
              st.wager ? (after.wager ? box("彩头 · " + st.wager, after.wager)
                : h("button", { "data-wk": "duelwagergo", onClick: () => ask("wager"), disabled: !!after.busy, className: "w-full disabled:opacity-50", style: Object.assign(btn("rgba(178,58,46,.08)", RED, RED), { marginBottom: 8 }) }, after.busy === "wager" ? foeName + " 在想…" : (over.winner === "foe" ? foeName + " 来讨彩头：" : over.winner === "me" ? "让 " + foeName + " 兑现：" : "打平了，彩头怎么算：") + st.wager)) : null,
              after.review ? box(foeName + " 复盘", after.review)
                : h("button", { "data-wk": "duelreview", onClick: () => ask("review"), disabled: !!after.busy, className: "w-full disabled:opacity-50", style: Object.assign(btn("transparent", SUB, "rgba(47,42,34,.25)"), { marginBottom: 8, fontSize: fz(11.5) }) }, after.busy === "review" ? foeName + " 在想…" : "听 " + foeName + " 复盘这一把（花一次调用）"));
          })() : null,
          // 战报发进聊天（她 2026-11-08）
          !st.tutorial && !st.run && onReport ? h("button", { "data-wk": "duelreportgo", disabled: reported, onClick: () => {
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
          : st.edict ? h("div", { className: "flex", style: { gap: 8 } },
              h("button", { "data-wk": "duelediccagain", onClick: () => startEdict(st.edict), className: "flex-1", style: btn(INK, PAPER) }, "同样的再来"),
              h("button", { onClick: () => { setSt(null); setMode("edictpick"); }, className: "flex-1", style: btn("transparent", INK, INK) }, "改封缄"))
          : st.raid ? h("div", { className: "flex", style: { gap: 8 } },
              h("button", { "data-wk": "duelraidagain", onClick: () => startRaid(st.raid.endless ? "endless" : "normal"), className: "flex-1", style: btn(INK, PAPER) }, "再打一次"),
              h("button", { onClick: () => { setSt(null); setMode("raidpick"); }, className: "flex-1", style: btn("transparent", INK, INK) }, "回讨伐"))
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
        : h("div", { key: "ft", "data-wk": "duelhand", className: "shrink-0", style: { paddingTop: 8, paddingBottom: "calc(8px + env(safe-area-inset-bottom) * 0.4)", borderTop: "1px solid rgba(47,42,34,.18)", background: "rgba(251,246,234,.92)", fontFamily: F, color: INK } },
          // 选着什么就告诉她现在能干嘛（她 2026-11-08「不好上手」→ 做 2、3）
          (() => { const hs = handSel >= 0 ? me.hand[handSel] : null, bu = boardSel >= 0 ? me.board[boardSel] : null;
            let tip = "";
            if (hs) { const c = hs.face + (st.events[st.turn] === "涨价" ? 1 : 0); tip = me.postage >= c ? "「" + hs.name + "」" + hs.role + "，贴一张花 " + c + " 胶水 → 点上面亮着的空格；格子里写着贴那儿会打谁" : "「" + hs.name + "」要 " + c + " 胶水，你只剩 " + me.postage + "，这回合贴不了，可以「留到下回合」"; }
            else if (bu) tip = bu.charge >= bu.need ? "「" + bu.name + "」章攒满了，点「盖章」放大招" : "「" + bu.name + "」章 " + bu.charge + "/" + bu.need + "，攒满才能盖；点旁边空格能挪过去";
            else if (me.hand.length) tip = "点一张手里的票，再点上面的空格贴上去；贴完点「寄出」，" + (st.blind ? "对面再动手" : "每张票底下写着它这回合干什么，红框是你要挨打的、绿框是你能打到的");
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
