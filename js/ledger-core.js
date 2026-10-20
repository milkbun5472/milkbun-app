// ============================================================
// 记账 · 开机就要的那一份（从 js/ledger.js 搬出来，她 2026-10-18 瘦身）
// ============================================================
// 记账页面（ledger.js）改成点进记账才加载；可这些开机、后台、聊天里就要：
//   · 周期账单到点自动记（app.js 开机和切回前台都会 ledgerCatchUp）
//   · 主屏记账小组件（ledgerWidgetData、ledgerIsGlass）
//   · 聊天里TA知道你的开销（ledgerNoteFor）、替你记一笔（ledgerAddByChar、ledgerChoices）、转发进聊天（ledgerShareMessage、ledgerMarkShared）
// 数据读写、格式化、统计这些算账的家伙什也都住在这儿：页面那份从 window.LedgerCore 取，一样只认这一份。
(function () {
  const ACCENT = "#4f6d5a";   // 记账主色（沉静的墨绿）
  const GOLD = "#b89150";
  const EXP = "#c25a4a";      // 支出（暖红）
  const INC = "#4f6d5a";      // 收入（绿）
  // ── 这一屋子的材质：一本账簿（v60.66，她 2026-09-02「界面米白有点无聊」）──
  // 原来整页就是主题的素米白——那是【没有材质】，不是一种材质，所以放哪儿都一样。
  // 现在页面本身是一张账簿纸：淡横格 + 左边那两道红色分栏线（一粗一细）。
  // 这个底换到别的功能上立刻不成立——只有记账才画分栏线。
  const PAPER = "#f2ece0";                       // 账簿纸
  const paperBg = () => {
    const PAPER = pageColor("ledger", "bg", "#f2ece0");
    const RULE = pageColor("ledger", "line", "rgba(60,54,40,.075)");
    const REDL = pageColor("ledger", "tint", "rgba(178,74,58,.34)");
    return {
    backgroundColor: PAPER,
    backgroundImage:
      "linear-gradient(90deg,transparent 0 44px," + REDL + " 44px 45.2px,transparent 45.2px 48px," + REDL.replace(".34", ".18") + " 48px 49px,transparent 49px)," +
      "repeating-linear-gradient(180deg,transparent 0 31px," + RULE + " 31px 32px)"
  }; };
  // 账簿边上伸出来的索引标签（跟查手机账本同一个形状，见 tabs-not-plain-pills.md）：
  // 选中那张满高、纸色，直接长进底下那一页里；没选的往下缩一截、压在后面。
  const bookTab = (on, label, onClick, tint) => h("button", { onClick, className: "flex-1 active:opacity-85",
    style: { minHeight: 44, marginTop: on ? 0 : 5, padding: on ? "12px 0 14px" : "9px 0 11px",
      borderRadius: "10px 10px 0 0", border: "1px solid " + pageColor("ledger", "line", "rgba(60,54,40,.16)"), borderBottom: "none",
      background: on ? pageColor("ledger", "bg", PAPER) : "rgba(60,54,40,.06)", color: on ? (tint || pageColor("ledger", "ink", "#33322c")) : pageColor("ledger", "sub", "rgba(60,54,40,.45)"),
      fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", fontWeight: 600, position: "relative", zIndex: on ? 2 : 1,
      boxShadow: on ? "0 -2px 7px rgba(60,54,40,.06)" : "none" } }, label);
  // 整页壳：顶栏（返回 + 居中小标题 + 右侧等宽位）+ 正文，一律铺账簿纸
  const bookPage = (title, onBack, right, body, footer) => h("div", Object.assign({ className: "h-full flex flex-col" }, { style: Object.assign({}, paperBg()) }),
    h(Head, { zh: title, onBack: onBack, ink: pageColor("ledger", "ink", "#33322c"), bg: "transparent", lineInk: pageColor("ledger", "line", "rgba(60,54,40,.12)"),
      right: right || null }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { overscrollBehavior: "contain" } }, body),
    footer || null);
  const AC = () => (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "");
  // 禁烟这一层（她 2026-09-05：「你看看还有哪儿没禁烟的」）。
  // ⚠️它是【世界事实】，不是文风：这个 app 里没人抽烟，那在哪一处都得成立。
  //   原来它只挂在 buildBundle / groupBans 上，于是【凡是自己拼 sys 的地方一律没有】。
  //   不许塞进 ANTI_CLICHE 搭便车（v55.90 那条：能独立成立的规则就让它独立成立，
  //   挂在别人身上，别人不发的那一轮它就跟着消失）。
  const CB = () => (typeof ContentBoundaries !== "undefined" && ContentBoundaries.prompt ? ContentBoundaries.prompt + "\n\n" : "");

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
    d.settings.budgets = d.settings.budgets && typeof d.settings.budgets === "object" ? d.settings.budgets : {}; // 月预算：{ 币种: 金额 }，每个月都用这一个数
    d.monthly = d.monthly || {}; // 月度盘点：{ "YYYY-MM": { genAt, comments:[{charId,charName,text,ts}] } }
    return d;
  }
  function saveData(d) { saveJSON("x_ledger", d); }

  // ---- 时间 / 金额工具 ----
  function pad(n) { return String(n).padStart(2, "0"); }
  function todayStr() { return ymd(new Date()); }
  function monthKey(dateStr) { return String(dateStr || "").slice(0, 7); }        // "YYYY-MM"
  function todayKey() { return ymd(new Date()); }
  function thisMonthKey() { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
  function fmtMonth(mk) { const p = mk.split("-"); return p[0] + "年" + parseInt(p[1], 10) + "月"; }
  function shiftMonth(mk, delta) {
    const p = mk.split("-"); let y = parseInt(p[0], 10), m = parseInt(p[1], 10) - 1 + delta;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + "-" + pad(m + 1);
  }
  // 日均支出（群里反馈 2026-09-27「记账那里可以添加一个每日花费吗」）：
  //   这个月还没过完就按【已经过去的天数】除，过完了的月份按整月天数除；未来的月份不算。
  function dailyAvg(exp, mk, today) {
    const now = today || new Date(), [y, m] = String(mk).split("-").map(Number);
    if (!y || !m) return null;
    const cur = now.getFullYear() * 12 + now.getMonth(), at = y * 12 + (m - 1);
    if (at > cur) return null;
    const days = at === cur ? now.getDate() : new Date(y, m, 0).getDate();
    return { days, avg: days ? exp / days : 0 };
  }
  // 月预算（她 2026-09-27「预算也加上吧」）：用了多少、还剩多少；这个月还没过完时再算「剩下每天还能花多少」
  //   ——剩的钱除以【含今天在内】还剩几天。超了就是负数，界面照实写超了多少，不替她粉饰。
  function budgetState(budget, exp, mk, today) {
    const b = Number(budget) || 0;
    if (b <= 0) return null;
    const now = today || new Date(), [y, m] = String(mk).split("-").map(Number);
    const left = b - (Number(exp) || 0), used = (Number(exp) || 0) / b;
    const isNow = y === now.getFullYear() && m === now.getMonth() + 1;
    const daysLeft = isNow ? new Date(y, m, 0).getDate() - now.getDate() + 1 : 0;
    return { budget: b, used, left, perDay: isNow && daysLeft > 0 ? left / daysLeft : null, daysLeft };
  }
  // 流水按天分组：每天一个小标题，带当天支出／收入合计（新的在上）
  function groupByDay(list) {
    const out = [], at = {};
    list.forEach(x => { const d = x.date || ""; if (!at[d]) { at[d] = { date: d, rows: [], exp: 0, inc: 0 }; out.push(at[d]); } const g = at[d]; g.rows.push(x); if (isTransfer(x)) return; if (x.type === "income") g.inc += netAmt(x); else g.exp += netAmt(x); });
    return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }
  function dayLabel(dateStr, today) {
    const now = today || new Date(), p = String(dateStr || "").split("-").map(Number);
    if (p.length !== 3 || !p[0]) return fmtDay(dateStr);
    const d = new Date(p[0], p[1] - 1, p[2]), base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((base - d) / 86400000), wk = "周" + "日一二三四五六"[d.getDay()];
    return (diff === 0 ? "今天 " : diff === 1 ? "昨天 " : "") + fmtDay(dateStr) + " " + wk;
  }
  function fmtDay(dateStr) { const p = String(dateStr || "").split("-"); return p.length === 3 ? (parseInt(p[1], 10) + "月" + parseInt(p[2], 10) + "日") : dateStr; }
  function fmtNum(n) { const v = Math.round((Number(n) || 0) * 100) / 100; return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
  function fmtAmt(n, cur) { return (cur ? cur.symbol : "") + fmtNum(n); }

  // ---- 账户（她 2026-09-29 定的三件事：信用卡按账单周期算；角色看不看得到余额单独一个开关；每种卡一种卡面颜色）----
  //   settings.accounts: [{ id, name, type, currency, init, limit, billDay, dueDay }]
  //   一笔收支挂 txn.account；转账是 type:"transfer"（from → to），还信用卡就是储蓄卡转给信用卡。
  //   ⚠️转账不是支出也不是收入：所有汇总（统计、日历、预算、角色看到的收支）都必须跳过它。
  //   余额不另存，每次现算＝初始余额 + 这个账户的收入 − 支出 ± 转账，永远对得上。
  const ACCT_TYPES = [
    { id: "debit", zh: "储蓄卡", hue: -30, tint: "#8fb2e6" },
    { id: "credit", zh: "信用卡", hue: 40, tint: "#ec8fb3" },
    { id: "cash", zh: "现金", hue: 0, tint: "#a68ae6" },
    { id: "wallet", zh: "支付宝/微信", hue: -105, tint: "#7fcfb6" },
    { id: "other", zh: "其他", hue: 160, tint: "#c3c7e2" }
  ];
  const acctType = id => ACCT_TYPES.find(x => x.id === id) || ACCT_TYPES[ACCT_TYPES.length - 1];
  const isTransfer = t => !!t && t.type === "transfer";
  // 退款 / AA 回款（她 2026-09-29）：挂在原来那笔支出上 t.refunds=[{date,amount,note}]，这笔的支出按净额算；不另记一笔收入把收入弄虚
  const refundSum = t => ((t && t.refunds) || []).reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const netAmt = t => Math.max(0, Math.round(((Number(t && t.amount) || 0) - (t && t.type !== "income" && !isTransfer(t) ? refundSum(t) : 0)) * 100) / 100);
  const isExpense = t => !!t && t.type !== "income" && t.type !== "transfer";
  function acctEffect(t, id) {
    const a = isTransfer(t) ? (Number(t.amount) || 0) : netAmt(t);
    if (isTransfer(t)) return (t.to === id ? a : 0) - (t.from === id ? a : 0);
    if (t.account !== id) return 0;
    return t.type === "income" ? a : -a;
  }
  // beforeDate：只算这一天【之前】的账（出账单那天算进下一期）
  function acctBalance(acct, txns, beforeDate) {
    let b = Number(acct.init) || 0;
    (txns || []).forEach(t => { if (beforeDate && !(String(t.date) < beforeDate)) return; b += acctEffect(t, acct.id); });
    return Math.round(b * 100) / 100;
  }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  // 信用卡：余额是负的就是欠款。设了账单日就按周期算——上一个账单日那天欠的，减掉那之后还进去的，就是本期应还；
  //   账单日之后新刷的算下一期（unbilled）。还款日在账单日后面的同月，否则顺延到下个月。
  function creditState(acct, txns, today) {
    const now = today || new Date();
    const bal = acctBalance(acct, txns);
    const owed = Math.max(0, -bal), limit = Number(acct.limit) || 0;
    const out = { bal, owed, limit, avail: limit ? Math.round((limit - owed) * 100) / 100 : null };
    const B = Math.min(28, Math.max(1, parseInt(acct.billDay, 10) || 0));
    if (!acct.billDay) return out;
    const lb = now.getDate() >= B ? new Date(now.getFullYear(), now.getMonth(), B) : new Date(now.getFullYear(), now.getMonth() - 1, B);
    const lbKey = ymd(lb);
    const owedAtBill = Math.max(0, -acctBalance(acct, txns, lbKey));
    let credits = 0, spent = 0;
    (txns || []).forEach(t => { if (String(t.date) < lbKey) return; const e = acctEffect(t, acct.id); if (e > 0) credits += e; else spent -= e; });
    const D = Math.min(28, Math.max(1, parseInt(acct.dueDay, 10) || B));
    const due = new Date(lb.getFullYear(), lb.getMonth() + (D > B ? 0 : 1), D);
    const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Object.assign(out, { billDate: lbKey, due: Math.max(0, Math.round((owedAtBill - credits) * 100) / 100), unbilled: Math.round(spent * 100) / 100,
      dueDate: ymd(due), daysLeft: Math.round((due - today0) / 86400000) });
  }
  // ---- 周期账单（她 2026-09-29）：房租、订阅、话费这类，设一次，每月到那天自动记上一笔 ----
  //   settings.recurring: [{ id, name, type, amount, currency, category, catIcon, account, day(1–28), startMk, lastMk }]
  //   打开记账时补记：从 lastMk 的下个月（没有就 startMk）一直补到这个月，只补日子已经到了的。
  //   每笔的 id 是 "r" + 规则 id + 月份，补记重复跑也不会记两次。
  // 每周／每两周（群友 2026-10-15「想要一周一周进帐」）：every＝"week"/"2week"，wd＝周几（1 周一…7 周日），
  //   起点 startDate、记到 lastDate；每笔 id＝"r"+规则id+那天日期，补记重跑也不会记两次。不填 every＝原来的每月。
  const recurStep = r => r.every === "2week" ? 14 : r.every === "week" ? 7 : 0;
  const addDays = (k, n) => { const x = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10) + n); return ymd(x); };
  function recurWeekStart(wd, now) { const t = new Date(now.getFullYear(), now.getMonth(), now.getDate()), cur = (t.getDay() + 6) % 7 + 1; return ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() + ((wd - cur + 7) % 7))); }
  function runRecurring(d, now) {
    now = now || new Date();
    const today = ymd(now), thisMk = today.slice(0, 7);
    let added = 0;
    (d.settings.recurring || []).forEach(r => {
      const step = recurStep(r);
      if (step) {
        let k = r.lastDate ? addDays(r.lastDate, step) : (r.startDate || today);
        for (let guard = 0; guard < 400 && k <= today; guard++, k = addDays(k, step)) {
          const id = "r" + r.id + k.replace(/-/g, "");
          if (!d.txns.some(x => x.id === id)) {
            d.txns = [{ id, ts: new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10), 9).getTime(), date: k, type: r.type === "income" ? "income" : "expense", amount: Number(r.amount) || 0,
              currency: r.currency, account: r.account || "", category: r.category, catEmoji: "", catIcon: r.catIcon || "", note: r.name || "", recur: r.id, comments: [] }].concat(d.txns);
            added++;
          }
          r.lastDate = k;
        }
        return;
      }
      const D = Math.min(28, Math.max(1, parseInt(r.day, 10) || 1));
      let mk = r.lastMk ? shiftMonth(r.lastMk, 1) : (r.startMk || thisMk);
      for (let guard = 0; guard < 36 && mk <= thisMk; guard++, mk = shiftMonth(mk, 1)) {
        const date = mk + "-" + pad(D);
        if (date > today) break;
        const id = "r" + r.id + mk.replace("-", "");
        if (!d.txns.some(x => x.id === id)) {
          d.txns = [{ id, ts: new Date(mk.slice(0, 4), parseInt(mk.slice(5), 10) - 1, D, 9).getTime(), date, type: r.type === "income" ? "income" : "expense", amount: Number(r.amount) || 0,
            currency: r.currency, account: r.account || "", category: r.category, catEmoji: "", catIcon: r.catIcon || "", note: r.name || "", recur: r.id, comments: [] }].concat(d.txns);
          added++;
        }
        r.lastMk = mk;
      }
    });
    return added;
  }
  // 下一次什么时候记（给列表和提醒用）
  function recurNext(r, now) {
    now = now || new Date();
    const step = recurStep(r);
    if (step) {
      const date = r.lastDate ? addDays(r.lastDate, step) : (r.startDate || ymd(now));
      const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { date, days: Math.round((new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) - t0) / 86400000) };
    }
    const D = Math.min(28, Math.max(1, parseInt(r.day, 10) || 1)), today = ymd(now);
    let mk = r.lastMk ? shiftMonth(r.lastMk, 1) : (r.startMk || today.slice(0, 7));
    const date = mk + "-" + pad(D);
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { date, days: Math.round((new Date(+mk.slice(0, 4), +mk.slice(5) - 1, D) - t0) / 86400000) };
  }
  // 导出 CSV（她 2026-09-29）：带 BOM，Excel 直接打开中文不乱码；转账写清楚从哪到哪
  function ledgerCSV(d) {
    const q = v => { const t = String(v == null ? "" : v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const an = id => id ? acctName(d.settings, id) : "";
    const rows = [["日期", "类型", "金额", "币种", "分类", "账户", "转出", "转入", "备注", "已退"]];
    d.txns.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.ts || 0) - (b.ts || 0))).forEach(t => {
      const x = isTransfer(t);
      rows.push([t.date, x ? "转账" : t.type === "income" ? "收入" : "支出", Number(t.amount) || 0, t.currency, x ? "" : t.category, x ? "" : an(t.account), x ? an(t.from) : "", x ? an(t.to) : "", t.note || "", refundSum(t) || ""]);
    });
    return "\ufeff" + rows.map(r => r.map(q).join(",")).join("\r\n");
  }
  // ---- 折合（她 2026-09-29）：settings.rates { 币种: 1 这个币 = 多少主币 }，settings.baseCur 主币；只用来看，不改任何一笔 ----
  function convertTotal(txns, settings, mk, kind) {
    const base = settings.baseCur, rates = settings.rates || {};
    if (!base) return null;
    let sum = 0, missing = [];
    (settings.currencies || []).forEach(c => {
      const s = summarize(txns, c.code, mk), v = kind === "income" ? s.inc : s.exp;
      if (!v) return;
      const r = c.code === base ? 1 : Number(rates[c.code]);
      if (!(r > 0)) { missing.push(c.code); return; }
      sum += v * r;
    });
    return { base, sum: Math.round(sum * 100) / 100, missing };
  }
  // ---- 存钱目标：settings.goals [{ id, name, target, currency, due, log:[{date,amount}] }] ----
  //   存进去 / 取出来都只记在目标自己的 log 上，不算支出——钱只是换了个罐子
  const goalSaved = g => Math.round(((g && g.log) || []).reduce((a, x) => a + (Number(x.amount) || 0), 0) * 100) / 100;
  function goalState(g, today) {
    const saved = goalSaved(g), target = Number(g.target) || 0, now = today || new Date();
    const out = { saved, target, pct: target ? Math.min(1, Math.max(0, saved / target)) : 0, left: Math.max(0, Math.round((target - saved) * 100) / 100), done: target > 0 && saved >= target };
    if (g.due) {
      const [y, m, d] = String(g.due).split("-").map(Number);
      const days = Math.round((new Date(y, m - 1, d) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
      out.days = days;
      const months = Math.max(1, Math.ceil(days / 30));
      out.perMonth = days > 0 && !out.done ? Math.round(out.left / months * 100) / 100 : null;
    }
    return out;
  }
  // ---- 分类预算：settings.catBudgets { 币种: { 分类名: 每月上限 } } ----
  const catBudgetOf = (settings, code, name) => Number((((settings && settings.catBudgets) || {})[code] || {})[name]) || 0;
  // ---- 年度回顾 ----
  function yearStats(txns, code, year) {
    const Y = String(year), mine = (txns || []).filter(t => t.currency === code && String(t.date).slice(0, 4) === Y && !isTransfer(t));
    const exps = mine.filter(isExpense);
    let exp = 0, inc = 0; const cats = {}, months = {};
    mine.forEach(t => { const a = netAmt(t); if (t.type === "income") inc += a; else { exp += a; cats[t.category] = (cats[t.category] || 0) + a; months[monthKey(t.date)] = (months[monthKey(t.date)] || 0) + a; } });
    const catList = Object.keys(cats).map(k => ({ name: k, amount: Math.round(cats[k] * 100) / 100 })).sort((a, b) => b.amount - a.amount);
    const freq = {}; exps.forEach(t => { freq[t.category] = (freq[t.category] || 0) + 1; });
    const mostOften = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0] || "";
    const monthList = Object.keys(months).sort();
    const cheapest = monthList.slice().sort((a, b) => months[a] - months[b])[0] || "", priciest = monthList.slice().sort((a, b) => months[b] - months[a])[0] || "";
    const biggest = exps.slice().sort((a, b) => netAmt(b) - netAmt(a))[0] || null;
    return { year: Y, exp: Math.round(exp * 100) / 100, inc: Math.round(inc * 100) / 100, net: Math.round((inc - exp) * 100) / 100, count: mine.length, catList,
      mostOften, mostOftenN: freq[mostOften] || 0, cheapest, cheapestAmt: months[cheapest] || 0, priciest, priciestAmt: months[priciest] || 0, biggest, months };
  }
  const acctName = (settings, id) => { const a = ((settings && settings.accounts) || []).find(x => x.id === id); return a ? a.name : "已删的账户"; };

  // 某币种在某月的收支汇总 + 分类明细
  function summarize(txns, code, mk) {
    let exp = 0, inc = 0; const cats = {};
    txns.forEach(t => {
      if (t.currency !== code || monthKey(t.date) !== mk || isTransfer(t)) return;
      const a = netAmt(t);
      if (t.type === "income") inc += a;
      else { exp += a; if (!cats[t.category]) cats[t.category] = { amount: 0, emoji: t.catEmoji || "" }; cats[t.category].amount += a; }
    });
    const catList = Object.keys(cats).map(k => ({ name: k, amount: cats[k].amount, emoji: cats[k].emoji })).sort((x, y) => y.amount - x.amount);
    return { exp, inc, net: inc - exp, catList, count: txns.filter(t => t.currency === code && monthKey(t.date) === mk && !isTransfer(t)).length };
  }

  // 主屏记账小组件数据（纯本地零 API）：本月各币种 支出/收入/最大分类
  window.ledgerWidgetData = function () {
    try {
      const d = loadData();
      const curs = d.settings.currencies || DEFAULT_CURS;
      const mk = thisMonthKey();
      return curs.map(c => {
        const s = summarize(d.txns || [], c.code, mk);
        return { code: c.code, symbol: c.symbol || "", label: c.label || c.code, exp: s.exp, inc: s.inc, count: s.count, topCat: s.catList[0] ? (s.catList[0].emoji ? s.catList[0].emoji + s.catList[0].name : s.catList[0].name) : "" };
      }).filter(r => r.count > 0);
    } catch (e) { return []; }
  };

  // ============================================================
  // 事件判定（纯本地、零 API）：这笔账值不值得角色「自己注意到、主动开口」
  // 命中返回 {key,desc}，没命中返回 null——绝大多数账没事件，一分钱 API 不花
  // ============================================================
  function detectTxnEvent(txns, txn, cur) {
    const a = Number(txn.amount) || 0;
    if (!(a > 0) || isTransfer(txn)) return null;
    const hist = txns.filter(x => x.id !== txn.id && x.currency === txn.currency && x.type === txn.type);
    if (txn.type === "expense") {
      // 大额：比 Ta 平时单笔支出的均值高出 3 倍以上（至少 5 笔历史才有「平时」可言）
      if (hist.length >= 5) {
        const avg = hist.reduce((s, x) => s + (Number(x.amount) || 0), 0) / hist.length;
        if (avg > 0 && a >= avg * 3) return { key: "big", desc: "这笔（" + fmtAmt(a, cur) + "）比 Ta 平时一笔的水平（约 " + fmtAmt(avg, cur) + "）大出好几倍" };
      }
      // 高频：本月同分类第 5、10、15…笔（每满 5 提一次，不然天天唠叨）
      const catN = txns.filter(x => x.type === "expense" && x.currency === txn.currency && x.category === txn.category && monthKey(x.date) === monthKey(txn.date)).length;
      if (catN >= 5 && catN % 5 === 0) return { key: "freq", desc: "这已经是 Ta 这个月第 " + catN + " 笔『" + txn.category + "』了" };
      // 深夜：0~5 点当天记的支出（熬夜花钱最容易被逮到）
      const hour = new Date().getHours();
      if (hour < 5 && txn.date === todayStr()) return { key: "night", desc: "现在是深夜" + (hour === 0 ? "十二" : hour) + "点多，Ta 深更半夜还在花钱" };
    } else {
      // 大进账：比平时收入的均值高出 2 倍以上（至少 2 笔历史）
      if (hist.length >= 2) {
        const avg = hist.reduce((s, x) => s + (Number(x.amount) || 0), 0) / hist.length;
        if (avg > 0 && a >= avg * 2) return { key: "income", desc: "这是笔难得的大进账（" + fmtAmt(a, cur) + "）" };
      }
    }
    return null;
  }

  // ============================================================
  // 供聊天引擎调用：把「被授权角色能看到的记账动态」拼成一段（financeNote）
  // 只读、只感知，绝不碰钱包/角色余额。app.js 的 ctxFor 会调用它。
  // ============================================================
  // 聊天里 TA 替她记账的那张卡要跟账本同一套皮：玻璃皮就出小票（components.js RecordedCard 读这个）
  // 一打开 App 就补记周期账单（她 2026-10-15「改吧宝宝 一打开就补」）：不用等进记账那一页。
  //   ⚠️存档还没读出来（null）就什么都不做——拿默认空账本去补再写回，会把整本账盖掉。
  window.ledgerCatchUp = function () {
    try {
      const raw = loadJSON("x_ledger", null);
      if (!raw || !raw.settings || !(raw.settings.recurring || []).length) return 0;
      const d = loadData(), n = runRecurring(d);
      if (n) saveData(d);
      return n;
    } catch (e) { return 0; }
  };
  window.ledgerIsGlass = function () { try { const d = loadJSON("x_ledger", null); return !(d && d.settings && d.settings.skin === "paper"); } catch (e) { return true; } };
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
      // 账户余额：单独一个开关（settings.shareAcct），默认不给
      const accts = d.settings.shareAcct ? (d.settings.accounts || []) : [];
      if (accts.length) lines.push("账户：" + accts.map(a => {
        const cur = curs.find(c => c.code === a.currency) || { symbol: "" };
        if (a.type === "credit") { const cs = creditState(a, txns); return a.name + "（信用卡）欠 " + fmtAmt(cs.owed, cur) + (cs.due ? "，本期应还 " + fmtAmt(cs.due, cur) + "，" + fmtDay(cs.dueDate) + "到期" : ""); }
        return a.name + " 余额 " + fmtAmt(acctBalance(a, txns), cur);
      }).join("；"));
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
  // ⚠️包一层：没开全局可见的角色，ledgerNoteFor 上面那段会直接 return ""，
  // 但TA【自己替她记的那几笔】仍然该知道，否则「记好了TA能看到这笔」就是空话。
  const _ledgerNoteBase = window.ledgerNoteFor;
  window.ledgerNoteFor = function (charId) {
    const main = _ledgerNoteBase(charId) || "";
    const own = ledgerOwnLines(charId);
    const life = ledgerLifeLines(charId);
    return [main, own, life].filter(Boolean).join("\n");
  };

  // 同一笔的分享卡和后续线索只读取已存账单，不带账户或其他人的批注。
  function ledgerLifeLines(charId) {
    if (!charId) return "";
    const d = loadData(), global = d.settings.visibleTo.includes(charId);
    const rows = d.txns.map(t => global || t.byChar === charId ? t : (t.sharedWith || {})[charId])
      .filter(t => t && !isTransfer(t) && String(t.note || "").trim())
      .slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 6);
    if (!rows.length) return "";
    return "你已知道的生活线索（日期是记录日期，结果以你们实际聊过的内容为准）：\n" + rows.map(t => {
      const cur = d.settings.currencies.find(c => c.code === t.currency) || { symbol: "" };
      const own = (t.comments || []).filter(c => c.charId === charId).slice(-1)[0];
      return "· " + t.date + " · " + t.category + " · " + fmtAmt(netAmt(t), cur) + " · " + t.note
        + (own ? "；你当时的批注：" + own.text : "");
    }).join("\n");
  }
  window.ledgerShareMessage = function (txnId, charId) {
    if (!charId) return null;
    const d = loadData(), txn = d.txns.find(t => t.id === txnId);
    if (!txn) return null;
    const cur = d.settings.currencies.find(c => c.code === txn.currency) || { symbol: "", label: txn.currency };
    const title = (isTransfer(txn) ? "⇄ " : txn.type === "income" ? "+" : "−") + fmtMoney(isTransfer(txn) ? txn.amount : netAmt(txn), cur) + " " + txn.category;
    const note = String(txn.note || "");
    const own = (txn.comments || []).filter(c => c.charId === charId).slice(-1)[0];
    return { role: "user", kind: "ledgershare", what: "ledger", ledgerId: txn.id, title, sub: txn.date + " · " + cur.label, note,
      content: "【我拿这笔个人账单给你看】\n" + txn.date + " · " + title + "（" + cur.label + "）"
        + (note ? "\n备注：" + note : "") + (own ? "\n你之前对这笔的批注：" + own.text : "")
        + "\n这是我主动分享的这一笔生活记录，可以接着和我聊。", ts: Date.now(), read: false };
  };
  window.ledgerMarkShared = function (txnId, charId) {
    if (!charId) return;
    const d = loadData(), txn = d.txns.find(t => t.id === txnId);
    if (!txn) return;
    // 保留分享那一刻的内容；后来编辑账单，不会悄悄扩大单笔分享。
    txn.sharedWith = Object.assign({}, txn.sharedWith, { [charId]: {
      id: txn.id, date: txn.date, type: txn.type, category: txn.category, amount: isTransfer(txn) ? txn.amount : netAmt(txn),
      currency: txn.currency, note: String(txn.note || ""), ts: Date.now()
    } });
    saveData(d);
  };

  // 角色替她记一笔（她 2026-08-30：「我说帮我记加币 xx 元吃东西，他们也能记上」）。
  // ⚠️币种和分类【只能从她已有的那几个里挑】：模型自己编一个 "CAD$" 或者「吃饭」出来，
  // 这笔就永远归不进任何一栏汇总，看着记上了其实是废的。认不出就退回默认那一个。
  // ⚠️「记好默认他们能看到这笔」＝只让TA看到【这一笔】，不是把整本账开给TA：
  // 账本的可见是全局开关（settings.visibleTo），随手打开等于把她所有开销一次性交出去。
  // 所以这里只在这一条上记 byChar，ledgerNoteFor 单独把「TA自己记的那几笔」发回去。
  const LEDGER_CAP = 2000;
  window.ledgerAddByChar = function (charId, tx) {
    try {
      if (!tx) return null;
      const amount = Math.round((Number(tx.amount) || 0) * 100) / 100;
      if (!(amount > 0)) return null;
      const d = loadData();
      const curs = d.settings.currencies || DEFAULT_CURS;
      const want = String(tx.currency || "").trim().toUpperCase();
      const cur = curs.find(c => c.code.toUpperCase() === want)
        || curs.find(c => String(c.label || "") === String(tx.currency || "").trim())
        || curs[0];
      const type = tx.type === "income" ? "income" : "expense";
      const pool = (d.settings.cats && d.settings.cats[type]) || [];
      const cat = pool.find(c => c.name === String(tx.category || "").trim()) || pool[pool.length - 1] || { name: "其他", emoji: "✨" };
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(tx.date || "")) ? tx.date : todayStr();
      const item = {
        // id 照手动记那一笔同一个写法（"l"+base36）——这个文件里没有 uid()，
        // 写成 uid("t") 会抛，然后被 try/catch 静默吞掉，变成「说记上了其实没记」
        id: "l" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
        type: type, amount: amount, currency: cur.code,
        category: cat.name, catEmoji: cat.emoji || "", date: date,
        note: String(tx.note || "").trim().slice(0, 60), comments: [], ts: Date.now(), byChar: charId || ""
      };
      d.txns = [item].concat(d.txns || []).slice(0, LEDGER_CAP);
      saveData(d);
      return Object.assign({}, item, { curLabel: cur.label, curSymbol: cur.symbol });
    } catch (e) { return null; }
  };
  // 她现在有哪几个币种、哪几个分类——发给模型当【可选项清单】。
  // ⚠️必须发真实清单：不发的话模型只能瞎猜，猜出来的分类归不进任何一栏汇总。
  // 这也是为什么校验那边挑不中就退回默认那一个，而不是照单收下。
  window.ledgerChoices = function () {
    try {
      const d = loadData();
      const cats = d.settings.cats || {};
      return {
        currencies: (d.settings.currencies || DEFAULT_CURS).map(c => c.label + "(" + c.code + ")"),
        expense: (cats.expense || []).map(c => c.name),
        income: (cats.income || []).map(c => c.name)
      };
    } catch (e) { return { currencies: [], expense: [], income: [] }; }
  };
  // TA自己替她记的那几笔——不受「谁能看到我的账」那个全局开关限制。
  // 是TA记的，TA当然知道；但别的开销仍然只有被授权的人看得见。
  function ledgerOwnLines(charId) {
    try {
      const d = loadJSON("x_ledger", null);
      const txns = (d && Array.isArray(d.txns) ? d.txns : []).filter(t => t && t.byChar === charId).slice(0, 6);
      if (!txns.length) return "";
      const curs = (d.settings && d.settings.currencies) || DEFAULT_CURS;
      return "你替 Ta 记下的几笔：" + txns.map(t => {
        const cur = curs.find(c => c.code === t.currency) || { symbol: "" };
        return fmtDay(t.date) + " " + t.category + " " + fmtAmt(t.amount, cur) + (t.note ? "（" + String(t.note).slice(0, 16) + "）" : "");
      }).join("；");
    } catch (e) { return ""; }
  }

  // ============================================================
  // 模型：多个角色一次性批注同一笔账（一次调用，省 API）
  // 返回按传入顺序对齐的 [{text}]；text 为空串表示这一位没生成出来（上层不入库、提示重试）
  // ============================================================
  async function genComments(active, txn, cur, list, uName, worldbook, opts) {
    const typeZh = txn.type === "income" ? "进账" : "花销";
    const amt = fmtAmt(txn.amount, cur) + "（" + cur.label + "）";
    // 性格升级素材（全部本地算，零额外 API）：
    // ① 该角色最近对别的账说过什么 → 逼 Ta 换新说法，治「每次都同一个梗」
    const allTxns = (loadData().txns || []);
    const prevOf = id => allTxns.filter(x => x.id !== txn.id).flatMap(x => (x.comments || []).filter(cm => cm.charId === id).map(cm => String(cm.text || ""))).filter(Boolean).slice(0, 2);
    // ② 本月同分类的频率/累计 → 角色能说出「这个月第几次了」这种真看过账本的话
    let bgLine = "";
    if (txn.type === "expense") {
      const same = allTxns.filter(x => x.type === "expense" && x.currency === txn.currency && x.category === txn.category && monthKey(x.date) === monthKey(txn.date));
      const tot = same.reduce((s, x) => s + (Number(x.amount) || 0), 0);
      if (same.length > 1) bgLine = "\n【背景】这个月『" + txn.category + "』连这笔已是第 " + same.length + " 笔、共 " + fmtAmt(tot, cur) + "。角色可以自然联系这个频率或累计来说话，但别报账式复述数字。";
    }
    const block = list.map((it, i) => (i + 1) + "、「" + it.name + "」\n  应用称呼：" + characterText(it, "他") + "\n  人设：" + (it.persona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 320) + (it.mood ? "\n  此刻心情：" + it.mood : "")
      + (it.aff != null ? "\n  对 " + uName + " 的好感度：" + Math.round(it.aff) + "/100（据此把握语气的亲疏和上不上心的程度）" : "")
      + (prevOf(it.id).length ? "\n  Ta 最近对别的账说过：" + prevOf(it.id).map(s => "「" + s.slice(0, 40) + "」").join("、") + "——这次必须换新的说法和角度，别复读同样的梗和句式" : "")).join("\n\n");
    // 事件驱动模式：不是用户请 Ta 来看，而是 Ta 自己刷到了这笔账、主动开口的第一反应
    const evIntro = opts && opts.event
      ? uName + " 刚记下一笔" + typeZh + "，下面每位角色恰好【自己注意到】了它——" + opts.event.desc + "。请【分别以每位角色本人的口吻】，各说一句 Ta 主动开口的第一反应：惊讶、皱眉、心疼、打趣、盘问都行，按各自人设来，像 Ta 忍不住先开口的那句。\n"
      : "下面是 " + uName + " 刚记下的一笔真实的" + typeZh + "。请【分别以下面每位角色本人的口吻】，各说一句 Ta 看到 " + uName + " 这笔账时会真实说出口的话。\n";
    const sys = AC() + CB() + NAC() +
      evIntro +
      "【硬性要求，必须做到】\n" +
      "· 真的进入角色、说出有内容有态度的一句，结合人设＋此刻心情＋这笔账的分类和金额。严禁敷衍成『看了一眼没说什么』『无所谓』『随你』这类空话——那是偷懒。\n" +
      "· 各角色以第一人称说自己的话。需要第三人称时，按该条目的「应用称呼」或角色姓名表达。\n" +
      "· 每人一句、口语、像随手发的消息；几个人语气各不相同，别写成同一个腔调，别说教别客套别报流水账。\n" +
      "· 反应可以多样：心疼你乱花、笑你手松、替你算账、酸一下、担心、或只是顺口关心——按各自人设来。\n\n" +
      "【这笔账】" + fmtDay(txn.date) + " · " + typeZh + " · " + txn.category + " · " + amt + (txn.note ? " · 备注：" + txn.note : "") + bgLine + "\n\n" +
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
      return { text: txt };
    });
  }


  // 金额一律两位小数、负号在符号前面：-¥3,174.80，不是 ¥-3,174.8
  function fmtMoney(n, cur) {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    return (v < 0 ? "-" : "") + (cur ? cur.symbol : "") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // 页面那份（ledger.js）要用的算账家伙什，原样递过去
  window.LedgerCore = { fmtMoney, ACCENT, GOLD, EXP, INC, PAPER, paperBg, bookTab, AC, CB, NAC, CUR_COLORS, DEFAULT_CURS, loadData, saveData, pad, todayStr, monthKey, todayKey, thisMonthKey, fmtMonth, shiftMonth, dailyAvg, budgetState, groupByDay, dayLabel, fmtDay, fmtNum, fmtAmt, ACCT_TYPES, acctType, isTransfer, refundSum, netAmt, isExpense, acctBalance, creditState, recurWeekStart, runRecurring, recurNext, ledgerCSV, convertTotal, goalSaved, goalState, catBudgetOf, yearStats, acctName, summarize, detectTxnEvent, genComments };
})();
