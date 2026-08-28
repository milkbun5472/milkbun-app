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
      const fixed = (Array.isArray(list) ? list : []).map(c => {
        const needTop = (c.items || []).some(x => typeof x === "string");
        const needSnap = (c.msgs || []).some(m => m.snap && (m.snap.items || []).some(x => typeof x === "string"));
        if (!needTop && !needSnap) return c;
        changed = true;
        return Object.assign({}, c, { items: itemsFix(c.items), msgs: (c.msgs || []).map(m => m.snap ? Object.assign({}, m, { snap: Object.assign({}, m.snap, { items: itemsFix(m.snap.items) }) }) : m) });
      });
      if (changed) { try { localStorage.setItem("x_trpg", JSON.stringify(fixed)); } catch (e) {} }
      return fixed;
    } catch (e) { return []; }
  };
  const persist = list => { try { localStorage.setItem("x_trpg", JSON.stringify(list)); } catch (e) {} };
  const rid = pre => pre + Date.now() + "_" + Math.random().toString(36).slice(2, 6);

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
        check = { stat: rawCheck.stat, who: who ? who.name : null };
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
    next.party.forEach(m => {
      const d = Math.max(-40, Math.min(40, hpSum[m.name] || 0));
      if (!d) return;
      m.hp = Math.max(0, Math.min(m.maxHp || 100, (m.hp || 0) + d));
      notes.push(m.name + " HP" + (d > 0 ? "+" : "") + d);
      chips.push({ k: d > 0 ? "hpup" : "hp", txt: m.name + " HP" + (d > 0 ? "+" : "") + d + " →" + m.hp });
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
  // 历史折叠:守密人→assistant,其余(玩家/骰子/系统)全并进 user 侧,
  // 连续同侧合成一条——上游对连续同角色消息的容忍度不一,不赌。
  function foldHist(msgs) {
    const out = [];
    (msgs || []).forEach(m => {
      const role = m.role === "gm" ? "assistant" : "user";
      const content = (m.role === "roll" || m.role === "sys" ? "〔" + m.content + "〕" : m.content) || "";
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

  function TrpgApp(props) {
    const t = useTheme();
    const uName = (props.profile && props.profile.name) || "你";
    const [camps, setCamps] = useState(load);
    const [view, setView] = useState("list"); // list | create | play
    const [playId, setPlayId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [busyWhat, setBusyWhat] = useState("");
    const [panelOpen, setPanelOpen] = useState(false);
    const [draft, setDraft] = useState(null);
    const [pickIds, setPickIds] = useState([]);
    const [kw, setKw] = useState("");
    const [diff, setDiff] = useState("normal");
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
    const update = fn => setCamps(p => { const n = fn(p.slice()); persist(n); return n; });
    useEffect(() => { campsRef.current = camps; });
    const camp = camps.find(c => c.id === playId) || null;
    // 地图布局:由 (战役id, 骨架) 决定的纯函数,毫秒级;memo 一下免得每次打字都重算
    const nodesOf = c => (c && c.mapRegions) ? c.mapRegions.flatMap(r => r.nodes) : [];
    const builtMap = useMemo(() => (camp && camp.mapRegions) ? mapBuild(camp.id, camp.mapRegions) : null, [camp && camp.id]);
    const [mapOpen, setMapOpen] = useState(false);
    const [selNode, setSelNode] = useState(null);
    const msgCount = camp ? camp.msgs.length : 0;
    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgCount, playId]);
    const charOf = id => props.characters.find(c => c.id === id) || null;

    // 人设给全文、封顶 6000(四处一样喂·落地要求4:截断出来的空白由训练先验补上,
    // 那就是霸总;跑团一队至多 1+4 人,谁都不该被砍)
    const personaOf = ch => String((ch && (ch.persona || ch.name)) || "").slice(0, 6000);
    const partyBlock = c => c.party.map(m => {
      const line = m.name + ":HP " + m.hp + "/" + (m.maxHp || 100) + " · " + STATS.map(([k, zh]) => zh + m.stats[k]).join(" ");
      return m.key === "user" ? line + "(玩家本人)" : line;
    }).join("\n");
    const personaBlocks = c => c.party.filter(m => m.key !== "user").map(m => {
      const ch = charOf(m.key);
      return "【队友人设·" + m.name + "(性格与声纹的根基,保持不变)】\n" + (ch ? personaOf(ch) : m.name);
    }).join("\n\n");

    // ---- 开团 ----
    const SHAPE_SETUP = "{\"title\":\"这场跑团的短名字(≤10字)\",\"world\":\"世界观与背景:这个世界怎么运转、此地是哪儿、空气里是什么味道(3-5句,只写长期为真的)\",\"hook\":\"开局处境:队伍此刻为什么聚在这里、眼前正在发生什么(2-3句)\",\"regions\":[{\"name\":\"区域名(≤6字)\",\"terrain\":\"山地|平原|森林|水泽|荒漠|城郭 之一\",\"adj\":[\"接壤的区域名\"],\"nodes\":[{\"name\":\"地点名(≤8字)\",\"kind\":\"城镇|遗迹|野外|地标 之一\",\"hook\":\"这里藏着什么(一句,写给守密人)\"}]}],\"stages\":[{\"goal\":\"第一章要达成的具体一步\",\"hint\":\"守密人自用的一句推进思路\",\"place\":\"这一章的目标在哪个地点(必须用 regions 里的节点名)\"}],\"truth\":\"藏在整件事背后的真相(玩家不可见)\",\"twist\":\"中段翻转:什么时刻、以什么方式掀出来(玩家不可见)\",\"secrets\":\"关键 NPC 各自瞒着什么(玩家不可见,每人一句)\",\"endgame\":\"故事可能的几种结局方向(玩家不可见)\",\"place\":\"开局地点(必须用 regions 里的节点名)\",\"opening\":\"开场正文\",\"choices\":[\"开局给玩家的 2-4 个行动选项\"]}";
    const genSetup = async () => {
      const members = pickIds.map(charOf).filter(Boolean);
      if (!members.length) return props.toast("先拉至少一个队友入队");
      if (!props.active) return props.toast("请先配置线下 API");
      setBusy(true); setBusyWhat("守密人在搭这个世界…");
      try {
        const frame = kw.trim() ? "" : "\n\n【本团取景框(骰子已掷好,三项照办)】\n世界:" + pick(POOL_WORLD) + "\n主线原型:" + pick(POOL_QUEST) + "\n基调:" + pick(POOL_TONE);
        const prior = camps.slice(0, 8).map(c => c.title + "(" + String(c.world || "").slice(0, 24) + ")").join(";");
        const sys = "你在为一场文字跑团做【开团设定】。玩家是 " + uName + ",队友是下面这些角色——保留他们的性格、说话方式与真实能力,把身份处境放进这个新世界(可以贴近原设定,也可以是平行身份,以和世界咬合为准)。\n"
          + "世界要落在一张地图上:regions 给 3-5 个区域,每区 1-3 个节点(地点)。adj 写谁和谁接壤——这决定地图上它们真的相邻;节点的 hook 是守密人自用的一句底(这里埋着什么),玩家看不到。主线各章要分布在【不同区域】的节点上,逼着队伍真的赶路。\n"
          + "主线拆成 4-5 章(stages),每章 goal 是一步【具体、可判定】的事(找到/救出/潜入/揭穿/带到),不是抽象状态;各章连起来是一条完整的弧;place 必须严格用 regions 里已有的节点名。\n"
          + "秘典字段(truth/twist/secrets/endgame)是守密人自用的底牌:truth 要经得起推敲,twist 要在中段真正颠一次盘,secrets 让沿途 NPC 都各怀心事。玩家看不到这些,所以写实话,别写宣传语。\n"
          + "opening 是写给玩家的开场正文(第二人称『你』,6-10句):把队伍放进一个正在发生、必须行动的时刻,交代此地与在场的人,悬着收尾;绝不替 " + uName + " 做决定。开场即可让一两个队友有一句进场的话或动作,声口要各是各的。\n"
          + ABILITY_RULE + "\n只输出 JSON:" + SHAPE_SETUP;
        const user = "【玩家】" + uName + "\n\n" + members.map(ch => "【队友·" + ch.name + " 人设】\n" + personaOf(ch)).join("\n\n")
          + "\n\n【关键词(可空,空则按取景框来)】" + (kw.trim() || "无") + frame
          + (prior ? "\n\n【已经开过的团(务必避开,换皮重来也算重复)】" + prior : "");
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 7600, timeout: 300000 });
        let p = parseObj(raw);
        if (!p) {
          // 内容多半已经写出来了,只是没按 JSON——花一次小调用原样归类,不整局重烧
          const sys2 = "下面是一段已写好的内容,但没按要求输出 JSON。把它【原样整理】成这个形状:\n" + SHAPE_SETUP + "\n【铁律】只搬运归类,一个字不改写;原文没有的字段留空。只输出 JSON,不要代码块。";
          try { p = parseObj(await callAI(props.active, sys2, [{ role: "user", content: String(raw || "").slice(0, 10000) }], { maxTokens: 7600, timeout: 150000 })); } catch (e) { p = null; }
        }
        if (!p) throw new Error("模型没按 JSON 输出,也整理不回来" + rawHint(raw));
        const stages = (Array.isArray(p.stages) ? p.stages : []).map(s => typeof s === "string" ? { goal: s, hint: "" } : s && s.goal ? { goal: String(s.goal), hint: String(s.hint || ""), place: String(s.place || "").trim() } : null).filter(Boolean).slice(0, 6);
        if (!String(p.world || "").trim() || !String(p.opening || "").trim() || stages.length < 2) throw new Error("设定缺了关键部分(世界/开场/章节),再试一次");
        // 地图骨架:坏了/缺了不整局报废——这场团就退化成没有地图的纯叙事团,别的照玩
        const mapRegions = normRegions(p.regions);
        const allNodes = mapRegions ? mapRegions.flatMap(r => r.nodes.map(n => Object.assign({ region: r.name }, n))) : [];
        const startNode = mapRegions ? (findNode(allNodes, p.place) || allNodes[0]) : null;
        stages.forEach(s => { if (mapRegions) { const nd = findNode(allNodes, s.place); s.place = nd ? nd.name : ""; } });
        // 属性此刻就掷好摆给她看;「换一版」重生成设定,「重掷属性」只重掷数值
        const party = [{ key: "user", name: uName, hp: 100, maxHp: 100, stats: rollStats() }]
          .concat(members.map(ch => ({ key: ch.id, name: ch.name, hp: 100, maxHp: 100, stats: personaNudge(rollStats(), ch.persona) })));
        setDraft({ partyIds: members.map(ch => ch.id), keywords: kw.trim(), difficulty: diff, title: p.title || "无名团", world: p.world, hook: p.hook || "", stages: stages.map(s => ({ goal: s.goal, hint: s.hint, place: s.place || "", done: false, note: null })), dossier: { truth: p.truth || "", twist: p.twist || "", secrets: p.secrets || "", endgame: p.endgame || "" }, mapRegions: mapRegions, pos: startNode ? startNode.name : "", place: startNode ? startNode.name : (String(p.place || "").trim() || "起点"), opening: p.opening, choices: normChoices(p.choices, party), party });
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); setBusyWhat(""); }
    };
    const rerollDraftStats = () => setDraft(d => d && Object.assign({}, d, { party: d.party.map(m => Object.assign({}, m, { stats: m.key === "user" ? rollStats() : personaNudge(rollStats(), (charOf(m.key) || {}).persona) })) }));
    const acceptDraft = () => {
      const openMsg = { id: rid("rm_"), role: "gm", content: draft.opening, ts: Date.now(), snap: { hp: draft.party.reduce((m, x) => (m[x.name] = x.hp, m), {}), items: [], clues: [], stageIdx: 0, place: draft.place, pos: draft.pos || "", visited: draft.pos ? [draft.pos] : [], choices: draft.choices } };
      const c = { id: rid("rpg_"), title: draft.title, createdAt: Date.now(), partyIds: draft.partyIds, keywords: draft.keywords, difficulty: draft.difficulty, world: draft.world, hook: draft.hook, stages: draft.stages, stageIdx: 0, dossier: draft.dossier, mapRegions: draft.mapRegions || null, pos: draft.pos || "", visited: draft.pos ? [draft.pos] : [], place: draft.place, party: draft.party, items: [], clues: [], choices: draft.choices, msgs: [openMsg], pendingStage: false, pendingEnd: false, ledger: null, summary: "", sumCount: 0, sumSig: "", ended: false, epilogue: null };
      update(list => [c, ...list]); setDraft(null); setKw(""); setPlayId(c.id); setView("play"); setPanelOpen(false);
    };

    // ---- 检定仪式:她亲手按「掷」,数字滚一秒落定,停 1.2 秒自动继续 ----
    // 延迟是客户端零成本的,但骰子必须是这一回合的情绪高点,不是一行日志
    const runCeremony = (who, statKey, statVal) => new Promise(resolve => {
      setCeremony({ who, statZh: STAT_ZH[statKey], statVal, phase: "ready", roll: 0, grade: null, resolve });
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
            const grade = gradeCheck(roll, c.statVal);
            setTimeout(() => setCeremony(cc => { if (cc && cc.resolve) cc.resolve({ roll, grade }); return null; }), 1300);
            return Object.assign({}, c, { phase: "done", roll, grade });
          });
        } else setCeremony(c => c && Object.assign({}, c, { roll: 1 + Math.floor(Math.random() * 100) }));
      }, 55);
    };

    // ---- 滚动摘要(超过 48 条把最老的压进前情账本,只留近 32 条逐句喂) ----
    const maybeSummarize = async campId => {
      if (sumBusyRef.current || !props.active) return;
      const c = (campsRef.current || []).find(x => x.id === campId);
      if (!c) return;
      const all = c.msgs;
      const done = (c.sumSig && c.sumSig === histSig(all.slice(0, c.sumCount || 0))) ? (c.sumCount || 0) : 0;
      if (all.length - done <= 48) return;
      const cut = all.length - 32;
      const seg = all.slice(done, cut).filter(m => m.role !== "photo").map(m => (m.role === "user" ? uName : m.role === "gm" ? "守密人" : "·") + ":" + m.content).join("\n").slice(0, 9000);
      sumBusyRef.current = true;
      try {
        const prev = c.ledger && LEDGER_KEYS.some(k => (c.ledger[k] || []).length) ? c.ledger : null;
        const sys = "把跑团剧情压缩进一本【前情账本】,不是写摘要散文。合并旧账本与新增剧情,输出四类条目,每条一句话:\n· timeline:已经发生的关键事件,按先后。\n· facts:已确立的事实(身份、真相碎片、约定)。\n· openThreads:【还没了结的线】——悬着的威胁、没兑现的承诺、没答的问题。宁可多留。\n· objects:重要物件在谁手上、什么状态。没有就空数组。\n旧账本条目除非被推翻或了结,一律保留。只输出 JSON:{\"timeline\":[],\"facts\":[],\"openThreads\":[],\"objects\":[]}";
        const user = (prev ? "【旧账本】\n" + JSON.stringify(prev) + "\n\n" : "") + "【新增剧情】\n" + seg;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 2200, timeout: 120000 });
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
        "【跑团·守密人(独立平行时空)】你是这场文字跑团的守密人(GM):叙述世界、扮演一切 NPC,并【完全代入】下面每一位队友本人——写到谁,就是谁在说话行事,用 TA 自己的性格、声口和真实能力(人设在下方),不是在旁边描写一个标签。这是与主线完全无关的平行时空:不引用主线聊天里发生过的事,正文里也不提这是游戏或扮演。",
        "【玩家主权】" + uName + " 的行动、台词和决定永远由 Ta 本人输入:你只写世界、NPC 与队友,绝不替 " + uName + " 做动作、说台词、下决定;写到需要 Ta 抉择的位置就停下来给选项。",
        ABILITY_RULE,
        personaBlocks(c),
        "【世界】" + c.world + (c.hook ? "\n【开局处境】" + c.hook : ""),
        "【守密人秘典(玩家永远不可见,不得在正文中直接说破)】\n真相:" + c.dossier.truth + "\n中段翻转:" + c.dossier.twist + "\nNPC 各自的心事:" + c.dossier.secrets + "\n结局方向:" + c.dossier.endgame + "\n伏笔要一点点埋,已经亮给玩家的线索见下方【线索】,别重复埋同一颗。",
        c.mapRegions ? "【地图(区域·接壤·节点)】\n" + c.mapRegions.map(r => r.name + "(" + r.terrain + ")" + (r.adj.length ? "·接壤:" + r.adj.join("、") : "") + "\n  " + r.nodes.map(n => n.name + "〔" + n.kind + (n.hook ? ":" + n.hook : "") + "〕").join(" / ")).join("\n") + "\n队伍现在位于「" + (c.pos || c.place) + "」。place 只许写地图上已有的节点名;跨节点移动由玩家在地图上发起(会带〔赶路〕指令),你不要自行把队伍挪去别的节点。节点〔〕里的底是你埋的料,按剧情一点点抖,不要一次说穿。" : null,
        "【主线各章】\n" + stageLines + "\n" + (c.stageIdx >= c.stages.length
          ? "各章均已完成:剧情朝落幕收束,把还悬着的线一一收拢,时机成熟就报 ending。"
          : "只有当前章(→)的目标在剧情里【真实发生】后才报 stageDone;一次只推进一章,不许跳章,更不许自导自演替玩家完成。全部章节完成、或剧情自然走到终点时,才报 ending。"),
        "【当前状态(以此为准,不凭记忆)】\n地点:" + c.place + "\n" + partyBlock(c) + "\n物品(名称×数量(持有人),不写持有人=队伍公用):" + (itemsFix(c.items).map(fmtItem).join("、") || "无") + "\n线索:" + (c.clues.map((x, i) => (i + 1) + "." + x).join(" ") || "尚无"),
        dd.play ? "【难度·" + dd.name + "】" + dd.play : null,
        "【检定规则】骰子由客户端掷,你【绝不自己编骰子结果】。历史里的〔检定〕行是既定事实,必须按其等级叙事:大成功给意外之喜;困难成功干净利落;成功达成但可以有小瑕疵;失败让局面复杂化但留有余地;大失败要有戏剧性代价——但检定失败永远制造新的戏,不判死、不判死胡同。需要碰运气的选项才挂 check(stat 取 phy体魄/agi身手/wit头脑/cha谈吐/luck气运;who 填该出手的队伍成员名,谁都能试就填 null——null 时措辞必须任何人都做得来)。不是每个选项都要检定,说句话不用掷骰。need 只挂「有这件东西才走得顺」的选项,而且【只写物品名本身】——绝不带持有人和数量(写「浓缩催吐解毒剂」,不写「浓缩催吐解毒剂(陆衍)」);玩家没有它仍可能硬闯,硬闯你要让它付出代价或临场挂检定;真正没有就绝无可能的事,不要做成选项。",
        "【状态纪律】一切状态变化只通过 JSON 字段报告:掉血/受伤/恢复写进 hp(name 必须严格用上面状态表里的名字;同一人同一拍只写一条,净变化不超过 ±40);拿到东西写 gain(可带 who=拿到的人,队伍公用就省略),失去写 lose(可带 who),东西在成员间转手写 hand:[{\"name\":\"物品\",\"from\":\"谁(可省)\",\"to\":\"谁\"}];新揭示的重要信息写进 clue。正文里发生了、字段里没写=没发生。HP 归零是倒下/濒死,不是死亡;要不要就此落幕由玩家决定。",
        c.summary ? "【前情提要(早前剧情已浓缩,接着往下,别倒回去复述)】\n" + c.summary : null,
        "【输出】叙事正文写进 scene(第二人称称玩家为『你』,NPC 与队友的对话用引号;一回合只推进一小步,留足玩家行动空间;结尾给 2-4 个 choices,至少一个朝当前章目标去,危险的选项要让人看得出险)。只输出 JSON:{\"scene\":\"正文\",\"place\":\"当前地点(没变可省略)\",\"choices\":[{\"text\":\"选项\",\"check\":{\"stat\":\"agi\",\"who\":null}|null,\"need\":null|\"需要的物品\"}],\"hp\":[{\"name\":\"成员名\",\"delta\":-10}],\"gain\":[{\"name\":\"物品\",\"who\":\"持有人(队伍公用省略)\"}],\"lose\":[],\"hand\":[],\"clue\":[],\"stageDone\":false,\"stageNote\":null,\"ending\":false,\"endNote\":null}"
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
          "【输出】只输出 JSON:{\"say\":\"你说的话(可空)\",\"do\":\"你做的事(一句)\"}"].join("\n\n");
        const hist = foldHist(liveMsgs).slice(-24);
        let raw = await window.CCSeat.ask({ tool: "game_turn", game: "trpg", turn_id: "trpg:" + c.id + ":" + rid("tt_"), char_id: String(eng.key), sys: ccSys, msgs: hist, expect: '{"say":"...","do":"..."}', deadline_at: new Date(Date.now() + 180000).toISOString() }, 180000, { charId: String(eng.key) });
        if (raw != null && typeof raw === "object") raw = JSON.stringify(raw);
        const p = parseObj(raw);
        if (!p) return null;
        const say = String(p.say || "").trim(), act = String(p.do || "").trim();
        if (!say && !act) return null;
        return eng.name + (say ? "说:「" + say + "」" : "") + (act ? (say ? " " : "") + act : "");
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
        if (cc) {
          const m = { id: rid("rm_"), role: "sys", content: "亲笔·" + cc, ts: Date.now() };
          liveMsgs.push(m);
          update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { msgs: c.msgs.concat([m]) })));
        }
        const sys = gmSys(camp);
        const hist = foldHist(liveMsgs.slice(camp.sumCount || 0)).slice(-40);
        const tail = "\n\n〔本回合守则〕只推进一小步,绝不替 " + uName + " 行动或代答;队友各用各的声口;历史里的〔检定〕结果是铁的事实,照其等级叙事;状态变化必须写进字段。" + (note.trim() ? "\n〔幕后指示(务必遵循,正文绝不提及)〕" + note.trim() : "") + (dice ? "\n〔剧情骰〕本回合必须自然引入一个意外——类型已掷定:【" + pick(POOL_EVENT) + "】,与世界观相容,落在具体行动上,并实际搅动局面。" : "") + (mode === "rest" ? "\n〔休整拍〕这一拍不推进主线、不引入新危机、不报 stageDone:队伍就地喘口气——【休整的形式必须贴合此刻身处的场景】:荒郊野外才是扎营生火;在室内就是闭门落锁、轮流望风、烧水理伤;在闹市可能只是找了个茶棚角落。照当前地点写,不要千篇一律地支帐篷。让队友们放松下来,聊天、拌嘴、照料伤处、整理手头的线索与物品;可以恢复少量 HP(hp 写正数,每人至多 +15);每位队友至少对下一步提一句自己的看法,意见可以不一致;结尾的选项给 2-3 个休整后动身的方向。" : "")
          + (mode && mode.travel ? "\n〔赶路〕队伍正从「" + (camp.pos || camp.place) + "」动身前往「" + mode.travel + "」:写这段路程(地形气候按两地所在区域来)与抵达后的第一眼;抵达后 place 写「" + mode.travel + "」。" + (Math.random() < 0.18 ? "路上必须遭遇一件事——类型已掷定:【" + pick(POOL_EVENT) + "】,与世界观相容,落在具体行动上。" : "路上不强求遭遇,顺就顺到底。") : "");
        if (hist.length && hist[hist.length - 1].role === "user") hist[hist.length - 1] = { role: "user", content: hist[hist.length - 1].content + tail };
        else hist.push({ role: "user", content: "(继续)" + tail });
        const raw = await callAI(props.active, sys, hist, { maxTokens: (window.StylePresets ? window.StylePresets.outTokens(1400) : 6000), timeout: 300000 });
        const p = parseTurnPayload(raw);
        if (!p) throw new Error("守密人的话没能解析成剧情,已拦住协议原文;再按一次重试");
        update(list => list.map(c => {
          if (c.id !== camp.id) return c;
          const r = applyTurnPayload(c, p, { travelTo: mode && mode.travel, nodes: nodesOf(c) });
          const nc = r.camp;
          // 数值角标钉在这一拍的正文上(chips),不再另发一条居中系统行;
          // 旧存档里已有的 sys 行仍照常渲染
          const msgs = c.msgs.concat([{ id: rid("rm_"), role: "gm", content: p.scene, ts: Date.now(), chips: r.chips.length ? r.chips : undefined, snap: { hp: nc.party.reduce((m, x) => (m[x.name] = x.hp, m), {}), items: nc.items, clues: nc.clues, stageIdx: nc.stageIdx, place: nc.place, pos: nc.pos || "", visited: (nc.visited || []).slice(), choices: nc.choices } }]);
          return Object.assign({}, nc, { msgs });
        }));
        setNote(""); setNoteOpen(false); setDice(false);
        setTimeout(() => maybeSummarize(camp.id), 400);
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
    const pickChoice = async c => {
      if (busy || !camp) return;
      if (c.need && !hasItem(camp.items, c.need)) {
        // 不叫「锁」了(Codex 抓的:界面画着锁点了却能做,是在骗人)——这是「硬闯」,
        // 说清代价再动手;守密人那侧的规则会让硬闯付代价或临场挂检定
        if (!confirm("没有「" + c.need + "」——硬闯试试?守密人会让硬闯付出代价。")) return;
        return turn(c.text + "(没有「" + c.need + "」,硬闯)");
      }
      if (!c.check) return turn(c.text);
      // 命运选人:守密人没点名就由客户端随机指一个——包括玩家自己
      let m = c.check.who ? findMember(camp.party, c.check.who) : null;
      let fated = "";
      if (!m) { m = camp.party[Math.floor(Math.random() * camp.party.length)]; fated = "命运选中了 " + m.name + " —— "; }
      const res = await runCeremony(m.name, c.check.stat, m.stats[c.check.stat]);
      const line = fated + m.name + " 的「" + STAT_ZH[c.check.stat] + "」检定:d100=" + res.roll + " / " + m.stats[c.check.stat] + " → " + res.grade.zh;
      // 检定行作为既定事实和宣言一起入史;之后哪怕生成失败也不撤——重试沿用这颗骰子
      turn(c.text, [{ id: rid("rm_"), role: "roll", content: line, ts: Date.now() }]);
    };
    const send = () => { const text = input.trim(); if (!text) return; setInput(""); turn(text); };
    // 追加一笔(米娅「加戏不推进」的分法):就当前场景补一小段戏——队友拌嘴、环境
    // 细节、NPC 一句闲话。不推进剧情、不动任何状态、不换选项,时钟原地不动。
    // 咬耳朵便签照吃(一次性),想点名「让谁多两句」就写在便签里。
    const addBeat = async () => {
      if (!camp || busy) return;
      if (!props.active) return props.toast("请先配置线下 API");
      setPlusOpen(false); setBusy(true); setBusyWhat("守密人在补这一笔…");
      try {
        const sys = [narrativeCore(),
          "【跑团·追加一笔(平行时空,不提这是游戏)】就【当前场景的这一刻】补一小段戏(2-5句):队友之间的互动、环境里的细节、NPC 的一句闲话、某人没说出口的小动作。写到谁就完全代入谁的性格与声口(人设在下方)。",
          "【铁律】只加戏,不推进:不引入新事件、不揭示新线索、不造成任何伤害或得失、不替 " + uName + " 行动或代答;写完就停,不给选项。",
          personaBlocks(camp),
          "【世界】" + String(camp.world || "").slice(0, 800),
          "【当前状态】地点:" + camp.place + "\n" + partyBlock(camp),
          note.trim() ? "【幕后指示(务必遵循,正文绝不提及)】" + note.trim() : null,
          "【输出】只输出 JSON:{\"scene\":\"补的这一小段\"}"
        ].filter(Boolean).join("\n\n");
        const hist = foldHist(camp.msgs.slice(camp.sumCount || 0)).slice(-24);
        if (!hist.length || hist[hist.length - 1].role !== "user") hist.push({ role: "user", content: "(就此刻补一笔)" });
        const raw = await callAI(props.active, sys, hist, { maxTokens: 2400, timeout: 180000 });
        const p = parseTurnPayload(raw);
        if (!p) throw new Error("这一笔没能解析出来,再试一次");
        // 状态一个字不动:快照原样抄当前值,分支回溯仍然对账
        update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { msgs: c.msgs.concat([{ id: rid("rm_"), role: "gm", content: p.scene, ts: Date.now(), extra: true, snap: { hp: c.party.reduce((m, x) => (m[x.name] = x.hp, m), {}), items: c.items, clues: c.clues, stageIdx: c.stageIdx, place: c.place, pos: c.pos || "", visited: (c.visited || []).slice(), choices: c.choices } }]) })));
        setNote(""); setNoteOpen(false);
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); setBusyWhat(""); }
    };
    // 否决要留回执(Codex 抓的:以前点「还没有」只清横幅,守密人不知道被否过,
    // 下一拍可能又报完成):否决写成一条幕后事实进史,守密人下一拍就看得见
    const confirmStage = ok => update(list => list.map(c => c.id !== camp.id ? c : ok
      ? Object.assign({}, c, { pendingStage: false, stages: c.stages.map((s, i) => i !== c.stageIdx ? s : Object.assign({}, s, { done: true, note: typeof c.pendingStage === "string" ? c.pendingStage : null })), stageIdx: Math.min(c.stages.length, c.stageIdx + 1) })
      : Object.assign({}, c, { pendingStage: false, msgs: c.msgs.concat([{ id: rid("rm_"), role: "sys", content: uName + " 判定:本章目标还没有真实达成,继续演;没有新的实质进展前不要再报 stageDone", ts: Date.now() }]) })));
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
          + (forced ? "\n剧情是中途收束的,就写到走到的地方为止,把没走完的路留成余味,不硬圆。" : "") + "\n另外盘点:秘典里有哪些真相与伏笔到最后也没来得及揭开(untold,没有就空数组)。\n只输出 JSON:{\"paras\":[\"段落\"],\"closing\":\"最后一句(≤30字)\",\"untold\":[]}";
        const user = "【世界】" + camp.world + "\n【秘典】真相:" + camp.dossier.truth + "\n翻转:" + camp.dossier.twist + "\n【各章】" + camp.stages.map((s, i) => s.goal + (s.done ? "(✓)" : i === camp.stageIdx ? "(进行中)" : "(未到)")).join(";") + "\n【已揭示线索】" + (camp.clues.join(";") || "无") + (camp.summary ? "\n【前情】\n" + camp.summary : "") + "\n【最近剧情】\n" + recent;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 4000, timeout: 300000 });
        const p = parseObj(raw);
        if (!p || !Array.isArray(p.paras) || !p.paras.length) throw new Error("终章没写出来" + rawHint(raw));
        update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { ended: true, pendingEnd: false, epilogue: { paras: p.paras.map(x => String(x || "").trim()).filter(Boolean), closing: String(p.closing || "").trim(), untold: (Array.isArray(p.untold) ? p.untold : []).map(x => String(x || "").trim()).filter(Boolean), revealed: 0 } })));
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
        party: camp.party.map(m => Object.assign({}, m, { hp: snap.hp[m.name] != null ? snap.hp[m.name] : m.hp })),
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
    const delCamp = id => { if (!confirm("删除这场跑团和全部记录?")) return; setPlayId(null); setView("list"); update(list => list.filter(c => c.id !== id)); };
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
        props.toast(bgTook ? "封面出好了,已当作背景;+菜单里可看整张、存相册" : "封面出好了(这场团有你自己的背景图,没动它)", 6000);
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
        if (ch) {
          // 跑团只继承【这张脸】:persona 换成本团世界,免得主线的职业装束/时代乱入
          // (小剧场 if 线同一课);服装按世界观由场景描述给
          const visualPersona = [String(camp.world || "").slice(0, 400), ch.name + " 正随队伍在这场冒险途中。"].filter(Boolean).join("\n");
          const styledChar = Object.assign({}, ch, { persona: visualPersona, photoOutfit: "" });
          const sceneDesc = "第三人称旁观的电影剧照(人物不看镜头,不是自拍)。\n【这是一场跑团冒险,与角色原设定的时代/职业无关】\n【世界】" + String(camp.world || "").slice(0, 300) + "\n【地点】" + (camp.place || "") + "\n【此刻正在发生(画最近剧情的当下一瞬)】\n" + recent
            + "\n【画面聚焦】" + ch.name + (duo ? " 与 " + uName : "") + " 此刻的神态与动作;其余同行者若入画,一律远景虚化、不描绘五官。服装、道具、环境必须符合上述世界观;构图取此刻最有张力的一瞬。" + SHOT_SAFE + cutNote;
          prompt = typeof buildPhotoPrompt === "function"
            ? buildPhotoPrompt(styledChar, sceneDesc, null, { kind: duo ? "duo" : "other", me: duo ? props.profile : null, cinematic: true })
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
        let out;
        try {
          out = await generateSelfieImage(prompt, refs, { minimalPrompt: minimalPrompt });
        } catch (e1) {
          if (!/safety|policy|内容政策|too long|sensitive|reject/i.test(String(e1 && e1.message || e1))) throw e1;
          props.toast("这一拍的描述被审核挡了,换成简版再试一次…");
          out = await generateSelfieImage(minimalPrompt, refs ? refs.slice(0, duo ? 2 : 1) : null);
        }
        if (!out || !out.blob) throw new Error("没出图");
        // 降级不无声无息:脸没锁上要说出来(小剧场同款)
        if (ch && out.degraded) props.toast(out.degraded === "duo-single-ref" ? "只锁了 " + ch.name + " 的脸" : "没用上参考照——脸可能不像" + (out.refError ? ":" + out.refError : ""), 7000);
        const durl = await blobToDataUrl(out.blob);
        const ref = typeof imgToVault === "function" ? await imgToVault(durl) : durl;
        update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { msgs: c.msgs.concat([{ id: rid("rm_"), role: "photo", img: ref, lockChar: ch ? ch.id : undefined, ts: Date.now() }]) })));
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
    const S = { wrap: { position: "fixed", inset: 0, zIndex: 60, background: t.bg, display: "flex", flexDirection: "column" },
      top: { display: "flex", alignItems: "center", gap: 10, padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 10px", borderBottom: "1px solid " + t.line },
      h1: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
      btn: fill => ({ padding: "7px 14px", borderRadius: 12, fontFamily: F_BODY, fontSize: 12, border: "1px solid " + (fill ? t.ink : t.line), background: fill ? t.ink : "transparent", color: fill ? t.bg2 : t.ink }),
      card: { margin: "10px 14px 0", padding: 13, borderRadius: 16, background: t.bg2, border: "1px solid " + t.line },
      lbl: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginBottom: 3 },
      txt: { fontFamily: F_BODY, fontSize: 13, color: t.ink, lineHeight: 1.7, whiteSpace: "pre-wrap" } };
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
    const ceremonyLayer = ceremony && h("div", { style: { position: "fixed", inset: 0, zIndex: 160, background: "rgba(20,18,16,.9)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: "#d9d3c8" } }, ceremony.who + " · " + ceremony.statZh + "检定(目标 ≤" + ceremony.statVal + ")"),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 64, color: ceremony.phase === "done" ? (ceremony.grade.tier === "crit" || ceremony.grade.tier === "hard" ? "#e8c76a" : ceremony.grade.tier === "ok" ? "#f0ece4" : "#e8a08c") : "#f0ece4", minHeight: 80 } }, ceremony.phase === "ready" ? "?" : String(ceremony.roll)),
      ceremony.phase === "ready"
        ? h("button", { onClick: ceremonyRoll, style: { padding: "10px 34px", borderRadius: 14, fontFamily: F_DISPLAY, fontSize: 16, border: "1px solid #f0ece4", background: "transparent", color: "#f0ece4" } }, "掷")
        : h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: "#d9d3c8", minHeight: 24 } }, ceremony.phase === "done" ? ceremony.grade.zh : "…"));

    if (view === "create") {
      const toggle = id => setPickIds(p => p.indexOf(id) >= 0 ? p.filter(x => x !== id) : p.length >= 4 ? (props.toast("队伍最多 4 名队友"), p) : p.concat([id]));
      const preview = draft && h("div", { style: S.card },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, marginBottom: 8 } }, draft.title),
        [["世界", draft.world], ["开局处境", draft.hook],
         ["地图", draft.mapRegions ? draft.mapRegions.length + " 个区域 · " + draft.mapRegions.reduce((n, r) => n + r.nodes.length, 0) + " 个地点,开局在「" + (draft.pos || "?") + "」(迷雾里的走近了才亮)" : "这一版没长出地图(不影响开团,按纯叙事走)"],
         ["第一章", draft.stages[0] && (draft.stages[0].goal + (draft.stages[0].place ? "〔在:" + draft.stages[0].place + "〕" : ""))], ["后面还有", (draft.stages.length - 1) + " 章(走到才揭晓)"], ["开场", draft.opening]].map(([k, v]) => v ? h("div", { key: k, style: { marginBottom: 8 } }, h("div", { style: S.lbl }, k), h("div", { style: S.txt }, String(v))) : null),
        h("div", { style: S.lbl }, "队伍属性(3d6×5;队友按人设微调)"),
        draft.party.map(m => h("div", { key: m.key, style: Object.assign({}, S.txt, { fontSize: 12, marginBottom: 2 }) }, m.name + ":" + STATS.map(([k, zh]) => zh + " " + m.stats[k]).join(" · "))),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, margin: "6px 0 8px" } }, "守密人还写好了一份秘典(真相、伏笔与翻转)——落幕之前不给看。"),
        h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
          h("button", { onClick: acceptDraft, style: S.btn(true) }, "就这个,开团"),
          h("button", { onClick: genSetup, disabled: busy, style: S.btn(false) }, busy ? "在想…" : "换一版"),
          h("button", { onClick: rerollDraftStats, style: S.btn(false) }, "重掷属性")));
      return h("div", { style: S.wrap }, badges(), header("新开跑团"),
        h("div", { style: { flex: 1, overflowY: "auto", paddingBottom: 30 } },
          h("div", { style: S.card }, h("div", { style: S.lbl }, "拉队友入队(1-4 名)"),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 } },
              props.characters.map(c => h("div", { key: c.id, onClick: () => toggle(c.id), style: { display: "flex", alignItems: "center", gap: 6, padding: "5px 10px 5px 6px", borderRadius: 999, border: "1.5px solid " + (pickIds.indexOf(c.id) >= 0 ? t.ink : t.line), background: pickIds.indexOf(c.id) >= 0 ? t.ink : "transparent" } },
                avatarOf(c, 24), h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: pickIds.indexOf(c.id) >= 0 ? t.bg2 : t.ink } }, c.name))))),
          h("div", { style: S.card }, h("div", { style: S.lbl }, "关键词(选填:世界/主线/氛围,如「西幻 盗墓 诙谐」)"),
            h("textarea", { value: kw, onChange: e => setKw(e.target.value), rows: 2, placeholder: "空着=掷骰子定世界与主线", style: { width: "100%", background: "transparent", border: "none", outline: "none", fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "none" } }),
            h("div", { style: S.lbl }, "难度"),
            h("div", { style: { display: "flex", gap: 6, marginBottom: 6 } }, ["easy", "normal", "hard"].map(k => h("button", { key: k, onClick: () => setDiff(k), style: S.btn(diff === k) }, DIFF[k].name))),
            !draft && h("button", { onClick: genSetup, disabled: busy, style: Object.assign({ marginTop: 4 }, S.btn(true)) }, busy ? "在搭世界…" : "生成设定")),
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
        return h("div", { style: { marginBottom: 8 } },
          h("div", { style: S.lbl }, "旅程"),
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
      const panel = panelOpen && h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", maxHeight: "56vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }) },
        journey,
        h("div", { style: S.lbl }, "队伍"),
        camp.party.map(m => h("div", { key: m.key, style: { marginBottom: 6 } },
          h("div", { style: Object.assign({}, S.txt, { fontSize: 12.5, display: "flex", justifyContent: "space-between" }) }, h("span", null, m.name), h("span", { style: { color: m.hp <= 25 ? "#a4442e" : t.sub } }, "HP " + m.hp + "/" + (m.maxHp || 100))),
          h("div", { style: { height: 4, borderRadius: 2, background: t.line, overflow: "hidden" } }, h("div", { style: { width: Math.max(0, Math.min(100, m.hp / (m.maxHp || 100) * 100)) + "%", height: "100%", background: m.hp <= 25 ? "#a4442e" : t.ink } })),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 2 } }, STATS.map(([k, zh]) => zh + m.stats[k]).join(" · ")))),
        h("div", { style: S.lbl }, "主线"),
        camp.stages.map((s, i) => h("div", { key: i, style: Object.assign({}, S.txt, { fontSize: 12, marginBottom: 2, color: i === camp.stageIdx ? t.ink : t.fog }) }, (s.done ? "✓ " : i === camp.stageIdx ? "→ " : "· ") + "第" + (i + 1) + "章:" + (i <= camp.stageIdx ? s.goal : "???"))),
        h("div", { style: Object.assign({}, S.lbl, { marginTop: 6 }) }, "物品"),
        h("div", { style: Object.assign({}, S.txt, { fontSize: 12 }) }, itemsFix(camp.items).map(fmtItem).join("、") || "空空如也"),
        h("div", { style: Object.assign({}, S.lbl, { marginTop: 6 }) }, "线索"),
        camp.clues.length ? camp.clues.map((x, i) => h("div", { key: i, style: Object.assign({}, S.txt, { fontSize: 12, marginBottom: 2 }) }, (i + 1) + ". " + x)) : h("div", { style: Object.assign({}, S.txt, { fontSize: 12 }) }, "尚无"),
        h("div", { style: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" } },
          !camp.ended && h("button", { onClick: () => { if (confirm("提前收团?守密人会就此写终章落幕。")) { setPanelOpen(false); setEndAsk({ forced: true }); } }, disabled: busy, style: S.btn(false) }, "谢幕收团"),
          h("button", { onClick: () => delCamp(camp.id), style: Object.assign({}, S.btn(false), { color: "#a4442e", borderColor: "#a4442e55" }) }, "删除此团")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 8, lineHeight: 1.7 } }, "长按任意一拍可从那里分支回溯——状态按当拍快照恢复,原团一个字不动。"));
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
            h("button", { onClick: () => { if (confirm("接受这个结局?终章会照现在的惨状写。")) setEndAsk({ forced: true }); }, disabled: busy, style: S.btn(false) }, "接受结局"))) : null;
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
               ep.untold && ep.untold.length ? h("div", null, h("div", { style: S.lbl }, "没来得及揭开的"), ep.untold.map((x, i) => h("div", { key: i, style: Object.assign({}, S.txt, { fontSize: 12 }) }, "· " + x))) : null)]);
      const flow = camp.msgs.map(m => m.role === "photo"
        ? h("div", { key: m.id, onPointerDown: () => pressPhoto(m), onPointerUp: pressEnd, onPointerMove: pressEnd, onPointerLeave: pressEnd, onContextMenu: e => e.preventDefault(), style: { margin: "10px 14px", textAlign: "center" } }, h("img", { src: imgSrc(m.img), onClick: () => setBigView({ img: m.img, title: camp.title }), style: { maxWidth: "86%", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.18)" } }))
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
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.7, padding: "0 2px 8px" } }, "选谁入镜(锁 TA 的脸" + (props.profile && props.profile.refPhoto ? ",你也有参考照,会自动拍成合照" : "") + ");其余队友退到远景虚化。"),
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
        return h("div", { style: { position: "fixed", inset: 0, zIndex: 130, background: t.bg, display: "flex", flexDirection: "column" } },
          h("div", { style: S.top },
            h("button", { onClick: () => { setMapOpen(false); setSelNode(null); }, style: { fontSize: 18, color: t.ink, background: "none", border: "none", padding: "0 4px" } }, "←"),
            h("div", { style: S.h1 }, "舆图 · " + camp.title),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, "队伍在「" + (camp.pos || camp.place) + "」")),
          h("div", { style: { flex: 1, overflowY: "auto", padding: "12px 10px" } },
            h("svg", { viewBox: "0 0 " + builtMap.W + " " + builtMap.H, style: { width: "100%", display: "block", borderRadius: 14, background: t.bg2, border: "1px solid " + t.line } },
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
                return h("g", { key: nd.name, onClick: () => setSelNode(nd.name) },
                  here ? h("circle", { cx: nd.x, cy: nd.y, r: 9, fill: "none", stroke: t.ink, strokeWidth: 1 },
                    h("animate", { attributeName: "r", values: "7;12;7", dur: "1.8s", repeatCount: "indefinite" }),
                    h("animate", { attributeName: "opacity", values: ".8;.1;.8", dur: "1.8s", repeatCount: "indefinite" })) : null,
                  h("circle", { cx: nd.x, cy: nd.y, r: isV ? 5 : 4.5, fill: isV ? t.ink : t.bg2, stroke: isV ? t.ink : t.fog, strokeWidth: 1.2, strokeDasharray: isF ? "2.5 2.5" : "none" }),
                  starAt[nd.name] ? h("text", { x: nd.x + 7, y: nd.y - 6, fontSize: 10, fill: "#8a6d3b" }, "★") : null,
                  h("text", { x: nd.x, y: nd.y + 16, textAnchor: "middle", fontSize: 9.5, fill: isV ? t.ink : t.fog, fontFamily: F_BODY, stroke: t.bg2, strokeWidth: 3, paintOrder: "stroke" }, nd.name),
                  // 隐形大热区:手指点得准的秘诀(视觉 5px,热区 16px)
                  h("circle", { cx: nd.x, cy: nd.y, r: 16, fill: "transparent" }));
              })),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, lineHeight: 1.8, margin: "10px 4px 0" } }, "实心=去过 · 虚圈=听说过的方向 · ★=章节目标 · 没亮的地方是迷雾,走近了才知道。")),
          sel ? h("div", { style: { borderTop: "1px solid " + t.line, background: t.bg2, padding: "12px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, sel.name + (starAt[sel.name] ? " ★" : "")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, marginTop: 3 } }, sel.region + " · " + sel.kind + " · " + (visited[sel.name] ? "去过" : "只是听说过的方向")),
            h("div", { style: { display: "flex", gap: 8, marginTop: 9 } },
              sel.name === camp.pos ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "7px 0" } }, "队伍就在这里")
              : canGo ? h("button", { onClick: () => { setMapOpen(false); setSelNode(null); turn("(动身前往「" + sel.name + "」)", null, { travel: sel.name }); }, style: S.btn(true) }, "动身前往")
              : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "7px 0" } }, busy ? "这一拍还没落定" : "太远了——路要一步步走,先去相邻的地点"),
              h("button", { onClick: () => setSelNode(null), style: S.btn(false) }, "收起"))) : null);
      })() : null;
      return h("div", { style: S.wrap }, badges(),
        camp.bg ? h("div", { style: { position: "absolute", inset: 0, zIndex: 0, backgroundImage: "linear-gradient(rgba(240,236,228,.8),rgba(240,236,228,.8)), url(" + imgSrc(camp.bg) + ")", backgroundSize: "cover", backgroundPosition: "center" } }) : null,
        ceremonyLayer, msgSheet, photoSheet, shotSheet, bigViewer, mapLayer,
        h("div", { style: { position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } },
        header(camp.title + " · " + (camp.place || ""), h("div", { style: { display: "flex", gap: 6 } },
          builtMap ? h("button", { onClick: () => { setSelNode(camp.pos || null); setMapOpen(true); }, style: S.btn(false) }, "🗺 舆图") : null,
          h("button", { onClick: () => setPanelOpen(v => !v), style: S.btn(false) }, panelOpen ? "收起" : "队伍与线索"))),
        panel, banner,
        h("div", { ref: scrollRef, style: { flex: 1, overflowY: "auto", paddingBottom: 16 } }, flow, epFlow,
          busy ? h("div", { style: { margin: "10px 14px", fontFamily: F_BODY, fontSize: 12, color: t.fog } }, busyWhat || "守密人在推演命运…") : null),
        camp.ended ? h("div", { style: { textAlign: "center", padding: "16px 14px calc(env(safe-area-inset-bottom, 0px) + 16px)", borderTop: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 11, letterSpacing: 2, color: t.fog } }, "—— 已落幕 · 长按任意一拍可分支重走 ——")
        : [
          pendingRetry ? h("div", { key: "rt", style: { display: "flex", flexWrap: "wrap", gap: 7, padding: "8px 14px 0", borderTop: "1px solid " + t.line } },
            h("button", { onClick: () => turn(""), style: S.btn(true) }, "▶ 继续这一拍" + (tailHasRoll ? "(沿用已掷的骰子)" : "")),
            // 掷过骰子就不给撤回:撤了等于洗骰子
            !tailHasRoll ? h("button", { onClick: retractTail, style: S.btn(false) }, "↩ 撤回重写") : null)
          : (camp.choices.length || stuck) ? h("div", { key: "ch", style: { display: "flex", flexWrap: "wrap", gap: 7, padding: "8px 14px 0", borderTop: "1px solid " + t.line } },
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
            h("button", { onClick: addBeat, disabled: busy, style: S.btn(false) }, "✍ 追加一笔"),
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
            h("textarea", { value: input, onChange: e => setInput(e.target.value), rows: 1, placeholder: "或者,你想说的话、想做的事…", style: { flex: 1, padding: "10px 13px", borderRadius: 14, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "none", outline: "none" } }),
            h("button", { onClick: send, disabled: busy, style: S.btn(true) }, "行动"))
        ]));
    }

    // 入口:战役列表
    const campCard = c => {
      const members = [null].concat(c.partyIds.map(charOf));
      // 有封面就压进卡片当底:图上要压字,盖一层足够厚的渐变,先保证读得清(小剧场同款)
      const coverBg = c.cover ? {
        backgroundImage: "linear-gradient(90deg, rgba(240,236,228,.94) 0%, rgba(240,236,228,.82) 52%, rgba(240,236,228,.35) 100%), url(" + imgSrc(c.cover) + ")",
        backgroundSize: "cover", backgroundPosition: "center", minHeight: 96
      } : null;
      return h("div", { key: c.id, onClick: () => { setPlayId(c.id); setView("play"); setPanelOpen(false); }, style: Object.assign({}, S.card, { cursor: "pointer", position: "relative" }, coverBg) },
        h("button", { onClick: e => { e.stopPropagation(); if (confirm("删除「" + c.title + "」和全部记录?")) update(list => list.filter(x => x.id !== c.id)); }, style: { position: "absolute", top: 10, right: 10, background: "none", border: "none", color: t.fog, fontSize: 15, padding: 4 } }, "✕"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, paddingRight: 26 } }, c.title),
        c.branchedFrom ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 3 } }, "⑂ 分支自「" + (c.branchedFrom.title || "原团") + "」第 " + (c.branchedFrom.at || 0) + " 拍") : null,
        h("div", { style: { display: "flex", alignItems: "center", gap: 4, marginTop: 6 } },
          members.map((m, i) => i === 0 ? avatarOf({ name: uName, avatarImage: props.profile && props.profile.avatarImage, color: props.profile && props.profile.color }, 22) : m ? avatarOf(m, 22) : null),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, marginLeft: 4 } }, (c.ended ? "已落幕 · " : "") + "第" + Math.min(c.stageIdx + 1, c.stages.length) + "/" + c.stages.length + "章 · " + c.msgs.length + "拍")),
        h("div", { style: Object.assign({}, S.txt, { color: t.fog, fontSize: 12, marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }) }, c.world));
    };
    return h("div", { style: S.wrap }, badges(), header("跑团", h("button", { onClick: () => { setDraft(null); setKw(""); setPickIds([]); setView("create"); }, style: S.btn(true) }, "新开跑团")),
      h("div", { style: { flex: 1, overflowY: "auto", paddingBottom: 30 } },
        camps.length ? camps.map(campCard)
        : h("div", { style: { textAlign: "center", marginTop: 80, fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 2 } }, "还没开过团。", h("br"), "拉上几个人,掷一把骰子,去另一个世界走一遭。")));
  }
  if (inApp) window.TrpgApp = TrpgApp;
  // 纯函数导出给 node --test;浏览器里没有 module,原样跳过
  if (typeof module === "object" && module.exports) module.exports = { rollStats, personaNudge, gradeCheck, normChoices, applyTurnPayload, foldHist, findMember, shotSafeLines, mulberry32, hashStr, journeyLayout, jitterPts, itemsFix, fmtItem, hasItem, nudgeHits, normRegions, mapBuild, mapAdjacent, findNode };
})();
