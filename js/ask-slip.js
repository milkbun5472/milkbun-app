// ============================================================
// 请示（群友 2026-10-29 许愿：「u 提出想买东西、请假、辞职……给出理由，char 和 npc 来审批，驳回/赞同」）
//   一张批条，单聊和群里同一张：
//   · 单聊：谁发都行。她发的由 TA 下一轮批；TA 发的由她点。
//   · 群里：长在投票卡身上（kind:"poll" + ask），选项固定「准 / 驳」，大家各投一票，过半就准。
//   · 动钱：准了＝发起的人自己掏这笔；单聊里批的人还能盖「我出」＝批的人替他出。
//   这里只放【长什么样】和几个纯函数；记账、谁来批，在 app.js 那头。
// ============================================================
const AskSlip = (() => {
  const VERDICT = { approved: "准", rejected: "驳", paid: "我出" };
  const amountOf = v => { const n = Math.round(Math.abs(Number(v) || 0) * 100) / 100; return n > 0 ? n : 0; };
  // 给模型和历史读的那一行：卡上写了什么、批了没有，一行说清
  const line = (m, who) => {
    const a = m.ask || m;
    const head = "[请示] " + (who ? who + "：" : "") + (a.what || "") + (amountOf(a.amount) ? "（" + amountOf(a.amount) + " 块）" : "") + (a.reason ? "；理由：" + a.reason : "");
    const st = m.status || (m.askResult && m.askResult.status);
    if (!st || st === "pending") return head;
    return head + " —— " + (m.judge ? m.judge + " " : "") + "批：" + VERDICT[st] + (m.note ? "（" + m.note + "）" : "");
  };
  // 群里那张：过半就准；准驳一样多算驳（没说服大家）
  const tally = poll => {
    const yes = ((poll.options || [])[0] || {}).voters || [], no = ((poll.options || [])[1] || {}).voters || [];
    return { yes, no, status: yes.length > no.length ? "approved" : "rejected" };
  };
  return { VERDICT, amountOf, line, tally };
})();
if (typeof window !== "undefined") window.AskSlip = AskSlip;

// 写一张请示：想干嘛、为什么、要花多少（可空）。单聊群里同一个小框
function AskComposeDialog({ who, onCancel, onSend }) {
  const t = useTheme();
  const [what, setWhat] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const field = { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", background: t.bg, color: t.ink, border: "1px solid " + t.line, borderRadius: 12, padding: "9px 12px" };
  const ok = what.trim().length > 0;
  return appDialogPortal(
    h("div", { "data-wk": "block", onClick: e => e.stopPropagation(), style: { width: "100%", maxWidth: 320, maxHeight: "88vh", overflowY: "auto", overscrollBehavior: "contain", background: t.bg2, borderRadius: 20, padding: "22px 20px 18px" } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: t.ink, textAlign: "center" } }, "请示" + (who ? " · " + who : "")),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, textAlign: "center", marginTop: 4, lineHeight: 1.6 } },
        "写上想干嘛、为什么，等着批。填了金额的，批准了这笔钱从你钱包里出；对方也可能说「我出」。"),
      h("input", { "data-wk": "input", value: what, onChange: e => setWhat(e.target.value.slice(0, 40)), placeholder: "想干嘛（买个东西、请天假、辞职……）", className: "w-full outline-none", style: Object.assign({}, field, { marginTop: 14 }) }),
      h("textarea", { "data-wk": "textarea", value: reason, onChange: e => setReason(e.target.value.slice(0, 120)), rows: 3, placeholder: "理由", className: "w-full outline-none", style: Object.assign({}, field, { marginTop: 8, resize: "none", lineHeight: 1.6 }) }),
      h("input", { "data-wk": "input", value: amount, inputMode: "decimal", onChange: e => setAmount(e.target.value.replace(/[^\d.]/g, "").slice(0, 12)), placeholder: "要花多少钱（不花钱就空着）", className: "w-full outline-none", style: Object.assign({}, field, { marginTop: 8 }) }),
      h("div", { className: "flex", style: { gap: 10, marginTop: 16 } },
        h("button", { onClick: onCancel, className: "flex-1 active:opacity-70", style: { minHeight: 42, borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: "transparent", border: "1px solid " + t.line } }, "算了"),
        h("button", { disabled: !ok, onClick: () => ok && onSend({ what: what.trim(), reason: reason.trim(), amount: AskSlip.amountOf(amount) }), className: "flex-1 active:opacity-70",
          style: { minHeight: 42, borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.bg2, background: ok ? t.ink : t.line, border: "none" } }, "递上去"))),
    onCancel);
}

