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
    const head = "[请示" + (a.round > 1 ? "·第" + a.round + "次递" : "") + "] " + (who ? who + "：" : "") + (a.what || "") + (amountOf(a.amount) ? "（" + amountOf(a.amount) + " 块）" : "") + (a.reason ? "；理由：" + a.reason : "")
      + (a.imageRef ? "；附了一张图" : "")
      + (a.before && a.before.length ? "；前几回：" + a.before.map(b => "理由「" + b.reason + "」被驳" + (b.note ? "（" + b.note + "）" : "")).join("，") : "");
    const st = m.status || (m.askResult && m.askResult.status);
    if (!st || st === "pending") return head;
    return head + " —— " + (m.judge ? m.judge + " " : "") + "批：" + VERDICT[st] + (st === "approved" && m.cond ? "，但是：" + m.cond : "") + (m.note ? "（" + m.note + "）" : "");
  };
  // 群里那张：过半就准；准驳一样多算驳（没说服大家）
  const tally = poll => {
    const yes = ((poll.options || [])[0] || {}).voters || [], no = ((poll.options || [])[1] || {}).voters || [];
    return { yes, no, status: yes.length > no.length ? "approved" : "rejected" };
  };
  // 再递一回：带上前几回的理由和批语，第几次一眼看得到
  const again = (prev, reason) => ({ what: prev.what, amount: prev.amount, reason, round: (prev.round || 1) + 1, prevAid: prev.aid,
    before: (prev.before || []).concat([{ reason: prev.reason || "", note: prev.note || "" }]).slice(-4) });
  // 编号：原卡和回执认同一个号
  const no = key => { let x = 0; String(key || "").split("").forEach(c => { x = (x * 31 + c.charCodeAt(0)) % 9973; }); return String(x).padStart(4, "0"); };
  return { VERDICT, amountOf, line, tally, again, no };
})();
if (typeof window !== "undefined") window.AskSlip = AskSlip;

// 写一张请示：想干嘛、为什么、要花多少（可空）。单聊群里同一个小框
function AskComposeDialog({ who, prev, onCancel, onSend }) {
  const t = useTheme();
  const [what, setWhat] = useState(prev ? prev.what || "" : "");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(prev && prev.amount ? String(prev.amount) : "");
  // 附一张图（群里 2026-10-30「许愿请示那能加图片」）：想买的那件、请假条、截图……压一下存进本机图库，卡上存的只是引用
  const [img, setImg] = useState(prev && prev.imageRef ? prev.imageRef : ""), [imgBusy, setImgBusy] = useState(false);
  const pickRef = useRef(null);
  const onPick = async e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; setImgBusy(true);
    try { const d = await resizeImageFile(f, 1280, 0.85); const ref = await imgToVault(d); setImg(ref || d); } catch (er) {} finally { setImgBusy(false); } };
  const field = { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", background: t.bg, color: t.ink, border: "1px solid " + t.line, borderRadius: 12, padding: "9px 12px" };
  const ok = what.trim().length > 0;
  return appDialogPortal(
    h("div", { "data-wk": "block", onClick: e => e.stopPropagation(), style: { width: "100%", maxWidth: 320, maxHeight: "88vh", overflowY: "auto", overscrollBehavior: "contain", background: t.bg2, borderRadius: 20, padding: "22px 20px 18px" } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: t.ink, textAlign: "center" } }, "请示" + (who ? " · " + who : "")),
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, textAlign: "center", marginTop: 4, lineHeight: 1.6 } },
        prev ? "上回被驳了，换个理由再递一回。" + (prev.note ? "批语是：「" + prev.note + "」" : "") : "写上想干嘛、为什么，等着批。填了金额的，批准了这笔钱从你钱包里出；对方也可能说「我出」。"),
      h("input", { "data-wk": "input", value: what, onChange: e => setWhat(e.target.value.slice(0, 40)), placeholder: "想干嘛（买个东西、请天假、辞职……）", className: "w-full outline-none", style: Object.assign({}, field, { marginTop: 14 }) }),
      h("textarea", { "data-wk": "textarea", value: reason, onChange: e => setReason(e.target.value.slice(0, 120)), rows: 3, placeholder: "理由", className: "w-full outline-none", style: Object.assign({}, field, { marginTop: 8, resize: "none", lineHeight: 1.6 }) }),
      h("input", { ref: pickRef, type: "file", accept: "image/*", onChange: onPick, style: { display: "none" } }),
      img ? h("div", { style: { position: "relative", marginTop: 8 } },
          h("img", { src: resolveImg(img), alt: "", style: { width: "100%", maxHeight: 180, objectFit: "contain", borderRadius: 10, background: t.bg, display: "block" } }),
          h("button", { onClick: () => setImg(""), "aria-label": "去掉这张图", style: { position: "absolute", right: 6, top: 6, minWidth: 30, minHeight: 30, borderRadius: 99, background: "rgba(0,0,0,.5)", color: "#fff", border: "none" } }, "✕"))
        : h("button", { onClick: () => pickRef.current && pickRef.current.click(), disabled: imgBusy, className: "w-full active:opacity-70",
          style: Object.assign({}, field, { marginTop: 8, textAlign: "left", color: t.fog, borderStyle: "dashed" }) }, imgBusy ? "图片处理中…" : "＋ 加一张图（可以不加）"),
      h("input", { "data-wk": "input", value: amount, inputMode: "decimal", onChange: e => setAmount(e.target.value.replace(/[^\d.]/g, "").slice(0, 12)), placeholder: "要花多少钱（不花钱就空着）", className: "w-full outline-none", style: Object.assign({}, field, { marginTop: 8 }) }),
      h("div", { className: "flex", style: { gap: 10, marginTop: 16 } },
        h("button", { onClick: onCancel, className: "flex-1 active:opacity-70", style: { minHeight: 42, borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: "transparent", border: "1px solid " + t.line } }, "算了"),
        h("button", { disabled: !ok, onClick: () => ok && onSend(Object.assign(prev ? Object.assign(AskSlip.again(prev, reason.trim()), { what: what.trim(), amount: AskSlip.amountOf(amount) }) : { what: what.trim(), reason: reason.trim(), amount: AskSlip.amountOf(amount) }, img ? { imageRef: img } : {})), className: "flex-1 active:opacity-70",
          style: { minHeight: 42, borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.bg2, background: ok ? t.ink : t.line, border: "none" } }, "递上去"))),
    onCancel);
}

