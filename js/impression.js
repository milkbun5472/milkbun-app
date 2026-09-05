// ============================================================
// 月度印象（impression）—— 每个月，每个角色眼里的「你」长什么样
// 一张剪影 + 三个关键词 + 一句他亲口说的话。按角色收进珍藏册，漏掉的月份可以补。
// 素材=当月和这个角色之间真实发生的事；底子=「Ta 眼里」(x_gaze) 已经攒下的长期印象。
// 剪影不需要锁脸(看不见五官)，所以完全不碰参考照那套，也就不吃合照那些审核麻烦。
// ============================================================
(function () {
  // 禁烟这一层（她 2026-09-05：「你看看还有哪儿没禁烟的」）。
  // ⚠️它是【世界事实】，不是文风：这个 app 里没人抽烟，那在哪一处都得成立。
  //   原来它只挂在 buildBundle / groupBans 上，于是【凡是自己拼 sys 的地方一律没有】。
  //   不许塞进 ANTI_CLICHE 搭便车（v55.90 那条：能独立成立的规则就让它独立成立，
  //   挂在别人身上，别人不发的那一轮它就跟着消失）。
  const CB = () => (typeof ContentBoundaries !== "undefined" && ContentBoundaries.prompt ? ContentBoundaries.prompt + "\n\n" : "");
  const useState = React.useState, useEffect = React.useEffect;
  const K = "x_impressions";
  const load = () => { try { return JSON.parse(localStorage.getItem(K) || "{}"); } catch (e) { return {}; } };
  const save = d => saveJSON(K, d);
  const uid = () => "im_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // 图标：一轮月亮 + 一道侧影
  window.GImpression = p => h(Svg, p,
    h("path", { d: "M12 3a9 9 0 100 18 9 9 0 000-18z" }),
    h("path", { d: "M15.5 20.4c-1.6-1-2.2-2.6-2.2-4.3 0-2.1 1.2-3 1.2-4.6 0-1.5-1.2-2.4-2.6-2.4-1.7 0-2.9 1.2-3.4 2.6" }));

  // ---- 月份工具 ----
  const monthKeyOf = ts => { const d = new Date(ts); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
  const monthLabel = k => { const [y, m] = String(k).split("-"); return y + " 年 " + Number(m) + " 月"; };
  const monthRange = k => {
    const [y, m] = String(k).split("-").map(Number);
    return { start: new Date(y, m - 1, 1).getTime(), end: new Date(y, m, 1).getTime() - 1 };
  };
  // 可写的月份 = 【已经过完的月】。本月还在发生，写不出"这个月你是什么样"——
  // 和周刊同一条规矩：报道窗口必须已经关闭（她 2026-08-20 指出）。
  // 所以 i 从 1 起：最近可写的是上个月，本月要等下月 1 号 0 点。
  const prevMonths = (n, now) => {
    const out = [], d = now ? new Date(now) : new Date();
    for (let i = 1; i <= n; i++) out.push(monthKeyOf(new Date(d.getFullYear(), d.getMonth() - i, 1).getTime()));
    return out;
  };
  const latestWritable = now => prevMonths(1, now)[0];
  const isWritable = (k, now) => String(k) <= String(latestWritable(now));
  // 下一次开写的时刻 = 下个月 1 号 0 点
  const nextOpenAt = now => { const d = now ? new Date(now) : new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); };
  // 珍藏册按【月份本身】从旧到新铺，不能按“哪张刚生成完”排。补历史月份时，
  // 生成顺序与真实月份不是一回事；月份才是这本册子的时间轴。
  const sortEntries = rows => (Array.isArray(rows) ? rows : []).slice()
    .sort((a, b) => String((a && a.monthKey) || "").localeCompare(String((b && b.monthKey) || "")));

  // ---- 当月素材：单聊 + 单人线下 + 互通群里他说的话 ----
  // arch = { ["c:"+charId]: [...], ["g:"+groupId]: [...] } —— 云端归档，调用方先取好传进来。
  // 必须要它：本地 x_chat 只留最近 150 条，七月那几千条早就归档到云上了，
  // 只读本地就会得出"这个月 0 条"的荒唐结论（她 2026-08-20 江识那次）。
  function monthMaterial(charId, charName, monthKey, uName, groups, arch) {
    const A = arch || {};
    const { start, end } = monthRange(monthKey);
    const inWin = ts => ts != null && ts >= start && ts <= end;
    const rows = [];
    // 用 loadJSON（自带 try/catch，还会先读 IDB 镜像）：以前是裸 JSON.parse，
    // 任何一条记录坏掉就整个函数抛，而补齐外面没有 catch——表现就是"点了没反应"。
    const grab = k => { try { return typeof loadJSON === "function" ? (loadJSON(k, []) || []) : (JSON.parse(localStorage.getItem(k) || "[]") || []); } catch (e) { return []; } };
    const clean = m => {
      if (!m || m.recalled || m.role === "system" || m.kind === "ooc" || m.kind === "silence") return "";
      return String(m.content || "").replace(/\s+/g, " ").trim();
    };
    // 云端归档 + 本地窗口一起过一遍；两边可能有重叠，按消息 id 去重
    const seenId = new Set();
    const eachChat = fn => (A["c:" + charId] || []).concat(grab("x_chat:" + charId)).forEach(m => {
      if (m && m.id) { if (seenId.has(m.id)) return; seenId.add(m.id); }
      fn(m);
    });
    eachChat(m => {
      if (!inWin(m.ts)) return;
      const t = clean(m); if (!t) return;
      rows.push({ ts: m.ts, who: m.role === "user" ? uName : charName, text: t });
    });
    (grab("x_offline:" + charId)).forEach(s => ((s && s.msgs) || []).forEach(m => {
      if (!inWin(m.ts)) return;
      const t = clean(m); if (!t) return;
      rows.push({ ts: m.ts, who: m.role === "user" ? uName : m.role === "narration" ? "【场景】" : charName, text: t });
    }));
    // 群聊也要算（v54.07）：她和顾朝顾暮大半的话是在群里说的，只数单聊会得出"七月没来往"
    // 这个荒唐结论。封闭群（没开记忆互通）不算——记忆不进也不出，和周刊同一条规矩。
    const gset = grab("x_groupSettings") || {};
    (groups || []).forEach(g => {
      if (!g || !(g.memberIds || []).includes(charId)) return;
      if (!(gset[g.id] && gset[g.id].memoryInterop)) return;
      const gSeen = new Set();
      (A["g:" + g.id] || []).concat(grab("x_gchat:" + g.id)).forEach(m => {
        if (m && m.id) { if (gSeen.has(m.id)) return; gSeen.add(m.id); }
        if (!inWin(m.ts)) return;
        const txt = clean(m); if (!txt) return;
        // 群里只取【他和她】两个人的话：别的成员说什么不构成"他眼里的她"
        const isUser = m.role === "user";
        const isHim = m.senderId === charId;
        if (!isUser && !isHim) return;
        rows.push({ ts: m.ts, who: isUser ? uName : charName, text: "【群】" + txt });
      });
    });
    rows.sort((a, b) => a.ts - b.ts);
    return rows;
  }
  // 分来源数一遍：界面上直接显示，省得"明明聊了很多却说没有"只能靠猜（她 2026-08-20 两次撞到）
  function materialBreakdown(charId, charName, monthKey, uName, groups, arch) {
    const rows = monthMaterial(charId, charName, monthKey, uName, groups, arch);
    const g = rows.filter(r => String(r.text).indexOf("【群】") === 0).length;
    let local = 0, cloud = ((arch || {})["c:" + charId] || []).length;
    try { local = (typeof loadJSON === "function" ? (loadJSON("x_chat:" + charId, []) || []) : []).length; } catch (e) {}
    return { total: rows.length, group: g, direct: rows.length - g, chatAll: local + cloud, local, cloud };
  }
  // 他自己说过的话：拿来当声纹样本，quote 才不会写成通用文艺腔
  const ownLines = (rows, charName, turn) => {
    const all = rows.filter(r => r.who === charName && r.text.length >= 6 && r.text.length <= 60).map(r => r.text);
    if (all.length <= 12) return all;
    const step = all.length / 12, off = Number(turn || 0);
    const out = [];
    for (let i = 0; i < 12; i++) out.push(all[Math.floor(i * step + off) % all.length]);
    return [...new Set(out)];
  };
  // 铺开整个月来取样，而不是只截月末那一段（她 2026-08-20：句式在换，榴莲披萨却每次都在）。
  // 两个毛病一起治：
  //   ① 只取尾部 → 每次重写喂进去的原料一模一样，模型只能反复抓同几样东西；
  //   ② 对「月度」印象来说，只看得见月末那几天本来就是错的。
  // 做法：把整月切成若干段，每段各取一点；turn 变化时段内的取样起点跟着挪，
  // 于是重写不只换写法，连看到的素材也换了一批。
  const spread = (rows, budget, turn) => {
    if (!rows.length) return "";
    const line = r => r.who + "：" + r.text;
    const whole = rows.map(line).join("\n");
    if (whole.length <= budget) return whole;
    const SEG = 8, per = Math.floor(budget / SEG);
    const size = Math.ceil(rows.length / SEG);
    const off = Number(turn || 0);
    const out = [];
    for (let i = 0; i < SEG; i++) {
      const seg = rows.slice(i * size, (i + 1) * size);
      if (!seg.length) continue;
      // 段内起点按 turn 挪：同一段里换一批句子给它看
      const start = seg.length > 3 ? (off * 3) % seg.length : 0;
      const picked = seg.slice(start).concat(seg.slice(0, start));
      let used = 0; const buf = [];
      for (const r of picked) { const t = line(r); if (used + t.length > per) break; buf.push(t); used += t.length + 1; }
      if (buf.length) out.push("〔" + new Date(seg[0].ts).getDate() + "号前后〕\n" + buf.join("\n"));
    }
    return out.join("\n\n");
  };

  // ---- 生成 ----
  // ⚠️三个关键词以前定死了槽位（气质/状态/他的私心），结果第三格必然长成「拿她没办法」
  //   「无法计算」——雷同是这条规则自己造出来的。改成给一批取词角度，按期轮换取三个。
  const TAG_ANGLES = [
    "她整个人的气温（冷的暖的、干的润的）", "她给人的质地（软硬、粗细、透不透光）",
    "她身上那种节奏（快慢、松紧、有没有停顿）", "她待着不动时的样子",
    "她最不设防的那一面", "她身上最锋利的那一处", "她让你不安的地方",
    "她身上那种说不通的矛盾", "她在场时屋里的动静（吵、静、哪一种静）", "她这一整个月的底色",
    "旁人看不出、只有你看得见的那层", "你私下给她起的定性（一个名词）"
  ];

  // 句式骰子：光说"别写套路"没用——两个角色照样收敛到同一个架构。
  // 得直接指定这一张【用哪种写法】，把结构本身也掷一次（小剧场那套骰子的同一个道理）。
  // v54.45 池子整体换血（她 2026-08-21 拿别家「初形象生成」对照）：旧池子里
  // 「两个名词相撞不许形容词」「只用否定」这类刻意求怪的面，正是「过载的嗡鸣」
  // 「融化的黄油」的出处。她要的是那种温润流动的【鉴定词】——总意象、两面性格、
  // 一丝反差的余味——所以每一面都改成肖像鉴定的写法，怪腔的面全部退场。
  const QUOTE_FORMS = [
    "开头一句「她是……」的总比喻：把她整个人比作一样有分量的意象（从这个月的记录里长出来，但不叙述那件事），后面接一两个短句，把人从意象里接回来。",
    "写她的两面：既有……的一面，又有……的一面。两面都要落在她本人身上，收尾补一丝和整体基调相反的余味。",
    "只用感官写她给你的整体感觉：质地、声音、气味、重量都行，但每个感官词都得是这个月真在她身上出现过的。",
    "一句「她是……」的私见判断。别人不会这么定义她，但听的人会点头。",
    "不写她是什么，写她让你的世界变成了什么样——语气像承认一件早就知道的事。",
    "写她的「配方」：几样具体的东西加起来才是她，最后一样要出人意料、却最准。",
    "用一种【声音或动静】定义她：她在场时，世界听起来变成什么样。",
    "由远及近：第一句写旁人也看得见的她，第二句写只有你看得见的她。",
    "写她身上那种说不通的矛盾，但语气是欣赏不是拆台——矛盾要落在两样具体的东西上。",
    "她像哪种「放错了地方」的东西——不合时宜，但正因如此才是她。",
    "用一个【动词】定义她：她整个人是一个正在进行的动作，再补一句这个动作落到你身上的感觉。",
    "先立一个符合你身份的判断，再让步：她本该是……，偏偏……。让步的那半句才是真心话。"
  ];

  // 已经被写烂的那个骨架——不点名它，模型每次都会滑回去（民国那次学到的：得指着说）。
  // v54.44 又抓到两族新八股（她 2026-08-21 四张卡对照）：光照比喻三张卡里出现三次、
  // title 全是「定语+的+身份名词」（掌权者/惯犯/扰动源/热源）——高频词得点名整族禁，
  // 只禁单个词它就换个同族词接着写。
  const BANNED_SHAPE = "\n\n【这些骨架已经用烂了，禁止再用】\n"
    + "「我［推演／分析／计算／设想］了很多种…… → 结果她一句话／一个动作 → 我的［逻辑／防线／线路／计划］全部［破产／失效／崩塌／被切断］」\n"
    + "同义改写也算：换成「所有理性」「全部预设」「精密的推演」照样是它。看到自己在写这个句子，推翻重来。\n"
    + "【意象整族禁用】「几点钟的光」「某个季节的光／空气」「晨光」「暖阳」「直射光」这一族光照比喻，"
    + "和「恒温」「热源」「体温」这类温度计词，已经写滥了。除非这个月的记录里真有一件和光或温度直接相关的事，"
    + "否则整族不许碰——她身上还有别的感官可写：声音、重量、质地、气味、速度。\n"
    + "【取名模子也用满了】「不讲理的X」「不按套路的X」（形容词+抽象名词），"
    + "以及「……的……者／家／源／犯／师／体」（定语+的+身份名词，如「温柔的掌权者」「毫无自觉的惯犯」）——"
    + "这两个模子都不许再灌。可以不用「的」，可以用只属于她的词，怪一点没关系，撞模子不行。";
  // 「不够个人化」的病根：不逼它扣住具体的事，它就会写放之四海皆准的漂亮话。
  // 治法和日记那次一样——给一条【可判定】的检验标准，而不是再加一句"要具体"。
  const CONCRETE_RULE = "\n\n【最高优先 · 写「她是什么样的人」，不是「这个月发生了什么」】\n"
    + "下面那段记录是【养料】，不是【题目】。你要从一整个月里提炼出她这个人的样子，"
    + "而不是挑一件事来复述——【quote 里不许出现具体事件的经过】：谁说了什么、哪天做了什么、后来怎么样，一律不要。\n"
    + "· 意象必须【长在真事上】：你想到的比喻、颜色、温度、物件，都得是这个月真的在她身上出现过的东西，"
    + "但落笔时只留那个意象，不交代它从哪来。读的人不知道出处，也该觉得准。\n"
    + "· 【自检】把她换成另一个人——如果这句话照样成立，说明你写的是漂亮话不是她，推翻重写。\n"
    + "· 也别滑到另一头：「温柔又坚强」「像月亮一样」这种谁都能套的词一律不许用。\n"
    + "· 语感的靶子是【温润、流动、一读就懂】：读起来顺口，落在她身上分毫不差。"
    + "不许靠生僻词、硬拗的意象、机械或技术黑话显得特别——怪不是目的，准才是。"
    + "读的人应该先觉得「写得真好」，再觉得「这就是她」。\n"
    + "· 抽象、有意象、可以很文艺——但每一个词都要是你【看着她】才会想到的。\n"
    + "· 这是【一整个月】，不是某一天：别死抓着某一样东西反复用。上面的记录从月初铺到月末，"
    + "你的印象应该是这一整段时间沉下来的，而不是某几句话留下的印子。";
  // 她自己说过的话：给模型一把具体的钩子，quote 才有东西可以扣
  // 她说过的话同理：铺开整月抽，别老盯着最后十四句
  const herLines = (rows, uName, turn) => {
    const all = rows.filter(r => r.who === uName && r.text.length >= 4 && r.text.length <= 50).map(r => r.text);
    if (all.length <= 14) return all;
    const step = all.length / 14, off = Number(turn || 0);
    const out = [];
    for (let i = 0; i < 14; i++) out.push(all[Math.floor(i * step + off) % all.length]);
    return [...new Set(out)];
  };

  const hashOf = str => { let x = 0; String(str || "x").split("").forEach(ch => { x = (x * 31 + ch.charCodeAt(0)) >>> 0; }); return x; };
  // 起点按角色+月份定（同一张卡不会自己重掷），再按 turn【确定性轮转】——
  // 靠哈希碰运气会撞面：turn 0 和 1 抽到同一个写法，重写就等于原地打转（实测撞过）。
  // 轮转保证每重写一次必然换一面，转满一圈才回到起点。
  function pickN(pool, n, seedStr, turn) {
    const base = hashOf(seedStr) % pool.length, step = Number(turn || 0);
    const out = [];
    for (let i = 0; i < n && i < pool.length; i++) out.push(pool[(base + step * n + i) % pool.length]);
    return out;
  }
  async function genText(active, char, profile, monthKey, rows, gazeText, opts) {
    const turn = Number((opts && opts.turn) || 0);
    const seed = String(char.id || char.name) + "|" + monthKey + "|" + turn;
    const form = pickN(QUOTE_FORMS, 1, String(char.id || char.name) + "|" + monthKey + "|form", turn)[0];
    const angles = pickN(TAG_ANGLES, 3, String(char.id || char.name) + "|" + monthKey + "|tag", turn);
    const past = ((opts && opts.past) || []).map(x => String(x || "").trim()).filter(Boolean).slice(0, 6);
    // 别的角色最近写过的卡：跨角色的八股就是这里漏掉的——每个角色第一次写都只避自己的往期，
    // 于是四个角色各自独立地收敛到同一族光照比喻（她 2026-08-21 四张卡对照抓到的）。
    const others = ((opts && opts.others) || []).filter(x => x && (x.quote || x.title)).slice(0, 8);
    const uName = (profile && profile.name) || "她";
    const lines = ownLines(rows, char.name, turn);
    const sys = (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "") + CB()
      + (typeof CHARCARD_RULE !== "undefined" ? CHARCARD_RULE + "\n\n" : "")
      + "你就是「" + char.name + "」本人。现在回望这一个月，写下【" + uName + " 在你眼里是什么样子】。\n"
      + "【你的人设】\n" + String(char.persona || char.name).slice(0, 1600)
      + (gazeText ? "\n\n【你心里对 " + uName + " 已有的长期印象（底子，别推翻，只在它上面往前长一点）】\n" + gazeText : "")
      + (lines.length ? "\n\n【你这个月真的说过的话 · 声纹最高优先】\n" + lines.map((x, i) => (i + 1) + ". " + x).join("\n")
        + "\n这些是你的原话，用来校准词汇、句长、口癖、攻击性与礼貌度。下面写的东西必须是同一个人说的，遮住名字也该认得出。" : "")
      + (herLines(rows, uName, turn).length ? "\n\n【" + uName + " 这个月说过的话 · quote 可以直接扣住其中一句】\n"
        + herLines(rows, uName, turn).map((x, i) => (i + 1) + ". " + x).join("\n") : "")
      + CONCRETE_RULE + BANNED_SHAPE
      + (past.length ? "\n\n【你以往写过的话 · 骨架和料都不许重复】\n" + past.map((x, i) => (i + 1) + ". " + x).join("\n")
        + "\n① 换个说法、换个词、换个角色都不算换骨架——句子的【搭法】必须和上面每一句都不一样。\n"
        + "② 上面那些句子里用过的【具体东西】（食物、物件、地点、那几个字），这一次一个都不许再用。"
        + "这个月还有别的东西可写，去找没被写过的那些。" : "")
      + (others.length ? "\n\n【册子里其他人已经写过的卡 · 撞了就作废】\n"
        + others.map((x, i) => (i + 1) + ". " + [x.title, (Array.isArray(x.tags) ? x.tags : []).join("／"), x.quote].filter(Boolean).join(" ｜ ")).join("\n")
        + "\n这些是别人的卡。它们用过的意象【整族】不许再碰（有一张写了光，光这一族对你就关了；写了温度，温度计那一族也关了）、"
        + "取名的模子不许同型、关键词不许撞。整本册子摊开看，每一张都得长得不一样。" : "")
      + "\n\n【这个月你和 " + uName + " 之间真实发生的事·从月初铺到月末】\n" + (spread(rows, 5200, turn) || "（这个月几乎没有来往。）")
      + "\n\n【要写四样东西】\n"
      + "① title：给这个月的她起一个【类型名】（≤10 字），像给一种人下定义那样——"
      + "「清冷理性的科研学者」就是这个感觉：气质定语＋一个【真实身份】（学者、医生、店主这种真的存在的身份），"
      + "但必须是【你】才会这么定义她。不是外号，不是事件概括，也不是抽象概念拼出来的机器词。\n"
      + "② tags：三个关键词，每个 2~5 个字。这一期【必须】分别从这三个角度取：\n"
      + angles.map((a, i) => "   " + (i + 1) + "）" + a).join("\n")
      + "\n   三个之间不许同义，也不许都在夸她。要抽象、要有气质——「爱吃雪糕」那是事，不是印象。"
      + "词形要顺口：像「静谧慵懒」「知性松弛」那样一读就懂的气质词，不是让人猜的谜语。\n"
      + "③ quote：**你亲口说的**、关于她的话。一段 40~80 字的【鉴定词】，二到三个短句，"
      + "读起来温润流动、有一锤定音的准。别写成通用抒情散文，也别写成人物介绍。"
      + "用「她」称呼她，不要直呼名字。\n"
      + "   【这一张的写法·必须照办】" + form + "\n"
      + "   写法是硬性的：哪怕你觉得别的写法更漂亮，也按这一条来。\n"
      + "④ silhouette：一句【画面描述】，用来画她的剪影。只写：轮廓姿态（侧脸/回头/低头/站着/坐着…）、"
      + "身边有什么意象（月亮、雨、书页、猫、灯、雾…）、以及整体色调冷暖。**不许写五官、不许写表情**——剪影是看不见脸的。"
      + "这是一幅【意象画】，不是生活场景抓拍：别画她在工位吃雪糕这类具体情节，"
      + "要画一个能代表她【整个人】的画面——一个姿态，加一到两样有分量的意象（意象可以从这个月真出现过的东西里取，但不必让人看出出处）；别凭空堆砌月亮和雨；"
      + "整体气质要和你写的那三个关键词对得上——关键词是冷的，画面就不该是暖的。\n"
      + "\n【输出】只输出 JSON，不要代码块：\n"
      + '{"title":"","tags":["","",""],"quote":"","silhouette":""}';
    // maxTokens 2000 真的被打穿过：quote 写到一半被截、宽松解析把半句话捞出来存成了卡
    // （她 2026-08-21「明明每次都被她搅得脑子发懵，但」戛然而止那张）。额度放大之外，
    // 还要用 silhouette 当截断哨兵——它是 JSON 最后一个字段，截断几乎必丢，丢了就报错重试。
    const raw = await callAI(active, sys, [{ role: "user", content: "开始写这个月的印象。" }], { maxTokens: 13000, timeout: 120000 });
    const d = (typeof parseJSONLoose === "function" ? parseJSONLoose(raw) : extractJSON(raw)) || {};
    const tags = (Array.isArray(d.tags) ? d.tags : []).map(x => String(x || "").trim()).filter(Boolean).slice(0, 3);
    const quote = String(d.quote || "").trim();
    if (!quote || !tags.length || !String(d.silhouette || "").trim()) throw new Error("这个月的印象没写全（可能被截断），再试一次");
    return { title: String(d.title || "").trim(), tags, quote, silhouette: String(d.silhouette || "").trim() };
  }

  // 剪影图：艺术插画，不是照片。刻意不给参考照——看不见脸，给了只会让它去画五官。
  // 剪影不能只照着一句场景描述画——那样画出来跟这个月的印象没关系。
  // 把这一期的三个关键词和短称呼一起喂进去：它们才是这张图真正要画的东西（她 2026-08-20 提）。
  async function genArt(desc, profile, mood) {
    const look = String((profile && profile.appearance) || "").slice(0, 120);
    const tags = (mood && Array.isArray(mood.tags) ? mood.tags : []).filter(Boolean);
    const prompt = "一幅【剪影艺术插画】：画面主体是一个人的纯黑剪影，**完全看不见五官、没有脸部细节**，"
      + "只有轮廓与发丝的形状。水墨与水彩晕染的质感，大量留白，像杂志内页的一幅意象插画。\n"
      + (tags.length ? "【这幅画要画出的气质·最重要】" + tags.join("、")
        + (mood && mood.title ? "（一句话概括：" + mood.title + "）" : "")
        + "。姿态、光线、冷暖、留白多少，全部服务于这几个词——画面读起来必须就是这种感觉。\n" : "")
      + "【画面】" + (desc || "一个人的侧影，身后是一轮月亮，冷色调。") + "\n"
      + (look ? "【轮廓参考·只取发型长度与身形，不画五官】" + look + "\n" : "")
      + "【硬性要求】不出现文字、不出现边框、不画成头像或证件照；构图竖幅；整体安静、克制、有留白；"
      + "画面必须是可公开展示的：衣着完整，不露骨。";
    const out = await generateSelfieImage(prompt, null);
    if (!out || !out.blob) throw new Error("剪影没出来");
    const durl = await blobToDataUrl(out.blob);
    return typeof imgToVault === "function" ? await imgToVault(durl) : durl;
  }

  window.Impression = { load, save, materialBreakdown, monthKeyOf, monthLabel, monthRange, prevMonths, latestWritable, isWritable, nextOpenAt, sortEntries, monthMaterial, genText, genArt, uid };
})();

