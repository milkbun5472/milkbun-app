"use strict";
(function (root) {
  const h = React.createElement, { useState, useRef, useEffect } = React, C = root.DateGameCore;
  function button(t, text, fn, disabled, part, hot) {
    return h("button", { "data-part": part, disabled: !!disabled, onClick: fn, style: { minHeight: 44, padding: "9px 12px", borderRadius: 12, border: "1px solid " + (hot ? t.tint : t.line), background: hot ? t.tint : t.bg2, color: hot ? "#fff" : t.ink, fontFamily: F_BODY, fontSize: 13, opacity: disabled ? .45 : 1, cursor: disabled ? "default" : "pointer" } }, text);
  }
  function card(t, children, extra) {
    return h("div", { style: Object.assign({ padding: 15, borderRadius: 16, marginBottom: 14, background: t.bg2, border: "1px solid " + t.line, boxShadow: "0 4px 12px rgba(30,20,10,.06)" }, extra || {}) }, children);
  }
  function DateGameSetup(props) {
    const t = props.t, chars = (props.characters || []).filter(c => !(props.isEngineer && props.isEngineer(c.id)));
    const [id, setId] = useState((props.initialPicked || [])[0] || ""), [chat, setChat] = useState(false);
    return h("div", { "data-wk": "datepage", className: "h-full flex flex-col", style: props.table("date", t) },
      h(Head, { zh: "各怀心思的约会", onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-6" },
        card(t, [h("div", { key: "title", style: { fontFamily: F_DISPLAY, fontSize: 21, marginBottom: 8, color: t.ink } }, "一起出门，各有算盘。"),
          h("p", { key: "body", style: { fontSize: 13, color: t.sub, lineHeight: 1.8 } }, "你和 TA 各抽一张秘密任务。180 分钟、200 枚游戏币，最多逛四处。商量路线时可以试探、装傻、说服，也可以成全对方。"),
          h("p", { key: "rules", style: { fontSize: 12, color: t.fog, lineHeight: 1.8, marginTop: 8 } }, "每一站轮流做主。你做主的那站，商量两次后可以拍板；TA 做主的那站，要说服 TA 改提议。合照和抓玩偶由你们一起操作。收工前各猜一次对方的任务，最后翻牌：完成任务 2 分，猜中对方 1 分。")]),
        h("div", { style: { fontFamily: F_DISPLAY, color: t.ink, fontSize: 14, marginBottom: 10 } }, "这次和谁出门"),
        chars.map(c => h("button", { key: c.id, "data-part": "partner", "data-id": c.id, onClick: () => setId(c.id), style: { display: "flex", width: "100%", alignItems: "center", gap: 12, padding: 11, marginBottom: 8, borderRadius: 13, background: t.bg2, border: "1px solid " + (id === c.id ? t.tint : t.line), color: t.ink, textAlign: "left" } },
          h(Avatar, { character: c, size: 38, radius: 12 }), h("span", { style: { flex: 1 } }, c.remark || c.name), id === c.id ? "已选" : "")),
        !chars.length ? card(t, "先去人格档案馆建一个角色，再来约 TA。") : null,
        h("label", { style: { display: "flex", gap: 9, alignItems: "center", minHeight: 48, color: t.sub, fontSize: 12 } }, h("input", { type: "checkbox", checked: chat, onChange: e => setChat(e.target.checked) }), "读最近聊天，让这一局更熟悉（只读）"),
        h("p", { style: { color: t.fog, fontSize: 11, lineHeight: 1.7 } }, "独立小游戏。只保存本局，不写角色回忆，不改变真实关系；游戏币、玩偶和小物都只在这一局。")),
      h("div", { className: "shrink-0 px-4 py-2.5", style: { borderTop: "1px solid " + t.line, paddingBottom: COMPOSER_PAD_BOTTOM } },
        h("div", { style: { display: "grid" } }, button(t, "抽任务，出发", () => props.onStart({ charIds: [id], mode: "normal", injectChat: chat, ccSeat: false, npcFill: false }), !chars.some(c => c.id === id), "start", true))));
  }
  function buildPrompt(props, char, state) {
    // 这局沿用小游戏沙盒：人设全文、世界书、可选最近聊天；没有主线状态写口。
    const pf = props.profile || {};
    const ctx = props.rules + "\n【你本人】\n" + (char.name || "TA") + "\n" + (char.persona || "")
      + "\n【一起玩的用户】\n" + (pf.name || "你") + "\n" + (pf.persona || pf.bio || "")
      + (state.config.injectChat && props.recentChatFor ? "\n【开局前最近聊天·只读背景】\n" + props.recentChatFor(char.id) : "");
    const game = "\n你正在玩独立的「各怀心思的约会」。你就是这名玩家，有自己的任务与性格，主动争取想去的地方；怎样藏心思、让步、讨价还价由你自己决定。\n"
      + "【规则】180 分钟、200 枚游戏币，最多四站，不重复逛。同意一处只代表提议，具体走路和活动由游戏结算。奇数站用户做主，偶数站你做主。商量时认真读对方这句话在做什么，用短台词接话。\n"
      + (state.config.mode === "easy" ? "【放水局】这局你让着对方：好说话，愿意成全对方想去的地方和想做的事，猜任务时也不必太较真。\n" : "")
      + "你的秘密任务只有你知道。对方的任务不在资料里，靠公开行动猜；可以试探、误导，也可以主动说破自己的任务。所有数值和成功都由裁判判断。\n"
      + "【你实际能看见的这一局】\n" + JSON.stringify(C.aiView(state));
    if (state.pending.kind === "react") {
      const p = C.place(state.current) || {}, last = state.events[state.events.length - 1] || {};
      return ctx + game + "\n【现在】你们到了「" + p.name + "」。刚才发生的：" + (last.text || "")
        + (last.topic ? "\n这一站抽到的聊天签：「" + last.topic + "」" + (last.line ? "，对方先说了：「" + last.line + "」" : "，对方没先开口") + "。就着它聊，照你自己的经历和性子说。" : "")
        + "\n像真在现场那样接一句（say），反应这件事、这个地方、或者刚才那个小意外；别复述规则和分数。"
        + (p.options ? "这里能挑东西：你替对方挑一样，pick 填下面一个选项 id：" + p.options.map(o => o[0] + "＝" + o[1]).join("、") + "。" : "")
        + "\n只输出 JSON：{\"say\":\"你的台词\"" + (p.options ? ",\"pick\":\"选项 id\"" : "") + "}。";
    }
    if (state.pending.kind === "guess") return ctx + game
      + "\n收工了。现在秘密提交你对用户任务的猜测，guess 填任务池里的一个 id，拿不准填 unknown。say 是翻牌前给对方的一句台词，猜测由游戏藏好，翻牌后才显示。只输出 JSON：{\"guess\":\"任务 id 或 unknown\",\"say\":\"你的台词\"}。";
    return ctx + game + "\n提出下一站。对方有提议时，你可接受或另提；accept=true 时 place 必须与对方提议相同。place 只选目前去得了的 id。pose 是合照准备动作的索引 0～2，row 是抓钩准备停的前后排 0～2；在游乐屋挑有玩偶的排，并用 hint 指点对方左右怎么配合。hint 是到了活动现场你给的短提示，可以直说，也可以逗对方猜。\n"
      + "只输出 JSON：{\"place\":\"地点 id\",\"accept\":true,\"pose\":0,\"row\":0,\"hint\":\"现场配合提示\",\"say\":\"商量这一站的台词\"}。";
  }
  // 翻牌前的裁判：只读聊天和走过的路，判两张「看人」的任务成没成。不看猜测、不给分。
  function buildJudge(props, char, state) {
    const pf = props.profile || {}, uName = pf.name || "用户", cName = char.name || "TA";
    const ask = [["user", uName], ["char", cName]].filter(x => (C.mission(state.missions[x[0]]) || {}).social)
      .map(x => "· " + x[0] + "（" + x[1] + "）的任务：" + C.mission(state.missions[x[0]]).text + "——对方是" + (x[0] === "user" ? cName : uName));
    return "你是这局「各怀心思的约会」的裁判，只判事实。读下面的聊天和走过的路，判每一条任务有没有真的发生：要有一句话能当证据，引出来；含糊、勉强、是自己说的不算对方说的，都判没成。\n"
      + ask.join("\n")
      + "\n【聊天】\n" + state.talk.map(m => (m.who === "user" ? uName : cName) + "：" + m.text).join("\n")
      + "\n【走过的路】\n" + state.events.map(e => e.text).join("\n")
      + "\n只输出 JSON：{" + ask.map(a => "\"" + a.slice(2, a.indexOf("（")) + "\":{\"done\":true,\"evidence\":\"那一句\"}").join(",") + "}";
  }
  function DateGame(props) {
    const t = props.t, cfg = props.config, char = (props.characters || []).find(c => c.id === cfg.charIds[0]);
    const [s, setS] = useState(() => props.savedState && props.savedState.state || C.newGame(cfg));
    const ref = useRef(s), ticket = useRef(0), abortRef = useRef(null), busyRef = useRef(false), alive = useRef(true);
    const [busy, setBusy] = useState(false), [unsaved, setUnsaved] = useState(false), [err, setErr] = useState(""), [text, setText] = useState(""), [selected, setSelected] = useState(""), [aim, setAim] = useState(1), [guess, setGuess] = useState(""), [showTask, setShowTask] = useState(true);
    const save = n => { const ok = props.onSave({ config: cfg, state: n, label: n.phase === "finished" ? "这一局已翻牌 · 可以回看" : "第 " + n.round + " 站 · 剩 " + n.minutes + " 分钟" }) !== false; setUnsaved(!ok); return ok; };
    const put = n => { ref.current = n; setS(n); return save(n); };
    useEffect(() => { alive.current = true; save(ref.current); return () => { alive.current = false; ticket.current++; if (abortRef.current) abortRef.current.abort(); }; }, []);
    const act = fn => { if (busyRef.current || unsaved) return; try { put(fn(ref.current)); setErr(""); } catch (e) { setErr(e.message); } };
    // 做完一站：TA 当场接一句（她 2026-10-12：「TA 在场」），点单／挑东西那几处 TA 也替你挑一样
    const doActivity = choice => {
      if (busyRef.current || unsaved) return;
      try { const n = C.resolveActivity(ref.current, choice); if (!put(n)) return; setErr(""); setText(""); const r = C.startRequest(n, "react", "", ""); if (!put(r)) return; run(r); } catch (e) { setErr(e.message); }
    };
    // 翻牌：有看人的任务就先请裁判读一遍聊天
    const [judging, setJudging] = useState(false);
    const reveal = async () => {
      if (busyRef.current || unsaved || !guess) return;
      let judged = null;
      if (C.needsJudge(ref.current)) {
        busyRef.current = true; setJudging(true);
        try {
          const raw = await props.call(props.active, buildJudge(props, char, ref.current), [{ role: "user", content: "判。" }], { maxTokens: 9000, logLabel: "各怀心思的约会·裁判", timeout: 90000 });
          judged = (typeof raw === "string" ? extractJSON(raw) : raw) || {};
        } catch (e) { setErr("裁判没读完聊天：" + String(e.message || e) + "。再按一次翻牌。"); busyRef.current = false; setJudging(false); return; }
        busyRef.current = false; setJudging(false);
      }
      act(x => C.finish(x, guess, judged));
    };
    async function run(pendingState) {
      if (busyRef.current || !char || (props.isEngineer && props.isEngineer(char.id))) return;
      const seq = ++ticket.current; abortRef.current = new AbortController(); busyRef.current = true; setBusy(true); setErr(""); let raw = "";
      try {
        raw = await props.call(props.active, buildPrompt(props, char, pendingState), [{ role: "user", content: "轮到你了。" }], { maxTokens: 65000, signal: abortRef.current.signal, logLabel: "各怀心思的约会", timeout: 90000 });
        const reply = typeof raw === "string" ? extractJSON(raw) : raw;
        const n = C.receiveReply(pendingState, reply);
        if (!alive.current || seq !== ticket.current) return;
        put(n);
      } catch (e) {
        if (alive.current && seq === ticket.current) setErr("这一句没接上，进度和预算都留着。\n" + String(e.message || e) + (raw ? "\n原回复：" + String(raw).slice(0, 800) : ""));
      } finally { if (alive.current && seq === ticket.current) { busyRef.current = false; setBusy(false); } }
    }
    const ask = (kind, line, place) => {
      if (busyRef.current || unsaved) return;
      try { const n = C.startRequest(ref.current, kind, line, place); if (!put(n)) return; setText(""); run(n); } catch (e) { setErr(e.message); }
    };
    const goNext = () => {
      if (busyRef.current || unsaved) return;
      const n = C.nextStop(ref.current); if (!put(n)) return; setSelected(""); setAim(1);
      ask(n.phase === "guess" ? "guess" : "plan", "", "");
    };
    const close = () => { if (busyRef.current || unsaved) return; const n = C.closeDate(ref.current); if (!put(n)) return; ask("guess", "", ""); };
    const available = C.legalPlaces(s), prop = C.place(s.proposal), current = C.place(s.current), mine = C.mission(s.missions.user);
    const primary = (label, fn, disabled, part) => button(t, label, fn, disabled || busy || unsaved, part, true);
    const title = (label, body) => h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, marginBottom: 9 } }, label), body);
    const remaining = h("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: t.sub, margin: "0 0 12px" } }, h("span", null, s.visits.length + "/4 站 · 剩 " + s.minutes + " 分钟"), h("span", null, s.money + " 枚游戏币"));
    if (!char || (props.isEngineer && props.isEngineer(char.id))) return h("div", { className: "h-full flex flex-col" }, h(Head, { zh: "各怀心思的约会", onBack: props.onBack }), card(t, "这一局的角色不可用。存档还留着，可以返回重新选人。"));
    const seats = [{ key: "user", name: (props.profile || {}).name || "你", isUser: true, char: props.profile || {}, sub: s.phase === "finished" ? s.result.user.score + " 分" : "秘密任务已装好", on: s.phase === "plan" && !!(s.round % 2) },
      { key: char.id, name: char.remark || char.name, char, sub: s.phase === "finished" ? s.result.char.score + " 分" : "TA 也有自己的算盘", on: s.phase === "plan" && !(s.round % 2) }];
    return h("div", { "data-wk": "datepage", className: "h-full flex flex-col", style: props.table("date", t) },
      h(Head, { zh: "各怀心思的约会", sub: s.phase === "finished" ? "翻牌时间" : "第 " + s.round + " 站 · " + (s.round % 2 ? "这一站你做主" : "这一站 TA 做主"), bg: "transparent", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-5", "data-part": "scroll" },
        h(props.VsBar, { t, seats, mid: "同行" }), remaining,
        h("div", { "data-wk": "datemission" }, card(t, [
          h("button", { key: "toggle", onClick: () => setShowTask(!showTask), style: { display: "flex", width: "100%", justifyContent: "space-between", color: t.tint, fontSize: 12, minHeight: 30 } }, "你的任务纸条", showTask ? "收起来" : "展开"),
          showTask ? h("div", { key: "task", style: { color: t.ink, fontSize: 14, lineHeight: 1.8, marginTop: 5 } }, mine.text,
            h("div", { style: { color: t.fog, fontSize: 11 } }, C.progress(s, mine.id).done ? (mine.id === "save" && s.phase !== "finished" ? "目前达成 · 别把剩的钱花掉了" : "已经达成了") : "藏好一点，TA 不知道你抽中了什么")) : null], { transform: "rotate(-.6deg)", borderStyle: "dashed" })),
        // 路上聊的：跟五子棋、你画我猜同一个左右气泡（GameTalkLog），不另画一套
        s.talk.length && root.GameTalkLog ? h(root.GameTalkLog, { t, uName: (props.profile || {}).name || "你", me: props.profile || {}, maxHeight: 260, k: "date",
          lines: s.talk.map((m, i) => m.who === "user" ? { me: true, name: (props.profile || {}).name || "你", text: m.text, at: i } : { id: char.id, name: char.remark || char.name, text: m.text, at: i }),
          charOf: () => char }) : null,
        s.phase === "plan" ? h("div", { "data-wk": "datemap" },
          card(t, title("把下一站往哪儿带", h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, C.placesOf(s).map(C.place).filter(Boolean).map(p => {
            const ok = available.some(a => a.id === p.id), on = selected === p.id;
            return h("button", { key: p.id, "data-part": "place", "data-id": p.id, disabled: !ok || busy || !!s.pending, onClick: () => setSelected(p.id), style: { padding: "12px 10px", minHeight: 107, textAlign: "left", color: t.ink, borderRadius: 14, border: "1px solid " + (on ? t.tint : t.line), background: on ? t.bg : t.bg2, boxShadow: on ? "0 4px 0 " + t.line : "none", opacity: ok ? 1 : .4, transform: "rotate(" + (p.id === "photo" ? -1 : p.id === "shop" ? 1 : 0) + "deg)" } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, marginBottom: 5 } }, p.name), h("div", { style: { fontSize: 11, color: t.tint } }, s.visits.includes(p.id) ? "已经逛过" : p.time + " 分钟 / " + p.cost + " 币"), h("div", { style: { fontSize: 11, color: t.fog, marginTop: 6, lineHeight: 1.5 } }, p.note));
          })))),
          prop ? card(t, title("TA 提议去「" + prop.name + "」", h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
            primary("就去这里", () => act(x => C.commitPlace(x, s.proposal)), !!s.pending, "accept"),
            s.round % 2 && s.exchanges >= 2 && selected && selected !== s.proposal ? button(t, "这站我来定", () => act(x => C.commitPlace(x, selected, true)), busy || !!s.pending, "override") : null))) : null,
          h("p", { style: { fontSize: 11, color: t.fog, lineHeight: 1.7, marginBottom: 10 } }, s.round % 2 ? "这一站你做主。商量两次后可以拍板，也可以直接接受 TA 的提议。" : "这一站 TA 做主。挑另一处，再说句话劝 TA 改主意。")) : null,
        s.phase === "activity" ? h("div", { "data-wk": "dateactivity" }, card(t, title(current.name,
          h("div", null,
            s.prepared.hint ? h("p", { style: { fontSize: 13, color: t.sub, lineHeight: 1.7, marginBottom: 14 } }, (char.remark || char.name) + "：" + s.prepared.hint) : null,
            s.incident ? h("p", { "data-part": "incident", style: { fontSize: 12.5, color: t.tint, lineHeight: 1.7, marginBottom: 10 } }, "路上：" + s.incident.text + (s.incident.minutes ? " · " + s.incident.minutes + " 分钟" : "") + (s.incident.money ? " · " + (s.incident.money > 0 ? "+" : "") + s.incident.money + " 币" : "")) : null,
            current.kind === "photo" ? h("div", null,
              h("div", { style: { display: "flex", justifyContent: "space-around", padding: "18px 0", border: "8px solid " + t.line, borderBottomWidth: 28, borderRadius: 8, background: t.bg, transform: "rotate(1deg)", marginBottom: 18 } }, h(Avatar, { character: props.profile || {}, size: 60, radius: 14 }), h(Avatar, { character: char, size: 60, radius: 14 })),
              h("label", { style: { display: "block", color: t.ink, fontSize: 13 } }, "你的动作：" + C.POSES[aim], h("input", { "data-part": "aim", type: "range", min: 0, max: 2, step: 1, value: aim, onChange: e => setAim(Number(e.target.value)), style: { width: "100%", minHeight: 44, accentColor: t.tint } })),
              primary("准备好了，拍", () => doActivity(aim), false, "shoot"))
            : current.kind === "claw" ? h("div", null,
              h("div", { style: { fontSize: 12, color: t.sub, marginBottom: 8 } }, "TA 管前后，停在第 " + (s.prepared.row + 1) + " 排。你拖动下面的滑杆，管左右。"),
              h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7, background: t.bg, padding: 12, border: "6px solid " + t.line, borderRadius: 14 } }, Array.from({ length: 9 }, (_, i) => h("div", { key: i, style: { minHeight: 50, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "2px solid " + (Math.floor(i / 3) === s.prepared.row && i % 3 === aim ? t.tint : t.line), fontSize: 25 } }, s.toys[Math.floor(i / 3)] === i % 3 ? (current.id === "capsule" ? "🥚" : "🧸") : "·"))),
              h("input", { "data-part": "aim", "aria-label": "左右移动", type: "range", min: 0, max: 2, step: 1, value: aim, onChange: e => setAim(Number(e.target.value)), style: { width: "100%", minHeight: 44, accentColor: t.tint } }),
              primary(current.id === "capsule" ? "一起扭" : "一起下钩", () => doActivity(aim), false, "claw"))
            : (current.kind === "walk" || current.kind === "talk") ? h("div", null,
              s.topic ? h("div", { "data-part": "topic", style: { padding: "12px 14px", borderRadius: 4, border: "1px dashed " + t.line, background: t.bg, color: t.ink, fontSize: 14, lineHeight: 1.7, marginBottom: 10, transform: "rotate(-.8deg)" } }, "抽到的聊天签：" + s.topic) : null,
              h("input", { "data-wk": "gameinput", "data-part": "topicline", value: text, maxLength: 300, onChange: e => setText(e.target.value), placeholder: "你先说两句（可空，空着就让 TA 先说）", style: { width: "100%", minHeight: 44, padding: "8px 10px", borderRadius: 12, border: "1px solid " + t.line, color: t.ink, background: t.bg, fontSize: 13, marginBottom: 8 } }),
              primary("就聊这个", () => doActivity(text), false, "talk"))
            : h("div", { style: { display: "grid", gap: 8 } }, (current.options || []).map(o => button(t, o[1], () => doActivity(o[0]), busy, o[0]))))))) : null,
        s.phase === "after" ? card(t, title("这一站做了什么", h("div", null,
          h("p", { style: { color: t.ink, fontSize: 14, lineHeight: 1.8, marginBottom: 12 } }, s.events[s.events.length - 1].text),
          !s.retryUsed && s.minutes >= 5 && ((current.kind === "photo" && !s.events[s.events.length - 1].match) || (current.kind === "claw" && !s.events[s.events.length - 1].win)) ? button(t, "再配合一次 · 5 分钟", () => act(C.retryActivity), busy, "retry-activity") : null,
          h("div", { style: { marginTop: 10 } }, primary(s.visits.length >= 4 || !available.length ? "收工，准备翻牌" : "接着逛，听听 TA", goNext, !!s.pending, "next"))))) : null,
        s.phase === "guess" ? card(t, title("你猜 TA 藏着什么任务", h("div", null,
          h("p", { style: { fontSize: 12, color: t.fog, lineHeight: 1.7, marginBottom: 12 } }, s.aiGuess === null ? "先让 TA 把猜测封好，再轮到你。" : "TA 的猜测已经封好，不会看到你怎么选。你也交一张。"),
          s.aiGuess === null && !s.pending ? primary("让 TA 先交猜测", () => ask("guess", "", ""), false, "guess-ai") : null,
          s.aiGuess !== null ? h("div", { style: { display: "grid", gap: 8 } }, C.MISSIONS.filter(m => m.id !== mine.id).concat([{ id: "unknown", title: "没猜出来", text: "这次先认输。" }]).map(m => button(t, m.title + " · " + m.text, () => setGuess(m.id), false, "guess-" + m.id, guess === m.id)),
            primary(judging ? "裁判在读你们的聊天…" : "一起翻牌", reveal, !guess || judging, "reveal")) : null))) : null,
        s.phase === "finished" ? h("div", { "data-wk": "datemission", "data-part": "result" }, card(t, title(s.result.user.score === s.result.char.score ? "你们打成平手了" : s.result.user.score > s.result.char.score ? "这局你的算盘更响" : "这局 TA 藏得更好",
          ["user", "char"].map(who => {
            const r = s.result[who], m = C.mission(s.missions[who]), guessed = who === "user" ? s.userGuess : s.aiGuess;
            return h("div", { key: who, style: { padding: "12px 0", borderTop: "1px dashed " + t.line, color: t.ink, lineHeight: 1.8, fontSize: 13 } },
              h("strong", null, (who === "user" ? "你" : char.remark || char.name) + " · " + r.score + " 分"),
              h("div", null, "秘密任务：" + m.text), h("div", { style: { color: t.tint } }, r.mission.done ? "完成 +2" : "没完成"),
              h("div", { style: { fontSize: 11, color: t.fog } }, r.mission.evidence),
              h("div", null, "猜的是：" + (C.mission(guessed) || { title: "没猜出来" }).title + (r.guess ? " · 猜中 +1" : " · 没猜中")));
          }))), h("p", { style: { color: t.fog, fontSize: 11, lineHeight: 1.7 } }, "这局只留在游戏存档里。回忆、关系和主聊天都没有改。")) : null,
        s.events.length ? h("details", { style: { color: t.sub, fontSize: 12, lineHeight: 1.8, margin: "14px 0" } }, h("summary", { style: { minHeight: 36 } }, "回看你们走过的路"), s.events.map((e, i) => h("div", { key: i, style: { padding: "7px 0", borderTop: "1px dashed " + t.line } }, C.place(e.place).name + " · " + e.text))) : null,
        unsaved ? card(t, [h("p", { key: "note", role: "alert", style: { color: t.tint, fontSize: 13, marginBottom: 8 } }, "这一局暂时没存好，先别退出。"), button(t, "重试保存", () => save(ref.current), false, "retry-save")]) : null,
        err ? card(t, [h("div", { key: "error", role: "alert", style: { color: t.tint, fontSize: 13 } }, "这一句没接上，进度留着。"), h("details", { key: "detail", style: { fontSize: 11, color: t.fog, marginTop: 8, overflowWrap: "anywhere", whiteSpace: "pre-wrap" } }, h("summary", null, "看具体原因"), err)]) : null,
        s.pending ? card(t, busy ? h("div", { role: "status", style: { color: t.sub, fontSize: 13 } }, "TA 正在想…") : primary("继续等 TA 这一句", () => run(ref.current), false, "retry-ai")) : null,
        ["plan", "after"].includes(s.phase) ? button(t, "今天先逛到这里，提前翻牌", close, busy || !!s.pending, "close") : null),
      s.phase === "plan" ? h("form", { "data-wk": "datecomposer", className: "shrink-0 flex items-center gap-2 px-3 py-2.5", onSubmit: e => { e.preventDefault(); ask("plan", text || (selected ? "我想去「" + C.place(selected).name + "」。" : ""), selected); }, style: { borderTop: "1px solid " + t.line, background: t.bg2, paddingBottom: COMPOSER_PAD_BOTTOM } },
        h("input", { "data-wk": "gameinput", "data-part": "chat", disabled: busy || unsaved || !!s.pending, value: text, maxLength: 600, onChange: e => setText(e.target.value), placeholder: selected ? "劝 TA 去这里，或者藏一下心思…" : "聊一句、试探一下，或让 TA 先提议…", style: { flex: 1, minWidth: 0, minHeight: 44, padding: "8px 10px", borderRadius: 12, border: "1px solid " + t.line, color: t.ink, background: t.bg, fontSize: 13 } }),
        h("button", { "data-part": "send", type: "submit", disabled: busy || unsaved || !!s.pending, style: { minHeight: 44, padding: "0 10px", borderRadius: 12, color: "#fff", background: t.tint, fontSize: 12, opacity: busy || s.pending ? .4 : 1 } }, selected ? "提议" : text ? "说一句" : "听 TA")) : null);
  }
  root.DateGameSetup = DateGameSetup; root.DateGame = DateGame;
  if (typeof module === "object" && module.exports) module.exports = { buildPrompt, buildJudge };
})(typeof window !== "undefined" ? window : globalThis);