// 一张批条。m：单聊那条（kind:"ask"）或群里那张投票（kind:"poll" 带 ask）。
//   onDecide(status)：这张该她批时才给；group：群里那张（显示两边各有谁）
function AskSlipCard({ m, asker, money, onDecide, onVote, onResend, meName, allowPay }) {
  const t = useTheme();
  const group = m.kind === "poll";
  const a = group ? (m.ask || {}) : m;
  const amt = AskSlip.amountOf(a.amount);
  const st = group ? (m.askResult && m.askResult.status) || "pending" : m.status || "pending";
  const tl = group ? AskSlip.tally(m) : null;
  const [big, setBig] = useState(false);   // 附图点开看大的
  const myVote = group && meName ? (tl.yes.indexOf(meName) >= 0 ? 0 : tl.no.indexOf(meName) >= 0 ? 1 : -1) : -1;
  // 一张公文批条：红色双线抬头、编号、一格一格的栏目、落款，结案盖一枚双圈印
  const SEAL = "#b8332e";
  const fs = n => "calc(" + n + "px * var(--app-fs, 1))";
  const small = { fontFamily: F_BODY, fontSize: fs(11), color: t.fog };
  const no = AskSlip.no(m.aid || m.pollId || a.what);
  const day = m.ts ? (d => (d.getMonth() + 1) + "月" + d.getDate() + "日")(new Date(m.ts)) : "";
  const row = (label, body, key, extra) => h("div", { key, className: "flex", style: Object.assign({ borderTop: "1px solid " + t.line, padding: "7px 0", gap: 10, alignItems: "baseline" }, extra || {}) },
    h("span", { style: Object.assign({}, small, { width: 34, flexShrink: 0, letterSpacing: "0.15em" }) }, label),
    h("div", { style: { flex: 1, minWidth: 0, wordBreak: "break-word" } }, body));
  const btn = (label, kind, onClick, key) => h("button", { key, onClick, className: "flex-1 active:opacity-70",
    style: { minHeight: 38, whiteSpace: "nowrap", padding: "0 4px", borderRadius: 4, fontFamily: F_DISPLAY, fontSize: fs(14), letterSpacing: "0.1em",
      color: kind === "solid" ? "#fff" : kind === "seal" ? SEAL : t.ink, background: kind === "solid" ? SEAL : "transparent",
      border: "1px solid " + (kind === "solid" || kind === "seal" ? SEAL : t.line) } }, label);
  const voters = (names, on) => h("span", { style: { color: on ? SEAL : t.ink } }, names.length ? names.join("、") : "—");
  return h("div", { "data-wk": "askslip", "data-status": st, "data-aid": m.aid || m.pollId || "", style: { position: "relative", width: 260, maxWidth: "100%", background: t.bg2, borderRadius: 3,
      padding: "12px 14px 12px 18px", border: "1px solid " + t.line, boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
      // 左边一道红色装订线
      backgroundImage: "linear-gradient(90deg, transparent 8px, " + SEAL + "33 8px, " + SEAL + "33 9px, transparent 9px)" } },
    // 抬头：红色双线 + 「请 示 单」+ 编号
    h("div", { style: { borderBottom: "3px double " + SEAL, paddingBottom: 6, textAlign: "center", position: "relative" } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(17), color: SEAL, letterSpacing: "0.55em", paddingLeft: "0.55em" } }, "请示单"),
      h("div", { className: "flex justify-between", style: Object.assign({}, small, { fontSize: fs(9.5), marginTop: 2, letterSpacing: "0.05em" }) },
        h("span", null, "No." + no), h("span", null, (a.round > 1 ? "第 " + a.round + " 次递 · " : "") + day))),
    h("div", { style: { marginTop: 4, fontFamily: F_BODY, fontSize: fs(13), color: t.ink, lineHeight: 1.55 } },
      row("事由", h("span", { style: { fontSize: fs(15), fontFamily: F_DISPLAY } }, a.what || ""), "w", { borderTop: "none" }),
      amt ? row("金额", h("span", { "data-wk": "askslipamount", style: { fontVariantNumeric: "tabular-nums" } }, money ? money(amt) : "¥" + amt), "a") : null,
      a.reason ? row("理由", a.reason, "r") : null,
      a.imageRef ? row("附图", h("img", { "data-wk": "askslipimg", src: resolveImg(a.imageRef), alt: "", onClick: e => { e.stopPropagation(); setBig(true); },
        style: { width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 4, display: "block", cursor: "zoom-in" } }), "img") : null,
      (a.before || []).length ? row("前回", (a.before || []).map((b, k) => h("div", { key: k, style: Object.assign({}, small, { textDecoration: "line-through", opacity: 0.75 }) },
        b.reason + (b.note ? "（驳：" + b.note + "）" : ""))), "b") : null,
      group ? row("表决", h("div", { style: { lineHeight: 1.7 } },
        h("div", null, h("span", { style: { color: SEAL, marginRight: 6 } }, "准 " + tl.yes.length), voters(tl.yes, false)),
        h("div", null, h("span", { style: { color: t.fog, marginRight: 6 } }, "驳 " + tl.no.length), voters(tl.no, false))), "v") : null,
      !group && st !== "pending" && m.note ? row("批示", h("span", { style: { fontFamily: F_DISPLAY, fontStyle: "italic" } }, m.note), "n") : null,
      !group && st === "approved" && m.cond ? row("条件", h("span", { "data-wk": "askslipcond", style: { color: SEAL } }, m.cond), "c") : null),
    // 落款
    h("div", { className: "flex justify-between", style: Object.assign({}, small, { borderTop: "1px solid " + t.line, paddingTop: 7, marginTop: 2 }) },
      h("span", null, "呈报 · " + (asker || "")),
      h("span", null, st === "pending" ? h("span", { style: { border: "1px dashed " + t.fog, borderRadius: 3, padding: "0 6px" } }, "待批") : (group ? "众议" : m.judge ? "批 · " + m.judge : "已批"))),
    big && a.imageRef ? appDialogPortal(h("img", { src: resolveImg(a.imageRef), alt: "", onClick: () => setBig(false), style: { maxWidth: "100%", maxHeight: "85vh", objectFit: "contain", borderRadius: 6 } }), () => setBig(false)) : null,
    // 结案印：双圈、斜盖、压在栏目上
    st !== "pending" ? h("div", { "data-wk": "askslipstamp", style: { position: "absolute", right: 14, top: 58, width: 62, height: 62, borderRadius: "50%",
        border: "2.5px solid " + SEAL, boxShadow: "inset 0 0 0 3px " + t.bg2 + ", inset 0 0 0 4px " + SEAL, color: SEAL,
        display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-14deg)", fontFamily: F_DISPLAY, fontWeight: 700,
        fontSize: fs(st === "paid" ? 16 : 26), opacity: 0.82, mixBlendMode: "multiply", pointerEvents: "none" } }, AskSlip.VERDICT[st]) : null,
    onDecide && st === "pending" ? h("div", { className: "flex", style: { gap: 6, marginTop: 10 } },
      btn("准", "solid", () => onDecide("approved"), "y"),
      btn("准，但", "seal", () => requestAppPrompt("准，但是……", "写上你要的条件，他会记着。", "", v => { if (String(v || "").trim()) onDecide("approved", String(v).trim().slice(0, 40)); }, "就这么定"), "c"),
      amt && allowPay ? btn("我出", "seal", () => onDecide("paid"), "p") : null,
      btn("驳", "", () => onDecide("rejected"), "n")) : null,
    onResend && st === "rejected" && !m.resent ? h("div", { className: "flex", style: { gap: 6, marginTop: 10 } }, btn("补充理由再递", "seal", onResend, "r")) : null,
    onVote && st === "pending" ? h("div", { className: "flex", style: { gap: 6, marginTop: 10 } },
      btn(myVote === 0 ? "✓ 准" : "准", myVote === 0 ? "solid" : "seal", () => onVote(0), "y"), btn(myVote === 1 ? "✓ 驳" : "驳", "", () => onVote(1), "n")) : null);
}

