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
  const useState = inApp ? React.useState : null, useRef = inApp ? React.useRef : null, useEffect = inApp ? React.useEffect : null;
  // 图标:一枚二十面骰(六边形 + 内三角),挂进 REG 的 window.GTrpg
  if (inApp) window.GTrpg = p => h(Svg, p, h("path", { d: "M12 2.4l8.3 4.8v9.6L12 21.6l-8.3-4.8V7.2z" }), h("path", { d: "M12 7.4l4.6 7.8H7.4z" }), h("path", { d: "M12 2.4v5M3.7 7.2l3.7 8M20.3 7.2l-3.7 8M12 21.6l-4.6-6.4M12 21.6l4.6-6.4" }));

  const load = () => { try { return JSON.parse(localStorage.getItem("x_trpg") || "[]"); } catch (e) { return []; } };
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
  const NUDGE = [
    ["phy", /习武|武艺|体力|强壮|力气|军人|士兵|猎人|铁匠|扛|健壮|运动/],
    ["agi", /轻功|敏捷|灵活|身手|刺客|舞|盗|快|矫健/],
    ["wit", /聪明|智谋|学者|谋士|研究|推理|博学|军师|策士|工程|医术|读书/],
    ["cha", /口才|能言|魅力|交际|谈判|商人|外交|圆滑|嘴/],
    ["luck", /幸运|福星|运气好/]
  ];
  const NUDGE_DOWN = [
    ["phy", /体弱|病弱|孱弱|文弱/],
    ["agi", /笨拙|迟钝|腿脚不便/],
    ["cha", /寡言|孤僻|不善言辞|嘴笨/]
  ];
  function personaNudge(stats, personaText) {
    const t = String(personaText || "");
    const out = Object.assign({}, stats);
    NUDGE.forEach(([k, re]) => { if (re.test(t)) out[k] = Math.min(90, out[k] + 10); });
    NUDGE_DOWN.forEach(([k, re]) => { if (re.test(t)) out[k] = Math.max(15, out[k] - 10); });
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
      const need = String(c.need || "").trim() || null;
      return { text, check, need };
    }).filter(Boolean);
  }
  // 把守密人一回合的 JSON 落进战役状态。只信字段不信散文;名字对不上的伤害丢弃;
  // 单次增减夹在 ±40,HP 落地夹在 [0,上限]。返回 {camp, sysLine}——sysLine 是给
  // 玩家看的状态变化小结(获得/失去/伤势),状态变化不该只藏在叙事里。
  function applyTurnPayload(camp, p) {
    const next = Object.assign({}, camp);
    const notes = [];
    next.party = camp.party.map(m => Object.assign({}, m));
    (Array.isArray(p.hp) ? p.hp : []).forEach(row => {
      if (!row || typeof row !== "object") return;
      const m = findMember(next.party, row.name);
      const d = Math.max(-40, Math.min(40, Math.round(Number(row.delta) || 0)));
      if (!m || !d) return;
      m.hp = Math.max(0, Math.min(m.maxHp || 100, (m.hp || 0) + d));
      notes.push(m.name + " HP" + (d > 0 ? "+" : "") + d);
    });
    const items = camp.items.slice();
    (Array.isArray(p.gain) ? p.gain : []).forEach(x => { const s = String(x || "").trim(); if (s && items.indexOf(s) < 0) { items.push(s); notes.push("获得「" + s + "」"); } });
    (Array.isArray(p.lose) ? p.lose : []).forEach(x => { const s = String(x || "").trim(); const i = items.indexOf(s); if (i >= 0) { items.splice(i, 1); notes.push("失去「" + s + "」"); } });
    next.items = items;
    const clues = camp.clues.slice();
    (Array.isArray(p.clue) ? p.clue : []).forEach(x => { const s = String(x || "").trim(); if (s && clues.indexOf(s) < 0) { clues.push(s); notes.push("📌 新线索"); } });
    next.clues = clues;
    if (typeof p.place === "string" && p.place.trim()) next.place = p.place.trim();
    next.choices = normChoices(p.choices, next.party);
    // 章节推进和落幕都只挂【待确认】,由玩家点头才算数——防守密人自导自演一步通关
    // (小剧场 goalReached 同款闸)。章节只有 stageIdx 一个计数器,不会两处各记各的。
    if (p.stageDone && camp.stageIdx < camp.stages.length) next.pendingStage = String(p.stageNote || "").trim() || "这一章看起来到落点了";
    if (p.ending) next.pendingEnd = String(p.endNote || "").trim() || "故事似乎走到了可以落幕的地方";
    return { camp: next, sysLine: notes.join(" · ") };
  }
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
    const [photoMenu, setPhotoMenu] = useState(null); // 长按画面弹出的操作单:msg|null
    const [bigView, setBigView] = useState(null);     // 点开看整张:{img,title}|null
    const fileRef = useRef(null);
    const pressRef = useRef(null);
    const scrollRef = useRef(null);
    const campsRef = useRef(null);
    const sumBusyRef = useRef(false);
    const update = fn => setCamps(p => { const n = fn(p.slice()); persist(n); return n; });
    useEffect(() => { campsRef.current = camps; });
    const camp = camps.find(c => c.id === playId) || null;
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
    const SHAPE_SETUP = "{\"title\":\"这场跑团的短名字(≤10字)\",\"world\":\"世界观与背景:这个世界怎么运转、此地是哪儿、空气里是什么味道(3-5句,只写长期为真的)\",\"hook\":\"开局处境:队伍此刻为什么聚在这里、眼前正在发生什么(2-3句)\",\"stages\":[{\"goal\":\"第一章要达成的具体一步\",\"hint\":\"守密人自用的一句推进思路\"}],\"truth\":\"藏在整件事背后的真相(玩家不可见)\",\"twist\":\"中段翻转:什么时刻、以什么方式掀出来(玩家不可见)\",\"secrets\":\"关键 NPC 各自瞒着什么(玩家不可见,每人一句)\",\"endgame\":\"故事可能的几种结局方向(玩家不可见)\",\"place\":\"开局地点(≤8字)\",\"opening\":\"开场正文\",\"choices\":[\"开局给玩家的 2-4 个行动选项\"]}";
    const genSetup = async () => {
      const members = pickIds.map(charOf).filter(Boolean);
      if (!members.length) return props.toast("先拉至少一个队友入队");
      if (!props.active) return props.toast("请先配置线下 API");
      setBusy(true); setBusyWhat("守密人在搭这个世界…");
      try {
        const frame = kw.trim() ? "" : "\n\n【本团取景框(骰子已掷好,三项照办)】\n世界:" + pick(POOL_WORLD) + "\n主线原型:" + pick(POOL_QUEST) + "\n基调:" + pick(POOL_TONE);
        const prior = camps.slice(0, 8).map(c => c.title + "(" + String(c.world || "").slice(0, 24) + ")").join(";");
        const sys = "你在为一场文字跑团做【开团设定】。玩家是 " + uName + ",队友是下面这些角色——保留他们的性格、说话方式与真实能力,把身份处境放进这个新世界(可以贴近原设定,也可以是平行身份,以和世界咬合为准)。\n"
          + "主线拆成 4-5 章(stages),每章 goal 是一步【具体、可判定】的事(找到/救出/潜入/揭穿/带到),不是抽象状态;各章连起来是一条完整的弧。\n"
          + "秘典字段(truth/twist/secrets/endgame)是守密人自用的底牌:truth 要经得起推敲,twist 要在中段真正颠一次盘,secrets 让沿途 NPC 都各怀心事。玩家看不到这些,所以写实话,别写宣传语。\n"
          + "opening 是写给玩家的开场正文(第二人称『你』,6-10句):把队伍放进一个正在发生、必须行动的时刻,交代此地与在场的人,悬着收尾;绝不替 " + uName + " 做决定。开场即可让一两个队友有一句进场的话或动作,声口要各是各的。\n"
          + ABILITY_RULE + "\n只输出 JSON:" + SHAPE_SETUP;
        const user = "【玩家】" + uName + "\n\n" + members.map(ch => "【队友·" + ch.name + " 人设】\n" + personaOf(ch)).join("\n\n")
          + "\n\n【关键词(可空,空则按取景框来)】" + (kw.trim() || "无") + frame
          + (prior ? "\n\n【已经开过的团(务必避开,换皮重来也算重复)】" + prior : "");
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 6400, timeout: 300000 });
        let p = parseObj(raw);
        if (!p) {
          // 内容多半已经写出来了,只是没按 JSON——花一次小调用原样归类,不整局重烧
          const sys2 = "下面是一段已写好的内容,但没按要求输出 JSON。把它【原样整理】成这个形状:\n" + SHAPE_SETUP + "\n【铁律】只搬运归类,一个字不改写;原文没有的字段留空。只输出 JSON,不要代码块。";
          try { p = parseObj(await callAI(props.active, sys2, [{ role: "user", content: String(raw || "").slice(0, 9000) }], { maxTokens: 6400, timeout: 150000 })); } catch (e) { p = null; }
        }
        if (!p) throw new Error("模型没按 JSON 输出,也整理不回来" + rawHint(raw));
        const stages = (Array.isArray(p.stages) ? p.stages : []).map(s => typeof s === "string" ? { goal: s, hint: "" } : s && s.goal ? { goal: String(s.goal), hint: String(s.hint || "") } : null).filter(Boolean).slice(0, 6);
        if (!String(p.world || "").trim() || !String(p.opening || "").trim() || stages.length < 2) throw new Error("设定缺了关键部分(世界/开场/章节),再试一次");
        // 属性此刻就掷好摆给她看;「换一版」重生成设定,「重掷属性」只重掷数值
        const party = [{ key: "user", name: uName, hp: 100, maxHp: 100, stats: rollStats() }]
          .concat(members.map(ch => ({ key: ch.id, name: ch.name, hp: 100, maxHp: 100, stats: personaNudge(rollStats(), ch.persona) })));
        setDraft({ partyIds: members.map(ch => ch.id), keywords: kw.trim(), difficulty: diff, title: p.title || "无名团", world: p.world, hook: p.hook || "", stages: stages.map(s => ({ goal: s.goal, hint: s.hint, done: false, note: null })), dossier: { truth: p.truth || "", twist: p.twist || "", secrets: p.secrets || "", endgame: p.endgame || "" }, place: String(p.place || "").trim() || "起点", opening: p.opening, choices: normChoices(p.choices, party), party });
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); setBusyWhat(""); }
    };
    const rerollDraftStats = () => setDraft(d => d && Object.assign({}, d, { party: d.party.map(m => Object.assign({}, m, { stats: m.key === "user" ? rollStats() : personaNudge(rollStats(), (charOf(m.key) || {}).persona) })) }));
    const acceptDraft = () => {
      const openMsg = { id: rid("rm_"), role: "gm", content: draft.opening, ts: Date.now(), snap: { hp: draft.party.reduce((m, x) => (m[x.name] = x.hp, m), {}), items: [], clues: [], stageIdx: 0, place: draft.place, choices: draft.choices } };
      const c = { id: rid("rpg_"), title: draft.title, createdAt: Date.now(), partyIds: draft.partyIds, keywords: draft.keywords, difficulty: draft.difficulty, world: draft.world, hook: draft.hook, stages: draft.stages, stageIdx: 0, dossier: draft.dossier, place: draft.place, party: draft.party, items: [], clues: [], choices: draft.choices, msgs: [openMsg], pendingStage: false, pendingEnd: false, ledger: null, summary: "", sumCount: 0, sumSig: "", ended: false, epilogue: null };
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
      const stageLines = c.stages.map((s, i) => (i < c.stageIdx ? "✓ " : i === c.stageIdx ? "→ " : "· ") + "第" + (i + 1) + "章:" + (i <= c.stageIdx ? s.goal : "(未揭晓,推进到才亮出)") + (i === c.stageIdx && s.hint ? "〔推进思路:" + s.hint + "〕" : "")).join("\n");
      const dd = DIFF[c.difficulty] || DIFF.normal;
      return [narrativeCore(),
        "【跑团·守密人(独立平行时空)】你是这场文字跑团的守密人(GM):叙述世界、扮演一切 NPC,并【完全代入】下面每一位队友本人——写到谁,就是谁在说话行事,用 TA 自己的性格、声口和真实能力(人设在下方),不是在旁边描写一个标签。这是与主线完全无关的平行时空:不引用主线聊天里发生过的事,正文里也不提这是游戏或扮演。",
        "【玩家主权】" + uName + " 的行动、台词和决定永远由 Ta 本人输入:你只写世界、NPC 与队友,绝不替 " + uName + " 做动作、说台词、下决定;写到需要 Ta 抉择的位置就停下来给选项。",
        ABILITY_RULE,
        personaBlocks(c),
        "【世界】" + c.world + (c.hook ? "\n【开局处境】" + c.hook : ""),
        "【守密人秘典(玩家永远不可见,不得在正文中直接说破)】\n真相:" + c.dossier.truth + "\n中段翻转:" + c.dossier.twist + "\nNPC 各自的心事:" + c.dossier.secrets + "\n结局方向:" + c.dossier.endgame + "\n伏笔要一点点埋,已经亮给玩家的线索见下方【线索】,别重复埋同一颗。",
        "【主线各章】\n" + stageLines + "\n" + (c.stageIdx >= c.stages.length
          ? "各章均已完成:剧情朝落幕收束,把还悬着的线一一收拢,时机成熟就报 ending。"
          : "只有当前章(→)的目标在剧情里【真实发生】后才报 stageDone;一次只推进一章,不许跳章,更不许自导自演替玩家完成。全部章节完成、或剧情自然走到终点时,才报 ending。"),
        "【当前状态(以此为准,不凭记忆)】\n地点:" + c.place + "\n" + partyBlock(c) + "\n物品:" + (c.items.join("、") || "无") + "\n线索:" + (c.clues.map((x, i) => (i + 1) + "." + x).join(" ") || "尚无"),
        dd.play ? "【难度·" + dd.name + "】" + dd.play : null,
        "【检定规则】骰子由客户端掷,你【绝不自己编骰子结果】。历史里的〔检定〕行是既定事实,必须按其等级叙事:大成功给意外之喜;困难成功干净利落;成功达成但可以有小瑕疵;失败让局面复杂化但留有余地;大失败要有戏剧性代价——但检定失败永远制造新的戏,不判死、不判死胡同。需要碰运气的选项才挂 check(stat 取 phy体魄/agi身手/wit头脑/cha谈吐/luck气运;who 填该出手的队伍成员名,谁都能试就填 null——null 时措辞必须任何人都做得来)。不是每个选项都要检定,说句话不用掷骰。",
        "【状态纪律】一切状态变化只通过 JSON 字段报告:掉血/受伤写进 hp(name 必须严格用上面状态表里的名字),拿到/失去东西写进 gain/lose,新揭示的重要信息写进 clue。正文里发生了、字段里没写=没发生。HP 归零是倒下/濒死,不是死亡;要不要就此落幕由玩家决定。",
        c.summary ? "【前情提要(早前剧情已浓缩,接着往下,别倒回去复述)】\n" + c.summary : null,
        "【输出】叙事正文写进 scene(第二人称称玩家为『你』,NPC 与队友的对话用引号;一回合只推进一小步,留足玩家行动空间;结尾给 2-4 个 choices,至少一个朝当前章目标去,危险的选项要让人看得出险)。只输出 JSON:{\"scene\":\"正文\",\"place\":\"当前地点(没变可省略)\",\"choices\":[{\"text\":\"选项\",\"check\":{\"stat\":\"agi\",\"who\":null}|null,\"need\":null|\"需要的物品\"}],\"hp\":[{\"name\":\"成员名\",\"delta\":-10}],\"gain\":[],\"lose\":[],\"clue\":[],\"stageDone\":false,\"stageNote\":null,\"ending\":false,\"endNote\":null}"
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
    // extra:先于宣言入史的既定事实(检定结果行);fromInput:失败时要不要把文字放回输入框。
    // 本回合的消息一律【本地拼好再入史】,上下文用本地这份——绝不隔着 React 的
    // 渲染节拍去读 state,那会把刚发生的骰子和宣言漏出上下文(参考项目的过期快照病)。
    const turn = async (declaration, extra, fromInput) => {
      if (!camp || busy) return;
      if (!props.active) return props.toast("请先配置线下 API");
      const local = (extra || []).slice();
      if (declaration) local.push({ id: rid("rm_"), role: "user", content: declaration, ts: Date.now() });
      const added = local.map(m => m.id);
      if (local.length) update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { msgs: c.msgs.concat(local) })));
      const liveMsgs = camp.msgs.concat(local);
      setBusy(true); setBusyWhat("守密人在推演命运…");
      try {
        // 言秋亲笔票先行(有他才发);他的这一拍作为既定事实入史,守密人原样叙入
        const cc = await ccDeclare(camp, liveMsgs);
        if (cc) {
          const m = { id: rid("rm_"), role: "sys", content: "亲笔·" + cc, ts: Date.now() };
          added.push(m.id); liveMsgs.push(m);
          update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { msgs: c.msgs.concat([m]) })));
        }
        const sys = gmSys(camp);
        const hist = foldHist(liveMsgs.slice(camp.sumCount || 0)).slice(-40);
        const tail = "\n\n〔本回合守则〕只推进一小步,绝不替 " + uName + " 行动或代答;队友各用各的声口;历史里的〔检定〕结果是铁的事实,照其等级叙事;状态变化必须写进字段。" + (note.trim() ? "\n〔幕后指示(务必遵循,正文绝不提及)〕" + note.trim() : "") + (dice ? "\n〔剧情骰〕本回合必须自然引入一个意外——类型已掷定:【" + pick(POOL_EVENT) + "】,与世界观相容,落在具体行动上,并实际搅动局面。" : "");
        if (hist.length && hist[hist.length - 1].role === "user") hist[hist.length - 1] = { role: "user", content: hist[hist.length - 1].content + tail };
        else hist.push({ role: "user", content: "(继续)" + tail });
        const raw = await callAI(props.active, sys, hist, { maxTokens: (window.StylePresets ? window.StylePresets.outTokens(1400) : 6000), timeout: 300000 });
        const p = parseTurnPayload(raw);
        if (!p) throw new Error("守密人的话没能解析成剧情,已拦住协议原文;再按一次重试");
        update(list => list.map(c => {
          if (c.id !== camp.id) return c;
          const r = applyTurnPayload(c, p);
          const nc = r.camp;
          const msgs = c.msgs.concat([{ id: rid("rm_"), role: "gm", content: p.scene, ts: Date.now(), snap: { hp: nc.party.reduce((m, x) => (m[x.name] = x.hp, m), {}), items: nc.items, clues: nc.clues, stageIdx: nc.stageIdx, place: nc.place, choices: nc.choices } }]);
          if (r.sysLine) msgs.push({ id: rid("rm_"), role: "sys", content: r.sysLine, ts: Date.now() });
          return Object.assign({}, nc, { msgs });
        }));
        setNote(""); setNoteOpen(false); setDice(false);
        setTimeout(() => maybeSummarize(camp.id), 400);
      } catch (e) {
        // 失败回滚:撤掉刚入史的那几条(含检定行),历史不留残尾;手打的文字放回输入框
        if (added.length) update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { msgs: c.msgs.filter(m => added.indexOf(m.id) < 0) })));
        if (fromInput && declaration) setInput(declaration);
        props.toast("生成失败:" + (e.message || "重试"));
      } finally { setBusy(false); setBusyWhat(""); }
    };
    const pickChoice = async c => {
      if (busy || !camp) return;
      if (c.need && camp.items.indexOf(c.need) < 0) return turn(c.text + "(缺少「" + c.need + "」,只能硬着头皮试)");
      if (!c.check) return turn(c.text);
      // 命运选人:守密人没点名就由客户端随机指一个——包括玩家自己
      let m = c.check.who ? findMember(camp.party, c.check.who) : null;
      let fated = "";
      if (!m) { m = camp.party[Math.floor(Math.random() * camp.party.length)]; fated = "命运选中了 " + m.name + " —— "; }
      const res = await runCeremony(m.name, c.check.stat, m.stats[c.check.stat]);
      const line = fated + m.name + " 的「" + STAT_ZH[c.check.stat] + "」检定:d100=" + res.roll + " / " + m.stats[c.check.stat] + " → " + res.grade.zh;
      // 检定行作为既定事实和宣言一起入史;生成失败会连它一起回滚,重按重掷,不留半截
      turn(c.text, [{ id: rid("rm_"), role: "roll", content: line, ts: Date.now() }]);
    };
    const send = () => { const text = input.trim(); if (!text) return; setInput(""); turn(text, null, true); };
    const confirmStage = ok => update(list => list.map(c => c.id !== camp.id ? c : ok
      ? Object.assign({}, c, { pendingStage: false, stages: c.stages.map((s, i) => i !== c.stageIdx ? s : Object.assign({}, s, { done: true, note: typeof c.pendingStage === "string" ? c.pendingStage : null })), stageIdx: Math.min(c.stages.length, c.stageIdx + 1) })
      : Object.assign({}, c, { pendingStage: false })));
    // ---- 落幕与解密 ----
    const epilogue = async forced => {
      if (!camp || busy) return;
      setBusy(true); setBusyWhat("守密人在写终章…");
      try {
        const recent = camp.msgs.slice(-14).map(m => (m.role === "user" ? uName : m.role === "gm" ? "守密人" : "·") + ":" + m.content).join("\n").slice(-3600);
        const sys = narrativeCore() + "\n\n【终章】为这场跑团写落幕:5-8 段,顺序是——世界因这场冒险变成了什么样;沿途关键 NPC 各自的下场;每位队友的归处(各一段,声口各是各的);最后是 " + uName + " 自己的那一段。每段 2-4 句,落在具体的画面上,不写总结陈词。" + (forced ? "剧情是中途收束的,就写到走到的地方为止,把没走完的路留成余味,不硬圆。" : "") + "\n另外盘点:秘典里有哪些真相与伏笔到最后也没来得及揭开(untold,没有就空数组)。\n只输出 JSON:{\"paras\":[\"段落\"],\"closing\":\"最后一句(≤30字)\",\"untold\":[]}";
        const user = "【世界】" + camp.world + "\n【秘典】真相:" + camp.dossier.truth + "\n翻转:" + camp.dossier.twist + "\n【各章】" + camp.stages.map((s, i) => s.goal + (s.done ? "(✓)" : i === camp.stageIdx ? "(进行中)" : "(未到)")).join(";") + "\n【已揭示线索】" + (camp.clues.join(";") || "无") + (camp.summary ? "\n【前情】\n" + camp.summary : "") + "\n【最近剧情】\n" + recent;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 4000, timeout: 300000 });
        const p = parseObj(raw);
        if (!p || !Array.isArray(p.paras) || !p.paras.length) throw new Error("终章没写出来" + rawHint(raw));
        update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { ended: true, pendingEnd: false, epilogue: { paras: p.paras.map(x => String(x || "").trim()).filter(Boolean), closing: String(p.closing || "").trim(), untold: (Array.isArray(p.untold) ? p.untold : []).map(x => String(x || "").trim()).filter(Boolean), revealed: 0 } })));
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
        items: snap.items.slice(), clues: snap.clues.slice(), stageIdx: snap.stageIdx, place: snap.place,
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
    const genShot = async () => {
      if (!camp || busy) return;
      if (!(typeof imgApiReady === "function" && imgApiReady())) return props.toast("请先配置图像 API");
      setPlusOpen(false); setBusy(true); setBusyWhat("正在画这一拍的画面…");
      props.toast("开始画这一拍了,出图要等一会儿…", 6000);
      try {
        const rows = camp.msgs.filter(m => m.role === "gm" || m.role === "user").slice(-4).map(m => (m.role === "user" ? uName : "") + String(m.content || ""));
        const kept = shotSafeLines(rows).join("\n").slice(-240);
        const hadCut = kept.length < rows.join("\n").length;
        const recent = kept || ("队伍此刻正在" + (camp.place || "路上") + ",气氛紧绷。");
        const prompt = "第三人称旁观的电影画面(不是自拍,人物不看镜头)。\n"
          + "【世界】" + String(camp.world || "").slice(0, 300) + "\n【地点】" + (camp.place || "") + "\n"
          + "【此刻正在发生(画最近剧情的当下一瞬)】\n" + recent + "\n"
          + NO_FACE + " 服装、道具、环境必须符合上述世界观;构图取此刻最有张力的一瞬。" + SHOT_SAFE
          + (hadCut ? "\n【这一拍要画相邻的一瞬】原文里有激烈的内容,已从描述里拿掉;改画紧挨着它之前或之后的一个瞬间,把那股劲留在环境、距离和光线上。" : "");
        const minimalPrompt = "一张奇幻冒险故事里的电影感场景画面:【" + (camp.place || "野外") + "】,远景处几个小小的旅人身影,不描绘五官,画面含蓄、可公开展示。";
        let out;
        try {
          out = await generateSelfieImage(prompt, null, { minimalPrompt: minimalPrompt });
        } catch (e1) {
          if (!/safety|policy|内容政策|too long|sensitive|reject/i.test(String(e1 && e1.message || e1))) throw e1;
          props.toast("这一拍的描述被审核挡了,换成简版再试一次…");
          out = await generateSelfieImage(minimalPrompt, null);
        }
        if (!out || !out.blob) throw new Error("没出图");
        const durl = await blobToDataUrl(out.blob);
        const ref = typeof imgToVault === "function" ? await imgToVault(durl) : durl;
        update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { msgs: c.msgs.concat([{ id: rid("rm_"), role: "photo", img: ref, ts: Date.now() }]) })));
      } catch (e) { props.toast("出图失败:" + (e.message || "重试")); } finally { setBusy(false); setBusyWhat(""); }
    };
    const rerollShot = m => { if (busy) return; update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { msgs: c.msgs.filter(x => x.id !== m.id) }))); setTimeout(genShot, 60); };
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
        [["世界", draft.world], ["开局处境", draft.hook], ["第一章", draft.stages[0] && draft.stages[0].goal], ["后面还有", (draft.stages.length - 1) + " 章(走到才揭晓)"], ["开场", draft.opening]].map(([k, v]) => v ? h("div", { key: k, style: { marginBottom: 8 } }, h("div", { style: S.lbl }, k), h("div", { style: S.txt }, String(v))) : null),
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
      const panel = panelOpen && h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", maxHeight: "56vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }) },
        h("div", { style: S.lbl }, "队伍"),
        camp.party.map(m => h("div", { key: m.key, style: { marginBottom: 6 } },
          h("div", { style: Object.assign({}, S.txt, { fontSize: 12.5, display: "flex", justifyContent: "space-between" }) }, h("span", null, m.name), h("span", { style: { color: m.hp <= 25 ? "#a4442e" : t.sub } }, "HP " + m.hp + "/" + (m.maxHp || 100))),
          h("div", { style: { height: 4, borderRadius: 2, background: t.line, overflow: "hidden" } }, h("div", { style: { width: Math.max(0, Math.min(100, m.hp / (m.maxHp || 100) * 100)) + "%", height: "100%", background: m.hp <= 25 ? "#a4442e" : t.ink } })),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 2 } }, STATS.map(([k, zh]) => zh + m.stats[k]).join(" · ")))),
        h("div", { style: S.lbl }, "主线"),
        camp.stages.map((s, i) => h("div", { key: i, style: Object.assign({}, S.txt, { fontSize: 12, marginBottom: 2, color: i === camp.stageIdx ? t.ink : t.fog }) }, (s.done ? "✓ " : i === camp.stageIdx ? "→ " : "· ") + "第" + (i + 1) + "章:" + (i <= camp.stageIdx ? s.goal : "???"))),
        h("div", { style: Object.assign({}, S.lbl, { marginTop: 6 }) }, "物品"),
        h("div", { style: Object.assign({}, S.txt, { fontSize: 12 }) }, camp.items.join("、") || "空空如也"),
        h("div", { style: Object.assign({}, S.lbl, { marginTop: 6 }) }, "线索"),
        camp.clues.length ? camp.clues.map((x, i) => h("div", { key: i, style: Object.assign({}, S.txt, { fontSize: 12, marginBottom: 2 }) }, (i + 1) + ". " + x)) : h("div", { style: Object.assign({}, S.txt, { fontSize: 12 }) }, "尚无"),
        h("div", { style: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" } },
          !camp.ended && h("button", { onClick: () => { if (confirm("提前收团?守密人会就此写终章落幕。")) epilogue(true); }, disabled: busy, style: S.btn(false) }, "谢幕收团"),
          h("button", { onClick: () => delCamp(camp.id), style: Object.assign({}, S.btn(false), { color: "#a4442e", borderColor: "#a4442e55" }) }, "删除此团")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 8, lineHeight: 1.7 } }, "长按任意一拍可从那里分支回溯——状态按当拍快照恢复,原团一个字不动。"));
      const downed = camp.party.filter(m => m.hp <= 0);
      const banner = camp.pendingStage ? h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", borderColor: t.ink }) },
          h("div", { style: S.txt }, "这一章可能到落点了:" + (cur ? cur.goal : "") + (typeof camp.pendingStage === "string" ? "\n(" + camp.pendingStage + ")" : "")),
          h("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
            h("button", { onClick: () => confirmStage(true), style: S.btn(true) }, "翻过这一章"),
            h("button", { onClick: () => confirmStage(false), style: S.btn(false) }, "还没有")))
        : camp.pendingEnd ? h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", borderColor: t.ink }) },
          h("div", { style: S.txt }, "故事似乎可以落幕了" + (typeof camp.pendingEnd === "string" ? ":" + camp.pendingEnd : "")),
          h("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
            h("button", { onClick: () => epilogue(false), disabled: busy, style: S.btn(true) }, "落幕,看终章"),
            h("button", { onClick: () => update(list => list.map(c => c.id !== camp.id ? c : Object.assign({}, c, { pendingEnd: false }))), style: S.btn(false) }, "故事还没完")))
        : (!camp.ended && downed.length) ? h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", borderColor: "#a4442e" }) },
          h("div", { style: S.txt }, downed.map(m => m.name).join("、") + " 倒下了。命悬一线不等于终局——可以继续演,让剧情给出转机;也可以就此落幕;或长按之前的一拍分支回溯。"),
          h("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
            h("button", { onClick: () => turn("(不肯认输,想办法救回" + downed.map(m => m.name).join("、") + ")"), disabled: busy, style: S.btn(true) }, "挣扎求生"),
            h("button", { onClick: () => { if (confirm("接受这个结局?终章会照现在的惨状写。")) epilogue(true); }, disabled: busy, style: S.btn(false) }, "接受结局"))) : null;
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
        : h("div", { key: m.id, onPointerDown: () => pressMsg(m), onPointerUp: pressEnd, onPointerMove: pressEnd, onPointerLeave: pressEnd, onContextMenu: e => e.preventDefault(), style: Object.assign({ margin: "10px 14px" }, S.txt) }, m.content));
      const msgSheet = msgMenu && h("div", { onClick: () => setMsgMenu(null), style: { position: "fixed", inset: 0, zIndex: 140, background: "rgba(30,28,24,.4)", display: "flex", alignItems: "flex-end" } },
        h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", background: t.bg2, borderRadius: "18px 18px 0 0", padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.7, padding: "0 2px 8px" } }, "从这一拍岔开一条新团:这一拍之前原样保留(HP/物品/章节都按当时恢复),之后的重演。原团一个字不动。"),
          [["⑂ 从这里分支", () => branchFrom(msgMenu)], ["取消", () => setMsgMenu(null)]].map(([label, fn], i) => h("button", { key: label, onClick: fn, style: { width: "100%", padding: "13px 0", fontFamily: F_BODY, fontSize: 14, color: i === 0 ? t.ink : t.sub, background: "none", border: "none", borderTop: i ? "1px solid " + t.line : "none" } }, label))));
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
      // 卡死自救:没在忙、没有选项、也没有待确认横幅时,给一条「让守密人继续」的路
      const stuck = !busy && !camp.ended && !camp.choices.length && !camp.pendingStage && !camp.pendingEnd;
      return h("div", { style: S.wrap }, badges(),
        camp.bg ? h("div", { style: { position: "absolute", inset: 0, zIndex: 0, backgroundImage: "linear-gradient(rgba(240,236,228,.8),rgba(240,236,228,.8)), url(" + imgSrc(camp.bg) + ")", backgroundSize: "cover", backgroundPosition: "center" } }) : null,
        ceremonyLayer, msgSheet, photoSheet, bigViewer,
        h("div", { style: { position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } },
        header(camp.title + " · " + (camp.place || ""), h("button", { onClick: () => setPanelOpen(v => !v), style: S.btn(false) }, panelOpen ? "收起" : "队伍与线索")),
        panel, banner,
        h("div", { ref: scrollRef, style: { flex: 1, overflowY: "auto", paddingBottom: 16 } }, flow, epFlow,
          busy ? h("div", { style: { margin: "10px 14px", fontFamily: F_BODY, fontSize: 12, color: t.fog } }, busyWhat || "守密人在推演命运…") : null),
        camp.ended ? h("div", { style: { textAlign: "center", padding: "16px 14px calc(env(safe-area-inset-bottom, 0px) + 16px)", borderTop: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 11, letterSpacing: 2, color: t.fog } }, "—— 已落幕 · 长按任意一拍可分支重走 ——")
        : [
          (camp.choices.length || stuck) ? h("div", { key: "ch", style: { display: "flex", flexWrap: "wrap", gap: 7, padding: "8px 14px 0", borderTop: "1px solid " + t.line } },
            camp.choices.map((c, i) => {
              const locked = c.need && camp.items.indexOf(c.need) < 0;
              return h("button", { key: i, onClick: () => pickChoice(c), disabled: busy, style: Object.assign({}, S.btn(false), { textAlign: "left", opacity: locked ? 0.55 : 1 }) },
                c.text,
                c.check ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, " 🎲" + STAT_ZH[c.check.stat] + (c.check.who ? "·" + c.check.who : "")) : null,
                c.need ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: locked ? "#a4442e" : t.fog } }, (locked ? " 🔒" : " ✓") + c.need) : null);
            }),
            stuck ? h("button", { key: "go", onClick: () => turn(""), disabled: busy, style: S.btn(false) }, "让守密人继续 →") : null) : null,
          noteOpen ? h("div", { key: "nt", style: { padding: "8px 14px 0" } },
            h("textarea", { value: note, onChange: e => setNote(e.target.value), rows: 2, placeholder: "跟守密人咬耳朵(只给下一回合的幕后指示,不入剧情):比如「节奏快一点」「让某人多点戏」", style: { width: "100%", padding: 8, borderRadius: 10, border: "1px dashed " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 12, color: t.ink, resize: "none", outline: "none" } })) : null,
          plusOpen ? h("div", { key: "pl", style: { display: "flex", gap: 8, padding: "8px 14px 0", flexWrap: "wrap" } },
            h("button", { onClick: () => setDice(v => !v), style: S.btn(dice) }, "🎲 剧情骰" + (dice ? "·已上膛" : "")),
            h("button", { onClick: () => setNoteOpen(v => !v), style: S.btn(noteOpen || !!note.trim()) }, "() 咬耳朵"),
            h("button", { onClick: genShot, disabled: busy, style: S.btn(false) }, "📷 当拍画面"),
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
  if (typeof module === "object" && module.exports) module.exports = { rollStats, personaNudge, gradeCheck, normChoices, applyTurnPayload, foldHist, findMember, shotSafeLines };
})();
