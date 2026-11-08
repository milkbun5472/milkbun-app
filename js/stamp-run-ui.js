// 远信的界面（她 2026-11-08）：开一趟 → 挑起手卡 → 路线图 → 一站一站走（打仗交给 StampDuelPage）→ 终点回信。
//   规则在 js/stamp-run.js。存档一把键 x_stampRun（每走一步存一次），回信存 x_stampRunLetters。
//   路上一直能跟同行的那个人聊（花调用，她发一句叫一次）。
(function () {
  "use strict";
  const { useState, useRef, useMemo } = React;
  const h = React.createElement;
  const RN = () => window.StampRun, D = () => window.StampDuel;
  const INK = "#2f2a22", SUB = "rgba(47,42,34,.6)", RED = "#b23a2e", GREEN = "#4f7a66", GOLD = "#b8862a", PAPER = "#fbf6ea";
  const AIR = "repeating-linear-gradient(135deg, #b23a2e 0 10px, #fbf6ea 10px 16px, #3f6fb0 16px 26px, #fbf6ea 26px 32px)";
  const RC = { R: "#5a5248", SR: "#3f6fb0", SSR: "#c8962e" };
  const fz = n => "calc(" + n + "px * var(--app-fs, 1))";
  const F = typeof F_BODY !== "undefined" ? F_BODY : "inherit", FD = typeof F_DISPLAY !== "undefined" ? F_DISPLAY : F;
  const SAVE = "x_stampRun", LETTERS = "x_stampRunLetters";
  const btn = (bg, fg, line) => ({ padding: "8px 14px", borderRadius: 4, background: bg, color: fg, border: line ? "1px solid " + line : "none", fontFamily: F, fontSize: fz(12.5) });
  const load = (k, d) => { try { return (typeof loadJSON === "function" ? loadJSON(k, d) : d) || d; } catch (e) { return d; } };
  const save = (k, v) => { try { typeof saveJSON === "function" && saveJSON(k, v); } catch (e) {} };

  // 一张小票（地图上的卡组、奖励三选一、邮局里）：卡名、作用、攻击血
  function Mini({ s, on, onTap, sub }) {
    return h("button", { "data-wk": "runcard", "data-on": on ? "1" : "0", onClick: onTap, className: "active:opacity-80 text-left",
      style: { width: "100%", padding: "7px 8px", borderRadius: 4, background: on ? "rgba(178,58,46,.08)" : "#fff", border: "1.5px solid " + (on ? RED : (RC[s.rarity] || RC.R) + "88"), fontFamily: F, color: INK } },
      h("div", { style: { fontSize: fz(9.5), color: RC[s.rarity] || RC.R, fontWeight: 700 } }, s.rarity + " · " + s.role + " · 面值 " + s.face),
      h("div", { style: { fontSize: fz(12), lineHeight: 1.3, margin: "2px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.name),
      h("div", { style: { fontSize: fz(10), color: SUB } }, "⚔" + s.pow + " ♥" + s.maxHp + " · " + s.trait + (sub ? " · " + sub : "")));
  }

  // 信匣里每一种往来叫什么（她 2026-11-08）
  const KIND_ZH = { letter: "回信", postcard: "明信片", note: "卡背面的便条", memory: "回忆卡", oneline: "一句话的回信", ask: "问答卡", future: "寄给以后的信", swap: "交换邮票时的话" };
  function StampRunPage(props) {
    const { characters, cards, onBack, meName, toast, closeOf, onChat, onPhoto } = props;
    const [run, setRun] = useState(() => { const v = load(SAVE, null); return v && v.run && !v.run.done ? v.run : null; });
    const [view, setView] = useState(() => { const v = load(SAVE, null); return v && v.run && !v.run.done ? (v.view || { at: "map" }) : { at: "start" }; });
    const [toId, setToId] = useState(() => { const c = (characters || []).find(x => (cards || []).some(k => k.charId === x.id)); return c ? c.id : ""; });
    const [core, setCore] = useState([]), [pickIdx, setPickIdx] = useState([]);
    const [withPick, setWithPick] = useState(""), [level, setLevel] = useState(1), [showDex, setShowDex] = useState(false);
    const POSTMARKS = "x_stampRunPostmarks", LEVELK = "x_stampRunLevel", DEX = "x_stampRunDex";
    const unlocked = Math.max(1, Number(load(LEVELK, 1)) || 1);
    const [chat, setChat] = useState(() => (load(SAVE, null) || {}).chat || []), [draft, setDraft] = useState(""), [busy, setBusy] = useState(false), [chatOpen, setChatOpen] = useState(false);
    const [, bump] = useState(0);
    const letters = load(LETTERS, []);
    // 一张卡的那一刻（写便条、回信时给 TA 看）
    const cardStory = s => { const c = (cards || []).find(x => x.id === (s && s.cardId)), tx = (c && c.text) || {};
      return "「" + ((s && s.name) || tx.name || "") + "」" + (s && s.charId && nameOf(s.charId) ? "（" + nameOf(s.charId) + "的卡）" : "") + "：" + [tx.gist, tx.narration, tx.open, tx.highlight, tx.thought ? "心里想：" + tx.thought : "", tx.line ? "说：" + tx.line : ""].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 220); };
    // 收进信匣：寄给以后的那封封着，下一趟出发时才拆
    const keepLetter = (kind, lines, extra) => { const L = load(LETTERS, []); L.push(Object.assign({ toId: run.toId, kind, text: (lines || []).join("\n"), ts: Date.now() }, extra || {})); save(LETTERS, L.slice(-120)); };
    const nameOf = id => { const c = (characters || []).find(x => x.id === id); return c ? (c.remark || c.name) : ""; };
    const toName = nameOf(run ? run.toId : toId) || "TA";
    // 陪你走的人（她 2026-11-08「可以」）：路上聊天、过站冒的话、路上的信都是 TA；明信片和寄给以后的信照旧是收信的人写
    const withId = run ? (run.withId || run.toId) : (withPick || toId), withName = nameOf(withId) || toName;
    // 图鉴：碰到过的信物、岔路、路上的麻烦（每走一步合一次）
    const dexMerge = r => { if (!r) return; const d = load(DEX, { relics: [], events: [], troubles: [] }), add = (k, xs) => { (xs || []).forEach(x => { if (x && !d[k].includes(x)) d[k].push(x); }); };
      add("relics", r.relics); add("events", r.evSeen); add("troubles", r.dexT); save(DEX, d); };
    // 一趟结束盖一枚纪念邮戳（送到的、退件的都留）；送到了解锁下一级
    const postmark = (r, win) => { if (!r || r.marked) return; r.marked = true;
      const P = load(POSTMARKS, []); P.push({ toId: r.toId, withId: r.withId, level: r.level || 1, win: !!win, ts: Date.now(), stations: r.log.length, chars: Array.from(new Set(r.deck.map(s => s.charId).filter(Boolean))) }); save(POSTMARKS, P.slice(-200));
      if (win) save(LEVELK, Math.max(unlocked, Math.min(RN().LEVEL_MAX, (r.level || 1) + 1))); dexMerge(r); };
    const bondsOf = () => { const m = {}; (characters || []).forEach(c => { m[c.id] = D().bondOf([c.persona, c.description, c.desc, c.personality].filter(Boolean).join(" ")); }); return m; };
    // 每动一步存一份
    const commit = (r, v, ch) => { const rr = r || run, vv = v || view; if (rr && rr.step) dexMerge(rr); save(SAVE, rr && !rr.done ? { run: rr, view: vv, chat: ch || chat } : null); setRun(rr ? Object.assign({}, rr) : rr); setView(vv); bump(x => x + 1); };
    const shell = kids => h("div", { "data-wk": "runpage", className: "h-full flex flex-col", style: { position: "relative", background: "repeating-linear-gradient(0deg, transparent 0 27px, rgba(47,42,34,.05) 27px 28px), linear-gradient(#f3ebdb, #e8dcc4)" } }, kids);
    const bar = () => run ? h("div", { "data-wk": "runbar", className: "flex items-center flex-wrap px-4", style: { gap: 10, padding: "4px 16px 8px", fontFamily: F, fontSize: fz(12), color: INK } },
      h("span", null, "✉ 信封 " + run.hp + "/" + run.max),
      h("span", null, "邮花 " + run.coins),
      h("span", null, "卡组 " + run.deck.length + " 张"),
      run.relics.length ? h("span", { style: { color: GOLD } }, "信物 " + run.relics.length) : null) : null;
    const relicRow = () => run && run.relics.length ? h("div", { "data-wk": "runrelics", className: "flex flex-wrap px-4", style: { gap: 5, marginBottom: 8 } }, run.relics.map(k => h("button", { key: k, onClick: () => toast && toast(k + "：" + D().RELICS[k]),
      style: { padding: "1px 8px", borderRadius: 999, border: "1px solid " + GOLD, color: GOLD, background: "rgba(184,134,42,.06)", fontSize: fz(11) } }, k))) : null;

    // ── 路上聊天：跟同行的那个人（终点就是 TA）──
    const talk = async () => {
      const text = draft.trim(); if (!text || busy || !onChat || !run) return;
      const ch = chat.concat({ who: "me", text }); setChat(ch); setDraft(""); setBusy(true); setChatOpen(true);
      try {
        const hist = ch.slice(-9, -1).map(m => (m.who === "me" ? (meName || "她") : withName) + "：" + m.text).join("\n");
        const lines = await onChat(withId, { mode: "road", text, toName, toId: run.toId, board: RN().summary(run, nameOf) + "；现在在第 " + ((run.pos ? run.pos.r : -1) + 2) + " 站前", history: hist });
        const ch2 = ch.concat((lines || []).map(x => ({ who: "foe", text: x }))); setChat(ch2); commit(run, view, ch2);
      } catch (e) { toast && toast("没聊成：" + ((e && e.message) || e)); }
      finally { setBusy(false); }
    };
    const chatBox = () => run && onChat ? h("div", { key: "chat", "data-wk": "runchat", className: "shrink-0 px-3", style: { paddingTop: 6, paddingBottom: "calc(6px + env(safe-area-inset-bottom) * 0.4)", borderTop: "1px solid rgba(47,42,34,.12)", background: "rgba(251,246,234,.85)", fontFamily: F, color: INK } },
      h("button", { onClick: () => setChatOpen(v => !v), className: "w-full text-left", style: { fontSize: fz(11.5), color: SUB, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } },
        (chatOpen ? "▾ " : "▸ ") + (chat.length ? (chat[chat.length - 1].who === "me" ? "我：" : withName + "：") + chat[chat.length - 1].text : "路上跟 " + withName + " 说两句（发一句花一次调用）")),
      chatOpen ? h("div", { style: { maxHeight: 150, overflowY: "auto", margin: "4px 0", display: "flex", flexDirection: "column", gap: 4 } },
        chat.slice(-12).map((m, k) => h("div", { key: k, style: { alignSelf: m.who === "me" ? "flex-end" : "flex-start", maxWidth: "80%", padding: "4px 9px", borderRadius: 10, background: m.who === "me" ? "rgba(79,122,102,.16)" : "#fff", fontSize: fz(12.5), lineHeight: 1.5 } }, m.text)),
        busy ? h("div", { style: { fontSize: fz(11), color: SUB } }, withName + " 在打字…") : null) : null,
      h("div", { className: "flex items-center", style: { gap: 6, padding: "4px 0" } },
        h("input", { "data-wk": "runchatinput", value: draft, onChange: e => setDraft(e.target.value), onKeyDown: e => { if (e.key === "Enter") talk(); }, placeholder: "边走边说…",
          style: { flex: 1, minWidth: 0, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(47,42,34,.25)", background: "#fff", fontSize: fz(12.5) } }),
        h("button", { onClick: talk, disabled: busy || !draft.trim(), className: "disabled:opacity-40", style: btn(INK, PAPER) }, "说"))) : null;
    // 过一站时同行的人冒一句卡上的话（不花调用）
    const companionLine = () => { const ls = (cards || []).filter(c => c.charId === withId && c.text).map(c => c.text.line || c.text.thought).filter(Boolean); return ls.length ? ls[(run.step * 7) % ls.length] : ""; };

    // ── 开一趟 ──
    if (view.at === "start" || !run) {
      const owned = (characters || []).filter(c => (cards || []).some(k => k.charId === c.id && k.text));
      return shell([
        h(Head, { key: "hd", zh: "远信", bg: "transparent", ink: INK, onBack }),
        h("div", { key: "bd", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingBottom: 24 } },
          h("div", { style: { fontSize: fz(12), color: SUB, lineHeight: 1.75, margin: "2px 0 14px" } }, "给一个人寄一封信。信要走六站：路上有暴雨、罢工的邮差、拦信的人，也有邮局和驿站。信封的血不会每场回满，打空了信就寄丢了。最后一站是 TA 本人——赢了，信送到，TA 会写一封回信给你。不花调用（路上聊天和回信除外）。"),
          h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 8 } }, "寄给谁"),
          h("div", { className: "flex flex-wrap", style: { gap: 8, marginBottom: 16 } }, owned.map(c => h("button", { key: c.id, "data-wk": "runto", "data-on": toId === c.id ? "1" : "0", onClick: () => setToId(c.id),
            style: { padding: "5px 12px", borderRadius: 999, border: "1px solid " + (toId === c.id ? RED : "rgba(47,42,34,.25)"), background: toId === c.id ? "rgba(178,58,46,.07)" : "rgba(255,255,255,.4)", color: toId === c.id ? RED : INK, fontSize: fz(12.5) } }, c.remark || c.name))),
          h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 4 } }, "谁陪你走"),
          h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 8 } }, "路上跟你聊天、写便条的人。不挑就是收信的人自己陪你走；挑了别人，终点 TA 也会知道是谁陪你来的。"),
          h("div", { className: "flex flex-wrap", style: { gap: 8, marginBottom: 16 } }, [{ id: "" }].concat(owned).map(c => { const on = (withPick || "") === (c.id || ""); return h("button", { key: c.id || "self", "data-wk": "runwith", "data-on": on ? "1" : "0", onClick: () => setWithPick(c.id || ""),
            style: { padding: "5px 11px", borderRadius: 999, border: "1px solid " + (on ? GOLD : "rgba(47,42,34,.25)"), background: on ? "rgba(184,134,42,.1)" : "rgba(255,255,255,.4)", color: on ? GOLD : INK, fontSize: fz(12.5) } }, c.id ? (c.remark || c.name) : "收信的人自己"); })),
          h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 4 } }, "邮路等级"),
          h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 8 } }, "送到一次解锁下一级：每一级起手的信封少 4，路上更凶，终点更硬。"),
          h("div", { className: "flex flex-wrap", style: { gap: 6, marginBottom: 16 } }, Array.from({ length: unlocked }, (_, k) => k + 1).map(lv => h("button", { key: lv, "data-wk": "runlevel", "data-on": level === lv ? "1" : "0", onClick: () => setLevel(lv),
            style: { width: 34, height: 34, borderRadius: 999, border: "1.5px solid " + (level === lv ? RED : "rgba(47,42,34,.25)"), background: level === lv ? RED : "transparent", color: level === lv ? "#fff" : INK, fontFamily: FD, fontSize: fz(13) } }, lv))),
          h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 4 } }, "带谁上路"),
          h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 8 } }, "最多两个人：起手发的牌多从他们那儿来。不挑就随机。"),
          h("div", { className: "flex flex-wrap", style: { gap: 8, marginBottom: 20 } }, owned.map(c => { const on = core.includes(c.id); return h("button", { key: c.id, onClick: () => setCore(p => on ? p.filter(x => x !== c.id) : p.concat(c.id).slice(-2)),
            style: { padding: "5px 11px", borderRadius: 999, border: "1px solid " + (on ? GREEN : "rgba(47,42,34,.25)"), background: on ? "rgba(79,122,102,.12)" : "rgba(255,255,255,.4)", color: on ? GREEN : INK, fontSize: fz(12.5) } }, c.remark || c.name); })),
          h("button", { "data-wk": "runstart", disabled: !toId, onClick: () => { const L0 = load(LETTERS, []); if (L0.some(x => x.sealed)) save(LETTERS, L0.map(x => x.sealed ? Object.assign({}, x, { sealed: false, opened: Date.now() }) : x)); const r = Object.assign(RN().newRun({ cards, toId, core, withId: withPick || toId, level: Math.min(level, unlocked) }), { bonds: bondsOf() }); setChat([]); setPickIdx([0, 1, 2, 3, 4, 5]); commit(r, { at: "pick" }, []); }, className: "w-full disabled:opacity-40", style: Object.assign(btn(RED, "#fff"), { padding: "12px 0", fontFamily: FD, fontSize: fz(15), letterSpacing: ".15em" }) }, "封好信，出发"),
          // 远信邮册：每一趟一枚纪念邮戳（她 2026-11-08）
          (() => { const P = load(POSTMARKS, []); if (!P.length) return null;
            return h("div", { "data-wk": "runpostmarks", style: { marginTop: 22 } },
              h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 4 } }, "远信邮册"),
              h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 10 } }, "寄出去的每一封都盖一枚戳：送到了是红的，退件是灰的。共 " + P.length + " 枚，送到 " + P.filter(x => x.win).length + " 封。"),
              h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 } }, P.slice().reverse().slice(0, 30).map((m, k) => {
                const c = m.win ? RED : "#8a8178", d = new Date(m.ts), tilt = ((m.ts / 1000) % 14) - 7;
                return h("div", { key: k, "data-wk": "runpostmark", "data-win": m.win ? "1" : "0", style: { aspectRatio: "1 / 1", borderRadius: 999, border: "2px solid " + c, outline: "1px solid " + c, outlineOffset: -6, color: c, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: "rotate(" + tilt + "deg)", fontFamily: F, background: "rgba(255,255,255,.35)", padding: 6, textAlign: "center" } },
                  h("div", { style: { fontSize: fz(9), letterSpacing: ".1em" } }, (d.getMonth() + 1) + "." + d.getDate()),
                  h("div", { style: { fontFamily: FD, fontSize: fz(13), lineHeight: 1.2, margin: "1px 0" } }, nameOf(m.toId) || "TA"),
                  h("div", { style: { fontSize: fz(8.5) } }, (m.win ? "送达" : "退件") + " · " + (m.level || 1) + " 级"),
                  m.withId && m.withId !== m.toId ? h("div", { style: { fontSize: fz(8) } }, nameOf(m.withId) + " 陪") : null);
              }))); })(),
          // 图鉴：信物、岔路、路上的麻烦，碰到过的才写出名字
          (() => { const d = load(DEX, { relics: [], events: [], troubles: [] }); const R0 = Object.keys(D().RELICS), E0 = RN().EVENTS, T0 = RN().TROUBLES;
            return h("div", { "data-wk": "rundex", style: { marginTop: 22 } },
              h("button", { onClick: () => setShowDex(v => !v), className: "w-full text-left", style: { fontFamily: FD, fontSize: fz(14), color: INK } }, (showDex ? "▾ " : "▸ ") + "图鉴 · 信物 " + d.relics.length + "/" + R0.length + " · 岔路 " + d.events.length + "/" + E0.length + " · 麻烦 " + d.troubles.length + "/" + T0.length),
              showDex ? h("div", { style: { marginTop: 8, fontSize: fz(12), lineHeight: 1.7 } },
                h("div", { style: { color: SUB, marginBottom: 2 } }, "信物"),
                h("div", { className: "flex flex-wrap", style: { gap: 5, marginBottom: 10 } }, R0.map(k => { const on = d.relics.includes(k); return h("button", { key: k, onClick: () => on && toast && toast(k + "：" + D().RELICS[k]), style: { padding: "1px 8px", borderRadius: 999, border: "1px " + (on ? "solid " + GOLD : "dashed rgba(47,42,34,.25)"), color: on ? GOLD : SUB } }, on ? k : "？？"); })),
                h("div", { style: { color: SUB, marginBottom: 2 } }, "岔路"),
                h("div", { className: "flex flex-wrap", style: { gap: 5, marginBottom: 10 } }, E0.map(e => { const on = d.events.includes(e.key); return h("span", { key: e.key, style: { padding: "1px 8px", borderRadius: 999, border: "1px " + (on ? "solid " + (e.letter ? RED : GREEN) : "dashed rgba(47,42,34,.25)"), color: on ? (e.letter ? RED : GREEN) : SUB } }, on ? e.zh.replace(/同行的人|TA/g, "TA") : "？？"); })),
                h("div", { style: { color: SUB, marginBottom: 2 } }, "路上的麻烦"),
                h("div", { className: "flex flex-wrap", style: { gap: 5 } }, T0.map(x => { const on = d.troubles.includes(x.key); return h("span", { key: x.key, style: { padding: "1px 8px", borderRadius: 999, border: "1px " + (on ? "solid " + INK : "dashed rgba(47,42,34,.25)"), color: on ? INK : SUB } }, on ? x.zh : "？？"); }))) : null); })(),
          letters.length ? h("div", { "data-wk": "runletters", style: { marginTop: 22 } },
            h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 8 } }, "信匣"),
            h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 8 } }, "一路上收到的明信片、便条、回信都在这儿。"),
            letters.slice().reverse().slice(0, 40).map((L, k) => h("details", { key: k, "data-wk": "runletterbox", "data-kind": L.kind || "letter", style: { marginBottom: 8, padding: "8px 11px", borderRadius: 4, background: PAPER, border: "1px solid rgba(47,42,34,.12)", borderLeft: "3px solid " + (L.kind === "future" ? GOLD : L.kind && L.kind !== "letter" ? GREEN : RED) } },
              h("summary", { style: { fontSize: fz(12.5), cursor: "pointer" } }, (nameOf(L.toId) || "TA") + " 的" + (KIND_ZH[L.kind || "letter"] || "信") + (L.title ? "：" + L.title : "") + " · " + new Date(L.ts).toLocaleDateString()),
              L.sealed ? h("div", { style: { marginTop: 6, fontSize: fz(12.5), color: SUB } }, "🔒 封着的。下一趟出发时才拆得开。")
                : h("div", { style: { marginTop: 6, fontFamily: FD, fontSize: fz(13), lineHeight: 1.85, whiteSpace: "pre-wrap" } }, L.img ? h("img", { src: typeof resolveImg === "function" ? resolveImg(L.img) : L.img, style: { display: "block", width: "100%", borderRadius: 4, marginBottom: 8 } }) : null, (L.q ? "问：" + L.q + "\n答：" + (L.a || "") + "\n\n" : L.mine ? "你写：" + L.mine + "\n\n" : "") + L.text)))) : null)]);
    }

    // ── 挑起手卡组 ──
    if (view.at === "pick") return shell([
      h(Head, { key: "hd", zh: "挑起手的票", bg: "transparent", ink: INK, onBack: () => commit(null, { at: "start" }) }),
      h("div", { key: "bd", className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, paddingBottom: 20 } },
        h("div", { style: { fontSize: fz(12), color: SUB, margin: "2px 0 10px" } }, "发了 8 张，挑 6 张带上路（点一下选上／去掉）。路上打赢了还能再拿。"),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } }, (run.offer || []).map((s, i) => h(Mini, { key: i, s, on: pickIdx.includes(i), sub: nameOf(s.charId), onTap: () => setPickIdx(p => p.includes(i) ? p.filter(x => x !== i) : p.length >= 6 ? p : p.concat(i)) }))),
        h("button", { "data-wk": "runpickgo", disabled: pickIdx.length < 4, onClick: () => { RN().takeStart(run, pickIdx); commit(run, { at: "map" }); }, className: "w-full disabled:opacity-40", style: Object.assign(btn(RED, "#fff"), { marginTop: 14, padding: "11px 0" }) }, "带这 " + pickIdx.length + " 张上路"))]);

    // ── 打仗：交给对局页 ──
    if (view.at === "battle") {
      const b = view.b;
      return h(window.StampDuelPage, Object.assign({}, props, { key: "rb" + run.step, onBack, runBattle: Object.assign({}, b, {
        meDeck: run.deck.map(x => Object.assign({}, x)), bonds: bondsOf(),
        foeName: b.foeName || nameOf(b.foeId) || "拦路的人",
        onQuit: () => { if (typeof requestAppConfirm === "function") requestAppConfirm("先离开这一站？", "回到地图，下次进来这一站从头打。", () => commit(run, { at: "map", redo: view.nd }), "离开"); else commit(run, { at: "map", redo: view.nd }); },
        onDone: st => {
          const nd = run.map[run.pos.r][run.pos.k], res = RN().afterBattle(run, st, nd, cards);
          if (res.won) { postmark(run, true); return commit(run, { at: "end", win: true }); }
          if (res.lost) { postmark(run, false); return commit(run, { at: "end", win: false }); }
          commit(run, { at: "reward", res });
        } }) }));
    }

    const go = k => {
      const nd = RN().enter(run, k); if (!nd) return;
      const line = companionLine();
      if (nd.type === "fight" || nd.type === "elite" || nd.type === "boss") return commit(run, { at: "battle", nd: { r: nd.r, k: nd.k }, b: RN().battleFor(run, nd, cards, closeOf, (characters || []).map(c => c.id)), line });
      if (nd.type === "event") return commit(run, { at: "event", ev: RN().eventFor(run).key, line });
      if (nd.type === "shop") return commit(run, { at: "shop", shop: RN().shopFor(run, cards), line });
      if (nd.type === "rest") return commit(run, { at: "rest", line });
    };
    // 从战斗里退出来的：再点同一站重打
    const redo = () => { const nd = run.map[view.redo.r][view.redo.k]; commit(run, { at: "battle", nd: view.redo, b: RN().battleFor(run, nd, cards, closeOf, (characters || []).map(c => c.id)) }); };
    const page = (title, kids, opts) => shell([
      h(Head, { key: "hd", zh: title, sub: "寄给 " + toName, bg: "transparent", ink: INK, onBack: () => commit(run, view, chat) || onBack() }),
      h("div", { key: "bar" }, bar(), relicRow()),
      h("div", { key: "bd", className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, paddingBottom: 16 } },
        view.line ? h("div", { "data-wk": "runsay", style: { margin: "0 0 10px", padding: "6px 11px", borderRadius: "4px 12px 12px 12px", background: "#fff", fontSize: fz(12.5), lineHeight: 1.55, boxShadow: "0 1px 4px rgba(47,42,34,.12)" } }, h("span", { style: { color: RED, fontFamily: FD, marginRight: 6 } }, toName), view.line) : null,
        kids),
      chatBox()]);

    // ── 地图 ──
    if (view.at === "map") {
      const can = RN().reachable(run), cur = run.pos;
      return page("远信 · 路线", [
        view.redo ? h("button", { key: "redo", onClick: redo, className: "w-full", style: Object.assign(btn(RED, "#fff"), { marginBottom: 10 }) }, "回到刚才那一站，重新打") : null,
        h("div", { key: "map", "data-wk": "runmap", style: { padding: 6, borderRadius: 6, background: AIR } },
          h("div", { style: { padding: "12px 10px", borderRadius: 3, background: PAPER } },
            run.map.map((row, r) => h("div", { key: r, className: "flex justify-around items-center", style: { margin: "6px 0", position: "relative" } },
              h("span", { style: { position: "absolute", left: 0, fontSize: fz(9.5), color: SUB } }, "第" + (r + 1) + "站"),
              row.map(nd => {
                const here = cur && cur.r === r && cur.k === nd.k, open = !view.redo && ((!cur && r === 0) || (cur && r === cur.r + 1)) && can.includes(nd.k), seen = run.seen[r + ":" + nd.k];
                const meta = RN().NODE[nd.type], col = nd.type === "boss" ? RED : nd.type === "elite" ? GOLD : nd.type === "shop" || nd.type === "rest" ? GREEN : INK;
                return h("button", { key: nd.k, "data-wk": "runnode", "data-type": nd.type, "data-open": open ? "1" : "0", disabled: !open, onClick: () => go(nd.k),
                  style: { width: 58, padding: "6px 0 4px", borderRadius: 6, textAlign: "center", fontFamily: F, background: here ? col : open ? "#fff" : "rgba(255,255,255,.35)", color: here ? "#fff" : col,
                    border: "1.5px " + (open ? "solid" : "dashed") + " " + col + (open || here ? "" : "55"), opacity: !open && !here && !seen ? 0.55 : 1, boxShadow: open ? "0 2px 6px rgba(47,42,34,.2)" : "none", transform: open ? "translateY(-1px)" : "none" } },
                  h("div", { style: { fontFamily: FD, fontSize: fz(16), lineHeight: 1.1 } }, nd.type === "boss" ? "♥" : meta.icon),
                  h("div", { style: { fontSize: fz(9.5) } }, nd.type === "boss" ? toName : meta.zh));
              }))))),
        h("div", { key: "tip", style: { fontSize: fz(11), color: SUB, marginTop: 8, lineHeight: 1.7 } }, "亮着的是下一站能去的。✉ 普通站打路上的麻烦；✦ 难站是别的角色来拦信，赢了掉信物；? 岔路；邮 邮局买东西；☕ 驿站歇脚；♥ 终点是 TA。"),
        h("div", { key: "deck", style: { marginTop: 12 } }, h("div", { style: { fontFamily: FD, fontSize: fz(13), marginBottom: 6 } }, "带着的票"),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 } }, run.deck.map((s, i) => h(Mini, { key: i, s, sub: nameOf(s.charId), onTap: () => toast && toast(s.name + "：" + s.role + " · 特质「" + s.trait + "」· 盖章「" + s.skill + "」") })))),
        h("button", { key: "quit", onClick: () => { const q = () => { save(SAVE, null); setRun(null); setView({ at: "start" }); }; typeof requestAppConfirm === "function" ? requestAppConfirm("放弃这一趟？", "信就不寄了，回到开头。", q, "放弃") : q(); }, style: { marginTop: 16, fontSize: fz(11.5), color: SUB, textDecoration: "underline" } }, "放弃这一趟")]);
    }

    // ── 打完一站：三选一 ──
    if (view.at === "reward") {
      const res = view.res || {};
      return page("赢了这一站", [
        h("div", { key: "t", style: { fontSize: fz(13), margin: "4px 0 10px" } }, "拿到 " + (res.coins || 0) + " 枚邮花。" + (res.relic ? "还捡到一件信物「" + res.relic + "」：" + D().RELICS[res.relic] + "。" : "")),
        h("div", { key: "s", style: { fontFamily: FD, fontSize: fz(13), marginBottom: 6 } }, "挑一张加进卡组"),
        h("div", { key: "g", style: { display: "grid", gridTemplateColumns: "1fr", gap: 6 } }, (res.offer || []).map((s, i) => h(Mini, { key: i, s, sub: nameOf(s.charId), onTap: () => { run.deck.push(s); commit(run, { at: "map" }); } }))),
        h("button", { key: "skip", onClick: () => commit(run, { at: "map" }), style: Object.assign(btn("transparent", INK, "rgba(47,42,34,.3)"), { marginTop: 10, width: "100%" }) }, "都不要，接着走")]);
    }
    // ── 信的事件：叫 TA 写一张，写完给奖励、收进信匣 ──
    const letterEvent = (ev, who) => {
      const wr = ev.letter === "postcard" || ev.letter === "future" ? toName : withName;   // 这一张谁写
      const lv = view.lv || {}, set = p => commit(run, Object.assign({}, view, { lv: Object.assign({}, lv, p) }));
      const call = async (mode, extra, after) => {
        if (busy || !onChat) return; setBusy(true);
        try {
          const writer = mode === "postcard" || mode === "future" ? run.toId : withId;
          const lines = await onChat(writer, Object.assign({ mode, text: "", toName, toId: run.toId, withName: withId !== run.toId ? withName : "", board: RN().summary(run, nameOf), history: chat.slice(-6).map(m => (m.who === "me" ? (meName || "她") : toName) + "：" + m.text).join("\n") }, extra || {}));
          if (!lines || !lines.length) { toast && toast(wr + " 没写出来，再点一次试试"); return; }
          after(lines);
        } catch (e) { toast && toast("没写成：" + ((e && e.message) || e)); }
        finally { setBusy(false); }
      };
      const finish = (lines, i, extra) => { keepLetter(ev.letter, lines, Object.assign({ sealed: ev.letter === "future" }, extra || {})); const msg = RN().letterReward(run, ev.letter, i); commit(run, Object.assign({}, view, { lv: Object.assign({}, lv, { lines, done: msg }) })); };
      const paper = (lines, sealed) => h("div", { key: "paper", "data-wk": "runpostcard", "data-kind": ev.letter, style: { position: "relative", margin: "4px 0 12px", padding: "16px 16px 14px", borderRadius: 4, background: PAPER, border: "1px solid rgba(47,42,34,.15)", boxShadow: "0 4px 14px rgba(47,42,34,.15)", fontFamily: FD, fontSize: fz(13.5), lineHeight: 1.9, whiteSpace: "pre-wrap", transform: "rotate(-.6deg)" } },
        h("div", { style: { height: 5, margin: "-16px -16px 12px", background: AIR } }),
        h("div", { style: { position: "absolute", right: 12, top: 14, width: 36, height: 36, borderRadius: 999, border: "1.5px dashed " + RED, color: RED, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F, fontSize: fz(9.5), transform: "rotate(-10deg)" } }, KIND_ZH[ev.letter] ? KIND_ZH[ev.letter].slice(0, 2) : "信"),
        sealed ? "🔒 封好了。下一趟出发时才拆得开。" : lines.join("\n"));
      const btnBig = (label, fn, dis) => h("button", { key: "b" + label, "data-wk": "runlettergo", onClick: fn, disabled: busy || dis, className: "w-full disabled:opacity-50", style: Object.assign(btn(RED, "#fff"), { padding: "11px 0", marginBottom: 8 }) }, busy ? wr + " 在写…" : label);
      const cost = ev.cost || 0;
      // 明信片配照片（花一次生图）：照明信片上写的画一张 TA 在驿站等信的照片
      const photo = async () => {
        if (busy || !onPhoto) return; setBusy(true);
        try { const ref = await onPhoto(run.toId, "在驿站等信的时候拍给她的一张照片，像寄来的明信片正面。明信片背面写着：" + (lv.lines || []).join(" ").slice(0, 200));
          const L = load(LETTERS, []); for (let k = L.length - 1; k >= 0; k--) if (L[k].kind === "postcard" && L[k].toId === run.toId) { L[k] = Object.assign({}, L[k], { img: ref }); break; } save(LETTERS, L);
          set({ img: ref }); }
        catch (e) { toast && toast("照片没拍成：" + ((e && e.message) || e)); }
        finally { setBusy(false); }
      };
      const imgUrl = r => typeof resolveImg === "function" ? resolveImg(r) : r;
      const body = lv.done ? [lv.img ? h("img", { key: "img", "data-wk": "runpostcardimg", src: imgUrl(lv.img), style: { display: "block", width: "100%", borderRadius: 4, border: "6px solid #fff", boxShadow: "0 4px 14px rgba(47,42,34,.2)", marginBottom: 10, transform: "rotate(.8deg)" } }) : null,
          paper(lv.lines, ev.letter === "future"),
          ev.letter === "postcard" && onPhoto && !lv.img ? h("button", { key: "ph", "data-wk": "runpostcardphoto", onClick: photo, disabled: busy, className: "w-full disabled:opacity-50", style: Object.assign(btn("transparent", INK, "rgba(47,42,34,.35)"), { marginBottom: 8 }) }, busy ? "在拍…" : "翻到正面看看照片（花一次生图）") : null,
          h("div", { key: "rw", style: { fontSize: fz(12.5), color: GREEN, marginBottom: 10 } }, lv.done), h("button", { key: "go", onClick: () => commit(run, { at: "map" }), className: "w-full", style: btn(INK, PAPER) }, "收好，接着走")]
        : ev.letter === "postcard" ? [btnBig("翻过来看", () => call("postcard", {}, l => finish(l)))]
        : ev.letter === "memory" ? [btnBig("投一枚邮花（" + cost + "）", () => { if (run.coins < cost) return toast && toast("邮花不够"); run.coins -= cost; call("memory", {}, l => finish(l)); })]
        : ev.letter === "future" ? [btnBig("让 " + wr + " 写", () => call("future", {}, l => finish(l)))]
        : ev.letter === "oneline" ? [h("textarea", { key: "in", value: draft, onChange: e => setDraft(e.target.value), placeholder: "写一句给 " + wr + "…", rows: 2, style: { width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid rgba(47,42,34,.25)", background: "#fff", fontSize: fz(13), marginBottom: 8 } }),
            btnBig("寄出去", () => { const t0 = draft.trim(); if (!t0) return; call("oneline", { text: t0 }, l => { setDraft(""); finish(l, 0, { mine: t0 }); }); }, !draft.trim())]
        : ev.letter === "ask" ? (lv.q ? [paper([lv.q]), h("textarea", { key: "in", value: draft, onChange: e => setDraft(e.target.value), placeholder: "回答 " + wr + "…", rows: 3, style: { width: "100%", padding: "8px 10px", borderRadius: 4, border: "1px solid rgba(47,42,34,.25)", background: "#fff", fontSize: fz(13), marginBottom: 8 } }),
              btnBig("把回答寄回去", () => { const a = draft.trim(); if (!a) return; call("answer", { text: a, question: lv.q }, l => { setDraft(""); finish(l, 0, { q: lv.q, a }); }); }, !draft.trim())]
            : [btnBig("拆开卡片", () => call("ask", {}, l => set({ q: l.join(" ") })))])
        : (ev.letter === "note" || ev.letter === "swap") ? [h("div", { key: "t", style: { fontSize: fz(12), color: SUB, marginBottom: 6 } }, ev.letter === "note" ? "挑一张，让 " + wr + " 在背面写几句：" : wr + " 想要走哪一张？你挑一张给 TA（送出去就不在卡组里了）："),
            busy ? h("div", { key: "w", style: { fontSize: fz(12.5), color: SUB, margin: "10px 0" } }, wr + " 在写…") : null,
            h("div", { key: "g", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 } }, run.deck.map((s2, i) => h(Mini, { key: i, s: s2, sub: nameOf(s2.charId), onTap: () => { if (busy) return; if (ev.letter === "swap" && run.deck.length <= 4) return toast && toast("卡组只剩 4 张了"); call(ev.letter, { card: cardStory(s2) }, l => finish(l, i, { title: s2.name })); } })))]
        : [];
      return page("岔路 · " + who(ev.zh), [
        h("div", { key: "say", style: { fontFamily: FD, fontSize: fz(14), lineHeight: 1.8, margin: "4px 0 6px" } }, who(ev.say)),
        h("div", { key: "rwd", style: { fontSize: fz(11.5), color: SUB, marginBottom: 12 } }, "花一次调用 · 写完" + (ev.reward ? "：" + ev.reward : "")),
        ...body,
        !lv.done ? h("button", { key: "skip", onClick: () => commit(run, { at: "map" }), style: { marginTop: 6, fontSize: fz(11.5), color: SUB, textDecoration: "underline" } }, "不了，接着走") : null]);
    };
    // ── 岔路 ──
    if (view.at === "event") {
      const ev = RN().EVENTS.find(e => e.key === view.ev) || RN().EVENTS[0];
      const who = t => String(t).replace(/同行的人|TA/g, ev.letter === "postcard" || ev.letter === "future" ? toName : withName);
      if (ev.letter) return letterEvent(ev, who);
      return page("岔路 · " + who(ev.zh), [
        h("div", { key: "say", style: { fontFamily: FD, fontSize: fz(14), lineHeight: 1.8, margin: "4px 0 14px" } }, who(ev.say)),
        view.result ? h("div", { key: "res" }, h("div", { style: { padding: "9px 12px", borderRadius: 4, background: "#fff", fontSize: fz(13), marginBottom: 10 } }, view.result),
            h("button", { onClick: () => commit(run, { at: "map" }), className: "w-full", style: btn(INK, PAPER) }, "接着走"))
          : ev.opts.map((op, i) => h("button", { key: i, "data-wk": "runeventopt", onClick: () => { const msg = RN().doEvent(run, ev, i, cards); commit(run, Object.assign({}, view, { result: msg })); }, className: "w-full text-left", style: Object.assign(btn("#fff", INK, "rgba(47,42,34,.25)"), { marginBottom: 8, display: "block" }) }, who(op.zh)))]);
    }
    // ── 邮局 ──
    if (view.at === "shop") {
      const sh = view.shop, buy = (w, i) => { const r = RN().buy(run, sh, w, i); if (!r.ok) toast && toast(r.why); commit(run, Object.assign({}, view)); };
      const price = k => RN().priceOf(run, k);
      return page("邮局", [
        h("div", { key: "a", style: { fontFamily: FD, fontSize: fz(13), margin: "4px 0 6px" } }, "买票（" + price("card") + " 邮花）"),
        h("div", { key: "b", style: { display: "grid", gridTemplateColumns: "1fr", gap: 6 } }, sh.cards.map((s, i) => h(Mini, { key: i, s, on: sh.sold["card" + i], sub: sh.sold["card" + i] ? "已买" : nameOf(s.charId), onTap: () => buy("card", i) }))),
        h("div", { key: "c", style: { fontFamily: FD, fontSize: fz(13), margin: "12px 0 6px" } }, "信物（" + price("relic") + " 邮花）"),
        sh.relics.map((k, i) => h("button", { key: "r" + i, "data-wk": "runrelicbuy", onClick: () => buy("relic", i), disabled: !!sh.sold["relic" + i], className: "w-full text-left disabled:opacity-50", style: Object.assign(btn("#fff", INK, GOLD), { marginBottom: 6, display: "block" }) }, h("b", { style: { color: GOLD } }, k), "：" + D().RELICS[k] + (sh.sold["relic" + i] ? "（已买）" : ""))),
        h("div", { key: "d", style: { fontFamily: FD, fontSize: fz(13), margin: "12px 0 6px" } }, "删一张票（" + price("remove") + " 邮花，点要删的那张）"),
        h("div", { key: "e", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 } }, run.deck.map((s, i) => h(Mini, { key: i, s, onTap: () => buy("remove", i) }))),
        h("button", { key: "f", onClick: () => buy("heal", 0), className: "w-full", style: Object.assign(btn("#fff", GREEN, GREEN), { marginTop: 12 }) }, "补信封 +15（" + price("heal") + " 邮花）"),
        h("button", { key: "g", onClick: () => commit(run, { at: "map" }), className: "w-full", style: Object.assign(btn(INK, PAPER), { marginTop: 10 }) }, "离开邮局")]);
    }
    // ── 驿站 ──
    if (view.at === "rest") {
      return page("驿站", [
        view.result ? h("div", { key: "r" }, h("div", { style: { padding: "9px 12px", borderRadius: 4, background: "#fff", fontSize: fz(13), marginBottom: 10 } }, view.result), h("button", { onClick: () => commit(run, { at: "map" }), className: "w-full", style: btn(INK, PAPER) }, "接着走"))
          : h("div", { key: "c" },
            h("button", { "data-wk": "runrestheal", onClick: () => commit(run, Object.assign({}, view, { result: RN().rest(run, "heal") })), className: "w-full", style: Object.assign(btn(GREEN, "#fff"), { marginBottom: 10 }) }, "歇一会儿（信封回三成）"),
            h("div", { style: { fontSize: fz(12), color: SUB, marginBottom: 6 } }, "或者挑一张升阶（攻击 +2、血 +3、章少攒一格）："),
            h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 } }, run.deck.map((s, i) => h(Mini, { key: i, s, onTap: () => commit(run, Object.assign({}, view, { result: RN().rest(run, "up", i) })) }))))]);
    }
    // ── 终点：回信 / 寄丢 ──
    if (view.at === "end") {
      const win = view.win;
      const ask = async () => {
        if (!onChat || busy) return; setBusy(true);
        try {
          const lines = await onChat(run.toId, { mode: "letter", text: "", withName: run.withId && run.withId !== run.toId ? withName : "", cards: run.deck.map(cardStory).join("\n"), board: RN().summary(run, nameOf), history: chat.slice(-8).map(m => (m.who === "me" ? (meName || "她") : toName) + "：" + m.text).join("\n") });
          const text = (lines || []).join("\n");
          if (text) { keepLetter("letter", lines); commit(Object.assign(run, { letter: text }), view); }
        } catch (e) { toast && toast("回信没写成：" + ((e && e.message) || e)); }
        finally { setBusy(false); }
      };
      return shell([
        h(Head, { key: "hd", zh: win ? "信送到了" : "信寄丢了", bg: "transparent", ink: INK, onBack: () => { save(SAVE, null); setRun(null); setView({ at: "start" }); } }),
        h("div", { key: "bd", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingBottom: 24 } },
          h("div", { style: { fontSize: fz(12.5), color: SUB, lineHeight: 1.8, margin: "6px 0 14px" } }, win ? "走完了 " + run.log.length + " 站，信封还剩 " + run.hp + "。" + toName + " 拆开了你的信。" : "走到第 " + ((run.done && run.done.at) + 1) + " 站，信封被打空了。这封信没能送到 " + toName + " 手里。"),
          win ? (run.letter ? h("div", { "data-wk": "runletter", style: { padding: "18px 18px 16px", borderRadius: 4, background: PAPER, border: "1px solid rgba(47,42,34,.15)", boxShadow: "0 4px 14px rgba(47,42,34,.15)", fontFamily: FD, fontSize: fz(13.5), lineHeight: 1.95, whiteSpace: "pre-wrap" } },
                h("div", { style: { height: 5, margin: "-18px -18px 14px", background: AIR } }), run.letter)
              : h("button", { "data-wk": "runletterask", onClick: ask, disabled: busy, className: "w-full disabled:opacity-50", style: Object.assign(btn(RED, "#fff"), { padding: "12px 0", fontFamily: FD, fontSize: fz(14) }) }, busy ? toName + " 在写回信…" : "拆开 " + toName + " 的回信（花一次调用）")) : null,
          h("button", { onClick: () => { save(SAVE, null); setRun(null); setView({ at: "start" }); }, className: "w-full", style: Object.assign(btn("transparent", INK, INK), { marginTop: 16 }) }, "再寄一封"))]);
    }
    return shell([h(Head, { key: "hd", zh: "远信", bg: "transparent", ink: INK, onBack })]);
  }
  window.StampRunPage = StampRunPage;
})();
