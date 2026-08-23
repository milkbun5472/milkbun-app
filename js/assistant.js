// ============================================================
// 帮手（assistant）—— app 里的小助理：帮她改文风、改人设、查「为什么没生效」、整理记忆
// 她 2026-08-22 要的：能直接改，但每一步都要她点头。
//
// 铁律：它【永远】不自己落库。所有改动一律先出成「改动稿」（patch），
// 界面上把改前改后并排摆出来，她一条条点「应用」才真的写进去。
// 这样最坏情况也只是一段白写的字，绝不会把她攒了很久的人设/文风悄悄改坏。
// ============================================================
(function () {
  const useState = React.useState;

  // 图标：一支笔搭在方框上（改东西的意思）
  window.GAssist = p => h(Svg, p,
    h("path", { d: "M4 5.5A1.5 1.5 0 015.5 4h7" }),
    h("path", { d: "M20 11.5v7a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5v-7" }),
    h("path", { d: "M19.6 3.6a1.9 1.9 0 012.7 2.7L14.6 14 11 15l1-3.6z" }));

  const loadJ = (k, d) => { try { return typeof loadJSON === "function" ? loadJSON(k, d) : JSON.parse(localStorage.getItem(k) || JSON.stringify(d)); } catch (e) { return d; } };
  const clip = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);

  // ---- 它能改的东西：白名单。不在这张表里的一律不许碰 ----
  // 每一项都要说清「怎么读」「怎么写」「界面上叫什么」，写入口集中在这里，
  // 免得以后加能力时到处散着改，哪天漏个校验就真把她的数据写坏了。
  const TARGETS = {
    style: {
      zh: "文风预设",
      read: () => loadJ("x_offlineStyles", []).map(s => ({ id: s.key, name: s.name, text: s.prompt })),
      write: (id, patch, ctx) => {
        const list = loadJ("x_offlineStyles", []);
        const i = list.findIndex(x => x.key === id);
        const next = i >= 0
          ? list.map(x => x.key === id ? { ...x, name: patch.name || x.name, prompt: patch.text } : x)
          : list.concat([{ key: "custom_" + Date.now(), name: patch.name || "帮手写的文风", prompt: patch.text, custom: true }]);
        try { localStorage.setItem("x_offlineStyles", JSON.stringify(next)); } catch (e) { throw new Error("存不下了，可能是本地存储满了"); }
        return next.length;
      }
    },
    persona: {
      zh: "角色人设",
      read: ctx => (ctx.characters || []).map(c => ({ id: c.id, name: c.name, text: c.persona })),
      write: (id, patch, ctx) => {
        if (!ctx.onPatchCharacter) throw new Error("这个页面没接角色写入口");
        ctx.onPatchCharacter(id, { persona: patch.text });
        return 1;
      }
    },
    appearance: {
      zh: "角色外貌",
      read: ctx => (ctx.characters || []).map(c => ({ id: c.id, name: c.name, text: c.appearance })),
      write: (id, patch, ctx) => {
        if (!ctx.onPatchCharacter) throw new Error("这个页面没接角色写入口");
        ctx.onPatchCharacter(id, { appearance: patch.text });
        return 1;
      }
    },
    memory: {
      zh: "记忆库条目",
      read: () => [],                       // 记忆是往里加，不是改现有的
      write: (id, patch, ctx) => {
        if (!ctx.onAddMemories) throw new Error("这个页面没接记忆写入口");
        const items = String(patch.text || "").split("\n").map(x => x.replace(/^[-·•\d.、\s]+/, "").trim()).filter(Boolean);
        if (!items.length) throw new Error("没有可写入的条目");
        ctx.onAddMemories(id, items);       // id = charId
        return items.length;
      }
    }
  };

  // ---- 现状快照：让它看得见 app 此刻的样子，才谈得上「诊断」 ----
  function snapshot(ctx) {
    const chars = (ctx.characters || []).map(c => ({
      名字: c.name, id: c.id,
      人设: clip(c.persona, 220) || "（空）",
      外貌: clip(c.appearance, 120) || "（空）",
      有参考照: !!c.refPhoto, 出图画风: c.photoStyle || "realistic"
    }));
    const styles = loadJ("x_offlineStyles", []).map(s => ({ 名称: s.name, id: s.key, 字数: String(s.prompt || "").length }));
    const offSet = loadJ("x_offlineSettings", {});
    const errs = (typeof window !== "undefined" && window.__errLog ? window.__errLog : []).slice(-5)
      .map(e => clip(e && e.msg, 120));
    return { 角色: chars, 已存的文风预设: styles, 线下设置: offSet, 最近报错: errs.length ? errs : ["（本次开机没抓到报错）"] };
  }

  // ---- 让它按固定形状说话：正文 + 改动稿 ----
  const SHAPE = '{"reply":"给她看的话（中文，简短，别复述她的问题）","patches":[{"target":"style|persona|appearance|memory","id":"要改的那一条的 id；style 留空=新建一条","title":"这条改动一句话叫什么","name":"（只有 style 新建时用）预设名","text":"改完的完整内容","why":"为什么这么改，一两句"}]}';

  function buildSystem(ctx, mode) {
    const snap = snapshot(ctx);
    const uName = (ctx.profile && ctx.profile.name) || "她";
    return "你是这个私人 App 里的帮手，替 " + uName + " 打理角色与写作设定。说话简短、直接、不客套，不用敬语堆砌。\n\n"
      + "【你能改的东西·只有这四样】\n"
      + "· style 文风预设（写给 AI 的文风提示词）\n· persona 角色人设\n· appearance 角色外貌\n· memory 记忆库条目（往里加）\n"
      + "别的一律不许碰，也别假装你改了。\n\n"
      + "【最重要的规矩】你给出的 patch 只是【草稿】。" + uName + " 会一条条看过再决定应不应用，所以：\n"
      + "· text 必须是【改完的完整内容】，不是 diff、不是「在原文基础上加一句」——她要能直接整段替换。\n"
      + "· 一次别超过 3 条 patch；没什么要改就给空数组，光用 reply 回答她。\n"
      + "· 拿不准她想要什么就先问，别擅自动手。改人设尤其要谨慎——那是她攒了很久的东西。\n\n"
      + (mode === "diagnose"
        ? "【这一轮她在问「为什么没生效」】先看下面的现状快照，指出最可能卡在哪一步，说清怎么验证。\n"
          + "常见成因：文风存了但这一局没切过去（线下顶栏 STYLE 那条会显示「未设文风」）；"
          + "自定义文风与通用叙事准则冲突；模型不认可选字段（不吐 photo/thought 这类）；出图被上游审核拒。\n"
          + "诊断轮通常不需要 patch，除非改一处设置就能解决。\n\n"
        : "")
      + "【App 现状快照】\n" + JSON.stringify(snap, null, 1) + "\n\n"
      + "【输出】只输出 JSON，不要代码块：\n" + SHAPE;
  }

  async function ask(active, ctx, history, text, mode) {
    const msgs = (history || []).slice(-8).map(m => ({ role: m.role === "me" ? "user" : "assistant", content: String(m.text || "") }))
      .concat([{ role: "user", content: String(text || "") }]);
    const raw = await callAI(active, buildSystem(ctx, mode), msgs, { maxTokens: 4000, timeout: 120000 });
    const d = (typeof parseJSONLoose === "function" ? parseJSONLoose(raw) : extractJSON(raw)) || {};
    const patches = (Array.isArray(d.patches) ? d.patches : []).filter(x => x && TARGETS[x.target] && String(x.text || "").trim())
      .slice(0, 3)
      .map((x, i) => ({
        pid: "p" + Date.now() + "_" + i,
        target: x.target, id: String(x.id || "").trim(),
        title: clip(x.title, 60) || TARGETS[x.target].zh,
        name: clip(x.name, 30), text: String(x.text).trim(), why: clip(x.why, 200)
      }));
    const reply = String(d.reply || "").trim();
    if (!reply && !patches.length) throw new Error("没听懂它说什么，再问一次");
    return { reply: reply || "改动稿在下面。", patches };
  }

  // 应用一条改动稿。写入口全在 TARGETS 里，这里只做校验与分发。
  function apply(patch, ctx) {
    const T = TARGETS[patch.target];
    if (!T) throw new Error("不认识的改动类型");
    if (patch.target !== "style" && !patch.id) throw new Error("这条没说要改谁");
    return T.write(patch.id, patch, ctx);
  }

  // 改之前长什么样——界面要把改前改后并排摆出来
  function before(patch, ctx) {
    const T = TARGETS[patch.target];
    if (!T) return "";
    const rows = T.read(ctx) || [];
    const hit = rows.find(x => String(x.id) === String(patch.id));
    return hit ? String(hit.text || "") : "";
  }

  function labelOf(patch, ctx) {
    const T = TARGETS[patch.target];
    const rows = (T && T.read(ctx)) || [];
    const hit = rows.find(x => String(x.id) === String(patch.id));
    return (T ? T.zh : "?") + (hit ? " · " + hit.name : (patch.target === "style" ? " · 新建" : ""));
  }

  window.Assistant = { ask, apply, before, labelOf, snapshot, TARGETS };
})();

