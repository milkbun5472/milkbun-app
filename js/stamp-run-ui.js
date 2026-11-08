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
  // 页面装修（她 2026-11-08「页面能不能做好看点」）：小票做成一枚齿孔邮票，上头一条作用色带
  const ROLE_C = { 投递: "#b23a2e", 火漆: "#8a3a4a", 补票: "#4f7a66", 集邮: "#3f6fb0", 邮戳: "#6a4f8a" };
  const PERF = "radial-gradient(circle at 4px 4px, transparent 2.6px, #fbf6ea 2.8px) -4px -4px / 7px 7px";
  // 小票上放卡面（她 2026-11-08「能不能有图显示」）：缩略图走邮票册那份 useThumb（StampRunPage 每次渲染时把它和卡挂到这两个变量上）
  let curThumb = null, curCards = [], curInfo = null;
  const noPress = (a, onTap) => ({ onClick: onTap });
  const noThumb = () => [null, { current: null }];
  function Mini({ s, on, onTap, sub }) {
    const rc = ROLE_C[s.role] || INK, card = s.cardId ? curCards.find(c => c && c.id === s.cardId) : null;
    const [url, el] = (curThumb || noThumb)(card ? (card.cover || card.face) : null);
    // 长按看底细（跟对局那张同一份）；点一下照旧是选上／去掉
    const show = curInfo, press = (window.StampLongPress || noPress)(show ? () => show(s) : null, onTap);
    return h("button", Object.assign({ ref: el, "data-wk": "runcard", "data-on": on ? "1" : "0" }, press, { className: "active:scale-[.98] text-left",
      style: { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none", width: "100%", minWidth: 0, display: "block", padding: 4, background: PERF, border: "none", filter: on ? "drop-shadow(0 0 0 " + RED + ") drop-shadow(0 3px 6px rgba(178,58,46,.35))" : "drop-shadow(0 2px 3px rgba(47,42,34,.18))", fontFamily: F, color: INK, transform: on ? "translateY(-2px)" : "none", transition: "transform .15s" } }),
      h("div", { style: { position: "relative", borderRadius: 2, overflow: "hidden", background: on ? "#fff4ef" : "#fffdf7", outline: "1px solid " + (on ? RED : (RC[s.rarity] || RC.R) + "66") } },
        h("div", { style: { height: 4, background: rc } }),
        h("div", { style: { display: "flex", alignItems: "stretch" } },
        h("div", { "data-wk": "runcardimg", style: { flex: "0 0 40px", minHeight: 52, margin: "5px 0 5px 5px", borderRadius: 2, background: url ? "#2a2520 center/cover no-repeat url(" + url + ")" : "linear-gradient(160deg, #efe6d2, #e2d6bd)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(47,42,34,.35)", fontFamily: FD, fontSize: fz(14) } }, url ? null : (s.name || "").slice(0, 1)),
        h("div", { style: { flex: 1, minWidth: 0, padding: "6px 8px 7px" } },
          h("div", { className: "flex items-center", style: { gap: 5, fontSize: fz(9.5) } },
            h("span", { style: { padding: "0 4px", borderRadius: 2, background: RC[s.rarity] || RC.R, color: "#fff", fontWeight: 700 } }, s.rarity),
            h("span", { style: { color: rc } }, s.role),
            h("span", { style: { marginLeft: "auto", fontFamily: FD, fontSize: fz(13), color: RC[s.rarity] || RC.R } }, s.face)),
          h("div", { style: { fontFamily: FD, fontSize: fz(12.5), lineHeight: 1.3, margin: "3px 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.name),
          h("div", { style: { fontSize: fz(10), color: SUB, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "⚔" + s.pow + " ♥" + s.maxHp + " · " + s.trait + (sub ? " · " + sub : ""))))));
  }
  // 一块信纸：页面里的段落都放在这上面
  const Paper = (key, title, kids, accent) => h("div", { key, "data-wk": "runpaper", style: { position: "relative", margin: "0 0 14px", borderRadius: 6, background: PAPER, boxShadow: "0 3px 10px rgba(47,42,34,.12)", border: "1px solid rgba(47,42,34,.08)", overflow: "hidden" } },
    h("div", { style: { height: 4, background: accent || AIR } }),
    h("div", { style: { padding: "12px 14px 14px" } }, title ? h("div", { style: { fontFamily: FD, fontSize: fz(14.5), marginBottom: 8, color: INK } }, title) : null, kids));
  // 信匣里每一种往来叫什么（她 2026-11-08）
  const KIND_ZH = { returned: "退件", letter: "回信", postcard: "明信片", note: "卡背面的便条", memory: "回忆卡", oneline: "一句话的回信", ask: "问答卡", future: "寄给以后的信", swap: "交换邮票时的话" };
  function StampRunPage(props) {
    const { characters, cards, onBack, meName, toast, closeOf, onChat, onPhoto, useThumb } = props;
    curThumb = useThumb || null; curCards = cards || [];
    const [run, setRun] = useState(() => { const v = load(SAVE, null); return v && v.run && !v.run.done ? v.run : null; });
    const [view, setView] = useState(() => { const v = load(SAVE, null); return v && v.run && !v.run.done ? (v.view || { at: "map" }) : { at: "start" }; });
    const [toId, setToId] = useState(() => { const c = (characters || []).find(x => (cards || []).some(k => k.charId === x.id)); return c ? c.id : ""; });
    const [core, setCore] = useState([]), [pickIdx, setPickIdx] = useState([]);
    const [withPick, setWithPick] = useState(""), [level, setLevel] = useState(1), [showDex, setShowDex] = useState(false), [themePick, setThemePick] = useState("");
    const POSTMARKS = "x_stampRunPostmarks", LEVELK = "x_stampRunLevel", DEX = "x_stampRunDex";
    const unlocked = Math.max(1, Number(load(LEVELK, 1)) || 1);
    const [chat, setChat] = useState(() => (load(SAVE, null) || {}).chat || []), [draft, setDraft] = useState(""), [busy, setBusy] = useState(false), [chatOpen, setChatOpen] = useState(false);
    const [, bump] = useState(0), [peek, setPeek] = useState(null);
    const [carry, setCarry] = useState(""), [kPick, setKPick] = useState([]), [kWho, setKWho] = useState(""), [kBusy, setKBusy] = useState(false), [kOpen, setKOpen] = useState("");
    curInfo = window.StampInfoCard ? setPeek : null;
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
    const commit = (r, v, ch) => { const rr = r || run, vv = v || view;
      if (rr && rr.step) dexMerge(rr); save(SAVE, rr && !rr.done ? { run: rr, view: vv, chat: ch || chat } : null); setRun(rr ? Object.assign({}, rr) : rr); setView(vv); bump(x => x + 1); };
    // 主题路线换底色（她 2026-11-08）：信纸横线照旧，底下那层渐变跟着路走
    const peekCard = () => peek && window.StampInfoCard ? h(window.StampInfoCard, { key: "peek", u: peek, foe: false, bonds: (run && run.bonds) || {}, cardOf: id => (cards || []).find(c => c && c.id === id), ownerOf: nameOf, nameOf, useThumb, onClose: () => setPeek(null) }) : null;
    const shell = kids => { const th = run && RN().THEMES[run.theme], pp = th ? th.paper : ["#f3ebdb", "#e8dcc4"]; kids = [].concat(kids, peekCard());
      return h("div", { "data-wk": "runpage", "data-theme": run && run.theme || "", className: "h-full flex flex-col", style: { position: "relative", background: "repeating-linear-gradient(0deg, transparent 0 27px, rgba(47,42,34,.05) 27px 28px), linear-gradient(" + pp[0] + ", " + pp[1] + ")" } }, kids); };
    // 信物册里收信的人、陪你走的人做过的（一件一个 id，去重）
    const oldKeeps = () => { const ids = [toId, withPick || toId].filter(Boolean), seen = {}; return (window.StampKeeps ? window.StampKeeps.all() : []).filter(k => ids.includes(k.charId) && D().KEEP_FX[k.fx] && !seen[k.id] && (seen[k.id] = 1)).reverse().slice(0, 12); };
    const carryKeeps = () => { const k = oldKeeps().find(x => x.id === carry); return k ? [Object.assign({}, k, { id: k.id + "_c" + Date.now().toString(36), on: true, carried: true })] : []; };
    const personaOf = id => { const c = (characters || []).find(x => x.id === id) || {}; return [c.persona, c.description, c.desc, c.personality].filter(Boolean).join(" "); };
    // 顶上一条：信封血（一条细血条）、邮花、卡组、信物（小火漆，点了看说明）
    const bar = () => run ? h("div", { "data-wk": "runbar", className: "px-4", style: { padding: "2px 16px 10px", fontFamily: F, color: INK } },
      h("div", { className: "flex items-center", style: { gap: 8 } },
        h("div", { style: { flex: 1, minWidth: 0, padding: "6px 10px", borderRadius: 6, background: "#fffdf7", boxShadow: "0 1px 4px rgba(47,42,34,.12)" } },
          h("div", { className: "flex", style: { justifyContent: "space-between", fontSize: fz(11), color: SUB } }, h("span", null, "✉ 信封"), h("span", { style: { fontFamily: FD, color: INK } }, run.hp + " / " + run.max)),
          h("div", { style: { height: 5, marginTop: 4, borderRadius: 3, background: "rgba(47,42,34,.1)", overflow: "hidden" } }, h("div", { style: { width: Math.max(0, 100 * run.hp / run.max) + "%", height: "100%", background: run.hp / run.max < 0.35 ? RED : GREEN, transition: "width .4s" } }))),
        h("div", { style: { padding: "6px 10px", borderRadius: 6, background: "#fffdf7", boxShadow: "0 1px 4px rgba(47,42,34,.12)", textAlign: "center", minWidth: 56 } }, h("div", { style: { fontSize: fz(10), color: SUB } }, "邮花"), h("div", { style: { fontFamily: FD, fontSize: fz(14), color: GOLD } }, run.coins)),
        h("div", { style: { padding: "6px 10px", borderRadius: 6, background: "#fffdf7", boxShadow: "0 1px 4px rgba(47,42,34,.12)", textAlign: "center", minWidth: 50 } }, h("div", { style: { fontSize: fz(10), color: SUB } }, "卡组"), h("div", { style: { fontFamily: FD, fontSize: fz(14) } }, run.deck.length))),
      run.relics.length ? h("div", { "data-wk": "runrelics", className: "flex flex-wrap", style: { gap: 6, marginTop: 8 } }, run.relics.map(k => h("button", { key: k, onClick: () => toast && toast(k + "：" + D().RELICS[k]),
        style: { display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px 2px 3px", borderRadius: 999, background: "#fffdf7", border: "1px solid " + GOLD + "88", color: "#8a6420", fontSize: fz(11) } },
        h("span", { style: { width: 16, height: 16, borderRadius: 999, background: "radial-gradient(circle at 35% 30%, #d9a441, #a8761f)", boxShadow: "inset 0 -1px 2px rgba(0,0,0,.25)" } }), k))) : null) : null;
    const relicRow = () => null;

    // ── 路上聊天：跟同行的那个人（终点就是 TA）──
    const talk = async () => {
      const text = draft.trim(); if (!text || busy || !onChat || !run) return;
      const ch = chat.concat({ who: "me", text }); setChat(ch); setDraft(""); setBusy(true); setChatOpen(true);
      try {
        const hist = ch.slice(-9, -1).map(m => (m.who === "me" ? (meName || "她") : withName) + "：" + m.text).join("\n");
        const lines = await onChat(withId, { mode: "road", text, toName, toId: run.toId, board: boardNow(), history: hist });
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
    // 她此刻在哪一页、面前摆着什么（她 2026-11-08：问「赢了选哪张进牌组」，TA 答成「先打哪张」——路上聊天只给了第几站）
    const cardBrief = x => "「" + x.name + "」（" + x.rarity + " " + x.role + "，攻 " + x.pow + " 血 " + x.maxHp + "，" + (nameOf(x.charId) || "通用票") + "的卡）";
    const sceneNow = () => {
      if (!run) return ""; const v = view || {};
      if (v.at === "reward") { const r = v.res || {}; return "她刚赢了这一站，拿到 " + (r.coins || 0) + " 枚邮花" + ((r.mats || []).length ? "、材料" + r.mats.join("、") : "") + "，现在正从这几张里挑一张加进卡组（只能挑一张）：" + (r.offer || []).map(cardBrief).join("；"); }
      if (v.at === "event") { const ev = RN().EVENTS.find(e => e.key === v.ev); return ev ? "她停在岔路「" + ev.zh + "」：" + ev.say + (ev.opts ? "要在这几个里选一个：" + ev.opts.map(o => o.zh).join("／") : "") : ""; }
      if (v.at === "shop") { const sh = v.shop || {}; return "她在邮局，手上 " + run.coins + " 枚邮花，正在看买什么：票 " + (sh.cards || []).map(cardBrief).join("、") + "；信物 " + (sh.relics || []).join("、") + "；也能花钱删一张票或补信封"; }
      if (v.at === "rest") return "她在驿站歇脚，要选：歇一会儿回信封，还是挑一张票升阶";
      if (v.at === "pick") return "她在出发前挑起手的票：发了 8 张挑 6 张";
      if (v.at === "map") return "她在路线图上挑下一站去哪";
      if (v.at === "end") return v.win ? "这一趟信已经送到了" : "这一趟信没送到，寄丢了";
      return "";
    };
    const boardNow = () => RN().summary(run, nameOf) + "；现在在第 " + ((run.pos ? run.pos.r : -1) + 2) + " 站前" + (sceneNow() ? "。她此刻在做的事：" + sceneNow() + "（她跟你说的话多半跟眼前这件事有关）" : "") + "。她现在的卡组：" + run.deck.map(cardBrief).join("、");
    // 过一站时同行的人冒一句卡上的话（不花调用）
    const companionLine = () => { const ls = (cards || []).filter(c => c.charId === withId && c.text).map(c => c.text.line || c.text.thought).filter(Boolean); return ls.length ? ls[(run.step * 7) % ls.length] : ""; };

    // ── 开一趟 ──
    if (view.at === "start" || !run) {
      const owned = (characters || []).filter(c => (cards || []).some(k => k.charId === c.id && k.text));
      return shell([
        h(Head, { key: "hd", zh: "远信", bg: "transparent", ink: INK, onBack }),
        h("div", { key: "bd", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingBottom: 24 } },
          h("div", { style: { fontSize: fz(12), color: SUB, lineHeight: 1.75, margin: "2px 0 14px" } }, "给一个人寄一封信。信要走六站（夜车五站）：路上有暴雨、罢工的邮差、拦信的人，也有邮局和驿站。信封的血不会每场回满，打空了信就寄丢了。最后一站是 TA 本人——赢了，信送到，TA 会写一封回信给你。不花调用（路上聊天和回信除外）。"),
          h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 8 } }, "寄给谁"),
          h("div", { className: "flex flex-wrap", style: { gap: 8, marginBottom: 16 } }, owned.map(c => h("button", { key: c.id, "data-wk": "runto", "data-on": toId === c.id ? "1" : "0", onClick: () => { setToId(c.id); setThemePick(""); setCarry(""); },
            style: { padding: "5px 12px", borderRadius: 999, border: "1px solid " + (toId === c.id ? RED : "rgba(47,42,34,.25)"), background: toId === c.id ? "rgba(178,58,46,.07)" : "rgba(255,255,255,.4)", color: toId === c.id ? RED : INK, fontSize: fz(12.5) } }, c.remark || c.name))),
          h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 4 } }, "谁陪你走"),
          h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 8 } }, "路上跟你聊天、写便条的人。不挑就是收信的人自己陪你走；挑了别人，终点 TA 也会知道是谁陪你来的。"),
          h("div", { className: "flex flex-wrap", style: { gap: 8, marginBottom: 16 } }, [{ id: "" }].concat(owned).map(c => { const on = (withPick || "") === (c.id || ""); return h("button", { key: c.id || "self", "data-wk": "runwith", "data-on": on ? "1" : "0", onClick: () => { setWithPick(c.id || ""); setCarry(""); },
            style: { padding: "5px 11px", borderRadius: 999, border: "1px solid " + (on ? GOLD : "rgba(47,42,34,.25)"), background: on ? "rgba(184,134,42,.1)" : "rgba(255,255,255,.4)", color: on ? GOLD : INK, fontSize: fz(12.5) } }, c.id ? (c.remark || c.name) : "收信的人自己"); })),
          (() => { const rec = toId ? RN().themeFor(personaOf(toId), toId) : "", cur = themePick || rec, TH = RN().THEMES;
            return h("div", { "data-wk": "runtheme", style: { marginBottom: 16 } },
              h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 4 } }, "走哪条路"),
              h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 8 } }, "每条路的麻烦、岔路和一条棋盘规则都不一样，回信也会写到这一路。默认是 " + (nameOf(toId) || "TA") + " 推荐的那条，可以换。"),
              h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 } }, Object.keys(TH).map(k => { const on = cur === k, t = TH[k], open = RN().themeOpen(k);
                return h("button", { key: k, "data-wk": "runthemepick", "data-on": on ? "1" : "0", disabled: !open, onClick: () => setThemePick(k), className: "text-left disabled:opacity-45",
                  style: { position: "relative", padding: "8px 10px", borderRadius: 5, border: "1.5px solid " + (on ? t.ink : "rgba(47,42,34,.18)"), background: "linear-gradient(" + t.paper[0] + ", " + t.paper[1] + ")", color: t.ink } },
                  h("div", { style: { fontFamily: FD, fontSize: fz(14) } }, (k === "节日" && RN().festNow() ? RN().festNow() : k) + (on ? " ✓" : "")),
                  h("div", { style: { fontSize: fz(10.5), lineHeight: 1.5, opacity: .85 } }, open ? t.rule + "：" + t.ruleZh : "节日前后才开，下一个是" + RN().festNext()),
                  k === rec ? h("span", { style: { position: "absolute", right: 6, top: 6, padding: "0 5px", borderRadius: 3, background: RED, color: "#fff", fontSize: fz(9) } }, "TA 推荐") : null); })));
          })(),
          // 带一件旧信物（她 2026-11-08「攒了信物，开局选和那个角色一起的时候可以挑一件信物和效果带进来」）：
          //   收信的人、陪你走的人以前做过的，挑一件带上，占一格，效果照做的时候那样
          (() => { const pool = oldKeeps(); if (!pool.length) return null;
            return h("div", { "data-wk": "runcarry", style: { marginBottom: 16 } },
              h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 4 } }, "带一件旧信物"),
              h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 8 } }, "收信的人、陪你走的人以前在远信里给你做过的。挑一件带上路，占信物栏一格，这一趟每一站都生效；不挑也行。"),
              pool.map(k => { const on = carry === k.id; return h("button", { key: k.id, "data-wk": "runcarrypick", "data-on": on ? "1" : "0", onClick: () => setCarry(on ? "" : k.id), className: "w-full text-left",
                style: { display: "block", marginBottom: 6, padding: "7px 10px", borderRadius: 5, border: "1px solid " + (on ? GOLD : "rgba(47,42,34,.18)"), background: on ? "rgba(184,134,42,.1)" : "rgba(255,255,255,.5)", color: INK } },
                h("div", { style: { fontFamily: FD, fontSize: fz(13.5) } }, (on ? "✦ " : "") + k.name),
                h("div", { style: { fontSize: fz(10.5), color: SUB } }, (nameOf(k.charId) || "TA") + " 做的 · " + (D().KEEP_FX[k.fx] ? D().KEEP_FX[k.fx].zh + " · " + D().KEEP_FX[k.fx].say(k.v) : ""))); })); })(),
          h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 4 } }, "邮路等级"),
          h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 8 } }, "送到一次解锁下一级。每一级对面的等级是定的（下面写着建议等级），卡练强了才好打高级；起手的信封也少 4。你这些卡平均 " + Math.round(D().avgLv(cards || [])) + " 级。"),
          h("div", { className: "flex flex-wrap", style: { gap: 6, marginBottom: 16 } }, Array.from({ length: unlocked }, (_, k) => k + 1).map(lv => h("button", { key: lv, "data-wk": "runlevel", "data-on": level === lv ? "1" : "0", onClick: () => setLevel(lv),
            style: { minWidth: 46, padding: "3px 6px", borderRadius: 8, border: "1.5px solid " + (level === lv ? RED : "rgba(47,42,34,.25)"), background: level === lv ? RED : "transparent", color: level === lv ? "#fff" : INK, fontFamily: FD, fontSize: fz(13), lineHeight: 1.2 } }, lv, h("div", { style: { fontFamily: F, fontSize: fz(9), opacity: .8 } }, "建议 " + RN().LEVEL_LV[lv - 1] + " 级")))),
          h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 4 } }, "带谁上路"),
          h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 8 } }, "最多两个人：起手发的牌多从他们那儿来。不挑就随机。"),
          h("div", { className: "flex flex-wrap", style: { gap: 8, marginBottom: 20 } }, owned.map(c => { const on = core.includes(c.id); return h("button", { key: c.id, onClick: () => setCore(p => on ? p.filter(x => x !== c.id) : p.concat(c.id).slice(-2)),
            style: { padding: "5px 11px", borderRadius: 999, border: "1px solid " + (on ? GREEN : "rgba(47,42,34,.25)"), background: on ? "rgba(79,122,102,.12)" : "rgba(255,255,255,.4)", color: on ? GREEN : INK, fontSize: fz(12.5) } }, c.remark || c.name); })),
          h("button", { "data-wk": "runstart", disabled: !toId, onClick: () => { const L0 = load(LETTERS, []); if (L0.some(x => x.sealed)) save(LETTERS, L0.map(x => x.sealed ? Object.assign({}, x, { sealed: false, opened: Date.now() }) : x)); const r = Object.assign(Object.assign(RN().newRun({ cards, toId, core, theme: themePick || RN().themeFor(personaOf(toId), toId), withId: withPick || toId, level: Math.min(level, unlocked) }), { keeps: carryKeeps() }), { bonds: bondsOf() }); setChat([]); setPickIdx([0, 1, 2, 3, 4, 5]); setDraft(""); commit(r, { at: "write" }, []); }, className: "w-full disabled:opacity-40", style: Object.assign(btn(RED, "#fff"), { padding: "12px 0", fontFamily: FD, fontSize: fz(15), letterSpacing: ".15em" }) }, "封好信，出发"),
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
          // 信物册：远信里做过的信物收着翻看（效果只在做它的那一趟）
          (() => { const K = window.StampKeeps ? window.StampKeeps.all() : []; if (!K.length) return null;
            return h("details", { "data-wk": "runkeepbook", style: { marginTop: 22 } },
              h("summary", { style: { fontFamily: FD, fontSize: fz(14), cursor: "pointer" } }, "信物册 · " + K.length + " 件"),
              h("div", { style: { fontSize: fz(11.5), color: SUB, margin: "4px 0 8px" } }, "远信路上 TA 给你做过的东西。效果只在做它的那一趟里，这里收着翻看。"),
              K.slice().reverse().slice(0, 60).map((k, i) => h("div", { key: i, style: { marginBottom: 8, padding: "8px 11px", borderRadius: 4, background: PAPER, borderLeft: "3px solid " + GOLD, fontSize: fz(12.5), lineHeight: 1.7 } },
                h("div", { style: { fontFamily: FD, fontSize: fz(13.5) } }, k.name, h("span", { style: { marginLeft: 6, fontFamily: F, fontSize: fz(10.5), color: SUB } }, (nameOf(k.charId) || "TA") + " 做的 · " + new Date(k.ts).toLocaleDateString())),
                k.story ? h("div", null, k.story) : null,
                k.say ? h("div", { style: { marginTop: 4, fontFamily: FD, color: "#5a4f40" } }, (nameOf(k.charId) || "TA") + "：「" + k.say + "」") : null))); })(),
          letters.length ? h("div", { "data-wk": "runletters", style: { marginTop: 22 } },
            h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 8 } }, "信匣"),
            h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 8 } }, "一路上收到的明信片、便条、回信都在这儿。"),
            letters.slice().reverse().slice(0, 40).map((L, k) => h("details", { key: k, "data-wk": "runletterbox", "data-kind": L.kind || "letter", style: { marginBottom: 8, padding: "8px 11px", borderRadius: 4, background: PAPER, border: "1px solid rgba(47,42,34,.12)", borderLeft: "3px solid " + (L.kind === "future" ? GOLD : L.kind && L.kind !== "letter" ? GREEN : RED) } },
              h("summary", { style: { fontSize: fz(12.5), cursor: "pointer" } }, L.kind === "returned" ? "你写给 " + (nameOf(L.toId) || "TA") + " 的信 · " + (L.delivered ? "后来重寄送到了" : "退件") : (nameOf(L.toId) || "TA") + " 的" + (KIND_ZH[L.kind || "letter"] || "信") + (L.title ? "：" + L.title : "") + " · " + new Date(L.ts).toLocaleDateString()),
              L.sealed ? h("div", { style: { marginTop: 6, fontSize: fz(12.5), color: SUB } }, "🔒 封着的。下一趟出发时才拆得开。")
                : h("div", { style: { marginTop: 6, fontFamily: FD, fontSize: fz(13), lineHeight: 1.85, whiteSpace: "pre-wrap" } }, L.img ? h("img", { src: typeof resolveImg === "function" ? resolveImg(L.img) : L.img, style: { display: "block", width: "100%", borderRadius: 4, marginBottom: 8 } }) : null, (L.q ? "问：" + L.q + "\n答：" + (L.a || "") + "\n\n" : L.mine ? "你写：" + L.mine + "\n\n" : "") + L.text)))) : null)]);
    }

    // ── 出发前写信（她 2026-11-08「我觉得可以」）：写的就是这封信；送到了 TA 拆开回你这一封，没送到退回信匣、下次能重寄 ──
    if (view.at === "write") {
      const back = load(LETTERS, []).map((L, i) => Object.assign({ i }, L)).filter(L => L.kind === "returned" && L.toId === run.toId && !L.delivered);
      return shell([
        h(Head, { key: "hd", zh: "写信", sub: "寄给 " + toName, bg: "transparent", ink: INK, onBack: () => commit(null, { at: "start" }) }),
        h("div", { key: "bd", className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, paddingBottom: 24 } },
          h("div", { style: { fontSize: fz(12), color: SUB, lineHeight: 1.7, margin: "2px 0 12px" } }, "写你想对 " + toName + " 说的话，封进信封带上路。送到了 TA 才拆，回信就是回这一封；路上没送到，信会退回来，下次出发可以再寄。不写也行，空着寄。"),
          back.length ? h("div", { "data-wk": "runresend", style: { marginBottom: 12 } },
            h("div", { style: { fontSize: fz(12), color: RED, marginBottom: 6 } }, "上次没送到、退回来的信（点一下重寄这封）："),
            back.slice(-5).reverse().map(L => h("button", { key: L.i, onClick: () => { setDraft(L.text || ""); commit(Object.assign(run, { resendIdx: L.i }), view); }, className: "w-full text-left",
              style: { display: "block", marginBottom: 6, padding: "7px 10px", borderRadius: 4, background: run.resendIdx === L.i ? "rgba(178,58,46,.08)" : "#fffdf7", border: "1px " + (run.resendIdx === L.i ? "solid " + RED : "dashed rgba(47,42,34,.3)"), fontSize: fz(12), color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } },
              "退件 · " + new Date(L.ts).toLocaleDateString() + "：" + String(L.text || "").slice(0, 40)))) : null,
          h("div", { "data-wk": "runwrite", style: { position: "relative", borderRadius: 6, background: PAPER, boxShadow: "0 4px 14px rgba(47,42,34,.15)", overflow: "hidden" } },
            h("div", { style: { height: 6, background: AIR } }),
            h("div", { style: { padding: "12px 16px 14px" } },
              h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 6 } }, toName + "："),
              h("textarea", { "data-wk": "runwriteinput", value: draft, onChange: e => { setDraft(e.target.value); if (typeof fitTextarea === "function") fitTextarea(e.target); }, rows: 9, placeholder: "想对 TA 说的话……",
                style: { width: "100%", minHeight: 240, border: "none", outline: "none", resize: "none", fontFamily: FD, fontSize: fz(14), lineHeight: "30px", color: INK, padding: 0,
                  background: "repeating-linear-gradient(180deg, transparent 0 29px, rgba(63,111,176,.2) 29px 30px)", backgroundAttachment: "local" } }),
              h("div", { style: { textAlign: "right", fontFamily: FD, fontSize: fz(13), color: SUB } }, "—— " + (meName || "我")))),
          h("button", { "data-wk": "runwritego", onClick: () => { commit(Object.assign(run, { myLetter: draft.trim().slice(0, 2000) }), { at: "pick" }); setDraft(""); }, className: "w-full", style: Object.assign(btn(RED, "#fff"), { marginTop: 14, padding: "12px 0", fontFamily: FD, fontSize: fz(15), letterSpacing: ".15em" }) }, draft.trim() ? "封好信，挑起手的票" : "空着寄，挑起手的票"))]);
    }
    // ── 挑起手卡组 ──
    if (view.at === "pick") return shell([
      h(Head, { key: "hd", zh: "挑起手的票", bg: "transparent", ink: INK, onBack: () => commit(null, { at: "start" }) }),
      h("div", { key: "bd", className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, paddingBottom: 20 } },
        h("div", { style: { fontSize: fz(12), color: SUB, margin: "2px 0 10px" } }, "发了 8 张，挑 6 张带上路（点一下选上／去掉）。路上打赢了还能再拿。"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 } }, (run.offer || []).map((s, i) => h(Mini, { key: i, s, on: pickIdx.includes(i), sub: nameOf(s.charId), onTap: () => setPickIdx(p => p.includes(i) ? p.filter(x => x !== i) : p.length >= 6 ? p : p.concat(i)) }))),
        h("button", { "data-wk": "runpickgo", disabled: pickIdx.length < 4, onClick: () => { RN().takeStart(run, pickIdx); commit(run, { at: "map" }); }, className: "w-full disabled:opacity-40", style: Object.assign(btn(RED, "#fff"), { marginTop: 14, padding: "11px 0" }) }, "带这 " + pickIdx.length + " 张上路"))]);

    // ── 打仗：交给对局页 ──
    if (view.at === "battle") {
      const b = view.b;
      return h(window.StampDuelPage, Object.assign({}, props, { key: "rb" + run.step, onBack, runBattle: Object.assign({}, b, {
        meDeck: run.deck.map(x => Object.assign({}, x)), bonds: bondsOf(),
        // 物品栏里带着的专属信物（她 2026-11-08）：收信的人、陪你走的人做的再强一档
        keeps: window.StampKeeps ? window.StampKeeps.forBattle([run.toId, run.withId]) : [],
        foeName: b.foeName || nameOf(b.foeId) || "拦路的人",
        onQuit: () => { if (typeof requestAppConfirm === "function") requestAppConfirm("先离开这一站？", "回到地图，下次进来这一站从头打。", () => commit(run, { at: "map", redo: view.nd }), "离开"); else commit(run, { at: "map", redo: view.nd }); },
        onDone: st => {
          const nd = run.map[run.pos.r][run.pos.k], res = RN().afterBattle(run, st, nd, cards);
          if (res.mats && window.StampKeeps) { window.StampKeeps.addMats(res.mats); run.matsGot = (run.matsGot || []).concat(res.mats); }
          if (res.won) { postmark(run, true); if (run.resendIdx != null) { const L = load(LETTERS, []); if (L[run.resendIdx]) { L[run.resendIdx] = Object.assign({}, L[run.resendIdx], { delivered: Date.now() }); save(LETTERS, L); } } return commit(run, { at: "end", win: true }); }
          if (res.lost) { postmark(run, false); if (run.myLetter && run.resendIdx == null) keepLetter("returned", [run.myLetter], { mine: true }); return commit(run, { at: "end", win: false }); }
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
    // ── 做信物（她 2026-11-08「在那一局里面就能合成和使用」「信物就是远信专属的」）：这一趟掉的材料，挑三样请 TA 当场做 ──
    if (view.at === "craft") {
      const mats = run.mats || [], keeps = run.keeps || [], slots = run.slots || 1, onN = keeps.filter(k => k.on).length;
      const whoList = Array.from(new Set([run.toId, run.withId].filter(Boolean))), who = whoList.includes(kWho) ? kWho : whoList[0];
      const cnt = {}; mats.forEach(m => { cnt[m] = (cnt[m] || 0) + 1; });
      const left = m => (cnt[m] || 0) - kPick.filter(x => x === m).length, fxs = D().keepFxOf(kPick);
      const make = async () => {
        if (kBusy || kPick.length !== 3 || !who || !onChat) return; setKBusy(true);
        try {
          const fxZh = {}; fxs.forEach(f => { fxZh[f] = D().KEEP_FX[f].zh + "（" + D().KEEP_FX[f].say(D().keepTier(kPick, f)) + "）"; });
          const r = await onChat(who, { mode: "keep", mats: kPick, fxList: fxs, fxZh });
          if (!r || !r.name) { toast && toast("没做出来，再点一次试试"); return; }
          const rest = mats.slice(); kPick.forEach(m => { const i = rest.indexOf(m); if (i >= 0) rest.splice(i, 1); }); run.mats = rest;
          const k = Object.assign({ id: "kp_" + Date.now().toString(36), charId: who, mats: kPick.slice(), v: D().keepTier(kPick, r.fx), ts: Date.now(), on: onN < slots }, r);
          run.keeps = keeps.concat(k); if (window.StampKeeps) window.StampKeeps.add(Object.assign({ toId: run.toId }, k));
          setKPick([]); setKOpen(k.id); toast && toast((nameOf(who) || "TA") + " 做好了「" + k.name + "」" + (k.on ? "，已经带上" : "，信物栏满了，要带得先放下一件")); commit(run, view);
        } catch (e) { toast && toast("没成：" + ((e && e.message) || e)); } finally { setKBusy(false); }
      };
      const chip = (txt, onClick, sel, c, wk, extra) => h("button", Object.assign({ "data-wk": wk, "data-on": sel ? "1" : "0", onClick, style: { padding: "3px 10px", borderRadius: 999, border: "1px solid " + (sel ? c : "rgba(47,42,34,.22)"), background: sel ? c + "18" : "rgba(255,255,255,.55)", color: sel ? c : INK, fontSize: fz(12) } }, extra || {}), txt);
      return page("做信物", [
        h("div", { key: "bk", "data-wk": "runcraft" },
        Paper("mats", "这一趟的材料 · " + mats.length + " 样", [
          h("div", { key: "t", style: { fontSize: fz(11.5), color: SUB, marginBottom: 8, lineHeight: 1.6 } }, "路上打赢掉的，只在这一趟里用。点三样（可以混着挑）。"),
          h("div", { key: "m", className: "flex flex-wrap", style: { gap: 6 } }, Object.keys(cnt).length ? Object.keys(cnt).map(m => chip(m + " ×" + left(m), () => { if (left(m) > 0 && kPick.length < 3) setKPick(p => p.concat(m)); }, kPick.includes(m), RED, "runmat", { disabled: left(m) <= 0 && !kPick.includes(m) })) : h("span", { style: { fontSize: fz(12), color: SUB } }, "还没掉材料，先往前打几站。"))]),
        Paper("make", "请谁做", [
          h("div", { key: "w", className: "flex flex-wrap", style: { gap: 6, marginBottom: 8 } }, whoList.map(id => chip(nameOf(id) || "TA", () => setKWho(id), who === id, GREEN, "runkeepwho"))),
          h("div", { key: "p", className: "flex flex-wrap", style: { gap: 6, marginBottom: 6 } }, [0, 1, 2].map(i => h("button", { key: i, "data-wk": "runkeeppick", onClick: () => setKPick(p => p.filter((_, j) => j !== i)), style: { minWidth: 70, padding: "6px 8px", borderRadius: 4, border: "1px dashed " + (kPick[i] ? RED : "rgba(47,42,34,.3)"), color: kPick[i] ? RED : SUB, fontSize: fz(12) } }, kPick[i] || "材料 " + (i + 1)))),
          fxs.length ? h("div", { key: "f", style: { fontSize: fz(11), color: SUB, marginBottom: 8, lineHeight: 1.6 } }, "可能做成：" + fxs.map(f => D().KEEP_FX[f].zh + " · " + D().KEEP_FX[f].say(D().keepTier(kPick, f))).join("；") + "。同一种偏向的材料越多越强，「TA 的东西」再加一档。") : null,
          h("button", { key: "go", "data-wk": "runkeepmake", onClick: make, disabled: kBusy || kPick.length !== 3 || !who || !onChat, className: "w-full disabled:opacity-40", style: Object.assign(btn(RED, "#fff"), { padding: "10px 0", fontFamily: FD, fontSize: fz(14) }) }, kBusy ? (nameOf(who) || "TA") + " 在做…" : "请 " + (nameOf(who) || "TA") + " 做（花一次调用）")], GREEN),
        Paper("keeps", "信物 · 带着 " + onN + " / " + slots, [
          h("div", { key: "t", style: { fontSize: fz(11.5), color: SUB, marginBottom: 8, lineHeight: 1.6 } }, "带着的在后面每一站都生效；终点是做它的人，再强一档。路上的「旧行李箱」能多开一格，最多三格。"),
          keeps.length ? keeps.slice().reverse().map(k => { const op = kOpen === k.id;
            return h("div", { key: k.id, "data-wk": "runkeep", style: { marginBottom: 8, borderRadius: 5, background: "#fffdf7", border: "1px solid " + (k.on ? GOLD : "rgba(47,42,34,.12)") } },
              h("div", { className: "flex items-center", style: { gap: 10, padding: "8px 10px" } },
                h("div", { style: { width: 32, height: 32, flexShrink: 0, borderRadius: 999, background: "radial-gradient(circle at 35% 30%, #c9a24a, #8f6b1e)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: fz(13), transform: "rotate(-8deg)" } }, D().KEEP_FX[k.fx] ? D().KEEP_FX[k.fx].zh : "✦"),
                h("button", { onClick: () => setKOpen(op ? "" : k.id), className: "flex-1 min-w-0 text-left" },
                  h("div", { style: { fontFamily: FD, fontSize: fz(14), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, k.name),
                  h("div", { style: { fontSize: fz(10.5), color: SUB } }, (nameOf(k.charId) || "TA") + (k.carried ? " 以前做的，带来的" : " 做的") + " · " + D().KEEP_FX[k.fx].zh + " · " + D().KEEP_FX[k.fx].say(k.v))),
                h("button", { "data-wk": "runkeeptoggle", onClick: () => { if (!k.on && onN >= slots) { toast && toast("信物栏满了，先放下一件"); return; } k.on = !k.on; commit(run, view); }, style: btn(k.on ? GOLD : "transparent", k.on ? "#fff" : INK, k.on ? null : "rgba(47,42,34,.3)") }, k.on ? "带着" : "带上")),
              op ? h("div", { style: { padding: "0 12px 10px 52px", fontSize: fz(12.5), lineHeight: 1.7 } }, k.story ? h("div", null, k.story) : null,
                k.say ? h("div", { style: { marginTop: 6, padding: "6px 10px", borderLeft: "3px solid " + GOLD, background: "rgba(184,134,42,.07)", fontFamily: FD, color: "#5a4f40" } }, (nameOf(k.charId) || "TA") + "：「" + k.say + "」") : null) : null); })
            : h("div", { key: "e", style: { fontSize: fz(12), color: SUB } }, "这一趟还没做信物。")], GOLD),
        h("button", { key: "bk2", onClick: () => commit(run, { at: "map" }), className: "w-full", style: Object.assign(btn("transparent", INK, "rgba(47,42,34,.35)"), { padding: "10px 0" }) }, "回路线图"))]);
    }
    if (view.at === "map") {
      const can = RN().reachable(run), cur = run.pos;
      const th = RN().THEMES[run.theme];
      return page(run.theme ? "远信 · " + run.theme : "远信 · 路线", [
        h("button", { key: "cr", "data-wk": "runcraftgo", onClick: () => commit(run, { at: "craft" }), className: "w-full flex items-center", style: { gap: 8, marginBottom: 8, padding: "7px 12px", borderRadius: 6, background: "rgba(184,134,42,.1)", border: "1px solid rgba(184,134,42,.4)", color: INK, fontSize: fz(12) } },
          h("span", { style: { fontFamily: FD, color: GOLD } }, "✦ 做信物"), h("span", { style: { color: SUB, flex: 1, textAlign: "left" } }, "材料 " + (run.mats || []).length + " 样 · 带着 " + (run.keeps || []).filter(k => k.on).length + " / " + (run.slots || 1) + " 件"), h("span", { style: { color: SUB } }, "›")),
        th ? h("div", { key: "th", "data-wk": "runthemeline", style: { fontSize: fz(11.5), color: th.ink, lineHeight: 1.6, marginBottom: 8 } }, th.say + "这一路的规则：" + th.rule + "——" + th.ruleZh + "。") : null,
        view.redo ? h("button", { key: "redo", onClick: redo, className: "w-full", style: Object.assign(btn(RED, "#fff"), { marginBottom: 10 }) }, "回到刚才那一站，重新打") : null,
        // 路线图：一排一站，站跟站之间画虚线；能去的那几站在动，走过的盖了戳，现在在哪儿压一个红邮戳
        (() => {
          const ROWH = 74, W = 300, rows = run.map, H = rows.length * ROWH + 10;
          const xOf = (row, k) => (k + 1) * W / (row.length + 1), yOf = r => 18 + r * ROWH + 22;
          const lines = [];
          rows.forEach((row, r) => row.forEach(nd => (nd.to || []).forEach(k2 => { const nx = rows[r + 1] && rows[r + 1][k2]; if (!nx) return;
            const walked = run.seen[r + ":" + nd.k] && run.seen[(r + 1) + ":" + k2], live = cur && cur.r === r && cur.k === nd.k;
            lines.push(h("line", { key: r + "_" + nd.k + "_" + k2, x1: xOf(row, nd.k), y1: yOf(r) + 18, x2: xOf(rows[r + 1], k2), y2: yOf(r + 1) - 18, stroke: walked ? RED : live ? INK : "rgba(47,42,34,.25)", strokeWidth: walked || live ? 2 : 1.4, strokeDasharray: walked ? "0" : "4 4" })); })));
          return h("div", { key: "map", "data-wk": "runmap", style: { padding: 6, borderRadius: 8, background: AIR, boxShadow: "0 4px 14px rgba(47,42,34,.18)" } },
            h("style", null, "@keyframes runPulse{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.08)}}"),
            h("div", { style: { position: "relative", borderRadius: 4, background: PAPER, height: H, maxWidth: W, margin: "0 auto", overflow: "hidden" } },
              h("svg", { width: "100%", height: H, viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", style: { position: "absolute", inset: 0 } }, lines),
              rows.map((row, r) => row.map(nd => {
                const here = cur && cur.r === r && cur.k === nd.k, open = !view.redo && ((!cur && r === 0) || (cur && r === cur.r + 1)) && can.includes(nd.k), seen = run.seen[r + ":" + nd.k];
                const meta = RN().NODE[nd.type], col = nd.type === "boss" ? RED : nd.type === "elite" ? GOLD : nd.type === "shop" || nd.type === "rest" ? GREEN : nd.type === "event" ? "#3f6fb0" : INK;
                const big = nd.type === "boss";
                return h("button", { key: r + "_" + nd.k, "data-wk": "runnode", "data-type": nd.type, "data-open": open ? "1" : "0", disabled: !open, onClick: () => go(nd.k),
                  style: { position: "absolute", left: (100 * xOf(row, nd.k) / W) + "%", top: yOf(r), transform: "translate(-50%,-50%)", width: big ? 64 : 52, height: big ? 64 : 52, padding: 3, border: "none",
                    background: PERF, filter: open ? "drop-shadow(0 3px 6px " + col + "66)" : "drop-shadow(0 1px 2px rgba(47,42,34,.2))", opacity: !open && !here && !seen && !big ? 0.55 : 1, animation: open ? "runPulse 1.6s ease-in-out infinite" : "none", zIndex: 2 } },
                  h("div", { style: { width: "100%", height: "100%", borderRadius: 2, background: here ? col : seen ? "#efe7d6" : "#fffdf7", outline: "1.5px solid " + col + (open || here ? "" : "77"), color: here ? "#fff" : col, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: F } },
                    h("div", { style: { fontFamily: FD, fontSize: fz(big ? 20 : 16), lineHeight: 1 } }, big ? "♥" : meta.icon),
                    h("div", { style: { fontSize: fz(8.5), marginTop: 2, maxWidth: "100%", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", padding: "0 2px" } }, big ? toName : meta.zh)),
                  seen && !here ? h("span", { style: { position: "absolute", right: -4, top: -4, width: 16, height: 16, borderRadius: 999, background: RED, color: "#fff", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" } }, "✓") : null,
                  here ? h("span", { style: { position: "absolute", left: "50%", top: -14, transform: "translateX(-50%) rotate(-8deg)", padding: "0 5px", borderRadius: 3, border: "1.5px solid " + RED, background: PAPER, color: RED, fontSize: 9, whiteSpace: "nowrap" } }, "你在这") : null);
              })),
              rows.map((row, r) => h("span", { key: "lb" + r, style: { position: "absolute", left: 6, top: yOf(r) - 7, fontSize: 9, color: SUB } }, r === rows.length - 1 ? "终点" : "第" + (r + 1) + "站"))));
        })(),
        h("div", { key: "tip", style: { fontSize: fz(11), color: SUB, marginTop: 8, lineHeight: 1.7 } }, "亮着的是下一站能去的。✉ 普通站打路上的麻烦；✦ 难站是别的角色来拦信，赢了掉信物；? 岔路；邮 邮局买东西；☕ 驿站歇脚；♥ 终点是 TA。"),
        h("div", { key: "deck", style: { marginTop: 14 } }, h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 8 } }, "带着的票 · " + run.deck.length + " 张"),
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 } }, run.deck.map((s, i) => h(Mini, { key: i, s, sub: nameOf(s.charId), onTap: () => toast && toast(s.name + "：" + s.role + " · 特质「" + s.trait + "」· 盖章「" + s.skill + "」") })))),
        h("button", { key: "quit", onClick: () => { const q = () => { save(SAVE, null); setRun(null); setView({ at: "start" }); }; typeof requestAppConfirm === "function" ? requestAppConfirm("放弃这一趟？", "信就不寄了，回到开头。", q, "放弃") : q(); }, style: { marginTop: 16, fontSize: fz(11.5), color: SUB, textDecoration: "underline" } }, "放弃这一趟")]);
    }

    // ── 打完一站：三选一 ──
    if (view.at === "reward") {
      const res = view.res || {};
      return page("赢了这一站", [
        Paper("got", "这一站拿到", h("div", { style: { fontSize: fz(13), lineHeight: 1.7 } }, "拿到 " + (res.coins || 0) + " 枚邮花。" + (res.relic ? "还捡到一件信物「" + res.relic + "」：" + D().RELICS[res.relic] + "。" : "") + ((res.mats || []).length ? "掉了材料：" + res.mats.join("、") + "（路线图上「做信物」能用）。" : "")), GREEN),
        Paper("pick", "挑一张加进卡组", h("div", { style: { display: "grid", gridTemplateColumns: "1fr", gap: 6 } }, (res.offer || []).map((s, i) => h(Mini, { key: i, s, sub: nameOf(s.charId), onTap: () => { run.deck.push(s); commit(run, { at: "map" }); } })))),
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
          const lines = await onChat(writer, Object.assign({ mode, text: "", toName, toId: run.toId, withName: withId !== run.toId ? withName : "", board: boardNow(), history: chat.slice(-6).map(m => (m.who === "me" ? (meName || "她") : toName) + "：" + m.text).join("\n") }, extra || {}));
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
            h("div", { key: "g", style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 } }, run.deck.map((s2, i) => h(Mini, { key: i, s: s2, sub: nameOf(s2.charId), onTap: () => { if (busy) return; if (ev.letter === "swap" && run.deck.length <= 4) return toast && toast("卡组只剩 4 张了"); call(ev.letter, { card: cardStory(s2) }, l => finish(l, i, { title: s2.name })); } })))]
        : [];
      return page("岔路 · " + who(ev.zh), [
        Paper("say", null, h("div", { style: { fontFamily: FD, fontSize: fz(14.5), lineHeight: 1.9 } }, who(ev.say)), RED),
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
        Paper("say", null, h("div", { style: { fontFamily: FD, fontSize: fz(14.5), lineHeight: 1.9 } }, who(ev.say)), "#3f6fb0"),
        view.result ? h("div", { key: "res" }, h("div", { style: { padding: "9px 12px", borderRadius: 4, background: "#fff", fontSize: fz(13), marginBottom: 10 } }, view.result),
            h("button", { onClick: () => commit(run, { at: "map" }), className: "w-full", style: btn(INK, PAPER) }, "接着走"))
          : ev.opts.map((op, i) => h("button", { key: i, "data-wk": "runeventopt", onClick: () => { const msg = RN().doEvent(run, ev, i, cards); commit(run, Object.assign({}, view, { result: msg })); }, className: "w-full text-left", style: Object.assign(btn("#fff", INK, "rgba(47,42,34,.25)"), { marginBottom: 8, display: "block" }) }, who(op.zh)))]);
    }
    // ── 邮局 ──
    if (view.at === "shop") {
      const sh = view.shop, buy = (w, i) => { const r = RN().buy(run, sh, w, i); if (!r.ok) toast && toast(r.why); commit(run, Object.assign({}, view)); };
      const price = k => RN().priceOf(run, k);
      return page("邮局", [
        Paper("cards", "买票 · 一张 " + price("card") + " 邮花", h("div", { style: { display: "grid", gridTemplateColumns: "1fr", gap: 8 } }, sh.cards.map((s, i) => h(Mini, { key: i, s, on: sh.sold["card" + i], sub: sh.sold["card" + i] ? "已买" : nameOf(s.charId), onTap: () => buy("card", i) }))), "#3f6fb0"),
        Paper("relics", "信物 · 一件 " + price("relic") + " 邮花", sh.relics.map((k, i) => h("button", { key: "r" + i, "data-wk": "runrelicbuy", onClick: () => buy("relic", i), disabled: !!sh.sold["relic" + i], className: "w-full text-left disabled:opacity-50",
          style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "8px 10px", borderRadius: 6, background: "#fffdf7", border: "1px solid " + GOLD + "66", fontFamily: F, color: INK } },
          h("span", { style: { width: 26, height: 26, flexShrink: 0, borderRadius: 999, background: "radial-gradient(circle at 35% 30%, #d9a441, #a8761f)", boxShadow: "inset 0 -2px 3px rgba(0,0,0,.25)" } }),
          h("span", { style: { fontSize: fz(12.5), lineHeight: 1.5 } }, h("b", { style: { color: "#8a6420" } }, k), "：" + D().RELICS[k] + (sh.sold["relic" + i] ? "（已买）" : "")))), GOLD),
        Paper("remove", "删一张票 · " + price("remove") + " 邮花", [h("div", { key: "t", style: { fontSize: fz(11.5), color: SUB, marginBottom: 8 } }, "点要删的那张。卡组最少留 4 张。"),
          h("div", { key: "g", style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 } }, run.deck.map((s, i) => h(Mini, { key: i, s, onTap: () => buy("remove", i) })))], "#8a3a4a"),
        h("button", { key: "f", onClick: () => buy("heal", 0), className: "w-full", style: Object.assign(btn("#fffdf7", GREEN, GREEN), { marginBottom: 10 }) }, "补信封 +15（" + price("heal") + " 邮花）"),
        h("button", { key: "g", onClick: () => commit(run, { at: "map" }), className: "w-full", style: btn(INK, PAPER) }, "离开邮局")]);
    }
    // ── 驿站 ──
    if (view.at === "rest") {
      return page("驿站", [
        view.result ? Paper("r", null, [h("div", { key: "t", style: { fontFamily: FD, fontSize: fz(14), lineHeight: 1.8, marginBottom: 12 } }, view.result), h("button", { key: "b", onClick: () => commit(run, { at: "map" }), className: "w-full", style: btn(INK, PAPER) }, "接着走")], GREEN)
          : [Paper("heal", "歇一会儿", [h("div", { key: "t", style: { fontSize: fz(12), color: SUB, marginBottom: 8 } }, "喝口热茶，信封回三成" + (run.relics.includes("旅伴的伞") ? "，再多回 10" : "") + "。"),
              h("button", { key: "b", "data-wk": "runrestheal", onClick: () => commit(run, Object.assign({}, view, { result: RN().rest(run, "heal") })), className: "w-full", style: btn(GREEN, "#fff") }, "歇一会儿")], GREEN),
            Paper("up", "或者给一张票升阶", [h("div", { key: "t", style: { fontSize: fz(11.5), color: SUB, marginBottom: 8 } }, "攻击 +2、血 +3、章少攒一格。点要升的那张。"),
              h("div", { key: "g", style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 } }, run.deck.map((s, i) => h(Mini, { key: i, s, onTap: () => commit(run, Object.assign({}, view, { result: RN().rest(run, "up", i) })) })))], GOLD)]]);
    }
    // ── 终点：回信 / 寄丢 ──
    if (view.at === "end") {
      const win = view.win;
      const ask = async () => {
        if (!onChat || busy) return; setBusy(true);
        try {
          const lines = await onChat(run.toId, { mode: "letter", text: "", myLetter: run.myLetter || "", withName: run.withId && run.withId !== run.toId ? withName : "", cards: run.deck.map(cardStory).join("\n"), board: RN().summary(run, nameOf), history: chat.slice(-8).map(m => (m.who === "me" ? (meName || "她") : toName) + "：" + m.text).join("\n") });
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
