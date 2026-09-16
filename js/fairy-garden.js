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
  const KEY = "x_fairyGarden", BUILD = "fg-6ef0e61f3eb1bc5e", hosts = new WeakMap();
  const h = React.createElement, useState = React.useState, useRef = React.useRef, useEffect = React.useEffect;
  root.FairyGardenHostFor = child => hosts.get(child) || null;
  const read = (key) => { const d = loadJSON(key || KEY, null); return d && d.version === 1 && d.id ? d : { version: 1, id: "garden_" + Date.now() + "_" + Math.random().toString(36).slice(2), partnerId: "", world: null, dialogs: {} }; };
  const write = (key, data) => { if (!saveJSON(key || KEY, data)) throw new Error("庭院没能保存，请先留在这里。空间不足时可以导出手机备份。"); return data; };
  // 两排色板：给的是【挑得动手】的十来个颜色，不是取色器。
  // 布偶是童话质感，饱和度压着走；深浅各来几档，深色头发也照顾到。
  const HAIR_COLORS = ['#2b2320', '#4a3629', '#6b4a33', '#8a6a4b', '#b38f62', '#d8c393', '#8d4a3a', '#6f5f7c'];
  const CLOTH_COLORS = ['#8d5f66', '#729786', '#5f7590', '#a7784c', '#6b6280', '#93684f', '#4f6b5c', '#b0857f'];
  function normalizeReply(raw) {
    const obj = extractJSON(raw);
    if (!obj || typeof obj.reply !== "string" || !obj.reply.trim()) { const e = new Error("这次没读懂角色的回复，可以重试。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    const a = obj.action || {}, kind = ["none", "follow", "routine", "wait", "goto"].includes(a.kind) ? a.kind : "none";
    return { reply: obj.reply.trim(), action: kind === "goto" && !["pond", "garden", "well", "home"].includes(a.target) ? { kind: "none" } : { kind, target: kind === "goto" ? a.target : undefined } };
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
      '【输出格式】只输出 JSON：{"reply":"你对对方说的话，可带必要的动作描写","action":{"kind":"动作标识","target":"仅 goto 时填写地点标识"}}。本轮只选择一个能落实的动作，其余内容可以继续聊天。'
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
  root.FairyGardenService = { KEY, normalizeReply, ask, generateSeason, blossoms, SEED_LABELS };
  root.GFairyGarden = p => h(Svg, p, h("path", { d: "M4 12l8-8 8 8M6 10v10h12V10M10 20v-6h4v6M18 3v4M16 5h4M3 17c2-3 4-2 4 0" }));
  // 一局庭院（选好世界与存档之后的那一屏）。外面那层选择页在 FairyGardenApp。
  function GardenSession(props) {
    // 存档挂哪儿：庭院房给自己那把钥匙，首页试玩仍是公共那一档
    const storeKey = useRef(null); if (!storeKey.current) storeKey.current = props.storeKey || KEY;
    // 庭院房的同行者就是这间房的角色，没得选：进门那一刻就钉死，免得先闪一下选人页
    const t = useTheme(), initial = useRef(null);
    if (!initial.current) {
      const d = read(storeKey.current);
      initial.current = (props.lockPartnerId && String(d.partnerId) !== String(props.lockPartnerId))
        ? write(storeKey.current, { ...d, partnerId: String(props.lockPartnerId) }) : d;
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
    const [seedKind, setSeedKind] = useState("miss");
    const [seedAsk, setSeedAsk] = useState("");
    const pullGarden = () => { const g = game(); if (g && g.getGarden) setGarden(g.getGarden()); };
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
          propsRef.current.record.onTurn({ text: text, reply: result.reply });
          update(old => ({ ...old, dialogs: { ...old.dialogs, [cid]: (old.dialogs[cid] || []).filter(m => m.request !== request) } }));
        } else update(old => ({ ...old, dialogs: { ...old.dialogs, [cid]: old.dialogs[cid].map(m => m.request === request ? { ...m, status: "done" } : m).concat({ id: request + "_reply", role: "assistant", content: result.reply, status: "done" }).slice(-200) } }));
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
          h("div", { style: { padding: "16px 16px 40px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "把想问的话种进花圃，过三天开花。开好了走到花圃那儿收——" + (char ? (char.remark || char.name) : "同行者") + "会在花笺上回你一句。"),
            // 种下
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 9 } }, "种下一句"),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 } },
              Object.entries((garden && garden.kinds) || {}).map(([k, label]) =>
                h("button", { key: k, onClick: () => setSeedKind(k), className: "active:opacity-70",
                  style: { ...pill(true), borderColor: seedKind === k ? G.deep : G.line, color: seedKind === k ? G.ink : G.soft,
                    background: seedKind === k ? "rgba(85,112,79,.12)" : "rgba(255,255,255,.55)" } }, label))),
            h("textarea", { value: seedAsk, onChange: e => setSeedAsk(e.target.value), rows: 2, maxLength: 120,
              placeholder: "想问他什么？也可以空着，只种一个念头",
              style: { width: "100%", border: "1px solid " + G.line, background: G.paper, borderRadius: 14, padding: "10px 12px",
                fontFamily: F_BODY, fontSize: 14, color: G.ink, outline: "none", resize: "none" } }),
            h("button", { className: "w-full active:opacity-70",
              onClick: () => { const g = game(); if (!g || !g.sow) return;
                const err = g.sow(seedKind, seedAsk);
                if (err) { props.toast(err); return; }
                setSeedAsk(""); pullGarden(); props.toast("种下了，三天后开花。"); },
              style: { marginTop: 9, border: 0, borderRadius: 999, padding: "11px 0", background: G.deep, color: "#f7faf2", fontFamily: F_BODY, fontSize: 13.5 } },
              "种下去"),
            garden && garden.error ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#a08d86", marginTop: 7 } }, garden.error) : null,
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
                    nt.pinned ? "已钉住" : "钉住"))))))
        ,
        dress && h("div", { style: { position: "absolute", inset: 0, background: "#e9ecdd", overflowY: "auto", WebkitOverflowScrolling: "touch" } },
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
                })))))),
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
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
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
        try { localStorage.removeItem(saveKeyOf(row)); } catch (e) {}
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
