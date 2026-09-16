// 微光庭院是架空游戏：全文人设与公共文风照常给；主线记忆、日程、好感与聊天不读写。
// 世界、游戏对话只存 x_fairyGarden；接口密钥留在父页 callAI，不传进游戏画面。
(function (root) {
  "use strict";
  const KEY = "x_fairyGarden", BUILD = "fg-913df0a848e719e3", hosts = new WeakMap();
  const h = React.createElement, useState = React.useState, useRef = React.useRef, useEffect = React.useEffect;
  root.FairyGardenHostFor = child => hosts.get(child) || null;
  const read = () => { const d = loadJSON(KEY, null); return d && d.version === 1 && d.id ? d : { version: 1, id: "garden_" + Date.now() + "_" + Math.random().toString(36).slice(2), partnerId: "", world: null, dialogs: {} }; };
  const write = data => { if (!saveJSON(KEY, data)) throw new Error("庭院没能保存，请先留在这里。空间不足时可以导出手机备份。"); return data; };
  function normalizeReply(raw) {
    const obj = extractJSON(raw);
    if (!obj || typeof obj.reply !== "string" || !obj.reply.trim()) { const e = new Error("这次没读懂角色的回复，可以重试。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    const a = obj.action || {}, kind = ["none", "follow", "routine", "wait", "goto"].includes(a.kind) ? a.kind : "none";
    return { reply: obj.reply.trim(), action: kind === "goto" && !["pond", "garden", "well", "home"].includes(a.target) ? { kind: "none" } : { kind, target: kind === "goto" ? a.target : undefined } };
  }
  function sharedStyle() { return [narrativeCore({ intimate: true }), CONDESCENDING_TONE_BAN, REGISTER_FOLLOWS_SCENE, STOCK_REPLY_BAN, OVERREACH_BAN, ECHO_QUESTION_BAN, typeof ReplyPacing !== "undefined" ? ReplyPacing.reading() : ""].filter(Boolean).join("\n\n"); }
  function roleContext(character, profile) { return ["你就是「" + character.name + "」，正与「" + userName(profile) + "」一起生活在架空的魔法庭院。", "【完整角色人设】\n" + (character.persona || character.name), "【对方的设定】\n" + (profile && profile.persona || "未填写")].join("\n\n"); }
  async function generateSeason({ active, character, profile, world }) {
    if (!active) throw new Error("先在设置里配置创作线路，再来安排这一季。");
    const rules = root.FairyGardenRules, season = rules.seasonOf(world.day);
    const sys = [sharedStyle(), roleContext(character, profile), "【当前游戏事实与最近日志】\n" + JSON.stringify(world),
      "【这一季】第 " + season.year + " 年" + season.name + "季，共 14 天。这是一份可以实行的生活安排，日子会继续往后走。围绕你的人设、兴趣和你们的游戏经历，为每天挑三个活动，依次用于上午、下午、傍晚。全天候的移动、雨雪调整、实际到场和材料结算由游戏负责。",
      "【可实行活动】\n" + JSON.stringify(Object.entries(rules.ACTIVITIES).map(([id,a])=>({id,place:rules.MAPS[a.map].name,activity:a.label}))),
      "你决定这一季想怎样生活，各天如何变化、哪些日子想独处或一起待着。活动的想法、动机与观察可以自由写；活动标识使用上述清单。涉及尚未建成的事物时把它作为愿望，眼下的安排仍落在已有地点。已经过去的季内日期只列计划，不把计划当已发生的回忆。",
      '【输出格式】只输出 JSON：{"title":"你为这一季取的短标题","days":[{"day":1,"note":"这天想怎样过","activities":[{"id":"活动标识","note":"这个活动里你想做什么"}]}]}。days 完整包含第 1 到第 14 天，每天恰好三个 activities。'
    ].join("\n\n");
    const raw = await callAI(active, sys, [{role:"user",content:"安排这一季。"}], {maxTokens:65535,timeout:180000,tag:"微光庭院季节"});
    try { return rules.normalizePlan(extractJSON(raw), world.day); } catch(e) { e.detail=String(raw||"").slice(0,1600);throw e; }
  }
  async function ask({ active, character, profile, world, history, text }) {
    if (!active) throw new Error("先在设置里配置创作线路，再来和角色说话。");
    const style = sharedStyle();
    const sys = [style,
      roleContext(character, profile),
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
    const t = useTheme(), initial = useRef(null); if (!initial.current) initial.current = read();
    const [entry, setEntry] = useState(() => initial.current), [pick, setPick] = useState(!initial.current.partnerId), [solo, setSolo] = useState(false), [chat, setChat] = useState(false), [draft, setDraft] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [detail, setDetail] = useState(""), [loaded, setLoaded] = useState(false);
    const frame = useRef(null), alive = useRef(true), busyRef = useRef(false), propsRef = useRef(props), owner = useRef(initial.current.id), serial = useRef(0), messages = useRef(null); propsRef.current = props;
    useEffect(() => { alive.current = true; return () => { alive.current = false; serial.current++; if (frame.current) hosts.delete(frame.current.contentWindow); }; }, []);
    const current = () => {
      if (!alive.current) throw new Error("这个庭院页面已经离开了。");
      const d = loadJSON(KEY, null); if (!d || d.id !== owner.current) throw new Error("存档已经切换，请重新进入庭院。"); return d;
    };
    const partner = () => (propsRef.current.characters || []).find(c => String(c.id) === String(current().partnerId)) || null;
    const update = fn => { const next = write(fn(current())); setEntry(next); return next; };
    const game = () => frame.current && frame.current.contentWindow.FairyGardenGame;
    const flush = () => { const g = game(); if (g && !g.flush()) throw new Error("进度还没有保存成功，请先留在庭院。"); };
    const back = () => { try { flush(); serial.current++; props.onBack(); } catch (e) { setError(e.message); props.toast(e.message); } };
    const choose = id => {
      try { const old = loadJSON(KEY, null); if (old && old.id !== owner.current) throw new Error("存档已经切换，请重新进入庭院。"); const d = old || initial.current; const next = write({ ...d, partnerId: id || "" }); owner.current = next.id; setEntry(next); setSolo(!id); setPick(false); setLoaded(false); setError(""); setDetail(""); serial.current++; }
      catch (e) { setError(e.message); }
    };
    const changePartner = () => { if (busyRef.current) { props.toast("等这次回复完成后再换同行者。"); return; } try { flush(); serial.current++; setChat(false); setPick(true); } catch (e) { props.toast(e.message); } };
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
        const plan=await generateSeason({active:propsRef.current.apiFor?propsRef.current.apiFor(cid):propsRef.current.active,character:c,profile:propsRef.current.profile,world});
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
        save: world => { if (frame.current !== node) return false; if (JSON.stringify(world).length > 100000) throw new Error("庭院进度异常，暂未覆盖旧存档。"); const d = current(); write({ ...d, world }); return true; },
        openChat: () => openChat(true), changePartner,
        planSeason, planState: day => { const d=current(); return (d.plans||{})[planKey(d.partnerId,day)]||null; },
        ready: () => { if (alive.current) setLoaded(true); }
      });
    };
    const char = (props.characters || []).find(c => String(c.id) === String(entry.partnerId));
    const rows = (entry.dialogs && entry.dialogs[entry.partnerId]) || [];
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
        const result = await ask({ active: propsRef.current.apiFor ? propsRef.current.apiFor(cid) : propsRef.current.active, character: c, profile: propsRef.current.profile, world, history: (d.dialogs[cid] || []).filter(m => m.status === "done").slice(-30), text });
        const accountNow = root.Cloud && root.Cloud.getSessionUser ? await root.Cloud.getSessionUser().catch(() => null) : null;
        if (!alive.current || serial.current !== epoch) return;
        const latest = current();
        if (String(latest.partnerId) !== String(cid) || !partner() || String(account && account.id || "") !== String(accountNow && accountNow.id || "") || !(latest.dialogs[cid] || []).some(m => m.request === request && m.status === "pending")) throw new Error("角色或存档已变更，这次回复没有写入。");
        update(old => ({ ...old, dialogs: { ...old.dialogs, [cid]: old.dialogs[cid].map(m => m.request === request ? { ...m, status: "done" } : m).concat({ id: request + "_reply", role: "assistant", content: result.reply, status: "done" }).slice(-200) } }));
        const accepted = game() && game().applyAction(result.action); if (!accepted) props.toast("回复已保存，这个动作暂时无法执行。");
      } catch (e) {
        if (alive.current && serial.current === epoch) { setError(e.message || "这次没能连上，稍后可以重试。"); setDetail(e.detail || ""); try { update(old => ({ ...old, dialogs: { ...old.dialogs, [cid]: (old.dialogs[cid] || []).map(m => m.request === request ? { ...m, status: "failed" } : m) } })); } catch (_) {} }
      } finally { busyRef.current = false; if (alive.current) setBusy(false); }
    }
    const buttonStyle = { border: "1px solid #c8d5ba", borderRadius: 12, padding: "12px 14px", background: "#f6f7ea", color: "#426043", fontSize: 13 };
    if (pick || (!char && !solo)) return h("div", { className: "h-full flex flex-col", style: { background: "#e4e9d7", color: "#344936" } },
      h(Head, { zh: "微光庭院", sub: "选一位同行者", bg: "transparent", ink: "#344936", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: 20 } },
        h("p", { style: { fontSize: 13, lineHeight: 1.8, marginBottom: 18 } }, "一起种花、探索林地，也可以边玩边聊。这里有独立的时间与经历。"),
        h("div", { style: { display: "grid", gap: 10 } }, (props.characters || []).map(c => h("button", { key: c.id, style: buttonStyle, onClick: () => choose(c.id) }, c.remark || c.name)),
          h("button", { style: buttonStyle, onClick: () => choose("") }, "先和示例同行者试玩")),
        !(props.characters || []).length && h("p", { style: { marginTop: 16, fontSize: 12 } }, "也可以先去人格档案馆创建角色。"),
        error && h("p", { role: "alert", style: { color: "#a34836", marginTop: 12 } }, error)));
    return h("div", { className: "h-full flex flex-col", style: { background: "#e4e9d7", color: "#344936" } },
      h(Head, { zh: "微光庭院", sub: char ? "与 " + (char.remark || char.name) + " 同行" : "自由试玩", bg: "transparent", ink: "#344936", onBack: back,
        right: h("button", { style: { fontSize: 12, padding: 8 }, onClick: () => openChat(!chat), disabled: !loaded }, chat ? "收起" : "说话") }),
      h("div", { className: "flex-1 min-h-0", style: { position: "relative" } },
        h("iframe", { ref: bind, title: "微光庭院游戏", src: "apps/fairy-garden/index.html?embedded=1&v=" + BUILD, style: { width: "100%", height: "100%", border: 0, display: "block" }, onLoad: () => { if (game()) setLoaded(true); } }),
        !loaded && h("div", { style: { position: "absolute", top: 25, left: 0, right: 0, textAlign: "center", fontSize: 12, pointerEvents: "none" } }, "正在推开庭院的门…"),
        chat && h("section", { "aria-label": "庭院聊天", style: { position: "absolute", left: 10, right: 10, bottom: 0, maxHeight: "45%", display: "flex", flexDirection: "column", background: "rgba(250,250,238,.97)", border: "1px solid #d1dac2", borderRadius: "18px 18px 0 0", boxShadow: "0 -8px 28px #30442618" } },
          h("div", { style: { padding: "9px 12px", display: "flex", alignItems: "center", gap: 12, fontSize: 11 } }, h("span", {style:{maxWidth:"65%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}, char ? "和 " + (char.remark || char.name) + " 说话" : "选一位角色，开始聊天"), h("button", { onClick: changePartner, disabled: busy }, "换同行者")),
          h("div", { ref: messages, className: "min-h-0 overflow-y-auto", style: { padding: "0 12px", fontSize: 13, lineHeight: 1.7, minHeight: 55, maxHeight: 180 } }, rows.map(m => h("p", { key: m.id, style: { margin: "5px 0 9px", whiteSpace: "pre-wrap", color: m.role === "user" ? "#6e8060" : "#344936" } }, h("small", null, m.role === "user" ? "你：" : (char && (char.remark || char.name) || "同行者") + "："), m.content)), !rows.length && h("p", null, "想聊什么，或者想一起去哪里？"), busy && h("p", { role: "status" }, "正在回应…"), error && h("p", { role: "alert", style: { color: "#a34836" } }, error), detail && h("details", null, h("summary", null, "查看原始回复"), h("pre", { style: { whiteSpace: "pre-wrap", fontSize: 10 } }, detail))),
          !busy && rows.some(m => m.role === "user" && m.status !== "done") && h("button", { style: { fontSize: 11, padding: 5 }, onClick: () => send(true) }, "重试上次未完成的回复"),
          h("form", { onSubmit: e => { e.preventDefault(); send(false); }, style: { display: "flex", gap: 8, padding: "8px 10px", paddingBottom: COMPOSER_PAD_BOTTOM } },
            h("input", { "aria-label": "对同行者说", value: draft, onChange: e => setDraft(e.target.value), disabled: busy || !char, maxLength: 12000, placeholder: char ? "和同行者说句话…" : "先选择角色", style: { flex: 1, minWidth: 0, border: "1px solid #d0d9c4", background: "#fffef5", borderRadius: 10, padding: "10px 9px", fontSize: 16 } }),
            h("button", { type: "submit", disabled: busy || !char || !draft.trim(), style: { padding: "8px 12px", fontSize: 13, color: "#456c48" } }, "发送")))));
  };
})(window);
