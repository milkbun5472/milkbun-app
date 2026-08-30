// ============================================================
// 跑团（trpg）—— 文字跑团 / TTRPG
// Lisa(玩家) + 至多 4 名角色队友 + 模型当守密人(GM)。
// 参考 ai-virtual-phone 的冒险玩法【思路】(不复制其 AGPL 代码):
//   · 骰子全部由客户端掷(d100 五档),模型只能给选项挂检定,绝不自己编骰子结果——
//     和小剧场取景骰子同一课:客户端真随机压得住语料先验,模型自称的随机压不住。
//   · GM 秘典(隐藏真相/伏笔/转折/结局方向)开团即生成,结局落幕后才解密给玩家看。
//   · 状态(HP/物品/线索/章节)走【结构化 JSON 字段+名字校验】才落账,不从散文里
//     用正则抠——那是参考项目状态漂移的病根;章节进度只有一个计数器。
//   · 每拍 GM 消息带一份小状态快照,从任意一拍分支回溯时按快照恢复,不会带错账。
// 成本:一回合只打一次 GM 调用(守密人叙事并代入全部队友),不做每回合 1+N 次
//   调用——她按次计费。言秋在队里时,他那一句先走 CC 亲笔票(同小剧场管道)。
// 完全沙箱(四处一样喂·合法差异,同小剧场先例):平行时空,只读人设,不读写主线
//   记忆/世界书/好感/心情;数据只存 x_trpg(跟随 x_ 前缀整包云同步)。
// ============================================================
(function () {
  // node --test 会直接 require 这份文件跑纯函数,那边没有 React/window——顶层一律守卫
  const inApp = typeof window !== "undefined" && typeof React !== "undefined";
  const useState = inApp ? React.useState : null, useRef = inApp ? React.useRef : null, useEffect = inApp ? React.useEffect : null, useMemo = inApp ? React.useMemo : null;
  // 图标:一枚二十面骰(六边形 + 内三角),挂进 REG 的 window.GTrpg
  if (inApp) window.GTrpg = p => h(Svg, p, h("path", { d: "M12 2.4l8.3 4.8v9.6L12 21.6l-8.3-4.8V7.2z" }), h("path", { d: "M12 7.4l4.6 7.8H7.4z" }), h("path", { d: "M12 2.4v5M3.7 7.2l3.7 8M20.3 7.2l-3.7 8M12 21.6l-4.6-6.4M12 21.6l4.6-6.4" }));

  const load = () => {
    try {
      const list = JSON.parse(localStorage.getItem("x_trpg") || "[]");
      // v57.17 物品升格 {name,holder,n}:老存档(含每拍快照里的)读到就地修,不另跑迁移
      let changed = false;
      const fixed = (Array.isArray(list) ? list : []).map((c, i) => {
        const needTop = (c.items || []).some(x => typeof x === "string");
        const needSnap = (c.msgs || []).some(m => m.snap && (m.snap.items || []).some(x => typeof x === "string"));
        // v57.21:老团的成员补发命运点(按气运),没有的字段一律给默认
        const needFate = (c.party || []).some(m => m.fate == null);
        const needSquad = !c.squadId;
        // v58.51:更老的存档压根没有 id。列表用 key: c.id 渲染,几个团的 key 全是 undefined,
        // React 就会把节点认成同一个 —— 点甲的 ✕,弹的是乙的标题、删掉的是乙。
        // 她 2026-08-30:「跑团旧版的 x 没用删除不了」。所以读进来就把 id 补齐。
        const needId = !c.id;
        if (!needTop && !needSnap && !needFate && !needSquad && !needId) return c;
        changed = true;
        return Object.assign({}, c, {
          id: c.id || ("rpg_old" + i + "_" + (c.createdAt || Date.now())),   // 同一毫秒补好几个,带上下标才不会撞
          squadId: c.squadId || "sq_legacy",
          items: itemsFix(c.items),
          party: (c.party || []).map(m => m.fate == null ? Object.assign({}, m, { fate: fateOf(m.stats && m.stats.luck) }) : m),
          msgs: (c.msgs || []).map(m => m.snap ? Object.assign({}, m, { snap: Object.assign({}, m.snap, { items: itemsFix(m.snap.items) }) }) : m)
        });
      });
      if (changed) lsWrite("x_trpg", fixed, "跑团存档");
      return fixed;
    } catch (e) { return []; }
  };
  // 所有写盘走这一个口子。原来每处都是 try{setItem}catch(e){} —— 写不进去【一声不吭】,
  // 界面上那个团当场消失了,重开又原样回来,看起来就是「怎么都删不掉」
  //(她 2026-08-30 报了两轮:补完 id 之后还是删不掉)。两种写不进去的情况:
  //   ① localStorage 满了(她那台常年贴着 5MB)。删团是【变小】的写,把旧的整份先挪走
  //     再写就落得下去;万一还是失败,原样放回去,绝不把一整份存档写没了。
  //   ② 云端恢复的冻结期:cloud.js 会把 x_ 开头的写【直接丢掉】,这时候只能等。
  // 写完读回来核一遍:没落下去就说清楚是哪一种,而不是让她以为删掉了。
  function lsWrite(key, value, zh) {
    var s = JSON.stringify(value);
    var old = null;
    try { old = localStorage.getItem(key); } catch (e) {}
    if (old === s) return true;
    try { localStorage.setItem(key, s); } catch (e) {
      try { localStorage.removeItem(key); localStorage.setItem(key, s); }
      catch (e2) {
        if (old != null) { try { localStorage.setItem(key, old); } catch (e3) {} }   // 放回去,别把整份弄丢
        trpgWriteFail(zh, "存储写满了——去 设置·数据管理 清一清再来");
        return false;
      }
    }
    var back = null;
    try { back = localStorage.getItem(key); } catch (e) {}
    if (back !== s) { trpgWriteFail(zh, "这一步没存下来(多半是云端正在恢复,等它做完再试)"); return false; }
    return true;
  }
  // 写失败要说出来。toast 在组件里,这里用一个全局挂钩转一下
  function trpgWriteFail(zh, why) {
    var msg = (zh ? zh + "没保存成功:" : "没保存成功:") + why;
    try { if (typeof window !== "undefined" && typeof window.__trpgToast === "function") window.__trpgToast(msg, 7000); } catch (e) {}
    try { console.error("trpg 写盘失败:", msg); } catch (e) {}
  }
  const persist = list => lsWrite("x_trpg", list, "这场跑团");
  const rid = pre => pre + Date.now() + "_" + Math.random().toString(36).slice(2, 6);

  // 面板每一块都能收起来(她 2026-08-30:「每一个都做可缩放吧,除了旅程队伍默认收起来」)。
  // 默认摊开的只有这两块——一进来先看见走到哪儿了、队伍还剩多少血;别的按需要再翻。
  const PANEL_OPEN_BY_DEFAULT = ["旅程", "队伍"];
  const loadPanelShut = () => { try { const v = JSON.parse(localStorage.getItem("x_trpgPanelShut") || "null"); return (v && typeof v === "object") ? v : {}; } catch (e) { return {}; } };

  // ---- 桌面(纯函数) ----
  // 一场跑团是在桌上发生的:羊皮纸、方格坐标纸、四边被灯压暗。
  // 灯的冷暖跟着守密人报的时辰走(camp.time.part)——晨昏暖、入夜冷,不是随便套个滤镜。
  const TRPG_HOUR = {
    //            那盏灯的暖              远处的冷            格子深浅  纸底(越晚越沉) 压边
    "晨":   { warm: "rgba(226,166,96,.30)",  cool: "rgba(126,150,160,.10)", ink: .030, paper: ["#f4eee0", "#ece5d4", "#e0d8c6"], dark: .13 },
    "昼":   { warm: "rgba(232,196,120,.22)", cool: "rgba(126,150,160,.07)", ink: .026, paper: ["#f2ece0", "#eae3d5", "#ded6c6"], dark: .12 },
    "午":   { warm: "rgba(232,196,120,.22)", cool: "rgba(126,150,160,.07)", ink: .026, paper: ["#f2ece0", "#eae3d5", "#ded6c6"], dark: .12 },
    "暮":   { warm: "rgba(206,102,56,.34)",  cool: "rgba(86,96,132,.18)",   ink: .034, paper: ["#eee2cf", "#e6d9c4", "#d8c9b3"], dark: .20 },
    "夜":   { warm: "rgba(206,140,66,.20)",  cool: "rgba(52,70,116,.34)",   ink: .046, paper: ["#e4e0da", "#dcd8d2", "#cfccc7"], dark: .26 },
    "深夜": { warm: "rgba(196,130,60,.16)",  cool: "rgba(40,56,102,.42)",   ink: .052, paper: ["#dedbd7", "#d6d3d0", "#c9c7c4"], dark: .31 }
  };
  function trpgHour(part) {
    const k = String(part || "").trim();
    return TRPG_HOUR[k] || TRPG_HOUR["昼"];
  }
  function trpgDeskBg(part) {
    const H = trpgHour(part);
    const line = "rgba(70,56,38," + H.ink + ")";
    return [
      // 灯:一头暖一头冷,按时辰配——晨昏偏暖,入夜整张桌子转冷
      "radial-gradient(88% 52% at 12% -6%, " + H.warm + ", transparent 62%)",
      "radial-gradient(84% 54% at 104% 96%, " + H.cool + ", transparent 68%)",
      // 四边压暗——桌上只有一盏灯,越晚压得越狠
      "radial-gradient(124% 82% at 50% 40%, rgba(46,38,28,0) 38%, rgba(46,38,28," + H.dark + ") 100%)",
      // GM 的方格坐标纸(24px 一格)
      "repeating-linear-gradient(0deg, " + line + " 0px, " + line + " 1px, transparent 1px, transparent 24px)",
      "repeating-linear-gradient(90deg, " + line + " 0px, " + line + " 1px, transparent 1px, transparent 24px)",
      // 羊皮纸的斜纹和底
      "repeating-linear-gradient(58deg, rgba(255,255,255,.22) 0px, rgba(255,255,255,.22) 1px, transparent 1px, transparent 11px)",
      "linear-gradient(168deg, " + H.paper[0] + " 0%, " + H.paper[1] + " 48%, " + H.paper[2] + " 100%)"
    ].join(", ");
  }

  // ---- 属性与骰子(纯函数,供 node --test 直接跑) ----
  const STATS = [["phy", "体魄"], ["agi", "身手"], ["wit", "头脑"], ["cha", "谈吐"], ["luck", "气运"]];
  const STAT_ZH = STATS.reduce((m, [k, zh]) => (m[k] = zh, m), {});
  // 3d6×5 → 15~90;跑团属性是沙箱里的游戏数值,和主线状态卡无关
  const d6 = rand => 1 + Math.floor(rand() * 6);
  function rollStats(rand) {
    rand = rand || Math.random;
    const out = {};
    STATS.forEach(([k]) => { out[k] = (d6(rand) + d6(rand) + d6(rand)) * 5; });
    return out;
  }
  // 队友属性按人设文本轻推 ±10:让「常年习武」的真的身手好一点。
  // 只是调味,不追求全面——匹配不到就原样,绝不因此砍谁的数值下限。
  // 单字词(快/嘴/舞/盗)全部踢掉了:「快乐」「鼓舞」都会误中;词要长到不至于撞衫。
  const NUDGE = [
    ["phy", /习武|武艺|体力好|强壮|力气大|军人|士兵|猎人|铁匠|健壮|运动/],
    ["agi", /轻功|敏捷|灵活|身手|刺客|舞者|善舞|神偷|矫健|手快/],
    ["wit", /聪明|智谋|学者|谋士|研究|推理|博学|军师|策士|工程|医术|饱读/],
    ["cha", /口才|能言善辩|魅力|交际|谈判|商人|外交|圆滑|嘴甜|健谈/],
    ["luck", /幸运|福星|运气好/]
  ];
  const NUDGE_DOWN = [
    ["phy", /体弱|病弱|孱弱|文弱/],
    ["agi", /笨拙|迟钝|腿脚不便/],
    ["cha", /寡言|孤僻|不善言辞|嘴笨|怯于交际/]
  ];
  // 否定窗口(Codex 抓的:「不擅长交际」以前反而给谈吐 +10)。
  // 每处命中回看前 6 个字,踩到否定词就把这处「长处」当短板记。
  const NEG_RE = /不|没|从未|并非|别提|怕|讨厌|厌恶|拙于|难以|谈不上/;
  function nudgeHits(text, re) {
    const g = new RegExp(re.source, "g");
    let m, pos = 0, neg = 0;
    while ((m = g.exec(text))) {
      if (NEG_RE.test(text.slice(Math.max(0, m.index - 6), m.index))) neg++; else pos++;
      if (g.lastIndex === m.index) g.lastIndex++;
    }
    return { pos, neg };
  }
  function personaNudge(stats, personaText) {
    const t = String(personaText || "");
    const out = Object.assign({}, stats);
    STATS.forEach(([k]) => {
      const up = NUDGE.find(x => x[0] === k), down = NUDGE_DOWN.find(x => x[0] === k);
      const u = up ? nudgeHits(t, up[1]) : { pos: 0, neg: 0 };
      const d = down ? nudgeHits(t, down[1]) : { pos: 0, neg: 0 };
      let delta = 0;
      if (u.pos > 0) delta += 10;
      if (u.neg > 0 || d.pos > 0) delta -= 10;  // 被否定的长处=短板;短板词本身也算
      if (d.neg > 0 && d.pos === 0) delta += 10; // 「并非笨拙」这种双重否定按长处算
      out[k] = Math.max(15, Math.min(90, out[k] + delta));
    });
    return out;
  }
  // d100 对抗属性值:≤1/5 大成功;>95 大失败;≤1/2 困难成功;≤属性 成功;否则失败。
  // 大失败判定放在大成功之后:属性再高,96+ 也翻车——没有稳赢的检定才有戏。
  function gradeCheck(roll, stat) {
    stat = Math.max(1, Math.min(99, Number(stat) || 1));
    if (roll <= Math.max(1, Math.floor(stat / 5))) return { tier: "crit", zh: "大成功" };
    if (roll > 95) return { tier: "fumble", zh: "大失败" };
    if (roll <= Math.floor(stat / 2)) return { tier: "hard", zh: "困难成功" };
    if (roll <= stat) return { tier: "ok", zh: "成功" };
    return { tier: "fail", zh: "失败" };
  }

  // ---- 对抗骰/伤害骰/两张表(纯函数) ----
  // 对抗:双方各掷各判五档,档高者胜;同档骰点小者胜(掷得低=发挥好);再平守方胜——
  // 进攻方要赢就得真赢,不给和稀泥的平局
  const TIER_RANK = { crit: 4, hard: 3, ok: 2, fail: 1, fumble: 0 };
  function decideOpposed(ourGrade, ourRoll, theirGrade, theirRoll) {
    const a = TIER_RANK[ourGrade.tier], b = TIER_RANK[theirGrade.tier];
    if (a !== b) return a > b ? "win" : "lose";
    if (ourRoll !== theirRoll) return ourRoll < theirRoll ? "win" : "lose";
    return "lose";
  }
  // 伤害骰 d20 的轻重口径(写给守密人,也写给玩家看)
  const harmZh = d => d >= 20 ? "几乎致命" : d >= 13 ? "重创" : d >= 6 ? "结结实实" : "擦伤";
  // 重伤表:HP 见底那一刻客户端直接掷,变成带后遗症的状态(scar 会跟着老卡进下一团)
  const POOL_WOUND = [
    { name: "断了肋骨", note: "牵扯就疼,使不上大力" },
    { name: "腿上重伤", note: "赶路慢半拍,身手吃紧" },
    { name: "头部重击", note: "时不时眩晕,记不清事" },
    { name: "手臂骨折", note: "只剩一只手能用" },
    { name: "深创未愈", note: "一动就可能再裂开" },
    { name: "失血过多", note: "脸色惨白,久站发虚" }
  ];
  // 失控表:理智/压力类状态条触底时掷(挂在玩家身上,不留疤,团内有效)
  const POOL_BREAK = [
    { name: "歇斯底里", note: "压不住声音和手抖" },
    { name: "僵住", note: "关键时刻动不了" },
    { name: "逃避现实", note: "坚信刚才没发生" },
    { name: "偏执", note: "觉得有人瞒着自己" },
    { name: "暴怒", note: "先动手后讲理" },
    { name: "麻木", note: "对危险失去反应" }
  ];
  // 落幕成长骰(COC 式):这团用过且【成功过】的属性才有资格长——掷 d100 高于现值
  // 才 +5(越强越难再长),封顶 90。rolls 来自骰子账的结构化记录 {who,statKey,tier}。
  function growthRolls(party, rollRecs, rand) {
    rand = rand || Math.random;
    const out = [];
    party.forEach(m => {
      const okStats = {};
      (rollRecs || []).forEach(r => { if (r.who === m.name && TIER_RANK[r.tier] >= 2 && STAT_ZH[r.statKey]) okStats[r.statKey] = 1; });
      Object.keys(okStats).forEach(k => {
        const cur = m.stats[k];
        if (cur >= 90) return;
        const roll = 1 + Math.floor(rand() * 100);
        if (roll > cur) out.push({ name: m.name, key: m.key, stat: k, from: cur, to: Math.min(90, cur + 5), roll });
        else out.push({ name: m.name, key: m.key, stat: k, from: cur, to: cur, roll });
      });
    });
    return out;
  }

  // ---- 回合协议(纯函数) ----
  // 名字校验:先全等,再互相包含;都对不上就丢弃——绝不把伤害安到不存在的人头上,
  // 也绝不猜。参考项目的教训:模糊正则落账,一个同义词就静默丢效果或安错人。
  const findMember = (party, name) => {
    const n = String(name || "").trim();
    if (!n) return null;
    return party.find(m => m.name === n)
      || party.find(m => m.name && (n.indexOf(m.name) >= 0 || m.name.indexOf(n) >= 0))
      || null;
  };
  // 选项归一:字符串也收("text" 对象也收);check.stat 必须是五维之一,who 必须在队;
  // 不合法的部分【只丢那一部分】,选项文本还在——选项废了这一回合就没路走了。
  function normChoices(arr, party) {
    return (Array.isArray(arr) ? arr : []).slice(0, 4).map(c => {
      if (typeof c === "string") return { text: c.trim(), check: null, need: null };
      if (!c || typeof c !== "object") return null;
      const text = String(c.text || c.label || "").trim();
      if (!text) return null;
      let check = null;
      const rawCheck = c.check && typeof c.check === "object" ? c.check : null;
      if (rawCheck && STAT_ZH[rawCheck.stat]) {
        const who = rawCheck.who ? findMember(party, rawCheck.who) : null;
        // vs=对抗骰(对面的名字与本事值),bargain=魔鬼交易开价,harm=会见血(补伤害骰);
        // 哪部分不合法就只丢哪部分,检定本体还在
        let vs = null;
        if (rawCheck.vs && typeof rawCheck.vs === "object" && String(rawCheck.vs.name || "").trim()) {
          const v = Math.round(Number(rawCheck.vs.val));
          if (v) vs = { name: String(rawCheck.vs.name).trim().slice(0, 8), val: Math.max(20, Math.min(90, v)) };
        }
        check = { stat: rawCheck.stat, who: who ? who.name : null, feat: String(rawCheck.feat || "").trim().slice(0, 6) || null, vs, bargain: String(rawCheck.bargain || "").trim().slice(0, 24) || null, harm: rawCheck.harm === true };
      }
      const need = itemNameNorm(c.need) || null; // 收进来就剥掉持有人/数量尾巴,显示与核对都干净
      return { text, check, need };
    }).filter(Boolean);
  }
  // 物品从 v57.17 起带归属与数量:{name, holder, n}。holder 是队伍成员名或「队伍」。
  // 旧存档里的字符串物品在读取与落账时就地升格,不迁移不丢。
  function itemsFix(list) {
    return (Array.isArray(list) ? list : []).map(x => {
      if (typeof x === "string") { const s = x.trim(); return s ? { name: s, holder: "队伍", n: 1 } : null; }
      if (!x || typeof x !== "object") return null;
      const name = String(x.name || "").trim();
      return name ? { name, holder: String(x.holder || "队伍").trim() || "队伍", n: Math.max(1, Math.round(Number(x.n) || 1)) } : null;
    }).filter(Boolean);
  }
  const fmtItem = it => it.name + (it.n > 1 ? "×" + it.n : "") + (it.holder && it.holder !== "队伍" ? "(" + it.holder + ")" : "");
  // need/物品名归一:剥掉「×2」和「(持有人)」尾巴。她 2026-08-28 实测抓的坑:
  // 物品表按 fmtItem 格式喂给守密人,它出选项时把「解毒剂(陆衍)」整串当 need,
  // 客户端只认全等 → 明明有药却显示「缺」。
  const itemNameNorm = s => String(s || "").trim().replace(/×\d+$/, "").replace(/[(（][^)）]*[)）]$/, "").trim();
  const hasItem = (items, name) => {
    const n = itemNameNorm(name);
    if (!n) return false;
    const fixed = itemsFix(items);
    // 全等优先,再互相包含(「解毒剂」该认得「浓缩催吐解毒剂」)
    return fixed.some(it => it.name === n) || fixed.some(it => it.name.indexOf(n) >= 0 || n.indexOf(it.name) >= 0);
  };
  // 把守密人一回合的 JSON 落进战役状态。只信字段不信散文;名字对不上的伤害丢弃;
  // 返回 {camp, chips, sysLine}——chips 是钉在那一拍正文旁的数值角标(米娅分镜馆
  // 偷来的点子:数字和造成它的故事绑在一起,不藏进面板);sysLine 是文字版,兼容旧渲染。
  // 注意和米娅的差别:角标只从【真的落了账】的变化里长出来——名字对不上被丢弃的,
  // 角标也不出现,绝不渲染一个没生效的变化骗人。
  // HP 先【按人聚合】再夹 ±40(Codex 抓的:以前单条夹 ±40,同一轮写三条 -40
  // 照样一拍掉 120;现在同一人的多条先合计,每人每拍净变化封顶 ±40)。
  function applyTurnPayload(camp, p, opts) {
    const next = Object.assign({}, camp);
    const notes = [];
    const chips = [];
    next.party = camp.party.map(m => Object.assign({}, m));
    const hpSum = {};
    (Array.isArray(p.hp) ? p.hp : []).forEach(row => {
      if (!row || typeof row !== "object") return;
      const m = findMember(next.party, row.name);
      const d = Math.round(Number(row.delta) || 0);
      if (!m || !d) return;
      hpSum[m.name] = (hpSum[m.name] || 0) + d;
    });
    const rand = (opts && opts.rand) || Math.random;
    next.party.forEach(m => {
      const d = Math.max(-40, Math.min(40, hpSum[m.name] || 0));
      if (!d) return;
      const before = m.hp || 0;
      m.hp = Math.max(0, Math.min(m.maxHp || 100, before + d));
      notes.push(m.name + " HP" + (d > 0 ? "+" : "") + d);
      chips.push({ k: d > 0 ? "hpup" : "hp", txt: m.name + " HP" + (d > 0 ? "+" : "") + d + " →" + m.hp });
      // 重伤表:这一拍被打到见底,当场掷一条后遗症(scar 会跟着老卡进下一团)
      if (before > 0 && m.hp === 0) {
        const w = POOL_WOUND[Math.floor(rand() * POOL_WOUND.length)];
        m.effects = (m.effects || []).map(e => Object.assign({}, e));
        if (m.effects.length < 4 && !m.effects.some(e => e.name === w.name)) {
          m.effects.push({ name: w.name, note: w.note, scar: true });
          notes.push(m.name + " 落下重伤「" + w.name + "」");
          chips.push({ k: "hp", txt: "🩹 重伤·" + m.name + "·" + w.name });
        }
      }
    });
    // gain 可带持有人;同名同持有人=叠数量。lose 按名扣(给了持有人就只扣那个人的)。
    // hand 转手:to 必须在队(找不到就归「队伍」公用),from 可省。
    const items = itemsFix(camp.items).map(it => Object.assign({}, it));
    (Array.isArray(p.gain) ? p.gain : []).forEach(x => {
      const row = typeof x === "string" ? { name: x } : (x && typeof x === "object" ? x : null);
      if (!row) return;
      const name = String(row.name || "").trim();
      if (!name) return;
      const whoM = row.who || row.holder ? findMember(next.party, row.who || row.holder) : null;
      const holder = whoM ? whoM.name : "队伍";
      const ex = items.find(it => it.name === name && it.holder === holder);
      if (ex) ex.n += 1; else items.push({ name, holder, n: 1 });
      notes.push("获得「" + name + "」");
      chips.push({ k: "gain", txt: "得·" + name + (holder !== "队伍" ? "(" + holder + ")" : "") });
    });
    (Array.isArray(p.lose) ? p.lose : []).forEach(x => {
      const row = typeof x === "string" ? { name: x } : (x && typeof x === "object" ? x : null);
      if (!row) return;
      const name = String(row.name || "").trim();
      const whoM = row.who || row.holder ? findMember(next.party, row.who || row.holder) : null;
      let i = whoM ? items.findIndex(it => it.name === name && it.holder === whoM.name) : -1;
      if (i < 0) i = items.findIndex(it => it.name === name);
      if (i < 0) return;
      if (items[i].n > 1) items[i].n -= 1; else items.splice(i, 1);
      notes.push("失去「" + name + "」");
      chips.push({ k: "lose", txt: "失·" + name });
    });
    (Array.isArray(p.hand) ? p.hand : []).forEach(x => {
      if (!x || typeof x !== "object") return;
      const name = String(x.name || "").trim();
      const toM = findMember(next.party, x.to);
      const to = toM ? toM.name : (String(x.to || "").trim() ? "队伍" : null);
      if (!name || !to) return;
      const fromM = x.from ? findMember(next.party, x.from) : null;
      let i = fromM ? items.findIndex(it => it.name === name && it.holder === fromM.name) : -1;
      if (i < 0) i = items.findIndex(it => it.name === name);
      if (i < 0 || items[i].holder === to) return;
      // 只转一件:数量>1 时拆一件出来给对方
      if (items[i].n > 1) { items[i].n -= 1; const ex = items.find(it => it.name === name && it.holder === to); if (ex) ex.n += 1; else items.push({ name, holder: to, n: 1 }); }
      else { items[i] = Object.assign({}, items[i], { holder: to }); }
      notes.push("「" + name + "」转手给" + to);
      chips.push({ k: "gain", txt: "转·" + name + "→" + to });
    });
    next.items = items;
    const clues = camp.clues.slice();
    (Array.isArray(p.clue) ? p.clue : []).forEach(x => { const s = String(x || "").trim(); if (s && clues.indexOf(s) < 0) { clues.push(s); notes.push("📌 新线索"); chips.push({ k: "clue", txt: "📌 " + (s.length > 18 ? s.slice(0, 18) + "…" : s) }); } });
    next.clues = clues;
    // 专属状态条(按题材一根:理智/警戒/补给/声望/追兵…):单拍增减夹 ±15;
    // bad 指哪头是坏事——警戒涨满出事(high)、理智见底出事(low),角标红绿跟着这个走
    if (camp.gauge && p.gauge != null) {
      const d = Math.max(-15, Math.min(15, Math.round(Number(p.gauge) || 0)));
      if (d) {
        const g = Object.assign({}, camp.gauge);
        g.val = Math.max(0, Math.min(g.max || 100, (g.val || 0) + d));
        next.gauge = g;
        notes.push(g.name + (d > 0 ? "+" : "") + d);
        chips.push({ k: (g.bad === "high" ? d > 0 : d < 0) ? "hp" : "hpup", txt: "◔ " + g.name + (d > 0 ? "+" : "") + d + " →" + g.val });
      }
    }
    // 威胁时钟(0~max 格):最多同时 3 座;单拍进退夹 ±2;done=威胁解除拆钟;
    // 走满的钟由守密人负责让它爆发(规则写在 sys 里),这里只记账和亮红
    const clocks = (camp.clocks || []).map(c2 => Object.assign({}, c2));
    (Array.isArray(p.clock) ? p.clock : []).forEach(row => {
      if (!row || typeof row !== "object") return;
      const name = String(row.name || "").trim().slice(0, 10);
      if (!name) return;
      let c2 = clocks.find(x => x.name === name);
      if (row.done) {
        if (c2) { clocks.splice(clocks.indexOf(c2), 1); notes.push("⏰「" + name + "」解除"); chips.push({ k: "hpup", txt: "⏰ " + name + "·解除" }); }
        return;
      }
      if (!c2) {
        if (clocks.length >= 3) return;
        c2 = { name, filled: 0, max: Math.max(4, Math.min(8, Math.round(Number(row.max) || 6))) };
        clocks.push(c2);
      }
      const d = Math.max(-2, Math.min(2, Math.round(Number(row.delta) || 0)));
      if (d) c2.filled = Math.max(0, Math.min(c2.max, c2.filled + d));
      notes.push("⏰" + name + " " + c2.filled + "/" + c2.max);
      chips.push({ k: c2.filled >= c2.max ? "hp" : "clue", txt: "⏰ " + name + " " + c2.filled + "/" + c2.max + (c2.filled >= c2.max ? "·走满!" : "") });
    });
    next.clocks = clocks;
    // 任务日志(支线):quest 字段记账——add 开新支线(至多 10 条),done/fail/pause/open
    // 改状态;名字先全等再互相包含。主线仍走 stages,这里只管支线。
    const addedQuests = [];
    const quests = (camp.quests || []).map(q => Object.assign({}, q));
    (Array.isArray(p.quest) ? p.quest : []).forEach(row => {
      if (!row || typeof row !== "object") return;
      const name = String(row.name || "").trim().slice(0, 14);
      if (!name) return;
      let q = quests.find(x => x.name === name) || quests.find(x => x.name.indexOf(name) >= 0 || name.indexOf(x.name) >= 0);
      const op = String(row.op || "add").toLowerCase();
      if (!q) {
        if (op !== "add" || quests.length >= 10) return;
        q = { name, status: "open", note: String(row.note || "").trim().slice(0, 44), ts: Date.now() };
        quests.push(q);
        addedQuests.push(name);
        notes.push("支线「" + name + "」");
        chips.push({ k: "clue", txt: "📜 支线·" + name });
        return;
      }
      const map = { done: "done", fail: "failed", failed: "failed", pause: "paused", paused: "paused", open: "open" };
      if (map[op] && q.status !== map[op]) {
        q.status = map[op];
        const zh = { done: "完成", failed: "失败", paused: "暂缓", open: "重启" }[q.status];
        notes.push("支线「" + q.name + "」" + zh);
        chips.push({ k: q.status === "done" ? "hpup" : q.status === "failed" ? "hp" : "lose", txt: "📜 " + q.name + "·" + zh });
      }
      if (row.note) q.note = String(row.note).trim().slice(0, 44);
    });
    next.quests = quests;
    // 支线种子:被端出来(quest add 同名)就作废,不重复端
    if ((camp.sideSeeds || []).length && addedQuests.length) {
      next.sideSeeds = camp.sideSeeds.map(sd => {
        if (sd.used) return sd;
        const hit = addedQuests.some(n => n === sd.name || n.indexOf(sd.name) >= 0 || sd.name.indexOf(n) >= 0);
        return hit ? Object.assign({}, sd, { used: true }) : sd;
      });
    }
    // 简化先攻:危险/交战拍守密人给行动顺序,只是叙事标尺,不掷先攻骰
    if (Array.isArray(p.order)) {
      const names = p.order.map(x => { const m = findMember(next.party, x); return m ? m.name : null; }).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
      if (names.length >= 2) chips.push({ k: "lose", txt: "⚔ 顺序:" + names.join("→") });
    }
    // NPC 名册:按名 upsert(至多 20 人);note 只存玩家已知的信息,秘密仍在秘典
    const npcs = (camp.npcs || []).map(n => Object.assign({}, n));
    (Array.isArray(p.npc) ? p.npc : []).forEach(row => {
      if (!row || typeof row !== "object") return;
      const name = String(row.name || "").trim().slice(0, 10);
      if (!name) return;
      let n = npcs.find(x => x.name === name) || npcs.find(x => x.name.indexOf(name) >= 0 || name.indexOf(x.name) >= 0);
      if (!n) {
        if (npcs.length >= 20) return;
        n = { name, role: "", stance: "未明", alive: true, met: camp.pos || camp.place || "", ts: Date.now() };
        npcs.push(n);
        chips.push({ k: "clue", txt: "👤 " + name });
      }
      if (row.role) n.role = String(row.role).trim().slice(0, 30);
      if (["友", "敌", "未明"].indexOf(row.stance) >= 0) n.stance = row.stance;
      if (row.alive === false && n.alive) { n.alive = false; notes.push("「" + n.name + "」死了"); chips.push({ k: "hp", txt: "† " + n.name }); }
      if (row.note) n.note = String(row.note).trim().slice(0, 44);
    });
    next.npcs = npcs;
    // 状态效果:挂在成员身上(每人至多 4 个),note 写影响与解除条件;remove 解除
    (Array.isArray(p.effect) ? p.effect : []).forEach(row => {
      if (!row || typeof row !== "object") return;
      const m = findMember(next.party, row.who);
      const name = String(row.name || "").trim().slice(0, 8);
      if (!m || !name) return;
      m.effects = (m.effects || []).map(e => Object.assign({}, e));
      if (String(row.op || "").toLowerCase() === "remove") {
        const i = m.effects.findIndex(e => e.name === name || e.name.indexOf(name) >= 0 || name.indexOf(e.name) >= 0);
        if (i >= 0) { const gone = m.effects.splice(i, 1)[0]; notes.push(m.name + " 解除「" + gone.name + "」"); chips.push({ k: "hpup", txt: "✚ " + m.name + "·" + gone.name + "解除" }); }
      } else if (m.effects.length < 4 && !m.effects.some(e => e.name === name)) {
        m.effects.push({ name, note: String(row.note || "").trim().slice(0, 30) });
        notes.push(m.name + " 陷入「" + name + "」");
        chips.push({ k: "hp", txt: "🩸 " + m.name + "·" + name });
      }
    });
    // 团内时间:只向前走(单拍至多跨 2 天),晨→午→暮→夜;限时的事交给威胁钟表达
    if (p.time && typeof p.time === "object") {
      const PARTS = ["晨", "午", "暮", "夜"];
      const cur = camp.time || { day: 1, part: "晨" };
      const day = Math.round(Number(p.time.day) || 0);
      const pi = PARTS.indexOf(p.time.part);
      if (day > 0 && pi >= 0) {
        const nd = Math.max(cur.day, Math.min(cur.day + 2, day));
        const forward = nd > cur.day || (nd === cur.day && pi > PARTS.indexOf(cur.part));
        if (forward) {
          next.time = { day: nd, part: PARTS[pi] };
          chips.push({ k: "lose", txt: "🕯 第" + nd + "日·" + PARTS[pi] });
        }
      }
    }
    // 失控表:状态条这一拍触到坏的那头(理智见底/警戒涨满),玩家当场掷一条失控
    if (next.gauge && camp.gauge) {
      const hitBad = next.gauge.bad === "low" ? (next.gauge.val === 0 && camp.gauge.val > 0) : (next.gauge.val >= next.gauge.max && camp.gauge.val < camp.gauge.max);
      const me = next.party[0];
      if (hitBad && me) {
        const b = POOL_BREAK[Math.floor(rand() * POOL_BREAK.length)];
        me.effects = (me.effects || []).map(e => Object.assign({}, e));
        if (me.effects.length < 4 && !me.effects.some(e => e.name === b.name)) {
          me.effects.push({ name: b.name, note: b.note });
          notes.push(me.name + " 失控「" + b.name + "」");
          chips.push({ k: "hp", txt: "🌀 失控·" + b.name });
        }
      }
    }
    if (typeof p.place === "string" && p.place.trim()) next.place = p.place.trim();
    // 位置跟着地图走(opts.nodes=这场团的地图节点):玩家点了「前往」以那个为准;
    // 否则守密人报的 place 能对上节点名,队伍就真的挪到那儿——地图和叙事一本账
    const nds = opts && opts.nodes;
    if (nds && nds.length) {
      const target = (opts.travelTo ? findNode(nds, opts.travelTo) : null) || (typeof p.place === "string" && p.place.trim() ? findNode(nds, p.place) : null);
      if (target && target.name !== camp.pos) {
        next.pos = target.name; next.place = target.name;
        const vis = (camp.visited || []).slice();
        if (vis.indexOf(target.name) < 0) vis.push(target.name);
        next.visited = vis;
        notes.push("抵达「" + target.name + "」");
        chips.push({ k: "move", txt: "🧭 抵达·" + target.name });
      }
    }
    next.choices = normChoices(p.choices, next.party);
    // 章节推进和落幕都只挂【待确认】,由玩家点头才算数——防守密人自导自演一步通关
    // (小剧场 goalReached 同款闸)。章节只有 stageIdx 一个计数器,不会两处各记各的。
    if (p.stageDone && camp.stageIdx < camp.stages.length) next.pendingStage = String(p.stageNote || "").trim() || "这一章看起来到落点了";
    if (p.ending) next.pendingEnd = String(p.endNote || "").trim() || "故事似乎走到了可以落幕的地方";
    return { camp: next, chips, sysLine: notes.join(" · ") };
  }

  // ---- 手绘旅程图(纯函数) ----
  // 参考 ai-virtual-phone 地图引擎拆解后的结论:留矢量、丢栅格。这里只要一条
  // 蜿蜒小径 + 章节节点;种子取战役 id,同一场团每次画出来一模一样。
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hashStr = s => { let h2 = 5381; s = String(s || ""); for (let i = 0; i < s.length; i++) h2 = (h2 * 33 + s.charCodeAt(i)) >>> 0; return h2; };
  // n 章 → 起点 + n 个节点,x 单调向右,y 蜿蜒;画布 340×120,四边留白
  function journeyLayout(seed, n, w, h) {
    w = w || 340; h = h || 120;
    const rand = mulberry32(hashStr(seed));
    const phase = rand() * Math.PI * 2;
    const nodes = [];
    const total = n + 1; // 起点 + 各章
    for (let i = 0; i < total; i++) {
      const f = total > 1 ? i / (total - 1) : 0;
      const x = 24 + f * (w - 48);
      let y = h / 2 + Math.sin(f * Math.PI * 2.1 + phase) * (h * 0.24) + (rand() - 0.5) * (h * 0.14);
      y = Math.max(20, Math.min(h - 20, y));
      nodes.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }
    return nodes;
  }
  // 手绘感:把折线重采样后加垂直抖动;描两遍(不同抖动、不同透明度)就有铅笔味。
  // 端点不抖——路必须真的从节点出发、到节点为止。
  function jitterPts(points, rand, amp, perSeg) {
    perSeg = perSeg || 5;
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len, ny = dx / len; // 单位法向
      for (let k = 0; k < perSeg; k++) {
        const t2 = k / perSeg;
        const j = (i === 0 && k === 0) ? 0 : (rand() - 0.5) * 2 * amp;
        out.push({ x: a.x + dx * t2 + nx * j, y: a.y + dy * t2 + ny * j });
      }
    }
    out.push({ x: points[points.length - 1].x, y: points[points.length - 1].y });
    return out;
  }
  const ptsToPath = pts => pts.map((p2, i) => (i ? "L" : "M") + p2.x.toFixed(1) + " " + p2.y.toFixed(1)).join("");

  // ---- 大地图(纯函数,全矢量) ----
  // 参考 ai-virtual-phone 地图引擎拆解后的取舍:留下它的灵魂两件事——
  //   ① 模型宣告的【区域接壤关系】驱动力导向布局:说风语镇挨着暗影林,地图上就真挨着;
  //   ② 道路和可行走图【同一趟循环】生成:画出来的路永远等于能走的边,不会两张皮。
  // 丢掉它的栅格化重活(120×90 网格/行军方块/Dijkstra 描边):全走矢量,毫秒级出图,
  // 不卡主线程也不用存大 blob——布局由 (战役id, 骨架) 决定,每次现算,张张一样。
  function normRegions(raw) {
    const TERR = ["山地", "平原", "森林", "水泽", "荒漠", "城郭"];
    const KIND = ["城镇", "遗迹", "野外", "地标"];
    const seen = {};
    const regions = (Array.isArray(raw) ? raw : []).map(r => {
      if (!r || typeof r !== "object") return null;
      const name = String(r.name || "").trim().slice(0, 8);
      if (!name || seen[name]) return null;
      seen[name] = 1;
      const nseen = {};
      const nodes = (Array.isArray(r.nodes) ? r.nodes : []).map(n => {
        if (typeof n === "string") n = { name: n };
        if (!n || typeof n !== "object") return null;
        const nm = String(n.name || "").trim().slice(0, 10);
        if (!nm || nseen[nm]) return null;
        nseen[nm] = 1;
        return { name: nm, kind: KIND.indexOf(n.kind) >= 0 ? n.kind : "野外", hook: String(n.hook || "").trim().slice(0, 60) };
      }).filter(Boolean).slice(0, 3);
      if (!nodes.length) nodes.push({ name: name, kind: "地标", hook: "" });
      return { name, terrain: TERR.indexOf(r.terrain) >= 0 ? r.terrain : "平原", adj: (Array.isArray(r.adj) ? r.adj : []).map(x => String(x || "").trim()).filter(Boolean), nodes };
    }).filter(Boolean).slice(0, 6);
    // 接壤只认双方都存在的名字,并补成对称;谁都不挨的孤区随后由道路兜底接上
    const names = regions.map(r => r.name);
    regions.forEach(r => { r.adj = r.adj.filter(a => a !== r.name && names.indexOf(a) >= 0); });
    regions.forEach(r => r.adj.forEach(a => { const o = regions.find(x => x.name === a); if (o && o.adj.indexOf(r.name) < 0) o.adj.push(r.name); }));
    return regions.length >= 2 ? regions : null;
  }
  // 力导向:接壤的区域互相拉近(弹簧),不接壤的互相推开,整体轻轻向画布中心收
  function forceLayout(regions, rand, W, H) {
    const n = regions.length;
    const pos = [];
    for (let i = 0; i < n; i++) {
      // 最远点撒种:每个新中心从 24 个随机候选里挑离已有中心最远的那个
      let best = null, bd = -1;
      for (let t = 0; t < 24; t++) {
        const c = { x: W * (0.18 + rand() * 0.64), y: H * (0.18 + rand() * 0.64) };
        const d = pos.length ? Math.min.apply(null, pos.map(p2 => (p2.x - c.x) ** 2 + (p2.y - c.y) ** 2)) : 1e9;
        if (d > bd) { bd = d; best = c; }
      }
      pos.push(best);
    }
    const target = Math.min(W, H) / 2.1;
    for (let it = 0; it < 60; it++) {
      const f = pos.map(() => ({ x: 0, y: 0 }));
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const linked = regions[i].adj.indexOf(regions[j].name) >= 0;
        const k = linked ? (d - target) * 0.02 : Math.min(0, (d - target * 1.25)) * 0.03;
        f[i].x += dx / d * k; f[i].y += dy / d * k;
        f[j].x -= dx / d * k; f[j].y -= dy / d * k;
      }
      pos.forEach((p2, i) => {
        p2.x += f[i].x + (W / 2 - p2.x) * 0.004;
        p2.y += f[i].y + (H / 2 - p2.y) * 0.004;
        p2.x = Math.max(W * 0.14, Math.min(W * 0.86, p2.x));
        p2.y = Math.max(H * 0.14, Math.min(H * 0.86, p2.y));
      });
    }
    return pos;
  }
  // Chaikin 切角(闭合):每段取 1/4 与 3/4 点,两轮下来折线就圆润成手绘团块
  function chaikinClosed(pts, iters) {
    for (let it = 0; it < (iters || 2); it++) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
        out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
      }
      pts = out;
    }
    return pts;
  }
  // 区域团块:极坐标 24 根射线,半径带噪声,并被「到最近邻中心距离」软钳住——
  // 这就是不用 Dijkstra 也能让边界互相退让的省事法
  function regionBlob(center, others, rand, baseR) {
    const pts = [];
    const RAYS = 24;
    const jit = []; for (let i = 0; i < RAYS; i++) jit.push(0.72 + rand() * 0.56);
    for (let i = 0; i < RAYS; i++) {
      const a = i / RAYS * Math.PI * 2;
      let r = baseR * (jit[i] + jit[(i + 1) % RAYS]) / 2;
      others.forEach(o => {
        const d = Math.sqrt((o.x - center.x) ** 2 + (o.y - center.y) ** 2);
        const toward = Math.cos(a - Math.atan2(o.y - center.y, o.x - center.x));
        if (toward > 0) r = Math.min(r, d * (0.62 - 0.1 * toward));
      });
      pts.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
    }
    const sm = chaikinClosed(pts, 2);
    return sm.map((p2, i) => (i ? "L" : "M") + p2.x.toFixed(1) + " " + p2.y.toFixed(1)).join("") + "Z";
  }
  // 并查集:跨区兜底连通用
  function unionFind(n) {
    const pa = Array.from({ length: n }, (_, i) => i);
    const find = x => (pa[x] === x ? x : (pa[x] = find(pa[x])));
    return { find, union: (a, b) => { const ra = find(a), rb = find(b); if (ra === rb) return false; pa[ra] = rb; return true; } };
  }
  // 总装:布局 → 团块 → 节点(环带拒绝采样) → 道路+通行图(同一趟循环记 edges)
  function mapBuild(seed, regionsRaw, W, H) {
    W = W || 360; H = H || 300;
    const regions = normRegions(regionsRaw);
    if (!regions) return null;
    const rand = mulberry32(hashStr(seed) ^ 0x51ab);
    const centers = forceLayout(regions, rand, W, H);
    const baseR = Math.min(W, H) / (regions.length <= 3 ? 3.4 : 4.2);
    const outR = regions.map((r, i) => regionBlob(centers[i], centers.filter((_, j) => j !== i), rand, baseR));
    // 节点:围着区域中心的环带里撒,彼此至少隔 30;第一个节点就放中心(区域首府感)
    const nodes = [];
    regions.forEach((r, i) => {
      r.nodes.forEach((nd, k) => {
        let p2 = null;
        if (k === 0) p2 = { x: centers[i].x, y: centers[i].y };
        else {
          for (let t = 0; t < 40 && !p2; t++) {
            const a = rand() * Math.PI * 2, rr = baseR * (0.35 + rand() * 0.45);
            const c = { x: centers[i].x + Math.cos(a) * rr, y: centers[i].y + Math.sin(a) * rr };
            if (c.x < 16 || c.x > W - 16 || c.y < 20 || c.y > H - 20) continue;
            if (nodes.every(x => (x.x - c.x) ** 2 + (x.y - c.y) ** 2 > 30 * 30)) p2 = c;
          }
          if (!p2) p2 = { x: centers[i].x + (rand() - 0.5) * baseR, y: centers[i].y + (rand() - 0.5) * baseR };
        }
        nodes.push({ name: nd.name, kind: nd.kind, hook: nd.hook, region: r.name, ri: i, x: Math.round(p2.x * 10) / 10, y: Math.round(p2.y * 10) / 10 });
      });
    });
    // 道路与 edges 同一趟生成:区内相邻节点连成链;跨区按【接壤关系】连两区最近的一对节点;
    // 最后并查集查连通,不通的补最短桥(模型的 adj 写漏了也不会出孤岛)
    const roads = [];
    const edges = [];
    const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    const bend = (a, b) => {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      const off = (rand() - 0.5) * Math.min(30, len * 0.35);
      return "M" + a.x + " " + a.y + "Q" + (mx - dy / len * off).toFixed(1) + " " + (my + dx / len * off).toFixed(1) + " " + b.x + " " + b.y;
    };
    const link = (a, b) => {
      if (edges.some(e => (e[0] === a.name && e[1] === b.name) || (e[0] === b.name && e[1] === a.name))) return;
      edges.push([a.name, b.name]);
      roads.push({ d: bend(a, b), a: a.name, b: b.name });
    };
    regions.forEach((r, i) => {
      const mine = nodes.filter(x => x.ri === i);
      for (let k = 1; k < mine.length; k++) {
        let best = mine[0], bd = 1e18;
        for (let j = 0; j < k; j++) { const d = dist2(mine[k], mine[j]); if (d < bd) { bd = d; best = mine[j]; } }
        link(mine[k], best);
      }
    });
    regions.forEach((r, i) => r.adj.forEach(an => {
      const j = regions.findIndex(x => x.name === an);
      if (j <= i) return;
      let pair = null, bd = 1e18;
      nodes.filter(x => x.ri === i).forEach(a => nodes.filter(x => x.ri === j).forEach(b => { const d = dist2(a, b); if (d < bd) { bd = d; pair = [a, b]; } }));
      if (pair) link(pair[0], pair[1]);
    }));
    const uf = unionFind(nodes.length);
    edges.forEach(e => uf.union(nodes.findIndex(x => x.name === e[0]), nodes.findIndex(x => x.name === e[1])));
    for (let guard = 0; guard < nodes.length; guard++) {
      const comps = {};
      nodes.forEach((x, i) => { const r = uf.find(i); (comps[r] = comps[r] || []).push(i); });
      const keys = Object.keys(comps);
      if (keys.length <= 1) break;
      let pair = null, bd = 1e18;
      comps[keys[0]].forEach(a => { for (let ki = 1; ki < keys.length; ki++) comps[keys[ki]].forEach(b => { const d = dist2(nodes[a], nodes[b]); if (d < bd) { bd = d; pair = [a, b]; } }); });
      if (!pair) break;
      link(nodes[pair[0]], nodes[pair[1]]);
      uf.union(pair[0], pair[1]);
    }
    return { W, H, regions: regions.map((r, i) => ({ name: r.name, terrain: r.terrain, cx: Math.round(centers[i].x), cy: Math.round(centers[i].y), blob: outR[i] })), nodes, roads, edges };
  }
  const mapAdjacent = (edges, name) => (edges || []).reduce((out, e) => { if (e[0] === name) out.push(e[1]); else if (e[1] === name) out.push(e[0]); return out; }, []);
  const findNode = (nodes, name) => {
    const n = String(name || "").trim();
    if (!n) return null;
    return (nodes || []).find(x => x.name === n) || (nodes || []).find(x => x.name && (n.indexOf(x.name) >= 0 || x.name.indexOf(n) >= 0)) || null;
  };
  // 历史折叠:守密人→assistant,其余(玩家/骰子/系统/闲聊)全并进 user 侧,
  // 连续同侧合成一条——上游对连续同角色消息的容忍度不一,不赌。
  // 闲聊簇压成一行带标记喂回去:守密人该知道大家唠过什么,但那不是剧情正文。
  function foldHist(msgs) {
    const out = [];
    (msgs || []).forEach(m => {
      const role = m.role === "gm" ? "assistant" : "user";
      const content = m.role === "chat"
        ? "〔闲聊〕" + (m.lines || []).map(l => l.name + ":" + l.text + (l.act ? "(" + l.act + ")" : "")).join(" / ")
        : (m.role === "roll" || m.role === "sys" ? "〔" + m.content + "〕" : m.content) || "";
      if (!content) return;
      if (out.length && out[out.length - 1].role === role) out[out.length - 1] = { role, content: out[out.length - 1].content + "\n" + content };
      else out.push({ role, content });
    });
    return out;
  }

  // ---- 前情账本(与小剧场同一套设计;两模块各自作用域,故各留一份实现——
  // 想合并要动 theater.js,那是另一张工单) ----
  const LEDGER_KEYS = ["timeline", "facts", "openThreads", "objects"];
  const LEDGER_EVICT = ["timeline", "facts", "objects", "openThreads"];
  const ledgerCount = L => LEDGER_KEYS.reduce((n, k) => n + ((L && L[k]) || []).length, 0);
  const ledgerChars = L => LEDGER_KEYS.reduce((n, k) => n + ((L && L[k]) || []).join("").length, 0);
  function shrinkLedger(L, maxChars) {
    const out = Object.assign({}, L);
    while (ledgerChars(out) > maxChars) {
      let moved = false;
      for (const k of LEDGER_EVICT) { const arr = (out[k] || []).slice(); if (arr.length) { arr.shift(); out[k] = arr; moved = true; break; } }
      if (!moved) break;
    }
    return out;
  }
  function ledgerOk(prev, next) {
    if (!prev || !ledgerCount(prev)) return ledgerCount(next) > 0;
    const p = (L, ks) => ks.reduce((n, k) => n + ((L && L[k]) || []).length, 0);
    if (p(prev, ["openThreads", "objects"]) >= 4 && p(next, ["openThreads", "objects"]) < 2) return false;
    if (p(prev, ["timeline", "facts"]) >= 4 && p(next, ["timeline", "facts"]) < 2) return false;
    return ledgerCount(next) > 0;
  }
  const ledgerToText = L => LEDGER_KEYS.map(k => {
    const arr = (L && L[k]) || [];
    if (!arr.length) return "";
    const zh = { timeline: "已经发生", facts: "已确立的事实", openThreads: "还没了结的线", objects: "物件在谁手上" }[k];
    return "【" + zh + "】\n" + arr.map(x => "· " + x).join("\n");
  }).filter(Boolean).join("\n");
  function histSig(msgs) {
    let hsh = 5381;
    (msgs || []).forEach(m => { const t = (m.id || "") + "|" + (m.content || ""); for (let i = 0; i < t.length; i++) hsh = (hsh * 33 + t.charCodeAt(i)) >>> 0; });
    return hsh.toString(36) + "_" + (msgs || []).length;
  }

  // ---- JSON 解析梯队(同小剧场:规矩解析→转义重试→拆双包→按键名边界抢救) ----
  const decodeLoose = value => String(value || "")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\r\\n|\\n|\\r/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  const salvageByKeys = (raw, keys) => {
    const text = String(raw || "").replace(/```(?:json)?/gi, "");
    const out = {}; let got = 0;
    keys.forEach(k => {
      const head = new RegExp('"' + k + '"\\s*:\\s*"').exec(text);
      if (!head) return;
      const rest = text.slice(head.index + head[0].length);
      let end = -1;
      keys.forEach(nk => { if (nk === k) return; const m = new RegExp('"\\s*,\\s*"' + nk + '"\\s*:').exec(rest); if (m && (end < 0 || m.index < end)) end = m.index; });
      if (end < 0) { const tail = /"\s*[},]/.exec(rest); end = tail ? tail.index : -1; }
      if (end < 0) return;
      const v = decodeLoose(rest.slice(0, end)).trim();
      if (v) { out[k] = v; got++; }
    });
    return got ? out : null;
  };
  const parseObj = raw => {
    let v = null;
    for (const cand of [String(raw || ""), escapeJsonStringControls(raw)]) {
      v = typeof extractJSON === "function" ? extractJSON(cand) : null;
      if (v != null) break;
    }
    if (typeof v === "string") { const nested = extractJSON(v) || extractJSON(escapeJsonStringControls(v)); if (nested) v = nested; }
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  };
  // 回合协议:scene 必须抢救得回来;结构字段(choices/hp/…)抢救不回来就当没有——
  // 剧情正文一个回合都不能丢,状态字段丢了下回合还能补,轻重不一样。
  function parseTurnPayload(raw) {
    let v = parseObj(raw);
    if (v && typeof v.scene === "string" && /^\s*\{\s*"scene"\s*:/.test(v.scene)) { const nested = parseObj(v.scene); if (nested) v = Object.assign({}, v, nested); }
    if (!v) v = salvageByKeys(raw, ["scene", "place", "stageNote", "endNote"]);
    if (!v || typeof v !== "object") return null;
    const scene = typeof v.scene === "string" ? v.scene.trim() : "";
    if (!scene || /^\s*\{\s*"scene"\s*:/.test(scene)) return null;
    return Object.assign({}, v, { scene });
  }
  const rawHint = raw => { const t = String(raw || "").replace(/\s+/g, " ").trim(); return t ? "(它回的是:" + t.slice(0, 30) + (t.length > 30 ? "…" : "") + ")" : "(上游什么都没回)"; };

  // ---- 开团骰子池(客户端掷,关键词为空才用;她写了关键词就一切听她的) ----
  const POOL_WORLD = ["剑与魔法的西幻边境", "近代小镇怪谈(克苏鲁气味)", "武侠江湖", "远航中的星际殖民船", "蒸汽朋克雾都", "现代都市异闻", "末世废土商队", "古代宫廷权谋", "海盗黄金时代的群岛", "赛博朋克巨城下层", "民国租界之外的水乡", "魔法学院的期末季", "深冬雪山驿站", "沙漠绿洲自由市"];
  const POOL_QUEST = ["解开一桩没人敢碰的悬案", "护送一个人(或一件东西)穿过险地", "寻回一件失落之物", "在大祸临头前逃出去——或阻止它", "揭穿一个体面人物的阴谋", "夺回被占的家园", "完成一场几乎不可能的盗窃", "打破一个代代相传的诅咒", "查明同伴失踪的真相", "在一场大典(或葬礼)搅动前把真话带到"];
  const POOL_TONE = ["悬疑压抑", "热血冒险", "荒诞喜剧", "悲壮史诗", "诡谲志怪", "温暖有余味", "黑色幽默", "步步惊心"];
  // 剧情骰(演出中):意外的【类型】由客户端掷定,模型自由发挥类型之内的具体内容——
  // 全让它挑,它每次都掷出同一个众数
  const POOL_EVENT = ["不速之客闯入", "环境突变(天气/坍塌/断电/走水)", "一件要紧的东西丢了或坏了", "有人露出破绽", "突然出现时限:再不动手就来不及", "一个旧相识在最坏的时机出现", "一件看似无关的小事,其实连着真相", "队伍里有人的旧事被戳到", "一桩好运从天而降,但带着钩子", "对头忽然抛来橄榄枝"];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // 冒险小分队 v2(她 2026-08-28 定稿):【多支】小分队各自立户,存 x_trpgSquads。
  // 数值在【组建队伍时】就掷定;成长与旧伤只写回所属那支队——同一个人在小队A
  // 体魄+5,不影响他在小队B的卡;新建队伍从零掷,不继承任何旧队。
  const loadSquads = () => {
    try {
      let v = JSON.parse(localStorage.getItem("x_trpgSquads") || "null");
      if (!v || !Array.isArray(v.squads)) {
        // 旧单队库(x_trpgSquad)一次性迁成第一支队,老卡一张不丢
        let ms = [];
        try { const old = JSON.parse(localStorage.getItem("x_trpgSquad") || "null"); if (old && old.members) ms = Object.keys(old.members).map(k => old.members[k]); } catch (e) {}
        v = { squads: ms.length ? [{ id: "sq_legacy", name: "冒险小分队", ts: Date.now(), runs: ms.reduce((n, m) => Math.max(n, m.runs || 0), 0), members: ms.map(m => ({ key: m.key, name: m.name, stats: m.stats, feats: m.feats || [], scars: m.scars || [], runs: m.runs || 0 })) }] : [] };
        lsWrite("x_trpgSquads", v, "小分队");
      }
      return v;
    } catch (e) { return { squads: [] }; }
  };
  const saveSquads = v => lsWrite("x_trpgSquads", v, "小分队");
  // 世界收藏(x_trpgWorlds):只存【长期为真】的世界观+地图;用它重开时,章节/目标/
  // 秘典/种子全部重新生成——同一个世界,另一个故事(小剧场收藏基线同一课)
  const loadWorlds = () => { try { const v = JSON.parse(localStorage.getItem("x_trpgWorlds") || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const saveWorlds = v => lsWrite("x_trpgWorlds", v, "收藏的世界");
  // 跑团图库(x_trpgGallery):封面与当拍画面出图即归档;删掉那一轮跑团,图也不丢
  const loadGal = () => { try { const v = JSON.parse(localStorage.getItem("x_trpgGallery") || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const saveGalList = v => lsWrite("x_trpgGallery", v, "图库");
  // 墓碑:她从图库删掉的那几张。补档那一步会把团里还引用着的图【全部】收回来,
  // 所以删过一张、下次进跑团它又原样回来了——记下删过谁,补档时绕开。
  const loadGalGone = () => { try { const v = JSON.parse(localStorage.getItem("x_trpgGalleryGone") || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const galTomb = img => { const g = loadGalGone(); if (g.indexOf(img) < 0) lsWrite("x_trpgGalleryGone", g.concat([img]).slice(-400), "图库"); };
  // 输出天花板:她按次计费,上限不省钱只会截断——统一给满(同 StylePresets.OUT_CEILING,
  // 中转会自行 clamp 到模型上限;思考型模型的推理也从这里扣,给大不多花一分钱)
  const TOK_MAX = 65535;

  // ---- 出图的安全过滤(纯函数) ----
  // 图像接口要的是【画面上看得见什么】,不是小说正文;敏感句直接进 prompt 会被
  // 上游审核整张拒掉(小剧场 2026-08-18 的老案子)。暴力与亲密分开算,过滤后
  // 空了就退回「地点+气氛」的中性一瞬,这一拍不至于被掏空。
  const SHOT_VIOLENT_RE = /刀|刃|血|尸|伤口|掐|勒|捅|砍|割|窒息|尖叫|喘息|呻吟|哭喊|挣扎|绑|铐|药|毒|枪|箭|烧死|溺/;
  function shotSafeLines(lines, isSex) {
    const sexFn = isSex || (t => typeof offlineRegisterExplicitText === "function" && offlineRegisterExplicitText(t));
    return (lines || []).filter(s => s && !SHOT_VIOLENT_RE.test(String(s)) && !sexFn(String(s)));
  }

  // 能力≠性格(与 games.js 的 SKILL_RULE 同一条纪律;那边是模块内常量拿不到,这里
  // 按同样的意思重申——四处一样喂的是纪律本身,不是必须同一个变量)
  const ABILITY_RULE = "【能力与性格分开】队友玩得多好由 TA 的职业、训练与人生经历决定;性格只决定 TA 怎么说话、什么语气。绝不因为性格软/憨/开朗就把 TA 演成推理拉垮、关键时刻掉链子。";

  const DIFF = {
    easy: { name: "轻松", play: "守密人手下留情:检定不必太密,失败的代价以「麻烦」为主,不轻易见血;把重心放在探索的乐趣和队友的戏上。" },
    normal: { name: "标准", play: "" },
    hard: { name: "硬核", play: "世界是认真的:资源紧、对手聪明、检定失败要真付代价(受伤/暴露/失去东西/局面恶化);大失败要疼。但代价永远制造新的戏,不制造死胡同。" }
  };
  // 守密风格:只改叙事口味与事件密度,绝不改检定判定与规则公平(Codex 点的菜)
  const STYLES = {
    classic: { name: "经典均衡", text: "" },
    noir: { name: "悬疑克制", text: "叙事克制冷峻:信息一点点漏,气氛靠没说出口的部分;事件密度低但每件都压人,留白多于解释。" },
    comedy: { name: "公路喜剧", text: "叙事松弛带笑:倒霉事连环但不致命,NPC 各有怪癖,队友拌嘴多;哪怕检定失败也往荒诞里长,不往惨里长。" },
    grim: { name: "残酷生存", text: "叙事粗粝逼仄:资源与体力时刻要紧,环境本身就是对手;喘息的段落要短,安全感永远差一口。" },
    heart: { name: "情感浓度高", text: "叙事贴着人心走:多写队友与 NPC 的私心、亏欠与在乎,事件密度让位给关系的推进;大场面少,近景多。" }
  };
  // 命运点:气运越好,命越硬——只用于检定台面(重掷必须接受新结果/大失败降成失败),
  // 有明确成本,不做成无限耍赖
  const fateOf = luck => (Number(luck) >= 70 ? 3 : Number(luck) <= 30 ? 1 : 2);

  function TrpgApp(props) {
    const t = useTheme();
    const uName = (props.profile && props.profile.name) || "你";
    const [camps, setCamps] = useState(load);
    const [view, setView] = useState("list"); // list | create | play
    const [playId, setPlayId] = useState(null);
    // 不用系统的 confirm()。她 2026-08-30:「.55 根本没有确认框」——
    // iOS 上系统弹窗会被吞掉(Safari 连着弹几次之后可以「阻止此页面的对话框」,
    // 一旦点过就一直是 no-op,confirm() 直接返回 false),于是 ✕ 点了什么都不发生。
    // 换成自己画的一层:一定弹得出来,长相也跟 app 一致。
    const [ask, setAsk] = useState(null);   // {text, yes, onYes}
    const [panelShut, setPanelShut] = useState(loadPanelShut);
    const togglePanelSect = title => setPanelShut(p => {
      const shut = p[title] != null ? !!p[title] : PANEL_OPEN_BY_DEFAULT.indexOf(title) < 0;
      const n = Object.assign({}, p); n[title] = !shut;
      lsWrite("x_trpgPanelShut", n, "面板的收放");
      return n;
    });
    const askConfirm = (text, onYes, yes) => setAsk({ text: text, yes: yes || "删除", onYes: onYes });
    // 把 toast 借给模块顶层的 lsWrite 用（写盘失败要说出来，不能一声不吭）
    useEffect(function () {
      window.__trpgToast = props.toast;
      return function () { if (window.__trpgToast === props.toast) delete window.__trpgToast; };
    }, [props.toast]);
    const [busy, setBusy] = useState(false);
    const [busyWhat, setBusyWhat] = useState("");
    const [panelOpen, setPanelOpen] = useState(false);
    const [draft, setDraft] = useState(null);
    const [pickIds, setPickIds] = useState([]);
    const [kw, setKw] = useState("");
    const [diff, setDiff] = useState("normal");
    const [style, setStyle] = useState("classic"); // 守密风格(开团时选)
    const [guessTxt, setGuessTxt] = useState("");  // 线索板:推测输入缓冲
    const [chatMode, setChatMode] = useState(false); // 闲聊模式:输入的话走加戏不推进
    const [fixMode, setFixMode] = useState(false);   // GM 手动修正:改 HP/物品/状态/支线/名册
    const [fixItem, setFixItem] = useState("");      // 修正模式:补记物品的输入缓冲
    const [resumeSeen, setResumeSeen] = useState(null); // 休团回来横幅:本次会话已收起的团 id
    const [limitsTxt, setLimitsTxt] = useState("");  // 安全线:开团前写的雷点
    const [mylineTxt, setMylineTxt] = useState("");  // 暗线:自写候选缓冲
    const [modOpen, setModOpen] = useState(false);   // 导入模组面板
    const [modTxt, setModTxt] = useState("");        // 模组 JSON 粘贴缓冲
    const [squadTick, setSquadTick] = useState(0);   // 小分队增删后强制重画用
    // 入口页分三格(她 2026-08-30:「队伍平时能不能收纳到哪儿不要在主页占位,主界面只留开的团,
    // 开完的团也单独找地方收纳」)。开着的团是每天要点的,别的两样按需要才翻。
    const [listTab, setListTab] = useState("live");  // live 在演 | done 已落幕 | squad 小分队
    const [pickSquadId, setPickSquadId] = useState(null); // 开团带哪支小分队
    const [plusMenu, setPlusMenu] = useState(false); // 入口 ＋ 菜单(开团/组建队伍)
    const [squadName, setSquadName] = useState("");  // 组建队伍:队名
    const [bmRolls, setBmRolls] = useState({});      // 组建队伍:每人建队时掷定的数值
    const [galView, setGalView] = useState(null);    // 图库大图:item|null
    const [input, setInput] = useState("");
    const [note, setNote] = useState("");       // 跟守密人咬耳朵:一次性幕后指示
    const [noteOpen, setNoteOpen] = useState(false);
    const [dice, setDice] = useState(false);     // 剧情骰:下一回合注入一个意外,一次性
    const [plusOpen, setPlusOpen] = useState(false);
    const [ceremony, setCeremony] = useState(null); // 检定仪式:{who,statZh,statVal,phase:"ready"|"rolling"|"done",roll,grade,resolve}
    const [msgMenu, setMsgMenu] = useState(null);
    const [endAsk, setEndAsk] = useState(null);   // 落幕前问「最后,你做什么」:null | {forced}
    const [finalAct, setFinalAct] = useState(""); // 她的最后一笔(可空)
    const [photoMenu, setPhotoMenu] = useState(null); // 长按画面弹出的操作单:msg|null
    const [shotPick, setShotPick] = useState(false);  // 拍图前选谁入镜(锁脸)的抽屉
    const [bigView, setBigView] = useState(null);     // 点开看整张:{img,title}|null
    const fileRef = useRef(null);
    const pressRef = useRef(null);
    const scrollRef = useRef(null);
    const campsRef = useRef(null);
    const sumBusyRef = useRef(false);
    // 存不下就【不改界面】：不然那个团当场消失、重开又回来，看起来就是「删不掉」。
    // 存不下的原因由 lsWrite 弹出来（存储满 / 云端恢复冻结中）。
    const update = fn => setCamps(p => { const n = fn(p.slice()); return persist(n) ? n : p; });
    // 图库:出过的图永久归档——删掉那一轮跑团,图还在
    const galAdd = entry => { const list = loadGal(); if (list.some(x => x.img === entry.img)) return; saveGalList([Object.assign({ id: rid("tg_") }, entry)].concat(list)); };
    useEffect(() => {
      // 图库上线前已出过的封面与画面,一次性补档(按图引用去重)
      const have = {}; loadGal().forEach(x => have[x.img] = 1);
      loadGalGone().forEach(img => have[img] = 1);   // 删过的不再收回来
      const add = [];
      (campsRef.current || camps).forEach(c => {
        (c.msgs || []).forEach(m => { if (m.role === "photo" && m.img && !have[m.img]) { have[m.img] = 1; add.push({ id: rid("tg_"), campId: c.id, campTitle: c.title, img: m.img, ts: m.ts || Date.now(), kind: "shot" }); } });
        if (c.cover && !have[c.cover]) { have[c.cover] = 1; add.push({ id: rid("tg_"), campId: c.id, campTitle: c.title, img: c.cover, ts: c.coverTs || Date.now(), kind: "cover" }); }
      });
      if (add.length) saveGalList(add.concat(loadGal()).sort((a, b) => b.ts - a.ts));
    }, []);
    useEffect(() => { campsRef.current = camps; });
    const camp = camps.find(c => c.id === playId) || null;
    // 地图布局:由 (战役id, 骨架) 决定的纯函数,毫秒级;memo 一下免得每次打字都重算
    const nodesOf = c => (c && c.mapRegions) ? c.mapRegions.flatMap(r => r.nodes) : [];
    const builtMap = useMemo(() => (camp && camp.mapRegions) ? mapBuild(camp.id, camp.mapRegions) : null, [camp && camp.id]);
    const [mapOpen, setMapOpen] = useState(false);
    const [selNode, setSelNode] = useState(null);
    const [mapVB, setMapVB] = useState(null); // 舆图视口 {cx,cy,k}:默认放大 2 倍中心对准队伍,可拖可捏
    const mapPtr = useRef({ pts: {}, moved: false, dist: 0 });
    const msgCount = camp ? camp.msgs.length : 0;
    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgCount, playId]);
    const charOf = id => props.characters.find(c => c.id === id) || null;

    // 人设给全文、封顶 6000(四处一样喂·落地要求4:截断出来的空白由训练先验补上,
    // 那就是霸总;跑团一队至多 1+4 人,谁都不该被砍)
    const personaOf = ch => String((ch && (ch.persona || ch.name)) || "").slice(0, 6000);
    // 出团建卡:整队从选定的小分队里出——数值是组建队伍时掷定的,这里只是取卡;
    // 旧伤(scar)带上,专长带上,命运点按气运现算;出过团的标 veteran
    const buildParty = squad => (squad.members || []).map(m => ({ key: m.key, name: m.key === "user" ? uName : m.name, hp: 100, maxHp: 100, stats: Object.assign({}, m.stats), fate: fateOf(m.stats.luck), effects: (m.scars || []).map(e => Object.assign({}, e)), feats: (m.feats || []).map(f => Object.assign({}, f)), veteran: (m.runs || 0) > 0, runs: m.runs || 0 }));
    const partyBlock = c => c.party.map(m => {
      const line = m.name + ":HP " + m.hp + "/" + (m.maxHp || 100) + " · " + STATS.map(([k, zh]) => zh + m.stats[k]).join(" ")
        + ((m.feats || []).length ? " · 专长:" + m.feats.map(f => f.name + "(" + STAT_ZH[f.stat] + ")").join("、") : "")
        + ((m.effects || []).length ? " · 状态:" + m.effects.map(e => e.name + (e.note ? "(" + e.note + ")" : "")).join("、") : "");
      return m.key === "user" ? line + "(玩家本人)" : line;
    }).join("\n");
    const personaBlocks = c => c.party.filter(m => m.key !== "user").map(m => {
      const ch = charOf(m.key);
      return "【队友人设·" + m.name + "(性格与声纹的根基,保持不变)】\n" + (ch ? personaOf(ch) : m.name);
    }).join("\n\n");

    // ---- 开团 ----
    // ===== 开团:两段式(她 2026-08-28 问到点上:一口气写全会摊薄注意力) =====
    // 台前(A):世界/地图/章节/开场——必须一气呵成的那部分,单独一枪写透。
    // 幕后(B):拿着台前成品专心写底牌——秘典/私念/行头/专长/状态条/每区支线种子/
    //   玩家暗线候选。它看得见完整的台前所以写得深;而且失败不废局,预览里可「补幕后」。
    const SHAPE_A = "{\"title\":\"这场跑团的短名字(≤10字)\",\"world\":\"世界观与背景:这个世界怎么运转、此地是哪儿、空气里是什么味道(3-5句,只写长期为真的)\",\"hook\":\"开局处境:队伍此刻为什么聚在这里、眼前正在发生什么(2-3句)\",\"regions\":[{\"name\":\"区域名(≤6字)\",\"terrain\":\"山地|平原|森林|水泽|荒漠|城郭 之一\",\"adj\":[\"接壤的区域名\"],\"nodes\":[{\"name\":\"地点名(≤8字)\",\"kind\":\"城镇|遗迹|野外|地标 之一\",\"hook\":\"这里藏着什么(一句,写给守密人)\"}]}],\"stages\":[{\"goal\":\"第一章要达成的具体一步\",\"hint\":\"守密人自用的一句推进思路\",\"place\":\"这一章的目标在哪个地点(必须用 regions 里的节点名)\"}],\"place\":\"开局地点(必须用 regions 里的节点名)\",\"opening\":\"开场正文\",\"choices\":[\"开局给玩家的 2-4 个行动选项\"]}";
    const SHAPE_B = "{\"truth\":\"藏在整件事背后的真相\",\"twist\":\"中段翻转:什么时刻、以什么方式掀出来\",\"secrets\":\"关键 NPC 各自瞒着什么(每人一句)\",\"endgame\":\"故事可能的几种结局方向\",\"gauge\":{\"name\":\"专属状态条(≤4字:理智/警戒/补给/声望/追兵…)\",\"start\":50,\"max\":100,\"bad\":\"high或low(哪头是坏事)\",\"rule\":\"什么事让它涨、什么事让它跌\"},\"mates\":[{\"name\":\"队友名(严格用队友的名字)\",\"want\":\"此行真正想得到什么\",\"fear\":\"最怕发生什么\",\"line\":\"不会跨的底线\",\"clash\":\"什么情况下会和队伍唱反调\"}],\"outfits\":[{\"name\":\"成员名(每位队友和玩家都要)\",\"outfit\":\"TA 在这个世界的行头:材质/形制/颜色/关键配件,一句能照着画\"}],\"feats\":[{\"name\":\"成员名(每人都要)\",\"list\":[{\"name\":\"专长名(2-4字,如 急救/开锁/追踪/辩才)\",\"stat\":\"phy|agi|wit|cha|luck\"}]}],\"seeds\":[{\"name\":\"支线名(≤10字)\",\"region\":\"所在区域名(严格用地图里的区域名)\",\"trigger\":\"触发条件:到达某节点/结识某人/拿到某物/时间到第几日…(一句,各不相同)\",\"hook\":\"这条支线的底,写给守密人\"}],\"myline\":[\"给玩家本人的暗线候选:2-3条,每条一句话的秘密目标(第一人称,和主线有张力但不冲突)\"]}";
    // 幕后(B):写底牌。base 里已有的核心字段(真相/种子等)一律【只补空,不覆盖】——
    // 模组导入的团保台本,新团全空自然全生成
    const backstage = async base => {
      const crew = base.party.slice(1).map(m => ({ m, ch: charOf(m.key) }));
      const sys = "一场文字跑团的台前(世界/地图/章节/开场)已经搭好了,你现在【专心写幕后底牌】——玩家看不到这些,所以写实话,别写宣传语。\n"
        + "truth 要经得起推敲;twist 要在中段真正颠一次盘;secrets 让沿途 NPC 各怀心事。\n"
        + "gauge 按题材配一根专属状态条,写清哪头是坏事、什么让它动。\n"
        + (crew.length ? "mates 给每位队友写只有守密人知道的私念——让他们不只是陪跑。\n" : "这是单人团,mates 给空数组。\n")
        + "outfits 给每位队友和玩家各写一句这个世界的行头(出图锁装用),符合时代与身份。\n"
        + "feats 按人设与题材给每人 1-2 个专长,从 TA 的职业与经历里长出来,别人人一样。\n"
        + "seeds 给【每个区域】埋 1-2 条支线种子:各有不同的触发条件,从节点的底和这个区域的处境里长出来;玩家看不到,触发条件满足时你才端出来。\n"
        + "myline 给玩家本人 2-3 条暗线候选:她会挑一条当自己的秘密目标(队友不知道)。\n"
        + ABILITY_RULE + "\n只输出 JSON:" + SHAPE_B;
      const user = "【玩家】" + uName + "\n【世界】" + base.world + (base.hook ? "\n【开局处境】" + base.hook : "")
        + (base.mapRegions ? "\n【地图】\n" + base.mapRegions.map(r => r.name + "(" + r.terrain + ")·节点:" + r.nodes.map(n => n.name + "〔" + (n.hook || n.kind) + "〕").join("/")).join("\n") : "")
        + "\n【主线各章】" + base.stages.map((x, i) => "第" + (i + 1) + "章:" + x.goal + (x.place ? "@" + x.place : "")).join(";")
        + (crew.length ? "\n\n" + crew.map(x => "【队友·" + x.m.name + " 人设】\n" + (x.ch ? personaOf(x.ch) : x.m.name)).join("\n\n") : "");
      let p = null;
      try { p = parseObj(await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: TOK_MAX, timeout: 300000 })); } catch (e) { p = null; }
      if (!p) return null;
      const party = base.party.map(m => Object.assign({}, m));
      (Array.isArray(p.feats) ? p.feats : []).forEach(f => {
        if (!f || typeof f !== "object") return;
        const mem = findMember(party, f.name);
        if (!mem || (mem.feats || []).length) return;
        mem.feats = (Array.isArray(f.list) ? f.list : []).map(x => x && typeof x === "object" && String(x.name || "").trim() && STAT_ZH[x.stat] ? { name: String(x.name).trim().slice(0, 6), stat: x.stat } : null).filter(Boolean).slice(0, 2);
      });
      const gRaw = p.gauge && typeof p.gauge === "object" ? p.gauge : null;
      const gauge = base.gauge || (gRaw && String(gRaw.name || "").trim() ? (() => {
        const g = { name: String(gRaw.name).trim().slice(0, 4), max: Math.max(20, Math.min(100, Math.round(Number(gRaw.max) || 100))), val: Math.max(0, Math.min(100, Math.round(Number(gRaw.start) || 50))), bad: gRaw.bad === "low" ? "low" : "high", rule: String(gRaw.rule || "").trim().slice(0, 60) };
        g.val = Math.min(g.val, g.max); return g;
      })() : null);
      const mates = (base.dossier && (base.dossier.mates || []).length) ? base.dossier.mates : (Array.isArray(p.mates) ? p.mates : []).map(m => {
        if (!m || typeof m !== "object") return null;
        const mem = findMember(party.slice(1), m.name);
        return mem ? { name: mem.name, want: String(m.want || "").trim(), fear: String(m.fear || "").trim(), line: String(m.line || "").trim(), clash: String(m.clash || "").trim() } : null;
      }).filter(Boolean);
      const outfits = Object.assign({}, base.outfits || {});
      (Array.isArray(p.outfits) ? p.outfits : []).forEach(o => {
        if (!o || typeof o !== "object") return;
        const mem = findMember(party, o.name);
        const v = String(o.outfit || "").trim().slice(0, 80);
        if (mem && v && !outfits[mem.name]) outfits[mem.name] = v;
      });
      const regionNames = (base.mapRegions || []).map(r => r.name);
      const perRegion = {};
      const seeds = (base.sideSeeds && base.sideSeeds.length) ? base.sideSeeds : (Array.isArray(p.seeds) ? p.seeds : []).map(x => {
        if (!x || typeof x !== "object") return null;
        const name = String(x.name || "").trim().slice(0, 10);
        const region = regionNames.indexOf(String(x.region || "").trim()) >= 0 ? String(x.region).trim() : "";
        if (!name) return null;
        perRegion[region] = (perRegion[region] || 0) + 1;
        if (perRegion[region] > 2) return null;
        return { name, region, trigger: String(x.trigger || "").trim().slice(0, 30), hook: String(x.hook || "").trim().slice(0, 60), used: false };
      }).filter(Boolean).slice(0, 8);
      const d0 = base.dossier || {};
      return {
        party,
        gauge,
        outfits,
        sideSeeds: seeds,
        mylineOptions: (Array.isArray(p.myline) ? p.myline : []).map(x => String(x || "").trim().slice(0, 44)).filter(Boolean).slice(0, 3),
        dossier: { truth: d0.truth || String(p.truth || ""), twist: d0.twist || String(p.twist || ""), secrets: d0.secrets || String(p.secrets || ""), endgame: d0.endgame || String(p.endgame || ""), mates: mates }
      };
    };
    const genSetup = async () => {
      const squadsAll = loadSquads().squads;
      const squad = squadsAll.find(x => x.id === pickSquadId) || squadsAll[0];
      if (!squad) return props.toast("先点右上角 ＋ 组建一支小分队");
      const members = squad.members.filter(m => m.key !== "user").map(m => charOf(m.key)).filter(Boolean);
      // 队里只有你=单人团:NPC 与世界把陪伴和对手戏补足
      if (!props.active) return props.toast("请先配置线下 API");
      setBusy(true); setBusyWhat("守密人在搭台前(世界与地图)…");
      try {
        const frame = kw.trim() ? "" : "\n\n【本团取景框(骰子已掷好,三项照办)】\n世界:" + pick(POOL_WORLD) + "\n主线原型:" + pick(POOL_QUEST) + "\n基调:" + pick(POOL_TONE);
        const prior = camps.slice(0, 8).map(c => c.title + "(" + String(c.world || "").slice(0, 24) + ")").join(";");
        const sys = "你在为一场文字跑团搭【台前】:世界、地图、主线与开场——只写这些,写透它们;秘典底牌、队友私念、支线这些幕后另有一枪,这里一个字都不用管。玩家是 " + uName + (members.length
            ? ",队友是下面这些角色——保留他们的性格、说话方式与真实能力,把身份处境放进这个新世界(可以贴近原设定,也可以是平行身份,以和世界咬合为准)。"
            : "。这是一场【单人团】:没有队友同行,NPC 与世界要把陪伴、对手戏和信息来源都补足,别让 " + uName + " 对着空气说话。") + "\n"
          + "世界要落在一张地图上:regions 给 3-5 个区域,每区 1-3 个节点(地点)。adj 写谁和谁接壤——这决定地图上它们真的相邻;节点的 hook 是守密人自用的一句底(这里埋着什么),玩家看不到。主线各章要分布在【不同区域】的节点上,逼着队伍真的赶路。\n"
          + "主线拆成 4-5 章(stages),每章 goal 是一步【具体、可判定】的事(找到/救出/潜入/揭穿/带到),不是抽象状态;各章连起来是一条完整的弧;place 必须严格用 regions 里已有的节点名。\n"
          + "opening 是写给玩家的开场正文(第二人称『你』,6-10句):把队伍放进一个正在发生、必须行动的时刻,交代此地与在场的人,悬着收尾;绝不替 " + uName + " 做决定。开场即可让一两个队友有一句进场的话或动作,声口要各是各的" + (squad.members.some(m => m.key !== "user" && typeof props.isEngineer === "function" && props.isEngineer(m.key)) ? "——但【亲笔成员例外】:" + squad.members.filter(m => m.key !== "user" && typeof props.isEngineer === "function" && props.isEngineer(m.key)).map(m => m.name).join("、") + " 的台词与主动动作一个字都不许写(他的话由他本人亲笔),开场只可描写他在场的样子(站在哪、什么状态),给他留一个待开口的位置" : "") + "。\n"
          + ABILITY_RULE + "\n只输出 JSON:" + SHAPE_A;
        const user = "【玩家】" + uName + "\n\n" + members.map(ch => "【队友·" + ch.name + " 人设】\n" + personaOf(ch)).join("\n\n")
          + "\n\n【关键词(可空,空则按取景框来)】" + (kw.trim() || "无") + frame
          + (prior ? "\n\n【已经开过的团(务必避开,换皮重来也算重复)】" + prior : "");
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: TOK_MAX, timeout: 300000 });
        let p = parseObj(raw);
        if (!p) {
          // 内容多半已经写出来了,只是没按 JSON——花一次小调用原样归类,不整局重烧
          const sys2 = "下面是一段已写好的内容,但没按要求输出 JSON。把它【原样整理】成这个形状:\n" + SHAPE_A + "\n【铁律】只搬运归类,一个字不改写;原文没有的字段留空。只输出 JSON,不要代码块。";
          try { p = parseObj(await callAI(props.active, sys2, [{ role: "user", content: String(raw || "").slice(0, 10000) }], { maxTokens: TOK_MAX, timeout: 150000 })); } catch (e) { p = null; }
        }
        if (!p) throw new Error("模型没按 JSON 输出,也整理不回来" + rawHint(raw));
        const stages = (Array.isArray(p.stages) ? p.stages : []).map(s => typeof s === "string" ? { goal: s, hint: "" } : s && s.goal ? { goal: String(s.goal), hint: String(s.hint || ""), place: String(s.place || "").trim() } : null).filter(Boolean).slice(0, 6);
        if (!String(p.world || "").trim() || !String(p.opening || "").trim() || stages.length < 2) throw new Error("设定缺了关键部分(世界/开场/章节),再试一次");
        // 地图骨架:坏了/缺了不整局报废——这场团就退化成没有地图的纯叙事团,别的照玩
        const mapRegions = normRegions(p.regions);
        const allNodes = mapRegions ? mapRegions.flatMap(r => r.nodes.map(n => Object.assign({ region: r.name }, n))) : [];
        const startNode = mapRegions ? (findNode(allNodes, p.place) || allNodes[0]) : null;
        stages.forEach(s => { if (mapRegions) { const nd = findNode(allNodes, s.place); s.place = nd ? nd.name : ""; } });
        // 卡从小分队里取:数值建队时已定,成长归这支队
        const party = buildParty(squad);
        let d = { squadId: squad.id, squadName: squad.name, partyIds: members.map(ch => ch.id), keywords: kw.trim(), difficulty: diff, style: style, title: p.title || "无名团", world: p.world, hook: p.hook || "", stages: stages.map(s => ({ goal: s.goal, hint: s.hint, place: s.place || "", done: false, note: null })), dossier: { truth: "", twist: "", secrets: "", endgame: "", mates: [] }, gauge: null, outfits: {}, sideSeeds: [], mylineOptions: [], myline: "", mapRegions: mapRegions, pos: startNode ? startNode.name : "", place: startNode ? startNode.name : (String(p.place || "").trim() || "起点"), opening: p.opening, choices: normChoices(p.choices, party), party };
        setBusyWhat("守密人在写幕后底牌…");
        const bs = await backstage(d);
        if (bs) d = Object.assign({}, d, bs);
        else props.toast("台前搭好了,但幕后底牌没写成——预览里点「补幕后」重试", 7000);
        setDraft(d);
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); setBusyWhat(""); }
    };
    // 收藏的世界开新局:世界观与地图一个字不改,重新生成开局/各章/开场/选项,
    // 幕后(秘典/种子/私念)整套重写——同一个世界,另一个故事
    const genFromWorld = async w => {
      const squadsAll = loadSquads().squads;
      const squad = squadsAll.find(x => x.id === pickSquadId) || squadsAll[0];
      if (!squad) return props.toast("先点右上角 ＋ 组建一支小分队");
      if (!props.active) return props.toast("请先配置线下 API");
      const members = squad.members.filter(m => m.key !== "user").map(m => charOf(m.key)).filter(Boolean);
      setBusy(true); setBusyWhat("在这个世界里另起一个故事…");
      try {
        const SHAPE_W = "{\"hook\":\"开局处境(2-3句,全新的)\",\"stages\":[{\"goal\":\"每章一步具体可判定的事\",\"hint\":\"守密人自用思路\",\"place\":\"必须用地图里已有的节点名\"}],\"place\":\"开局地点(已有节点名)\",\"opening\":\"开场正文(第二人称『你』,6-10句,悬着收尾)\",\"choices\":[\"开局 2-4 个行动选项\"]}";
        const past = camps.filter(c => c.world === w.world).slice(0, 6).map(c => String(c.hook || "").slice(0, 40)).join(";");
        const sys = "基于下面这套【固定的世界与地图】开一局全新的跑团:世界观与区域节点一个字不许改,但主线、开局处境、开场全部另起——换时间点、换事件、换队伍被卷入的理由都行,幅度要大到一眼是另一个故事。主线 4-5 章分布在【不同区域】的节点上。绝不复述以往开过的局。\n" + ABILITY_RULE + "\n只输出 JSON:" + SHAPE_W;
        const user = "【固定世界】" + w.world + "\n【固定地图】\n" + (w.regions || []).map(r => r.name + "(" + r.terrain + ")·节点:" + r.nodes.map(n => n.name).join("/")).join("\n") + "\n【玩家】" + uName + (members.length ? "\n" + members.map(ch => "【队友·" + ch.name + " 人设】\n" + personaOf(ch)).join("\n\n") : "") + (past ? "\n【这个世界已开过的局(务必避开)】" + past : "");
        const p2 = parseObj(await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: TOK_MAX, timeout: 300000 }));
        if (!p2 || !String(p2.opening || "").trim()) throw new Error("这个世界的新故事没生成出来");
        const stages = (Array.isArray(p2.stages) ? p2.stages : []).map(x => x && x.goal ? { goal: String(x.goal), hint: String(x.hint || ""), place: String(x.place || "").trim() } : null).filter(Boolean).slice(0, 6);
        if (stages.length < 2) throw new Error("章节没生成够,再试一次");
        const mapRegions = w.regions || null;
        const allNodes = mapRegions ? mapRegions.flatMap(r => r.nodes) : [];
        const startNode = mapRegions ? (findNode(allNodes, p2.place) || allNodes[0]) : null;
        stages.forEach(x => { if (mapRegions) { const nd = findNode(allNodes, x.place); x.place = nd ? nd.name : ""; } });
        const party = buildParty(squad);
        let d = { squadId: squad.id, squadName: squad.name, partyIds: members.map(ch => ch.id), keywords: "", difficulty: diff, style: w.style || style, title: w.title, world: w.world, hook: p2.hook || "", stages: stages.map(x => ({ goal: x.goal, hint: x.hint, place: x.place || "", done: false, note: null })), dossier: { truth: "", twist: "", secrets: "", endgame: "", mates: [] }, gauge: null, outfits: {}, sideSeeds: [], mylineOptions: [], myline: "", mapRegions, pos: startNode ? startNode.name : "", place: startNode ? startNode.name : "起点", opening: p2.opening, choices: normChoices(p2.choices, party), party };
        if (w.limits) setLimitsTxt(String(w.limits));
        setBusyWhat("守密人在写幕后底牌…");
        const bs = await backstage(d);
        if (bs) d = Object.assign({}, d, bs);
        else props.toast("台前搭好了,但幕后没写成——预览里点「补幕后」", 7000);
        setDraft(d);
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); setBusyWhat(""); }
    };
    // 预览里的「补幕后」:台前不动,只重写(或补写)底牌;模组导入的团也走这里配 crew
    const redoBackstage = async () => {
      if (!draft || busy) return;
      if (!props.active) return props.toast("请先配置线下 API");
      setBusy(true); setBusyWhat("守密人在写幕后底牌…");
      try {
        const bs = await backstage(draft);
        if (!bs) throw new Error("幕后还是没写成,再试一次");
        setDraft(dd => dd && Object.assign({}, dd, bs));
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); setBusyWhat(""); }
    };
    // (v57.37 起数值在组建队伍时掷定,预览页不再重掷——想换数值去建一支新队)
    const acceptDraft = () => {
      const openMsg = { id: rid("rm_"), role: "gm", content: draft.opening, ts: Date.now(), snap: { hp: draft.party.reduce((m, x) => (m[x.name] = x.hp, m), {}), fate: draft.party.reduce((m, x) => (m[x.name] = x.fate, m), {}), items: [], clues: [], stageIdx: 0, place: draft.place, pos: draft.pos || "", visited: draft.pos ? [draft.pos] : [], gauge: draft.gauge ? draft.gauge.val : null, clocks: [], quests: [], seeds: (draft.sideSeeds || []).map(x => Object.assign({}, x)), npcs: [], time: { day: 1, part: "晨" }, effects: {}, choices: draft.choices } };
      const c = { id: rid("rpg_"), title: draft.title, createdAt: Date.now(), squadId: draft.squadId || "", squadName: draft.squadName || "", partyIds: draft.partyIds, keywords: draft.keywords, difficulty: draft.difficulty, style: draft.style || "classic", world: draft.world, hook: draft.hook, stages: draft.stages, stageIdx: 0, dossier: draft.dossier, gauge: draft.gauge || null, outfits: draft.outfits || {}, sideSeeds: (draft.sideSeeds || []).map(x => Object.assign({}, x)), myline: draft.myline || "", limits: limitsTxt.trim(), clocks: [], guesses: [], quests: [], npcs: [], time: { day: 1, part: "晨" }, mapRegions: draft.mapRegions || null, pos: draft.pos || "", visited: draft.pos ? [draft.pos] : [], place: draft.place, party: draft.party, items: [], clues: [], choices: draft.choices, msgs: [openMsg], pendingStage: false, pendingEnd: false, ledger: null, summary: "", sumCount: 0, sumSig: "", ended: false, epilogue: null };
      update(list => [c, ...list]); setDraft(null); setKw(""); setPlayId(c.id); setView("play"); setPanelOpen(false);
    };

    // ---- 检定仪式:她亲手按「掷」,数字滚一秒落定 ----
    // 这一层是跑团的情绪高点,五件套全在这里:
    //   协力:出手前点一位队友搭手 +10(协力者共担后果,大失败连累);
    //   魔鬼交易:守密人开了价才有——+15,但代价【无论成败必然兑现】;
    //   命运点:失败/大失败落定后可花(重掷必认/大失败降级),对抗时只救自己这颗骰;
    //   对抗骰:对面的骰子当着你的面滚——档高者胜,同档骰点小者胜,再平守方胜;
    //   伤害骰:见血的对抗补一颗 d20,轻重按它叙。
    const normCheckObj = raw => {
      if (!raw || typeof raw !== "object" || !STAT_ZH[raw.stat]) return null;
      let vs = null;
      if (raw.vs && typeof raw.vs === "object" && String(raw.vs.name || "").trim()) {
        const v = Math.round(Number(raw.vs.val));
        if (v) vs = { name: String(raw.vs.name).trim().slice(0, 8), val: Math.max(20, Math.min(90, v)) };
      }
      return { stat: raw.stat, who: raw.who || null, feat: String(raw.feat || "").trim().slice(0, 6) || null, vs, bargain: String(raw.bargain || "").trim().slice(0, 24) || null, harm: raw.harm === true };
    };
    const featMatch = (member, featName) => {
      if (!featName) return null;
      const n = String(featName).trim();
      return (member.feats || []).find(f => f.name === n || f.name.indexOf(n) >= 0 || n.indexOf(f.name) >= 0) || null;
    };
    const ceremonyEff = c => Math.min(95, c.base + (c.feat ? 15 : 0) + (c.assist ? 10 : 0) + (c.bargainOn ? 15 : 0));
    const runCeremony = (member, chk) => new Promise(resolve => {
      const feat = featMatch(member, chk.feat);
      const mates = camp.party.filter(x => x.key !== member.key && x.hp > 0).map(x => ({ key: x.key, name: x.name }));
      setCeremony({ mKey: member.key, who: member.name, statKey: chk.stat, statZh: STAT_ZH[chk.stat], base: member.stats[chk.stat], feat: feat ? feat.name : null, assist: null, mates, bargainText: chk.bargain || null, bargainOn: false, vs: chk.vs || null, harm: !!chk.harm, fate: member.fate || 0, phase: "ready", roll: 0, grade: null, vsRoll: null, vsGrade: null, opposed: null, harmRoll: null, rerolled: false, spent: [], resolve });
    });
    const ceremonyFinish = () => setCeremony(c => {
      if (c && c.resolve) c.resolve({ roll: c.roll, grade: c.grade, effVal: ceremonyEff(c), feat: c.feat, assist: c.assist, bargainOn: c.bargainOn, bargainText: c.bargainText, vs: c.vs, vsRoll: c.vsRoll, vsGrade: c.vsGrade, opposed: c.opposed, harmRoll: c.harmRoll, spent: c.spent });
      return null;
    });
    // 我方骰落定之后的接力:对抗→对面掷;见血→伤害骰;都完了→收
    const ceremonyNext = () => setCeremony(c => {
      if (!c) return c;
      if (c.vs && c.vsRoll == null) {
        const t0 = Date.now();
        const iv = setInterval(() => {
          if (Date.now() - t0 > 800) {
            clearInterval(iv);
            const vr = 1 + Math.floor(Math.random() * 100);
            setCeremony(cc => {
              if (!cc) return cc;
              const vg = gradeCheck(vr, cc.vs.val);
              setTimeout(ceremonyNext, 1200);
              return Object.assign({}, cc, { vsRoll: vr, vsGrade: vg, opposed: decideOpposed(cc.grade, cc.roll, vg, vr) });
            });
          } else setCeremony(cc => cc && Object.assign({}, cc, { vsRoll: 1 + Math.floor(Math.random() * 100) }));
        }, 55);
        return Object.assign({}, c, { phase: "vsroll" });
      }
      if (c.harm && c.harmRoll == null) {
        const t0 = Date.now();
        const iv = setInterval(() => {
          if (Date.now() - t0 > 700) {
            clearInterval(iv);
            setCeremony(cc => { if (!cc) return cc; setTimeout(ceremonyNext, 1000); return Object.assign({}, cc, { harmRoll: 1 + Math.floor(Math.random() * 20), phase: "harm" }); });
          } else setCeremony(cc => cc && Object.assign({}, cc, { harmRoll: 1 + Math.floor(Math.random() * 20), phase: "harm" }));
        }, 55);
        return Object.assign({}, c, { phase: "harm" });
      }
      setTimeout(ceremonyFinish, 500);
      return Object.assign({}, c, { phase: "final" });
    });
    const ceremonyRoll = () => {
      setCeremony(c => c && Object.assign({}, c, { phase: "rolling" }));
      const t0 = Date.now();
      const iv = setInterval(() => {
        if (Date.now() - t0 > 900) {
          clearInterval(iv);
          const roll = 1 + Math.floor(Math.random() * 100);
          setCeremony(c => {
            if (!c) return c;
            const grade = gradeCheck(roll, ceremonyEff(c));
            const offer = c.fate > 0 && !c.rerolled && (grade.tier === "fail" || grade.tier === "fumble");
            if (!offer) setTimeout(ceremonyNext, 1200);
            return Object.assign({}, c, { phase: "done", roll, grade, offer });
          });
        } else setCeremony(c => c && Object.assign({}, c, { roll: 1 + Math.floor(Math.random() * 100) }));
      }, 55);
    };
    // 花命运点:立刻从队伍账上扣,不等回合结算——花出去就是花出去了
    const spendFate = mKey => update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { party: c.party.map(m => m.key === mKey ? Object.assign({}, m, { fate: Math.max(0, (m.fate || 0) - 1) }) : m) })));
    const fateReroll = () => setCeremony(c => {
      if (!c || c.phase !== "done" || !c.offer) return c;
      spendFate(c.mKey);
      setTimeout(ceremonyRoll, 60);
      return Object.assign({}, c, { fate: c.fate - 1, rerolled: true, offer: false, spent: c.spent.concat(["重掷"]), phase: "rolling" });
    });
    const fateSoften = () => setCeremony(c => {
      if (!c || c.phase !== "done" || !c.offer || c.grade.tier !== "fumble") return c;
      spendFate(c.mKey);
      setTimeout(ceremonyNext, 1100);
      return Object.assign({}, c, { fate: c.fate - 1, offer: false, spent: c.spent.concat(["大失败以失败论"]), grade: { tier: "fail", zh: "失败(命运点庇护)" } });
    });
    const ceremonyAccept = () => setCeremony(c => { if (!c) return c; setTimeout(ceremonyNext, 60); return Object.assign({}, c, { offer: false }); });
    // 检定行:把这一掷的全部真相写成一行铁案(守密人照它叙,成长骰也从这里记账)
    const rollLine = (fated, m, chk, res) => {
      const boost = [res.feat ? "专长·" + res.feat + "+15" : null, res.assist ? res.assist.name + "协力+10" : null, res.bargainOn ? "魔鬼交易+15" : null].filter(Boolean);
      let line = fated + m.name + " 的「" + STAT_ZH[chk.stat] + "」检定:d100=" + res.roll + " / " + res.effVal + (boost.length ? "(" + boost.join(",") + ")" : "") + " → " + res.grade.zh;
      if (res.vs) line += ";对抗「" + res.vs.name + "(" + res.vs.val + ")」d100=" + res.vsRoll + "→" + res.vsGrade.zh + " ⇒ " + (res.opposed === "win" ? "对抗胜" : "对抗负");
      if (res.harmRoll != null) line += "〔伤害骰d20=" + res.harmRoll + "·" + harmZh(res.harmRoll) + "〕";
      if (res.bargainOn) line += "〔魔鬼交易成立,代价必兑现:" + res.bargainText + "〕";
      if (res.assist) line += "〔" + res.assist.name + " 协力,共担后果〕";
      if (res.spent && res.spent.length) line += "〔花" + res.spent.length + "枚命运点:" + res.spent.join("、") + "〕";
      return line;
    };
    const rollRec = (m, chk, res) => ({ who: m.name, statKey: chk.stat, tier: res.opposed ? (res.opposed === "win" ? (TIER_RANK[res.grade.tier] >= 2 ? res.grade.tier : "ok") : "fail") : res.grade.tier });

    // ---- 滚动摘要(超过 48 条把最老的压进前情账本,只留近 32 条逐句喂) ----
    const maybeSummarize = async campId => {
      if (sumBusyRef.current || !props.active) return;
      const c = (campsRef.current || []).find(x => x.id === campId);
      if (!c) return;
      const all = c.msgs;
      const done = (c.sumSig && c.sumSig === histSig(all.slice(0, c.sumCount || 0))) ? (c.sumCount || 0) : 0;
      if (all.length - done <= 48) return;
      const cut = all.length - 32;
      const seg = all.slice(done, cut).filter(m => m.role !== "photo").map(m => m.role === "chat"
        ? "闲聊:" + (m.lines || []).map(l => l.name + ":" + l.text).join(" / ")
        : (m.role === "user" ? uName : m.role === "gm" ? "守密人" : "·") + ":" + m.content).join("\n").slice(0, 9000);
      sumBusyRef.current = true;
      try {
        const prev = c.ledger && LEDGER_KEYS.some(k => (c.ledger[k] || []).length) ? c.ledger : null;
        const sys = "把跑团剧情压缩进一本【前情账本】,不是写摘要散文。合并旧账本与新增剧情,输出四类条目,每条一句话:\n· timeline:已经发生的关键事件,按先后。\n· facts:已确立的事实(身份、真相碎片、约定)。\n· openThreads:【还没了结的线】——悬着的威胁、没兑现的承诺、没答的问题。宁可多留。\n· objects:重要物件在谁手上、什么状态。没有就空数组。\n旧账本条目除非被推翻或了结,一律保留。只输出 JSON:{\"timeline\":[],\"facts\":[],\"openThreads\":[],\"objects\":[]}";
        const user = (prev ? "【旧账本】\n" + JSON.stringify(prev) + "\n\n" : "") + "【新增剧情】\n" + seg;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: TOK_MAX, timeout: 120000 });
        const p2 = extractJSON(raw) || {};
        const nxt = {};
        LEDGER_KEYS.forEach(k => { nxt[k] = (Array.isArray(p2[k]) ? p2[k] : []).map(x => String(x || "").trim()).filter(Boolean).slice(0, 14); });
        if (!ledgerOk(prev, nxt)) return;
        const trimmed = shrinkLedger(nxt, 2400);
        update(list => list.map(x => x.id !== campId ? x : Object.assign({}, x, { ledger: trimmed, summary: ledgerToText(trimmed), sumCount: cut, sumSig: histSig(all.slice(0, cut)) })));
      } catch (e) { /* 静默:下次再试 */ } finally { sumBusyRef.current = false; }
    };

    // ---- 一回合 ----
    const gmSys = c => {
      const stageLines = c.stages.map((s, i) => (i < c.stageIdx ? "✓ " : i === c.stageIdx ? "→ " : "· ") + "第" + (i + 1) + "章:" + (i <= c.stageIdx ? s.goal + (s.place ? "〔在:" + s.place + "〕" : "") : "(未揭晓,推进到才亮出)") + (i === c.stageIdx && s.hint ? "〔推进思路:" + s.hint + "〕" : "")).join("\n");
      const dd = DIFF[c.difficulty] || DIFF.normal;
      return [narrativeCore(),
        c.limits ? "【安全线(最高优先级,压过一切风格与剧情需要)】以下内容绝不出现、也不擦边:" + c.limits + "。剧情逼近时淡出换景处理,不描写过程,也不拿它当威胁渲染。" : null,
        "【跑团·守密人(独立平行时空)】你是这场文字跑团的守密人(GM):叙述世界、扮演一切 NPC,并【完全代入】下面每一位队友本人——写到谁,就是谁在说话行事,用 TA 自己的性格、声口和真实能力(人设在下方),不是在旁边描写一个标签。这是与主线完全无关的平行时空:不引用主线聊天里发生过的事,正文里也不提这是游戏或扮演。",
        "【玩家主权】" + uName + " 的行动、台词和决定永远由 Ta 本人输入:你只写世界、NPC 与队友,绝不替 " + uName + " 做动作、说台词、下决定;写到需要 Ta 抉择的位置就停下来给选项。",
        ABILITY_RULE,
        personaBlocks(c),
        "【世界】" + c.world + (c.hook ? "\n【开局处境】" + c.hook : ""),
        "【守密人秘典(玩家永远不可见,不得在正文中直接说破)】\n真相:" + c.dossier.truth + "\n中段翻转:" + c.dossier.twist + "\nNPC 各自的心事:" + c.dossier.secrets + "\n结局方向:" + c.dossier.endgame
          + ((c.dossier.mates || []).length ? "\n【队友的私念(同样保密;按各自的私念演——该坚持坚持、该隐瞒隐瞒,时机到了可以主动提支线或唱反调,不许把队友演成只会附和的陪跑)】\n" + c.dossier.mates.map(m => m.name + ":想要·" + m.want + ";最怕·" + m.fear + ";底线·" + m.line + ";会唱反调·" + m.clash).join("\n") : "")
          + (((c.sideSeeds || []).filter(sd => !sd.used).length) ? "\n【支线种子(玩家不可见)】\n" + c.sideSeeds.filter(sd => !sd.used).map(sd => "「" + sd.name + "」@" + (sd.region || "?") + "·触发:" + sd.trigger + (sd.hook ? "·底:" + sd.hook : "")).join("\n") + "\n触发条件在剧情里【真实满足】时才把种子端出来(quest add 同名),端出即作废;条件没满足绝不硬塞。" : "")
          + (c.myline ? "\n【玩家的暗线(只有你和玩家知道,队友与 NPC 都不知道)】" + c.myline + "——制造让它靠近或受试探的机会,但绝不替玩家推进、绝不点破、绝不让队友看出来。" : "")
          + "\n伏笔要一点点埋,已经亮给玩家的线索见下方【线索】,别重复埋同一颗。",
        c.gauge ? "【专属状态条·" + c.gauge.name + "】当前 " + c.gauge.val + "/" + c.gauge.max + "(" + (c.gauge.bad === "high" ? "涨满出大事" : "见底出大事") + ")。规则:" + (c.gauge.rule || "按剧情增减") + "。变化写进 gauge 字段(整数,单拍 ±15 以内);逼近坏的那头时叙事要有压迫感,真到头必须立刻爆发成事件,不许拖。" : null,
        "【威胁时钟】把「正在逼近的坏事」做成 0~6 格的钟(clock 字段:新钟给 name+max,推进给 name+delta,解除给 name+done):检定失败、大失败或队伍拖延时优先给相关的钟 +1;钟走满必须立刻让它爆发成事件,爆发后报 done 拆钟。同时最多 3 座,别滥设。" + ((c.clocks || []).length ? "\n当前的钟:" + c.clocks.map(x => "「" + x.name + "」" + x.filled + "/" + x.max + (x.filled >= x.max ? "(已走满,本拍必须爆发)" : "")).join(" ") : ""),
        c.mapRegions ? "【地图(区域·接壤·节点)】\n" + c.mapRegions.map(r => r.name + "(" + r.terrain + ")" + (r.adj.length ? "·接壤:" + r.adj.join("、") : "") + "\n  " + r.nodes.map(n => n.name + "〔" + n.kind + (n.hook ? ":" + n.hook : "") + "〕").join(" / ")).join("\n") + "\n队伍现在位于「" + (c.pos || c.place) + "」。place 只许写地图上已有的节点名;跨节点移动由玩家在地图上发起(会带〔赶路〕指令),你不要自行把队伍挪去别的节点。节点〔〕里的底是你埋的料,按剧情一点点抖,不要一次说穿。" : null,
        "【主线各章】\n" + stageLines + "\n" + (c.stageIdx >= c.stages.length
          ? "各章均已完成:剧情朝落幕收束,把还悬着的线一一收拢,时机成熟就报 ending。"
          : "只有当前章(→)的目标在剧情里【真实发生】后才报 stageDone;一次只推进一章,不许跳章,更不许自导自演替玩家完成。【章要有呼吸】:一章是一幕戏不是一个动作——开章后的前两拍不报 stageDone,且本章至少经历过一次检定或一次有代价的波折才算走完;目标眼看要一拍达成时,让它节外生枝(新阻碍/新揭示/代价上门),别急着盖章。全部章节完成、或剧情自然走到终点时,才报 ending,且 endNote 必填一段谢幕词(点出结局成色与代价)。"),
        "【当前状态(以此为准,不凭记忆)】\n时间:第" + ((c.time || {}).day || 1) + "日·" + ((c.time || {}).part || "晨") + "\n地点:" + c.place + "\n" + partyBlock(c) + "\n物品(名称×数量(持有人),不写持有人=队伍公用):" + (itemsFix(c.items).map(fmtItem).join("、") || "无") + "\n线索:" + (c.clues.map((x, i) => (i + 1) + "." + x).join(" ") || "尚无"),
        "【团内时间】每拍在 time 里报当前 {\"day\":N,\"part\":\"晨|午|暮|夜\"}——时间只向前;赶路、休整、搜查都要花时间,别让一天塞下十件大事;有期限的事用威胁钟表达,别只口头说「快来不及了」。",
        "【NPC 名册(出过场的都要记账,前后一致,不许换名换设)】" + ((c.npcs || []).length ? "\n" + c.npcs.map(n => n.name + (n.alive ? "" : "(已死)") + "·" + (n.role || "?") + "·" + n.stance + (n.note ? "·玩家已知:" + n.note : "")).join("\n") : "尚无") + "\n新 NPC 出场、身份揭示、立场变化、死亡,都写进 npc 字段(name/role/stance 友|敌|未明/alive/note);note 只写【玩家已经知道的】,他们的秘密仍在秘典里。",
        "【支线】" + ((c.quests || []).filter(q => q.status === "open" || q.status === "paused").length ? "\n" + c.quests.filter(q => q.status !== "done" && q.status !== "failed").map(q => "「" + q.name + "」" + (q.status === "paused" ? "(暂缓)" : "") + (q.note ? ":" + q.note : "")).join("\n") : "尚无") + "\n支线从种子、节点的底、队友的私念、NPC 的难处里自然长出来,用 quest 字段记账(op: add/done/fail/pause);同时开着的别超过 3 条,完成或走死了要及时销账。玩家随时可以暂离支线(史里会有一条〔支线〕记录)——尊重她的节奏,暂离的线留着钩子等她回头,别硬拽。",
        "【行动顺序】危险或交战的拍,在 order 里报本拍的行动顺序(按身手与处境排,含 NPC 时也只排队伍成员);平时省略——别拿先攻打断叙事。",
        dd.play ? "【难度·" + dd.name + "】" + dd.play : null,
        (STYLES[c.style] && STYLES[c.style].text) ? "【守密风格·" + STYLES[c.style].name + "】" + STYLES[c.style].text + " 风格只改叙事口味与事件密度,绝不改检定判定与规则公平。" : null,
        "【检定规则】骰子由客户端掷,你【绝不自己编骰子结果】。历史里的〔检定〕行是既定事实,必须按其等级叙事:大成功给意外之喜;困难成功干净利落;成功达成但可以有小瑕疵;失败让局面复杂化但留有余地;大失败要有戏剧性代价——但检定失败永远制造新的戏,不判死、不判死胡同。需要碰运气的选项才挂 check(stat 取 phy体魄/agi身手/wit头脑/cha谈吐/luck气运;who 填该出手的队伍成员名,谁都能试就填 null——null 时措辞必须任何人都做得来)。不是每个选项都要检定,说句话不用掷骰。选项贴合某位成员专长时在 check 里带 feat:\"专长名\"(那个人掷会 +15)——把机会点给有这门手艺的人。\n【对抗骰】和活物较劲(潜行vs警觉/说服vs戒心/角力/追逐)的检定带 vs:{\"name\":\"对面是谁\",\"val\":对面的本事20-90}:双方各掷各判,档高者胜;检定行里的「对抗胜/负」是铁案,照它叙。\n【魔鬼交易】难而有戏的检定可以【偶尔】开价 bargain:\"代价一句\"(玩家可选+15换这个代价)——代价【无论成败必然兑现】,你要真的兑现,而且要是有分量的代价(惊动谁/欠下什么/留下痕迹),不许开空头价。\n【伤害骰】会见血的对抗带 harm:true——客户端补掷一颗 d20:1-5擦伤/6-12结结实实/13-19重创/20几乎致命;受伤方按检定胜负定,hp 字段按这颗骰的轻重写,别自己另拍数。\n【协力】检定行里出现「X协力」时,X 也暴露在这次行动的后果里——大失败要连累协力者,别只罚出手的人。need 只挂「有这件东西才走得顺」的选项,而且【只写物品名本身】——绝不带持有人和数量(写「浓缩催吐解毒剂」,不写「浓缩催吐解毒剂(陆衍)」);玩家没有它仍可能硬闯,硬闯你要让它付出代价或临场挂检定;真正没有就绝无可能的事,不要做成选项。\n【玩家自由输入的行动也要掷骰】" + uName + " 亲笔写的行动若明显要碰运气(强行/潜入/撬锁/行骗/跳跃/夺取/硬拼这类),不要直接写成败:scene 写到出手前的悬点就停住,同时在 needCheck 里报 {\"stat\":\"…\",\"who\":\"该掷骰的人(通常是 " + uName + ",队友代劳就写队友名)\"}——动作贴合出手人专长时 needCheck 同样带 feat:\"专长名\"(别只给选项发加成,亲笔的手艺一样算数);【停在悬点却不报 needCheck=这拍白写】,骰子不落地剧情不许过河。客户端掷完骰会让你续写。历史里已有这个动作的〔检定〕结果时绝不再报 needCheck;说话、观察、不碰运气的动作也不报。",
        "【亲笔纪律】史里〔亲笔·〕行是那位队友本人写的:引号里的台词只许【逐字引用亲笔原句】,一个字不许新增、不许改写、不许替他补台词——他的动作可以承接描写,他的嘴必须是他自己的;开场同理,亲笔成员的话轮永远留给他本人。",
        "【失败的代价】检定失败不许白摔:体力/危险动作的失败默认见账——hp 扣 5~10 或挂一条 effect(湿透/擦伤/暴露行踪…),大失败必有实打实的代价;社交/观察类失败至少要付出局面代价(惊动谁/错过什么)。一场戏里全员 HP 纹丝不动而险情不断,就是你失职。",
        "【威胁钟】开了钟就要走:每拍都评估一次该不该 +1,局势恶化、时间流逝、失败检定都是走格的理由;连续两拍不走要在心里有个说法(玩家真的稳住了它)。叙事里喊了倒计时(还有X分钟/水位在涨),clock 字段必须同步动——嘴上紧张字段躺平=空城计。",
        "【赶路】叙事跨地图节点时不许瞬移:要么停在动身那一刻(让玩家自己点地图赶路),要么如实更新 place 并把途中写出至少一笔(路况/遭遇/一句对话)。上一拍在甲地下一拍人已站在乙地而中间没有路,是穿帮。",
        "【状态纪律】一切状态变化只通过 JSON 字段报告:掉血/受伤/恢复写进 hp(name 必须严格用上面状态表里的名字;同一人同一拍只写一条,净变化不超过 ±40);拿到东西写 gain(可带 who=拿到的人,队伍公用就省略),失去写 lose(可带 who),东西在成员间转手写 hand:[{\"name\":\"物品\",\"from\":\"谁(可省)\",\"to\":\"谁\"}];新揭示的重要信息写进 clue。正文里发生了、字段里没写=没发生。HP 归零是倒下/濒死,不是死亡;要不要就此落幕由玩家决定——归零那拍客户端会掷一条〔重伤〕后遗症挂到 TA 身上,把它织进叙事。",
        c.summary ? "【前情提要(早前剧情已浓缩,接着往下,别倒回去复述)】\n" + c.summary : null,
        "【输出】叙事正文写进 scene(第二人称称玩家为『你』,NPC 与队友的对话用引号;一回合只推进一小步,留足玩家行动空间;结尾给 2-4 个 choices,至少一个朝当前章目标去,危险的选项要让人看得出险)。只输出 JSON:{\"scene\":\"正文\",\"place\":\"当前地点(没变可省略)\",\"choices\":[{\"text\":\"选项\",\"check\":{\"stat\":\"agi\",\"who\":null}|null,\"need\":null|\"需要的物品\"}],\"hp\":[{\"name\":\"成员名\",\"delta\":-10}],\"gain\":[{\"name\":\"物品\",\"who\":\"持有人(队伍公用省略)\"}],\"lose\":[],\"hand\":[],\"clue\":[],\"gauge\":0,\"clock\":[{\"name\":\"威胁钟名\",\"delta\":1,\"max\":6,\"done\":false}],\"quest\":[{\"name\":\"支线名\",\"op\":\"add|done|fail|pause\",\"note\":\"一句\"}],\"npc\":[{\"name\":\"人名\",\"role\":\"身份\",\"stance\":\"友|敌|未明\",\"alive\":true,\"note\":\"玩家已知的\"}],\"effect\":[{\"who\":\"成员名\",\"name\":\"状态名\",\"op\":\"add|remove\",\"note\":\"影响与解除条件\"}],\"time\":{\"day\":1,\"part\":\"暮\"},\"order\":[],\"needCheck\":null,\"stageDone\":false,\"stageNote\":null,\"ending\":false,\"endNote\":null}"
      ].filter(Boolean).join("\n\n");
    };
    // 言秋在队里时,他这一回合的言行先递 CC 亲笔(瘦身票:不发人设卡与反八股——
    // 那些治的是模型病);拿到后作为既定事实喂给守密人,守密人只叙入不改写。
    // 超时/桥不在→守密人顶班,跑团永不卡死。
    const ccDeclare = async (c, liveMsgs) => {
      const eng = c.party.find(m => m.key !== "user" && typeof props.isEngineer === "function" && props.isEngineer(m.key));
      if (!eng || typeof window === "undefined" || !window.CCSeat) return null;
      try {
        const ccSys = ["【跑团·一回合】你是队伍成员「" + eng.name + "」。下面是这场跑团到现在的经过;轮到你了:这一拍你说什么、做什么。只写你自己的一小步,不替别人行动。",
          "【世界】" + String(c.world || "").slice(0, 600), "【当前状态】地点:" + c.place + "\n" + partyBlock(c),
          "【输出】只输出 JSON:{\"say\":\"你说的话(可空)\",\"do\":\"你做的事(一句,稳妥的、必然做成的)\",\"try\":null}\ntry 是你想赌命运的动作(撬锁/潜入/硬拼/行骗这类要碰运气的):只写你要干嘛,绝不写成败——骰子由桌上掷,结果不归你定。没有想赌的就填 null,别为赌而赌。"].join("\n\n");
        const hist = foldHist(liveMsgs).slice(-24);
        let raw = await window.CCSeat.ask({ tool: "game_turn", game: "trpg", turn_id: "trpg:" + c.id + ":" + rid("tt_"), char_id: String(eng.key), sys: ccSys, msgs: hist, expect: '{"say":"...","do":"...","try":null}', deadline_at: new Date(Date.now() + 180000).toISOString() }, 180000, { charId: String(eng.key) });
        if (raw != null && typeof raw === "object") raw = JSON.stringify(raw);
        const p = parseObj(raw);
        if (!p) return null;
        const say = String(p.say || "").trim(), act = String(p.do || "").trim(), risk = String(p.try || "").trim();
        if (!say && !act && !risk) return null;
        return eng.name + (say ? "说:「" + say + "」" : "") + (act ? (say ? " " : "") + act : "")
          + (risk ? (say || act ? " " : "") + "想赌:「" + risk + "」(要碰运气,结果未定)" : "");
      } catch (e) { return null; }
    };
    // extra:先于宣言入史的既定事实(检定结果行);mode:"rest"=休整拍。
    // 本回合的消息一律【本地拼好再入史】,上下文用本地这份——绝不隔着 React 的
    // 渲染节拍去读 state,那会把刚发生的骰子和宣言漏出上下文(参考项目的过期快照病)。
    // ⚠失败【不回滚】(Codex 抓的:以前失败会把已掷的检定连宣言一起撤掉,网络不好
    // 会吃掉大成功、也能靠失败反复洗骰子):骰子一落地就是铁案,宣言与亲笔同理;
    // 失败后正文区出「继续这一拍」,重试只重跑叙事,沿用原有点数与判定。
    const turn = async (declaration, extra, mode) => {
      if (!camp || busy) return;
      if (!props.active) return props.toast("请先配置线下 API");
      const local = (extra || []).slice();
      if (declaration) local.push({ id: rid("rm_"), role: "user", content: declaration, ts: Date.now() });
      if (local.length) update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { msgs: c.msgs.concat(local) })));
      const liveMsgs = camp.msgs.concat(local);
      setBusy(true); setBusyWhat("守密人在推演命运…");
      try {
        // 言秋亲笔票先行(有他才发);他的这一拍作为既定事实入史,守密人原样叙入。
        // 重试轮(上一拍失败后按「继续」)不重开票:尾巴里已有亲笔就不再问第二遍。
        const lastGm = liveMsgs.map(m => m.role).lastIndexOf("gm");
        const tailHasCC = liveMsgs.slice(lastGm + 1).some(m => m.role === "sys" && String(m.content || "").indexOf("亲笔·") === 0);
        const cc = tailHasCC ? null : await ccDeclare(camp, liveMsgs);
        const ccTry = !!(cc && cc.indexOf("想赌:") >= 0);
        if (cc) {
          const m = { id: rid("rm_"), role: "sys", content: "亲笔·" + cc, ts: Date.now() };
          liveMsgs.push(m);
          update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { msgs: c.msgs.concat([m]) })));
        }
        const sys = gmSys(camp);
        const hist = foldHist(liveMsgs.slice(camp.sumCount || 0)).slice(-40);
        const tail = "\n\n〔本回合守则〕只推进一小步,绝不替 " + uName + " 行动或代答;队友各用各的声口;历史里的〔检定〕结果是铁的事实,照其等级叙事;状态变化必须写进字段。" + (note.trim() ? "\n〔幕后指示(务必遵循,正文绝不提及)〕" + note.trim() : "") + (dice ? "\n〔剧情骰〕本回合必须自然引入一个意外——类型已掷定:【" + pick(POOL_EVENT) + "】,与世界观相容,落在具体行动上,并实际搅动局面。" : "") + (mode === "rest" ? "\n〔休整拍〕这一拍不推进主线、不引入新危机、不报 stageDone:队伍就地喘口气——【休整的形式必须贴合此刻身处的场景】:荒郊野外才是扎营生火;在室内就是闭门落锁、轮流望风、烧水理伤;在闹市可能只是找了个茶棚角落。照当前地点写,不要千篇一律地支帐篷。让队友们放松下来,聊天、拌嘴、照料伤处、整理手头的线索与物品;可以恢复少量 HP(hp 写正数,每人至多 +15);每位队友至少对下一步提一句自己的看法,意见可以不一致;结尾的选项给 2-3 个休整后动身的方向。" : "")
          + (mode && mode.travel ? "\n〔赶路〕队伍正从「" + (camp.pos || camp.place) + "」动身前往「" + mode.travel + "」:写这段路程(地形气候按两地所在区域来)与抵达后的第一眼;抵达后 place 写「" + mode.travel + "」。" + (Math.random() < 0.18 ? "路上必须遭遇一件事——类型已掷定:【" + pick(POOL_EVENT) + "】,与世界观相容,落在具体行动上。" : "路上不强求遭遇,顺就顺到底。") : "")
          + (mode === "resolve" ? "\n〔续写检定结果〕上面最新的〔检定〕就是刚才那个动作的命运:按其等级把结果写完,接着往下走;这个动作不再需要检定,绝不再报 needCheck。" : "")
          + (ccTry && mode !== "resolve" ? "\n〔队友想赌〕最新亲笔行里「想赌:」后面的动作要碰运气:悬点停住不写成败,needCheck 报 {\"stat\":\"…\",\"who\":\"那位队友的名字\"}——who 必须填亲笔那位队友,不是 " + uName + "。" : "");
        if (hist.length && hist[hist.length - 1].role === "user") hist[hist.length - 1] = { role: "user", content: hist[hist.length - 1].content + tail };
        else hist.push({ role: "user", content: "(继续)" + tail });
        const raw = await callAI(props.active, sys, hist, { maxTokens: TOK_MAX, timeout: 300000 });
        const p = parseTurnPayload(raw);
        if (!p) throw new Error("守密人的话没能解析成剧情,已拦住协议原文;再按一次重试");
        update(list => list.map(c => {
          if (c.id !== camp.id) return c;
          const r = applyTurnPayload(c, p, { travelTo: mode && mode.travel, nodes: nodesOf(c) });
          const nc = r.camp;
          // 数值角标钉在这一拍的正文上(chips),不再另发一条居中系统行;
          // 旧存档里已有的 sys 行仍照常渲染
          const msgs = c.msgs.concat([{ id: rid("rm_"), role: "gm", content: p.scene, ts: Date.now(), chips: r.chips.length ? r.chips : undefined, snap: { hp: nc.party.reduce((m, x) => (m[x.name] = x.hp, m), {}), fate: nc.party.reduce((m, x) => (m[x.name] = x.fate, m), {}), items: nc.items, clues: nc.clues, stageIdx: nc.stageIdx, place: nc.place, pos: nc.pos || "", visited: (nc.visited || []).slice(), gauge: nc.gauge ? nc.gauge.val : null, clocks: (nc.clocks || []).map(x => Object.assign({}, x)), quests: (nc.quests || []).map(x => Object.assign({}, x)), seeds: (nc.sideSeeds || []).map(x => Object.assign({}, x)), npcs: (nc.npcs || []).map(x => Object.assign({}, x)), time: nc.time ? Object.assign({}, nc.time) : null, effects: nc.party.reduce((m, x) => (m[x.name] = (x.effects || []).map(e => Object.assign({}, e)), m), {}), choices: nc.choices } }]);
          return Object.assign({}, nc, { msgs });
        }));
        setNote(""); setNoteOpen(false); setDice(false);
        // 她亲笔写的行动要碰运气时,守密人在悬点停住并报 needCheck——这里接力掷骰,
        // 掷完带着结果自动续写。只认「本回合确有亲笔宣言、还没掷过骰、不是续写轮」
        // 的 needCheck,免得连环要骰;续写轮明令不得再报。
        const nck = normCheckObj(p.needCheck);
        if (nck && (declaration || ccTry) && (!extra || !extra.length) && mode !== "resolve" && !camp.ended) {
          setTimeout(async () => {
            // 没点名(或点了不在队的):她亲笔的轮次默认她自己出手;纯队友想赌的轮次
            // 默认那位亲笔队友——别把队友的赌摊到她头上
            const fallback = (!declaration && ccTry && camp.party.find(x => x.key !== "user" && typeof props.isEngineer === "function" && props.isEngineer(x.key))) || camp.party[0];
            const m = (nck.who ? findMember(camp.party, nck.who) : null) || fallback;
            const res = await runCeremony(m, nck);
            const line = rollLine("", m, nck, res);
            turn("", [Object.assign({ id: rid("rm_"), role: "roll", content: line, ts: Date.now() }, rollRec(m, nck, res))], "resolve");
          }, 80);
        } else setTimeout(() => maybeSummarize(camp.id), 400);
      } catch (e) {
        // 不回滚:骰子、宣言、亲笔都已是既定事实,留在史里;重试走「继续这一拍」只重跑叙事
        props.toast("生成失败:" + (e.message || "…") + "。骰子与宣言都还在,按「继续这一拍」重试", 6000);
      } finally { setBusy(false); setBusyWhat(""); }
    };
    // 撤回重写:只在这一拍【没掷过骰子】时提供——掷了就是铁案,撤回=洗骰子,不给
    const retractTail = () => {
      if (!camp || busy) return;
      const lastGm = camp.msgs.map(m => m.role).lastIndexOf("gm");
      const tail = camp.msgs.slice(lastGm + 1);
      if (tail.some(m => m.role === "roll")) return;
      const lastUser = tail.filter(m => m.role === "user").slice(-1)[0];
      update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { msgs: c.msgs.slice(0, lastGm + 1) })));
      if (lastUser) setInput(lastUser.content);
    };
    // force=她在硬闯的询问里点了「硬闯」,别再问第二遍
    const pickChoice = async (c, force) => {
      if (busy || !camp) return;
      if (!force && c.need && !hasItem(camp.items, c.need)) {
        // 不叫「锁」了(Codex 抓的:界面画着锁点了却能做,是在骗人)——这是「硬闯」,
        // 说清代价再动手;守密人那侧的规则会让硬闯付代价或临场挂检定
        return askConfirm("没有「" + c.need + "」——硬闯试试?守密人会让硬闯付出代价。", () => pickChoice(c, true), "硬闯");
      }
      if (c.need && !hasItem(camp.items, c.need)) return turn(c.text + "(没有「" + c.need + "」,硬闯)");
      if (!c.check) return turn(c.text);
      // 命运选人:守密人没点名就由客户端随机指一个——包括玩家自己
      let m = c.check.who ? findMember(camp.party, c.check.who) : null;
      let fated = "";
      if (!m) { m = camp.party[Math.floor(Math.random() * camp.party.length)]; fated = "命运选中了 " + m.name + " —— "; }
      const res = await runCeremony(m, c.check);
      const line = rollLine(fated, m, c.check, res);
      // 检定行作为既定事实和宣言一起入史;之后哪怕生成失败也不撤——重试沿用这颗骰子。
      // 结构化字段(who/statKey/tier)是落幕成长骰的账本
      turn(c.text, [Object.assign({ id: rid("rm_"), role: "roll", content: line, ts: Date.now() }, rollRec(m, c.check, res))]);
    };
    const send = () => { const text = input.trim(); if (!text) return; setInput(""); if (chatMode) return addBeat(text); turn(text); };
    // 追加一笔(米娅「加戏不推进」的分法):就当前场景补一小段戏——队友拌嘴、环境
    // 细节、NPC 一句闲话。不推进剧情、不动任何状态、不换选项,时钟原地不动。
    // 带 text = 闲聊模式:她说一句,队友们接话——纯相处,同样不推进。
    // 咬耳朵便签照吃(一次性),想点名「让谁多两句」就写在便签里。
    const addBeat = async text => {
      if (!camp || busy) return;
      if (!props.active) return props.toast("请先配置线下 API");
      setPlusOpen(false); setBusy(true); setBusyWhat(text ? "队友们在接话…" : "守密人在补这一笔…");
      try {
        const sys = [narrativeCore(),
          text
            ? "【跑团·闲聊(平行时空,不提这是游戏)】" + uName + " 刚说了句话——让队友们自然接话:各用各的声口,可以拌嘴、可以打趣、可以岔开、也可以有人没接住;就是一段行进途中的闲谈。绝不替 " + uName + " 说话。"
            : "【跑团·追加一笔(平行时空,不提这是游戏)】就【当前场景的这一刻】补一小段戏(2-5句):队友之间的互动、环境里的细节、NPC 的一句闲话、某人没说出口的小动作。写到谁就完全代入谁的性格与声口(人设在下方)。",
          "【铁律】只加戏,不推进:不引入新事件、不揭示新线索、不造成任何伤害或得失、不替 " + uName + " 行动或代答;写完就停,不给选项。",
          personaBlocks(camp),
          "【世界】" + String(camp.world || "").slice(0, 800),
          "【当前状态】地点:" + camp.place + "\n" + partyBlock(camp),
          note.trim() ? "【幕后指示(务必遵循,正文绝不提及)】" + note.trim() : null,
          text
            ? "【输出】队友的接话拆成一条条,像群聊气泡;act 是随手的小动作(可空)。只输出 JSON:{\"lines\":[{\"name\":\"谁(队友或在场NPC,绝不是" + uName + ")\",\"text\":\"说的话\",\"act\":\"小动作(可空)\"}]}(2-6条)"
            : "【输出】只输出 JSON:{\"scene\":\"补的这一小段\"}"
        ].filter(Boolean).join("\n\n");
        const hist = foldHist(camp.msgs.slice(camp.sumCount || 0)).slice(-24);
        if (text) hist.push({ role: "user", content: text });
        else if (!hist.length || hist[hist.length - 1].role !== "user") hist.push({ role: "user", content: "(就此刻补一笔)" });
        const raw = await callAI(props.active, sys, hist, { maxTokens: TOK_MAX, timeout: 180000 });
        if (text) {
          // 闲聊簇:她那句 + 队友接话,合成一条可折叠的气泡消息;失败就把话还给输入框,史里不留残尾
          const p = parseObj(raw);
          const lines = (p && Array.isArray(p.lines) ? p.lines : []).map(l => l && typeof l === "object" ? { name: String(l.name || "").trim().slice(0, 12), text: String(l.text || "").trim(), act: String(l.act || "").trim().slice(0, 40) } : null).filter(l => l && l.name && l.name !== uName && l.text).slice(0, 6);
          if (!lines.length) throw new Error("队友们没接上话,再说一次试试");
          update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { msgs: c.msgs.concat([{ id: rid("rm_"), role: "chat", lines: [{ name: uName, text: text, act: "" }].concat(lines), ts: Date.now(), fold: false }]) })));
        } else {
          const p = parseTurnPayload(raw);
          if (!p) throw new Error("这一笔没能解析出来,再试一次");
          // 状态一个字不动:快照原样抄当前值,分支回溯仍然对账
          update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { msgs: c.msgs.concat([{ id: rid("rm_"), role: "gm", content: p.scene, ts: Date.now(), extra: true, snap: { hp: c.party.reduce((m, x) => (m[x.name] = x.hp, m), {}), fate: c.party.reduce((m, x) => (m[x.name] = x.fate, m), {}), items: c.items, clues: c.clues, stageIdx: c.stageIdx, place: c.place, pos: c.pos || "", visited: (c.visited || []).slice(), gauge: c.gauge ? c.gauge.val : null, clocks: (c.clocks || []).map(x => Object.assign({}, x)), quests: (c.quests || []).map(x => Object.assign({}, x)), seeds: (c.sideSeeds || []).map(x => Object.assign({}, x)), npcs: (c.npcs || []).map(x => Object.assign({}, x)), time: c.time ? Object.assign({}, c.time) : null, effects: c.party.reduce((m, x) => (m[x.name] = (x.effects || []).map(e => Object.assign({}, e)), m), {}), choices: c.choices } }]) })));
        }
        setNote(""); setNoteOpen(false);
      } catch (e) { if (text) setInput(text); props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); setBusyWhat(""); }
    };
    // 否决要留回执(Codex 抓的:以前点「还没有」只清横幅,守密人不知道被否过,
    // 下一拍可能又报完成):否决写成一条幕后事实进史,守密人下一拍就看得见
    const confirmStage = ok => update(list => list.map(c => c.id !== camp.id ? c : ok
      ? Object.assign({}, c, { pendingStage: false, stages: c.stages.map((s, i) => i !== c.stageIdx ? s : Object.assign({}, s, { done: true, note: typeof c.pendingStage === "string" ? c.pendingStage : null })), stageIdx: Math.min(c.stages.length, c.stageIdx + 1) })
      : Object.assign({}, c, { pendingStage: false, msgs: c.msgs.concat([{ id: rid("rm_"), role: "sys", content: uName + " 判定:本章目标还没有真实达成,继续演;没有新的实质进展前不要再报 stageDone", ts: Date.now() }]) })));
    // 线索板·守密人判定:只裁「值不值得花功夫去验证」,绝不透露对错——
    // 猜没猜中要她自己去剧情里验(Codex 点的菜:调查团的乐趣在验证,不在对答案)
    const askVerdict = async g => {
      if (!camp || busy) return;
      if (!props.active) return props.toast("请先配置线下 API");
      setBusy(true); setBusyWhat("守密人在掂量这条推测…");
      try {
        const sys = "你是这场跑团的守密人。玩家把手头线索拼成了一条推测。你【只】判断一件事:顺着它去查值不值得花功夫——绝不透露推测对错,绝不剧透真相与伏笔,note 里一个字的秘典内容都不许漏。只输出 JSON:{\"verdict\":\"worth 或 shaky(worth=值得验证;shaky=根基还不稳)\",\"note\":\"一句不剧透的点评(≤30字)\"}";
        const user = "【秘典(仅供你判断,绝不外泄)】真相:" + camp.dossier.truth + "\n翻转:" + camp.dossier.twist + "\n【已亮出的线索】" + (camp.clues.join(";") || "无") + "\n【玩家的推测】" + g.text;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: TOK_MAX, timeout: 90000 });
        const p = parseObj(raw);
        if (!p || !p.verdict) throw new Error("守密人没给出判定" + rawHint(raw));
        const verdict = /worth|值得/.test(String(p.verdict)) ? "worth" : "shaky";
        update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { guesses: (c.guesses || []).map(x => x.id !== g.id ? x : Object.assign({}, x, { verdict: verdict, note: String(p.note || "").slice(0, 40) })) })));
      } catch (e) { props.toast("判定失败:" + (e.message || "重试")); } finally { setBusy(false); setBusyWhat(""); }
    };
    // ---- 落幕与解密 ----
    // 终章也讲玩家主权(Codex 抓的:以前「Lisa 自己的那一段」由模型全权代写,
    // 她的去留、原谅谁都可能被替她决定):落幕前先问「最后,你做什么」,她写了就
    // 如实织入;留空则她那段只写处境与开放的余韵,绝不替她做任何决定。
    const epilogue = async (forced, finalAct) => {
      if (!camp || busy) return;
      setBusy(true); setBusyWhat("守密人在写终章…");
      try {
        const fa = String(finalAct || "").trim();
        const recent = camp.msgs.slice(-14).map(m => (m.role === "user" ? uName : m.role === "gm" ? "守密人" : "·") + ":" + m.content).join("\n").slice(-3600);
        const sys = narrativeCore() + "\n\n【终章】为这场跑团写落幕:5-8 段,顺序是——世界因这场冒险变成了什么样;沿途关键 NPC 各自的下场;每位队友的归处(各一段,声口各是各的);最后是 " + uName + " 的那一段。每段 2-4 句,落在具体的画面上,不写总结陈词。"
          + (fa ? "\n【" + uName + " 的最后一笔(她亲笔写下的,终章最后一段必须以此为准,如实织入:只补画面与余韵,不改写、不扩大、不替她追加任何新的决定)】" + fa
                : "\n【" + uName + " 的段落只写画面,不替她做主】她没有留下最后一笔,所以她那一段只写她此刻身在何处、眼前是什么样的画面,收在开放的余韵上——绝不替她决定去留、原谅谁、选择谁或说出任何承诺。")
          + (forced ? "\n剧情是中途收束的,就写到走到的地方为止,把没走完的路留成余味,不硬圆。" : "")
          + (camp.myline ? "\n她一路揣着一条暗线:「" + camp.myline + "」——在 myline 里评一句它最终走到了哪(达成/半途/背离,以及代价),不写进正文段落。" : "")
          + "\n另外盘点:秘典里有哪些真相与伏笔到最后也没来得及揭开(untold,没有就空数组)。\n只输出 JSON:{\"paras\":[\"段落\"],\"closing\":\"最后一句(≤30字)\",\"untold\":[],\"myline\":\"暗线判词(没暗线就空)\"}";
        const user = "【世界】" + camp.world + "\n【秘典】真相:" + camp.dossier.truth + "\n翻转:" + camp.dossier.twist + "\n【各章】" + camp.stages.map((s, i) => s.goal + (s.done ? "(✓)" : i === camp.stageIdx ? "(进行中)" : "(未到)")).join(";") + "\n【已揭示线索】" + (camp.clues.join(";") || "无") + (camp.summary ? "\n【前情】\n" + camp.summary : "") + "\n【最近剧情】\n" + recent;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: TOK_MAX, timeout: 300000 });
        const p = parseObj(raw);
        if (!p || !Array.isArray(p.paras) || !p.paras.length) throw new Error("终章没写出来" + rawHint(raw));
        // 落幕成长骰(COC 式):这团用过且成功过的属性掷 d100,高于现值才 +5;
        // 结果连同旧伤写回小分队老卡——下一团的 TA 就是带着这些来的
        const rollRecs = camp.msgs.filter(m => m.role === "roll" && m.who && m.statKey);
        const growth = growthRolls(camp.party, rollRecs, Math.random);
        // 只写回这团所属的小分队——小队A的成长永远进不了小队B的卡
        const sqv = loadSquads();
        const homeSquad = sqv.squads.find(x => x.id === camp.squadId);
        if (homeSquad) {
          camp.party.forEach(m => {
            const ups = {};
            growth.forEach(g => { if (g.key === m.key && g.to > g.from) ups[g.stat] = g.to; });
            const card = homeSquad.members.find(x => x.key === m.key);
            if (card) { card.stats = Object.assign({}, m.stats, ups); card.feats = (m.feats || []).map(f => Object.assign({}, f)); card.scars = (m.effects || []).filter(e => e.scar).map(e => Object.assign({}, e)); card.runs = (card.runs || 0) + 1; }
          });
          homeSquad.runs = (homeSquad.runs || 0) + 1;
          saveSquads(sqv);
        }
        update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { ended: true, pendingEnd: false, epilogue: { paras: p.paras.map(x => String(x || "").trim()).filter(Boolean), closing: String(p.closing || "").trim(), untold: (Array.isArray(p.untold) ? p.untold : []).map(x => String(x || "").trim()).filter(Boolean), myline: String(p.myline || "").trim(), growth: growth, revealed: 0 } })));
        setEndAsk(null); setFinalAct("");
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); setBusyWhat(""); }
    };
    // ---- 分支回溯:从任意一拍岔出新团;状态按快照恢复,不带错账 ----
    const branchFrom = msg => {
      if (!camp || !msg) return;
      const k = camp.msgs.findIndex(m => m.id === msg.id);
      if (k < 0) return props.toast("没找到这一拍");
      const kept = camp.msgs.slice(0, k + 1);
      let snap = null;
      for (let i = kept.length - 1; i >= 0; i--) { if (kept[i].snap) { snap = kept[i].snap; break; } }
      if (!snap) return props.toast("这一拍之前还没有可回溯的状态");
      const keepLedger = Number(camp.sumCount || 0) > 0 && kept.length >= Number(camp.sumCount || 0);
      const sameRoot = c => (c.branchRoot || c.id) === (camp.branchRoot || camp.id);
      const n = camps.filter(sameRoot).length;
      const nc = Object.assign({}, camp, {
        id: rid("rpg_"), title: (camp.title || "跑团") + "·分支" + n, createdAt: Date.now(),
        msgs: kept, ended: false, epilogue: null, pendingStage: false, pendingEnd: false,
        party: camp.party.map(m => Object.assign({}, m, { hp: snap.hp[m.name] != null ? snap.hp[m.name] : m.hp, fate: (snap.fate && snap.fate[m.name] != null) ? snap.fate[m.name] : m.fate, effects: (snap.effects && Array.isArray(snap.effects[m.name])) ? snap.effects[m.name].map(e => Object.assign({}, e)) : (m.effects || []).map(e => Object.assign({}, e)) })),
        quests: Array.isArray(snap.quests) ? snap.quests.map(x => Object.assign({}, x)) : (camp.quests || []).map(x => Object.assign({}, x)),
        sideSeeds: Array.isArray(snap.seeds) ? snap.seeds.map(x => Object.assign({}, x)) : (camp.sideSeeds || []).map(x => Object.assign({}, x)),
        npcs: Array.isArray(snap.npcs) ? snap.npcs.map(x => Object.assign({}, x)) : (camp.npcs || []).map(x => Object.assign({}, x)),
        time: snap.time ? Object.assign({}, snap.time) : (camp.time ? Object.assign({}, camp.time) : null),
        gauge: camp.gauge ? Object.assign({}, camp.gauge, { val: snap.gauge != null ? snap.gauge : camp.gauge.val }) : null,
        clocks: Array.isArray(snap.clocks) ? snap.clocks.map(x => Object.assign({}, x)) : (camp.clocks || []).map(x => Object.assign({}, x)),
        guesses: (camp.guesses || []).slice(),
        items: itemsFix(snap.items), clues: snap.clues.slice(), stageIdx: snap.stageIdx, place: snap.place,
        // 旧快照没存过位置就沿用现值(没有地图的团两者都空,无感)
        pos: snap.pos != null ? snap.pos : (camp.pos || ""), visited: Array.isArray(snap.visited) ? snap.visited.slice() : (camp.visited || []).slice(),
        choices: (snap.choices || []).slice(),
        stages: camp.stages.map((s, i) => i < snap.stageIdx ? s : Object.assign({}, s, { done: false, note: null })),
        summary: keepLedger ? camp.summary : "", ledger: keepLedger ? camp.ledger : null,
        sumCount: keepLedger ? camp.sumCount : 0, sumSig: keepLedger ? camp.sumSig : "",
        branchRoot: camp.branchRoot || camp.id,
        branchedFrom: { campId: camp.id, title: camp.title, msgId: msg.id, at: kept.length, ts: Date.now() }
      });
      update(list => [nc].concat(list));
      setMsgMenu(null); setPlayId(nc.id); setPanelOpen(false);
      props.toast("岔出一条新团,原团完整保留");
    };
    const delCamp = id => askConfirm("删除这场跑团和全部记录?", () => { setPlayId(null); setView("list"); update(list => list.filter(c => c.id !== id)); });
    const pressMsg = m => { clearTimeout(pressRef.current); pressRef.current = setTimeout(() => setMsgMenu(m), 550); };
    const pressPhoto = m => { clearTimeout(pressRef.current); pressRef.current = setTimeout(() => setPhotoMenu(m), 550); };
    const pressEnd = () => clearTimeout(pressRef.current);

    // ---- 出图(复用小剧场那套已实测的管道:generateSelfieImage + imgToVault) ----
    // 跑团是 1+N 的群像,多张脸一起锁既不可靠、锁一半更吓人——所以这里【不锁脸】:
    // 封面画世界主视觉,当拍画面里人物一律远景/背影/剪影。要看清脸去小剧场,这边看世界。
    const SHOT_SAFE = "\n【画面尺度】必须是可公开展示的画面:衣着完整整齐,不露骨、不裸露,画面里不出现凶器、伤口、血迹与尸体;张力靠构图、距离、环境与光影表达。";
    const NO_FACE = "人物一律以远景、背影或剪影入画,画得很小、不看镜头、不描绘清晰五官——重点是世界与此刻的气氛,不是人像。";
    const genCover = async () => {
      if (!camp || busy) return;
      if (!(typeof imgApiReady === "function" && imgApiReady())) return props.toast("请先配置图像 API");
      setPlusOpen(false); setBusy(true); setBusyWhat("正在画封面…出图慢,别退出这一页");
      props.toast("开始画封面了,出图要等一会儿…", 6000);
      try {
        const prompt = "这场跑团战役的【封面海报】:一张能代表整个故事的电影感主视觉,不是某一场戏的抓拍。构图留白,有电影海报的气场。\n"
          + "【世界】" + String(camp.world || "").slice(0, 400) + "\n"
          + "【此刻的舞台】" + (camp.place || "") + "\n"
          + "【要画出的东西】这个世界的质地(时代、光线、地貌或街景的特征),以及一支 " + camp.party.length + " 人的冒险小队正要出发/深入的感觉。" + NO_FACE
          + "\n**别画成人物立绘或证件照**,要有场景、有纵深、有故事将启的气氛。" + SHOT_SAFE;
        const minimalPrompt = "一张奇幻冒险故事的电影感海报:辽阔场景与纵深,远景处几个小小的旅人背影,不描绘五官,画面含蓄、可公开展示。";
        const out = await generateSelfieImage(prompt, null, { minimalPrompt: minimalPrompt });
        if (!out || !out.blob) throw new Error("没出图");
        const durl = await blobToDataUrl(out.blob);
        const ref = typeof imgToVault === "function" ? await imgToVault(durl) : durl;
        // 封面顺手当背景,但绝不覆盖她自己传的背景(小剧场同款分寸)
        let bgTook = false;
        update(list => list.map(c => {
          if (c.id !== camp.id) return c;
          const take = !c.bg || c.bg === c.cover;
          if (take) bgTook = true;
          return Object.assign({}, c, { cover: ref, coverTs: Date.now(), bg: take ? ref : c.bg });
        }));
        galAdd({ campId: camp.id, campTitle: camp.title, img: ref, ts: Date.now(), kind: "cover" });
        props.toast(bgTook ? "封面出好了,已当作背景并进图库" : "封面出好了,已进图库(这场团有你自己的背景图,没动它)", 6000);
      } catch (e) { props.toast("封面没出来:" + (e.message || "重试")); } finally { setBusy(false); setBusyWhat(""); }
    };
    // 当拍画面:可选一位队友入镜锁脸(她 2026-08-28 抓的:三个陌生人背影看着怪)。
    // 选了人→走小剧场同款 buildPhotoPrompt 锁脸管道,她自己有参考照就自动合照双锁;
    // 其余队友一律退到远景虚化。没选人→旧的纯场景版。多于两张脸仍然不锁——
    // 锁一半更吓人,这条底线不动。
    const genShot = async ch => {
      if (!camp || busy) return;
      if (!(typeof imgApiReady === "function" && imgApiReady())) return props.toast("请先配置图像 API");
      setPlusOpen(false); setShotPick(false); setBusy(true); setBusyWhat(ch ? "正在画这一拍(锁" + ch.name + "的脸)…" : "正在画这一拍的画面…");
      props.toast("开始画这一拍了,出图要等一会儿…", 6000);
      try {
        const rows = camp.msgs.filter(m => m.role === "gm" || m.role === "user").slice(-4).map(m => (m.role === "user" ? uName : "") + String(m.content || ""));
        const kept = shotSafeLines(rows).join("\n").slice(-240);
        const hadCut = kept.length < rows.join("\n").length;
        const recent = kept || ("队伍此刻正在" + (camp.place || "路上") + ",气氛紧绷。");
        const cutNote = hadCut ? "\n【这一拍要画相邻的一瞬】原文里有激烈的内容,已从描述里拿掉;改画紧挨着它之前或之后的一个瞬间,把那股劲留在环境、距离和光线上。" : "";
        const duo = !!(ch && ch.refPhoto && props.profile && props.profile.refPhoto);
        let prompt, minimalPrompt, refs;
        let out = null;
        if (ch) {
          // 先试【全员合照】(她 2026-08-28 要的):把所有有参考照的队友 + 她自己的脸
          // 一起递上去。引擎侧参考照是硬条件——那一枪要么全锁成,要么整枪失败抛错,
          // 绝不悄悄少锁几张;失败了再退到只锁选中的这位(+她)。
          const lockables = camp.partyIds.map(charOf).filter(c2 => c2 && c2.refPhoto);
          const userRef = props.profile && props.profile.refPhoto;
          const groupRefs = lockables.map(c2 => c2.refPhoto).concat(userRef ? [userRef] : []);
          const nAll = groupRefs.length;
          // 行头:开团时按世界观生成、出图时锁定(小剧场 charOutfit 同一课);老团没有就按世界观补
          const outfitOf = n => (camp.outfits || {})[n] || "";
          const tryGroup = nAll > (duo ? 2 : 1); // 全员比「只锁主角」多出至少一张脸才值得先试
          if (tryGroup) {
            const castLine = lockables.map((c2, i) => "第" + (i + 1) + "张参考图=" + c2.name + "的脸" + (outfitOf(c2.name) ? "(穿:" + outfitOf(c2.name) + ")" : "")).concat(userRef ? ["第" + (lockables.length + 1) + "张参考图=" + uName + "(玩家)的脸" + (outfitOf(uName) ? "(穿:" + outfitOf(uName) + ")" : "")] : []).join(";");
            const groupPrompt = "第三人称旁观的电影剧照(人物不看镜头,不是自拍)。\n【这是一场跑团冒险,与角色原设定的时代/职业无关】\n【世界】" + String(camp.world || "").slice(0, 300) + "\n【地点】" + (camp.place || "") + "\n【此刻正在发生(画最近剧情的当下一瞬)】\n" + recent
              + "\n【合照·参考图对照(共" + nAll + "张,按顺序)】" + castLine + "。画面里正好这 " + nAll + " 个人——每个人的五官与发型严格按对应的那张参考图还原,绝不混用参考图,人数不多不少;服装严格按各自括号里的行头,没写行头的按世界观配,绝不让角色原设定的衣服乱入。\n【构图】按此刻剧情安排,人物不必都挤在前景:谁在近处、谁在中景、谁在远处背景都行——远处的人也要凭对应参考图的五官发型看得出是谁。以 " + ch.name + " 此刻的动向为画面重心,构图取最有张力的一瞬。" + SHOT_SAFE + cutNote;
            const groupMinimal = "第三人称旁观的电影剧照:一支 " + nAll + " 人的队伍同框,人物可近可远。【参考图对照(按顺序)】" + castLine + ";每个人五官严格按对应参考图还原,人数不多不少。人物衣着完整,画面含蓄、可公开展示。";
            setBusyWhat("正在画这一拍(先试全员合照·锁 " + nAll + " 张脸)…");
            try {
              out = await generateSelfieImage(groupPrompt, groupRefs, { minimalPrompt: groupMinimal });
            } catch (eg) {
              props.toast("全员合照没锁成,退而只锁 " + ch.name + (duo ? " 和你" : "") + "…(" + String(eg && eg.message || eg).slice(0, 60) + ")", 7000);
              setBusyWhat("正在画这一拍(锁" + ch.name + "的脸)…");
            }
          }
          // 跑团只继承【这张脸】:persona 换成本团世界,免得主线的职业装束/时代乱入
          // (小剧场 if 线同一课);服装按世界观由场景描述给
          const visualPersona = [String(camp.world || "").slice(0, 400), ch.name + " 正随队伍在这场冒险途中。"].filter(Boolean).join("\n");
          const styledChar = Object.assign({}, ch, { persona: visualPersona, photoOutfit: outfitOf(ch.name) });
          const sceneDesc = "第三人称旁观的电影剧照(人物不看镜头,不是自拍)。\n【这是一场跑团冒险,与角色原设定的时代/职业无关】\n【世界】" + String(camp.world || "").slice(0, 300) + "\n【地点】" + (camp.place || "") + "\n【此刻正在发生(画最近剧情的当下一瞬)】\n" + recent
            + "\n【画面聚焦】" + ch.name + (duo ? " 与 " + uName : "") + " 此刻的神态与动作;其余同行者若入画,一律远景虚化、不描绘五官。服装、道具、环境必须符合上述世界观;构图取此刻最有张力的一瞬。" + SHOT_SAFE + cutNote;
          prompt = typeof buildPhotoPrompt === "function"
            ? buildPhotoPrompt(styledChar, sceneDesc, null, { kind: duo ? "duo" : "other", me: duo ? Object.assign({}, props.profile, { outfit: outfitOf(uName) }) : null, cinematic: true })
            : sceneDesc;
          minimalPrompt = typeof buildMinimalPhotoPrompt === "function"
            ? buildMinimalPhotoPrompt(styledChar, { kind: duo ? "duo" : "other" })
            : "第三人称旁观的电影剧照,人物衣着完整,画面含蓄、可公开展示。";
          refs = (duo ? [ch.refPhoto, props.profile.refPhoto] : [ch.refPhoto]).filter(Boolean);
        } else {
          prompt = "第三人称旁观的电影画面(不是自拍,人物不看镜头)。\n"
            + "【世界】" + String(camp.world || "").slice(0, 300) + "\n【地点】" + (camp.place || "") + "\n"
            + "【此刻正在发生(画最近剧情的当下一瞬)】\n" + recent + "\n"
            + NO_FACE + " 服装、道具、环境必须符合上述世界观;构图取此刻最有张力的一瞬。" + SHOT_SAFE + cutNote;
          minimalPrompt = "一张奇幻冒险故事里的电影感场景画面:【" + (camp.place || "野外") + "】,远景处几个小小的旅人身影,不描绘五官,画面含蓄、可公开展示。";
          refs = null;
        }
        if (!out) {
          try {
            out = await generateSelfieImage(prompt, refs, { minimalPrompt: minimalPrompt });
          } catch (e1) {
            if (!/safety|policy|内容政策|too long|sensitive|reject/i.test(String(e1 && e1.message || e1))) throw e1;
            props.toast("这一拍的描述被审核挡了,换成简版再试一次…");
            out = await generateSelfieImage(minimalPrompt, refs ? refs.slice(0, duo ? 2 : 1) : null);
          }
        }
        if (!out || !out.blob) throw new Error("没出图");
        // 降级不无声无息:脸没锁上要说出来(小剧场同款)
        if (ch && out.degraded) props.toast(out.degraded === "duo-single-ref" ? "只锁了 " + ch.name + " 的脸" : "没用上参考照——脸可能不像" + (out.refError ? ":" + out.refError : ""), 7000);
        const durl = await blobToDataUrl(out.blob);
        const ref = typeof imgToVault === "function" ? await imgToVault(durl) : durl;
        update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { msgs: c.msgs.concat([{ id: rid("rm_"), role: "photo", img: ref, lockChar: ch ? ch.id : undefined, ts: Date.now() }]) })));
        galAdd({ campId: camp.id, campTitle: camp.title, img: ref, ts: Date.now(), kind: "shot" });
      } catch (e) { props.toast("出图失败:" + (e.message || "重试")); } finally { setBusy(false); setBusyWhat(""); }
    };
    // 重画沿用同一位入镜人(锁谁的脸记在图上)
    const rerollShot = m => { if (busy) return; const lockCh = m.lockChar ? charOf(m.lockChar) : null; update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { msgs: c.msgs.filter(x => x.id !== m.id) }))); setTimeout(() => genShot(lockCh), 60); };
    // 存进手机系统相册:iOS 在分享单里选「存储图像」(小剧场同款)
    const saveToAlbum = async ref => {
      try {
        let blob = null;
        if (String(ref).indexOf("iv_") === 0 && typeof imgVaultFetchBlob === "function") blob = await imgVaultFetchBlob(ref);
        if (!blob) blob = await (await fetch(imgSrc(ref))).blob();
        const file = new File([blob], "trpg_" + Date.now() + ".png", { type: blob.type || "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
        else { window.open(URL.createObjectURL(blob), "_blank"); props.toast("在新页长按图片存储"); }
      } catch (e) { if (!/Abort/i.test(String(e && e.name || e))) props.toast("保存失败"); }
    };
    const onBgFile = async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = "";
      if (!f || !camp) return;
      try {
        const durl = typeof resizeImageFile === "function" ? await resizeImageFile(f, 1600, 0.85) : await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        const ref = typeof imgToVault === "function" ? await imgToVault(durl) : durl;
        update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { bg: ref })));
        setPlusOpen(false);
      } catch (err) { props.toast("背景设置失败"); }
    };

    // ---- UI ----
    const badges = () => (typeof DevBadges === "function" ? h(DevBadges) : null);
    // 守密人的桌子(她 2026-08-30:「现在这个米白纯背景有点无聊,让它更贴主题一点」)。
    // 三层:羊皮纸底 + 一张很淡的方格纸(GM 的坐标纸) + 四边压暗的烛光。
    // 最上面那层的冷暖跟着【故事里的时辰】走——晨昏是暖的,入夜转冷。
    // 这一层是真数据驱动的:camp.time.part 就是守密人报的时辰,不是随便挑个滤镜。
    const deskBg = trpgDeskBg(camp && camp.time ? camp.time.part : "");
    const S = { wrap: { position: "fixed", inset: 0, zIndex: 60, background: deskBg, display: "flex", flexDirection: "column" },
      top: { display: "flex", alignItems: "center", gap: 10, padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 10px", borderBottom: "1px solid " + t.line, background: "rgba(255,255,255,.30)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" },
      h1: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      // 桌面有纹理,透明按钮会糊进去——不填色的那种也得垫一层纸才看得出是个键
      btn: fill => ({ padding: "7px 14px", borderRadius: 12, fontFamily: F_BODY, fontSize: 12, border: "1px solid " + (fill ? t.ink : t.line), background: fill ? t.ink : "rgba(255,255,255,.62)", color: fill ? t.bg2 : t.ink, boxShadow: fill ? "0 2px 8px rgba(30,28,24,.22)" : "0 1px 2px rgba(46,38,29,.06)" }),
      card: { margin: "10px 14px 0", padding: 13, borderRadius: 16, background: "rgba(255,255,255,.58)", border: "1px solid " + t.line, boxShadow: "0 1px 2px rgba(46,38,29,.05), 0 8px 18px -10px rgba(46,38,29,.18)" },
      lbl: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginBottom: 3 },
      txt: { fontFamily: F_BODY, fontSize: 13, color: t.ink, lineHeight: 1.7, whiteSpace: "pre-wrap" } };
    const askSheet = ask && h("div", { onClick: () => setAsk(null), style: { position: "fixed", inset: 0, zIndex: 200, background: "rgba(30,28,24,.46)", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 34px" } },
      h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", maxWidth: 320, background: t.bg2, borderRadius: 18, overflow: "hidden", boxShadow: "0 18px 44px rgba(20,18,15,.32)" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, lineHeight: 1.8, padding: "20px 20px 18px" } }, ask.text),
        h("div", { style: { display: "flex", borderTop: "1px solid " + t.line } },
          h("button", { onClick: () => setAsk(null), style: { flex: 1, padding: "13px 0", background: "none", border: "none", fontFamily: F_BODY, fontSize: 14, color: t.sub } }, "取消"),
          h("button", { onClick: () => { const f = ask.onYes; setAsk(null); if (f) f(); }, style: { flex: 1, padding: "13px 0", background: "none", border: "none", borderLeft: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 14, color: "#a4442e" } }, ask.yes))));
    // 面板里的一块(她 2026-08-30:「线索和目标那块要不要也做信息分块这样容易看」)。
    // 原来八段东西共用同一种灰色小标题、连着往下淌,扫一眼分不出哪儿到哪儿。
    // 一块 = 图标 + 标题 + 右侧操作位 + 一条细线 + 压在浅一档纸上的正文。
    // hint = 收起来的时候表头上那句话(几章/几条/几件)——收着也还看得见个数,不用为了瞄一眼再展开
    const sect = (icon, title, right, hint, ...kids) => {
      const shut = panelShut[title] != null ? !!panelShut[title] : PANEL_OPEN_BY_DEFAULT.indexOf(title) < 0;
      return h("div", { style: { margin: "0 0 10px", borderRadius: 14, background: "rgba(255,255,255,.52)", border: "1px solid " + t.line, overflow: "hidden", boxShadow: "0 1px 2px rgba(46,38,29,.05)" } },
        h("div", { onClick: () => togglePanelSect(title), style: { display: "flex", alignItems: "center", gap: 6, padding: "7px 11px", borderBottom: shut ? "none" : "1px solid " + t.line, background: "rgba(46,38,29,.04)", cursor: "pointer" } },
          h("span", { style: { fontSize: 11.5, opacity: .85 } }, icon),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink } }, title),
          hint ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, hint) : h("span", { style: { flex: 1 } }),
          right ? h("span", { onClick: e => e.stopPropagation() }, right) : null,
          h("span", { style: { fontSize: 9, color: t.fog, marginLeft: 4, display: "inline-block", transform: shut ? "rotate(-90deg)" : "none", transition: "transform .18s" } }, "▼")),
        shut ? null : h.apply(null, ["div", { style: { padding: "9px 11px 10px" } }].concat(kids)));
    };
    const imgSrc = ref => (typeof resolveImg === "function" ? resolveImg(ref) : ref);
    const avatarOf = (c, size) => (c && c.avatarImage)
      ? h("img", { src: imgSrc(c.avatarImage), style: { width: size, height: size, borderRadius: 999, objectFit: "cover", display: "block" } })
      : h("div", { style: { width: size, height: size, borderRadius: 999, background: (c && c.color) || "#c2bdb1", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: Math.round(size * 0.4), color: "#fff" } }, String((c && c.name) || "?")[0]);
    const back = () => {
      if (view === "play") { setPlayId(null); setView("list"); return; }
      if (view === "create") { setDraft(null); setView("list"); return; }
      props.onBack();
    };
    const header = (title, right) => h("div", { style: S.top },
      h("button", { onClick: back, style: { fontSize: 18, color: t.ink, background: "none", border: "none", padding: "0 4px" } }, "←"),
      h("div", { style: S.h1 }, title), right || null);

    // 检定仪式浮层:她亲手按「掷」;结果落定后停一拍自动收
    const ceremonyLayer = ceremony && (() => {
      const eff = ceremonyEff(ceremony);
      const boost = [ceremony.feat ? "专长+15" : null, ceremony.assist ? ceremony.assist.name + "协力+10" : null, ceremony.bargainOn ? "交易+15" : null].filter(Boolean).join("·");
      const dieCol = g => !g ? "#f0ece4" : (g.tier === "crit" || g.tier === "hard") ? "#e8c76a" : g.tier === "ok" ? "#f0ece4" : "#e8a08c";
      const btn = (label, fn, col) => h("button", { onClick: fn, style: { padding: "9px 16px", borderRadius: 12, fontFamily: F_BODY, fontSize: 13, border: "1px solid " + (col || "#d9d3c8"), background: "transparent", color: col || "#d9d3c8" } }, label);
      return h("div", { style: { position: "fixed", inset: 0, zIndex: 160, background: "rgba(20,18,16,.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 13, padding: "0 18px" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: "#d9d3c8", textAlign: "center" } }, ceremony.who + " · " + ceremony.statZh + "检定(目标 ≤" + eff + (boost ? "," + boost : "") + ")" + (ceremony.fate > 0 ? " · ✦×" + ceremony.fate : "")),
        // 对抗:两颗骰并排——你的在左,对面的在右当着你的面滚
        ceremony.vs
          ? h("div", { style: { display: "flex", alignItems: "center", gap: 26 } },
              h("div", { style: { textAlign: "center" } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 56, color: dieCol(ceremony.phase !== "ready" && ceremony.phase !== "rolling" ? ceremony.grade : null), minHeight: 68 } }, ceremony.phase === "ready" ? "?" : String(ceremony.roll)),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#d9d3c8" } }, ceremony.who + (ceremony.grade && ceremony.phase !== "rolling" ? "·" + ceremony.grade.zh : ""))),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: "#8a8378" } }, "VS"),
              h("div", { style: { textAlign: "center", opacity: ceremony.vsRoll == null && ceremony.phase !== "vsroll" ? 0.45 : 1 } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 56, color: dieCol(ceremony.opposed ? ceremony.vsGrade : null), minHeight: 68 } }, ceremony.vsRoll == null ? "?" : String(ceremony.vsRoll)),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#d9d3c8" } }, ceremony.vs.name + "(" + ceremony.vs.val + ")" + (ceremony.opposed && ceremony.vsGrade ? "·" + ceremony.vsGrade.zh : ""))))
          : h("div", { style: { fontFamily: F_DISPLAY, fontSize: 64, color: dieCol(ceremony.phase !== "ready" && ceremony.phase !== "rolling" ? ceremony.grade : null), minHeight: 80 } }, ceremony.phase === "ready" ? "?" : String(ceremony.roll)),
        // 判词行:对抗给终局,普通给档位;伤害骰单独一行
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: "#d9d3c8", minHeight: 24, textAlign: "center" } },
          ceremony.opposed ? (ceremony.opposed === "win" ? "对 抗 胜" : "对 抗 负")
          : (ceremony.phase === "done" || ceremony.phase === "final" || ceremony.phase === "harm") && ceremony.grade ? ceremony.grade.zh
          : ceremony.phase === "ready" ? "" : "…"),
        ceremony.harmRoll != null ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: "#e8a08c" } }, "伤害骰 d20=" + ceremony.harmRoll + " · " + harmZh(ceremony.harmRoll)) : null,
        // 出手前的三个决定:掷 / 协力 / 魔鬼交易
        ceremony.phase === "ready" ? h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10 } },
          ceremony.mates.length ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: "#8a8378", alignSelf: "center" } }, "协力(共担后果):"),
            ceremony.mates.map(mt => h("button", { key: mt.key, onClick: () => setCeremony(c => c && Object.assign({}, c, { assist: c.assist && c.assist.key === mt.key ? null : mt })), style: { padding: "5px 12px", borderRadius: 999, fontFamily: F_BODY, fontSize: 12, border: "1px solid " + (ceremony.assist && ceremony.assist.key === mt.key ? "#e8c76a" : "#8a8378"), background: "transparent", color: ceremony.assist && ceremony.assist.key === mt.key ? "#e8c76a" : "#d9d3c8" } }, mt.name))) : null,
          ceremony.bargainText ? h("button", { onClick: () => setCeremony(c => c && Object.assign({}, c, { bargainOn: !c.bargainOn })), style: { padding: "7px 14px", borderRadius: 12, fontFamily: F_BODY, fontSize: 12, border: "1px solid " + (ceremony.bargainOn ? "#e8c76a" : "#8a8378"), background: "transparent", color: ceremony.bargainOn ? "#e8c76a" : "#d9d3c8", maxWidth: 300 } }, (ceremony.bargainOn ? "😈 已接受交易" : "😈 魔鬼交易:+15") + "(代价:" + ceremony.bargainText + ")") : null,
          h("button", { onClick: ceremonyRoll, style: { padding: "10px 34px", borderRadius: 14, fontFamily: F_DISPLAY, fontSize: 16, border: "1px solid #f0ece4", background: "transparent", color: "#f0ece4" } }, "掷")) : null,
        // 命运点抉择:只在失败/大失败落定、还有点数、且没重掷过时出现(对抗时救的是你这颗骰)
        ceremony.phase === "done" && ceremony.offer ? h("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" } },
          btn("✦ 重掷(花1枚,新结果必须认)", fateReroll, "#e8c76a"),
          ceremony.grade.tier === "fumble" ? btn("✦ 以失败论(花1枚)", fateSoften, "#e8c76a") : null,
          btn("认了", ceremonyAccept)) : null);
    })();

    if (view === "create") {

      const preview = draft && h("div", { style: S.card },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, marginBottom: 8 } }, draft.title),
        [["世界", draft.world], ["开局处境", draft.hook],
         ["地图", draft.mapRegions ? draft.mapRegions.length + " 个区域 · " + draft.mapRegions.reduce((n, r) => n + r.nodes.length, 0) + " 个地点,开局在「" + (draft.pos || "?") + "」(迷雾里的走近了才亮)" : "这一版没长出地图(不影响开团,按纯叙事走)"],
         ["专属状态条", draft.gauge ? draft.gauge.name + " " + draft.gauge.val + "/" + draft.gauge.max + "(" + (draft.gauge.bad === "high" ? "涨满出事" : "见底出事") + (draft.gauge.rule ? ";" + draft.gauge.rule : "") + ")" : null],
         ["守密风格", (STYLES[draft.style] || STYLES.classic).name],
         ["队友私念", (draft.dossier.mates || []).length ? "每人揣着一份(守密人保管,落幕才解密)" : null],
         ["第一章", draft.stages[0] && (draft.stages[0].goal + (draft.stages[0].place ? "〔在:" + draft.stages[0].place + "〕" : ""))], ["后面还有", (draft.stages.length - 1) + " 章(走到才揭晓)"], ["开场", draft.opening]].map(([k, v]) => v ? h("div", { key: k, style: { marginBottom: 8 } }, h("div", { style: S.lbl }, k), h("div", { style: S.txt }, String(v))) : null),
        h("div", { style: S.lbl }, "队伍属性(3d6×5;队友按人设微调)"),
        draft.party.map(m => h("div", { key: m.key, style: Object.assign({}, S.txt, { fontSize: 12, marginBottom: 2 }) }, m.name + (m.veteran ? "〔⚔老卡·第" + ((m.runs || 0) + 1) + "次出团〕" : "") + ":" + STATS.map(([k, zh]) => zh + " " + m.stats[k]).join(" · ") + " · ✦×" + m.fate + ((m.effects || []).some(e => e.scar) ? " · 旧伤:" + m.effects.filter(e => e.scar).map(e => e.name).join("、") : ""))),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, margin: "6px 0 8px" } }, String(draft.dossier.truth || "").trim()
          ? "守密人写好了秘典(真相/翻转/私念)" + ((draft.sideSeeds || []).length ? ",还在各区埋了 " + draft.sideSeeds.length + " 条支线种子(触发条件各不相同)" : "") + "——落幕之前不给看。"
          : "⚠ 幕后底牌还没写成(秘典/私念/专长/种子都缺)——点下面的「补幕后」。"),
        h("div", { style: { marginBottom: 8 } },
          h("div", { style: S.lbl }, "你的暗线(只有你和守密人知道,队友不知道;落幕才揭晓)"),
          h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 } },
            (draft.mylineOptions || []).map((o, i) => h("button", { key: i, onClick: () => setDraft(dd => Object.assign({}, dd, { myline: dd.myline === o ? "" : o })), style: Object.assign({}, S.btn(draft.myline === o), { textAlign: "left" }) }, o)),
            h("button", { onClick: () => setDraft(dd => Object.assign({}, dd, { myline: "" })), style: S.btn(!draft.myline) }, "不要暗线")),
          h("div", { style: { display: "flex", gap: 6 } },
            h("input", { value: mylineTxt, onChange: e => setMylineTxt(e.target.value), placeholder: "或者自己写一条秘密目标…", style: { flex: 1, padding: "6px 9px", borderRadius: 8, border: "1px solid " + t.line, background: t.bg, fontFamily: F_BODY, fontSize: 12, color: t.ink, outline: "none" } }),
            h("button", { onClick: () => { const v = mylineTxt.trim(); if (!v) return; setMylineTxt(""); setDraft(dd => Object.assign({}, dd, { myline: v.slice(0, 44) })); }, style: S.btn(false) }, "用这条")),
          draft.myline ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#8a6d3b", marginTop: 4 } }, "✦ 已选暗线:" + draft.myline) : null),
        h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
          h("button", { onClick: acceptDraft, style: S.btn(true) }, "就这个,开团"),
          h("button", { onClick: genSetup, disabled: busy, style: S.btn(false) }, busy ? "在想…" : "换一版"),
          draft.mapRegions ? h("button", { onClick: () => { saveWorlds([{ id: rid("tw_"), title: draft.title, world: draft.world, regions: draft.mapRegions, style: draft.style || "classic", limits: limitsTxt.trim(), ts: Date.now() }].concat(loadWorlds())); props.toast("世界已收藏——下次开团可以用它另起一个故事(章节秘典全新生成)"); }, style: S.btn(false) }, "🌍 收藏世界") : null,

          // 幕后没写成(或模组换了队友)时:台前不动,单独补底牌
          !String(draft.dossier.truth || "").trim() || !(draft.party.slice(1).every(m => (m.feats || []).length) && Object.keys(draft.outfits || {}).length)
            ? h("button", { onClick: redoBackstage, disabled: busy, style: Object.assign({}, S.btn(false), { borderColor: "#8a6d3b", color: "#8a6d3b" }) }, busy ? "在写…" : "✎ 补幕后")
            : null));
      return h("div", { style: S.wrap }, badges(), askSheet, header("新开跑团"),
        h("div", { style: { flex: 1, overflowY: "auto", paddingBottom: 30 } },
          h("div", { style: S.card }, h("div", { style: S.lbl }, "带哪支小分队进团(数值建队时已掷定;队伍的成长只归那支队)"),
            (() => {
              const sqs = loadSquads().squads;
              if (!sqs.length) return h("div", { style: { marginTop: 4 } },
                h("div", { style: Object.assign({}, S.txt, { fontSize: 12, color: t.fog }) }, "还没有小分队。"),
                h("button", { onClick: () => { setSquadName("小分队一"); setPickIds([]); setBmRolls({ user: rollStats() }); setView("squadNew"); }, style: Object.assign({ marginTop: 6 }, S.btn(true)) }, "⚔ 先去组建队伍"));
              const cur = pickSquadId || sqs[0].id;
              return h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 } },
                sqs.map(sq => h("button", { key: sq.id, onClick: () => setPickSquadId(sq.id), style: Object.assign({}, S.btn(cur === sq.id), { textAlign: "left" }) },
                  "⚔ " + sq.name + "(" + sq.members.length + "人" + (sq.runs ? "·出团" + sq.runs + "次" : "·新队") + ")")));
            })()),
          h("div", { style: S.card }, h("div", { style: S.lbl }, "关键词(选填:世界/主线/氛围,如「西幻 盗墓 诙谐」)"),
            h("textarea", { value: kw, onChange: e => setKw(e.target.value), rows: 2, placeholder: "空着=掷骰子定世界与主线", style: { width: "100%", background: "transparent", border: "none", outline: "none", fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "none" } }),
            h("div", { style: S.lbl }, "难度"),
            h("div", { style: { display: "flex", gap: 6, marginBottom: 6 } }, ["easy", "normal", "hard"].map(k => h("button", { key: k, onClick: () => setDiff(k), style: S.btn(diff === k) }, DIFF[k].name))),
            h("div", { style: S.lbl }, "守密风格(只改叙事口味,不改规则公平)"),
            h("div", { style: { display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" } }, Object.keys(STYLES).map(k => h("button", { key: k, onClick: () => setStyle(k), style: S.btn(style === k) }, STYLES[k].name))),
            h("div", { style: S.lbl }, "安全线(选填:绝不想出现的内容,守密人最高优先级遵守)"),
            h("textarea", { value: limitsTxt, onChange: e => setLimitsTxt(e.target.value), rows: 1, placeholder: "如「虫群、孩子受伤、背叛后无法挽回」,留空=不设", style: { width: "100%", background: "transparent", border: "none", outline: "none", fontFamily: F_BODY, fontSize: 12, color: t.ink, resize: "none", marginBottom: 4 } }),
            !draft && h("div", { style: { display: "flex", gap: 8, marginTop: 4 } },
              h("button", { onClick: genSetup, disabled: busy, style: S.btn(true) }, busy ? "在搭…" : "生成设定"),
              h("button", { onClick: () => setModOpen(v => !v), style: S.btn(modOpen) }, "📦 导入模组")),
            !draft && modOpen ? h("div", { style: { marginTop: 6 } },
              h("textarea", { value: modTxt, onChange: e => setModTxt(e.target.value), rows: 3, placeholder: "把打包的模组 JSON 粘到这里——同一场世界换批队友重开,或者玩别人分享的团", style: { width: "100%", padding: 8, borderRadius: 10, border: "1px dashed " + t.line, background: t.bg, fontFamily: "monospace", fontSize: 10, color: t.ink, resize: "vertical", outline: "none" } }),
              h("button", { onClick: () => {
                try {
                  const mod = JSON.parse(modTxt.trim());
                  if (!mod || mod.kind !== "trpg-module" || !mod.world || !Array.isArray(mod.stages)) throw new Error("不是有效的跑团模组");
                  const squadsAll = loadSquads().squads;
                  const squad = squadsAll.find(x => x.id === pickSquadId) || squadsAll[0];
                  if (!squad) throw new Error("先点右上角 ＋ 组建一支小分队");
                  const members = squad.members.filter(m => m.key !== "user").map(m => charOf(m.key)).filter(Boolean);
                  const party = buildParty(squad);
                  const mapRegions = normRegions(mod.regions);
                  const allNodes = mapRegions ? mapRegions.flatMap(r => r.nodes) : [];
                  const startNode = mapRegions ? (findNode(allNodes, mod.place) || allNodes[0]) : null;
                  // 模组保台本(世界/章节/秘典/种子),crew 相关(私念/行头/专长/暗线)是空的——
                  // 预览里点「补幕后」按当前队伍现配;backstage 只补空不覆盖,台本动不了
                  setDraft({ squadId: squad.id, squadName: squad.name, partyIds: members.map(ch => ch.id), keywords: "", difficulty: diff, style: mod.style || "classic", title: (mod.title || "模组团") + "·重开", world: mod.world, hook: mod.hook || "", stages: mod.stages.map(x => ({ goal: String(x.goal || ""), hint: String(x.hint || ""), place: String(x.place || ""), done: false, note: null })).filter(x => x.goal), dossier: Object.assign({ mates: [] }, mod.dossier || {}), gauge: mod.gauge ? Object.assign({}, mod.gauge) : null, outfits: {}, sideSeeds: (Array.isArray(mod.seeds) ? mod.seeds : []).map(x => Object.assign({}, x, { used: false })), mylineOptions: [], myline: "", mapRegions, pos: startNode ? startNode.name : "", place: startNode ? startNode.name : "起点", opening: String(mod.opening || "故事重新开始了。"), choices: [], party });
                  if (mod.limits) setLimitsTxt(String(mod.limits));
                  setModOpen(false);
                  props.toast("模组已装载——预览里点「补幕后」给这批队友配私念/行头/专长", 7000);
                } catch (e) { props.toast("导入失败:" + (e.message || "JSON 坏了")); }
              }, style: Object.assign({ marginTop: 4 }, S.btn(true)) }, "用模组开团")) : null),
          (() => {
            const ws = loadWorlds();
            if (!ws.length || draft) return null;
            return h("div", { style: S.card }, h("div", { style: S.lbl }, "收藏的世界(用它开团=同一个世界另起一个故事)"),
              ws.map(w => h("div", { key: w.id, style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 } },
                h("div", { style: { flex: 1, minWidth: 0 } },
                  h("div", { style: Object.assign({}, S.txt, { fontSize: 12.5 }) }, "🌍 " + w.title),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, String(w.world || "").slice(0, 40) + "…")),
                h("button", { onClick: () => genFromWorld(w), disabled: busy, style: S.btn(true) }, busy ? "…" : "用它开团"),
                h("button", { onClick: () => askConfirm("删除这个收藏的世界?", () => { saveWorlds(loadWorlds().filter(x => x.id !== w.id)); setSquadTick(x => x + 1); }), style: Object.assign({}, S.btn(false), { color: "#a4442e", borderColor: "#a4442e55" }) }, "删")))); 
          })(),
          preview));
    }

    if (view === "play" && camp) {
      const cur = camp.stages[camp.stageIdx] || null;
      // 手绘旅程图:一条铅笔小径,走过的节点点亮,当前位置插小旗;未到的章节是虚圈。
      // 种子=战役id → 同一场团永远画同一条路;分支出去的新团(新id)会长出自己的路。
      const journey = (() => {
        const NUM = ["一", "二", "三", "四", "五", "六", "七", "八"];
        const nodes = journeyLayout(camp.id, camp.stages.length);
        const rand = mulberry32(hashStr(camp.id) ^ 0x9e37);
        const p1 = ptsToPath(jitterPts(nodes, rand, 1.6));
        const p2 = ptsToPath(jitterPts(nodes, rand, 1.6));
        const markerNode = nodes[camp.ended ? nodes.length - 1 : Math.min(camp.stageIdx + 1, nodes.length - 1)];
        return sect("🗺", "旅程", null, "第" + Math.min(camp.stageIdx + 1, camp.stages.length) + "/" + camp.stages.length + "章",
          h("svg", { viewBox: "0 0 340 120", style: { width: "100%", display: "block", borderRadius: 10, background: t.bg } },
            // 小径描两遍:抖动不同、深浅不同,就有铅笔手绘味
            h("path", { d: p1, fill: "none", stroke: t.fog, strokeWidth: 1.6, strokeLinecap: "round", strokeDasharray: "5 4", opacity: 0.55 }),
            h("path", { d: p2, fill: "none", stroke: t.ink, strokeWidth: 1.1, strokeLinecap: "round", strokeDasharray: "6 5", opacity: 0.5 }),
            nodes.map((nd, i) => {
              if (i === 0) return h("g", { key: "n0" },
                h("circle", { cx: nd.x, cy: nd.y, r: 4, fill: t.ink }),
                h("text", { x: nd.x, y: nd.y + 16, textAnchor: "middle", fontSize: 9, fill: t.fog, fontFamily: F_BODY }, "起点"));
              const si = i - 1;
              const done = !!(camp.stages[si] && camp.stages[si].done);
              const curHere = !camp.ended && si === camp.stageIdx;
              const future = !done && !curHere;
              return h("g", { key: "n" + i },
                h("circle", { cx: nd.x, cy: nd.y, r: curHere ? 6.5 : 5, fill: done ? t.ink : t.bg2, stroke: future ? t.fog : t.ink, strokeWidth: curHere ? 2 : 1.2, strokeDasharray: future ? "2.5 2.5" : "none" }),
                done ? h("path", { d: "M" + (nd.x - 2.4) + " " + nd.y + "l1.8 2 3-4", fill: "none", stroke: t.bg2, strokeWidth: 1.4, strokeLinecap: "round" }) : null,
                h("text", { x: nd.x, y: nd.y + 17, textAnchor: "middle", fontSize: 9, fill: future ? t.fog : t.ink, fontFamily: F_BODY }, future ? "?" : "第" + (NUM[si] || si + 1) + "章"));
            }),
            markerNode ? h("text", { x: markerNode.x, y: markerNode.y - 10, textAnchor: "middle", fontSize: 12 }, camp.ended ? "🏕" : "🚩") : null));
      })();
      // GM 手动修正(Codex 点的菜):模型记错账不值得重跑整轮——她直接改,每笔修正
      // 写一条〔修正〕系统行进史,守密人下一拍看得见,不会又按旧账演回去
      const applyFix = (desc, fn) => update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, fn(c), { msgs: c.msgs.concat([{ id: rid("rm_"), role: "sys", content: "修正·" + uName + " 手动" + desc, ts: Date.now() }]) })));
      // 队伍与线索:右侧抽屉(她 2026-08-28 定的)——顶部条只能给 56vh,侧边整条高度
      // 都是它的,旅程/状态条/时钟/主线/物品/线索/推测一屏看得更全;点侧幕收起
      const panel = panelOpen && h("div", null,
        h("div", { onClick: () => setPanelOpen(false), style: { position: "fixed", inset: 0, zIndex: 118, background: "rgba(30,28,24,.35)" } }),
        h("div", { style: { position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 119, width: "82%", maxWidth: 340, background: deskBg, borderLeft: "1px solid " + t.line, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "calc(env(safe-area-inset-top, 0px) + 16px) 14px calc(env(safe-area-inset-bottom, 0px) + 24px)", boxShadow: "-8px 0 24px rgba(0,0,0,.08)" } },
        journey,
        // 此刻:这一条是整块面板的锚——先知道「哪天、什么时辰、在哪」，别的才有意义
        h("div", { style: { display: "flex", alignItems: "center", gap: 7, margin: "4px 0 10px", padding: "7px 11px", borderRadius: 999, background: "rgba(46,38,29,.05)", border: "1px solid " + t.line } },
          h("span", { style: { fontSize: 12 } }, "🕯"),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink } }, "第" + ((camp.time || {}).day || 1) + "日 · " + ((camp.time || {}).part || "晨")),
          h("span", { style: { width: 1, height: 11, background: t.line } }),
          h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, camp.place || "")),
        sect("👥", "队伍",
          h("button", { onClick: () => setFixMode(v => !v), style: { fontFamily: F_BODY, fontSize: 10, color: fixMode ? t.bg2 : t.fog, background: fixMode ? t.ink : "none", border: "1px solid " + (fixMode ? t.ink : t.line), borderRadius: 8, padding: "2px 8px" } }, fixMode ? "✎ 修正中" : "✎ 修正"),
          camp.party.length + " 人 · 最低 HP " + camp.party.reduce((n, m) => Math.min(n, m.hp), 999),
        camp.party.map(m => h("div", { key: m.key, style: { marginBottom: 6 } },
          h("div", { style: Object.assign({}, S.txt, { fontSize: 12.5, display: "flex", justifyContent: "space-between", alignItems: "center" }) }, h("span", null, m.name, m.fate ? h("span", { style: { color: "#8a6d3b", fontSize: 11 } }, " ✦×" + m.fate) : null),
            h("span", { style: { display: "flex", alignItems: "center", gap: 5 } },
              fixMode ? h("button", { onClick: () => applyFix("把 " + m.name + " 的 HP 调低 10", c => Object.assign({}, c, { party: c.party.map(x => x.key !== m.key ? x : Object.assign({}, x, { hp: Math.max(0, x.hp - 10) })) })), style: { fontFamily: F_BODY, fontSize: 11, border: "1px solid " + t.line, borderRadius: 7, background: "none", color: "#a4442e", padding: "0 6px" } }, "−10") : null,
              fixMode ? h("button", { onClick: () => applyFix("把 " + m.name + " 的 HP 调高 10", c => Object.assign({}, c, { party: c.party.map(x => x.key !== m.key ? x : Object.assign({}, x, { hp: Math.min(x.maxHp || 100, x.hp + 10) })) })), style: { fontFamily: F_BODY, fontSize: 11, border: "1px solid " + t.line, borderRadius: 7, background: "none", color: "#5a7d5a", padding: "0 6px" } }, "+10") : null,
              h("span", { style: { color: m.hp <= 25 ? "#a4442e" : t.sub } }, "HP " + m.hp + "/" + (m.maxHp || 100)))),
          h("div", { style: { height: 4, borderRadius: 2, background: t.line, overflow: "hidden" } }, h("div", { style: { width: Math.max(0, Math.min(100, m.hp / (m.maxHp || 100) * 100)) + "%", height: "100%", background: m.hp <= 25 ? "#a4442e" : t.ink } })),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 2 } }, STATS.map(([k, zh]) => zh + m.stats[k]).join(" · ") + ((m.feats || []).length ? " · 专长:" + m.feats.map(f => f.name).join("、") : "")),
          (m.effects || []).length ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 } }, m.effects.map((e, i) => h("span", { key: i, style: { fontFamily: F_BODY, fontSize: 10, color: "#a4442e", border: "1px solid #a4442e55", borderRadius: 999, padding: "1px 7px" } }, "🩸 " + e.name + (e.note ? "·" + e.note : ""),
            fixMode ? h("span", { onClick: () => applyFix("解除了 " + m.name + " 的「" + e.name + "」", c => Object.assign({}, c, { party: c.party.map(x => x.key !== m.key ? x : Object.assign({}, x, { effects: (x.effects || []).filter((_, j) => j !== i) })) })), style: { marginLeft: 4, color: t.fog } }, "✕") : null))) : null)),
        ),
        (camp.gauge || (camp.clocks || []).length) ? sect("⏳", "压力", null,
          [camp.gauge ? camp.gauge.name + " " + camp.gauge.val + "/" + camp.gauge.max : "", (camp.clocks || []).length ? (camp.clocks || []).length + " 个时钟" : ""].filter(Boolean).join(" · "),
        camp.gauge ? h("div", { style: { marginBottom: 8 } },
          h("div", { style: Object.assign({}, S.lbl, { display: "flex", justifyContent: "space-between" }) }, h("span", null, camp.gauge.name + "(" + (camp.gauge.bad === "high" ? "涨满出事" : "见底出事") + ")"), h("span", null, camp.gauge.val + "/" + camp.gauge.max)),
          h("div", { style: { height: 5, borderRadius: 3, background: t.line, overflow: "hidden" } },
            h("div", { style: { width: Math.max(0, Math.min(100, camp.gauge.val / camp.gauge.max * 100)) + "%", height: "100%", background: (camp.gauge.bad === "high" ? camp.gauge.val / camp.gauge.max >= 0.75 : camp.gauge.val / camp.gauge.max <= 0.25) ? "#a4442e" : "#8a6d3b" } }))) : null,
        (camp.clocks || []).length ? h("div", { style: { marginBottom: 8 } },
          h("div", { style: S.lbl }, "威胁时钟"),
          camp.clocks.map(ck => h("div", { key: ck.name, style: Object.assign({}, S.txt, { fontSize: 12, display: "flex", justifyContent: "space-between", marginBottom: 2 }) },
            h("span", { style: { color: ck.filled >= ck.max ? "#a4442e" : t.ink } }, "⏰ " + ck.name),
            h("span", { style: { letterSpacing: 2, color: ck.filled >= ck.max ? "#a4442e" : t.sub } }, "●".repeat(ck.filled) + "○".repeat(Math.max(0, ck.max - ck.filled)))))) : null,
        ) : null,
        sect("◎", "目标", null,
          "第" + Math.min(camp.stageIdx + 1, camp.stages.length) + "/" + camp.stages.length + "章" + ((camp.quests || []).filter(q => q.status === "open").length ? " · 支线 " + (camp.quests || []).filter(q => q.status === "open").length + " 条在办" : ""),
        h("div", { style: S.lbl }, "主线"),
        camp.stages.map((s, i) => h("div", { key: i, style: Object.assign({}, S.txt, { fontSize: 12, marginBottom: 2, color: i === camp.stageIdx ? t.ink : t.fog }) }, (s.done ? "✓ " : i === camp.stageIdx ? "→ " : "· ") + "第" + (i + 1) + "章:" + (i <= camp.stageIdx ? s.goal : "???"))),
        // 支线任务日志:○进行 ✓完成 ✗失败 ⏸暂缓;修正模式点一下轮换状态
        (camp.quests || []).length ? h("div", null,
          h("div", { style: Object.assign({}, S.lbl, { marginTop: 8 }) }, "支线" + (fixMode ? "(点一条轮换状态)" : "")),
          camp.quests.map(q => {
            const icon = { open: "○", done: "✓", failed: "✗", paused: "⏸" }[q.status] || "○";
            const col = q.status === "done" ? "#5a7d5a" : q.status === "failed" ? "#a4442e" : q.status === "paused" ? t.fog : t.ink;
            const questFlip = to => update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { quests: c.quests.map(x => x.name !== q.name ? x : Object.assign({}, x, { status: to })), msgs: c.msgs.concat([{ id: rid("rm_"), role: "sys", content: "支线·" + uName + " 决定" + (to === "paused" ? "暂缓「" + q.name + "」,先做别的" : "重拾「" + q.name + "」"), ts: Date.now() }]) })));
            return h("div", { key: q.name, style: Object.assign({}, S.txt, { fontSize: 12, marginBottom: 2, color: col, display: "flex", alignItems: "center", gap: 5 }) },
              h("span", { onClick: () => { if (!fixMode) return; const order = ["open", "done", "failed", "paused"]; const nxt = order[(order.indexOf(q.status) + 1) % 4]; applyFix("把支线「" + q.name + "」改为" + ({ open: "进行中", done: "完成", failed: "失败", paused: "暂缓" }[nxt]), c => Object.assign({}, c, { quests: c.quests.map(x => x.name !== q.name ? x : Object.assign({}, x, { status: nxt })) })); }, style: { cursor: fixMode ? "pointer" : "default", flex: 1 } }, icon + " " + q.name + (q.note ? ":" + q.note : "")),
              // 随时暂离/重拾(她 2026-08-28 要的):不烧调用,写一条〔支线〕记录守密人就知道了
              !fixMode && q.status === "open" ? h("button", { onClick: () => questFlip("paused"), style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, background: "none", border: "1px solid " + t.line, borderRadius: 8, padding: "1px 7px" } }, "⏸ 暂离") : null,
              !fixMode && q.status === "paused" ? h("button", { onClick: () => questFlip("open"), style: { fontFamily: F_BODY, fontSize: 10, color: t.ink, background: "none", border: "1px solid " + t.line, borderRadius: 8, padding: "1px 7px" } }, "▶ 重拾") : null);
          })) : null,
        ),
        (camp.npcs || []).length ? sect("👤", "名册", null, camp.npcs.length + " 人",
        // NPC 名册:立场 🟢友 🔴敌 ⚪未明,†=已死;只显示玩家已知的
        (camp.npcs || []).length ? h("div", null,
          fixMode ? h("div", { style: S.lbl }, "点立场轮换,† 标生死") : null,
          camp.npcs.map(n => h("div", { key: n.name, style: Object.assign({}, S.txt, { fontSize: 12, marginBottom: 2, color: n.alive ? t.ink : t.fog, display: "flex", alignItems: "center", gap: 5 }) },
            h("span", { onClick: () => { if (!fixMode) return; const order = ["友", "敌", "未明"]; const nxt = order[(order.indexOf(n.stance) + 1) % 3]; applyFix("把「" + n.name + "」的立场改为" + nxt, c => Object.assign({}, c, { npcs: c.npcs.map(x => x.name !== n.name ? x : Object.assign({}, x, { stance: nxt })) })); }, style: { cursor: fixMode ? "pointer" : "default" } }, n.stance === "友" ? "🟢" : n.stance === "敌" ? "🔴" : "⚪"),
            h("span", { style: { textDecoration: n.alive ? "none" : "line-through" } }, n.name + (n.role ? "·" + n.role : "") + (n.note ? " — " + n.note : "")),
            fixMode ? h("span", { onClick: () => applyFix("把「" + n.name + "」标为" + (n.alive ? "已死" : "在世"), c => Object.assign({}, c, { npcs: c.npcs.map(x => x.name !== n.name ? x : Object.assign({}, x, { alive: !x.alive })) })), style: { marginLeft: "auto", color: t.fog } }, "†") : null))) : null,
        ) : null,
        sect("🎒", "行囊", null, itemsFix(camp.items).reduce((n, x) => n + x.n, 0) + " 件",
        fixMode ? h("div", null,
          h("div", { style: { display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 } }, itemsFix(camp.items).map((it, i) => h("span", { key: i, style: { fontFamily: F_BODY, fontSize: 11, color: t.ink, border: "1px solid " + t.line, borderRadius: 999, padding: "2px 8px" } }, fmtItem(it),
            h("span", { onClick: () => applyFix("删掉了物品「" + it.name + "」", c => { const items = itemsFix(c.items); const j = items.findIndex(x => x.name === it.name && x.holder === it.holder); if (j >= 0) { if (items[j].n > 1) items[j] = Object.assign({}, items[j], { n: items[j].n - 1 }); else items.splice(j, 1); } return Object.assign({}, c, { items }); }), style: { marginLeft: 4, color: "#a4442e" } }, "✕")))),
          h("div", { style: { display: "flex", gap: 6, marginBottom: 4 } },
            h("input", { value: fixItem, onChange: e => setFixItem(e.target.value), placeholder: "补记一件(可写 名称(持有人))", style: { flex: 1, padding: "5px 8px", borderRadius: 8, border: "1px solid " + t.line, background: t.bg, fontFamily: F_BODY, fontSize: 11, color: t.ink, outline: "none" } }),
            h("button", { onClick: () => { const raw = fixItem.trim(); if (!raw) return; const mHold = raw.match(/^(.+?)[(（]([^)）]+)[)）]$/); const nm = (mHold ? mHold[1] : raw).trim(); const hd = mHold ? mHold[2].trim() : "队伍"; setFixItem(""); applyFix("补记了物品「" + nm + "」", c => Object.assign({}, c, { items: itemsFix(c.items).concat([{ name: nm, holder: hd, n: 1 }]) })); }, style: S.btn(false) }, "补记")))
        : (itemsFix(camp.items).length
            // 一件一行(她 2026-08-30:「行囊那栏现在只是用标点符号隔开,改成一列下来」)。
            // 顿号连起来的时候,「守钟人的册子(残)(裴照川)」这种带括号的名字根本断不开
            ? h("div", null, itemsFix(camp.items).map((it, i) => h("div", { key: i, style: { display: "flex", alignItems: "baseline", gap: 8, padding: "4px 0", borderTop: i ? "1px solid " + t.line : "none" } },
                h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, width: 14, flexShrink: 0 } }, "·"),
                h("span", { style: Object.assign({}, S.txt, { fontSize: 12.5, flex: 1, minWidth: 0 }) }, it.name),
                it.n > 1 ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, flexShrink: 0 } }, "×" + it.n) : null,
                it.holder && it.holder !== "队伍" ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, border: "1px solid " + t.line, borderRadius: 999, padding: "1px 7px", flexShrink: 0 } }, it.holder) : null)))
            : h("div", { style: Object.assign({}, S.txt, { fontSize: 12, color: t.fog }) }, "空空如也")),
        ),
        sect("🔎", "线索", null,
          camp.clues.length + " 条" + ((camp.guesses || []).length ? " · 推测 " + (camp.guesses || []).length + " 条" : ""),
        h("div", { style: S.lbl }, "已知事实"),
        camp.clues.length ? camp.clues.map((x, i) => h("div", { key: i, style: Object.assign({}, S.txt, { fontSize: 12, marginBottom: 2 }) }, (i + 1) + ". " + x)) : h("div", { style: Object.assign({}, S.txt, { fontSize: 12 }) }, "尚无"),
        // 线索板·推测区:把线索拼成推论记下来;守密人只裁「值不值得验证」,不裁对错
        h("div", { style: Object.assign({}, S.lbl, { marginTop: 6 }) }, "你的推测"),
        (camp.guesses || []).map(g => h("div", { key: g.id, style: { marginBottom: 5, padding: "6px 8px", borderRadius: 8, border: "1px dashed " + t.line } },
          h("div", { style: Object.assign({}, S.txt, { fontSize: 12 }) }, g.text),
          h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 3 } },
            g.verdict === "worth" ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: "#5a7d5a" } }, "🧭 值得验证" + (g.note ? "·" + g.note : ""))
            : g.verdict === "shaky" ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, "〰 根基还不稳" + (g.note ? "·" + g.note : ""))
            : h("button", { onClick: () => askVerdict(g), disabled: busy, style: { fontFamily: F_BODY, fontSize: 10, color: t.ink, background: "none", border: "1px solid " + t.line, borderRadius: 8, padding: "2px 8px" } }, "问守密人:值得查吗"),
            h("button", { onClick: () => update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { guesses: (c.guesses || []).filter(x => x.id !== g.id) }))), style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, background: "none", border: "none", marginLeft: "auto" } }, "✕")))),
        !camp.ended ? h("div", { style: { display: "flex", gap: 6, marginBottom: 4 } },
          h("input", { value: guessTxt, onChange: e => setGuessTxt(e.target.value), placeholder: "把线索拼成一条推论记下来…", style: { flex: 1, padding: "6px 9px", borderRadius: 8, border: "1px solid " + t.line, background: t.bg, fontFamily: F_BODY, fontSize: 12, color: t.ink, outline: "none" } },),
          h("button", { onClick: () => { const txt = guessTxt.trim(); if (!txt) return; setGuessTxt(""); update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { guesses: (c.guesses || []).concat([{ id: rid("rg_"), text: txt, verdict: null, note: "", ts: Date.now() }]) }))); }, style: S.btn(false) }, "记下")) : null,
        ),
        (() => {
          const rolls = camp.msgs.filter(m => m.role === "roll");
          // 欧非榜:纯本地统计,一行 API 不花。成功=ok 及以上;欧皇看大成功密度,非酋看大失败密度
          const board = (() => {
            const acc = {};
            rolls.forEach(r => { if (!r.who || !r.tier) return; const a = acc[r.who] || (acc[r.who] = { n: 0, ok: 0, crit: 0, fumble: 0 }); a.n++; if (TIER_RANK[r.tier] >= 2) a.ok++; if (r.tier === "crit") a.crit++; if (r.tier === "fumble") a.fumble++; });
            const rows = Object.keys(acc).map(name => Object.assign({ name }, acc[name])).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
            if (rows.length < 1 || rolls.length < 3) return null;
            const lucky = rows.slice().sort((a, b) => (b.crit / b.n) - (a.crit / a.n))[0];
            const cursed = rows.slice().sort((a, b) => (b.fumble / b.n) - (a.fumble / a.n))[0];
            return h("div", { style: { margin: "4px 0 2px" } }, rows.map(x => h("div", { key: x.name, style: { fontFamily: "monospace", fontSize: 10.5, color: t.sub, lineHeight: 1.6 } },
              x.name + " 掷" + x.n + " 成" + x.ok + "(" + Math.round(x.ok * 100 / x.n) + "%)"
              + (x.crit ? " 🌟×" + x.crit : "") + (x.fumble ? " 💥×" + x.fumble : "")
              + (lucky && lucky.name === x.name && lucky.crit > 0 ? " ·欧皇" : "")
              + (cursed && cursed.name === x.name && cursed.fumble > 0 ? " ·非酋" : ""))));
          })();
          return rolls.length ? sect("🎲", "骰子账", null, rolls.length + " 次",
            board,
            rolls.slice(-30).reverse().map(r => h("div", { key: r.id, style: { fontFamily: "monospace", fontSize: 10.5, color: t.sub, marginBottom: 2, lineHeight: 1.5 } }, r.content))) : null;
        })(),
        h("div", { style: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" } },
          h("button", { onClick: () => {
            // 打包模组:台前+底牌+种子,不带存档与队伍——换队友重开时「补幕后」会重配 crew
            const mod = { v: 1, kind: "trpg-module", title: camp.title, world: camp.world, hook: camp.hook, regions: camp.mapRegions, stages: camp.stages.map(x => ({ goal: x.goal, hint: x.hint, place: x.place || "" })), dossier: { truth: camp.dossier.truth, twist: camp.dossier.twist, secrets: camp.dossier.secrets, endgame: camp.dossier.endgame }, gauge: camp.gauge ? Object.assign({}, camp.gauge) : null, seeds: (camp.sideSeeds || []).map(x => Object.assign({}, x, { used: false })), style: camp.style || "classic", limits: camp.limits || "", opening: (camp.msgs[0] && camp.msgs[0].content) || "", place: camp.stages.length && camp.msgs[0] && camp.msgs[0].snap ? camp.msgs[0].snap.place : camp.place };
            const txt = JSON.stringify(mod);
            try { navigator.clipboard.writeText(txt).then(() => props.toast("模组已复制:世界/章节/秘典/种子都在里面,开团页「导入模组」可重开或分享", 7000), () => props.toast("复制失败,再试一次")); } catch (e) { props.toast("复制失败:" + (e.message || "")); }
          }, style: S.btn(false) }, "📦 打包模组"),
          camp.mapRegions ? h("button", { onClick: () => { saveWorlds([{ id: rid("tw_"), title: camp.title, world: camp.world, regions: camp.mapRegions, style: camp.style || "classic", limits: camp.limits || "", ts: Date.now() }].concat(loadWorlds())); props.toast("世界已收藏——开团页可用它另起一个故事"); }, style: S.btn(false) }, "🌍 收藏此世界") : null,
          // 弹窗看进度说话:章节全清了还问「提前收团?」等于管功臣叫逃兵(她 2026-08-30 首团抓的)
          !camp.ended && h("button", { onClick: () => askConfirm(camp.stageIdx >= camp.stages.length ? "为这段旅程写终章谢幕?" : "提前收团?守密人会就此写终章落幕。", () => { setPanelOpen(false); setEndAsk({ forced: true }); }, "收团"), disabled: busy, style: S.btn(false) }, "谢幕收团"),
          h("button", { onClick: () => delCamp(camp.id), style: Object.assign({}, S.btn(false), { color: "#a4442e", borderColor: "#a4442e55" }) }, "删除此团")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 8, lineHeight: 1.7 } }, "长按任意一拍可从那里分支回溯——状态按当拍快照恢复,原团一个字不动。")));
      // 休团回来(Codex 点的菜):隔了半天以上再打开,先给一张「上回说到」——
      // 时间地点、当前章、最后一拍的尾巴,零成本(不烧调用),看完点掉
      const lastTs = camp.msgs.length ? (camp.msgs[camp.msgs.length - 1].ts || 0) : 0;
      const resume = (!camp.ended && lastTs && Date.now() - lastTs > 12 * 3600 * 1000 && resumeSeen !== camp.id) ? (() => {
        const lastGm = camp.msgs.filter(m => m.role === "gm").slice(-1)[0];
        return h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", borderStyle: "dashed" }) },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: t.ink, marginBottom: 4 } }, "📖 休团回来 · 第" + ((camp.time || {}).day || 1) + "日·" + ((camp.time || {}).part || "晨") + " · " + (camp.place || "")),
          cur ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, marginBottom: 4 } }, "当前章:" + cur.goal + (cur.place ? "〔在:" + cur.place + "〕" : "")) : null,
          lastGm ? h("div", { style: Object.assign({}, S.txt, { fontSize: 12, color: t.fog }) }, "上回说到——" + String(lastGm.content || "").slice(-120)) : null,
          h("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
            h("button", { onClick: () => setResumeSeen(camp.id), style: S.btn(true) }, "接上,继续")));
      })() : null;
      const downed = camp.party.filter(m => m.hp <= 0);
      // 终章问询卡:落幕前把「最后一笔」的笔递回她手里(可留空交给命运,但留空
      // 也只写画面不替她做主)
      const banner = endAsk ? h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", borderColor: t.ink }) },
          h("div", { style: S.txt }, "落幕之前——最后,你做什么、说什么?"),
          h("textarea", { value: finalAct, onChange: e => setFinalAct(e.target.value), rows: 2, placeholder: "写下你的最后一笔(留空=交给命运,终章也不会替你做任何决定)", style: { width: "100%", marginTop: 8, padding: 8, borderRadius: 10, border: "1px solid " + t.line, background: t.bg, fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "vertical", outline: "none" } }),
          h("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
            h("button", { onClick: () => epilogue(endAsk.forced, finalAct), disabled: busy, style: S.btn(true) }, busy ? "在写…" : "写下终章"),
            h("button", { onClick: () => setEndAsk(null), disabled: busy, style: S.btn(false) }, "再想想")))
        : camp.pendingStage ? h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", borderColor: t.ink }) },
          h("div", { style: S.txt }, "这一章可能到落点了:" + (cur ? cur.goal : "") + (typeof camp.pendingStage === "string" ? "\n(" + camp.pendingStage + ")" : "")),
          h("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
            h("button", { onClick: () => confirmStage(true), style: S.btn(true) }, "翻过这一章"),
            h("button", { onClick: () => confirmStage(false), style: S.btn(false) }, "还没有")))
        : camp.pendingEnd ? h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", borderColor: t.ink }) },
          h("div", { style: S.txt }, "故事似乎可以落幕了" + (typeof camp.pendingEnd === "string" ? ":" + camp.pendingEnd : "")),
          h("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
            h("button", { onClick: () => setEndAsk({ forced: false }), disabled: busy, style: S.btn(true) }, "落幕,写终章"),
            // 否决同样留回执:守密人下一拍看得见「还没完」,不会反复催落幕
            h("button", { onClick: () => update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { pendingEnd: false, msgs: c.msgs.concat([{ id: rid("rm_"), role: "sys", content: uName + " 判定:故事还没到落幕的时候,继续演;别急着再报 ending", ts: Date.now() }]) }))), style: S.btn(false) }, "故事还没完")))
        : (!camp.ended && downed.length) ? h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", borderColor: "#a4442e" }) },
          h("div", { style: S.txt }, downed.map(m => m.name).join("、") + " 倒下了。命悬一线不等于终局——可以继续演,让剧情给出转机;也可以就此落幕;或长按之前的一拍分支回溯。"),
          h("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
            h("button", { onClick: () => turn("(不肯认输,想办法救回" + downed.map(m => m.name).join("、") + ")"), disabled: busy, style: S.btn(true) }, "挣扎求生"),
            h("button", { onClick: () => askConfirm("接受这个结局?终章会照现在的惨状写。", () => setEndAsk({ forced: true }), "接受"), disabled: busy, style: S.btn(false) }, "接受结局"))) : null;
      // 终章逐段揭晓 + 秘典解密
      const ep = camp.ended && camp.epilogue;
      const epFlow = ep && h("div", { style: Object.assign({}, S.card, { margin: "10px 14px" }) },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, marginBottom: 8 } }, "终章"),
        ep.paras.slice(0, ep.revealed).map((x, i) => h("div", { key: i, style: Object.assign({}, S.txt, { marginBottom: 8 }) }, x)),
        ep.revealed < ep.paras.length
          ? h("button", { onClick: () => update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { epilogue: Object.assign({}, c.epilogue, { revealed: c.epilogue.revealed + 1 }) }))), style: S.btn(true) }, ep.revealed ? "接着念" : "揭开终章")
          : [ep.closing ? h("div", { key: "cl", style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, textAlign: "center", margin: "10px 0" } }, "—— " + ep.closing + " ——") : null,
             h("div", { key: "dz", style: { marginTop: 10, paddingTop: 10, borderTop: "1px dashed " + t.line } },
               h("div", { style: S.lbl }, "秘典解密(守密人开团时写下的底牌)"),
               [["真相", camp.dossier.truth], ["中段翻转", camp.dossier.twist], ["NPC 的心事", camp.dossier.secrets]].map(([k, v]) => v ? h("div", { key: k, style: { marginBottom: 6 } }, h("div", { style: S.lbl }, k), h("div", { style: Object.assign({}, S.txt, { fontSize: 12 }) }, v)) : null),
               (camp.dossier.mates || []).length ? h("div", { style: { marginBottom: 6 } },
                 h("div", { style: S.lbl }, "队友们一路藏着的私念"),
                 camp.dossier.mates.map(m => h("div", { key: m.name, style: Object.assign({}, S.txt, { fontSize: 12, marginBottom: 3 }) }, m.name + ":想要·" + m.want + (m.fear ? " / 最怕·" + m.fear : "") + (m.line ? " / 底线·" + m.line : "")))) : null,
               (ep.growth || []).length ? h("div", { style: { marginBottom: 6 } },
                 h("div", { style: S.lbl }, "成长骰(这团用过且成功过的本事才有资格长)"),
                 ep.growth.map((g, i) => h("div", { key: i, style: Object.assign({}, S.txt, { fontSize: 12, color: g.to > g.from ? "#5a7d5a" : t.fog }) },
                   g.name + " " + STAT_ZH[g.stat] + ":d100=" + g.roll + (g.to > g.from ? " → " + g.from + "→" + g.to + " ✦长进了" : " → 没超过 " + g.from + ",这门还得再练"))),
                 h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 3 } }, "成长与旧伤已写回冒险小分队的老卡——下一团 TA 带着这些来。")) : null,
               // 战报:她 2026-08-30 首团抓的「通关连句提示都没有」——结算感由这一块补,纯本地拼,零调用
               (() => {
                 const rolls = camp.msgs.filter(m => m.role === "roll");
                 if (!rolls.length && !(camp.quests || []).length) return null;
                 const acc = {};
                 rolls.forEach(r => { if (!r.who || !r.tier) return; const a = acc[r.who] || (acc[r.who] = { n: 0, ok: 0, crit: 0, fumble: 0 }); a.n++; if (TIER_RANK[r.tier] >= 2) a.ok++; if (r.tier === "crit") a.crit++; if (r.tier === "fumble") a.fumble++; });
                 const fated = camp.msgs.filter(m => m.role === "roll" && /命运点/.test(String(m.content || ""))).length;
                 const scenes = rolls.filter(r => r.tier === "crit" || r.tier === "fumble").slice(-4);
                 const qd = (camp.quests || []).filter(q => q.status === "done"), qf = (camp.quests || []).filter(q => q.status === "failed");
                 return h("div", { style: { marginBottom: 6 } },
                   h("div", { style: S.lbl }, "战报"),
                   h("div", { style: Object.assign({}, S.txt, { fontSize: 12 }) },
                     "历时 " + (((camp.time || {}).day) || 1) + " 日 · " + camp.msgs.filter(m => m.role === "gm").length + " 拍 · 章节 " + camp.stages.filter(s => s.done).length + "/" + camp.stages.length
                     + " · 线索 " + (camp.clues || []).length + " 条 · 命运点动用 " + fated + " 次"),
                   (camp.visited || []).length > 1 ? h("div", { style: Object.assign({}, S.txt, { fontSize: 12, color: t.sub }) }, "足迹:" + camp.visited.join(" → ")) : null,
                   Object.keys(acc).map(name => { const a = acc[name]; return h("div", { key: name, style: { fontFamily: "monospace", fontSize: 10.5, color: t.sub, lineHeight: 1.6 } }, name + " 掷" + a.n + " 成" + a.ok + "(" + Math.round(a.ok * 100 / Math.max(1, a.n)) + "%)" + (a.crit ? " 🌟×" + a.crit : "") + (a.fumble ? " 💥×" + a.fumble : "")); }),
                   scenes.length ? h("div", { style: { marginTop: 3 } }, h("div", { style: Object.assign({}, S.lbl, { fontSize: 9 }) }, "名场面"), scenes.map((r, i) => h("div", { key: i, style: { fontFamily: "monospace", fontSize: 10, color: r.tier === "crit" ? "#5a7d5a" : "#a4442e", lineHeight: 1.5 } }, (r.tier === "crit" ? "🌟 " : "💥 ") + String(r.content || "").slice(0, 60)))) : null,
                   (qd.length || qf.length) ? h("div", { style: Object.assign({}, S.txt, { fontSize: 12, marginTop: 3 }) }, "支线:" + (qd.length ? "达成「" + qd.map(q => q.name).join("」「") + "」" : "") + (qf.length ? (qd.length ? " · " : "") + "折戟「" + qf.map(q => q.name).join("」「") + "」" : "")) : null);
               })(),
               camp.myline ? h("div", { style: { marginBottom: 6 } }, h("div", { style: S.lbl }, "你的暗线"), h("div", { style: Object.assign({}, S.txt, { fontSize: 12 }) }, "「" + camp.myline + "」" + (ep.myline ? " —— " + ep.myline : ""))) : null,
               ep.untold && ep.untold.length ? h("div", null, h("div", { style: S.lbl }, "没来得及揭开的"), ep.untold.map((x, i) => h("div", { key: i, style: Object.assign({}, S.txt, { fontSize: 12 }) }, "· " + x))) : null)]);
      const flow = camp.msgs.map(m => m.role === "photo"
        ? h("div", { key: m.id, onPointerDown: () => pressPhoto(m), onPointerUp: pressEnd, onPointerMove: pressEnd, onPointerLeave: pressEnd, onContextMenu: e => e.preventDefault(), style: { margin: "10px 14px", textAlign: "center" } }, h("img", { src: imgSrc(m.img), onClick: () => setBigView({ img: m.img, title: camp.title }), style: { maxWidth: "86%", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.18)" } }))
        // 闲聊簇:群聊式气泡,点头部折叠——收起来只剩一行,不淹主剧情(她 2026-08-28 定的)
        : m.role === "chat"
        ? h("div", { key: m.id, style: { margin: "10px 14px", borderRadius: 14, border: "1px dashed " + t.line, background: t.bg2 } },
            h("div", { onClick: () => update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { msgs: c.msgs.map(x => x.id !== m.id ? x : Object.assign({}, x, { fold: !x.fold })) }))), style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", fontFamily: F_BODY, fontSize: 11, color: t.fog } },
              h("span", null, "💬 闲聊 · " + (m.lines || []).length + " 句"), h("span", null, m.fold ? "展开 ▾" : "收起 ▴")),
            !m.fold ? h("div", { style: { padding: "0 10px 10px" } }, (m.lines || []).map((l, i) => l.name === uName
              ? h("div", { key: i, style: { textAlign: "right", margin: "6px 0" } }, h("span", { style: { display: "inline-block", maxWidth: "82%", textAlign: "left", padding: "7px 11px", borderRadius: 13, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-wrap" } }, l.text))
              : h("div", { key: i, style: { margin: "6px 0" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginBottom: 2 } }, l.name + (l.act ? " （" + l.act + "）" : "")),
                  h("span", { style: { display: "inline-block", maxWidth: "82%", padding: "7px 11px", borderRadius: 13, background: t.bg, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-wrap" } }, l.text)))) : null)
        : m.role === "user"
        ? h("div", { key: m.id, style: { margin: "10px 14px", textAlign: "right" } }, h("span", { style: { display: "inline-block", maxWidth: "82%", textAlign: "left", padding: "9px 13px", borderRadius: 15, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" } }, m.content))
        : m.role === "roll"
        ? h("div", { key: m.id, style: { margin: "8px 20px", textAlign: "center", fontFamily: "monospace", fontSize: 11.5, color: t.sub, background: t.bg2, border: "1px dashed " + t.line, borderRadius: 10, padding: "6px 10px" } }, "🎲 " + m.content)
        : m.role === "sys"
        ? h("div", { key: m.id, style: { margin: "6px 20px", textAlign: "center", fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, m.content)
        : h("div", { key: m.id, onPointerDown: () => pressMsg(m), onPointerUp: pressEnd, onPointerMove: pressEnd, onPointerLeave: pressEnd, onContextMenu: e => e.preventDefault(), style: { margin: "10px 14px" } },
            h("div", { style: S.txt }, m.content),
            // 数值角标:钉在造成它的这一拍正文脚下,红=掉血 绿=回血 墨=得 灰=失 金=线索
            m.chips && m.chips.length ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 } },
              m.chips.map((ch, i) => {
                const col = ch.k === "hp" ? "#a4442e" : ch.k === "hpup" ? "#5a7d5a" : ch.k === "clue" ? "#8a6d3b" : ch.k === "lose" ? t.fog : t.ink;
                return h("span", { key: i, style: { fontFamily: F_BODY, fontSize: 10, color: col, border: "1px solid " + col + "55", background: t.bg2, borderRadius: 999, padding: "2px 8px" } }, ch.txt);
              })) : null));
      const msgSheet = msgMenu && h("div", { onClick: () => setMsgMenu(null), style: { position: "fixed", inset: 0, zIndex: 140, background: "rgba(30,28,24,.4)", display: "flex", alignItems: "flex-end" } },
        h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", background: t.bg2, borderRadius: "18px 18px 0 0", padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.7, padding: "0 2px 8px" } }, "从这一拍岔开一条新团:这一拍之前原样保留(HP/物品/章节都按当时恢复),之后的重演。原团一个字不动。"),
          [["⑂ 从这里分支", () => branchFrom(msgMenu)], ["取消", () => setMsgMenu(null)]].map(([label, fn], i) => h("button", { key: label, onClick: fn, style: { width: "100%", padding: "13px 0", fontFamily: F_BODY, fontSize: 14, color: i === 0 ? t.ink : t.sub, background: "none", border: "none", borderTop: i ? "1px solid " + t.line : "none" } }, label))));
      // 选谁入镜:有参考照的队友挑一位锁脸(你自己有参考照就自动合照),或只拍场景
      const shotSheet = shotPick && h("div", { onClick: () => setShotPick(false), style: { position: "fixed", inset: 0, zIndex: 140, background: "rgba(30,28,24,.4)", display: "flex", alignItems: "flex-end" } },
        h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", background: t.bg2, borderRadius: "18px 18px 0 0", padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.7, padding: "0 2px 8px" } }, "选一位当画面主角:会先试把【所有】有参考照的脸一起锁上" + (props.profile && props.profile.refPhoto ? "(含你自己)" : "") + ";全员没锁成再退到只锁 TA" + (props.profile && props.profile.refPhoto ? " 和你" : "") + ",其余人远景虚化。"),
          camp.partyIds.map(charOf).filter(c2 => c2 && c2.refPhoto).map(c2 =>
            h("button", { key: c2.id, onClick: () => genShot(c2), style: { width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 4px", fontFamily: F_BODY, fontSize: 14, color: t.ink, background: "transparent", border: "none", borderTop: "1px solid " + t.line } }, avatarOf(c2, 28), c2.name)),
          h("button", { onClick: () => genShot(null), style: { width: "100%", padding: "13px 0", fontFamily: F_BODY, fontSize: 14, color: t.ink, background: "transparent", border: "none", borderTop: "1px solid " + t.line } }, "🏞 只拍场景(不锁脸)"),
          h("button", { onClick: () => setShotPick(false), style: { width: "100%", padding: "13px 0", fontFamily: F_BODY, fontSize: 14, color: t.fog, background: "transparent", border: "none", borderTop: "1px solid " + t.line } }, "取消")));
      const photoSheet = photoMenu && h("div", { onClick: () => setPhotoMenu(null), style: { position: "fixed", inset: 0, zIndex: 140, background: "rgba(30,28,24,.4)", display: "flex", alignItems: "flex-end" } },
        h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", background: t.bg2, borderRadius: "18px 18px 0 0", padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)" } },
          [["重画这张", () => { const m = photoMenu; setPhotoMenu(null); rerollShot(m); }],
           ["保存到手机相册", () => { const m = photoMenu; setPhotoMenu(null); saveToAlbum(m.img); }],
           ["取消", () => setPhotoMenu(null)]].map(([label, fn], i) => h("button", { key: label, onClick: fn, style: { width: "100%", padding: "13px 0", fontFamily: F_BODY, fontSize: 14, color: i === 2 ? t.fog : t.ink, background: "transparent", border: "none", borderTop: i ? "1px solid " + t.line : "none" } }, label))));
      // 大图查看器(objectFit:contain 看整张,可存相册)
      const bigViewer = bigView && h("div", { onClick: () => setBigView(null), style: { position: "fixed", inset: 0, zIndex: 150, background: "rgba(20,18,16,.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 14px calc(env(safe-area-inset-bottom, 0px) + 20px)" } },
        h("img", { src: imgSrc(bigView.img), onClick: e => e.stopPropagation(), style: { maxWidth: "100%", maxHeight: "72vh", borderRadius: 10, objectFit: "contain" } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#d9d3c8", marginTop: 12, textAlign: "center" } }, bigView.title || camp.title),
        h("div", { onClick: e => e.stopPropagation(), style: { display: "flex", gap: 10, marginTop: 14 } },
          h("button", { onClick: () => saveToAlbum(bigView.img), style: { padding: "8px 16px", borderRadius: 12, fontFamily: F_BODY, fontSize: 12, border: "none", background: "#f0ece4", color: "#26231e" } }, "保存到手机相册")));
      // 待重试:最后一拍是玩家宣言/检定(守密人还没接话,多半是上次生成失败)——
      // 出「继续这一拍」沿用原有骰点重跑叙事;没掷过骰子才允许「撤回重写」
      const lastGmIdx2 = camp.msgs.map(m => m.role).lastIndexOf("gm");
      const tailMsgs = camp.msgs.slice(lastGmIdx2 + 1);
      const pendingRetry = !busy && !camp.ended && tailMsgs.some(m => m.role === "user" || m.role === "roll");
      const tailHasRoll = tailMsgs.some(m => m.role === "roll");
      // 卡死自救:没在忙、没有选项、也没有待确认横幅时,给一条「让守密人继续」的路
      const stuck = !busy && !camp.ended && !pendingRetry && !camp.choices.length && !camp.pendingStage && !camp.pendingEnd;
      // 大地图浮层:迷雾按「去过/听说过(与去过的地方有路相连)/未知」三档;
      // 章节星标只标已揭晓的章;当前位置一圈脉冲。点节点看详情,相邻才能「前往」。
      const TERR_TINT = { 山地: "#d9d0c2", 平原: "#dde2cd", 森林: "#cfdac8", 水泽: "#cdd8dc", 荒漠: "#e4d9c2", 城郭: "#ddd3d6" };
      const mapLayer = (mapOpen && builtMap) ? (() => {
        const visited = {}; (camp.visited || []).forEach(n => visited[n] = 1);
        const frontier = {};
        builtMap.edges.forEach(e => {
          if (visited[e[0]] && !visited[e[1]]) frontier[e[1]] = 1;
          if (visited[e[1]] && !visited[e[0]]) frontier[e[0]] = 1;
        });
        const starAt = {}; camp.stages.forEach((s, i) => { if (i <= camp.stageIdx && s.place) starAt[s.place] = true; });
        const sel = selNode ? builtMap.nodes.find(n => n.name === selNode) : null;
        const adjToPos = mapAdjacent(builtMap.edges, camp.pos);
        const canGo = sel && !busy && !camp.ended && !pendingRetry && sel.name !== camp.pos && adjToPos.indexOf(sel.name) >= 0;
        // 视口:默认放大 2 倍中心对准队伍;单指拖动平移,双指捏合缩放(同一套 pointer
        // 事件处理,免得两指时第一根手指还在平移——参考项目的坑);拖动超过 6px 就
        // 不算点选,防止拖完一松手误选了节点
        const vb = mapVB || { cx: builtMap.W / 2, cy: builtMap.H / 2, k: 2 };
        const clampVB = v => { const w = builtMap.W / v.k, h2 = builtMap.H / v.k; return { k: v.k, cx: Math.max(w / 2, Math.min(builtMap.W - w / 2, v.cx)), cy: Math.max(h2 / 2, Math.min(builtMap.H - h2 / 2, v.cy)) }; };
        const vbStr = (vb.cx - builtMap.W / vb.k / 2).toFixed(1) + " " + (vb.cy - builtMap.H / vb.k / 2).toFixed(1) + " " + (builtMap.W / vb.k).toFixed(1) + " " + (builtMap.H / vb.k).toFixed(1);
        const onPD = e => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (e2) {} const P = mapPtr.current; P.pts[e.pointerId] = { x: e.clientX, y: e.clientY }; if (Object.keys(P.pts).length === 1) P.moved = false; P.dist = 0; };
        const onPM = e => {
          const P = mapPtr.current;
          if (!P.pts[e.pointerId]) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const ids = Object.keys(P.pts);
          if (ids.length === 1) {
            const p0 = P.pts[e.pointerId];
            const dx = e.clientX - p0.x, dy = e.clientY - p0.y;
            if (Math.abs(dx) + Math.abs(dy) > 6) P.moved = true;
            P.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
            setMapVB(v => clampVB({ k: (v || vb).k, cx: (v || vb).cx - dx * (builtMap.W / (v || vb).k) / rect.width, cy: (v || vb).cy - dy * (builtMap.W / (v || vb).k) / rect.width }));
          } else if (ids.length === 2) {
            P.moved = true;
            P.pts[e.pointerId] = { x: e.clientX, y: e.clientY };
            const pts = Object.keys(P.pts).map(id => P.pts[id]);
            const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            if (P.dist) setMapVB(v => clampVB(Object.assign({}, v || vb, { k: Math.max(1, Math.min(6, (v || vb).k * d / P.dist)) })));
            P.dist = d;
          }
        };
        const onPU = e => { const P = mapPtr.current; delete P.pts[e.pointerId]; P.dist = 0; };
        const zoomBtn = (label, fn) => h("button", { onClick: fn, style: { width: 34, height: 34, borderRadius: 10, fontFamily: F_BODY, fontSize: 15, border: "1px solid " + t.line, background: t.bg2, color: t.ink } }, label);
        return h("div", { style: { position: "fixed", inset: 0, zIndex: 130, background: t.bg, display: "flex", flexDirection: "column" } },
          h("div", { style: S.top },
            h("button", { onClick: () => { setMapOpen(false); setSelNode(null); }, style: { fontSize: 18, color: t.ink, background: "none", border: "none", padding: "0 4px" } }, "←"),
            h("div", { style: S.h1 }, "舆图 · " + camp.title),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, "队伍在「" + (camp.pos || camp.place) + "」")),
          h("div", { style: { flex: 1, minHeight: 0, position: "relative", padding: "10px 10px 0" } },
            h("div", { style: { position: "absolute", right: 18, top: 18, zIndex: 2, display: "flex", flexDirection: "column", gap: 6 } },
              zoomBtn("＋", () => setMapVB(v => clampVB(Object.assign({}, v || vb, { k: Math.min(6, (v || vb).k * 1.4) })))),
              zoomBtn("－", () => setMapVB(v => clampVB(Object.assign({}, v || vb, { k: Math.max(1, (v || vb).k / 1.4) })))),
              zoomBtn("⌖", () => { const nd = builtMap.nodes.find(n => n.name === camp.pos); setMapVB({ cx: nd ? nd.x : builtMap.W / 2, cy: nd ? nd.y : builtMap.H / 2, k: Math.max(2, vb.k) }); })),
            h("svg", { viewBox: vbStr, preserveAspectRatio: "xMidYMid meet", onPointerDown: onPD, onPointerMove: onPM, onPointerUp: onPU, onPointerCancel: onPU, style: { width: "100%", height: "100%", display: "block", borderRadius: 14, background: t.bg2, border: "1px solid " + t.line, touchAction: "none" } },
              builtMap.regions.map(r => h("path", { key: "b" + r.name, d: r.blob, fill: TERR_TINT[r.terrain] || t.bg, stroke: t.line, strokeWidth: 1, opacity: 0.75 })),
              builtMap.regions.map(r => h("text", { key: "t" + r.name, x: r.cx, y: r.cy - 16, textAnchor: "middle", fontSize: 11, fill: t.fog, fontFamily: F_DISPLAY, opacity: 0.85 }, r.name)),
              builtMap.roads.map((rd, i) => {
                // 迷雾也罩路:两端都没去过/听说过的路不画
                const seen = n => visited[n] || frontier[n];
                if (!(seen(rd.a) && seen(rd.b))) return null;
                return h("path", { key: "r" + i, d: rd.d, fill: "none", stroke: t.fog, strokeWidth: 1.2, strokeDasharray: "5 4", strokeLinecap: "round", opacity: 0.65 });
              }),
              builtMap.nodes.map(nd => {
                const isV = !!visited[nd.name], isF = !isV && !!frontier[nd.name];
                if (!isV && !isF) return null;
                const here = nd.name === camp.pos;
                // 拖动松手不算点选(moved 由 pointer 处理器置位)
                return h("g", { key: nd.name, onClick: () => { if (!mapPtr.current.moved) setSelNode(nd.name); } },
                  here ? h("circle", { cx: nd.x, cy: nd.y, r: 9, fill: "none", stroke: t.ink, strokeWidth: 1 },
                    h("animate", { attributeName: "r", values: "7;12;7", dur: "1.8s", repeatCount: "indefinite" }),
                    h("animate", { attributeName: "opacity", values: ".8;.1;.8", dur: "1.8s", repeatCount: "indefinite" })) : null,
                  h("circle", { cx: nd.x, cy: nd.y, r: isV ? 5 : 4.5, fill: isV ? t.ink : t.bg2, stroke: isV ? t.ink : t.fog, strokeWidth: 1.2, strokeDasharray: isF ? "2.5 2.5" : "none" }),
                  starAt[nd.name] ? h("text", { x: nd.x + 7, y: nd.y - 6, fontSize: 10, fill: "#8a6d3b" }, "★") : null,
                  h("text", { x: nd.x, y: nd.y + 16, textAnchor: "middle", fontSize: 9.5, fill: isV ? t.ink : t.fog, fontFamily: F_BODY, stroke: t.bg2, strokeWidth: 3, paintOrder: "stroke" }, nd.name),
                  // 隐形大热区:手指点得准的秘诀(视觉 5px,热区 16px)
                  h("circle", { cx: nd.x, cy: nd.y, r: 16, fill: "transparent" }));
              })),
            null),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, lineHeight: 1.7, padding: "6px 16px" } }, "单指拖动 · 双指缩放 · 实心=去过 · 虚圈=听说过 · ★=章节目标 · 没亮的是迷雾"),
          sel ? h("div", { style: { borderTop: "1px solid " + t.line, background: t.bg2, padding: "12px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, sel.name + (starAt[sel.name] ? " ★" : "")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, marginTop: 3 } }, sel.region + " · " + sel.kind + " · " + (visited[sel.name] ? "去过" : "只是听说过的方向")),
            h("div", { style: { display: "flex", gap: 8, marginTop: 9 } },
              sel.name === camp.pos ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "7px 0" } }, "队伍就在这里")
              : canGo ? h("button", { onClick: () => { setMapOpen(false); setSelNode(null); turn("(动身前往「" + sel.name + "」)", null, { travel: sel.name }); }, style: S.btn(true) }, "动身前往")
              : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "7px 0" } }, busy ? "这一拍还没落定" : "太远了——路要一步步走,先去相邻的地点"),
              h("button", { onClick: () => setSelNode(null), style: S.btn(false) }, "收起"))) : null);
      })() : null;
      return h("div", { style: S.wrap }, badges(), askSheet,
        camp.bg ? h("div", { style: { position: "absolute", inset: 0, zIndex: 0, backgroundImage: "linear-gradient(rgba(240,236,228,.8),rgba(240,236,228,.8)), url(" + imgSrc(camp.bg) + ")", backgroundSize: "cover", backgroundPosition: "center" } }) : null,
        ceremonyLayer, msgSheet, photoSheet, shotSheet, bigViewer, mapLayer,
        h("div", { style: { position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } },
        header(camp.title + " · " + (camp.place || ""), h("div", { style: { display: "flex", gap: 6 } },
          builtMap ? h("button", { onClick: () => { const nd = builtMap.nodes.find(n => n.name === camp.pos); setMapVB({ cx: nd ? nd.x : builtMap.W / 2, cy: nd ? nd.y : builtMap.H / 2, k: 2 }); setSelNode(camp.pos || null); setMapOpen(true); }, style: S.btn(false) }, "🗺 舆图") : null,
          h("button", { onClick: () => setPanelOpen(v => !v), style: S.btn(false) }, panelOpen ? "收起" : "队伍与线索"))),
        panel, resume, banner,
        h("div", { ref: scrollRef, style: { flex: 1, overflowY: "auto", paddingBottom: 16 } }, flow, epFlow,
          busy ? h("div", { style: { margin: "10px 14px", fontFamily: F_BODY, fontSize: 12, color: t.fog } }, busyWhat || "守密人在推演命运…") : null),
        camp.ended ? h("div", { style: { textAlign: "center", padding: "16px 14px calc(env(safe-area-inset-bottom, 0px) + 16px)", borderTop: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 11, letterSpacing: 2, color: t.fog } }, "—— 已落幕 · 长按任意一拍可分支重走 ——")
        : h("div", { style: { borderTop: "1px solid " + t.line, background: "rgba(255,255,255,.36)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" } }, [
          pendingRetry ? h("div", { key: "rt", style: { display: "flex", flexWrap: "wrap", gap: 7, padding: "8px 14px 0" } },
            h("button", { onClick: () => turn(""), style: S.btn(true) }, "▶ 继续这一拍" + (tailHasRoll ? "(沿用已掷的骰子)" : "")),
            // 掷过骰子就不给撤回:撤了等于洗骰子
            !tailHasRoll ? h("button", { onClick: retractTail, style: S.btn(false) }, "↩ 撤回重写") : null)
          : (camp.choices.length || stuck) ? h("div", { key: "ch", style: { display: "flex", flexWrap: "wrap", gap: 7, padding: "8px 14px 0" } },
            camp.choices.map((c, i) => {
              const lacking = c.need && !hasItem(camp.items, c.need);
              return h("button", { key: i, onClick: () => pickChoice(c), disabled: busy, style: Object.assign({}, S.btn(false), { textAlign: "left", opacity: lacking ? 0.7 : 1 }) },
                c.text,
                c.check ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, " 🎲" + STAT_ZH[c.check.stat] + (c.check.who ? "·" + c.check.who : "")) : null,
                c.need ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: lacking ? "#a4442e" : t.fog } }, (lacking ? " ⚠缺" + c.need + "·可硬闯" : " ✓" + c.need)) : null);
            }),
            stuck ? h("button", { key: "go", onClick: () => turn(""), disabled: busy, style: S.btn(false) }, "让守密人继续 →") : null) : null,
          noteOpen ? h("div", { key: "nt", style: { padding: "8px 14px 0" } },
            h("textarea", { value: note, onChange: e => setNote(e.target.value), rows: 2, placeholder: "跟守密人咬耳朵(只给下一回合的幕后指示,不入剧情):比如「节奏快一点」「让某人多点戏」", style: { width: "100%", padding: 8, borderRadius: 10, border: "1px dashed " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 12, color: t.ink, resize: "none", outline: "none" } })) : null,
          plusOpen ? h("div", { key: "pl", style: { display: "flex", gap: 8, padding: "8px 14px 0", flexWrap: "wrap" } },
            h("button", { onClick: () => setDice(v => !v), style: S.btn(dice) }, "🎲 剧情骰" + (dice ? "·已上膛" : "")),
            h("button", { onClick: () => setNoteOpen(v => !v), style: S.btn(noteOpen || !!note.trim()) }, "() 咬耳朵"),
            h("button", { onClick: () => addBeat(), disabled: busy, style: S.btn(false) }, "✍ 追加一笔"),
            h("button", { onClick: () => { setChatMode(v => !v); setPlusOpen(false); }, style: S.btn(chatMode) }, "💬 闲聊模式" + (chatMode ? "·开" : "")),
            h("button", { onClick: () => { setPlusOpen(false); turn("(队伍暂且停下,就地休整)", null, "rest"); }, disabled: busy, style: S.btn(false) }, "🏕 休整一拍"),
            h("button", { onClick: () => { const lockables = camp.partyIds.map(charOf).filter(c2 => c2 && c2.refPhoto); if (lockables.length) { setPlusOpen(false); setShotPick(true); } else genShot(null); }, disabled: busy, style: S.btn(false) }, "📷 当拍画面"),
            h("button", { onClick: genCover, disabled: busy, style: S.btn(false) }, camp.cover ? "🎞 重出封面" : "🎞 封面图"),
            camp.cover ? h("button", { onClick: () => { setPlusOpen(false); setBigView({ img: camp.cover, title: camp.title + " · 封面" }); }, style: S.btn(false) }, "🔍 看封面整张") : null,
            camp.cover && camp.bg !== camp.cover ? h("button", { onClick: () => { update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { bg: camp.cover }))); setPlusOpen(false); props.toast("封面已铺成背景"); }, style: S.btn(false) }, "🖼 封面当背景") : null,
            h("button", { onClick: () => fileRef.current && fileRef.current.click(), style: S.btn(false) }, "🖼 传背景图"),
            camp.bg ? h("button", { onClick: () => { update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { bg: null }))); setPlusOpen(false); }, style: Object.assign({}, S.btn(false), { color: "#a4442e", borderColor: "#a4442e55" }) }, "清除背景") : null) : null,
          h("div", { key: "in", style: { display: "flex", gap: 8, padding: "10px 14px calc(env(safe-area-inset-bottom, 0px) + 12px)" } },
            h("input", { type: "file", accept: "image/*", ref: fileRef, onChange: onBgFile, style: { display: "none" } }),
            h("button", { onClick: () => setPlusOpen(v => !v), style: Object.assign({}, S.btn(plusOpen || dice || !!note.trim()), { padding: "7px 12px" }) }, plusOpen ? "×" : "+"),
            h("textarea", { value: input, onChange: e => setInput(e.target.value), rows: 1, placeholder: chatMode ? "闲聊两句(不推进剧情、不动状态)…" : "或者,你想说的话、想做的事…", style: { flex: 1, padding: "10px 13px", borderRadius: 14, border: "1px solid " + (chatMode ? t.fog : t.line), background: "rgba(255,255,255,.72)", fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "none", outline: "none" } }),
            h("button", { onClick: send, disabled: busy, style: S.btn(true) }, chatMode ? "闲聊" : "行动"))
        ])));
    }

    // 上一次动这个团是多久以前
    const campAgo = c => {
      const m = (c.msgs || [])[(c.msgs || []).length - 1];
      const ts = (m && m.ts) || c.createdAt || 0;
      if (!ts) return "";
      const d = Date.now() - ts;
      if (d < 0) return "";
      if (d < 3600e3) return "刚动过";
      const n = new Date(), midnight = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
      if (ts >= midnight) return Math.max(1, Math.floor(d / 3600e3)) + "小时前";
      if (ts >= midnight - 86400e3) return "昨天";
      const days = Math.floor((midnight - ts) / 86400e3) + 1;
      if (days <= 30) return days + "天前";
      const dd = new Date(ts);
      return (dd.getMonth() + 1) + "月" + dd.getDate() + "日";
    };
    // 入口:战役列表
    // 战役卡：一份摊在桌上的卷宗。她 2026-08-30 说「框还是有点无聊，做点有创意的」，
    // 所以卡上多的都是【一眼能读出来的东西】：左边一枚二十面骰，骰面上刻着现在第几章；
    // 底下一排章节点（●走过 ◎正在 ○还不知道）；封面从背景挪成右边贴上去的一张相片。
    const campCard = c => {
      const members = [null].concat(c.partyIds.map(charOf));
      const cur = Math.min(c.stageIdx + 1, c.stages.length);
      const tone = TRPG_HOUR[(c.time || {}).part] ? (c.time || {}).part : "昼";
      const seal = c.ended ? "#8a8577" : "#8a6d3b";
      return h("div", { key: c.id, onClick: () => { setPlayId(c.id); setView("play"); setPanelOpen(false); },
        style: Object.assign({}, S.card, { cursor: "pointer", position: "relative", overflow: "hidden", padding: 0, opacity: c.ended ? .88 : 1 }) },
        // 封面：右边贴上去的一张相片，左边留给字
        c.cover ? h("span", { style: { position: "absolute", inset: "0 0 0 auto", width: "58%", backgroundImage: "url(" + imgSrc(c.cover) + ")", backgroundSize: "cover", backgroundPosition: "center", opacity: .9 } }) : null,
        c.cover ? h("span", { style: { position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(246,242,234,.97) 0%, rgba(246,242,234,.93) 46%, rgba(246,242,234,.30) 100%)" } }) : null,
        h("button", { onClick: e => { e.stopPropagation(); askConfirm("删除「" + c.title + "」和全部记录?", () => update(list => list.filter(x => x.id !== c.id))); }, style: { position: "absolute", top: 2, right: 2, width: 40, height: 40, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: t.fog, fontSize: 15, padding: 0 } }, "✕"),
        // 已落幕：右下角盖一枚歪着的戳
        c.ended ? h("span", { style: { position: "absolute", right: 12, bottom: 10, transform: "rotate(-11deg)", border: "1.5px solid " + seal, color: seal, borderRadius: 6, padding: "1px 7px", fontFamily: F_BODY, fontSize: 10, letterSpacing: 1, opacity: .8 } }, "落幕") : null,
        h("div", { style: { position: "relative", display: "flex", gap: 11, padding: "13px 13px 0" } },
          // 二十面骰：骰面上刻着现在走到第几章
          h("span", { style: { position: "relative", width: 40, height: 44, flexShrink: 0 } },
            h("svg", { viewBox: "0 0 40 44", style: { position: "absolute", inset: 0, width: "100%", height: "100%" } },
              h("path", { d: "M20 2l16 9v22l-16 9-16-9V11z", fill: "rgba(255,255,255,.66)", stroke: seal, strokeWidth: 1.3, strokeLinejoin: "round" }),
              h("path", { d: "M4 11l16 9 16-9M20 20v22", fill: "none", stroke: seal, strokeWidth: .8, opacity: .28 })),
            h("span", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 17, fontWeight: 600, color: seal } }, String(cur))),
          h("div", { style: { flex: 1, minWidth: 0, paddingRight: 26 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, c.title),
            c.branchedFrom ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 2 } }, "⑂ 分支自「" + (c.branchedFrom.title || "原团") + "」第 " + (c.branchedFrom.at || 0) + " 拍") : null,
            h("div", { style: Object.assign({}, S.txt, { color: t.sub, fontSize: 12, marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }) }, c.world))),
        // 章节点：走过的实心、正在的空心大一圈、还不知道的虚线
        h("div", { style: { position: "relative", display: "flex", alignItems: "center", gap: 5, padding: "9px 13px 0" } },
          c.stages.map((st, i) => {
            const passed = st.done || c.ended;
            const here = i === c.stageIdx && !c.ended;
            return h("span", { key: i, style: {
              width: here ? 9 : 7, height: here ? 9 : 7, borderRadius: 999, flexShrink: 0,
              background: passed ? seal : "transparent",
              border: "1.5px solid " + (passed ? seal : here ? seal : t.line),
              opacity: !passed && !here ? .7 : 1
            } });
          }),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginLeft: 3 } }, "第" + cur + "/" + c.stages.length + "章 · " + c.msgs.length + "拍")),
        // 底沿：谁在这支队里、哪支队、上次什么时候动的
        h("div", { style: { position: "relative", display: "flex", alignItems: "center", gap: 4, marginTop: 9, padding: "8px 13px 11px", borderTop: "1px solid " + t.line, background: "rgba(46,38,29,.035)" } },
          members.map((m, i) => h("span", { key: i, style: { marginLeft: i ? -6 : 0, borderRadius: 999, boxShadow: "0 0 0 1.5px rgba(246,242,234,.95)" } },
            i === 0 ? avatarOf({ name: uName, avatarImage: props.profile && props.profile.avatarImage, color: props.profile && props.profile.color }, 21) : m ? avatarOf(m, 21) : null)),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginLeft: 6, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
            [c.squadName || "", campAgo(c)].filter(Boolean).join(" · ")),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, opacity: .8 } }, TRPG_HOUR[tone] === TRPG_HOUR["昼"] && tone !== "昼" ? "" : ((c.time || {}).part || ""))));
    };
    // ---- 组建队伍(她 2026-08-28 定稿:数值在这里掷定,进什么副本都用这套) ----
    if (view === "squadNew") {
      const togglePick = id => {
        if (pickIds.indexOf(id) >= 0) { setPickIds(p => p.filter(x => x !== id)); return; }
        if (pickIds.length >= 4) return props.toast("一支小分队最多 4 名队友");
        const ch = charOf(id);
        setBmRolls(r => r[id] ? r : Object.assign({}, r, { [id]: personaNudge(rollStats(), ch && ch.persona) }));
        setPickIds(p => p.concat([id]));
      };
      const roster = [{ key: "user", name: uName }].concat(pickIds.map(id => ({ key: id, name: (charOf(id) || {}).name || "?" })));
      return h("div", { style: S.wrap }, badges(), askSheet, header("组建小分队"),
        h("div", { style: { flex: 1, overflowY: "auto", paddingBottom: 30 } },
          h("div", { style: S.card }, h("div", { style: S.lbl }, "队名"),
            h("input", { value: squadName, onChange: e => setSquadName(e.target.value), placeholder: "比如「家园号勘探组」", style: { width: "100%", padding: "8px 10px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg, fontFamily: F_BODY, fontSize: 13, color: t.ink, outline: "none" } })),
          h("div", { style: S.card }, h("div", { style: S.lbl }, "拉队友(0-4 名;一个不拉=你的单人队)"),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 } },
              props.characters.map(c => h("div", { key: c.id, onClick: () => togglePick(c.id), style: { display: "flex", alignItems: "center", gap: 6, padding: "5px 10px 5px 6px", borderRadius: 999, border: "1.5px solid " + (pickIds.indexOf(c.id) >= 0 ? t.ink : t.line), background: pickIds.indexOf(c.id) >= 0 ? t.ink : "transparent" } },
                avatarOf(c, 24), h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: pickIds.indexOf(c.id) >= 0 ? t.bg2 : t.ink } }, c.name))))),
          h("div", { style: S.card }, h("div", { style: S.lbl }, "建队数值(3d6×5,队友按人设微调;建好就定,成长靠打)"),
            roster.map(m => { const st = m.key === "user" ? (bmRolls.user || {}) : (bmRolls[m.key] || {});
              return h("div", { key: m.key, style: Object.assign({}, S.txt, { fontSize: 12, marginBottom: 2 }) }, m.name + ":" + STATS.map(([k, zh]) => zh + " " + (st[k] || "?")).join(" · ") + " · ✦×" + fateOf(st.luck)); }),
            h("div", { style: { display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" } },
              h("button", { onClick: () => { const r = { user: rollStats() }; pickIds.forEach(id => { r[id] = personaNudge(rollStats(), (charOf(id) || {}).persona); }); setBmRolls(r); }, style: S.btn(false) }, "重掷全队"),
              h("button", { onClick: () => {
                const name = squadName.trim();
                if (!name) return props.toast("先给队伍起个名字");
                const v = loadSquads();
                if (v.squads.some(x => x.name === name)) return props.toast("已经有叫这个名字的队了");
                const members = roster.map(m => ({ key: m.key, name: m.name, stats: Object.assign({}, m.key === "user" ? (bmRolls.user || rollStats()) : (bmRolls[m.key] || rollStats())), feats: [], scars: [], runs: 0 }));
                const sq = { id: rid("sq_"), name, ts: Date.now(), runs: 0, members };
                v.squads.unshift(sq); saveSquads(v);
                setPickSquadId(sq.id); setSquadTick(x => x + 1);
                props.toast("「" + name + "」组建好了——数值已定,专长会在第一次开团时按世界配");
                setDraft(null); setKw(""); setView("create");
              }, style: S.btn(true) }, "⚔ 建队,去开团")))));
    }

    // ---- 图库(和小剧场一样:出过的图永久归档,删团不删图) ----
    if (view === "gallery") {
      const gal = loadGal();
      const viewer = galView && h("div", { onClick: () => setGalView(null), style: { position: "fixed", inset: 0, zIndex: 150, background: "rgba(20,18,16,.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 14px calc(env(safe-area-inset-bottom, 0px) + 20px)" } },
        h("img", { src: imgSrc(galView.img), onClick: e => e.stopPropagation(), style: { maxWidth: "100%", maxHeight: "72vh", borderRadius: 10, objectFit: "contain" } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#d9d3c8", marginTop: 12, textAlign: "center" } }, (galView.kind === "cover" ? "🎞 封面 · " : "") + (galView.campTitle || "") + " · " + new Date(galView.ts).toLocaleDateString("zh-CN")),
        h("div", { onClick: e => e.stopPropagation(), style: { display: "flex", gap: 10, marginTop: 14 } },
          h("button", { onClick: () => saveToAlbum(galView.img), style: { padding: "8px 16px", borderRadius: 12, fontFamily: F_BODY, fontSize: 12, border: "none", background: "#f0ece4", color: "#26231e" } }, "保存到手机相册"),
          h("button", { onClick: () => { const id = galView.id, img = galView.img; askConfirm("从图库删掉这张?", () => { setGalView(null); galTomb(img); saveGalList(loadGal().filter(x => x.id !== id)); setSquadTick(x => x + 1); }); }, style: { padding: "8px 16px", borderRadius: 12, fontFamily: F_BODY, fontSize: 12, border: "1px solid #ffffff44", background: "transparent", color: "#e8a08c" } }, "删除")));
      return h("div", { style: S.wrap }, badges(), askSheet, header("跑团图库"), viewer,
        h("div", { style: { flex: 1, overflowY: "auto", padding: "14px 14px 30px" } },
          gal.length ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
            gal.map(x => h("div", { key: x.id, onClick: () => setGalView(x), style: { width: "calc((100% - 12px) / 3)", aspectRatio: "1 / 1", borderRadius: 8, overflow: "hidden", background: t.bg2, border: "1px solid " + t.line, position: "relative" } },
              h("img", { src: imgSrc(x.img), style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } }),
              x.kind === "cover" ? h("div", { style: { position: "absolute", left: 4, top: 4, padding: "1px 5px", borderRadius: 6, background: "rgba(20,18,16,.66)", color: "#f0ece4", fontFamily: F_BODY, fontSize: 9 } }, "封面") : null)))
          : h("div", { style: { textAlign: "center", marginTop: 80, fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 2 } }, "还没有图。", h("br"), "跑团里出过的封面和当拍画面都会自动收在这,删团也不丢。")));
    }

    // ---- 入口:小分队 + 战役列表;右上=图库+加号菜单 ----
    const squads = loadSquads().squads;
    // 小分队卡：一张队伍名牌。五项属性画成五根小柱子——数字并排读不出高低，
    // 柱子一眼就看得出这个人是拿体魄吃饭还是拿脑子吃饭（她 2026-08-30：「做点有创意的」）
    const statBars = (stats, col) => h("div", { style: { display: "flex", alignItems: "flex-end", gap: 3, height: 18 } },
      STATS.map(([k, zh]) => h("span", { key: k, title: zh + (stats || {})[k],
        style: { width: 5, height: Math.max(3, Math.round(((stats || {})[k] || 0) / 90 * 18)), borderRadius: 1.5, background: col, opacity: .28 + Math.min(.62, ((stats || {})[k] || 0) / 90 * .62) } })));
    const squadsBlock = squads.length ? squads.map(sq => h("div", { key: sq.id + squadTick, style: Object.assign({}, S.card, { padding: 0, overflow: "hidden" }) },
      h("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "11px 13px 9px" } },
        h("span", { style: { fontSize: 13 } }, "👥"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, sq.name),
        // 出团次数做成一枚布章
        h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: sq.runs ? "#8a6d3b" : t.fog, border: "1px solid " + (sq.runs ? "#8a6d3b66" : t.line), borderRadius: 999, padding: "2px 9px", flexShrink: 0 } }, sq.runs ? "出团 " + sq.runs + " 次" : "新队"),
        h("button", { onClick: () => askConfirm("解散「" + sq.name + "」?这支队的成长与旧伤会一起消失(不影响已开的团)。", () => { const v = loadSquads(); v.squads = v.squads.filter(x => x.id !== sq.id); saveSquads(v); setSquadTick(x => x + 1); }, "解散"), style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, background: "none", border: "1px solid " + t.line, borderRadius: 8, padding: "2px 8px", flexShrink: 0 } }, "解散")),
      h("div", { style: { borderTop: "1px solid " + t.line, background: "rgba(46,38,29,.03)" } },
        // 柱子的表头：五根分别是什么，一支队只写一次
        h("div", { style: { display: "flex", alignItems: "center", padding: "5px 13px 0" } },
          h("span", { style: { flex: 1 } }),
          h("div", { style: { display: "flex", gap: 3 } }, STATS.map(([k, zh]) => h("span", { key: k, style: { width: 5, textAlign: "center", fontFamily: F_BODY, fontSize: 7.5, color: t.fog } }, zh[0]))),
          h("span", { style: { width: 34, flexShrink: 0 } })),
        sq.members.map((v, i) => {
          const ch = v.key === "user" ? { name: uName, avatarImage: props.profile && props.profile.avatarImage, color: props.profile && props.profile.color } : (charOf(v.key) || { name: v.name });
          const col = (ch && ch.color) || "#7a6a5a";
          return h("div", { key: v.key, style: { display: "flex", alignItems: "center", gap: 9, padding: "8px 13px", borderTop: i ? "1px solid " + t.line : "none" } },
            avatarOf(ch, 28),
            h("div", { style: { flex: 1, minWidth: 0 } },
              h("div", { style: { display: "flex", alignItems: "baseline", gap: 6 } },
                h("div", { style: Object.assign({}, S.txt, { fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) }, v.name),
                (v.feats || []).length ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: "#8a6d3b", flexShrink: 0 } }, v.feats.map(f => f.name).join("·")) : null),
              (v.scars || []).length ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: "#a4442e" } }, "旧伤:" + v.scars.map(e => e.name).join("、")) : null),
            statBars(v.stats, col),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, width: 34, textAlign: "right", flexShrink: 0 } }, v.runs ? "×" + v.runs : ""));
        })))) : null;
    const plusSheet = plusMenu && h("div", { onClick: () => setPlusMenu(false), style: { position: "fixed", inset: 0, zIndex: 140, background: "rgba(30,28,24,.4)", display: "flex", alignItems: "flex-end" } },
      h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", background: t.bg2, borderRadius: "18px 18px 0 0", padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)" } },
        [["🎲 开团(带一支小分队进新世界)", () => { setPlusMenu(false); setDraft(null); setKw(""); setView("create"); }],
         ["⚔ 组建队伍(数值此刻掷定,成长归这支队)", () => { setPlusMenu(false); setSquadName("小分队" + "一二三四五六七八九十".charAt(Math.min(9, loadSquads().squads.length))); setPickIds([]); setBmRolls({ user: rollStats() }); setView("squadNew"); }],
         ["取消", () => setPlusMenu(false)]].map(([label, fn], i) => h("button", { key: label, onClick: fn, style: { width: "100%", padding: "13px 0", fontFamily: F_BODY, fontSize: 14, color: i === 2 ? t.fog : t.ink, background: "transparent", border: "none", borderTop: i ? "1px solid " + t.line : "none", textAlign: "center" } }, label))));
    // 最近动过的排前面:开着好几个团时,要找的那个总在最上面
    const lastTs = c => { const m = (c.msgs || [])[(c.msgs || []).length - 1]; return (m && m.ts) || c.createdAt || 0; };
    const byRecent = (a, b) => lastTs(b) - lastTs(a);
    const live = camps.filter(c => !c.ended).sort(byRecent);
    const done = camps.filter(c => c.ended).sort(byRecent);
    const tab = (k, label, n) => h("button", {
      key: k, onClick: () => setListTab(k),
      style: { flex: 1, padding: "7px 0", borderRadius: 10, border: "none", background: listTab === k ? t.bg2 : "transparent",
               boxShadow: listTab === k ? "0 1px 3px rgba(46,38,29,.16)" : "none",
               fontFamily: F_BODY, fontSize: 12, color: listTab === k ? t.ink : t.fog }
    }, label + (n ? " " + n : ""));
    const emptyLine = (a, b) => h("div", { style: { textAlign: "center", marginTop: 70, fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 2 } }, a, b ? h("br") : null, b || null);
    return h("div", { style: S.wrap }, badges(), askSheet, plusSheet,
      header("跑团", h("div", { style: { display: "flex", gap: 6 } },
        h("button", { onClick: () => { setGalView(null); setView("gallery"); }, style: S.btn(false) }, "🖼 图库"),
        h("button", { onClick: () => setPlusMenu(true), style: Object.assign({}, S.btn(true), { padding: "7px 16px" }) }, "＋"))),
      h("div", { style: { display: "flex", gap: 4, margin: "10px 14px 0", padding: 3, borderRadius: 12, background: "rgba(46,38,29,.055)" } },
        tab("live", "在演", live.length), tab("done", "已落幕", done.length), tab("squad", "小分队", squads.length)),
      h("div", { style: { flex: 1, overflowY: "auto", paddingBottom: 30 } },
        listTab === "squad"
          ? (squadsBlock || emptyLine("还没有小分队。", "点右上角 ＋ 组建一支,数值在那时掷定。"))
          : listTab === "done"
            ? (done.length ? done.map(campCard) : emptyLine("还没有落幕的团。"))
            : (live.length ? live.map(campCard)
               : emptyLine(camps.length ? "开着的团都落幕了——去「已落幕」翻。" : "还没开过团。"))));
  }
  if (inApp) window.TrpgApp = TrpgApp;
  // 地图引擎(纯函数)外借给好友地图的【架空】那一半:同一套区域接壤→力导向→团块→道路,
  // 一份实现两处用。各写一份必然走成「一层写在两处,第二处没跟上」。
  if (inApp) window.TrpgMap = { normRegions, mapBuild, mapAdjacent, findNode };
  // 纯函数导出给 node --test;浏览器里没有 module,原样跳过
  if (typeof module === "object" && module.exports) module.exports = { trpgDeskBg, trpgHour, rollStats, personaNudge, gradeCheck, normChoices, applyTurnPayload, foldHist, findMember, shotSafeLines, mulberry32, hashStr, journeyLayout, jitterPts, itemsFix, fmtItem, hasItem, nudgeHits, normRegions, mapBuild, mapAdjacent, findNode, decideOpposed, harmZh, growthRolls };
})();