// 一张批条。m：单聊那条（kind:"ask"）或群里那张投票（kind:"poll" 带 ask）。
//   onDecide(status)：这张该她批时才给；group：群里那张（显示两边各有谁）
function AskSlipCard({ m, asker, money, onDecide, onVote, meName, allowPay }) {
  const t = useTheme();
  const group = m.kind === "poll";
  const a = group ? (m.ask || {}) : m;
  const amt = AskSlip.amountOf(a.amount);
  const st = group ? (m.askResult && m.askResult.status) || "pending" : m.status || "pending";
  const tl = group ? AskSlip.tally(m) : null;
  const myVote = group && meName ? (tl.yes.indexOf(meName) >= 0 ? 0 : tl.no.indexOf(meName) >= 0 ? 1 : -1) : -1;
  const small = { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog };
  const btn = (label, on, onClick, key) => h("button", { key, onClick, className: "flex-1 active:opacity-70",
    style: { minHeight: 38, borderRadius: 10, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: on ? t.bg2 : t.ink, background: on ? t.ink : "transparent", border: "1px solid " + (on ? t.ink : t.line) } }, label);
  return h("div", { "data-wk": "askslip", "data-status": st, style: { position: "relative", width: 250, maxWidth: "100%", background: t.bg2, border: "1px solid " + t.line, borderRadius: 6, padding: "12px 14px 12px", boxShadow: "0 1px 0 " + t.line } },
    h("div", { className: "flex items-baseline justify-between", style: { borderBottom: "1px dashed " + t.line, paddingBottom: 6 } },
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, letterSpacing: "0.3em" } }, "请示"),
      h("span", { style: small }, asker || "")),
    h("div", { style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink, marginTop: 8, lineHeight: 1.5, wordBreak: "break-word" } }, a.what || ""),
    amt ? h("div", { "data-wk": "askslipamount", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, marginTop: 4 } }, "要花 " + (money ? money(amt) : "¥" + amt)) : null,
    a.reason ? h("div", { style: Object.assign({}, small, { marginTop: 6, lineHeight: 1.6, wordBreak: "break-word" }) }, "理由：" + a.reason) : null,
    group ? h("div", { style: Object.assign({}, small, { marginTop: 8, lineHeight: 1.6 }) },
      "准 " + tl.yes.length + (tl.yes.length ? "（" + tl.yes.join("、") + "）" : ""), h("br"),
      "驳 " + tl.no.length + (tl.no.length ? "（" + tl.no.join("、") + "）" : "")) : null,
    st !== "pending" ? h("div", { "data-wk": "askslipstamp", style: { position: "absolute", right: 12, top: 42, width: 54, height: 54, borderRadius: "50%", border: "2.5px solid #b8332e", color: "#b8332e",
      display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-14deg)", fontFamily: F_DISPLAY, fontSize: "calc(" + (st === "paid" ? 15 : 22) + "px * var(--app-fs, 1))", opacity: 0.85, pointerEvents: "none" } }, AskSlip.VERDICT[st]) : null,
    !group && st !== "pending" && (m.judge || m.note) ? h("div", { style: Object.assign({}, small, { marginTop: 8, color: t.ink, lineHeight: 1.6 }) }, (m.judge ? m.judge + " 批" : "批") + (m.note ? "：" + m.note : "")) : null,
    onDecide && st === "pending" ? h("div", { className: "flex", style: { gap: 6, marginTop: 10 } },
      btn("准", false, () => onDecide("approved"), "y"),
      amt && allowPay ? btn("我出", false, () => onDecide("paid"), "p") : null,
      btn("驳", false, () => onDecide("rejected"), "n")) : null,
    onVote && st === "pending" ? h("div", { className: "flex", style: { gap: 6, marginTop: 10 } },
      btn("准", myVote === 0, () => onVote(0), "y"), btn("驳", myVote === 1, () => onVote(1), "n")) : null);
}
