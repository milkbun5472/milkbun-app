// ============================================================
// 时光胶囊（capsule）—— 给未来写信，情侣空间内的独立页面（眠尔机借鉴，自己重写）
//   · 每段情侣空间只看自己的胶囊；角色 ID 是隔离边界，旧内容不迁移、不删除
//   · 给当前情侣对象写：到期 TA 才收到拆开，读信后写一封回信（一次 API，走主力池）
//   · 反向：你给 TA 埋胶囊时，TA 有时也悄悄埋一颗给你（内容当场生成封存，到期才能看）
//   · 到期时情侣空间入口红点（window.capsuleDueCount）；封存中内容全锁（自己写的也不给看，反悔删掉可以）
// 数据 x_capsules，随云同步。
// ============================================================
(function () {
  const ACCENT = "#5a6d8a";
  const load = () => { const v = loadJSON("x_capsules", []); return Array.isArray(v) ? v : []; };
  const save = list => saveJSON("x_capsules", list);
  // ID 是权威隔离键；极早期若只存了名字，则仅为同名角色做只读兼容。
  const belongsTo = (cap, characterId, characterName) => {
    if (!cap || !characterId || cap.dir === "toSelf") return false;
    if (String(cap.charId || "") === String(characterId)) return true;
    return !cap.charId && !!characterName && String(cap.charName || "") === String(characterName);
  };
  window.capsuleDueCount = function (characterId, characterName) { try { const now = Date.now(); return load().filter(c => belongsTo(c, characterId, characterName) && !c.opened && c.openTs <= now).length; } catch (e) { return 0; } };
  const fmtD = ts => { const d = new Date(ts); return d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日"; };
  const leftTxt = ts => { const ms = ts - Date.now(); if (ms <= 0) return "可拆封"; const dd = Math.ceil(ms / 86400000); return dd > 1 ? "还有 " + dd + " 天" : "不到 1 天"; };
  const uid = () => "cap_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

  // 胶囊不是一律写给“遥远未来”。一周后的纸条与一年后的信，时间感和可谈的变化本来就不同。
  // 统一给手动回埋、自动埋与到期回信使用，免得三条路径各自把短期胶囊写成人生预言（v53.90）。
  const daysBetween = (fromTs, toTs) => Math.max(1, Math.round((Number(toTs) - Number(fromTs)) / 86400000));
  // ⚠️字数（她 2026-09-05：「现在字数是不是太少了」）：原来是 140-480，
  //   短到写不开——封了三个月的信只有三百来字，读起来像张便签，不像一封信。
  //   这一层是【下限】比上限重要：说清「至少要写到这个份上」，别让它草草收尾。
  const sealGuide = openTs => {
    const days = daysBetween(Date.now(), openTs);
    if (days <= 14) return "这颗胶囊约 " + days + " 天后就会拆开，它是一张延时抵达的私密纸条，不是写给遥远未来的预言。把【今天此刻】一个具体念头、细节、小秘密或没说出口的话封进去；不要凭空预告人生、关系或性格会发生巨大变化。写 3-5 个自然段，**至少 300 个汉字、别超过 700**；内容宁可具体、有只属于你们的细节，也不要泛泛祝福。";
    if (days <= 90) return "这颗胶囊约 " + days + " 天后拆开。重点保存【现在】真正值得回看的一个具体瞬间、牵挂、疑问或约定；可以期待届时回看，但不要把不确定的未来写成已经发生。写 4-6 个自然段，**至少 450 个汉字、别超过 900**，有细节、有你自己的口吻。";
    return "这颗胶囊约 " + days + " 天后拆开——隔这么久，值得好好写一封。写下此刻真正想留给那一天的 Ta 的东西：具体处境、心愿、疑问、约定或没说出口的话。可以谈长时间后的期待，但不替未来下结论。写 5-8 个自然段，**至少 650 个汉字、别超过 1300**，有细节、有你自己的口吻。长不等于绕：每一段都要有一件具体的事，别用感慨把篇幅填满。";
  };
  const replyGuide = (createdTs, openedTs) => {
    const days = daysBetween(createdTs, openedTs);
    if (days <= 14) return "这封信只封存了约 " + days + " 天。回应当时那句话和这几天真实发生的小变化；如果没变，也可以坦白说没变。不要硬写成多年后重逢，不要虚构关系或人生已经发生巨大转折。";
    if (days <= 90) return "这封信封存了约 " + days + " 天。回应信里最具体的内容，对照当时与现在确实发生的变化；没有证据的变化不要编。";
    return "这封信封存了约 " + days + " 天。回应信里最具体的内容，并从你真实知道的共同经历中对照当时与现在；不把期待冒充事实。";
  };
  window.CapsulePromptKit = { daysBetween, sealGuide, replyGuide };

  // 三屏共用的那层底（v62.44）：时光胶囊是【埋下去】的东西，所以底纹是一层层压下去的沉积。
  // 铺在最外那个 h-full 外壳上、Head 传 transparent 让它透上来，顶上才不会横一道没盖住的带子
  //（.claude/rules/mobile-ui-layout.md §3.5）。也不跟着滚——内容在动，底不该动。
  const STRATA = "repeating-linear-gradient(180deg,rgba(120,95,55,.055) 0 1px,rgba(0,0,0,0) 1px 11px),"
    + "repeating-linear-gradient(180deg,rgba(120,95,55,.03) 0 1px,rgba(0,0,0,0) 1px 37px)";
  function CapsuleApp(props) {
    const t = useTheme();
    const [allList, setAllList] = useState(load);
    const [view, setView] = useState(null);      // null=列表 | "compose" | capsuleId(详情)
    const [busy, setBusy] = useState(null);      // 正在生成回信的 capsuleId
    const chars = props.characters || [];
    const uName = (props.profile && props.profile.name) || "我";
    const charOf = id => chars.find(c => c.id === id);
    const activeChar = charOf(props.characterId);
    const list = allList.filter(c => belongsTo(c, props.characterId, activeChar && activeChar.name));
    const updateAll = updater => setAllList(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (save(next)) return next;
      props.toast && props.toast("这次没保存成功，原胶囊还在");
      return prev;
    });

    // 反向胶囊：你埋给 TA 时，TA 也悄悄埋一颗——内容以 TA 此刻的心境当场写好、封存到同一天。
    // 每个角色【第一次】给 TA 埋时必回埋一颗（保证你至少见到一次）；之后 70% 概率。失败给提示、不再静默。
    const maybeBuryBack = async (char, openTs) => {
      if (!props.active) return;
      const existing = load();
      // 同一个人已经有一颗话在路上，就别因为用户连续埋信而叠出一排锁盒。
      if (existing.some(c => c && c.dir === "fromChar" && c.charId === char.id && !c.opened)) return;
      const everBuried = existing.some(c => c && c.dir === "fromChar" && c.charId === char.id);
      if (everBuried && Math.random() > 0.7) return;
      try {
        // ⚠️站位（v64.03，她 2026-09-05 点名对比情书和悄悄话）：那两处走的是
        //   runProbe({voice:true})——「你就是他本人正在写」；这一处原来自己拼 sys 直发，
        //   料一样、站位没有。写信这题的训练先验就是书信八股（见字如面／提笔时窗外…），
        //   没有那句站位它必然往那儿滑。解梦馆那次是同一个形状。
        const d = await runProbe(props.apiFor ? props.apiFor(char.id) : props.active, props.ctxFor(char), {
          voice: true,
          instruction: uName + " 刚埋下一颗写给你的时光胶囊（内容保密），约定 " + fmtD(openTs) + " 才能拆。你心里一动，也悄悄把一封【现在写下、到期才送达】的信埋给 Ta。"
            + sealGuide(openTs) + "第一人称，贴你的人设与此刻心情；别客套、别落款。",
          schemaHint: "{\"letter\":\"信的正文\"}",
          maxTokens: 20000   // 一封长信＝「一整章」那一档（max-tokens-floor）；放宽字数之后 12000 会截在半句
        });
        if (!d || !d.letter) { props.toast && props.toast(char.name + " 想回埋一颗但没写成，回头再说～"); return; }
        const entry = { id: uid(), dir: "fromChar", source: "reciprocal", charId: char.id, charName: char.name, text: String(d.letter).trim(), createdTs: Date.now(), openTs, opened: false, reply: null };
        updateAll(prev => [entry, ...prev]);
        props.toast && props.toast(char.name + " 好像也悄悄埋了一颗…到期才能拆");
      } catch (e) { props.toast && props.toast(char.name + " 想回埋一颗但没成：" + (e.message || "稍后重试")); }
    };
    const bury = (text, openTs) => {
      const c = activeChar;
      if (!c) { props.toast && props.toast("没找到这段情侣关系，先返回重进一次"); return; }
      const entry = { id: uid(), dir: "toChar", source: "manual", charId: c.id, charName: c.name, text, createdTs: Date.now(), openTs, opened: false, reply: null };
      updateAll(prev => [entry, ...prev]);
      setView(null);
      props.toast && props.toast("已封存 · " + fmtD(openTs) + " 开启");
      maybeBuryBack(c, openTs);
    };
    // 拆封：给角色的 → TA 读信写回信；TA 埋的/给自己的 → 直接揭开
    const openCap = async cap => {
      if (cap.openTs > Date.now()) return;
      const upd = patch => updateAll(prev => prev.map(x => x.id === cap.id ? { ...x, ...patch } : x));
      upd({ opened: true, openedTs: Date.now() });
      setView(cap.id);
      if (cap.dir === "toChar" && props.active && !cap.reply) {
        const c = charOf(cap.charId);
        if (!c) return;
        setBusy(cap.id);
        try {
          const d = await runProbe(props.apiFor ? props.apiFor(c.id) : props.active, props.ctxFor(c), {
            voice: true,
            instruction: uName + " 在 " + fmtD(cap.createdTs) + " 埋了一颗时光胶囊给你，约定今天才能拆。你刚拆开，读到 Ta 当时写的信：\n「" + cap.text + "」\n\n"
              + replyGuide(cap.createdTs, Date.now())
              + "以你此刻的人设与心情写回信：直接回应信里最具体、最让你有反应的地方，联系你真正知道的共同经历。"
              + "写 4-6 个自然段，**至少 400 个汉字、别超过 900**；第一人称，动真格，别客套、别复述原文、别落款。",
            schemaHint: "{\"reply\":\"回信正文\"}",
            maxTokens: 20000
          });
          if (d && d.reply) upd({ reply: String(d.reply).trim() });
          keepOpened(cap, c, d && d.reply ? String(d.reply).trim() : "");
        } catch (e) { props.toast && props.toast("回信没等到：" + (e.message || "重试")); }
        finally { setBusy(null); }
      } else if (cap.dir === "fromChar") {
        keepOpened(cap, charOf(cap.charId), "");
      }
    };
    // 拆开那一刻记一笔（她 2026-09-05：情书会进记忆库，胶囊什么都不进——
    // 于是他认认真真回了一封信，下次聊天完全不知道自己拆过）。
    // ⚠️只在【拆开之后】写。封存期间一个字都不许进记忆或上下文，那是这个功能的全部机制。
    const keepOpened = (cap, c, reply) => {
      if (!props.onKeep || !c || cap.dir === "toSelf") return;
      const snip = (x, n) => String(x || "").replace(/\s+/g, " ").trim().slice(0, n);
      const text = cap.dir === "toChar"
        ? uName + " 在 " + fmtD(cap.createdTs) + " 埋了一颗时光胶囊给" + c.name + "，今天拆开了。信里写着「" + snip(cap.text, 120) + "」"
          + (reply ? "；" + c.name + "回信说「" + snip(reply, 120) + "」" : "")
        : c.name + " 在 " + fmtD(cap.createdTs) + " 悄悄埋了一颗时光胶囊，今天" + uName + "拆开了，他当时写的是「" + snip(cap.text, 120) + "」";
      props.onKeep(c.id, text, "时光胶囊");
    };
    const delCap = id => requestAppConfirm("删掉这颗胶囊？", "删了不可恢复。", () => {
      const next = allList.filter(x => x.id !== id);
      if (!save(next)) return props.toast && props.toast("这次没删成功，原胶囊还在");
      setAllList(next); setView(null);
    }, "删除");

    // ---- 详情 ----
    if (view && view !== "compose") {
      const cap = list.find(x => x.id === view);
      if (!cap) { setView(null); return null; }
      const who = cap.dir === "toSelf" ? "写给未来的自己" : cap.dir === "toChar" ? "写给 " + cap.charName : cap.charName + " 埋给你的";
      return h("div", { className: "h-full flex flex-col", style: { background: t.bg, backgroundImage: STRATA } },
        h(Head, { zh: "时光胶囊", en: activeChar ? activeChar.name : "", bg: "transparent", onBack: () => setView(null), right: h("button", { onClick: () => delCap(cap.id), className: "active:opacity-50" }, h(ITrash, { size: 18, color: t.fog })) }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 12 } }, who + " · 埋于 " + fmtD(cap.createdTs) + " · 拆于 " + fmtD(cap.openedTs || cap.openTs)),
          h("div", { style: { background: "#f7f1e2", border: "1px solid #e2d7c1", borderRadius: 2, padding: "18px 17px", marginBottom: 16,
            boxShadow: "0 7px 18px rgba(90,70,40,.11)",
            backgroundImage: "repeating-linear-gradient(180deg,rgba(0,0,0,0) 0 26px,rgba(120,100,60,.14) 26px 27px)", backgroundPosition: "0 38px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: "0.15em", color: "#9b8a6c", height: 20 } }, cap.dir === "fromChar" ? "TA 当时写下的" : "当时写下的"),
            h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 14.5, lineHeight: "27px", color: "#4b3f2e", whiteSpace: "pre-wrap" } }, cap.text)),
          cap.dir === "toChar" ? (
            cap.reply
              ? h("div", { style: { background: "#eef1f6", border: "1px solid #ccd6e4", borderRadius: 2, padding: "18px 17px",
                  boxShadow: "0 7px 18px rgba(50,70,100,.10)",
                  backgroundImage: "repeating-linear-gradient(180deg,rgba(0,0,0,0) 0 26px,rgba(70,95,135,.13) 26px 27px)", backgroundPosition: "0 38px" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: "0.15em", color: ACCENT, height: 20 } }, (cap.charName || "TA") + " 的回信"),
                  h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 14.5, lineHeight: "27px", color: "#33405a", whiteSpace: "pre-wrap" } }, cap.reply))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, textAlign: "center", padding: "14px 0" } },
                  busy === cap.id ? "TA 正在读信、写回信…" : h("button", { onClick: () => openCap({ ...cap, opened: false }), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: "#fff", background: ACCENT, border: "none", borderRadius: 999, padding: "8px 18px" } }, "让 TA 读信回信"))
          ) : null));
    }
    // ---- 写一颗（compose）----
    if (view === "compose") return h(CapsuleCompose, { t, char: activeChar, onBack: () => setView(null), onBury: bury });
    // ---- 列表 ----
    const now = Date.now();
    const due = list.filter(c => !c.opened && c.openTs <= now);
    const sealed = list.filter(c => !c.opened && c.openTs > now).sort((a, b) => a.openTs - b.openTs);
    const done = list.filter(c => c.opened);
    // ── 一封蜡封的信（v62.44，她 2026-09-04：「时光胶囊里面也是，甚至还在用 emoji」）──
    // 上一版每条是一个圆角框，左边挂一个锁 / 沙漏 / 信封 emoji。两个毛病：
    //   ① emoji 在她机器上会渲成豆腐块（跟情侣空间那次一模一样的病，v61.29 记过）；
    //   ② 换个 app 照样成立——它没长成【胶囊】这件东西。
    // 这一页里的东西现实中是【封了火漆的信】，所以三种状态是三种【形状】，不是三种颜色：
    //   封存中＝印是整的、刻着「封」；到期＝印裂了一道、刻着「启」；已拆＝印掰成了两半。
    // 印上刻的是汉字，不是 emoji——汉字一定渲得出来。
    const WAX = { sealed: "#8f342c", due: "#b8453a", done: "#b09490" };
    const waxSeal = kind => kind === "done"
      ? h("span", { "aria-hidden": "true", style: { position: "relative", width: 34, height: 34, flexShrink: 0, display: "block" } },
          h("span", { style: { position: "absolute", left: 0, top: 4, width: 13, height: 27, borderRadius: "13px 2px 2px 13px", background: WAX.done, opacity: .62, transform: "rotate(-13deg)" } }),
          h("span", { style: { position: "absolute", right: 0, top: 6, width: 13, height: 27, borderRadius: "2px 13px 13px 2px", background: WAX.done, opacity: .62, transform: "rotate(12deg)" } }))
      : h("span", { style: { position: "relative", width: 34, height: 34, flexShrink: 0, borderRadius: 999,
          background: "radial-gradient(circle at 34% 28%," + (kind === "due" ? "#d4685c" : "#a94a40") + "," + WAX[kind] + " 60%,#6d251f)",
          boxShadow: "inset 0 -2px 4px rgba(0,0,0,.34), 0 3px 6px rgba(90,30,25,.30)",
          display: "flex", alignItems: "center", justifyContent: "center" } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: "rgba(255,238,232,.92)" } }, kind === "due" ? "启" : "封"),
          kind === "due" ? h("span", { "aria-hidden": "true", style: { position: "absolute", left: 1, right: 1, top: "50%",
            height: 1.5, background: "rgba(255,242,238,.8)", transform: "rotate(-16deg)" } }) : null);
    const row = (cap, kind) => {
      const who = cap.dir === "toSelf" ? "给未来的自己" : cap.dir === "toChar" ? "给 " + cap.charName : cap.charName + " 埋的";
      return h("button", { key: cap.id, onClick: () => kind === "due" ? openCap(cap) : (kind === "done" ? setView(cap.id) : null), className: "w-full text-left active:opacity-80",
        style: { position: "relative", display: "flex", alignItems: "center", gap: 13, minHeight: 44, padding: "14px 15px", borderRadius: 2, marginBottom: 11,
          background: kind === "due" ? "linear-gradient(180deg,#fdf5e6,#f8ead2)" : kind === "done" ? "#f7f2e8" : "#f3ecdd",
          border: "1px solid " + (kind === "due" ? "#dfc189" : "#e2d7c1"),
          boxShadow: kind === "due" ? "0 10px 22px rgba(120,85,40,.17)" : "0 5px 13px rgba(90,70,40,.08)",
          transform: "rotate(" + (kind === "due" ? -0.6 : -0.25) + "deg)" } },
        // 信封正面那个倒三角封口：封着的是实线，拆过的只剩一道虚痕
        h("svg", { "aria-hidden": "true", viewBox: "0 0 100 18", preserveAspectRatio: "none",
          style: { position: "absolute", left: 0, right: 0, top: 0, width: "100%", height: 18, opacity: kind === "done" ? .3 : .6 } },
          h("path", { d: "M0 0 L50 15 L100 0", fill: "none", stroke: "rgba(140,110,60,.55)", strokeWidth: 1,
            strokeDasharray: kind === "done" ? "3 4" : "none", vectorEffect: "non-scaling-stroke" })),
        waxSeal(kind),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: "#5b4a33" } }, who),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#9b8a6c", marginTop: 3, lineHeight: 1.6 } },
            kind === "sealed" ? "埋于 " + fmtD(cap.createdTs) + " · " + fmtD(cap.openTs) + " 开启 · " + leftTxt(cap.openTs)
            : kind === "due" ? "埋于 " + fmtD(cap.createdTs) + " · 到日子了，点开拆封"
            : "拆于 " + fmtD(cap.openedTs || cap.openTs))),
        kind === "due" ? h("span", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: "#a5642c", flexShrink: 0 } }, "拆封") : null);
    };
    return h("div", { className: "h-full flex flex-col", style: { background: t.bg, backgroundImage: STRATA } },
      h(Head, { zh: "时光胶囊", en: activeChar ? activeChar.name : "", bg: "transparent", onBack: props.onBack, right: activeChar ? h("button", { onClick: () => setView("compose"), className: "active:opacity-50" }, h(IPlus, { size: 20, color: t.ink })) : null }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-10" },
        !activeChar ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", padding: "60px 20px", lineHeight: 2 } }, "没有找到当前情侣对象。\n返回情侣空间后，从对应的人那里重新打开。") : null,
        activeChar && list.length === 0 ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", padding: "60px 20px", lineHeight: 2 } }, "你和 " + activeChar.name + " 还没有胶囊。\n点右上角 ＋，给以后写点什么。") : null,
        due.length ? h("div", { style: { marginBottom: 14 } }, due.map(c => row(c, "due"))) : null,
        sealed.length ? h("div", { style: { marginBottom: 14 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: "0.1em", color: t.fog, marginBottom: 8 } }, "封存中 · 到期前谁也看不到"),
          sealed.map(c => row(c, "sealed"))) : null,
        done.length ? h("div", null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: "0.1em", color: t.fog, marginBottom: 8 } }, "已拆开"),
          done.map(c => row(c, "done"))) : null));
  }

  function CapsuleCompose({ t, char, onBack, onBury }) {
    const [text, setText] = useState("");
    const [preset, setPreset] = useState(30);   // 天数；-1=自定义
    const [customDate, setCustomDate] = useState("");
    const openTs = preset === -1
      ? (customDate ? new Date(customDate + "T09:00:00").getTime() : 0)
      : Date.now() + preset * 86400000;
    const ok = text.trim() && openTs > Date.now();
    // ── 「什么时候开启」不是一排药丸（v62.44，tabs-not-plain-pills）──────────
    // 上一版是五颗填色的圆角药丸：搬去任何 app 都成立，而且【看不出那天到底是哪天】。
    // 这一格问的是「哪一天开」，那就直接把那一天摆出来：一张真的挂历页
    //（跟情侣空间倒数、我们的日子那一列是同一张 CalPage——一处画、处处用）。
    // 选中的那一张往上抬、微微歪、压出影；没选的往下缩一截、压灰。
    // 形状、高度、位置三样都变了，不只靠色差。
    const dayOf = n => new Date(Date.now() + n * 86400000);
    const leaf = (on, n, label, onClick) => {
      const d = n > 0 ? dayOf(n) : (customDate ? new Date(customDate + "T09:00:00") : null);
      const valid = d && !isNaN(d.getTime());
      return h("button", { key: label, onClick: onClick, className: "active:opacity-80",
        style: { flex: 1, minWidth: 0, padding: "2px 0 4px", display: "flex", flexDirection: "column", alignItems: "center",
          transform: on ? "translateY(-3px) rotate(-1.6deg)" : "none", transition: "transform .12s" } },
        h("span", { style: { display: "block", filter: on ? "none" : "grayscale(.55)", opacity: on ? 1 : .58,
          boxShadow: on ? "0 7px 15px rgba(90,60,40,.24)" : "none", borderRadius: 7 } },
          typeof CalPage === "function"
            ? h(CalPage, { w: 44, dim: !on, month: valid ? d.getMonth() + 1 : undefined, day: valid ? d.getDate() : undefined,
                head: valid ? undefined : "　", body: valid ? undefined : "？" })
            : null),
        h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: on ? "#8a5f3a" : t.fog, marginTop: 6 } }, label));
    };
    return h("div", { className: "h-full flex flex-col", style: { background: t.bg, backgroundImage: STRATA } },
      h(Head, { zh: "埋一颗胶囊", en: char ? (char.remark || char.name) : "", bg: "transparent", onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, margin: "6px 0 9px" } }, "哪一天拆开"),
        h("div", { className: "flex", style: { gap: 6, alignItems: "flex-start", marginBottom: preset === -1 ? 10 : 18 } },
          [[7, "1 周后"], [30, "1 个月后"], [90, "3 个月后"], [365, "1 年后"]].map(pp => leaf(preset === pp[0], pp[0], pp[1], () => setPreset(pp[0]))).concat(
            [leaf(preset === -1, -1, "自己挑", () => setPreset(-1))])),
        preset === -1 ? h("input", { type: "date", value: customDate, onChange: e => setCustomDate(e.target.value),
          style: { width: "100%", outline: "none", padding: "10px 12px", borderRadius: 12, fontFamily: F_BODY, fontSize: 14, background: t.bg2, color: t.ink, border: "1px solid " + t.line, marginBottom: 18 } }) : null,
        // 信纸：格子是真的，正文行高跟格距相等，字写在格子上（跟交换日记同一套做法）
        h("div", { style: { position: "relative", borderRadius: 2, padding: "13px 15px 15px", background: "#f7f1e2",
          border: "1px solid #e2d7c1", boxShadow: "0 8px 20px rgba(90,70,40,.12)",
          backgroundImage: "repeating-linear-gradient(180deg,rgba(0,0,0,0) 0 26px,rgba(120,100,60,.14) 26px 27px)", backgroundPosition: "0 33px" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".14em", color: "#9b8a6c", height: 20 } },
            "写给拆开这封信那天的 " + (char ? (char.remark || char.name) : "TA")),
          h("textarea", { value: text, onChange: e => setText(e.target.value), rows: 9,
            placeholder: "封存后 TA 到期才看得到，你自己也不能偷看…",
            style: { width: "100%", outline: "none", resize: "none", background: "transparent", border: "none", padding: 0,
              fontFamily: "'Noto Serif SC',serif", fontSize: 14.5, lineHeight: "27px", color: "#4b3f2e" } })),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 9, lineHeight: 1.6 } }, "封存后内容上锁、只能整颗删除；到期情侣空间那一行会亮红点。给角色埋的话，TA 有时也会悄悄埋一颗给你。"),
        // 「封存」这一下不是按钮，是【把火漆压下去】：一枚刻着「封」的印
        h("button", { onClick: () => ok && onBury(text.trim(), openTs), disabled: !ok, className: "w-full flex flex-col items-center active:opacity-80 disabled:opacity-35",
          style: { marginTop: 18, minHeight: 44, padding: "6px 0 4px", background: "transparent" } },
          h("span", { style: { width: 52, height: 52, borderRadius: 999,
            background: "radial-gradient(circle at 34% 28%,#a94a40,#8f342c 60%,#6d251f)",
            boxShadow: "inset 0 -3px 6px rgba(0,0,0,.34), 0 5px 12px rgba(90,30,25,.34)",
            display: "flex", alignItems: "center", justifyContent: "center" } },
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 23, color: "rgba(255,238,232,.94)" } }, "封")),
          h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, marginTop: 8 } }, "压下去，封存"))));
  }
  window.CapsuleApp = CapsuleApp;
})();
