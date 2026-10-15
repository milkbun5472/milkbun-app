(function (root) {
  "use strict";
  const h = React.createElement;
  const LOUNGE_URL = "https://lisamacbook-air.tail542792.ts.net/lounge/";
  function LoungeEntryApp({ onBack }) {
    const t = useTheme();
    const [loaded, setLoaded] = useState(false);
    return h("div", { className: "h-full flex flex-col", style: { background: t.bg, color: t.ink } },
      h("div", { className: "shrink-0 px-3", style: { paddingTop: "calc(7px + env(safe-area-inset-top))", paddingBottom: 7, borderBottom: "1px solid " + t.line, display: "flex", alignItems: "center", gap: 8 } },
        h("button", { onClick: onBack, style: { width: 40, height: 40, display: "grid", placeItems: "center" } }, h(IArrow, { size: 18, color: t.ink })),
        h("div", { style: { flex: 1 } }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18 } }, "三席会客"), h("div", { style: { fontFamily: F_BODY, color: t.fog, fontSize: 10.5 } }, "Lisa · 言秋老窗口 · VPS Codex")),
        h("button", { onClick: function () { location.href = LOUNGE_URL; }, style: { border: "1px solid " + t.line, borderRadius: 999, padding: "6px 9px", fontFamily: F_BODY, fontSize: 10.5, color: t.sub } }, "全屏")),
      !loaded && h("div", { style: { position: "absolute", inset: "90px 0 0", display: "grid", placeItems: "center", color: t.fog, fontFamily: F_BODY, fontSize: 12, pointerEvents: "none" } }, "正在搬来三把椅子…"),
      h("iframe", { title: "三方会客室", src: LOUNGE_URL, onLoad: function () { setLoaded(true); }, style: { flex: 1, minHeight: 0, width: "100%", border: 0, background: t.bg } }));
  }
  root.LoungeEntryApp = LoungeEntryApp;
})(window);
