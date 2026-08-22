// ============================================================
// 小剧场（theater）—— if 线扮演
// 选角色 + 关键词 → 生成平行身份(角色新身份/你的新身份/世界情境) + 本轮小目标。
// 线下叙事式演出;目标由模型报告 + 用户确认;同一条 if 线可多轮续演(每轮一个新目标)。
// 完全沙箱:不读写主线记忆/世界书/好感/状态卡;数据只存 x_theater(跟随 x_ 前缀整包云同步)。
// 生成走线下创作线路(props.active),prompt 复用全局 ANTI_CLICHE / CHARCARD_RULE / 线下叙事准则。
// ============================================================
(function () {
  const useState = React.useState, useRef = React.useRef, useEffect = React.useEffect;
  // 图标:两片小幕布 + 星(挂进 REG 的 window.GTheater)
  window.GTheater = p => h(Svg, p, h("path", { d: "M3 4c3 2 15 2 18 0v5a9 9 0 01-18 0z" }), h("path", { d: "M7.5 13.5v4M12 14.5v5M16.5 13.5v4" }), h("path", { d: "M12 6.2l.4 1.2 1.2.4-1.2.4-.4 1.2-.4-1.2-1.2-.4 1.2-.4z" }));

  const load = () => {
    try {
      const list = JSON.parse(localStorage.getItem("x_theater") || "[]");
      const repaired = repairTheaterHistory(list);
      if (repaired.changed) localStorage.setItem("x_theater", JSON.stringify(repaired.list));
      return repaired.list;
    } catch (e) { return []; }
  };
  const persist = list => { try { localStorage.setItem("x_theater", JSON.stringify(list)); } catch (e) {} };
  const rid = pre => pre + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  // 前情提要改成小账本(参考 liveware-tavern 的做法,自己实现):
  // 一坨文字没法判断压缩有没有把东西压没了,也没法规定谁先被丢。
  const LEDGER_KEYS = ["timeline", "facts", "openThreads", "objects"];
  // 超长时的淘汰顺序:先丢流水与事实,【未了的线与物件最后才动】——
  // 最早的事件往往正是埋得最深的那条线,按时间一刀切会先把它扔掉。
  const LEDGER_EVICT = ["timeline", "facts", "objects", "openThreads"];
  const ledgerCount = L => LEDGER_KEYS.reduce((n, k) => n + ((L && L[k]) || []).length, 0);
  const ledgerChars = L => LEDGER_KEYS.reduce((n, k) => n + ((L && L[k]) || []).join("").length, 0);
  function shrinkLedger(L, maxChars) {
    const out = Object.assign({}, L);
    while (ledgerChars(out) > maxChars) {
      let moved = false;
      for (const k of LEDGER_EVICT) {
        const arr = (out[k] || []).slice();
        if (arr.length) { arr.shift(); out[k] = arr; moved = true; break; }
      }
      if (!moved) break;
    }
    return out;
  }
  // 压缩质量闸:不额外调用,纯本地判断这次压缩是不是把记忆压没了。
  // 受保护的(未了的线/物件)从有到几乎没有,一律判失败,宁可这轮不压。
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
  // 覆盖到哪儿改用【内容哈希】而不是下标:删改过中间某条消息后,下标会静默错位,
  // 摘要覆盖范围和实际对不上也不会报错。
  function histSig(msgs) {
    let h = 5381;
    (msgs || []).forEach(m => { const t = (m.id || "") + "|" + (m.content || ""); for (let i = 0; i < t.length; i++) h = (h * 33 + t.charCodeAt(i)) >>> 0; });
    return h.toString(36) + "_" + (msgs || []).length;
  }

  // 不同供应商对“只输出 JSON”的服从方式并不一致。Gemini 通常直接给对象，
  // Claude/部分中转偶尔会多包一层 JSON 字符串，或在字符串里留下未转义换行。
  // 小剧场正文绝不能因此退化成显示整坨协议原文（scene/goalReached/...）。
  // escapeJsonStringControls / parseJSONLoose 现在住在 engine.js，主聊天、群聊、小剧场共用一份实现。
  // Claude 偶尔会在 JSON 字符串正文里直接写中文对话引号，导致整份 JSON
  // 语法失效。此时不猜整份对象，只按协议中稳定的字段边界抢救 scene；
  // goal 字段仍逐个读取，绝不把协议壳当正文。
  const decodeLooseJsonText = value => String(value || "")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
  const salvageTheaterPayload = raw => {
    const text = String(raw || "").replace(/```(?:json)?/gi, "").trim();
    const startMatch = /"scene"\s*:\s*"/.exec(text);
    if (!startMatch) return null;
    const start = startMatch.index + startMatch[0].length;
    const rest = text.slice(start);
    const endMatch = /"\s*,\s*"goalReached"\s*:/.exec(rest);
    if (!endMatch) return null;
    const scene = decodeLooseJsonText(rest.slice(0, endMatch.index)).trim();
    if (!scene) return null;
    const bool = name => {
      const m = new RegExp('"' + name + '"\\s*:\\s*(true|false)', "i").exec(text.slice(start + endMatch.index));
      return m ? m[1].toLowerCase() === "true" : false;
    };
    const noteMatch = /"goalNote"\s*:\s*(null|"([\s\S]*?)")\s*[},]/.exec(text.slice(start + endMatch.index));
    return {
      scene,
      goalReached: bool("goalReached"),
      goalFailed: bool("goalFailed"),
      goalNote: noteMatch && noteMatch[1] !== "null" ? decodeLooseJsonText(noteMatch[2]) : null
    };
  };
  function parseTheaterPayload(raw) {
    let value = null;
    const candidates = [String(raw || ""), escapeJsonStringControls(raw)];
    for (const candidate of candidates) {
      value = typeof extractJSON === "function" ? extractJSON(candidate) : null;
      if (value != null) break;
    }
    // 兼容 `"{\"scene\":...}"` 以及 `{scene:"{\"scene\":...}"}` 两种双包层。
    for (let depth = 0; depth < 3; depth++) {
      if (typeof value === "string") {
        const nested = (typeof extractJSON === "function" && extractJSON(value))
          || (typeof extractJSON === "function" && extractJSON(escapeJsonStringControls(value)));
        if (nested == null) break;
        value = nested;
        continue;
      }
      if (value && typeof value === "object" && typeof value.scene === "string" && /^\s*\{\s*"(?:scene|draftScene)"\s*:/.test(value.scene)) {
        const nested = (typeof extractJSON === "function" && extractJSON(value.scene))
          || (typeof extractJSON === "function" && extractJSON(escapeJsonStringControls(value.scene)));
        if (!nested || typeof nested !== "object") break;
        value = Object.assign({}, value, nested);
        continue;
      }
      break;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) value = salvageTheaterPayload(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const scene = typeof value.scene === "string" ? value.scene.trim() : "";
    // 最后一层保险：协议对象仍像协议对象时，宁可重试，也不污染剧情历史。
    if (!scene || /^\s*\{\s*"(?:scene|draftScene|goalReached)"\s*:/.test(scene)) return null;
    return Object.assign({}, value, { scene });
  }
  // 设定/开局这几支以前只用裸 extractJSON，于是 scene 那边早就治过的两种坏法在这里照样致命：
  //   ① 字符串正文里直接写了换行等控制字符（opening 是 5-9 句，最容易踩）；
  //   ② 正文里用了未转义的英文引号（中文对白最爱）。
  // 现在按 scene 同一套梯队来：先规规矩矩解析 → 转义控制字符再解析 → 拆一层字符串双包
  //   → 最后按【已知键名的边界】把每个字段的正文硬抠出来。抠不出来就返回 null，绝不猜。
  const salvageByKeys = (raw, keys) => {
    const text = String(raw || "").replace(/```(?:json)?/gi, "");
    const out = {};
    let got = 0;
    keys.forEach(k => {
      const head = new RegExp('"' + k + '"\\s*:\\s*"').exec(text);
      if (!head) return;
      const rest = text.slice(head.index + head[0].length);
      let end = -1;
      keys.forEach(nk => {
        if (nk === k) return;
        const m = new RegExp('"\\s*,\\s*"' + nk + '"\\s*:').exec(rest);
        if (m && (end < 0 || m.index < end)) end = m.index;
      });
      if (end < 0) { const tail = /"\s*\}[\s\S]*$/.exec(rest); end = tail ? tail.index : -1; }
      if (end < 0) return;
      const v = decodeLooseJsonText(rest.slice(0, end)).trim();
      if (v) { out[k] = v; got++; }
    });
    return got ? out : null;
  };
  const parseSettingPayload = (raw, keys) => {
    let v = null;
    for (const cand of [String(raw || ""), escapeJsonStringControls(raw)]) {
      v = typeof extractJSON === "function" ? extractJSON(cand) : null;
      if (v != null) break;
    }
    if (typeof v === "string") {
      const nested = extractJSON(v) || extractJSON(escapeJsonStringControls(v));
      if (nested) v = nested;
    }
    if (!v || typeof v !== "object" || Array.isArray(v)) v = salvageByKeys(raw, keys);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  };
  // v53.61 以前若已经把协议原文存进历史，升级后本地就地修复一次。
  // 只碰明确长得像 theater 协议的角色消息，普通剧情与用户输入完全不动。
  function repairTheaterHistory(value) {
    let changed = false;
    const repairRounds = rounds => (rounds || []).map(round => ({ ...round, msgs: (round.msgs || []).map(msg => {
      if (msg.role !== "char" || typeof msg.content !== "string" || !/"scene"\s*:/.test(msg.content) || !/"goalReached"\s*:/.test(msg.content)) return msg;
      const parsed = parseTheaterPayload(msg.content);
      if (!parsed || !parsed.scene) return msg;
      changed = true;
      return { ...msg, content: parsed.scene };
    }) }));
    const list = Array.isArray(value) ? value.map(line => ({
      ...line,
      rounds: repairRounds(line.rounds),
      archives: (line.archives || []).map(archive => ({ ...archive, rounds: repairRounds(archive.rounds) }))
    })) : [];
    return { list, changed };
  }
  // 取景骰子(v53.27):没关键词时让模型「自由发挥」,它每次都掷出同一个众数——
  // 民国租界 + 一方走投无路 + 另一方手里握着唯一能救她的物件。根因是目标契约
  // (他做出/有代价/不可逆/由她促成)最省力的解只有那一个拓扑,再加上提示词里
  // 点名过的题材本身就是吸引子。所以题材/关系/门槛三个骰子改由 JS 来掷:
  // 客户端的真随机压得住语料先验,模型自称的"随机挑一个"压不住。
  const POOL_GENRE = ["校园", "现代都市职场", "江湖武侠", "古代宫廷", "赛博朋克", "末世废土", "西幻大陆", "蒸汽朋克", "太空歌剧", "神话志怪", "民国", "西部拓荒", "远洋航船", "乡镇小城", "医院", "法庭律所", "演艺圈", "职业体育", "餐饮后厨", "考古学界", "监狱", "秘密结社", "赛车机械", "剧团马戏班"];
  const POOL_BOND = ["上下级", "宿敌", "旧友重逢", "债主与欠债人", "被迫合作的同谋", "师徒", "同行竞争者", "照顾者与被照顾者", "被同一件事困住的陌生人", "分开多年的前任", "猎人与猎物", "房东与租客", "医生与病人", "对簿公堂的两造", "台前与幕后的搭档"];
  const POOL_TENSION = ["一段没清算干净的旧账", "一个谁都不肯先说破的秘密", "两个人立场天然对立", "一个没兑现的承诺", "一场势均力敌、谁也不肯认输的较劲", "共同守着一件不能外传的事", "一个从头到尾的误会,双方都以为自己才是吃亏的那个", "一次谁也不占便宜的交易", "共同照看着某个第三者(人、动物或一件东西)", "一段被硬生生打断、没能收尾的关系", "悬殊的身份差距", "一个共同的敌人逼着两人搭伙", "刚刚开始建立、还很脆弱的信任", "一句说出口就会改变一切、所以谁都没说的话"];
  const POOL_TONE = ["冷硬克制", "温暖有余味", "荒诞喜剧", "悬疑压抑", "怅然若失", "热血莽撞", "暧昧拉扯", "松弛的日常感", "苦中作乐", "锋利互怼"];
  const POOL_GATE = ["承认一种他一直否认的感情", "放弃一个他赖以生存的身份", "亲手毁掉他最在意的东西", "当众站到某一边去", "放走一个他本该处理掉的人", "答应一件违背他原则的事", "说出一个他发誓不说的名字", "第一次向人开口求助", "收下他一直拒绝的东西", "把一个人留下来"];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const pick3 = a => { const s = []; while (s.length < 3) { const x = pick(a); if (s.indexOf(x) < 0) s.push(x); } return s; };
  // 情境骰子:同一套身份世界要开出【不同的故事】时用。收藏基线开新局、重开此线都掷它,
  // 否则模型只会把上一次那个时刻换个说法复述一遍——身份留住了,故事却是同一个。
  const POOL_SITU = ["其中一方失去了记忆", "一场政变或剧变掀翻了原有秩序", "多年以后重逢,两人的位置对调了", "一方病倒或重伤,只能依赖另一方", "两人被困在同一个地方出不去", "一方的秘密被第三方当众揭穿", "一方来求另一方办一件绝不该开口的事", "一笔旧账被翻出来当众清算", "一个外来者闯入,打破了两人之间的平衡", "两人被迫以另一重身份共事", "一方失势落魄,另一方成了唯一的去处", "一件本该早就毁掉的东西重新出现"];
  // world(长期为真)+ hook(此刻)拼成整段情境;老存档只有 setting,拼接要能容忍空值
  const joinScene = (world, hook) => [String(world || "").trim(), String(hook || "").trim()].filter(Boolean).join("\n");

  function TheaterApp(props) {
    const t = useTheme();
    const uName = (props.profile && props.profile.name) || "你";
    const [lines, setLines] = useState(load);
    // 收藏的基线设定(x_theaterPresets):满意的身份/世界可复用开新局,只重新生成开场与目标
    const [presets, setPresets] = useState(() => { try { return JSON.parse(localStorage.getItem("x_theaterPresets") || "[]"); } catch (e) { return []; } });
    const savePresets = fn => setPresets(p => { const n = fn(p.slice()); try { localStorage.setItem("x_theaterPresets", JSON.stringify(n)); } catch (e) {} return n; });
    // 图库(x_theaterGallery):所有出过的剧照自动归档,按角色分组;重拍换掉的、线删掉的都仍留在这里
    const loadGal = () => { try { return JSON.parse(localStorage.getItem("x_theaterGallery") || "[]"); } catch (e) { return []; } };
    const [gal, setGal] = useState(loadGal);
    const saveGal = fn => setGal(p => { const n = fn(p.slice()); try { localStorage.setItem("x_theaterGallery", JSON.stringify(n)); } catch (e) {} return n; });
    const [galView, setGalView] = useState(null); // 图库里点开的大图:null | item
    const [galChar, setGalChar] = useState(null); // 图库里进到哪个角色:null=头像墙
    const [sheetChar, setSheetChar] = useState(null); // 入口页点头像拉起的抽屉
    const [listChar, setListChar] = useState(null); // 记录/收藏页当前看的是哪个角色
    // 收藏只留【长期为真】的那一层:身份 + 世界。此刻的处境(hook)故意不存——
    // 存了它,用基线开新局就变成把同一个时刻重演一遍,那正是它没意思的原因。
    const addPreset = src => { savePresets(l => [{ id: rid("tp_"), charId: src.charId, title: src.title, charRole: src.charRole, userRole: src.userRole, world: src.world || src.setting, keywords: src.keywords || "", ts: Date.now() }, ...l]); props.toast("已收藏为基线(只存身份与世界,每次开局重新起情境)"); };
    const [view, setView] = useState("list"); // list | create | play
    const [playId, setPlayId] = useState(null);
    const [busy, setBusy] = useState(false);
    // busy 只说"忙着"，说不出在忙什么。出图要等半分钟，界面却写着「Ta 在演…」，
    // 加上 + 菜单点完就收起来，看着就像点了没反应（她 2026-08-22 提）。
    const [busyWhat, setBusyWhat] = useState("");
    const [panelOpen, setPanelOpen] = useState(false);
    const [draft, setDraft] = useState(null); // create 预览:{charId, keywords, title, charRole, userRole, setting, goal}
    const [pickChar, setPickChar] = useState((props.characters[0] || {}).id || null);
    const [kw, setKw] = useState("");
    const [input, setInput] = useState("");
    const [edit, setEdit] = useState(null); // 演出面板的设定编辑缓冲:null | {title, charRole, userRole, setting, goal}
    const [note, setNote] = useState(""); // 导演便签:一次性,喂给下一拍生成后自动清空
    const [noteOpen, setNoteOpen] = useState(false);
    const [dice, setDice] = useState(false); // 剧场骰子:下一拍注入一个意外,一次性
    const [plusOpen, setPlusOpen] = useState(false); // + 菜单(骰子/便签/背景/出图)
    const [photoMenu, setPhotoMenu] = useState(null); // 长按剧照弹出的操作单:msg|null
    const [msgMenu, setMsgMenu] = useState(null);     // 长按正文弹出的操作单(分支):msg|null
    const pressRef = useRef(null);
    const fileRef = useRef(null);
    const [writeGoal, setWriteGoal] = useState(null); // null | string:手写下一轮目标的缓冲
    const [diff, setDiff] = useState("normal"); // 开线时的难度档
    const scrollRef = useRef(null);
    const linesRef = useRef(null);
    const sumBusyRef = useRef(false);
    const update = fn => setLines(p => { const n = fn(p.slice()); persist(n); return n; });
    useEffect(() => { linesRef.current = lines; });
    // 回填:图库上线前已经出过的剧照(含归档的重开局)一次性补进图库,按图引用去重
    useEffect(() => {
      const have = new Set(loadGal().map(x => x.img));
      const add = [];
      lines.forEach(l => (l.rounds || []).concat((l.archives || []).flatMap(a => a.rounds || [])).forEach(r => (r.msgs || []).forEach(m => {
        if (m.role === "photo" && m.img && !have.has(m.img)) { have.add(m.img); add.push({ id: rid("tg_"), charId: l.charId, lineId: l.id, lineTitle: l.title, img: m.img, ts: m.ts || Date.now() }); }
      })));
      // 封面同样归档（v54.46）：以前封面只当卡片底纹，出完就再也看不到整张
      lines.forEach(l => { if (l.cover && !have.has(l.cover)) { have.add(l.cover); add.push({ id: rid("tg_"), charId: l.charId, lineId: l.id, lineTitle: l.title, img: l.cover, ts: l.coverTs || l.ts || Date.now(), kind: "cover" }); } });
      if (add.length) saveGal(list => add.concat(list).sort((a, b) => b.ts - a.ts));
    }, []);
    // 目标契约(四处生成共用一份,免得改一处漏三处)。
    // 2026-08-18 Lisa 拿商业乙游的关卡设计来对照:那边的目标全是「让他喂你吃排骨」
    // 「让他同意你帮他换衬衫」「让他相信你只是在晨跑」这类日常小动作,却一点不轻——
    // 因为重量来自处境。我原先写死的「禁止事务级小目标」是错的,一刀切掉了整类好目标。
    const GOAL_RULE = "目标【必须是角色一方做出/说出的事】——让他答应、让他承认、让他松口、让他交出、让他做出那个选择;由 " + uName + " 在戏里想办法促成,他跨过那道坎才算达成。绝不许写成要 " + uName + " 自己去坦白/抉择/行动的任务(Ta 是解题的人,不是被出题的人)。"
      + "\n【门槛的重量来自处境,不来自动作大小】目标完全可以是一件日常小事:让他喂你一口菜、让他答应替你/让你替他换掉湿掉的衣服、让他收下你硬塞的东西、让他把手里的活交给你、让他哭出来、让他说出刚才为什么不吭声。动作本身很小,但放在此刻这个处境、这两个人的关系里,他要跨过去并不容易——那就是好目标。不要为了显得有分量,就把每个目标都写成生死抉择或惊天秘密。"
      + "\n【目标必须具体、可判定】写成一句能一眼看出「到底发生了没有」的事(喂了/没喂、说了/没说、答应了/没答应、哭了/没哭),不要写「让他敞开心扉」「化解两人的隔阂」这种没法判定的抽象状态。"
      + "\n【只定门槛,不定路径】写清他要跨过哪一类坎,但不预设他为什么跨、真相是什么、必须被怎样说动——解法要不止一种。";
    // 难度档:目标重量 + 演出时他有多难撬
    const DIFF = {
      easy: { name: "轻松", goal: "目标就写日常尺度的小事:喂一口菜、收下你硬塞的东西、答应陪你走一段、把手里的活交给你。小不等于没门槛——他此刻仍要克服点什么才做得出来。", play: "他对目标方向的抵抗不高:给个台阶就下,顺水推舟就能到。" },
      normal: { name: "标准", goal: "", play: "" },
      hard: { name: "硬核", goal: "目标门槛要重:他有充分理由死守,达成应当很难、需要多轮真正的攻坚(仍可以是一个小动作,但那个动作对此刻的他等于缴械)。", play: "他会【真实地抵抗】目标方向:回避、装傻、转移话题、反将一军;只有被真正说动、戳中要害或无路可退时才让步,绝不因为对方坚持了两句就松口。" }
    };
    const diffOf = l => DIFF[(l && l.difficulty) || "normal"] || DIFF.normal;
    // 滚动摘要(防长线失忆):超过 48 条后,把最老的部分浓缩进 line.summary,只留近 32 条逐句喂
    const maybeSummarize = async lineId => {
      if (sumBusyRef.current || !props.active) return;
      const l = (linesRef.current || []).find(x => x.id === lineId);
      if (!l) return;
      const all = l.rounds.flatMap(r => r.msgs);
      // 覆盖范围认哈希:存档里 sumSig 与当前前缀对不上(中间被删改过)就从头重算,
      // 不再拿一个可能已经错位的下标继续往下压。
      const done = (l.sumSig && l.sumSig === histSig(all.slice(0, l.sumCount || 0))) ? (l.sumCount || 0) : 0;
      if (all.length - done <= 48) return;
      const cut = all.length - 32;
      const seg = all.slice(done, cut).filter(m => m.role !== "photo").map(m => (m.role === "user" ? uName : (charOf(l).name || "Ta")) + ":" + m.content).join("\n").slice(0, 9000);
      sumBusyRef.current = true;
      try {
        const prev = l.ledger && LEDGER_KEYS.some(k => (l.ledger[k] || []).length) ? l.ledger : null;
        const sys = "把小剧场剧情压缩进一本【前情账本】,不是写摘要散文。合并旧账本与新增剧情,输出四类条目,每条一句话:\n"
          + "· timeline:已经发生的关键事件,按先后。\n"
          + "· facts:已经确立、后面不该被推翻的事实(身份、关系、真相、约定)。\n"
          + "· openThreads:【还没了结的线】——问了没答的、说了要做还没做的、悬着的威胁与承诺。这一类最要紧,宁可多留。\n"
          + "· objects:重要物件此刻在谁手上、什么状态(刀、信、底片、钥匙…)。没有就给空数组。\n"
          + "旧账本里的条目除非已经被剧情推翻或了结,否则一律保留;了结了的从 openThreads 挪进 timeline 或 facts。不要写文风渲染,不要复述对白。\n"
          + "只输出 JSON:{\"timeline\":[],\"facts\":[],\"openThreads\":[],\"objects\":[]}";
        const user = (prev ? "【旧账本】\n" + JSON.stringify(prev) + "\n\n" : "") + "【新增剧情】\n" + seg;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 2200, timeout: 120000 });
        const p2 = extractJSON(raw) || {};
        const next = {};
        LEDGER_KEYS.forEach(k => { next[k] = (Array.isArray(p2[k]) ? p2[k] : []).map(x => String(x || "").trim()).filter(Boolean).slice(0, 14); });
        // 质量闸:压完发现受保护的记忆几乎没了,就当这次压缩没发生——
        // 宁可下一轮多喂点原文,也不能静默把几十轮剧情压成一句空话。
        if (!ledgerOk(prev, next)) return;
        const trimmed = shrinkLedger(next, 2400);
        update(list => list.map(x => x.id !== lineId ? x : { ...x, ledger: trimmed, summary: ledgerToText(trimmed), sumCount: cut, sumSig: histSig(all.slice(0, cut)) }));
      } catch (e) { /* 静默:下次再试 */ } finally { sumBusyRef.current = false; }
    };
    const line = lines.find(l => l.id === playId) || null;
    const charOf = l => props.characters.find(c => c.id === l.charId) || {};
    const msgCount = line ? line.rounds.reduce((n, r) => n + r.msgs.length, 0) : 0;
    // 只在消息数或换线时滚到底;无依赖数组会让每次打字/点按钮都把滚动条按回底部,想往上翻都翻不了
    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgCount, playId]);

    // 「模型没吐出 JSON」= 连键名都抠不出来，说明它压根没按格式写(直接写成了散文)。
    // 内容其实已经生成出来、也已经付过钱了，所以再花一次小调用把它【原样归类】进 JSON，
    // 而不是让她重点一次按钮从头烧。整理不回来才认输。
    const reformatSetting = async (raw, shape, keys) => {
      const text = String(raw || "").trim();
      if (!text) return null;
      const sys = "下面是一段已经写好的内容,但它没有按要求输出 JSON。把它【原样整理】成这个形状:\n" + shape
        + "\n【铁律】只做搬运和归类:内容一个字都不许改写、不许润色、不许自己另编;原文里确实没写的字段就留空字符串。只输出 JSON,不要代码块。";
      try {
        return parseSettingPayload(await callAI(props.active, sys, [{ role: "user", content: text.slice(0, 8000) }], { maxTokens: 3200, timeout: 120000 }), keys);
      } catch (e) { return null; }
    };
    // 认输时把模型到底回了什么带出来一小段——不然「没吐出 JSON」是个查不下去的死胡同。
    const rawHint = raw => {
      const t = String(raw || "").replace(/\s+/g, " ").trim();
      return t ? "(它回的是:" + t.slice(0, 30) + (t.length > 30 ? "…" : "") + ")" : "(上游什么都没回)";
    };
    // 「设定生成不完整」的真凶多半不是模型不会写,是【正文被 max_tokens 截断】:
    // JSON 尾部的键先死,而 goal 以前恰好排在最后一个。goal 已经挪到 opening 前面、额度也放宽了;
    // 万一还是缺,就拿这次已经付过钱的那半份回去补【只补缺的键】,不整局重来白烧一次调用。
    const completeSetting = async (partial, raw, need, hint) => {
      const lack = need.filter(k => !String((partial && partial[k]) || "").trim());
      if (!lack.length) return partial;
      const sys = "下面这份 JSON 因为长度被截断,缺了几个字段。请【只补这几个键】,和已经写好的部分严丝合缝地接上,其余一个字都不要重复。\n"
        + (hint || "") + "\n只输出 JSON:{" + lack.map(k => "\"" + k + "\":\"…\"").join(",") + "}";
      let fix = null;
      try {
        fix = parseSettingPayload(await callAI(props.active, sys, [{ role: "user", content: "【已经写好的部分】\n" + String(raw || "").slice(0, 6000) }], { maxTokens: 1600, timeout: 90000 }), lack);
      } catch (e) { return partial; }
      if (!fix) return partial;
      const out = Object.assign({}, partial || {});
      lack.forEach(k => { if (String(fix[k] || "").trim()) out[k] = fix[k]; });
      return out;
    };
    // ---- 生成:if 线设定 ----
    const SHAPE_SETTING = "{\"title\":\"这条if线的短名字(≤10字)\",\"charRole\":\"角色的新身份、性格处境与长期立场(2-3句;不含一次性的当下状态)\",\"userRole\":\"" + uName + " 的新身份+Ta 长期背负的冲突或赌注(2-3句;同样不含当下状态)\",\"world\":\"世界观 + 两人之间长期存在的关系与张力核心(2-4句)\",\"hook\":\"此刻正在发生什么:这一局专属的一次性处境(1-3句)\",\"charOutfit\":\"Ta 在这条线里穿什么:一句话,具体到能照着画(材质/形制/颜色/关键配件),必须符合这个世界的时代与身份\",\"userOutfit\":\"" + uName + " 在这条线里穿什么:同样一句话、同样具体\",\"goal\":\"本轮目标:一句话,写清那个有代价的关键节点\",\"opening\":\"开场正文\"}";
    const genSetting = async () => {
      const char = props.characters.find(c => c.id === pickChar);
      if (!char) return props.toast("先选一个角色");
      if (!props.active) return props.toast("请先配置线下 API");
      setBusy(true);
      try {
        const sys = "你在为一场「if 线小剧场」做开场设定:保持角色的性格、说话方式和反应习惯,但把身份、职业、处境替换到一个全新的平行世界。\n【保留的只是性格机制】——他怎么说话、怎么注意、怎么反应、那股聪明劲;履历、职业领域、社会位置、甚至道德立场都属于可替换的部分。新身份要敢于远离原设定:换时代、换世界观、换职业大类都行;除非关键词点名,【不要】沿用原人设的职业领域(原本搞研究就总派研究员,这是偷懒)。关键词为空时,严格按 user 消息里给出的【本局取景框】搭这条线,不要另起炉灶挑自己顺手的题材。\n【关键词拥有最高优先级】:题材、身份、阵营都照办——包括要求他当反派/坏人时,就让他【真的坏】,用他原本的聪明、魅力和说话方式去坏,不许洗白、软化或让他偷偷还是好人。\n先构思一个把两人绑在一起的【张力核心】(关键词为空时,它的性质由取景框指定,不许另选);两人的新身份都必须长在这个张力上,不是随便两个职业的偶遇。张力不必都是阴谋、亏欠或对立——共犯般的默契、没说破的心动、荒唐的误会、势均力敌的较劲同样能把两个人牢牢绑住。\ngoal 是这条张力上的一个节点。" + GOAL_RULE + "\n【禁用默认套路】「一方走投无路,另一方手里正好握着唯一能救他/她的物件或情报,交出即自毁」——这是上面这套约束最省力的解,已经被用烂了;雨夜、暗室、追兵在门外、身上带着伤同样是默认布景。你想到的第一个点子如果长这样,推翻重想。\n【基调决定味道,不决定重量】取景框给的基调只管这条线读起来是什么气味(冷硬/温暖/荒诞/暧昧…),不影响目标的分量:温暖或喜剧的线同样要有一个真正难跨的门槛(比如让他承认这些年其实一直是他在依赖你),不许因为基调轻松就把目标写软。\n【代价不必是生死】身败名裂、失去位置、背叛另一个人、承认自己错了或需要人——社会性、关系性、自尊上的代价一样重。不要每条线都写成命悬一线。\n【长期与一次性必须分开写】这是硬性要求:world 和两人的身份只写【长期为真】的东西——他们是谁、这个世界怎么运转、两人之间长期存在的关系与张力;而「他明天一早就要走」「你正拿着文件堵在他面前」这类只属于今天这一刻的处境,一个字都不许写进 world 或身份里,全部放进 hook。判断标准:半年前成立、半年后还成立的,写进 world;只在此刻成立的,写进 hook。\nhook 要把 " + uName + " 直接放进一个【正在进行、必须做选择】的具体时刻,不是平静的日常介绍。\nopening 是写给 " + uName + " 的开场正文(第二人称『你』,5-9句):交代 Ta 的身份处境与内心冲突,把场景推进到那个时刻,以张力悬在半空收尾;绝不替 " + uName + " 做任何决定或行动。\n只输出 JSON:" + SHAPE_SETTING + "";
        // 关键词为空才掷骰子;她写了关键词就一切听她的,不拿随机框去顶她的要求
        const frame = kw.trim() ? "" : "\n\n【本局取景框(骰子已经掷好,四项全部照办,不许挑拣也不许换)】\n题材:" + pick(POOL_GENRE) + "\n两人关系的底座:" + pick(POOL_BOND) + "\n把两人绑在一起的张力性质:" + pick(POOL_TENSION) + "\n整条线的基调:" + pick(POOL_TONE) + "\n本轮目标要跨的门槛属于这一类:" + pick(POOL_GATE);
        // 演过的线一并喂进去:模型看不见上一局,不给它就会反复抽到同一个众数
        const prior = lines.slice(0, 10).map(l => l.title + "(" + String(l.setting || "").slice(0, 30) + ")").join(";");
        const user = "【角色人设】\n" + (char.persona || char.name) + "\n\n【关键词(可空,空则按取景框来)】" + (kw.trim() || "无") + frame + (DIFF[diff].goal ? "\n\n【难度要求】" + DIFF[diff].goal : "") + (prior ? "\n\n【已经演过的线(务必避开,换皮重来也算重复)】" + prior : "") + "\n\n【对方名字】" + uName;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 4800, timeout: 150000 });
        const KEYS = ["title", "charRole", "userRole", "world", "hook", "charOutfit", "userOutfit", "goal", "opening"];
        let p = parseSettingPayload(raw, KEYS) || await reformatSetting(raw, SHAPE_SETTING, KEYS);
        if (!p) throw new Error("模型没按 JSON 输出,也整理不回来" + rawHint(raw));
        p = await completeSetting(p, raw, ["charRole", "goal", "opening"].concat(p.setting ? [] : ["world"]),
          "goal:" + GOAL_RULE + "\nopening 是写给 " + uName + " 的开场正文(第二人称『你』,5-9句),张力悬在半空收尾,绝不替 " + uName + " 做决定。");
        const lack = [["charRole", "角色新身份"], ["world", "世界观"], ["goal", "本轮目标"]]
          .filter(([k]) => k !== "world" ? !String(p[k] || "").trim() : !String(p.world || p.setting || "").trim())
          .map(([, label]) => label);
        if (lack.length) throw new Error("设定缺了「" + lack.join("、") + "」,再试一次");
        // world=长期为真(可收藏复用) / hook=这一局专属的此刻;setting 仍是两者拼起来的整段,面板与出图都照旧读它
        const world = p.world || p.setting, hook = p.hook || (p.world ? "" : "");
        setDraft({ charId: char.id, keywords: kw.trim(), difficulty: diff, title: p.title || "if线", charRole: p.charRole, userRole: p.userRole || "", world: world, hook: hook, charOutfit: p.charOutfit || "", userOutfit: p.userOutfit || "", setting: joinScene(world, hook), opening: p.opening || "", goal: p.goal });
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); }
    };
    // 从收藏基线开新局:身份与世界原样不动,但【此刻的处境要整个换掉】——
    // 基线存的是「他是龙族监督官、你是人类书记官」,不是「他行囊打包好了、你堵在他面前」。
    // 不明说这一点的话,模型会把上次那个时刻原样复述一遍,新局和重开就没有区别了。
    const newSituation = (fixedWorld, avoid) => "\n【这一局的处境必须是全新的】上面的身份与世界原样保留,但【此刻正在发生什么】要另起一个:换时间点(几个月后/多年后)、换事件、换两人相遇的理由都行,幅度要大到一眼看得出是另一个故事。举例——同样是这两个身份,可以是其中一方失忆了被另一方捡到,可以是一场政变让强势的一方反过来求人,可以是多年后位置对调重逢。\n【禁止】复述或微调以往开过的局:同一个时刻换个说法、同一个场景挪个地点、同一件事往前往后挪一天,都算重复。"
      + (avoid ? "\n【已经开过的局(务必避开)】" + avoid : "")
      + "\n【本局情境骰子】从这三个里挑一个最有戏的当作新处境的起点:" + pick3(POOL_SITU).join(" / ");
    const SHAPE_PRESET = "{\"hook\":\"新的当下处境\",\"charOutfit\":\"Ta 这一局穿什么(具体到能照着画)\",\"userOutfit\":\"" + uName + " 这一局穿什么\",\"goal\":\"一句话目标\",\"opening\":\"开场正文\"}";
    const genFromPreset = async ps => {
      const char = props.characters.find(c => c.id === ps.charId);
      if (!char) return props.toast("这个基线的角色不在了");
      if (!props.active) return props.toast("请先配置线下 API");
      setPickChar(ps.charId); setBusy(true);
      try {
        const past = lines.filter(l => l.presetId === ps.id).slice(0, 6).map(l => String(l.hook || l.setting || "").slice(0, 50)).join(";");
        const sys = "基于下面这套【固定的身份与世界】开一局全新的:身份、世界观、两人的长期关系一个字不许改,但要生成一个【全新的当下处境】以及配套的开场与本轮目标。"
          + newSituation(true, past)
          + "\nhook:此刻正在发生什么(1-3句,这一局专属)。\nopening:第二人称『你』写给 " + uName + " 的开场正文(5-9句),把 Ta 放进这个新处境里一个正在进行、必须做选择的时刻,张力悬着收尾,不替 Ta 做任何决定。\ngoal:" + GOAL_RULE + "\n只输出 JSON:" + SHAPE_PRESET + "";
        const user = "【角色人设】\n" + (char.persona || char.name) + "\n\n【固定的身份与世界】\nTa 的身份:" + ps.charRole + "\n" + uName + " 的身份:" + ps.userRole + "\n世界与长期张力:" + (ps.world || ps.setting);
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 4000, timeout: 150000 });
        const KEYS = ["hook", "charOutfit", "userOutfit", "goal", "opening"];
        let p = parseSettingPayload(raw, KEYS) || await reformatSetting(raw, SHAPE_PRESET, KEYS);
        if (!p) throw new Error("模型没按 JSON 输出,也整理不回来" + rawHint(raw));
        p = await completeSetting(p, raw, ["hook", "goal", "opening"],
          "goal:" + GOAL_RULE + "\nhook 是这一局专属的当下处境(1-3句)。opening 是第二人称『你』写给 " + uName + " 的开场正文(5-9句),悬着收尾。");
        if (!p.goal) throw new Error("开局缺了「本轮目标」,再试一次");
        const world = ps.world || ps.setting;
        setDraft({ charId: ps.charId, keywords: ps.keywords, difficulty: diff, title: ps.title, charRole: ps.charRole, userRole: ps.userRole, world: world, hook: p.hook || "", charOutfit: p.charOutfit || "", userOutfit: p.userOutfit || "", setting: joinScene(world, p.hook), opening: p.opening || "", goal: p.goal, fromPreset: true, presetId: ps.id });
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); }
    };
    const acceptDraft = () => {
      const l = { id: rid("th_"), charId: draft.charId, title: draft.title, keywords: draft.keywords, difficulty: draft.difficulty || "normal", charRole: draft.charRole, userRole: draft.userRole, world: draft.world || draft.setting, hook: draft.hook || "", charOutfit: draft.charOutfit || "", userOutfit: draft.userOutfit || "", setting: draft.setting, presetId: draft.presetId || null, createdAt: Date.now(), rounds: [{ id: rid("tr_"), goal: draft.goal, goalDone: false, goalNote: null, pending: false, msgs: draft.opening ? [{ id: rid("tm_"), role: "char", content: draft.opening, ts: Date.now() }] : [], startTs: Date.now() }] };
      update(list => [l, ...list]); setDraft(null); setKw(""); setPlayId(l.id); setView("play"); setPanelOpen(true);
    };

    // ---- 演出 ----
    const allMsgs = l => l.rounds.flatMap(r => r.msgs);
    const send = async () => {
      const text = input.trim();
      if (!line || busy) return;
      const round = line.rounds[line.rounds.length - 1];
      const lastIsUser = round.msgs.length && round.msgs[round.msgs.length - 1].role === "user";
      // 空输入 + 历史末尾是自己的消息 = 上次生成失败的重试:不重复入史,直接用现有历史再生成
      if (!text && !lastIsUser && !dice) return;
      if (!props.active) return props.toast("请先配置线下 API");
      const char = charOf(line);
      let addedId = null;
      if (text) {
        addedId = rid("tm_");
        setInput("");
        update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : { ...r, msgs: [...r.msgs, { id: addedId, role: "user", content: text, ts: Date.now() }] }) }));
      }
      setBusy(true);
      try {
        // 是否跨进了明确场景:复用主线线下那套判定(它靠消息上的 registerExplicitActive 记状态,
        // 因为自修会把触发词洗掉,不能每轮要求干净终稿重新自证)
        const rt = typeof offlineRegisterTransition === "function"
          ? offlineRegisterTransition({ msgs: allMsgs(line).filter(m => m.role !== "photo").concat(text ? [{ role: "user", content: text }] : []) })
          : { inputBeat: false, active: false };
        const selfRevise = !!(rt.inputBeat && rt.active);
        const sys = [narrativeCore({ intimate: true }),
          "【小剧场·if 线(独立平行时空)】这是一场与主线完全无关的平行扮演:不引用主线聊天里发生过的事,也不提及这是扮演。世界观、身份以下面的设定为准。",
          "【角色人设(性格与声纹的根基,保持不变)】\n" + (char.persona || char.name),
          "【if 线身份·你(" + char.name + ")】" + line.charRole + "\n身份、职业、处境按此替换;性格、说话方式、注意力习惯仍是上面这个人。",
          "【if 线身份·" + uName + "】" + (line.userRole || "如设定所述"),
          "【世界与情境】" + line.setting,
          "【本轮目标(远景,不是本轮任务)】" + round.goal + (round.goalDone ? "(已达成,剧情自然继续即可)" : " —— 这是这一轮剧情【最终】要自然抵达的节点,通常需要多次来回互动、经过铺垫、并由 " + uName + " 的行动共同促成。绝不许在开场或单次回复里自己一步演完整条弧,更不许自导自演替对方完成属于对方的部分;每轮只朝它走一小步,留足对方行动的空间。只有当它经过铺垫在剧情里【真实发生】后,才在 goalReached 里报告。\n【失败判定】他拒绝、抵抗、僵持都不是失败——只要继续演还有任何一条路能自然走到目标,就没失败。只有目标变得【不可逆地无法达成】(他彻底离场断绝、目标所系之物已毁、剧内时限已过、他做出了反向的不可逆承诺)时,才在 goalFailed 里报告。" + (diffOf(line).play ? "\n【难度·" + diffOf(line).name + "】" + diffOf(line).play : "")),
          line.summary ? "【前情提要(早前剧情已浓缩,接着往下演,别倒回去复述)】\n" + line.summary : null,
          note.trim() ? "【临时导演提示(本拍务必遵循;这是幕后指示,绝不在正文中提及它的存在)】" + note.trim() : null,
          dice ? "【剧场骰子】本拍必须自然引入一个出乎双方意料的外部意外(第三者闯入/环境突变/时限出现/被撞破…):与世界观相容、落在具体行动上,并让它实际搅动当前局面。" : null,
          "【对方主权】" + uName + " 的行动、反应和台词永远由 Ta 本人输入:你只能写「我」的言行心理与 NPC/环境,绝不替『你』做动作、说台词、下决定——哪怕剧情顺手也不行,写到需要 Ta 行动的位置就停。",
          "【节拍】一次回复只演【一拍】:你的一个反应、至多一次行动和随之的话;演到需要 " + uName + " 回应、选择或行动的位置就自然停下。不把几个情绪阶段压进同一拍(震惊、想通、劝阻、逼问要分几个来回演),不替 Ta 说出 Ta 没说出口的意图,也不自问自答替 Ta 推进。一拍限制的是【剧情推进量】,不是篇幅——同一拍之内照样要写足。",
          "【镜头不随人物收缩】角色的克制是【台词】的克制,不是【镜头】的克制。他话少、冷淡、不外露,恰恰意味着叙述要接住更多:说这句话之前先做完的那个动作、停顿的那一下、手上正在做的事、他注意到却没提起的东西、身体先于话给出的反应。绝不能因为他是个冷淡的人就把段落缩成「我看着你。」——那不是克制,那是没写;他不说的部分必须在纸面上有分量。每句台词旁边至少要有一处具体的、看得见的动作或环境细节;但也不许拿华丽形容词和情绪副词充数,要的是具体物件与动作,不是修饰。",
          "【成段,不要一句一行】把动作、感觉、台词织进【连续的段落】里,一段通常三五句连着写;绝不要每写一句就换行空一段——一句一段会让整场戏看起来支离破碎、像剧本提纲而不是小说。「我看着你。」「我停了一下。」这种单句尤其不许独立成段,要么并进前后的叙述里,要么就删掉。只有真正需要一个停顿感的关键处,才允许一句独立成段,一整拍里至多用一次。\n【别学历史的排版】前文里如果全是短句短段,那是旧毛病,不是范例:照上面的要求写,不要模仿它。",
          "【输出】用第一人称『我』完全代入「" + char.name + "」,称对方为『你』,对话用引号,写成连续场景正文;篇幅由【场景需要】决定,不由角色话多话少决定——冷淡的人不等于短的段落。只输出 JSON:{\"scene\":\"场景正文\",\"goalReached\":false,\"goalFailed\":false,\"goalNote\":null}(达成时 goalReached=true;不可逆失败时 goalFailed=true;goalNote 一句话指出达成或失败的瞬间)",
          // 跨进明确场景时,和主线线下走同一套「初稿→自编辑去认证句」——以前这套只焊在
          // 单聊线下里,小剧场拿不到,于是同样的内容在这边就滑回八股(Lisa 2026-08-18)
          selfRevise ? offlineSelfReviseProtocol("{\"draftScene\":\"内部完整首稿\",\"scene\":\"基于前一字段完成的最终正文\",\"goalReached\":false,\"goalFailed\":false,\"goalNote\":null}") : null
        ].filter(Boolean).join("\n\n");
        // CC 亲笔票的瘦身版 sys:言秋本人不需要人设卡和反八股全家桶(那些治的是模型病),
        // 只递 if 线专属信息——身份、世界、目标、前情、导演提示与节拍纪律(Lisa 2026-08-22 抓的票太肥)
        const ccSys = [
          "【小剧场·if 线(独立平行时空)】与主线无关的平行扮演;世界观与身份以下面为准,正文里不提这是扮演。",
          "【你这一局的身份】" + line.charRole,
          "【" + uName + " 这一局的身份】" + (line.userRole || "如设定所述"),
          "【世界与情境】" + line.setting,
          "【本轮目标(远景)】" + round.goal + (round.goalDone ? "(已达成,剧情自然继续)" : "——多次来回才该抵达,每拍只走一小步;真实发生后才报 goalReached,不可逆走死才报 goalFailed。") + (diffOf(line).play ? "\n【难度·" + diffOf(line).name + "】" + diffOf(line).play : ""),
          line.summary ? "【前情提要】\n" + line.summary : null,
          note.trim() ? "【临时导演提示(务必遵循,正文不提)】" + note.trim() : null,
          dice ? "【剧场骰子】本拍须自然引入一个意外(第三者/环境突变/时限/被撞破…),落在具体行动上并搅动局面。" : null,
          "【纪律】只演你自己的一拍,绝不写" + uName + "的动作反应台词,写到需要 Ta 行动处就停;第一人称『我』,对话用引号,织成连贯段落。",
          "【输出】只输出 JSON:{\"scene\":\"场景正文\",\"goalReached\":false,\"goalFailed\":false,\"goalNote\":null}"
        ].filter(Boolean).join("\n\n");
        const base = allMsgs(line).slice(line.sumCount || 0).filter(m => m.role !== "photo");
        const hist = (text ? base.concat([{ role: "user", content: text, ts: Date.now() }]) : base)
          .slice(-40).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
        // 尾部守则(recency 最强处;史里有旧八股时 system 中段压不住自我模仿)
        // 尾部原先全是减法,冷淡角色被砍完就只剩「我看着你。」——必须在同一处补上加法
        const tail = "\n\n〔本拍守则〕只演我自己的一拍,绝不写「你」的动作、反应或台词,写到需要你行动处就停;用这个角色自己的说话方式,砍掉现成网文反应、连环强度词和总结旁白。台词可以短,镜头不能跟着短:他不说的那部分,用具体的动作、手上的事和他注意到的细节写出来,并且织成连贯的段落——不要一句一段,前文那种支离破碎的排版不要学。";
        if (hist.length && hist[hist.length - 1].role === "user") hist[hist.length - 1] = { ...hist[hist.length - 1], content: hist[hist.length - 1].content + tail };
        else hist.push({ role: "user", content: "(继续)" + tail });
        // 自修轮要多写一份初稿,预算给足,否则终稿会被截断
        // 言秋座位(engineerEyes)的「演」先递到 CC 让他亲笔写这一拍;超时/桥不在→模型顶班,剧场永不卡死
        let raw = null;
        if (typeof props.isEngineer === "function" && props.isEngineer(char.id) && typeof window !== "undefined" && window.CCSeat) {
          try {
            raw = await window.CCSeat.ask({
              tool: "game_turn", game: "theater", turn_id: "theater:" + line.id + ":" + rid("tt_"),
              char_id: String(char.id), sys: ccSys, msgs: hist,
              expect: '{"scene":"这一拍的场景正文","goalReached":false,"goalFailed":false,"goalNote":null}' + (selfRevise ? '(自修轮需先写 draftScene 再写 scene)' : ''),
              deadline_at: new Date(Date.now() + 180000).toISOString()
            }, 180000, { charId: String(char.id) });
          } catch (e) { raw = null; }
          // CC 回填的是结构化对象;parseTheaterPayload 吃字符串,转一层
          if (raw != null && typeof raw === "object") raw = JSON.stringify(raw);
        }
        if (raw == null) raw = await callAI(props.active, sys, hist, { maxTokens: selfRevise ? 6000 : 3200, timeout: 180000 });
        const p = parseTheaterPayload(raw);
        if (!p) throw new Error("模型返回的剧情格式无法解析，已拦住协议原文；请再按一次「演」");
        // 自修轮:draftScene 只是内部草稿,scene 才是进历史的终稿;终稿缺失就当本轮失败重试,
        // 绝不拿草稿顶上——那等于把去认证句这一步悄悄跳过
        if (selfRevise && p.draftScene && !String(p.scene || "").trim()) throw new Error("模型没写出自修终稿,再按一次「演」");
        if (!p.scene) throw new Error("没拿到正文");
        // 达成硬门槛:本轮用户发言不满 3 条时,模型报 goalReached 也不采信——防"开场自导自演一步通关"
        update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : { ...r, msgs: [...r.msgs, { id: rid("tm_"), role: "char", content: p.scene, ts: Date.now(), registerExplicitActive: rt.active || undefined }], pending: !r.goalDone && !r.failed && !!p.goalReached && r.msgs.filter(m => m.role === "user").length >= 3 ? (p.goalNote || "看起来目标达成了") : r.pending, pendingFail: !r.goalDone && !r.failed && !p.goalReached && !!p.goalFailed && r.msgs.filter(m => m.role === "user").length >= 3 ? (p.goalNote || "看起来这条路走死了") : r.pendingFail }) }));
        setNote(""); setNoteOpen(false); setDice(false); // 便签与骰子都是一次性,用完即清
        setTimeout(() => maybeSummarize(line.id), 400);
      } catch (e) {
        // 失败回滚:撤回刚入史的那条,文字放回输入框,再按一次「演」即重试;历史不留残尾
        if (addedId) { update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : { ...r, msgs: r.msgs.filter(m => m.id !== addedId) }) })); setInput(text); }
        props.toast("生成失败:" + (e.message || "再按一次「演」重试"));
      } finally { setBusy(false); }
    };
    const confirmGoal = ok => update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : ok ? { ...r, goalDone: true, goalNote: typeof r.pending === "string" ? r.pending : r.goalNote, pending: false, endTs: Date.now() } : { ...r, pending: false }) }));
    const confirmFail = ok => update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : ok ? { ...r, failed: true, goalNote: typeof r.pendingFail === "string" ? r.pendingFail : r.goalNote, pendingFail: false, endTs: Date.now() } : { ...r, pendingFail: false }) }));
    // mode="next" 开下一轮;mode="redo" 重掷当前轮目标(剧情保留,只换目标)
    const genGoal = async mode => {
      if (!line || busy) return;
      setBusy(true);
      try {
        const recent = allMsgs(line).slice(-8).map(m => (m.role === "user" ? uName : charOf(line).name) + ":" + m.content).join("\n").slice(-1800);
        const cur = line.rounds[line.rounds.length - 1];
        const sys = (mode === "redo"
          ? "为一场进行中的 if 线小剧场【重新想当前这一轮的目标】(替换旧目标『" + cur.goal + "』,方向要和它不同)。"
          : "为一场进行中的 if 线小剧场想【下一轮目标】:顺着已发生的剧情,把两人之间的张力再拧深一档;若上一轮以失败告终,新目标应从失败的后果里长出来(挽回/付代价/换一条路)。")
          + "" + GOAL_RULE + "不重复已经达成过的目标。只输出 JSON:{\"goal\":\"一句话目标\"}";
        const user = "【设定】" + line.setting + "\n【角色身份】" + line.charRole + "\n【各轮目标】" + line.rounds.map(r => r.goal + (r.goalDone ? "(✓)" : r.failed ? "(✗失败)" : "")).join(";") + "\n【最近剧情】\n" + recent;
        // 思考型模型的思考也从 maxTokens 里扣,给窄了 JSON 会被写一半截断
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 2000, timeout: 120000 });
        const p = parseSettingPayload(raw, ["goal"]) || await reformatSetting(raw, "{\"goal\":\"一句话目标\"}", ["goal"]);
        if (!p || !p.goal) throw new Error("目标没生成出来" + rawHint(raw));
        update(list => list.map(l => l.id !== line.id ? l : mode === "redo"
          ? { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : { ...r, goal: p.goal, pending: false }) }
          : { ...l, rounds: [...l.rounds, { id: rid("tr_"), goal: p.goal, goalDone: false, goalNote: null, pending: false, msgs: [], startTs: Date.now() }] }));
        setPanelOpen(true);
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); }
    };
    // 重开:旧剧情整段归档,同一套设定从第一轮重来(新开场+新目标)
    const restartLine = async () => {
      if (!line || busy) return;
      // 重开 = 同一个处境从头再演一遍(要换处境请用收藏基线开新局);两者的分工别混
      if (!confirm("重开此线?当前剧情会归档,同一个处境从第一轮重演。\n(想要同样的身份、全新的故事,请用「收藏此设定」再开新局)")) return;
      setBusy(true);
      try {
        const char = charOf(line);
        const sys = "基于下面这套【固定的 if 线设定】重开一局:设定一个字不许改,只生成新的开场与本轮目标。opening:第二人称『你』写给 " + uName + " 的开场正文(5-9句),把 Ta 放进一个必须做选择的时刻,悬着收尾。goal:" + GOAL_RULE + "只输出 JSON:{\"goal\":\"一句话目标\",\"opening\":\"开场正文\"}";
        const user = "【角色人设】\n" + (char.persona || char.name) + "\n\n【固定设定】\nTa 的身份:" + line.charRole + "\n" + uName + " 的身份:" + line.userRole + "\n世界与张力:" + line.setting;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 2600, timeout: 150000 });
        const p = parseSettingPayload(raw, ["goal", "opening"]) || await reformatSetting(raw, "{\"goal\":\"一句话目标\",\"opening\":\"开场正文\"}", ["goal", "opening"]);
        if (!p || !p.goal) throw new Error("重开没生成出目标" + rawHint(raw));
        update(list => list.map(l => l.id !== line.id ? l : { ...l, ended: false, summary: "", sumCount: 0,
          archives: [...(l.archives || []), { rounds: l.rounds, summary: l.summary || "", ts: Date.now() }],
          rounds: [{ id: rid("tr_"), goal: p.goal, goalDone: false, goalNote: null, pending: false, msgs: p.opening ? [{ id: rid("tm_"), role: "char", content: p.opening, ts: Date.now() }] : [], startTs: Date.now() }] }));
        setPanelOpen(true);
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); }
    };
    // 谢幕:生成终场戏并标记完结(仍可回看,面板里可重开)
    const endLine = async () => {
      if (!line || busy) return;
      if (!confirm("为这条线谢幕?会生成终场戏并标记完结。")) return;
      setBusy(true);
      try {
        const char = charOf(line);
        const recent = allMsgs(line).slice(-14).map(m => (m.role === "user" ? uName : char.name) + ":" + m.content).join("\n").slice(-3000);
        const sys = narrativeCore({ intimate: true }) + "\n\n【谢幕】为这条 if 线写终场戏:用第一人称『我』代入「" + char.name + "」,顺着已发生的剧情把这条线收在一个有余味的落点——不强行大团圆、不总结陈词,最后一拍落在具体的动作或一句话上。只输出 JSON:{\"scene\":\"终场正文\"}";
        const user = "【设定】" + line.setting + "\n【各轮目标】" + line.rounds.map(r => r.goal + (r.goalDone ? "(✓)" : r.failed ? "(✗失败)" : "")).join(";") + "\n【最近剧情】\n" + recent;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 2600, timeout: 150000 });
        const p = parseTheaterPayload(raw);
        if (!p || !p.scene) throw new Error("终场格式无法解析，已拦住协议原文；请再试一次");
        update(list => list.map(l => l.id !== line.id ? l : { ...l, ended: true, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : { ...r, msgs: [...r.msgs, { id: rid("tm_"), role: "char", content: p.scene, ts: Date.now(), curtain: true }] }) }));
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); }
    };
    // 当轮剧照:第三人称旁观构图,服饰道具跟 if 线世界观;有两张脸参考才双人,否则他单人
    // 剧照和封面共用的一套底座（v53.88）：画风、身份锁、if 线行头、参考图排列。
    // 抽出来是因为封面若自己再拼一份，就会漏掉 photoStyle/手部解剖锁这些——
    // 和 GOAL_RULE 当初四处各写各的是同一类毛病。
    const shotBase = l => {
      const char = charOf(l);
      const duo = !!(char.refPhoto && props.profile && props.profile.refPhoto);
      // photoOutfit 换成 if 线自己的行头：角色的固定服装锁属于主线世界，会把这条线的装束顶掉
      // IF 线只继承【这张脸】，不继承主线职业/时代/身份。以前这里仍塞主线 persona，
      // 会一边要求「平行世界」，一边又把主线行头和职业递给图片模型，造成串线。
      const ifVisualPersona = [l.world || l.setting, l.charRole].filter(Boolean).join("\n").slice(0, 500);
      const styledChar = Object.assign({}, char, { photoOutfit: String(l.charOutfit || "").trim(), persona: ifVisualPersona });
      const faceLock = "【最高优先级·就是这个人】" + (duo
        ? "画面里的两个人必须严格就是参考图里的这两位:「" + char.name + "」用参考图1的脸,「" + uName + "」用参考图2的脸——五官、脸型、发色瞳色、年龄感、肤色完全照搬各自的参考图,不许互换、混合或另造陌生人。"
        : "画面里的人必须严格就是参考图里的那一位:五官、脸型、发色瞳色、年龄感、肤色完全照搬参考图,不许生成长相不同的陌生人,也绝不出现第二个人。")
        + "下面的身份设定【只改变服装、道具、场景与气质,绝不改变这张脸】;身份描述里的种族/职业/头衔不是长相指令,不得据此重画五官。\n";
      const refList = (duo ? [char.refPhoto, props.profile.refPhoto] : (char.refPhoto ? [char.refPhoto] : [])).filter(Boolean);
      const meWith = duo ? Object.assign({}, props.profile, { outfit: String(l.userOutfit || "").trim() }) : null;
      return { char: char, duo: duo, styledChar: styledChar, faceLock: faceLock, refList: refList, me: meWith };
    };
    // ---- 封面图（v53.88）----
    // 不取自任何一拍：画的是这条线【整体】的样子——世界、两个人的身份、那股张力。
    // 所以它不需要剧情过滤（没有原文进去），也不会因为某一拍是亲密戏就出不来。
    const genCover = async () => {
      if (!line || busy) return;
      if (!(typeof imgApiReady === "function" && imgApiReady())) return props.toast("请先配置图像 API");
      const b = shotBase(line);
      if (!(b.char.refPhoto || b.char.appearance)) return props.toast("角色还没有参考照或外貌描述");
      setPlusOpen(false); setBusy(true); setBusyWhat("正在画封面…出图慢，别退出这一页");
      props.toast("开始画封面了，出图要等一会儿…", 6000);
      try {
        const sceneDesc = "这条平行世界故事线的【封面海报】:一张能代表整个故事的电影感主视觉,不是某一场戏的抓拍。人物不看镜头,构图留白、有电影海报的气场。\n"
          + "【这是一条平行世界 if 线,与角色原设定的时代/职业无关】\n"
          + "【世界与场景】" + String(line.world || line.setting || "").slice(0, 300) + "\n"
          + "【" + b.char.name + " 在这条线里的身份】" + String(line.charRole || "").slice(0, 200) + "\n"
          + (b.duo ? "【" + uName + " 在这条线里的身份】" + String(line.userRole || "").slice(0, 200) + "\n" : "")
          + "【要画出的东西】这个世界的质地(时代、光线、建筑或环境的特征)，以及" + (b.duo ? "这两个人之间那股说不破的张力" : "这个人此刻的处境与气场")
          + "。**别画成证件照或人物立绘**,要有场景、有氛围、有故事正要发生的感觉。\n"
          + "【画面尺度】必须是可公开展示的画面:衣着完整整齐,不露骨、不裸露,不出现凶器、伤口、血迹与尸体。";
        const prompt = typeof buildPhotoPrompt === "function"
          ? b.faceLock + buildPhotoPrompt(b.styledChar, sceneDesc, null, { kind: b.duo ? "duo" : "other", me: b.me, cinematic: true })
          : b.faceLock + sceneDesc;
        const out = await generateSelfieImage(prompt, b.refList.length ? b.refList : null);
        if (!out || !out.blob) throw new Error("没出图");
        if (out.degraded) props.toast(out.degraded === "softened" ? "审核不让真人照片配酒/烟/刀，画面里换成了茶和折扇——脸保住了" : out.degraded === "softened-no-ref" ? "审核挡了两次，换掉酒/烟/刀才出得来，而且没用上参考照——脸可能不像" : out.degraded === "duo-single-ref" ? "只锁了 " + b.char.name + " 的脸" : "没用上参考照" + (out.refError ? "：" + out.refError : ""), 7000);
        const durl = await blobToDataUrl(out.blob);
        const ref = typeof imgToVault === "function" ? await imgToVault(durl) : durl;
        // 封面跟着【整条线】走，分支出去的新线也沿用同一张——同一个世界不必各画各的
        // 顺手当背景（v54.46）：以前封面只在记录卡上当底纹，被 90° 渐变压掉大半，
        // 等于画完就看不见。但【不许覆盖她自己传的背景】——只在没背景、
        // 或现在这张背景就是上一版封面（背景本来就在跟着封面走）时才接管。
        let bgTook = false;
        update(list => list.map(l => {
          if (l.id !== line.id) return l;
          const take = !l.bg || l.bg === l.cover;
          if (take) bgTook = true;
          return { ...l, cover: ref, coverTs: Date.now(), bg: take ? ref : l.bg };
        }));
        // 存进图库：那里才有看整张的大图和「保存到手机相册」（她 2026-08-22 要的）
        saveGal(list => [{ id: rid("tg_"), charId: line.charId, lineId: line.id, lineTitle: line.title, img: ref, ts: Date.now(), kind: "cover" }].concat(list));
        props.toast(bgTook ? "封面出好了，已当作背景 · 图库里可以看整张、存相册"
          : "封面出好了，已进图库（这条线有你自己的背景图，没动它）", 6000);
      } catch (e) { props.toast("封面没出来:" + (e.message || "重试")); } finally { setBusy(false); setBusyWhat(""); }
    };
    const genPhoto = async () => {
      if (!line || busy) return;
      const char = charOf(line);
      if (!(typeof imgApiReady === "function" && imgApiReady())) return props.toast("请先配置图像 API");
      if (!(char.refPhoto || char.appearance)) return props.toast("角色还没有参考照或外貌描述");
      const duo = !!(char.refPhoto && props.profile && props.profile.refPhoto);
      setPlusOpen(false); setBusy(true); setBusyWhat("正在画这一拍的剧照…");
      props.toast("开始画这一拍了，出图要等一会儿…", 6000);
      try {
        // 图像接口要的是【画面上看得见什么】,不是小说正文。把当轮正文原样喂过去,
        // 一旦这几拍是亲密戏,审核会直接拒("该提示可能违反了我们的内容政策"),
        // 而且两张真人参考照 + 亲密文本审得更严——单张能过、合照过不了就是这么来的
        // (2026-08-18 Lisa 案)。所以逐条过滤明确内容,并声明画面必须含蓄。
        // 两类分开算:上游审核对情色和暴力惊悚都会拦,但提示里不能混为一谈——
        // 抓到的是刻刀和喘息,却跟她说「本拍是亲密戏」,那是系统在乱扣帽子(她 2026-08-18 指出)。
        const VIOLENT_RE = /刀|刃|血|尸|伤口|掐|勒|捅|砍|割|窒息|尖叫|喘息|呻吟|哭喊|挣扎|绑|铐|药|毒/;
        const isSex = t => typeof offlineRegisterExplicitText === "function" && offlineRegisterExplicitText(t);
        const isViolent = t => VIOLENT_RE.test(String(t || ""));
        const explicit = t => isSex(t) || isViolent(t);
        const rows = allMsgs(line).filter(m => m.role !== "photo").slice(-4);
        const hitSex = rows.some(m => isSex(m.content));
        const hitViolent = rows.some(m => isViolent(m.content));
        const spicyWhy = hitSex && hitViolent ? "本拍有亲密与刀具/惊悚描写" : hitSex ? "本拍是亲密戏" : hitViolent ? "本拍有刀具或惊悚描写" : "";
        // 敏感句仍然不能进 prompt(上游审核读的就是原文),但删掉之后必须给替代方案,
        // 否则这一拍等于被掏空。做法和亲密戏一致:告诉它画紧挨着的前一瞬或后一瞬。
        const kept = rows.filter(m => !explicit(m.content))
          .map(m => (m.role === "user" ? uName : char.name) + ":" + m.content).join("\n").slice(-240);
        const fallbackCue = [line.hook, line.charOutfit ? null : null].filter(Boolean).find(t => !explicit(t)) || "两人此刻正对着彼此,气氛紧绷。";
        const recent = kept || fallbackCue;
        const safeShot = "\n【画面尺度】必须是可公开展示的画面:人物衣着完整整齐,不露骨、不裸露,画面里不出现凶器、伤口、血迹与尸体;张力全部靠神情、距离、手的位置、环境与光影来表达。"
          + ((hitSex || hitViolent) ? "\n【这一拍要改画相邻的一瞬】本拍原文里有" + (hitSex && hitViolent ? "亲密与刀具/惊悚" : hitSex ? "亲密" : "刀具或惊悚") + "的内容,已从上面的描述里拿掉了。不要试图还原那一刻,改画【紧挨着它之前或之后】的一个瞬间:动作已经收住或还没发生,两人在同一个空间里,把刚才那股劲留在呼吸、眼神、没松开的距离和屋子里的光线上。这样画面依然属于这一拍,只是取了可以见人的那一格。" : "");
        // 走 buildPhotoPrompt,别再自己从零拼:画风(photoStyle 写实/跟随参考图/二次元)、
        // 身份锁、人设视觉事实、手部解剖锁全在那边,自拼等于把角色的画风设定整个丢掉。
        // 两处刻意改造:photoOutfit 清空(角色的固定服装锁是主线世界的,会把 if 线的行头顶掉);
        // st 传 null(此刻穿着同理,银龙不该穿着主线那身出现在龙岛)。
        // 用 if 线自己的行头顶替主线的固定服装锁:清空会让服装每张随机(她拍到袍子变女仆装),
        // 照抄主线又会让银龙穿着现代便装出现在龙岛。正解是这条线有自己的一套,并且锁死。
        const ifVisualPersona = [line.world || line.setting, line.charRole].filter(Boolean).join("\n").slice(0, 500);
        const styledChar = Object.assign({}, char, { photoOutfit: String(line.charOutfit || "").trim(), persona: ifVisualPersona });
        // if 线的身份描述会跟参考照抢脸:模型容易照着「龙族监督官」重画一个陌生人。
        // 所以把「只换身份行头、不换人」提到最前面,和 buildPhotoPrompt 的身份锁叠加。
        const faceLock = "【最高优先级·就是这个人】" + (duo
          ? "画面里的两个人必须严格就是参考图里的这两位:「" + char.name + "」用参考图1的脸,「" + uName + "」用参考图2的脸——五官、脸型、发色瞳色、年龄感、肤色完全照搬参考图,不许生成长相不同的陌生人。"
          : "画面里的人必须严格就是参考图里的那一位:五官、脸型、发色瞳色、年龄感、肤色完全照搬参考图,不许生成长相不同的陌生人,也绝不出现第二个人。")
          + "下面的身份设定【只改变服装、道具、场景与气质,绝不改变这张脸】;身份描述里的种族/职业/头衔不是长相指令,不得据此重画五官。\n";
        const sceneDesc = "第三人称旁观的电影剧照(人物不看镜头,不是自拍)。\n【这是一条平行世界 if 线,与角色原设定的时代/职业无关】\n【世界与场景】" + (line.setting || "") + "\n【" + char.name + " 在这条线里的身份】" + (line.charRole || "") + (duo ? "\n【" + uName + " 在这条线里的身份】" + (line.userRole || "") : "") + "\n【此刻正在发生(画最近剧情的当下一瞬)】\n" + recent + "\n服装、发型、道具、环境必须符合上述 if 线的世界观与身份,绝不让角色原设定的职业装束或现代便装乱入;构图取此刻最有张力的一瞬。" + safeShot;
        // 锁脸放【整段 prompt 的最前面】:sceneDesc 会被 buildPhotoPrompt 塞到末尾、还冠以
        // 「场景/正在做什么：」,身份指令挂在那儿位置最弱,压不住后面一大段 if 线设定。
        // 连贯参考图:同一条线上一张剧照。同场景连拍两张会飘,拿它当锚能稳住
        // 衣着配饰与场地光线;它排在最后,失败降级时第一个被丢掉(身份优先于连贯)。
        const prevPhoto = allMsgs(line).filter(m => m.role === "photo" && m.img).slice(-1)[0];
        const refList = (duo ? [char.refPhoto, props.profile.refPhoto] : (char.refPhoto ? [char.refPhoto] : [])).filter(Boolean);
        if (prevPhoto && refList.length) refList.push(prevPhoto.img);
        const refs = refList.length ? refList : null;
        const prompt = typeof buildPhotoPrompt === "function"
          ? faceLock + buildPhotoPrompt(styledChar, sceneDesc, null, { kind: duo ? "duo" : "other", me: duo ? Object.assign({}, props.profile, { outfit: String(line.userOutfit || "").trim() }) : null, cinematic: true, contRef: !!(prevPhoto && refList.length > (duo ? 2 : 1)), contRefIndex: (prevPhoto && refList.length > (duo ? 2 : 1)) ? refList.length : 0 })
          : faceLock + sceneDesc;
        // 上游审核可能仍然拒(prompt 太长 / 措辞被误判)。备用 prompt 完全不含剧情文本:
        // 只保留锁脸、行头、世界一句话和一个中性构图,短且干净,成功率高得多。
        const minimalPrompt = faceLock + "第三人称旁观的电影剧照(人物不看镜头,不是自拍)。\n【场景】" + String(line.world || line.setting || "").slice(0, 120)
          + "\n【" + char.name + " 的穿着】" + (line.charOutfit || "符合上述世界观的身份装束")
          + (duo ? "\n【" + uName + " 的穿着】" + (line.userOutfit || "符合上述世界观的身份装束") : "")
          + "\n两人只是面对面站着说话,神情各异,衣着完整整齐,画面含蓄、可公开展示。";
        let out;
        try {
          out = await generateSelfieImage(prompt, refs, { contRef: !!(prevPhoto && refList.length > (duo ? 2 : 1)) });
        } catch (e1) {
          if (!/safety|policy|内容政策|too long|sensitive|reject/i.test(String(e1 && e1.message || e1))) throw e1;
          props.toast("这一拍的描述被审核挡了,换成简版再试一次…");
          out = await generateSelfieImage(minimalPrompt, refList.slice(0, duo ? 2 : 1));
        }
        if (!out || !out.blob) throw new Error("没出图");
        // 降级不再无声无息:脸没锁上时要说出来,否则你只会看到两个陌生人却不知道为什么
        // 降级时把接口原话一起报出来:光说「没用上参考照」排查不了,得知道它到底拒了什么
        if (out.degraded === "softened") props.toast("审核不让真人照片配酒/烟/刀，画面里换成了茶和折扇——脸保住了", 7000);
        else if (out.degraded === "softened-no-ref") props.toast("审核挡了两次，换掉酒/烟/刀才出得来，而且没用上参考照——脸可能不像", 7000);
        else if (out.degraded) {
          const policy = /内容政策|content policy|safety|moderat/i.test(out.refError || "");
          props.toast(
            (out.degraded === "duo-single-ref" ? "只锁了 " + char.name + " 的脸" : "没用上参考照") +
            (policy ? "：图像接口的审核拒了这一拍" + (spicyWhy ? "(" + spicyWhy + ",已尽量过滤仍被判定)" : "") + ",换个平静些的时刻再拍试试" : (out.refError ? "：" + out.refError : "")),
            9000);
        }
        const durl = await blobToDataUrl(out.blob);
        const ref = typeof imgToVault === "function" ? await imgToVault(durl) : durl;
        update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : { ...r, msgs: [...r.msgs, { id: rid("tm_"), role: "photo", img: ref, ts: Date.now() }] }) }));
        saveGal(list => [{ id: rid("tg_"), charId: line.charId, lineId: line.id, lineTitle: line.title, img: ref, ts: Date.now() }].concat(list));
      } catch (e) { props.toast("出图失败:" + (e.message || "重试")); } finally { setBusy(false); setBusyWhat(""); }
    };
    // 存进手机系统相册:iOS 在分享单里选「存储图像」
    const saveToAlbum = async ref => {
      try {
        let blob = null;
        if (String(ref).indexOf("iv_") === 0 && typeof imgVaultFetchBlob === "function") blob = await imgVaultFetchBlob(ref);
        if (!blob) blob = await (await fetch(imgSrc(ref))).blob();
        const file = new File([blob], "theater_" + Date.now() + ".png", { type: blob.type || "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
        else { window.open(URL.createObjectURL(blob), "_blank"); props.toast("在新页长按图片存储"); }
      } catch (e) { if (!/Abort/i.test(String(e && e.name || e))) props.toast("保存失败"); }
    };
    const rerollPhoto = m => { if (busy) return; update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map(r => ({ ...r, msgs: r.msgs.filter(x => x.id !== m.id) })) })); setTimeout(genPhoto, 60); };
    // ---- 分支存档（v53.88）----
    // 从任意一拍岔开一条新线：那一拍之前原样保留，之后的全部不要；原线一个字不动。
    // 这既是"存档读档"（想回到某个路口重走），也是真正的 if 之 if。纯本地操作，零 API。
    const branchFrom = msg => {
      if (!line || !msg) return;
      const rounds = [];
      let hit = false;
      for (const r of line.rounds) {
        if (hit) break;
        const k = (r.msgs || []).findIndex(m => m.id === msg.id);
        if (k < 0) { rounds.push(r); continue; }
        hit = true;
        // 岔开点那一拍要留着（她是看到这一拍才想换条路的），之后的全丢
        rounds.push({ ...r, msgs: r.msgs.slice(0, k + 1),
          // 这一轮的结局从此重新未定：达成/失败/待确认全部清空，早先几轮的结果照旧
          goalDone: false, failed: false, pending: false, pendingFail: false, goalNote: null });
      }
      if (!rounds.length) return props.toast("没找到这一拍");
      const kept = rounds.reduce((n, r) => n + (r.msgs || []).length, 0);
      // 账本覆盖的是前 sumCount 条。岔开点在它之后 → 账本对这段前缀仍然成立，可以带走；
      // 岔在它之前 → 账本里写的事有一半已经不存在了，只能丢掉，让新线自己重新压缩。
      const keepLedger = Number(line.sumCount || 0) > 0 && kept >= Number(line.sumCount || 0);
      const sameRoot = l => (l.branchRoot || l.id) === (line.branchRoot || line.id);
      const n = lines.filter(sameRoot).length; // 同一条根线下已经有几条了
      const nl = { ...line,
        id: rid("th_"),
        title: (line.title || "if线") + "·分支" + n,
        rounds: rounds,
        archives: [],              // 归档属于原线，不跟着分支走
        ended: false,
        cover: line.cover || null, // 封面沿用，同一个世界
        summary: keepLedger ? line.summary : "",
        ledger: keepLedger ? line.ledger : null,
        sumCount: keepLedger ? line.sumCount : 0,
        sumSig: keepLedger ? line.sumSig : "",
        createdAt: Date.now(),
        branchRoot: line.branchRoot || line.id,
        branchedFrom: { lineId: line.id, title: line.title, msgId: msg.id, at: kept, ts: Date.now() } };
      update(list => [nl, ...list]);
      setMsgMenu(null); setPlayId(nl.id); setPanelOpen(false);
      props.toast("岔出一条新线，原线完整保留");
    };
    const pressStart = m => { clearTimeout(pressRef.current); pressRef.current = setTimeout(() => setPhotoMenu(m), 550); };
    const pressMsg = m => { clearTimeout(pressRef.current); pressRef.current = setTimeout(() => setMsgMenu(m), 550); };
    const pressEnd = () => clearTimeout(pressRef.current);
    const onBgFile = async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = "";
      if (!f || !line) return;
      try {
        const durl = typeof resizeImageFile === "function" ? await resizeImageFile(f, 1600, 0.85) : await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        const ref = typeof imgToVault === "function" ? await imgToVault(durl) : durl;
        update(list => list.map(l => l.id !== line.id ? l : { ...l, bg: ref }));
        setPlusOpen(false);
      } catch (err) { props.toast("背景设置失败"); }
    };
    const imgSrc = ref => (typeof resolveImg === "function" ? resolveImg(ref) : ref);
    // 大图查看器（objectFit:contain，看的是整张不是裁过的）。
    // v54.46 从图库分支里搬出来：演出页刚出完封面就该能点开看整张，
    // 而不是先退到图库再点进角色再点缩略图。
    const bigViewer = () => galView && h("div", { onClick: () => setGalView(null), style: { position: "fixed", inset: 0, zIndex: 150, background: "rgba(20,18,16,.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 14px calc(env(safe-area-inset-bottom, 0px) + 20px)" } },
        h("img", { src: imgSrc(galView.img), onClick: e => e.stopPropagation(), style: { maxWidth: "100%", maxHeight: "72vh", borderRadius: 10, objectFit: "contain" } }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#d9d3c8", marginTop: 12, textAlign: "center" } }, (galView.kind === "cover" ? "🎞 封面 · " : "") + galView.lineTitle + " · " + new Date(galView.ts).toLocaleDateString("zh-CN")),
        h("div", { onClick: e => e.stopPropagation(), style: { display: "flex", gap: 10, marginTop: 14 } },
          h("button", { onClick: () => saveToAlbum(galView.img), style: { padding: "8px 16px", borderRadius: 12, fontFamily: F_BODY, fontSize: 12, border: "none", background: "#f0ece4", color: "#26231e" } }, "保存到手机相册"),
          h("button", { onClick: () => { const id = galView.id; if (!gal.some(x => x.id === id)) return props.toast("这张还没归档进图库"); if (!confirm("从图库删掉这张?剧情里的那张不受影响。")) return; setGalView(null); saveGal(l => l.filter(x => x.id !== id)); }, style: { padding: "8px 16px", borderRadius: 12, fontFamily: F_BODY, fontSize: 12, border: "1px solid #ffffff44", background: "transparent", color: "#e8a08c" } }, "删除")));
    const delLine = id => { if (!confirm("删除这条 if 线和全部记录?")) return; const l0 = lines.find(l => l.id === id); if (l0) setListChar(l0.charId); setView(l0 ? "lines" : "list"); setPlayId(null); update(list => list.filter(l => l.id !== id)); };

    // ---- UI ----
    // 小剧场是 zIndex:60 的整屏覆盖层,会盖住 zIndex:50 的全局 DevBadges;
    // 在层内再渲染一次同一个组件,版本号/电量就还在左上右上,和别的页面一样
    const badges = () => (typeof DevBadges === "function" ? h(DevBadges) : null);
    const S = { wrap: { position: "fixed", inset: 0, zIndex: 60, background: t.bg, display: "flex", flexDirection: "column" },
      top: { display: "flex", alignItems: "center", gap: 10, padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 10px", borderBottom: "1px solid " + t.line },
      h1: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, flex: 1 },
      btn: (fill) => ({ padding: "7px 14px", borderRadius: 12, fontFamily: F_BODY, fontSize: 12, border: "1px solid " + (fill ? t.ink : t.line), background: fill ? t.ink : "transparent", color: fill ? t.bg2 : t.ink }),
      card: { margin: "10px 14px 0", padding: 13, borderRadius: 16, background: t.bg2, border: "1px solid " + t.line },
      lbl: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginBottom: 3 },
      txt: { fontFamily: F_BODY, fontSize: 13, color: t.ink, lineHeight: 1.7, whiteSpace: "pre-wrap" } };
    // 头像:没设头像就用带首字的色块,别让入口页出现一排空洞
    const avatarOf = (c, size) => (c && c.avatarImage)
      ? h("img", { src: imgSrc(c.avatarImage), style: { width: size, height: size, borderRadius: 999, objectFit: "cover", display: "block" } })
      : h("div", { style: { width: size, height: size, borderRadius: 999, background: (c && c.color) || "#c2bdb1", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: Math.round(size * 0.4), color: "#fff" } }, String((c && c.name) || "?")[0]);
    // 返回:子页面逐层退回,不要一脚踹回入口(演出→该角色的记录→入口)
    const back = () => {
      if (view === "list") return props.onBack();
      if (view === "gallery") { setGalView(null); return galChar ? setGalChar(null) : setView("list"); }
      if (view === "play" && line) { setListChar(line.charId); setPlayId(null); setDraft(null); setView("lines"); return; }
      if ((view === "create" || view === "presets") && listChar) { setDraft(null); setView("lines"); return; }
      setPlayId(null); setDraft(null); setView("list");
    };
    const header = title => h("div", { style: S.top },
      h("button", { onClick: back, style: { fontSize: 18, color: t.ink, background: "none", border: "none", padding: "0 4px" } }, "←"),
      h("div", { style: S.h1 }, title),
      view === "list" ? h("button", { key: "gal", onClick: () => { setGalChar(null); setView("gallery"); }, style: S.btn(false) }, "图库") : null,
      view === "lines" ? h("button", { key: "new", onClick: () => { setDraft(null); setKw(""); setPickChar(listChar); setView("create"); }, style: S.btn(true) }, "新开if线") : null,
      view === "play" && line ? h("button", { onClick: () => setPanelOpen(v => !v), style: S.btn(false) }, panelOpen ? "收起" : "背景与目标") : null);

    // 入口的一行:头像居中站着,点开时纸条从右边拉出来,居中布局把头像自然挤向左边
    // (不用手写 translate:让 flex 的 justifyContent:center 去分配,头像走多远永远等于纸条宽度的一半)
    const EASE = "cubic-bezier(.22,1,.36,1)";
    const NOTE_W = 214;
    const charRow = c => {
      const open = sheetChar === c.id;
      const nL = lines.filter(l => l.charId === c.id).length;
      const nP = presets.filter(p => p.charId === c.id).length;
      const go = fn => e => { e.stopPropagation(); setListChar(c.id); fn(); };
      const noteBtn = (label, meta, onClick, strong) => h("button", { key: label, onClick, style: { width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "6px 9px", marginBottom: 5, borderRadius: 7, fontFamily: F_BODY, fontSize: 12, color: t.ink, background: strong ? t.ink : "transparent", border: "1px solid " + (strong ? t.ink : t.line) } },
        h("span", { style: { flex: 1, textAlign: "left", color: strong ? t.bg2 : t.ink } }, label),
        meta ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: strong ? t.bg2 : t.fog } }, meta) : null);
      // 必须挡住冒泡:外层容器有「点空白收起」,不挡的话这一下会被它接着关掉,看起来就是点了没反应
      return h("div", { key: c.id, onClick: e => { e.stopPropagation(); setSheetChar(open ? null : c.id); }, style: { display: "flex", alignItems: "center", justifyContent: "center", padding: "9px 12px" } },
        h("div", { style: { flexShrink: 0, textAlign: "center", transition: "transform .38s " + EASE, transform: open ? "scale(.94)" : "scale(1)" } },
          avatarOf(c, 62),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink, marginTop: 5, maxWidth: 78, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.name),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, nL ? nL + " 条线" : "还没演过")),
        // 纸条:宽度 0→NOTE_W 的动画;内层固定宽,内容不会跟着挤变形
        // 外层多留 8px 内边距:纸条有阴影又是歪的,贴着 overflow:hidden 的边会被削掉角
        h("div", { onClick: e => open && e.stopPropagation(), style: { width: open ? NOTE_W + 16 : 0, marginLeft: open ? 6 : 0, padding: "8px", opacity: open ? 1 : 0, overflow: "hidden", transition: "width .38s " + EASE + ", margin-left .38s " + EASE + ", opacity .26s ease" } },
          h("div", { style: { width: NOTE_W, padding: "9px 10px 5px", borderRadius: "2px 9px 9px 2px", background: t.bg2, borderLeft: "3px solid " + t.line, boxShadow: "0 3px 10px rgba(0,0,0,.10)", transform: "rotate(-.7deg)", backgroundImage: "repeating-linear-gradient(180deg, transparent 0, transparent 25px, " + t.line + " 25px, " + t.line + " 26px)" } },
            noteBtn("查看记录", nL ? nL + " 条" : "还没有", go(() => setView("lines"))),
            noteBtn("收藏的设定", nP ? nP + " 个" : "还没有", go(() => setView("presets"))),
            noteBtn("新开 if 线", "", go(() => { setPickChar(c.id); setDraft(null); setKw(""); setView("create"); }), true))));
    };

    // 图库:所有出过的剧照按角色分组;点开看大图,可存进手机相册或从图库删掉
    if (view === "gallery") {
      const gg = [];
      gal.forEach(x => { let g = gg.find(y => y.charId === x.charId); if (!g) { g = { charId: x.charId, items: [] }; gg.push(g); } g.items.push(x); });
      const viewer = bigViewer();
      // 先头像墙,点进某个角色才看到 Ta 的照片
      if (!galChar) {
        return h("div", { style: S.wrap }, badges(), header("剧照图库"),
          h("div", { style: { flex: 1, overflowY: "auto", padding: "14px 14px 30px" } },
            gg.length ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 10 } }, gg.map(g => { const c = props.characters.find(x => x.id === g.charId) || {};
              const cover = g.items[0];
              return h("div", { key: g.charId || "unknown", onClick: () => setGalChar(g.charId), style: { width: "calc((100% - 20px) / 3)", textAlign: "center" } },
                h("div", { style: { position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: 12, overflow: "hidden", background: t.bg2, border: "1px solid " + t.line } },
                  cover ? h("img", { src: imgSrc(cover.img), style: { width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: .55 } }) : null,
                  h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" } }, avatarOf(c, 52))),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.name || "已删除"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog } }, g.items.length + " 张"));
            }))
            : h("div", { style: { textAlign: "center", marginTop: 80, fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 2 } }, "还没有剧照。", h("br"), "演出时点 + 里的「当轮剧照」,出过的图都会自动收在这。")));
      }
      const cg = props.characters.find(x => x.id === galChar) || {};
      const mine = gal.filter(x => x.charId === galChar);
      return h("div", { style: S.wrap }, badges(), header((cg.name || "已删除的角色") + " · 剧照"), viewer,
        h("div", { style: { flex: 1, overflowY: "auto", padding: "14px 14px 30px" } },
          h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
            mine.map(x => h("div", { key: x.id, onClick: () => setGalView(x), style: { width: "calc((100% - 12px) / 3)", aspectRatio: "1 / 1", borderRadius: 8, overflow: "hidden", background: t.bg2, border: "1px solid " + t.line, position: "relative" } },
              h("img", { src: imgSrc(x.img), style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } }),
              x.kind === "cover" ? h("div", { style: { position: "absolute", left: 4, top: 4, padding: "1px 5px", borderRadius: 6, background: "rgba(20,18,16,.66)", color: "#f0ece4", fontFamily: F_BODY, fontSize: 9 } }, "封面") : null)))));
    }

    if (view === "create") {
      const preview = draft && h("div", { style: S.card },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, marginBottom: 8 } }, draft.title),
        [["Ta 的新身份", draft.charRole], [uName + " 的新身份", draft.userRole], ["世界与长期张力", draft.world || draft.setting], ["此刻正在发生", draft.hook], ["Ta 的行头", draft.charOutfit], [uName + " 的行头", draft.userOutfit], ["开场", draft.opening], ["本轮目标", draft.goal]].map(([k, v]) => v ? h("div", { key: k, style: { marginBottom: 8 } }, h("div", { style: S.lbl }, k), h("div", { style: S.txt }, v)) : null),
        h("div", { style: { display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" } },
          h("button", { onClick: acceptDraft, style: S.btn(true) }, "就这个,开演"),
          !draft.fromPreset && h("button", { onClick: genSetting, disabled: busy, style: S.btn(false) }, busy ? "在想…" : "换一版"),
          !draft.fromPreset && h("button", { onClick: () => addPreset(draft), style: S.btn(false) }, "收藏为基线")));
      const pc = props.characters.find(c => c.id === pickChar) || {};
      return h("div", { style: S.wrap }, badges(), header("新开 if 线"),
        h("div", { style: { flex: 1, overflowY: "auto", paddingBottom: 30 } },
          h("div", { style: Object.assign({}, S.card, { display: "flex", alignItems: "center", gap: 10 }) }, avatarOf(pc, 34),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, flex: 1 } }, pc.name || "?"),
            h("button", { onClick: () => { setDraft(null); setView("list"); }, style: S.btn(false) }, "换个角色")),
          h("div", { style: S.card }, h("div", { style: S.lbl }, "关键词(选填:题材/身份/氛围,如「民国 报社 追凶」)"),
            h("textarea", { value: kw, onChange: e => setKw(e.target.value), rows: 2, placeholder: "空着=让 Ta 自由发挥", style: { width: "100%", background: "transparent", border: "none", outline: "none", fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "none" } }),
            h("div", { style: S.lbl }, "难度"),
            h("div", { style: { display: "flex", gap: 6, marginBottom: 6 } }, ["easy", "normal", "hard"].map(k =>
              h("button", { key: k, onClick: () => setDiff(k), style: S.btn(diff === k) }, DIFF[k].name))),
            !draft && h("button", { onClick: genSetting, disabled: busy, style: Object.assign({ marginTop: 4 }, S.btn(true)) }, busy ? "在想…" : "生成设定")),
          preview));
    }

    // 收藏的设定:某个角色的基线,用同一套身份世界开新局
    if (view === "presets") {
      const c = props.characters.find(x => x.id === listChar) || {};
      const mine = presets.filter(p => p.charId === listChar);
      return h("div", { style: S.wrap }, badges(), header((c.name || "?") + " · 收藏的设定"),
        h("div", { style: { flex: 1, overflowY: "auto", paddingBottom: 30 } },
          mine.length ? [h("div", { key: "tip", style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.8, margin: "12px 16px 0" } }, "基线只留身份与世界。每次开新局都会另起一个全新的处境——同样这两个人,可能是失忆、政变、多年后重逢,不会再演同一个时刻。")].concat(mine.map(ps => h("div", { key: ps.id, style: S.card },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, ps.title),
            [["Ta 的身份", ps.charRole], [uName + " 的身份", ps.userRole], ["世界与长期张力", ps.world || ps.setting]].map(([k, v]) => v ? h("div", { key: k, style: { marginTop: 6 } }, h("div", { style: S.lbl }, k), h("div", { style: S.txt }, v)) : null),
            h("div", { style: { display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" } },
              h("button", { onClick: () => genFromPreset(ps), disabled: busy, style: S.btn(true) }, busy ? "在想…" : "用它开新局"),
              h("button", { onClick: () => { if (confirm("删除这条基线?")) savePresets(l => l.filter(x => x.id !== ps.id)); }, style: Object.assign({}, S.btn(false), { color: "#a4442e", borderColor: "#a4442e55" }) }, "删除")))))
          : h("div", { style: { textAlign: "center", marginTop: 80, fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 2 } }, "还没有收藏的设定。", h("br"), "生成设定时或演出面板里点「收藏」,身份和世界就存下来了。")));
    }

    if (view === "play" && line) {
      const char = charOf(line);
      const round = line.rounds[line.rounds.length - 1];
      const ta = (k, rows) => h("textarea", { value: edit[k], onChange: e => setEdit(p => ({ ...p, [k]: e.target.value })), rows: rows || 3, style: { width: "100%", padding: 8, borderRadius: 10, border: "1px solid " + t.line, background: t.bg, fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "vertical", outline: "none" } });
      const panel = panelOpen && h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", maxHeight: "56vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }) },
        edit
          ? [h("div", { key: "e1", style: { marginBottom: 7 } }, h("div", { style: S.lbl }, "线名"), ta("title", 1)),
             h("div", { key: "e2", style: { marginBottom: 7 } }, h("div", { style: S.lbl }, "Ta 的身份"), ta("charRole")),
             h("div", { key: "e3", style: { marginBottom: 7 } }, h("div", { style: S.lbl }, uName + " 的身份"), ta("userRole", 2)),
             h("div", { key: "e4", style: { marginBottom: 7 } }, h("div", { style: S.lbl }, "世界与情境"), ta("setting", 4)),
             h("div", { key: "e4b", style: { marginBottom: 7 } }, h("div", { style: S.lbl }, "Ta 的行头(出图时锁定,留空则每张随机)"), ta("charOutfit", 2)),
             h("div", { key: "e4c", style: { marginBottom: 7 } }, h("div", { style: S.lbl }, uName + " 的行头(同上)"), ta("userOutfit", 2)),
             h("div", { key: "e5", style: { marginBottom: 7 } }, h("div", { style: S.lbl }, "当前轮目标"), ta("goal", 2)),
             h("div", { key: "e6", style: { display: "flex", gap: 8 } },
               h("button", { onClick: () => { const e2 = edit; update(list => list.map(l => l.id !== line.id ? l : { ...l, title: e2.title.trim() || l.title, charRole: e2.charRole, userRole: e2.userRole, setting: e2.setting, charOutfit: e2.charOutfit, userOutfit: e2.userOutfit, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : { ...r, goal: e2.goal }) })); setEdit(null); props.toast("已保存"); }, style: S.btn(true) }, "保存"),
               h("button", { onClick: () => setEdit(null), style: S.btn(false) }, "取消"))]
          : [[["Ta 的身份", line.charRole], [uName + " 的身份", line.userRole], ["世界与情境", line.setting]].map(([k, v]) => v ? h("div", { key: k, style: { marginBottom: 7 } }, h("div", { style: S.lbl }, k), h("div", { style: S.txt }, v)) : null),
             h("div", { key: "df", style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 7 } },
               h("span", { style: S.lbl }, "难度"),
               ["easy", "normal", "hard"].map(k => h("button", { key: k, onClick: () => update(list => list.map(l => l.id !== line.id ? l : { ...l, difficulty: k })), style: S.btn((line.difficulty || "normal") === k) }, DIFF[k].name))),
             h("div", { key: "gl", style: S.lbl }, "各轮目标"),
             line.rounds.map((r, i) => h("div", { key: r.id, style: Object.assign({}, S.txt, { marginBottom: 3 }) }, "第" + (i + 1) + "轮:" + r.goal + (r.goalDone ? " ✓" : r.failed ? " ✗失败" : i === line.rounds.length - 1 ? "(进行中)" : "(未完)"))),
             h("div", { key: "bt", style: { display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" } },
               line.ended ? null : (round.goalDone || round.failed)
                 ? [h("button", { key: "ai", onClick: () => genGoal("next"), disabled: busy, style: S.btn(true) }, busy ? "在想…" : "下一轮·AI想"),
                    h("button", { key: "hand", onClick: () => setWriteGoal(""), style: S.btn(false) }, "下一轮·自己写")]
                 : h("button", { onClick: () => genGoal("redo"), disabled: busy, style: S.btn(false) }, busy ? "在想…" : "换个目标"),
               !line.ended && h("button", { onClick: endLine, disabled: busy, style: S.btn(false) }, "谢幕收线"),
               h("button", { onClick: restartLine, disabled: busy, style: S.btn(false) }, "重开此线"),
               h("button", { onClick: () => setEdit({ title: line.title, charRole: line.charRole, userRole: line.userRole, setting: line.setting, charOutfit: line.charOutfit || "", userOutfit: line.userOutfit || "", goal: round.goal }), style: S.btn(false) }, "编辑设定"),
               h("button", { onClick: () => addPreset(line), style: S.btn(false) }, "收藏此设定"),
               h("button", { onClick: () => delLine(line.id), style: Object.assign({}, S.btn(false), { color: "#a4442e", borderColor: "#a4442e55" }) }, "删除此线")),
             writeGoal !== null && h("div", { key: "wg", style: { marginTop: 8 } },
               h("div", { style: S.lbl }, "写下一轮目标(记得写成「让他…」,可以是很日常的小事)"),
               h("textarea", { value: writeGoal, onChange: e => setWriteGoal(e.target.value), rows: 2, style: { width: "100%", padding: 8, borderRadius: 10, border: "1px solid " + t.line, background: t.bg, fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "vertical", outline: "none" } }),
               h("div", { style: { display: "flex", gap: 8, marginTop: 6 } },
                 h("button", { onClick: () => { const g = (writeGoal || "").trim(); if (!g) return; update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: [...l.rounds, { id: rid("tr_"), goal: g, goalDone: false, goalNote: null, pending: false, msgs: [], startTs: Date.now() }] })); setWriteGoal(null); }, style: S.btn(true) }, "开这一轮"),
                 h("button", { onClick: () => setWriteGoal(null), style: S.btn(false) }, "算了")))]);
      const banner = round.pending ? h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", borderColor: t.ink }) },
        h("div", { style: S.txt }, "本轮目标可能已达成:" + round.goal + (typeof round.pending === "string" ? "\n(" + round.pending + ")" : "")),
        h("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
          h("button", { onClick: () => confirmGoal(true), style: S.btn(true) }, "确认达成"),
          h("button", { onClick: () => confirmGoal(false), style: S.btn(false) }, "还没有")))
      : round.pendingFail ? h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", borderColor: "#a4442e" }) },
        h("div", { style: S.txt }, "这条路可能已经走死了:" + round.goal + (typeof round.pendingFail === "string" ? "\n(" + round.pendingFail + ")" : "")),
        h("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
          h("button", { onClick: () => confirmFail(true), style: Object.assign({}, S.btn(true), { background: "#a4442e", borderColor: "#a4442e" }) }, "确认失败"),
          h("button", { onClick: () => confirmFail(false), style: S.btn(false) }, "还有机会"))) : null;
      let ri = 0;
      const flow = line.rounds.flatMap((r, i) => [h("div", { key: "rd" + r.id, style: { textAlign: "center", fontFamily: F_BODY, fontSize: 10, color: t.fog, margin: "14px 0 4px" } }, "— 第" + (i + 1) + "轮 · " + r.goal + (r.goalDone ? " ✓" : r.failed ? " ✗" : "") + " —")]
        .concat(r.msgs.map(m => m.role === "photo"
          ? h("div", { key: m.id, onPointerDown: () => pressStart(m), onPointerUp: pressEnd, onPointerMove: pressEnd, onPointerLeave: pressEnd, onContextMenu: e => e.preventDefault(), style: { margin: "10px 14px", textAlign: "center" } }, h("img", { src: imgSrc(m.img), style: { maxWidth: "86%", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.18)" } }))
          : m.role === "user"
          ? h("div", { key: m.id, style: { margin: "10px 14px", textAlign: "right" } }, h("span", { style: { display: "inline-block", maxWidth: "82%", textAlign: "left", padding: "9px 13px", borderRadius: 15, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" } }, m.content))
          : h("div", { key: m.id, onPointerDown: () => pressMsg(m), onPointerUp: pressEnd, onPointerMove: pressEnd, onPointerLeave: pressEnd, onContextMenu: e => e.preventDefault(),
              style: Object.assign({ margin: "10px 14px" }, S.txt) }, m.content))));
      const photoSheet = photoMenu && h("div", { onClick: () => setPhotoMenu(null), style: { position: "fixed", inset: 0, zIndex: 140, background: "rgba(30,28,24,.4)", display: "flex", alignItems: "flex-end" } },
        h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", background: t.bg2, borderRadius: "18px 18px 0 0", padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)" } },
          [["重拍这张", () => { const m = photoMenu; setPhotoMenu(null); rerollPhoto(m); }],
           ["保存到手机相册", () => { const m = photoMenu; setPhotoMenu(null); saveToAlbum(m.img); }],
           ["取消", () => setPhotoMenu(null)]].map(([label, fn], i) => h("button", { key: label, onClick: fn, style: { width: "100%", padding: "13px 0", fontFamily: F_BODY, fontSize: 14, color: i === 0 ? t.ink : i === 2 ? t.fog : t.ink, background: "transparent", border: "none", borderTop: i ? "1px solid " + t.line : "none" } }, label))));
      const msgSheet = msgMenu && h("div", { onClick: () => setMsgMenu(null), style: { position: "fixed", inset: 0, zIndex: 140, background: "rgba(30,28,24,.4)", display: "flex", alignItems: "flex-end" } },
        h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", background: t.bg2, borderRadius: "18px 18px 0 0", padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.7, padding: "0 2px 8px" } },
            "从这一拍岔开一条新线：这一拍之前原样保留，之后的重演。**原线一个字不动**，随时能切回去。"),
          [["⑂ 从这里分支", () => branchFrom(msgMenu)],
           ["取消", () => setMsgMenu(null)]].map(([label, fn], i) => h("button", { key: label, onClick: fn, style: { width: "100%", padding: "13px 0", fontFamily: F_BODY, fontSize: 14, color: i === 0 ? t.ink : t.sub, background: "none", border: "none", borderTop: i ? "1px solid " + t.line : "none" } }, label))));
      return h("div", { style: S.wrap }, badges(),
        line.bg ? h("div", { style: { position: "absolute", inset: 0, zIndex: 0, backgroundImage: "linear-gradient(rgba(240,236,228,.8),rgba(240,236,228,.8)), url(" + imgSrc(line.bg) + ")", backgroundSize: "cover", backgroundPosition: "center" } }) : null,
        bigViewer(),
        h("div", { style: { position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } }, header(line.title + " · " + (char.name || "")), photoSheet, msgSheet,
        panel, banner,
        h("div", { ref: scrollRef, style: { flex: 1, overflowY: "auto", paddingBottom: 16 } }, flow,
          busy ? h("div", { style: { margin: "10px 14px", fontFamily: F_BODY, fontSize: 12, color: t.fog } }, busyWhat || "Ta 在演…") : null),
        line.ended ? h("div", { style: { textAlign: "center", padding: "16px 14px calc(env(safe-area-inset-bottom, 0px) + 16px)", borderTop: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 11, letterSpacing: 2, color: t.fog } }, "—— 已完结 · 可在「背景与目标」里重开 ——") : noteOpen ? h("div", { style: { padding: "8px 14px 0", borderTop: "1px solid " + t.line } },
          h("textarea", { value: note, onChange: e => setNote(e.target.value), rows: 2, placeholder: "导演便签(只给这一拍的幕后指示,不入剧情):比如「让他更凶一点」「引入一个不速之客」", style: { width: "100%", padding: 8, borderRadius: 10, border: "1px dashed " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 12, color: t.ink, resize: "none", outline: "none" } })) : null,
        !line.ended && plusOpen ? h("div", { style: { display: "flex", gap: 8, padding: "8px 14px 0", borderTop: "1px solid " + t.line, flexWrap: "wrap" } },
          h("button", { onClick: () => { setDice(v => !v); }, style: S.btn(dice) }, "🎲 骰子" + (dice ? "·已上膛" : "")),
          h("button", { onClick: () => { setNoteOpen(v => !v); }, style: S.btn(noteOpen || !!note.trim()) }, "() 便签"),
          h("button", { onClick: genPhoto, disabled: busy, style: S.btn(false) }, "📷 当轮剧照"),
          h("button", { onClick: genCover, disabled: busy, style: S.btn(false) }, line.cover ? "🎞 重出封面" : "🎞 封面图"),
          // 封面画完不该只剩卡片上那层被渐变压掉的底纹：点开看整张、或直接铺成背景
          line.cover ? h("button", { onClick: () => { setPlusOpen(false); setGalView(gal.find(x => x.img === line.cover) || { id: "cover_" + line.id, charId: line.charId, lineId: line.id, lineTitle: line.title, img: line.cover, ts: line.coverTs || Date.now(), kind: "cover" }); }, style: S.btn(false) }, "🔍 看封面整张") : null,
          line.cover && line.bg !== line.cover ? h("button", { onClick: () => { update(list => list.map(l => l.id !== line.id ? l : { ...l, bg: line.cover })); setPlusOpen(false); props.toast("封面已铺成背景"); }, style: S.btn(false) }, "🖼 封面当背景") : null,
          h("button", { onClick: () => fileRef.current && fileRef.current.click(), style: S.btn(false) }, "🖼 传背景图"),
          line.bg ? h("button", { onClick: () => { update(list => list.map(l => l.id !== line.id ? l : { ...l, bg: null })); setPlusOpen(false); }, style: Object.assign({}, S.btn(false), { color: "#a4442e", borderColor: "#a4442e55" }) }, "清除背景") : null) : null,
        line.ended ? null : h("div", { style: { display: "flex", gap: 8, padding: "10px 14px calc(env(safe-area-inset-bottom, 0px) + 12px)", borderTop: (noteOpen || plusOpen) ? "none" : "1px solid " + t.line } },
          h("input", { type: "file", accept: "image/*", ref: fileRef, onChange: onBgFile, style: { display: "none" } }),
          h("button", { onClick: () => setPlusOpen(v => !v), style: Object.assign({}, S.btn(plusOpen || dice || !!note.trim()), { padding: "7px 12px" }) }, plusOpen ? "×" : "+"),
          h("textarea", { value: input, onChange: e => setInput(e.target.value), rows: 1, placeholder: (round.msgs.length && round.msgs[round.msgs.length - 1].role === "user") ? "上条没生成出来,直接按「演」重试" : "你的行动或台词…", style: { flex: 1, padding: "10px 13px", borderRadius: 14, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "none", outline: "none" } }),
          h("button", { onClick: send, disabled: busy, style: S.btn(true) }, "演"))));
    }

    // 某个角色的记录:只显示 Ta 的线,每条可单独删除
    const lineCard = l => { const n = allMsgs(l).length; const done = l.rounds.filter(r => r.goalDone).length;
      // 有封面就把它压进卡片当底：图上要压字，所以盖一层足够厚的渐变，先保证读得清
      const coverBg = l.cover ? {
        backgroundImage: "linear-gradient(90deg, rgba(240,236,228,.94) 0%, rgba(240,236,228,.82) 52%, rgba(240,236,228,.35) 100%), url(" + imgSrc(l.cover) + ")",
        backgroundSize: "cover", backgroundPosition: "center", minHeight: 96
      } : null;
      return h("div", { key: l.id, onClick: () => { setPlayId(l.id); setView("play"); setPanelOpen(false); }, style: Object.assign({}, S.card, { cursor: "pointer", position: "relative" }, coverBg) },
        h("button", { onClick: e => { e.stopPropagation(); if (confirm("删除「" + l.title + "」和全部记录?")) update(list => list.filter(x => x.id !== l.id)); },
          style: { position: "absolute", top: 10, right: 10, background: "none", border: "none", color: t.fog, fontSize: 15, padding: 4 } }, "✕"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, paddingRight: 26 } }, l.title),
        l.branchedFrom ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 3 } },
          "⑂ 分支自「" + (l.branchedFrom.title || "原线") + "」第 " + (l.branchedFrom.at || 0) + " 拍") : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, marginTop: 4 } }, (l.ended ? "已完结 · " : "") + "第" + l.rounds.length + "轮 · 目标达成" + done + " · " + n + "条" + (l.archives && l.archives.length ? " · 重开过" + l.archives.length + "次" : "")),
        h("div", { style: Object.assign({}, S.txt, { color: t.fog, fontSize: 12, marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }) }, l.setting)); };
    if (view === "lines") {
      const c = props.characters.find(x => x.id === listChar) || {};
      const mine = lines.filter(l => l.charId === listChar);
      return h("div", { style: S.wrap }, badges(), header((c.name || "?") + " · 记录"),
        h("div", { style: { flex: 1, overflowY: "auto", paddingBottom: 30 } },
          mine.length ? mine.map(lineCard)
          : h("div", { style: { textAlign: "center", marginTop: 80, fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 2 } }, "还没有和 Ta 演过。", h("br"), "点右上角新开一条 if 线。")));
    }

    // 入口:头像一个一列站在屏幕中间,往下滑看全部;点一下纸条从右边拉开
    return h("div", { style: S.wrap }, badges(), header("小剧场"),
      h("div", { onClick: () => setSheetChar(null), style: { flex: 1, overflowY: "auto", padding: "10px 0 40px" } },
        props.characters.length ? props.characters.map(charRow)
        : h("div", { style: { textAlign: "center", marginTop: 80, fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 2 } }, "还没有角色。", h("br"), "先去建一个,再把 Ta 扔进另一种人生。")));
  }
  window.TheaterApp = TheaterApp;
})();
