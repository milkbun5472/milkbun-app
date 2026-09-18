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
  const KEY = "x_fairyGarden", BUILD = "fg-2b31fc9769f83a61", hosts = new WeakMap();
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
  // 一份空存档长什么样，只写在这一处：read 兜底和「新开一段」建档都来拿。
  const blankSave = () => ({ version: 1, id: "garden_" + Date.now() + "_" + Math.random().toString(36).slice(2), partnerId: "", world: null, dialogs: {} });
  const read = (key) => {
    const k = key || KEY;
    const d = loadJSON(k, null);
    if (d && d.version === 1 && d.id) return d;
    const stall = vaultStalled(k); if (stall) throw new Error(stall);
    return blankSave();
  };
  const write = (key, data) => { if (!saveJSON(key || KEY, data)) throw new Error("庭院没能保存，请先留在这里。空间不足时可以导出手机备份。"); return data; };
  // 发色沿用色板；衣柜提供逐套保存的自由配色。
  const HAIR_COLORS = ['#2b2320', '#4a3629', '#6b4a33', '#8a6a4b', '#b38f62', '#d8c393', '#8d4a3a', '#6f5f7c'];
  // 衣服、肤色、发色共用取色与色号输入，验证规则只写一份。
  function DyeControl({label, value, onChange, palette}) {
    const hex = /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#f2cbb4";
    return h("div", { style: { marginBottom: 6 } },
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, minHeight: 48 } },
        h("span", { style: { flex: 1, fontSize: 12, color: "#344936" } }, label),
        h("input", { type: "color", value: hex, "aria-label": "自定义" + label, onChange: e => onChange(e.target.value), style: { width: 44, height: 44, border: 0, background: "transparent", padding: 0 } }),
        h("input", { key: hex, type: "text", defaultValue: hex, "aria-label": label + "色号", maxLength: 7, spellCheck: false,
          onBlur: e => { const v = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v); else e.target.value = hex; },
          style: { width: 86, minHeight: 44, padding: "6px", border: "1px solid #cbd4bd", borderRadius: 7, background: "#f8f7ee", color: "#344936", fontSize: 14 } })),
      palette && h("div", { style: { display: "flex", flexWrap: "wrap", gap: 10, margin: "8px 0 14px" } },
        palette.map(color => h("button", { key: color, "aria-label": label + color, "aria-pressed": hex.toLowerCase() === color, onClick: () => onChange(color),
          style: { width: 44, height: 44, borderRadius: 999, background: color, border: hex.toLowerCase() === color ? "2px solid #344936" : "1px solid #cbd4bd" } }))));
  }
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
    const a = obj.action || {}, kind = ["none", "follow", "routine", "wait", "goto", "invite", "gift", "refuse"].includes(a.kind) ? a.kind : "none";
    // 地点只认这个世界里真有的（那张表在 rules.js）；处到哪一档才去得了、他手上有没有那样东西，由游戏那头再验一次
    const known = id => typeof id === "string" && Object.hasOwn(root.FairyGardenRules.COMPANION_DESTINATIONS, id);
    const text = v => String(v == null ? "" : v).trim().slice(0, 80);
    let action = { kind };
    if (kind === "goto" || kind === "invite") action = known(a.target) ? { kind, target: a.target, note: kind === "invite" ? text(a.note) : undefined } : { kind: "none" };
    else if (kind === "gift") action = ["herb", "mushroom", "flower", "food"].includes(a.item) ? { kind, item: a.item } : { kind: "none" };
    else if (kind === "refuse") action = { kind, why: text(a.why) };
    else action = { kind, target: undefined };
    return { parts, reply: parts.join("\n"), action };
  }
  function sharedStyle() { return [narrativeCore({ intimate: true }), CONDESCENDING_TONE_BAN, REGISTER_FOLLOWS_SCENE, STOCK_REPLY_BAN, ECHO_QUESTION_BAN, typeof ReplyPacing !== "undefined" ? ReplyPacing.reading() : ""].filter(Boolean).join("\n\n"); }
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
  async function ask({ active, character, profile, world, history, text, mainline, destinations }) {
    if (!active) throw new Error("先在设置里配置创作线路，再来和角色说话。");
    const style = sharedStyle();
    const sys = [style,
      roleContext(character, profile, mainline),
      "【微光庭院】以本轮人设保留性格、声纹和相处方式，以游戏状态确定此时此地。时间、背包、位置与共同经历都属于这个存档。",
      "【当前世界的事实】\n" + JSON.stringify(world),
      "【这个世界里你们最近的对话】\n" + history.map(m => (m.role === "user" ? userName(profile) : character.name) + "：" + m.content).join("\n"),
      "【对方刚说】\n" + text,
      "【你能落实的动作】none=继续当前行动；follow=沿路来陪对方；routine=恢复自己的日程；wait=停在当前位置等候；goto=去一个地点，target 取 " + (destinations || "home（屋前）") + "。你们处得越熟，能一起去的地方越多（世界事实里 bond 那一栏写着你们处到哪儿了、一起做过什么、她递过你什么）。"
        + "另外三种真会发生的事：invite=你约她去一个地点（target 同上，note 写你约她时说的那句），你先过去等，她到了才有下文；"
        + "gift=你把手边顺手采到的一样递给她，item 取 herb（一束铃叶草）／mushroom（荧光菇）／flower（月光花），得她就在你跟前，一天一样；food 是你在夜市上给她买一样吃的，只有世界事实里 food.open 为 true、两个人都在灯串集市时才做得到；"
        + "refuse=她提了什么你没答应，why 写你没答应的那一句，然后你回自己的日程。"
        + "动作只控制你自己，用户的小人由用户操作。路径与到达由游戏执行，回复表达眼下的意愿与举动；物品变动以游戏实际结算为准。答应、犹豫、商量、拒绝、主动约她，都按你的性格来。",
      '【输出格式】只输出 JSON：{"reply":["你说的第一句","接着说的第二句"],"action":{"kind":"动作标识","target":"goto／invite 时的地点标识","note":"invite 时你约她的那句","item":"gift 时的东西标识","why":"refuse 时的那一句"}}。用不到的字段不写。'
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
  async function bottleReply({active,character,profile,mainline,world,bottle}) {
    if(!active) throw new Error("先在设置里配置创作线路，再来读回信。瓶子会等着你。");
    const sys=[sharedStyle(),roleContext(character,profile,mainline),
      "【庭院事实】\n"+JSON.stringify(world),
      "【数日前放下水的原信】\n"+JSON.stringify({text:bottle.original,day:bottle.from}),
      "你在这个架空庭院里捡到了这封漂流瓶，隔了几天才把回应封回瓶里。以自己的口吻写一小段回信，回应原句；可从庭院日常生发具体感受。共同经历以提供的事实为依据，想象就以想象表达。署名由程序填入。",
      '只输出 JSON：{"reply":"回信正文"}。'].join("\n\n");
    const raw=await callAI(active,sys,[{role:"user",content:"写这封回信。"}],{maxTokens:65535,timeout:180000,tag:"庭院漂流瓶回信"});
    const result=extractJSON(raw);
    if(!result||typeof result.reply!=="string"||!result.reply.trim()){
      const e=new Error("这次没读懂回信，瓶子还留着，可以再试。");e.detail=String(raw||"").slice(0,1200);throw e;
    }
    return {reply:result.reply.trim().slice(0,600),sender:character.name};
  }
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
      "【星井】「" + uName + "」在井底发现奇物。外形由游戏决定，这里生成其中承载的内容，四种性质：\n"
        + "· 回声 echo：一段真发生过的小事——只能从上面真给到你的经历里长，没有就别选它。\n"
        + "· 梦境 dream：一个梦里的画面，不必解释前因后果。\n"
        + "· 留感 sense：一段声音、一种气味、一点温度，附着它勾起的那一点东西。\n"
        + "· 旧物印记 relic：曾经使用、遗落或保存留下的痕迹，来历可以不完整。",
      "【当前世界的事实】\n" + JSON.stringify(world),
      "【这一层】第 " + Math.max(1, Number(depth) || 1) + " 层。"
        + "⚠️越深的只是【越完整、越奇怪】，不是越深情、越惨、越隐秘——别按层数往上堆情绪。"
        + "浅处也可以挖到很珍贵的东西，深处也可以很日常。",
      "【怎么写】每片一两句，短：写可感知的内容和痕迹；容器外形由游戏里的井潮选择，内容可承载在任一种奇物里。"
        + "不解释前因后果，不交代是什么时候的事，不写成完整的小故事。别每片一个调子，别都在说她。\n"
        + "kind 只能取：echo｜dream｜sense｜relic。\n"
        + "⚠️echo【只能从上面真给到你的经历里长】，真没有就别选它。绝不许编一段你们其实没发生过的事。\n"
        + "⚠️最要紧的一条：**东西是挖出来的，话是你自己说的**。"
        + "不许在碎片上替自己宣布「我当时差点说…」「我一直想着…」这种台词——"
        + "那句话要等你【看见这件东西之后】再决定说不说、怎么说。这里只写那件东西本身。",
      '【输出格式】只输出 JSON 数组，' + n + ' 条：[{"kind":"echo｜dream｜sense｜relic","text":"这一片上写着什么","whole":false}]。'
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
  // ── 礼物簿那张表：他喜欢什么（她 2026-09-18）。一位角色一辈子只打一次，之后递什么都是查表。
  // ⚠️类别在 rules.js（游戏那侧按同一张表结算）；这儿只问【态度】和【第一次接过时他会说的话】。
  // ⚠️不塞任何内容示范（施工规则/prompt-no-content-samples.md）：喜欢什么由他的人设长出来。
  // ⚠️料全放 system，user 只留一句触发（施工规则/prompt-send-shape.md）。
  function normalizeTastes(raw) {
    const rules = root.FairyGardenRules, obj = extractJSON(raw);
    const rows = obj && Array.isArray(obj.tastes) ? obj.tastes : [];
    const out = Object.keys(rules.GIFT_FAMILIES).map(family => {
      const r = rows.find(x => x && x.family === family) || {};
      const stance = Object.hasOwn(rules.GIFT_STANCES, r.stance) ? r.stance : "";
      return { family, stance, words: replyParts(r.words).slice(0, 3) };
    });
    if (!out.some(x => x.stance)) { const e = new Error("这次没读出他的喜好，可以再递一次。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return out;
  }
  // 生日：人格档案馆里那一栏（公历或农历）换算成村里的一天。⚠️解析只用 engine 那几处现成的函数，不另写一套
  function gameBirthdayOf(c) {
    try {
      const bd = String((c && c.birthday) || "").trim(); if (!bd) return 0;
      const rules = root.FairyGardenRules; let mo = 0, d = 0;
      const lu = typeof parseLunarBirthday === "function" ? parseLunarBirthday(bd) : null;
      if (lu && typeof lunarToSolar === "function") { const dt = lunarToSolar(new Date().getFullYear(), lu.m, lu.d, lu.isLeap); if (dt) { mo = dt.getMonth() + 1; d = dt.getDate(); } }
      else { const p = typeof parseBirthDate === "function" ? parseBirthDate(bd) : null; if (p) { mo = p.mo; d = p.d; } else { const m = bd.match(/(\d{1,2})\s*[-/.月]\s*(\d{1,2})/); if (m) { mo = +m[1]; d = +m[2]; } } }
      return mo && d ? gameBirthday(mo, d) : 0;
    } catch (e) { return 0; }
  }
  // 村里的一年：四季各十四天。⚠️同一个换算写在 world.mjs 的 gameBirthday；这儿只是宿主拿不到 ESM 时的同一份算法
  function gameBirthday(mo, d) {
    const season = mo >= 3 && mo <= 5 ? 0 : mo >= 6 && mo <= 8 ? 1 : mo >= 9 && mo <= 11 ? 2 : 3;
    const start = [3, 6, 9, 12][season], within = ((mo - start + 12) % 12) * 31 + (d - 1);
    return season * 14 + Math.min(14, 1 + Math.floor(within / 93 * 14));
  }
  // ── 他带路那十句（她 2026-09-18）：七件事各一句、换季三站各一句，一位角色一辈子一枪。零内容示范。
  const GUIDE_STOPS = [
    { step: "well", what: "带她去井边取一壶清水" }, { step: "garden", what: "带她给花圃浇一次水" }, { step: "herbs", what: "带她去林地采一束铃叶草" },
    { step: "gift", what: "让她把手上的东西递一样给你，一天一样" }, { step: "sow", what: "带她在花圃种下一句想问你的话，三天开花" },
    { step: "board", what: "带她去公告栏接一件委托，做完交了有功绩，集市日拿去换东西" }, { step: "sit", what: "带她去池边一起坐一会儿" },
    { step: "season:1", what: "夏天第一天，带她去看溪畔的水磨坊，那儿能磨星砂、蒸月露" }, { step: "season:2", what: "秋天第一天，带她去林后的许愿树，学会的咒在那儿念" },
    { step: "season:3", what: "冬天第一天，月湖结冰了，带她上冰面" }
  ];
  function normalizeGuide(raw) {
    const obj = extractJSON(raw), rows = obj && Array.isArray(obj.lines) ? obj.lines : [];
    const out = GUIDE_STOPS.map(g => { const r = rows.find(x => x && x.step === g.step) || {}; return { step: g.step, text: String(r.text || "").trim().slice(0, 160) }; }).filter(x => x.text);
    if (out.length < 5) { const e = new Error("这次没读出他带路要说的话。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return out;
  }
  async function guideLines({ active, character, profile, mainline, world }) {
    if (!active) throw new Error("先在设置里配置创作线路，他才带得了路。");
    const sys = [sharedStyle(),
      roleContext(character, profile, mainline),
      "【微光庭院】以本轮人设保留性格、声纹和相处方式，以游戏状态确定此时此地。",
      "【当前世界的事实】\n" + JSON.stringify(world),
      "【此刻】她刚搬进这个村子，你先住了一阵，村里的路你熟。头一天你带她走一圈，每到一处先站在那儿等她，她走到跟前你说一句。换季那天也各有一站。",
      "【十站】\n" + JSON.stringify(GUIDE_STOPS),
      "【要紧的】每一站只写你站在那儿、她走过来时说出口的那一句（可以两句）：说清这儿能做什么、为什么值得做，用你自己的口气。不编你们没发生过的往事，不替她安排接下来做什么。十句得看得出是同一个人说的。",
      '【输出格式】只输出 JSON：{"lines":[{"step":"站的标识","text":"你说的那句"}]}，十站都要有。'
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "带路。" }], { maxTokens: 65535, timeout: 180000, tag: "微光庭院带路" });
    return normalizeGuide(raw);
  }
  async function tastes({ active, character, profile, mainline, world }) {
    if (!active) throw new Error("先在设置里配置创作线路，他才说得出喜欢什么。");
    const rules = root.FairyGardenRules;
    const sys = [sharedStyle(),
      roleContext(character, profile, mainline),
      "【微光庭院】以本轮人设保留性格、声纹和相处方式，以游戏状态确定此时此地。",
      "【当前世界的事实】\n" + JSON.stringify(world),
      "【她在这个村里能递给你的东西，分这几类】\n" + JSON.stringify(Object.entries(rules.GIFT_FAMILIES).map(([id, f]) => ({ family: id, label: f.label, what: f.what }))),
      "【要你定的】每一类你是什么态度，以及第一次从她手里接过这一类东西时你会说出口的话。态度四档：" + Object.entries(rules.GIFT_STANCES).map(([k, v]) => k + "=" + v).join("／")
        + "。按你自己的人设定，不用四档都占，也不必讨好她：有人就是不爱花，有人偏偏稀罕井里那些脏兮兮的旧物。"
        + "⚠️那几句只写你接过东西那一刻说出口的：不编你们没发生过的往事，也不替她安排接下来做什么。",
      '【输出格式】只输出 JSON：{"tastes":[{"family":"类别标识","stance":"四档之一","words":["接过时说的第一句","要是还有第二句"]}]}。'
        + "每一类都要有一条。words 一条一个意思，她那头是一个一个气泡冒出来的；一句说得完就一条。"
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "定下来。" }], { maxTokens: 65535, timeout: 180000, tag: "微光庭院喜好" });
    return normalizeTastes(raw);
  }
  // ── 邻居打招呼那句（她 2026-09-18：「做3和4」的 4）：一位邻居一辈子一枪，
  //   三档各一句（刚搬来／脸熟了／处熟了），之后她每次挥手都是查表。零内容示范。
  function normalizeHello(raw) {
    const obj = extractJSON(raw), rows = obj && Array.isArray(obj.lines) ? obj.lines : [];
    const tiers = ["刚搬来", "脸熟了", "处熟了"];
    const out = tiers.map(tier => { const r = rows.find(x => x && x.tier === tier) || {}; return { tier, text: String(r.text || "").trim().slice(0, 120) }; }).filter(x => x.text);
    if (!out.length) { const e = new Error("这次没读出 TA 会怎么打招呼，再挥一次手试试。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return out;
  }
  async function hello({ active, character, profile, world }) {
    if (!active) throw new Error("先在设置里配置创作线路，邻居才开得了口。");
    const sys = [sharedStyle(),
      "你就是「" + character.name + "」，住在魔法庭院的村子里，是「" + userName(profile) + "」的邻居。",
      "【完整角色人设】\n" + (character.persona || character.name),
      "【对方的设定】\n" + (profile && profile.persona || "未填写"),
      "【当前世界的事实】\n" + JSON.stringify(world),
      "【此刻】她在村里走着，看见你，抬手朝你挥了挥。你应一句。她和你处到三档：刚搬来（还不熟）、脸熟了（路上常碰见）、处熟了（说得上话），三档各写一句你会应的话。"
        + "⚠️只写你此刻应的那一句：不编你们没发生过的往事，也不替她安排接下来做什么。三句得看得出是同一个人在三种熟络程度下说的。",
      '【输出格式】只输出 JSON：{"lines":[{"tier":"刚搬来","text":"你应的那句"},{"tier":"脸熟了","text":"…"},{"tier":"处熟了","text":"…"}]}。'
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "应一句。" }], { maxTokens: 65535, timeout: 180000, tag: "微光庭院邻居" });
    return normalizeHello(raw);
  }
  // ── 走近了跟邻居说句话（她 2026-09-18：「Ab 都做吧」的 a）──────────────
  // ⚠️邻居是【别人的角色】，所以这一枪有两道闸，而且它们管的不是同一件事：
  //   ① 门（door）＝TA 自己的主线记忆带不带进这个村子。开了哪几条由她在邻居那一页
  //      拨，走的是房间那道闸（ChatRooms.gateCtx），不另写一套。
  //   ② 世界那一份＝【这一档里的私事】。发给 TA 的是 world.mjs 的 neighborView，
  //      不是那份 snapshot——同行者的位置、礼物、相处册、委托，门开得再大也一个字不给。
  //   开了①就顺手漏②，是这条线上最容易犯的错。
  // ⚠️反八股那一堆照给：那不是记忆，是文风地板，在哪儿都该有
  //   （施工规则/four-surfaces-same-context.md：「沙盒身份不构成砍掉它们的理由」）。
  // ⚠️料全放 system，user 只留一句触发（施工规则/prompt-send-shape.md）。
  async function neighborLine({ active, character, profile, bundle, view, said }) {
    if (!active) throw new Error("先在设置里配置创作线路，TA 才开得了口。");
    const sys = [sharedStyle(),
      "你就是「" + character.name + "」，住在魔法庭院的村子里，是「" + userName(profile) + "」的邻居。",
      "【完整角色人设】\n" + (character.persona || character.name),
      bundle || "",
      "【对方的设定】\n" + (profile && profile.persona || "未填写"),
      "【此刻这个村子】\n" + JSON.stringify(view),
      (said ? "【她刚说】\n" + said : "【此刻】她走到你跟前，像是想跟你说句话。你开口。"),
      (said ? "【要紧的】接着她这句说，别把她的话原样复述一遍。" : ""),
      "【要紧的】就着此刻说——这个时候、这个地方、这个天气，你手头在做什么，你们碰见过几次。"
        + "你和她是邻居，不是她的谁：熟到什么程度上面写着，别越过它。"
        + "⚠️你不知道她和同住那位之间的事，一个字都别提，也别打听。"
        + "⚠️不编你们没发生过的往事，不替她安排接下来做什么，不问「你怎么了」这种回声式的反问。",
      '【输出格式】只输出 JSON：{"lines":["你说的第一句","接着说的第二句"]}。'
        + "一条一个意思，她那头是一个一个气泡冒出来的；一句说得完就一条，最多三条。"
    ].filter(Boolean).join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "说句话。" }],
      { maxTokens: 65535, timeout: 180000, tag: "微光庭院邻居" });
    const obj = extractJSON(raw), rows = obj && Array.isArray(obj.lines) ? obj.lines : [];
    const out = rows.map(x => String(x || "").trim()).filter(Boolean).slice(0, 3);
    if (!out.length) { const e = new Error("这次没听清 TA 说什么，明天再找 TA 聊。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return out;
  }
  // ── 他在台上报方向那四句（她 2026-09-18 的 ①）────────────────────────
  // ⚠️门开不开【由代码判】：差多少、往哪边，都是数（world.mjs 的 starBand／starGap）。
  //   这一枪只换【他怎么说那前半句】——往左往右不许模型编，那是他俩配合的凭据。
  // ⚠️一位角色一辈子一枪，存在这一档的 stars[charId]（照 hello 那条的先例）：
  //   她转一格就打一次的话，一晚上十几枪，而这件事本来是零成本的。
  const STAR_BANDS = [["far", "光还偏得远，得转好几格"], ["near", "快了，再转一两格就到"],
    ["close", "就差一格"], ["done", "光正落在刻痕上，对上了"]];
  function normalizeStar(raw) {
    const obj = extractJSON(raw), rows = obj && Array.isArray(obj.lines) ? obj.lines : [];
    const out = {};
    for (const [band] of STAR_BANDS) {
      const r = rows.find(x => x && x.band === band) || {};
      const t = String(r.text || "").trim().slice(0, 60);
      if (t) out[band] = t;
    }
    if (!Object.keys(out).length) { const e = new Error("这次没读出 TA 会怎么报方向，照旧用白话那几句。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return out;
  }
  async function starLines({ active, character, profile, mainline }) {
    if (!active) throw new Error("先在设置里配置创作线路，他才报得出方向。");
    const sys = [sharedStyle(),
      roleContext(character, profile, mainline),
      "【微光庭院】以本轮人设保留性格、声纹和相处方式，以游戏状态确定此时此地。",
      "【此刻】旧塔观星室。她在楼下转铜环，你站在残顶观测台上看光落在哪儿——"
        + "她手里只有环，看不见光，全靠你报。你们要把光对到今晚那道刻痕上。",
      "【四种情况】\n" + JSON.stringify(STAR_BANDS.map(([band, what]) => ({ band, what }))),
      "【要紧的】每种写一句你会喊下去的话，用你自己的口气。"
        + "⚠️只写【差多少】那半句，**不要写往左往右**——方向由游戏接在你这句后面，写了会重复。"
        + "⚠️是喊给楼下的人听的：短，能听清。不编你们没发生过的往事，也不替她安排接下来做什么。",
      '【输出格式】只输出 JSON：{"lines":[{"band":"档位标识","text":"你喊的那句"}]}，四种都要有。'
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "报方向。" }],
      { maxTokens: 65535, timeout: 180000, tag: "微光庭院对星" });
    return normalizeStar(raw);
  }
  // ── 路上撞见：两位邻居站住说两句（她 2026-09-18 的 ②）──────────────────
  // ⚠️一枪里坐着【两个角色】，所以围栏比别处更要紧：
  //   ① 每个人的人设落在【他自己那一段】里，绝不合成一块共享注入
  //      （群聊那条规矩：私有层必须分段，见 four-surfaces-same-context.md）。
  //   ② 【谁的主线记忆都不给】——没法把 A 的记忆挡在 B 眼睛外面。宁可少给，不许漏。
  //   ③ 她和同住那位之间的事，两个人都不知道（world.mjs 的 pairView 已经裁过一遍）。
  // ⚠️料全放 system，user 只留一句触发（施工规则/prompt-send-shape.md）。
  async function pairLines({ active, profile, a, b, view }) {
    if (!active) throw new Error("先在设置里配置创作线路，他们才说得上话。");
    const seg = (who, label) => "【" + label + "：" + who.name + "】\n" + (who.persona || who.name);
    const sys = [sharedStyle(),
      "村里两位住户在路上撞见了，站住说了两句。你把这两句都写出来，各用各的口气。",
      seg(a, "先开口的那位"),
      seg(b, "接话的那位"),
      "【这个村子此刻】\n" + JSON.stringify(view),
      "【他们和「" + userName(profile) + "」的关系】两位都是住在同一个村子里的邻居，仅此而已。",
      "【要紧的】就着此刻说——这个天气、这个地方、他们照过几次面。"
        + "两句话，一人一句，是那种路上碰见随口说的：短，具体，不寒暄客套。"
        + "⚠️他们互相之间不熟到能聊私事，也不知道对方家里的事，别编。"
        + "⚠️更不知道「" + userName(profile) + "」和她同住那位之间的任何事，一个字都别提。"
        + "⚠️不编他们没发生过的往事，不替谁安排接下来做什么。",
      '【输出格式】只输出 JSON：{"lines":[{"who":"' + a.name + '","text":"第一句"},{"who":"' + b.name + '","text":"接的那句"}]}。'
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "他们说了什么。" }],
      { maxTokens: 65535, timeout: 180000, tag: "微光庭院邻里" });
    const obj = extractJSON(raw), rows = obj && Array.isArray(obj.lines) ? obj.lines : [];
    const out = rows.map(x => ({ who: String((x && x.who) || "").trim(), text: String((x && x.text) || "").trim() }))
      .filter(x => x.text).slice(0, 2);
    if (!out.length) { const e = new Error("这次没听清他们说什么。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
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
      material && material.starNight
        ? "【此刻】你们在旧塔的星图桌前，把她一趟趟从井底带回来的星图碎片拼在了一起，天已经黑了，星图摊开在桌上。这一夜只有这一次，说你此刻真想说的。"
        : material && material.invite
        ? "【此刻】是你约她来" + String(material.invite.place || "这儿") + "的" + (material.invite.note ? "（你当时说的是：" + material.invite.note + "）" : "") + "，她真的来了，这会儿就站在你跟前。这一段只有这一次。"
        : "【此刻】你自己放下手里的事，走到她面前站住了。不是她叫你来的——是你自己想找她说句话。"
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
  root.FairyGardenService = { KEY, normalizeReply, ask, bottleReply, missLine, neighborLine, starLines, normalizeStar, pairLines, generateSeason, blossoms, shards, tastes, normalizeTastes, hello, normalizeHello, guideLines, normalizeGuide, gameBirthday, SEED_LABELS, SHARD_LABELS };
  // ⚠️原来这颗是【一栋小房子】，画的是世界 #1（微光庭院）。壳里现在装着好几个世界，
  //   主屏那颗图标是【进壳】的入口，不该再指认某一个世界。
  //   换成三颗大小不一的星子：只说「好几个小世界」。
  root.GFairyGarden = p => h(Svg, p, h("path", {
    d: "M5 14a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M13 7.5a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M3.9 6.2a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0" }));
  // 一局庭院（选好世界与存档之后的那一屏）。外面那层选择页在 FairyGardenApp。
  // 一份色板：原来 GardenSession 和 FairyGardenApp 各写了一份，改一处永远漏一处。
  const G = { ink: "#344936", soft: "#6e8060", line: "#d1dac2", paper: "#fffef5", deep: "#55704f" };
  // ⚠️写成函数，不是模块级常量：好几条测试把这个文件【按段】抠出来在 vm 里跑，
  //   在模块加载那一刻就去取 F_BODY 的话，那几段一跑就是「F_BODY is not defined」。
  const pickButtonStyle = () => ({ border: "1px solid #c8d5ba", borderRadius: 14, padding: "14px 16px", background: "#f6f7ea", color: "#426043", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.5, textAlign: "left" });
  // 「挑一位同行者」那一页的正文：新开一段和在庭院里另开一间，用的是同一份。
  // ⚠️只此一份：这一页上「住在村里的排前面」「没有角色时提示去档案馆」这些分寸，
  //   照着再抄一份就会各改各的（施工规则/one-public-mechanism.md）。
  // ⚠️没有「先和示例同行者试玩」那条路了（她 2026-09-18：「直接把示例同行者删了吧，
  //   玩秋秋机的都是有角色的。所以主要 focus 还是角色互动和关系」）。
  //   那条路本来就是残的：没有角色时井里刨不出碎片 → 做不了东西 → 收藏馆空 →
  //   念不了咒 → 三条会开的路一条都开不了。摆着它＝请人去玩一个阉割版。
  //   ⚠️【以前开的那些示例档不动】：照样列在选档页上、照样进得去，只是不能再新建
  //   （施工规则外那条也管这儿：这一步执行完，有没有哪一份数据只剩一个副本了）。
  function partnerPickBody({ characters, live, note, onPick, error }) {
    const seated = (live || []).map(String);
    // 住在村里的那几位排在前面（她 2026-09-17：「改变同行应该是只能从邻居里面选」）。
    // ⚠️不是把别人挡掉：新存档村里一个人都没有，挡掉她就谁也选不了。
    //   选了住在村里的那一位，那间屋就空出来——他现在跟你一起住了，
    //   不会再变成两个人（那一层在 world.mjs 里，界面怎么点都绕不过去）。
    const rows = (characters || []).slice().sort((a, b) => seated.indexOf(String(b.id)) - seated.indexOf(String(a.id)));
    return h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: 20 } },
      h("p", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.9, marginBottom: 20, color: G.soft } },
        // ⚠️一个角色都没有的时候「挑一位」没有对象，而下面那句「也可以先去…」
        //   还暗示着本来有别的选择——那条选择（示例同行者）已经撤掉了。空的时候换一句话说。
        rows.length ? note : "这个世界是和你手机里的角色一起过的。先去人格档案馆创建一位，再回来开一段。"),
      h("div", { style: { display: "grid", gap: 11 } },
        rows.map(c => h("button", { key: c.id, style: pickButtonStyle(), onClick: () => onPick(c.id) },
          (c.remark || c.name) + (seated.includes(String(c.id)) ? " · 住在村里" : "")))),

      error && h("p", { role: "alert", style: { color: "#a34836", marginTop: 14, fontFamily: F_BODY, fontSize: 12.5 } }, error));
  }
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
    const [entry, setEntry] = useState(() => initial.current), [pick, setPick] = useState(!initial.current.partnerId && !props.startSolo), [solo, setSolo] = useState(!!props.startSolo), [chat, setChat] = useState(false), [draft, setDraft] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [detail, setDetail] = useState(""), [loaded, setLoaded] = useState(false);
    const frame = useRef(null), alive = useRef(true), busyRef = useRef(false), propsRef = useRef(props), owner = useRef(initial.current.id), serial = useRef(0), messages = useRef(null); propsRef.current = props;
    // ⚠️禁区要跟着这一屏一起走：不撤的话，出了庭院悬浮播放器还悬在半空，
    //   而外面根本没有那条行动栏——那就成了「哪儿都躲着一条看不见的东西」。
    useEffect(() => { alive.current = true; return () => { alive.current = false; serial.current++; if (window.FloatKeepClear) window.FloatKeepClear.set(0); if (frame.current) hosts.delete(frame.current.contentWindow); }; }, []);
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
      // 挑了手机里的一位＝给 TA 开一间庭院房，不是把这一档换个人顶上。
      // 一间房＝一个庭院存档是这条线从头定下的；在原地换人会让这一档的过去接到别人身上。
      // ⚠️原来这一句还挂着 lockPartnerId：于是【已经在庭院房里】才走这条，
      //   从首页那个入口挑人走的是下面那条——只把 partnerId 写进这一档，
      //   一间房都没有。她 2026-09-18：「我从游戏开了一档根本没连房间」。
      //   挑示例同行者（id 为空）才走下面那条：那一档本来就不属于谁，所以不挂房间。
      if (id && props.onNewGardenRoom) { setPick(false); props.onNewGardenRoom(id); return; }
      try { const old = loadJSON(storeKey.current, null); if (old && old.id !== owner.current) throw new Error("存档已经切换，请重新进入庭院。"); const d = old || initial.current; const next = write(storeKey.current, { ...d, partnerId: id || "" }); owner.current = next.id; setEntry(next); setSolo(!id); setPick(false); setLoaded(false); setError(""); setDetail(""); serial.current++; }
      catch (e) { setError(e.message); }
    };
    const changePartner = () => {
      // 她 2026-09-17：「从游戏里开新档它不会主动创建房间」。
      // ⚠️原来这儿只丢下一句「换人请另开一间」就完了：话是对的，可她得自己退出去、
      //   翻到房间列表、认出哪个预设是庭院、建一间——那一步本来就该我们替她做。
      if (props.lockPartnerId) { if (props.onNewGardenRoom) { setPick(true); return; }
        props.toast("这间庭院房就是和 TA 的，换人请另开一间。"); return; } if (busyRef.current) { props.toast("等这次回复完成后再换同行者。"); return; } try { flush(); serial.current++; setChat(false); setPick(true); } catch (e) { props.toast(e.message); } };
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
        load: () => current(), partner: () => { const c = partner(); return c ? { id: c.id, name: c.remark || c.name, birthday: gameBirthdayOf(c) } : null; },
        save: world => { if (frame.current !== node) return false; if (!world || typeof world !== "object" || !Number.isFinite(world.version) || !Number.isFinite(world.day) || typeof world.map !== "string") throw new Error("庭院进度异常，暂未覆盖旧存档。"); const d = current(); write(storeKey.current, { ...d, world }); return true; },
        openChat: () => openChat(true), changePartner,
        // 庭院整屏是一张画布，底下那条行动栏是它自己的操作位——报上来，
        // 悬浮播放器就不会默认停在它头上（js/components.js 的 FloatKeepClear）。
        floatClear: px => { if (window.FloatKeepClear) window.FloatKeepClear.set(px); },
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
        // 礼物簿那张表：这位角色一辈子只问一次，问过就存在这一档里（跟季节安排一个放法）
        hasTastes: () => { const c = partner(); const d = current(); return !!(c && d.tastes && d.tastes[String(c.id)] && d.tastes[String(c.id)].status === "ready"); },
        // 屋里点衣柜／梳妆台（审计，她 2026-09-18）：开的就是季节手册那一页「样貌」，不另做一个换装界面
        openWardrobe: () => { pullLook(); pullGarden(); setDress(true); },
        // 他带路那十句：一位角色问一次，存在这一档的 guides[charId]
        guideLines: async () => {
          const c = partner(); if (!c) throw new Error("先选一位同行者。");
          const cid = String(c.id), have = (current().guides || {})[cid];
          if (have && have.status === "ready") return have.rows;
          if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const epoch = serial.current; busyRef.current = true; setBusy(true);
          try {
            const rows = await guideLines({ active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
              character: c, profile: propsRef.current.profile, mainline: propsRef.current.mainline, world: (game() && game().snapshot()) || {} });
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这几句没有写下来。");
            if (String(current().partnerId) !== cid) throw new Error("同行者已经换过，这几句没有写下来。");
            update(old => ({ ...old, guides: { ...(old.guides || {}), [cid]: { status: "ready", at: Date.now(), rows } } }));
            return rows;
          } catch (e) { if (alive.current) { setError(e.message); setDetail(e.detail || ""); } throw e; }
          finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        // 走近了跟邻居说句话（她 2026-09-18 的 a）：一天一位一次，每次现打。
        // ⚠️两道闸各管各的：door → 那位自己的主线记忆（走房间那道 gateCtx）；
        //   view → 这一档里能给 TA 看的（同行者那条线一个字都不在里头，见 neighborView）。
        neighborSay: async ({ charId, door, view, said }) => {
          const cid = String(charId), c = (propsRef.current.characters || []).find(x => String(x.id) === cid);
          if (!c) throw new Error("这位邻居不在手机里了。");
          if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const epoch = serial.current;
          busyRef.current = true; setBusy(true);
          try {
            const bundle = propsRef.current.neighborBundle ? propsRef.current.neighborBundle(cid, door) : "";
            const lines = await neighborLine({ active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
              character: c, profile: propsRef.current.profile, bundle, view, said });
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这几句没算数。");
            return lines;
          } catch (e) { if (alive.current) { setError(e.message); setDetail(e.detail || ""); } throw e; }
          finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        // 他报方向那四句：一位角色问一次，存在这一档的 stars[charId]（照 hello 的先例）
        starVoice: async () => {
          const c = partner(); if (!c) return null;
          const cid = String(c.id), have = (current().stars || {})[cid];
          if (have && have.status === "ready") return have.lines;
          if (busyRef.current) return null;     // ⚠️别在这儿抛：她正在转环，报不出就先用白话那几句
          const epoch = serial.current;
          busyRef.current = true; setBusy(true);
          try {
            const lines = await starLines({ active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
              character: c, profile: propsRef.current.profile, mainline: propsRef.current.mainline });
            if (!alive.current || serial.current !== epoch) return null;
            update(old => ({ ...old, stars: { ...(old.stars || {}), [cid]: { status: "ready", at: Date.now(), lines } } }));
            return lines;
          } catch (e) { if (alive.current) { setDetail(e.detail || ""); } return null; }
          finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        // 路上撞见两位住户站住说两句：一对一天一次，每次现打（她在场才叫得到这儿）
        pairSay: async ({ a, b, view }) => {
          const list = propsRef.current.characters || [];
          const who = id => String(id) === "companion" ? partner() : list.find(x => String(x.id) === String(id));
          const ca = who(a), cb = who(b);
          if (!ca || !cb) throw new Error("这两位有一位不在手机里了。");
          if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const epoch = serial.current;
          busyRef.current = true; setBusy(true);
          try {
            const lines = await pairLines({ active: propsRef.current.apiFor ? propsRef.current.apiFor(ca.id) : propsRef.current.active,
              profile: propsRef.current.profile, a: ca, b: cb, view });
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这两句没算数。");
            return lines;
          } catch (e) { if (alive.current) { setDetail(e.detail || ""); } throw e; }
          finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        // 邻居打招呼那三句：一位邻居问一次，存在这一档的 hellos[charId]
        hello: async charId => {
          const cid = String(charId), c = (propsRef.current.characters || []).find(x => String(x.id) === cid);
          if (!c) throw new Error("这位邻居不在手机里了。");
          const have = (current().hellos || {})[cid];
          if (have && have.status === "ready") return have.rows;
          if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const epoch = serial.current;
          busyRef.current = true; setBusy(true);
          try {
            const rows = await hello({ active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
              character: c, profile: propsRef.current.profile, world: (game() && game().snapshot()) || {} });
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这几句没有写下来。");
            update(old => ({ ...old, hellos: { ...(old.hellos || {}), [cid]: { status: "ready", at: Date.now(), rows } } }));
            return rows;
          } catch (e) { if (alive.current) { setError(e.message); setDetail(e.detail || ""); } throw e; }
          finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        tastes: async () => {
          const c = partner();
          if (!c) throw new Error("先选一位同行者，才知道 TA 喜欢什么。");
          const cid = String(c.id), have = (current().tastes || {})[cid];
          // ⚠️类别表长了（v70.74 加了「吃的」）：老档那张表缺哪一类就再问一次，不缺就一辈子只问一次
          if (have && have.status === "ready" && Object.keys(root.FairyGardenRules.GIFT_FAMILIES).every(f => (have.rows || []).some(r => r && r.family === f))) return have.rows;
          if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const epoch = serial.current;
          busyRef.current = true; setBusy(true);
          try {
            const rows = await tastes({
              active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
              character: c, profile: propsRef.current.profile, mainline: propsRef.current.mainline,
              world: (game() && game().snapshot()) || {}
            });
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这张表没有写下来。");
            if (String(current().partnerId) !== cid) throw new Error("同行者已经换过，这张表没有写下来。");
            update(old => ({ ...old, tastes: { ...(old.tastes || {}), [cid]: { status: "ready", at: Date.now(), rows } } }));
            return rows;
          } catch (e) { if (alive.current) { setError(e.message); setDetail(e.detail || ""); } throw e; }
          finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        bottleReply: async bottle => {
          if(busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const c=partner();if(!c)throw new Error("先选一位同行者，回信才有人写。瓶子会留着。");
          const epoch=serial.current;busyRef.current=true;setBusy(true);
          try {
            const out=await bottleReply({active:propsRef.current.apiFor?propsRef.current.apiFor(c.id):propsRef.current.active,
              character:c,profile:propsRef.current.profile,mainline:propsRef.current.mainline,
              world:(game()&&game().snapshot())||{},bottle});
            if(!alive.current||serial.current!==epoch||String(current().partnerId)!==String(c.id))throw new Error("庭院或同行者已切换，这次回信没有写入。");
            return out;
          }catch(e){if(alive.current){setError(e.message);setDetail(e.detail||"");}throw e;}finally{busyRef.current=false;if(alive.current)setBusy(false);}
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
    // ⚠️顶栏浮在场景上面（她 2026-09-18：「上面又有框，不要做这个框挡住场景了」）。
    //   这是对 施工规则/mobile-ui-layout.md「顶栏自己占一条」的一处明写例外：
    //   庭院整屏是一张 3D 画布，横一条实心栏就等于把画剪掉一截。栏还是那条 Head
    //   （返回、标题、三颗药丸都没动），只是不再占位——底色换成一层往下化开的薄纱。
    //   ⚠️游戏那头的天气、地图控件本来贴着顶边，得让开这条栏：量出来的高度报进去，
    //   那边只有 --head-clear 这一个变量在用（不在两处各写一个数）。
    const headRef = useRef(null);
    const [headH, setHeadH] = useState(0);
    const [dress, setDress] = useState(false);
    // 花册（她 2026-09-16 定的种花那条）：写字和翻册子在手机这一侧，走过去收在游戏那一侧
    const [book, setBook] = useState(false);
    const [garden, setGarden] = useState(null);
    const [bookTab, setBookTab] = useState("notes");   // notes=花册 / shards=碎片盒
    // 请谁搬进来／改谁的门禁：这一页开着的时候，装的是那位的草稿（她 2026-09-18 的 b）
    const [invite, setInvite] = useState(null);
    // 量一次那条栏有多高：字号、安全区、机型都能改它，写死一个数迟早对不上
    useEffect(() => {
      const el = headRef.current; if (!el) return;
      const set = () => setHeadH(Math.round(el.getBoundingClientRect().height));
      set();
      if (!window.ResizeObserver) return;
      const ro = new ResizeObserver(set); ro.observe(el);
      return () => ro.disconnect();
    }, [pick, book, dress]);
    // 报给游戏：它那头的天气和地图控件照这个数往下让
    useEffect(() => { const g = game(); if (loaded && g && g.setHeadClear) g.setHeadClear(headH); }, [headH, loaded]);

    const [shardBox, setShardBox] = useState(null);
    const [bond, setBond] = useState(null);           // 相处册＋礼物簿（game.getBond）
    const [things, setThings] = useState(null);
    const [museum, setMuseum] = useState(null);
    const [bottles, setBottles] = useState(null);
    const [crew, setCrew] = useState(null);
    const [bottleText, setBottleText] = useState("");
    const bottleView=useRef({query:"",repliesOnly:false,page:0}),bottleArchive=useRef(null);
    const readBottleBook=(patch,scroll=false)=>{
      bottleView.current={...bottleView.current,...patch};
      const g=game();if(g?.getBottles)setBottles(g.getBottles(bottleView.current));
      if(scroll)requestAnimationFrame(()=>bottleArchive.current?.scrollIntoView({block:"start"}));
    };
    const pullGarden = () => { const g = game(); if (!g) return;
      if (g.getGarden) setGarden(g.getGarden());
      if (g.getShards) setShardBox(g.getShards());
      if (g.getThings) setThings(g.getThings());
      if (g.getCollection) setMuseum(g.getCollection());
      if (g.getBottles) setBottles(g.getBottles(bottleView.current));
      if (g.getNeighbors) setCrew(g.getNeighbors());
      if (g.getBond) setBond(g.getBond()); };
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
        // 她自己说的那句也浮到她头顶上（她 2026-09-17：「我自己说话也要气泡」）。
        // ⚠️和他那只走同一个 speak()，只是 who 不同：另写一套的话，
        //   「一条显示完停一口气再下一条」那条规矩迟早只剩一边还对。
        try { if (game() && game().speak) game().speak(text, "me"); } catch (e) {}
        const account = root.Cloud && root.Cloud.getSessionUser ? await root.Cloud.getSessionUser().catch(() => null) : null;
        if (!alive.current || serial.current !== epoch) return;
        current();
        const result = await ask({ active: propsRef.current.apiFor ? propsRef.current.apiFor(cid) : propsRef.current.active, character: c, profile: propsRef.current.profile, world, history: doneHistory(d, cid).slice(-30), text, mainline: propsRef.current.mainline, destinations: (game() && game().destinations && game().destinations()) || "" });
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
    // 描边药丸：顶栏那个「说话」、面板里的「换同行者」「重试」都用它，大小只差一档
    const pill = (small) => ({
      border: "1px solid " + G.line, borderRadius: 999,
      padding: small ? "5px 12px" : "7px 15px",
      background: "rgba(255,255,255,.55)", color: G.soft,
      fontFamily: F_BODY, fontSize: small ? 11 : 12.5, lineHeight: 1.4, whiteSpace: "nowrap"
    });
    if ((!props.lockPartnerId || props.onNewGardenRoom) && (pick || (!char && !solo))) return h("div", { className: "h-full flex flex-col", style: { background: "#e4e9d7", color: "#344936" } },
      h(Head, { zh: "微光庭院", sub: props.lockPartnerId ? "给谁新开一间" : "选一位同行者", bg: "transparent", ink: "#344936", onBack: props.lockPartnerId ? () => setPick(false) : props.onBack }),
      partnerPickBody({ characters: props.characters, live: ((crew && crew.rows) || []).map(n => n.charId), error,
        note: props.lockPartnerId ? "一间房＝一个庭院存档。挑一位，就给 TA 新开一间，这一间和这一档都留着不动。" : "一起种花、探索林地，也可以边玩边聊。这里有独立的时间与经历。",
        onPick: choose }));
    return h("div", { className: "h-full flex flex-col", style: { background: "#e4e9d7", color: "#344936", position: "relative" } },
      // ⚠️浮在场景上面、不占位（见上面 headRef 那段注释）：薄纱往下化开，字还看得清，
      //   画面从屏幕最上边就开始。pointerEvents 只在栏本身上打开，别把场景的拖动吃掉。
      h("div", { ref: headRef, style: { position: "absolute", left: 0, right: 0, top: 0, zIndex: 5,
        background: "linear-gradient(180deg, rgba(228,233,215,.92), rgba(228,233,215,.62) 62%, rgba(228,233,215,0))" } },
      h(Head, { zh: "微光庭院", sub: char ? "与 " + (char.remark || char.name) + " 同行" : "自由试玩", bg: "transparent", ink: "#344936", onBack: back,
        // ⚠️开着花册/样貌时只留一个「回庭院」：三颗药丸并排会把标题挤扁
        right: (book || dress)
          ? h("button", { style: pill(), onClick: () => { setBook(false); setDress(false); } }, "回庭院")
          : h("div", { style: { display: "flex", gap: 7 } },
            h("button", { style: { ...pill(), opacity: loaded ? 1 : .45 }, onClick: () => { pullGarden(); setBook(true); }, disabled: !loaded }, "花册"),
            h("button", { style: { ...pill(), opacity: loaded ? 1 : .45 }, onClick: () => { pullLook(); pullGarden(); setDress(true); }, disabled: !loaded }, "样貌"),
            h("button", { style: { ...pill(), opacity: loaded ? 1 : .45 }, onClick: () => openChat(!chat), disabled: !loaded }, chat ? "收起" : "说话")) })),
      h("div", { className: "flex-1 min-h-0", style: { position: "relative" } },
        h("iframe", { ref: bind, title: "微光庭院游戏", src: "apps/fairy-garden/index.html?embedded=1&v=" + BUILD, style: { width: "100%", height: "100%", border: 0, display: "block" }, onLoad: () => { if (game()) setLoaded(true); } }),
        !loaded && h("div", { style: { position: "absolute", top: 25, left: 0, right: 0, textAlign: "center", fontSize: 12, pointerEvents: "none" } }, "正在推开庭院的门…"),
        // ⚠️整页盖住游戏，而不是新开一屏：iframe 一旦卸载，这一局的进度就没了。
        // ⚠️顶栏现在浮着：整页盖上来的册子要自己让开那条栏，不然第一排索引签压在它底下
        book && h("div", { style: { position: "absolute", inset: 0, paddingTop: headH, background: "#e9ecdd", overflowY: "auto", WebkitOverflowScrolling: "touch" } },
          // ⚠️这一册在现实里就是一本【索引册】，所以 tab 长成册子右边伸出来的一列索引签（施工规则/tabs-not-plain-pills.md）：
          //   竖排字、每张一个色、贴着页边往下排；选中那张是纸色、跟页面连成一片、往外拉出来一截，
          //   没选的往边上缩进去、暗着，像压在后面几页。七张竖着排也放得下，不会像横排那样把最后一张挤出屏幕。
          //   选中态不只靠颜色：位置、宽度、纸色、连不连着页面四样一起变。可点区 48px 高。
          //   sticky＋height 0：跟着页面滚也钉在右上，不用把滚动容器拆成两层。
          h("div", { style: { position: "sticky", top: headH + 10, height: 0, zIndex: 3, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, margin: 0 } },
            [["notes", "花册", ((garden && garden.notes) || []).length, "#e6d6c3"],
             ["shards", "碎片盒", ((shardBox && shardBox.rows) || []).length, "#dfe3c9"],
             ["things", "屋里", ((things && things.rows) || []).length, "#e4d9df"],
             ["museum", "收藏馆", ((museum && museum.rows) || []).length, "#d7e0e3"],
             ["bottle", "漂流瓶", ((bottles && bottles.waiting) || []).length, "#e7e1c9"],
             ["crew", "邻居", ((crew && crew.rows) || []).length, "#d9e5d7"],
             ["bond", "相处", bond ? bond.kinds.filter(k => k.count).length : 0, "#e6d4cf"]].map(([k, label, n, tint]) => {
              const on = bookTab === k;
              return h("button", { key: k, onClick: () => setBookTab(k), className: "active:opacity-80", "aria-pressed": on,
                style: { writingMode: "vertical-rl", minHeight: 48, minWidth: on ? 44 : 38, padding: on ? "12px 7px 12px 8px" : "10px 6px 10px 7px",
                  fontFamily: F_BODY, fontSize: on ? 13 : 12, letterSpacing: 1.5, lineHeight: 1,
                  color: on ? G.ink : "#7d8b72", background: on ? G.paper : tint,
                  border: "1px solid " + G.line, borderRight: 0, borderLeft: on ? "1px solid " + G.paper : "1px solid " + G.line,
                  borderRadius: "10px 0 0 10px", transform: on ? "translateX(0)" : "translateX(7px)",
                  boxShadow: on ? "-2px 2px 5px rgba(52,73,54,.12)" : "none", position: "relative", zIndex: on ? 2 : 1, transition: "transform .15s ease" } },
                label + (n ? " " + n : "")); })),
          bookTab === "bond" ? h("div", { style: { padding: "16px 54px 40px 16px" } },
            // ── 相处册（她 2026-09-18：「做1和2」）。刻度按【一起做过几种事】走，不是分数。
            // ⚠️名单、档位、礼物的类别与态度都问 world.mjs 那一处要（getBond），这儿只画。
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "你们一起做过的事都记在这儿。做过的事越多样，处得越熟；处熟了，他能陪你去的地方就更多。"),
            bond ? h("div", null,
              h("div", { style: { borderRadius: 14, border: "1px solid " + G.deep, background: "rgba(255,255,255,.6)", padding: "12px 14px", marginBottom: 18 } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: G.ink } }, bond.label),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 5, lineHeight: 1.7 } },
                  bond.next ? "再一起做 " + bond.next.need + " 种没做过的事，就是「" + bond.next.label + "」。" : "能一起做的事，都一起做过了。"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#93a188", marginTop: 6, lineHeight: 1.7 } },
                  "现在他愿意陪你去：" + bond.canGo.map(x => x.label).join("、"))),
              // 他带路的开关（她 2026-09-18：「开了的话就让角色带着过一遍」）
              bond.guide ? h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderRadius: 12, border: "1px solid " + G.line, background: "rgba(255,255,255,.55)", padding: "9px 12px", marginBottom: 14 } },
                h("div", null,
                  h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.ink } }, "他带路"),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: G.soft, marginTop: 2, lineHeight: 1.6 } },
                    bond.guide.on ? (bond.guide.step ? "现在带你：" + bond.guide.step.label : "这一圈带完了，换季那天他还会带你看一处") : "关着。开了他会先走到该去的地方等你。")),
                h("button", { className: "active:opacity-70", onClick: () => { const g = game(); if (!g || !g.setGuide) return; g.setGuide(!bond.guide.on); pullGarden(); },
                  style: { ...pill(true), borderColor: bond.guide.on ? G.deep : G.line, color: bond.guide.on ? "#f7faf2" : G.soft, background: bond.guide.on ? G.deep : "rgba(255,255,255,.55)" } },
                  bond.guide.on ? "开着" : "关着")) : null,
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 8 } }, "一起做过的"),
              h("div", { style: { display: "grid", gap: 8, marginBottom: 20 } },
                bond.kinds.map(k => h("div", { key: k.kind, style: { borderRadius: 12, border: "1px solid " + (k.count ? G.line : "rgba(209,218,194,.5)"), background: k.count ? "rgba(255,255,255,.6)" : "transparent", padding: "9px 12px", opacity: k.count ? 1 : .55 } },
                  h("div", { className: "flex items-baseline justify-between", style: { gap: 8 } },
                    h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: G.ink } }, k.label),
                    h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } }, k.count ? (k.count > 1 ? k.count + " 次 · " : "") + "第 " + k.day + " 天" : "还没有")),
                  k.text ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 4, lineHeight: 1.6 } }, k.text) : null))),
              // ── 礼物簿：七类各自摸清了没有。⚠️他喜欢什么是他自己定的，这儿只显示她已经试出来的那几类
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 4 } }, "礼物簿"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: G.soft, marginBottom: 10, lineHeight: 1.7 } },
                "在庭院里走到他身边点「递一样东西」。一天只递一样。递过一类，才知道他对这一类是什么态度；第一次接过时他说的话会留在这儿。"),
              ((bond.gifts.fromHim || []).length) ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginBottom: 10, lineHeight: 1.7 } },
                "他递给你的：" + bond.gifts.fromHim.map(r => r.name + "（第 " + r.day + " 天）").join("、")) : null,
              h("div", { style: { display: "grid", gap: 8 } },
                bond.gifts.families.map(f => h("div", { key: f.id, style: { borderRadius: 12, border: "1px solid " + (f.count ? G.line : "rgba(209,218,194,.5)"), background: f.count ? "rgba(255,255,255,.6)" : "transparent", padding: "9px 12px", opacity: f.count ? 1 : .6 } },
                  h("div", { className: "flex items-baseline justify-between", style: { gap: 8 } },
                    h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: G.ink } }, f.label),
                    h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: f.stance === "love" || f.stance === "like" ? G.deep : "#93a188" } },
                      f.stance ? bond.gifts.stances[f.stance] + (f.count > 1 ? " · 递过 " + f.count + " 次" : "") : f.count ? "他没说" : "？")),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#93a188", marginTop: 3, lineHeight: 1.6 } }, f.what),
                  f.said && f.said.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.soft, marginTop: 5, lineHeight: 1.7, whiteSpace: "pre-wrap" } }, "第一次接过时他说：" + f.said.join("\n")) : null))),
              // ── 食谱册（她 2026-09-18：「夜市卖的跟吃的有关」）：十二样尝没尝过、会不会做。⚠️全从 world.foodBook 来，这儿只画
              bond.food ? h("div", { style: { marginTop: 20 } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 4 } }, "食谱册 · 尝过 " + bond.food.tasted + " / " + bond.food.total),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: G.soft, marginBottom: 10, lineHeight: 1.7 } },
                  (bond.food.open ? "夜市开着，去灯串集市。" : bond.food.tonight ? "今晚有夜市，天黑后开。" : "夜市一季一次、两晚，下次是第 " + bond.food.next + " 天。") + "会做的在自己家灶台上做；吃的也能递给他，是礼物簿里单独一类。"),
                bond.food.pantry.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginBottom: 10, lineHeight: 1.7 } },
                  "篮子里：" + bond.food.pantry.map(p => p.label + (p.from === "him" ? "（他买的）" : p.from === "home" ? "（自己做的）" : "")).join("、")) : null,
                bond.food.buffs.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.deep, marginBottom: 10, lineHeight: 1.7 } }, bond.food.buffs.join("；")) : null,
                h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
                  bond.food.items.map(it => h("div", { key: it.id, style: { borderRadius: 12, border: "1px solid " + (it.tasted ? G.line : "rgba(209,218,194,.5)"), background: it.tasted ? "rgba(255,255,255,.6)" : "transparent", padding: "8px 10px", opacity: it.tasted ? 1 : .6 } },
                    h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.ink } }, it.tasted ? it.label : "？"),
                    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188", marginTop: 3, lineHeight: 1.6 } },
                      (it.tasted ? it.note : it.season != null ? "只在一季的夜市有" : it.cook ? "夜市上有，也能自己做" : "夜市上有") + (it.cook ? (it.known ? " · 会做" : " · 还不会做") : "") + (it.tasted && it.buff ? " · " + it.buff : ""))))))
              : null)
            : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft } }, "还没读到这一册。"))
          : bookTab === "crew" ? (invite ? h("div", { style: { padding: "16px 54px 40px 16px" } },
            // ── 请 TA 搬进来之前先把话说清（她 2026-09-18：「邀请邻居进来是不是也能直接设置」）──
            // ⚠️开关那几条【不在这儿另写一份】：名字和措辞都问 ChatRooms.GROUPS.cognition，
            //   全库的房间用的就是那一份（施工规则/one-public-mechanism.md）。
            //   「回这间房先补看主聊天」那一条没有对象——邻居不住在一间房里，所以只有它被摘掉。
            (() => {
              const Kit = root.ChatRooms;
              const rows = ((Kit && Kit.GROUPS && Kit.GROUPS.cognition) || []).filter(([k]) => k !== "mainDelta");
              const who = (props.characters || []).find(c => String(c.id) === String(invite.charId));
              const flip = k => setInvite(v => ({ ...v, door: { ...v.door, [k]: !v.door[k] } }));
              return h(React.Fragment, null,
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: G.ink } },
                  invite.fresh ? "请 " + (who ? (who.remark || who.name) : "TA") + " 搬进村里" : "改" + invite.name + "的设定"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, margin: "6px 0 14px" } },
                  "住进来之后 TA 在村里过自己的日子，你走在村里会碰见。这几条现在就能定，之后也随时能改。"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 6 } }, "村里叫 TA 什么"),
                h("input", { value: invite.name, maxLength: 16,
                  onChange: e => setInvite(v => ({ ...v, name: e.target.value })),
                  style: { width: "100%", padding: "10px 11px", borderRadius: 11, border: "1px solid " + G.line,
                    background: "rgba(255,255,255,.7)", color: G.ink, fontFamily: F_BODY, fontSize: 14, outline: "none" } }),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: G.soft, marginTop: 6, lineHeight: 1.7 } },
                  "样子搬进来之后在「样貌」那一页换，和同行者走同一套。"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, margin: "18px 0 4px" } }, "TA 进这个村子时带着什么"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: G.soft, lineHeight: 1.7, marginBottom: 6 } },
                  "默认什么都不带——请进来的是别人的角色，带什么由你一条条拨开。"),
                rows.map(([k, label, note]) => h("div", { key: k, className: "flex items-center justify-between",
                  style: { padding: "11px 0", borderBottom: "1px solid " + G.line, gap: 12 } },
                  h("div", null,
                    h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: G.ink } }, label),
                    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: G.soft, marginTop: 2, lineHeight: 1.45 } }, note)),
                  h("button", { onClick: () => flip(k), className: "active:opacity-70", "aria-pressed": !!invite.door[k],
                    style: { flexShrink: 0, width: 46, height: 27, borderRadius: 999, border: "1px solid " + G.line,
                      background: invite.door[k] ? G.deep : "rgba(255,255,255,.6)", padding: 2, display: "flex",
                      justifyContent: invite.door[k] ? "flex-end" : "flex-start" } },
                    h("span", { style: { width: 21, height: 21, borderRadius: 999, background: invite.door[k] ? "#fffef5" : "#c6d0b8", display: "block" } })))),
                h("div", { className: "flex", style: { gap: 9, marginTop: 20 } },
                  h("button", { onClick: () => {
                      const g = game(); if (!g) return;
                      const err = invite.fresh
                        ? g.moveIn({ charId: invite.charId, name: invite.name, look: {}, door: invite.door })
                        : g.setNeighborDoor(invite.charId, invite.door, invite.name);
                      if (err) { props.toast(err); return; }
                      setInvite(null); pullGarden();
                      props.toast(invite.fresh ? invite.name + "搬进来了。" : "改好了。"); },
                    style: { flex: 1, padding: "11px 0", borderRadius: 12, border: 0, background: G.deep,
                      color: "#f6f7ea", fontFamily: F_BODY, fontSize: 13 } },
                    invite.fresh ? "请 TA 搬进来" : "保存"),
                  h("button", { onClick: () => setInvite(null),
                    style: { padding: "11px 15px", borderRadius: 12, border: "1px solid " + G.line,
                      background: "transparent", color: G.soft, fontFamily: F_BODY, fontSize: 12.5 } }, "算了")));
            })())
          : h("div", { style: { padding: "16px 54px 40px 16px" } },
            // ── 邻居（她 2026-09-17：「更像邻居关系」）。三间屋就是三个名额。
            // ⚠️他们走路用的是【跟同行者同一套】控制器和布偶，只是各跑一份。
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "村里有三间邻居屋。请谁住进来，谁就在村里过自己的日子——早上出门、去集市、傍晚回自己门前，你走在村里会碰见。走近了能挥手、能递东西，处得近了公告栏上的委托才落他们的名字。"),
            ((crew && crew.pairs) || []).length ? h("div", { style: { borderRadius: 12, border: "1px solid " + G.line, background: "rgba(255,255,255,.45)", padding: "9px 12px", marginBottom: 14 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.ink, marginBottom: 4 } }, "他们之间"),
              crew.pairs.map((p, i) => h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.7 } },
                p.a + " 和 " + p.b + " 在村里碰过 " + p.n + " 次" + (p.day ? "，最近是第 " + p.day + " 天" : "")))) : null,
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
                h("div", { className: "flex items-center", style: { gap: 14, marginTop: 8 } },
                  h("button", { onClick: () => setInvite({ charId: n.charId, name: n.name, door: { ...(n.door || {}) }, fresh: false }),
                    className: "active:opacity-60",
                    style: { fontFamily: F_BODY, fontSize: 10.5, color: G.deep, background: "transparent", padding: 0 } },
                    "设定 ›"),
                  h("button", { onClick: () => { const g = game(); if (!g || !g.moveOut) return;
                      const err = g.moveOut(n.charId);
                      if (err) { props.toast(err); return; } pullGarden(); props.toast(n.name + "搬走了。房间和聊天都留着。"); },
                    className: "active:opacity-60",
                    style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 10.5, color: "#a08d86", background: "transparent", padding: 0 } },
                    "请 TA 搬走")))))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, lineHeight: 1.9, marginBottom: 16 } },
                  "三间屋都空着。"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 9 } },
              (crew && crew.free) ? "请谁搬进来" : "三间都住满了"),
            (crew && crew.free) ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7 } },
              (props.characters || []).filter(c => String(c.id) !== String(entry.partnerId)
                && !((crew && crew.rows) || []).some(n => String(n.charId) === String(c.id)))
                .slice(0, 40).map(c => h("button", { key: c.id, className: "active:opacity-70",
                  onClick: () => setInvite({ charId: c.id, name: c.remark || c.name, door: {}, fresh: true }),
                  style: { ...pill(true), borderColor: G.line, color: G.soft, background: "rgba(255,255,255,.55)" } },
                  c.remark || c.name)))
              : null))
          :           bookTab === "bottle" ? h("div", { style: { padding: "16px 54px 40px 16px" } },
            // 回信与原信沿用同一本漂流瓶记录。
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "写一句话封进瓶子里放下水，" + ((bottles && bottles.days) || 7) + " 个游戏日以后，可能捞到同行者的回信，也可能只有原信。到月湖栈桥捞，一天一只；读新回信会使用创作线路。"),
            h("textarea", { value: bottleText, onChange: e => setBottleText(e.target.value), rows: 2, maxLength: 120,
              placeholder: "想放进瓶子里的那一句话……",
              style: { width: "100%", border: "1px solid " + G.line, background: G.paper, borderRadius: 14, padding: "10px 12px",
                fontFamily: F_BODY, fontSize: 14, color: G.ink, outline: "none", resize: "none" } }),
            h("button", { className: "w-full active:opacity-70",
              onClick: () => { const g = game(); if (!g || !g.seal) return;
                const err = g.seal(bottleText);
                if (err) { props.toast(err); return; }
                setBottleText(""); pullGarden(); props.toast("放下水了，" + ((bottles && bottles.days) || 7) + " 个游戏日以后，去水边看看。"); },
              style: { marginTop: 9, border: 0, borderRadius: 999, padding: "11px 0", background: G.deep, color: "#f7faf2", fontFamily: F_BODY, fontSize: 13.5 } },
              "放下水"),
            ((bottles && bottles.waiting) || []).length ? h("div", { style: { marginTop: 20 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 8 } },
                bottles.ready ? "有 " + bottles.ready + " 只已到月湖，去栈桥捞捞看" : "还在水里的"),
              bottles.waiting.map(b => h("div", { key: b.id, style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, lineHeight: 1.8, padding: "8px 0", borderBottom: "1px solid rgba(209,218,194,.6)" } },
                b.text + (b.backIn ? " · 还有 " + b.backIn + " 个游戏日" : " · 已到月湖，待捞")))) : null,
            h("section", {ref:bottleArchive,"aria-label":"漂流信册",style:{marginTop:22}},
              h("div", {style:{fontFamily:F_BODY,fontSize:12,color:G.ink,marginBottom:8}}, "捞上来过的 · 共 " + (bottles?.total||0) + " 封"),
              h("input", {type:"search","aria-label":"搜索漂流信",placeholder:"搜原句、回信或署名",value:bottleView.current.query,
                onChange:e=>readBottleBook({query:e.target.value,page:0}),
                style:{width:"100%",minHeight:44,border:"1px solid "+G.line,borderRadius:10,padding:"10px 12px",background:G.paper,color:G.ink,fontSize:14}}),
              h("label", {style:{display:"flex",alignItems:"center",gap:8,minHeight:44,fontSize:12,color:G.ink}},
                h("input", {type:"checkbox",checked:bottleView.current.repliesOnly,onChange:e=>readBottleBook({repliesOnly:e.target.checked,page:0})}), "只看回信"),
              h("div", {role:"status",style:{fontSize:11,color:G.soft,marginBottom:10}},
                bottles?.matches ? "找到 " + bottles.matches + " 封 · 第 " + (bottles.page+1) + " / " + bottles.pages + " 页" : bottles?.total ? "没有找到相符的信，换个词看看。" : "捞到的信会留在这里。"),
              h("div", {style:{display:"grid",gap:10}},
                (bottles?.drifts||[]).map((d,i)=>h("article", {key:(d.id||"")+":"+d.day+":"+i,style:{borderRadius:14,border:"1px solid "+G.line,background:"rgba(255,255,255,.6)",padding:"11px 13px"}},
                  h("div", {style:{fontFamily:F_BODY,fontSize:10.5,color:"#93a188"}},
                    "第 " + d.day + " 天捞到 · " + (d.kind === "reply" ? (d.sender || "同行者") + "的回信" : d.kind === "mine" ? "自己封的" : d.kind === "wish" ? "水灯上留的那句" : d.kind === "note" ? "旧花笺" : d.kind === "shard" ? "井里的碎片" : "馆里的一件") + "（第 " + d.from + " 天）"),
                  d.original && h("div", {style:{fontSize:12,color:G.soft,marginTop:8}}, "你放下的：" + d.original),
                  h("div", {style:{fontFamily:F_BODY,fontSize:13.5,color:G.ink,marginTop:6,lineHeight:1.85,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}},d.text)))),
              bottles?.pages>1 && h("div", {style:{display:"flex",justifyContent:"space-between",gap:12,marginTop:16}},
                h("button", {disabled:bottles.page===0,onClick:()=>readBottleBook({page:bottles.page-1},true),style:{...pill(),minHeight:44}}, "上一页"),
                h("button", {disabled:bottles.page>=bottles.pages-1,onClick:()=>readBottleBook({page:bottles.page+1},true),style:{...pill(),minHeight:44}}, "下一页"))))
          :           bookTab === "museum" ? h("div", { style: { padding: "16px 54px 40px 16px" } },
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
          :           bookTab === "things" ? h("div", { style: { padding: "16px 54px 40px 16px" } },
            // ── 修好的地方（她 2026-09-17：「做④吧宝宝」）。
            // ⚠️「还差什么」问的是 world.mjs 那一处（workShort），这儿不另算一遍。
            ((things && things.works) || []).length ? h("div", { style: { marginBottom: 22 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 4 } }, "修好的地方"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: G.soft, marginBottom: 10, lineHeight: 1.7 } },
                "弄好一处，村里就多一处能用的地方——下雨他会去那儿躲，午后他会去那儿坐。材料带齐了，走到那儿就能动手。"),
              h("div", { style: { display: "grid", gap: 9 } },
                things.works.map(w => h("div", { key: w.id, style: { borderRadius: 14, border: "1px solid " + (w.done ? G.deep : G.line), background: "rgba(255,255,255,.55)", padding: "10px 13px" } },
                  h("div", { className: "flex items-baseline justify-between", style: { gap: 8 } },
                    h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: G.ink } }, w.label),
                    h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: w.done ? G.deep : "#93a188" } },
                      w.done ? "弄好了" : (w.where || "公告栏"))),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 5, lineHeight: 1.7 } },
                    w.done ? w.hint : w.cost ? (w.short.length ? "还差" + w.short.join("、") : "材料齐了，走过去就能动手") + " · 要" + w.cost : w.hint))))) : null,
            // ── 屋里：锅炼出来的东西。⚠️这一整条链一枪都不打，全是代码算的
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "用碎片在锅里做出来的东西。能摆的摆出来——真下雨的时候，屋檐下的雨铃会响。屋里屋外每一件放得住东西的家具都摆得下：走过去点它就行。"),
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
                  // ⚠️位置从三个变成了五十二个：一件东西底下铺五十二颗药丸没法用。
                  //   这儿只留【老三样 ＋ 它现在在的那一处 ＋ 她这会儿站着的那一件】，
                  //   其余的都在世界里——走过去点那件家具就能摆。那才是「每一处都能交互」。
                  Object.entries(things.spots).filter(([k]) =>
                    ["eaves", "sill", "pond"].includes(k) || k === t.spot || k === things.here).map(([k, label]) =>
                    h("button", { key: k, className: "active:opacity-70",
                      onClick: () => { const g = game(); if (!g || !g.place) return;
                        const err = g.place(t.id, t.spot === k ? null : k);
                        if (err) { props.toast(err); return; } pullGarden(); },
                      style: { ...pill(true), borderColor: t.spot === k ? G.deep : G.line, color: t.spot === k ? G.ink : G.soft,
                        background: t.spot === k ? "rgba(85,112,79,.12)" : "rgba(255,255,255,.55)" } },
                      t.spot === k ? "已摆在" + label : "摆到" + label))) : null)))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, lineHeight: 1.9 } },
                  "还没有。下井刨一片碎片回来，走到炼药锅那儿做点东西。"))
          : bookTab === "shards" ? h("div", { style: { padding: "16px 54px 40px 16px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "井潮带来的奇物，里面留着不同的片段。越深的只是越完整、越奇怪，不是越沉重。"),
            ((shardBox && shardBox.rows) || []).length ? h("div", { style: { display: "grid", gap: 10 } },
              shardBox.rows.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map(sh =>
                h("div", { key: sh.id, style: { borderRadius: 14, border: "1px solid " + (sh.pinned ? G.deep : G.line), background: "rgba(255,255,255,.6)", padding: "11px 13px" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } },
                    "〔" + ((shardBox.curios && shardBox.curios[sh.curio] && shardBox.curios[sh.curio].name) || (shardBox.kinds && shardBox.kinds[sh.kind]) || "碎片") + "〕第 " + sh.depth + " 层 · 第 " + sh.day + " 天" + (sh.whole ? " · 完整的一片" : "")),
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
          : h("div", { style: { padding: "16px 54px 40px 16px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "走到花圃那儿种一句下去，过三天开花。开好了再走过去收——" + (char ? (char.remark || char.name) : "同行者") + "会在花笺上回你一句。"),
            // 地里的
            ((garden && garden.seeds) || []).length ? h("div", { style: { marginTop: 20 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 8 } }, "地里的"),
              garden.seeds.map(sd => h("div", { key: sd.id, style: { fontFamily: F_BODY, fontSize: 12, color: G.soft, lineHeight: 1.7, padding: "7px 0", borderBottom: "1px solid rgba(209,218,194,.6)" } },
                "〔" + (sd.label || garden.kinds[sd.kind] || "今天") + "〕" + (sd.ask || "（只种了一个念头）") + " · " + (sd.bloomIn > 0 ? "还有 " + sd.bloomIn + " 天开" : "开好了，去花圃收")))) : null,
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
            // 住在村里的那几位也在这一排（她 2026-09-17：「邀请邻居的话改不了外貌」）
            [["companion", char ? (char.remark || char.name) : "同行者"], ["me", "我"],
              ...(((crew && crew.rows) || []).map(n => [String(n.charId), n.name]))].map(([k, label]) =>
              h("button", { key: k, onClick: () => setWho(k), className: "flex-1 active:opacity-70",
                style: { padding: "12px 0", fontFamily: F_BODY, fontSize: 13.5, color: who === k ? G.ink : "#93a188",
                  borderBottom: "2px solid " + (who === k ? G.deep : "transparent"), background: "transparent" } }, label))),
          h("div", { style: { padding: "16px 54px 40px 16px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              who === "companion" && char
                ? "换的是 " + (char.remark || char.name) + " 在这个庭院里的样子，只在这一个存档里算数。"
                : who === "me" ? "换的是你自己在这个庭院里的样子。"
                : "换的是住在村里那一位在这个庭院里的样子。"),
            h(DyeControl, { key: who + "skin", label: "肤色", value: game() && game().getDyes ? game().getDyes(who).skin : null,
              onChange: skin => pushLook({ skin }), palette: ["#f9e2d2", "#f2cbb4", "#dfb093", "#c58d69", "#9c694c", "#694536"] }),
            h("section", { "aria-label": "衣柜", style: { marginBottom: 24 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: G.ink, marginBottom: 10 } }, "挑一套衣服"),
              h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 } },
                Object.entries((styles && styles.outfits) || {}).map(([id, outfit]) => {
                  const on = ((look[who] || {}).outfit || "traveler") === id;
                  return h("button", { key: id, "aria-pressed": on, onClick: () => pushLook({ outfit: id }),
                    style: { minHeight: 54, padding: "10px 8px", borderRadius: 12, border: "1px solid " + (on ? G.deep : G.line), background: on ? "#d4ddc7" : "#f7f5e9", color: G.ink, fontFamily: F_BODY, fontSize: 12 } }, outfit.label);
                })),
              h("p", { style: { fontSize: 11, color: G.soft, lineHeight: 1.8, margin: "12px 0" } }, "每套单独记住配色，选颜色或输入六位色号，小人会立即换上。"),
              [["cloth", "衣服主色"], ["trim", "领边与配色"], ["bottom", "裤袜颜色"], ["boots", "鞋子颜色"]].map(([slot, label]) => {
                const selected = game() && game().getOutfit ? game().getOutfit(who) : null;
                const hex = selected && selected.colors[slot] || "#8d5f66";
                return h(DyeControl, { key: who + slot, label, value: hex, onChange: value => pushLook({ outfitColors: { [slot]: value } }) });
              })),
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
            h(DyeControl, { key: who + "hair", label: "发色", value: game() && game().getDyes ? game().getDyes(who).hairColor : null,
              onChange: hairColor => pushLook({ hairColor }), palette: HAIR_COLORS })))),
        chat && !dress && !book && h("section", { "aria-label": "庭院聊天", style: { position: "absolute", left: 8, right: 8, bottom: 0, maxHeight: "52%", display: "flex", flexDirection: "column", background: "rgba(250,250,238,.97)", border: "1px solid " + G.line, borderTop: "1px solid " + G.line, borderRadius: "22px 22px 0 0", boxShadow: "0 -10px 34px #3044261f" } },
          // 抓手：一眼看出这层是能收起来的，也把面板和游戏画面隔开
          h("div", { style: { width: 34, height: 4, borderRadius: 999, background: G.line, margin: "8px auto 0" } }),
          h("div", { style: { padding: "9px 16px 8px", display: "flex", alignItems: "center", gap: 10 } },
            h("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: F_BODY, fontSize: 12, color: G.soft } },
              char ? "和 " + (char.remark || char.name) + " 说话" : "选一位角色，开始聊天"),
            h("button", { onClick: changePartner, disabled: busy, style: { ...pill(true), opacity: busy ? .45 : 1 } }, "另开一间")),
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
  // ⚠️她 2026-09-18：占位的那三个世界全删了。原来摆在那儿是「这地方以后会长」的意思，
  //   可它们许的是三件谁都没在做的事——别人打开秋秋机，看见的就是三张空头支票。
  //   撤掉一件东西就把它删掉，不许留在原地当死代码（那三行连着灰卡片那一档渲染一起走）。
  const WORLDS = [
    { id: "garden", name: "微光庭院", note: "种花、下井、和同行者一起把日子过下去" }
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
    const [picking, setPicking] = useState(false);
    // 「先和示例同行者试玩」本身就是一次回答：进去别再把同一张选人页摆一遍。
    const [openSolo, setOpenSolo] = useState(false);
    const refresh = () => setSaves(readSaves());
    // openId 存的是【整把钥匙】，不是 id：房间那种键拼不回来（见 readSaves 的注释）
    if (openId) return h(GardenSession, Object.assign({}, props, {
      key: openId, storeKey: openId, startSolo: openSolo,
      onBack: () => { setOpenId(null); setOpenSolo(false); refresh(); }
    }));
    const card = (onClick, children) => h("button", {
      onClick: onClick, className: "w-full text-left active:opacity-70",
      style: { padding: "15px 16px", borderRadius: 16, border: "1px solid " + G.line,
        background: "rgba(255,255,255,.62)" }
    }, children);
    // ⚠️只有【壳】叫小世界（她 2026-09-18 定的）：它装着好几个世界，再叫「微光庭院」
    //   就成了「一个叫微光庭院的地方，进去挑世界，第一个世界也叫微光庭院」。
    //   进了某个世界以后那几处 Head 仍旧是那个世界自己的名字（GardenSession 里那三处别动）。
    const shell = (sub, onBack, body) => h("div", { className: "h-full flex flex-col", style: { background: "#e4e9d7", color: G.ink } },
      h(Head, { zh: "小世界", sub: sub, bg: "transparent", ink: G.ink, onBack: onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 18px 36px" } }, body));

    // 仓没打开时名册也读不全：这时候让她建新档，会把一份残缺的名册写回去（名字、时间都没了）。
    const stall = vaultStalled(INDEX_KEY);
    if (stall) return shell("等一下再进来", props.onBack,
      h("p", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 2, color: G.soft, margin: "10px 0" } }, stall));
    if (!world) return shell("挑一个世界", props.onBack, h(React.Fragment, null,
      h("p", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.9, color: G.soft, margin: "6px 0 18px" } },
        "每个世界有自己的时间、地图和存档，进去挑一位角色一起过。"),
      h("div", { style: { display: "grid", gap: 11 } }, WORLDS.map(w => card(() => setWorld(w),
        h(React.Fragment, null,
          h("div", { className: "flex items-center justify-between", style: { gap: 10 } },
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: G.ink } }, w.name),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: G.deep } }, "可以进")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 5, lineHeight: 1.6 } }, w.note)))))));

    const rows = saves.filter(x => x.world === world.id);
    // ⚠️不再有「开一段不挑人的」：新的一段一律要挑一位（她 2026-09-18 定的）。
    //   以前开的那些示例档照样列在上面、照样进得去，只是不能再新建——
    //   撤掉一件东西就把它删掉，不许留在原地当死代码。
    // ⚠️她 2026-09-18：「从游戏开了一档根本没连房间」。原来「＋ 新开一段」直接写一条
    //   g_xxx 进庭院自己那张名册就开了——那一档【不属于任何人、也不挂任何房间】：
    //   没有聊天、没有记忆进出、没有一处能设权限。挑了手机里的一位，就该是一间房
    //   （一间房＝一个庭院存档，这条线从头就是这么定的），而且先让她把设定定好。
    const pickForNew = id => { setPicking(false); if (id) props.onNewGardenRoom(id); };
    const drop = row => requestAppConfirm("删掉这一档？",
      "这一档里的日子、背包和聊过的话会一起删掉，找不回来。",
      () => {
        const next = readSaves().filter(x => x.id !== row.id);
        saveJSON(INDEX_KEY, next);
        try { dropStored(saveKeyOf(row)); } catch (e) {}
        setSaves(next);
      }, "删掉");
    // 挑人那一页：挑了手机里的一位就去开一间房（先设定、再建）。
    if (picking) return shell("给谁开一段", () => setPicking(false),
      partnerPickBody({ characters: props.characters, live: [], onPick: pickForNew,
        note: "挑一位，就给 TA 开一间庭院房——房间的设定先让你定好，定完这一段就开在那间房里。" }));
    return shell("选一档 · " + world.name, () => setWorld(null), h(React.Fragment, null,
      h("p", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.9, color: G.soft, margin: "6px 0 16px" } },
        "选一档接着过，或者从头开一段新的。"),
      h("div", { style: { display: "grid", gap: 11 } },
        rows.map((row, i) => {
          const meta = saveMeta(row);
          const partner = (props.characters || []).find(c => String(c.id) === meta.partnerId);
          return h("div", { key: row.id, style: { position: "relative" } },
            // ⚠️以前开的示例档没有同行者：直接进去接着玩，别摆一张【它逃不掉的】选人页
            //   ——那一页现在只剩「挑一位」，一挑就跑去开新房间，这一档就被撂下了。
            card(() => { setOpenSolo(!meta.partnerId); setOpenId(saveKeyOf(row)); }, h(React.Fragment, null,
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: G.ink } }, row.name || (row.id === "legacy" ? "原来那一档" : "第 " + (rows.length - i) + " 档")),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 5, lineHeight: 1.6 } },
                meta.fresh ? "还没开始" : "第 " + meta.day + " 天" + (partner ? " · 与 " + (partner.remark || partner.name) + " 同住" : "")))),
            // 聊天里那间房的存档不给在这儿删：删了那间房就指着一个空壳
            (row.key && row.key.indexOf("::room::") > -1) ? null : h("button", { onClick: () => drop(row), className: "active:opacity-60",
              style: { position: "absolute", right: 10, top: 10, padding: "4px 8px", fontFamily: F_BODY, fontSize: 10.5, color: "#a08d86", background: "transparent" } }, "删掉"));
        }),
        h("button", { onClick: () => setPicking(true), className: "w-full active:opacity-70",
          style: { padding: "14px 16px", borderRadius: 16, border: "1px dashed " + G.line, background: "transparent", fontFamily: F_BODY, fontSize: 13, color: G.deep } },
          "＋ 新开一段"))));
  };
})(window);
