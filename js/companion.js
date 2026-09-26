// ============================================================
// 陪伴 · 桌宠（companion）—— 独立小 app ＋ 全局悬浮小人
// 选一个角色，他以庭院那一份小人（2K 表情）站在你屏幕上；
// 脸跟着他此刻的心情换（x_moods → 十张表情之一）。样貌在这里单独挑，跟庭院没关系
// （她 2026-09-26：「这个的外貌是要单独选和庭院没关系」）；换装面板用庭院那一份 DressControls。
// 画面在 iframe 里（three.js 只在那里加载），这边只负责挑人、算样貌和表情、摆悬浮窗。
// 设置存 x_companion：{ charId, float, pos, scale, autoFace, looks: { [charId]: look } }
// ============================================================
(function () {
  const KEY = "x_companion", BUILD = "fg-0067d556fe1d225e";
  const load = () => Object.assign({ charId: "", float: false, pos: null, scale: 1, autoFace: true, looks: {} }, loadJSON(KEY, {}) || {});
  const save = v => saveJSON(KEY, v);
  // 心情 → 表情。心情是模型写的自由中文（x_moods[charId].label），按字认；认不出就是「平常」。
  // 顺序有意义：先认强烈的，再认温和的（「又委屈又开心」按委屈算）。
  const FACE_RULES = [
    ["irritated", /生气|火气|烦|恼|不耐|气鼓|暴躁|炸毛|醋/],
    ["sad", /难过|委屈|伤心|哭|心碎|想哭|酸涩|受伤/],
    ["gloomy", /低落|失落|疲惫|累|困|倦|思念|想念|寂寞|孤单|闷|丧|emo|惆怅|怅/],
    ["surprise", /惊讶|意外|错愕|愣|懵|吓/],
    ["amazed", /激动|兴奋|期待|惊喜|雀跃|心动|哇/],
    ["proud", /得意|骄傲|傲娇|自豪|嘚瑟|神气|臭屁|胜利/],
    ["happy", /开心|高兴|快乐|愉悦|欢喜|喜悦|乐|笑/],
    ["cozy", /温暖|暖意|幸福|甜|满足|惬意|安心|踏实|舒服/],
    ["relax", /平静|放松|平和|悠闲|慵懒|淡定|安稳|宁静/]
  ];
  const FACE_ZH = { default: "平常", happy: "开心", cozy: "惬意", relax: "放松", surprise: "惊讶", amazed: "哇", proud: "得意", gloomy: "低落", sad: "难过", irritated: "不耐烦" };
  function faceForMood(label) {
    const s = String(label || "");
    for (const [face, re] of FACE_RULES) if (re.test(s)) return face;
    return "default";
  }
  function moodLabel(moods, id) {
    const mo = moods && moods[id];
    if (!mo || !mo.label) return "";
    if (window.MoodLabel && window.MoodLabel.settle) { try { return window.MoodLabel.settle(mo.label, mo.ts, Date.now()).label || mo.label; } catch (_) {} }
    return String(mo.label);
  }
  const taOf = c => (typeof CharacterPronoun !== "undefined" && c) ? CharacterPronoun.ta(c) : "TA";
  function petMessage(char, moods, cfg) {
    if (!char) return null;
    const own = (cfg.looks || {})[char.id] || {};
    const face = cfg.autoFace === false ? (own.face || "default") : faceForMood(moodLabel(moods, char.id));
    return { type: "pet-look", ta: taOf(char), look: Object.assign({}, own, { face }) };
  }
  // 一只 iframe 画面：加载完成（pet-ready）或样貌变了，就把消息再送一次
  function PetFrame({ mode, msg, style, onOpen, frameRef }) {
    const own = useRef(null), ref = frameRef || own;
    const key = JSON.stringify(msg);
    useEffect(() => {
      const send = () => { const w = ref.current && ref.current.contentWindow; if (w && msg) w.postMessage(msg, "*"); };
      send();
      const on = e => {
        if (!ref.current || e.source !== ref.current.contentWindow || !e.data) return;
        if (e.data.type === "pet-ready") { send(); if (e.data && ref.onReady) ref.onReady(); }
        if (e.data.type === "pet-open" && onOpen) onOpen();
      };
      window.addEventListener("message", on);
      return () => window.removeEventListener("message", on);
    }, [key]);
    return h("iframe", { ref, title: "陪伴小人", src: "apps/companion/index.html?mode=" + mode + "&v=" + BUILD,
      allowTransparency: "true", style: Object.assign({ border: 0, background: "transparent", display: "block" }, style) });
  }

  function Companion(props) {
    const chars = props.characters || [];
    const [cfg, setCfg] = useState(load);
    const [styles, setStyles] = useState(null);
    const [, bump] = useState(0);
    const frame = useRef(null);
    frame.onReady = () => bump(n => n + 1);   // 小人加载好，换装面板才有现值可读
    useEffect(() => { fetch("apps/fairy-garden/doll.json?v=" + BUILD).then(r => r.json()).then(setStyles).catch(() => {}); }, []);
    const set = patch => setCfg(c => { const n = Object.assign({}, c, patch); save(n); if (window.__companionChanged) window.__companionChanged(n); return n; });
    const char = chars.find(c => c.id === cfg.charId) || chars[0] || null;
    useEffect(() => { if (char && char.id !== cfg.charId) set({ charId: char.id }); }, [char && char.id]);
    const mood = char ? moodLabel(props.moods, char.id) : "";
    const auto = cfg.autoFace !== false;
    const own = char ? ((cfg.looks || {})[char.id] || {}) : {};
    const face = auto ? faceForMood(mood) : (own.face || "default");
    const pet = () => { const w = frame.current && frame.current.contentWindow; return w && w.PetGame ? w.PetGame : null; };
    const pushLook = patch => { if (!char) return; const g = pet(); const cur = (load().looks || {})[char.id] || {};
      const next = g ? g.merge(cur, patch) : Object.assign({}, cur, patch);
      const extra = patch && patch.face ? { autoFace: false } : {};   // 在面板里点了表情＝我来选
      set(Object.assign({ looks: Object.assign({}, load().looks || {}, { [char.id]: next }) }, extra)); };
    const Dress = window.GardenDressControls;
    const chip = (on, label, onClick, key) => h("button", { key, onClick, className: "active:opacity-70",
      style: { flexShrink: 0, padding: "7px 14px", borderRadius: 16, fontFamily: F_BODY, fontSize: 13,
        border: "1px solid " + (on ? "#8a6a4b" : "rgba(138,106,75,.25)"), background: on ? "#8a6a4b" : "rgba(255,255,255,.6)", color: on ? "#fff" : "#6b5440" } }, label);
    return h("div", { className: "h-full flex flex-col", style: { background: "linear-gradient(180deg,#f6efe4,#ece2d2)" } },
      h(Head, { zh: "陪伴", onBack: props.onBack, bg: "transparent" }),
      h("div", { style: { display: "flex", gap: 8, overflowX: "auto", padding: "4px 16px 8px", flexShrink: 0 } },
        chars.map(c => chip(char && c.id === char.id, c.remark || c.name, () => set({ charId: c.id }), c.id))),
      !char ? h("div", { style: { padding: 24, fontFamily: F_BODY, color: "#8a7a5e" } }, "还没有角色。先去建一个，再回来让他陪着你。") :
      h(React.Fragment, null,
        h("div", { style: { height: "42vh", flexShrink: 0, position: "relative" } },
          h(PetFrame, { mode: "full", frameRef: frame, msg: petMessage(char, props.moods, cfg), style: { width: "100%", height: "100%" } })),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 20px", paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 24px)", fontFamily: F_BODY } },
          h("div", { style: { fontSize: 12.5, color: "#6b5440", lineHeight: 1.8 } },
            (char.remark || char.name) + " 现在" + (mood ? "的心情是「" + mood + "」" : "没有记下心情") + "，脸上是「" + FACE_ZH[face] + "」。"),
          h("div", { style: { display: "flex", gap: 8, margin: "8px 0 12px" } },
            chip(auto, "表情跟着心情", () => set({ autoFace: true }), "a"), chip(!auto, "我来选表情", () => set({ autoFace: false }), "b")),
          h("button", { onClick: () => set({ float: !cfg.float }), className: "active:opacity-70",
            style: { width: "100%", minHeight: 46, borderRadius: 14, fontSize: 14, marginBottom: 18,
              background: cfg.float ? "#8a6a4b" : "rgba(255,255,255,.7)", color: cfg.float ? "#fff" : "#6b5440", border: "1px solid rgba(138,106,75,.35)" } },
            cfg.float ? "正在屏幕上陪着你 · 点这里收起来" : "让他悬浮在屏幕上"),
          h("div", { style: { fontSize: 11, color: "#9a8a70", lineHeight: 1.7, marginBottom: 12 } }, "这一身只在陪伴里算数，和庭院那一身分开。悬浮的小人拖右下角的小圆点能调大小。"),
          Dress && pet() ? h(Dress, { who: "me", look: { me: Object.assign({}, own, auto ? {} : {}) }, styles, game: pet, pushLook }) :
            h("div", { style: { fontSize: 12, color: "#9a8a70" } }, "小人还在来的路上…"))));
  }

  // 全局悬浮小人：挂在 app 外壳上（和迷你播放器同一层），在陪伴页里自己不出。
  function CompanionFloat(props) {
    const [cfg, setCfg] = useState(load);
    useEffect(() => { window.__companionChanged = n => setCfg(n); return () => { window.__companionChanged = null; }; }, []);
    const chars = props.characters || [];
    const char = chars.find(c => c.id === cfg.charId);
    const sc = Math.max(.6, Math.min(2.2, Number(cfg.scale) || 1)), W = Math.round(96 * sc), H = Math.round(132 * sc);
    const [pos, setPos] = useState(() => cfg.pos || { x: window.innerWidth - W - 8, y: window.innerHeight - H - 150 });
    const drag = useRef(null), rs = useRef(null);
    if (!cfg.float || !char || props.hidden) return null;
    const clamp = p => ({ x: Math.max(0, Math.min(window.innerWidth - W, p.x)), y: Math.max(44, Math.min(window.innerHeight - H - 8, p.y)) });
    const onDown = e => { drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} };
    const onMove = e => { const d = drag.current; if (!d) return; setPos(clamp({ x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy })); };
    const onUp = () => { if (!drag.current) return; drag.current = null; const n = Object.assign(load(), { pos }); save(n); };
    return h("div", { style: { position: "fixed", left: pos.x, top: pos.y, width: W, height: H, zIndex: 60, touchAction: "none" } },
      h(PetFrame, { mode: "float", msg: petMessage(char, props.moods, cfg), onOpen: props.onOpen, style: { width: W, height: H - 18, pointerEvents: "auto" } }),
      // 这一条是拖动把手（iframe 里的点击留给「打开陪伴」）
      h("div", { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, "aria-label": "拖动陪伴小人",
        style: { height: 18, margin: "0 22px", borderRadius: 9, background: "rgba(138,106,75,.28)", cursor: "grab" } }),
      // 右下角的小圆点：往外拖变大、往里拖变小
      h("div", { "aria-label": "调整陪伴小人大小",
        onPointerDown: e => { e.stopPropagation(); rs.current = { sx: e.clientX, sy: e.clientY, s0: sc }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} },
        onPointerMove: e => { const r = rs.current; if (!r) return; const d = ((e.clientX - r.sx) + (e.clientY - r.sy)) / 2; const ns = Math.max(.6, Math.min(2.2, r.s0 + d / 110)); setCfg(c => Object.assign({}, c, { scale: ns })); },
        onPointerUp: () => { if (!rs.current) return; rs.current = null; setCfg(c => { const n = Object.assign(load(), { scale: c.scale }); save(n); return c; }); },
        style: { position: "absolute", right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, background: "rgba(138,106,75,.55)", border: "2px solid #fff", touchAction: "none" } }));
  }

  // 主屏图标：一个圆脑袋的小人
  window.GCompanion = p => h(Svg, p, h("circle", { cx: 12, cy: 8, r: 4.6 }), h("path", { d: "M6.5 20.5c.4-4 2.6-6.3 5.5-6.3s5.1 2.3 5.5 6.3" }), h("path", { d: "M9.6 8.4h.01M14.4 8.4h.01" }));
  window.Companion = Companion;
  window.CompanionFloat = CompanionFloat;
  window.CompanionFace = { faceForMood, FACE_ZH };
})();
