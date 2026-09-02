// ============================================================
// 备忘录（memo）—— 给自己记的东西，独立小 app。两个 tab：
//   📝 备忘：自由记事（标题+正文+置顶）
//   ⏰ 提醒：现实事情的日期提醒（不重复/每年/每月 + 倒计时），到期当天主屏亮红点
// 角色互动（都按需/临近触发，平时零 token，守聊天预算铁律）：
//   · 到期主动提醒：给提醒勾「可见角色」，到期当天其中一位会主动发消息提醒你（app.js 的早晚安 tick 里扫）
//   · 聊天感知：可见角色在临近时于聊天里自然提起（window.memoNoteFor → ctxFor.memoNote，只读）
//   · 角色批注：点一下让多个角色对某条备忘/提醒各留一句（一次 API 批量出，走便宜后台池 bgActive）
// 数据存 localStorage x_memo，随云同步。和情侣纪念日(x_coupleAnniv)彻底分开：那是和角色的，这是你现实的。
// ============================================================
(function () {
  const ACCENT = "#7a6a9a";   // 备忘录主色（柔紫）
  const AC = () => (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "");
  const NAC = () => (typeof NARRATIVE_ANTI_CLICHE !== "undefined" ? NARRATIVE_ANTI_CLICHE + "\n\n" : "");

  // ---- 数据存取 ----
  function loadData() {
    const d = loadJSON("x_memo", null) || {};
    return { notes: Array.isArray(d.notes) ? d.notes : [], reminders: Array.isArray(d.reminders) ? d.reminders : [] };
  }
  function saveData(d) { saveJSON("x_memo", d); }
  function uid(p) { return (p || "m") + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

  // ---- 时间工具 ----
  // 提醒统一用「锚点日 anchor(YYYY-MM-DD) + repeat」表示，anchor 决定星期几/几号/月-日：
  // none 不重复 · weekly 每周(同星期) · biweekly 每两周 · monthly 每月(同号,短月压到月底) · monthlyEnd 每月最后一天 · yearly 每年(同月日)
  const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  function pad(n) { return String(n).padStart(2, "0"); }
  function todayMid() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function ymdStr(dt) { return dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate()); }
  function parseYmd(s) { const p = String(s || "").split("-").map(Number); return (p.length === 3 && p[0]) ? new Date(p[0], p[1] - 1, p[2]) : null; }
  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
  function lastDayOfMonth(y, m1) { return new Date(y, m1, 0).getDate(); }
  // 兼容旧数据（年/月/日字段）→ 锚点日
  function getAnchor(r) {
    if (r.anchor) return r.anchor;
    if (r.year && r.month && r.day) return r.year + "-" + pad(r.month) + "-" + pad(r.day);
    const now = new Date();
    if (r.month && r.day) return now.getFullYear() + "-" + pad(r.month) + "-" + pad(r.day);
    if (r.day) return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(r.day);
    return null;
  }
  // 某提醒是否落在 dateObj 这天
  function occursOn(r, dateObj) {
    const a = parseYmd(getAnchor(r)); if (!a) return false; a.setHours(0, 0, 0, 0);
    const d = new Date(dateObj); d.setHours(0, 0, 0, 0);
    const rp = r.repeat || "none";
    if (rp === "none") return d.getTime() === a.getTime();
    if (rp === "monthlyEnd") return d.getDate() === lastDayOfMonth(d.getFullYear(), d.getMonth() + 1);
    if (rp === "monthly") { const day = Math.min(a.getDate(), lastDayOfMonth(d.getFullYear(), d.getMonth() + 1)); return d.getDate() === day; }
    if (rp === "yearly") { const day = Math.min(a.getDate(), lastDayOfMonth(d.getFullYear(), d.getMonth() + 1)); return d.getMonth() === a.getMonth() && d.getDate() === day; }
    if (d < a) return false; // 每周/每两周：锚点日之前不算
    if (rp === "weekly") return d.getDay() === a.getDay();
    if (rp === "biweekly") return Math.round((d - a) / 86400000) % 14 === 0;
    return false;
  }
  // 下次发生（从今天起）→ {dt, days}；none 可能 days<0（逾期）
  function nextOccur(r, today) {
    today = today || todayMid();
    const a = parseYmd(getAnchor(r)); if (!a) return null; a.setHours(0, 0, 0, 0);
    if ((r.repeat || "none") === "none") return { dt: a, days: daysBetween(today, a) };
    for (let i = 0; i < 400; i++) { const d = new Date(today.getTime() + i * 86400000); if (occursOn(r, d)) return { dt: d, days: i }; }
    return null;
  }
  function cdLabel(days) {
    if (days === 0) return "今天";
    if (days === 1) return "明天";
    if (days > 1) return "还有 " + days + " 天";
    return "已过 " + (-days) + " 天";
  }
  function cdColor(days, t) {
    if (days < 0) return "#c25a4a";        // 逾期
    if (days === 0) return ACCENT;          // 今天
    if (days <= 3) return "#b89150";        // 临近
    return t.fog;
  }
  function repeatLabel(rp) { return { weekly: "每周", biweekly: "每两周", monthly: "每月", monthlyEnd: "月底", yearly: "每年" }[rp] || "一次"; }
  function reminderDateText(r) {
    const a = parseYmd(getAnchor(r)); const rp = r.repeat || "none";
    if (rp === "weekly") return "每周" + (a ? WEEK[a.getDay()] : "");
    if (rp === "biweekly") return "每两周（周" + (a ? WEEK[a.getDay()] : "") + "）";
    if (rp === "monthly") return "每月 " + (a ? a.getDate() : "?") + " 号";
    if (rp === "monthlyEnd") return "每月最后一天";
    if (rp === "yearly") return "每年 " + (a ? (a.getMonth() + 1) + " 月 " + a.getDate() + " 日" : "");
    return a ? (a.getFullYear() + " 年 " + (a.getMonth() + 1) + " 月 " + a.getDate() + " 日") : "?";
  }

  // ============================================================
  // 供聊天引擎：可见角色 + 临近/逾期的提醒（+ 用户主动共享的备忘）→ 一段（memoNote）
  // 只读、只感知；平时（无临近提醒、无共享备忘）返回空串 → 不进 prompt。
  // ============================================================
  window.memoNoteFor = function (charId) {
    try {
      const d = loadData();
      const uName = (loadJSON("x_profile", {}) || {}).name || "用户";
      const today = todayMid();
      const lines = [];
      (d.reminders || []).forEach(r => {
        if (r.done) return;
        if (!(r.visibleTo || []).includes(charId)) return;
        const nx = nextOccur(r, today); if (!nx) return;
        const what = "「" + r.title + "」" + (r.note ? "（" + r.note + "）" : "")
          + (r.startTime ? "（" + r.startTime + "）" : "");
        if (nx.days === 0) lines.push("今天是 " + uName + " 要 " + what + " 的日子。Ta 特意让你知道这事，可自然提醒/关心一句，别硬邦邦报事项。");
        else if (nx.days > 0 && nx.days <= 2) lines.push("再过 " + nx.days + " 天 " + uName + " 要 " + what + "，你心里有数，临近了可自然提一嘴。");
        else if (nx.days < 0) lines.push(uName + " 之前记着要 " + what + "（" + (-nx.days) + " 天前就该做了、好像还没勾掉），你可以关心一下弄了没。");
        // ⚠️【是你自己替 Ta 记的】那几条，不管还有多远都得知道。
        // 原来只有「今天／两天内／逾期」才进上下文，于是她让他记下周三的会，
        // 他记完转头就忘了，要到临近那两天才想起来——刚答应过的事不该是这样。
        else if (r.byChar === charId) lines.push("是你替 " + uName + " 记下的：" + nx.days + " 天后 " + what + "。别老提，但心里有这回事。");
      });
      (d.notes || []).forEach(n => {
        if (!(n.visibleTo || []).includes(charId)) return;
        if (!n.title && !n.body) return;
        lines.push(uName + " 在备忘录里记着「" + (n.title || String(n.body).replace(/\s+/g, " ").slice(0, 24)) + "」，Ta 愿意让你看到（聊到相关可自然接住）。");
      });
      return lines.slice(0, 6).join("\n");
    } catch (e) { return ""; }
  };
  // 角色替她记一笔（她 2026-08-30：「我跟他们说帮我记下周三十点的会，他们就真的能帮我记」）。
  // ⚠️写入口只此一处，校验也只写一处：日期不合法就不落盘，宁可不记也别记错一条她以为记上了的事。
  // visibleTo 默认带上【记这一笔的那个角色】——是他替她记的，他当然知道这件事。
  const MEMO_CAP = 200;
  window.memoAddByChar = function (charId, r) {
    try {
      if (!r || !String(r.title || "").trim()) return null;
      const anchor = String(r.date || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return null;      // 模型给的日期必须是真日期
      const dt = parseYmd(anchor);
      if (!dt || isNaN(dt.getTime())) return null;
      const t0 = String(r.time || "").trim();
      const startTime = /^\d{1,2}:\d{2}$/.test(t0) ? t0 : "";
      const repeat = ["none", "weekly", "biweekly", "monthly", "monthlyEnd", "yearly"].indexOf(r.repeat) >= 0 ? r.repeat : "none";
      const d = loadData();
      const item = {
        id: uid("r"), title: String(r.title).trim().slice(0, 40), note: String(r.note || "").trim().slice(0, 120),
        repeat: repeat, anchor: anchor, startTime: startTime, endTime: "", done: false,
        visibleTo: charId ? [charId] : [], comments: [], createdTs: Date.now(), byChar: charId || ""
      };
      d.reminders = [item].concat(d.reminders || []).slice(0, MEMO_CAP);
      saveData(d);
      return item;
    } catch (e) { return null; }
  };
  // 给 app.js 用：某提醒距下次发生几天（今天=0，逾期<0，无效=null）—— 主屏红点 + 到期主动提醒
  window.memoNextDays = function (r) { const nx = nextOccur(r, todayMid()); return nx ? nx.days : null; };
  // 今天到期(未完成)的提醒数量 —— 主屏图标红点
  window.memoDueToday = function () {
    try { const d = loadData(); return (d.reminders || []).filter(r => !r.done && window.memoNextDays(r) === 0).length; }
    catch (e) { return 0; }
  };
  // 某天(y, m1一based, d)落在其上的提醒 —— 供日历显示（item 7）
  window.memoRemindersOnDay = function (y, m1, d) {
    try { const dt = new Date(y, m1 - 1, d); const data = loadData(); return (data.reminders || []).filter(r => occursOn(r, dt)); }
    catch (e) { return []; }
  };
  // 日历那边点一块带时刻的提醒 → 跳回备忘录、直接把这条的详情打开。
  // 她 2026-08-26：「点开可以看细节跟备忘录那边打开细节是一样的」——那就别在日历里
  // 复刻一份详情（批注、可见角色、打勾），直接把她送到【同一个】详情面板去。
  window.memoOpenReminder = function (id) {
    try { window.__memoOpenId = id; if (typeof window.memoGoApp === "function") window.memoGoApp(); } catch (e) {}
  };
  // 最近的 n 条未完成提醒（逾期在前，按临近排）—— 供主屏备忘录小组件
  window.memoUpcoming = function (n) {
    try {
      const d = loadData();
      return (d.reminders || []).filter(r => !r.done)
        .map(r => ({ title: r.title || "提醒", days: window.memoNextDays(r) }))
        .filter(x => x.days != null)
        .sort((a, b) => a.days - b.days)
        .slice(0, n || 3);
    } catch (e) { return []; }
  };

  // ============================================================
  // 批注：一次 API 让多个角色各对这条备忘/提醒说一句（走后台便宜池 active=bgActive）
  // ============================================================
  async function genComments(active, itemDesc, list, uName, worldbook, opts) {
    // 防复读素材（本地零 API）：该角色最近对别的备忘/提醒说过什么 → 逼 Ta 换新说法
    const d0 = loadData();
    const allItems = (d0.notes || []).concat(d0.reminders || []);
    const prevOf = id => allItems.filter(x => x.id !== (opts && opts.excludeId)).flatMap(x => (x.comments || []).filter(cm => cm.charId === id).map(cm => String(cm.text || ""))).filter(Boolean).slice(0, 2);
    const block = list.map((it, i) => (i + 1) + "、「" + it.name + "」\n  人设：" + (it.persona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 320) + (it.mood ? "\n  此刻心情：" + it.mood : "")
      + (it.aff != null ? "\n  对 " + uName + " 的好感度：" + Math.round(it.aff) + "/100（据此把握语气的亲疏和上不上心的程度）" : "")
      + (prevOf(it.id).length ? "\n  Ta 最近对别的备忘说过：" + prevOf(it.id).map(s => "「" + s.slice(0, 40) + "」").join("、") + "——这次必须换新的说法和角度，别复读同样的梗和句式" : "")).join("\n\n");
    // 事件驱动模式：不是用户请 Ta 来看，而是 Ta 自己注意到这条提醒被办完了、主动开口的第一反应
    const evIntro = opts && opts.event
      ? "下面这条是 " + uName + " 备忘录里的提醒，Ta 刚把它标为完成——" + opts.event.desc + "。下面每位角色恰好【自己注意到】了这事。请【分别以每位角色本人的口吻】，各说一句 Ta 主动开口的第一反应：夸一句、松口气、打趣 Ta 拖延、心疼 Ta 辛苦都行，按各自人设来。\n"
      : "下面是 " + uName + " 在自己备忘录里记下的一条东西。请【分别以下面每位角色本人的口吻】，各说一句 Ta 看到 " + uName + " 记的这条时会真实说出口的话。\n";
    const sys = AC() + NAC() +
      evIntro +
      "【硬性要求】\n" +
      "· 真的进入角色、说出有内容有态度的一句，结合人设＋此刻心情＋这条的内容。严禁敷衍成『看了一眼没说什么』『随你』这类空话。\n" +
      "· 人称必须对：从人设判断性别，男用「他」女用「她」，判断不出就叫名字或不用第三人称。绝不许写『Ta』『TA』占位符。\n" +
      "· 每人一句、口语、像随手发的消息；几个人语气各不相同，别一个腔调，别说教别客套。\n" +
      (opts && opts.event ? "" : "· 反应可多样：提醒你别忘、催你、心疼、调侃、替你操心、或只是顺口关心——按各自人设来。\n") + "\n" +
      "【这条备忘】" + itemDesc + "\n\n" +
      "【要批注的角色】\n" + block +
      (worldbook && worldbook.trim() ? "\n\n【世界书（仅参考）】\n" + worldbook.trim().slice(0, 400) : "") +
      "\n\n【输出】只输出 JSON，comments 数组和上面角色顺序【一一对应、数量一致】：{\"comments\":[{\"name\":\"角色名\",\"text\":\"这位角色的一句话\"}...]}。别加解释、别加代码块。";
    const raw = await callAI(active, sys, [{ role: "user", content: "开始批注。" }], { maxTokens: 14000 });
    const p = extractJSON(raw) || {};
    const arr = Array.isArray(p.comments) ? p.comments : (Array.isArray(p) ? p : []);
    return list.map((it, i) => {
      const byName = arr.find(r => r && r.name && String(r.name).trim() === it.name);
      const r = byName || arr[i];
      const txt = r && (r.text || r.comment) ? String(r.text || r.comment).trim() : "";
      return { charId: it.id, name: it.name, text: txt, ts: Date.now() };
    }).filter(c => c.text);
  }

  // ---- 选角色批注（多选，排除已批注的）----
  function CommentPicker(props) {
    const t = useTheme();
    const [sel, setSel] = useState([]);
    const avail = (props.characters || []).filter(c => !(props.existing || []).includes(c.id));
    const allSel = avail.length > 0 && sel.length === avail.length;
    const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    // ⚠必须 portal 挂 body：这层从「详情 Sheet」里打开，Sheet 的 fadeUp 动画(fill:both)保留了 transform，
    // fixed 会被劫持成相对 Sheet 定位+被其 overflow 裁头——就是她两次报「标题被顶没了」的根因
    // 结构铁律：头/尾 shrink-0、只有中间列表滚；容器 overflow hidden 兜底
    return ReactDOM.createPortal(h("div", { className: "fixed inset-0 z-[90] flex items-end", style: { background: "rgba(20,19,15,0.4)" }, onClick: props.onClose },
      h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", background: t.bg2, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "18px 18px 22px", maxHeight: "78vh", display: "flex", flexDirection: "column", overflow: "hidden", animation: "fadeUp .2s ease both" } },
        h("div", { className: "flex items-center justify-between shrink-0", style: { marginBottom: 4 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "让谁来批注"),
          avail.length > 1 && h("button", { onClick: () => setSel(allSel ? [] : avail.map(c => c.id)), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: ACCENT } }, allSel ? "全不选" : "全选")),
        h("div", { className: "shrink-0", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 12 } }, "选中的角色会各说一句（一次生成，走便宜后台池）"),
        avail.length === 0 ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "10px 0" } }, "没有可批注的角色了。")
          : h("div", { style: { display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", WebkitOverflowScrolling: "touch", flex: "1 1 auto", minHeight: 0, margin: "0 -4px", padding: "0 4px" } }, avail.map(c => h("button", { key: c.id, onClick: () => toggle(c.id), className: "w-full flex items-center gap-3 active:opacity-70 shrink-0", style: { padding: "7px 4px", textAlign: "left" } },
            h(Avatar, { character: c, size: 34, radius: 999 }),
            h("span", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.remark || c.name),
            h("span", { style: { width: 22, height: 22, borderRadius: 999, border: "2px solid " + (sel.includes(c.id) ? ACCENT : t.line), background: sel.includes(c.id) ? ACCENT : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, flexShrink: 0 } }, sel.includes(c.id) ? "✓" : "")))),
        h("div", { className: "flex gap-2 shrink-0", style: { marginTop: 14 } },
          h("button", { onClick: props.onClose, className: "flex-1 active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub, background: t.bg, border: "1px solid " + t.line, borderRadius: 14, padding: "11px 0" } }, "取消"),
          h("button", { onClick: () => sel.length && props.onPick(sel), disabled: !sel.length || props.busy, className: "flex-1 active:opacity-80 disabled:opacity-40", style: { fontFamily: F_DISPLAY, fontSize: 14, color: "#fff", background: ACCENT, borderRadius: 14, padding: "11px 0" } }, props.busy ? "生成中…" : "让 TA 们说 (" + sel.length + ")")))), document.body);
  }

  // ---- 谁可以看到（可见角色）----
  function VisiblePicker(props) {
    const t = useTheme();
    const [sel, setSel] = useState((props.value || []).slice());
    const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    // portal 挂 body：同 CommentPicker，躲开详情 Sheet 的 transform 劫持 fixed
    return ReactDOM.createPortal(h("div", { className: "fixed inset-0 z-[90] flex items-end", style: { background: "rgba(20,19,15,0.4)" }, onClick: props.onClose },
      h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", background: t.bg2, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "18px 18px 22px", maxHeight: "78vh", display: "flex", flexDirection: "column", overflow: "hidden", animation: "fadeUp .2s ease both" } },
        h("div", { className: "shrink-0", style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, marginBottom: 4 } }, "谁能看到 / 提醒你"),
        h("div", { className: "shrink-0", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 12 } }, "选中的角色：临近时会在聊天里自然提起；到期当天可能主动发消息提醒你。"),
        (props.characters || []).length === 0 ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "还没有角色。")
          : h("div", { style: { display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", WebkitOverflowScrolling: "touch", flex: "1 1 auto", minHeight: 0, margin: "0 -4px", padding: "0 4px" } }, (props.characters || []).map(c => h("button", { key: c.id, onClick: () => toggle(c.id), className: "w-full flex items-center gap-3 active:opacity-70 shrink-0", style: { padding: "7px 4px", textAlign: "left" } },
            h(Avatar, { character: c, size: 34, radius: 999 }),
            h("span", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.remark || c.name),
            h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: sel.includes(c.id) ? ACCENT : t.fog } }, sel.includes(c.id) ? "✓ 可见" : "不可见")))),
        h("button", { onClick: () => props.onSave(sel), className: "w-full active:opacity-80 shrink-0", style: { marginTop: 14, fontFamily: F_DISPLAY, fontSize: 14.5, color: "#fff", background: t.ink, borderRadius: 14, padding: "12px 0" } }, "保存"))), document.body);
  }

  // ---- 批注区块（备忘/提醒详情共用）----
  function CommentBlock(props) {
    const t = useTheme();
    const [pick, setPick] = useState(false);
    const [busy, setBusy] = useState(false);
    const comments = props.comments || [];
    const doGen = async ids => {
      setBusy(true);
      try {
        const list = ids.map(id => (props.characters || []).find(c => c.id === id)).filter(Boolean)
          .map(c => ({ id: c.id, name: c.name, persona: c.persona || "", mood: (props.moods && props.moods[c.id] && props.moods[c.id].label) || "", aff: props.affinities ? props.affinities[c.id] : null }));
        const lore = props.worldbookFor ? props.worldbookFor(ids, props.itemDesc) : props.worldbook;
        const outs = await genComments(props.active, props.itemDesc, list, props.uName, lore, { excludeId: props.itemId });
        if (outs.length) props.onAdd(outs);
        else props.toast && props.toast("没生成出来，再试试");
      } catch (e) { props.toast && props.toast("批注失败：" + (e.message || e)); }
      finally { setBusy(false); setPick(false); }
    };
    return h("div", { style: { marginTop: 18 } },
      h("div", { className: "flex items-center justify-between", style: { marginBottom: 10 } },
        h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, letterSpacing: "0.05em" } }, "角色批注" + (comments.length ? " · " + comments.length : "")),
        h("button", { onClick: () => setPick(true), className: "active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: ACCENT, border: "1px solid " + ACCENT + "55", borderRadius: 999, padding: "4px 12px" } }, comments.length ? "再让 TA 们说说" : "让角色批注")),
      comments.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } }, comments.map((cm, i) => {
        const c = (props.characters || []).find(x => x.id === cm.charId) || { name: cm.name, color: "#8a8a8a" };
        return h("div", { key: i, className: "flex items-start gap-2.5" },
          h(Avatar, { character: c, size: 30, radius: 999 }),
          h("div", { style: { flex: 1, background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "9px 12px" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: t.sub, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 } }, c.remark || c.name || cm.name,
              cm.auto ? h("span", { style: { fontFamily: F_BODY, fontSize: 9.5, color: ACCENT, border: "1px solid " + ACCENT + "55", borderRadius: 999, padding: "1px 7px" } }, "自己注意到 · 办完了") : null),
            h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, lineHeight: 1.5 } }, cm.text),
            h("button", { onClick: () => props.onDel(i), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4 } }, "删除")));
      })) : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "还没有角色批注。"),
      pick && h(CommentPicker, { characters: props.characters, existing: comments.map(c => c.charId), busy: busy, onPick: doGen, onClose: () => !busy && setPick(false) }));
  }

  // ---- 提醒 编辑表单 ----
  function ReminderForm(props) {
    const t = useTheme();
    const r = props.initial || {};
    const [title, setTitle] = useState(r.title || "");
    const [note, setNote] = useState(r.note || "");
    const [repeat, setRepeat] = useState(r.repeat || "none");
    const [anchor, setAnchor] = useState(getAnchor(r) || ymdStr(new Date()));
    // 起止时刻（v56.35，她 2026-08-26 要的）：填了就不再只挂在日历顶部，
    // 而是落进那天的时间轴、跟别的日程一样是一块。留空＝全天，行为和以前一模一样。
    const [startTime, setStartTime] = useState(r.startTime || "");
    const [endTime, setEndTime] = useState(r.endTime || "");
    const aDate = parseYmd(anchor);
    const save = () => {
      if (!title.trim()) { props.toast && props.toast("写点要提醒的事"); return; }
      if (!parseYmd(anchor)) { props.toast && props.toast("选个日期"); return; }
      // 只存 anchor+repeat；清掉旧的 year/month/day 字段免得歧义
      const clean = Object.assign({}, r); delete clean.year; delete clean.month; delete clean.day;
      props.onSave(Object.assign(clean, { id: r.id || uid("r"), title: title.trim(), note: note.trim(), repeat: repeat, anchor: anchor, startTime: startTime || "", endTime: startTime ? (endTime || "") : "", done: !!r.done, visibleTo: r.visibleTo || [], comments: r.comments || [], createdTs: r.createdTs || Date.now() }));
    };
    const inp = { width: "100%", background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 13px", fontFamily: F_BODY, fontSize: 14.5, color: t.ink, outline: "none" };
    const rchip = (v, lbl) => h("button", { onClick: () => setRepeat(v), className: "active:opacity-70 shrink-0", style: { fontFamily: F_BODY, fontSize: 12.5, padding: "6px 12px", borderRadius: 999, background: repeat === v ? ACCENT : "transparent", color: repeat === v ? "#fff" : t.sub, border: "1px solid " + (repeat === v ? ACCENT : t.line) } }, lbl);
    // 选中日期 + 重复方式 → 一句人话解释这条会什么时候提醒
    const explain = !aDate ? "" : repeat === "none" ? "只在这一天提醒一次。"
      : repeat === "weekly" ? "每周" + WEEK[aDate.getDay()] + "提醒。"
      : repeat === "biweekly" ? "从这天起，每两周的周" + WEEK[aDate.getDay()] + "提醒一次。"
      : repeat === "monthly" ? "每月 " + aDate.getDate() + " 号提醒" + (aDate.getDate() >= 29 ? "（碰上没这天的短月，自动落到当月最后一天）" : "") + "。"
      : repeat === "monthlyEnd" ? "每月最后一天提醒（自动适配 28/29/30/31）。"
      : "每年 " + (aDate.getMonth() + 1) + " 月 " + aDate.getDate() + " 日提醒。";
    return h(Sheet, { onClose: props.onClose, tall: true },
      h("div", { className: "flex items-center justify-between mb-3" },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: t.ink } }, props.initial ? "编辑提醒" : "新提醒"),
        h("button", { onClick: save, className: "active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 14, color: ACCENT } }, "保存")),
      h("input", { value: title, onChange: e => setTitle(e.target.value), placeholder: "要提醒的事（如 交房租 / 妈妈生日 / 复诊）", style: Object.assign({}, inp, { marginBottom: 10 }) }),
      h("input", { value: note, onChange: e => setNote(e.target.value), placeholder: "备注（可空）", style: Object.assign({}, inp, { marginBottom: 14 }) }),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 7 } }, repeat === "monthlyEnd" ? "日期（月底模式下只用来定从哪个月起）" : "日期"),
      h("input", { type: "date", value: anchor, onChange: e => setAnchor(e.target.value), style: Object.assign({}, inp, { marginBottom: 14 }) }),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 7 } }, "时间（留空＝全天，只挂在日历顶部）"),
      h("div", { className: "flex gap-3", style: { marginBottom: 5 } },
        h("input", { type: "time", value: startTime, onChange: e => setStartTime(e.target.value), style: Object.assign({}, inp, { flex: 1, minWidth: 0 }) }),
        h("input", { type: "time", value: endTime, disabled: !startTime, onChange: e => setEndTime(e.target.value), style: Object.assign({}, inp, { flex: 1, minWidth: 0 }, startTime ? null : { opacity: 0.45 }) })),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 14 } }, startTime ? "会画在日历那天的时间轴上" : "全天：画在日历顶部那一条"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 7 } }, "重复"),
      h("div", { className: "flex gap-2 flex-wrap", style: { marginBottom: 10 } }, rchip("none", "不重复"), rchip("weekly", "每周"), rchip("biweekly", "每两周"), rchip("monthly", "每月"), rchip("monthlyEnd", "每月最后一天"), rchip("yearly", "每年")),
      explain && h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint, lineHeight: 1.5, background: ACCENT + "10", borderRadius: 10, padding: "8px 11px" } }, explain),
      props.initial && h("button", { onClick: () => props.onDelete(r.id), className: "w-full active:opacity-70", style: { marginTop: 22, fontFamily: F_BODY, fontSize: 13, color: "#c25a4a" } }, "删除这条提醒"));
  }

  // ---- 备忘 编辑表单 ----
  function NoteForm(props) {
    const t = useTheme();
    const n = props.initial || {};
    const [title, setTitle] = useState(n.title || "");
    const [body, setBody] = useState(n.body || "");
    const save = () => {
      if (!title.trim() && !body.trim()) { props.toast && props.toast("写点东西"); return; }
      props.onSave(Object.assign({}, n, { id: n.id || uid("n"), title: title.trim(), body: body.trim(), pinned: !!n.pinned, visibleTo: n.visibleTo || [], comments: n.comments || [], ts: n.ts || Date.now(), updatedTs: Date.now() }));
    };
    const inp = { width: "100%", background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 13px", fontFamily: F_BODY, color: t.ink, outline: "none" };
    return h(Sheet, { onClose: props.onClose, tall: true },
      h("div", { className: "flex items-center justify-between mb-3" },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: t.ink } }, props.initial ? "编辑备忘" : "新备忘"),
        h("button", { onClick: save, className: "active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 14, color: ACCENT } }, "保存")),
      h("input", { value: title, onChange: e => setTitle(e.target.value), placeholder: "标题", style: Object.assign({}, inp, { fontSize: 16, marginBottom: 10 }) }),
      h("textarea", { value: body, onChange: e => setBody(e.target.value), placeholder: "随手记点什么…", rows: 8, style: Object.assign({}, inp, { fontSize: 14.5, lineHeight: 1.6, resize: "none" }) }),
      props.initial && h("button", { onClick: () => props.onDelete(n.id), className: "w-full active:opacity-70", style: { marginTop: 20, fontFamily: F_BODY, fontSize: 13, color: "#c25a4a" } }, "删除这条备忘"));
  }

  // ============================================================
  // 主组件
  // ============================================================
  function Memo(props) {
    const t = useTheme();
    const [data, setData] = useState(loadData);
    const [tab, setTab] = useState("reminders");   // reminders | notes
    const [form, setForm] = useState(null);        // {kind:'reminder'|'note', item?}
    const [detail, setDetail] = useState(null);    // {kind, id}
    // 从日历点某条提醒进来：memoOpenReminder 把 id 放在 __memoOpenId，这里接住并打开详情。
    // fromCal 记着「是从日历过来的」——她 2026-08-26：从日历进的，退出来要回日历，
    // 不能把她扔在备忘录里；从备忘录自己点开的照旧留在备忘录。
    const [fromCal, setFromCal] = useState(false);
    useEffect(() => {
      const want = typeof window !== "undefined" ? window.__memoOpenId : null;
      if (!want) return;
      window.__memoOpenId = null;
      setTab("reminders"); setDetail({ kind: "reminder", id: want }); setFromCal(true);
    }, []);
    // 从日历来的：任何一种「看完了」都送回日历——关详情、删掉、或者编辑完关掉表单。
    // 中途点「编辑」不算看完，那一步只是把详情换成表单，旗子要留着。
    const leaveIfFromCal = () => {
      if (!fromCal) return false;
      setFromCal(false);
      if (typeof window.calOpenFromMemo === "function") { window.calOpenFromMemo(); return true; }
      return false;
    };
    const closeDetail = () => { setDetail(null); leaveIfFromCal(); };
    const backOut = () => { if (!leaveIfFromCal()) props.onBack && props.onBack(); };
    const [visFor, setVisFor] = useState(null);    // 正在设可见角色的 {kind,id}
    const persist = updater => setData(prev => { const n = typeof updater === "function" ? updater(prev) : updater; saveData(n); return n; });

    const upReminder = (id, patch) => persist(d => ({ ...d, reminders: (d.reminders || []).map(r => r.id === id ? Object.assign({}, r, typeof patch === "function" ? patch(r) : patch) : r) }));
    const uName = (props.profile && props.profile.name) || "用户";
    // 事件驱动一次性反应：勾掉一条「可见」的到期/逾期提醒 → 好感最高的可见角色自己注意到、留一句批注
    // 本地判定零常驻：提前完成不吱声，没可见角色/今天已反应过=零 API；反应只留在批注区，不进聊天 prompt
    const autoReactDone = r => {
      try {
        if (!props.active || r.done) return;   // r 是勾之前的快照，勾完才算完成
        const vis = (r.visibleTo || []).filter(id => (props.characters || []).some(c => c.id === id));
        if (!vis.length) return;
        const nd = window.memoNextDays(r);
        if (nd == null || nd > 0) return;      // 到期当天办完 / 拖了几天补办 才有戏
        const dayK = ymdStr(todayMid());
        const log = loadJSON("x_memoDoneReactLog", {});
        if (log[r.id] === dayK) return;        // 同一天反复勾/取消不重复反应
        log[r.id] = dayK; saveJSON("x_memoDoneReactLog", log);
        const aff = props.affinities || {};
        const cid = vis.slice().sort((x, y) => (aff[y] != null ? aff[y] : 50) - (aff[x] != null ? aff[x] : 50))[0];
        const c = (props.characters || []).find(x => x.id === cid);
        if (!c) return;
        const hour = new Date().getHours();
        const desc = (nd < 0 ? "这件事拖了 " + (-nd) + " 天，Ta 今天终于办完勾掉了" : "Ta 今天按时把这事办完勾掉了") + (hour < 5 ? "（还是深夜 " + (hour === 0 ? "十二" : hour) + " 点多勾掉的）" : "");
        const list = [{ id: c.id, name: c.name, persona: c.persona || "", mood: (props.moods && props.moods[c.id] && props.moods[c.id].label) || "", aff: aff[c.id] }];
        const itemDesc = "提醒 · " + r.title + "（" + reminderDateText(r) + "）" + (r.note ? " · 备注：" + r.note : "");
        const lore = props.worldbookFor ? props.worldbookFor([c.id], itemDesc) : props.worldbook;
        genComments(props.active, itemDesc, list, uName, lore, { event: { key: "done", desc }, excludeId: r.id }).then(outs => {
          const cmts = (outs || []).filter(o => o && o.text).map(o => Object.assign({}, o, { auto: true, event: "done" }));
          if (!cmts.length) return;
          if (!loadData().reminders.some(x => x.id === r.id)) return; // 用户已把这条删了就算了
          upReminder(r.id, x => ({ comments: (x.comments || []).concat(cmts) }));
          props.toast && props.toast(c.name + " 注意到你办完了「" + r.title + "」");
        }).catch(() => {/* 静默：主动反应失败不打扰勾选本身 */});
      } catch (e) {}
    };
    const upNote = (id, patch) => persist(d => ({ ...d, notes: (d.notes || []).map(n => n.id === id ? Object.assign({}, n, typeof patch === "function" ? patch(n) : patch) : n) }));
    const saveReminder = r => persist(d => ({ ...d, reminders: (d.reminders || []).some(x => x.id === r.id) ? d.reminders.map(x => x.id === r.id ? r : x) : [r, ...(d.reminders || [])] }));
    const saveNote = n => persist(d => ({ ...d, notes: (d.notes || []).some(x => x.id === n.id) ? d.notes.map(x => x.id === n.id ? n : x) : [n, ...(d.notes || [])] }));
    const delReminder = id => { persist(d => ({ ...d, reminders: (d.reminders || []).filter(r => r.id !== id) })); setForm(null); setDetail(null); };
    const delNote = id => { persist(d => ({ ...d, notes: (d.notes || []).filter(n => n.id !== id) })); setForm(null); setDetail(null); };

    const today = todayMid();
    const reminders = (data.reminders || []).slice().sort((a, b) => {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      const da = window.memoNextDays(a), db = window.memoNextDays(b);
      return (da == null ? 9999 : da) - (db == null ? 9999 : db);
    });
    const notes = (data.notes || []).slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedTs || 0) - (a.updatedTs || 0));

    const tabBtn = (k, lbl) => h("button", { onClick: () => setTab(k), className: "flex-1 active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 14.5, padding: "9px 0", color: tab === k ? "#fff" : t.sub, background: tab === k ? ACCENT : "transparent", borderRadius: 12 } }, lbl);

    // 日历里【我的】日程也在这儿露一面（她 2026-08-26：「在日历建的日程，备忘录那边也要体现出来」）。
    // 只读：数据仍然只有日历那一份，点了跳回日历改。不做双写——改了一边没改另一边、
    // 删了一个留下孤儿，这种飘是迟早的事。
    const calUpcoming = (typeof window.calMyUpcoming === "function" ? window.calMyUpcoming(30) : []) || [];
    const calSection = () => calUpcoming.length ? h("div", { style: { marginBottom: 16 } },
      h("div", { className: "flex items-center justify-between", style: { marginBottom: 8 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: "0.1em", color: t.fog } }, "日历里的日程 · 30 天内"),
        h("button", { onClick: () => { typeof window.calOpenFromMemo === "function" && window.calOpenFromMemo(); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: ACCENT } }, "去日历 ›")),
      h("div", { className: "flex flex-col gap-2" }, calUpcoming.slice(0, 8).map(e => h("button", {
        key: e.id, onClick: () => { typeof window.calOpenFromMemo === "function" && window.calOpenFromMemo(); },
        className: "w-full active:opacity-70 flex items-center gap-2.5",
        style: { textAlign: "left", background: t.bg2, border: "1px dashed " + t.line, borderRadius: 12, padding: "9px 12px" }
      },
        h("span", { className: "shrink-0", style: { fontSize: 15 } }, e.icon || "🗓️"),
        h("div", { style: { flex: 1, minWidth: 0 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, e.title),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 1 } },
            e.date.slice(5).replace("-", "月") + "日" + (e.time ? " " + e.time : " 全天") + (e.location ? " · " + e.location : ""))),
        h("span", { className: "shrink-0", style: { fontFamily: F_DISPLAY, fontSize: 12, color: t.fog } }, e.days === 0 ? "今天" : e.days === 1 ? "明天" : e.days + " 天后"))))) : null;
    // 提醒行
    const reminderRow = r => {
      const days = window.memoNextDays(r);
      const done = !!r.done;
      return h("button", { key: r.id, onClick: () => setDetail({ kind: "reminder", id: r.id }), className: "w-full active:opacity-70 flex items-center gap-3", style: { textAlign: "left", background: t.bg2, border: "1px solid " + t.line, borderRadius: 16, padding: "12px 14px", opacity: done ? 0.55 : 1 } },
        h("button", { onClick: e => { e.stopPropagation(); autoReactDone(r); upReminder(r.id, { done: !r.done }); }, className: "shrink-0 active:opacity-60", style: { width: 24, height: 24, borderRadius: 999, border: "2px solid " + (done ? ACCENT : t.line), background: done ? ACCENT : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13 } }, done ? "✓" : ""),
        h("div", { style: { flex: 1, minWidth: 0 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink, textDecoration: done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.title),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2 } }, reminderDateText(r) + (r.startTime ? " " + r.startTime + (r.endTime ? "–" + r.endTime : "") : "") + " · " + repeatLabel(r.repeat) + ((r.comments || []).length ? " · 💬" + r.comments.length : "") + ((r.visibleTo || []).length ? " · 👁" + r.visibleTo.length : ""))),
        !done && days != null && h("span", { className: "shrink-0", style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: cdColor(days, t), background: cdColor(days, t) + "18", borderRadius: 999, padding: "3px 10px" } }, cdLabel(days)));
    };
    // 备忘行
    const noteRow = n => h("button", { key: n.id, onClick: () => setDetail({ kind: "note", id: n.id }), className: "w-full active:opacity-70", style: { textAlign: "left", background: t.bg2, border: "1px solid " + t.line, borderRadius: 16, padding: "13px 15px" } },
      h("div", { className: "flex items-center gap-2" },
        n.pinned && h("span", { style: { fontSize: 12 } }, "📌"),
        h("div", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, n.title || "（无标题）")),
      n.body && h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, marginTop: 3, lineHeight: 1.5, maxHeight: 34, overflow: "hidden" } }, n.body),
      ((n.comments || []).length || (n.visibleTo || []).length) && h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 5 } }, ((n.comments || []).length ? "💬" + n.comments.length + "  " : "") + ((n.visibleTo || []).length ? "👁" + n.visibleTo.length : "")));

    // 详情
    const curReminder = detail && detail.kind === "reminder" ? (data.reminders || []).find(r => r.id === detail.id) : null;
    const curNote = detail && detail.kind === "note" ? (data.notes || []).find(n => n.id === detail.id) : null;
    const visTarget = visFor && (visFor.kind === "reminder" ? (data.reminders || []).find(r => r.id === visFor.id) : (data.notes || []).find(n => n.id === visFor.id));

    return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
      h(Head, { zh: "备忘录", en: "Memo", onBack: backOut,
        right: h("button", { onClick: () => setForm({ kind: tab === "notes" ? "note" : "reminder" }), className: "active:opacity-60", style: { fontFamily: F_DISPLAY, fontSize: 24, color: ACCENT, lineHeight: 1 } }, "＋") }),
      h("div", { className: "shrink-0 flex gap-2 px-5 pb-2" }, tabBtn("reminders", "⏰ 提醒"), tabBtn("notes", "📝 备忘")),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-6" },
        tab === "reminders"
          ? h("div", null, calSection(),
            reminders.length ? h("div", { className: "flex flex-col gap-2.5" }, reminders.map(reminderRow))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", padding: calUpcoming.length ? "34px 20px" : "70px 20px", lineHeight: 1.9 } }, "还没有提醒\n点右上角 ＋ 记一件要记住的事\n（交房租、复诊、谁的生日…）"))
          : (notes.length ? h("div", { className: "flex flex-col gap-2.5" }, notes.map(noteRow))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", padding: "70px 20px", lineHeight: 1.9 } }, "还没有备忘\n点右上角 ＋ 随手记点什么"))),

      // 新建/编辑表单
      form && form.kind === "reminder" && h(ReminderForm, { initial: form.item, toast: props.toast, onClose: () => { setForm(null); leaveIfFromCal(); }, onSave: r => { saveReminder(r); setForm(null); leaveIfFromCal(); }, onDelete: id => { delReminder(id); leaveIfFromCal(); } }),
      form && form.kind === "note" && h(NoteForm, { initial: form.item, toast: props.toast, onClose: () => setForm(null), onSave: n => { saveNote(n); setForm(null); }, onDelete: delNote }),

      // 提醒详情
      curReminder && h(Sheet, { onClose: closeDetail, tall: true },
        h("div", { className: "flex items-start justify-between", style: { marginBottom: 4 } },
          h("div", { style: { flex: 1 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink, textDecoration: curReminder.done ? "line-through" : "none" } }, curReminder.title),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, marginTop: 3 } }, reminderDateText(curReminder) + " · " + repeatLabel(curReminder.repeat) + (window.memoNextDays(curReminder) != null && !curReminder.done ? " · " + cdLabel(window.memoNextDays(curReminder)) : ""))),
          h("button", { onClick: () => { setForm({ kind: "reminder", item: curReminder }); setDetail(null); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.tint } }, "编辑")),
        curReminder.note && h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.sub, marginTop: 8, lineHeight: 1.6 } }, curReminder.note),
        h("div", { className: "flex gap-2", style: { marginTop: 14 } },
          h("button", { onClick: () => { autoReactDone(curReminder); upReminder(curReminder.id, { done: !curReminder.done }); }, className: "flex-1 active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: curReminder.done ? t.sub : "#fff", background: curReminder.done ? t.bg2 : ACCENT, border: "1px solid " + (curReminder.done ? t.line : ACCENT), borderRadius: 12, padding: "10px 0" } }, curReminder.done ? "标为未完成" : "标为已完成"),
          h("button", { onClick: () => setVisFor({ kind: "reminder", id: curReminder.id }), className: "flex-1 active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "10px 0" } }, "谁能看 (" + (curReminder.visibleTo || []).length + ")")),
        h(CommentBlock, { comments: curReminder.comments, characters: props.characters, moods: props.moods, affinities: props.affinities, active: props.active, worldbook: props.worldbook, worldbookFor: props.worldbookFor, uName: uName, toast: props.toast, itemId: curReminder.id,
          itemDesc: "提醒 · " + curReminder.title + "（" + reminderDateText(curReminder) + "）" + (curReminder.note ? " · 备注：" + curReminder.note : ""),
          onAdd: cs => upReminder(curReminder.id, r => ({ comments: (r.comments || []).concat(cs) })),
          onDel: i => upReminder(curReminder.id, r => ({ comments: (r.comments || []).filter((_, idx) => idx !== i) })) })),

      // 备忘详情
      curNote && h(Sheet, { onClose: () => setDetail(null), tall: true },
        h("div", { className: "flex items-start justify-between", style: { marginBottom: 6 } },
          h("div", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 20, color: t.ink } }, curNote.title || "（无标题）"),
          h("button", { onClick: () => { setForm({ kind: "note", item: curNote }); setDetail(null); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.tint } }, "编辑")),
        curNote.body && h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, lineHeight: 1.7, whiteSpace: "pre-wrap", marginTop: 4 } }, curNote.body),
        h("div", { className: "flex gap-2", style: { marginTop: 14 } },
          h("button", { onClick: () => upNote(curNote.id, { pinned: !curNote.pinned }), className: "flex-1 active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: curNote.pinned ? "#fff" : t.sub, background: curNote.pinned ? ACCENT : t.bg2, border: "1px solid " + (curNote.pinned ? ACCENT : t.line), borderRadius: 12, padding: "10px 0" } }, curNote.pinned ? "取消置顶" : "📌 置顶"),
          h("button", { onClick: () => setVisFor({ kind: "note", id: curNote.id }), className: "flex-1 active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "10px 0" } }, "谁能看 (" + (curNote.visibleTo || []).length + ")")),
        h(CommentBlock, { comments: curNote.comments, characters: props.characters, moods: props.moods, affinities: props.affinities, active: props.active, worldbook: props.worldbook, worldbookFor: props.worldbookFor, uName: uName, toast: props.toast, itemId: curNote.id,
          itemDesc: "备忘 · " + (curNote.title || "") + (curNote.body ? "：" + curNote.body.slice(0, 120) : ""),
          onAdd: cs => upNote(curNote.id, n => ({ comments: (n.comments || []).concat(cs) })),
          onDel: i => upNote(curNote.id, n => ({ comments: (n.comments || []).filter((_, idx) => idx !== i) })) })),

      // 可见角色
      visTarget && h(VisiblePicker, { characters: props.characters, value: visTarget.visibleTo || [], onClose: () => setVisFor(null),
        onSave: sel => { (visFor.kind === "reminder" ? upReminder : upNote)(visFor.id, { visibleTo: sel }); setVisFor(null); } }));
  }

  window.Memo = Memo;
})();
