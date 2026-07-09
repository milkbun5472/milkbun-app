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
  function todayMid() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function clampDay(y, m1, d) { const last = new Date(y, m1, 0).getDate(); return Math.min(d, last); } // m1 1-based
  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
  // 下一次发生 → { dt, days }（days<0 = 逾期，仅「不重复」会出现）
  function nextOccur(r, today) {
    today = today || todayMid();
    if (!r || !r.day) return null;
    if (r.repeat === "monthly") {
      let y = today.getFullYear(), m = today.getMonth() + 1;
      let dt = new Date(y, m - 1, clampDay(y, m, r.day)); dt.setHours(0, 0, 0, 0);
      if (dt < today) { m++; if (m > 12) { m = 1; y++; } dt = new Date(y, m - 1, clampDay(y, m, r.day)); dt.setHours(0, 0, 0, 0); }
      return { dt: dt, days: daysBetween(today, dt) };
    }
    if (r.repeat === "yearly") {
      if (!r.month) return null;
      let y = today.getFullYear();
      let dt = new Date(y, r.month - 1, clampDay(y, r.month, r.day)); dt.setHours(0, 0, 0, 0);
      if (dt < today) { y++; dt = new Date(y, r.month - 1, clampDay(y, r.month, r.day)); dt.setHours(0, 0, 0, 0); }
      return { dt: dt, days: daysBetween(today, dt) };
    }
    // 不重复
    if (!r.year || !r.month) return null;
    const dt = new Date(r.year, r.month - 1, r.day); dt.setHours(0, 0, 0, 0);
    return { dt: dt, days: daysBetween(today, dt) };
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
  function repeatLabel(rp) { return rp === "yearly" ? "每年" : rp === "monthly" ? "每月" : "一次"; }
  function reminderDateText(r) {
    if (r.repeat === "monthly") return "每月 " + r.day + " 号";
    if (r.repeat === "yearly") return "每年 " + r.month + " 月 " + r.day + " 日";
    return (r.year ? r.year + " 年 " : "") + (r.month || "?") + " 月 " + (r.day || "?") + " 日";
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
        const what = "「" + r.title + "」" + (r.note ? "（" + r.note + "）" : "");
        if (nx.days === 0) lines.push("今天是 " + uName + " 要 " + what + " 的日子。Ta 特意让你知道这事，可自然提醒/关心一句，别硬邦邦报事项。");
        else if (nx.days > 0 && nx.days <= 2) lines.push("再过 " + nx.days + " 天 " + uName + " 要 " + what + "，你心里有数，临近了可自然提一嘴。");
        else if (nx.days < 0) lines.push(uName + " 之前记着要 " + what + "（" + (-nx.days) + " 天前就该做了、好像还没勾掉），你可以关心一下弄了没。");
      });
      (d.notes || []).forEach(n => {
        if (!(n.visibleTo || []).includes(charId)) return;
        if (!n.title && !n.body) return;
        lines.push(uName + " 在备忘录里记着「" + (n.title || String(n.body).replace(/\s+/g, " ").slice(0, 24)) + "」，Ta 愿意让你看到（聊到相关可自然接住）。");
      });
      return lines.slice(0, 6).join("\n");
    } catch (e) { return ""; }
  };
  // 给 app.js 用：某提醒距下次发生几天（今天=0，逾期<0，无效=null）—— 主屏红点 + 到期主动提醒
  window.memoNextDays = function (r) { const nx = nextOccur(r, todayMid()); return nx ? nx.days : null; };
  // 今天到期(未完成)的提醒数量 —— 主屏图标红点
  window.memoDueToday = function () {
    try { const d = loadData(); return (d.reminders || []).filter(r => !r.done && window.memoNextDays(r) === 0).length; }
    catch (e) { return 0; }
  };

  // ============================================================
  // 批注：一次 API 让多个角色各对这条备忘/提醒说一句（走后台便宜池 active=bgActive）
  // ============================================================
  async function genComments(active, itemDesc, list, uName, worldbook) {
    const block = list.map((it, i) => (i + 1) + "、「" + it.name + "」\n  人设：" + (it.persona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 320) + (it.mood ? "\n  此刻心情：" + it.mood : "")).join("\n\n");
    const sys = AC() + NAC() +
      "下面是 " + uName + " 在自己备忘录里记下的一条东西。请【分别以下面每位角色本人的口吻】，各说一句 Ta 看到 " + uName + " 记的这条时会真实说出口的话。\n" +
      "【硬性要求】\n" +
      "· 真的进入角色、说出有内容有态度的一句，结合人设＋此刻心情＋这条的内容。严禁敷衍成『看了一眼没说什么』『随你』这类空话。\n" +
      "· 人称必须对：从人设判断性别，男用「他」女用「她」，判断不出就叫名字或不用第三人称。绝不许写『Ta』『TA』占位符。\n" +
      "· 每人一句、口语、像随手发的消息；几个人语气各不相同，别一个腔调，别说教别客套。\n" +
      "· 反应可多样：提醒你别忘、催你、心疼、调侃、替你操心、或只是顺口关心——按各自人设来。\n\n" +
      "【这条备忘】" + itemDesc + "\n\n" +
      "【要批注的角色】\n" + block +
      (worldbook && worldbook.trim() ? "\n\n【世界书（仅参考）】\n" + worldbook.trim().slice(0, 400) : "") +
      "\n\n【输出】只输出 JSON，comments 数组和上面角色顺序【一一对应、数量一致】：{\"comments\":[{\"name\":\"角色名\",\"text\":\"这位角色的一句话\"}...]}。别加解释、别加代码块。";
    const raw = await callAI(active, sys, [{ role: "user", content: "开始批注。" }], { maxTokens: 6000 });
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
    const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    return h("div", { className: "absolute inset-0 z-[70] flex items-end", style: { background: "rgba(20,19,15,0.4)" }, onClick: props.onClose },
      h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", background: t.bg2, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "18px 18px 22px", maxHeight: "72vh", overflowY: "auto", animation: "fadeUp .2s ease both" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, marginBottom: 4 } }, "让谁来批注"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 12 } }, "选中的角色会各说一句（一次生成，走便宜后台池）"),
        avail.length === 0 ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "10px 0" } }, "没有可批注的角色了。")
          : h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, avail.map(c => h("button", { key: c.id, onClick: () => toggle(c.id), className: "w-full flex items-center gap-3 active:opacity-70", style: { padding: "7px 4px", textAlign: "left" } },
            h(Avatar, { character: c, size: 34, radius: 999 }),
            h("span", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.remark || c.name),
            h("span", { style: { width: 22, height: 22, borderRadius: 999, border: "2px solid " + (sel.includes(c.id) ? ACCENT : t.line), background: sel.includes(c.id) ? ACCENT : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13 } }, sel.includes(c.id) ? "✓" : "")))),
        h("div", { className: "flex gap-2", style: { marginTop: 14 } },
          h("button", { onClick: props.onClose, className: "flex-1 active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.sub, background: t.bg, border: "1px solid " + t.line, borderRadius: 14, padding: "11px 0" } }, "取消"),
          h("button", { onClick: () => sel.length && props.onPick(sel), disabled: !sel.length || props.busy, className: "flex-1 active:opacity-80 disabled:opacity-40", style: { fontFamily: F_DISPLAY, fontSize: 14, color: "#fff", background: ACCENT, borderRadius: 14, padding: "11px 0" } }, props.busy ? "生成中…" : "让 TA 们说 (" + sel.length + ")"))));
  }

  // ---- 谁可以看到（可见角色）----
  function VisiblePicker(props) {
    const t = useTheme();
    const [sel, setSel] = useState((props.value || []).slice());
    const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    return h("div", { className: "absolute inset-0 z-[70] flex items-end", style: { background: "rgba(20,19,15,0.4)" }, onClick: props.onClose },
      h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", background: t.bg2, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "18px 18px 22px", maxHeight: "72vh", overflowY: "auto", animation: "fadeUp .2s ease both" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, marginBottom: 4 } }, "谁能看到 / 提醒你"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 12 } }, "选中的角色：临近时会在聊天里自然提起；到期当天可能主动发消息提醒你。"),
        (props.characters || []).length === 0 ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "还没有角色。")
          : h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, (props.characters || []).map(c => h("button", { key: c.id, onClick: () => toggle(c.id), className: "w-full flex items-center gap-3 active:opacity-70", style: { padding: "7px 4px", textAlign: "left" } },
            h(Avatar, { character: c, size: 34, radius: 999 }),
            h("span", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.remark || c.name),
            h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: sel.includes(c.id) ? ACCENT : t.fog } }, sel.includes(c.id) ? "✓ 可见" : "不可见")))),
        h("button", { onClick: () => props.onSave(sel), className: "w-full active:opacity-80", style: { marginTop: 14, fontFamily: F_DISPLAY, fontSize: 14.5, color: "#fff", background: t.ink, borderRadius: 14, padding: "12px 0" } }, "保存")));
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
          .map(c => ({ id: c.id, name: c.name, persona: c.persona || "", mood: (props.moods && props.moods[c.id] && props.moods[c.id].label) || "" }));
        const outs = await genComments(props.active, props.itemDesc, list, props.uName, props.worldbook);
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
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 12.5, color: t.sub, marginBottom: 2 } }, c.remark || c.name || cm.name),
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
    const today = new Date();
    const [ymd, setYmd] = useState(r.year ? (r.year + "-" + String(r.month).padStart(2, "0") + "-" + String(r.day).padStart(2, "0")) : (today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0")));
    const [mon, setMon] = useState(r.month || today.getMonth() + 1);
    const [day, setDay] = useState(r.day || today.getDate());
    const save = () => {
      if (!title.trim()) { props.toast && props.toast("写点要提醒的事"); return; }
      let year = null, month = null, dd = null;
      if (repeat === "none") { const p = ymd.split("-").map(Number); if (p.length !== 3) { props.toast && props.toast("选个日期"); return; } year = p[0]; month = p[1]; dd = p[2]; }
      else if (repeat === "yearly") { month = Math.max(1, Math.min(12, +mon || 1)); dd = Math.max(1, Math.min(31, +day || 1)); }
      else { dd = Math.max(1, Math.min(31, +day || 1)); }
      props.onSave(Object.assign({}, r, { id: r.id || uid("r"), title: title.trim(), note: note.trim(), repeat: repeat, year: year, month: month, day: dd, done: !!r.done, visibleTo: r.visibleTo || [], comments: r.comments || [], createdTs: r.createdTs || Date.now() }));
    };
    const inp = { width: "100%", background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 13px", fontFamily: F_BODY, fontSize: 14.5, color: t.ink, outline: "none" };
    const rchip = (v, lbl) => h("button", { onClick: () => setRepeat(v), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, padding: "7px 14px", borderRadius: 999, background: repeat === v ? ACCENT : "transparent", color: repeat === v ? "#fff" : t.sub, border: "1px solid " + (repeat === v ? ACCENT : t.line) } }, lbl);
    return h(Sheet, { onClose: props.onClose, tall: true },
      h("div", { className: "flex items-center justify-between mb-3" },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: t.ink } }, props.initial ? "编辑提醒" : "新提醒"),
        h("button", { onClick: save, className: "active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 14, color: ACCENT } }, "保存")),
      h("input", { value: title, onChange: e => setTitle(e.target.value), placeholder: "要提醒的事（如 交房租 / 妈妈生日 / 复诊）", style: Object.assign({}, inp, { marginBottom: 10 }) }),
      h("input", { value: note, onChange: e => setNote(e.target.value), placeholder: "备注（可空）", style: Object.assign({}, inp, { marginBottom: 14 }) }),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 7 } }, "重复"),
      h("div", { className: "flex gap-2", style: { marginBottom: 14 } }, rchip("none", "不重复"), rchip("yearly", "每年"), rchip("monthly", "每月")),
      repeat === "none" ? h("div", null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 7 } }, "日期"),
        h("input", { type: "date", value: ymd, onChange: e => setYmd(e.target.value), style: inp }))
        : repeat === "yearly" ? h("div", { className: "flex gap-2 items-center" },
          h("input", { type: "number", value: mon, onChange: e => setMon(e.target.value), min: 1, max: 12, style: Object.assign({}, inp, { width: 90 }) }), h("span", { style: { fontFamily: F_BODY, color: t.sub } }, "月"),
          h("input", { type: "number", value: day, onChange: e => setDay(e.target.value), min: 1, max: 31, style: Object.assign({}, inp, { width: 90 }) }), h("span", { style: { fontFamily: F_BODY, color: t.sub } }, "日"))
          : h("div", { className: "flex gap-2 items-center" }, h("span", { style: { fontFamily: F_BODY, color: t.sub } }, "每月"),
            h("input", { type: "number", value: day, onChange: e => setDay(e.target.value), min: 1, max: 31, style: Object.assign({}, inp, { width: 90 }) }), h("span", { style: { fontFamily: F_BODY, color: t.sub } }, "号")),
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
    const [visFor, setVisFor] = useState(null);    // 正在设可见角色的 {kind,id}
    const persist = updater => setData(prev => { const n = typeof updater === "function" ? updater(prev) : updater; saveData(n); return n; });

    const upReminder = (id, patch) => persist(d => ({ ...d, reminders: (d.reminders || []).map(r => r.id === id ? Object.assign({}, r, typeof patch === "function" ? patch(r) : patch) : r) }));
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

    // 提醒行
    const reminderRow = r => {
      const days = window.memoNextDays(r);
      const done = !!r.done;
      return h("button", { key: r.id, onClick: () => setDetail({ kind: "reminder", id: r.id }), className: "w-full active:opacity-70 flex items-center gap-3", style: { textAlign: "left", background: t.bg2, border: "1px solid " + t.line, borderRadius: 16, padding: "12px 14px", opacity: done ? 0.55 : 1 } },
        h("button", { onClick: e => { e.stopPropagation(); upReminder(r.id, { done: !r.done }); }, className: "shrink-0 active:opacity-60", style: { width: 24, height: 24, borderRadius: 999, border: "2px solid " + (done ? ACCENT : t.line), background: done ? ACCENT : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13 } }, done ? "✓" : ""),
        h("div", { style: { flex: 1, minWidth: 0 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink, textDecoration: done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.title),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2 } }, reminderDateText(r) + " · " + repeatLabel(r.repeat) + ((r.comments || []).length ? " · 💬" + r.comments.length : "") + ((r.visibleTo || []).length ? " · 👁" + r.visibleTo.length : ""))),
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
      h(Head, { zh: "备忘录", en: "Memo", onBack: props.onBack,
        right: h("button", { onClick: () => setForm({ kind: tab === "notes" ? "note" : "reminder" }), className: "active:opacity-60", style: { fontFamily: F_DISPLAY, fontSize: 24, color: ACCENT, lineHeight: 1 } }, "＋") }),
      h("div", { className: "shrink-0 flex gap-2 px-5 pb-2" }, tabBtn("reminders", "⏰ 提醒"), tabBtn("notes", "📝 备忘")),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-6" },
        tab === "reminders"
          ? (reminders.length ? h("div", { className: "flex flex-col gap-2.5" }, reminders.map(reminderRow))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", padding: "70px 20px", lineHeight: 1.9 } }, "还没有提醒\n点右上角 ＋ 记一件要记住的事\n（交房租、复诊、谁的生日…）"))
          : (notes.length ? h("div", { className: "flex flex-col gap-2.5" }, notes.map(noteRow))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, textAlign: "center", padding: "70px 20px", lineHeight: 1.9 } }, "还没有备忘\n点右上角 ＋ 随手记点什么"))),

      // 新建/编辑表单
      form && form.kind === "reminder" && h(ReminderForm, { initial: form.item, toast: props.toast, onClose: () => setForm(null), onSave: r => { saveReminder(r); setForm(null); }, onDelete: delReminder }),
      form && form.kind === "note" && h(NoteForm, { initial: form.item, toast: props.toast, onClose: () => setForm(null), onSave: n => { saveNote(n); setForm(null); }, onDelete: delNote }),

      // 提醒详情
      curReminder && h(Sheet, { onClose: () => setDetail(null), tall: true },
        h("div", { className: "flex items-start justify-between", style: { marginBottom: 4 } },
          h("div", { style: { flex: 1 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink, textDecoration: curReminder.done ? "line-through" : "none" } }, curReminder.title),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, marginTop: 3 } }, reminderDateText(curReminder) + " · " + repeatLabel(curReminder.repeat) + (window.memoNextDays(curReminder) != null && !curReminder.done ? " · " + cdLabel(window.memoNextDays(curReminder)) : ""))),
          h("button", { onClick: () => { setForm({ kind: "reminder", item: curReminder }); setDetail(null); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.tint } }, "编辑")),
        curReminder.note && h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.sub, marginTop: 8, lineHeight: 1.6 } }, curReminder.note),
        h("div", { className: "flex gap-2", style: { marginTop: 14 } },
          h("button", { onClick: () => upReminder(curReminder.id, { done: !curReminder.done }), className: "flex-1 active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: curReminder.done ? t.sub : "#fff", background: curReminder.done ? t.bg2 : ACCENT, border: "1px solid " + (curReminder.done ? t.line : ACCENT), borderRadius: 12, padding: "10px 0" } }, curReminder.done ? "标为未完成" : "标为已完成"),
          h("button", { onClick: () => setVisFor({ kind: "reminder", id: curReminder.id }), className: "flex-1 active:opacity-70", style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: t.sub, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "10px 0" } }, "谁能看 (" + (curReminder.visibleTo || []).length + ")")),
        h(CommentBlock, { comments: curReminder.comments, characters: props.characters, moods: props.moods, active: props.active, worldbook: props.worldbook, uName: (props.profile && props.profile.name) || "用户", toast: props.toast,
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
        h(CommentBlock, { comments: curNote.comments, characters: props.characters, moods: props.moods, active: props.active, worldbook: props.worldbook, uName: (props.profile && props.profile.name) || "用户", toast: props.toast,
          itemDesc: "备忘 · " + (curNote.title || "") + (curNote.body ? "：" + curNote.body.slice(0, 120) : ""),
          onAdd: cs => upNote(curNote.id, n => ({ comments: (n.comments || []).concat(cs) })),
          onDel: i => upNote(curNote.id, n => ({ comments: (n.comments || []).filter((_, idx) => idx !== i) })) })),

      // 可见角色
      visTarget && h(VisiblePicker, { characters: props.characters, value: visTarget.visibleTo || [], onClose: () => setVisFor(null),
        onSave: sel => { (visFor.kind === "reminder" ? upReminder : upNote)(visFor.id, { visibleTo: sel }); setVisFor(null); } }));
  }

  window.Memo = Memo;
})();
