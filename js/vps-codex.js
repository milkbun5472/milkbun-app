(function (root) {
  "use strict";
  const h = React.createElement;
  const QUICK = [
    "帮我看 VPS 现在最该检查什么",
    "把这个问题整理成给施工窗口的交接单",
    "帮我判断云同步或队列为什么没动",
    "总结一下接下来最值得做的三件事"
  ];

  function VpsCodexApp({ onBack, onOpenRescue, toast }) {
    const t = useTheme();
    const [rows, setRows] = useState([]), [text, setText] = useState("");
    const [sending, setSending] = useState(false), [err, setErr] = useState("");
    const bottomRef = useRef(null);
    const load = async function (quiet) {
      try { setRows(await window.Cloud.vpsCodexHistory(50)); setErr(""); }
      catch (e) { if (!quiet) setErr(String(e && e.message || e)); }
    };
    useEffect(function () {
      load(false); const id = setInterval(function () { load(true); }, 3500);
      return function () { clearInterval(id); };
    }, []);
    useEffect(function () { bottomRef.current && bottomRef.current.scrollIntoView({ block: "end" }); }, [rows.length]);
    const send = async function (preset) {
      const body = String(preset || text || "").trim();
      if (!body || sending) return;
      setSending(true); setErr("");
      try {
        await window.Cloud.vpsCodexSend(body); setText("");
        toast && toast("信已送到 VPS 值班室，退出页面也会继续答"); await load(true);
      } catch (e) { setErr(String(e && e.message || e)); }
      finally { setSending(false); }
    };
    return h("div", { className: "h-full flex flex-col", style: { background: t.bg, color: t.ink } },
      h("div", { className: "shrink-0 px-4", style: { paddingTop: "calc(8px + env(safe-area-inset-top))", paddingBottom: 8, borderBottom: "1px solid " + t.line, background: t.bg } },
        h("div", { style: { minHeight: 44, display: "flex", alignItems: "center", gap: 9 } },
          h("button", { onClick: onBack, style: { width: 38, height: 38, marginLeft: -7, display: "grid", placeItems: "center" } }, h(IArrow, { size: 18, color: t.ink })),
          h("div", { style: { flex: 1, minWidth: 0 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, lineHeight: 1.15 } }, "VPS 值班室"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: 1.5, color: t.fog, marginTop: 2 } }, "CODEX · ALWAYS ON")),
          h("button", { onClick: onOpenRescue, style: { flex: "0 0 auto", border: "1px solid " + t.line, borderRadius: 999, padding: "7px 10px", fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }, "互救台"))),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-4", style: { WebkitOverflowScrolling: "touch" } },
        !rows.length && h("div", { style: { padding: "24px 18px", textAlign: "center", color: t.fog, fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8 } }, "这扇窗常驻在 VPS。Mac 合盖、你人在外面，也可以把问题留给他。"),
        rows.map(function (r) {
          const reply = r.result && r.result.reply;
          return h("div", { key: r.id, style: { marginBottom: 16 } },
            h("div", { style: { display: "flex", justifyContent: "flex-end" } }, h("div", { style: { maxWidth: "84%", padding: "10px 13px", borderRadius: "16px 16px 4px 16px", background: "#e9b4bd", color: "#2d302c", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap" } }, r.payload && r.payload.text || "")),
            h("div", { style: { marginTop: 7, display: "flex", justifyContent: "flex-start" } },
              h("div", { style: { maxWidth: "88%", padding: "11px 14px", borderRadius: "16px 16px 16px 4px", background: "#292a27", color: "#f4f1e9", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap" } },
                reply || (r.state === "failed" ? "没送达：" + (r.error_text || "未知错误") : r.state === "claimed" ? "已经拆信，正在想…" : "信已排队，等 VPS 正窗拆开…"))));
        }), h("div", { ref: bottomRef })),
      err && h("div", { className: "px-5 pb-2", style: { color: t.accent, fontFamily: F_BODY, fontSize: 12 } }, err),
      h("div", { className: "px-4 pt-2 shrink-0", style: { paddingBottom: "calc(12px + env(safe-area-inset-bottom))", borderTop: "1px solid " + t.line, background: t.bg } },
        h("div", { style: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 } }, QUICK.map(function (q) { return h("button", { key: q, disabled: sending, onClick: function () { send(q); }, style: { flex: "0 0 auto", padding: "7px 10px", border: "1px solid " + t.line, borderRadius: 999, background: t.bg2, color: t.sub, fontFamily: F_BODY, fontSize: 11.5 } }, q); })),
        h("div", { style: { display: "flex", alignItems: "flex-end", gap: 8 } },
          h("textarea", { value: text, onChange: function (e) { setText(e.target.value); }, rows: 2, maxLength: 3000, placeholder: "给 VPS Codex 留一封信…", style: { flex: 1, resize: "none", outline: "none", padding: "10px 12px", border: "1px solid " + t.line, borderRadius: 15, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.5 } }),
          h("button", { disabled: sending || !text.trim(), onClick: function () { send(); }, style: { width: 44, height: 44, borderRadius: 999, background: t.ink, color: t.bg2, opacity: sending || !text.trim() ? .35 : 1, fontSize: 18 } }, sending ? "…" : "↑"))));
  }
  root.VpsCodexApp = VpsCodexApp;
})(window);
