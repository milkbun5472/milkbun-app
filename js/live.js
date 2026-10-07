// ============================================================
// 直播（live）—— 群友 2026-10-07 提的，她拍板「1c 2b」：
//   · 两种都要：【看 TA 播】（TA 是主播，她进直播间）和【我来播】（她开播，她的人混在观众里）。
//   · 弹幕是【背景】：屏幕上滚过去的路人弹幕只是氛围，不进上下文、TA 不回它们。
//     TA 只理她、和几个有名有姓的常客（擂台 v60.41 那一课：网名刷屏＝借来的形状，没有活人）。
// 看 TA 播：走 runProbe（voiceScene），料就是TA平时那一整份——播的时候TA还是TA。
// 我来播：几个人一起看，一枪写完所有人的反应（每人一份短人设 + 最近几句聊天）。
// 打赏走她的钱包；TA 们私下发来的消息落进各自的单聊。下播后记一条事实进记忆库。
// 存 x_live（DURABLE_TEXT_KEYS，进 IDB）。
// ============================================================
(function () {
  const KEY = "x_live";
  const CAP = 40;             // 回放最多留几场
  const LINES_CAP = 400;      // 一场里最多留几行
  const CTX_LINES = 40;       // 每一拍给模型看最近几行
  const LIVE_INK = "#f3eef7", LIVE_DIM = "rgba(243,238,247,.62)", LIVE_BG = "#141019", LIVE_RED = "#e2556b", LIVE_LINE = "rgba(255,255,255,.12)";

  // 播什么：只给方向，不给答案。「TA 自己定」就一个字都不给。
  const KINDS = [["free", "TA 自己定"], ["chat", "聊天"], ["game", "打游戏"], ["sing", "唱歌"], ["study", "陪学陪工作"], ["cook", "做饭吃饭"], ["outdoor", "户外"], ["sell", "带货"], ["spicy", "擦边"]];
  const HOST_KINDS = KINDS.filter(k => k[0] !== "free" && k[0] !== "sell");
  const GIFTS = [["小心心", 1], ["棒棒糖", 6], ["玫瑰", 20], ["告白气球", 99], ["跑车", 520], ["火箭", 1314]];

  // 图标：一个镜头加两道往外走的信号
  window.GLive = p => h(Svg, p,
    h("rect", { x: 4, y: 8, width: 11, height: 9, rx: 2 }),
    h("path", { d: "M15 11l4-2.4v7.8L15 14" }),
    h("path", { d: "M7.5 5.2a6 6 0 0 1 4 0M6 3a9 9 0 0 1 7 0" }));

  const S = v => String(v == null ? "" : v).trim();
  const arr = v => Array.isArray(v) ? v : [];
  const uid = p => p + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
  const load = () => { try { const v = loadJSON(KEY, []); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const AC = () => (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "");
  const CB = () => (typeof ContentBoundaries !== "undefined" && ContentBoundaries.prompt ? ContentBoundaries.prompt + "\n\n" : "");
  // 外壳的底：顶上打下来一束暖红的灯，像演播间（不是平铺的米白）
  const liveFloor = t => ({ background: "radial-gradient(130% 55% at 50% -12%,rgba(226,85,107,.16),rgba(226,85,107,0) 62%),repeating-linear-gradient(90deg,rgba(0,0,0,.018) 0 1px,transparent 1px 22px)," + t.bg });
  const kindZh = k => (KINDS.find(x => x[0] === k) || [k, k])[1];

  // 路人弹幕：只要几条短的字，一律不进下一拍的上下文
  const normNoise = v => arr(v).map(S).filter(Boolean).map(x => x.slice(0, 30)).slice(0, 12);
  const normChat = (v, names) => arr(v).map(x => x && typeof x === "object" ? { name: S(x.name).slice(0, 20), text: S(x.text).slice(0, 300) } : null)
    .filter(x => x && x.name && x.text && (!names || names.indexOf(x.name) >= 0));
  const normLines = v => (Array.isArray(v) ? v : (S(v) ? [S(v)] : [])).map(S).filter(Boolean).map(x => x.slice(0, 400)).slice(0, 10);

  // 给模型看的那一段经过。⚠️路人弹幕不在里面——那是「2b」：只给眼睛看，不给TA看。
  function transcript(ses) {
    return arr(ses.lines).slice(-CTX_LINES).map(l => {
      if (l.kind === "host") return (l.name || "主播") + "（主播）" + (l.act ? "【" + l.act + "】" : "") + "：" + l.text;
      if (l.kind === "gift") return l.name + " 送出了「" + l.gift + "」×1（" + l.amount + " 元）";
      if (l.kind === "enter") return l.text;
      return l.name + (l.kind === "me" ? "（弹幕）" : "（弹幕）") + "：" + l.text;
    }).join("\n");
  }

  // ── 看 TA 播 ────────────────────────────────────────────
  function watchInstruction(ses, uName, first) {
    const who = ses.as === "mask"
      ? uName + "这次用的是一个马甲号「" + ses.maskName + "」进的直播间。你不知道这个号是她——除非她自己说破，或者她说的话让你认出来。"
      : uName + "用的是自己的号进的直播间，名字就是「" + uName + "」，你一眼就知道是她。";
    const kind = ses.kind && ses.kind !== "free" ? "这一场播的是：" + kindZh(ses.kind) + "。" : "这一场播什么由你自己定。";
    const topic = S(ses.topic) ? "她希望看到的是：" + S(ses.topic) + "（要不要照这个播，看你这个人）。" : "";
    const base = "你在一个直播平台上有自己的直播间，此刻正在开播。你在平台上是个什么样的主播——主播名叫什么、平时播什么、粉丝是一群什么人、对着镜头和私下是不是一个样——都从你这个人身上长出来；设定里没写，就照你这个人真会怎么做来定。\n"
      + kind + topic + "\n"
      + "直播间里：" + who + "\n"
      + "还有几个有名有姓的常客，各自带着对你的看法。屏幕上另有一大片路人弹幕滚过去，那些你看不清、也不必回。你说话的对象是镜头、是她、是这几个常客——挑着回，不必谁都回。";
    if (first) return base + "\n\n现在刚开播。写：直播间标题 title、你的主播名 host、镜头里看得见的样子 scene（一两句）、你对着镜头说的话 say（数组，一个元素一句）、你此刻在镜头前做什么 act（一句，可以空）、几个常客 regulars（2~4 个，每人 name 是网名、who 一句话说清是什么人、lean 一句话说清对你什么态度，几个人别是同一种）、这一拍常客们发的弹幕 chat、滚过去的路人弹幕 noise（6~10 条，很短）、在线人数 viewers（数字）。";
    return base + "\n\n【常客】\n" + arr(ses.regulars).map(r => "· " + r.name + "：" + r.who + "；" + r.lean).join("\n")
      + "\n\n【刚才直播间里发生的】\n" + transcript(ses)
      + "\n\n接着往下播。写：你对着镜头说的话 say（数组）、你此刻在做什么 act（没变就照旧写）、这一拍常客们发的弹幕 chat（可以没有）、新滚过去的路人弹幕 noise、在线人数 viewers、你要不要下播 end（true/false；真想下播才下）。";
  }
  const WATCH_SHAPE_FIRST = '{"title":"","host":"","scene":"","say":["一句"],"act":"","regulars":[{"name":"","who":"","lean":""}],"chat":[{"name":"常客网名","text":""}],"noise":["",""],"viewers":0}';
  const WATCH_SHAPE = '{"say":["一句"],"act":"","chat":[{"name":"常客网名","text":""}],"noise":["",""],"viewers":0,"end":false}';

  // ── 我来播 ──────────────────────────────────────────────
  function hostInstruction(ses, uName, chars, briefs, first) {
    const names = chars.map(c => c.name);
    return AC() + CB()
      + "【场景】" + uName + "开了一场直播。" + (ses.kind ? "她播的是：" + kindZh(ses.kind) + "。" : "") + (S(ses.title) ? "直播间标题：" + S(ses.title) + "。" : "")
      + (S(ses.topic) ? "她自己说这一场：" + S(ses.topic) + "。" : "")
      + "\n下面这几个人都认识她，此刻都在她的直播间里看着（她知道他们在）。直播间里还有一大片不认识的路人在刷弹幕。"
      + "\n\n" + briefs.join("\n\n")
      + "\n\n【刚才直播间里发生的】\n" + (transcript(ses) || "（刚开播）")
      + "\n\n【这一次要写什么】" + (first ? "她刚开播。" : "她刚在镜头前说了、做了上面最后那几句。")
      + "这几个人各自照自己的性子看她播：可以发弹幕（公开，所有人都看得见）、可以送礼物、可以私下给她发一条消息（只有她看得见，会落进你俩的聊天）、也可以什么都不做。谁跟她什么关系、此刻什么心情，决定他在别人面前怎么说、私下又怎么说。"
      + "\n写：这几个人公开发的弹幕 chat（name 只能是：" + names.join("、") + "）、送的礼物 gifts（name、gift 礼物名、amount 金额数字；没人送就空）、私下发的消息 private（name、text；没有就空）、路人弹幕 noise（6~10 条，很短，只是氛围）、在线人数 viewers（数字）。";
  }
  const HOST_SHAPE = '{"chat":[{"name":"","text":""}],"gifts":[{"name":"","gift":"","amount":0}],"private":[{"name":"","text":""}],"noise":["",""],"viewers":0}';

  // ── 弹幕飘过去的那一层（只给眼睛看）────────────────────────
  let styleIn = false;
  function ensureStyle() {
    if (styleIn || typeof document === "undefined") return;
    styleIn = true;
    const st = document.createElement("style");
    st.textContent = "@keyframes liveFly{from{transform:translateX(0)}to{transform:translateX(-160vw)}}";
    document.head.appendChild(st);
  }
  function NoiseLayer({ noise, seed }) {
    ensureStyle();
    const list = arr(noise).slice(0, 10);
    return h("div", { "aria-hidden": "true", style: { position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" } },
      list.map((t, i) => h("div", {
        key: seed + "_" + i,
        style: { position: "absolute", left: "100%", top: (8 + (i * 37) % 70) + "%", whiteSpace: "nowrap", fontFamily: F_BODY, fontSize: 12.5,
          color: "rgba(255,255,255,.78)", textShadow: "0 1px 3px rgba(0,0,0,.6)",
          animation: "liveFly " + (7 + (i % 4) * 1.6) + "s linear " + (i * 0.9) + "s 1 both" }
      }, t)));
  }

  function GlyphDot() { return h("span", { style: { display: "inline-block", width: 7, height: 7, borderRadius: 99, background: LIVE_RED, marginRight: 5, verticalAlign: "1px" } }); }

  // ── 直播间（两种共用一个房间）──────────────────────────
  function LiveRoom({ ses, chars, profile, busy, onSay, onGift, onEnd, onBack, readOnly }) {
    const [text, setText] = useState("");
    const [giftOpen, setGiftOpen] = useState(false);
    const listRef = useRef(null);
    useEffect(function () { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [arr(ses.lines).length, busy]);
    const watching = ses.mode === "watch";
    const host = watching ? chars.find(c => c.id === ses.charId) : null;
    const uName = (profile && profile.name) || "我";
    const lastHost = arr(ses.lines).filter(l => l.kind === (watching ? "host" : "me")).slice(-1)[0];
    const lineEl = (l, i) => {
      if (l.kind === "gift") return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12, color: "#f6c76b", padding: "3px 0" } }, l.name + " 送出了「" + l.gift + "」 ¥" + l.amount);
      if (l.kind === "enter") return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 11, color: LIVE_DIM, padding: "3px 0" } }, l.text);
      if (l.kind === "private") return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12, color: "#cdbdf0", padding: "4px 0" } }, "私信 · " + l.name + "：" + l.text);
      const isHost = l.kind === "host";
      const mine = l.kind === "me";
      return h("div", { key: i, style: { padding: "4px 0", fontFamily: F_BODY, fontSize: isHost ? 14 : 13, lineHeight: 1.55, color: LIVE_INK } },
        h("span", { style: { color: isHost ? LIVE_RED : mine ? "#9fd2ff" : "#d6c7ff", marginRight: 6 } }, (isHost ? "主播 " : "") + l.name),
        l.act ? h("span", { style: { color: LIVE_DIM, marginRight: 4 } }, "（" + l.act + "）") : null,
        l.text);
    };
    const send = () => { const v = text.trim(); if (!v || busy) return; setText(""); onSay(v); };
    const stageTitle = watching ? (ses.host || (host && host.name) || "主播") : uName;
    return h("div", { className: "h-full flex flex-col", style: { background: LIVE_BG, position: "relative" } },
      h(Head, { zh: S(ses.title) || "直播间", sub: (ses.endTs ? "已下播" : "直播中") + " · " + (Number(ses.viewers) || 0) + " 人在看", bg: "transparent", ink: LIVE_INK, onBack: onBack,
        right: (!readOnly && !ses.endTs) ? h("button", { onClick: onEnd, disabled: !!busy, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: LIVE_RED, padding: "0 6px", minHeight: 40 } }, watching ? "离开" : "下播") : null }),
      // 镜头那一块：主播（或她自己）此刻的样子＋刚说的那句；路人弹幕从这儿飘过去
      h("div", { className: "shrink-0", style: { position: "relative", height: 210, margin: "0 12px", borderRadius: 16, overflow: "hidden",
        background: "radial-gradient(120% 90% at 30% 20%,rgba(226,85,107,.28),rgba(80,60,120,.25) 55%,rgba(20,16,25,1))", border: "1px solid " + LIVE_LINE } },
        h("div", { style: { position: "absolute", left: 14, top: 12, display: "flex", alignItems: "center", gap: 8 } },
          watching && host ? h(Avatar, { character: host, size: 34 }) : null,
          h("div", null,
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: LIVE_INK } }, stageTitle),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: LIVE_DIM } }, ses.endTs ? "已下播" : h(Fragment, null, h(GlyphDot), "直播中")))),
        h("div", { style: { position: "absolute", left: 14, right: 14, bottom: 12 } },
          S(ses.scene) ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: LIVE_DIM, lineHeight: 1.5, marginBottom: 6 } }, ses.scene) : null,
          lastHost ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, lineHeight: 1.6, color: LIVE_INK, textShadow: "0 1px 4px rgba(0,0,0,.5)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } },
            (lastHost.act ? "（" + lastHost.act + "）" : "") + lastHost.text) : null),
        ses.endTs ? null : h(NoiseLayer, { noise: ses.noise, seed: ses.noiseSeed || 0 })),
      h("div", { ref: listRef, className: "flex-1 min-h-0 overflow-y-auto px-4", style: { paddingTop: 10, paddingBottom: 8 } },
        arr(ses.lines).map(lineEl),
        busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: LIVE_DIM, padding: "6px 0" } }, watching ? "……" : "大家在看……") : null),
      (readOnly || ses.endTs) ? null : h("div", { className: "shrink-0 px-3", style: { paddingTop: 8, paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 10px)", borderTop: "1px solid " + LIVE_LINE } },
        giftOpen && watching ? h("div", { className: "flex flex-wrap", style: { gap: 8, marginBottom: 8 } },
          GIFTS.map(g => h("button", { key: g[0], disabled: !!busy, onClick: () => { setGiftOpen(false); onGift(g[0], g[1]); }, className: "active:opacity-60",
            style: { minHeight: 34, padding: "0 12px", borderRadius: 999, border: "1px solid " + LIVE_LINE, background: "rgba(255,255,255,.06)", color: LIVE_INK, fontFamily: F_BODY, fontSize: 12 } }, g[0] + " ¥" + g[1]))) : null,
        h("div", { className: "flex items-end", style: { gap: 8 } },
          watching ? h("button", { onClick: () => setGiftOpen(v => !v), "aria-label": "送礼物", className: "active:opacity-60 shrink-0",
            style: { width: 42, height: 42, borderRadius: 12, border: "1px solid " + LIVE_LINE, color: "#f6c76b", fontFamily: F_BODY, fontSize: 12 } }, "礼物") : null,
          h("textarea", { value: text, onChange: e => setText(e.target.value), rows: 1,
            placeholder: watching ? (ses.as === "mask" ? "用「" + ses.maskName + "」发条弹幕" : "发条弹幕") : "对着镜头说点什么，或写你在做什么",
            className: "flex-1 outline-none resize-none",
            style: { minHeight: 42, maxHeight: 104, borderRadius: 12, border: "1px solid " + LIVE_LINE, background: "rgba(0,0,0,.34)", color: LIVE_INK, padding: "11px 13px", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55 } }),
          h("button", { onClick: send, disabled: !!busy || !text.trim(), className: "active:opacity-70 shrink-0",
            style: { width: 52, height: 42, borderRadius: 12, background: (busy || !text.trim()) ? "rgba(255,255,255,.08)" : LIVE_RED, color: (busy || !text.trim()) ? LIVE_DIM : "#fff", fontFamily: F_BODY, fontSize: 13 } }, busy ? "…" : "发送"))));
  }

  // ── 开播前那一页 ────────────────────────────────────────
  function Setup({ mode, characters, maskName, t, onStart, onBack }) {
    const watching = mode === "watch";
    const [pick, setPick] = useState(watching ? ((characters[0] || {}).id || null) : characters.slice(0, 3).map(c => c.id));
    const [kind, setKind] = useState(watching ? "free" : "chat");
    const [topic, setTopic] = useState("");
    const [title, setTitle] = useState("");
    const [as, setAs] = useState("me");
    const toggle = id => setPick(p => watching ? id : (p.indexOf(id) >= 0 ? p.filter(x => x !== id) : p.concat([id]).slice(0, 5)));
    const on = id => watching ? pick === id : pick.indexOf(id) >= 0;
    const ok = watching ? !!pick : pick.length > 0;
    const label = s => h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, margin: "18px 0 8px" } }, s);
    const chip = (on2, txt, fn, key) => h("button", { key: key, onClick: fn, className: "active:opacity-60",
      style: { minHeight: 34, padding: "0 13px", borderRadius: 999, border: "1px solid " + (on2 ? t.ink : t.line), background: on2 ? t.ink : "transparent", color: on2 ? t.bg2 : t.sub, fontFamily: F_BODY, fontSize: 12.5 } }, txt);
    return h("div", { className: "h-full flex flex-col", style: liveFloor(t) },
      h(Head, { zh: watching ? "去看 TA 播" : "我来开播", onBack: onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 30 } },
        label(watching ? "看谁播" : "谁在直播间里看着（最多五个）"),
        h("div", { className: "flex flex-wrap", style: { gap: 12 } }, characters.map(c => h("button", { key: c.id, onClick: () => toggle(c.id), className: "active:opacity-70 flex flex-col items-center", style: { width: 58, opacity: on(c.id) ? 1 : 0.45 } },
          h("div", { style: { borderRadius: 999, padding: 2, border: "2px solid " + (on(c.id) ? LIVE_RED : "transparent") } }, h(Avatar, { character: c, size: 46 })),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, marginTop: 4, maxWidth: 58, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.remark || c.name)))),
        label(watching ? "播什么" : "你播什么"),
        h("div", { className: "flex flex-wrap", style: { gap: 8 } }, (watching ? KINDS : HOST_KINDS).map(k => chip(kind === k[0], k[1], () => setKind(k[0]), k[0]))),
        !watching ? label("直播间标题") : null,
        !watching ? h("input", { value: title, onChange: e => setTitle(e.target.value), placeholder: "不写也行", className: "w-full outline-none",
          style: { minHeight: 42, borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, padding: "0 13px", fontFamily: F_BODY, fontSize: 13.5 } }) : null,
        label(watching ? "想看什么（不写就随 TA）" : "这一场你打算干嘛（不写也行）"),
        h("textarea", { value: topic, onChange: e => setTopic(e.target.value), rows: 2, className: "w-full outline-none resize-none",
          style: { borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, padding: "11px 13px", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55 } }),
        watching ? label("用哪个号进去") : null,
        watching ? h("div", { className: "flex flex-wrap", style: { gap: 8 } },
          chip(as === "me", "自己的号（TA 知道是你）", () => setAs("me"), "me"),
          chip(as === "mask", "马甲「" + (maskName || "路过的") + "」（TA 不知道）", () => setAs("mask"), "mask")) : null,
        h("button", { disabled: !ok, onClick: () => onStart({ mode, charId: watching ? pick : null, charIds: watching ? [pick] : pick, kind, topic: topic.trim(), title: title.trim(), as, maskName: maskName || "路过的" }),
          className: "w-full active:opacity-80", style: { marginTop: 26, minHeight: 48, borderRadius: 14, background: ok ? LIVE_RED : t.line, color: "#fff", fontFamily: F_BODY, fontSize: 14.5 } },
          watching ? "进直播间" : "开播")));
  }

  // ── 入口 ───────────────────────────────────────────────
  function LiveApp(props) {
    const t = useTheme();
    const { characters, profile, toast } = props;
    const [list, setList] = useState(load);
    const [view, setView] = useState(props.startView || "home");   // home | setup:watch | setup:host | room
    // 嵌在刷刷里当一格时（v74.99x）：落地页不摆返回键，底栏就是出口；从「＋ → 开播」进来直接落在开播那一页
    const [curId, setCurId] = useState(null);
    const [busy, setBusy] = useState(false);
    const listRef = useRef(list); listRef.current = list;
    const uName = (profile && profile.name) || "我";
    const save = next => { const n = next.slice(0, CAP); listRef.current = n; setList(n); saveJSON(KEY, n); };
    const patch = (id, fn) => save(listRef.current.map(s => s.id === id ? fn(s) : s));
    const get = id => listRef.current.find(s => s.id === id);
    const charsOf = ses => (ses.charIds || [ses.charId]).map(id => characters.find(c => c.id === id)).filter(Boolean);
    const cur = curId ? list.find(s => s.id === curId) : null;

    // 一拍：看 TA 播
    const stepWatch = async (id, first) => {
      const ses = get(id); const char = ses && characters.find(c => c.id === ses.charId);
      if (!ses || !char) return;
      setBusy(true);
      try {
        const d = await props.probeAs(char, watchInstruction(ses, uName, first), first ? WATCH_SHAPE_FIRST : WATCH_SHAPE) || {};
        const regs = first ? arr(d.regulars).map(r => r && { name: S(r.name).slice(0, 20), who: S(r.who).slice(0, 80), lean: S(r.lean).slice(0, 80) }).filter(r => r && r.name).slice(0, 4) : ses.regulars;
        const hostName = first ? (S(d.host).slice(0, 20) || char.name) : ses.host;
        const say = normLines(d.say);
        if (!say.length && !normChat(d.chat).length) { toast("这一拍没播出来，再发一次试试"); return; }
        const act = S(d.act).slice(0, 120);
        const add = say.map((x, i) => ({ kind: "host", name: hostName, text: x, act: i === 0 ? act : "", ts: Date.now() }))
          .concat(normChat(d.chat, arr(regs).map(r => r.name)).map(x => ({ kind: "reg", name: x.name, text: x.text, ts: Date.now() })));
        patch(id, s => ({ ...s,
          title: first ? (S(d.title).slice(0, 40) || s.title || char.name + "的直播间") : s.title,
          host: hostName, scene: first ? S(d.scene).slice(0, 200) : s.scene, regulars: regs,
          lines: arr(s.lines).concat(add).slice(-LINES_CAP),
          noise: normNoise(d.noise), noiseSeed: (s.noiseSeed || 0) + 1,
          viewers: Math.max(1, Math.round(Number(d.viewers) || s.viewers || 1)),
          endTs: (!first && d.end === true) ? Date.now() : s.endTs }));
        if (!first && d.end === true) wrapUp(id);
      } catch (e) { toast("直播间没连上：" + ((e && e.message) || "再试一次")); }
      finally { setBusy(false); }
    };
    // 一拍：我来播
    const stepHost = async (id, first) => {
      const ses = get(id); if (!ses) return;
      const chars = charsOf(ses); if (!chars.length) return;
      setBusy(true);
      try {
        const d = await props.probeMany(chars, hostInstruction(ses, uName, chars, chars.map(props.briefFor), first), HOST_SHAPE) || {};
        const names = chars.map(c => c.name);
        const chat = normChat(d.chat, names);
        const gifts = arr(d.gifts).map(g => g && { name: S(g.name), gift: S(g.gift).slice(0, 20) || "礼物", amount: Math.max(0, Math.min(100000, Math.round(Number(g.amount) || 0))) })
          .filter(g => g && names.indexOf(g.name) >= 0 && g.amount > 0).slice(0, 5);
        const priv = normChat(d.private, names).slice(0, 5);
        const add = chat.map(x => ({ kind: "char", name: x.name, text: x.text, ts: Date.now() }))
          .concat(gifts.map(g => ({ kind: "gift", name: g.name, gift: g.gift, amount: g.amount, ts: Date.now() })))
          .concat(priv.map(x => ({ kind: "private", name: x.name, text: x.text, ts: Date.now() })));
        gifts.forEach(g => props.pay(g.amount, "直播收到打赏 · " + g.name + " 的「" + g.gift + "」"));
        priv.forEach(x => { const c = chars.find(cc => cc.name === x.name); if (c) props.onPrivate(c.id, x.text); });
        patch(id, s => ({ ...s, lines: arr(s.lines).concat(add).slice(-LINES_CAP), noise: normNoise(d.noise), noiseSeed: (s.noiseSeed || 0) + 1,
          viewers: Math.max(1, Math.round(Number(d.viewers) || s.viewers || 1)) }));
      } catch (e) { toast("直播间没连上：" + ((e && e.message) || "再试一次")); }
      finally { setBusy(false); }
    };
    // 下播：记一条事实进记忆库（不额外调模型）
    const wrapUp = id => {
      const s = get(id); if (!s) return;
      const chars = charsOf(s); if (!chars.length) return;
      const mine = arr(s.lines).filter(l => l.kind === "me").length;
      const spent = arr(s.lines).filter(l => l.kind === "gift" && l.mine).reduce((n, l) => n + (Number(l.amount) || 0), 0);
      let text;
      if (s.mode === "watch") {
        const c = chars[0];
        text = s.as === "mask"
          ? c.name + "开了一场直播《" + (s.title || "") + "》。直播间里有个叫「" + s.maskName + "」的观众" + (mine ? "发了 " + mine + " 条弹幕" : "一直在看") + (spent ? "，还打赏了 " + spent + " 元" : "") + "。" + c.name + "不知道那是谁。"
          : c.name + "开了一场直播《" + (s.title || "") + "》，" + uName + "用自己的号来看了" + (mine ? "，发了 " + mine + " 条弹幕" : "") + (spent ? "，打赏了 " + spent + " 元" : "") + "。";
        props.remember([c.id], text);
      } else {
        const said = arr(s.lines).filter(l => l.kind === "char");
        chars.forEach(c => {
          const own = said.filter(l => l.name === c.name).slice(-1)[0];
          props.remember([c.id], uName + "开了一场直播" + (s.title ? "《" + s.title + "》" : "") + "，" + c.name + "在直播间里看着" + (own ? "，在弹幕里说过「" + own.text.slice(0, 60) + "」" : "") + "。");
        });
      }
    };

    const start = cfg => {
      const ses = { id: uid("live"), mode: cfg.mode, charId: cfg.charId, charIds: cfg.charIds, kind: cfg.kind, topic: cfg.topic, title: cfg.title,
        as: cfg.as, maskName: cfg.maskName, lines: [], noise: [], viewers: 0, startTs: Date.now(), endTs: 0 };
      if (cfg.mode === "watch") ses.lines.push({ kind: "enter", text: (cfg.as === "mask" ? cfg.maskName : uName) + " 进入了直播间", ts: Date.now() });
      save([ses].concat(listRef.current));
      setCurId(ses.id); setView("room");
      if (cfg.mode === "watch") stepWatch(ses.id, true); else stepHost(ses.id, true);
    };
    const say = v => {
      const s = get(curId); if (!s) return;
      const name = s.mode === "watch" ? (s.as === "mask" ? s.maskName : uName) : uName;
      patch(curId, x => ({ ...x, lines: arr(x.lines).concat([{ kind: "me", name, text: v, ts: Date.now() }]).slice(-LINES_CAP) }));
      if (s.mode === "watch") stepWatch(curId, false); else stepHost(curId, false);
    };
    const gift = (g, amount) => {
      const s = get(curId); if (!s) return;
      if (typeof props.wallet === "number" && props.wallet < amount) { toast("钱包余额不够"); return; }
      const name = s.as === "mask" ? s.maskName : uName;
      props.pay(-amount, "直播打赏 · " + (s.host || "主播") + "「" + g + "」");
      patch(curId, x => ({ ...x, lines: arr(x.lines).concat([{ kind: "gift", mine: true, name, gift: g, amount, ts: Date.now() }]).slice(-LINES_CAP) }));
      stepWatch(curId, false);
    };
    const end = () => {
      const s = get(curId); if (!s || s.endTs) return;
      patch(curId, x => ({ ...x, endTs: Date.now() }));
      wrapUp(curId);
      toast(s.mode === "watch" ? "离开了直播间" : "下播了");
    };

    if (view === "setup:watch" || view === "setup:host")
      return h(Setup, { mode: view === "setup:watch" ? "watch" : "host", characters, maskName: props.maskName, t, onStart: start, onBack: () => setView("home") });
    if (view === "room" && cur)
      return h(LiveRoom, { ses: cur, chars: characters, profile, busy, onSay: say, onGift: gift, onEnd: end, onBack: () => { setView("home"); setCurId(null); } });

    // 落地页：两扇门 + 回放
    const door = (title, sub, fn) => h("button", { onClick: fn, className: "w-full text-left active:opacity-80",
      style: { position: "relative", borderRadius: 18, padding: "18px 18px", minHeight: 96, overflow: "hidden", background: "radial-gradient(130% 120% at 0% 0%,rgba(226,85,107,.85),rgba(70,50,110,.95))", color: "#fff" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, opacity: .85 } }, h(GlyphDot), "直播"),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, marginTop: 6 } }, title),
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, opacity: .85, marginTop: 4, lineHeight: 1.5 } }, sub));
    const nameOf = s => s.mode === "watch" ? ((characters.find(c => c.id === s.charId) || {}).name || "") : uName;
    return h("div", { className: "h-full flex flex-col", style: liveFloor(t) },
      h(Head, { zh: "直播", onBack: props.embedded ? undefined : props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: 30 } },
        h("div", { style: { display: "flex", flexDirection: "column", gap: 12, marginTop: 6 } },
          characters.length ? door("去看 TA 播", "挑一个人，看 TA 在直播间里是什么样。可以用自己的号，也可以挂马甲。", () => setView("setup:watch")) : null,
          characters.length ? door("我来开播", "你开播，你的人混在观众里看着你。", () => setView("setup:host")) : null,
          !characters.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "30px 0", textAlign: "center" } }, "先去人格档案馆建一个角色") : null),
        list.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, margin: "24px 0 8px" } }, "回放") : null,
        list.map(s => h("div", { key: s.id, className: "flex items-center", style: { gap: 10, padding: "11px 0", borderBottom: "1px solid " + t.line } },
          h("button", { onClick: () => { setCurId(s.id); setView("room"); }, className: "flex-1 min-w-0 text-left active:opacity-70" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, (s.endTs ? "" : "● ") + (S(s.title) || "直播间")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 2 } },
              (s.mode === "watch" ? nameOf(s) + " 播的" : "我播的") + " · " + new Date(s.startTs).toLocaleDateString() + " · " + arr(s.lines).length + " 条")),
          h("button", { onClick: () => save(listRef.current.filter(x => x.id !== s.id)), className: "active:opacity-60 shrink-0", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, minHeight: 36, padding: "0 6px" } }, "删")))));
  }

  window.LiveApp = LiveApp;
  window.LiveKit = { watchInstruction, hostInstruction, transcript, normNoise, normChat, KINDS, GIFTS };
})();