// ============================================================
// 界面：一问一答 + 改动稿卡片（改前/改后并排，逐条应用）
// ============================================================
(function () {
  const useState = React.useState, useRef = React.useRef, useEffect = React.useEffect;
  const A = window.Assistant;

  function AssistantApp(props) {
    const t = useTheme();
    const [msgs, setMsgs] = useState([]);          // {role:"me"|"it", text, patches?}
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [mode, setMode] = useState("chat");      // chat | diagnose
    const [done, setDone] = useState({});          // pid -> "已应用" | 错误原文
    const [open, setOpen] = useState({});          // pid -> 展开看全文
    const scroller = useRef(null);
    useEffect(() => { if (scroller.current) scroller.current.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [msgs.length, busy]);

    const send = async (preset) => {
      const text = String(preset || input).trim();
      if (!text || busy) return;
      if (!props.active) return props.toast("请先配置线下 API");
      setInput(""); setBusy(true);
      const hist = msgs.concat([{ role: "me", text }]);
      setMsgs(hist);
      try {
        const r = await A.ask(props.active, props, msgs, text, mode);
        setMsgs(h2 => h2.concat([{ role: "it", text: r.reply, patches: r.patches }]));
      } catch (e) {
        setMsgs(h2 => h2.concat([{ role: "it", text: "没答上来：" + (e.message || "重试"), patches: [] }]));
      } finally { setBusy(false); }
    };

    const applyOne = p => {
      try {
        const n = A.apply(p, props);
        setDone(d => ({ ...d, [p.pid]: "已应用" }));
        props.toast(p.target === "memory" ? "写进记忆库 " + n + " 条" : "改好了，下次生成生效");
      } catch (e) {
        setDone(d => ({ ...d, [p.pid]: "没应用：" + (e.message || "未知") }));
      }
    };

    const S = {
      wrap: { position: "relative", height: "100%", display: "flex", flexDirection: "column", background: t.bg },
      chip: on => ({ padding: "5px 11px", borderRadius: 999, border: "1px solid " + (on ? t.accent : t.line), background: on ? t.accent : "transparent", color: on ? "#fff" : t.sub, fontFamily: F_BODY, fontSize: 11.5 })
    };

    const patchCard = p => {
      const was = A.before(p, props);
      const state = done[p.pid];
      return h("div", { key: p.pid, style: { marginTop: 10, borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, overflow: "hidden" } },
        h("div", { style: { padding: "9px 12px", borderBottom: "1px solid " + t.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, letterSpacing: ".05em" } }, A.labelOf(p, props)),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.ink, marginTop: 2 } }, p.title),
          p.why ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginTop: 4, lineHeight: 1.6 } }, p.why) : null),
        h("div", { style: { padding: "10px 12px" } },
          was ? h("div", { style: { marginBottom: 8 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 3 } }, "改前"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.6, whiteSpace: "pre-wrap", textDecoration: "line-through", opacity: .75 } },
              open[p.pid] ? was : was.slice(0, 140) + (was.length > 140 ? "…" : ""))) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 3 } }, was ? "改后" : "新增"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, lineHeight: 1.7, whiteSpace: "pre-wrap" } },
            open[p.pid] ? p.text : p.text.slice(0, 220) + (p.text.length > 220 ? "…" : "")),
          (p.text.length > 220 || (was && was.length > 140))
            ? h("button", { onClick: () => setOpen(o => ({ ...o, [p.pid]: !o[p.pid] })), style: { marginTop: 6, background: "none", border: "none", padding: 0, fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, open[p.pid] ? "收起" : "看全文")
            : null),
        h("div", { style: { padding: "8px 12px 10px", borderTop: "1px solid " + t.line, display: "flex", alignItems: "center", gap: 10 } },
          state
            ? h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: state === "已应用" ? "#4a8b68" : "#a4442e" } }, state)
            : h(React.Fragment, null,
                h("button", { onClick: () => applyOne(p), style: { padding: "6px 14px", borderRadius: 9, border: "none", background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 12 } }, "应用这条"),
                h("button", { onClick: () => setDone(d => ({ ...d, [p.pid]: "跳过了" })), style: { background: "none", border: "none", fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "跳过"))));
    };

    const QUICK = mode === "diagnose"
      ? ["我设的文风好像没生效", "线下出图老是失败", "心声好久不更新了"]
      : ["帮我把现在的文风改得更克制一点", "照我贴的这段范文写一份文风预设", "帮我给某个角色改改人设"];

    return h("div", { style: S.wrap },
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid " + t.line } },
        h("button", { onClick: props.onBack, style: { background: "none", border: "none", color: t.ink, fontSize: 19, padding: "2px 6px" } }, "←"),
        h("div", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "帮手"),
        h("button", { onClick: () => setMode("chat"), style: S.chip(mode === "chat") }, "改东西"),
        h("button", { onClick: () => setMode("diagnose"), style: S.chip(mode === "diagnose") }, "查毛病")),
      h("div", { ref: scroller, style: { flex: 1, overflowY: "auto", padding: "14px 14px 20px" } },
        msgs.length === 0
          ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, lineHeight: 1.9, marginTop: 6 } },
              mode === "diagnose"
                ? "哪儿不对劲就问。它看得见你现在的角色、文风预设、线下设置和最近的报错，会告诉你卡在哪一步。"
                : "它能改四样东西：文风预设、角色人设、角色外貌、往记忆库里加条目。\n改之前一定先给你看改前改后，你点了「应用这条」才真的写进去。")
          : null,
        msgs.map((m, i) => m.role === "me"
          ? h("div", { key: i, style: { display: "flex", justifyContent: "flex-end", marginBottom: 12 } },
              h("div", { style: { maxWidth: "82%", padding: "8px 12px", borderRadius: 14, background: t.accent, color: "#fff", fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" } }, m.text))
          : h("div", { key: i, style: { marginBottom: 14 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, lineHeight: 1.8, whiteSpace: "pre-wrap" } }, m.text),
              (m.patches || []).map(patchCard))),
        busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "在想…") : null,
        !busy && msgs.length === 0
          ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 16 } },
              QUICK.map(q => h("button", { key: q, onClick: () => send(q), style: { padding: "7px 12px", borderRadius: 999, border: "1px dashed " + t.line, background: "transparent", color: t.sub, fontFamily: F_BODY, fontSize: 12 } }, q)))
          : null),
      h("div", { style: { display: "flex", gap: 8, padding: "10px 14px calc(env(safe-area-inset-bottom, 0px) + 12px)", borderTop: "1px solid " + t.line } },
        h("textarea", { value: input, onChange: e => setInput(e.target.value), rows: 1,
          placeholder: mode === "diagnose" ? "哪儿不对劲？" : "想改什么？也可以直接贴一段范文",
          style: { flex: 1, padding: "10px 13px", borderRadius: 14, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "none", outline: "none", maxHeight: 120 } }),
        h("button", { onClick: () => send(), disabled: busy, style: { padding: "8px 16px", borderRadius: 999, border: "none", background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13 } }, busy ? "…" : "问")));
  }
  window.AssistantApp = AssistantApp;
})();
