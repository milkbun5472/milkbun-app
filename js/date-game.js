"use strict";
(function (root) {
  const h = React.createElement, { useState, useRef, useEffect } = React, C = root.DateGameCore;
  function button(t, text, fn, disabled, part, hot) {
    return h("button", { "data-part": part, disabled: !!disabled, onClick: fn, style: { minHeight: 44, padding: "9px 12px", borderRadius: 12, border: "1px solid " + (hot ? t.tint : t.line), background: hot ? t.tint : t.bg2, color: hot ? "#fff" : t.ink, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", opacity: disabled ? .45 : 1, cursor: disabled ? "default" : "pointer" } }, text);
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
        card(t, [h("div", { key: "title", style: { fontFamily: F_DISPLAY, fontSize: "calc(21px * var(--app-fs, 1))", marginBottom: 8, color: t.ink } }, "一起出门，各有算盘。"),
          h("p", { key: "body", style: { fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.8 } }, "你和 TA 各抽一张秘密任务。180 分钟、200 枚游戏币，最多逛四处。商量路线时可以试探、装傻、说服，也可以成全对方。"),
          h("p", { key: "rules", style: { fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.8, marginTop: 8 } }, "每一站轮流做主。你做主的那站，商量两次后可以拍板；TA 做主的那站，要说服 TA 改提议。合照和抓玩偶由你们一起操作。收工前各猜一次对方的任务，最后翻牌：完成任务 2 分，猜中对方 1 分。")]),
        h("div", { style: { fontFamily: F_DISPLAY, color: t.ink, fontSize: "calc(14px * var(--app-fs, 1))", marginBottom: 10 } }, "这次和谁出门"),
        chars.map(c => h("button", { "data-wk": "block", key: c.id, "data-part": "partner", "data-id": c.id, onClick: () => setId(c.id), style: { display: "flex", width: "100%", alignItems: "center", gap: 12, padding: 11, marginBottom: 8, borderRadius: 13, background: t.bg2, border: "1px solid " + (id === c.id ? t.tint : t.line), color: t.ink, textAlign: "left" } },
          h(Avatar, { character: c, size: 38, radius: 12 }), h("span", { style: { flex: 1 } }, c.remark || c.name), id === c.id ? "已选" : "")),
        !chars.length ? card(t, "先去人格档案馆建一个角色，再来约 TA。") : null,
        h("label", { style: { display: "flex", gap: 9, alignItems: "center", minHeight: 48, color: t.sub, fontSize: "calc(12px * var(--app-fs, 1))" } }, h("input", { type: "checkbox", checked: chat, onChange: e => setChat(e.target.checked) }), "读最近聊天，让这一局更熟悉（只读）"),
        h("p", { style: { color: t.fog, fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: 1.7 } }, "独立小游戏。只保存本局，不写角色回忆，不改变真实关系；游戏币、玩偶和小物都只在这一局。")),
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
      + "【规则】180 分钟、200 枚游戏币，最多四站，不重复逛。同意一处只代表提议，具体走路和活动由游戏结算。奇数站用户做主，偶数站你做主。商量时认真读对方这句话在做什么，用短台词接话。say 像发消息一样，可以拆成一到三句、用换行隔开，一句一个气泡。\n"
      + (state.config.mode === "easy" ? "【放水局】这局你让着对方：好说话，愿意成全对方想去的地方和想做的事，猜任务时也不必太较真。\n" : "")
      + ((C.THEMES[state.theme] || {}).prompt ? "【这一局】" + C.THEMES[state.theme].prompt + "\n" : "")
      + "你的秘密任务只有你知道。对方的任务不在资料里，靠公开行动猜；可以试探、误导，也可以主动说破自己的任务。所有数值和成功都由裁判判断。\n"
      + (state.bonus ? "走完第二站你多抽到一张追加任务（yourBonus），完成多 1 分。\n" : "")
      + "每句台词另填 scheme：这句是不是在暗暗为你的任务使劲（是就 true，平常就是 false）。对方翻牌前可以指认你哪句在演，被指中对方多 1 分。\n"
      + "【你实际能看见的这一局】\n" + JSON.stringify(C.aiView(state));
    if (state.pending.kind === "react") {
      const p = C.place(state.current) || {}, last = state.events[state.events.length - 1] || {};
      return ctx + game + "\n【现在】你们到了「" + p.name + "」。刚才发生的：" + (last.text || "")
        + (last.topic ? "\n这一站抽到的聊天签：「" + last.topic + "」" + (last.line ? "，对方先说了：「" + last.line + "」" : "，对方没先开口") + "。就着它聊，照你自己的经历和性子说。" : "")
        + "\n像真在现场那样接一句（say），反应这件事、这个地方、或者刚才那个小意外；别复述规则和分数。"
        + (p.options ? "这里能挑东西：你替对方挑一样，pick 填下面一个选项 id：" + p.options.map(o => o[0] + "＝" + o[1]).join("、") + "。" : "")
        + "\nmood：这一站下来你心情变了多少，-10～10 的整数——照你自己的喜好和性子判：合不合你的胃口、刚才那个小意外对方怎么处理的、你们聊得怎么样。"
        + (C.wantsChallenge(state) ? "\n这一站你还可以给对方出一道小题，照你的性子出（不想出就不填 challenge）：lie＝说三件关于你自己的事，两真一假，fake 填假的那句是第几句（0～2）；dare＝一个开放的小要求，比如逗你笑、猜你喜欢的某样东西、用一句话夸你，text 写要求。" : "")
        + "\n只输出 JSON：{\"say\":\"你的台词\",\"mood\":0,\"scheme\":false" + (p.options ? ",\"pick\":\"选项 id\"" : "")
        + (C.wantsChallenge(state) ? ",\"challenge\":{\"kind\":\"lie 或 dare\",\"lines\":[\"第一句\",\"第二句\",\"第三句\"],\"fake\":1,\"text\":\"dare 的要求\"}" : "") + "}。";
    }
    if (state.pending.kind === "dare") {
      const said = (state.talk || []).filter(x => x.who === "user").slice(-1)[0];
      return ctx + game + "\n【现在】你刚才给对方出了题：「" + (state.challenge || {}).text + "」。对方回：「" + ((said && said.text) || "") + "」。"
        + "\n照你出题时心里的标准判过没过（pass），别为了哄人就放水，也别故意刁难；再接一句（say）。只输出 JSON：{\"pass\":true,\"say\":\"你的台词\"}。";
    }
    if (state.pending.kind === "chat") {
      const p = C.place(state.current) || {}, said = (state.talk || []).filter(x => x.who === "user").slice(-1)[0];
      return ctx + game + "\n【现在】" + (state.phase === "plan" ? "你们在商量下一站去哪儿" : state.phase === "guess" ? "逛完了，正准备翻牌" : "你们在「" + (p.name || "路上") + "」") + "，对方跟你说：「" + ((said && said.text) || "") + "」。"
        + "\n像真在一起那样接话（say），聊什么都行，不用把话题拉回游戏；别复述规则和分数。mood 是这句话让你心情变了多少（-3～3 的整数，平常就是 0）。只输出 JSON：{\"say\":\"你的台词\",\"mood\":0,\"scheme\":false}。";
    }
    if (state.pending.kind === "guess") return ctx + game
      + "\n收工了。现在秘密提交你对用户任务的猜测，guess 填任务池里的一个 id，拿不准填 unknown。say 是翻牌前给对方的一句台词，猜测由游戏藏好，翻牌后才显示。rate 是你给今天这次约会打几分（1～10，照你真实的感受），heart 是一句没说出口的心里话（翻牌后对方才看得到），title 是你给今天这次约会起的名字（八个字以内，会印在纪念票根上）。只输出 JSON：{\"guess\":\"任务 id 或 unknown\",\"say\":\"你的台词\",\"rate\":8,\"heart\":\"心里话\",\"title\":\"今天叫什么\"}";
    return ctx + game + "\n提出下一站。对方有提议时，你可接受或另提；accept=true 时 place 必须与对方提议相同。place 只选目前去得了的 id。pose 是合照准备动作的索引 0～2，row 是抓钩准备停的前后排 0～2；在游乐屋挑有玩偶的排，并用 hint 指点对方左右怎么配合。hint 是到了活动现场你给的短提示，可以直说，也可以逗对方猜。\n"
      + "只输出 JSON：{\"place\":\"地点 id\",\"accept\":true,\"pose\":0,\"row\":0,\"hint\":\"现场配合提示\",\"say\":\"商量这一站的台词\",\"scheme\":false}。";
  }
  // 开局配料（她 2026-10-14：「放开让模型想」）：照 TA 的人设和世界，给这一局的六处起名、写样子、配能挑的东西，
  //   再编几件路上的小意外和两三张看聊天的专属任务。玩法种类和判分不归它管。
  function buildPrep(props, char, state) {
    const pf = props.profile || {};
    const KIND = { menu: "吃东西（到了挑一样吃的）", photo: "合照（两人摆动作拍一张）", claw: "合力小游戏（一人管排一人管格）", gift: "挑东西（买一样或一对）", walk: "散步（边走边聊）", book: "翻书（一起看看书）", talk: "坐下来聊（看完东西或者待着聊天）" };
    const list = C.placesOf(state).map(id => { const b = C.PLACE_POOL.find(p => p.id === id); return "· " + id + "：" + KIND[b.kind] + "，默认叫「" + b.name + "」" + (b.options ? "，要配 3 样能挑的" + (b.kind === "menu" ? "（至少一样是甜的，tags 填 sweet）" : b.kind === "gift" ? "（至少一样是成对的，tags 填 pair）" : "") : ""); }).join("\n");
    return "你在给一局约会小游戏备料。去约会的是「" + (char.name || "TA") + "」和「" + (pf.name || "对方") + "」。\n【" + (char.name || "TA") + "】\n" + (char.persona || "")
      + "\n【" + (pf.name || "对方") + "】\n" + (pf.persona || pf.bio || "")
      + ((C.THEMES[state.theme] || {}).prompt ? "\n【这一次】" + C.THEMES[state.theme].zh : "")
      + "\n\n这局会去的六处，每处的玩法定好了，你只管它在这两个人的世界里长什么样：照他们所在的时代、城市、身份来起名（八个字以内）、写一句样子（二十字以内）、配一个 emoji 图标；要挑东西的那几处，配 3 样这里真会有的。\n" + list
      + "\n\n再编 5 件这两个人约会路上可能撞上的小意外（贴着他们的世界，别是谁都能用的那种），每件给两个怎么办，各写要花几分钟（-20~0）、几枚钱（-30~15，正数是省了或捡到）、对方心情会怎么变（-3~5）。"
      + "\n再写 3 张只属于这两个人的小任务，都要靠聊天才能完成（比如让对方说出某句话、承认某件事），照他们的关系和过去写，裁判会读聊天判。"
      + "\n只输出 JSON：{\"places\":{\"地点id\":{\"name\":\"\",\"note\":\"\",\"icon\":\"🍵\",\"options\":[{\"label\":\"\",\"tags\":[]}]}},\"incidents\":[{\"text\":\"\",\"choices\":[{\"label\":\"\",\"minutes\":-5,\"money\":0,\"mood\":2}]}],\"missions\":[{\"title\":\"四字以内\",\"text\":\"让对方……\"}]}";
  }
  // 翻牌前的裁判：只读聊天和走过的路，判两张「看人」的任务成没成。不看猜测、不给分。
  function buildJudge(props, char, state) {
    const pf = props.profile || {}, uName = pf.name || "用户", cName = char.name || "TA";
    const rows = [["user", uName, state.missions.user], ["char", cName, state.missions.char]]
      .concat(state.bonus ? [["userBonus", uName, state.bonus.user], ["charBonus", cName, state.bonus.char]] : []);
    const ask = rows.filter(x => (C.mission(x[2]) || {}).social)
      .map(x => "· " + x[0] + "（" + x[1] + "）的" + (/Bonus/.test(x[0]) ? "追加任务" : "任务") + "：" + C.mission(x[2]).text + "——对方是" + (x[1] === uName ? cName : uName));
    return "你是这局「各怀心思的约会」的裁判，只判事实。读下面的聊天和走过的路，判每一条任务有没有真的发生：要有一句话能当证据，引出来；含糊、勉强、是自己说的不算对方说的，都判没成。\n"
      + ask.join("\n")
      + "\n【聊天】\n" + state.talk.map(m => (m.who === "user" ? uName : cName) + "：" + m.text).join("\n")
      + "\n【走过的路】\n" + state.events.map(e => e.text).join("\n")
      + "\n只输出 JSON：{" + ask.map(a => "\"" + a.slice(2, a.indexOf("（")) + "\":{\"done\":true,\"evidence\":\"那一句\"}").join(",") + "}";
  }
  function DateGame(props) {
    const t = props.t, cfg = props.config, char = (props.characters || []).find(c => c.id === cfg.charIds[0]);
    const [s, setS] = useState(() => props.savedState && props.savedState.state || C.newGame(cfg, null, { hour: (typeof vclockNow === "function" ? vclockNow(cfg.charIds[0]) : new Date()).getHours() }));
    const ref = useRef(s), ticket = useRef(0), abortRef = useRef(null), busyRef = useRef(false), alive = useRef(true);
    const [busy, setBusy] = useState(false), [unsaved, setUnsaved] = useState(false), [err, setErr] = useState(""), [text, setText] = useState(""), [selected, setSelected] = useState(""), [aim, setAim] = useState(1), [guess, setGuess] = useState(""), [talkText, setTalkText] = useState(""), [dareText, setDareText] = useState(""), [accuse, setAccuse] = useState(null), [copied, setCopied] = useState(false), [showTask, setShowTask] = useState(() => { const v = props.savedState && props.savedState.state; return !v || !(v.visits || []).length; });   // 第一站摊开给她看，之后折着，别把聊天往下挤
    const save = n => { const ok = props.onSave({ config: cfg, state: n, label: n.phase === "finished" ? "这一局已翻牌 · 可以回看" : "第 " + n.round + " 站 · 剩 " + n.minutes + " 分钟" }) !== false; setUnsaved(!ok); return ok; };
    const put = n => { ref.current = n; setS(n); return save(n); };
    useEffect(() => { if (s.visits.length === 1) setShowTask(false); }, [s.visits.length]);   // 走完第一站就折起任务纸条（想看再点「偷看一眼」）
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
      act(x => C.finish(x, guess, judged, accuse));
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
    // 开局先配料：没配过就请 TA 的模型配一次；配不出来照默认的玩，不卡住
    const [prepping, setPrepping] = useState(false);
    const prep = async () => {
      if (busyRef.current || ref.current.prepped || !char) return;
      busyRef.current = true; setPrepping(true); const seq = ++ticket.current;
      try {
        const raw = await props.call(props.active, buildPrep(props, char, ref.current), [{ role: "user", content: "备料。" }], { maxTokens: 12000, logLabel: "各怀心思的约会·备料", timeout: 90000 });
        if (alive.current && seq === ticket.current) put(C.applyCustom(ref.current, typeof raw === "string" ? extractJSON(raw) : raw));
      } catch (e) { if (alive.current && seq === ticket.current) put(C.skipPrep(ref.current)); }
      finally { if (seq === ticket.current) { busyRef.current = false; if (alive.current) setPrepping(false); } }
    };
    useEffect(() => { if (!ref.current.prepped && !(ref.current.visits || []).length && !(ref.current.talk || []).length) prep(); else if (!ref.current.prepped) put(C.skipPrep(ref.current)); }, []);
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
    C.bind(s);
    const iconOf = id => ((C.place(id) || {}).icon) || ICON[id] || "📍";
    const available = C.legalPlaces(s), prop = C.place(s.proposal), current = C.place(s.current), mine = C.mission(s.missions.user);
    const primary = (label, fn, disabled, part) => button(t, label, fn, disabled || busy || unsaved, part, true);
    const title = (label, body) => h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: t.ink, marginBottom: 9 } }, label), body);
    // 一路的进度：四个站点连成一条虚线，走过的那站换成那处的小图标（她 2026-10-12：「一堆框好无聊」——不再是一行数字）
    const ICON = { cafe: "☕", noodle: "🍜", dessert: "🍦", bbq: "🍢", photo: "📸", studio: "🎞️", arcade: "🧸", capsule: "🥚", shop: "🛍️", flower: "💐", record: "💿", river: "🌊", rooftop: "🌆", park: "🌳", book: "📚", library: "📖", cinema: "🎬", observatory: "🔭", breakfast: "🥟", nightmarket: "🏮", sunset: "🌇", rings: "⭕", balloon: "🎈", ktv: "🎤" };
    const remaining = h("div", { "data-part": "route", style: { display: "flex", alignItems: "center", gap: 6, margin: "6px 2px 16px" } },
      [0, 1, 2, 3].map(i => {
        const id = s.visits[i], now = i === s.visits.length && s.phase !== "finished" && s.phase !== "guess";
        return [i ? h("span", { key: "l" + i, style: { flex: 1, borderTop: "2px dashed " + (id ? t.tint : t.line), opacity: id ? .7 : 1 } }) : null,
          h("span", { key: "d" + i, title: id ? C.place(id).name : "", style: { width: 34, height: 34, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: id ? 17 : 12, color: t.fog,
            background: id ? t.bg2 : "transparent", border: (now ? "2px solid " + t.tint : "1.5px dashed " + t.line), boxShadow: id ? "0 2px 6px rgba(30,20,10,.12)" : "none" } }, id ? iconOf(id) : String(i + 1))];
      }),
      h("span", { style: { marginLeft: 10, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink, whiteSpace: "nowrap" } },
        h("span", null, "⏱ " + s.minutes), h("span", null, "🪙 " + s.money)));
    // 纸条：贴一截胶带，微微歪着。任务、猜测、翻牌都用这一种纸，不用方框
    const slip = (kids, extra, key) => h("div", { key: key, style: Object.assign({ position: "relative", padding: "16px 16px 13px", margin: "6px 4px 16px", background: "#fffdf6", color: "#3a332b", borderRadius: 2,
      boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 6px 14px -8px rgba(40,25,10,.35)", transform: "rotate(-.7deg)" }, extra || {}) },
      h("span", { "aria-hidden": "true", style: { position: "absolute", top: -8, left: "50%", width: 54, height: 16, marginLeft: -27, background: "rgba(235,215,160,.75)", transform: "rotate(2deg)" } }), kids);
    // 一站的小票：上下锯齿虚线，像店里打出来的那张。夹在路上的对话里，排在那一站说的话中间（按发生先后）
    const receipt = (e, i) => h("div", { "data-part": "receipt", style: { margin: "4px 8px", padding: "12px 14px", background: "#fffdf6", color: "#3a332b", fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.8,
        borderTop: "2px dashed " + t.line, borderBottom: "2px dashed " + t.line, boxShadow: "0 6px 14px -10px rgba(40,25,10,.45)" } },
      h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "calc(11px * var(--app-fs, 1))", color: "#9a8f80", letterSpacing: 1, marginBottom: 4 } }, h("span", null, iconOf(e.place) + " " + ((C.place(e.place) || {}).name || "")), h("span", null, "第 " + (i + 1) + " 站")),
      e.text);
    // 路上的话和小票排成一条：每到新的一站先落一行站名，TA 一句话拆成几个气泡（她 2026-10-14：「节奏和气泡显示有点不对」）
    const feedLines = (() => {
      const out = [], uName = (props.profile || {}).name || "你", cName = char ? (char.remark || char.name) : "TA";
      let lastRound = 0, ev = 0;
      C.feed(s).forEach((f, k) => {
        const r = Number(f.item.round) || 0;
        if (r && r !== lastRound) { lastRound = r; const vid = s.visits[r - 1]; out.push({ sys: true, text: "· 第 " + r + " 站" + (vid ? " · " + iconOf(vid) + " " + C.place(vid).name : "") + " ·" }); }
        if (f.kind === "event") { out.push({ node: receipt(f.item, ev++) }); return; }
        const m = f.item;
        if (m.who === "user") { out.push({ me: true, name: uName, text: m.text, at: k }); return; }
        String(m.text || "").split(/\n+/).map(x => x.trim()).filter(Boolean).forEach((x, j) => out.push({ id: char && char.id, name: cName, text: x, at: k + "_" + j }));
      });
      return out;
    })();
    const sectionTitle = (label, sub) => h("div", { style: { margin: "4px 2px 10px", display: "flex", alignItems: "baseline", gap: 8 } },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: t.ink } }, label), sub ? h("span", { style: { fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog } }, sub) : null);
    if (!char || (props.isEngineer && props.isEngineer(char.id))) return h("div", { "data-wk": "dategamepage", "data-part": "run", className: "h-full flex flex-col" }, h(Head, { zh: "各怀心思的约会", onBack: props.onBack }), card(t, "这一局的角色不可用。存档还留着，可以返回重新选人。"));
    // TA 的心情条（她 2026-10-14）：座位卡上一颗心＋数，最近一次涨跌跟在后面
    const mood = C.moodOf(s), lastMood = (s.moodLog || []).slice(-1)[0];
    const moodLine = (mood >= 80 ? "💗" : mood >= 60 ? "🙂" : mood >= 40 ? "😐" : "😕") + " 心情 " + mood + (lastMood && lastMood.round === s.round ? (lastMood.d > 0 ? " ↑" : " ↓") : "");
    const seats = [{ key: "user", name: (props.profile || {}).name || "你", isUser: true, char: props.profile || {}, sub: s.phase === "finished" ? s.result.user.score + " 分" : "秘密任务已装好", on: s.phase === "plan" && !!(s.round % 2) },
      { key: char.id, name: char.remark || char.name, char, sub: s.phase === "finished" ? s.result.char.score + " 分" : moodLine, on: s.phase === "plan" && !(s.round % 2) }];
    return h("div", { "data-wk": "datepage", className: "h-full flex flex-col", style: props.table("date", t) },
      h(Head, { zh: "各怀心思的约会", sub: s.phase === "finished" ? "翻牌时间" : "第 " + s.round + " 站 · " + (s.round % 2 ? "这一站你做主" : "这一站 TA 做主"), bg: "transparent", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-5", "data-part": "scroll" },
        h(props.VsBar, { t, seats, mid: "同行" }), remaining,
        h("div", { "data-wk": "datemission" }, slip([
          h("button", { "data-wk": "block", key: "toggle", onClick: () => setShowTask(!showTask), style: { display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", color: "#a0603f", fontSize: "calc(11.5px * var(--app-fs, 1))", letterSpacing: 1, minHeight: 28, background: "none", border: "none", padding: 0 } }, "我的秘密任务", showTask ? "折起来" : "偷看一眼"),
          showTask ? h("div", { key: "task", style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", lineHeight: 1.7, marginTop: 4 } }, mine.text,
            h("div", { style: { fontFamily: F_BODY, color: C.progress(s, mine.id).done ? "#5d8b4c" : "#9a8f80", fontSize: "calc(11px * var(--app-fs, 1))", marginTop: 4 } }, mine.social ? "看你们聊了什么——翻牌前会读一遍聊天" : C.progress(s, mine.id).done ? (mine.id === "save" && s.phase !== "finished" ? "✓ 目前达成 · 别把剩的钱花掉了" : "✓ 已经达成了") : "藏好一点，TA 不知道你抽中了什么")) : null])),
        // 追加任务（走完第二站抽的，完成多 1 分）
        s.bonus && s.phase !== "finished" ? h("div", { "data-part": "bonus" }, slip([
          h("div", { key: "h", style: { color: "#a0603f", fontSize: "calc(11.5px * var(--app-fs, 1))", letterSpacing: 1 } }, "追加任务 · +1"),
          h("div", { key: "t", style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", lineHeight: 1.6, marginTop: 3 } }, C.mission(s.bonus.user).text)
        ], { padding: "13px 15px 11px", transform: "rotate(.6deg)", background: "#fff8e6" }, "bonus")) : null,
        // 路上聊的：跟五子棋、你画我猜同一个左右气泡（GameTalkLog），不另画一套
        feedLines.length && root.GameTalkLog ? h(root.GameTalkLog, { t, uName: (props.profile || {}).name || "你", me: props.profile || {}, maxHeight: "none", k: "date",
          lines: feedLines, charOf: () => char }) : null,
        prepping ? h("div", { "data-part": "prep", style: { display: "flex", alignItems: "center", gap: 10, margin: "8px 4px 16px", color: t.sub, fontSize: "calc(13px * var(--app-fs, 1))" } },
          h(Avatar, { character: char, size: 28, radius: 9 }), h("span", { role: "status" }, (char.remark || char.name) + " 在想今天去哪儿逛…"),
          h("button", { "data-part": "skipprep", onClick: () => { ticket.current++; busyRef.current = false; setPrepping(false); put(C.skipPrep(ref.current)); }, style: { marginLeft: "auto", fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, textDecoration: "underline", background: "none", border: "none", minHeight: 32 } }, "不等了")) :
        s.phase === "plan" ? h("div", { "data-wk": "datemap" },
          sectionTitle("下一站去哪儿", s.round % 2 ? "这一站你做主" : "这一站 TA 做主"),
          // 一张纸地图：街道是几道浅浅的斜线，地点是贴在上面的圆形贴纸，错落着摆，不排成格子
          h("div", { "data-part": "map", style: { position: "relative", padding: "18px 8px 10px", borderRadius: 18, marginBottom: 12,
            background: "linear-gradient(115deg, transparent 47%, " + t.line + " 47.5%, " + t.line + " 49%, transparent 49.5%), linear-gradient(25deg, transparent 62%, " + t.line + " 62.5%, " + t.line + " 64%, transparent 64.5%), " + t.bg2,
            boxShadow: "inset 0 0 0 1px " + t.line } },
            h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", rowGap: 4 } }, C.placesOf(s).map(C.place).filter(Boolean).map((p, i) => {
              const ok = available.some(a => a.id === p.id), on = selected === p.id, went = s.visits.includes(p.id), proposed = s.proposal === p.id;
              return h("button", { key: p.id, "data-part": "place", "data-id": p.id, disabled: !ok || busy || !!s.pending, onClick: () => setSelected(on ? "" : p.id),
                style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 2px 8px", minHeight: 96, background: "none", border: "none", color: t.ink,
                  transform: "translateY(" + (i % 3 === 1 ? 14 : 0) + "px)", opacity: ok || went ? 1 : .35 } },
                h("span", { style: { position: "relative", width: 52, height: 52, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "calc(25px * var(--app-fs, 1))",
                  background: "#fffdf6", boxShadow: on ? "0 0 0 3px " + t.tint + ", 0 6px 12px -6px rgba(0,0,0,.4)" : "0 4px 10px -6px rgba(0,0,0,.45)",
                  filter: went ? "grayscale(1)" : "none", transform: on ? "scale(1.08) rotate(-4deg)" : "none", transition: "transform .15s" } },
                  iconOf(p.id),
                  went ? h("span", { style: { position: "absolute", bottom: -4, right: -8, padding: "1px 5px", border: "1.5px solid #b0553f", color: "#b0553f", borderRadius: 4, fontSize: "calc(9.5px * var(--app-fs, 1))", background: "#fffdf6", transform: "rotate(-12deg)" } }, "去过") : null,
                  proposed && !went ? h("span", { style: { position: "absolute", top: -10, right: -12, fontSize: "calc(18px * var(--app-fs, 1))" } }, "💭") : null),
                h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.3, textAlign: "center" } }, p.name),
                h("span", { style: { fontSize: "calc(10px * var(--app-fs, 1))", color: t.fog } }, went ? "" : p.time + "分 · " + (p.cost ? p.cost + "币" : "免费")));
            }))),
          selected ? h("div", { style: { fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.6, margin: "0 4px 12px" } }, iconOf(selected) + " " + C.place(selected).name + "：" + C.place(selected).note) : null,
          // TA 想去哪儿：一句气泡，按钮跟在后面，不再套一个框
          prop ? h("div", { "data-part": "proposal", style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "0 2px 12px" } },
            h(Avatar, { character: char, size: 30, radius: 10 }),
            h("span", { style: { padding: "7px 12px", borderRadius: "4px 14px 14px 14px", background: t.bg2, border: "1px solid " + t.line, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, "想去 " + iconOf(prop.id) + " " + prop.name),
            primary("就去这里", () => act(x => C.commitPlace(x, s.proposal)), !!s.pending, "accept"),
            s.round % 2 && s.exchanges >= 2 && selected && selected !== s.proposal ? button(t, "这站我来定", () => act(x => C.commitPlace(x, selected, true)), busy || !!s.pending, "override") : null) : null,
          h("p", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.7, margin: "0 4px 10px" } }, s.round % 2 ? "点一处贴纸，在底下说句话提议。商量两次后可以拍板，也可以直接答应 TA。" : "这站 TA 说了算。挑另一处贴纸，说句话劝 TA 改主意，或者就跟着 TA 走。")) : null,
        s.phase === "activity" ? h("div", { "data-wk": "dateactivity" }, h("div", null,
          h("div", { "data-part": "scene", style: { display: "flex", alignItems: "center", gap: 12, margin: "2px 2px 14px" } },
            h("span", { style: { fontSize: "calc(40px * var(--app-fs, 1))", lineHeight: 1, filter: "drop-shadow(0 4px 6px rgba(0,0,0,.18))" } }, iconOf(current.id)),
            h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: t.ink } }, current.name), h("div", { style: { fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, current.note))),
          h("div", null,
            s.prepared.hint && (current.kind === "photo" || current.kind === "claw") ? h("p", { style: { fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.7, margin: "0 4px 14px" } }, "💬 " + (char.remark || char.name) + "：" + s.prepared.hint) : null,
            // 路上的小意外有两条路时，先挑一条再做这一站（她 2026-10-14）
            s.incident && s.incident.choices && !s.incident.picked ? h("div", { "data-part": "incidentchoice", style: { margin: "0 0 16px" } },
              h("div", { "data-wk": "block", style: { display: "inline-block", padding: "7px 11px", margin: "0 0 10px 4px", background: "#fdf1b8", color: "#5a4a20", fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.6, transform: "rotate(1.2deg)", boxShadow: "0 4px 8px -5px rgba(0,0,0,.4)" } }, "⚡ 路上：" + s.incident.text + "，怎么办？"),
              h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, s.incident.choices.map((c, i) => h("button", { key: c.id, "data-part": "incident-" + c.id, disabled: busy, onClick: () => act(x => C.chooseIncident(x, c.id)),
                style: { minHeight: 56, padding: "9px 11px", background: "#fffdf6", color: "#3a332b", border: "none", borderRadius: 2, fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.4, textAlign: "left", boxShadow: "0 6px 12px -8px rgba(40,25,10,.45)", transform: "rotate(" + (i ? .8 : -.8) + "deg)", borderLeft: "3px solid #e0b735" } }, c.label)))) :
            s.incident ? h("div", { "data-part": "incident", style: { display: "inline-block", padding: "7px 11px", margin: "0 0 14px 4px", background: "#fdf1b8", color: "#5a4a20", fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.6, transform: "rotate(1.2deg)", boxShadow: "0 4px 8px -5px rgba(0,0,0,.4)" } }, "⚡ 路上：" + s.incident.text + (s.incident.pickedLabel ? "，" + s.incident.pickedLabel : "") + (s.incident.minutes ? " · " + s.incident.minutes + " 分钟" : "") + (s.incident.money ? " · " + (s.incident.money > 0 ? "+" : "") + s.incident.money + " 币" : "")) : null,
            s.incident && s.incident.choices && !s.incident.picked ? null : current.kind === "photo" ? h("div", null,
              h("div", { style: { display: "flex", justifyContent: "space-around", padding: "18px 0", border: "8px solid " + t.line, borderBottomWidth: 28, borderRadius: 8, background: t.bg, transform: "rotate(1deg)", marginBottom: 18 } }, h(Avatar, { character: props.profile || {}, size: 60, radius: 14 }), h(Avatar, { character: char, size: 60, radius: 14 })),
              h("label", { style: { display: "block", color: t.ink, fontSize: "calc(13px * var(--app-fs, 1))" } }, "你的动作：" + C.POSES[aim], h("input", { "data-part": "aim", type: "range", min: 0, max: 2, step: 1, value: aim, onChange: e => setAim(Number(e.target.value)), style: { width: "100%", minHeight: 44, accentColor: t.tint } })),
              primary("准备好了，拍", () => doActivity(aim), false, "shoot"))
            : current.kind === "claw" ? h("div", null,
              h("div", { style: { fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, marginBottom: 8 } }, "TA 管前后，停在第 " + (s.prepared.row + 1) + " 排。你拖动下面的滑杆，管左右。"),
              h("div", { "data-wk": "block", style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7, background: t.bg, padding: 12, border: "6px solid " + t.line, borderRadius: 14 } }, Array.from({ length: 9 }, (_, i) => h("div", { key: i, style: { minHeight: 50, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "2px solid " + (Math.floor(i / 3) === s.prepared.row && i % 3 === aim ? t.tint : t.line), fontSize: "calc(25px * var(--app-fs, 1))" } }, s.toys[Math.floor(i / 3)] === i % 3 ? ({ capsule: "🥚", rings: "🎁", balloon: "🎈" }[current.id] || "🧸") : "·"))),
              h("input", { "data-part": "aim", "aria-label": "左右移动", type: "range", min: 0, max: 2, step: 1, value: aim, onChange: e => setAim(Number(e.target.value)), style: { width: "100%", minHeight: 44, accentColor: t.tint } }),
              primary(({ capsule: "一起扭", rings: "扔圈", balloon: "开枪" }[current.id] || "一起下钩"), () => doActivity(aim), false, "claw"))
            : (current.kind === "walk" || current.kind === "talk") ? h("div", null,
              s.topic ? h("div", { "data-part": "topic", style: { padding: "12px 14px", borderRadius: 4, border: "1px dashed " + t.line, background: t.bg, color: t.ink, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.7, marginBottom: 10, transform: "rotate(-.8deg)" } }, "抽到的聊天签：" + s.topic) : null,
              h("input", { "data-wk": "gameinput", "data-part": "topicline", value: text, maxLength: 300, onChange: e => setText(e.target.value), placeholder: "你先说两句（可空，空着就让 TA 先说）", style: { width: "100%", minHeight: 44, padding: "8px 10px", borderRadius: 12, border: "1px solid " + t.line, color: t.ink, background: t.bg, fontSize: "calc(13px * var(--app-fs, 1))", marginBottom: 8 } }),
              primary("就聊这个", () => doActivity(text), false, "talk"))
            : h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, (current.options || []).map((o, i) => h("button", { key: o[0], "data-part": o[0], disabled: busy, onClick: () => doActivity(o[0]),
                style: { minHeight: 64, padding: "10px 12px", background: "#fffdf6", color: "#3a332b", border: "none", borderRadius: 2, fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.4, textAlign: "left",
                  boxShadow: "0 6px 12px -8px rgba(40,25,10,.45)", transform: "rotate(" + (i % 2 ? .8 : -.8) + "deg)", borderLeft: "3px solid " + t.tint } }, o[1])))))) : null,
        // 这一站的小票：上下锯齿虚线，像店里打出来的那张
        s.phase === "after" ? h("div", { "data-part": "after" },
          // TA 出的小题（她 2026-10-14）：三句里猜一句假的，或者回 TA 一个小要求；答上了多 10 分钟、TA 心情 +5
          s.challenge ? h("div", { "data-part": "challenge" }, slip([
            h("div", { key: "h", style: { color: "#a0603f", fontSize: "calc(11.5px * var(--app-fs, 1))", letterSpacing: 1 } }, (char.remark || char.name) + " 出了道题"),
            h("div", { key: "t", style: { fontFamily: F_DISPLAY, fontSize: "calc(15.5px * var(--app-fs, 1))", lineHeight: 1.7, marginTop: 4 } }, s.challenge.text),
            s.challenge.kind === "lie" ? h("div", { key: "o", style: { display: "flex", flexDirection: "column", gap: 7, marginTop: 9 } }, s.challenge.options.map((o, i) => {
              const done = s.challenge.done, isFake = done && i === s.challenge.answer, picked = done && i === s.challenge.picked;
              return h("button", { key: i, "data-part": "lie-" + i, disabled: done || busy, onClick: () => act(x => C.answerLie(x, i)),
                style: { minHeight: 44, padding: "8px 11px", textAlign: "left", fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.5, color: "#3a332b", background: picked ? "#fff4d6" : "#fffaf0", border: "1px solid " + (isFake ? "#b0553f" : "#e8dfcf"), borderRadius: 8 } },
                o, isFake ? h("span", { style: { marginLeft: 6, color: "#b0553f", fontSize: "calc(11.5px * var(--app-fs, 1))" } }, "← 假的") : null);
            })) : null,
            s.challenge.kind === "dare" && !s.challenge.done ? h("div", { key: "d", style: { display: "flex", gap: 8, marginTop: 9 } },
              h("input", { "data-wk": "input", "data-part": "dareline", value: dareText, onChange: e => setDareText(e.target.value.slice(0, 300)), placeholder: "回 TA 一句…", disabled: busy || !!s.pending, style: { flex: 1, minWidth: 0, minHeight: 42, padding: "8px 10px", borderRadius: 10, border: "1px solid #e8dfcf", background: "#fffaf0", color: "#3a332b", fontSize: "calc(13px * var(--app-fs, 1))" } }),
              h("button", { "data-part": "daresend", disabled: busy || !!s.pending || !dareText.trim(), onClick: () => { ask("dare", dareText.trim(), ""); setDareText(""); }, style: { minHeight: 42, padding: "0 14px", borderRadius: 10, color: "#fff", background: t.tint, fontSize: "calc(13px * var(--app-fs, 1))", opacity: busy || !dareText.trim() ? .45 : 1 } }, "回答")) : null,
            s.challenge.done ? h("div", { key: "r", style: { marginTop: 9, fontSize: "calc(12.5px * var(--app-fs, 1))", color: s.challenge.pass ? "#5d8b4c" : "#9a8f80" } }, s.challenge.skipped ? "没接这题" : s.challenge.pass ? "✓ 答上了 · 多了 10 分钟，TA 心情 +5" : "✗ 没答上，不扣东西")
              : h("button", { "data-wk": "block", key: "s", "data-part": "skipchallenge", onClick: () => act(C.skipChallenge), disabled: busy || !!s.pending, style: { marginTop: 8, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#9a8f80", background: "none", border: "none", textDecoration: "underline", minHeight: 32 } }, "不接这题")
          ], { margin: "8px 4px 14px" }, "challenge")) : null,
          !s.retryUsed && s.minutes >= 5 && ((current.kind === "photo" && !s.events[s.events.length - 1].match) || (current.kind === "claw" && !s.events[s.events.length - 1].win)) ? button(t, "再配合一次 · 5 分钟", () => act(C.retryActivity), busy, "retry-activity") : null,
          h("div", { style: { margin: "4px 2px" } }, primary(s.visits.length >= 4 || !available.length ? "收工，准备翻牌" : "接着逛，听听 TA", goNext, !!s.pending || !!(s.challenge && !s.challenge.done), "next"))) : null,
        // 猜：任务一张张摊成纸条，点哪张就翻起哪张
        s.phase === "guess" ? h("div", { "data-part": "guess" },
          sectionTitle("你猜 TA 藏着什么任务", s.aiGuess === null ? "TA 先封猜测" : "TA 已经封好，看不到你选什么"),
          s.aiGuess === null && !s.pending ? h("div", { style: { margin: "0 2px 12px" } }, primary("让 TA 先交猜测", () => ask("guess", "", ""), false, "guess-ai")) : null,
          s.aiGuess !== null ? h("div", null,
            h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "4px 2px 16px" } },
              C.aiView(s).missionPool.filter(m => m.id !== mine.id).concat([{ id: "unknown", title: "没猜出来", text: "这次先认输。" }]).map((m, i) => {
                const on = guess === m.id;
                return h("button", { key: m.id, "data-part": "guess-" + m.id, onClick: () => setGuess(m.id),
                  style: { minHeight: 82, padding: "10px 11px", textAlign: "left", background: on ? "#fff4d6" : "#fffdf6", color: "#3a332b", border: "none", borderRadius: 2,
                    boxShadow: on ? "0 0 0 2px " + t.tint + ", 0 8px 14px -8px rgba(40,25,10,.5)" : "0 6px 12px -8px rgba(40,25,10,.45)", transform: "rotate(" + ((i % 3) - 1) * .9 + "deg) translateY(" + (on ? -3 : 0) + "px)", transition: "transform .15s" } },
                  h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))" } }, m.title), h("div", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: "#7a7064", lineHeight: 1.5, marginTop: 3 } }, m.text));
              })),
            // 指认（她 2026-10-14 挑的第 5 条）：挑 TA 的一句，说它是在为任务使劲，指对了多 1 分。可以不挑
            sectionTitle("指认一句", "觉得 TA 哪句是在演？指对 +1，可以不挑"),
            h("div", { "data-part": "accuse", style: { display: "flex", flexDirection: "column", gap: 6, margin: "0 2px 16px" } },
              (s.talk || []).map((m, i) => ({ m, i })).filter(x => x.m.who === "char").slice(-8).map(x => h("button", { key: x.i, "data-part": "accuse-" + x.i, onClick: () => setAccuse(accuse === x.i ? null : x.i),
                style: { textAlign: "left", minHeight: 40, padding: "7px 11px", borderRadius: 10, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.5, color: t.ink, background: accuse === x.i ? t.tint + "1f" : t.bg2, border: "1px solid " + (accuse === x.i ? t.tint : t.line) } },
                (accuse === x.i ? "🎭 " : "") + x.m.text.slice(0, 60)))),
            primary(judging ? "裁判在读你们的聊天…" : "一起翻牌", reveal, !guess || judging, "reveal")) : null) : null,
        // 翻牌：两张任务纸条并排翻开，各自盖上「完成／没完成」的章
        s.phase === "finished" ? h("div", { "data-wk": "datemission", "data-part": "result" },
          h("div", { style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: "calc(20px * var(--app-fs, 1))", color: t.ink, margin: "6px 0 14px" } }, s.result.user.score === s.result.char.score ? "你们打成平手了" : s.result.user.score > s.result.char.score ? "这局你的算盘更响" : "这局 TA 藏得更好"),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } }, ["user", "char"].map((who, i) => {
            const r = s.result[who], m = C.mission(s.missions[who]), guessed = who === "user" ? s.userGuess : s.aiGuess;
            return slip([
              h("div", { key: "n", style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } }, h("strong", { style: { fontSize: "calc(13px * var(--app-fs, 1))" } }, who === "user" ? "你" : char.remark || char.name), h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: "#a0603f" } }, r.score)),
              h("div", { key: "m", style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.6, margin: "6px 0" } }, m.text),
              h("div", { key: "st", style: { display: "inline-block", padding: "1px 7px", border: "1.5px solid " + (r.mission.done ? "#5d8b4c" : "#b0553f"), color: r.mission.done ? "#5d8b4c" : "#b0553f", borderRadius: 4, fontSize: "calc(11px * var(--app-fs, 1))", transform: "rotate(-6deg)" } }, r.mission.done ? "完成 +2" : "没完成"),
              h("div", { key: "e", style: { fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#9a8f80", lineHeight: 1.5, marginTop: 6 } }, r.mission.evidence),
              h("div", { key: "g", style: { fontSize: "calc(11.5px * var(--app-fs, 1))", marginTop: 8, color: r.guess ? "#5d8b4c" : "#7a7064" } }, "猜：" + (C.mission(guessed) || { title: "没猜出来" }).title + (r.guess ? " ✓ +1" : " ✗")),
              r.bonus ? h("div", { key: "b", style: { fontSize: "calc(11.5px * var(--app-fs, 1))", marginTop: 4, color: r.bonus.done ? "#5d8b4c" : "#7a7064" } }, "追加：" + C.mission(s.bonus[who]).title + (r.bonus.done ? " ✓ +1" : " ✗")) : null,
              r.accuse ? h("div", { key: "a", style: { fontSize: "calc(11.5px * var(--app-fs, 1))", marginTop: 4, color: r.accuse.hit ? "#5d8b4c" : "#7a7064" } }, "指认「" + r.accuse.text.slice(0, 14) + "…」" + (r.accuse.hit ? " ✓ +1" : " ✗ 那句是真心的")) : null
            ], { margin: "8px 0", transform: "rotate(" + (i ? 1 : -1.2) + "deg)" }, who);
          })),
          // 收进记忆／战报（她 2026-10-23：「可以开口，但得让他知道这是操控虚拟小人玩的，不是真的约会」）
          window.GameKeepMemBtn ? h(window.GameKeepMemBtn, { t: t, host: props, rep: () => {
            const cn = char.remark || char.name, u = s.result.user, c = s.result.char;
            const spots = (s.visits || []).map(id => (C.place(id) || {}).name).filter(Boolean).join("、");
            return { key: "date", zh: "各怀心思的约会", ids: [char.id], wins: c.score > u.score ? [char.id] : [], meWin: u.score === c.score ? null : u.score > c.score,
              procLabel: "游戏里两个小人一路聊的", proc: (s.talk || []).map(x => ({ name: x.who === "user" ? "她" : cn, text: x.text })),
              text: "一起在手机上玩了小游戏「各怀心思的约会」——是两个人各操控一个虚拟小人在地图上逛、各自做秘密任务，不是真的出门约会。"
                + (spots ? "小人逛了" + spots + "。" : "") + "比分 " + u.score + " : " + c.score + "（她 : " + cn + "）"
                + (s.rating && s.rating.score ? "，" + cn + "给这局打了 " + s.rating.score + " 分" : "") + "。" };
          } }) : null,
          // TA 给这次约会打几分＋一句心里话＋一路的心情（她 2026-10-14）
          h("div", { "data-part": "rating", style: { margin: "10px 4px 4px", padding: "14px 16px", borderRadius: 14, background: t.bg2, border: "1px solid " + t.line, textAlign: "center" } },
            h("div", { style: { fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, (char.remark || char.name) + " 给今天打"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(30px * var(--app-fs, 1))", color: "#a0603f", margin: "2px 0" } }, s.rating && s.rating.score ? s.rating.score + " / 10" : "—"),
            h("div", { style: { fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub } }, moodLine.replace(/ ↑| ↓/, "") + " · 一路" + ((s.moodLog || []).length ? (s.moodLog || []).map(x => (x.d > 0 ? "+" : "") + x.d).join(" ") : "没怎么变")),
            s.rating && s.rating.heart ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.7, marginTop: 10 } }, "「" + s.rating.heart + "」") : null),
          // 纪念票根（第 6 条）：TA 给今天起的名字、四站图标、每站一句。只在游戏存档里，能复制
          (() => {
            const name = (s.rating && s.rating.title) || "今天";
            const rows = s.events.map(e => iconOf(e.place) + " " + ((C.place(e.place) || {}).name || "") + "：" + String(e.text || "").replace(/^（[^）]*）/, "").replace(/^[^：]*：/, "").slice(0, 26));
            const text = "《" + name + "》\n" + rows.join("\n") + (s.rating && s.rating.score ? "\n" + (char.remark || char.name) + " 打了 " + s.rating.score + " 分" : "");
            return h("div", { "data-part": "ticket", style: { position: "relative", margin: "16px 6px 6px", padding: "14px 18px 12px", background: "#fffdf6", color: "#3a332b", borderRadius: 10,
                boxShadow: "0 8px 18px -10px rgba(40,25,10,.5)", borderLeft: "2px dashed " + t.line } },
              h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
                h("span", { style: { fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: 3, color: "#9a8f80" } }, "ADMIT TWO · 约会票根"),
                h("span", { style: { fontSize: "calc(10.5px * var(--app-fs, 1))", color: "#9a8f80" } }, new Date().toLocaleDateString())),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", margin: "6px 0 8px" } }, "《" + name + "》"),
              h("div", { style: { display: "flex", gap: 8, marginBottom: 8, fontSize: "calc(22px * var(--app-fs, 1))" } }, s.visits.map(v => h("span", { key: v }, iconOf(v) || "·"))),
              rows.map((r, i) => h("div", { key: i, style: { fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.7, color: "#5a5045" } }, r)),
              h("button", { "data-part": "ticketcopy", onClick: () => { try { (typeof copyText === "function" ? copyText : x => navigator.clipboard.writeText(x))(text); setCopied(true); } catch (e) {} },
                style: { marginTop: 8, fontSize: "calc(12px * var(--app-fs, 1))", color: "#a0603f", background: "none", border: "1px dashed #d8c9b0", borderRadius: 8, padding: "5px 12px", minHeight: 34 } }, copied ? "已复制" : "复制票根"));
          })(),
          h("p", { style: { color: t.fog, fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: 1.7, textAlign: "center", marginTop: 8 } }, "这局只留在游戏存档里。回忆、关系和主聊天都没有改。")) : null,
        s.events.length ? h("details", { style: { color: t.sub, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.8, margin: "14px 0" } }, h("summary", { style: { minHeight: 36 } }, "回看你们走过的路"), s.events.map((e, i) => h("div", { key: i, style: { padding: "7px 0", borderTop: "1px dashed " + t.line } }, C.place(e.place).name + " · " + e.text))) : null,
        unsaved ? h("div", { style: { margin: "10px 4px" } }, h("p", { role: "alert", style: { color: t.tint, fontSize: "calc(13px * var(--app-fs, 1))", marginBottom: 8 } }, "这一局暂时没存好，先别退出。"), button(t, "重试保存", () => save(ref.current), false, "retry-save")) : null,
        err ? h("div", { style: { margin: "10px 4px" } }, h("div", { role: "alert", style: { color: t.tint, fontSize: "calc(13px * var(--app-fs, 1))" } }, "这一句没接上，进度留着。"), h("details", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, marginTop: 8, overflowWrap: "anywhere", whiteSpace: "pre-wrap" } }, h("summary", null, "看具体原因"), err)) : null,
        s.pending ? h("div", { style: { margin: "8px 4px", display: "flex", alignItems: "center", gap: 8 } }, busy ? [h(Avatar, { key: "a", character: char, size: 24, radius: 8 }), h("span", { key: "s", role: "status", style: { color: t.sub, fontSize: "calc(13px * var(--app-fs, 1))" } }, (char.remark || char.name) + " 在想…")] : primary("继续等 TA 这一句", () => run(ref.current), false, "retry-ai")) : null,
        ["plan", "after"].includes(s.phase) ? h("button", { "data-part": "close", onClick: close, disabled: busy || !!s.pending, style: { display: "block", margin: "18px auto 4px", minHeight: 40, padding: "0 12px", background: "none", border: "none", color: t.fog, fontSize: "calc(12px * var(--app-fs, 1))", textDecoration: "underline", textUnderlineOffset: 3 } }, "今天先逛到这里，提前翻牌") : null),
      s.phase === "plan" ? h("form", { "data-wk": "datecomposer", className: "shrink-0 flex items-center gap-2 px-3 py-2.5", onSubmit: e => { e.preventDefault(); ask("plan", text || (selected ? "我想去「" + C.place(selected).name + "」。" : ""), selected); }, style: { borderTop: "1px solid " + t.line, background: t.bg2, paddingBottom: COMPOSER_PAD_BOTTOM } },
        h("input", { "data-wk": "gameinput", "data-part": "chat", disabled: busy || unsaved || !!s.pending, value: text, maxLength: 600, onChange: e => setText(e.target.value), placeholder: selected ? "劝 TA 去这里，或者藏一下心思…" : "聊一句、试探一下，或让 TA 先提议…", style: { flex: 1, minWidth: 0, minHeight: 44, padding: "8px 10px", borderRadius: 12, border: "1px solid " + t.line, color: t.ink, background: t.bg, fontSize: "calc(13px * var(--app-fs, 1))" } }),
        h("button", { "data-part": "send", type: "submit", disabled: busy || unsaved || !!s.pending, style: { minHeight: 44, padding: "0 10px", borderRadius: 12, color: "#fff", background: t.tint, fontSize: "calc(12px * var(--app-fs, 1))", opacity: busy || s.pending ? .4 : 1 } }, selected ? "提议" : text ? "说一句" : "听 TA"))
      // 别的几步也能说话：到了站里、看小票、翻牌前，都留一个输入框（只聊天，不改地点和进度）
      : s.phase !== "finished" ? h("form", { "data-wk": "datecomposer", "data-part": "chatbar", className: "shrink-0 flex items-center gap-2 px-3 py-2.5", onSubmit: e => { e.preventDefault(); if (talkText.trim()) { ask("chat", talkText.trim(), ""); setTalkText(""); } }, style: { borderTop: "1px solid " + t.line, background: t.bg2, paddingBottom: COMPOSER_PAD_BOTTOM } },
        h("input", { "data-wk": "gameinput", "data-part": "talk", disabled: busy || unsaved || !!s.pending, value: talkText, maxLength: 600, onChange: e => setTalkText(e.target.value), placeholder: "跟 " + (char.remark || char.name) + " 说句话…", style: { flex: 1, minWidth: 0, minHeight: 44, padding: "8px 10px", borderRadius: 12, border: "1px solid " + t.line, color: t.ink, background: t.bg, fontSize: "calc(13px * var(--app-fs, 1))" } }),
        h("button", { "data-part": "talksend", type: "submit", disabled: busy || unsaved || !!s.pending || !talkText.trim(), style: { minHeight: 44, padding: "0 12px", borderRadius: 12, color: "#fff", background: t.tint, fontSize: "calc(12px * var(--app-fs, 1))", opacity: busy || s.pending || !talkText.trim() ? .4 : 1 } }, "说")) : null);
  }
  root.DateGameSetup = DateGameSetup; root.DateGame = DateGame;
  if (typeof module === "object" && module.exports) module.exports = { buildPrompt, buildJudge };
})(typeof window !== "undefined" ? window : globalThis);
