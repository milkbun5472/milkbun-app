// ============================================================
// 塔罗（tarot）—— 抽牌 + 角色声音解牌，独立小 app
// 四种玩法（都靠全局 callAI + ANTI_CLICHE，存 localStorage x_tarot_saves 随云同步）：
//   · reading  角色为你解牌：你问一件事，选一个角色，Ta 用自己的口吻按牌面为你解读
//   · relation 关系占卜：为「你和某角色」抽牌，牌面暗暗被真实好感/关系上色，不露数字
//   · daily    每日一牌：今天一张牌，角色给你一句当日签（同一天同一人固定不变）
//   · forchar  给角色算一卦：替某角色抽 Ta 此刻的近况/心结/走向，旁白式解读
// 78 张莱德-韦特牌（22 大阿卡纳 + 56 小阿卡纳），每张有正/逆位。
// ============================================================
(function () {
  const ACCENT = "#4a3f6b";      // 塔罗主色（深紫）
  const GOLD = "#b89150";        // 烫金点缀
  const AC = () => (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "");
  const NAC = () => (typeof NARRATIVE_ANTI_CLICHE !== "undefined" ? NARRATIVE_ANTI_CLICHE + "\n\n" : "");

  // ---- 牌堆 ----
  const MAJORS = ["愚者", "魔术师", "女祭司", "皇后", "皇帝", "教皇", "恋人", "战车", "力量", "隐者", "命运之轮", "正义", "倒吊人", "死神", "节制", "恶魔", "高塔", "星星", "月亮", "太阳", "审判", "世界"];
  const SUITS = ["权杖", "圣杯", "宝剑", "星币"];
  const RANKS = ["王牌", "二", "三", "四", "五", "六", "七", "八", "九", "十", "侍从", "骑士", "王后", "国王"];
  function buildDeck() {
    const d = MAJORS.map(n => ({ name: n, major: true }));
    SUITS.forEach(s => RANKS.forEach(r => d.push({ name: s + r, major: false })));
    return d; // 78 张
  }
  const DECK = buildDeck();
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // 抽 n 张互不相同的牌，各自随机正/逆位
  function draw(n) {
    return shuffle(DECK).slice(0, n).map(c => ({ name: c.name, major: c.major, rev: Math.random() < 0.34 }));
  }
  const cardLabel = c => c.name + "（" + (c.rev ? "逆位" : "正位") + "）";

  // ---- 好感度 → 语气档（不给模型数字，只给氛围词，占卜结果暗暗被它上色）----
  function affBand(a) {
    if (a == null || isNaN(a)) return "";
    if (a >= 80) return "极亲密、几乎交付了真心";
    if (a >= 60) return "亲近、信任在生长";
    if (a >= 40) return "有好感但仍有分寸";
    if (a >= 22) return "还疏淡、在观望";
    return "冷淡、甚至带着戒备";
  }

  // 角色最近聊天一小段，作近况/语气参考
  function recentChat(charId, uName, charName) {
    const msgs = loadJSON("x_chat:" + charId, []);
    if (!msgs.length) return "";
    return msgs.slice(-10)
      .filter(m => m && (m.content || "").trim() && (m.role === "user" || m.role === "assistant"))
      .map(m => (m.role === "user" ? uName : charName) + "：" + String(m.content).replace(/\s+/g, " ").slice(0, 70))
      .join("\n");
  }

  // ---- 四种玩法 ----
  const MODES = {
    reading: {
      zh: "角色为你解牌", en: "A Reading For You", icon: "✦",
      blurb: "问一件心里的事，让一个角色为你摊开三张牌、以 Ta 的口吻解读",
      spread: ["此刻的处境", "眼前的阻碍", "给你的指引"],
      needChar: true, needQ: true, qHint: "你想问的事（如：这段关系会往哪走 / 该不该辞职…）"
    },
    relation: {
      zh: "关系占卜", en: "You & Them", icon: "❤",
      blurb: "为「你和 Ta」抽牌——牌面会照着你们此刻真实的远近显影",
      spread: ["你眼中的 Ta", "Ta 眼中的你", "你们的走向"],
      needChar: true
    },
    daily: {
      zh: "每日一牌", en: "Card of the Day", icon: "☀",
      blurb: "今天翻一张牌，让 Ta 给你一句当日签（同一天固定不变）",
      spread: ["今日"],
      needChar: true, daily: true
    },
    forchar: {
      zh: "给角色算一卦", en: "A Reading For Them", icon: "◈",
      blurb: "替某个角色抽 Ta 此刻的近况与心结，旁白替 Ta 摊开命运",
      spread: ["Ta 的近况", "藏在心里的结", "接下来"],
      needChar: true
    }
  };

  function loadSaves() { return loadJSON("x_tarot_saves", []); }
  function saveSaves(l) { saveJSON("x_tarot_saves", l); }
  const todayKey = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };

  // ============================================================
  // 模型：解一副牌 —— 按玩法给不同的声音与视角，返回 {reads:[{pos,text}], summary}
  // ============================================================
  async function readSpread(active, ctx) {
    const { mode, cards, spread, charName, charPersona, uName, question, relText, band, voiceRef, worldbook } = ctx;
    const cardList = cards.map((c, i) => (i + 1) + "、【" + spread[i] + "】" + cardLabel(c)).join("\n");
    let voice, view;
    if (mode === "reading") {
      voice = "你就是「" + charName + "」本人，正坐在 " + uName + " 对面替 Ta 摊牌解读。全程用第一人称、你自己的口吻和性格说话，像真的在跟 " + uName + " 讲，别当中立的解牌机器。你对 " + uName + " 的态度（" + (band || "说不清的距离") + "）会自然渗进你怎么解、语气软还是硬、点到为止还是掏心窝。";
      view = "这是 " + uName + " 问的事：「" + (question || "我最近该注意什么") + "」。顺着这个问题解。";
    } else if (mode === "relation") {
      voice = "你是替 " + uName + " 与「" + charName + "」摊牌的占者，声音安静、有点神秘，不代入角色本人。";
      view = "这一卦是关于 " + uName + " 和 " + charName + " 之间的关系。" +
        (relText ? "已知的关系：" + relText + "。" : "") +
        "他们此刻真实的远近是：" + (band || "尚未明朗") + "——【不要】把这句话或任何分数直接说出来，而是让它悄悄决定牌面的暖度、亲疏和走向的明暗。";
    } else if (mode === "daily") {
      voice = "你就是「" + charName + "」本人，用你自己的口吻给 " + uName + " 递今天这张牌，像随口说的一句当日签。";
      view = "只有一张牌，别长篇大论。";
    } else { // forchar
      voice = "你是替「" + charName + "」摊牌的旁白/占者，用第三人称讲 Ta，声音冷静、有洞察，不代入 Ta 本人也不对 " + uName + " 说话。";
      view = "这一卦算的是 " + charName + " 自己此刻的命理，照着 Ta 的人设与近况来解，别牵扯 " + uName + " 的问题。";
    }

    const sys = AC() + NAC() + voice + "\n\n" +
      "【角色资料】「" + charName + "」：" + (charPersona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 800) +
      (voiceRef ? "\n\n【Ta 近期的语气 / 近况，仅参考】\n" + voiceRef : "") +
      (worldbook && worldbook.trim() ? "\n\n【世界书】\n" + worldbook.trim().slice(0, 500) : "") +
      "\n\n" + view +
      "\n\n【摊开的牌】\n" + cardList +
      "\n\n【怎么解】\n· 逐张解：每张牌结合它所在的位置、正位或逆位的含义来讲，别背牌义词典，要落到具体的处境/情绪/建议上，每张 40~90 字。\n" +
      "· 正位、逆位要真的解出差别，别把逆位也当正位讲。\n" +
      "· 最后给一段收束（summary，40~110 字）：把几张牌连成一句话的走向或一句真心的提醒。\n" +
      (MODES[mode].daily ? "· 只有一张牌时，reads 只放一条，summary 就是那句当日签，整体简短。\n" : "") +
      "【输出】只输出 JSON：{\"reads\":[{\"pos\":\"位置名\",\"text\":\"这张牌的解读\"}...],\"summary\":\"收束\"}。别加解释、别加代码块。";
    const raw = await callAI(active, sys, [{ role: "user", content: "开始解牌。" }], { maxTokens: 3500 });
    const p = extractJSON(raw) || {};
    let reads = Array.isArray(p.reads) ? p.reads.filter(r => r && r.text).map((r, i) => ({ pos: r.pos || spread[i] || "", text: String(r.text).trim() })) : [];
    if (!reads.length) reads = [{ pos: spread[0] || "", text: String(raw || "牌面模糊，重试。").trim() }];
    return { reads: reads, summary: String(p.summary || "").trim() };
  }

  // ============================================================
  // 主组件
  // ============================================================
  function Tarot(props) {
    const t = useTheme();
    const [saves, setSaves] = useState(loadSaves);
    const [view, setView] = useState("home"); // home | mode:<key> | s:<id>
    const lpTimer = useRef(null), lpFired = useRef(false);

    const persist = list => { setSaves(list); saveSaves(list); };
    const delSession = id => { if (window.confirm("撕掉这次占卜？")) { persist(loadSaves().filter(s => s.id !== id)); if (view === "s:" + id) setView("home"); } };
    const startLP = id => { lpFired.current = false; lpTimer.current = setTimeout(() => { lpFired.current = true; delSession(id); }, 550); };
    const cancelLP = () => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; } };

    if (view.indexOf("mode:") === 0) {
      return h(Setup, {
        modeKey: view.slice(5), characters: props.characters, profile: props.profile, rels: props.rels,
        affinities: props.affinities, moods: props.moods, worldbook: props.worldbook, active: props.active, toast: props.toast,
        onCancel: () => setView("home"),
        onDone: session => { persist([session].concat(loadSaves().filter(s => s.id !== session.id))); setView("s:" + session.id); }
      });
    }
    if (view.indexOf("s:") === 0) {
      const s = saves.find(x => x.id === view.slice(2));
      if (!s) { setView("home"); return null; }
      return h(SessionView, { session: s, onBack: () => { setSaves(loadSaves()); setView("home"); } });
    }

    // ---- 落地页：四个玩法 + 历史 ----
    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: "塔罗", en: "Tarot", onBack: props.onBack }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-8" },
        h("div", { style: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 } },
          Object.keys(MODES).map(k => {
            const m = MODES[k];
            return h("button", {
              key: k, onClick: () => { if (!props.characters.length) { props.toast && props.toast("先去『名录』建个角色"); return; } setView("mode:" + k); },
              className: "w-full active:opacity-80", style: { textAlign: "left", background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 13 }
            },
              h("div", { style: { width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: ACCENT, color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 } }, m.icon),
              h("div", { style: { minWidth: 0 } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, m.zh),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 3, lineHeight: 1.5 } }, m.blurb)));
          })),
        saves.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: t.sub, marginBottom: 10, letterSpacing: .3 } }, "牌 · 历史") : null,
        h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
          saves.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).map(s => {
            const m = MODES[s.mode] || {};
            return h("div", {
              key: s.id,
              onClick: () => { if (lpFired.current) { lpFired.current = false; return; } setView("s:" + s.id); },
              onContextMenu: e => { e.preventDefault(); delSession(s.id); },
              onTouchStart: () => startLP(s.id), onTouchEnd: cancelLP, onTouchMove: cancelLP, onTouchCancel: cancelLP,
              onMouseDown: () => startLP(s.id), onMouseUp: cancelLP, onMouseLeave: cancelLP,
              className: "active:opacity-70",
              style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 13, padding: "12px 15px", cursor: "pointer" }
            },
              h("div", { style: { display: "flex", alignItems: "center", gap: 7, marginBottom: 4 } },
                h("span", { style: { fontFamily: F_BODY, fontSize: 10, fontWeight: 700, letterSpacing: .5, padding: "1px 7px", borderRadius: 6, color: "#fff", background: ACCENT } }, m.zh || "占卜"),
                h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, s.charName)),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                (s.mode === "reading" && s.question ? "问：" + s.question + " · " : "") + (s.cards || []).map(c => c.name).join(" · ")));
          })),
        saves.length ? h("div", { style: { marginTop: 14, textAlign: "center", fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "长按可撕掉一次占卜") : null
      ));
  }

  // ============================================================
  // 发起：选角色（+问题）→ 抽牌 → 解牌
  // ============================================================
  function Setup(props) {
    const t = useTheme();
    const m = MODES[props.modeKey];
    const [charId, setCharId] = useState("");
    const [q, setQ] = useState("");
    const [busy, setBusy] = useState(false);
    const [phase, setPhase] = useState("");

    const go = async () => {
      if (!charId) { props.toast && props.toast("先选一个角色"); return; }
      if (m.needQ && !q.trim()) { props.toast && props.toast("写下你想问的事"); return; }
      const c = props.characters.find(x => x.id === charId);
      const uName = (props.profile && props.profile.name) || "我";

      // 每日一牌：同一天同一角色 → 直接取已有的那次，不重抽
      if (m.daily) {
        const tk = todayKey();
        const exist = loadSaves().find(s => s.mode === "daily" && s.charId === charId && s.dayKey === tk);
        if (exist) { props.onDone(exist); return; }
      }

      setBusy(true); setPhase("正在洗牌…");
      try {
        const cards = draw(m.spread.length);
        setPhase("牌已摊开，" + c.name + "正在解读…");
        const rels = props.rels || {};
        const r1 = rels[c.id + "->me"], r2 = rels["me->" + c.id];
        const relText = [r2 && r2.label ? "你把 Ta 当作：" + r2.label : "", r1 && r1.label ? "Ta 把你当作：" + r1.label : ""].filter(Boolean).join("；");
        const aff = props.affinities ? props.affinities[c.id] : null;
        const out = await readSpread(props.active, {
          mode: props.modeKey, cards: cards, spread: m.spread,
          charName: c.name, charPersona: c.persona || "", uName: uName,
          question: q.trim(), relText: relText,
          band: (props.modeKey === "relation" || props.modeKey === "reading") ? affBand(aff) : "",
          voiceRef: recentChat(c.id, uName, c.name), worldbook: props.worldbook
        });
        const session = {
          id: "tr_" + Date.now(), mode: props.modeKey, charId: c.id, charName: c.name,
          question: q.trim(), spread: m.spread, cards: cards, reads: out.reads, summary: out.summary,
          dayKey: m.daily ? todayKey() : "", ts: Date.now()
        };
        props.onDone(session);
      } catch (e) { props.toast && props.toast("牌没摊开：" + (e.message || "重试")); setBusy(false); setPhase(""); }
    };

    const label = { fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: t.sub, marginBottom: 8, letterSpacing: .3 };

    if (busy) return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: m.zh, en: m.en, onBack: props.onCancel }),
      h("div", { className: "flex-1 flex flex-col items-center justify-center px-8" },
        h("div", { style: { fontSize: 40, color: ACCENT, marginBottom: 18 } }, m.icon),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, textAlign: "center" } }, phase || "…")));

    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: m.zh, en: m.en, onBack: props.onCancel }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-32" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.7, marginBottom: 20 } }, m.blurb + "。"),
        h("div", { style: label }, props.modeKey === "forchar" ? "替谁算" : props.modeKey === "relation" ? "算你和谁" : "请谁替你解牌"),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 } },
          props.characters.map(c => {
            const on = charId === c.id;
            return h("button", { key: c.id, onClick: () => setCharId(prev => prev === c.id ? "" : c.id), className: "active:opacity-70",
              style: { fontFamily: F_BODY, fontSize: 13, color: on ? "#fff" : t.ink, background: on ? ACCENT : t.bg2, border: "1px solid " + (on ? ACCENT : t.line), borderRadius: 999, padding: "8px 15px" } }, c.name);
          })),
        m.needQ ? h("div", { style: label }, "你想问的事") : null,
        m.needQ ? h("textarea", { value: q, onChange: e => setQ(e.target.value), rows: 3, placeholder: m.qHint,
          style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 11, padding: "11px 13px", width: "100%", outline: "none", resize: "none", marginBottom: 8 } }) : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.7 } },
          "会摊开 " + m.spread.length + " 张牌：" + m.spread.join(" · ") + "。")
      ),
      h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 20px calc(10px + env(safe-area-inset-bottom))", background: "linear-gradient(to top," + t.bg + " 78%,transparent)" } },
        h("button", { onClick: go, className: "w-full active:opacity-80",
          style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 700, color: "#fff", background: ACCENT, borderRadius: 12, padding: "13px 0" } }, "洗牌 · 摊开")));
  }

  // ============================================================
  // 一次占卜的正文
  // ============================================================
  function SessionView(props) {
    const t = useTheme();
    const s = props.session;
    const m = MODES[s.mode] || {};
    const cards = s.cards || [];

    // 一张牌片
    const cardTile = (c, pos, i) => h("div", { key: "c" + i, style: { flex: "1 1 0", minWidth: 88, maxWidth: 130 } },
      h("div", { style: { position: "relative", aspectRatio: "2/3.4", borderRadius: 11, background: "linear-gradient(160deg," + ACCENT + ",#241f38)", border: "1px solid rgba(184,145,80,0.5)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 8, overflow: "hidden" } },
        h("div", { style: { position: "absolute", top: 6, left: 8, fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: 1, color: "rgba(184,145,80,0.85)" } }, c.major ? "ARCANA" : ""),
        h("div", { style: { fontSize: 22, color: GOLD, marginBottom: 8, transform: c.rev ? "rotate(180deg)" : "none" } }, m.icon || "✦"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: "#f4efe4", textAlign: "center", lineHeight: 1.25 } }, c.name),
        h("div", { style: { marginTop: 6, fontFamily: F_BODY, fontSize: 10, color: c.rev ? "#e0a3a3" : "rgba(244,239,228,0.7)", border: "1px solid rgba(184,145,80,0.4)", borderRadius: 999, padding: "1px 8px" } }, c.rev ? "逆位" : "正位")),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, textAlign: "center", marginTop: 6 } }, pos));

    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: m.zh || "占卜", en: m.en, onBack: props.onBack }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-10" },
        // 抬头：谁 + 问题
        h("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 4 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: GOLD, fontWeight: 700 } }, m.icon),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } },
            s.mode === "forchar" ? "为 " + s.charName + " 而算" : s.mode === "relation" ? "你 与 " + s.charName : s.charName + " 为你解牌")),
        s.mode === "reading" && s.question ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, fontStyle: "italic", marginBottom: 16 } }, "「" + s.question + "」") : h("div", { style: { height: 12 } }),
        // 牌阵
        h("div", { style: { display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 22 } },
          cards.map((c, i) => cardTile(c, (s.spread || [])[i] || "", i))),
        // 逐张解读
        (s.reads || []).map((r, i) => h("div", { key: "r" + i, style: { marginBottom: 16 } },
          h("div", { style: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, fontWeight: 700, color: ACCENT, background: "rgba(74,63,107,0.1)", borderRadius: 6, padding: "1px 8px" } }, r.pos || (s.spread || [])[i] || ("第" + (i + 1) + "张")),
            cards[i] ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, cardLabel(cards[i])) : null),
          h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.8, color: t.ink, whiteSpace: "pre-wrap" } }, r.text))),
        // 收束
        s.summary ? h("div", { style: { marginTop: 8, padding: "14px 16px", background: "rgba(74,63,107,0.06)", border: "1px solid rgba(74,63,107,0.22)", borderRadius: 13 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, fontWeight: 700, letterSpacing: .5, color: ACCENT, marginBottom: 6 } }, s.mode === "daily" ? "今日签" : "牌面的话"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.8, color: t.ink } }, s.summary)) : null));
  }

  window.Tarot = Tarot;
})();
