// 微光庭院有两种进法（她 2026-09-16 定的第二种）：
//   · 首页那个入口＝架空试玩：一个公共存档，全文人设＋公共文风，主线一概不读写。
//   · 【庭院房】＝角色的一间侧房：一间房一个存档，进门带什么由这间房的开关说了算，
//     说过的话落在这间房自己的聊天记录里，要带出去就开「能进记忆」「总结回主线」。
// ⚠️第二种一样机制都没新造：房间那套（cognition/writeback）本来就长着这几排开关，
//   庭院以前只是没接上去。所以这里只多收三个 props：storeKey（存档挂哪儿）、
//   mainline（已经过这间房认知闸的主线底子）、record（这间房的记录与写回）。
// 接口密钥留在父页 callAI，不传进游戏画面。
(function (root) {
  "use strict";
  const KEY = "x_fairyGarden", BUILD = "fg-cb356e8af2453791", hosts = new WeakMap();
  const h = React.createElement, useState = React.useState, useRef = React.useRef, useEffect = React.useEffect;
  root.FairyGardenHostFor = child => hosts.get(child) || null;
  // ⚠️「读回来是空」不等于「这儿本来就没有一档」。存档搬进 IDB 之后，文字仓没灌起来
  //   那一刻读到的也是空；这时候要是照着「没有」开一档新的，第一次保存就把她真正的
  //   那一档原地盖掉了——而她看见的全过程只是「进去发现庭院变新的了」。
  //   所以空的时候先问一句仓开没开：没开就【什么都不写】，把话说出来让她退出去再进。
  function vaultStalled(key) {
    if (typeof isIdbTextKey !== "function" || !isIdbTextKey(key)) return "";
    let st = null; try { st = typeof txtVaultState === "function" ? txtVaultState() : null; } catch (e) { return ""; }
    if (!st || (st.done && st.ok)) return "";
    return "本机的存档仓还没打开" + (st.err ? "（" + st.err + "）" : "") + "，先别在这儿开新的一档——退出去等一下再进来，庭院还在。";
  }
  const read = (key) => {
    const k = key || KEY;
    const d = loadJSON(k, null);
    if (d && d.version === 1 && d.id) return d;
    const stall = vaultStalled(k); if (stall) throw new Error(stall);
    return { version: 1, id: "garden_" + Date.now() + "_" + Math.random().toString(36).slice(2), partnerId: "", world: null, dialogs: {} };
  };
  const write = (key, data) => { if (!saveJSON(key || KEY, data)) throw new Error("庭院没能保存，请先留在这里。空间不足时可以导出手机备份。"); return data; };
  // 两排色板：给的是【挑得动手】的十来个颜色，不是取色器。
  // 布偶是童话质感，饱和度压着走；深浅各来几档，深色头发也照顾到。
  const HAIR_COLORS = ['#2b2320', '#4a3629', '#6b4a33', '#8a6a4b', '#b38f62', '#d8c393', '#8d4a3a', '#6f5f7c'];
  const CLOTH_COLORS = ['#8d5f66', '#729786', '#5f7590', '#a7784c', '#6b6280', '#93684f', '#4f6b5c', '#b0857f'];
  // 一轮话拆成几个气泡（她 2026-09-17：「他回复一大段是不是没用分气泡」）。
  // ⚠️拆气泡全库只有一处实现：GroupIdentityGuard.splitBubbles ＋ engine.js 的 splitLongBubble。
  //   庭院自己再写一个切句子的函数，就是同一层活在两处（施工规则/one-public-mechanism.md）。
  // ⚠️只有【真的长到成墙】的那一条才动刀（80 字往上，而且只在句号处断）：
  //   庭院这边是成段叙事，照即时通讯那个 22 字的尺子切，会把一段描写剁成碎片。
  const BUBBLE_WALL = 80;
  function replyParts(raw) {
    const G = (typeof window !== "undefined" && window.GroupIdentityGuard) || null;
    const lines = [];
    (Array.isArray(raw) ? raw : [raw]).forEach(row => {
      const text = String(row == null ? "" : row).trim(); if (!text) return;
      (G ? G.splitBubbles(text) : text.split(/\n+/)).forEach(x => { const t = String(x).trim(); if (t) lines.push(t); });
    });
    const out = [];
    lines.forEach(line => {
      if (line.length <= BUBBLE_WALL || typeof splitLongBubble !== "function") { out.push(line); return; }
      const cut = splitLongBubble(line, false).filter(Boolean);
      (cut.length ? cut : [line]).forEach(x => out.push(x));
    });
    return out.slice(0, 12);
  }
  function normalizeReply(raw) {
    const obj = extractJSON(raw);
    const parts = obj ? replyParts(obj.reply) : [];
    if (!parts.length) { const e = new Error("这次没读懂角色的回复，可以重试。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    const a = obj.action || {}, kind = ["none", "follow", "routine", "wait", "goto"].includes(a.kind) ? a.kind : "none";
    return { parts, reply: parts.join("\n"), action: kind === "goto" && !["pond", "garden", "well", "home"].includes(a.target) ? { kind: "none" } : { kind, target: kind === "goto" ? a.target : undefined } };
  }
  function sharedStyle() { return [narrativeCore({ intimate: true }), CONDESCENDING_TONE_BAN, REGISTER_FOLLOWS_SCENE, STOCK_REPLY_BAN, OVERREACH_BAN, ECHO_QUESTION_BAN, typeof ReplyPacing !== "undefined" ? ReplyPacing.reading() : ""].filter(Boolean).join("\n\n"); }
  // mainline＝父页按【这间房的认知闸】拼好的主线底子（buildBundle 那一份）。
  // ⚠️给了就用它替掉这儿这份手写的自我介绍：那一份是全库公用的「你是谁＋怎么说话」，
  //   庭院自己再写一遍就是同一层活在两处（施工规则/one-public-mechanism.md）。
  //   没给（首页试玩）仍走原来这份，行为一个字都不变。
  function roleContext(character, profile, mainline) {
    const one = "你就是「" + character.name + "」，正与「" + userName(profile) + "」一起生活在魔法庭院。";
    if (String(mainline || "").trim()) return one + "\n\n" + String(mainline).trim();
    return [one, "【完整角色人设】\n" + (character.persona || character.name), "【对方的设定】\n" + (profile && profile.persona || "未填写")].join("\n\n");
  }
  async function generateSeason({ active, character, profile, world, mainline }) {
    if (!active) throw new Error("先在设置里配置创作线路，再来安排这一季。");
    const rules = root.FairyGardenRules, season = rules.seasonOf(world.day);
    const sys = [sharedStyle(), roleContext(character, profile, mainline), "【当前游戏事实与最近日志】\n" + JSON.stringify(world),
      "【这一季】第 " + season.year + " 年" + season.name + "季，共 14 天。这是一份可以实行的生活安排，日子会继续往后走。围绕你的人设、兴趣和你们的游戏经历，为每天挑三个活动，依次用于上午、下午、傍晚。全天候的移动、雨雪调整、实际到场和材料结算由游戏负责。",
      "【这一份就是你全部的日子】游戏这边没有另一套「默认作息」垫着——你没排的时段，他就只是待在屋前。所以这十四天是什么样，全看你怎么排。",
      "【她一个人做的那些事，你也去得了】井、告示板、收藏馆、月潭边、集市、小桥、许愿树、邻居屋门前，都在清单里。⚠️收藏馆里摆着的是【她自己留下的东西】，你去看，就是在看她。",
      (world.lately && world.lately.length ? "【村里最近发生的事】\n" + world.lately.map(x => "・第 " + x.day + " 天：" + x.text).join("\n") : ""),
      "【本季每日天气】\n" + JSON.stringify(Array.from({length:14},(_,i)=>({day:i+1,weather:rules.weather(season.start+i,world.epoch)}))),
      "【可实行活动】\n" + JSON.stringify(Object.entries(rules.ACTIVITIES).map(([id,a])=>({id,place:rules.MAPS[a.map].name,activity:a.label}))),
      "你决定这一季想怎样生活，各天如何变化、哪些日子想独处或一起待着。活动的想法、动机与观察可以自由写；活动标识使用上述清单。涉及尚未建成的事物时把它作为愿望，眼下的安排仍落在已有地点。已经过去的季内日期只列计划，不把计划当已发生的回忆。",
      '【输出格式】只输出 JSON：{"title":"你为这一季取的短标题","days":[{"day":1,"note":"这天想怎样过","activities":[{"id":"活动标识","note":"这个活动里你想做什么"}]}]}。days 完整包含第 1 到第 14 天，每天恰好三个 activities。'
    ].join("\n\n");
    const raw = await callAI(active, sys, [{role:"user",content:"安排这一季。"}], {maxTokens:65535,timeout:180000,tag:"微光庭院季节"});
    try { return rules.normalizePlan(extractJSON(raw), world.day); } catch(e) { e.detail=String(raw||"").slice(0,1600);throw e; }
  }
  async function ask({ active, character, profile, world, history, text, mainline }) {
    if (!active) throw new Error("先在设置里配置创作线路，再来和角色说话。");
    const style = sharedStyle();
    const sys = [style,
      roleContext(character, profile, mainline),
      "【微光庭院】以本轮人设保留性格、声纹和相处方式，以游戏状态确定此时此地。时间、背包、位置与共同经历都属于这个存档。",
      "【当前世界的事实】\n" + JSON.stringify(world),
      "【这个世界里你们最近的对话】\n" + history.map(m => (m.role === "user" ? userName(profile) : character.name) + "：" + m.content).join("\n"),
      "【对方刚说】\n" + text,
      "【你能落实的动作】none=继续当前行动；follow=沿路来陪对方；routine=恢复自己的日程；wait=停在当前位置等候；goto=去一个地点，target 取 pond（林地池边）、garden（庭院花圃）、well（水井）、home（屋前）。动作只控制你自己，用户的小人由用户操作。路径与到达由游戏执行，回复表达眼下的意愿与举动；物品变动以游戏实际结算为准。你可以按性格答应、犹豫、商量或拒绝。",
      '【输出格式】只输出 JSON：{"reply":["你说的第一句","接着说的第二句"],"action":{"kind":"动作标识","target":"仅 goto 时填写地点标识"}}。'
      + "reply 是一个数组，一条一个意思：她那头是一个一个气泡冒出来的，一口气说完的整段塞进一条就是一堵字墙。"
      + "想说几条由你，短就一条；动作描写跟着它所属的那一句走，别单独攒成一条。"
      + "本轮只选择一个能落实的动作，其余内容可以继续聊天。"
    ].join("\n\n");
    return normalizeReply(await callAI(active, sys, [{ role: "user", content: "回应眼前这一句。" }], { maxTokens: 65535, timeout: 180000, tag: "微光庭院" }));
  }
  // ── 花笺：把开好的那几株一次问完（她 2026-09-16 定的种花那条）──────────
  // ⚠️【一次调用收一批】：开了几朵就在这一枪里一起回，不是一朵一枪。
  //   这是整条设计能不能落地的那个闸——拆了它，她在庭院点一下午就是几十枪。
  // ⚠️不许把没发生过的共同经历写成真发生过：花笺是他此刻的感受、想法、
  //   他自己那边的生活，不是你们的新往事（如果馆那条路已经吃过一次亏）。
  const SEED_LABELS = { miss: "想你", curious: "好奇", sulk: "委屈", secret: "秘密",
    today: "今天", later: "以后", what_if: "如果", unsaid: "没说出口" };
  async function blossoms({ active, character, profile, world, mainline, seeds }) {
    if (!active) throw new Error("先在设置里配置创作线路，再来收花笺。");
    const rows = (seeds || []).slice(0, 6);
    if (!rows.length) throw new Error("地里没有开好的花。");
    const uName = userName(profile);
    const sys = [sharedStyle(), roleContext(character, profile, mainline),
      "【花田】「" + uName + "」把想问你的话种进了庭院的花圃，过了几天开出花来。你现在逐一回它们。",
      "【当前世界的事实】\n" + JSON.stringify(world),
      "【开好的花，每一株一句】\n" + rows.map(x => "· " + x.id + "〔" + (SEED_LABELS[x.kind] || "今天") + "〕" + (x.ask || "（她没写字，只放了这个念头）")).join("\n"),
      "【怎么回】一株一句到三句，是你此刻真实的回应：可以是一个很小的具体瞬间、一个念头、"
        + "一件你那边刚发生的事，也可以是反问或者沉默着说点别的。别复述她的问题，别每株都同一个调子，"
        + "别写成情书体。\n"
        + "⚠️不许把【你们之间没发生过的事】说成真发生过——没有的共同经历就别编；"
        + "想象和「如果」要让人看得出那是想象。",
      '【输出格式】只输出 JSON 数组：[{"id":"上面那一行的编号","reply":"你的回应"}]，每株一条，不多不少。'
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "回这几株。" }], { maxTokens: 20000, timeout: 180000, tag: "微光庭院花笺" });
    const parsed = extractJSON(raw);
    const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.notes) ? parsed.notes : null);
    if (!list) { const e = new Error("这次没读懂花笺，可以重试。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    const want = new Set(rows.map(x => x.id));
    const out = list.filter(x => x && want.has(String(x.id)) && String(x.reply || "").trim())
      .map(x => ({ id: String(x.id), reply: String(x.reply).trim().slice(0, 400) }));
    if (!out.length) { const e = new Error("这次一株都没回上来，可以重试。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return out;
  }
  // ── 碎片：下潜时一次生成一批，慢慢挖出来（同花笺那条闸）──────────────
  // ⚠️深度只决定【完整度和奇异度】，不决定情感重量——「B1 普通想法、B20 童年创伤」
  //   那种梯子她点名不要。这条在提示词里写死。
  // ⚠️能捞的（回忆/联想/他那边）只许从真东西里长；想象的那几类必须看得出是想象。
  // ⚠️四类【看得见的东西】（v69.32，codex 提的，她拍板）：先是东西，其次才带着内容。
  //   「没说出口／以后／他那边」不再自己占一格，而是这几样东西携带的内容。
  const SHARD_LABELS = { echo: "回声石", dream: "梦屑", sense: "感官晶", relic: "无名遗物" };
  async function shards({ active, character, profile, world, mainline, depth, want }) {
    if (!active) throw new Error("先在设置里配置创作线路，再下井。");
    const n = Math.max(1, Math.min(8, Number(want) || 6));
    const uName = userName(profile);
    const sys = [sharedStyle(), roleContext(character, profile, mainline),
      "【星井】「" + uName + "」在井底的石头里刨出一些【东西】。四种：\n"
        + "· 回声石 echo：里面封着一段真发生过的小事——只能从上面真给到你的经历里长，没有就别选它。\n"
        + "· 梦屑 dream：一个梦里的画面，不必解释前因后果。\n"
        + "· 感官晶 sense：一段声音、一种气味、一点温度，附着它勾起的那一点东西。\n"
        + "· 无名遗物 relic：一件旧东西——半张地图、一把不知道开哪儿的钥匙、一个奇怪零件。",
      "【当前世界的事实】\n" + JSON.stringify(world),
      "【这一层】第 " + Math.max(1, Number(depth) || 1) + " 层。"
        + "⚠️越深的只是【越完整、越奇怪】，不是越深情、越惨、越隐秘——别按层数往上堆情绪。"
        + "浅处也可以挖到很珍贵的东西，深处也可以只是「突然很想吃烤红薯」。",
      "【怎么写】每片一两句，短：写【这是一件什么东西】，以及它上面／里面有什么。"
        + "不解释前因后果，不交代是什么时候的事，不写成完整的小故事。别每片一个调子，别都在说她。\n"
        + "kind 只能取：echo｜dream｜sense｜relic。\n"
        + "⚠️echo【只能从上面真给到你的经历里长】，真没有就别选它。绝不许编一段你们其实没发生过的事。\n"
        + "⚠️最要紧的一条：**东西是挖出来的，话是你自己说的**。"
        + "不许在碎片上替自己宣布「我当时差点说…」「我一直想着…」这种台词——"
        + "那句话要等你【看见这件东西之后】再决定说不说、怎么说。这里只写那件东西本身。",
      '【输出格式】只输出 JSON 数组，' + n + ' 条：[{"kind":"上面那八个之一","text":"这一片上写着什么","whole":false}]。'
        + 'whole 只有在这一件本身是完整一件事时才为 true。'
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "刨开这一层。" }], { maxTokens: 20000, timeout: 180000, tag: "微光庭院碎片" });
    const parsed = extractJSON(raw);
    const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.shards) ? parsed.shards : null);
    if (!list) { const e = new Error("这次没读懂井里的东西，可以再下一次。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    const out = list.filter(x => x && SHARD_LABELS[String(x.kind)] && String(x.text || "").trim())
      .map(x => ({ kind: String(x.kind), text: String(x.text).trim().slice(0, 240), whole: x.whole === true })).slice(0, n);
    if (!out.length) { const e = new Error("这一层什么都没刨出来，可以再下一次。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return out;
  }
  // 他自己走过来、她点了头，才打的那一枪（她 2026-09-17）。
  // ⚠️这是整个庭院里最值钱的一次调用：别的都躲着不打，这一次是她主动要听。
  // ⚠️料全放 system，user 只留一句触发（施工规则/prompt-send-shape.md）。
  // ⚠️手上那几件【全是存档里真发生过的东西】，他只能从这里头挑：
  //   不给料他就只能说「我想你了」，那句话换个角色照样成立，等于没说。
  async function missLine({ active, character, profile, mainline, world, material }) {
    if (!active) throw new Error("先在设置里配置创作线路，他才说得出话。");
    const rows = (material && material.rows) || [];
    const quiet = Math.max(0, Number(material && material.quiet) || 0);
    const sys = [sharedStyle(),
      roleContext(character, profile, mainline),
      "【微光庭院】以本轮人设保留性格、声纹和相处方式，以游戏状态确定此时此地。",
      "【当前世界的事实】\n" + JSON.stringify(world),
      "【此刻】你自己放下手里的事，走到她面前站住了。不是她叫你来的——是你自己想找她说句话。"
        + (quiet ? "你们已经 " + quiet + " 天没正经说过话了。" : ""),
      rows.length
        ? "【你手上这几样，都是你们之间真有过的】\n" + rows.map(r => "・〔" + r.kind + "・第 " + r.day + " 天〕" + r.text).join("\n")
        : "【你手上什么都没有】你们之间还没攒下什么可说的东西。",
      "【要紧的一条】从上面那几样里【挑一件】说起，或者说这会儿眼前的天气、光线、她正在做的事。"
        + "⚠️绝不许编一段你们其实没发生过的事。"
        + "⚠️也别只说一句你想她——那句话谁来说都成立，等于没开口；真要说，也得说清是被什么勾起来的。"
        + "说完就完，不用替她安排接下来做什么，也不用留个问题等她接。",
      '【输出格式】只输出 JSON：{"say":["你开口的第一句","接着说的第二句"]}。'
        + "一条一个意思，她那头是一个一个气泡冒出来的。想说几条由你，一句说得完就一条。"
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "他开口。" }], { maxTokens: 12000, timeout: 180000, tag: "微光庭院找你" });
    const obj = extractJSON(raw);
    const parts = obj ? replyParts(obj.say) : [];
    if (!parts.length) { const e = new Error("这次他没说出口，明天再来。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return parts;
  }
  root.FairyGardenService = { KEY, normalizeReply, ask, missLine, generateSeason, blossoms, shards, SEED_LABELS, SHARD_LABELS };
  root.GFairyGarden = p => h(Svg, p, h("path", { d: "M4 12l8-8 8 8M6 10v10h12V10M10 20v-6h4v6M18 3v4M16 5h4M3 17c2-3 4-2 4 0" }));
  // 一局庭院（选好世界与存档之后的那一屏）。外面那层选择页在 FairyGardenApp。
  function GardenSession(props) {
    // 存档挂哪儿：庭院房给自己那把钥匙，首页试玩仍是公共那一档
    const storeKey = useRef(null); if (!storeKey.current) storeKey.current = props.storeKey || KEY;
    // 庭院房的同行者就是这间房的角色，没得选：进门那一刻就钉死，免得先闪一下选人页
    const t = useTheme(), initial = useRef(null), stalled = useRef("");
    if (!initial.current) {
      try {
        const d = read(storeKey.current);
        initial.current = (props.lockPartnerId && String(d.partnerId) !== String(props.lockPartnerId))
          ? write(storeKey.current, { ...d, partnerId: String(props.lockPartnerId) }) : d;
      } catch (e) {
        stalled.current = e.message;
        initial.current = { version: 1, id: "", partnerId: "", world: null, dialogs: {} };
      }
    }
    const [entry, setEntry] = useState(() => initial.current), [pick, setPick] = useState(!initial.current.partnerId), [solo, setSolo] = useState(false), [chat, setChat] = useState(false), [draft, setDraft] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [detail, setDetail] = useState(""), [loaded, setLoaded] = useState(false);
    const frame = useRef(null), alive = useRef(true), busyRef = useRef(false), propsRef = useRef(props), owner = useRef(initial.current.id), serial = useRef(0), messages = useRef(null); propsRef.current = props;
    useEffect(() => { alive.current = true; return () => { alive.current = false; serial.current++; if (frame.current) hosts.delete(frame.current.contentWindow); }; }, []);
    const current = () => {
      if (!alive.current) throw new Error("这个庭院页面已经离开了。");
      const d = loadJSON(storeKey.current, null); if (!d || d.id !== owner.current) throw new Error("存档已经切换，请重新进入庭院。"); return d;
    };
    const partner = () => (propsRef.current.characters || []).find(c => String(c.id) === String(current().partnerId)) || null;
    const update = fn => { const next = write(storeKey.current, fn(current())); setEntry(next); return next; };
    const game = () => frame.current && frame.current.contentWindow.FairyGardenGame;
    const flush = () => { const g = game(); if (g && !g.flush()) throw new Error("进度还没有保存成功，请先留在庭院。"); };
    const back = () => { try { flush(); serial.current++; props.onBack(); } catch (e) { setError(e.message); props.toast(e.message); } };
    const choose = id => {
      try { const old = loadJSON(storeKey.current, null); if (old && old.id !== owner.current) throw new Error("存档已经切换，请重新进入庭院。"); const d = old || initial.current; const next = write(storeKey.current, { ...d, partnerId: id || "" }); owner.current = next.id; setEntry(next); setSolo(!id); setPick(false); setLoaded(false); setError(""); setDetail(""); serial.current++; }
      catch (e) { setError(e.message); }
    };
    const changePartner = () => { if (props.lockPartnerId) { props.toast("这间庭院房就是和 TA 的，换人请另开一间。"); return; } if (busyRef.current) { props.toast("等这次回复完成后再换同行者。"); return; } try { flush(); serial.current++; setChat(false); setPick(true); } catch (e) { props.toast(e.message); } };
    const openChat = value => { setChat(value); if (game()) game().setChatOpen(value); };
    const planKey = (cid, day) => String(cid) + ":" + (current().world?.epoch || "initial") + ":" + root.FairyGardenRules.seasonOf(day).key;
    async function planSeason(retry) {
      if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
      const c=partner(); if(!c) throw new Error("先选择手机里的角色，再一起安排这一季。");
      flush(); const world=game().snapshot(), key=planKey(c.id,world.day), old=(current().plans||{})[key];
      if(old?.status==="ready")return old.plan;
      if(old?.status==="pending" && Date.now()-old.at<185000)throw new Error("上次请求还在处理，稍后再看看这一季。");
      if(old && !retry)throw new Error("上次安排没有完成，可以点重试。日常活动仍会继续。");
      const epoch=serial.current, request="season_"+Date.now()+"_"+Math.random().toString(36).slice(2), cid=c.id;
      const accountId=async()=>root.Cloud?.getSessionUser?String((await root.Cloud.getSessionUser().catch(()=>null))?.id||""):"";
      busyRef.current=true;setBusy(true);
      try {
        update(d=>({...d,plans:{...(d.plans||{}),[key]:{status:"pending",at:Date.now(),request}}}));
        const account=await accountId();if(!alive.current||serial.current!==epoch)throw Error("庭院已离开，这次安排没有写入。");current();
        const plan=await generateSeason({active:propsRef.current.apiFor?propsRef.current.apiFor(cid):propsRef.current.active,character:c,profile:propsRef.current.profile,world,mainline:propsRef.current.mainline});
        if(await accountId()!==account||!alive.current||serial.current!==epoch)throw Error("角色或账号已切换，这次安排没有写入。");
        const latest=current();if(String(latest.partnerId)!==String(cid)||!partner()||latest.plans?.[key]?.request!==request||planKey(cid,game().snapshot().day)!==key)throw Error("存档或季节已改变，这次安排没有写入。");
        update(d=>({...d,plans:{...(d.plans||{}),[key]:{status:"ready",at:Date.now(),plan}}}));
        game().refreshSeasonPlan();return plan;
      } catch(e) {
        if(alive.current&&serial.current===epoch)try{update(d=>d.plans?.[key]?.request===request?{...d,plans:{...d.plans,[key]:{status:"failed",at:Date.now(),error:e.message,detail:e.detail||""}}}:d);}catch(_){}
        throw e;
      } finally {busyRef.current=false;if(alive.current)setBusy(false);}
    }
    const bind = node => {
      if (frame.current && frame.current !== node) hosts.delete(frame.current.contentWindow); frame.current = node; if (!node) return;
      hosts.set(node.contentWindow, {
        load: () => current(), partner: () => { const c = partner(); return c ? { id: c.id, name: c.remark || c.name } : null; },
        save: world => { if (frame.current !== node) return false; if (JSON.stringify(world).length > 100000) throw new Error("庭院进度异常，暂未覆盖旧存档。"); const d = current(); write(storeKey.current, { ...d, world }); return true; },
        openChat: () => openChat(true), changePartner,
        // 收花笺：游戏那头走到花圃按下收，生成这一枪在这儿打（callAI 在父页）。
        // 一次把开好的全回了，回来由游戏自己写进存档。
        // 下潜时补一池碎片：一次调用出一批，接下来几层刨到的都是从这池里取
        dig: async depth => {
          const c = partner();
          if (!c) throw new Error("先选一位同行者，井里才有东西。");
          const epoch = serial.current;
          return await shards({
            active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
            character: c, profile: propsRef.current.profile, mainline: propsRef.current.mainline,
            world: (game() && game().snapshot()) || {}, depth: depth
          }).then(out => {
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这一批碎片没有写入。");
            return out;
          });
        },
        // 他自己来找你：走过来那一路是游戏算的，这一枪等她点了记号才打
        miss: async material => {
          if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const c = partner();
          if (!c) throw new Error("先选一位同行者。");
          const epoch = serial.current;
          busyRef.current = true; setBusy(true);
          try {
            const parts = await missLine({
              active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
              character: c, profile: propsRef.current.profile, mainline: propsRef.current.mainline,
              world: (game() && game().snapshot()) || {}, material: material
            });
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这句话没有写下来。");
            if (String(current().partnerId) !== String(c.id)) throw new Error("同行者已经换过，这句话没有写下来。");
            // ⚠️他说的话跟她问出来的那些落在同一处：不另开一本，不然聊天记录就有两份
            const record = propsRef.current.record;
            if (record) record.onTurn({ text: "", reply: parts.join("\n"), parts: parts });
            else update(old => ({ ...old, dialogs: { ...old.dialogs, [c.id]: ((old.dialogs || {})[c.id] || [])
              .concat(parts.map((part, i) => ({ id: "miss_" + Date.now() + "_" + i, role: "assistant", content: part, status: "done" }))).slice(-200) } }));
            return parts;
          } finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        bloom: async rows => {
          if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const c = partner();
          if (!c) throw new Error("先选一位同行者，花才有人回。");
          const epoch = serial.current;
          busyRef.current = true; setBusy(true);
          try {
            const out = await blossoms({
              active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
              character: c, profile: propsRef.current.profile, mainline: propsRef.current.mainline,
              world: (game() && game().snapshot()) || {}, seeds: rows
            });
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这几张花笺没有写入。");
            if (String(current().partnerId) !== String(c.id)) throw new Error("同行者已经换过，这几张花笺没有写入。");
            return out;
          } finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        planSeason, planState: day => { const d=current(); return (d.plans||{})[planKey(d.partnerId,day)]||null; },
        ready: () => {
          if (!alive.current) return;
          setLoaded(true);
          // 第一次进来给同行者一身默认：衣色取角色卡上那个色，发型按卡上写的性别。
          // ⚠️只在【这个存档还没设过】时给，之后一律听她挑的那一份。
          try {
            const g = frame.current && frame.current.contentWindow.FairyGardenGame;
            const c = partner();
            if (g && g.getLook && c) {
              const now = g.getLook();
              if (!now.companion || !now.companion.hair) {
                const ta = (typeof CharacterPronoun !== "undefined") ? CharacterPronoun.ta(c) : "TA";
                g.setLook('companion', {
                  hair: ta === "她" ? 'wavy' : ta === "他" ? 'korean' : 'hush',
                  cloth: c.color || '#729786'
                });
              }
            }
            pullLook();
          } catch (e) {/* 样貌是锦上添花，出错不许拦住进门 */}
        }
      });
    };
    // ── 说过的话只有一份 ────────────────────────────────────────────────
    // 庭院房里，那一份就是【这间房的聊天记录】（父页递来的 record.history）：
    // 主聊天那边翻得到，「能进记忆」「总结回主线」这些开关也才有东西可带。
    // 存档里只留还没落定的那几条（pending/failed）——重试要靠它认领，
    // 落定之后立刻交给房间，不在这儿留第二份。
    // 首页试玩没有房间可写，仍旧全存在自己的存档里（行为不变）。
    const record = props.record || null;
    const doneHistory = (d, cid) => record
      ? ((propsRef.current.record && propsRef.current.record.history) || [])
      : ((d.dialogs || {})[cid] || []).filter(m => m.status === "done");
    // ── 样貌（她 2026-09-16 接着要的）─────────────────────────────────────
    // 一个身体十二款头发，换一款是数据：这儿只管把选择递给游戏，存档由游戏那头写。
    // 清单从 apps/fairy-garden/doll.json 拿——发型名单和六个体型参数的上下限都在里面，
    // 由导模型那一步同时生成。界面上的名字/范围和模型里的网格/形态键永远对得上
    //（在这儿另写一份 JS 常量就是又一处要同步的）。
    const [dress, setDress] = useState(false);
    // 花册（她 2026-09-16 定的种花那条）：写字和翻册子在手机这一侧，走过去收在游戏那一侧
    const [book, setBook] = useState(false);
    const [garden, setGarden] = useState(null);
    const [bookTab, setBookTab] = useState("notes");   // notes=花册 / shards=碎片盒
    const [shardBox, setShardBox] = useState(null);
    const [things, setThings] = useState(null);
    const [museum, setMuseum] = useState(null);
    const [bottles, setBottles] = useState(null);
    const [crew, setCrew] = useState(null);
    const [bottleText, setBottleText] = useState("");
    const pullGarden = () => { const g = game(); if (!g) return;
      if (g.getGarden) setGarden(g.getGarden());
      if (g.getShards) setShardBox(g.getShards());
      if (g.getThings) setThings(g.getThings());
      if (g.getCollection) setMuseum(g.getCollection());
      if (g.getBottles) setBottles(g.getBottles());
      if (g.getNeighbors) setCrew(g.getNeighbors()); };
    const [who, setWho] = useState('companion');
    const [styles, setStyles] = useState(null);
    const [look, setLook] = useState({ me: {}, companion: {} });
    useEffect(() => {
      let on = true;
      fetch('apps/fairy-garden/doll.json?v=' + BUILD).then(r => r.json())
        .then(d => { if (on) setStyles(d); }).catch(() => {});
      return () => { on = false; };
    }, []);
    const pullLook = () => { const g = game(); if (g && g.getLook) setLook(g.getLook()); };
    // 她 2026-09-17：「为啥感觉体型拉杆没用」——拉杆一直是有用的，是这一页【整页盖住了游戏】，
    // 她拖的时候一个像素都看不见。这一页顶上留一条透明的窗（PREVIEW_BAND=30%），
    // 底下那一格就是游戏自己往窗里渲的那个小人。开这一页就告诉它渲谁，关了就收。
    useEffect(() => {
      const g = game(); if (!g || !g.preview) return;
      g.preview(dress ? who : null);
      return () => { const q = game(); if (q && q.preview) q.preview(null); };
    }, [dress, who, loaded]);
    const pushLook = patch => {
      const g = game(); if (!g || !g.setLook) return;
      if (!g.setLook(who, patch)) { props.toast("这次没存上，样貌还是原来的。"); return; }
      pullLook();
    };
    const char = (props.characters || []).find(c => String(c.id) === String(entry.partnerId));
    const localRows = (entry.dialogs && entry.dialogs[entry.partnerId]) || [];
    const rows = record
      ? (record.history || []).concat(localRows.filter(m => m && m.status !== "done"))
      : localRows;
    useEffect(() => { if (messages.current) messages.current.scrollTop = messages.current.scrollHeight; }, [rows.length, chat, busy]);
    // ⚠️这个提前 return 必须排在【所有 hook 之后】：排前面的话下面的 hook 这一帧不跑，
    //   React #310 直接白屏（test/hooks-order.test.js 钉着这条）。
    if (stalled.current) return h("div", { className: "h-full flex flex-col", style: { background: "#e4e9d7", color: "#344936" } },
      h(Head, { zh: "微光庭院", sub: "等一下再进来", bg: "transparent", ink: "#344936", onBack: props.onBack }),
      h("div", { style: { padding: "22px 20px", fontFamily: F_BODY, fontSize: 13, lineHeight: 2 } }, stalled.current));
    async function send(retry) {
      if (busyRef.current || !game()) return;
      const c = partner(); if (!c) { setError("先选一位角色入住庭院。"); return; }
      const pending = retry ? rows.findLast(m => m.role === "user" && m.status !== "done") : null;
      const text = String(pending ? pending.content : draft).trim(); if (!text) return;
      const request = "turn_" + Date.now() + "_" + Math.random().toString(36).slice(2), epoch = serial.current, cid = c.id;
      busyRef.current = true; setBusy(true); setError(""); setDetail("");
      try {
        flush(); const world = game().snapshot();
        const d = update(old => { const previous = (old.dialogs || {})[cid] || [], next = pending ? previous.map(m => m.id === pending.id ? { ...m, request, status: "pending" } : m) : previous.concat({ id: request, request, role: "user", content: text, status: "pending" }); return { ...old, dialogs: { ...old.dialogs, [cid]: next.slice(-200) } }; });
        setDraft("");
        const account = root.Cloud && root.Cloud.getSessionUser ? await root.Cloud.getSessionUser().catch(() => null) : null;
        if (!alive.current || serial.current !== epoch) return;
        current();
        const result = await ask({ active: propsRef.current.apiFor ? propsRef.current.apiFor(cid) : propsRef.current.active, character: c, profile: propsRef.current.profile, world, history: doneHistory(d, cid).slice(-30), text, mainline: propsRef.current.mainline });
        const accountNow = root.Cloud && root.Cloud.getSessionUser ? await root.Cloud.getSessionUser().catch(() => null) : null;
        if (!alive.current || serial.current !== epoch) return;
        const latest = current();
        if (String(latest.partnerId) !== String(cid) || !partner() || String(account && account.id || "") !== String(accountNow && accountNow.id || "") || !(latest.dialogs[cid] || []).some(m => m.request === request && m.status === "pending")) throw new Error("角色或存档已变更，这次回复没有写入。");
        if (record) {
          // 先把这一轮交给房间（它才是记录），再把存档里那条在途的撤掉——
          // 顺序反过来的话，中间那一瞬这句话谁都没有。
          propsRef.current.record.onTurn({ text: text, reply: result.reply, parts: result.parts });
          update(old => ({ ...old, dialogs: { ...old.dialogs, [cid]: (old.dialogs[cid] || []).filter(m => m.request !== request) } }));
        } else update(old => ({ ...old, dialogs: { ...old.dialogs, [cid]: old.dialogs[cid].map(m => m.request === request ? { ...m, status: "done" } : m).concat(result.parts.map((part, i) => ({ id: request + "_reply" + (i ? "_" + i : ""), role: "assistant", content: part, status: "done" }))).slice(-200) } }));
        // 他刚说的那句话浮到他头顶上（她 2026-09-17）。⚠️只是把已经收到的这句显示一遍，
        //   不另存一份、也不另发一次——聊天记录仍旧只有上面那一处。
        try { if (game() && game().speak) game().speak(result.parts); } catch (e) {}
        const accepted = game() && game().applyAction(result.action); if (!accepted) props.toast("回复已保存，这个动作暂时无法执行。");
      } catch (e) {
        if (alive.current && serial.current === epoch) { setError(e.message || "这次没能连上，稍后可以重试。"); setDetail(e.detail || ""); try { update(old => ({ ...old, dialogs: { ...old.dialogs, [cid]: (old.dialogs[cid] || []).map(m => m.request === request ? { ...m, status: "failed" } : m) } })); } catch (_) {} }
      } finally { busyRef.current = false; if (alive.current) setBusy(false); }
    }
    // ── 这一页的按键（她 2026-09-16：「那些按键的 ui 好拥挤」）─────────────
    // 病根是这些按钮从来没装修过：没字体、没圆角、字挤在一条边上，
    // 跟 app 别处那套（F_BODY + 圆角 + 该留的白）完全不是一家人。
    // 一份色板 + 三个形状写在这儿，下面各处都取这儿的，不再各写各的行内样式。
    const G = { ink: "#344936", soft: "#6e8060", line: "#d1dac2", paper: "#fffef5", deep: "#55704f" };
    const buttonStyle = { border: "1px solid #c8d5ba", borderRadius: 14, padding: "14px 16px", background: "#f6f7ea", color: "#426043", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.5, textAlign: "left" };
    // 描边药丸：顶栏那个「说话」、面板里的「换同行者」「重试」都用它，大小只差一档
    const pill = (small) => ({
      border: "1px solid " + G.line, borderRadius: 999,
      padding: small ? "5px 12px" : "7px 15px",
      background: "rgba(255,255,255,.55)", color: G.soft,
      fontFamily: F_BODY, fontSize: small ? 11 : 12.5, lineHeight: 1.4, whiteSpace: "nowrap"
    });
    if (!props.lockPartnerId && (pick || (!char && !solo))) return h("div", { className: "h-full flex flex-col", style: { background: "#e4e9d7", color: "#344936" } },
      h(Head, { zh: "微光庭院", sub: "选一位同行者", bg: "transparent", ink: "#344936", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: 20 } },
        h("p", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.9, marginBottom: 20, color: G.soft } }, "一起种花、探索林地，也可以边玩边聊。这里有独立的时间与经历。"),
        h("div", { style: { display: "grid", gap: 11 } }, (props.characters || []).map(c => h("button", { key: c.id, style: buttonStyle, onClick: () => choose(c.id) }, c.remark || c.name)),
          h("button", { style: buttonStyle, onClick: () => choose("") }, "先和示例同行者试玩")),
        !(props.characters || []).length && h("p", { style: { marginTop: 18, fontFamily: F_BODY, fontSize: 12, color: G.soft } }, "也可以先去人格档案馆创建角色。"),
        error && h("p", { role: "alert", style: { color: "#a34836", marginTop: 14, fontFamily: F_BODY, fontSize: 12.5 } }, error)));
    return h("div", { className: "h-full flex flex-col", style: { background: "#e4e9d7", color: "#344936" } },
      h(Head, { zh: "微光庭院", sub: char ? "与 " + (char.remark || char.name) + " 同行" : "自由试玩", bg: "transparent", ink: "#344936", onBack: back,
        // ⚠️开着花册/样貌时只留一个「回庭院」：三颗药丸并排会把标题挤扁
        right: (book || dress)
          ? h("button", { style: pill(), onClick: () => { setBook(false); setDress(false); } }, "回庭院")
          : h("div", { style: { display: "flex", gap: 7 } },
            h("button", { style: { ...pill(), opacity: loaded ? 1 : .45 }, onClick: () => { pullGarden(); setBook(true); }, disabled: !loaded }, "花册"),
            h("button", { style: { ...pill(), opacity: loaded ? 1 : .45 }, onClick: () => { pullLook(); setDress(true); }, disabled: !loaded }, "样貌"),
            h("button", { style: { ...pill(), opacity: loaded ? 1 : .45 }, onClick: () => openChat(!chat), disabled: !loaded }, chat ? "收起" : "说话")) }),
      h("div", { className: "flex-1 min-h-0", style: { position: "relative" } },
        h("iframe", { ref: bind, title: "微光庭院游戏", src: "apps/fairy-garden/index.html?embedded=1&v=" + BUILD, style: { width: "100%", height: "100%", border: 0, display: "block" }, onLoad: () => { if (game()) setLoaded(true); } }),
        !loaded && h("div", { style: { position: "absolute", top: 25, left: 0, right: 0, textAlign: "center", fontSize: 12, pointerEvents: "none" } }, "正在推开庭院的门…"),
        // ⚠️整页盖住游戏，而不是新开一屏：iframe 一旦卸载，这一局的进度就没了。
        book && h("div", { style: { position: "absolute", inset: 0, background: "#e9ecdd", overflowY: "auto", WebkitOverflowScrolling: "touch" } },
          // ⚠️这一册在现实里就是一本【册子】，所以 tab 长成册子边上伸出来的索引签：
          //   上圆下方、贴着页边，选中那张满高、纸色，直接长进底下那一页里；
          //   没选的往下缩一截、暗着，像压在后面几页（施工规则/tabs-not-plain-pills.md）。
          //   选中态不只靠颜色：高度、纸色、底下那条缝三样一起变。
          h("div", { style: { display: "flex", alignItems: "flex-end", gap: 3, padding: "10px 12px 0", background: "rgba(255,255,255,.3)" } },
            [["notes", "花册", ((garden && garden.notes) || []).length],
             ["shards", "碎片盒", ((shardBox && shardBox.rows) || []).length],
             ["things", "屋里", ((things && things.rows) || []).length],
             ["museum", "收藏馆", ((museum && museum.rows) || []).length],
             ["bottle", "漂流瓶", ((bottles && bottles.floating) || []).length],
             ["crew", "邻居", ((crew && crew.rows) || []).length]].map(([k, label, n]) => {
              const on = bookTab === k;
              return h("button", { key: k, onClick: () => setBookTab(k), className: "flex-1 active:opacity-80",
                style: { padding: on ? "12px 0 13px" : "8px 0 9px", fontFamily: F_BODY, fontSize: on ? 13 : 12,
                  color: on ? G.ink : "#93a188", background: on ? G.paper : "rgba(226,232,213,.75)",
                  border: "1px solid " + G.line, borderBottom: on ? "1px solid " + G.paper : "1px solid " + G.line,
                  borderRadius: "11px 11px 0 0", marginBottom: on ? -1 : 0, position: "relative", zIndex: on ? 2 : 1 } },
                label + (n ? " " + n : "")); })),
          h("div", { style: { height: 1, background: G.line, marginTop: 0 } }),
          bookTab === "crew" ? h("div", { style: { padding: "16px 16px 40px" } },
            // ── 邻居（她 2026-09-17：「更像邻居关系」）。三间屋就是三个名额。
            // ⚠️他们走路用的是【跟同行者同一套】控制器和布偶，只是各跑一份。
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "村里有三间邻居屋。请谁住进来，谁就在村里过自己的日子——早上出门、去集市、傍晚回自己门前，你走在村里会碰见。碰过面的会记进村里的账，公告栏上的委托也开始落他们的名字。"),
            ((crew && crew.rows) || []).length ? h("div", { style: { display: "grid", gap: 10, marginBottom: 18 } },
              crew.rows.map(n => h("div", { key: n.charId, style: { borderRadius: 14, border: "1px solid " + G.line, background: "rgba(255,255,255,.6)", padding: "11px 13px" } },
                h("div", { className: "flex items-baseline justify-between", style: { gap: 8 } },
                  h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: G.ink } }, n.name),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } }, n.houseLabel)),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 5 } },
                  n.here ? "这会儿在" + (n.where || n.map) : "这会儿在" + n.map),
                // 碰见：走在村里照过几次面。⚠️这个数只数【她自己碰见的】，
                //   邻居之间碰得再多也不是她的交情（world.mjs 的 metCount 就是这么算的）。
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#93a188", marginTop: 4 } },
                  n.met ? "碰见过 " + n.met + " 次 · " + n.closeness : "还没在路上碰见过"),
                h("button", { onClick: () => { const g = game(); if (!g || !g.moveOut) return;
                    const err = g.moveOut(n.charId);
                    if (err) { props.toast(err); return; } pullGarden(); props.toast(n.name + "搬走了。"); },
                  className: "active:opacity-60",
                  style: { marginTop: 8, fontFamily: F_BODY, fontSize: 10.5, color: "#a08d86", background: "transparent" } },
                  "请 TA 搬走"))))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, lineHeight: 1.9, marginBottom: 16 } },
                  "三间屋都空着。"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 9 } },
              (crew && crew.free) ? "请谁搬进来" : "三间都住满了"),
            (crew && crew.free) ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7 } },
              (props.characters || []).filter(c => String(c.id) !== String(entry.partnerId)
                && !((crew && crew.rows) || []).some(n => String(n.charId) === String(c.id)))
                .slice(0, 40).map(c => h("button", { key: c.id, className: "active:opacity-70",
                  onClick: () => { const g = game(); if (!g || !g.moveIn) return;
                    const err = g.moveIn({ charId: c.id, name: c.remark || c.name, look: {} });
                    if (err) { props.toast(err); return; } pullGarden(); props.toast((c.remark || c.name) + "搬进来了。"); },
                  style: { ...pill(true), borderColor: G.line, color: G.soft, background: "rgba(255,255,255,.55)" } },
                  c.remark || c.name)))
              : null)
          :           bookTab === "bottle" ? h("div", { style: { padding: "16px 16px 40px" } },
            // ── 漂流瓶：⚠️这一条一个字都不生成。漂回来的全是【已经在存档里的东西】，
            //    她自己封的那句，或者以前的花笺、刨到过的碎片、留在馆里的那一件。
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "写一句话封进瓶子里放下水，" + ((bottles && bottles.days) || 7) + " 天以后它会漂回来。走到月潭栈桥那儿捞，一天一只。"),
            h("textarea", { value: bottleText, onChange: e => setBottleText(e.target.value), rows: 2, maxLength: 120,
              placeholder: "想对几天后的自己说什么？",
              style: { width: "100%", border: "1px solid " + G.line, background: G.paper, borderRadius: 14, padding: "10px 12px",
                fontFamily: F_BODY, fontSize: 14, color: G.ink, outline: "none", resize: "none" } }),
            h("button", { className: "w-full active:opacity-70",
              onClick: () => { const g = game(); if (!g || !g.seal) return;
                const err = g.seal(bottleText);
                if (err) { props.toast(err); return; }
                setBottleText(""); pullGarden(); props.toast("放下水了，" + ((bottles && bottles.days) || 7) + " 天以后见。"); },
              style: { marginTop: 9, border: 0, borderRadius: 999, padding: "11px 0", background: G.deep, color: "#f7faf2", fontFamily: F_BODY, fontSize: 13.5 } },
              "放下水"),
            ((bottles && bottles.floating) || []).length ? h("div", { style: { marginTop: 20 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 8 } }, "还在水里的"),
              bottles.floating.map(b => h("div", { key: b.id, style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, lineHeight: 1.8, padding: "8px 0", borderBottom: "1px solid rgba(209,218,194,.6)" } },
                b.text + " · 还有 " + b.backIn + " 天漂回来"))) : null,
            ((bottles && bottles.drifts) || []).length ? h("div", { style: { marginTop: 22 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 8 } }, "捞上来过的"),
              h("div", { style: { display: "grid", gap: 10 } },
                bottles.drifts.map((d, i) => h("div", { key: (d.id || "") + ":" + i, style: { borderRadius: 14, border: "1px solid " + G.line, background: "rgba(255,255,255,.6)", padding: "11px 13px" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } },
                    "第 " + d.day + " 天捞到 · " + (d.kind === "mine" ? "自己封的" : d.kind === "note" ? "旧花笺" : d.kind === "shard" ? "井里的碎片" : "馆里的一件") + "（第 " + d.from + " 天）"),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: G.ink, marginTop: 6, lineHeight: 1.85, whiteSpace: "pre-wrap" } }, d.text))))) : null)
          :           bookTab === "museum" ? h("div", { style: { padding: "16px 16px 40px" } },
            // ── 收藏馆：三个位置摆不下的那些的【出口】。捐进去的永不删除，
            //    炼金笔记的全表由 world.mjs 一处生成，这儿只负责显示（别再抄一份）
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "留在收藏馆里的东西会一直摆着——背包会被挤掉，这一份不会。走进村南那间小馆才能留。"),
            // ⚠️馆里那几件排在前面：笔记有三十行，其中二十多行是「？」，
            //   摆在上面就把她真正捐进去的那几件压到屏幕外头去了。
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 8 } },
              "馆里摆着的 " + ((museum && museum.rows) || []).length + " 件"),
            ((museum && museum.rows) || []).length ? h("div", { style: { display: "grid", gap: 10 } },
              museum.rows.map(t => h("div", { key: t.id, style: { borderRadius: 14, border: "1px solid " + G.line, background: "rgba(255,255,255,.6)", padding: "11px 13px" } },
                h("div", { className: "flex items-baseline justify-between", style: { gap: 8 } },
                  h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: G.ink } }, t.name),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } }, "第 " + t.gaveDay + " 天捐的")),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, marginTop: 5, lineHeight: 1.7 } }, t.note),
                t.from ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#93a188", marginTop: 5, lineHeight: 1.6 } }, "用的那一片：" + t.from) : null)))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, lineHeight: 1.9 } },
                  "还空着。做好一样东西，走进收藏馆把它留在那儿。"),
            // 炼金笔记：做成过的写出名字，没做成过的只留一行材料——那是线索，不是清单
            h("div", { style: { marginTop: 24, display: "flex", alignItems: "baseline", justifyContent: "space-between" } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink } }, "炼金笔记"),
              h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: G.soft } },
                "做成过 " + ((museum && museum.made) || []).length + " / " + ((museum && museum.total) || 0) + " 种")),
            h("div", { style: { display: "grid", gap: 6, marginTop: 8 } },
              ((museum && museum.recipes) || []).filter(r => (museum.made || []).indexOf(r.key) > -1).map(r =>
                h("div", { key: r.key, style: { display: "flex", alignItems: "baseline", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(209,218,194,.55)" } },
                  h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: G.ink, flex: 1 } }, r.name),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } }, r.how)))),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#93a188", marginTop: 12, lineHeight: 1.9 } },
              "还没做出来的：" + ((museum && museum.recipes) || []).filter(r => (museum.made || []).indexOf(r.key) < 0)
                .map(r => r.how).join("、")))
          :           bookTab === "things" ? h("div", { style: { padding: "16px 16px 40px" } },
            // ── 屋里：锅炼出来的东西。⚠️这一整条链一枪都不打，全是代码算的
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "用碎片在锅里做出来的东西。能摆的摆出来——真下雨的时候，屋檐下的雨铃会响。"),
            ((things && things.rows) || []).length ? h("div", { style: { display: "grid", gap: 10 } },
              things.rows.map(t => h("div", { key: t.id, style: { borderRadius: 14, border: "1px solid " + (t.spot ? G.deep : G.line), background: "rgba(255,255,255,.6)", padding: "11px 13px" } },
                h("div", { className: "flex items-baseline justify-between", style: { gap: 8 } },
                  h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: G.ink } }, t.name),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } },
                    (things.ways[t.way] ? things.ways[t.way].label : "") + " · 第 " + t.day + " 天")),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, marginTop: 5, lineHeight: 1.7 } },
                  t.ready ? t.note : "还封着，第 " + t.openDay + " 天才能打开。"),
                !t.ready ? h("button", { className: "active:opacity-70",
                  onClick: () => { const g = game(); if (!g || !g.hasten) return;
                    const err = g.hasten(t.id);
                    if (err) { props.toast(err); return; } pullGarden(); props.toast("倒了一滴月露，今天就能开。"); },
                  disabled: !((things && things.potions) > 0),
                  style: { ...pill(true), marginTop: 8, borderColor: G.line, color: ((things && things.potions) > 0) ? G.deep : "#b3bfa6",
                    background: "rgba(255,255,255,.55)" } },
                  ((things && things.potions) > 0) ? "倒一滴月露 · 今天就开" : "倒一滴月露（没有月露了）") : null,
                t.from ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#93a188", marginTop: 5, lineHeight: 1.6 } }, "用的那一片：" + t.from) : null,
                t.ready ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 9 } },
                  Object.entries(things.spots).map(([k, label]) =>
                    h("button", { key: k, className: "active:opacity-70",
                      onClick: () => { const g = game(); if (!g || !g.place) return;
                        const err = g.place(t.id, t.spot === k ? null : k);
                        if (err) { props.toast(err); return; } pullGarden(); },
                      style: { ...pill(true), borderColor: t.spot === k ? G.deep : G.line, color: t.spot === k ? G.ink : G.soft,
                        background: t.spot === k ? "rgba(85,112,79,.12)" : "rgba(255,255,255,.55)" } },
                      t.spot === k ? "已摆在" + label : "摆到" + label))) : null)))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, lineHeight: 1.9 } },
                  "还没有。下井刨一片碎片回来，走到炼药锅那儿做点东西。"))
          : bookTab === "shards" ? h("div", { style: { padding: "16px 16px 40px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "井底石头里刨出来的东西。越深的只是越完整、越奇怪，不是越沉重。"),
            ((shardBox && shardBox.rows) || []).length ? h("div", { style: { display: "grid", gap: 10 } },
              shardBox.rows.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map(sh =>
                h("div", { key: sh.id, style: { borderRadius: 14, border: "1px solid " + (sh.pinned ? G.deep : G.line), background: "rgba(255,255,255,.6)", padding: "11px 13px" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } },
                    "〔" + ((shardBox.kinds && shardBox.kinds[sh.kind]) || "碎片") + "〕第 " + sh.depth + " 层 · 第 " + sh.day + " 天" + (sh.whole ? " · 完整的一片" : "")),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: G.ink, marginTop: 6, lineHeight: 1.85, whiteSpace: "pre-wrap" } }, sh.text),
                  h("button", { onClick: () => { const g = game(); if (g && g.pinShard) { g.pinShard(sh.id); pullGarden(); } }, className: "active:opacity-60",
                    style: { marginTop: 7, fontFamily: F_BODY, fontSize: 10.5, color: sh.pinned ? G.deep : "#93a188", background: "transparent" } },
                    sh.pinned ? "已钉住" : "钉住"))))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, lineHeight: 1.9 } },
                  "还没有。从屋边那口井下去，石头里有东西。"),
            shardBox && shardBox.busy ? h("div", { style: { marginTop: 12, fontFamily: F_BODY, fontSize: 11.5, color: G.soft } }, "正在读这一层的石头…") : null,
            // ⚠️封出去的那几片【还读得到】——施法不烧掉碎片，这是它的另一半
            ((shardBox && shardBox.casts) || []).length ? h("div", { style: { marginTop: 22 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 8 } }, "封出去的"),
              h("div", { style: { display: "grid", gap: 10 } },
                shardBox.casts.map((c, i) => h("div", { key: c.place + ":" + i, style: { borderRadius: 14, border: "1px dashed " + G.line, background: "rgba(255,255,255,.45)", padding: "11px 13px" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } },
                    "〔" + c.spell + "〕封在" + c.place + " · 第 " + c.day + " 天"),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: G.soft, marginTop: 6, lineHeight: 1.85, whiteSpace: "pre-wrap" } }, c.text))))) : null,
            ((shardBox && shardBox.spells) || []).length ? h("div", { style: { marginTop: 20 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 6 } }, "会念的咒"),
              shardBox.spells.map(sp => h("div", { key: sp.id, style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, padding: "5px 0" } },
                sp.name + " · 要" + sp.need + " —— " + sp.note))) : null)
          : h("div", { style: { padding: "16px 16px 40px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "走到花圃那儿种一句下去，过三天开花。开好了再走过去收——" + (char ? (char.remark || char.name) : "同行者") + "会在花笺上回你一句。"),
            // 地里的
            ((garden && garden.seeds) || []).length ? h("div", { style: { marginTop: 20 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 8 } }, "地里的"),
              garden.seeds.map(sd => h("div", { key: sd.id, style: { fontFamily: F_BODY, fontSize: 12, color: G.soft, lineHeight: 1.7, padding: "7px 0", borderBottom: "1px solid rgba(209,218,194,.6)" } },
                "〔" + (garden.kinds[sd.kind] || "今天") + "〕" + (sd.ask || "（只种了一个念头）") + " · " + (sd.bloomIn > 0 ? "还有 " + sd.bloomIn + " 天开" : "开好了，去花圃收")))) : null,
            // 花册
            h("div", { style: { marginTop: 22, display: "flex", alignItems: "baseline", justifyContent: "space-between" } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink } }, "花册"),
              h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: G.soft } },
                ((garden && garden.notes) || []).length ? "共 " + garden.notes.length + " 张" : "还没有")),
            h("div", { style: { marginTop: 8, display: "grid", gap: 10 } },
              ((garden && garden.notes) || []).slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map(nt =>
                h("div", { key: nt.id, style: { borderRadius: 14, border: "1px solid " + (nt.pinned ? G.deep : G.line), background: "rgba(255,255,255,.6)", padding: "11px 13px" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } },
                    "第 " + nt.day + " 天 ·〔" + ((garden.kinds && garden.kinds[nt.kind]) || "今天") + "〕"),
                  nt.ask ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 4, lineHeight: 1.6 } }, "你问：" + nt.ask) : null,
                  h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: G.ink, marginTop: 6, lineHeight: 1.85, whiteSpace: "pre-wrap" } }, nt.reply),
                  h("button", { onClick: () => { const g = game(); if (g && g.pinNote) { g.pinNote(nt.id); pullGarden(); } }, className: "active:opacity-60",
                    style: { marginTop: 7, fontFamily: F_BODY, fontSize: 10.5, color: nt.pinned ? G.deep : "#93a188", background: "transparent" } },
                    nt.pinned ? "已钉住" : "钉住")))))),
        dress && h("div", { style: { position: "absolute", inset: 0, background: "transparent", pointerEvents: "none" } },
          // ⚠️这条 30% 高的窗要【真的透明】：底下就是游戏，游戏往这儿渲要换的那个小人。
          //   高度必须和 game.mjs 的 PREVIEW_BAND 对上，改一处就得改两处——所以两边都写着对方。
          h("div", { style: { position: "absolute", left: 0, right: 0, top: 0, height: "30%" } }),
          h("div", { style: { position: "absolute", left: 0, right: 0, top: "30%", bottom: 0, background: "#e9ecdd", overflowY: "auto", WebkitOverflowScrolling: "touch", pointerEvents: "auto", boxShadow: "0 -12px 30px #30442615" } },
          // 两个人：一排底线 tab，不是一排药丸（施工规则/tabs-not-plain-pills.md）
          h("div", { style: { display: "flex", borderBottom: "1px solid " + G.line, background: "rgba(255,255,255,.4)" } },
            [["companion", char ? (char.remark || char.name) : "同行者"], ["me", "我"]].map(([k, label]) =>
              h("button", { key: k, onClick: () => setWho(k), className: "flex-1 active:opacity-70",
                style: { padding: "12px 0", fontFamily: F_BODY, fontSize: 13.5, color: who === k ? G.ink : "#93a188",
                  borderBottom: "2px solid " + (who === k ? G.deep : "transparent"), background: "transparent" } }, label))),
          h("div", { style: { padding: "16px 16px 40px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              who === "companion" && char
                ? "换的是 " + (char.remark || char.name) + " 在这个庭院里的样子，只在这一个存档里算数。"
                : "换的是你自己在这个庭院里的样子。"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 9 } }, "发型"),
            h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 } },
              Object.entries((styles && styles.hair) || {}).map(([key, label]) => {
                const on = ((look[who] || {}).hair || "") === key;
                return h("button", { key: key, onClick: () => pushLook({ hair: key }), className: "active:opacity-70",
                  style: { padding: "11px 6px", borderRadius: 13, border: "1px solid " + (on ? G.deep : G.line),
                    background: on ? "rgba(85,112,79,.12)" : "rgba(255,255,255,.55)",
                    fontFamily: F_BODY, fontSize: 12, lineHeight: 1.45, color: on ? G.ink : G.soft } }, label);
              })),
            !styles && h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.soft } }, "发型名单还没读进来…"),
            // 体型：六根滑杆，1 是中性。上下限来自 doll.json（＝Blender 里那份 LIMITS）
            ((styles && styles.dims) || []).length ? h("div", { style: { marginTop: 22 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 4 } }, "体型"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: G.soft, marginBottom: 10, lineHeight: 1.7 } }, "都从中间那一档开始；拖动时小人当场就变。"),
              styles.dims.map(d => {
                const cur = Number(((look[who] || {}).dims || {})[d.key]);
                const value = isFinite(cur) ? cur : 1;
                return h("div", { key: d.key, style: { marginBottom: 14 } },
                  h("div", { className: "flex items-center justify-between", style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginBottom: 3 } },
                    h("span", null, d.label),
                    h("button", { onClick: () => pushLook({ dims: { [d.key]: 1 } }), className: "active:opacity-60",
                      style: { fontFamily: F_BODY, fontSize: 10.5, color: Math.abs(value - 1) < .005 ? "transparent" : G.deep, background: "transparent" } }, "回到中间")),
                  h("input", { type: "range", min: d.min, max: d.max, step: .01, value: value,
                    onChange: e => pushLook({ dims: { [d.key]: Number(e.target.value) } }),
                    style: { width: "100%", accentColor: G.deep } }));
              })) : null,
            [["hairColor", "发色", HAIR_COLORS], ["cloth", "衣服颜色", CLOTH_COLORS]].map(([field, label, palette]) =>
              h("div", { key: field, style: { marginTop: 20 } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 9 } }, label),
                h("div", { style: { display: "flex", flexWrap: "wrap", gap: 10 } }, palette.map(hex => {
                  const on = String((look[who] || {})[field] || "").toLowerCase() === hex;
                  return h("button", { key: hex, onClick: () => pushLook({ [field]: hex }), "aria-label": label + hex,
                    className: "active:opacity-70",
                    style: { width: 36, height: 36, borderRadius: 999, background: hex,
                      border: on ? "2px solid " + G.ink : "1px solid rgba(0,0,0,.12)", boxShadow: on ? "0 0 0 3px rgba(255,255,255,.75) inset" : "none" } });
                }))))))),
        chat && !dress && !book && h("section", { "aria-label": "庭院聊天", style: { position: "absolute", left: 8, right: 8, bottom: 0, maxHeight: "52%", display: "flex", flexDirection: "column", background: "rgba(250,250,238,.97)", border: "1px solid " + G.line, borderTop: "1px solid " + G.line, borderRadius: "22px 22px 0 0", boxShadow: "0 -10px 34px #3044261f" } },
          // 抓手：一眼看出这层是能收起来的，也把面板和游戏画面隔开
          h("div", { style: { width: 34, height: 4, borderRadius: 999, background: G.line, margin: "8px auto 0" } }),
          h("div", { style: { padding: "9px 16px 8px", display: "flex", alignItems: "center", gap: 10 } },
            h("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: F_BODY, fontSize: 12, color: G.soft } },
              char ? "和 " + (char.remark || char.name) + " 说话" : "选一位角色，开始聊天"),
            props.lockPartnerId ? null : h("button", { onClick: changePartner, disabled: busy, style: { ...pill(true), opacity: busy ? .45 : 1 } }, "换同行者")),
          h("div", { ref: messages, className: "min-h-0 overflow-y-auto", style: { padding: "2px 16px 4px", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.85, minHeight: 64, maxHeight: "34vh" } },
            rows.map(m => h("div", { key: m.id, style: { margin: "0 0 13px" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".06em", color: "#93a188", marginBottom: 2 } }, m.role === "user" ? "你" : (char && (char.remark || char.name) || "同行者")),
              h("div", { style: { whiteSpace: "pre-wrap", color: m.role === "user" ? G.soft : G.ink } }, m.content))),
            !rows.length && h("p", { style: { margin: "6px 0 12px", color: "#93a188" } }, "想聊什么，或者想一起去哪里？"),
            busy && h("p", { role: "status", style: { margin: "0 0 12px", color: "#93a188" } }, "正在回应…"),
            error && h("p", { role: "alert", style: { margin: "0 0 10px", color: "#a34836" } }, error),
            detail && h("details", { style: { marginBottom: 10 } }, h("summary", { style: { fontSize: 11, color: G.soft } }, "查看原始回复"), h("pre", { style: { whiteSpace: "pre-wrap", fontSize: 10, marginTop: 6 } }, detail))),
          !busy && rows.some(m => m.role === "user" && m.status !== "done") && h("div", { style: { padding: "0 16px 8px" } },
            h("button", { style: pill(true), onClick: () => send(true) }, "重试上次未完成的回复")),
          h("form", { onSubmit: e => { e.preventDefault(); send(false); }, style: { display: "flex", alignItems: "center", gap: 9, padding: "9px 12px 11px", paddingBottom: COMPOSER_PAD_BOTTOM, borderTop: "1px solid rgba(209,218,194,.7)" } },
            h("input", { "aria-label": "对同行者说", value: draft, onChange: e => setDraft(e.target.value), disabled: busy || !char, maxLength: 12000, placeholder: char ? "和同行者说句话…" : "先选择角色", style: { flex: 1, minWidth: 0, border: "1px solid " + G.line, background: G.paper, borderRadius: 999, padding: "11px 15px", fontFamily: F_BODY, fontSize: 16, color: G.ink, outline: "none" } }),
            h("button", { type: "submit", disabled: busy || !char || !draft.trim(), style: { flexShrink: 0, border: 0, borderRadius: 999, padding: "11px 17px", background: G.deep, color: "#f7faf2", fontFamily: F_BODY, fontSize: 13.5, opacity: (busy || !char || !draft.trim()) ? .38 : 1 } }, "发送")))));
  }

  // ── 进门那两页（她 2026-09-16：「先做个进入页面…再来到存档…新建或者开启已有」）──
  // 一层是【去哪个世界】，一层是【开哪一档】。庭院房那条路不走这儿：
  // 一间房就是一个世界一个存档，进门直接落到桌上（见 app.js 的 storeKey/lockPartnerId）。
  const WORLDS = [
    { id: "garden", name: "微光庭院", note: "种花、下井、和同行者一起把日子过下去", ready: true },
    { id: "academy", name: "晨雾学院", note: "课表、委托板、校规与同窗" },
    { id: "market", name: "潮汐集市", note: "赶集、讲价、把东西送给该送的人" },
    { id: "rail", name: "云上列车", note: "一段路，一车厢陌生人" }
  ];
  const INDEX_KEY = "x_fairyGardenSaves";
  // legacy＝原来那一档，钥匙仍是原来那把；扫回来的房间存档 id 自带 ":" 开头
  const saveKeyOf = row => { const id = typeof row === "string" ? row : (row && row.id); return (row && row.key) || (id === "legacy" ? KEY : KEY + ":" + id); };
  // 老的那一档（KEY 里躺着的那份）要认回来当一条存档。
  // ⚠️绝不搬它的内容：搬＝复制一份再删一份，中间任何一步断掉就少一档。
  //   只在名册里记一笔，它的钥匙仍旧是原来那把。
  function readSaves() {
    const rows = (loadJSON(INDEX_KEY, []) || []).filter(x => x && x.id).map(x => ({
      id: String(x.id), world: String(x.world || "garden"),
      name: String(x.name || "").slice(0, 24), ts: Number(x.ts) || 0
    }));
    const legacy = loadJSON(KEY, null);
    if (legacy && legacy.id && !rows.some(x => x.id === "legacy")) {
      rows.unshift({ id: "legacy", world: "garden", name: "原来那一档", ts: 0 });
      saveJSON(INDEX_KEY, rows);
    }
    // ⚠️名册对不上时以【存档本身】为准（她 2026-09-16：「我回不到有花园的小屋了」）。
    //   名册只是一张目录，它丢了一行、或者这一档本来就不是从这儿建的（比如聊天里的
    //   庭院房），存档都还好好躺在那儿。所以再扫一遍真正存在的键，没登记的认回来——
    //   宁可多列一行，也不能让一段日子从界面上消失。
    //   （先例：设置 → 数据 →「找回失联的角色」。）
    try {
      // 存档已经搬进 IDB（engine.js 的 IDB_TEXT_PREFIXES），localStorage 里多半只剩
      // 还没迁完的那几个，所以两边都要扫一遍，谁也别落下。
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      try { (typeof window !== "undefined" && window.__txtMirror ? window.__txtMirror : new Map()).forEach((v, k) => keys.push(k)); } catch (e) {}
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!key || key.indexOf(KEY + ":") !== 0) continue;
        const id = key.slice(KEY.length + 1);
        if (!id || rows.some(x => x.id === id)) continue;
        const room = key.indexOf("::room::") > -1;
        // ⚠️房间那种键是 x_fairyGarden::角色::room::房号，切出来的 id 自己带冒号。
        //   所以这一行连【整把钥匙】一起记下来，别再去拼一次（拼错就又打不开了）。
        rows.push({ id: id, key: key, world: "garden", name: room ? "聊天里的庭院房" : "找回的一档", ts: 0, found: true });
      }
    } catch (e) {/* 隐私模式下读不到就算了，不连累这一页 */}
    return rows;
  }
  function saveMeta(row) {
    const d = loadJSON(saveKeyOf(row), null) || {};
    const w = d.world || {};
    return {
      day: Number(w.day) || 0,
      partnerId: String(d.partnerId || ""),
      fresh: !d.world
    };
  }
  root.FairyGardenApp = function FairyGardenApp(props) {
    const t = useTheme();
    // 庭院房那条路：房间就是世界也是存档，不用选
    if (props.storeKey || props.lockPartnerId) return h(GardenSession, props);
    const [world, setWorld] = useState(null);
    const [saves, setSaves] = useState(() => readSaves());
    const [openId, setOpenId] = useState(null);
    const G = { ink: "#344936", soft: "#6e8060", line: "#d1dac2", deep: "#55704f" };
    const refresh = () => setSaves(readSaves());
    // openId 存的是【整把钥匙】，不是 id：房间那种键拼不回来（见 readSaves 的注释）
    if (openId) return h(GardenSession, Object.assign({}, props, {
      key: openId, storeKey: openId, onBack: () => { setOpenId(null); refresh(); }
    }));
    const card = (onClick, dim, children) => h("button", {
      onClick: dim ? undefined : onClick, disabled: !!dim, className: dim ? "w-full text-left" : "w-full text-left active:opacity-70",
      style: { padding: "15px 16px", borderRadius: 16, border: "1px solid " + G.line,
        background: dim ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.62)", opacity: dim ? .55 : 1 }
    }, children);
    const shell = (sub, onBack, body) => h("div", { className: "h-full flex flex-col", style: { background: "#e4e9d7", color: G.ink } },
      h(Head, { zh: "微光庭院", sub: sub, bg: "transparent", ink: G.ink, onBack: onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 18px 36px" } }, body));

    // 仓没打开时名册也读不全：这时候让她建新档，会把一份残缺的名册写回去（名字、时间都没了）。
    const stall = vaultStalled(INDEX_KEY);
    if (stall) return shell("等一下再进来", props.onBack,
      h("p", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 2, color: G.soft, margin: "10px 0" } }, stall));
    if (!world) return shell("挑一个世界", props.onBack, h(React.Fragment, null,
      h("p", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.9, color: G.soft, margin: "6px 0 18px" } },
        "每个世界有自己的时间、地图和存档。现在开着的只有微光庭院，别的还在长。"),
      h("div", { style: { display: "grid", gap: 11 } }, WORLDS.map(w => card(() => setWorld(w), !w.ready,
        h(React.Fragment, null,
          h("div", { className: "flex items-center justify-between", style: { gap: 10 } },
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: G.ink } }, w.name),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: w.ready ? G.deep : "#93a188" } }, w.ready ? "可以进" : "敬请期待")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 5, lineHeight: 1.6 } }, w.note)))))));

    const rows = saves.filter(x => x.world === world.id);
    const create = () => {
      const id = "g_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
      const next = [{ id, world: world.id, name: "", ts: Date.now() }, ...readSaves()];
      if (!saveJSON(INDEX_KEY, next)) { props.toast("这次没能记下新存档，先别关。"); return; }
      setSaves(next); setOpenId(saveKeyOf({ id: id }));
    };
    const drop = row => requestAppConfirm("删掉这一档？",
      "这一档里的日子、背包和聊过的话会一起删掉，找不回来。",
      () => {
        const next = readSaves().filter(x => x.id !== row.id);
        saveJSON(INDEX_KEY, next);
        try { dropStored(saveKeyOf(row)); } catch (e) {}
        setSaves(next);
      }, "删掉");
    return shell("选一档 · " + world.name, () => setWorld(null), h(React.Fragment, null,
      h("p", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.9, color: G.soft, margin: "6px 0 16px" } },
        "选一档接着过，或者从头开一段新的。"),
      h("div", { style: { display: "grid", gap: 11 } },
        rows.map((row, i) => {
          const meta = saveMeta(row);
          const partner = (props.characters || []).find(c => String(c.id) === meta.partnerId);
          return h("div", { key: row.id, style: { position: "relative" } },
            card(() => setOpenId(saveKeyOf(row)), false, h(React.Fragment, null,
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: G.ink } }, row.name || (row.id === "legacy" ? "原来那一档" : "第 " + (rows.length - i) + " 档")),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 5, lineHeight: 1.6 } },
                meta.fresh ? "还没开始" : "第 " + meta.day + " 天" + (partner ? " · 与 " + (partner.remark || partner.name) + " 同住" : "")))),
            // 聊天里那间房的存档不给在这儿删：删了那间房就指着一个空壳
            (row.key && row.key.indexOf("::room::") > -1) ? null : h("button", { onClick: () => drop(row), className: "active:opacity-60",
              style: { position: "absolute", right: 10, top: 10, padding: "4px 8px", fontFamily: F_BODY, fontSize: 10.5, color: "#a08d86", background: "transparent" } }, "删掉"));
        }),
        h("button", { onClick: create, className: "w-full active:opacity-70",
          style: { padding: "14px 16px", borderRadius: 16, border: "1px dashed " + G.line, background: "transparent", fontFamily: F_BODY, fontSize: 13, color: G.deep } },
          "＋ 新开一段"))));
  };
})(window);