// 批完那一刻落的存根（跟转账回执一个意思）：小印 + 编号事由 + 批语/条件 + 钱怎么走的。
//   r：消息上的 askReceipt；whoName(side)：me/char 叫什么；onJump：点了跳回原卡
function AskReceipt({ r, meName, charName, money, onJump }) {
  const t = useTheme();
  const SEAL = "#b8332e", fs = n => "calc(" + n + "px * var(--app-fs, 1))";
  const small = { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, lineHeight: 1.6 };
  const payLine = r.amount ? (r.payer === "me" ? "从你的钱包出了 " : "从" + (charName || "TA") + "的钱包出了 ") + (money ? money(r.amount) : "¥" + r.amount) : "";
  return h("div", { "data-wk": "askreceipt", "data-status": r.status, onClick: onJump, className: onJump ? "active:opacity-80" : "",
      style: { width: 220, maxWidth: "100%", background: t.bg2, border: "1px solid " + t.line, borderTop: "2px dashed " + t.line, borderRadius: "0 0 4px 4px",
        padding: "9px 12px", display: "flex", gap: 10, alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", cursor: onJump ? "pointer" : "default" } },
    h("div", { style: { width: 38, height: 38, flexShrink: 0, borderRadius: "50%", border: "2px solid " + SEAL, boxShadow: "inset 0 0 0 2px " + t.bg2 + ", inset 0 0 0 3px " + SEAL,
      color: SEAL, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-12deg)", fontFamily: F_DISPLAY, fontWeight: 700, fontSize: fs(r.status === "paid" ? 11 : 16) } }, AskSlip.VERDICT[r.status] || ""),
    h("div", { style: { flex: 1, minWidth: 0 } },
      h("div", { style: Object.assign({}, small, { fontSize: fs(9.5), letterSpacing: "0.05em" }) }, "批复 · No." + AskSlip.no(r.aid)),
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(13), color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.what || ""),
      r.group ? h("div", { style: small }, "准 " + r.yes + " : 驳 " + r.no) : null,
      r.note ? h("div", { style: Object.assign({}, small, { color: t.ink, fontStyle: "italic", wordBreak: "break-word" }) }, "「" + r.note + "」") : null,
      r.cond ? h("div", { style: Object.assign({}, small, { color: SEAL, wordBreak: "break-word" }) }, "条件：" + r.cond) : null,
      payLine ? h("div", { style: small }, payLine) : null));
}

// 点回执跳回原卡：原卡还在屏上（没被收进更早的那几页）就滚过去，闪一下
function askJump(aid) {
  try {
    const el = document.querySelector('[data-wk="askslip"][data-aid="' + String(aid).replace(/"/g, "") + '"]');
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.animate && el.animate([{ outline: "2px solid #b8332e" }, { outline: "2px solid transparent" }], { duration: 1200 });
  } catch (e) {}
}
