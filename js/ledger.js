// ============================================================
// 记账（ledger）—— 多币种个人记账，独立小 app
// 用户在国外：生活用 CAD、玩游戏充 CNY —— 多币种【各记各的、默认不换算不合并本币】。
//   · 每个币种一张独立卡：各自本月支出 / 收入 / 结余
//   · 按币种进详情：切月份看「这个月各分类各花了多少」+ 当月流水
//   · 记好一笔可【选多个角色一次性批注】（一次 API 调用出多人，省次数；参考实时心情+人设）
//   · 可设「谁能看到我的账」→ 被授权的角色在聊天里能自然感知你的真实开销（financeNote，不碰钱包/余额）
// 和「钱包」(x_wallet) 是两套钱：钱包=RP 虚构 CNY 经济；这里=你真实的个人财务。互不换算、互不触发。
// 数据存 localStorage x_ledger，随云同步。
// ============================================================
(function () {
  const ACCENT = "#4f6d5a";   // 记账主色（沉静的墨绿）
  const GOLD = "#b89150";
  const EXP = "#c25a4a";      // 支出（暖红）
  const INC = "#4f6d5a";      // 收入（绿）
  const AC = () => (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "");
  const NAC = () => (typeof NARRATIVE_ANTI_CLICHE !== "undefined" ? NARRATIVE_ANTI_CLICHE + "\n\n" : "");
  const CUR_COLORS = ["#a8543f", "#4f6d5a", "#4f5a78", "#7a6a5a", "#6d5a78", "#3f6d6d"];

  // ---- 默认币种 & 分类 ----
  const DEFAULT_CURS = [
    { code: "CAD", symbol: "$", label: "加币" },
    { code: "CNY", symbol: "¥", label: "人民币" }
  ];
  const DEF_EXP = [
    { name: "餐饮", emoji: "🍚" }, { name: "买菜", emoji: "🛒" }, { name: "交通", emoji: "🚌" },
    { name: "购物", emoji: "🛍️" }, { name: "日用", emoji: "🧴" }, { name: "居住", emoji: "🏠" },
    { name: "娱乐", emoji: "🎬" }, { name: "游戏充值", emoji: "🎮" }, { name: "医疗", emoji: "💊" },
    { name: "人情", emoji: "🎁" }, { name: "学习", emoji: "📚" }, { name: "其他", emoji: "✨" }
  ];
  const DEF_INC = [
    { name: "工资", emoji: "💰" }, { name: "兼职", emoji: "💼" }, { name: "红包", emoji: "🧧" },
    { name: "报销", emoji: "🧾" }, { name: "其他", emoji: "✨" }
  ];

  // ---- 数据存取 ----
  function defaultData() {
    return { txns: [], settings: { visibleTo: [], currencies: DEFAULT_CURS.map(c => ({ ...c })), cats: { expense: DEF_EXP.map(c => ({ ...c })), income: DEF_INC.map(c => ({ ...c })) } } };
  }
  function loadData() {
    const d = loadJSON("x_ledger", null);
    if (!d) return defaultData();
    const def = defaultData();
    d.txns = Array.isArray(d.txns) ? d.txns : [];
    d.settings = d.settings || {};
    d.settings.visibleTo = Array.isArray(d.settings.visibleTo) ? d.settings.visibleTo : [];
    d.settings.currencies = Array.isArray(d.settings.currencies) && d.settings.currencies.length ? d.settings.currencies : def.settings.currencies;
    d.settings.cats = d.settings.cats || {};
    d.settings.cats.expense = Array.isArray(d.settings.cats.expense) && d.settings.cats.expense.length ? d.settings.cats.expense : def.settings.cats.expense;
    d.settings.cats.income = Array.isArray(d.settings.cats.income) && d.settings.cats.income.length ? d.settings.cats.income : def.settings.cats.income;
    return d;
  }
  function saveData(d) { saveJSON("x_ledger", d); }

  // ---- 时间 / 金额工具 ----
  function pad(n) { return String(n).padStart(2, "0"); }
  function todayStr() { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function monthKey(dateStr) { return String(dateStr || "").slice(0, 7); }        // "YYYY-MM"
  function thisMonthKey() { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
  function fmtMonth(mk) { const p = mk.split("-"); return p[0] + "年" + parseInt(p[1], 10) + "月"; }
  function shiftMonth(mk, delta) {
    const p = mk.split("-"); let y = parseInt(p[0], 10), m = parseInt(p[1], 10) - 1 + delta;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + "-" + pad(m + 1);
  }
  function fmtDay(dateStr) { const p = String(dateStr || "").split("-"); return p.length === 3 ? (parseInt(p[1], 10) + "月" + parseInt(p[2], 10) + "日") : dateStr; }
  function fmtNum(n) { const v = Math.round((Number(n) || 0) * 100) / 100; return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
  function fmtAmt(n, cur) { return (cur ? cur.symbol : "") + fmtNum(n); }

  // 某币种在某月的收支汇总 + 分类明细
  function summarize(txns, code, mk) {
    let exp = 0, inc = 0; const cats = {};
    txns.forEach(t => {
      if (t.currency !== code || monthKey(t.date) !== mk) return;
      const a = Number(t.amount) || 0;
      if (t.type === "income") inc += a;
      else { exp += a; cats[t.category] = (cats[t.category] || 0) + a; }
    });
    const catList = Object.keys(cats).map(k => ({ name: k, amount: cats[k] })).sort((x, y) => y.amount - x.amount);
    return { exp, inc, net: inc - exp, catList };
  }
  function curMonthKeys(txns, code) {
    const set = {}; txns.forEach(t => { if (t.currency === code) set[monthKey(t.date)] = 1; });
    const arr = Object.keys(set).sort(); if (!arr.includes(thisMonthKey())) arr.push(thisMonthKey());
    return arr.sort();
  }

  // ============================================================
  // 供聊天引擎调用：把「被授权角色能看到的记账动态」拼成一段（financeNote）
  // 只读、只感知，绝不碰钱包/角色余额。app.js 的 ctxFor 会调用它。
  // ============================================================
  window.ledgerNoteFor = function (charId) {
    try {
      const d = loadJSON("x_ledger", null);
      if (!d || !d.settings || !(d.settings.visibleTo || []).includes(charId)) return "";
      const txns = Array.isArray(d.txns) ? d.txns : [];
      if (!txns.length) return "";
      const curs = d.settings.currencies || DEFAULT_CURS;
      const mk = thisMonthKey();
      const lines = [];
      curs.forEach(cur => {
        const s = summarize(txns, cur.code, mk);
        if (!s.exp && !s.inc) return;
        let l = "· " + cur.label + "（" + cur.code + "）本月：支出 " + fmtAmt(s.exp, cur) + "，收入 " + fmtAmt(s.inc, cur) + "，结余 " + fmtAmt(s.net, cur);
        if (s.catList.length) l += "；花得最多的是 " + s.catList.slice(0, 3).map(c => c.name + " " + fmtAmt(c.amount, cur)).join("、");
        lines.push(l);
      });
      // 最近几笔较大的开销（跨币种，各币种取金额较大的）
      const big = txns.filter(t => t.type === "expense").slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 12)
        .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0)).slice(0, 4);
      if (big.length) {
        lines.push("最近几笔较大的开销：" + big.map(t => {
          const cur = curs.find(c => c.code === t.currency) || { symbol: "" };
          return fmtDay(t.date) + " " + t.category + " " + fmtAmt(t.amount, cur) + (t.note ? "（" + String(t.note).slice(0, 16) + "）" : "");
        }).join("；"));
      }
      return lines.join("\n");
    } catch (e) { return ""; }
  };

  // ============================================================
  // 模型：多个角色一次性批注同一笔账（一次调用，省 API）
  // 返回按传入顺序对齐的 [{text}]
  // ============================================================
  async function genComments(active, txn, cur, list, uName, worldbook) {
    const typeZh = txn.type === "income" ? "进账" : "花销";
    const amt = fmtAmt(txn.amount, cur) + "（" + cur.label + "）";
    const block = list.map((it, i) => (i + 1) + "、「" + it.name + "」\n  人设：" + (it.persona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 280) + (it.mood ? "\n  此刻心情：" + it.mood : "")).join("\n\n");
    const sys = AC() + NAC() +
      "下面是 " + uName + " 刚记下的一笔真实的" + typeZh + "。请【分别以下面每位角色本人的口吻】，各对这笔账说一句话——像看到 " + uName + " 的账本时随口的反应。\n" +
      "· 结合各自人设与（若给了）此刻心情：有人会心疼你乱花、有人调侃你" + (txn.category === "游戏充值" ? "又氪了" : "手松") + "、有人心疼你舍不得、有人无所谓、有人顺口关心一句。\n" +
      "· 短，一两句，口语，像发消息。别报流水账、别说教、别写成同一个腔调、别客套。这钱是 " + uName + " 自己的，与角色无关，只是让 Ta 知道并有反应。\n\n" +
      "【这笔账】" + fmtDay(txn.date) + " · " + typeZh + " · " + txn.category + " · " + amt + (txn.note ? " · 备注：" + txn.note : "") + "\n\n" +
      "【要批注的角色】\n" + block +
      (worldbook && worldbook.trim() ? "\n\n【世界书（仅参考）】\n" + worldbook.trim().slice(0, 400) : "") +
      "\n\n【输出】只输出 JSON，comments 数组和上面角色顺序【一一对应、数量一致】：{\"comments\":[{\"name\":\"角色名\",\"text\":\"这位角色对这笔账的一句话\"}...]}。别加解释、别加代码块。";
    const raw = await callAI(active, sys, [{ role: "user", content: "开始批注。" }], { maxTokens: 2600 });
    const p = extractJSON(raw) || {};
    const arr = Array.isArray(p.comments) ? p.comments : [];
    return list.map((it, i) => {
      const byName = arr.find(r => r && r.name && String(r.name).trim() === it.name);
      const r = byName || arr[i];
      return { text: r && r.text ? String(r.text).trim() : "（Ta 看了一眼，没说什么）" };
    });
  }

  // ============================================================
  // 主组件
  // ============================================================
  function Ledger(props) {
    const t = useTheme();
    const [data, setData] = useState(loadData);
    const [view, setView] = useState("home");   // home | cur:<code> | txn:<id>
    const [showAdd, setShowAdd] = useState(false);
    const [showSet, setShowSet] = useState(false);
    const uName = (props.profile && props.profile.name) || "我";

    const persist = d => { setData(d); saveData(d); };
    const addTxn = txn => { const d = loadData(); d.txns = [txn].concat(d.txns); persist(d); return txn; };
    const updTxn = (id, patch) => { const d = loadData(); d.txns = d.txns.map(x => x.id === id ? { ...x, ...patch } : x); persist(d); };
    const delTxn = id => { const d = loadData(); d.txns = d.txns.filter(x => x.id !== id); persist(d); };
    const setSettings = patch => { const d = loadData(); d.settings = { ...d.settings, ...patch }; persist(d); };

    const curs = data.settings.currencies || DEFAULT_CURS;
    const curOf = code => curs.find(c => c.code === code) || { code: code, symbol: "", label: code };

    // ---- 币种详情 ----
    if (view.indexOf("cur:") === 0) {
      const code = view.slice(4);
      return h(CurView, {
        code, cur: curOf(code), txns: data.txns, onBack: () => setView("home"),
        onOpenTxn: id => setView("txn:" + id)
      });
    }
    // ---- 单笔详情 ----
    if (view.indexOf("txn:") === 0) {
      const id = view.slice(4);
      const txn = data.txns.find(x => x.id === id);
      if (!txn) { setView("home"); return null; }
      return h(TxnView, {
        txn, cur: curOf(txn.currency), characters: props.characters, moods: props.moods,
        active: props.active, worldbook: props.worldbook, uName, toast: props.toast,
        onBack: () => setView("home"),
        onAddComments: cmts => updTxn(id, { comments: (txn.comments || []).concat(cmts) }),
        onDelete: () => { if (window.confirm("删掉这笔账？")) { delTxn(id); setView("home"); } }
      });
    }

    // ---- 落地页：币种卡 + 记一笔 ----
    const mk = thisMonthKey();
    // 显示所有配置的币种（本月有账的排前面）
    const cards = curs.map((cur, i) => {
      const s = summarize(data.txns, cur.code, mk);
      const has = data.txns.some(x => x.currency === cur.code);
      return { cur, s, has, color: CUR_COLORS[i % CUR_COLORS.length] };
    }).sort((a, b) => (b.has ? 1 : 0) - (a.has ? 1 : 0));

    const gearBtn = h("button", { onClick: () => setShowSet(true), className: "active:opacity-50" },
      h(GConfig, { size: 19, color: t.ink }));

    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: "记账", en: "Ledger", onBack: props.onBack, right: gearBtn }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-28" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 14, lineHeight: 1.5 } },
          fmtMonth(mk) + " · 各币种各记各的，不换算"),
        // 币种卡
        h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
          cards.map(({ cur, s, color }) => h("button", {
            key: cur.code, onClick: () => setView("cur:" + cur.code), className: "w-full active:opacity-90 text-left",
            style: { background: color, borderRadius: 18, padding: "16px 18px", color: "#f6f4ef", border: "none" }
          },
            h("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 } },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: 17 } }, cur.label),
              h("span", { style: { fontFamily: F_BODY, fontSize: 11, opacity: 0.7, letterSpacing: "0.08em" } }, cur.code)),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, opacity: 0.75, marginBottom: 2 } }, "本月支出"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 30, lineHeight: 1 } }, fmtAmt(s.exp, cur)),
            h("div", { style: { display: "flex", gap: 16, marginTop: 12, fontFamily: F_BODY, fontSize: 11.5, opacity: 0.85 } },
              h("span", null, "收入 " + fmtAmt(s.inc, cur)),
              h("span", null, "结余 " + fmtAmt(s.net, cur)))))),
        // 可见性小提示
        (data.settings.visibleTo || []).length
          ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 16, textAlign: "center" } },
              (data.settings.visibleTo || []).length + " 位角色能看到你的记账动态 · 点右上角调整")
          : null),
      // 悬浮「记一笔」
      h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "12px 20px calc(env(safe-area-inset-bottom, 0px) + 16px)", background: "linear-gradient(to top, " + t.bg + " 60%, transparent)" } },
        h("button", { onClick: () => setShowAdd(true), className: "w-full active:opacity-85",
          style: { background: ACCENT, color: "#fff", border: "none", borderRadius: 999, padding: "15px 0", fontFamily: F_BODY, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 } },
          h(IPlus, { size: 18, color: "#fff" }), "记一笔")),
      showAdd ? h(AddSheet, {
        settings: data.settings, curs,
        onClose: () => setShowAdd(false),
        onAddCurrency: cur => { const d = loadData(); d.settings.currencies = (d.settings.currencies || []).concat([cur]); persist(d); },
        onAddCat: (type, cat) => { const d = loadData(); d.settings.cats[type] = (d.settings.cats[type] || []).concat([cat]); persist(d); },
        onSave: txn => { addTxn(txn); setShowAdd(false); if (props.characters && props.characters.length) setView("txn:" + txn.id); else props.toast && props.toast("记好了"); }
      }) : null,
      showSet ? h(SettingsSheet, {
        settings: data.settings, characters: props.characters,
        onClose: () => setShowSet(false),
        onSaveVisible: ids => { setSettings({ visibleTo: ids }); }
      }) : null);
  }

  // ============================================================
  // 币种详情：切月份 + 汇总 + 分类明细 + 当月流水
  // ============================================================
  function CurView(props) {
    const t = useTheme();
    const { code, cur, txns } = props;
    const months = curMonthKeys(txns, code);
    const [mk, setMk] = useState(thisMonthKey());
    const s = summarize(txns, code, mk);
    const monthTxns = txns.filter(x => x.currency === code && monthKey(x.date) === mk)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const maxCat = s.catList.length ? s.catList[0].amount : 1;

    const navBtn = (label, delta) => h("button", { onClick: () => setMk(m => shiftMonth(m, delta)), className: "active:opacity-50",
      style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.fog, width: 40, textAlign: "center", lineHeight: 1 } }, label);

    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: cur.label, en: code, onBack: props.onBack }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-10" },
        // 月份切换
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 16 } },
          navBtn("‹", -1),
          h("span", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, minWidth: 110, textAlign: "center" } }, fmtMonth(mk)),
          navBtn("›", 1)),
        // 汇总卡
        h("div", { style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 16, padding: "16px 18px", marginBottom: 20, display: "flex", justifyContent: "space-between", textAlign: "center" } },
          [["支出", s.exp, EXP], ["收入", s.inc, INC], ["结余", s.net, t.ink]].map(([lab, val, col], i) =>
            h("div", { key: i, style: { flex: 1 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 4 } }, lab),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: col } }, fmtAmt(val, cur))))),
        // 分类明细（支出）
        s.catList.length ? h("div", { style: { marginBottom: 22 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 10, letterSpacing: "0.05em" } }, "支出分类"),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 11 } },
            s.catList.map(c => h("div", { key: c.name },
              h("div", { style: { display: "flex", justifyContent: "space-between", fontFamily: F_BODY, fontSize: 12.5, color: t.ink, marginBottom: 4 } },
                h("span", null, c.name),
                h("span", null, fmtAmt(c.amount, cur) + "  ·  " + Math.round(c.amount / (s.exp || 1) * 100) + "%")),
              h("div", { style: { height: 6, borderRadius: 6, background: t.line, overflow: "hidden" } },
                h("div", { style: { height: "100%", width: Math.max(3, c.amount / maxCat * 100) + "%", background: ACCENT, borderRadius: 6 } })))))) : null,
        // 当月流水
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 10, letterSpacing: "0.05em" } }, "流水 · " + monthTxns.length + " 笔"),
        monthTxns.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
          monthTxns.map(x => h(TxnRow, { key: x.id, txn: x, cur, onClick: () => props.onOpenTxn(x.id) })))
          : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, textAlign: "center", padding: "30px 0" } }, "这个月还没有记账")));
  }

  // 单条流水行
  function TxnRow(props) {
    const t = useTheme();
    const { txn, cur } = props;
    const cat = txn.catEmoji || "";
    const isInc = txn.type === "income";
    return h("button", { onClick: props.onClick, className: "w-full active:opacity-70 text-left",
      style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 14px", display: "flex", alignItems: "center", gap: 12 } },
      h("div", { style: { width: 34, height: 34, borderRadius: 10, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 } }, cat || (isInc ? "💰" : "💸")),
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, txn.category),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
          fmtDay(txn.date) + (txn.note ? " · " + txn.note : "") + ((txn.comments || []).length ? " · 💬" + txn.comments.length : ""))),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: isInc ? INC : t.ink, flexShrink: 0 } },
        (isInc ? "+" : "-") + fmtAmt(txn.amount, cur)));
  }

  // ============================================================
  // 单笔详情：账 + 角色批注 + 让角色批注（多选一次生成）
  // ============================================================
  function TxnView(props) {
    const t = useTheme();
    const { txn, cur } = props;
    const [pick, setPick] = useState(false);
    const isInc = txn.type === "income";
    const comments = txn.comments || [];
    const charById = id => (props.characters || []).find(c => c.id === id);

    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: "这笔账", en: isInc ? "Income" : "Expense", onBack: props.onBack,
        right: h("button", { onClick: props.onDelete, className: "active:opacity-50" }, h(ITrash, { size: 18, color: t.fog })) }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-8" },
        // 大金额卡
        h("div", { style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 18, padding: "22px 20px", textAlign: "center", marginBottom: 22 } },
          h("div", { style: { fontSize: 30, marginBottom: 8 } }, txn.catEmoji || (isInc ? "💰" : "💸")),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 34, color: isInc ? INC : t.ink, lineHeight: 1 } },
            (isInc ? "+" : "-") + fmtAmt(txn.amount, cur)),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, marginTop: 10 } },
            txn.category + " · " + cur.label + " · " + fmtDay(txn.date)),
          txn.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, marginTop: 8, lineHeight: 1.5 } }, txn.note) : null),
        // 批注区
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, letterSpacing: "0.05em" } }, "角色批注" + (comments.length ? " · " + comments.length : "")),
          (props.characters && props.characters.length)
            ? h("button", { onClick: () => setPick(true), className: "active:opacity-70",
                style: { fontFamily: F_BODY, fontSize: 12, color: "#fff", background: ACCENT, border: "none", borderRadius: 999, padding: "6px 14px" } },
                comments.length ? "再让 TA 们说说" : "让角色批注")
            : null),
        comments.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
          comments.map((cm, i) => {
            const ch = charById(cm.charId);
            return h("div", { key: i, style: { display: "flex", gap: 10 } },
              ch ? h(Avatar, { character: ch, size: 34, radius: 10 })
                 : h("div", { style: { width: 34, height: 34, borderRadius: 10, background: "#c2bdb1", flexShrink: 0 } }),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, marginBottom: 3 } }, cm.charName),
                h("div", { style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, borderTopLeftRadius: 3, padding: "9px 12px", fontFamily: F_BODY, fontSize: 13, color: t.ink, lineHeight: 1.55 } }, cm.text)));
          }))
          : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, textAlign: "center", padding: "20px 0" } },
              (props.characters && props.characters.length) ? "还没人看过这笔账，点上面让 TA 们说说" : "先去『名录』建个角色")),
      pick ? h(CommentPicker, {
        characters: props.characters, moods: props.moods, existing: comments.map(c => c.charId),
        txn, cur, active: props.active, worldbook: props.worldbook, uName: props.uName, toast: props.toast,
        onClose: () => setPick(false),
        onDone: cmts => { props.onAddComments(cmts); setPick(false); }
      }) : null);
  }

  // ============================================================
  // 批注角色多选 → 一次生成
  // ============================================================
  function CommentPicker(props) {
    const t = useTheme();
    const [sel, setSel] = useState([]);
    const [busy, setBusy] = useState(false);
    const chars = props.characters || [];
    const moodOf = id => { const mo = props.moods && props.moods[id]; return mo && mo.label ? String(mo.label) : ""; };
    const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : s.concat([id]));

    const run = async () => {
      if (!sel.length || busy) return;
      setBusy(true);
      try {
        const list = sel.map(id => { const c = chars.find(x => x.id === id); return { id, name: c.name, persona: c.persona || "", mood: moodOf(id) }; });
        const outs = await genComments(props.active, props.txn, props.cur, list, props.uName, props.worldbook);
        const cmts = list.map((it, i) => ({ charId: it.id, charName: it.name, text: outs[i].text, ts: Date.now() }));
        props.onDone(cmts);
      } catch (e) { props.toast && props.toast("生成失败，重试一下"); setBusy(false); }
    };

    return h("div", { style: { position: "absolute", inset: 0, zIndex: 50, background: "rgba(20,18,15,0.4)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }, onClick: props.onClose },
      h("div", { onClick: e => e.stopPropagation(), style: { background: t.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "20px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)", maxHeight: "78%", display: "flex", flexDirection: "column" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: t.ink, marginBottom: 4 } }, "让谁看看这笔账"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 16, lineHeight: 1.5 } }, "可多选，一次生成全部——省一次 API。TA 们会按各自人设和此刻心情说一句。"),
        busy
          ? h("div", { style: { padding: "40px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "TA 们正在看你的账本…")
          : h(Fragment, null,
              h("div", { style: { flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 } },
                chars.map(c => {
                  const on = sel.includes(c.id); const md = moodOf(c.id);
                  return h("button", { key: c.id, onClick: () => toggle(c.id), className: "active:opacity-80 text-left",
                    style: { display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 12, background: on ? ACCENT : t.bg2, border: "1px solid " + (on ? ACCENT : t.line) } },
                    h(Avatar, { character: c, size: 32, radius: 9 }),
                    h("div", { style: { minWidth: 0, flex: 1 } },
                      h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: on ? "#fff" : t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.name),
                      md ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: on ? "rgba(255,255,255,0.75)" : t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, md) : null));
                })),
              h("button", { onClick: run, disabled: !sel.length, className: "w-full active:opacity-85",
                style: { background: sel.length ? ACCENT : t.line, color: "#fff", border: "none", borderRadius: 999, padding: "14px 0", fontFamily: F_BODY, fontSize: 14.5, fontWeight: 600 } },
                sel.length ? "生成批注（" + sel.length + " 人）" : "选一个或几个角色"))));
  }

  // ============================================================
  // 记一笔（新增）
  // ============================================================
  function AddSheet(props) {
    const t = useTheme();
    const { curs } = props;
    const [type, setType] = useState("expense");
    const [amount, setAmount] = useState("");
    const [code, setCode] = useState(curs[0] ? curs[0].code : "CAD");
    const [cat, setCat] = useState(null);
    const [date, setDate] = useState(todayStr());
    const [note, setNote] = useState("");
    const [addingCur, setAddingCur] = useState(false);

    const catList = (props.settings.cats[type] || []);
    const cur = curs.find(c => c.code === code) || curs[0];

    const addCustomCat = () => {
      const name = window.prompt("新分类名称"); if (!name || !name.trim()) return;
      const emoji = window.prompt("给它一个 emoji（可留空）", "") || "";
      const nc = { name: name.trim(), emoji: emoji.trim() };
      props.onAddCat(type, nc); setCat(nc);
    };
    const addCustomCur = () => {
      const label = window.prompt("币种名称（如 日元）"); if (!label || !label.trim()) return;
      const codeIn = (window.prompt("三字母代码（如 JPY）") || "").trim().toUpperCase(); if (!codeIn) return;
      const symbol = (window.prompt("符号（如 ¥、$、€）", "") || "").trim();
      const nc = { code: codeIn, symbol: symbol || codeIn, label: label.trim() };
      props.onAddCurrency(nc); setCode(nc.code); setAddingCur(false);
    };

    const canSave = amount && Number(amount) > 0 && cat;
    const save = () => {
      if (!canSave) return;
      props.onSave({
        id: "l" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
        ts: Date.now(), date, type, amount: Math.round(Number(amount) * 100) / 100,
        currency: code, category: cat.name, catEmoji: cat.emoji || "", note: note.trim(), comments: []
      });
    };

    const seg = (val, label) => h("button", { onClick: () => { setType(val); setCat(null); }, className: "flex-1 active:opacity-80",
      style: { padding: "9px 0", borderRadius: 10, fontFamily: F_BODY, fontSize: 13.5, fontWeight: 600, border: "none",
        background: type === val ? (val === "income" ? INC : EXP) : "transparent", color: type === val ? "#fff" : t.sub } });

    return h("div", { style: { position: "absolute", inset: 0, zIndex: 50, background: "rgba(20,18,15,0.4)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }, onClick: props.onClose },
      h("div", { onClick: e => e.stopPropagation(), style: { background: t.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "8px 20px calc(env(safe-area-inset-bottom, 0px) + 18px)", maxHeight: "90%", display: "flex", flexDirection: "column" } },
        h("div", { style: { width: 38, height: 4, borderRadius: 4, background: t.line, margin: "0 auto 14px" } }),
        // 收支切换
        h("div", { style: { display: "flex", gap: 4, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: 3, marginBottom: 16 } },
          seg("expense", "支出"), seg("income", "收入")),
        h("div", { style: { flex: 1, overflowY: "auto" } },
          // 金额 + 币种
          h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 18 } },
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 30, color: t.ink } }, cur ? cur.symbol : ""),
            h("input", { value: amount, onChange: e => setAmount(e.target.value.replace(/[^0-9.]/g, "")), inputMode: "decimal", placeholder: "0",
              style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 34, color: t.ink, background: "transparent", border: "none", borderBottom: "1.5px solid " + t.line, outline: "none", padding: "2px 0" } })),
          // 币种选择
          h("div", { style: { display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20 } },
            curs.map(c => h("button", { key: c.code, onClick: () => setCode(c.code), className: "active:opacity-70",
              style: { fontFamily: F_BODY, fontSize: 12.5, color: code === c.code ? "#fff" : t.sub, background: code === c.code ? ACCENT : t.bg2, border: "1px solid " + (code === c.code ? ACCENT : t.line), borderRadius: 999, padding: "6px 13px" } },
              c.label + " " + c.code)),
            h("button", { onClick: addCustomCur, className: "active:opacity-70",
              style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, background: t.bg2, border: "1px dashed " + t.line, borderRadius: 999, padding: "6px 13px" } }, "＋币种")),
          // 分类网格
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 10, letterSpacing: "0.05em" } }, "分类"),
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 9, marginBottom: 20 } },
            catList.map(c => { const on = cat && cat.name === c.name;
              return h("button", { key: c.name, onClick: () => setCat(c), className: "active:opacity-70",
                style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "11px 0", borderRadius: 12, background: on ? ACCENT : t.bg2, border: "1px solid " + (on ? ACCENT : t.line) } },
                h("span", { style: { fontSize: 20 } }, c.emoji || "•"),
                h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: on ? "#fff" : t.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" } }, c.name)); }),
            h("button", { onClick: addCustomCat, className: "active:opacity-70",
              style: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: "11px 0", borderRadius: 12, background: t.bg2, border: "1px dashed " + t.line, color: t.fog } },
              h("span", { style: { fontSize: 20, lineHeight: 1 } }, "＋"),
              h("span", { style: { fontFamily: F_BODY, fontSize: 11 } }, "自定义"))),
          // 日期 + 备注
          h("div", { style: { display: "flex", gap: 10, marginBottom: 12 } },
            h("input", { type: "date", value: date, onChange: e => setDate(e.target.value),
              style: { flex: 1, fontFamily: F_BODY, fontSize: 13, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "10px 12px", outline: "none" } })),
          h("input", { value: note, onChange: e => setNote(e.target.value), placeholder: "备注（可留空）", maxLength: 60,
            style: { width: "100%", fontFamily: F_BODY, fontSize: 13, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "10px 12px", outline: "none", marginBottom: 18 } })),
        h("button", { onClick: save, disabled: !canSave, className: "w-full active:opacity-85",
          style: { background: canSave ? ACCENT : t.line, color: "#fff", border: "none", borderRadius: 999, padding: "14px 0", fontFamily: F_BODY, fontSize: 15, fontWeight: 600 } },
          "记好了")));
  }

  // ============================================================
  // 设置：谁能看到我的账（复用可见性思路）
  // ============================================================
  function SettingsSheet(props) {
    const t = useTheme();
    const [sel, setSel] = useState((props.settings.visibleTo || []).slice());
    const chars = props.characters || [];
    const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : s.concat([id]));
    const save = () => { props.onSaveVisible(sel); props.onClose(); };

    return h("div", { style: { position: "absolute", inset: 0, zIndex: 50, background: "rgba(20,18,15,0.4)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }, onClick: props.onClose },
      h("div", { onClick: e => e.stopPropagation(), style: { background: t.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "20px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)", maxHeight: "80%", display: "flex", flexDirection: "column" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: t.ink, marginBottom: 4 } }, "谁能看到我的账"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 16, lineHeight: 1.55 } }, "被选中的角色在聊天里能自然感知你本月的真实收支和几笔大开销，按人设关心或调侃你。只是让 TA 知道，不碰任何余额。"),
        chars.length
          ? h(Fragment, null,
              h("div", { style: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 } },
                chars.map(c => { const on = sel.includes(c.id);
                  return h("button", { key: c.id, onClick: () => toggle(c.id), className: "active:opacity-80",
                    style: { display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 12, background: t.bg2, border: "1px solid " + (on ? ACCENT : t.line) } },
                    h(Avatar, { character: c, size: 36, radius: 10 }),
                    h("span", { style: { flex: 1, textAlign: "left", fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, c.name),
                    h("div", { style: { width: 22, height: 22, borderRadius: 999, border: "1.5px solid " + (on ? ACCENT : t.line), background: on ? ACCENT : "transparent", display: "flex", alignItems: "center", justifyContent: "center" } },
                      on ? h(ICheck, { size: 13, color: "#fff" }) : null)); })),
              h("button", { onClick: save, className: "w-full active:opacity-85",
                style: { background: ACCENT, color: "#fff", border: "none", borderRadius: 999, padding: "14px 0", fontFamily: F_BODY, fontSize: 14.5, fontWeight: 600 } }, "保存"))
          : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, textAlign: "center", padding: "20px 0" } }, "先去『名录』建个角色")));
  }

  window.Ledger = Ledger;
})();
