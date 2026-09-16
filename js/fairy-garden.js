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
  const KEY = "x_fairyGarden", BUILD = "fg-24a1e7eb12051540", hosts = new WeakMap();
  const h = React.createElement, useState = React.useState, useRef = React.useRef, useEffect = React.useEffect;
  root.FairyGardenHostFor = child => hosts.get(child) || null;
  const read = (key) => { const d = loadJSON(key || KEY, null); return d && d.version === 1 && d.id ? d : { version: 1, id: "garden_" + Date.now() + "_" + Math.random().toString(36).slice(2), partnerId: "", world: null, dialogs: {} }; };
  const write = (key, data) => { if (!saveJSON(key || KEY, data)) throw new Error("庭院没能保存，请先留在这里。空间不足时可以导出手机备份。"); return data; };
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
  root.FairyGardenService = { KEY, normalizeReply, ask, generateSeason };
  root.GFairyGarden = p => h(Svg, p, h("path", { d: "M4 12l8-8 8 8M6 10v10h12V10M10 20v-6h4v6M18 3v4M16 5h4M3 17c2-3 4-2 4 0" }));
  root.FairyGardenApp = function FairyGardenApp(props) {
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
        planSeason, planState: day => { const d=current(); return (d.plans||{})[planKey(d.partnerId,day)]||null; },
        ready: () => { if (alive.current) setLoaded(true); }
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
        right: h("button", { style: { ...pill(), opacity: loaded ? 1 : .45 }, onClick: () => openChat(!chat), disabled: !loaded }, chat ? "收起" : "说话") }),
      h("div", { className: "flex-1 min-h-0", style: { position: "relative" } },
        h("iframe", { ref: bind, title: "微光庭院游戏", src: "apps/fairy-garden/index.html?embedded=1&v=" + BUILD, style: { width: "100%", height: "100%", border: 0, display: "block" }, onLoad: () => { if (game()) setLoaded(true); } }),
        !loaded && h("div", { style: { position: "absolute", top: 25, left: 0, right: 0, textAlign: "center", fontSize: 12, pointerEvents: "none" } }, "正在推开庭院的门…"),
        chat && h("section", { "aria-label": "庭院聊天", style: { position: "absolute", left: 8, right: 8, bottom: 0, maxHeight: "52%", display: "flex", flexDirection: "column", background: "rgba(250,250,238,.97)", border: "1px solid " + G.line, borderTop: "1px solid " + G.line, borderRadius: "22px 22px 0 0", boxShadow: "0 -10px 34px #3044261f" } },
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
  };
})(window);
