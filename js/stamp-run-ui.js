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

  function StampRunPage(props) {
    const { characters, cards, onBack, meName, toast, closeOf, onChat } = props;
    const [run, setRun] = useState(() => { const v = load(SAVE, null); return v && v.run && !v.run.done ? v.run : null; });
    const [view, setView] = useState(() => { const v = load(SAVE, null); return v && v.run && !v.run.done ? (v.view || { at: "map" }) : { at: "start" }; });
    const [toId, setToId] = useState(() => { const c = (characters || []).find(x => (cards || []).some(k => k.charId === x.id)); return c ? c.id : ""; });
    const [core, setCore] = useState([]), [pickIdx, setPickIdx] = useState([]);
    const [chat, setChat] = useState(() => (load(SAVE, null) || {}).chat || []), [draft, setDraft] = useState(""), [busy, setBusy] = useState(false), [chatOpen, setChatOpen] = useState(false);
    const [, bump] = useState(0);
    const letters = load(LETTERS, []);
    const nameOf = id => { const c = (characters || []).find(x => x.id === id); return c ? (c.remark || c.name) : ""; };
    const toName = nameOf(run ? run.toId : toId) || "TA";
    const bondsOf = () => { const m = {}; (characters || []).forEach(c => { m[c.id] = D().bondOf([c.persona, c.description, c.desc, c.personality].filter(Boolean).join(" ")); }); return m; };
    // 每动一步存一份
    const commit = (r, v, ch) => { const rr = r || run, vv = v || view; save(SAVE, rr && !rr.done ? { run: rr, view: vv, chat: ch || chat } : null); setRun(rr ? Object.assign({}, rr) : rr); setView(vv); bump(x => x + 1); };
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
        const hist = ch.slice(-9, -1).map(m => (m.who === "me" ? (meName || "她") : toName) + "：" + m.text).join("\n");
        const lines = await onChat(run.toId, { mode: "road", text, board: RN().summary(run, nameOf) + "；现在在第 " + ((run.pos ? run.pos.r : -1) + 2) + " 站前", history: hist });
        const ch2 = ch.concat((lines || []).map(x => ({ who: "foe", text: x }))); setChat(ch2); commit(run, view, ch2);
      } catch (e) { toast && toast("没聊成：" + ((e && e.message) || e)); }
      finally { setBusy(false); }
    };
    const chatBox = () => run && onChat ? h("div", { key: "chat", "data-wk": "runchat", className: "shrink-0 px-3", style: { paddingTop: 6, paddingBottom: "calc(6px + env(safe-area-inset-bottom) * 0.4)", borderTop: "1px solid rgba(47,42,34,.12)", background: "rgba(251,246,234,.85)", fontFamily: F, color: INK } },
      h("button", { onClick: () => setChatOpen(v => !v), className: "w-full text-left", style: { fontSize: fz(11.5), color: SUB, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } },
        (chatOpen ? "▾ " : "▸ ") + (chat.length ? (chat[chat.length - 1].who === "me" ? "我：" : toName + "：") + chat[chat.length - 1].text : "路上跟 " + toName + " 说两句（发一句花一次调用）")),
      chatOpen ? h("div", { style: { maxHeight: 150, overflowY: "auto", margin: "4px 0", display: "flex", flexDirection: "column", gap: 4 } },
        chat.slice(-12).map((m, k) => h("div", { key: k, style: { alignSelf: m.who === "me" ? "flex-end" : "flex-start", maxWidth: "80%", padding: "4px 9px", borderRadius: 10, background: m.who === "me" ? "rgba(79,122,102,.16)" : "#fff", fontSize: fz(12.5), lineHeight: 1.5 } }, m.text)),
        busy ? h("div", { style: { fontSize: fz(11), color: SUB } }, toName + " 在打字…") : null) : null,
      h("div", { className: "flex items-center", style: { gap: 6, padding: "4px 0" } },
        h("input", { "data-wk": "runchatinput", value: draft, onChange: e => setDraft(e.target.value), onKeyDown: e => { if (e.key === "Enter") talk(); }, placeholder: "边走边说…",
          style: { flex: 1, minWidth: 0, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(47,42,34,.25)", background: "#fff", fontSize: fz(12.5) } }),
        h("button", { onClick: talk, disabled: busy || !draft.trim(), className: "disabled:opacity-40", style: btn(INK, PAPER) }, "说"))) : null;
    // 过一站时同行的人冒一句卡上的话（不花调用）
    const companionLine = () => { const ls = (cards || []).filter(c => c.charId === run.toId && c.text).map(c => c.text.line || c.text.thought).filter(Boolean); return ls.length ? ls[(run.step * 7) % ls.length] : ""; };

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
          h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 4 } }, "带谁上路"),
          h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 8 } }, "最多两个人：起手发的牌多从他们那儿来。不挑就随机。"),
          h("div", { className: "flex flex-wrap", style: { gap: 8, marginBottom: 20 } }, owned.map(c => { const on = core.includes(c.id); return h("button", { key: c.id, onClick: () => setCore(p => on ? p.filter(x => x !== c.id) : p.concat(c.id).slice(-2)),
            style: { padding: "5px 11px", borderRadius: 999, border: "1px solid " + (on ? GREEN : "rgba(47,42,34,.25)"), background: on ? "rgba(79,122,102,.12)" : "rgba(255,255,255,.4)", color: on ? GREEN : INK, fontSize: fz(12.5) } }, c.remark || c.name); })),
          h("button", { "data-wk": "runstart", disabled: !toId, onClick: () => { const r = RN().newRun({ cards, toId, core }); setChat([]); setPickIdx([0, 1, 2, 3, 4, 5]); commit(r, { at: "pick" }, []); }, className: "w-full disabled:opacity-40", style: Object.assign(btn(RED, "#fff"), { padding: "12px 0", fontFamily: FD, fontSize: fz(15), letterSpacing: ".15em" }) }, "封好信，出发"),
          letters.length ? h("div", { "data-wk": "runletters", style: { marginTop: 22 } },
            h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 8 } }, "收到的回信"),
            letters.slice().reverse().slice(0, 10).map((L, k) => h("details", { key: k, style: { marginBottom: 8, padding: "8px 11px", borderRadius: 4, background: PAPER, border: "1px solid rgba(47,42,34,.12)" } },
              h("summary", { style: { fontSize: fz(12.5), cursor: "pointer" } }, (nameOf(L.toId) || "TA") + " 的回信 · " + new Date(L.ts).toLocaleDateString()),
              h("div", { style: { marginTop: 6, fontFamily: FD, fontSize: fz(13), lineHeight: 1.85, whiteSpace: "pre-wrap" } }, L.text)))) : null)]);
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
          if (res.won) return commit(run, { at: "end", win: true });
          if (res.lost) return commit(run, { at: "end", win: false });
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
    // ── 岔路 ──
    if (view.at === "event") {
      const ev = RN().EVENTS.find(e => e.key === view.ev) || RN().EVENTS[0];
      return page("岔路 · " + ev.zh, [
        h("div", { key: "say", style: { fontFamily: FD, fontSize: fz(14), lineHeight: 1.8, margin: "4px 0 14px" } }, ev.say),
        view.result ? h("div", { key: "res" }, h("div", { style: { padding: "9px 12px", borderRadius: 4, background: "#fff", fontSize: fz(13), marginBottom: 10 } }, view.result),
            h("button", { onClick: () => commit(run, { at: "map" }), className: "w-full", style: btn(INK, PAPER) }, "接着走"))
          : ev.opts.map((op, i) => h("button", { key: i, "data-wk": "runeventopt", onClick: () => { const msg = RN().doEvent(run, ev, i, cards); commit(run, Object.assign({}, view, { result: msg })); }, className: "w-full text-left", style: Object.assign(btn("#fff", INK, "rgba(47,42,34,.25)"), { marginBottom: 8, display: "block" }) }, op.zh))]);
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
          const lines = await onChat(run.toId, { mode: "letter", text: "", board: RN().summary(run, nameOf), history: chat.slice(-8).map(m => (m.who === "me" ? (meName || "她") : toName) + "：" + m.text).join("\n") });
          const text = (lines || []).join("\n");
          if (text) { const L = load(LETTERS, []); L.push({ toId: run.toId, text, ts: Date.now() }); save(LETTERS, L.slice(-50)); commit(Object.assign(run, { letter: text }), view); }
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
