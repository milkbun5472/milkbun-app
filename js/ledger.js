// ============================================================
// 记账（ledger）—— 多币种个人记账，独立小 app
// 用户在国外：生活用 CAD、玩游戏充 CNY —— 多币种【各记各的、默认不换算不合并本币】。
//   · 钱包式落地页：币种像卡片叠着，点一张「抽出」看该币种本月富信息汇总（支出/收入/结余+分类+对比+流水入口）
//   · 记一笔：支出/收入切换 · 多币种(可增删改) · 分类网格(可增删改) · 日期 · 备注
//   · 每笔可编辑/删除；可【选多个角色一次性批注】（一次 API 出多人，参考实时心情+人设，忠于性别不偷懒）
//   · 可设「谁能看到我的账」→ 被授权角色在聊天里自然感知真实开销（financeNote，只读、绝不碰钱包/余额）
// 和「钱包」(x_wallet) 是两套钱：钱包=RP 虚构 CNY 经济；这里=你真实的个人财务。互不换算、互不触发。
// 数据存 localStorage x_ledger，随云同步。
// ============================================================
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
      fontFamily: F_BODY, fontSize: 13.5, fontWeight: 600, position: "relative", zIndex: on ? 2 : 1,
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
  function todayStr() { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function monthKey(dateStr) { return String(dateStr || "").slice(0, 7); }        // "YYYY-MM"
  function todayKey() { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
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
  function runRecurring(d, now) {
    now = now || new Date();
    const today = ymd(now), thisMk = today.slice(0, 7);
    let added = 0;
    (d.settings.recurring || []).forEach(r => {
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

  // ============================================================
  // 小工具：风格统一的字段输入弹窗（增/改币种、增/改分类都用它，替掉原生 prompt）
  // fields: [{key,label,value,placeholder,maxLength}]
  // ============================================================
  function FieldDialog(props) {
    const t = useTheme();
    const [vals, setVals] = useState(() => { const o = {}; (props.fields || []).forEach(f => o[f.key] = f.value || ""); return o; });
    const lift = useKbLift();
    const set = (k, v) => setVals(s => ({ ...s, [k]: v }));
    const submit = () => {
      for (const f of props.fields) { if (f.required && !String(vals[f.key] || "").trim()) { return; } }
      props.onSubmit(vals);
    };
    // 果冻电子钱包那套皮里：背后一层淡紫雾，弹窗本身是一块磨砂玻璃，确认键是粉色软糖
    const g = !!props.glass;
    return h("div", { className: "absolute inset-0 z-[60] flex items-center justify-center", style: { background: g ? "rgba(120,110,170,.28)" : pageColor("ledger", "bg2", "rgba(20,19,15,0.5)"), backdropFilter: g ? "blur(6px)" : "blur(3px)", padding: 24 }, onClick: props.onCancel, "data-wk": "ldgfielddialogsubmit" },
      h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", maxWidth: 320, background: g ? "linear-gradient(150deg, rgba(255,255,255,.82), rgba(246,242,255,.72))" : t.bg2, border: g ? "1px solid rgba(255,255,255,.9)" : "none", boxShadow: g ? "0 0 0 1px rgba(160,155,210,.3), inset 1.5px 1.5px 0 #fff, 0 14px 34px rgba(110,100,180,.25)" : "none", backdropFilter: g ? "blur(16px) saturate(1.3)" : "none", borderRadius: 20, padding: "20px 18px 16px", animation: "fadeUp .2s ease both", transform: lift ? "translateY(-" + Math.round(lift / 2) + "px)" : "none", transition: "transform .18s ease" }, "data-wk": "ldgfielddialogtap", "data-part": "1" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, marginBottom: 16, textAlign: "center" } }, props.title),
        (props.fields || []).map(f => h("div", { key: f.key, style: { marginBottom: 12 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 5 } }, f.label),
          // 图标：从画好的那一套里挑一个（不再让她填 emoji）
          f.type === "icon" ? h("div", { "data-ledger-iconpick": true, style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 } },
            Object.keys(CATEGORY_ART).map(k => h("button", { key: k, type: "button", onClick: () => set(f.key, k), "aria-label": "图标 " + k, className: "active:opacity-70",
              style: { height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid " + (vals[f.key] === k ? "#e48cb2" : "transparent"), background: vals[f.key] === k ? "rgba(248,210,228,.45)" : "transparent" }, "data-wk": "ldgfielddialogbtn", "data-part": "图标 " },
              h(CategoryGlyph, { icon: k, size: 26 })))) :
          h("input", { value: vals[f.key], onChange: e => set(f.key, e.target.value), placeholder: f.placeholder || "", maxLength: f.maxLength || 40, disabled: f.locked,
            style: { width: "100%", fontFamily: F_BODY, fontSize: 14, color: f.locked ? t.fog : t.ink, background: g ? "rgba(255,255,255,.55)" : t.bg, border: "1px solid " + (g ? "rgba(170,160,220,.4)" : t.line), borderRadius: 10, padding: "10px 12px", outline: "none" }, "data-wk": "ldgfielddialoginput", "data-part": "1" }))),
        h("div", { className: "flex gap-3", style: { marginTop: 6 } },
          h("button", { onClick: props.onCancel, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 14, color: t.sub, padding: "11px 0", borderRadius: 12, border: "1px solid " + t.line, background: "transparent" }, "data-wk": "ldgfielddialogbtn", "data-part": "cancel" }, "取消"),
          h("button", { onClick: submit, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: g ? "#713c5b" : "#fff", background: g ? "radial-gradient(70% 55% at 40% 18%, rgba(255,255,255,.7), rgba(255,255,255,0) 70%), linear-gradient(160deg, #fcd6e8, #efa3c7)" : pageColor("ledger", "accent", ACCENT), boxShadow: g ? "0 0 0 1px rgba(214,140,180,.45), inset 0 0 0 1px rgba(255,255,255,.6), 0 4px 10px rgba(220,140,185,.3)" : "none", padding: "12px 0", borderRadius: 12, border: "none" }, "data-wk": "ldgfielddialogbtn", "data-part": "3" }, props.submitLabel || "保存"))));
  }

  // ============================================================
  // 账本样式（她 2026-09-28）：换的只是【皮】，排版和功能所有样式共用一份。
  //   skin 存在 settings.skin：glass（果冻电子钱包，默认）| paper（原来那本账簿纸）。
  //
  // ⚠️glass 不是「给普通记账 App 刷一层粉紫」（她第二轮原话：主题只存在于背景）。
  //   它是一台【2000 年代透明果冻塑料的掌上记账机】，每个零件都从这台机器上长出来：
  //   · 外壳 shell  —— 半透明果冻塑料面板：细高光边、内阴影、淡蓝紫折射。所有「卡片」都是它上面的一个舱位。
  //   · 屏幕 screen —— 凹进外壳里的一小块珠光 LCD（淡紫蓝、细扫描线、深紫字）。
  //     ⚠️它只是点睛（她第三轮：「一屏四块灰 LCD，像 2003 年的血糖仪」）：整个记账只有两块——
  //     钱包的余额主屏、记一笔的金额屏。其余数据容器一律用下面的 acrylic。
  //   · 亚克力 acrylic —— 乳白 / 淡粉紫蓝的透明塑料小面板：图表、读数、排行、日历都装在它上面。
  //   · 按键 key    —— 凸起的果冻键：透明外壳 + 浅色芯 + 底下一道硬影，按下去沉 3px。
  //   · 格子 cells  —— 能量槽：进度一格一格点亮成糖果色，没亮的格子是半透明的淡紫塑料，不是灰格。
  //   · 小票 receipt —— 唯一的纸：这台机器吐出来的实体小票，材质上故意和塑料形成反差。
  //   粉/蓝/紫只留给塑料自己的折射和局部发光；背景收成干净的浅灰紫。
  //   比例：七成透明果冻、两成柔和的现代排版、一成复古 LCD。电子等宽字只给余额和金额主数字。
  // ============================================================
  const SKIN_LIST = [
    { id: "glass", zh: "果冻电子钱包", sub: "透明塑料外壳和一块小屏幕" },
    { id: "paper", zh: "账簿", sub: "横格纸和红色分栏线" }
  ];
  // 分类色：同一个分类在图标、仪表环、状态条里用同一个颜色，看颜色就知道是哪类
  const CAT_TINTS = ["#f4a7c1", "#b9a2f0", "#f5c49e", "#9fb6f5", "#8fd4c8", "#f0cf7f", "#e5a3de", "#a9d38c", "#f0a99b", "#98cbf0", "#c9bce6", "#c3ccd8"];
  // 果冻键的几种塑料颜色：[浅, 深]
  // 粉只留给「记一笔」和选中；收入是冰蓝，账单是银灰薰衣草
  const JELLY = { pink: ["#ffc6da", "#ec8fb3"], blue: ["#d3e4fb", "#8fb2e6"], lilac: ["#e4e3f2", "#a9a7cc"], mint: ["#c6eee1", "#7fcfb6"], clear: ["#f6f7fb", "#c6c9da"] };
  const CAL_RAMP = ["#ffe0ec", "#fbc7dd", "#efb8ea", "#d3b2f6", "#b39cf0", "#9885e6"];
  const LCD_INK = "#383552", LCD_DIM = "rgba(200,188,240,.28)";
  const DIGIT = "ui-monospace,'SF Mono','Menlo','Roboto Mono','Consolas',monospace";
  // ============================================================
  // 材质系统（她 2026-09-28 第九轮：「现在是在给东西上颜色，要开始给东西做材质」）
  //   参考图不是 pastel UI，是【透明亚克力电子设备】：光穿过透明材质之后才留下粉蓝紫。
  //   所以卡片几乎不用白：极低透明度的白 + 背后模糊 + 一点饱和度，让后面的环境色透上来；
  //   玻璃感靠四层同时在：透明底 → 极细亮边 → 内侧左上高光 → 右下极淡蓝紫折射边，外面一片冷色环境影（不是灰色投影）。
  //   三个等级，别让所有东西都是同一个白色圆角矩形：
  //   · A 透明亚克力 —— 钱包卡托盘、三颗主键、完成键：最透、边最厚（外轮廓 → 亮唇 → 厚度带 → 内侧折射），带虹彩
  //   · B 磨砂玻璃   —— 余额、预算、统计摘要、日历主体：更雾，但照样透出后面的颜色
  //   · C 薄玻璃     —— 每条账单、小组件：只有透明底 + 发丝边 + 一点高光
  //   判据：截图转灰度以后，还能靠透明度、边缘高光、厚度分出前后层，而不是看到一堆白色圆角矩形。
  // ============================================================
  // ⚠️不描边（她 2026-09-28：「每一个框都搞外面的线，但做不出真正的玻璃质感的话反而很土」）：
  //   玻璃靠的是【光】——透明底、左上一抹柔光、右下一点冷色、外面一片很淡的环境影——不是一圈线。
  //   只有 A 级（托盘、主键、完成键）保留一道极细的内侧亮沿，那是亚克力的厚度；B、C 两级一条线都不画。
  // ⚠️第十三轮·去卡片化（她 2026-09-28）：土感不是玻璃不够，是「一个模块一个圆角矩形」往下堆盒子。
  //   整个产品是【一台透明电子钱包 / 数码随身机】：信息直接印在机身上，只有真正的实体交互或层级才用亚克力。
  //   · 每屏最多一两个大容器；其余靠留白、细线、排版和小实体控件组织。
  //   · 颜色比例：七成冷白 / 银灰 / 极淡薰衣草，两成冰蓝紫，一成粉——粉只给当前操作、支出、选中。
  //   · 少 glow；多冷白、银灰、冰蓝、透明硬塑料。
  // ⚠️第十四轮（她：去卡片化方向对，但删得太干净，像半成品网页）：不再删，也不加卡片，
  //   往骨架上装少量【看得见摸得着的透明硬件零件】——预算凹槽、光盘仪表、树脂键帽、亚克力滑轨、功能键底座。
  //   玻璃只属于能被摸到 / 按下 / 插入的东西；文字、分隔线、列表保持平面。
  //   比例：75% 安静的冷白机身 · 15% 透明硬塑料零件 · 7% 冰蓝淡紫折射 · 3% 粉色当前态。
  //   关键词是 Y2K 透明消费电子 / iMac G3 / 电子宠物，不是 glassmorphism。
  const LINE = "rgba(140,146,184,.22)";          // 机身上的细分隔线
  // 一颗嵌在机身上的透明树脂小件（图标壳、键帽、底座共用）：几乎无色，上沿一丝亮光，底下一点厚度
  const RESIN = { background: "linear-gradient(165deg, rgba(255,255,255,.62), rgba(236,239,248,.22))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.95), inset 0 -2px 3px rgba(118,122,178,.14), 0 1.5px 0 rgba(150,154,200,.3), 0 3px 6px rgba(118,122,178,.1)" };
  // 机械 / 电子感的等宽 grotesk 数字（iOS 上是 DIN）
  const GROTESK = "'DIN Alternate','DIN Condensed','Bahnschrift','Barlow','Roboto Condensed','Arial Narrow',Arial,sans-serif";
  const FLAT = { background: "transparent", border: "none", boxShadow: "none", borderRadius: 0, backdropFilter: "none", WebkitBackdropFilter: "none" };
  const GLASS = {
    A: {
      background: "linear-gradient(135deg, rgba(255,255,255,.3) 0%, rgba(226,238,255,.14) 42%, rgba(255,255,255,.22) 58%, rgba(250,226,244,.18) 100%)",
      border: "none",
      // 虹彩：左上一团粉光、右下一团冰蓝光——用光晕做，不用线
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.75), inset 3px 4px 8px rgba(255,255,255,.5), inset -4px -6px 12px rgba(150,138,228,.16), -4px -3px 10px rgba(255,214,236,.22), 4px 5px 12px rgba(176,208,250,.3)",
      backdropFilter: "blur(10px) saturate(1.45)", WebkitBackdropFilter: "blur(10px) saturate(1.45)"
    },
    B: {
      background: "linear-gradient(118deg, transparent 38%, rgba(255,222,244,.22) 46%, rgba(214,236,255,.24) 53%, transparent 61%), linear-gradient(145deg, rgba(255,255,255,.3) 0%, rgba(248,245,255,.18) 55%, rgba(236,244,255,.22) 100%)",
      border: "none",
      boxShadow: "inset 0 10px 16px -12px rgba(255,255,255,.9), inset -10px -12px 20px -14px rgba(168,148,236,.3), -4px -3px 12px rgba(255,200,232,.16), 4px 6px 16px rgba(176,212,255,.2)",
      backdropFilter: "blur(16px) saturate(1.4)", WebkitBackdropFilter: "blur(16px) saturate(1.4)"
    },
    C: {
      background: "linear-gradient(135deg, rgba(255,255,255,.3), rgba(255,255,255,.1))",
      border: "none",
      boxShadow: "inset 0 8px 12px -10px rgba(255,255,255,.85), 0 4px 14px rgba(122,118,200,.07)",
      backdropFilter: "blur(12px) saturate(1.3)", WebkitBackdropFilter: "blur(12px) saturate(1.3)"
    }
  };
  // A 级的带色版本（三颗主键）：同一块透明亚克力，只是往里透一点自己的颜色
  function glassTinted(a, b) {
    return Object.assign({}, GLASS.A, {
      background: "radial-gradient(70% 55% at 38% 26%, rgba(255,255,255,.55), rgba(255,255,255,0) 70%), linear-gradient(145deg, " + a + "40 0%, " + a + "66 55%, " + b + "4d 100%)",
      border: "none",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.8), inset 3px 4px 8px rgba(255,255,255,.55), inset -4px -6px 12px " + b + "40, -4px -3px 10px rgba(255,214,236,.2), 4px 5px 12px rgba(176,208,250,.28)"
    });
  }
  function ledgerSkin(settings) {
    const id = settings && settings.skin === "paper" ? "paper" : "glass";
    const t = window.__ledgerTheme || {};
    if (id === "paper") {
      const card = { background: t.bg2 || "#faf7f0", border: "1px solid " + (t.line || "rgba(60,54,40,.14)"), borderRadius: 16 };
      return {
        id,
        page: paperBg(),
        ink: pageColor("ledger", "ink", "#33322c"), sub: pageColor("ledger", "sub", "rgba(60,54,40,.62)"), fog: pageColor("ledger", "fog", "rgba(60,54,40,.45)"),
        line: pageColor("ledger", "line", "rgba(60,54,40,.14)"), accent: pageColor("ledger", "accent", ACCENT), pink: pageColor("ledger", "tint", "#c25a4a"),
        exp: pageColor("ledger", "ink", "#33322c"), inc: INC, over: EXP,
        card, shell: card, screen: { background: "rgba(60,54,40,.05)", borderRadius: 12 }, acrylic: { background: "rgba(60,54,40,.04)", borderRadius: 12 }, well: { background: "rgba(60,54,40,.05)", borderRadius: 12 },
        lcd: pageColor("ledger", "ink", "#33322c"), lcdDim: "rgba(60,54,40,.10)",
        num: F_DISPLAY, digit: F_DISPLAY,
        tabBar: { background: "rgba(242,236,224,.94)", borderTop: "1px solid rgba(60,54,40,.12)" }
      };
    }
    const ink = pageColor("ledger", "ink", "#30314e");
    // 参考图的层次：珍珠底、轻薄列表、只有钱包套与按键带折射厚边。
    const shell = {
      background: "linear-gradient(145deg,rgba(255,255,255,.54),rgba(250,249,255,.30))",
      border: "1px solid rgba(255,255,255,.65)", borderRadius: 19,
      boxShadow: "inset 0 1px 2px #fff, 0 1px 4px rgba(103,99,150,.10)"
    };
    return {
      id,
      page: {
        // 机身：冷白 / 银灰为主，只在边角透一点冰蓝和薰衣草，粉几乎没有
        backgroundColor: pageColor("ledger", "bg", "#e9e9f2"),
        backgroundImage: "linear-gradient(118deg, transparent 26%, rgba(255,255,255,.55) 38%, rgba(226,238,252,.35) 46%, transparent 58%)," +
          "radial-gradient(ellipse 70% 42% at 6% 4%, rgba(214,226,246,.7), transparent 70%)," +
          "radial-gradient(ellipse 60% 50% at 100% 36%, rgba(226,220,246,.6), transparent 70%)," +
          "radial-gradient(ellipse 70% 40% at 30% 96%, rgba(236,226,240,.45), transparent 70%)," +
          "linear-gradient(180deg, #f3f4f8, #e9ebf2)",
        backgroundAttachment: "scroll",
        boxShadow: "inset 2px 0 4px rgba(255,255,255,.65), inset -2px 0 4px rgba(135,136,168,.13)"
      },
      ink, sub: pageColor("ledger", "sub", "#656581"), fog: pageColor("ledger", "fog", "#9391ad"),
      line: pageColor("ledger", "line", "rgba(140,135,190,.2)"), accent: pageColor("ledger", "accent", "#8874cf"), pink: pageColor("ledger", "tint", "#d98db2"),
      exp: ink, inc: "#589c98", over: "#bc668c",
      // 卡片不再是白色实体：B 级磨砂玻璃当外壳，C 级薄玻璃当账单条，A 级留给托盘和主键
      card: Object.assign({}, FLAT, { borderBottom: "1px solid " + LINE }), shell: Object.assign({}, FLAT, { borderTop: "1px solid " + LINE }), matA: GLASS.A, glassB: GLASS.B,
      screen: Object.assign({}, GLASS.C, { borderRadius: 13, boxShadow: "inset 0 2px 5px rgba(131,124,169,.12)" }),
      acrylic: { background: "transparent" },
      well: { background: "rgba(255,255,255,.14)", border: "none", borderRadius: 18, boxShadow: "inset 0 2px 5px rgba(140,136,200,.12)" },
      lcd: LCD_INK, lcdDim: LCD_DIM,
      num: GROTESK, digit: GROTESK,
      tabBar: { background: "rgba(233,233,246,.38)", borderTop: "1px solid rgba(146,145,180,.18)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.65)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }
    };
  }
  // 果冻键：透明外壳 + 上半一团浅色芯 + 底下一道硬影（凸起）。pressed＝已经被按下去的那颗（选中态）
  function jellyKey(sk, tone, pressed, extra) {
    if (sk.id !== "glass") return Object.assign({ background: pressed ? "#fff" : "rgba(255,255,255,.6)", border: "1px solid " + sk.line, borderRadius: 14, color: sk.ink }, extra || {});
    const [a, b] = JELLY[tone] || JELLY.clear, clear = tone === "clear";
    // 一颗玻璃软糖键：半透明的面（带色的键里透出颜色）、厚白唇边、上沿高光、底下一点同色厚度
    return Object.assign({
      borderRadius: 14, color: sk.ink, border: "none",
      background: clear ? "linear-gradient(170deg, rgba(255,255,255,.42), rgba(232,235,246,.18))" : "radial-gradient(80% 50% at 40% 12%, rgba(255,255,255,.95), rgba(255,255,255,0) 70%), linear-gradient(170deg, " + a + "cc, " + b + "b3)",
      boxShadow: (pressed ? "inset 0 2px 6px " + b + "80, " : "") + (clear ? "inset 0 1px 0 rgba(255,255,255,.95), inset 1px 0 0 rgba(255,255,255,.5), inset 0 -2px 3px rgba(118,122,178,.18), 0 2px 0 rgba(150,154,200,.34), 0 4px 7px rgba(118,122,178,.1)" : "inset 0 0 0 1px rgba(255,255,255,.65), inset 1px 2px 2px #fff, inset -1px -2px 3px " + b + "6d, 0 1px 2px " + b + "55"),
      transform: pressed ? "translateY(2px)" : "none", transition: "transform .08s, box-shadow .08s"
    }, extra || {});
  }
  // 平的小键（月份箭头、搜索、眼睛）：没有外壳，只有按下去那一下变淡
  const flatKey = (extra) => Object.assign({ background: "transparent" }, extra || {});
  // 按下去那一下（:active）：沉 3px、硬影收起来——写成一条全局样式，每颗键只挂一个 class
  const JELLY_CSS = `
.lg-key{-webkit-tap-highlight-color:transparent}
.lg-gloss{position:relative;overflow:hidden;isolation:isolate}
.lg-gloss::before{content:"";position:absolute;left:4%;right:4%;top:1px;height:54%;background:radial-gradient(ellipse 52% 100% at 50% 0%,rgba(255,255,255,.95) 0%,rgba(255,255,255,.7) 42%,rgba(255,255,255,.18) 66%,rgba(255,255,255,0) 72%);pointer-events:none;z-index:1}
.lg-gloss>*{position:relative;z-index:2}
.lg-gloss-soft::before{height:48%;background:radial-gradient(ellipse 52% 100% at 50% 0%,rgba(255,255,255,.8) 0%,rgba(255,255,255,.45) 45%,rgba(255,255,255,0) 70%)}
.lg-iris{box-shadow:-5px -4px 14px rgba(255,186,226,.42),5px 6px 16px rgba(166,208,255,.45),inset 0 1px 0 rgba(255,255,255,.85),inset 3px 4px 8px rgba(255,255,255,.5),inset -4px -6px 12px rgba(150,138,228,.16)!important}
.lg-hand{font-family:'Dancing Script','Bradley Hand','Snell Roundhand','Segoe Script',cursive}
.lg-hand-zh{font-family:'Dancing Script','Kaiti SC','STKaiti','KaiTi',cursive}
.lg-word{font-family:Arial,'Helvetica Neue',sans-serif;font-weight:800;letter-spacing:.14em}.lg-key:active{transform:translateY(2px)!important;filter:brightness(.98)}
.lg-reference{--f-body:Arial,'PingFang SC',sans-serif;--f-display:Arial,'PingFang SC',sans-serif;font-family:Arial,'PingFang SC',sans-serif}
.lg-reference .lg-wallet-head [data-wk=head]>div:first-child{width:30px}
.lg-reference .lg-wallet-head [data-wk=head]>div:nth-child(2){text-align:left!important}
.lg-reference .lg-wallet-head [data-wk=head]>div:nth-child(2)>div:first-child{font-family:'Avenir Next','Futura','Century Gothic','Helvetica Neue',Arial,sans-serif!important;font-size:25px!important;font-weight:500!important;letter-spacing:.16em;color:#23244a!important}
.lg-reference .lg-wallet-head [data-wk=head]>div:nth-child(2)>div:nth-child(2){font-size:9px!important;letter-spacing:.55em!important;margin-top:2px}
.lg-reference .lg-wallet-head [data-wk=head]>div:last-child{width:66px!important}
.lg-reference .lg-wallet-main{padding:8px 22px 24px}
.lg-reference .lg-balance{padding:6px 18px 4px!important;margin-bottom:14px!important;background:transparent!important;border:0!important;box-shadow:none!important}
.lg-reference .lg-balance-summary{display:none!important}
.lg-reference .lg-motto{background:transparent!important;border-radius:0!important;border-bottom:0!important;margin-top:5px!important;padding:4px 6px!important;color:#444264!important}
.lg-reference .lg-bigkeys{gap:11px!important;margin-bottom:20px!important}
.lg-reference [data-ledger-bigkey]{aspect-ratio:1/1.08!important;max-height:113px!important;border-radius:19px!important}
.lg-reference [data-ledger-wallet-budget]{margin-bottom:16px!important}
.lg-reference [data-ledger-tabbar]{position:relative;isolation:isolate;background:transparent!important;border:0!important;box-shadow:0 4px 12px rgba(110,112,160,.12)!important;padding:4px 8px!important;gap:6px}
.lg-reference [data-ledger-tabbar] button{position:relative;isolation:isolate;min-width:0;min-height:50px!important;border-radius:12px;background:rgba(235,232,250,.16);transition:transform .15s,background .15s}
.lg-reference [data-ledger-tabbar] button[aria-current=page]{transform:translateY(-2px);background:rgba(228,214,249,.5)}
.lg-reference [data-ledger-tabbar] button::before{opacity:.4}
.lg-reference [data-ledger-tabbar] button[aria-current=page]::before{opacity:1}
.lg-reference [data-ledger-tabbar] button>span:first-child{background:transparent!important;box-shadow:none!important}
.lg-reference [data-ledger-tabbar] button>span:first-child::before{content:none}
.lg-reference [data-ledger-tabbar] svg{fill:rgba(197,185,236,.35);stroke:#8980ae;filter:drop-shadow(0 1px 0 rgba(255,255,255,.9))}
.lg-reference [data-ledger-tabbar] button[aria-current=page] svg{fill:#b4a2ec;stroke:#494579}
.lg-reference .lg-segment{gap:0!important;height:42px;border-radius:21px}
.lg-reference .lg-segment button{min-height:36px!important;border-radius:16px!important;font-size:13px!important}
.lg-reference .lg-segment button[aria-pressed=true]{background:transparent!important;box-shadow:none!important;border:0!important}
.lg-reference .lg-add-grid{gap:11px!important;align-content:start}
.lg-reference .lg-add-category{min-width:0;height:78px;border-radius:16px;justify-content:center;gap:2px!important;padding:5px 0!important;background:transparent;border:0;box-shadow:none}
.lg-reference .lg-add-category[aria-pressed=true]::before{content:none}
.lg-reference .lg-add-category{position:relative;overflow:hidden}
.lg-reference .lg-add-category[aria-pressed=true]{background:transparent;box-shadow:none}
.lg-reference .lg-add-category[aria-pressed=true] .lg-cattile{box-shadow:0 0 0 2px rgba(240,166,200,.6),0 0 0 5px rgba(248,206,226,.35),inset 0 1px 0 #fff,0 2px 0 rgba(214,150,186,.35)!important;background:linear-gradient(165deg,rgba(255,255,255,.75),rgba(252,222,236,.4))!important}
.lg-reference .lg-add-category .lg-cattile{width:48px!important;height:48px!important;border-radius:50%!important;background:linear-gradient(165deg,rgba(255,255,255,.6),rgba(236,239,248,.18))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -2px 3px rgba(118,122,178,.14),0 2px 0 rgba(150,154,200,.3),0 3px 6px rgba(118,122,178,.1)!important;border:0!important}
.lg-reference .lg-add-custom{height:30px;grid-column:1/-1;flex-direction:row!important;justify-content:center;gap:6px!important;background:none;border:0;box-shadow:none}
.lg-reference .lg-add-custom>div{width:24px!important;height:24px!important;font-size:16px!important;background:transparent!important;border:0!important;box-shadow:none!important}
.lg-reference .lg-console{padding:8px 20px calc(env(safe-area-inset-bottom) * 0.4 + 12px)!important;background:transparent!important;border:0!important;box-shadow:none!important}
.lg-reference .lg-console [data-ledger-amount]{min-height:48px;padding:2px 9px 2px 14px!important;margin-bottom:8px!important}
.lg-reference .lg-console input{min-height:37px!important}
.lg-reference .lg-number-key{min-height:40px!important;border-radius:10px!important;font-size:20px!important;font-weight:500!important}
.lg-reference [data-ledger-done]{background:radial-gradient(70% 45% at 40% 18%,rgba(255,255,255,.55),rgba(255,255,255,0) 70%),linear-gradient(160deg,rgba(252,214,232,.5),rgba(236,160,198,.45))!important;color:#713c5b!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.8),inset 3px 4px 8px rgba(255,255,255,.55),inset -4px -6px 12px rgba(214,120,168,.28),0 8px 20px rgba(220,140,185,.26)!important;border:0!important;opacity:1!important;backdrop-filter:blur(8px) saturate(1.4);-webkit-backdrop-filter:blur(8px) saturate(1.4)}
.lg-reference .lg-bills-date{display:none!important}
.lg-reference .lg-bills .lg-segment{margin:0 10px}
.lg-reference .lg-bills [data-ledger-strip]{min-height:64px;padding:10px 2px!important;border-radius:0!important}
.lg-reference .lg-bills [data-ledger-strip] .lg-cattile{width:36px!important;height:36px!important}
.lg-reference .lg-bills [data-ledger-day]>div:last-child{margin-bottom:0!important}
.lg-reference .lg-bills-list{gap:6px!important}
.lg-reference .lg-stats>div:nth-child(2){background:transparent!important;border:0!important;box-shadow:none!important;padding:5px 0 14px!important}
.lg-reference .lg-stats>div:nth-child(2)>div:first-child{display:none}
.lg-reference .lg-receipt{margin:18px 12px 30px!important;filter:drop-shadow(0 5px 8px #7c799929)!important}
.lg-reference .lg-receipt:before{content:'';position:absolute;width:73px;height:23px;left:-20px;top:0;transform:rotate(-32deg);background:linear-gradient(110deg,#c4d2e54f,#adc7e56b,#dce8f55c);border:1px solid #d2e0eb33;z-index:1}
.lg-reference .lg-receipt>div:first-child{padding:25px 20px 20px!important;background-image:repeating-linear-gradient(0deg,#bbb7d309 0 1px,transparent 1px 4px)!important}
.lg-reference .lg-receipt svg{height:34px!important;margin-top:22px!important}

@media(max-height:720px){.lg-reference .lg-add-category{height:73px}.lg-reference .lg-add-grid{gap:8px!important}.lg-reference .lg-console{padding-top:4px!important}}
.lg-reference .lg-bigkeys img{clip-path:inset(0 0 0 0 round 19%)}
.lg-reference [data-ledger-rail]>img{clip-path:inset(3% 0 5% round 999px)}
.lg-reference [data-ledger-monthnav],.lg-reference .lg-rail{background:none!important;isolation:isolate;position:relative}
.lg-reference [data-ledger-monthnav]::before,.lg-reference .lg-rail::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:url(assets/ledger/rail.webp?v=259) center/100% 100% no-repeat;clip-path:inset(2% 0 5% round 999px)}
.lg-reference .lg-add-category .lg-cattile,.lg-reference .lg-number-key,.lg-reference .lg-share-key{position:relative;isolation:isolate;background:rgba(243,240,255,.18)!important;border:0!important;box-shadow:none!important;border-radius:13px!important}
.lg-reference .lg-add-category .lg-cattile::before,.lg-reference .lg-number-key::before,.lg-reference .lg-share-key::before,.lg-reference [data-ledger-done]::before,.lg-reference [data-ledger-tabbar]::before,.lg-reference [data-ledger-tabbar] button::before{content:'';position:absolute;inset:0;height:auto;background:none;z-index:-1;pointer-events:none;border:9px solid transparent;border-image:url(assets/ledger/panel.webp?v=259) 120 fill / 9px / 0 stretch}
.lg-reference .lg-add-category .lg-cattile::before,.lg-reference .lg-number-key::before,.lg-reference [data-ledger-done]::before{opacity:.8}
.lg-reference [data-ledger-tabbar]::before{border-image-width:12px;opacity:.8}
.lg-reference [data-ledger-tabbar] button::before{border-image-width:7px}
.lg-reference .lg-add-category[aria-pressed=true] .lg-cattile{background:rgba(249,188,217,.4)!important;box-shadow:0 0 0 1px #e6a9c8!important}
.lg-reference [data-ledger-acctface]{isolation:isolate}
.lg-reference [data-ledger-acctface]::before{content:'';position:absolute;inset:-8px;z-index:-1;pointer-events:none;background:url(assets/ledger/card.webp?v=290) 44% 40%/500% 400%;filter:blur(5px) hue-rotate(var(--lg-acct-hue,0deg));opacity:.95}
.lg-reference .lg-balance>div:nth-child(2){position:relative;z-index:1;flex-wrap:wrap;gap:4px!important}
.lg-reference .lg-balance>div:nth-child(2)>button{flex-shrink:0}
.lg-reference .lg-balance>img{pointer-events:none}
@media(max-height:650px){
 .lg-reference .lg-wallet-main>[data-ledger-tray],.lg-reference .lg-cardpack-wrap{padding-top:12px!important}
 .lg-reference .lg-balance{min-height:96px!important;margin-top:0!important;margin-bottom:4px!important}
 .lg-reference .lg-bigkeys{margin-bottom:8px!important}
 .lg-reference .lg-bigkeys [data-ledger-bigkey]{aspect-ratio:auto!important}
 .lg-reference .lg-wallet-main>.lg-edge{display:none}
 .lg-reference .lg-add-category{height:62px}
 .lg-reference .lg-add-category .lg-cattile{width:38px!important;height:38px!important}
 .lg-reference .lg-add-grid{gap:4px!important}
 .lg-reference .lg-console{padding:4px 16px calc(env(safe-area-inset-bottom) * .4 + 4px)!important}
 .lg-reference .lg-console [data-ledger-amount]{min-height:40px;margin-bottom:4px!important}
 .lg-reference .lg-console input{min-height:32px!important;margin-bottom:4px!important}
 .lg-reference .lg-entry-options{flex-wrap:nowrap!important;overflow-x:auto;min-height:34px}
 .lg-reference .lg-entry-options>*{flex-shrink:0}
}
`;
  // 金额一律两位小数、负号在符号前面：-¥3,174.80，不是 ¥-3,174.8
  function fmtMoney(n, cur) {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    return (v < 0 ? "-" : "") + (cur ? cur.symbol : "") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // 正文里的金额：清楚第一，粗、等宽数字
  const numStyle = (sk, size, color) => ({ fontFamily: sk.num, fontSize: size, color: color || sk.ink, fontWeight: sk.id === "glass" ? 600 : 400, fontVariantNumeric: "tabular-nums", letterSpacing: sk.id === "glass" ? "-.01em" : 0 });
  // 屏幕上的数字：电子等宽字、屏幕墨色
  const lcdNum = (sk, size, color) => ({ fontFamily: sk.digit, fontSize: size, color: color || sk.lcd, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: sk.id === "glass" ? ".02em" : 0 });
  // 印在外壳上的小字（丝印）：像机器上印的「BUDGET」那种，但写中文
  const silk = (sk, text, extra) => h("div", { style: Object.assign({ fontFamily: F_BODY, fontSize: 12.5, fontWeight: 600, letterSpacing: sk.id === "glass" ? ".12em" : 0, color: sk.ink }, extra || {}) }, text);
  // 分类自己挑的图标（新建分类时从画好的那一套里选），账单行、排行、记一笔都从这里拿
  function catIconOf(settings, type, name) {
    const c = ((settings && settings.cats && settings.cats[type]) || []).find(x => x.name === name);
    return c && c.icon ? c.icon : "";
  }
  function catTint(settings, type, name) {
    const list = (settings && settings.cats && settings.cats[type]) || [];
    const i = list.findIndex(c => c.name === name);
    return CAT_TINTS[(i < 0 ? Math.abs(forumlessHash(name)) : i) % CAT_TINTS.length];
  }
  function forumlessHash(s) { let x = 0; s = String(s || ""); for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return x; }
  // 分类图标共用这套小玻璃图形；用户自定义的 emoji 仍原样显示。
  const CATEGORY_ART = {
    cup: ["#eac0ce", "#95637d", "M10 15h22l-3 20q-8 5-16 0z M9 14q12-5 24 0v3H9z M21 12l2-7 6-2", "M15 21l2 10 M18 12h5"],
    shop: ["#e9bfdc", "#98688e", "M10 15h23l3 23H7z M16 17v-7q5-8 11 0v7", "M13 22h1 M29 22h1 M11 29l1 5"],
    bus: ["#b1d4ef", "#5c86ae", "M11 6q11-3 22 0v29H11z M15 35v4h3v-4 M26 35v4h3v-4 M8 15v9 M36 15v9", "M15 10h14v12H15z M16 28h2 M26 28h2 M18 6h8"],
    basket: ["#c8bef3", "#8a7abc", "M7 18h30l-4 19H11z M14 18l5-11 M30 18L25 7", "M15 24l1 7 M22 24v7 M29 24l-1 7"],
    game: ["#c5b9f2", "#8470b8", "M12 14q10-6 20 0l6 14q1 8-5 7l-7-6h-8l-7 6q-6 1-5-7z", "M12 20h8 M16 16v8 M28 19h1 M32 23h1"],
    book: ["#c6b9ef", "#8873b4", "M7 11l13-4 4 3 12 1v24l-12-1-4 3-13-4z M20 7v30 M24 10v24", "M28 16l4 1 M28 21l4 1"],
    health: ["#9fd4db", "#5e97a8", "M18 7h9v10h10v10H27v10h-9V27H8V17h10z", "M21 10v10H11"],
    cat: ["#f5e2e9", "#a67e94", "M9 19L9 6l10 8h7l9-8 1 15q7 19-13 20Q3 41 8 22z", "M15 24h1 M29 24h1 M21 28h3l-2 2 M17 32q5 4 10 0 M10 29h4 M30 29h4"],
    heart: ["#f0c8df", "#b887a4", "M21 17C9 1-2 20 18 34l4-4 M24 17C34 5 44 19 26 35 7 23 15 7 24 17z", "M17 18q-1-5 3-5"],
    home: ["#b4dce3", "#759caa", "M5 21L22 6l17 15-5 2v15H10V23z M18 38V27h9v11", "M17 18h10v6H17z M11 20L22 10"],
    plane: ["#c5c2f3", "#827bb8", "M5 15l12 2L29 5q6-3 6 3L25 22l3 13-4 3-7-11-7 5-5-3 9-8z", "M18 19l12-11"],
    money: ["#ebcaaa", "#997765", "M15 5h16l-5 9q14 13 10 22-4 7-15 5Q4 41 8 30q2-9 11-16z M16 15h13", "M26 22q-10-4-10 2t10 7q0 5-10 2 M21 19v18"],
    ticket: ["#e6b9e7", "#ab7ea9", "M6 13l29-8 4 12q-6 3 1 7l2 9-30 8-3-10q6-4-1-7z", "M26 10l7 25 M16 18l8 3-5 8z"],
    // 她 2026-09-29「重复的图标重画」：日用、娱乐、兼职、红包原来跟别的分类撞图，各给一张自己的
    bottle: ["#c9e3f5", "#6f94b8", "M17 5h10v6H17z M15 11h14q3 2 3 6v18q0 4-4 4H16q-4 0-4-4V17q0-4 3-6z", "M16 22h12 M16 30h12"],
    tv: ["#d9c6f4", "#8a70bc", "M6 13h32v22H6z M16 6l6 7 6-7", "M10 17h24v14H10z M20 21l6 3-6 3z"],
    case: ["#e4cfb8", "#95765c", "M5 14h34v22H5z M16 14V9q0-2 2-2h8q2 0 2 2v5", "M5 23h34 M20 21h4v5h-4z"],
    envelope: ["#f4bccb", "#b5657a", "M9 6h26v32H9z", "M9 13q13 9 26 0 M22 17a3 3 0 1 0 .1 0"],
    dots: ["#d3c7ed", "#9a86ba", "M8 21a2 2 0 1 0 .1 0 M20 21a2 2 0 1 0 .1 0 M32 21a2 2 0 1 0 .1 0", ""]
  };
  function CategoryGlyph({ emoji, name, size, icon }) {
    const lookup = { "餐饮":"cup", "买菜":"basket", "交通":"bus", "购物":"shop", "日用":"bottle", "居住":"home", "住房":"home", "娱乐":"tv", "游戏充值":"game", "医疗":"health", "人情":"heart", "社交":"heart", "学习":"book", "宠物":"cat", "旅行":"plane", "工资":"money", "兼职":"case", "红包":"envelope", "报销":"ticket", "其他":"dots" };
    const emojis = { "🍚":"cup", "☕":"cup", "🧋":"cup", "🍵":"cup", "🛒":"basket", "🚌":"bus", "🚇":"bus", "🛍️":"shop", "🧴":"bottle", "🏠":"home", "🎬":"tv", "🎮":"game", "💊":"health", "🎁":"heart", "📚":"book", "🐱":"cat", "✈️":"plane", "💰":"money", "💼":"case", "🧧":"envelope", "🧾":"ticket", "✨":"dots" };
    const k = (icon && CATEGORY_ART[icon] ? icon : null) || lookup[name] || emojis[emoji], art = CATEGORY_ART[k];
    // 画好的图里没有这一类（她自己加的分类又没挑图标）：画一颗软糖泡泡，里面写分类名的第一个字——不再退回 emoji
    if (!art) {
      const ch = String(name || "").trim().slice(0, 1) || "·", bid = "lg-cat-letter";
      return h("svg", { width: size, height: size, viewBox: "0 0 44 44", "aria-hidden": true, style: { overflow: "visible", filter: "drop-shadow(0 1.5px 1px #8a7abc44)" }, "data-wk": "ldgcategoryglyph" },
        h("defs", null, h("linearGradient", { id: bid, x1: "0%", y1: "0%", x2: "85%", y2: "100%" }, h("stop", { offset: "0%", stopColor: "#fff", stopOpacity: .94 }), h("stop", { offset: "45%", stopColor: "#d9cef5" }), h("stop", { offset: "100%", stopColor: "#b9a8ea" }))),
        h("circle", { cx: 22, cy: 22, r: 16, fill: "url(#" + bid + ")", stroke: "#8a7abc", strokeWidth: 1.6 }),
        h("path", { d: "M12 17q3-6 9-7", fill: "none", stroke: "#fff", strokeOpacity: .85, strokeWidth: 2, strokeLinecap: "round" }),
        h("text", { x: 22, y: 27.5, textAnchor: "middle", fontSize: 15, fontWeight: 700, fill: "#5d4d94", fontFamily: F_BODY }, ch));
    }
    const [fill, stroke, outline, detail] = art, id = "lg-cat-" + k;
    return h("svg", { width: size, height: size, viewBox: "0 0 44 44", "aria-hidden": true, style: { overflow: "visible", filter: "drop-shadow(0 1.5px 1px " + stroke + "44)" }, strokeLinecap: "round", strokeLinejoin: "round", "data-wk": "ldgcategoryglyph", "data-part": "r2" },
      h("defs", null, h("linearGradient", { id, x1: "0%", y1: "0%", x2: "85%", y2: "100%" }, h("stop", { offset: "0%", stopColor: "#fff", stopOpacity: .94 }), h("stop", { offset: "38%", stopColor: fill, stopOpacity: .8 }), h("stop", { offset: "100%", stopColor: fill }))),
      h("path", { d: outline, fill: "url(#" + id + ")", stroke, strokeWidth: 1.8 }),
      h("path", { d: outline, fill: "none", stroke: "#fff", strokeOpacity: .7, strokeWidth: .7, transform: "translate(.8 .8)" }),
      h("path", { d: detail, fill: "none", stroke, strokeWidth: 1.5 }));
  }
  function CatTile({ tint, emoji, name, icon, size, on, sk }) {
    const s = size || 40, glass = sk.id === "glass";
    // 图标住在一颗透明树脂小壳里：几乎无色，分类颜色只在图标本身和一丝边缘折射
    return h("div", { className: "lg-cattile", style: Object.assign({ width: s, height: s, borderRadius: Math.round(s * .3), flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(s * .5), position: "relative" },
      glass ? Object.assign({}, RESIN, { boxShadow: RESIN.boxShadow + ", inset 1px 0 0 " + tint + "40" }) : { background: tint + "33", border: "1px solid " + (on ? sk.pink : sk.line) }), "data-wk": "ldgcattile", "data-on": on ? "1" : "0" },
      h(CategoryGlyph, { emoji, name, icon, size: s * (glass ? .78 : .7) }));
  }

  // 一排格子（能量槽 / 电量格 / 状态条）：n 格里点亮 lit 格。点亮的格子带一点发光，没亮的是屏幕上淡淡的底格
  // 果冻符号（照第一张样张的视觉语法，不是现代高清 3D icon）：
  //   小、细、樱花粉半透明；左上一点糊糊的白光，底下一层很浅的糊影——旧网页贴图那种有点泛白、有点软的质感。
  const JELLY_GLYPH = {
    plus: "M20.5 7h7a2.5 2.5 0 0 1 2.5 2.5V18h8.5A2.5 2.5 0 0 1 41 20.5v7a2.5 2.5 0 0 1-2.5 2.5H30v8.5a2.5 2.5 0 0 1-2.5 2.5h-7a2.5 2.5 0 0 1-2.5-2.5V30H9.5A2.5 2.5 0 0 1 7 27.5v-7A2.5 2.5 0 0 1 9.5 18H18V9.5A2.5 2.5 0 0 1 20.5 7z",
    bag: "M18 7h12l-3 6.5C34 16.5 39 22.5 39 30.5c0 6.5-6 10.5-15 10.5S9 37 9 30.5c0-8 5-14 12-17z",
    chart: "M8 29a2.5 2.5 0 0 1 2.5-2.5h4A2.5 2.5 0 0 1 17 29v12H8zM19.5 20a2.5 2.5 0 0 1 2.5-2.5h4a2.5 2.5 0 0 1 2.5 2.5v21h-9zM31 11a2.5 2.5 0 0 1 2.5-2.5h4A2.5 2.5 0 0 1 40 11v30h-9z"
  };
  const JELLY_SHINE = { plus: [[23.5, 10.5, 2.2, 1.3], [11.5, 21.5, 2, 1.2]], bag: [[17, 23, 1.6, 3.6]], chart: [[12, 29.5, 1.6, .9], [23.5, 20.5, 1.6, .9], [35, 11.5, 1.6, .9]] };
  function JellyGlyph({ k, tone, size }) {
    // [最亮, 中间, 边, 侧面]
    const T = { pink: ["#ffe3ee", "#f693b9", "#e0709c", "#c85584"], blue: ["#e6efff", "#8eaef0", "#6a8ddf", "#5273c4"], lilac: ["#efe6ff", "#b39af0", "#9076de", "#775cc4"] }[tone] || ["#fff", "#ddd", "#bbb", "#999"];
    const id = "lgj-" + k + "-" + tone, S = size || 40, d = JELLY_GLYPH[k];
    return h("svg", { width: S, height: S, viewBox: "0 0 48 48", "aria-hidden": "true", style: { position: "relative", overflow: "visible", filter: "drop-shadow(0 2px 2px " + T[3] + "59)" }, "data-wk": "ldgjellyglyph" },
      h("defs", null,
        h("radialGradient", { id: id + "f", cx: .36, cy: .28, r: .85 }, h("stop", { offset: 0, stopColor: T[0] }), h("stop", { offset: .5, stopColor: T[1] }), h("stop", { offset: 1, stopColor: T[2] })),
        h("filter", { id: id + "g", x: "-30%", y: "-30%", width: "160%", height: "160%" }, h("feGaussianBlur", { stdDeviation: .8 }))),
      h("path", { d, fill: T[3], fillOpacity: .8, transform: "translate(.8 1.8)" }),
      h("path", { d, fill: "url(#" + id + "f)", stroke: T[3], strokeWidth: .65 }),
      h("path", { d, fill: "none", stroke: "rgba(255,255,255,.8)", strokeWidth: 1.3, strokeLinejoin: "round", filter: "url(#" + id + "g)" }),
      k === "bag" ? h("text", { x: 24, y: 35, textAnchor: "middle", fontSize: 13, fontWeight: 800, fill: "#fff", fontFamily: "Arial,sans-serif" }, "$") : null,
      h("g", { filter: "url(#" + id + "g)" }, (JELLY_SHINE[k] || []).map((e, i) => h("ellipse", { key: i, cx: e[0], cy: e[1], rx: e[2], ry: e[3], fill: "#fff", fillOpacity: .95 }))));
  }
  // 进度条：细细一根，填的那段是紫到粉的糖果渐变、带一道高光
  function Bar({ pct, over, sk, color, height, rail }) {
    const H = height || 6, w = Math.max(2, Math.min(1, pct) * 100) + "%";
    if (rail && sk.id === "glass") {
      // 跟首页同一根试管（她给的素材），液体按进度画
      return h("div", { "data-ledger-rail": true, style: { position: "relative" }, "data-wk": "ldgbar" },
        h("img", { src: "assets/ledger/tube.webp?v=259", alt: "", draggable: false, style: { display: "block", width: "100%", height: "auto" } }),
        h("div", { "aria-hidden": "true", style: { position: "absolute", left: "4.2%", top: "33%", height: "34%", width: (Math.max(.06, Math.min(1, pct)) * 91.6) + "%", borderRadius: 999,
          background: over ? "linear-gradient(180deg,#f7c7d9,#e58db1)" : "linear-gradient(180deg,#d9d2fb,#a79cef 55%,#9387e3)", boxShadow: "inset 0 1.5px 0 rgba(255,255,255,.85), inset 0 -1px 2px rgba(80,70,170,.3)" } }));
    }
    if (false) {
      // 凹槽：细长、略微凹下去（内影在上）、透明的边；里面是一段带上沿亮光的紫色液体
      return h("div", { "data-ledger-rail": true, style: { height: 14, borderRadius: 14, padding: 3, background: "linear-gradient(180deg, rgba(214,218,234,.55), rgba(255,255,255,.45))",
          boxShadow: "inset 0 2px 3px rgba(96,100,150,.22), inset 0 -1px 0 rgba(255,255,255,.9), 0 1px 0 rgba(255,255,255,.8)" }, "data-wk": "ldgbar", "data-part": "r2" },
        h("div", { style: { height: "100%", width: w, borderRadius: 8, position: "relative", overflow: "hidden",
          background: over ? "linear-gradient(180deg, #f3b5cc, #df7fa6)" : "linear-gradient(180deg, #c9bff5, #9a8ae0 70%, #8a7ad4)",
          boxShadow: "inset 0 -1px 2px rgba(80,60,160,.25)" } },
          h("span", { style: { position: "absolute", left: 3, right: 3, top: 1, height: 3, borderRadius: 3, background: "rgba(255,255,255,.75)" } })));
    }
    return h("div", { style: { height: H, borderRadius: H, background: sk.lcdDim, overflow: "hidden" }, "data-wk": "ldgbar", "data-part": "r3" },
      h("div", { style: { height: "100%", width: w, borderRadius: H,
        background: over ? sk.over : (color || (sk.id === "glass" ? "linear-gradient(180deg, #b4a8f4, #8976df)" : sk.accent)),
        boxShadow: sk.id === "glass" ? "inset 0 1px 0 rgba(255,255,255,.6)" : "none" } }));
  }
  function Cells({ n, lit, colors, height, sk, gap }) {
    const H = height || 10;
    return h("div", { style: { display: "flex", gap: gap == null ? 2 : gap, height: H }, "data-wk": "ldgcells" },
      Array.from({ length: n }, (_, i) => { const on = i < lit, c = Array.isArray(colors) ? colors[Math.min(colors.length - 1, Math.floor(i / n * colors.length))] : colors;
        return h("div", { key: i, style: { flex: 1, borderRadius: sk.id === "glass" ? 3 : 3, background: on ? (sk.id === "glass" ? "linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,0) 55%), " + c : c) : sk.lcdDim, boxShadow: on && sk.id === "glass" ? "0 1px 4px " + c + "88" : "none" }, "data-wk": "ldgcells", "data-part": "r2", "data-on": on ? "1" : "0" }); }));
  }
  // 线条小图标（底栏、按钮）：统一一套，别用 Unicode 方块
  const LI = {
    wallet: c => [h("rect", { key: 1, x: 3, y: 6, width: 18, height: 13, rx: 3 }), h("path", { key: 2, d: "M16 12.5h2.5" }), h("path", { key: 3, d: "M5 6l9.5-3 1.5 3" })],
    chart: c => [h("path", { key: 1, d: "M4 20h16" }), h("rect", { key: 2, x: 5.5, y: 12, width: 3, height: 6, rx: 1 }), h("rect", { key: 3, x: 10.5, y: 8, width: 3, height: 10, rx: 1 }), h("rect", { key: 4, x: 15.5, y: 4.5, width: 3, height: 13.5, rx: 1 })],
    cal: c => [h("rect", { key: 1, x: 3.5, y: 5, width: 17, height: 15, rx: 3 }), h("path", { key: 2, d: "M3.5 10h17M8 3v4M16 3v4" })],
    me: c => [h("circle", { key: 1, cx: 12, cy: 8.5, r: 4 }), h("path", { key: 2, d: "M4.5 20c1.2-4 4-5.5 7.5-5.5s6.3 1.5 7.5 5.5" })],
    bag: c => [h("path", { key: 1, d: "M6 8h12l-1 12H7L6 8z" }), h("path", { key: 2, d: "M9 8V6.5a3 3 0 0 1 6 0V8" }), h("path", { key: 3, d: "M12 11v5M10 13.5h4" })],
    plus: c => [h("path", { key: 1, d: "M12 5v14M5 12h14" })],
    eye: c => [h("path", { key: 1, d: "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" }), h("circle", { key: 2, cx: 12, cy: 12, r: 2.6 })],
    eyeOff: c => [h("path", { key: 1, d: "M3 3l18 18" }), h("path", { key: 2, d: "M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.8 3.4M6.3 7.8C3.9 9.5 2.5 12 2.5 12s3.5 6 9.5 6c1.4 0 2.6-.3 3.7-.8" })],
    search: c => [h("circle", { key: 1, cx: 11, cy: 11, r: 6.5 }), h("path", { key: 2, d: "M16 16l4.5 4.5" })]
  };
  const LIcon = ({ k, size, color, sw }) => h("svg", { width: size || 22, height: size || 22, viewBox: "0 0 24 24", fill: "none", stroke: color || "currentColor", strokeWidth: sw || 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, LI[k] ? LI[k]() : null);
  // 玻璃框（她给的 panel.webp）画在 ::before 上单独压透明度；统计页、日历页共用
  const PNL_CSS = ".lg-pnl::before{content:'';position:absolute;inset:-24px;z-index:-1;pointer-events:none;border:24px solid transparent;border-image:url(assets/ledger/panel.webp?v=259) 120 fill / 24px / 0 stretch;opacity:.6}" +
    ".lg-pnl.lg-pnl-hero::before{opacity:.46;filter:saturate(.75);-webkit-mask-image:linear-gradient(180deg,#000 45%,rgba(0,0,0,.45));mask-image:linear-gradient(180deg,#000 45%,rgba(0,0,0,.45))}";
  // 月份切换：两颗小果冻键夹着一小块屏幕
  //   玻璃皮（她 2026-09-29「日历框也做成第三页这样而不是裸的一行」）：整条垫一块她给的透明滑轨，像一枚小胶囊屏
  const MonthNav = ({ mk, setMk, sk }) => h("div", { "data-ledger-monthnav": true, style: Object.assign({ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, margin: "0 0 10px" },
      sk.id === "glass" ? { width: "fit-content", marginLeft: "auto", marginRight: "auto", padding: "4px 10px", minHeight: 48, background: "url(assets/ledger/rail.webp?v=259) center / 100% 100% no-repeat" } : {}) },
    h("button", { onClick: () => setMk(m => shiftMonth(m, -1)), "aria-label": "上个月", className: "active:opacity-50", style: flatKey({ width: 40, height: 40, fontSize: 18, color: sk.sub }), "data-wk": "ldgmonthnavbtn", "data-part": "上个月" }, "‹"),
    h("span", { style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 500, color: sk.ink, minWidth: 96, textAlign: "center" } }, fmtMonth(mk)),
    h("button", { onClick: () => setMk(m => shiftMonth(m, 1)), "aria-label": "下个月", className: "active:opacity-50", style: flatKey({ width: 40, height: 40, fontSize: 18, color: sk.sub }), "data-wk": "ldgmonthnavbtn", "data-part": "下个月" }, "›"));
  // 切换：一条很淡的底槽，选中那一格是一颗粉色糖果小胶囊（有高光、略鼓），其余就是字
  // 切换（她：做成一条透明滑轨）：一根细长的透明亚克力轨道（略凹、透明边），
  //   选中项下面滑着一小块半透明粉色树脂；字就印在轨道上
  const CandySeg = ({ items, value, onChange, sk }) => {
    const n = items.length, idx = Math.max(0, items.findIndex(x => x[0] === value)), glass = sk.id === "glass";
    return h("div", { className: "lg-segment lg-rail", style: Object.assign({ display: "flex", position: "relative", padding: 3 },
        glass ? { borderRadius: 24, minHeight: 48, padding: 5, background: "url(assets/ledger/rail.webp?v=259) center / 100% 100% no-repeat" } : sk.well), "data-wk": "ldgcandyseg" },
      glass ? h("span", { "aria-hidden": "true", "data-ledger-slider": true, style: { position: "absolute", top: 5, bottom: 5, left: "calc(5px + " + (idx * 100 / n) + "% - " + (idx * 10 / n) + "px)", width: "calc(" + (100 / n) + "% - " + (10 / n) + "px)", borderRadius: 16,
          background: "url(assets/ledger/slider.webp?v=259) center / 100% 100% no-repeat", transform: "scale(1.12, 1.25)",
          transition: "left .22s cubic-bezier(.3,.7,.3,1)" } }) : null,
      items.map(([k, zh]) => { const on = value === k;
        return h("button", { key: k, onClick: () => onChange(k), "aria-pressed": on, className: "flex-1 active:opacity-80",
          style: { position: "relative", zIndex: 1, minHeight: 36, borderRadius: 16, fontFamily: F_BODY, fontSize: 13, letterSpacing: glass ? ".06em" : 0, fontWeight: on ? 700 : 500, color: on ? sk.ink : sk.sub,
            background: glass ? "transparent" : (on ? "#fff" : "transparent"), border: "none", boxShadow: glass ? "none" : (on ? "0 1px 3px rgba(0,0,0,.08)" : "none") }, "data-wk": "ldgcandyseg", "data-part": "r2", "data-on": on ? "1" : "0" }, zh); }));
  };
  // 整页壳：外壳铺底，顶栏透明（mobile-ui-layout §3.5）
  const ledgerPage = (sk, title, onBack, right, body, footer, extra) => h("div", { className: "h-full flex flex-col", style: Object.assign({}, sk.page, extra || {}) },
    h(Head, { zh: title, onBack: onBack, ink: sk.ink, bg: "transparent", noLine: true, right: right || null }),
    h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { overscrollBehavior: "contain" } }, body),
    footer || null);

  // ============================================================
  // 主组件：底下四格（钱包 / 统计 / 日历 / 我的），记一笔、账单、单笔、设置叠在上面
  // ⚠️叠在上面而不是换掉底下那页：退回来时底下那页的滚动位置原样还在（mobile-ui-layout §3）
  // ============================================================
  function Ledger(props) {
    const t = useTheme();
    window.__ledgerTheme = t;
    const [data, setData] = useState(loadData);
    const [tab, setTab] = useState("wallet");      // wallet | stats | cal | me
    const [stack, setStack] = useState([]);        // 叠在上面的页：{k:"bills"} | {k:"txn",id}
    const [addState, setAddState] = useState(null); // null | {edit?:txn, type?}
    const [showSet, setShowSet] = useState(null);
    const [confirmAsk, setConfirmAsk] = useState(null);  // null | "visible" | "acct" | "cur" | "cat"
    const uName = (props.profile && props.profile.name) || "我";
    const routedLore = (ids, text) => props.worldbookFor ? props.worldbookFor(ids, text) : props.worldbook;
    const sk = ledgerSkin(data.settings);

    const persist = d => { setData(d); saveData(d); };
    const addTxn = txn => { const d = loadData(); d.txns = [txn].concat(d.txns); persist(d); return txn; };
    const updTxn = (id, patch) => { const d = loadData(); d.txns = d.txns.map(x => x.id === id ? { ...x, ...patch } : x); persist(d); };
    const delTxn = id => { const d = loadData(); d.txns = d.txns.filter(x => x.id !== id); persist(d); };
    const setSetting = patch => { const d = loadData(); d.settings = { ...d.settings, ...patch }; persist(d); };

    const curs = data.settings.currencies || DEFAULT_CURS;
    const curOf = code => curs.find(c => c.code === code) || { code: code, symbol: "", label: code };
    // 看哪个币：记在 settings.viewCur；没记过就挑有账的第一个
    const code = (curs.find(c => c.code === data.settings.viewCur) || curs.find(c => data.txns.some(x => x.currency === c.code)) || curs[0] || DEFAULT_CURS[0]).code;
    const cur = curOf(code);
    const push = v => setStack(s => s.concat([v]));
    const pop = () => setStack(s => s.slice(0, -1));
    const onSetBudget = v => persist({ ...data, settings: { ...data.settings, budgets: { ...(data.settings.budgets || {}), [code]: v } } });
    const editBudget = () => requestAppPrompt("每月预算", "每个月打算在" + cur.label + "上花多少？填 0 就是不设。", (data.settings.budgets || {})[code] || "", v => {
      const n = Math.max(0, Math.round((parseFloat(String(v).replace(/[^\d.]/g, "")) || 0) * 100) / 100);
      onSetBudget(n);
    }, "好", { placeholder: "比如 2000" });

    // 事件驱动一次性反应：记完账本地判定事件（大额/高频/深夜/大进账），命中且有可见角色时，
    // 让好感最高的一位「自己注意到」这笔账、主动留一句批注。没事件=零 API；反应只留在账本里，不进聊天 prompt。
    const autoReact = async txn => {
      try {
        if (!props.active) return;
        const d = loadData();
        // 设置 → 自动生成 →「顺手点评」关着的人不搭话
        const vis = (d.settings.visibleTo || []).filter(id => (props.characters || []).some(c => c.id === id) && (typeof window !== "undefined" && window.__autoRefreshOn ? window.__autoRefreshOn("react", id) : true));
        if (!vis.length) return;
        const cur = curOf(txn.currency);
        const ev = detectTxnEvent(d.txns, txn, cur);
        if (!ev) return;
        const aff = props.affinities || {};
        const cid = vis.slice().sort((x, y) => (aff[y] != null ? aff[y] : 50) - (aff[x] != null ? aff[x] : 50))[0];
        const c = (props.characters || []).find(x => x.id === cid);
        if (!c) return;
        const mo = props.moods && props.moods[c.id];
        const list = [{ id: c.id, name: c.name, gender: c.gender, persona: c.persona || "", mood: mo && mo.label ? String(mo.label) : "", aff: aff[c.id] }];
        const outs = await genComments(props.active, txn, cur, list, uName, routedLore([c.id], txn.note || txn.category || "记账"), { event: ev });
        const cmts = (outs || []).filter(o => o && o.text).map(o => ({ charId: c.id, charName: c.name, text: o.text, ts: Date.now(), auto: true, event: ev.key }));
        if (!cmts.length) return;
        const now = loadData().txns.find(x => x.id === txn.id);
        if (!now) return; // 用户已把这笔删了就算了
        updTxn(txn.id, { comments: (now.comments || []).concat(cmts) });
        props.toast && props.toast(c.name + " 注意到了这笔账");
      } catch (e) {/* 静默：主动反应失败不打扰记账本身 */}
    };

    // 月度盘点：新月份第一次打开记账，给上月账本生成一次角色盘点（一次 API 出所有可见角色的话；失败不落库、下次打开再试）
    const genMonthly = async (mk, vis) => {
      try {
        const d0 = loadData();
        const curs0 = d0.settings.currencies || DEFAULT_CURS;
        const prevMk = shiftMonth(mk, -1);
        const statLines = [];
        curs0.forEach(cur => {
          const s = summarize(d0.txns, cur.code, mk);
          if (!s.exp && !s.inc) return;
          const p = summarize(d0.txns, cur.code, prevMk);
          let l = "· " + cur.label + "（" + cur.code + "）：支出 " + fmtAmt(s.exp, cur) + "、收入 " + fmtAmt(s.inc, cur) + "、结余 " + fmtAmt(s.net, cur) + "（" + s.count + " 笔）";
          if (s.catList.length) l += "，花最多的是 " + s.catList.slice(0, 3).map(c => c.name + " " + fmtAmt(c.amount, cur)).join("、");
          if (p.exp > 0) l += "；比上个月支出" + (s.exp >= p.exp ? "多" : "少") + Math.abs(Math.round((s.exp - p.exp) / p.exp * 100)) + "%";
          statLines.push(l);
        });
        if (!statLines.length) return;
        const aff = props.affinities || {};
        const list = vis.map(id => { const c = props.characters.find(x => x.id === id); const mo = props.moods && props.moods[id]; return { id, name: c.name, gender: c.gender, persona: c.persona || "", mood: mo && mo.label ? String(mo.label) : "", aff: aff[id] }; });
        const block = list.map((it, i) => (i + 1) + "、「" + it.name + "」\n  应用称呼：" + characterText(it, "他") + "\n  人设：" + (it.persona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 300) + (it.mood ? "\n  此刻心情：" + it.mood : "") + (it.aff != null ? "\n  对 " + uName + " 的好感度：" + Math.round(it.aff) + "/100（据此把握语气亲疏）" : "")).join("\n\n");
        const sys = AC() + CB() + NAC() +
          uName + " 上个月（" + fmtMonth(mk) + "）的账本盘点如下。请【分别以每位角色本人的口吻】对这份月账单说一段话（1~3 句）。\n" +
          "【硬性要求】\n" +
          "· 这是【月度盘点】不是单笔吐槽：看整月的花钱习惯和趋势——心疼、表扬、揶揄手松、替 Ta 操心结余、注意到某类花得突然多，都按各自人设来，几个人腔调各不相同。\n" +
          "· 各角色以第一人称盘点。需要第三人称时，使用条目里的「应用称呼」或姓名。严禁『看了一眼没说什么』这类空话。\n\n" +
          "【上月账单】\n" + statLines.join("\n") + "\n\n【要盘点的角色】\n" + block +
          "\n\n【输出】只输出 JSON，comments 与角色顺序一一对应、数量一致：{\"comments\":[{\"name\":\"角色名\",\"text\":\"这位角色的月度盘点\"}]}。别加解释、别加代码块。";
        const raw = await callAI(props.active, sys, [{ role: "user", content: "开始盘点。" }], { maxTokens: 14000 });
        const pd = extractJSON(raw) || {};
        const arr = Array.isArray(pd.comments) ? pd.comments : [];
        const cmts = list.map((it, i) => { const byName = arr.find(r => r && String(r.name || "").trim() === it.name); const r = byName || arr[i]; const txt = r && (r.text || r.comment) ? String(r.text || r.comment).trim() : ""; return { charId: it.id, charName: it.name, text: txt, ts: Date.now() }; }).filter(x => x.text);
        if (!cmts.length) return;
        const d1 = loadData();
        d1.monthly = d1.monthly || {};
        d1.monthly[mk] = { genAt: Date.now(), comments: cmts };
        persist(d1);
      } catch (e) {/* 静默：下次打开再试 */}
    };
    // 周期账单：打开记账就把到日子的补记上；三天内要到的，一天提醒一次
    useEffect(() => {
      const d = loadData();
      if (!(d.settings.recurring || []).length) return;
      const n = runRecurring(d);
      const soon = (d.settings.recurring || []).map(r => ({ r, nx: recurNext(r) })).filter(x => x.nx.days >= 0 && x.nx.days <= 3);
      const today = todayStr();
      const remind = soon.length && d.settings.recurRemind !== today;
      if (remind) d.settings.recurRemind = today;
      if (n || remind) persist(d);
      if (props.toast) {
        if (n) props.toast("自动记上了 " + n + " 笔周期账单");
        else if (remind) props.toast(soon.map(x => (x.r.name || x.r.category) + (x.nx.days === 0 ? " 今天" : " " + x.nx.days + " 天后") + "到期").join("，"));
      }
    }, []);
    // 年度回顾：能看账本的角色一起说几句（一次 API 出所有人；失败不落库）
    const genYearly = async (year, ys) => {
      try {
        const d0 = loadData(), vis = (d0.settings.visibleTo || []).filter(id => (props.characters || []).some(c => c.id === id));
        if (!vis.length || !props.active) return;
        const aff = props.affinities || {};
        const list = vis.map(id => { const c = props.characters.find(x => x.id === id); const mo = props.moods && props.moods[id]; return { id, name: c.name, gender: c.gender, persona: c.persona || "", mood: mo && mo.label ? String(mo.label) : "", aff: aff[id] }; });
        const block = list.map((it, i) => (i + 1) + "、「" + it.name + "」\n  应用称呼：" + characterText(it, "他") + "\n  人设：" + (it.persona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 300) + (it.mood ? "\n  此刻心情：" + it.mood : "") + (it.aff != null ? "\n  对 " + uName + " 的好感度：" + Math.round(it.aff) + "/100（据此把握语气亲疏）" : "")).join("\n\n");
        const stat = [cur.label + "（" + cur.code + "）" + year + " 年：支出 " + fmtAmt(ys.exp, cur) + "、收入 " + fmtAmt(ys.inc, cur) + "、结余 " + fmtAmt(ys.net, cur) + "，共 " + ys.count + " 笔",
          ys.catList.length ? "花得最多的几类：" + ys.catList.slice(0, 5).map(c => c.name + " " + fmtAmt(c.amount, cur)).join("、") : "",
          ys.mostOften ? "记得最多的是「" + ys.mostOften + "」，" + ys.mostOftenN + " 笔" : "",
          ys.biggest ? "最贵的一笔：" + (ys.biggest.note || ys.biggest.category) + " " + fmtAmt(netAmt(ys.biggest), cur) : "",
          ys.priciest ? "最能花的月份：" + ys.priciest + "（" + fmtAmt(ys.priciestAmt, cur) + "）；最省的月份：" + ys.cheapest + "（" + fmtAmt(ys.cheapestAmt, cur) + "）" : ""].filter(Boolean).join("\n");
        const sys = AC() + CB() + NAC() +
          uName + " 一整年（" + year + " 年）的账本回顾如下。请【分别以每位角色本人的口吻】对这一年说一段话（2~4 句）。\n" +
          "【硬性要求】\n" +
          "· 这是【年度回顾】：看一整年的花钱习惯、变化和亮点，按各自人设和跟 " + uName + " 的关系来说，几个人腔调各不相同。\n" +
          "· 各角色以第一人称说。需要第三人称时，使用条目里的「应用称呼」或姓名。\n\n" +
          "【这一年】\n" + stat + "\n\n【要说话的角色】\n" + block +
          "\n\n【输出】只输出 JSON，comments 与角色顺序一一对应、数量一致：{\"comments\":[{\"name\":\"角色名\",\"text\":\"这位角色说的话\"}]}。别加解释、别加代码块。";
        const raw = await callAI(props.active, sys, [{ role: "user", content: "开始。" }], { maxTokens: 14000 });
        const pd = extractJSON(raw) || {}, arr = Array.isArray(pd.comments) ? pd.comments : [];
        const cmts = list.map((it, i) => { const r = arr.find(x => x && String(x.name || "").trim() === it.name) || arr[i]; const txt = r && (r.text || r.comment) ? String(r.text || r.comment).trim() : ""; return { charId: it.id, charName: it.name, text: txt, ts: Date.now() }; }).filter(x => x.text);
        if (!cmts.length) { props.toast && props.toast("TA 们这次没说出来，等会儿再试"); return; }
        const d1 = loadData(); d1.yearly = d1.yearly || {}; d1.yearly[cur.code + "-" + year] = { genAt: Date.now(), comments: cmts }; persist(d1);
      } catch (e) { props.toast && props.toast("没生成出来：" + (e && e.message || e)); }
    };
    const exportCSV = async () => {
      try {
        const d = loadData();
        if (!d.txns.length) { props.toast && props.toast("还没有账可以导出"); return; }
        const r = await window.saveTextFile("账本-" + todayStr().replace(/-/g, "") + ".csv", ledgerCSV(d), "text/csv");
        if (r !== "cancel" && props.toast) props.toast("导出好了：" + d.txns.length + " 笔");
      } catch (e) { props.toast && props.toast("导出没成功：" + (e && e.message || e)); }
    };
    useEffect(() => {
      const lastMk = shiftMonth(thisMonthKey(), -1);
      const d = loadData();
      if ((d.monthly || {})[lastMk]) return;                                   // 这个月已经盘过
      if (!d.txns.some(x => monthKey(x.date) === lastMk)) return;              // 上月没账
      const vis = (d.settings.visibleTo || []).filter(id => (props.characters || []).some(c => c.id === id));
      if (!vis.length || !props.active) return;
      genMonthly(lastMk, vis);
    }, []);

    const common = { sk, data, cur, code, curs, settings: data.settings, onOpenTxn: id => push({ k: "txn", id }) };
    const TABS = [["wallet", "钱包", "wallet"], ["stats", "统计", "chart"], ["cal", "日历", "cal"], ["me", "我的", "me"]];
    const tabTitle = { wallet: "我的钱包", stats: "统计", cal: "日历", me: "我的" }[tab];
    // 顶栏：多币种时右边一颗切换键（只有一种币就不出现）
    const curSwitch = curs.length > 1 ? h("button", { onClick: () => { const i = curs.findIndex(c => c.code === code); setSetting({ viewCur: curs[(i + 1) % curs.length].code }); }, "aria-label": "换币种", className: "active:opacity-60",
      style: { minWidth: 40, height: 40, padding: "0 8px", fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: sk.accent }, "data-wk": "ldgpagebtn", "data-part": "换币种" }, cur.label) : null;

    const main = h("div", { className: "h-full flex flex-col", style: Object.assign({}, sk.page) },
      h("div", { className: tab === "wallet" && sk.id === "glass" ? "lg-wallet-head shrink-0" : "shrink-0" }, h(Head, { zh: sk.id === "glass" ? "" : tabTitle, onBack: props.onBack, ink: sk.ink, bg: "transparent", noLine: true, right: curSwitch }),
        // 第一页标题也换成她出的图（2026-09-29）；放在顶栏这一格里，下面钱包的一切位置都不用跟着挪
        tab === "wallet" && sk.id === "glass" ? h("img", { src: "assets/ledger/title-wallet.webp?v=279", alt: "MY WALLET", draggable: false, "data-ledger-title": "wallet", style: { display: "block", width: "72%", height: "auto", margin: "-34px 0 0 12%" } }) : null),
      // 她 2026-09-29：首页不许左右滑（票根、便签这些故意伸出页边的素材会把页面撑宽），滑到底也不许再弹
      h("div", { key: tab, className: "flex-1 min-h-0 overflow-y-auto", "data-ledger-scroll": true, style: { overflowX: "hidden", overscrollBehavior: "none", touchAction: "pan-y" } },
        tab === "wallet" ? h(sk.id === "glass" ? WalletHomeY2K : WalletHome, Object.assign({}, common, { characters: props.characters, onAdd: type => setAddState({ type }), onBills: () => push({ k: "bills" }), onEditBudget: editBudget,
          onMotto: () => requestAppPrompt("钱包上的那句话", "写一句给自己看的话，留空就用默认那句。", data.settings.motto || "", v => setSetting({ motto: String(v || "").trim().slice(0, 30) }), "好"),
          onToggleHide: () => setSetting({ hideBal: !data.settings.hideBal }) })) :
        tab === "stats" ? h(CurView, Object.assign({}, common, { onOpenCat: (cat, kind, mk) => push({ k: "bills", cat, kind, mk }), txns: data.txns, budget: (data.settings.budgets || {})[code] || 0, onSetBudget })) :
        tab === "cal" ? h(CalView, common) :
        h(MeView, Object.assign({}, common, { characters: props.characters, onSettings: k => setShowSet(k), onExport: exportCSV, onGoals: () => push({ k: "goals" }), onYear: () => push({ k: "year" }), onEditBudget: editBudget, onSkin: id => setSetting({ skin: id }) }))),
      // 底栏：只吃 0.4 条安全区（mobile-ui-layout §2）；选中那格图标加粗、底下垫一块鼓起来的糖块
      h("div", { className: "shrink-0 flex", "data-ledger-tabbar": true, style: sk.id === "glass"
        // 样张：底栏是一条浮起来的玻璃条（圆角、细白边），只吃 0.4 条安全区（mobile-ui-layout §2）
        ? { padding: "6px 8px", margin: "0 12px calc(env(safe-area-inset-bottom) * 0.4)", borderRadius: 24, background: "linear-gradient(160deg, rgba(255,255,255,.62), rgba(244,245,252,.4))", border: "1px solid rgba(255,255,255,.9)",
            boxShadow: "inset 0 1px 0 #fff, 0 6px 18px rgba(110,112,160,.14)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }
        : Object.assign({ padding: "6px 10px calc(env(safe-area-inset-bottom) * 0.4)" }, sk.tabBar) },
        // 底栏轻薄：只有选中那一格底下垫一小块果冻高光
        TABS.map(([k, zh, ic]) => { const on = tab === k;
          return h("button", { key: k, onClick: () => setTab(k), className: "flex-1 flex flex-col items-center justify-center active:opacity-70", "aria-label": zh, "aria-current": on ? "page" : undefined, style: { minHeight: 52, gap: 2 }, "data-wk": "ldgpage", "data-on": on ? "1" : "0" },
            h("span", { className: "flex items-center justify-center" + (on && sk.id === "glass" ? " lg-gloss" : ""), style: { width: 44, height: 28, borderRadius: 10,
              background: on ? (sk.id === "glass" ? "radial-gradient(80% 60% at 50% 15%, rgba(255,255,255,.95), rgba(255,255,255,0) 70%), linear-gradient(180deg, #ece4ff, #d9ccfb)" : "rgba(60,54,40,.08)") : "transparent",
              boxShadow: on && sk.id === "glass" ? "inset 0 -1px 2px rgba(150,125,225,.35), 0 2px 6px rgba(150,125,225,.22)" : "none" } },
              h(LIcon, { k: ic, size: 20, color: on ? sk.ink : sk.fog, sw: on ? 2.1 : 1.6 })),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, fontWeight: on ? 700 : 500, color: on ? sk.ink : sk.fog } }, zh)); })));

    const renderOverlay = top => {
      let over = null;
    if (top && top.k === "goals") over = h(GoalsView, Object.assign({}, common, { onBack: pop, toast: props.toast, onPersist: mutate => { const d = loadData(); mutate(d); persist(d); },
      onConfirm: (title, body, fn) => setConfirmAsk({ title, body, fn }) }));
    else if (top && top.k === "year") over = h(YearView, Object.assign({}, common, { onBack: pop, characters: props.characters, onGenerate: genYearly,
      canComment: !!props.active && (data.settings.visibleTo || []).some(id => (props.characters || []).some(c => c.id === id)) }));
    else if (top && top.k === "bills") over = h(BillsView, Object.assign({}, common, { onBack: pop, initCat: top.cat, initKind: top.kind, initMk: top.mk }));
    else if (top && top.k === "txn") {
      const txn = data.txns.find(x => x.id === top.id);
      over = txn ? h(TxnView, {
        txn, cur: curOf(txn.currency), sk, settings: data.settings, characters: props.characters, moods: props.moods, affinities: props.affinities,
        active: props.active, worldbook: props.worldbook, worldbookFor: props.worldbookFor, uName, toast: props.toast,
        onBack: pop,
        onForwardToChat: props.onForwardToChat,
        onEdit: () => setAddState({ edit: txn }),
        onAddComments: cmts => updTxn(txn.id, { comments: (txn.comments || []).concat(cmts) }),
        onDelete: () => { delTxn(txn.id); pop(); },
        onRefund: (amt, note) => { const now = loadData().txns.find(x => x.id === txn.id); if (!now) return; const rs = (now.refunds || []).slice();
          if (amt == null) rs.pop(); else rs.push({ date: todayStr(), amount: amt, note: note || "" });
          updTxn(txn.id, { refunds: rs }); props.toast && props.toast(amt == null ? "撤掉了" : "记上了，这笔现在按 " + fmtMoney(netAmt({ ...now, refunds: rs }), curOf(txn.currency)) + " 算"); }
      }) : null;
    }

      return over;
    };

    return h("div", { className: "h-full" + (sk.id === "glass" ? " lg-reference" : ""), style: { position: "relative" }, "data-wk": "ldgpage", "data-part": "r2" },
      h("style", null, JELLY_CSS),
      main,
      // 底下那层留着不卸：滚动位置原样还在
      stack.map((v, i) => h("div", { key: i + v.k, "data-ledger-overlay": v.k, "aria-hidden": i !== stack.length - 1, style: { position: "absolute", inset: 0, zIndex: 20 + i, visibility: i === stack.length - 1 ? "visible" : "hidden", pointerEvents: i === stack.length - 1 ? "auto" : "none" } }, renderOverlay(v))),
      addState ? h(AddSheet, {
        settings: data.settings, curs, edit: addState.edit, initType: addState.type, initCode: code, sk,
        onClose: () => setAddState(null),
        onAddCurrency: c => { const d = loadData(); d.settings.currencies = (d.settings.currencies || []).concat([c]); persist(d); },
        onAddCat: (type, cat) => { const d = loadData(); d.settings.cats[type] = (d.settings.cats[type] || []).concat([cat]); persist(d); },
        onSave: txn => {
          if (txn.account) { const d = loadData(); d.settings.lastAcct = { ...(d.settings.lastAcct || {}), [txn.currency]: txn.account }; saveData(d); }
          if (addState.edit) { updTxn(addState.edit.id, txn); setAddState(null); props.toast && props.toast("改好了"); }
          else { addTxn(txn); setAddState(null); autoReact(txn); if (props.characters && props.characters.length) push({ k: "txn", id: txn.id }); else props.toast && props.toast("记好了"); }
        }
      }) : null,
      confirmAsk ? h(ConfirmDialog, { title: confirmAsk.title, body: confirmAsk.body, confirmLabel: "删掉", danger: true, onConfirm: () => { confirmAsk.fn(); setConfirmAsk(null); }, onCancel: () => setConfirmAsk(null) }) : null,
      showSet ? h(SettingsSheet, {
        settings: data.settings, characters: props.characters, txns: data.txns, toast: props.toast, initTab: showSet, sk, code,
        onClose: () => setShowSet(null),
        onPersist: mutate => { const d = loadData(); mutate(d); persist(d); }
      }) : null);
  }

  // ============================================================
  // 钱包：顶上那张镭射卡是【母组件】——下面的余额屏、三颗键、电量槽都是同一台机器上的舱位
  // ============================================================
  // ============================================================
  // 钱包首页 · 照她 2026-09-28 给的整页样张（IMG 抄作业版）逐块做：
  //   页边印着的小字 → 透明卡套 + 银链 + 透明兔子挂件 → 余额面板 + 手写座右铭 + 贴纸便签
  //   → 三颗带四颗螺丝的玻璃键 → 透明试管预算槽 + 手写 Keep going → 玻璃面板里的最近账单 → 左边露出一截票根 → 页脚小字和条码
  // ============================================================
  const HAND_ZH = "'Kaiti SC','STKaiti','KaiTi','Long Cang',cursive";
  const WIDE = "'Avenir Next','Futura','Century Gothic','Helvetica Neue',Arial,sans-serif";
  // 页边印着的一列小字（像机身上的丝印）
  const edgeText = (lines, style) => h("div", { className: "lg-edge", "aria-hidden": "true", style: Object.assign({ position: "absolute", fontFamily: WIDE, fontSize: 7.5, letterSpacing: ".22em", lineHeight: 1.9, color: "rgba(92,92,130,.55)", pointerEvents: "none", whiteSpace: "pre" }, style) }, lines.join("\n"));
  // 银色链子 + 一只透明树脂兔子挂件
  function KeyChain({ style }) {
    return h("svg", { width: 44, height: 150, viewBox: "0 0 44 150", "aria-hidden": "true", style: Object.assign({ position: "absolute", overflow: "visible", pointerEvents: "none" }, style), "data-wk": "ldgkeychain" },
      h("defs", null,
        h("linearGradient", { id: "lg-chain", x1: 0, y1: 0, x2: 1, y2: 1 }, h("stop", { offset: 0, stopColor: "#ffffff" }), h("stop", { offset: .45, stopColor: "#c9ccd8" }), h("stop", { offset: 1, stopColor: "#8e92a8" })),
        h("radialGradient", { id: "lg-charm", cx: .38, cy: .3, r: .8 }, h("stop", { offset: 0, stopColor: "rgba(255,255,255,.98)" }), h("stop", { offset: .6, stopColor: "rgba(232,234,248,.7)" }), h("stop", { offset: 1, stopColor: "rgba(196,200,232,.75)" }))),
      // 链环：一节竖、一节横，交错
      [0, 1, 2, 3, 4].map(i => i % 2 === 0
        ? h("rect", { key: i, x: 10, y: 4 + i * 17, width: 11, height: 20, rx: 5.5, fill: "none", stroke: "url(#lg-chain)", strokeWidth: 3 })
        : h("rect", { key: i, x: 11.5, y: 6 + i * 17, width: 8, height: 16, rx: 4, fill: "none", stroke: "url(#lg-chain)", strokeWidth: 2.4, transform: "rotate(90 15.5 " + (14 + i * 17) + ")" })),
      // 兔子挂件：透明树脂
      h("g", { transform: "translate(0 88)", style: { filter: "drop-shadow(0 3px 4px rgba(110,110,170,.25))" } },
        h("path", { d: "M14 20c-3-8-3-17 1-18s5 8 4 17M28 20c3-8 3-17-1-18s-5 8-4 17", fill: "url(#lg-charm)", stroke: "rgba(170,172,210,.8)", strokeWidth: 1 }),
        h("ellipse", { cx: 21, cy: 34, rx: 17, ry: 15, fill: "url(#lg-charm)", stroke: "rgba(170,172,210,.8)", strokeWidth: 1 }),
        h("circle", { cx: 15.5, cy: 33, r: 1.4, fill: "#8a86b4" }), h("circle", { cx: 26.5, cy: 33, r: 1.4, fill: "#8a86b4" }),
        h("path", { d: "M19 38q2 1.6 4 0", fill: "none", stroke: "#8a86b4", strokeWidth: 1, strokeLinecap: "round" }),
        h("ellipse", { cx: 13, cy: 26, rx: 4, ry: 2, fill: "rgba(255,255,255,.95)", transform: "rotate(-30 13 26)" })));
  }
  // 条码（页脚、卡上的贴纸、票根共用）
  const miniBarcode = (w, hh, seed) => { const bars = []; let x = 0, n = Math.abs(forumlessHash(seed || "q")) || 7;
    while (x < w) { n = (n * 1103515245 + 12345) & 0x7fffffff; const bw = 0.8 + (n % 3) * .7; bars.push(h("rect", { key: x, x, y: 0, width: bw, height: hh, fill: "#5d5f7c" })); x += bw + 1 + ((n >> 3) % 2); }
    return h("svg", { width: w, height: hh, viewBox: "0 0 " + w + " " + hh, "aria-hidden": "true", style: { display: "block" }, "data-wk": "ldgkeychainminibarcode" }, bars); };
  // 玻璃键四角的小螺丝
  const screws = () => [[8, 8], [null, 8], [8, null], [null, null]].map(([l, t], i) => h("span", { key: i, "aria-hidden": "true", style: Object.assign({ position: "absolute", width: 7, height: 7, borderRadius: "50%",
    background: "radial-gradient(circle at 35% 30%, #fff, #d6d8e6 55%, #9ea2bc)", boxShadow: "0 0.5px 1px rgba(80,80,120,.35)", zIndex: 3 }, l == null ? { right: 8 } : { left: l }, t == null ? { bottom: 8 } : { top: t }) }));
  // 面板：极淡的乳白玻璃，一道细白边（样张里余额 / 预算 / 最近都是这一种）
  const PANEL = { background: "linear-gradient(160deg, rgba(255,255,255,.55), rgba(246,247,252,.3))", border: "1px solid rgba(255,255,255,.85)", borderRadius: 18,
    boxShadow: "inset 0 1px 0 #fff, 0 1px 2px rgba(110,112,160,.08), 0 6px 18px rgba(110,112,160,.08)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" };
  function WalletHomeY2K(props) {
    const { sk, data, cur, code, settings } = props;
    const mk = thisMonthKey(), lmk = shiftMonth(mk, -1);
    const s = summarize(data.txns, code, mk);
    const hide = !!settings.hideBal;
    const bs = budgetState((settings.budgets || {})[code], s.exp, mk);
    const recent = data.txns.filter(x => x.currency === code).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 4);
    const motto = settings.motto || "认真生活，也要快乐花钱♡";
    const now = new Date(), MON = ["JAN.", "FEB.", "MAR.", "APR.", "MAY", "JUN.", "JUL.", "AUG.", "SEP.", "OCT.", "NOV.", "DEC."][now.getMonth()];
    const used = bs ? Math.min(1, bs.used) : 0;
    // 座右铭按逗号折成两行，照样张那样一上一下
    const mottoLines = (() => { const t = String(motto); const i = t.search(/[，,]/); return i > 0 && i < t.length - 1 ? [t.slice(0, i + 1), t.slice(i + 1)] : [t]; })();
    const card = h("div", { "data-ledger-card": true, style: { position: "relative", height: 172, borderRadius: 15, overflow: "hidden",
        background: "linear-gradient(125deg,#e6e0fb 0%,#f3dff0 28%,#d9e6fb 55%,#ece0fa 80%,#f6e6f3 100%)",
        boxShadow: "inset 0 1px 0 #fff, inset 0 -4px 10px rgba(150,130,220,.2), inset 0 0 0 1px rgba(255,255,255,.55)" } },
      h("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(112deg, transparent 32%, rgba(255,255,255,.65) 43%, rgba(214,236,255,.35) 49%, transparent 58%)" } }),
      h("div", { style: { position: "absolute", left: 22, top: 20, fontFamily: WIDE, fontSize: 12.5, fontWeight: 700, letterSpacing: ".16em", color: "#4d4f86" } }, "QIUQIU WALLET"),
      h("div", { style: { position: "absolute", left: 22, top: 52, width: 38, height: 29, borderRadius: 6, background: "linear-gradient(135deg,#f7f5fc,#c9c4dc 60%,#eeebf6)", boxShadow: "inset 0 0 0 1px rgba(120,110,160,.3)" } },
        h("div", { style: { position: "absolute", left: 12, top: 0, bottom: 0, width: 1, background: "rgba(120,110,160,.3)" } }), h("div", { style: { position: "absolute", right: 10, top: 0, bottom: 0, width: 1, background: "rgba(120,110,160,.3)" } }),
        h("div", { style: { position: "absolute", inset: "8px 0", borderTop: "1px solid rgba(120,110,160,.3)", borderBottom: "1px solid rgba(120,110,160,.3)" } })),
      h("div", { style: { position: "absolute", left: 22, bottom: 18, fontFamily: WIDE, fontSize: 10.5, letterSpacing: ".1em", lineHeight: 1.3, color: "#5c5e8c" } }, "GOOD THINGS", h("br"), "COST MONEY", h("br"), "BUT ALSO", h("br"), "MAKE ME HAPPY :)"),
      h("svg", { width: 66, height: 66, viewBox: "0 0 70 70", style: { position: "absolute", right: 26, bottom: 30 }, fill: "none", stroke: "rgba(255,255,255,.98)", strokeWidth: 2.2, strokeLinecap: "round", "aria-hidden": "true" },
        h("path", { d: "M25 30c-4-10-4-22 1-24s7 10 6 22M45 30c4-10 4-22-1-24s-7 10-6 22" }),
        h("path", { d: "M14 50c0-12 9-21 21-21s21 9 21 21-9 14-21 14-21-2-21-14z" }),
        h("circle", { cx: 28, cy: 48, r: 1.5, fill: "#fff" }), h("circle", { cx: 42, cy: 48, r: 1.5, fill: "#fff" }), h("path", { d: "M32 53c1.5 1.2 4.5 1.2 6 0" })),
      h(Sparkle, { size: 16, style: { position: "absolute", right: 16, bottom: 88 } }),
      // 卡上的两张贴纸：椭圆的 QIUQIU、底边一条条码
      h("div", { style: { position: "absolute", right: 12, bottom: 12, padding: "3px 9px", borderRadius: 999, transform: "rotate(-14deg)", fontFamily: WIDE, fontSize: 8.5, fontWeight: 700, letterSpacing: ".08em", color: "#55588a",
        background: "linear-gradient(160deg, rgba(255,255,255,.95), rgba(222,226,246,.9))", boxShadow: "0 1px 2px rgba(90,90,140,.25), inset 0 1px 0 #fff" } }, "QIUQIU"),
      h("div", { style: { position: "absolute", left: "50%", bottom: 0, transform: "translateX(-40%)", padding: "4px 8px 2px", borderRadius: "4px 4px 0 0", background: "rgba(255,255,255,.85)", boxShadow: "0 -1px 2px rgba(90,90,140,.15)" } }, miniBarcode(90, 16, "card")));
    const key = (label, tone, glyph, onClick) => { const [a, b] = JELLY[tone];
      const ink = { pink: "#4a3446", blue: "#33415e", lilac: "#3f3a62" }[tone];
      return h("button", { onClick, className: "flex-1 flex flex-col items-center justify-center lg-key", "data-ledger-bigkey": tone,
        style: { position: "relative", height: 104, gap: 6, borderRadius: 18,
          // 一块厚透明玻璃：外沿一道淡色轮廓，里面一圈亮白厚边，面是透出来的一点点颜色
          background: "radial-gradient(70% 55% at 35% 18%, rgba(255,255,255,.75), rgba(255,255,255,0) 70%), linear-gradient(160deg, rgba(255,255,255,.55), " + a + "55)",
          border: "1px solid " + b + "80",
          boxShadow: "inset 0 0 0 3px rgba(255,255,255,.6), inset 0 0 0 4px " + b + "33, inset 0 3px 4px #fff, inset 0 -4px 8px " + b + "33, 0 3px 0 " + b + "40, 0 8px 16px rgba(110,112,160,.14)" }, "data-wk": "ldgwallethomeykkey" },
        screws(),
        h(JellyGlyph, { k: glyph, tone, size: 42 }),
        h("span", { style: { position: "relative", fontFamily: F_BODY, fontSize: 14, fontWeight: 700, letterSpacing: ".06em", color: ink } }, label)); };
    // ⚠️她 2026-09-29：「我让你完全复制没让你自己画」——实物部件（卡套+链子兔子、便签、三颗键、试管、票根、页脚）
    //   直接用她那张整页样张裁下来的图（assets/ledger/，按 960 宽的原图坐标裁），位置和宽度也按原图比例摆；
    //   只有会变的东西（余额、座右铭、预算数字和进度、最近账单）用字写在上面。
    const IMG = "assets/ledger/", IMG_V = "?v=290";   // 素材换了就改这个数，不然手机里缓存的旧图不会换
    const accts = settings.accounts || [];
    const [slide, setSlide] = useState(0);
    // 她 2026-09-29「滑到不同的卡数字要变」：第 0 张是总卡＝这个币种本月结余；滑到账户卡＝那个账户本月的收入 − 支出（转账不算收支）
    const slideAcct = slide > 0 ? accts[slide - 1] : null;
    const shownNet = slideAcct ? data.txns.filter(t => t.account === slideAcct.id && monthKey(t.date) === mk && !isTransfer(t))
      .reduce((a, t) => a + (t.type === "income" ? 1 : -1) * netAmt(t), 0) : s.net;
    // 账户卡上印的字：盖住原卡面左上那块，跟卡一起歪 3 度
    const acctFace = a => { const c = (props.curs || []).find(x => x.code === a.currency) || cur, ty = acctType(a.type);
      const cs = a.type === "credit" ? creditState(a, data.txns) : null;
      const money = v => hide ? c.symbol + " ****" : fmtMoney(v, c);
      // 卡套图（1500×950）里那张卡：中心在 44.4% / 48.9%，宽 63%、高 58%，本身斜 -8 度
      return h("div", { "data-ledger-acctface": a.id, style: { position: "absolute", left: "12.9%", top: "19.9%", width: "63%", height: "58%", padding: "4.5% 6%", borderRadius: "7% / 11%", transform: "rotate(-8deg)", overflow: "hidden", boxSizing: "border-box",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          background: "#e9eafa", "--lg-acct-hue": ty.hue + "deg",
          boxShadow: "inset 0 1px 0 #fff, inset 0 0 0 1px rgba(255,255,255,.8)" }, "data-wk": "ldgwallethomeyk" },
        h("div", null, h("div", { style: { display: "flex", alignItems: "center", gap: 6, fontFamily: F_BODY, fontSize: 13, fontWeight: 800, color: "#2b2c55", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } },
          h("span", { style: { width: 12, height: 8, borderRadius: 2, background: ty.tint, flexShrink: 0 } }), a.name),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: "#77789a", marginTop: 1 } }, ty.zh + " · " + c.label)),
        cs ? h("div", null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#5c5e80", marginTop: 0 } }, cs.dueDate ? "本期应还" : "欠款"),
          h("div", { style: Object.assign(numStyle(sk, 19, "#1d1e44"), { fontWeight: 800 }) }, money(cs.dueDate ? cs.due : cs.owed)),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: cs.due && cs.daysLeft >= 0 && cs.daysLeft <= 3 ? sk.over : "#77789a", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } },
            (cs.dueDate ? (cs.due ? (cs.daysLeft < 0 ? "已过还款日 " + (-cs.daysLeft) + " 天" : cs.daysLeft === 0 ? "今天要还" : "还有 " + cs.daysLeft + " 天还款") : "本期已还清") : "") +
            (cs.avail != null ? (cs.dueDate ? " · " : "") + "可用 " + money(cs.avail) : "")))
          : h("div", null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#5c5e80", marginTop: 0 } }, "余额"),
            h("div", { style: Object.assign(numStyle(sk, 19, "#1d1e44"), { fontWeight: 800 }) }, money(acctBalance(a, data.txns))))); };
    const at = (x, w) => ({ marginLeft: (x / 960 * 100) + "%", width: (w / 960 * 100) + "%" });
    const pic = (src, x, w, extra, props2) => h("img", Object.assign({ src: IMG + src + ".webp" + IMG_V, alt: "", draggable: false, style: Object.assign({ display: "block", height: "auto" }, at(x, w), extra || {}) }, props2 || {}));
    const soft = "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent), linear-gradient(180deg, transparent, #000 5%, #000 95%, transparent)";
    const softStyle = { WebkitMaskImage: soft, maskImage: soft, WebkitMaskComposite: "source-in", maskComposite: "intersect" };
    const picKey = (src, x, w, label, onClick, tone) => h("button", { onClick, "aria-label": label, "data-ledger-bigkey": tone, className: "lg-key", style: Object.assign({ position: "absolute", top: 0, padding: 0, background: "transparent" }, { left: (x / 960 * 100) + "%", width: (w / 960 * 100) + "%" }), "data-wk": "ldgwallethomeykbtn", "data-part": "1" },
      h("img", { src: IMG + src + ".webp" + IMG_V, alt: "", draggable: false, style: Object.assign({ display: "block", width: "100%", height: "auto" }, softStyle) }));
    const tubeFill = Math.max(.06, used);
    return h("div", { className: "lg-wallet-main", style: { position: "relative", padding: "0 0 26px", overflowX: "clip" }, "data-wk": "ldgwallethomeyk", "data-part": "r2" },
      // 页面周围的小字和星星（照样张，是字不是图，所以日期会跟着变）
      edgeText(["GOOD", "THINGS", "TAKE TIME."], { right: 46, top: 2, zIndex: 3, fontSize: 8, color: "rgba(92,92,130,.72)" }),
      h(Sparkle, { size: 18, style: { position: "absolute", right: 18, top: 12, zIndex: 3 } }),
      edgeText(["SINCE", String(now.getFullYear()), "· · ·"], { right: 4, top: 118, zIndex: 3, fontSize: 7.5 }),
      edgeText(["SPEND", "", "SAVE", "· · ·", "HAPPIER", "·"], { left: 4, top: 150, zIndex: 0, zIndex: 3, fontSize: 7.5 }),
      h(Sparkle, { size: 14, style: { position: "absolute", left: 10, top: 262, zIndex: 3 } }),
      edgeText([MON, String(now.getFullYear()), "/ " + pad(now.getMonth() + 1)], { right: 4, top: 350, zIndex: 3, fontSize: 9.5, letterSpacing: ".3em", color: "rgba(92,92,130,.65)" }),
      h(Sparkle, { size: 16, style: { position: "absolute", right: 2, top: 404, zIndex: 3 } }),
      h(Sparkle, { size: 11, style: { position: "absolute", left: 4, top: 470, zIndex: 3 } }),
      // 卡套 + 卡 + 链子兔子（原图）。加了账户就变成卡包：第一张还是这张总卡，往左滑是一张张账户卡，
      //   卡面同一张图、按类型换颜色（她 2026-09-29「3 可以」），卡上印名字和余额；信用卡印本期应还和还款日
      accts.length ? h("div", { className: "lg-cardpack-wrap", style: { position: "relative", paddingTop: 58 } },
        h("div", { "data-ledger-cardpack": true, onScroll: e => { const el = e.currentTarget; const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)); if (i !== slide) setSlide(i); },
            style: { display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none", touchAction: "pan-x pan-y", overscrollBehaviorX: "contain" } },
          [null].concat(accts).map((a, i) => h("div", { key: a ? a.id : "total", "data-ledger-tray": i === 0 ? true : undefined, "data-ledger-acctcard": a ? a.id : undefined, style: { flex: "0 0 100%", scrollSnapAlign: "center", position: "relative" } },
            // 卡套图和账户卡面套在同一个框里一起歪 3 度；卡面按卡套里那张卡的位置和 8 度斜角贴上去（她 2026-09-29「对准那个框，框相当于卡套」）
            h("div", { style: { position: "relative", width: "82%", margin: "0 0 0 9%", transform: "rotate(-3deg)" } },
              h("img", { src: IMG + "card.webp" + IMG_V, alt: "", draggable: false, style: { display: "block", width: "100%", height: "auto", filter: a && acctType(a.type).hue ? "hue-rotate(" + acctType(a.type).hue + "deg)" : "none" } }),
              a ? acctFace(a) : null)))),
        h("div", { style: { display: "flex", justifyContent: "center", gap: 6, marginTop: 4 } }, [null].concat(accts).map((a, i) => h("span", { key: i, style: { width: i === slide ? 14 : 6, height: 6, borderRadius: 999, background: i === slide ? (a ? acctType(a.type).tint : "#a79cef") : "rgba(150,145,200,.3)", transition: "width .2s" } }))))
      : h("div", { "data-ledger-tray": true, style: { position: "relative", paddingTop: 58 } },
        h("img", { src: IMG + "card.webp" + IMG_V, alt: "", draggable: false, style: { display: "block", width: "82%", height: "auto", margin: "0 0 0 9%", transform: "rotate(-3deg)" } })),
      // 余额（字）+ 便签（原图）
      h("div", { className: "lg-balance", style: { position: "relative", margin: "4px 20px 6px", minHeight: 150 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#23244a" } }, slideAcct ? slideAcct.name + " · 本月结余" : "本月结余"),
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 6 } },
          h("div", { "data-ledger-balance": true, style: Object.assign(numStyle(sk, 36, shownNet < 0 ? sk.over : "#1d1e44"), { fontWeight: 800 }) }, hide ? cur.symbol + " ****" : fmtMoney(shownNet, cur)),
          h("button", { onClick: props.onToggleHide, "aria-label": hide ? "显示金额" : "藏起金额", className: "active:opacity-60 flex items-center justify-center", style: flatKey({ width: 40, height: 40 }), "data-wk": "ldgwallethomeykbtn", "data-part": "togglehide" }, h(LIcon, { k: hide ? "eyeOff" : "eye", size: 24, color: "#23244a" }))),
        // 座右铭：一行、小一点，装在一条淡淡的透明框里（她 2026-09-29：喜欢之前那种有点透明框的）
        h("button", { onClick: props.onMotto, className: "w-full text-left active:opacity-60 lg-motto-y2k", style: { marginTop: 10, minHeight: 36, padding: "6px 12px", borderRadius: 10, fontFamily: F_BODY, fontSize: 13, color: "#44465f",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", background: "rgba(255,255,255,.42)", borderBottom: "1px dashed rgba(255,255,255,.95)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.7)" }, "data-wk": "ldgwallethomeykbtn", "data-part": "motto" },
          "「" + motto + "」"),
        h("img", { src: IMG + "note.webp" + IMG_V, alt: "", draggable: false, "aria-hidden": "true", style: { position: "absolute", right: -18, top: -6, width: "40%", height: "auto", transform: "rotate(-6deg)" } })),
      // 三颗键（原图，整块就是按钮）
      h("div", { className: "lg-bigkeys", style: { display: "flex", gap: "2%", padding: "0 4%", marginBottom: 8 } },
        [["k1", "记一笔", () => props.onAdd("expense"), "pink"], ["k2", "收入", () => props.onAdd("income"), "blue"], ["k3", "账单", props.onBills, "lilac"]].map(([src, label, fn, tone]) =>
          h("button", { key: src, onClick: fn, "aria-label": label, "data-ledger-bigkey": tone, className: "lg-key", style: { flex: 1, padding: 0, background: "transparent" }, "data-wk": "ldgwallethomeykbtn", "data-part": "4" },
            h("img", { src: IMG + src + ".webp" + IMG_V, alt: "", draggable: false, style: { display: "block", width: "100%", height: "auto" } })))),
      // 预算：字 + 原图试管，里面的液体按真实进度画
      h("button", { onClick: props.onEditBudget, className: "w-full text-left active:opacity-90", "data-ledger-wallet-budget": true, style: { display: "block", padding: "4px 0 10px" }, "data-wk": "ldgwallethomeykbtn", "data-part": "editbudget" },
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 20px 2px 24px" } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#23244a" } }, "本月预算"),
          bs ? h("span", { style: { display: "flex", alignItems: "baseline", gap: 14 } },
            h("span", { className: "lg-hand", style: { fontSize: 16, color: "#6d6c8c", transform: "rotate(-8deg)", display: "inline-block" } }, bs.left < 0 ? "Oops :(" : "Keep going :)"),
            h("span", { style: numStyle(sk, 15, bs.left < 0 ? sk.over : "#23244a") }, Math.round(bs.used * 100) + "%")) : h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: sk.fog } }, "＋ 设个每月预算")),
        h("div", { "data-ledger-rail": true, style: { position: "relative", width: "92%", margin: "0 4%" } },
          h("img", { src: IMG + "tube.webp" + IMG_V, alt: "", draggable: false, style: { display: "block", width: "100%", height: "auto" } }),
          h("div", { "aria-hidden": "true", style: { position: "absolute", left: "4.2%", top: "33%", height: "34%", width: (tubeFill * 91.6) + "%", borderRadius: 999,
            background: bs && bs.left < 0 ? "linear-gradient(180deg,#f7c7d9,#e58db1)" : "linear-gradient(180deg,#d9d2fb,#a79cef 55%,#9387e3)", boxShadow: "inset 0 1.5px 0 rgba(255,255,255,.85), inset 0 -1px 2px rgba(80,70,170,.3)" } })),
        bs ? h("div", { style: { display: "flex", justifyContent: "space-between", margin: "4px 20px 0 24px", fontFamily: F_BODY, fontSize: 14, color: "#4a4b6a" } },
          h("span", { style: numStyle(sk, 14, "#4a4b6a") }, fmtMoney(s.exp, cur) + " / " + fmtMoney(bs.budget, cur)),
          h("span", null, bs.left < 0 ? "超了  " : "还能花  ", h("span", { style: numStyle(sk, 14, bs.left < 0 ? sk.over : "#23244a") }, fmtMoney(Math.abs(bs.left), cur)))) : null),
      // 最近：左边原图票根 + 右边字
      h("div", { style: { position: "relative", display: "flex", marginTop: 8 } },
        h("img", { src: IMG + "stub.webp" + IMG_V, alt: "", draggable: false, "aria-hidden": "true", style: { position: "absolute", left: "-9%", top: -10, width: "26%", height: "auto", zIndex: 2, pointerEvents: "none", transform: "rotate(-2deg)" } }),
        h("div", { style: { flex: 1, minWidth: 0, margin: "0 16px 0 20%", position: "relative", zIndex: 1 } },
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 6, borderBottom: "1px solid " + LINE } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 700, color: "#23244a" } }, "最近"),
            h("button", { onClick: props.onBills, className: "active:opacity-60", style: { minHeight: 36, fontFamily: F_BODY, fontSize: 14, color: "#6b62b8" }, "data-wk": "ldgwallethomeykbtn", "data-part": "bills" }, "全部账单 ›")),
          recent.length ? recent.map(x => h(TxnRow, { key: x.id, txn: x, cur, sk, settings, onClick: () => props.onOpenTxn(x.id) }))
            : h("div", { style: { padding: "22px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 12.5, color: sk.fog } }, "还没有记账，点上面「记一笔」"))),
      // 页脚（原图）
      h("div", { style: { marginTop: 18 } }, pic("foot", 60, 850, softStyle)));
  }

  function WalletHome(props) {
    const { sk, data, cur, code, settings } = props;
    const mk = thisMonthKey(), lmk = shiftMonth(mk, -1);
    const s = summarize(data.txns, code, mk);
    const hide = !!settings.hideBal;
    const bs = budgetState((settings.budgets || {})[code], s.exp, mk);
    const recent = data.txns.filter(x => x.currency === code).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 5);
    const motto = settings.motto || "认真生活，也要快乐花钱♡";
    const glass = sk.id === "glass";
    // 卡面：镭射渐变 + 一道斜高光 + 芯片 + 角落一只小兔子（程序画的，不是图）
    const card = h("div", { "data-ledger-card": true, style: { position: "relative", height: 168, borderRadius: 22, overflow: "hidden", transform: glass ? "rotate(-3deg)" : "none", margin: glass ? "4px 6px 12px" : "4px 8px 20px",
        background: glass ? "linear-gradient(125deg,#e2d6ff 0%,#fbdfee 32%,#d8e8ff 62%,#eedcff 100%)" : CUR_COLORS[0],
        border: glass ? "1px solid rgba(255,255,255,.95)" : "none",
        boxShadow: glass ? "0 16px 30px rgba(130,110,200,.24), inset 0 1px 0 #fff, inset 0 -6px 14px rgba(150,130,220,.25), inset 0 0 0 1px rgba(255,255,255,.6)" : "0 6px 16px rgba(0,0,0,.15)" } },
      glass ? h("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,.6) 42%, transparent 54%)" } }) : null,
      h("div", { style: { position: "absolute", left: 20, top: 18, fontFamily: F_BODY, fontSize: 12.5, fontWeight: 800, letterSpacing: ".16em", color: glass ? "#6a5fa6" : "#fff" } }, glass ? "QIUQIU WALLET" : cur.label + " · " + cur.code),
      h("div", { style: { position: "absolute", left: 20, top: 50, width: 36, height: 27, borderRadius: 6, background: glass ? "linear-gradient(135deg,#f6f3fc,#c7c1dc 60%,#eeeaf7)" : "linear-gradient(135deg,#e8cf94,#b89150)", boxShadow: "inset 0 0 0 1px rgba(120,110,160,.28)" } },
        h("div", { style: { position: "absolute", left: 11, top: 0, bottom: 0, width: 1, background: "rgba(120,110,160,.3)" } }),
        h("div", { style: { position: "absolute", left: 0, right: 0, top: 13, height: 1, background: "rgba(120,110,160,.3)" } }), h("div", { style: { position: "absolute", right: 9, top: 0, bottom: 0, width: 1, background: "rgba(120,110,160,.3)" } }), h("div", { style: { position: "absolute", inset: "7px 0", borderTop: "1px solid rgba(120,110,160,.3)", borderBottom: "1px solid rgba(120,110,160,.3)" } })),
      h("div", { style: { position: "absolute", left: 20, bottom: 15, fontFamily: "Arial,sans-serif", fontSize: 10.5, letterSpacing: ".09em", lineHeight: 1.2, color: glass ? "rgba(90,80,140,.72)" : "rgba(255,255,255,.8)" } }, glass ? h(Fragment, null, "GOOD THINGS", h("br"), "COST MONEY", h("br"), "BUT ALSO", h("br"), "MAKE ME HAPPY :)") : "这个月记了 " + s.count + " 笔"),
      glass ? h("svg", { width: 70, height: 70, viewBox: "0 0 70 70", style: { position: "absolute", right: 18, bottom: 12, opacity: .9 }, fill: "none", stroke: "rgba(255,255,255,.95)", strokeWidth: 2.2, strokeLinecap: "round", "aria-hidden": "true" },
        h("path", { d: "M25 30c-4-10-4-22 1-24s7 10 6 22M45 30c4-10 4-22-1-24s-7 10-6 22" }),
        h("path", { d: "M14 50c0-12 9-21 21-21s21 9 21 21-9 14-21 14-21-2-21-14z" }),
        h("circle", { cx: 28, cy: 48, r: 1.4, fill: "rgba(255,255,255,.95)" }), h("circle", { cx: 42, cy: 48, r: 1.4, fill: "rgba(255,255,255,.95)" }),
        h("path", { d: "M33 53c1.2 1 2.8 1 4 0" })) : null,
      h("svg", { width: 22, height: 22, viewBox: "0 0 24 24", style: { position: "absolute", right: 20, top: 18 }, fill: glass ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.8)", "aria-hidden": "true" },
        h("path", { d: "M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" })));
    // 三颗主键（参考图）：接近正方形的一块厚玻璃软糖——面是整块透出来的粉/蓝/紫，四周一圈透明厚唇边，
    //   左上一片糊糊的高光，底下露一点同色厚度；图标是一颗占半个键宽的果冻软糖；字是暗酒红 / 暗蓝 / 暗紫
    const bigKey = (label, tone, glyph, onClick) => { const [a, b] = JELLY[tone];
      const ink = { pink: "#8c3a4f", blue: "#34467e", lilac: "#523f84" }[tone];
      return h("button", { onClick, className: "flex-1 flex flex-col items-center justify-center lg-key" + (glass ? " lg-gloss" : ""), "data-ledger-bigkey": tone,
        style: glass ? Object.assign(glassTinted(a, b), { position: "relative", aspectRatio: "1 / 1", maxHeight: 112, gap: 4, borderRadius: 18, marginBottom: 4, transition: "transform .08s" })
          : jellyKey(sk, tone, false, { minHeight: 88, gap: 4, borderRadius: 14 }), "data-wk": "ldgwallethomebigkey" },
        h(JellyGlyph, { k: glyph, tone, size: glass ? 44 : 26 }),
        h("span", { style: { position: "relative", fontFamily: F_BODY, fontSize: 13, fontWeight: 500, color: glass ? ink : sk.ink } }, label)); };
    const mrec = (data.monthly || {})[lmk];
    const ls = summarize(data.txns, code, lmk);
    const cellsN = 20, used = bs ? Math.min(1, bs.used) : 0;
    return h("div", { className: "px-5 pb-8 lg-wallet-main", "data-wk": "ldgwallethomebigkey", "data-part": "r2" },
      glass ? h("div", { "data-ledger-tray": true, style: Object.assign({}, sk.shell, { position: "relative", padding: "12px 10px 4px", borderRadius: 30, margin: "2px 0 16px" }) },
        h(Sparkle, { size: 22, style: { position: "absolute", right: -6, top: -10 } }),
        card) : card,
      // 余额（参考图）：一块亚克力里「当前余额」+ 大数字 + 眼睛，右上角一颗星，下面一行「」小字
      h("div", { className: "lg-balance", style: Object.assign({ position: "relative", padding: "14px 16px 12px", marginBottom: 14 }, sk.shell) },
        glass ? h(Sparkle, { size: 20, style: { position: "absolute", right: 14, top: 10 } }) : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, fontWeight: 600, color: sk.sub } }, "本月结余"),
        h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 } },
          h("div", { "data-ledger-balance": true, style: numStyle(sk, 30, s.net < 0 ? sk.over : sk.ink) }, hide ? cur.symbol + " ****" : fmtMoney(s.net, cur)),
          h("button", { onClick: props.onToggleHide, "aria-label": hide ? "显示金额" : "藏起金额", className: "active:opacity-60 flex items-center justify-center", style: flatKey({ width: 40, height: 36 }), "data-wk": "ldgwallethomebtn", "data-part": "togglehide" }, h(LIcon, { k: hide ? "eyeOff" : "eye", size: 20, color: sk.ink }))),
        h("div", { className: "lg-balance-summary", style: { display: "flex", gap: 14, marginTop: 2, fontFamily: F_BODY, fontSize: 11.5, color: sk.fog } },
          h("span", null, "收入 ", h("span", { style: numStyle(sk, 11.5, sk.inc) }, hide ? "****" : fmtMoney(s.inc, cur))),
          h("span", null, "支出 ", h("span", { style: numStyle(sk, 11.5, sk.sub) }, hide ? "****" : fmtMoney(s.exp, cur)))),
        h("button", { onClick: props.onMotto, className: "w-full text-left active:opacity-60 lg-motto", style: { marginTop: 8, minHeight: 32, padding: "4px 10px", borderRadius: 10, background: glass ? "rgba(255,255,255,.4)" : "transparent", fontFamily: F_BODY, fontSize: 12.5, color: sk.sub }, "data-wk": "ldgwallethomebtn", "data-part": "motto" }, "「" + motto + "」", glass ? h(Heart, { size: 12, style: { marginLeft: 4, verticalAlign: "-1px" } }) : null)),
      h("div", { className: "lg-bigkeys", style: { display: "flex", gap: 10, marginBottom: 16 } },
        bigKey("记一笔", "pink", "plus", () => props.onAdd("expense")),
        bigKey("收入", "blue", "bag", () => props.onAdd("income")),
        bigKey("账单", "lilac", "chart", props.onBills)),
      // 预算：一根电量槽，一格一格点亮；没设就是一颗「设个预算」的键
      h("button", { onClick: props.onEditBudget, className: "w-full text-left active:opacity-90", "data-ledger-wallet-budget": true, style: Object.assign({ display: "block", padding: "12px 14px 14px", marginBottom: 20 }, sk.shell), "data-wk": "ldgwallethomebtn", "data-part": "editbudget" },
        bs ? h(Fragment, null,
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } },
            silk(sk, "本月预算"),
            h("span", { style: numStyle(sk, 12, bs.left < 0 ? sk.over : sk.sub) }, Math.round(bs.used * 100) + "%")),
          h(Bar, { pct: used, over: bs.left < 0, sk, rail: true }),
          h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: F_BODY, fontSize: 11.5, color: sk.fog } },
            h("span", { style: numStyle(sk, 11.5, sk.fog) }, fmtMoney(s.exp, cur) + " / " + fmtMoney(bs.budget, cur)),
            h("span", { style: { color: bs.left < 0 ? sk.over : sk.sub, fontWeight: 600 } }, bs.left < 0 ? "超了 " + fmtMoney(-bs.left, cur) : "还能花 " + fmtMoney(bs.left, cur))))
          : h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: sk.fog } }, "＋ 设个每月预算")),
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 2px 8px" } },
        silk(sk, "最近"),
        h("button", { onClick: props.onBills, className: "active:opacity-60", style: { minHeight: 36, fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: sk.accent }, "data-wk": "ldgwallethomebtn", "data-part": "bills" }, "全部账单 ›")),
      recent.length ? h(StripSlot, { sk }, recent.map(x => h(TxnRow, { key: x.id, txn: x, cur, sk, settings, onClick: () => props.onOpenTxn(x.id) })))
        : h("div", { style: Object.assign({ padding: "22px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 12.5, color: sk.fog, marginBottom: 20 }, sk.shell) }, "还没有记账，点上面「记一笔」"),
      // 上月结算：这台机器吐出来的一张小票，角色的月度盘点写在虚线框里
      (ls.exp || ls.inc) ? h(Receipt, { sk, title: parseInt(lmk.split("-")[1], 10) + "月结算", sub: fmtMonth(lmk), no: lmk.replace("-", "") },
        [["本月支出", fmtMoney(ls.exp, cur), null], ["本月收入", fmtMoney(ls.inc, cur), "#2f9c7f"], ["结余", fmtMoney(ls.net, cur), null, true]].map(([k, v, c, big], i) =>
          h("div", { key: i, style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: big ? "10px 0 0" : "4px 0", borderTop: big ? "1px dashed rgba(60,60,80,.3)" : "none", marginTop: big ? 6 : 0 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "#5c5a66" } }, k),
            h("span", { style: { fontFamily: DIGIT, fontWeight: 700, fontSize: big ? 18 : 13.5, color: c || "#2d2c36" } }, v))),
        (mrec && (mrec.comments || []).length) ? h("div", { style: { marginTop: 12, border: "1.5px dashed rgba(60,60,80,.3)", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 } },
          mrec.comments.map((cm, i) => h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, color: "#3f3d49" } }, h("b", null, cm.charName + "："), cm.text)))
          : null) : null);
  }
  // 插信息条的那一格：外壳上开的一道凹槽，一条条小票条插在里面
  // Y2K 四角星：参考图里散在卡片和余额旁边的那几颗
  function Sparkle({ size, style, color }) {
    return h("svg", { width: size || 18, height: size || 18, viewBox: "0 0 24 24", "aria-hidden": "true", style: Object.assign({ filter: "drop-shadow(0 1px 2px rgba(150,130,210,.4))" }, style || {}), "data-wk": "ldgsparkle" },
      h("path", { d: "M12 1.5C12.8 8 16 11.2 22.5 12 16 12.8 12.8 16 12 22.5 11.2 16 8 12.8 1.5 12 8 11.2 11.2 8 12 1.5z", fill: color || "#fff", stroke: "rgba(170,150,225,.6)", strokeWidth: .8 }));
  }
  function Heart({ size, style, color }) {
    return h("svg", { width: size || 14, height: size || 14, viewBox: "0 0 24 24", "aria-hidden": "true", style: Object.assign({ filter: "drop-shadow(0 1px 1px rgba(220,130,175,.35))" }, style || {}), "data-wk": "ldgheart" },
      h("path", { d: "M12 20.5C5.5 16 2.5 12.5 2.5 8.7 2.5 5.9 4.6 4 7.1 4c1.9 0 3.6 1 4.9 2.8C13.3 5 15 4 16.9 4c2.5 0 4.6 1.9 4.6 4.7 0 3.8-3 7.3-9.5 11.8z", fill: color || "none", stroke: color ? "none" : "#e48cb2", strokeWidth: 1.8 }));
  }
  // 一颗很小的兔子头（卡面上那只的小号），当贴纸用
  function Bunny({ size, style }) {
    return h("svg", { width: size || 26, height: size || 26, viewBox: "0 0 70 70", "aria-hidden": "true", fill: "none", stroke: "#b8a8e6", strokeWidth: 3, strokeLinecap: "round", style: style || {}, "data-wk": "ldgbunny" },
      h("path", { d: "M25 30c-4-10-4-22 1-24s7 10 6 22M45 30c4-10 4-22-1-24s-7 10-6 22" }),
      h("path", { d: "M14 50c0-12 9-21 21-21s21 9 21 21-9 14-21 14-21-2-21-14z", fill: "rgba(255,255,255,.7)" }),
      h("circle", { cx: 28, cy: 48, r: 1.8, fill: "#b8a8e6" }), h("circle", { cx: 42, cy: 48, r: 1.8, fill: "#b8a8e6" }));
  }
  // 回形针（贴在小票上）
  function Clip({ style }) {
    return h("svg", { width: 22, height: 46, viewBox: "0 0 22 46", "aria-hidden": "true", style: Object.assign({ position: "absolute", filter: "drop-shadow(0 1px 1px rgba(90,90,130,.3))" }, style || {}), "data-wk": "ldgclip" },
      h("path", { d: "M7 12V34a4 4 0 0 0 8 0V9a6 6 0 0 0-12 0v27a8 8 0 0 0 16 0V14", fill: "none", stroke: "#b9bdd2", strokeWidth: 2.2, strokeLinecap: "round" }),
      h("path", { d: "M7 12V34a4 4 0 0 0 8 0V9a6 6 0 0 0-12 0v27a8 8 0 0 0 16 0V14", fill: "none", stroke: "#fff", strokeWidth: .8, strokeLinecap: "round", transform: "translate(-.6 -.4)" }));
  }
  // 每页顶上的英文字标 + 一行手写小字（她 2026-09-28：Y2K 要有标志性的字，英文可以破例）
  function WordMark({ sk, word, hand, star }) {
    if (sk.id !== "glass") return null;
    return h("div", { "data-ledger-wordmark": word, style: { position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "space-between", margin: "0 2px 12px" }, "data-wk": "ldgwordmark" },
      h("div", null,
        h("div", { className: "lg-word", style: { fontSize: 17, color: sk.ink } }, word),
        hand ? h("div", { className: "lg-hand", style: { fontSize: 15, color: "#b27aa6", marginTop: -1, transform: "rotate(-3deg)", transformOrigin: "left" } }, hand) : null),
      star !== false ? h(Sparkle, { size: 22, style: { marginBottom: 6 } }) : null);
  }
  function StripSlot({ sk, children }) {
    return h("div", { style: { display: "flex", flexDirection: "column", gap: 0, marginBottom: 18, borderTop: sk.id === "glass" ? "1px solid " + LINE : "none" }, "data-wk": "ldgstripslot" }, children);
  }

  // 小票：这台机器吐出来的实体纸——唯一不是塑料的东西。热敏纸的淡打印纹、编号、虚线、上下锯齿
  function Receipt({ sk, title, sub, no, children, foot }) {
    const PAPER = "#fcfbff";
    const teeth = dir => h("div", { "aria-hidden": "true", style: { height: 7, background: "linear-gradient(" + (dir ? "45deg" : "135deg") + ", " + PAPER + " 50%, transparent 50%) 0 0/14px 14px repeat-x, linear-gradient(" + (dir ? "-45deg" : "225deg") + ", " + PAPER + " 50%, transparent 50%) 0 0/14px 14px repeat-x", transform: dir ? "scaleY(-1)" : "none" } });
    return h("div", { "data-ledger-receipt": true, className: "lg-receipt", style: { position: "relative", margin: "4px 10px 26px", filter: "drop-shadow(0 8px 14px rgba(70,70,110,.16))" }, "data-wk": "ldgreceipt" },
      sk.id === "glass" ? h(Clip, { style: { right: 18, top: -16, zIndex: 3, transform: "rotate(18deg)" } }) : null,
      sk.id === "glass" ? null : teeth(true),
      h("div", { style: { background: PAPER, backgroundImage: "repeating-linear-gradient(180deg, rgba(0,0,0,.018) 0 1px, transparent 1px 3px)", padding: "14px 18px 14px" } },
        h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 16, fontWeight: 800, letterSpacing: ".1em", color: "#2d2c36" } }, title),
        sub ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 10.5, color: "#8f8c98", marginTop: 3, letterSpacing: ".12em" } }, sub) : null,
        no ? h("div", { style: { textAlign: "center", fontFamily: DIGIT, fontSize: 10, color: "#a09daa", marginTop: 3, letterSpacing: ".1em" } }, "No." + String(no).toUpperCase().slice(-8)) : null,
        h("div", { style: { borderTop: "1px dashed rgba(60,60,80,.3)", margin: "12px 0 8px" } }),
        children,
        // 手写的一句 + 一颗心 + 小兔子贴纸（参考图小票上那种）
        sk.id === "glass" ? h("div", { style: { position: "relative", margin: "12px 0 2px", minHeight: 40 } },
          h("div", { className: "lg-hand", style: { fontSize: 18, color: "#6d5a8e", lineHeight: 1.1, transform: "rotate(-4deg)", transformOrigin: "left" } }, "Manage money,", h("br"), h("span", { style: { whiteSpace: "nowrap" } }, "manage a happier me ", h(Heart, { size: 13, style: { verticalAlign: "-1px" } }))),
          h(Bunny, { size: 30, style: { position: "absolute", right: 0, bottom: -4, transform: "rotate(8deg)" } })) : null,
        foot || null),
      sk.id === "glass" ? h("div", { style: { height: 8, background: "linear-gradient(135deg, " + PAPER + " 25%, transparent 25%) -7px 0 / 14px 14px, linear-gradient(225deg, " + PAPER + " 25%, transparent 25%) -7px 0 / 14px 14px" } }) : teeth(false));
  }
  // 条形码：几十根宽窄不一的竖线，按这笔账的 id 定下来，每一笔都不一样但每次打开都一样
  function Barcode({ seed }) {
    const bars = []; let x = 0, n = Math.abs(forumlessHash(seed || "x"));
    for (let i = 0; i < 90; i++) { n = (n * 1103515245 + 12345) & 0x7fffffff; const w = 1 + (n % 3); if (i % 2 === 0) bars.push(h("rect", { key: i, x, y: 0, width: w, height: 38, fill: "#2d2c36" })); x += w + 1; }
    return h("svg", { width: "100%", height: 38, viewBox: "0 0 " + x + " 38", preserveAspectRatio: "none", "aria-hidden": "true", style: { display: "block", margin: "12px 0 4px" }, "data-wk": "ldgbarcode" }, bars);
  }

  // ============================================================
  // 统计：电子钱包仪表盘——仪表环在一块 LCD 里，排行是屏上的状态条，六个月是像素柱
  // ============================================================
  // 仪表环：一圈 60 根小刻度，按分类占比依次点亮成各自的颜色；没用到的刻度是屏上的暗格
  // 环形图：平的，一圈淡彩色——跟参考图一样，不抢戏
  // 统计页唯一的主视觉：一张薄薄的透明光盘——虹彩的透明盘面、几道同心细纹、盘边一圈亮沿、中心一个小轴孔圈；
  //   数据环印在盘面上（比例不变，只换材质），中间的数字保持平面清楚
  function Donut({ parts, total, label, cur, sk }) {
    const R = 54, C = 2 * Math.PI * R, glass = sk.id === "glass"; let acc = 0;
    if (!glass) return h("div", { style: { position: "relative", width: 140, height: 140, flexShrink: 0 }, "data-wk": "ldgdonut" },
      h("svg", { width: 140, height: 140, viewBox: "0 0 140 140", "aria-hidden": "true" },
        h("circle", { cx: 70, cy: 70, r: R, fill: "none", stroke: sk.line, strokeWidth: 18 }),
        parts.map((p, i) => { const len = total ? p.v / total * C : 0; const el = h("circle", { key: i, cx: 70, cy: 70, r: R, fill: "none", stroke: p.c, strokeWidth: 18, strokeDasharray: Math.max(0, len - 1.5) + " " + C, strokeDashoffset: -acc, transform: "rotate(-90 70 70)" }); acc += len; return el; })),
      h("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" } },
        h("div", { style: numStyle(sk, 16) }, fmtMoney(total, cur)), h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: sk.sub, marginTop: 2 } }, label)));
    return h("div", { "data-ledger-cd": true, style: { position: "relative", width: 150, height: 150, flexShrink: 0 }, "data-wk": "ldgdonut", "data-part": "r2" },
      // 盘面：虹彩透明（锥形渐变），带一点厚度
      h("div", { "aria-hidden": "true", style: { position: "absolute", inset: 0, borderRadius: "50%",
        background: "conic-gradient(from 210deg, rgba(255,226,240,.5), rgba(214,236,255,.55), rgba(232,224,255,.5), rgba(255,246,222,.45), rgba(214,244,246,.5), rgba(255,226,240,.5))",
        boxShadow: "inset 0 1px 1px rgba(255,255,255,.95), inset 0 -2px 4px rgba(110,114,170,.18), 0 2px 0 rgba(150,154,200,.28), 0 6px 14px rgba(110,114,170,.14)" } }),
      h("svg", { width: 150, height: 150, viewBox: "0 0 150 150", "aria-hidden": "true", style: { position: "absolute", inset: 0 } },
        // 同心细纹
        [70, 64, 36, 30].map(r => h("circle", { key: r, cx: 75, cy: 75, r, fill: "none", stroke: "rgba(255,255,255,.6)", strokeWidth: .6 })),
        // 数据环：半透明，印在盘面上
        h("circle", { cx: 75, cy: 75, r: R, fill: "none", stroke: "rgba(255,255,255,.35)", strokeWidth: 15 }),
        parts.map((p, i) => { const len = total ? p.v / total * C : 0; const el = h("circle", { key: i, cx: 75, cy: 75, r: R, fill: "none", stroke: p.c, strokeOpacity: .78, strokeWidth: 15,
          strokeDasharray: Math.max(0, len - 1.5) + " " + C, strokeDashoffset: -acc, transform: "rotate(-90 75 75)" }); acc += len; return el; }),
        // 盘边亮沿 + 左上一道反光
        h("circle", { cx: 75, cy: 75, r: 74, fill: "none", stroke: "rgba(255,255,255,.85)", strokeWidth: 1 }),
        h("path", { d: "M26 48 A56 56 0 0 1 60 22", fill: "none", stroke: "rgba(255,255,255,.85)", strokeWidth: 3, strokeLinecap: "round" }),
        // 中心轴孔圈
        h("circle", { cx: 75, cy: 75, r: 40, fill: "rgba(255,255,255,.55)", stroke: "rgba(255,255,255,.9)", strokeWidth: 1 })),
      h("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" } },
        h("div", { style: numStyle(sk, total >= 10000 ? 14 : 16) }, fmtMoney(total, cur)),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".1em", color: sk.sub, marginTop: 2 } }, label)));
  }
  function CurView(props) {
    const { sk, code, cur, txns, settings } = props;
    const [mk, setMk] = useState(thisMonthKey());
    const [kind, setKind] = useState("expense");
    const s = summarize(txns, code, mk);
    const monthTxns = txns.filter(x => x.currency === code && monthKey(x.date) === mk)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
    // 收入也要能看分类：summarize 只拆了支出，收入这边就地拆
    const incCats = (() => { const m = {}; monthTxns.filter(x => x.type === "income").forEach(x => { m[x.category] = (m[x.category] || 0) + (Number(x.amount) || 0); }); return Object.keys(m).map(k => ({ name: k, amount: m[k] })).sort((a, b) => b.amount - a.amount); })();
    const list = kind === "income" ? incCats : s.catList;
    const total = kind === "income" ? s.inc : s.exp;
    const parts = list.map(c => ({ v: c.amount, c: catTint(settings, kind, c.name), name: c.name }));
    const maxCat = list.length ? list[0].amount : 1;
    const six = [5, 4, 3, 2, 1, 0].map(i => { const m = shiftMonth(mk, -i); return { m, v: summarize(txns, code, m).exp }; });
    const sixMax = Math.max(1, ...six.map(x => x.v));
    // 第二页照她给的素材做（2026-09-29）：面板是她给的那块玻璃框，按九宫格拉伸；标题、星星、挂件都是素材图
    const LA = "assets/ledger/", LV = "?v=290", glassP = sk.id === "glass";
    // 她 2026-09-29「这些玻璃现在有点光污染」：玻璃框挪到 ::before 上单独压透明度，里面的字和圆环不受影响；
    //   本月支出那块最大，四个角同时亮像水晶相框——再压一档，下半截淡出去，让圆环当主角
    const pnl = glassP ? { borderStyle: "solid", borderWidth: 24, borderColor: "transparent", borderRadius: 0, background: "transparent", padding: 0, position: "relative", isolation: "isolate" } : sk.shell;
    const pnlCls = glassP ? "lg-pnl" : undefined;
    const pnlCss = glassP ? h("style", null, PNL_CSS) : null;
    const deco = (src, st) => glassP ? h("img", { src: LA + src + ".webp" + LV, alt: "", "aria-hidden": "true", draggable: false, style: Object.assign({ position: "absolute", height: "auto", pointerEvents: "none", zIndex: 3 }, st) }) : null;
    const bay = (title, body, extra, cls) => h("div", { className: glassP ? "lg-pnl" + (cls ? " " + cls : "") : undefined, style: Object.assign({ padding: "12px 14px 14px", marginBottom: 16 }, pnl, extra || {}) }, title ? silk(sk, title, { marginBottom: 8 }) : null, body);
    // overflow 两个方向都 clip：装饰素材伸到最后一块面板下面时不许把页面撑长（她 2026-09-29「撑不到那么多的时候也把页面截了」）
    return h("div", { className: "px-5 pb-8 lg-stats", style: { position: "relative", overflow: glassP ? "clip" : undefined }, "data-wk": "ldgcurview" },
      glassP ? h("img", { src: LA + "title-stats.webp" + LV, alt: "STATISTICS", draggable: false, style: { display: "block", width: "82%", height: "auto", margin: "-4px 0 2px -4%" } }) : h(WordMark, { sk, word: "STATISTICS", hand: "where did my money go?" }),
      pnlCss,
      // 装饰故意不对称（她 2026-09-29「三块玻璃板太整齐，又有 UI kit 感」）：回形针只夹一块、只露半截；
      //   金星全页就一颗，紫星多两颗但不是每块都有；票根从支出排行右侧探出一角
      deco("star-purple", { width: 30, right: 6, top: 14 }),
      deco("star-purple", { width: 16, right: 40, top: 46, opacity: .8 }),
      deco("charm1", { width: 62, right: -18, top: 300, transform: "rotate(-8deg)" }),
      deco("star-gold", { width: 26, left: -8, top: 520 }),
      deco("stub", { width: 84, right: -30, top: 880, transform: "rotate(-7deg)" }),
      deco("star-purple", { width: 20, left: -4, top: 1180 }),
      h(MonthNav, { mk, setMk, sk }),
      bay(kind === "income" ? "本月收入" : "本月支出", h(Fragment, null,
        h("div", { style: Object.assign({ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px" }, sk.acrylic) },
          h(Donut, { parts, total, label: kind === "income" ? "本月收入" : "本月支出", cur, sk }),
          h("div", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 } },
            list.length ? list.slice(0, 6).map(c => h("div", { key: c.name, style: { display: "flex", alignItems: "center", gap: 7, fontFamily: F_BODY, fontSize: 12, color: sk.ink } },
              h("span", { style: { width: 8, height: 8, borderRadius: 2, background: catTint(settings, kind, c.name), flexShrink: 0, boxShadow: "0 0 4px " + catTint(settings, kind, c.name) } }),
              h("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.name),
              h("span", { style: numStyle(sk, 11.5) }, Math.round(c.amount / (total || 1) * 100) + "%")))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: sk.sub } }, kind === "income" ? "这个月还没有收入" : "这个月还没有支出"))),
        h("div", { style: { marginTop: 12 } }, h(CandySeg, { items: [["expense", "支出"], ["income", "收入"]], value: kind, onChange: setKind, sk }))), null, "lg-pnl-hero"),
      // 多币种折合（她 2026-09-29）：设了主币和汇率才出现，只是换算着看，不改任何一笔
      (function () {
        if ((settings.currencies || []).length < 2 || !settings.baseCur) return null;
        const ct = convertTotal(txns, settings, mk, kind), bc = (settings.currencies || []).find(c => c.code === ct.base) || { symbol: "", label: ct.base };
        return h("div", { "data-ledger-converted": true, style: { margin: "-6px 4px 14px", fontFamily: F_BODY, fontSize: 12, color: sk.sub, textAlign: "center" }, "data-wk": "ldgcurview", "data-part": "r2" },
          "所有币种折合成" + bc.label + "，这个月" + (kind === "income" ? "收入" : "花了") + " ", h("span", { style: numStyle(sk, 13, sk.ink) }, fmtMoney(ct.sum, bc)),
          ct.missing.length ? h("span", { style: { color: sk.fog } }, "（" + ct.missing.join("、") + " 还没填汇率，没算进去）") : null);
      })(),
      (function () {
        const da = dailyAvg(s.exp, mk);
        if (!da) return null;
        // 今天实际花了多少（她 2026-09-27「那实际的每日消费你没做」）：只在看这个月时有
        const td = todayKey(), todayExp = mk === td.slice(0, 7) ? monthTxns.filter(x => x.date === td && isExpense(x)).reduce((a, x) => a + netAmt(x), 0) : null;
        // 三块并排的小读数屏
        const row = (label, val, note, key, first) => h("div", { key, style: { flex: 1, textAlign: "center", padding: "2px 4px", borderLeft: first ? "none" : "1px solid " + LINE } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: sk.sub, marginBottom: 3 } }, label),
          h("div", { style: numStyle(sk, 14.5) }, fmtMoney(val, cur)),
          note ? h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: sk.sub, marginTop: 2 } }, note) : null);
        return h("div", { "data-ledger-daily": true, className: pnlCls, style: Object.assign({ display: "flex", padding: "12px 6px", marginBottom: 14 }, pnl), "data-wk": "ldgcurview", "data-part": "r3" },
          todayExp != null ? row("今天花了", todayExp, "", "today", true) : null,
          row("日均支出", da.avg, "按 " + da.days + " 天算", "avg", todayExp == null),
          row("结余", s.net, "", "net"));
      })(),
      // 本月预算：没设过就是一行小字「设个预算」，设了是一根电量槽
      (function () {
        const bs = budgetState(props.budget, s.exp, mk);
        const edit = () => requestAppPrompt("每月预算", "每个月打算在" + cur.label + "上花多少？填 0 就是不设。", props.budget || "", v => {
          const n = Math.max(0, Math.round((parseFloat(String(v).replace(/[^\d.]/g, "")) || 0) * 100) / 100);
          props.onSetBudget && props.onSetBudget(n);
        }, "好", { placeholder: "比如 2000" });
        if (!bs) return h("button", { onClick: edit, className: "active:opacity-60", style: { display: "block", margin: "0 0 14px 4px", minHeight: 40, fontFamily: F_BODY, fontSize: 12.5, color: sk.fog }, "data-wk": "ldgcurview", "data-part": "r4" }, "＋ 设个每月预算");
        const over = bs.left < 0, pct = Math.min(1, bs.used);
        return h("div", { "data-ledger-budget": true, className: pnlCls, style: Object.assign({ padding: "12px 14px 14px", marginBottom: 16 }, pnl), "data-wk": "ldgcurview", "data-part": "r5" },
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
            silk(sk, "本月预算"),
            h("button", { onClick: edit, "aria-label": "改预算", className: "active:opacity-60 flex items-center gap-1", style: { minHeight: 40, fontFamily: F_BODY, fontSize: 12, color: sk.sub }, "data-wk": "ldgcurviewbtn", "data-part": "改预算" }, fmtMoney(bs.budget, cur), h(IPencil, { size: 13, color: sk.fog }))),
          h("div", { style: { marginBottom: 10 } },
            h(Bar, { pct, over, sk, rail: true }),
            h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 7, fontFamily: F_BODY, fontSize: 11.5, color: sk.sub } },
              h("span", null, "已用 ", h("span", { style: numStyle(sk, 11.5) }, Math.round(bs.used * 100) + "%")),
              h("span", { style: { color: over ? sk.over : sk.sub } }, over ? "超了 " : "还剩 ", h("span", { style: numStyle(sk, 11.5, over ? sk.over : sk.ink) }, fmtMoney(over ? -bs.left : bs.left, cur))))),
          bs.perDay != null ? h("div", { style: { display: "flex", justifyContent: "space-between", fontFamily: F_BODY, fontSize: 11.5, color: sk.sub } },
            h("span", null, over ? "这个月已经超支了" : "剩下每天可花（含今天，还有 " + bs.daysLeft + " 天）"),
            over ? null : h("span", { style: numStyle(sk, 14) }, fmtMoney(bs.perDay, cur))) : null,
          // 今天实际花的对上「今天能花的」：超了照实标出来
          bs.perDay != null && !over ? (function () {
            const td = todayKey(), spent = monthTxns.filter(x => x.date === td && isExpense(x)).reduce((a, x) => a + netAmt(x), 0);
            const allow = (bs.left + spent) / bs.daysLeft;   // 今天开张前剩的钱摊到含今天的这几天，就是今天原本能花的
            return h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: F_BODY, fontSize: 11.5, color: sk.sub }, "data-wk": "ldgcurview", "data-part": "r6" },
              h("span", null, "今天已花"),
              h("span", { style: { color: spent > allow ? sk.over : sk.sub, fontWeight: 600 } }, fmtMoney(spent, cur) + " / " + fmtMoney(allow, cur)));
          })() : null);
      })(),
      // 排行：屏上的一行行状态条
      list.length ? bay(kind === "income" ? "收入排行" : "支出排行",
        h("div", { style: Object.assign({ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }, sk.acrylic) },
          list.map(c => { const tint = catTint(settings, kind, c.name), meta = ((settings.cats || {})[kind] || []).find(x => x.name === c.name) || {};
            // 点一行就去账单，只看这一类（她 2026-09-28：统计和账单要连起来）
            return h("button", { key: c.name, onClick: () => props.onOpenCat && props.onOpenCat(c.name, kind, mk), "data-ledger-rank": c.name, className: "w-full text-left active:opacity-70", style: { display: "flex", alignItems: "center", gap: 10, minHeight: 44 }, "data-wk": "ldgcurview", "data-part": "r7" },
              h(CatTile, { tint, emoji: meta.emoji || c.emoji, name: c.name, icon: meta.icon, size: 30, sk }),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { display: "flex", justifyContent: "space-between", fontFamily: F_BODY, fontSize: 12.5, color: sk.ink, marginBottom: 5 } },
                  h("span", { style: { fontWeight: 600 } }, c.name),
                  h("span", { style: numStyle(sk, 12) }, fmtMoney(c.amount, cur) + " " + Math.round(c.amount / (total || 1) * 100) + "%")),
                // 设了分类上限：条按「用了上限的几成」画，快到了变粉、超了变红（她 2026-09-29）
                (() => { const lim = kind === "income" ? 0 : catBudgetOf(settings, code, c.name);
                  return lim ? h(Fragment, null, h(Bar, { pct: Math.min(1, c.amount / lim), over: c.amount > lim, color: c.amount / lim >= .8 ? "#ec8fb3" : tint, height: 6, sk }),
                      h("div", { "data-ledger-catlimit": c.name, style: { fontFamily: F_BODY, fontSize: 10.5, color: c.amount > lim ? sk.over : sk.fog, marginTop: 3 } }, c.amount > lim ? "超了上限 " + fmtMoney(c.amount - lim, cur) : "上限 " + fmtMoney(lim, cur) + " · 还能花 " + fmtMoney(lim - c.amount, cur)))
                    : h(Bar, { pct: c.amount / maxCat, color: tint, height: 6, sk }); })()),
              h("span", { style: { color: sk.fog, fontSize: 15 } }, "›")); }))) : null,
      // 近六个月：屏上的像素柱，一格一格往上垒
      bay("近六个月支出",
        h("div", { style: Object.assign({ display: "flex", alignItems: "flex-end", gap: 10, padding: "12px 12px 8px" }, sk.acrylic) },
          six.map(x => { const lit = x.v ? Math.max(1, Math.round(x.v / sixMax * 10)) : 0, now = x.m === mk;
            // 点一根柱子＝看那个月的支出账单（她 2026-09-29）
            return h("button", { key: x.m, "data-ledger-sixmonth": x.m, "aria-label": "看" + fmtMonth(x.m) + "的支出", onClick: () => props.onOpenCat && props.onOpenCat("", "expense", x.m), className: "active:opacity-70",
                style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minHeight: 40, padding: 0, background: "transparent", border: "none" }, "data-wk": "ldgcurview", "data-part": "r8" },
              h("div", { style: numStyle(sk, 9.5, sk.sub) }, x.v ? fmtNum(Math.round(x.v)) : "—"),
              // 玻璃皮：她给的一对柱子素材——空柱子当底，满柱子按金额从下往上长（九宫格拉伸，圆头不变形）
              glassP ? h("div", { "data-ledger-col": x.m, style: { position: "relative", width: "100%", maxWidth: 30, height: 96 } },
                  h("div", { style: { position: "absolute", inset: 0, borderStyle: "solid", borderColor: "transparent", borderWidth: "14px 10px", borderImage: "url(" + LA + "col-empty.webp" + LV + ") 140 100 fill / 14px 10px / 0 stretch" } }),
                  x.v ? h("div", { style: { position: "absolute", inset: 0, borderStyle: "solid", borderColor: "transparent", borderWidth: "14px 10px", borderImage: "url(" + LA + "col-full.webp" + LV + ") 140 100 fill / 14px 10px / 0 stretch",
                    // 满柱整根画出来，再从上往下裁掉没用完的那段：液面是平的，不会挤成一团
                    clipPath: "inset(" + Math.round((1 - Math.max(.12, x.v / sixMax)) * 100) + "% 0 0 0 round 10px)",
                    filter: now ? "hue-rotate(55deg) saturate(1.1)" : "none" } }) : null)
              : h("div", { style: { width: "100%", maxWidth: 24, height: 84, display: "flex", alignItems: "flex-end", borderRadius: 12, background: sk.line } },
                h("div", { style: { width: "100%", height: lit ? Math.max(10, lit * 8.4) : 0, borderRadius: 12, background: sk.accent } })),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: now ? sk.ink : sk.sub, fontWeight: now ? 800 : 500 } }, parseInt(x.m.split("-")[1], 10) + "月")); }))));
  }

  // ============================================================
  // 账单：月份 + 全部/支出/收入 + 搜索 + 按天分组的信息条
  // ============================================================
  function BillsView(props) {
    const { sk, code, cur, data, settings } = props;
    const [mk, setMk] = useState(props.initMk || thisMonthKey());
    const [kind, setKind] = useState(props.initKind || "all");
    const [catF, setCatF] = useState(props.initCat || "");   // 从统计排行点进来：只看这一类
    const [q, setQ] = useState(null);   // null＝没在搜；字符串＝在搜（搜的时候跨月）
    const all = data.txns.filter(x => x.currency === code && (!catF || x.category === catF));
    const kw = q == null ? "" : q.trim();
    const monthTxns = all.filter(x => (kw ? true : monthKey(x.date) === mk) && (kind === "all" || (kind === "income" ? x.type === "income" : isExpense(x)))
      && (!kw || [x.note, x.category, String(x.amount)].some(v => String(v || "").indexOf(kw) >= 0)))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return ledgerPage(sk, sk.id === "glass" ? "" : "账单", props.onBack,
      h("button", { onClick: () => setQ(q == null ? "" : null), "aria-label": "搜索账单", className: "active:opacity-60 flex items-center justify-center", style: flatKey({ width: 40, height: 40 }), "data-wk": "ldgbillsviewbtn", "data-part": "搜索账单" }, h(LIcon, { k: "search", size: 19, color: sk.ink })),
      h("div", { className: "px-5 pb-8 lg-bills", style: sk.id === "glass" ? { position: "relative" } : undefined },
      // 玻璃皮：标题换她出的 BILLS 图，右上角一颗她给的紫星（2026-09-29）
      sk.id === "glass" ? h(Fragment, null,
          h("img", { src: "assets/ledger/star-purple.webp?v=290", alt: "", "aria-hidden": "true", draggable: false, style: { position: "absolute", right: 14, top: 0, width: 30, height: "auto", pointerEvents: "none" } }),
          h("img", { src: "assets/ledger/title-bills.webp?v=290", alt: "BILLS", draggable: false, "data-ledger-title": "bills", style: { display: "block", width: "64%", height: "auto", margin: "-6px 0 8px -2%" } }))
        : h(WordMark, { sk, word: "MY BILLS", hand: "small money, big happiness" }),
        catF ? h("div", { "data-ledger-catfilter": catF, style: { display: "flex", justifyContent: "center", marginBottom: 10 } },
          h("button", { onClick: () => setCatF(""), "aria-label": "不再只看" + catF, className: "active:opacity-70 flex items-center", style: Object.assign({ gap: 6, minHeight: 36, padding: "0 12px 0 6px", borderRadius: 999, fontFamily: F_BODY, fontSize: 12.5, fontWeight: 600, color: sk.ink }, sk.card), "data-wk": "ldgbillsviewbtn", "data-part": "不再只看" },
            h(CategoryGlyph, { name: catF, icon: catIconOf(settings, kind === "income" ? "income" : "expense", catF), size: 22 }), "只看" + catF, h("span", { style: { color: sk.fog, marginLeft: 2 } }, "×"))) : null,
        q != null ? h("input", { autoFocus: true, value: q, onChange: e => setQ(e.target.value), placeholder: "搜备注、分类或金额", style: Object.assign({ width: "100%", minHeight: 42, padding: "0 14px", fontFamily: F_BODY, fontSize: 14, color: sk.ink, outline: "none", marginBottom: 12 }, sk.acrylic), "data-wk": "ldgbillsviewinput", "data-part": "搜备注、分类或金额" })
          : h(MonthNav, { mk, setMk, sk }),
        h("div", { style: { marginBottom: 10 } }, h(CandySeg, { items: [["all", "全部"], ["expense", "支出"], ["income", "收入"]], value: kind, onChange: setKind, sk })),
        // 本月汇总条（她 2026-09-29）：滑下去也钉在顶上。算的就是眼下列出来的这些——筛了分类、搜了字，数跟着变；转账不算收支
        (function () {
          const exp = monthTxns.filter(isExpense).reduce((a, x) => a + netAmt(x), 0);
          const inc = monthTxns.filter(x => x.type === "income").reduce((a, x) => a + (Number(x.amount) || 0), 0);
          const cell = (label, val, color, first) => h("div", { style: { flex: 1, textAlign: "center", borderLeft: first ? "none" : "1px solid " + LINE } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: sk.fog } }, label),
            h("div", { style: Object.assign(numStyle(sk, 14, color), { marginTop: 1, whiteSpace: "nowrap" }) }, val));
          return h("div", { "data-ledger-billsum": true, style: { position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", padding: "8px 4px", margin: "0 -6px 12px", borderRadius: 14,
              background: sk.id === "glass" ? "linear-gradient(160deg,rgba(255,255,255,.82),rgba(240,238,252,.72))" : pageColor("ledger", "bg", "#f2ece0"),
              border: sk.id === "glass" ? "1px solid rgba(255,255,255,.95)" : "1px solid " + sk.line, boxShadow: "0 4px 12px rgba(110,112,160,.12)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }, "data-wk": "ldgbillsview" },
            cell(kw ? "搜到的支出" : "支出", fmtMoney(exp, cur), sk.exp, true),
            cell(kw ? "搜到的收入" : "收入", fmtMoney(inc, cur), sk.inc),
            cell("笔数", String(monthTxns.length) + " 笔", sk.ink));
        })(),
        monthTxns.length ? h("div", { className: "lg-bills-list", style: { display: "flex", flexDirection: "column", gap: 4 } },
          groupByDay(monthTxns).map(g => h("div", { key: g.date, "data-ledger-day": g.date },
            h("div", { className: "lg-bills-date", style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 6px 6px", fontFamily: F_BODY, fontSize: 11.5, fontWeight: 600, color: sk.sub } },
              h("span", null, dayLabel(g.date)),
              h("span", { style: numStyle(sk, 11, sk.fog) }, [g.exp ? "支 " + fmtMoney(g.exp, cur) : "", g.inc ? "收 " + fmtMoney(g.inc, cur) : ""].filter(Boolean).join("  "))),
            h(StripSlot, { sk }, g.rows.map(x => h(TxnRow, { key: x.id, txn: x, cur, sk, settings, onClick: () => props.onOpenTxn(x.id) }))))))
          : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: sk.fog, textAlign: "center", padding: "40px 0" } }, kw ? "没搜到" : "这个月还没有记账")));
  }


  // ============================================================
  // 存钱目标（她 2026-09-29）：一个罐子一根试管；存进去 / 取出来只记在目标自己的 log 上，不算支出
  // ============================================================
  function GoalsView(props) {
    const { sk, cur, code, settings } = props;
    const [adding, setAdding] = useState(false);
    const [open, setOpen] = useState(null);
    const goals = (settings.goals || []).filter(g => g.currency === code);
    const money = v => fmtMoney(v, cur);
    const ask = (g, sign) => requestAppPrompt(sign > 0 ? "往「" + g.name + "」里存" : "从「" + g.name + "」里取", sign > 0 ? "存多少" + cur.label + "？" : "取出多少" + cur.label + "？最多 " + money(goalSaved(g)) + "。", "", v => {
      let n = Math.round((parseFloat(String(v).replace(/[^\d.]/g, "")) || 0) * 100) / 100; if (!(n > 0)) return;
      if (sign < 0) n = Math.min(n, goalSaved(g));
      props.onPersist(d => { d.settings.goals = (d.settings.goals || []).map(x => x.id === g.id ? { ...x, log: (x.log || []).concat([{ date: todayStr(), amount: sign * n }]) } : x); });
      const after = goalState({ ...g, log: (g.log || []).concat([{ amount: sign * n }]) });
      props.toast && props.toast(after.done ? "「" + g.name + "」存满啦 ♡" : sign > 0 ? "存进去了，还差 " + money(after.left) : "取出来了");
    }, "好", { placeholder: "比如 200" });
    return h(Fragment, null, ledgerPage(sk, sk.id === "glass" ? "" : "存钱目标", props.onBack, null,
      h("div", { className: "px-5 pb-8", "data-ledger-goals": true },
        sk.id === "glass" ? h(WordMark, { sk, word: "SAVING", hand: "a brighter me ♡" }) : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: sk.fog, lineHeight: 1.6, margin: "0 4px 14px" } }, "存进去、取出来都只记在目标自己身上，不算花钱，也不动账户余额。"),
        goals.map(g => { const st = goalState(g), on = open === g.id;
          return h("div", { key: g.id, "data-ledger-goal": g.id, style: Object.assign({ padding: "12px 14px", marginBottom: 12, borderRadius: 18 }, sk.id === "glass" ? { background: "linear-gradient(160deg,rgba(255,255,255,.62),rgba(236,234,250,.42))", border: "1px solid rgba(255,255,255,.85)", boxShadow: "0 3px 10px rgba(140,130,200,.12)" } : sk.shell), "data-wk": "ldggoalsview" },
            h("button", { onClick: () => setOpen(on ? null : g.id), className: "w-full text-left active:opacity-80", style: { display: "block", minHeight: 40 }, "data-wk": "ldggoalsviewbtn", "data-part": "1", "data-on": on ? "1" : "0" },
              h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
                h("span", { style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 800, color: sk.ink } }, (st.done ? "♡ " : "") + g.name),
                h("span", { style: numStyle(sk, 12.5, sk.sub) }, money(st.saved) + " / " + money(st.target))),
              h("div", { style: { margin: "8px 0 6px" } }, h(Bar, { pct: st.pct, sk, rail: true })),
              h("div", { style: { display: "flex", justifyContent: "space-between", fontFamily: F_BODY, fontSize: 11, color: sk.fog } },
                h("span", null, st.done ? "存满了" : "还差 " + money(st.left)),
                h("span", null, g.due ? (st.days < 0 ? "已过 " + fmtDay(g.due) : fmtDay(g.due) + (st.perMonth ? " · 每月存 " + money(st.perMonth) : "")) : Math.round(st.pct * 100) + "%"))),
            on ? h("div", { style: { display: "flex", gap: 8, marginTop: 10 } },
              h("button", { onClick: () => ask(g, 1), className: "flex-1 active:opacity-80", style: { minHeight: 40, borderRadius: 999, fontFamily: F_BODY, fontSize: 13, fontWeight: 700, color: "#6b3a5a", background: "linear-gradient(160deg,#fcd6e8,#efa3c7)" }, "data-wk": "ldggoalsviewbtn", "data-part": "2" }, "存一笔"),
              h("button", { onClick: () => ask(g, -1), className: "flex-1 active:opacity-80", style: { minHeight: 40, borderRadius: 999, fontFamily: F_BODY, fontSize: 13, color: sk.sub, border: "1px solid " + sk.line }, "data-wk": "ldggoalsviewbtn", "data-part": "3" }, "取出来"),
              h("button", { onClick: () => props.onConfirm("删掉目标「" + g.name + "」？", "只删这个目标和它的存取记录，账本里的账一笔都不动。", () => props.onPersist(d => { d.settings.goals = (d.settings.goals || []).filter(x => x.id !== g.id); })),
                "aria-label": "删掉这个目标", className: "active:opacity-60 flex items-center justify-center", style: { width: 40, height: 40 }, "data-wk": "ldggoalsviewbtn", "data-part": "删掉这个目标" }, h(ITrash, { size: 17, color: sk.fog }))) : null); }),
        h("button", { onClick: () => setAdding(true), className: "w-full active:opacity-70", style: { minHeight: 48, borderRadius: 16, border: "1px dashed " + sk.line, fontFamily: F_BODY, fontSize: 13, color: sk.fog }, "data-wk": "ldggoalsviewbtn", "data-part": "5" }, "＋ 新的存钱目标"))),
      adding ? h(FieldDialog, { glass: sk.id === "glass", title: "新的存钱目标", submitLabel: "好",
        fields: [{ key: "name", label: "存来做什么", placeholder: "比如 回国机票", required: true }, { key: "target", label: "目标金额（" + cur.label + "）", placeholder: "比如 6000", required: true }, { key: "due", label: "想在哪天前存够（可留空，写成 2027-01-31）", placeholder: "2027-01-31" }],
        onSubmit: v => { const target = Math.round((parseFloat(String(v.target).replace(/[^\d.]/g, "")) || 0) * 100) / 100; if (!(target > 0)) return;
          const due = /^\d{4}-\d{2}-\d{2}$/.test(String(v.due || "").trim()) ? String(v.due).trim() : "";
          props.onPersist(d => { d.settings.goals = (d.settings.goals || []).concat([{ id: "g" + Date.now().toString(36), name: String(v.name).trim().slice(0, 20), target, currency: code, due, log: [] }]); }); setAdding(false); },
        onCancel: () => setAdding(false) }) : null);
  }

  // ============================================================
  // 年度回顾（她 2026-09-29）：一张年终小票；能看账本的角色可以一起说几句
  // ============================================================
  function YearView(props) {
    const { sk, cur, code, data } = props;
    const [year, setYear] = useState(new Date().getFullYear());
    const [busy, setBusy] = useState(false);
    const ys = yearStats(data.txns, code, year);
    const key = code + "-" + year, saved = (data.yearly || {})[key];
    const money = v => fmtMoney(v, cur);
    const row = (k, v) => h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0", fontFamily: F_BODY, fontSize: 12.5, color: "#5c5a66" } }, h("span", null, k), h("span", { style: { fontWeight: 700, color: "#2d2c36", textAlign: "right" } }, v));
    const mName = mk => mk ? parseInt(mk.slice(5), 10) + "月" : "—";
    return ledgerPage(sk, sk.id === "glass" ? "" : "年度回顾", props.onBack, null,
      h("div", { className: "px-5 pb-8", "data-ledger-year": year },
        sk.id === "glass" ? h(WordMark, { sk, word: "MY YEAR", hand: "small money, big happiness" }) : null,
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 10 } },
          h("button", { onClick: () => setYear(y => y - 1), "aria-label": "上一年", className: "active:opacity-50", style: { width: 40, height: 40, fontSize: 18, color: sk.sub }, "data-wk": "ldgyearviewbtn", "data-part": "上一年" }, "‹"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 600, color: sk.ink, minWidth: 80, textAlign: "center" } }, year + " 年"),
          h("button", { onClick: () => setYear(y => Math.min(new Date().getFullYear(), y + 1)), "aria-label": "下一年", className: "active:opacity-50", style: { width: 40, height: 40, fontSize: 18, color: sk.sub }, "data-wk": "ldgyearviewbtn", "data-part": "下一年" }, "›")),
        ys.count ? h(Receipt, { sk, title: year + " 年度小票", sub: cur.label + " · " + ys.count + " 笔", no: key,
          foot: h(Barcode, { seed: key }) },
          row("一整年花了", money(ys.exp)),
          row("一整年进账", money(ys.inc)),
          row("结余", money(ys.net)),
          h("div", { style: { borderTop: "1px dashed rgba(60,60,80,.3)", margin: "8px 0" } }),
          ys.catList[0] ? row("花得最多", ys.catList[0].name + " " + money(ys.catList[0].amount)) : null,
          ys.mostOften ? row("最常记", ys.mostOften + " · " + ys.mostOftenN + " 笔") : null,
          ys.biggest ? row("最贵的一笔", (ys.biggest.note || ys.biggest.category) + " " + money(netAmt(ys.biggest))) : null,
          ys.priciest ? row("最能花的月", mName(ys.priciest) + " " + money(ys.priciestAmt)) : null,
          ys.cheapest && ys.cheapest !== ys.priciest ? row("最省的月", mName(ys.cheapest) + " " + money(ys.cheapestAmt)) : null,
          ys.catList.length > 1 ? h("div", { style: { marginTop: 8 } }, ys.catList.slice(0, 5).map(c => h("div", { key: c.name, style: { display: "flex", alignItems: "center", gap: 8, margin: "5px 0", fontFamily: F_BODY, fontSize: 11.5, color: "#5c5a66" } },
            h("span", { style: { width: 58, flexShrink: 0 } }, c.name), h("div", { style: { flex: 1 } }, h(Bar, { pct: c.amount / ys.catList[0].amount, height: 5, sk })), h("span", { style: { width: 64, textAlign: "right" } }, money(c.amount))))) : null)
          : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: sk.fog, textAlign: "center", padding: "40px 0" } }, "这一年还没有" + cur.label + "的账"),
        ys.count && props.canComment ? h("div", { style: { marginTop: 4 } },
          silk(sk, "TA 们看了你这一年", { marginBottom: 10 }),
          (saved && saved.comments || []).map((cm, i) => { const ch = (props.characters || []).find(c => c.id === cm.charId);
            return h("div", { key: i, style: { display: "flex", gap: 10, marginBottom: 12 }, "data-wk": "ldgyearview" },
              ch ? h(Avatar, { character: ch, size: 34, radius: 10 }) : h("div", { style: { width: 34, height: 34, borderRadius: 10, background: sk.line, flexShrink: 0 } }),
              h("div", { style: { flex: 1, minWidth: 0 } }, h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: sk.sub, marginBottom: 3 } }, cm.charName),
                h("div", { style: Object.assign({ padding: "9px 12px", fontFamily: F_BODY, fontSize: 13, color: sk.ink, lineHeight: 1.55 }, sk.card, { borderRadius: 14, borderTopLeftRadius: 4 }) }, cm.text))); }),
          h("button", { disabled: busy, onClick: async () => { setBusy(true); try { await props.onGenerate(year, ys); } finally { setBusy(false); } }, "data-ledger-yeargen": true, className: "w-full active:opacity-80",
            style: { minHeight: 44, borderRadius: 999, fontFamily: F_BODY, fontSize: 13, fontWeight: 700, color: sk.ink, background: "rgba(255,255,255,.55)", border: "1px solid rgba(160,150,220,.35)" }, "data-wk": "ldgyearviewbtn", "data-part": "3" },
            busy ? "TA 们在看…" : saved ? "再让 TA 们说说" : "让能看账本的 TA 们说说")) : null));
  }

  // ============================================================
  // 日历：整个月装进一块电子屏里，花过钱的日子像 LCD 像素格被点亮，花得越多越黑
  // ============================================================
  function CalView(props) {
    const { sk, code, cur, data, settings } = props;
    const [mk, setMk] = useState(thisMonthKey());
    const [sel, setSel] = useState(todayKey());
    const [y, m] = mk.split("-").map(Number);
    const first = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate();
    const byDay = {};
    data.txns.forEach(x => { if (x.currency !== code || monthKey(x.date) !== mk || isTransfer(x)) return; const d = byDay[x.date] || (byDay[x.date] = { exp: 0, inc: 0 }); if (x.type === "income") d.inc += netAmt(x); else d.exp += netAmt(x); });
    const max = Math.max(1, ...Object.keys(byDay).map(k => byDay[k].exp));
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(y + "-" + pad(m) + "-" + pad(d));
    const selRows = data.txns.filter(x => x.currency === code && x.date === sel).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const today = todayKey();
    const glass = sk.id === "glass";
    // 第三页照她给的素材做（2026-09-29）：标题图、便签、三种日期键帽、邮戳、左边一列圆孔都是她出的图；
    //   日期数字和金额、邮戳上的日期是代码印上去的，所以哪个月都对
    const LA = "assets/ledger/", LV = "?v=290";
    const [sy, sm, sd] = sel.split("-");
    return h("div", { className: "px-5 pb-8 lg-cal", style: glass ? { position: "relative", overflow: "clip" } : undefined, "data-wk": "ldgcalview" },
      glass ? h("style", null, PNL_CSS) : null,
      glass ? h("img", { src: LA + "note-good.webp" + LV, alt: "", "aria-hidden": "true", draggable: false, style: { position: "absolute", right: -6, top: 0, width: 96, height: "auto", transform: "rotate(5deg)", pointerEvents: "none", zIndex: 0 } }) : null,
      glass ? h("img", { src: LA + "title-cal.webp" + LV, alt: "CALENDAR", draggable: false, style: { position: "relative", display: "block", width: "74%", height: "auto", margin: "-2px 0 4px -3%" } })
        : h(WordMark, { sk, word: "MY CALENDAR", hand: "every little day ♡" }),
      h(MonthNav, { mk, setMk, sk }),
      h("div", { className: glass ? "lg-pnl" : undefined, style: glass ? { borderStyle: "solid", borderWidth: 24, borderColor: "transparent", position: "relative", isolation: "isolate", padding: "0", margin: "0 -6px 14px" }
        : { padding: "4px 0", marginBottom: 12, borderTop: "1px solid " + LINE, borderBottom: "1px solid " + LINE } },
        // 她给的空吊牌挂在日历框右边，月份缩写是代码印的——到十月就自己变 OCT.
        glass ? h("div", { "data-ledger-tag": true, "aria-hidden": "true", style: { position: "absolute", right: -40, top: 28, width: 38, zIndex: 2, pointerEvents: "none", transform: "rotate(-3deg)" } },
          h("img", { src: LA + "tag.webp" + LV, alt: "", draggable: false, style: { display: "block", width: "100%", height: "auto" } }),
          h("span", { style: { position: "absolute", left: "38%", top: "58%", transform: "translate(-50%,-50%)", writingMode: "vertical-rl", fontFamily: F_BODY, fontSize: 12, fontWeight: 800, letterSpacing: "2px", color: sk.accent } },
            ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][m - 1] + ".")) : null,
        h("div", { "data-ledger-cal": true, style: Object.assign({ padding: "10px 2px" }, sk.acrylic) },
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 } }, "日一二三四五六".split("").map(w => h("div", { key: w, style: { textAlign: "center", fontFamily: F_BODY, fontSize: 10.5, fontWeight: 700, color: sk.sub } }, w))),
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 } },
            cells.map((k, i) => { if (!k) return h("div", { key: "e" + i, "data-wk": "ldgcalview", "data-part": "r2" });
              const d = byDay[k], on = sel === k, lv = d && d.exp ? .12 + .88 * (d.exp / max) : 0;
              // 点亮的格子：屏幕墨色按深浅铺满，上面叠一层像素网格；深的格子字反白
              const lit = lv > 0, dark = lv > .66;
              const cap = glass ? (k === today ? "day-today" : lit ? (lv > .5 ? "day-hi" : "day-lo") : null) : null;
              return h("button", { key: k, onClick: () => setSel(k), className: "active:opacity-70", "data-ledger-daycap": cap || undefined, style: cap ? { minHeight: 46, padding: "3px 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, position: "relative",
                background: "url(" + LA + cap + ".webp" + LV + ") center / 100% 100% no-repeat", borderRadius: 10,
                outline: on && k !== today ? "1px solid " + sk.accent : "none", outlineOffset: 1 } : { minHeight: 46, borderRadius: 4, padding: "3px 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, position: "relative",
                // 花过钱的那天：一颗嵌在机身上的迷你透明键帽——很淡、很透，上沿一丝亮光，底边一点厚度；没花钱的日子完全是平的
                background: lit ? (glass ? "linear-gradient(170deg, rgba(255,255,255,.7), rgba(" + (lv > .5 ? "196,188,236" : "204,222,246") + "," + (0.25 + lv * 0.3).toFixed(2) + "))" : "rgba(60,54,40," + (lv * .4).toFixed(2) + ")") : "transparent",
                boxShadow: lit && glass ? "inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 2px rgba(118,122,178,.14), 0 2px 0 rgba(150,154,200,.32), 0 3px 5px rgba(118,122,178,.1)" : "none",
                borderRadius: 10,
                // 今天：一道细粉线；选中（不是今天）：一道冰蓝细线
                outline: k === today ? "1px solid " + (glass ? "#ec8fb3" : sk.pink) : on ? "1px solid " + (glass ? "#9fb6e6" : sk.accent) : "none", outlineOffset: 1 }, "data-wk": "ldgcalview", "data-part": "r3", "data-on": on ? "1" : "0" },
                h("span", { style: numStyle(sk, 12.5, sk.ink) }, parseInt(k.slice(8), 10)),
                d && d.exp ? h("span", { style: numStyle(sk, 7.5, sk.fog) }, fmtNum(Math.round(d.exp))) : null,
                null); })))),
      // 玻璃皮：这天的流水像夹在活页本里——左边一列她给的圆孔纵向铺；右下角盖一枚 DAILY 邮戳，印的是选中那天
      h("div", { "data-ledger-dayfile": true, style: glass ? { position: "relative", paddingLeft: 30, paddingBottom: 96, marginLeft: -8, background: "url(" + LA + "holes.webp" + LV + ") left 2px top 0 / 22px auto repeat-y" } : undefined },
      h("div", { style: { display: "flex", justifyContent: "space-between", fontFamily: F_BODY, fontSize: 12, fontWeight: 600, color: sk.sub, margin: "0 6px 8px" } }, h("span", null, dayLabel(sel)), byDay[sel] ? h("span", { style: numStyle(sk, 12, sk.sub) }, "支 " + fmtMoney(byDay[sel].exp, cur)) : null),
      selRows.length ? h(StripSlot, { sk }, selRows.map(x => h(TxnRow, { key: x.id, txn: x, cur, sk, settings, onClick: () => props.onOpenTxn(x.id) })))
        : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: sk.fog, textAlign: "center", padding: "24px 0" } }, "这天没有记账"),
      glass ? h("div", { "data-ledger-stamp": true, "aria-hidden": "true", style: { position: "absolute", right: -4, bottom: 4, width: 132, transform: "rotate(-8deg)", opacity: .78, pointerEvents: "none" } },
        h("img", { src: LA + "stamp.webp" + LV, alt: "", draggable: false, style: { display: "block", width: "100%", height: "auto" } }),
        [[sy.slice(2), "28%"], [sm, "46.5%"], [sd, "64%"]].map((t, i) => h("span", { key: i, style: { position: "absolute", left: t[1], top: "52%", transform: "translate(-50%,-50%)", fontFamily: F_BODY, fontSize: 11, fontWeight: 800, letterSpacing: ".5px", color: sk.accent } }, t[0]))) : null));
  }

  // ============================================================
  // 我的：账本样式 + 各种管理入口（一排印在外壳上的设置键）
  // ============================================================
  function MeView(props) {
    const { sk, settings, cur, code } = props;
    const vis = (settings.visibleTo || []).length;
    const row = (label, note, onClick, first) => h("button", { onClick, className: "w-full flex items-center active:opacity-70", style: { minHeight: 52, padding: "0 16px", borderTop: first ? "none" : "1px solid " + sk.line }, "data-wk": "ldgmeviewbtn", "data-part": "1" },
      h("span", { style: { flex: 1, textAlign: "left", fontFamily: F_BODY, fontSize: 14, fontWeight: 600, color: sk.ink } }, label),
      h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: sk.sub, marginRight: 6 } }, note),
      h("span", { style: { color: sk.fog } }, "›"));
    // 第四页照她给的素材做（2026-09-29）：标题、两张皮肤预览、四个设置图标、右边一列书签都是她出的图；
    //   皮肤名、选中的粉框、编号和英文小字是代码印的
    if (sk.id === "glass") {
      const LA = "assets/ledger/", LV = "?v=290";
      const PREV = { glass: "skin-glass", paper: "skin-paper" };
      const grow = (n, icon, label, en, note, onClick) => h("button", { key: n, onClick, "data-ledger-merow": n, className: "w-full flex items-center active:opacity-70",
          style: { minHeight: 62, padding: "6px 12px 6px 10px", gap: 10, marginBottom: 8, borderRadius: 18, background: "linear-gradient(160deg,rgba(255,255,255,.62),rgba(236,234,250,.42))", border: "1px solid rgba(255,255,255,.85)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9), 0 3px 10px rgba(140,130,200,.12)" }, "data-wk": "ldgmeviewbtn", "data-part": "2" },
        h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: sk.fog, width: 18, letterSpacing: ".5px" } }, (n < 10 ? "0" : "") + n),
        // 存钱目标 / 年度回顾还没有专门的图标，先借她给过的果冻柱和 DAILY 邮戳
        h("img", { src: LA + ({ goal: "col-full", year: "stamp" }[icon] || "ic-" + icon) + ".webp" + LV, alt: "", draggable: false, style: { width: 40, height: 40, flexShrink: 0, objectFit: "contain" } }),
        h("span", { style: { width: 1, alignSelf: "stretch", margin: "6px 2px", background: LINE } }),
        h("span", { style: { flex: 1, minWidth: 0, textAlign: "left" } },
          h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 14.5, fontWeight: 700, color: sk.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, label),
          h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 9.5, letterSpacing: "2px", color: sk.fog, marginTop: 2 } }, en)),
        h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: sk.sub, marginRight: 4, whiteSpace: "nowrap", flexShrink: 0 } }, note),
        h("span", { style: { color: sk.fog } }, "›"));
      return h("div", { className: "px-5 pb-8 lg-me", style: { position: "relative", overflow: "clip" }, "data-wk": "ldgmeview" },
        h("style", null, PNL_CSS),
        // 右上那张便签和 nice day 小对话泡（她 2026-09-29 给的图）
        h("img", { src: LA + "note-glad.webp" + LV, alt: "", "aria-hidden": "true", draggable: false, style: { position: "absolute", right: -4, top: -4, width: 88, height: "auto", transform: "rotate(5deg)", pointerEvents: "none" } }),
        h("img", { src: LA + "bubble-nice.webp" + LV, alt: "", "aria-hidden": "true", draggable: false, style: { position: "absolute", right: 86, top: 44, width: 58, height: "auto", transform: "rotate(-8deg)", pointerEvents: "none" } }),
        h("img", { src: LA + "title-me.webp" + LV, alt: "MY STUFF", draggable: false, style: { position: "relative", display: "block", width: "66%", height: "auto", margin: "-2px 0 10px -3%" } }),
        h("div", { className: "lg-pnl", style: { borderStyle: "solid", borderWidth: 24, borderColor: "transparent", position: "relative", isolation: "isolate", margin: "0 -6px 10px" } },
          h("img", { src: LA + "side-tabs.webp" + LV, alt: "", "aria-hidden": "true", draggable: false, style: { position: "absolute", right: -40, top: 250, width: 30, height: "auto", pointerEvents: "none", zIndex: 2 } }),
          silk(sk, "账本样式", { marginBottom: 10 }),
          h("div", { style: { display: "flex", gap: 8, marginBottom: 12 } },
            SKIN_LIST.map(x => { const on = sk.id === x.id;
              return h("button", { key: x.id, onClick: () => props.onSkin(x.id), "data-ledger-skin": x.id, className: "flex-1 text-left active:opacity-80",
                style: { position: "relative", overflow: "hidden", borderRadius: 16, padding: "0 7px 7px", minHeight: 0, background: "rgba(255,255,255,.4)", border: on ? "2px solid " + sk.pink : "1px solid rgba(255,255,255,.8)", boxShadow: on ? "0 0 0 3px color-mix(in srgb, " + sk.pink + " 18%, transparent)" : "none" }, "data-wk": "ldgmeview", "data-part": "r2", "data-on": on ? "1" : "0" },
                on ? h("span", { style: { position: "absolute", right: 6, top: 6, zIndex: 1, fontFamily: F_BODY, fontSize: 9, fontWeight: 700, color: "#fff", background: sk.pink, borderRadius: 999, padding: "1px 6px" } }, "✓ 当前使用") : null,
                h("img", { src: LA + PREV[x.id] + ".webp" + LV, alt: "", draggable: false, style: { display: "block", width: "118%", maxWidth: "none", height: "auto", margin: "2px -9% -2px" } }),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, fontWeight: 800, color: sk.ink, lineHeight: 1.3 } }, x.zh),
                h("div", { style: { fontFamily: F_BODY, fontSize: 9, color: sk.fog, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, x.sub)); })),
          grow(1, "acct", "账户", "ACCOUNTS", (settings.accounts || []).length ? (settings.accounts || []).length + " 个" : "还没加", () => props.onSettings("acct")),
          grow(2, "piggy", "每月预算", "BUDGET", (settings.budgets || {})[code] ? fmtMoney(settings.budgets[code], cur) : "没设", props.onEditBudget),
          grow(3, "lock", "谁能看到我的账", "PRIVACY", vis ? vis + " 位" : "谁都看不到", () => props.onSettings("visible")),
          grow(4, "coin", "币种", "CURRENCY", (settings.currencies || []).length + " 种", () => props.onSettings("cur")),
          grow(5, "folder", "分类", "CATEGORY", "", () => props.onSettings("cat")),
          grow(6, "recur", "周期账单", "RECURRING", (settings.recurring || []).length ? (settings.recurring || []).length + " 条" : "没设", () => props.onSettings("recur")),
          grow(7, "export", "导出账单", "EXPORT", "CSV", props.onExport),
          grow(8, "goal", "存钱目标", "SAVING", (settings.goals || []).filter(g => g.currency === code).length ? (settings.goals || []).filter(g => g.currency === code).length + " 个" : "还没有", props.onGoals),
          grow(9, "year", "年度回顾", "MY YEAR", String(new Date().getFullYear()), props.onYear)),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: sk.fog, lineHeight: 1.6, margin: "4px 4px 0" } }, h("span", { style: { fontStyle: "italic", color: sk.accent, marginRight: 6 } }, "✳ " + "NOTE"), "文字和点缀色能在 设置 → 主题工作台 里调；玻璃和贴纸是图片，不跟着变。♡"));
    }
    return h("div", { className: "px-5 pb-8", "data-wk": "ldgmeview", "data-part": "r3" },
      h(WordMark, { sk, word: "MY STUFF", hand: "a better me :)" }),
      h("div", { style: Object.assign({ padding: "12px 14px 14px", marginBottom: 16 }, sk.shell) },
        silk(sk, "账本样式", { marginBottom: 10 }),
        h("div", { style: { display: "flex", gap: 10 } },
          SKIN_LIST.map(x => { const on = sk.id === x.id, pv = ledgerSkin({ skin: x.id });
            return h("button", { key: x.id, onClick: () => props.onSkin(x.id), "data-ledger-skin": x.id, className: "flex-1 text-left active:opacity-80",
              style: Object.assign({}, pv.page, { borderRadius: 16, padding: 10, minHeight: 112, border: on ? "2px solid " + sk.pink : "1px solid " + sk.line, boxShadow: on ? "0 0 0 3px " + sk.pink + "30" : "none" }), "data-wk": "ldgmeview", "data-part": "r4", "data-on": on ? "1" : "0" },
              h("div", { style: Object.assign({ height: 26, marginBottom: 6 }, pv.shell, { borderRadius: 10 }) }),
              h("div", { style: Object.assign({ height: 16, marginBottom: 8 }, pv.screen, { borderRadius: 6 }) }),
              h("div", { style: { fontFamily: F_BODY, fontSize: 13, fontWeight: 800, color: pv.ink } }, x.zh + (on ? " ✓" : "")),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: pv.fog, marginTop: 2 } }, x.sub)); }))),
      h("div", { style: Object.assign({ overflow: "hidden" }, sk.shell) },
        row("账户", (settings.accounts || []).length ? (settings.accounts || []).length + " 个" : "还没加", () => props.onSettings("acct"), true),
        row("每月预算", (settings.budgets || {})[code] ? fmtMoney(settings.budgets[code], cur) : "没设", props.onEditBudget),
        row("谁能看到我的账", vis ? vis + " 位" : "谁都看不到", () => props.onSettings("visible")),
        row("币种", (settings.currencies || []).length + " 种", () => props.onSettings("cur")),
        row("分类", "", () => props.onSettings("cat")),
        row("周期账单", (settings.recurring || []).length ? (settings.recurring || []).length + " 条" : "没设", () => props.onSettings("recur")),
        row("导出账单", "CSV", props.onExport),
        row("存钱目标", (settings.goals || []).filter(g => g.currency === code).length + " 个", props.onGoals),
        row("年度回顾", String(new Date().getFullYear()), props.onYear)),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: sk.fog, lineHeight: 1.6, margin: "10px 4px 0" } }, "颜色还能在 设置 → 主题工作台 里单独调。"));
  }

  // 单条信息条：像一张插进钱包凹槽里的小票条——左边一排打孔，彩色塑料小方块，右边金额最清楚
  function TxnRow(props) {
    const { txn, cur, sk, settings } = props;
    const isInc = txn.type === "income", xfer = isTransfer(txn);
    const tm = txn.ts ? new Date(txn.ts) : null;
    const head = dayLabel(txn.date).split(" ")[0];
    const when = head === "今天" || head === "昨天" ? head + (tm ? " " + pad(tm.getHours()) + ":" + pad(tm.getMinutes()) : "") : fmtDay(txn.date);
    const glass = sk.id === "glass";
    return h("button", { onClick: props.onClick, className: "w-full active:opacity-80 text-left", "data-ledger-strip": true,
      style: Object.assign({ padding: "10px 12px", display: "flex", alignItems: "center", gap: 11, minHeight: 58 }, sk.card, { borderRadius: sk.id === "glass" ? 0 : 16 }), "data-wk": "ldgtxnrow" },
      xfer ? h("div", { "aria-hidden": "true", style: { width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: sk.sub, background: "rgba(200,196,236,.35)", border: "1px solid rgba(255,255,255,.7)" } }, "⇄")
        : h(CatTile, { tint: catTint(settings, isInc ? "income" : "expense", txn.category), emoji: txn.catEmoji, name: txn.category, icon: txn.catIcon || catIconOf(settings, isInc ? "income" : "expense", txn.category), size: 38, sk }),
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 500, color: sk.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, xfer ? (txn.note || acctName(settings, txn.from) + " → " + acctName(settings, txn.to)) : (txn.note || txn.category)),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: sk.fog, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
          when + ((txn.comments || []).length ? " · " + txn.comments.length + " 条批注" : ""))),
      h("div", { style: { textAlign: "right", flexShrink: 0 } },
        h("div", { style: numStyle(sk, 15.5, xfer ? sk.sub : isInc ? sk.inc : sk.exp) }, (xfer ? "" : isInc ? "+ " : "- ") + fmtMoney(xfer ? txn.amount : netAmt(txn), cur)),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: sk.fog, marginTop: 2 } }, xfer ? "转账" : (refundSum(txn) ? "已退 " + fmtMoney(refundSum(txn), cur) + " · " : "") + txn.category + (txn.account ? " · " + acctName(settings, txn.account) : ""))),
      h("span", { style: { color: sk.fog, fontSize: 16, marginLeft: -2 } }, "›"));
  }

  // ============================================================
  // 单笔详情：机器吐出来的一张小票 + 编辑/删除 + 角色批注（多选一次生成）
  // ============================================================
  function TxnView(props) {
    const { txn, cur, sk } = props;
    const [pick, setPick] = useState(false);
    const [share, setShare] = useState(false);
    const [confirmDel, setConfirmDel] = useState(false);
    const isInc = txn.type === "income", xfer = isTransfer(txn);
    const comments = txn.comments || [];
    const charById = id => (props.characters || []).find(c => c.id === id);
    const tm = txn.ts ? new Date(txn.ts) : null;
    const line = (k, v, big) => h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "3px 0", fontFamily: F_BODY, fontSize: 12.5, color: "#5c5a66" } }, h("span", null, k), h("span", { style: { fontFamily: DIGIT, fontWeight: 700, fontSize: big ? 18 : 12.5, color: "#2d2c36" } }, v));
    return h("div", { className: "h-full flex flex-col", style: Object.assign({}, sk.page), "data-wk": "ldgtxnview" },
      h(Head, { zh: xfer ? "这笔转账" : isInc ? "这笔进账" : "这笔账", onBack: props.onBack, ink: sk.ink, bg: "transparent", noLine: true,
        right: h("div", { className: "flex items-center" },
          h("button", { onClick: props.onEdit, "aria-label": "改这一笔", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40 }, "data-wk": "ldgtxnviewbtn", "data-part": "改这一笔" }, h(IPencil, { size: 17, color: sk.ink })),
          h("button", { onClick: () => setConfirmDel(true), "aria-label": "删掉这一笔", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40 }, "data-wk": "ldgtxnviewbtn", "data-part": "删掉这一笔" }, h(ITrash, { size: 18, color: sk.sub }))) }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-8", style: { overscrollBehavior: "contain" } },
        h(Receipt, { sk, title: sk.id === "glass" ? "QIUQIU MART" : (isInc ? "进账小票" : "小票"), sub: sk.id === "glass" ? "GOOD LIFE EVERYDAY" : "生活也值得被记录", no: txn.id,
          foot: h(Fragment, null, h(Barcode, { seed: txn.id }), h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 11, color: "#8f8c98", letterSpacing: ".14em" } }, "记账让生活更清晰", sk.id === "glass" ? h("div", { style: { fontSize: 12, marginTop: 2 } }, "THANK YOU!") : null)) },
          line(txn.note || txn.category, (isInc ? "+" : "") + fmtMoney(txn.amount, cur), true),
          xfer ? line("从", acctName(props.settings, txn.from)) : line("分类", txn.category),
          xfer ? line("到", acctName(props.settings, txn.to)) : txn.account ? line("账户", acctName(props.settings, txn.account)) : null,
          line("时间", txn.date + (tm && txn.date === (tm.getFullYear() + "-" + pad(tm.getMonth() + 1) + "-" + pad(tm.getDate())) ? " " + pad(tm.getHours()) + ":" + pad(tm.getMinutes()) : "")),
          line("币种", cur.label + " " + cur.code),
          (txn.refunds || []).map((r, i) => line("退回 · " + fmtDay(r.date) + (r.note ? " " + r.note : ""), "−" + fmtMoney(r.amount, cur))),
          (txn.refunds || []).length ? line("实际花了", fmtMoney(netAmt(txn), cur), true) : null),
        props.onForwardToChat && (props.characters || []).length ? h("button", { "data-ledger-share": true, onClick: () => setShare(true), className: "lg-key lg-share-key w-full active:opacity-80",
          style: jellyKey(sk, "lilac", false, { minHeight: 44, marginBottom: 16, fontFamily: F_BODY, fontSize: 13, fontWeight: 700 }), "data-wk": "ldgtxnviewbtn", "data-part": "3" }, "拿这笔账给 TA 看") : null,
        // 退款 / AA 回款：挂在这一笔上，这笔按净额算（她 2026-09-29）
        !xfer && !isInc ? h("div", { style: { display: "flex", gap: 8, marginBottom: 16 } },
          h("button", { onClick: () => requestAppPrompt("退回多少", "退款或者别人 AA 还你的钱。会从这笔里扣掉，不算收入。最多还能退 " + fmtMoney(netAmt(txn), cur) + "。", "", v => {
              const n = Math.round((parseFloat(String(v).replace(/[^\d.]/g, "")) || 0) * 100) / 100;
              if (n > 0) props.onRefund && props.onRefund(Math.min(n, netAmt(txn)), "");
            }, "好", { placeholder: "比如 12.5" }), "data-ledger-refund": true, className: "active:opacity-80",
            style: { flex: 1, minHeight: 40, borderRadius: 999, fontFamily: F_BODY, fontSize: 12.5, fontWeight: 700, color: sk.ink, background: "rgba(255,255,255,.55)", border: "1px solid rgba(160,150,220,.35)" }, "data-wk": "ldgtxnviewbtn", "data-part": "比如 12.5" }, "＋ 退款 / AA 回款"),
          (txn.refunds || []).length ? h("button", { onClick: () => props.onRefund && props.onRefund(null), className: "active:opacity-80",
            style: { minHeight: 40, padding: "0 14px", borderRadius: 999, fontFamily: F_BODY, fontSize: 12, color: sk.sub, background: "transparent", border: "1px solid rgba(160,150,220,.3)" }, "data-wk": "ldgtxnviewbtn", "data-part": "5" }, "撤掉最后一笔退款") : null) : null,
        xfer ? null : h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 } },
          silk(sk, "角色批注" + (comments.length ? " · " + comments.length : "")),
          (props.characters && props.characters.length)
            ? h("button", { onClick: () => setPick(true), className: "active:opacity-80", style: { minHeight: 36, padding: "0 16px", borderRadius: 999, fontFamily: F_BODY, fontSize: 12.5, fontWeight: 700, color: sk.ink, background: sk.id === "glass" ? "linear-gradient(180deg, #ffe6ef, #ffcfe0)" : sk.accent, boxShadow: "inset 0 1px 0 #fff" }, "data-wk": "ldgtxnviewbtn", "data-part": "6" },
                comments.length ? "再让 TA 们说说" : "让角色批注")
            : null),
        xfer ? null : comments.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
          comments.map((cm, i) => {
            const ch = charById(cm.charId);
            return h("div", { key: i, style: { display: "flex", gap: 10 }, "data-wk": "ldgtxnview", "data-part": "r2" },
              ch ? h(Avatar, { character: ch, size: 34, radius: 10 })
                 : h("div", { style: { width: 34, height: 34, borderRadius: 10, background: sk.line, flexShrink: 0 } }),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: sk.sub, marginBottom: 3, display: "flex", alignItems: "center", gap: 6 } }, cm.charName,
                  cm.auto ? h("span", { style: { fontSize: 9.5, color: GOLD, border: "1px solid " + GOLD + "55", borderRadius: 999, padding: "1px 7px" } },
                    cm.event === "big" ? "自己注意到 · 大额" : cm.event === "freq" ? "自己注意到 · 频率" : cm.event === "night" ? "自己注意到 · 深夜" : cm.event === "income" ? "自己注意到 · 进账" : "自己注意到") : null),
                h("div", { style: Object.assign({ padding: "9px 12px", fontFamily: F_BODY, fontSize: 13, color: sk.ink, lineHeight: 1.55 }, sk.card, { borderRadius: 14, borderTopLeftRadius: 4 }) }, cm.text)));
          }))
          : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: sk.fog, textAlign: "center", padding: "20px 0" } },
              (props.characters && props.characters.length) ? "还没人看过这笔账，点上面让 TA 们说说" : "先去『人格档案馆』建个角色")),
      share ? h(LedgerSharePicker, { sk, characters: props.characters, onClose: () => setShare(false), onShare: c => {
        if (props.onForwardToChat(txn.id, c.id) !== false) setShare(false);
      } }) : null,
      pick ? h(CommentPicker, {
        characters: props.characters, moods: props.moods, affinities: props.affinities, existing: comments.map(c => c.charId),
        txn, cur, active: props.active, worldbook: props.worldbook, worldbookFor: props.worldbookFor, uName: props.uName, toast: props.toast,
        onClose: () => setPick(false),
        onDone: cmts => { props.onAddComments(cmts); setPick(false); }
      }) : null,
      confirmDel ? h(ConfirmDialog, { title: "删掉这笔账？", body: "删掉后连同角色批注一起没了。", confirmLabel: "删掉", danger: true, onConfirm: props.onDelete, onCancel: () => setConfirmDel(false) }) : null);
  }

  function LedgerSharePicker({ sk, characters, onClose, onShare }) {
    return h("div", { "data-ledger-sharepicker": true, className: "h-full flex flex-col", style: Object.assign({}, sk.page, { position: "absolute", inset: 0, zIndex: 50 }), "data-wk": "ldgledgersharepicker" },
      h(Head, { zh: "拿给谁看", onBack: onClose, ink: sk.ink, bg: "transparent", noLine: true }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-8", style: { overscrollBehavior: "contain" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: sk.sub, lineHeight: 1.6, marginBottom: 16 } }, "只分享这一笔和你写的备注。选好后去聊天，可以接着说你想聊的话。"),
        (characters || []).map(c => h("button", { key: c.id, onClick: () => onShare(c), "data-ledger-recipient": c.id, className: "w-full text-left lg-key lg-share-key flex items-center gap-3",
          style: jellyKey(sk, "clear", false, { minHeight: 56, padding: "8px 12px", marginBottom: 10 }), "data-wk": "ldgledgersharepickerbtn", "data-part": "1" },
          h(Avatar, { character: c, size: 36, radius: 10 }), h("span", { style: { fontFamily: F_BODY, fontSize: 14, color: sk.ink } }, c.remark || c.name)))));
  }

  // ============================================================
  // 批注角色多选 → 一次生成（含全选）
  // ============================================================
  function CommentPicker(props) {
    const t = useTheme();
    const [sel, setSel] = useState([]);
    const [busy, setBusy] = useState(false);
    const lift = useKbLift();
    const chars = props.characters || [];
    const moodOf = id => { const mo = props.moods && props.moods[id]; return mo && mo.label ? String(mo.label) : ""; };
    const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : s.concat([id]));
    const allOn = sel.length === chars.length && chars.length > 0;
    const toggleAll = () => setSel(allOn ? [] : chars.map(c => c.id));

    const run = async () => {
      if (!sel.length || busy) return;
      setBusy(true);
      try {
        const list = sel.map(id => { const c = chars.find(x => x.id === id); return { id, name: c.name, gender: c.gender, persona: c.persona || "", mood: moodOf(id), aff: props.affinities ? props.affinities[id] : null }; });
        const lore = props.worldbookFor ? props.worldbookFor(sel, [props.txn && props.txn.note, props.txn && props.txn.category].filter(Boolean).join("\n")) : props.worldbook;
        const outs = await genComments(props.active, props.txn, props.cur, list, props.uName, lore);
        const cmts = list.map((it, i) => ({ charId: it.id, charName: it.name, text: outs[i].text, ts: Date.now() })).filter(c => c.text);
        if (!cmts.length) { props.toast && props.toast("这次没生成出来，再试一次"); setBusy(false); return; }
        if (cmts.length < list.length) props.toast && props.toast("有 " + (list.length - cmts.length) + " 位没接上话，可再点一次补上");
        props.onDone(cmts);
      } catch (e) { props.toast && props.toast("生成失败，重试一下"); setBusy(false); }
    };

    return h("div", { style: { position: "absolute", inset: 0, zIndex: 50, background: pageColor("ledger", "bg2", "rgba(20,18,15,0.4)"), display: "flex", flexDirection: "column", justifyContent: "flex-end" }, onClick: props.onClose, "data-wk": "ldgcommentpicker" },
      h("div", { onClick: e => e.stopPropagation(), style: { background: t.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "20px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)", maxHeight: "78%", display: "flex", flexDirection: "column", marginBottom: lift || 0, transition: "margin-bottom .18s ease" }, "data-wk": "ldgcommentpickertap", "data-part": "1" },
        h("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 4 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: t.ink } }, "让谁看看这笔账"),
          (!busy && chars.length > 1) ? h("button", { onClick: toggleAll, className: "active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: 12, color: allOn ? t.sub : pageColor("ledger", "accent", ACCENT), background: "transparent", border: "none", flexShrink: 0, paddingTop: 3 }, "data-wk": "ldgcommentpickerbtn", "data-part": "1" }, allOn ? "取消全选" : "全选") : null),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 16, lineHeight: 1.5 } }, "可多选，一次生成全部——省一次 API。TA 们会按各自人设和此刻心情说一句。"),
        busy
          ? h("div", { style: { padding: "40px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "TA 们正在看你的账本…")
          : h(Fragment, null,
              h("div", { style: { flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 } },
                chars.map(c => {
                  const on = sel.includes(c.id); const md = moodOf(c.id);
                  return h("button", { key: c.id, onClick: () => toggle(c.id), className: "active:opacity-80 text-left",
                    style: { display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 12, background: on ? pageColor("ledger", "accent", ACCENT) : t.bg2, border: "1px solid " + (on ? pageColor("ledger", "accent", ACCENT) : t.line) }, "data-wk": "ldgcommentpicker", "data-part": "r2", "data-on": on ? "1" : "0" },
                    h(Avatar, { character: c, size: 32, radius: 9 }),
                    h("div", { style: { minWidth: 0, flex: 1 } },
                      h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: on ? "#fff" : t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.name),
                      md ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: on ? "rgba(255,255,255,0.75)" : t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, md) : null));
                })),
              h("button", { onClick: run, disabled: !sel.length, className: "w-full active:opacity-85",
                style: { background: sel.length ? pageColor("ledger", "accent", ACCENT) : t.line, color: "#fff", border: "none", borderRadius: 999, padding: "14px 0", fontFamily: F_BODY, fontSize: 14.5, fontWeight: 600 }, "data-wk": "ldgcommentpickerbtn", "data-part": "2" },
                sel.length ? "生成批注（" + sel.length + " 人）" : "选一个或几个角色"))));
  }

  // ============================================================
  // 记一笔（新增 / 编辑）：上面分类糖块，中间金额和备注，底下一块数字键盘
  // ⚠️金额不走系统键盘：自己的键盘一直摆着，点分类、按数字、按完成，三下记完
  // ============================================================
  function AddSheet(props) {
    const { curs, edit, sk } = props;
    const [type, setType] = useState(edit ? edit.type : (props.initType === "income" || props.initType === "transfer" ? props.initType : "expense"));
    const [amount, setAmount] = useState(edit ? String(edit.amount) : "");
    const [code, setCode] = useState(edit ? edit.currency : (props.initCode || (curs[0] ? curs[0].code : "CAD")));
    const [cat, setCat] = useState(edit ? { name: edit.category, emoji: edit.catEmoji || "", icon: edit.catIcon || catIconOf(props.settings, edit.type, edit.category) } : null);
    const [date, setDate] = useState(edit ? edit.date : todayStr());
    const [note, setNote] = useState(edit ? (edit.note || "") : "");
    const [dialog, setDialog] = useState(null); // {kind:'cur'|'cat'}
    // 账户：只列这个币种的；默认上次在这个币种用的那个（settings.lastAcct）
    const allAccts = props.settings.accounts || [];
    const accts = allAccts.filter(a => a.currency === code);
    const [acct, setAcct] = useState(edit ? (edit.account || "") : ((props.settings.lastAcct || {})[code] || ""));
    const [from, setFrom] = useState(edit && edit.from || "");
    const [to, setTo] = useState(edit && edit.to || "");
    const acctOk = !acct || accts.some(a => a.id === acct);
    useEffect(() => { if (!acctOk) setAcct(""); if (from && !accts.some(a => a.id === from)) setFrom(""); if (to && !accts.some(a => a.id === to)) setTo(""); }, [code]);

    const catList = type === "transfer" ? [] : (props.settings.cats[type] || []);
    const cur = curs.find(c => c.code === code) || curs[0];

    const submitCat = vals => { const nc = { name: (vals.name || "").trim(), emoji: "", icon: vals.icon || "" }; if (!nc.name) return; props.onAddCat(type, nc); setCat(nc); setDialog(null); };
    const submitCur = vals => {
      const codeIn = (vals.code || "").trim().toUpperCase(); const label = (vals.label || "").trim();
      if (!codeIn || !label) return;
      if (curs.some(c => c.code === codeIn)) { setCode(codeIn); setDialog(null); return; }
      const nc = { code: codeIn, symbol: (vals.symbol || "").trim() || codeIn, label: label };
      props.onAddCurrency(nc); setCode(nc.code); setDialog(null);
    };
    // 键盘：最多两位小数、整数部分最多 9 位；开头的 0 被下一个数字顶掉
    const press = k => setAmount(a => {
      if (k === "del") return a.slice(0, -1);
      if (k === ".") return a.indexOf(".") >= 0 ? a : (a || "0") + ".";
      const [i, d] = a.split(".");
      if (d != null) return d.length >= 2 ? a : a + k;
      if (i.length >= 9) return a;
      return a === "0" ? k : a + k;
    });

    const isXfer = type === "transfer";
    const canSave = amount && Number(amount) > 0 && (isXfer ? (from && to && from !== to) : cat);
    const save = () => {
      if (!canSave) return;
      if (isXfer) {
        const base = { date, type, amount: Math.round(Number(amount) * 100) / 100, currency: code, from, to, account: "", category: "转账", catEmoji: "", catIcon: "", note: note.trim() };
        props.onSave(edit ? base : Object.assign({ id: "l" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), ts: Date.now(), comments: [] }, base));
        return;
      }
      const account = acctOk ? acct : "";
      if (edit) {
        props.onSave({ date, type, amount: Math.round(Number(amount) * 100) / 100, currency: code, account, from: "", to: "", category: cat.name, catEmoji: cat.emoji || "", catIcon: cat.icon || "", note: note.trim() });
      } else {
        props.onSave({ id: "l" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), ts: Date.now(), date, type, amount: Math.round(Number(amount) * 100) / 100, currency: code, account, category: cat.name, catEmoji: cat.emoji || "", catIcon: cat.icon || "", note: note.trim(), comments: [] });
      }
    };
    const glass = sk.id === "glass";
    const key = (k, label) => h("button", { key: k, onClick: () => press(k), "aria-label": k === "del" ? "退格" : label, className: "lg-key lg-number-key lg-gloss lg-gloss-soft",
      style: jellyKey(sk, "clear", false, { minHeight: 44, fontFamily: sk.digit, fontSize: 19, fontWeight: 700, borderRadius: 13 }), "data-wk": "ldgaddsheetbtn", "data-part": "1" }, label);
    const chip = (content, onClick, extra) => h("button", { onClick, className: "lg-key flex items-center gap-1", style: jellyKey(sk, "clear", false, Object.assign({ minHeight: 34, padding: "0 12px", fontFamily: F_BODY, fontSize: 12.5, fontWeight: 600, color: sk.sub, borderRadius: 999 }, extra || {})), "data-wk": "ldgaddsheetbtn", "data-part": "2" }, content);

    // 整页，不用半窗（施工规则/no-half-sheet.md）
    return h("div", { style: { position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column" }, "data-wk": "ldgaddsheetsave" },
      h("div", { className: "h-full flex flex-col", style: Object.assign({}, sk.page) },
        h(Head, { zh: edit ? "改这一笔" : "记一笔", onBack: props.onClose, ink: sk.ink, bg: "transparent", noLine: true,
          right: h("button", { onClick: save, disabled: !canSave, className: "lg-key" + (glass ? " lg-gloss" : ""), style: jellyKey(sk, canSave ? "lilac" : "clear", !canSave, { minWidth: 56, height: 34, borderRadius: 999, fontFamily: F_BODY, fontSize: 12.5, fontWeight: 800, color: canSave ? sk.ink : sk.fog }), "data-wk": "ldgaddsheetbtn", "data-part": "3" }, "完成") }),
        h("div", { style: { padding: "0 20px 10px" } }, h(CandySeg, { items: [["expense", "支出"], ["income", "收入"], ["transfer", "转账"]], value: type, onChange: v => { setType(v); setCat(null); }, sk })),
        h("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "4px 20px 10px" } },
          isXfer ? h("div", { "data-ledger-xfer": true },
            accts.length < 2 ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: sk.sub, lineHeight: 1.7, padding: "18px 4px" } },
                "转账要在同一个币种下至少有两个账户。去「我的 → 账户」加上，比如一张储蓄卡、一张信用卡——还信用卡就是从储蓄卡转给信用卡。")
              : [["从", from, setFrom], ["到", to, setTo]].map(([lab, val, setv]) => h("div", { key: lab, style: { marginBottom: 14 } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: sk.sub, marginBottom: 6 } }, lab + "哪个账户"),
                h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } }, accts.map(a => { const on = val === a.id, ty = acctType(a.type);
                  return h("button", { key: a.id, onClick: () => setv(a.id), "aria-pressed": on, className: "active:opacity-70 flex items-center gap-2",
                    style: { minHeight: 40, padding: "0 12px", borderRadius: 12, fontFamily: F_BODY, fontSize: 13, fontWeight: on ? 700 : 500, color: on ? sk.ink : sk.sub,
                      background: on ? ty.tint + "40" : "rgba(255,255,255,.4)", border: "1.5px solid " + (on ? ty.tint : "rgba(160,160,200,.25)") }, "data-wk": "ldgaddsheet", "data-on": on ? "1" : "0" },
                    h("span", { style: { width: 16, height: 11, borderRadius: 3, background: ty.tint } }), a.name); }))))) :
          h("div", { "data-ledger-catgrid": true, className: "lg-add-grid", style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 } },
            catList.map(c => { const on = cat && cat.name === c.name;
              return h("button", { key: c.name, onClick: () => setCat(c), "aria-pressed": !!on, className: "lg-add-category active:opacity-70 flex flex-col items-center", style: { gap: 5, padding: "4px 0" }, "data-wk": "ldgaddsheet", "data-part": "r2" },
                h(CatTile, { tint: catTint(props.settings, type, c.name), emoji: c.emoji, name: c.name, icon: c.icon, size: 50, on, sk }),
                h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, fontWeight: on ? 600 : 400, color: on ? sk.ink : sk.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" } }, c.name)); }),
            h("button", { onClick: () => setDialog({ kind: "cat" }), className: "lg-add-custom active:opacity-70 flex flex-col items-center", style: { gap: 5, padding: "4px 0" }, "data-wk": "ldgaddsheetbtn", "data-part": "4" },
              h("div", { style: Object.assign({ width: 50, height: 50, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: sk.fog }, sk.well) }, "＋"),
              h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: sk.fog } }, "自定义")))),
        // 底下这一整块是机器的操作台：一块金额屏 + 备注条 + 一排小胶囊键 + 数字键盘
        h("div", { className: "shrink-0 lg-console", style: Object.assign({ padding: "12px 14px calc(env(safe-area-inset-bottom) * 0.4 + 8px)" }, glass ? Object.assign({}, sk.shell, { borderRadius: "24px 24px 0 0", borderBottom: "none" }) : { borderTop: "1px solid " + sk.line }) },
          h("div", { "data-ledger-amount": true, style: Object.assign({ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px 6px 14px", marginBottom: 8 }, glass ? Object.assign({}, FLAT, { borderBottom: "1px solid " + LINE, padding: "4px 4px 6px" }) : sk.screen) },
            h("span", { style: lcdNum(sk, 20, "rgba(43,52,82,.6)") }, cur ? cur.symbol : ""),
            h("span", { style: Object.assign({ flex: 1 }, lcdNum(sk, 30, amount ? sk.lcd : "rgba(43,52,82,.3)")) }, amount || "0.00"),
            amount ? h("button", { onClick: () => setAmount(""), "aria-label": "清空金额", className: "active:opacity-60", style: { width: 40, height: 40, color: "rgba(43,52,82,.5)", fontSize: 18 }, "data-wk": "ldgaddsheetbtn", "data-part": "清空金额" }, "⊗") : null),
          h("input", { value: note, onChange: e => setNote(e.target.value), placeholder: "备注：这一笔是什么（可留空）", maxLength: 60,
            style: Object.assign({ width: "100%", minHeight: 40, padding: "0 14px", fontFamily: F_BODY, fontSize: 13, color: sk.ink, outline: "none", marginBottom: 8 }, (glass ? Object.assign({}, FLAT, { borderBottom: "1px solid " + LINE }) : sk.well), { borderRadius: 12 }), "data-wk": "ldgaddsheetinput", "data-part": "备注：这一笔是什么（可留" }),
          h("div", { className: "lg-entry-options", style: { display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" } },
            // 日期：一颗小胶囊，底下压着一个透明的原生日期框，点了照样弹系统日期
            h("label", { className: "lg-key flex items-center", style: jellyKey(sk, "clear", false, { position: "relative", minHeight: 34, padding: "0 12px", fontFamily: F_BODY, fontSize: 12.5, fontWeight: 600, color: sk.sub, borderRadius: 999 }) },
              date === todayStr() ? "今天" : fmtDay(date),
              h("input", { type: "date", value: date, onChange: e => e.target.value && setDate(e.target.value), "aria-label": "日期", style: { position: "absolute", inset: 0, opacity: 0, width: "100%" }, "data-wk": "ldgaddsheetinput", "data-part": "日期" })),
            curs.length > 1 ? chip(cur.label, () => { const i = curs.findIndex(c => c.code === code); setCode(curs[(i + 1) % curs.length].code); }) : null,
            !isXfer && accts.length ? chip(h(Fragment, null, h("span", { style: { width: 14, height: 10, borderRadius: 3, background: acct && acctOk ? acctType((accts.find(a => a.id === acct) || {}).type).tint : "rgba(160,160,200,.35)" } }),
                acct && acctOk ? (accts.find(a => a.id === acct) || {}).name : "不记账户"),
              () => { const ids = [""].concat(accts.map(a => a.id)); setAcct(ids[(ids.indexOf(acctOk ? acct : "") + 1) % ids.length]); }, { color: acct && acctOk ? sk.ink : sk.fog }) : null,
            chip("＋币种", () => setDialog({ kind: "cur" }), { color: sk.fog }),
            cat && !isXfer ? chip(h(Fragment, null, h(CategoryGlyph, { name: cat.name, emoji: cat.emoji, icon: cat.icon, size: 18 }), cat.name), null, { color: sk.ink, fontWeight: 700 }) : null),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.1fr", gap: 7 } },
            h("div", { style: { gridColumn: "1 / 4", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 } },
              ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"].map(k => key(k, k)), key("del", "⌫")),
            h("button", { onClick: save, disabled: !canSave, "data-ledger-done": true, className: "lg-key" + (glass ? " lg-gloss" : ""), style: jellyKey(sk, canSave ? "pink" : "clear", false, { borderRadius: 16, fontFamily: F_BODY, fontSize: 16, fontWeight: 800, color: canSave ? "#9c2256" : sk.fog, opacity: canSave ? 1 : .7 }), "data-wk": "ldgaddsheetbtn", "data-part": "6" }, edit ? "保存" : "完成")))),
      dialog && dialog.kind === "cat" ? h(FieldDialog, { glass: (typeof sk !== "undefined" && sk && sk.id === "glass") || !!(props.sk && props.sk.id === "glass"), title: "新分类", submitLabel: "添加",
        fields: [{ key: "name", label: "名称", placeholder: "如 咖啡", required: true }, { key: "icon", label: "图标", type: "icon" }],
        onSubmit: submitCat, onCancel: () => setDialog(null) }) : null,
      dialog && dialog.kind === "cur" ? h(FieldDialog, { glass: (typeof sk !== "undefined" && sk && sk.id === "glass") || !!(props.sk && props.sk.id === "glass"), title: "新币种", submitLabel: "添加",
        fields: [{ key: "label", label: "名称", placeholder: "如 日元", required: true }, { key: "code", label: "三字母代码", placeholder: "JPY", maxLength: 4, required: true }, { key: "symbol", label: "符号（可留空）", placeholder: "¥", maxLength: 3 }],
        onSubmit: submitCur, onCancel: () => setDialog(null) }) : null);
  }

  // ============================================================
  // 设置：可见性 + 管理币种(增删改) + 管理分类(增删改)
  // ============================================================
  // 玻璃皮下设置这几页的字：紫色调，不用主题的黑（她 2026-09-29「字体颜色不要黑色要紫色一点」）
  const glassInk = (t, sk) => sk && sk.id === "glass" ? Object.assign({}, t, { ink: "#4d4590", sub: "#7a71b4", fog: "#a29bcb", line: "rgba(160,150,220,.32)" }) : t;
  function SettingsSheet(props) {
    const t = glassInk(useTheme(), props.sk);
    const s = props.settings;
    const [sel, setSel] = useState((s.visibleTo || []).slice());
    const [tab, setTab] = useState(props.initTab || "visible"); // visible | acct | cur | cat
    const [acctEdit, setAcctEdit] = useState(null); // null | {} 新的 | 账户对象
    const [recurEdit, setRecurEdit] = useState(null); // null | {} 新的 | 规则对象
    const [catType, setCatType] = useState("expense");
    const [dialog, setDialog] = useState(null); // {kind, ...}
    const [confirm, setConfirm] = useState(null); // {title,body,onConfirm}
    const chars = props.characters || [];
    const curs = s.currencies || [];
    const cats = (s.cats && s.cats[catType]) || [];

    const toggle = id => setSel(x => x.includes(id) ? x.filter(y => y !== id) : x.concat([id]));
    const saveVisible = () => { props.onPersist(d => { d.settings.visibleTo = sel; }); props.onClose(); };

    // 币种：改（label/symbol，code 锁定）、删（有账则拦）
    const editCur = c => setDialog({ kind: "editcur", code: c.code, label: c.label, symbol: c.symbol });
    const submitEditCur = vals => { props.onPersist(d => { d.settings.currencies = d.settings.currencies.map(c => c.code === dialog.code ? { ...c, label: (vals.label || "").trim() || c.label, symbol: (vals.symbol || "").trim() || c.symbol } : c); }); setDialog(null); };
    const delCur = c => {
      const used = (props.txns || []).some(x => x.currency === c.code);
      if (used) { props.toast && props.toast("这个币种下还有账，删不了"); return; }
      if (curs.length <= 1) { props.toast && props.toast("至少留一个币种"); return; }
      setConfirm({ title: "删掉「" + c.label + "」？", body: "这个币种没有任何账，可安全删除。", onConfirm: () => { props.onPersist(d => { d.settings.currencies = d.settings.currencies.filter(x => x.code !== c.code); }); setConfirm(null); } });
    };
    const addCur = () => setDialog({ kind: "addcur" });
    const submitAddCur = vals => { const code = (vals.code || "").trim().toUpperCase(), label = (vals.label || "").trim(); if (!code || !label) return; if (curs.some(c => c.code === code)) { setDialog(null); return; } props.onPersist(d => { d.settings.currencies = d.settings.currencies.concat([{ code, label, symbol: (vals.symbol || "").trim() || code }]); }); setDialog(null); };

    // 分类：改（name/emoji，并同步已有 txn 的分类名/emoji）、删
    const editCat = c => setDialog({ kind: "editcat", old: c.name, name: c.name, emoji: c.emoji, icon: c.icon || "" });
    const submitEditCat = vals => {
      // 表单里已经没有 emoji 那一栏了：旧分类原来的 emoji 原样带着（只当画好的图认不出时的线索），图标换成挑的那一个
      const name = (vals.name || "").trim(), emoji = dialog.emoji || "", icon = vals.icon || ""; if (!name) return;
      props.onPersist(d => {
        d.settings.cats[catType] = d.settings.cats[catType].map(c => c.name === dialog.old ? { name, emoji, icon } : c);
        d.txns = d.txns.map(x => (x.type === catType && x.category === dialog.old) ? { ...x, category: name, catEmoji: emoji, catIcon: icon } : x);
      });
      setDialog(null);
    };
    const delCat = c => {
      if (cats.length <= 1) { props.toast && props.toast("至少留一个分类"); return; }
      const used = (props.txns || []).some(x => x.type === catType && x.category === c.name);
      setConfirm({ title: "删掉分类「" + c.name + "」？", body: used ? "已经记过的账会保留原样，只是以后记账不再有这个分类。" : "以后记账不再出现这个分类。", onConfirm: () => { props.onPersist(d => { d.settings.cats[catType] = d.settings.cats[catType].filter(x => x.name !== c.name); }); setConfirm(null); } });
    };
    const addCat = () => setDialog({ kind: "addcat" });
    const submitAddCat = vals => { const name = (vals.name || "").trim(); if (!name) return; if (cats.some(c => c.name === name)) { setDialog(null); return; } props.onPersist(d => { d.settings.cats[catType] = d.settings.cats[catType].concat([{ name, icon: vals.icon || "", emoji: (vals.emoji || "").trim() }]); }); setDialog(null); };

    const tabBtn = (k, label) => bookTab(tab === k, label, () => setTab(k), pageColor("ledger", "accent", ACCENT));

    // 玻璃皮（她 2026-09-29 给的样张）：tab 换成那条透明滑轨，名单装进统计页那块玻璃框，勾选圈、便签、手写字、长尾夹都是她出的图
    const g = !!(props.sk && props.sk.id === "glass");
    const LA = "assets/ledger/", LV = "?v=290";
    const decoImg = (n, st) => h("img", { src: LA + n + ".webp" + LV, alt: "", "aria-hidden": "true", draggable: false, style: Object.assign({ position: "absolute", height: "auto", pointerEvents: "none" }, st) });
    const rowStyle = g ? { display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 14, background: "linear-gradient(160deg,rgba(255,255,255,.62),rgba(236,234,250,.42))", border: "1px solid rgba(255,255,255,.85)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9), 0 3px 10px rgba(140,130,200,.1)" }
      : { display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 12, background: t.bg2, border: "1px solid " + t.line };
    const iconBtn = (Icon, onClick, color) => h("button", { onClick, className: "active:opacity-50", style: { background: "transparent", border: "none", padding: 4 }, "data-wk": "ldgsettingssheetbtn", "data-part": "1" }, h(Icon, { size: 16, color: color || t.fog }));

    // 整页，不用半窗：三个 tab、一屋子币种和分类，半窗里一次只看得见三四行
    return h("div", { style: { position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column" }, "data-wk": "ldgsettingssheet" },
      h("div", { className: "h-full flex flex-col", style: Object.assign({ position: "relative", overflow: "hidden" }, props.sk ? props.sk.page : paperBg()) },
        g ? h("style", null, PNL_CSS) : null,
        g ? decoImg("note-better", { right: -8, top: -6, width: 74, transform: "rotate(7deg)", zIndex: 0 }) : null,
        h(Head, { zh: g ? "" : "记账设置", onBack: props.onClose, ink: props.sk ? props.sk.ink : pageColor("ledger", "ink", "#33322c"), bg: "transparent", noLine: true,
          right: null }),
        g ? h("div", { style: { position: "relative", padding: "2px 16px 0" } }, h(CandySeg, { items: [["visible", "谁能看到"], ["acct", "账户"], ["recur", "周期"], ["cur", "币种"], ["cat", "分类"]], value: tab, onChange: setTab, sk: props.sk }))
        : h("div", { style: { display: "flex", gap: 6, padding: "0 20px" } },
          tabBtn("visible", "谁能看到"), tabBtn("acct", "账户"), tabBtn("recur", "周期"), tabBtn("cur", "币种"), tabBtn("cat", "分类")),
        h("div", { style: { position: "relative", flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "18px 20px 6px", borderTop: g ? "none" : "1px solid " + pageColor("ledger", "line", "rgba(60,54,40,.16)"), marginTop: -1 } },
          // ---- 可见性 ----
          tab === "visible" && g ? h(Fragment, null,
            h("div", { style: { position: "relative", height: 78, marginBottom: 2 } },
              decoImg("hand-between", { right: 0, top: -2, width: 140, transform: "rotate(-5deg)" })),
            chars.length ? h("div", { className: "lg-pnl", "data-ledger-visible": true, style: { borderStyle: "solid", borderWidth: 24, borderColor: "transparent", position: "relative", isolation: "isolate", margin: "0 -14px 6px" } },
              chars.map((c, i) => { const on = sel.includes(c.id);
                return h("button", { key: c.id, onClick: () => toggle(c.id), "aria-pressed": on, className: "w-full active:opacity-80 flex items-center", style: { gap: 14, minHeight: 60, padding: "6px 2px", borderTop: i ? "1px solid " + LINE : "none" }, "data-wk": "ldgsettingssheet", "data-part": "r2" },
                  h("span", { style: { padding: 2, borderRadius: 14, background: "linear-gradient(150deg,#fff,rgba(214,206,246,.8))", boxShadow: "0 2px 6px rgba(140,130,200,.25)", flexShrink: 0 } }, h(Avatar, { character: c, size: 42, radius: 12 })),
                  h("span", { style: { flex: 1, textAlign: "left", fontFamily: F_BODY, fontSize: 14.5, color: t.ink } }, c.name),
                  h("img", { src: LA + (on ? "chk-on" : "chk-off") + ".webp" + LV, alt: "", draggable: false, style: { width: 32, height: 32, flexShrink: 0, objectFit: "contain" } })); }))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, textAlign: "center", padding: "20px 0" } }, "先去『人格档案馆』建个角色")) :
          tab === "visible" ? h(Fragment, null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 14, lineHeight: 1.55 } }, "被选中的角色在聊天里能自然感知你本月的真实收支和几笔大开销，按人设关心或调侃你。只是让 TA 知道，不碰任何余额。"),
            chars.length ? chars.map(c => { const on = sel.includes(c.id);
              return h("button", { key: c.id, onClick: () => toggle(c.id), className: "w-full active:opacity-80", style: { ...rowStyle, marginBottom: 8 }, "data-wk": "ldgsettingssheet", "data-part": "r3" },
                h(Avatar, { character: c, size: 36, radius: 10 }),
                h("span", { style: { flex: 1, textAlign: "left", fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, c.name),
                h("div", { style: { width: 22, height: 22, borderRadius: 999, border: "1.5px solid " + (on ? pageColor("ledger", "accent", ACCENT) : t.line), background: on ? pageColor("ledger", "accent", ACCENT) : "transparent", display: "flex", alignItems: "center", justifyContent: "center" } }, on ? h(ICheck, { size: 13, color: "#fff" }) : null));
            }) : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, textAlign: "center", padding: "20px 0" } }, "先去『人格档案馆』建个角色")) : null,
          // ---- 账户 ----
          tab === "acct" ? h(Fragment, null,
            (s.accounts || []).map(a => { const ty = acctType(a.type), c = curs.find(x => x.code === a.currency) || { symbol: "", label: a.currency };
              const cs = a.type === "credit" ? creditState(a, props.txns || []) : null;
              return h("button", { key: a.id, onClick: () => setAcctEdit(a), "data-ledger-acct": a.id, className: "w-full active:opacity-80 text-left", style: { ...rowStyle, marginBottom: 8, minHeight: 56 }, "data-wk": "ldgsettingssheet", "data-part": "r4" },
                g ? h("span", { style: { position: "relative", width: 40, height: 34, flexShrink: 0 } },
                    h("img", { src: LA + "ic-acct.webp" + LV, alt: "", draggable: false, style: { width: 40, height: 34, objectFit: "contain" } }),
                    h("span", { style: { position: "absolute", right: -2, bottom: 0, width: 12, height: 12, borderRadius: 99, background: ty.tint, border: "2px solid #fff" } }))
                  : h("div", { style: { width: 34, height: 24, borderRadius: 6, background: "linear-gradient(135deg,#fff," + ty.tint + ")", border: "1px solid " + ty.tint, flexShrink: 0 } }),
                h("div", { style: { flex: 1, minWidth: 0 } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, fontWeight: 600, color: t.ink } }, a.name),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2 } }, ty.zh + " · " + c.label)),
                h("div", { style: { textAlign: "right" } },
                  cs ? h(Fragment, null,
                    h("div", { style: { fontFamily: F_BODY, fontSize: 13, fontWeight: 700, color: t.ink } }, "欠 " + fmtAmt(cs.owed, c)),
                    cs.dueDate ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: cs.due && cs.daysLeft <= 3 ? EXP : t.fog, marginTop: 2 } }, "本期应还 " + fmtAmt(cs.due, c) + " · " + fmtDay(cs.dueDate)) : null)
                    : h("div", { style: { fontFamily: F_BODY, fontSize: 13, fontWeight: 700, color: t.ink } }, fmtAmt(acctBalance(a, props.txns || []), c))),
                h("span", { style: { color: t.fog } }, "›")); }),
            h("button", { onClick: () => setAcctEdit({}), className: "w-full active:opacity-70", style: { ...rowStyle, justifyContent: "center", minHeight: 48, border: "1px dashed " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: 13, marginBottom: 18 }, "data-wk": "ldgsettingssheetbtn", "data-part": "2" }, "＋ 添加账户"),
            // 她 2026-09-29「搞开关给不给」：能看账本的角色，看不看得到账户余额，单独一个开关，默认不给
            h("button", { onClick: () => props.onPersist(d => { d.settings.shareAcct = !d.settings.shareAcct; }), "data-ledger-shareacct": true, "aria-pressed": !!s.shareAcct, className: "w-full active:opacity-80 text-left", style: { ...rowStyle, minHeight: 56 }, "data-wk": "ldgsettingssheetbtn", "data-part": "3" },
              h("div", { style: { flex: 1 } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, "角色也能看到账户余额"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 3, lineHeight: 1.5 } }, "只对「谁能看到」里选中的角色生效。关着的时候 TA 们只知道收支，不知道你卡里有多少、欠多少。")),
              h("span", { style: { width: 44, height: 26, borderRadius: 999, flexShrink: 0, position: "relative", background: s.shareAcct ? pageColor("ledger", "accent", ACCENT) : t.line, transition: "background .2s" } },
                h("span", { style: { position: "absolute", top: 3, left: s.shareAcct ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left .2s" } })))) : null,
          // ---- 周期账单 ----
          tab === "recur" ? h(Fragment, null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 14, lineHeight: 1.55 } }, "房租、订阅、话费这类每月固定的，设一次，到了那天打开记账就自动记上一笔；快到的前三天会提醒你。"),
            (s.recurring || []).map(r => { const c = curs.find(x => x.code === r.currency) || { symbol: "" }, nx = recurNext(r);
              return h("button", { key: r.id, onClick: () => setRecurEdit(r), "data-ledger-recur": r.id, className: "w-full active:opacity-80 text-left", style: { ...rowStyle, marginBottom: 8, minHeight: 56 }, "data-wk": "ldgsettingssheet", "data-part": "r5" },
                h("span", { style: { width: 28, display: "flex", justifyContent: "center" } }, h(CategoryGlyph, { name: r.category, icon: r.catIcon, size: 26 })),
                h("div", { style: { flex: 1, minWidth: 0 } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, fontWeight: 600, color: t.ink } }, r.name || r.category),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2 } }, "每月 " + r.day + " 号 · " + r.category + (r.account ? " · " + acctName(s, r.account) : "") + " · 下次 " + fmtDay(nx.date))),
                h("div", { style: { fontFamily: F_BODY, fontSize: 13, fontWeight: 700, color: r.type === "income" ? INC : t.ink } }, (r.type === "income" ? "+" : "") + fmtAmt(r.amount, c)),
                h("span", { style: { color: t.fog } }, "›")); }),
            h("button", { onClick: () => setRecurEdit({}), className: "w-full active:opacity-70", style: { ...rowStyle, justifyContent: "center", minHeight: 48, border: "1px dashed " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: 13 }, "data-wk": "ldgsettingssheetbtn", "data-part": "4" }, "＋ 添加周期账单")) : null,
          // ---- 币种管理 ----
          tab === "cur" ? h(Fragment, null,
            curs.map(c => h("div", { key: c.code, style: { ...rowStyle, marginBottom: 8 } },
              h("div", { style: { width: 30, height: 22, borderRadius: 5, background: "linear-gradient(135deg,#e8cf94,#b89150)", flexShrink: 0 } }),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, c.label + " " + c.symbol),
                h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, letterSpacing: "0.08em" } }, c.code)),
              // 折合用：主币 / 汇率（她 2026-09-29）。只影响统计页那一行「折合」，不动任何一笔账
              curs.length > 1 ? h("button", { "data-ledger-rate": c.code, className: "active:opacity-70", onClick: () => {
                  if (!s.baseCur) { props.onPersist(d => { d.settings.baseCur = c.code; }); props.toast && props.toast(c.label + " 设成主币了，其他币填汇率就能折合"); return; }
                  if (s.baseCur === c.code) return;
                  const bc = curs.find(x => x.code === s.baseCur) || { label: s.baseCur };
                  requestAppPrompt("汇率", "1 " + c.label + " 等于多少" + bc.label + "？只用来折合着看。", String((s.rates || {})[c.code] || ""), v => {
                    const n = parseFloat(String(v).replace(/[^\d.]/g, "")) || 0; props.onPersist(d => { d.settings.rates = { ...(d.settings.rates || {}), [c.code]: n > 0 ? n : undefined }; });
                  }, "好", { placeholder: "比如 0.19" }); },
                  style: { minHeight: 32, padding: "0 10px", borderRadius: 999, fontFamily: F_BODY, fontSize: 11, color: s.baseCur === c.code ? "#fff" : t.sub, background: s.baseCur === c.code ? "#a79cef" : "transparent", border: "1px solid " + t.line, flexShrink: 0 }, "data-wk": "ldgsettingssheetbtn", "data-part": "比如 0.19" },
                s.baseCur === c.code ? "主币" : !s.baseCur ? "设为主币" : (s.rates || {})[c.code] ? "×" + s.rates[c.code] : "填汇率") : null,
              iconBtn(IPencil, () => editCur(c), t.sub), iconBtn(ITrash, () => delCur(c)))),
            h("button", { onClick: addCur, className: "w-full active:opacity-70", style: { ...rowStyle, justifyContent: "center", border: "1px dashed " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: 13 }, "data-wk": "ldgsettingssheetbtn", "data-part": "6" }, "＋ 添加币种")) : null,
          // ---- 分类管理 ----
          tab === "cat" ? h(Fragment, null,
g ? h("div", { style: { marginBottom: 14 } }, h(CandySeg, { items: [["expense", "支出分类"], ["income", "收入分类"]], value: catType, onChange: setCatType, sk: props.sk })) :
            h("div", { style: { display: "flex", gap: 4, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: 3, marginBottom: 14 } },
              ["expense", "income"].map(k => h("button", { key: k, onClick: () => setCatType(k), className: "flex-1 active:opacity-80",
                style: { padding: "7px 0", borderRadius: 8, fontFamily: F_BODY, fontSize: 12.5, fontWeight: 600, border: "none", background: catType === k ? (k === "income" ? INC : EXP) : "transparent", color: catType === k ? "#fff" : t.sub }, "data-wk": "ldgsettingssheetbtn", "data-part": "7" }, k === "income" ? "收入分类" : "支出分类"))),
            cats.map(c => h("div", { key: c.name, style: { ...rowStyle, marginBottom: 8 } },
              h("span", { style: { width: 28, display: "flex", justifyContent: "center" } }, h(CategoryGlyph, { name: c.name, emoji: c.emoji, icon: c.icon, size: 26 })),
              h("span", { style: { flex: 1, fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, c.name),
              // 分类上限（支出分类才有）：按统计页当前看的币种存（她 2026-09-29）
              catType === "expense" ? h("button", { "data-ledger-setlimit": c.name, className: "active:opacity-70", onClick: () => {
                  const code = props.code, curLabel = (curs.find(x => x.code === code) || { label: code }).label;
                  requestAppPrompt(c.name + " 每月上限", "每个月在「" + c.name + "」上最多花多少" + curLabel + "？填 0 就是不设。", String(catBudgetOf(s, code, c.name) || ""), v => {
                    const n = Math.round((parseFloat(String(v).replace(/[^\d.]/g, "")) || 0) * 100) / 100;
                    props.onPersist(d => { const all = { ...(d.settings.catBudgets || {}) }; const m = { ...(all[code] || {}) }; if (n > 0) m[c.name] = n; else delete m[c.name]; all[code] = m; d.settings.catBudgets = all; });
                  }, "好", { placeholder: "比如 800" }); },
                  style: { minHeight: 32, padding: "0 10px", borderRadius: 999, fontFamily: F_BODY, fontSize: 11, color: catBudgetOf(s, props.code, c.name) ? t.ink : t.fog, background: "transparent", border: "1px solid " + t.line, flexShrink: 0 }, "data-wk": "ldgsettingssheetbtn", "data-part": "比如 800" },
                catBudgetOf(s, props.code, c.name) ? "上限 " + catBudgetOf(s, props.code, c.name) : "设上限") : null,
              iconBtn(IPencil, () => editCat(c), t.sub), iconBtn(ITrash, () => delCat(c)))),
            h("button", { onClick: addCat, className: "w-full active:opacity-70", style: { ...rowStyle, justifyContent: "center", border: "1px dashed " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: 13 }, "data-wk": "ldgsettingssheetbtn", "data-part": "9" }, "＋ 添加分类")) : null),
        // 底部主按钮（可见性 tab 才需要保存；管理 tab 即时生效，给「完成」）
        g ? h("div", { className: "shrink-0", style: { position: "relative", display: "flex", justifyContent: "center", padding: "12px 20px calc(env(safe-area-inset-bottom, 0px) + 14px)" } },
            decoImg("hand-small", { left: 2, bottom: "calc(env(safe-area-inset-bottom, 0px) + 62px)", width: 84, transform: "rotate(-8deg)" }),
            decoImg("binder", { right: 4, bottom: "calc(env(safe-area-inset-bottom, 0px) + 40px)", width: 60, transform: "rotate(10deg)" }),
            h("button", { onClick: tab === "visible" ? saveVisible : props.onClose, "data-ledger-setsave": true, className: "active:opacity-85",
              style: { position: "relative", width: "74%", minHeight: 52, border: "none", borderRadius: 999, fontFamily: F_BODY, fontSize: 15.5, fontWeight: 700, letterSpacing: ".2em", color: "#5b4f9e",
                background: "url(assets/ledger/rail.webp?v=259) center / 100% 100% no-repeat" }, "data-wk": "ldgsettingssheetbtn", "data-part": "10" }, tab === "visible" ? "保存" : "完成"))
        : h("div", { className: "shrink-0", style: { padding: "10px 20px calc(env(safe-area-inset-bottom, 0px) + 14px)", borderTop: "1px solid " + pageColor("ledger", "line", "rgba(60,54,40,.12)") } },
          h("button", { onClick: tab === "visible" ? saveVisible : props.onClose, className: "w-full active:opacity-85",
            style: { background: pageColor("ledger", "accent", ACCENT), color: "#fff", border: "none", borderRadius: 999, padding: "14px 0", fontFamily: F_BODY, fontSize: 14.5, fontWeight: 600 }, "data-wk": "ldgsettingssheetbtn", "data-part": "11" },
            tab === "visible" ? "保存" : "完成"))),
      // 弹窗们
      dialog && dialog.kind === "addcur" ? h(FieldDialog, { glass: (typeof sk !== "undefined" && sk && sk.id === "glass") || !!(props.sk && props.sk.id === "glass"), title: "新币种", submitLabel: "添加", fields: [{ key: "label", label: "名称", placeholder: "如 日元", required: true }, { key: "code", label: "三字母代码", placeholder: "JPY", maxLength: 4, required: true }, { key: "symbol", label: "符号（可留空）", placeholder: "¥", maxLength: 3 }], onSubmit: submitAddCur, onCancel: () => setDialog(null) }) : null,
      dialog && dialog.kind === "editcur" ? h(FieldDialog, { glass: (typeof sk !== "undefined" && sk && sk.id === "glass") || !!(props.sk && props.sk.id === "glass"), title: "改币种", submitLabel: "保存", fields: [{ key: "code", label: "代码（不可改）", value: dialog.code, locked: true }, { key: "label", label: "名称", value: dialog.label, required: true }, { key: "symbol", label: "符号", value: dialog.symbol, maxLength: 3 }], onSubmit: submitEditCur, onCancel: () => setDialog(null) }) : null,
      dialog && dialog.kind === "addcat" ? h(FieldDialog, { glass: (typeof sk !== "undefined" && sk && sk.id === "glass") || !!(props.sk && props.sk.id === "glass"), title: "新分类", submitLabel: "添加", fields: [{ key: "name", label: "名称", placeholder: "如 咖啡", required: true }, { key: "icon", label: "图标", type: "icon" }], onSubmit: submitAddCat, onCancel: () => setDialog(null) }) : null,
      dialog && dialog.kind === "editcat" ? h(FieldDialog, { glass: (typeof sk !== "undefined" && sk && sk.id === "glass") || !!(props.sk && props.sk.id === "glass"), title: "改分类", submitLabel: "保存", fields: [{ key: "name", label: "名称", value: dialog.name, required: true }, { key: "icon", label: "图标", type: "icon", value: dialog.icon }], onSubmit: submitEditCat, onCancel: () => setDialog(null) }) : null,
      recurEdit ? h(RecurEditor, { rule: recurEdit, settings: s, curs, sk: props.sk,
        onClose: () => setRecurEdit(null),
        onSave: r => { props.onPersist(d => { const list = d.settings.recurring || []; d.settings.recurring = list.some(x => x.id === r.id) ? list.map(x => x.id === r.id ? r : x) : list.concat([r]); runRecurring(d); }); setRecurEdit(null); },
        // 删规则只是以后不再记；已经记上的那几笔是真花出去的钱，留着
        onDelete: r => { props.onPersist(d => { d.settings.recurring = (d.settings.recurring || []).filter(x => x.id !== r.id); }); setRecurEdit(null); } }) : null,
      acctEdit ? h(AcctEditor, { acct: acctEdit, curs, sk: props.sk, txns: props.txns || [],
        onClose: () => setAcctEdit(null),
        onSave: a => { props.onPersist(d => { const list = d.settings.accounts || []; d.settings.accounts = list.some(x => x.id === a.id) ? list.map(x => x.id === a.id ? a : x) : list.concat([a]); }); setAcctEdit(null); },
        onDelete: a => { props.onPersist(d => {
          d.settings.accounts = (d.settings.accounts || []).filter(x => x.id !== a.id);
          // 挂在它身上的收支照样留着、照样算进统计，只是不再属于哪个账户
          d.txns = d.txns.map(x => x.account === a.id ? { ...x, account: "" } : x);
        }); setAcctEdit(null); } }) : null,
      confirm ? h(ConfirmDialog, { title: confirm.title, body: confirm.body, confirmLabel: "删掉", danger: true, onConfirm: confirm.onConfirm, onCancel: () => setConfirm(null) }) : null);
  }

  // 添加 / 改一条周期账单：整页（施工规则/no-half-sheet.md）
  function RecurEditor(props) {
    const t = glassInk(useTheme(), props.sk);
    const r0 = props.rule || {}, s = props.settings, isNew = !r0.id;
    const [name, setName] = useState(r0.name || "");
    const [type, setType] = useState(r0.type || "expense");
    const [amount, setAmount] = useState(r0.amount ? String(r0.amount) : "");
    const [code, setCode] = useState(r0.currency || (props.curs[0] || {}).code || "CAD");
    const [cat, setCat] = useState(r0.category || "");
    const [acct, setAcct] = useState(r0.account || "");
    const [day, setDay] = useState(r0.day ? String(r0.day) : String(Math.min(28, new Date().getDate())));
    const [confirmDel, setConfirmDel] = useState(false);
    const cats = (s.cats && s.cats[type]) || [];
    const accts = (s.accounts || []).filter(a => a.currency === code);
    const D = parseInt(day, 10), amt = Math.round((parseFloat(String(amount).replace(/[^\d.]/g, "")) || 0) * 100) / 100;
    const ok = amt > 0 && cat && cats.some(c => c.name === cat) && D >= 1 && D <= 28;
    const save = () => {
      if (!ok) return;
      const c = cats.find(x => x.name === cat) || {};
      const now = new Date(), thisMk = thisMonthKey();
      // 新建：第一笔落在今天或以后——日子这个月已经过了就从下个月开始，不替她倒补
      const startMk = r0.startMk || (now.getDate() > D ? shiftMonth(thisMk, 1) : thisMk);
      props.onSave({ id: r0.id || Date.now().toString(36) + Math.floor(Math.random() * 1e3).toString(36), name: name.trim().slice(0, 20), type, amount: amt, currency: code, category: cat, catIcon: c.icon || "",
        account: accts.some(a => a.id === acct) ? acct : "", day: D, startMk, lastMk: r0.lastMk || "" });
    };
    const g = props.sk && props.sk.id === "glass";
    const label = txt => h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, margin: "14px 0 6px" } }, txt);
    const input = (val, set, ph, mode) => h("input", { value: val, onChange: e => set(e.target.value), placeholder: ph, inputMode: mode || "text", maxLength: 20,
      style: { width: "100%", minHeight: 44, fontFamily: F_BODY, fontSize: 14, color: t.ink, background: g ? "rgba(255,255,255,.55)" : t.bg2, border: "1px solid " + (g ? "rgba(170,160,220,.4)" : t.line), borderRadius: 12, padding: "0 12px", outline: "none" }, "data-wk": "ldgrecureditorinput", "data-part": "1" });
    const pill = (on, txt, onClick, tint, key) => h("button", { key: key || txt, onClick, "aria-pressed": on, className: "active:opacity-70", style: { minHeight: 40, padding: "0 14px", borderRadius: 999, fontFamily: F_BODY, fontSize: 13, fontWeight: on ? 700 : 500,
      color: on ? t.ink : t.sub, background: on ? (tint ? tint + "45" : "rgba(200,190,240,.45)") : "transparent", border: "1.5px solid " + (on ? (tint || pageColor("ledger", "accent", ACCENT)) : t.line) }, "data-wk": "ldgrecureditorbtn", "data-part": "1", "data-on": on ? "1" : "0" }, txt);
    const wrap = kids => h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } }, kids);
    return h("div", { style: { position: "absolute", inset: 0, zIndex: 58, display: "flex", flexDirection: "column" }, "data-wk": "ldgrecureditorsave" },
      h("div", { className: "h-full flex flex-col", style: Object.assign({}, props.sk ? props.sk.page : paperBg()) },
        h(Head, { zh: isNew ? "添加周期账单" : "改周期账单", onBack: props.onClose, ink: props.sk ? props.sk.ink : pageColor("ledger", "ink", "#33322c"), bg: "transparent", noLine: true,
          right: isNew ? null : h("button", { onClick: () => setConfirmDel(true), "aria-label": "删掉这条周期账单", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40 }, "data-wk": "ldgrecureditorbtn", "data-part": "删掉这条周期账单" }, h(ITrash, { size: 18, color: t.sub })) }),
        h("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "4px 20px 20px" } },
          label("叫什么（会写进备注）"), input(name, setName, "比如 房租"),
          label("支出还是收入"), wrap([pill(type === "expense", "支出", () => { setType("expense"); setCat(""); }), pill(type === "income", "收入", () => { setType("income"); setCat(""); })]),
          label("每月多少"), input(amount, setAmount, "比如 1800", "decimal"),
          props.curs.length > 1 ? h(Fragment, null, label("币种"), wrap(props.curs.map(c => pill(code === c.code, c.label, () => setCode(c.code), null, c.code)))) : null,
          label("分类"), wrap(cats.map(c => pill(cat === c.name, c.name, () => setCat(c.name), null, c.name))),
          accts.length ? h(Fragment, null, label("从哪个账户（可不选）"), wrap([pill(!acct, "不记账户", () => setAcct(""), null, "none")].concat(accts.map(a => pill(acct === a.id, a.name, () => setAcct(a.id), acctType(a.type).tint, a.id))))) : null,
          label("每月几号（1–28）"), input(day, setDay, "1", "numeric"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.6, marginTop: 10 } }, "到了那天打开记账会自动记上；那天没打开，下次打开时补上。删掉这条以后不再记，已经记上的不会动。")),
        h("div", { className: "shrink-0", style: { padding: "10px 20px calc(env(safe-area-inset-bottom, 0px) + 14px)" } },
          h("button", { onClick: save, disabled: !ok, className: "w-full active:opacity-85", style: { minHeight: 48, background: ok ? pageColor("ledger", "accent", ACCENT) : t.line, color: "#fff", border: "none", borderRadius: 999, fontFamily: F_BODY, fontSize: 14.5, fontWeight: 600 }, "data-wk": "ldgrecureditorbtn", "data-part": "3" }, "保存"))),
      confirmDel ? h(ConfirmDialog, { title: "删掉「" + (r0.name || r0.category || "") + "」？", body: "以后不再自动记这一笔；已经记上的那些会留着。", confirmLabel: "删掉", danger: true, onConfirm: () => props.onDelete(r0), onCancel: () => setConfirmDel(false) }) : null);
  }

  // 添加 / 改一个账户：整页（施工规则/no-half-sheet.md）
  function AcctEditor(props) {
    const t = glassInk(useTheme(), props.sk);
    const a0 = props.acct || {};
    const isNew = !a0.id;
    const [name, setName] = useState(a0.name || "");
    const [type, setType] = useState(a0.type || "debit");
    const [code, setCode] = useState(a0.currency || (props.curs[0] || {}).code || "CAD");
    // 信用卡在表单里填「现在欠多少」（正数），存的时候变成负的初始余额
    const [init, setInit] = useState(a0.id ? String(a0.type === "credit" ? -(Number(a0.init) || 0) : (Number(a0.init) || 0)) : "");
    const [limit, setLimit] = useState(a0.limit ? String(a0.limit) : "");
    const [billDay, setBillDay] = useState(a0.billDay ? String(a0.billDay) : "");
    const [dueDay, setDueDay] = useState(a0.dueDay ? String(a0.dueDay) : "");
    const [confirmDel, setConfirmDel] = useState(false);
    const credit = type === "credit";
    const num = v => Math.round((parseFloat(String(v).replace(/[^\d.-]/g, "")) || 0) * 100) / 100;
    const day = v => { const n = parseInt(v, 10); return n >= 1 && n <= 28 ? n : 0; };
    const used = !isNew && (props.txns || []).some(x => x.account === a0.id || x.from === a0.id || x.to === a0.id);
    const save = () => {
      if (!name.trim()) return;
      const v = num(init);
      props.onSave({ id: a0.id || "a" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name: name.trim().slice(0, 16), type, currency: code,
        init: credit ? -Math.abs(v) : v, limit: credit ? num(limit) : 0, billDay: credit ? day(billDay) : 0, dueDay: credit ? day(dueDay) : 0 });
    };
    const g = props.sk && props.sk.id === "glass";
    const label = txt => h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, margin: "14px 0 6px" } }, txt);
    const input = (val, set, ph, mode) => h("input", { value: val, onChange: e => set(e.target.value), placeholder: ph, inputMode: mode || "text", maxLength: 16,
      style: { width: "100%", minHeight: 44, fontFamily: F_BODY, fontSize: 14, color: t.ink, background: g ? "rgba(255,255,255,.55)" : t.bg2, border: "1px solid " + (g ? "rgba(170,160,220,.4)" : t.line), borderRadius: 12, padding: "0 12px", outline: "none" }, "data-wk": "ldgaccteditorinput", "data-part": "1" });
    const pill = (on, txt, onClick, tint) => h("button", { onClick, "aria-pressed": on, className: "active:opacity-70", style: { minHeight: 40, padding: "0 14px", borderRadius: 999, fontFamily: F_BODY, fontSize: 13, fontWeight: on ? 700 : 500,
      color: on ? t.ink : t.sub, background: on ? (tint ? tint + "45" : "rgba(200,190,240,.45)") : "transparent", border: "1.5px solid " + (on ? (tint || pageColor("ledger", "accent", ACCENT)) : t.line) }, "data-wk": "ldgaccteditorbtn", "data-part": "1", "data-on": on ? "1" : "0" }, txt);
    return h("div", { style: { position: "absolute", inset: 0, zIndex: 58, display: "flex", flexDirection: "column" }, "data-wk": "ldgaccteditorsave" },
      h("div", { className: "h-full flex flex-col", style: Object.assign({}, props.sk ? props.sk.page : paperBg()) },
        h(Head, { zh: isNew ? "添加账户" : "改账户", onBack: props.onClose, ink: props.sk ? props.sk.ink : pageColor("ledger", "ink", "#33322c"), bg: "transparent", noLine: true,
          right: isNew ? null : h("button", { onClick: () => setConfirmDel(true), "aria-label": "删掉这个账户", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40 }, "data-wk": "ldgaccteditorbtn", "data-part": "删掉这个账户" }, h(ITrash, { size: 18, color: t.sub })) }),
        h("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "4px 20px 20px" } },
          label("名字"), input(name, setName, credit ? "比如 招行信用卡" : "比如 工资卡"),
          label("类型"), h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } }, ACCT_TYPES.map(x => pill(type === x.id, x.zh, () => setType(x.id), x.tint))),
          label("币种"), h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } }, props.curs.map(c => pill(code === c.code, c.label, () => setCode(c.code)))),
          label(credit ? "现在欠多少（没欠就填 0）" : "现在余额"), input(init, setInit, "0", "decimal"),
          credit ? h(Fragment, null,
            label("额度（可留空）"), input(limit, setLimit, "比如 20000", "decimal"),
            h("div", { style: { display: "flex", gap: 10 } },
              h("div", { style: { flex: 1 } }, label("账单日（每月几号，1–28）"), input(billDay, setBillDay, "5", "numeric")),
              h("div", { style: { flex: 1 } }, label("还款日（每月几号，1–28）"), input(dueDay, setDueDay, "25", "numeric"))),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.6, marginTop: 10 } }, "设了账单日就按周期算：账单日那天之前刷的算这一期应还，之后刷的算下一期。还信用卡在「记一笔 → 转账」里，从储蓄卡转给这张卡。")) : null),
        h("div", { className: "shrink-0", style: { padding: "10px 20px calc(env(safe-area-inset-bottom, 0px) + 14px)" } },
          h("button", { onClick: save, disabled: !name.trim(), className: "w-full active:opacity-85", style: { minHeight: 48, background: name.trim() ? pageColor("ledger", "accent", ACCENT) : t.line, color: "#fff", border: "none", borderRadius: 999, fontFamily: F_BODY, fontSize: 14.5, fontWeight: 600 }, "data-wk": "ldgaccteditorbtn", "data-part": "3" }, "保存"))),
      confirmDel ? h(ConfirmDialog, { title: "删掉「" + (a0.name || "") + "」？", body: used ? "记在它上面的收支会留着、照样算进统计，只是不再属于哪个账户；跟它有关的转账会显示成「已删的账户」。" : "这个账户上还没有账，可以放心删。", confirmLabel: "删掉", danger: true, onConfirm: () => props.onDelete(a0), onCancel: () => setConfirmDel(false) }) : null);
  }

  window.Ledger = Ledger;
})();