// ============================================================
// 界面：头像墙 → 某个角色的珍藏册 → 单张卡片
// ============================================================
(function () {
  const useState = React.useState;
  const M = window.Impression;

  function ImpressionApp(props) {
    const t = useTheme();
    const uName = (props.profile && props.profile.name) || "我";
    const [book, setBook] = useState(() => M.load());
    const [curChar, setCurChar] = useState(null);
    const [cardId, setCardId] = useState(null);
    const [busy, setBusy] = useState("");
    const backfillLock = React.useRef(false);
    const [backfillState, setBackfillState] = useState(null); // { charId, phase: scan|confirm|run }
    // 云端归档缓存：{ charId: {"c:xx":[...], "g:yy":[...]} }。一个角色只拉一次，
    // 后面写印象、补齐、看素材条数全用这一份——别每次都去云上拉一遍大数组。
    const [archs, setArchs] = useState({});
    const [arching, setArching] = useState(false);
    const archOf = id => archs[id] || null;
    const put = fn => setBook(p => { const n = fn(p); if (M.save(n)) return n; props.toast("这次没保存成功，原印象还在"); return p; });
    // ⚠️imgSrc 不是全局的：它是 theater.js 自己内部声明的（js/theater.js 里那份）。
    // 照抄用法却没带上定义，一进这个页面就 ReferenceError、整个 App 白屏（她 2026-08-20 撞到）。
    const imgSrc = ref => (typeof resolveImg === "function" ? resolveImg(ref) : ref);
    // 头像与存相册照小剧场那套自己实现——components 里那两个不是全局的，拿不到
    const avatarOf = (c, size) => (c && c.avatarImage)
      ? h("img", { src: imgSrc(c.avatarImage), style: { width: size, height: size, borderRadius: 999, objectFit: "cover", display: "block" } })
      : h("div", { style: { width: size, height: size, borderRadius: 999, background: (c && c.color) || "#c2bdb1", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: Math.round(size / 2.4), color: "#fff" } }, String((c && c.name) || "?").slice(0, 1));
    const saveToAlbum = async ref => {
      try {
        let blob = null;
        if (String(ref).indexOf("iv_") === 0 && typeof imgVaultFetchBlob === "function") blob = await imgVaultFetchBlob(ref);
        if (!blob) blob = await (await fetch(imgSrc(ref))).blob();
        const file = new File([blob], "impression_" + Date.now() + ".png", { type: blob.type || "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
        else { window.open(URL.createObjectURL(blob), "_blank"); props.toast("在新页长按图片存储"); }
      } catch (e) { if (!/Abort/i.test(String(e && e.name || e))) props.toast("保存失败"); }
    };
    const listOf = id => M.sortEntries(book[id]);
    // 其他角色最近的卡：当负例喂给生成，跨角色才不会各写各的、结果全撞进同一族光照比喻
    const othersOf = charId => Object.keys(book).filter(k => k !== charId)
      .flatMap(k => book[k] || [])
      .sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 8)
      .map(x => ({ title: x.title, tags: x.tags, quote: x.quote }));

    // ---- 相册那套零件（v61.18，她 2026-09-03：「首页和进去角色页面都还是很普通」）----
    // 判据照旧：这套形状搬到别的功能上还成立吗？不成立才对。
    // 月度印象在现实里是【一本按月贴的剪影相册】——所以列表不是网格，是相册内页：
    // 深色卡纸台面上贴着一张张相纸，四角用相角压住，每张微微歪一点（人手贴的从来不齐），
    // 底下手写月份。空的那格是还没贴上去的相角位，不是一个虚线按钮。
    const MOUNT = "rgba(28,24,20,.90)";          // 卡纸台面（相册内页那块深色底）
    const PAPER = "#f3ece0";                     // 相纸白边
    // 每张歪的角度由序号定死：随机的话每次重画都在动，像页面在抖
    const tilt = i => [-1.6, 1.1, -0.7, 1.8, -1.2, .6][i % 6];
    // 相角：压在相片四角上的那个三角形纸角。⚠️别用「转 45 度的方块」——那样四个角
    //   会从相纸外面支出去，看着是四颗黑菱形，不是相角。用 clipPath 切出真三角，
    //   而且贴在【相片里面】的角上，才是相角压住照片的样子。
    const CLIP = { tl: "polygon(0 0,100% 0,0 100%)", tr: "polygon(100% 0,100% 100%,0 0)",
      bl: "polygon(0 0,0 100%,100% 100%)", br: "polygon(100% 0,100% 100%,0 100%)" };
    const corner = (pos, size) => {
      const st = { position: "absolute", width: size, height: size, clipPath: CLIP[pos],
        background: "linear-gradient(135deg,rgba(58,49,39,.95),rgba(30,25,20,.86))", pointerEvents: "none" };
      st[pos[0] === "t" ? "top" : "bottom"] = 0;
      st[pos[1] === "l" ? "left" : "right"] = 0;
      return h("div", { key: pos, style: st });
    };
    const corners = size => ["tl", "tr", "bl", "br"].map(x => corner(x, size));
    // 一张贴在卡纸上的相纸
    const plate = (opts, inner) => h("div", { style: Object.assign({ position: "relative", background: PAPER,
      padding: opts.edge == null ? 6 : opts.edge, boxShadow: "0 7px 18px rgba(0,0,0,.38)",
      transform: "rotate(" + (opts.deg || 0) + "deg)" }, opts.style || {}) },
      h("div", { style: { position: "relative", width: "100%", aspectRatio: opts.ratio || "3 / 4",
        overflow: "hidden", background: "rgba(20,17,14,.30)" } }, inner, corners(opts.corner || 18)));
    // 相册内页：深色卡纸 + 一点点纸纹（两道极淡的斜光，不是纯色块）
    // 底已经由 S.wrap 一路铺到顶了，这儿只管留白
    const pageStyle = { flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 15px 40px" };
    const handLabel = { fontFamily: "'Noto Serif SC',serif", fontSize: 12.5, color: "rgba(243,236,224,.92)",
      letterSpacing: ".04em" };
    const footNote = { fontFamily: F_BODY, fontSize: 10.5, color: "rgba(243,236,224,.45)", lineHeight: 1.85 };

    const S = {
      // ⚠️台面要一直铺到最顶上（她 2026-09-03：「这背景没延伸到顶部啊」）：
      //   原来只有正文那块是卡纸，顶栏还留在主题米白上，看着像相册上面压了一条白边。
      //   相册就是一整块台面，顶栏只是浮在它上面的一行字。
      wrap: { position: "relative", height: "100%", display: "flex", flexDirection: "column",
        background: MOUNT + " linear-gradient(146deg,rgba(255,255,255,.055),transparent 42%,rgba(0,0,0,.16))",
        backgroundBlendMode: "overlay" },
      btn: on => ({ padding: "6px 12px", borderRadius: 999, border: "1px solid " + (on ? t.accent : "rgba(243,236,224,.34)"),
        background: on ? t.accent : "transparent", color: on ? "#fff" : "rgba(243,236,224,.9)", fontFamily: F_BODY, fontSize: 12 })
    };
    const header = (title, right) => h("div", { style: { flexShrink: 0, display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", paddingTop: safeTop(10), borderBottom: "1px solid rgba(243,236,224,.13)" } },
      h("button", { onClick: back, style: { background: "none", border: "none", color: "rgba(243,236,224,.92)", fontSize: 19, padding: "2px 6px" } }, "←"),
      h("div", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 17, color: "rgba(243,236,224,.95)" } }, title), right || null);
    function back() {
      if (cardId) return setCardId(null);
      if (curChar) return setCurChar(null);
      props.onBack();
    }

    // 拉这个角色的云端归档（本人单聊 + 他在的互通群）。拉不到就退回只用本地，
    // 但要说出来——否则又变成"聊了一整月却说没有"那种查不下去的沉默。
    async function ensureArch(charId) {
      if (archs[charId]) return archs[charId];
      if (!(window.Cloud && window.Cloud.ready && window.Cloud.ready())) return null;
      setArching(true);
      const box = {};
      try { box["c:" + charId] = await window.Cloud.chatArchiveGet(charId) || []; } catch (e) { box["c:" + charId] = []; }
      const gset = (function () { try { return loadJSON("x_groupSettings", {}) || {}; } catch (e) { return {}; } })();
      for (const g of (props.groups || [])) {
        if (!g || !(g.memberIds || []).includes(charId)) continue;
        if (!(gset[g.id] && gset[g.id].memoryInterop)) continue;
        try { box["g:" + g.id] = await window.Cloud.chatArchiveGet("g_" + g.id) || []; } catch (e) { box["g:" + g.id] = []; }
      }
      setArchs(p => Object.assign({}, p, { [charId]: box }));
      setArching(false);
      return box;
    }
    // ---- 生成一个月 ----
    async function make(charId, monthKey, opts) {
      const char = (props.characters || []).find(c => c.id === charId);
      if (!char) return;
      if (!props.active) return props.toast("请先配置线下 API");
      if (!M.isWritable(monthKey)) { props.toast(M.monthLabel(monthKey) + " 还没过完，等下个月 1 号 0 点再写"); return false; }
      const arch = await ensureArch(charId);
      const rows = M.monthMaterial(charId, char.name, monthKey, uName, props.groups, arch);
      if (rows.length < 6) {
        // 报出实际条数：以前只说"几乎没有来往"，她明明聊了很多也不知道是哪一步没数到
        if (!(opts && opts.quiet)) props.toast(M.monthLabel(monthKey) + " 只找到 " + rows.length + " 条你俩的往来（单聊+单人线下+互通群），写不出印象");
        return false;
      }
      setBusy(charId + monthKey);
      try {
        const gazeText = window.Gaze && window.Gaze.text ? String(window.Gaze.text(charId, uName) || "").slice(0, 900) : "";
        const past = (book[charId] || []).filter(x => x.monthKey !== monthKey).map(x => x.quote);
        const d = await M.genText(props.active, char, props.profile, monthKey, rows, gazeText, { turn: 0, past, others: othersOf(charId) });
        let img = null;
        // 图出不来不算失败：字才是主体，剪影可以之后单独补
        try { if (typeof imgApiReady === "function" && imgApiReady()) img = await M.genArt(d.silhouette, props.profile, { tags: d.tags, title: d.title }); }
        catch (e) { props.toast("字写好了，剪影没出来：" + (e.message || "稍后可单独重出")); }
        const entry = { id: M.uid(), monthKey, title: d.title, tags: d.tags, quote: d.quote, silhouette: d.silhouette, img, turn: 0, ts: Date.now() };
        put(p => Object.assign({}, p, { [charId]: [entry].concat((p[charId] || []).filter(x => x.monthKey !== monthKey)) }));
        return true;
      } catch (e) { props.toast("生成失败：" + (e.message || "重试")); return false; }
      finally { setBusy(""); }
    }
    // 只重出剪影，字不动
    async function redrawArt(charId, entry) {
      if (!(typeof imgApiReady === "function" && imgApiReady())) return props.toast("请先配置图像 API");
      setBusy(charId + entry.monthKey);
      try {
        const img = await M.genArt(entry.silhouette, props.profile, { tags: entry.tags, title: entry.title });
        put(p => Object.assign({}, p, { [charId]: (p[charId] || []).map(x => x.id === entry.id ? Object.assign({}, x, { img }) : x) }));
      } catch (e) { props.toast("剪影没出来：" + (e.message || "重试")); } finally { setBusy(""); }
    }
    // 只重写文案，剪影原样留着——出图慢又贵，不该为了换一句话把画也重刷一遍（她 2026-08-20 提）
    async function rewriteText(charId, entry) {
      const char = (props.characters || []).find(c => c.id === charId); if (!char) return;
      if (!props.active) return props.toast("请先配置线下 API");
      setBusy(charId + entry.monthKey);
      try {
        const rows = M.monthMaterial(charId, char.name, entry.monthKey, uName, props.groups, await ensureArch(charId));
        const gazeText = window.Gaze && window.Gaze.text ? String(window.Gaze.text(charId, uName) || "").slice(0, 900) : "";
        // turn+1 = 换一面骰子：不换的话「只重写文案」会拿到同一个写法，等于原地打转
        const turn = Number(entry.turn || 0) + 1;
        // 自己上一版也算"往期"——重写就是为了不要它，别把它再写一遍
        const past = (book[charId] || []).filter(x => x.monthKey !== entry.monthKey).map(x => x.quote).concat([entry.quote]);
        const d = await M.genText(props.active, char, props.profile, entry.monthKey, rows, gazeText, { turn, past, others: othersOf(charId) });
        put(p => Object.assign({}, p, { [charId]: (p[charId] || []).map(x => x.id === entry.id
          ? Object.assign({}, x, { title: d.title, tags: d.tags, quote: d.quote, silhouette: d.silhouette, turn }) : x) }));
        props.toast("换了个写法，剪影没动");
      } catch (e) { props.toast("重写失败：" + (e.message || "重试")); } finally { setBusy(""); }
    }
    // 补齐：最近 12 个月里有素材、却还没写过的，一月一月补（失败即停，已写好的都留着）
    async function backfill(charId) {
      const char = (props.characters || []).find(c => c.id === charId); if (!char) return;
      if (busy || backfillLock.current) return props.toast("正在统计或补齐，别重复点");
      if (!props.active) return props.toast("请先配置线下 API");
      // 从第一下点击就上锁、立刻给回音。原来要先拉完云归档才弹确认，几秒空白里每点一下
      // 都会另开一条异步扫描，最后连续冒出好几个确认框。
      backfillLock.current = true;
      setBackfillState({ charId, phase: "scan" });
      props.toast("正在统计可以补齐的月份…");
      const releaseBackfill = () => { backfillLock.current = false; setBackfillState(null); };
      let want = [];
      // 整段包起来：以前任何一步抛出去，外面没人接，表现就是"点了没反应"
      try {
        const arch = await ensureArch(charId);              // 先把云端归档拉齐，再判断哪些月有素材
        const have = new Set((book[charId] || []).map(x => x.monthKey));
        const all = M.prevMonths(12);                       // 已经过完的 12 个月
        const missing = all.filter(k => !have.has(k));
        want = missing.filter(k => M.monthMaterial(charId, char.name, k, uName, props.groups, arch).length >= 6);
        if (!want.length) {
          // 分清三种"没得补"，别一律一句话打发
          releaseBackfill();
          return props.toast(!missing.length ? "最近一年每个月都写过了"
            : "漏掉的那 " + missing.length + " 个月几乎没有来往，写不出印象");
        }
      } catch (e) { releaseBackfill(); return props.toast("翻旧账的时候出错了：" + (e.message || "未知")); }
      // iOS/PWA 可以永久屏蔽系统 confirm；被屏蔽后它只返回 false，按钮就像完全没点到。
      // 用全 App 自己画的确认层，而且把真正补齐动作放进确认回调——点“开始补齐”后才逐月写。
      setBackfillState({ charId, phase: "confirm" });
      const opened = requestAppConfirm("补齐 " + want.length + " 个月？", "会一个月一个月写，中途失败前面的都保留。", async () => {
        setBackfillState({ charId, phase: "run" });
        try {
          want.reverse();
          let done = 0;
          for (const k of want) {
            const ok = await make(charId, k, { quiet: true });
            if (!ok) { props.toast("补到 " + M.monthLabel(k) + " 时停下了，已写好 " + done + " 个"); return; }
            done++; props.toast("已补 " + done + "/" + want.length, 1200);
          }
          props.toast("补齐了 " + done + " 个月");
        } finally { releaseBackfill(); }
      }, "开始补齐", releaseBackfill);
      if (!opened) releaseBackfill();
    }

    // ---- 单张卡片 ----
    if (cardId && curChar) {
      const e = listOf(curChar).find(x => x.id === cardId);
      const c = (props.characters || []).find(x => x.id === curChar) || {};
      if (!e) { setCardId(null); return null; }
      // 编号＝这本册子里的第几张（按月份从旧到新，跟珍藏册那页铺的顺序一致）
      const idxOf = listOf(curChar).findIndex(x => x.id === e.id);
      return h("div", { style: S.wrap }, header(M.monthLabel(e.monthKey)),
        h("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 18px 40px" } },
          // 这一张是【从册子上取下来的那张相纸】（v61.26，她 2026-09-03：「点进卡里面还是白的，
          // 卡片要不要也做点装饰」）。原来是一块 t.bg2 的白圆角——白得像个弹窗，
          // 跟外面那本相册不是一件东西。现在：相纸本身泛旧（四角压暖压深，不是纯白）、
          // 上边斜贴一条胶带、下半张白边上有铅笔写的编号和月份。
          h("div", { style: { position: "relative", marginTop: 12, background: PAPER,
            backgroundImage: "radial-gradient(120% 90% at 50% 0,rgba(255,255,255,.55),transparent 55%),"
              + "radial-gradient(80% 60% at 8% 100%,rgba(146,116,72,.16),transparent 60%),"
              + "radial-gradient(80% 60% at 96% 6%,rgba(146,116,72,.13),transparent 62%)",
            padding: 9, boxShadow: "0 16px 40px rgba(0,0,0,.42)", transform: "rotate(-.5deg)" } },
            // 胶带：斜贴在上边缘，压住相纸和台面的交界——这就是它在册子上的贴法
            h("div", { style: { position: "absolute", top: -13, left: "50%", width: 104, height: 26,
              transform: "translateX(-58%) rotate(-3.4deg)", background: "rgba(226,214,186,.62)",
              borderLeft: "1px dashed rgba(255,255,255,.5)", borderRight: "1px dashed rgba(255,255,255,.5)",
              boxShadow: "0 2px 6px rgba(0,0,0,.22)", pointerEvents: "none" } }),
            h("div", { style: { position: "relative", width: "100%", aspectRatio: "3 / 4", background: "rgba(20,17,14,.24)" } },
              e.img ? h("img", { src: imgSrc(e.img), style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } })
                : h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: 12, color: "rgba(243,236,224,.6)", textAlign: "center", padding: 20 } }, "还没有剪影"),
              // 这张也压四个相角，和珍藏册那一页是同一本册子里的东西（v61.22）
              corners(22),
              // 三个关键词照「初形象生成」那套挂：白点＋细线＋金边小签，点朝画面里侧
              h("div", { style: { position: "absolute", inset: 0, pointerEvents: "none" } },
                (e.tags || []).slice(0, 3).map((tag, i) => {
                  const onLeft = i === 1;
                  const dot = h("div", { key: "d", style: { width: 9, height: 9, borderRadius: 999, background: "#fff", boxShadow: "0 0 0 7px rgba(255,255,255,.26)", flexShrink: 0 } });
                  const line = h("div", { key: "l", style: { width: 20, height: 1, background: "rgba(255,255,255,.85)", flexShrink: 0 } });
                  const chip = h("div", { key: "c", style: { background: "rgba(97,84,56,.86)", border: "1px solid rgba(246,239,226,.55)",
                    color: "#f6efe2", padding: "5px 13px", borderRadius: 999, fontFamily: F_BODY, fontSize: 12.5,
                    letterSpacing: ".06em", whiteSpace: "nowrap", backdropFilter: "blur(2px)" } }, tag);
                  return h("div", { key: i, style: { position: "absolute", top: [24, 49, 74][i] + "%", [onLeft ? "left" : "right"]: "5%",
                    display: "flex", alignItems: "center", gap: 7 } },
                    onLeft ? [chip, line, dot] : [dot, line, chip]);
                }))),
            h("div", { style: { padding: "16px 12px 14px", position: "relative" } },
              // 相纸下半张那道白边：左边铅笔写的编号和月份，右边这一册的名字
              // ⚠️两边都得 nowrap：这一行是相纸下沿【铅笔写的一行小字】，
              // 断成两行就不是一行小字了（她 2026-09-03 截图：右边那句折成了两行）。
              // 窄机上宁可字距收窄，也不许换行——所以右边这句字号和字距都压了一档。
              h("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8,
                paddingBottom: 11, marginBottom: 13, borderBottom: "1px solid rgba(120,100,72,.20)" } },
                h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 13, color: "rgba(64,54,42,.86)", letterSpacing: ".04em", whiteSpace: "nowrap", flexShrink: 0 } },
                  "No. " + String(idxOf + 1).padStart(2, "0") + "　" + M.monthLabel(e.monthKey)),
                h("div", { style: { fontFamily: F_BODY, fontSize: 8.5, letterSpacing: ".22em", color: "rgba(120,100,72,.55)", textIndent: ".22em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "clip" } }, "印象变了哪儿")),
              e.title ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: "rgba(43,36,28,.95)", textAlign: "center", marginBottom: 14, letterSpacing: ".06em" } }, "{ " + e.title + " }") : null,
              h("div", { style: { position: "relative", padding: "2px 14px" } },
                h("div", { style: { fontFamily: "Georgia,'Noto Serif SC',serif", fontSize: 36, lineHeight: 1, color: "rgba(120,100,72,.5)" } }, "“"),
                h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 15, lineHeight: 2.1, color: "rgba(43,36,28,.95)", textAlign: "center", padding: "0 6px" } }, e.quote),
                h("div", { style: { fontFamily: "Georgia,'Noto Serif SC',serif", fontSize: 36, lineHeight: 1, color: "rgba(120,100,72,.5)", textAlign: "right" } }, "”")),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(94,79,58,.8)", textAlign: "right", marginTop: 10 } }, "—— " + (c.name || "TA") + " 眼里的 " + uName))),
          h("div", { style: { display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "center" } },
            e.img ? h("button", { onClick: () => saveToAlbum(e.img), style: S.btn(false) }, "保存到相册") : null,
            h("button", { onClick: () => rewriteText(curChar, e), disabled: !!busy, style: S.btn(false) }, busy ? "在写…" : "只重写文案"),
            h("button", { onClick: () => redrawArt(curChar, e), disabled: !!busy, style: S.btn(false) }, busy ? "在画…" : (e.img ? "只重出剪影" : "补一张剪影")),
            h("button", { onClick: () => requestAppConfirm("删掉这个月的印象？", "删除后不能恢复。", () => { const next = Object.assign({}, book, { [curChar]: (book[curChar] || []).filter(x => x.id !== e.id) }); if (!M.save(next)) return props.toast("这次没删成功，原印象还在"); setBook(next); setCardId(null); }, "删除"), style: Object.assign({}, S.btn(false), { color: "#a4442e" }) }, "删除"))));
    }

    // ---- 某个角色的珍藏册：一本按月贴的相册 ----
    if (curChar) {
      const c = (props.characters || []).find(x => x.id === curChar) || {};
      // 一进来就把云端归档拉好：不然那行素材统计报的是本地窗口的数，等于继续误导
      if (!archs[curChar] && !arching) ensureArch(curChar);
      const mine = listOf(curChar);
      // 能写的是【上个月】：本月还在过，写不出"这个月你是什么样"
      const openMonth = M.latestWritable();
      const hasThis = mine.some(x => x.monthKey === openMonth);
      const openAt = new Date(M.nextOpenAt());
      // 空相角位：这个月还没贴上去的那一格。它长得就是「一张相片该在的地方」，
      // 不是一个虚线按钮——按钮换个功能照样成立，这一格不行。
      // 已经贴上去的月份不再多摆一个空位——那张相片就在这一页上，摆两次等于自己骗自己。
      const emptySlot = hasThis ? null : h("div", { onClick: () => make(curChar, openMonth),
        style: { position: "relative", width: "calc((100% - 26px) / 2)", cursor: "pointer" } },
        h("div", { style: { position: "relative", width: "100%", aspectRatio: "3 / 4",
          border: "1px dashed rgba(243,236,224,.30)", display: "flex", alignItems: "center", justifyContent: "center",
          textAlign: "center", padding: 12, fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.8,
          color: "rgba(243,236,224,.62)" } },
          busy ? "在写…" : "贴上 " + M.monthLabel(openMonth) + "的那一张",
          corners(15)),
        h("div", { style: Object.assign({}, handLabel, { marginTop: 8, color: "rgba(243,236,224,.55)" }) },
          M.monthLabel(openMonth)));
      return h("div", { style: S.wrap },
        header((c.name || "?") + " 眼里的 " + uName,
          h("button", { onClick: () => backfill(curChar), disabled: !!busy || !!backfillState, style: S.btn(false) },
            backfillState && backfillState.charId === curChar
              ? (backfillState.phase === "scan" ? "统计中…" : backfillState.phase === "confirm" ? "待确认…" : "补齐中…") : "补齐")),
        h("div", { style: pageStyle },
          h("div", { style: { display: "flex", flexWrap: "wrap", gap: "26px 26px", alignItems: "flex-start" } },
            mine.map((e, i) => h("div", { key: e.id, onClick: () => setCardId(e.id),
              style: { width: "calc((100% - 26px) / 2)" } },
              plate({ deg: tilt(i), corner: 15 },
                e.img ? h("img", { src: imgSrc(e.img), style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } })
                  : h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: F_BODY, fontSize: 11, color: "rgba(243,236,224,.55)" } }, "只有字")),
              h("div", { style: Object.assign({}, handLabel, { marginTop: 9 }) }, M.monthLabel(e.monthKey)),
              // 三个词写成相片底下那行铅笔小字，不是一排药丸
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "rgba(243,236,224,.55)", marginTop: 2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                (e.tags || []).slice(0, 3).join(" · ") || e.title || ""))),
            emptySlot),
          // 页脚：本月为什么还不能写 + 素材数，压在页面最底下，像相册页边上的铅笔注记
          h("div", { style: { marginTop: 26, paddingTop: 14, borderTop: "1px solid rgba(243,236,224,.14)" } },
            h("div", { style: footNote },
              "本月还在过，写不出这个月你是什么样。" + (openAt.getMonth() + 1) + " 月 1 日 0 点开写。"),
            (function () {
              if (arching && !archs[curChar]) return h("div", { style: footNote }, "正在拉云端归档…");
              let b = null;
              try { b = M.materialBreakdown(curChar, c.name, openMonth, uName, props.groups, archOf(curChar)); } catch (e) { return null; }
              const cloudOk = !!archs[curChar];
              return h("div", { style: footNote },
                M.monthLabel(openMonth) + "素材：单聊+线下 " + b.direct + " 条 · 群 " + b.group + " 条",
                h("br"),
                "（记录共 " + b.chatAll + " 条：本地 " + b.local + " · 云端归档 " + b.cloud + "）",
                cloudOk ? null : h("span", null, h("br"), "⚠️云端归档没拉到，只数了本地那 " + b.local + " 条——旧消息都在云上"));
            })(),
            mine.length ? null : h("div", { style: Object.assign({}, footNote, { marginTop: 6 }) },
              "这本还是空的。写一个月看看，或者点右上角补齐。"))));
    }

    // ---- 头像墙：一摞一摞的相片，谁的厚就是谁攒得多 ----
    return h("div", { style: S.wrap }, header("月度印象"),
      h("div", { style: pageStyle },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(243,236,224,.62)", lineHeight: 1.9, marginBottom: 20 } },
          "每个月，每个人眼里的你长得都不一样。", h("br"), "一张剪影、三个词、一句他亲口说的话。"),
        (props.characters || []).length ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: "30px 22px", alignItems: "flex-start" } },
          (props.characters || []).map((c, i) => {
            const n = (book[c.id] || []).length;
            // 珍藏册正文从旧到新铺；封面仍取最近那张，不能因为展示顺序改了就倒回最老月份。
            const cover = listOf(c.id).slice().reverse().find(x => x.img);
            // 叠得多厚＝攒了几个月。这一层不是装饰：它把「n 个月」这件事画了出来，
            // 所以底下那行不必再重复报数，只写名字和月份数就够。
            const depth = Math.min(3, n);
            const back = [];
            for (let k = depth; k >= 1; k--) back.push(h("div", { key: k, style: { position: "absolute",
              inset: 0, background: PAPER, opacity: .5 + .15 * (depth - k), borderRadius: 1,
              transform: "rotate(" + (k % 2 ? -1 : 1) * (2.4 + k * 2.2) + "deg) translateY(" + (k * 2.5) + "px)",
              boxShadow: "0 4px 12px rgba(0,0,0,.3)" } }));
            return h("div", { key: c.id, onClick: () => setCurChar(c.id),
              style: { width: "calc((100% - 44px) / 3)", textAlign: "center" } },
              h("div", { style: { position: "relative" } },
                back,
                plate({ deg: tilt(i), corner: 13, ratio: "1 / 1" },
                  cover ? h("img", { src: imgSrc(cover.img), style: { width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: .55 } }) : null,
                  h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" } },
                    avatarOf(c, 44)))),
              h("div", { style: Object.assign({}, handLabel, { marginTop: 10, fontSize: 12, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }) }, c.name),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: "rgba(243,236,224,.5)", marginTop: 1 } },
                n ? n + " 个月" : "还没有"));
          }))
          : h("div", { style: { textAlign: "center", marginTop: 70, fontFamily: F_BODY, fontSize: 13, color: "rgba(243,236,224,.6)" } }, "还没有角色。")));
  }
  window.ImpressionApp = ImpressionApp;
})();
