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
    list.forEach(x => { const d = x.date || ""; if (!at[d]) { at[d] = { date: d, rows: [], exp: 0, inc: 0 }; out.push(at[d]); } const g = at[d]; g.rows.push(x); if (x.type === "income") g.inc += Number(x.amount) || 0; else g.exp += Number(x.amount) || 0; });
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

  // 某币种在某月的收支汇总 + 分类明细
  function summarize(txns, code, mk) {
    let exp = 0, inc = 0; const cats = {};
    txns.forEach(t => {
      if (t.currency !== code || monthKey(t.date) !== mk) return;
      const a = Number(t.amount) || 0;
      if (t.type === "income") inc += a;
      else { exp += a; if (!cats[t.category]) cats[t.category] = { amount: 0, emoji: t.catEmoji || "" }; cats[t.category].amount += a; }
    });
    const catList = Object.keys(cats).map(k => ({ name: k, amount: cats[k].amount, emoji: cats[k].emoji })).sort((x, y) => y.amount - x.amount);
    return { exp, inc, net: inc - exp, catList, count: txns.filter(t => t.currency === code && monthKey(t.date) === mk).length };
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
    if (!(a > 0)) return null;
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
    return [main, own].filter(Boolean).join("\n");
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
    return h("div", { className: "absolute inset-0 z-[60] flex items-center justify-center", style: { background: pageColor("ledger", "bg2", "rgba(20,19,15,0.5)"), backdropFilter: "blur(3px)", padding: 24 }, onClick: props.onCancel },
      h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", maxWidth: 320, background: t.bg2, borderRadius: 20, padding: "20px 18px 16px", animation: "fadeUp .2s ease both", transform: lift ? "translateY(-" + Math.round(lift / 2) + "px)" : "none", transition: "transform .18s ease" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, marginBottom: 16, textAlign: "center" } }, props.title),
        (props.fields || []).map(f => h("div", { key: f.key, style: { marginBottom: 12 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 5 } }, f.label),
          h("input", { value: vals[f.key], onChange: e => set(f.key, e.target.value), placeholder: f.placeholder || "", maxLength: f.maxLength || 40, disabled: f.locked,
            style: { width: "100%", fontFamily: F_BODY, fontSize: 14, color: f.locked ? t.fog : t.ink, background: t.bg, border: "1px solid " + t.line, borderRadius: 10, padding: "10px 12px", outline: "none" } }))),
        h("div", { className: "flex gap-3", style: { marginTop: 6 } },
          h("button", { onClick: props.onCancel, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 14, color: t.sub, padding: "11px 0", borderRadius: 12, border: "1px solid " + t.line, background: "transparent" } }, "取消"),
          h("button", { onClick: submit, className: "flex-1 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 700, color: "#fff", background: pageColor("ledger", "accent", ACCENT), padding: "12px 0", borderRadius: 12, border: "none" } }, props.submitLabel || "保存"))));
  }

  // ============================================================
  // 账本样式（她 2026-09-28 给的样张：一整套晶透的记账软件）
  // ⚠️换的只是【皮】，排版和功能所有样式共用一份——以后加什么功能，每套皮都自动有。
  //   skin 存在 settings.skin 里：glass（晶透，默认）| paper（原来那本账簿纸）。
  // ============================================================
  const SKIN_LIST = [
    { id: "glass", zh: "晶透", sub: "淡紫粉的玻璃卡片" },
    { id: "paper", zh: "账簿", sub: "横格纸和红色分栏线" }
  ];
  // 分类色：同一个分类在图标底、统计环、排行条里用同一个颜色，看颜色就知道是哪类
  const CAT_TINTS = ["#f4a7c1", "#c3a8f0", "#f5c49e", "#a9bdf5", "#9ed9cf", "#f2d58f", "#e7a9e0", "#b5d99a", "#f0b1a4", "#a8d4f0", "#d3c6e8", "#cfd6de"];
  function ledgerSkin(settings) {
    const id = settings && settings.skin === "paper" ? "paper" : "glass";
    const t = window.__ledgerTheme || {};
    if (id === "paper") {
      return {
        id,
        page: paperBg(),
        ink: pageColor("ledger", "ink", "#33322c"), sub: pageColor("ledger", "sub", "rgba(60,54,40,.62)"), fog: pageColor("ledger", "fog", "rgba(60,54,40,.45)"),
        line: pageColor("ledger", "line", "rgba(60,54,40,.14)"), accent: pageColor("ledger", "accent", ACCENT), pink: pageColor("ledger", "tint", "#c25a4a"),
        exp: pageColor("ledger", "ink", "#33322c"), inc: INC, over: EXP,
        card: { background: t.bg2 || "#faf7f0", border: "1px solid " + (t.line || "rgba(60,54,40,.14)"), borderRadius: 16 },
        well: { background: "rgba(60,54,40,.05)", borderRadius: 12 },
        num: F_DISPLAY, onAccent: "#fff", tabBar: { background: "rgba(242,236,224,.94)", borderTop: "1px solid rgba(60,54,40,.12)" }
      };
    }
    const ink = pageColor("ledger", "ink", "#3b3552");
    return {
      id,
      page: {
        backgroundColor: pageColor("ledger", "bg", "#f1ecfa"),
        backgroundImage: "radial-gradient(60% 40% at 12% 6%, rgba(255,214,232,.75), transparent 70%)," +
          "radial-gradient(55% 38% at 92% 22%, rgba(206,222,255,.7), transparent 70%)," +
          "radial-gradient(70% 45% at 30% 96%, rgba(230,214,255,.75), transparent 70%)," +
          "linear-gradient(170deg, #f4effc 0%, #f8eef6 48%, #eceffb 100%)"
      },
      ink, sub: pageColor("ledger", "sub", "#6c6687"), fog: pageColor("ledger", "fog", "#a39db9"),
      line: pageColor("ledger", "line", "rgba(143,128,190,.18)"), accent: pageColor("ledger", "accent", "#9a86e0"), pink: pageColor("ledger", "tint", "#f08fb1"),
      exp: ink, inc: "#3aa98a", over: "#e0607e",
      card: { background: "rgba(255,255,255,.58)", border: "1px solid rgba(255,255,255,.9)", borderRadius: 20,
        boxShadow: "0 10px 26px rgba(130,110,190,.13), inset 0 1px 0 rgba(255,255,255,.95)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" },
      well: { background: "rgba(255,255,255,.5)", border: "1px solid rgba(255,255,255,.85)", borderRadius: 14 },
      num: F_BODY, onAccent: "#fff",
      tabBar: { background: "rgba(250,247,255,.72)", borderTop: "1px solid rgba(255,255,255,.9)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", boxShadow: "0 -6px 20px rgba(130,110,190,.08)" }
    };
  }
  // 金额一律两位小数、负号在符号前面：-¥3,174.80，不是 ¥-3,174.8
  function fmtMoney(n, cur) {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    return (v < 0 ? "-" : "") + (cur ? cur.symbol : "") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const numStyle = (sk, size, color) => ({ fontFamily: sk.num, fontSize: size, color: color || sk.ink, fontWeight: sk.id === "glass" ? 700 : 400, fontVariantNumeric: "tabular-nums", letterSpacing: sk.id === "glass" ? "-.01em" : 0 });
  function catTint(settings, type, name) {
    const list = (settings && settings.cats && settings.cats[type]) || [];
    const i = list.findIndex(c => c.name === name);
    return CAT_TINTS[(i < 0 ? Math.abs(forumlessHash(name)) : i) % CAT_TINTS.length];
  }
  function forumlessHash(s) { let x = 0; s = String(s || ""); for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return x; }
  // 分类图标：一块带高光的糖色小方块，里面是分类自己的那个符号
  function CatTile({ tint, emoji, size, on, sk }) {
    const s = size || 40;
    return h("div", { style: { width: s, height: s, borderRadius: Math.round(s * .32), flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(s * .5),
      background: sk.id === "glass" ? "linear-gradient(150deg, rgba(255,255,255,.95), " + tint + "66 55%, " + tint + "aa)" : tint + "33",
      border: on ? "2px solid " + sk.pink : (sk.id === "glass" ? "1px solid rgba(255,255,255,.95)" : "1px solid " + sk.line),
      boxShadow: sk.id === "glass" ? "0 4px 10px " + tint + "55, inset 0 1px 0 rgba(255,255,255,.95)" : "none" } }, emoji || "•");
  }
  // 线条小图标（底栏、按钮）：统一一套，别用 Unicode 方块
  const LI = {
    wallet: c => [h("rect", { key: 1, x: 3, y: 6, width: 18, height: 13, rx: 3 }), h("path", { key: 2, d: "M16 12.5h2.5" }), h("path", { key: 3, d: "M5 6l9.5-3 1.5 3" })],
    chart: c => [h("path", { key: 1, d: "M4 20h16" }), h("rect", { key: 2, x: 5.5, y: 12, width: 3, height: 6, rx: 1 }), h("rect", { key: 3, x: 10.5, y: 8, width: 3, height: 10, rx: 1 }), h("rect", { key: 4, x: 15.5, y: 4.5, width: 3, height: 13.5, rx: 1 })],
    cal: c => [h("rect", { key: 1, x: 3.5, y: 5, width: 17, height: 15, rx: 3 }), h("path", { key: 2, d: "M3.5 10h17M8 3v4M16 3v4" })],
    me: c => [h("circle", { key: 1, cx: 12, cy: 8.5, r: 4 }), h("path", { key: 2, d: "M4.5 20c1.2-4 4-5.5 7.5-5.5s6.3 1.5 7.5 5.5" })],
    bag: c => [h("path", { key: 1, d: "M6 8h12l-1 12H7L6 8z" }), h("path", { key: 2, d: "M9 8V6.5a3 3 0 0 1 6 0V8" }), h("path", { key: 3, d: "M12 11v5M10 13.5h4" })],
    eye: c => [h("path", { key: 1, d: "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" }), h("circle", { key: 2, cx: 12, cy: 12, r: 2.6 })],
    eyeOff: c => [h("path", { key: 1, d: "M3 3l18 18" }), h("path", { key: 2, d: "M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.8 3.4M6.3 7.8C3.9 9.5 2.5 12 2.5 12s3.5 6 9.5 6c1.4 0 2.6-.3 3.7-.8" })],
    search: c => [h("circle", { key: 1, cx: 11, cy: 11, r: 6.5 }), h("path", { key: 2, d: "M16 16l4.5 4.5" })],
    back: c => [h("path", { key: 1, d: "M20 11H8.5M12.5 7l-4 4 4 4" }), h("path", { key: 2, d: "M4 5v12" })]
  };
  const LIcon = ({ k, size, color, sw }) => h("svg", { width: size || 22, height: size || 22, viewBox: "0 0 24 24", fill: "none", stroke: color || "currentColor", strokeWidth: sw || 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, LI[k] ? LI[k]() : null);
  // 月份左右切（箭头点得着：40px）
  const MonthNav = ({ mk, setMk, sk }) => h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 4 } },
    h("button", { onClick: () => setMk(m => shiftMonth(m, -1)), "aria-label": "上个月", className: "active:opacity-50", style: { width: 40, height: 40, color: sk.sub, fontSize: 20 } }, "‹"),
    h("span", { style: { fontFamily: F_BODY, fontSize: 14.5, color: sk.ink, minWidth: 100, textAlign: "center", fontWeight: 600 } }, fmtMonth(mk)),
    h("button", { onClick: () => setMk(m => shiftMonth(m, 1)), "aria-label": "下个月", className: "active:opacity-50", style: { width: 40, height: 40, color: sk.sub, fontSize: 20 } }, "›"));
  // 一排「糖块」切换：选中那块鼓起来、有高光和影子，没选的平贴在槽里——不只靠一个色差（tabs-not-plain-pills.md）
  const CandySeg = ({ items, value, onChange, sk }) => h("div", { style: Object.assign({ display: "flex", gap: 4, padding: 4 }, sk.well) },
    items.map(([k, zh]) => { const on = value === k;
      return h("button", { key: k, onClick: () => onChange(k), className: "flex-1 active:opacity-80",
        style: { minHeight: 40, borderRadius: 11, fontFamily: F_BODY, fontSize: 13.5, fontWeight: on ? 700 : 500, color: on ? sk.ink : sk.fog,
          background: on ? (sk.id === "glass" ? "linear-gradient(180deg,#ffe3ee,#ffc9dc)" : "#fff") : "transparent",
          boxShadow: on ? (sk.id === "glass" ? "0 4px 10px rgba(240,143,177,.35), inset 0 1px 0 rgba(255,255,255,.9)" : "0 2px 6px rgba(0,0,0,.08)") : "none",
          transform: on ? "translateY(-1px)" : "none" } }, zh); }));
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
    const [showSet, setShowSet] = useState(null);  // null | "visible" | "cur" | "cat"
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
        const vis = (d.settings.visibleTo || []).filter(id => (props.characters || []).some(c => c.id === id));
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
      style: { minWidth: 40, height: 40, padding: "0 8px", fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: sk.accent } }, cur.label) : null;

    const main = h("div", { className: "h-full flex flex-col", style: Object.assign({}, sk.page) },
      h(Head, { zh: tabTitle, onBack: props.onBack, ink: sk.ink, bg: "transparent", noLine: true, right: curSwitch }),
      h("div", { key: tab, className: "flex-1 min-h-0 overflow-y-auto", style: { overscrollBehavior: "contain" } },
        tab === "wallet" ? h(WalletHome, Object.assign({}, common, { characters: props.characters, onAdd: type => setAddState({ type }), onBills: () => push({ k: "bills" }), onEditBudget: editBudget,
          onMotto: () => requestAppPrompt("钱包上的那句话", "写一句给自己看的话，留空就用默认那句。", data.settings.motto || "", v => setSetting({ motto: String(v || "").trim().slice(0, 30) }), "好"),
          onToggleHide: () => setSetting({ hideBal: !data.settings.hideBal }) })) :
        tab === "stats" ? h(CurView, Object.assign({}, common, { txns: data.txns, budget: (data.settings.budgets || {})[code] || 0, onSetBudget })) :
        tab === "cal" ? h(CalView, common) :
        h(MeView, Object.assign({}, common, { characters: props.characters, onSettings: k => setShowSet(k), onEditBudget: editBudget, onSkin: id => setSetting({ skin: id }) }))),
      // 底栏：只吃 0.4 条安全区（mobile-ui-layout §2）；选中那格图标加粗、底下垫一块鼓起来的糖块
      h("div", { className: "shrink-0 flex", "data-ledger-tabbar": true, style: Object.assign({ padding: "6px 10px calc(env(safe-area-inset-bottom) * 0.4)" }, sk.tabBar) },
        TABS.map(([k, zh, ic]) => { const on = tab === k;
          return h("button", { key: k, onClick: () => setTab(k), className: "flex-1 flex flex-col items-center justify-center active:opacity-70", style: { minHeight: 50, gap: 2 } },
            h("div", { style: { width: 42, height: 28, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              background: on ? (sk.id === "glass" ? "linear-gradient(180deg, rgba(255,255,255,.95), rgba(226,214,255,.9))" : "rgba(60,54,40,.08)") : "transparent",
              boxShadow: on && sk.id === "glass" ? "0 3px 8px rgba(130,110,190,.22)" : "none" } },
              h(LIcon, { k: ic, size: 21, color: on ? sk.ink : sk.fog, sw: on ? 2.1 : 1.6 })),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, fontWeight: on ? 700 : 500, color: on ? sk.ink : sk.fog } }, zh)); })));

    const top = stack[stack.length - 1];
    let over = null;
    if (top && top.k === "bills") over = h(BillsView, Object.assign({}, common, { onBack: pop }));
    else if (top && top.k === "txn") {
      const txn = data.txns.find(x => x.id === top.id);
      over = txn ? h(TxnView, {
        txn, cur: curOf(txn.currency), sk, characters: props.characters, moods: props.moods, affinities: props.affinities,
        active: props.active, worldbook: props.worldbook, worldbookFor: props.worldbookFor, uName, toast: props.toast,
        onBack: pop,
        onEdit: () => setAddState({ edit: txn }),
        onAddComments: cmts => updTxn(txn.id, { comments: (txn.comments || []).concat(cmts) }),
        onDelete: () => { delTxn(txn.id); pop(); }
      }) : null;
    }

    return h("div", { className: "h-full", style: { position: "relative" } },
      main,
      // 底下那层留着不卸：滚动位置原样还在
      stack.map((v, i) => i === stack.length - 1 ? h("div", { key: i + v.k, style: { position: "absolute", inset: 0, zIndex: 20 + i } }, over) : null),
      addState ? h(AddSheet, {
        settings: data.settings, curs, edit: addState.edit, initType: addState.type, initCode: code, sk,
        onClose: () => setAddState(null),
        onAddCurrency: c => { const d = loadData(); d.settings.currencies = (d.settings.currencies || []).concat([c]); persist(d); },
        onAddCat: (type, cat) => { const d = loadData(); d.settings.cats[type] = (d.settings.cats[type] || []).concat([cat]); persist(d); },
        onSave: txn => {
          if (addState.edit) { updTxn(addState.edit.id, txn); setAddState(null); props.toast && props.toast("改好了"); }
          else { addTxn(txn); setAddState(null); autoReact(txn); if (props.characters && props.characters.length) push({ k: "txn", id: txn.id }); else props.toast && props.toast("记好了"); }
        }
      }) : null,
      showSet ? h(SettingsSheet, {
        settings: data.settings, characters: props.characters, txns: data.txns, toast: props.toast, initTab: showSet, sk,
        onClose: () => setShowSet(null),
        onPersist: mutate => { const d = loadData(); mutate(d); persist(d); }
      }) : null);
  }

  // ============================================================
  // 钱包：一张晶透的卡 + 这个月还剩多少 + 三颗大按钮 + 预算 + 最近几笔 + 上月结算小票
  // ============================================================
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
    const card = h("div", { "data-ledger-card": true, style: { position: "relative", height: 172, borderRadius: 22, overflow: "hidden", transform: glass ? "rotate(-3deg)" : "none", margin: "6px 6px 18px",
        background: glass ? "linear-gradient(125deg,#e3d7ff 0%,#fbe0ef 32%,#dbe9ff 62%,#efe0ff 100%)" : CUR_COLORS[0],
        boxShadow: glass ? "0 16px 34px rgba(140,115,200,.28), inset 0 1px 0 rgba(255,255,255,.95), inset 0 0 0 1px rgba(255,255,255,.7)" : "0 6px 16px rgba(0,0,0,.15)" } },
      glass ? h("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,.55) 42%, transparent 54%)" } }) : null,
      h("div", { style: { position: "absolute", left: 20, top: 18, fontFamily: F_BODY, fontSize: 12.5, fontWeight: 700, letterSpacing: ".14em", color: glass ? "#6f63a8" : "#fff" } }, cur.label + " · " + cur.code),
      h("div", { style: { position: "absolute", left: 20, top: 50, width: 36, height: 27, borderRadius: 6, background: glass ? "linear-gradient(135deg,#f4f1fb,#c9c3dc 60%,#eeeaf7)" : "linear-gradient(135deg,#e8cf94,#b89150)", boxShadow: "inset 0 0 0 1px rgba(120,110,160,.25)" } },
        h("div", { style: { position: "absolute", left: 11, top: 0, bottom: 0, width: 1, background: "rgba(120,110,160,.3)" } }),
        h("div", { style: { position: "absolute", left: 0, right: 0, top: 13, height: 1, background: "rgba(120,110,160,.3)" } })),
      h("div", { style: { position: "absolute", left: 20, bottom: 18, fontFamily: F_BODY, fontSize: 11, lineHeight: 1.55, color: glass ? "rgba(90,80,140,.7)" : "rgba(255,255,255,.8)" } }, "小钱也要被好好记住", h("br"), "这个月记了 " + s.count + " 笔"),
      glass ? h("svg", { width: 70, height: 70, viewBox: "0 0 70 70", style: { position: "absolute", right: 18, bottom: 12, opacity: .85 }, fill: "none", stroke: "rgba(255,255,255,.95)", strokeWidth: 2.2, strokeLinecap: "round", "aria-hidden": "true" },
        h("path", { d: "M25 30c-4-10-4-22 1-24s7 10 6 22M45 30c4-10 4-22-1-24s-7 10-6 22" }),
        h("path", { d: "M14 50c0-12 9-21 21-21s21 9 21 21-9 14-21 14-21-2-21-14z" }),
        h("circle", { cx: 28, cy: 48, r: 1.4, fill: "rgba(255,255,255,.95)" }), h("circle", { cx: 42, cy: 48, r: 1.4, fill: "rgba(255,255,255,.95)" }),
        h("path", { d: "M33 53c1.2 1 2.8 1 4 0" })) : null,
      h("svg", { width: 22, height: 22, viewBox: "0 0 24 24", style: { position: "absolute", right: 20, top: 18 }, fill: glass ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.8)", "aria-hidden": "true" },
        h("path", { d: "M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" })));
    const bigBtn = (label, grad, glow, icon, onClick) => h("button", { onClick, className: "flex-1 flex flex-col items-center justify-center active:opacity-80",
      style: { minHeight: 92, borderRadius: 20, gap: 8, background: glass ? grad : "rgba(255,255,255,.6)", border: glass ? "1px solid rgba(255,255,255,.95)" : "1px solid " + sk.line,
        boxShadow: glass ? "0 10px 22px " + glow + ", inset 0 1px 0 rgba(255,255,255,.95)" : "none" } },
      icon, h("span", { style: { fontFamily: F_BODY, fontSize: 13, fontWeight: 700, color: sk.ink } }, label));
    const mrec = (data.monthly || {})[lmk];
    const ls = summarize(data.txns, code, lmk);
    return h("div", { className: "px-5 pb-8" },
      card,
      h("div", { style: Object.assign({ padding: "16px 18px", marginBottom: 14 }, sk.card) },
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: sk.sub } }, "这个月还剩"),
          h("button", { onClick: props.onToggleHide, "aria-label": hide ? "显示金额" : "藏起金额", className: "active:opacity-60", style: { width: 40, height: 32, display: "flex", alignItems: "center", justifyContent: "flex-end" } }, h(LIcon, { k: hide ? "eyeOff" : "eye", size: 19, color: sk.sub }))),
        h("div", { "data-ledger-balance": true, style: Object.assign({ marginTop: 2 }, numStyle(sk, 32, s.net < 0 ? sk.over : sk.ink)) }, hide ? cur.symbol + " ****" : fmtMoney(s.net, cur)),
        h("div", { style: { display: "flex", gap: 14, marginTop: 6, fontFamily: F_BODY, fontSize: 11.5, color: sk.fog } },
          h("span", null, "收入 ", h("span", { style: numStyle(sk, 12, sk.inc) }, hide ? "****" : fmtMoney(s.inc, cur))),
          h("span", null, "支出 ", h("span", { style: numStyle(sk, 12, sk.sub) }, hide ? "****" : fmtMoney(s.exp, cur)))),
        h("button", { onClick: props.onMotto, className: "w-full text-left active:opacity-60", style: { marginTop: 12, minHeight: 36, padding: "8px 12px", borderRadius: 12, border: "1px dashed " + sk.line, fontFamily: F_BODY, fontSize: 12.5, color: sk.sub } }, "「" + motto + "」")),
      h("div", { style: { display: "flex", gap: 12, marginBottom: 14 } },
        bigBtn("记一笔", "linear-gradient(160deg,#fff 0%,#ffe0ec 55%,#ffc6da 100%)", "rgba(240,143,177,.32)", h("span", { style: { fontSize: 34, lineHeight: 1, fontWeight: 300, color: sk.pink } }, "＋"), () => props.onAdd("expense")),
        bigBtn("收入", "linear-gradient(160deg,#fff 0%,#dfeaff 55%,#c7dbff 100%)", "rgba(120,150,230,.3)", h(LIcon, { k: "bag", size: 30, color: "#6f8fdc", sw: 1.9 }), () => props.onAdd("income")),
        bigBtn("账单", "linear-gradient(160deg,#fff 0%,#ece2ff 55%,#dccdff 100%)", "rgba(150,120,220,.3)", h(LIcon, { k: "chart", size: 30, color: "#9579d8", sw: 1.9 }), props.onBills)),
      // 预算：没设就是一行邀请；设了是一根糖色进度条
      h("button", { onClick: props.onEditBudget, className: "w-full text-left active:opacity-80", "data-ledger-wallet-budget": true, style: Object.assign({ display: "block", padding: "14px 16px", marginBottom: 18 }, sk.card) },
        bs ? h(Fragment, null,
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 13, fontWeight: 700, color: sk.ink } }, "本月预算"),
            h("span", { style: numStyle(sk, 12, bs.left < 0 ? sk.over : sk.sub) }, Math.round(bs.used * 100) + "%")),
          h("div", { style: { height: 8, borderRadius: 8, background: "rgba(150,140,190,.16)", overflow: "hidden" } },
            h("div", { style: { height: "100%", width: Math.max(3, Math.min(1, bs.used) * 100) + "%", borderRadius: 8, background: bs.left < 0 ? sk.over : (glass ? "linear-gradient(90deg,#a992ec,#f3a6c4)" : sk.accent) } })),
          h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: F_BODY, fontSize: 11.5, color: sk.fog } },
            h("span", { style: numStyle(sk, 11.5, sk.fog) }, fmtMoney(s.exp, cur) + " / " + fmtMoney(bs.budget, cur)),
            h("span", { style: { color: bs.left < 0 ? sk.over : sk.fog } }, bs.left < 0 ? "超了 " + fmtMoney(-bs.left, cur) : "还能花 " + fmtMoney(bs.left, cur))))
          : h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: sk.fog } }, "＋ 设个每月预算")),
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 2px 8px" } },
        h("span", { style: { fontFamily: F_BODY, fontSize: 13, fontWeight: 700, color: sk.ink } }, "最近"),
        h("button", { onClick: props.onBills, className: "active:opacity-60", style: { minHeight: 36, fontFamily: F_BODY, fontSize: 12, color: sk.accent } }, "全部账单 ›")),
      recent.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 } }, recent.map(x => h(TxnRow, { key: x.id, txn: x, cur, sk, settings, onClick: () => props.onOpenTxn(x.id) })))
        : h("div", { style: Object.assign({ padding: "22px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 12.5, color: sk.fog, marginBottom: 20 }, sk.card) }, "还没有记账，点上面「记一笔」"),
      // 上月结算：一张小票，角色的月度盘点写在虚线框里
      (ls.exp || ls.inc) ? h(Receipt, { sk, title: parseInt(lmk.split("-")[1], 10) + "月结算", sub: fmtMonth(lmk) },
        [["本月支出", fmtMoney(ls.exp, cur), null], ["本月收入", fmtMoney(ls.inc, cur), sk.inc], ["结余", fmtMoney(ls.net, cur), null, true]].map(([k, v, c, big], i) =>
          h("div", { key: i, style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: big ? "10px 0 0" : "4px 0", borderTop: big ? "1px dashed rgba(90,80,120,.25)" : "none", marginTop: big ? 6 : 0 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "#6b6580" } }, k),
            h("span", { style: numStyle({ id: "glass", num: F_BODY }, big ? 18 : 13.5, c || "#3b3552") }, v))),
        (mrec && (mrec.comments || []).length) ? h("div", { style: { marginTop: 12, border: "1.5px dashed rgba(150,130,200,.45)", borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 } },
          mrec.comments.map((cm, i) => h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, color: "#4a4462" } }, h("b", null, cm.charName + "："), cm.text)))
          : null) : null);
  }
  // 小票：白纸、虚线分隔、底边一排锯齿（上月结算和单笔详情共用这一张）
  function Receipt({ sk, title, sub, children, foot }) {
    return h("div", { "data-ledger-receipt": true, style: { position: "relative", margin: "4px 4px 26px", filter: sk.id === "glass" ? "drop-shadow(0 10px 18px rgba(130,110,190,.18))" : "drop-shadow(0 4px 8px rgba(0,0,0,.08))" } },
      h("div", { style: { background: "#fffdfb", padding: "18px 18px 16px", borderRadius: "4px 4px 0 0" } },
        h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 16, fontWeight: 800, letterSpacing: ".08em", color: "#3b3552" } }, title),
        sub ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 10.5, color: "#a09bb3", marginTop: 3, letterSpacing: ".1em" } }, sub) : null,
        h("div", { style: { borderTop: "1px dashed rgba(90,80,120,.28)", margin: "12px 0 8px" } }),
        children,
        foot || null),
      h("div", { "aria-hidden": "true", style: { height: 7, background: "linear-gradient(135deg, #fffdfb 50%, transparent 50%) 0 0/14px 14px repeat-x, linear-gradient(225deg, #fffdfb 50%, transparent 50%) 0 0/14px 14px repeat-x" } }));
  }
  // 条形码：几十根宽窄不一的竖线，按这笔账的 id 定下来，每一笔都不一样但每次打开都一样
  function Barcode({ seed }) {
    const bars = []; let x = 0, n = Math.abs(forumlessHash(seed || "x"));
    for (let i = 0; i < 46 && x < 220; i++) { n = (n * 1103515245 + 12345) & 0x7fffffff; const w = 1 + (n % 3); if (i % 2 === 0) bars.push(h("rect", { key: i, x, y: 0, width: w, height: 38, fill: "#3b3552" })); x += w + 1; }
    return h("svg", { width: "100%", height: 38, viewBox: "0 0 " + x + " 38", preserveAspectRatio: "none", "aria-hidden": "true", style: { display: "block", margin: "12px 0 4px" } }, bars);
  }

  // ============================================================
  // 统计：环形图 + 分类排行 + 近六个月 + 日均 / 今天 / 预算
  // ============================================================
  function Donut({ parts, total, label, cur, sk }) {
    const R = 52, C = 2 * Math.PI * R; let acc = 0;
    return h("div", { style: { position: "relative", width: 140, height: 140, flexShrink: 0 } },
      h("svg", { width: 140, height: 140, viewBox: "0 0 140 140", "aria-hidden": "true" },
        h("circle", { cx: 70, cy: 70, r: R, fill: "none", stroke: "rgba(150,140,190,.14)", strokeWidth: 20 }),
        parts.map((p, i) => { const len = total ? p.v / total * C : 0; const el = h("circle", { key: i, cx: 70, cy: 70, r: R, fill: "none", stroke: p.c, strokeWidth: 20, strokeDasharray: Math.max(0, len - 1.5) + " " + C, strokeDashoffset: -acc, transform: "rotate(-90 70 70)" }); acc += len; return el; })),
      h("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" } },
        h("div", { style: numStyle(sk, total >= 10000 ? 14 : 16) }, fmtMoney(total, cur)),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: sk.fog, marginTop: 2 } }, label)));
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
    const card = extra => Object.assign({ padding: "16px 16px", marginBottom: 14 }, sk.card, extra || {});
    return h("div", { className: "px-5 pb-8" },
      h(MonthNav, { mk, setMk, sk }),
      h("div", { style: card() },
        h("div", { style: { display: "flex", alignItems: "center", gap: 14 } },
          h(Donut, { parts, total, label: kind === "income" ? "本月收入" : "本月支出", cur, sk }),
          h("div", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 } },
            list.length ? list.slice(0, 6).map(c => h("div", { key: c.name, style: { display: "flex", alignItems: "center", gap: 7, fontFamily: F_BODY, fontSize: 12, color: sk.sub } },
              h("span", { style: { width: 8, height: 8, borderRadius: 8, background: catTint(settings, kind, c.name), flexShrink: 0 } }),
              h("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.name),
              h("span", { style: numStyle(sk, 11.5, sk.fog) }, Math.round(c.amount / (total || 1) * 100) + "%")))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: sk.fog } }, kind === "income" ? "这个月还没有收入" : "这个月还没有支出"))),
        h("div", { style: { marginTop: 14 } }, h(CandySeg, { items: [["expense", "支出"], ["income", "收入"]], value: kind, onChange: setKind, sk }))),
      (function () {
        const da = dailyAvg(s.exp, mk);
        if (!da) return null;
        // 今天实际花了多少（她 2026-09-27「那实际的每日消费你没做」）：只在看这个月时有
        const td = todayKey(), todayExp = mk === td.slice(0, 7) ? monthTxns.filter(x => x.date === td && x.type !== "income").reduce((a, x) => a + (Number(x.amount) || 0), 0) : null;
        const row = (label, val, note, key) => h("div", { key, style: { flex: 1, textAlign: "center" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: sk.fog, marginBottom: 4 } }, label),
          h("div", { style: numStyle(sk, 17) }, fmtMoney(val, cur)),
          note ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: sk.fog, marginTop: 2 } }, note) : null);
        return h("div", { "data-ledger-daily": true, style: card({ display: "flex", padding: "14px 10px" }) },
          todayExp != null ? row("今天花了", todayExp, "", "today") : null,
          row("日均支出", da.avg, "按 " + da.days + " 天算", "avg"),
          row("结余", s.net, "", "net"));
      })(),
      // 本月预算：没设过就是一行小字「设个预算」，设了才有那张卡
      (function () {
        const bs = budgetState(props.budget, s.exp, mk);
        const edit = () => requestAppPrompt("每月预算", "每个月打算在" + cur.label + "上花多少？填 0 就是不设。", props.budget || "", v => {
          const n = Math.max(0, Math.round((parseFloat(String(v).replace(/[^\d.]/g, "")) || 0) * 100) / 100);
          props.onSetBudget && props.onSetBudget(n);
        }, "好", { placeholder: "比如 2000" });
        if (!bs) return h("button", { onClick: edit, className: "active:opacity-60", style: { display: "block", margin: "0 0 14px 4px", minHeight: 40, fontFamily: F_BODY, fontSize: 12, color: sk.fog } }, "＋ 设个每月预算");
        const over = bs.left < 0, pct = Math.min(1, bs.used);
        return h("div", { "data-ledger-budget": true, style: card() },
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 13, fontWeight: 700, color: sk.ink } }, "本月预算"),
            h("button", { onClick: edit, "aria-label": "改预算", className: "active:opacity-60 flex items-center gap-1", style: { minHeight: 40, fontFamily: F_BODY, fontSize: 12, color: sk.sub } }, fmtMoney(bs.budget, cur), h(IPencil, { size: 13, color: sk.fog }))),
          h("div", { style: { height: 8, borderRadius: 8, background: "rgba(150,140,190,.16)", overflow: "hidden", marginBottom: 10 } },
            h("div", { style: { height: "100%", width: Math.max(2, pct * 100) + "%", background: over ? sk.over : (sk.id === "glass" ? "linear-gradient(90deg,#a992ec,#f3a6c4)" : sk.accent), borderRadius: 8 } })),
          h("div", { style: { display: "flex", justifyContent: "space-between", fontFamily: F_BODY, fontSize: 11.5, color: sk.sub } },
            h("span", null, "已用 " + Math.round(bs.used * 100) + "%"),
            h("span", { style: { color: over ? sk.over : sk.sub } }, over ? "超了 " + fmtMoney(-bs.left, cur) : "还剩 " + fmtMoney(bs.left, cur))),
          bs.perDay != null ? h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: F_BODY, fontSize: 11.5, color: sk.sub } },
            h("span", null, over ? "这个月已经超支了" : "剩下每天可花（含今天，还有 " + bs.daysLeft + " 天）"),
            over ? null : h("span", { style: numStyle(sk, 14) }, fmtMoney(bs.perDay, cur))) : null,
          // 今天实际花的对上「今天能花的」：超了照实标出来
          bs.perDay != null && !over ? (function () {
            const td = todayKey(), spent = monthTxns.filter(x => x.date === td && x.type !== "income").reduce((a, x) => a + (Number(x.amount) || 0), 0);
            const allow = (bs.left + spent) / bs.daysLeft;   // 今天开张前剩的钱摊到含今天的这几天，就是今天原本能花的
            return h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: F_BODY, fontSize: 11.5, color: sk.sub } },
              h("span", null, "今天已花"),
              h("span", { style: { color: spent > allow ? sk.over : sk.sub } }, fmtMoney(spent, cur) + " / " + fmtMoney(allow, cur)));
          })() : null);
      })(),
      list.length ? h("div", { style: card() },
        h("div", { style: { fontFamily: F_BODY, fontSize: 13, fontWeight: 700, color: sk.ink, marginBottom: 12 } }, kind === "income" ? "收入排行" : "支出排行"),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
          list.map(c => { const tint = catTint(settings, kind, c.name), meta = ((settings.cats || {})[kind] || []).find(x => x.name === c.name) || {};
            return h("div", { key: c.name, style: { display: "flex", alignItems: "center", gap: 10 } },
              h(CatTile, { tint, emoji: meta.emoji || c.emoji, size: 32, sk }),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { display: "flex", justifyContent: "space-between", fontFamily: F_BODY, fontSize: 12.5, color: sk.ink, marginBottom: 5 } },
                  h("span", null, c.name),
                  h("span", { style: numStyle(sk, 12.5) }, fmtMoney(c.amount, cur) + "  ·  " + Math.round(c.amount / (total || 1) * 100) + "%")),
                h("div", { style: { height: 6, borderRadius: 6, background: "rgba(150,140,190,.14)", overflow: "hidden" } },
                  h("div", { style: { height: "100%", width: Math.max(3, c.amount / maxCat * 100) + "%", background: tint, borderRadius: 6 } })))); }))) : null,
      h("div", { style: card() },
        h("div", { style: { fontFamily: F_BODY, fontSize: 13, fontWeight: 700, color: sk.ink, marginBottom: 12 } }, "近六个月支出"),
        h("div", { style: { display: "flex", alignItems: "flex-end", gap: 10, height: 120 } },
          six.map(x => h("div", { key: x.m, style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 5 } },
            h("div", { style: numStyle(sk, 9.5, sk.fog) }, x.v ? fmtNum(Math.round(x.v)) : ""),
            h("div", { style: { width: "100%", maxWidth: 26, height: Math.max(3, x.v / sixMax * 80), borderRadius: 7,
              background: x.m === mk ? (sk.id === "glass" ? "linear-gradient(180deg,#f3a6c4,#a992ec)" : sk.accent) : "rgba(150,140,190,.28)" } }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: x.m === mk ? sk.ink : sk.fog, fontWeight: x.m === mk ? 700 : 400 } }, parseInt(x.m.split("-")[1], 10) + "月"))))));
  }

  // ============================================================
  // 账单：月份 + 全部/支出/收入 + 搜索 + 按天分组的流水
  // ============================================================
  function BillsView(props) {
    const { sk, code, cur, data, settings } = props;
    const [mk, setMk] = useState(thisMonthKey());
    const [kind, setKind] = useState("all");
    const [q, setQ] = useState(null);   // null＝没在搜；字符串＝在搜（搜的时候跨月）
    const all = data.txns.filter(x => x.currency === code);
    const kw = q == null ? "" : q.trim();
    const monthTxns = all.filter(x => (kw ? true : monthKey(x.date) === mk) && (kind === "all" || (kind === "income" ? x.type === "income" : x.type !== "income"))
      && (!kw || [x.note, x.category, String(x.amount)].some(v => String(v || "").indexOf(kw) >= 0)))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return ledgerPage(sk, "账单", props.onBack,
      h("button", { onClick: () => setQ(q == null ? "" : null), "aria-label": "搜索账单", className: "active:opacity-60 flex items-center justify-center", style: { width: 40, height: 40 } }, h(LIcon, { k: "search", size: 20, color: sk.ink })),
      h("div", { className: "px-5 pb-8" },
        q != null ? h("input", { autoFocus: true, value: q, onChange: e => setQ(e.target.value), placeholder: "搜备注、分类或金额", style: Object.assign({ width: "100%", minHeight: 42, padding: "0 14px", fontFamily: F_BODY, fontSize: 14, color: sk.ink, outline: "none", marginBottom: 10 }, sk.well) })
          : h(MonthNav, { mk, setMk, sk }),
        h("div", { style: { marginBottom: 12 } }, h(CandySeg, { items: [["all", "全部"], ["expense", "支出"], ["income", "收入"]], value: kind, onChange: setKind, sk })),
        monthTxns.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
          groupByDay(monthTxns).map(g => h("div", { key: g.date, "data-ledger-day": g.date },
            h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 4px 6px", fontFamily: F_BODY, fontSize: 11.5, color: sk.sub } },
              h("span", null, dayLabel(g.date)),
              h("span", { style: numStyle(sk, 11, sk.fog) }, [g.exp ? "支 " + fmtMoney(g.exp, cur) : "", g.inc ? "收 " + fmtMoney(g.inc, cur) : ""].filter(Boolean).join("  "))),
            h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
              g.rows.map(x => h(TxnRow, { key: x.id, txn: x, cur, sk, settings, onClick: () => props.onOpenTxn(x.id) }))))))
          : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: sk.fog, textAlign: "center", padding: "40px 0" } }, kw ? "没搜到" : "这个月还没有记账")));
  }

  // ============================================================
  // 日历：每格写当天花了多少，花得越多格子越深；点一天看那天的明细
  // ============================================================
  function CalView(props) {
    const { sk, code, cur, data, settings } = props;
    const [mk, setMk] = useState(thisMonthKey());
    const [sel, setSel] = useState(todayKey());
    const [y, m] = mk.split("-").map(Number);
    const first = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate();
    const byDay = {};
    data.txns.forEach(x => { if (x.currency !== code || monthKey(x.date) !== mk) return; const d = byDay[x.date] || (byDay[x.date] = { exp: 0, inc: 0 }); if (x.type === "income") d.inc += Number(x.amount) || 0; else d.exp += Number(x.amount) || 0; });
    const max = Math.max(1, ...Object.keys(byDay).map(k => byDay[k].exp));
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(y + "-" + pad(m) + "-" + pad(d));
    const selRows = data.txns.filter(x => x.currency === code && x.date === sel).sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const today = todayKey();
    return h("div", { className: "px-5 pb-8" },
      h(MonthNav, { mk, setMk, sk }),
      h("div", { "data-ledger-cal": true, style: Object.assign({ padding: "12px 10px", marginBottom: 14 }, sk.card) },
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 } }, "日一二三四五六".split("").map(w => h("div", { key: w, style: { textAlign: "center", fontFamily: F_BODY, fontSize: 10.5, color: sk.fog } }, w))),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 } },
          cells.map((k, i) => { if (!k) return h("div", { key: "e" + i });
            const d = byDay[k], on = sel === k, lv = d && d.exp ? .18 + .62 * (d.exp / max) : 0;
            return h("button", { key: k, onClick: () => setSel(k), className: "active:opacity-70", style: { minHeight: 48, borderRadius: 11, padding: "4px 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
              background: lv ? "rgba(169,146,236," + lv.toFixed(2) + ")" : "transparent", border: on ? "2px solid " + sk.pink : (k === today ? "1px solid " + sk.accent : "1px solid transparent") } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, fontWeight: k === today ? 800 : 500, color: lv > .5 ? "#fff" : sk.ink } }, parseInt(k.slice(8), 10)),
              d && d.exp ? h("span", { style: numStyle(sk, 8.5, lv > .5 ? "#fff" : sk.sub) }, fmtNum(Math.round(d.exp))) : null); }))),
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: sk.sub, margin: "0 4px 8px" } }, dayLabel(sel) + (byDay[sel] ? "　支 " + fmtMoney(byDay[sel].exp, cur) : "")),
      selRows.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, selRows.map(x => h(TxnRow, { key: x.id, txn: x, cur, sk, settings, onClick: () => props.onOpenTxn(x.id) })))
        : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: sk.fog, textAlign: "center", padding: "24px 0" } }, "这天没有记账"));
  }

  // ============================================================
  // 我的：账本样式 + 各种管理入口
  // ============================================================
  function MeView(props) {
    const { sk, settings, cur, code } = props;
    const vis = (settings.visibleTo || []).length;
    const row = (label, note, onClick) => h("button", { onClick, className: "w-full flex items-center active:opacity-70", style: { minHeight: 52, padding: "0 16px", borderTop: "1px solid " + sk.line } },
      h("span", { style: { flex: 1, textAlign: "left", fontFamily: F_BODY, fontSize: 14, color: sk.ink } }, label),
      h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: sk.fog, marginRight: 6 } }, note),
      h("span", { style: { color: sk.fog } }, "›"));
    return h("div", { className: "px-5 pb-8" },
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: sk.sub, margin: "4px 4px 8px" } }, "账本样式"),
      h("div", { style: { display: "flex", gap: 10, marginBottom: 18 } },
        SKIN_LIST.map(x => { const on = sk.id === x.id, pv = ledgerSkin({ skin: x.id });
          return h("button", { key: x.id, onClick: () => props.onSkin(x.id), "data-ledger-skin": x.id, className: "flex-1 text-left active:opacity-80",
            style: Object.assign({}, pv.page, { borderRadius: 18, padding: 12, minHeight: 110, border: on ? "2px solid " + sk.pink : "1px solid " + sk.line, boxShadow: on ? "0 6px 16px rgba(240,143,177,.25)" : "none" }) },
            h("div", { style: Object.assign({ height: 44, marginBottom: 8 }, pv.card) }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, fontWeight: 700, color: pv.ink } }, x.zh + (on ? " ✓" : "")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: pv.fog, marginTop: 2 } }, x.sub)); })),
      h("div", { style: Object.assign({ overflow: "hidden", padding: 0 }, sk.card) },
        h("div", { style: { marginTop: -1 } },
          row("每月预算", (settings.budgets || {})[code] ? fmtMoney(settings.budgets[code], cur) : "没设", props.onEditBudget),
          row("谁能看到我的账", vis ? vis + " 位" : "谁都看不到", () => props.onSettings("visible")),
          row("币种", (settings.currencies || []).length + " 种", () => props.onSettings("cur")),
          row("分类", "", () => props.onSettings("cat")))),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: sk.fog, lineHeight: 1.6, margin: "14px 4px 0" } }, "颜色还能在 设置 → 主题工作台 里单独调。"));
  }

  // 单条流水行：分类小方块 + 备注（没写备注就写分类）+ 时间，右边金额、下面一行小字分类
  function TxnRow(props) {
    const { txn, cur, sk, settings } = props;
    const isInc = txn.type === "income";
    const tm = txn.ts ? new Date(txn.ts) : null;
    const when = dayLabel(txn.date).split(" ")[0] === "今天" || dayLabel(txn.date).split(" ")[0] === "昨天" ? dayLabel(txn.date).split(" ")[0] + (tm ? " " + pad(tm.getHours()) + ":" + pad(tm.getMinutes()) : "") : fmtDay(txn.date);
    return h("button", { onClick: props.onClick, className: "w-full active:opacity-70 text-left",
      style: Object.assign({ padding: "10px 12px", display: "flex", alignItems: "center", gap: 12, minHeight: 58 }, sk.card, { borderRadius: 16 }) },
      h(CatTile, { tint: catTint(settings, isInc ? "income" : "expense", txn.category), emoji: txn.catEmoji || (isInc ? "💰" : "🧾"), size: 38, sk }),
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, fontWeight: 600, color: sk.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, txn.note || txn.category),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: sk.fog, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
          when + ((txn.comments || []).length ? " · 💬" + txn.comments.length : ""))),
      h("div", { style: { textAlign: "right", flexShrink: 0 } },
        h("div", { style: numStyle(sk, 15, isInc ? sk.inc : sk.exp) }, (isInc ? "+ " : "- ") + fmtMoney(txn.amount, cur)),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: sk.fog, marginTop: 2 } }, txn.category)));
  }

  // ============================================================
  // 单笔详情：一张小票 + 编辑/删除 + 角色批注（多选一次生成）
  // ============================================================
  function TxnView(props) {
    const { txn, cur, sk } = props;
    const [pick, setPick] = useState(false);
    const [confirmDel, setConfirmDel] = useState(false);
    const isInc = txn.type === "income";
    const comments = txn.comments || [];
    const charById = id => (props.characters || []).find(c => c.id === id);
    const tm = txn.ts ? new Date(txn.ts) : null;
    const line = (k, v) => h("div", { style: { display: "flex", justifyContent: "space-between", padding: "3px 0", fontFamily: F_BODY, fontSize: 12.5, color: "#5b5570" } }, h("span", null, k), h("span", { style: numStyle({ id: "glass", num: F_BODY }, 12.5, "#3b3552") }, v));
    return h("div", { className: "h-full flex flex-col", style: Object.assign({}, sk.page) },
      h(Head, { zh: isInc ? "这笔进账" : "这笔账", onBack: props.onBack, ink: sk.ink, bg: "transparent", noLine: true,
        right: h("div", { className: "flex items-center" },
          h("button", { onClick: props.onEdit, "aria-label": "改这一笔", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IPencil, { size: 17, color: sk.ink })),
          h("button", { onClick: () => setConfirmDel(true), "aria-label": "删掉这一笔", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40 } }, h(ITrash, { size: 18, color: sk.sub }))) }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-8", style: { overscrollBehavior: "contain" } },
        h(Receipt, { sk, title: isInc ? "进账小票" : "小票", sub: "生活也值得被记录",
          foot: h(Fragment, null, h(Barcode, { seed: txn.id }), h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 11, color: "#8d879f", letterSpacing: ".12em" } }, "记账让生活更清晰")) },
          line(txn.note || txn.category, (isInc ? "+" : "") + fmtMoney(txn.amount, cur)),
          line("分类", (txn.catEmoji ? txn.catEmoji + " " : "") + txn.category),
          line("时间", txn.date + (tm && txn.date === (tm.getFullYear() + "-" + pad(tm.getMonth() + 1) + "-" + pad(tm.getDate())) ? " " + pad(tm.getHours()) + ":" + pad(tm.getMinutes()) : "")),
          line("币种", cur.label + " " + cur.code)),
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: sk.sub } }, "角色批注" + (comments.length ? " · " + comments.length : "")),
          (props.characters && props.characters.length)
            ? h("button", { onClick: () => setPick(true), className: "active:opacity-70",
                style: { minHeight: 36, fontFamily: F_BODY, fontSize: 12.5, fontWeight: 700, color: "#fff", background: sk.id === "glass" ? "linear-gradient(180deg,#f7a8c6,#e889ae)" : sk.accent, borderRadius: 999, padding: "0 16px" } },
                comments.length ? "再让 TA 们说说" : "让角色批注")
            : null),
        comments.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
          comments.map((cm, i) => {
            const ch = charById(cm.charId);
            return h("div", { key: i, style: { display: "flex", gap: 10 } },
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
      pick ? h(CommentPicker, {
        characters: props.characters, moods: props.moods, affinities: props.affinities, existing: comments.map(c => c.charId),
        txn, cur, active: props.active, worldbook: props.worldbook, worldbookFor: props.worldbookFor, uName: props.uName, toast: props.toast,
        onClose: () => setPick(false),
        onDone: cmts => { props.onAddComments(cmts); setPick(false); }
      }) : null,
      confirmDel ? h(ConfirmDialog, { title: "删掉这笔账？", body: "删掉后连同角色批注一起没了。", confirmLabel: "删掉", danger: true, onConfirm: props.onDelete, onCancel: () => setConfirmDel(false) }) : null);
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

    return h("div", { style: { position: "absolute", inset: 0, zIndex: 50, background: pageColor("ledger", "bg2", "rgba(20,18,15,0.4)"), display: "flex", flexDirection: "column", justifyContent: "flex-end" }, onClick: props.onClose },
      h("div", { onClick: e => e.stopPropagation(), style: { background: t.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "20px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)", maxHeight: "78%", display: "flex", flexDirection: "column", marginBottom: lift || 0, transition: "margin-bottom .18s ease" } },
        h("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 4 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: t.ink } }, "让谁看看这笔账"),
          (!busy && chars.length > 1) ? h("button", { onClick: toggleAll, className: "active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: 12, color: allOn ? t.sub : pageColor("ledger", "accent", ACCENT), background: "transparent", border: "none", flexShrink: 0, paddingTop: 3 } }, allOn ? "取消全选" : "全选") : null),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 16, lineHeight: 1.5 } }, "可多选，一次生成全部——省一次 API。TA 们会按各自人设和此刻心情说一句。"),
        busy
          ? h("div", { style: { padding: "40px 0", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "TA 们正在看你的账本…")
          : h(Fragment, null,
              h("div", { style: { flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 } },
                chars.map(c => {
                  const on = sel.includes(c.id); const md = moodOf(c.id);
                  return h("button", { key: c.id, onClick: () => toggle(c.id), className: "active:opacity-80 text-left",
                    style: { display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 12, background: on ? pageColor("ledger", "accent", ACCENT) : t.bg2, border: "1px solid " + (on ? pageColor("ledger", "accent", ACCENT) : t.line) } },
                    h(Avatar, { character: c, size: 32, radius: 9 }),
                    h("div", { style: { minWidth: 0, flex: 1 } },
                      h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: on ? "#fff" : t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.name),
                      md ? h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: on ? "rgba(255,255,255,0.75)" : t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, md) : null));
                })),
              h("button", { onClick: run, disabled: !sel.length, className: "w-full active:opacity-85",
                style: { background: sel.length ? pageColor("ledger", "accent", ACCENT) : t.line, color: "#fff", border: "none", borderRadius: 999, padding: "14px 0", fontFamily: F_BODY, fontSize: 14.5, fontWeight: 600 } },
                sel.length ? "生成批注（" + sel.length + " 人）" : "选一个或几个角色"))));
  }

  // ============================================================
  // 记一笔（新增 / 编辑）：上面分类糖块，中间金额和备注，底下一块数字键盘
  // ⚠️金额不走系统键盘：自己的键盘一直摆着，点分类、按数字、按完成，三下记完
  // ============================================================
  function AddSheet(props) {
    const { curs, edit, sk } = props;
    const [type, setType] = useState(edit ? edit.type : (props.initType === "income" ? "income" : "expense"));
    const [amount, setAmount] = useState(edit ? String(edit.amount) : "");
    const [code, setCode] = useState(edit ? edit.currency : (props.initCode || (curs[0] ? curs[0].code : "CAD")));
    const [cat, setCat] = useState(edit ? { name: edit.category, emoji: edit.catEmoji || "" } : null);
    const [date, setDate] = useState(edit ? edit.date : todayStr());
    const [note, setNote] = useState(edit ? (edit.note || "") : "");
    const [dialog, setDialog] = useState(null); // {kind:'cur'|'cat'}

    const catList = (props.settings.cats[type] || []);
    const cur = curs.find(c => c.code === code) || curs[0];

    const submitCat = vals => { const nc = { name: (vals.name || "").trim(), emoji: (vals.emoji || "").trim() }; if (!nc.name) return; props.onAddCat(type, nc); setCat(nc); setDialog(null); };
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

    const canSave = amount && Number(amount) > 0 && cat;
    const save = () => {
      if (!canSave) return;
      if (edit) {
        props.onSave({ date, type, amount: Math.round(Number(amount) * 100) / 100, currency: code, category: cat.name, catEmoji: cat.emoji || "", note: note.trim() });
      } else {
        props.onSave({ id: "l" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), ts: Date.now(), date, type, amount: Math.round(Number(amount) * 100) / 100, currency: code, category: cat.name, catEmoji: cat.emoji || "", note: note.trim(), comments: [] });
      }
    };
    const glass = sk.id === "glass";
    const key = (k, label) => h("button", { key: k, onClick: () => press(k), "aria-label": k === "del" ? "退格" : label, className: "active:opacity-60",
      style: Object.assign({ minHeight: 46, fontFamily: F_BODY, fontSize: 19, fontWeight: 600, color: sk.ink }, sk.well, { borderRadius: 13 }) }, label);
    const chip = (content, onClick, extra) => h("button", { onClick, className: "active:opacity-70 flex items-center gap-1", style: Object.assign({ minHeight: 36, padding: "0 12px", fontFamily: F_BODY, fontSize: 12.5, color: sk.sub }, sk.well, { borderRadius: 999 }, extra || {}) }, content);

    // 整页，不用半窗（施工规则/no-half-sheet.md）
    return h("div", { style: { position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column" } },
      h("div", { className: "h-full flex flex-col", style: Object.assign({}, sk.page) },
        h(Head, { zh: edit ? "改这一笔" : "记一笔", onBack: props.onClose, ink: sk.ink, bg: "transparent", noLine: true,
          right: h("button", { onClick: save, disabled: !canSave, className: "active:opacity-70", style: { minWidth: 52, height: 32, borderRadius: 999, fontFamily: F_BODY, fontSize: 12.5, fontWeight: 700,
            color: canSave ? "#fff" : sk.fog, background: canSave ? (glass ? "linear-gradient(180deg,#b7a4f2,#9a86e0)" : sk.accent) : "transparent" } }, "完成") }),
        h("div", { style: { padding: "0 20px 10px" } }, h(CandySeg, { items: [["expense", "支出"], ["income", "收入"]], value: type, onChange: v => { setType(v); setCat(null); }, sk })),
        h("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "4px 20px 10px" } },
          h("div", { "data-ledger-catgrid": true, style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 } },
            catList.map(c => { const on = cat && cat.name === c.name;
              return h("button", { key: c.name, onClick: () => setCat(c), className: "active:opacity-70 flex flex-col items-center", style: { gap: 5, padding: "4px 0" } },
                h(CatTile, { tint: catTint(props.settings, type, c.name), emoji: c.emoji, size: 50, on, sk }),
                h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, fontWeight: on ? 700 : 500, color: on ? sk.ink : sk.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" } }, c.name)); }),
            h("button", { onClick: () => setDialog({ kind: "cat" }), className: "active:opacity-70 flex flex-col items-center", style: { gap: 5, padding: "4px 0" } },
              h("div", { style: { width: 50, height: 50, borderRadius: 16, border: "1.5px dashed " + sk.line, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: sk.fog } }, "＋"),
              h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: sk.fog } }, "自定义")))),
        h("div", { className: "shrink-0", style: { padding: "10px 16px calc(env(safe-area-inset-bottom) * 0.4 + 8px)", borderTop: "1px solid " + sk.line, background: glass ? "rgba(250,247,255,.6)" : "transparent", backdropFilter: glass ? "blur(14px)" : "none" } },
          h("div", { "data-ledger-amount": true, style: Object.assign({ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", marginBottom: 8 }, sk.card, { borderRadius: 16 }) },
            h("span", { style: numStyle(sk, 20, sk.sub) }, cur ? cur.symbol : ""),
            h("span", { style: Object.assign({ flex: 1 }, numStyle(sk, 30, amount ? sk.ink : sk.fog)) }, amount || "0.00"),
            amount ? h("button", { onClick: () => setAmount(""), "aria-label": "清空金额", className: "active:opacity-60", style: { width: 40, height: 40, color: sk.fog, fontSize: 18 } }, "⊗") : null),
          h("input", { value: note, onChange: e => setNote(e.target.value), placeholder: "备注：这一笔是什么（可留空）", maxLength: 60,
            style: Object.assign({ width: "100%", minHeight: 40, padding: "0 14px", fontFamily: F_BODY, fontSize: 13, color: sk.ink, outline: "none", marginBottom: 8 }, sk.well) }),
          h("div", { style: { display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" } },
            // 日期：一颗小胶囊，底下压着一个透明的原生日期框，点了照样弹系统日期
            h("label", { className: "active:opacity-70 flex items-center", style: Object.assign({ position: "relative", minHeight: 36, padding: "0 12px", fontFamily: F_BODY, fontSize: 12.5, color: sk.sub }, sk.well, { borderRadius: 999 }) },
              date === todayStr() ? "今天" : fmtDay(date),
              h("input", { type: "date", value: date, onChange: e => e.target.value && setDate(e.target.value), "aria-label": "日期", style: { position: "absolute", inset: 0, opacity: 0, width: "100%" } })),
            curs.length > 1 ? chip(cur.label, () => { const i = curs.findIndex(c => c.code === code); setCode(curs[(i + 1) % curs.length].code); }) : null,
            chip("＋币种", () => setDialog({ kind: "cur" }), { color: sk.fog }),
            cat ? chip((cat.emoji ? cat.emoji + " " : "") + cat.name, null, { color: sk.ink, fontWeight: 700 }) : null),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.1fr", gap: 7 } },
            h("div", { style: { gridColumn: "1 / 4", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 } },
              ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"].map(k => key(k, k)), key("del", "⌫")),
            h("button", { onClick: save, disabled: !canSave, "data-ledger-done": true, className: "active:opacity-80", style: { borderRadius: 16, fontFamily: F_BODY, fontSize: 16, fontWeight: 800, color: "#fff",
              background: canSave ? (glass ? "linear-gradient(170deg,#ffc4d8,#f08fb1)" : sk.accent) : "rgba(150,140,190,.25)",
              boxShadow: canSave && glass ? "0 10px 20px rgba(240,143,177,.4), inset 0 1px 0 rgba(255,255,255,.8)" : "none" } }, edit ? "保存" : "完成")))),
      dialog && dialog.kind === "cat" ? h(FieldDialog, { title: "新分类", submitLabel: "添加",
        fields: [{ key: "name", label: "名称", placeholder: "如 咖啡", required: true }, { key: "emoji", label: "Emoji（可留空）", placeholder: "☕", maxLength: 4 }],
        onSubmit: submitCat, onCancel: () => setDialog(null) }) : null,
      dialog && dialog.kind === "cur" ? h(FieldDialog, { title: "新币种", submitLabel: "添加",
        fields: [{ key: "label", label: "名称", placeholder: "如 日元", required: true }, { key: "code", label: "三字母代码", placeholder: "JPY", maxLength: 4, required: true }, { key: "symbol", label: "符号（可留空）", placeholder: "¥", maxLength: 3 }],
        onSubmit: submitCur, onCancel: () => setDialog(null) }) : null);
  }

  // ============================================================
  // 设置：可见性 + 管理币种(增删改) + 管理分类(增删改)
  // ============================================================
  function SettingsSheet(props) {
    const t = useTheme();
    const s = props.settings;
    const [sel, setSel] = useState((s.visibleTo || []).slice());
    const [tab, setTab] = useState(props.initTab || "visible"); // visible | cur | cat
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
    const editCat = c => setDialog({ kind: "editcat", old: c.name, name: c.name, emoji: c.emoji });
    const submitEditCat = vals => {
      const name = (vals.name || "").trim(), emoji = (vals.emoji || "").trim(); if (!name) return;
      props.onPersist(d => {
        d.settings.cats[catType] = d.settings.cats[catType].map(c => c.name === dialog.old ? { name, emoji } : c);
        d.txns = d.txns.map(x => (x.type === catType && x.category === dialog.old) ? { ...x, category: name, catEmoji: emoji } : x);
      });
      setDialog(null);
    };
    const delCat = c => {
      if (cats.length <= 1) { props.toast && props.toast("至少留一个分类"); return; }
      const used = (props.txns || []).some(x => x.type === catType && x.category === c.name);
      setConfirm({ title: "删掉分类「" + c.name + "」？", body: used ? "已经记过的账会保留原样，只是以后记账不再有这个分类。" : "以后记账不再出现这个分类。", onConfirm: () => { props.onPersist(d => { d.settings.cats[catType] = d.settings.cats[catType].filter(x => x.name !== c.name); }); setConfirm(null); } });
    };
    const addCat = () => setDialog({ kind: "addcat" });
    const submitAddCat = vals => { const name = (vals.name || "").trim(); if (!name) return; if (cats.some(c => c.name === name)) { setDialog(null); return; } props.onPersist(d => { d.settings.cats[catType] = d.settings.cats[catType].concat([{ name, emoji: (vals.emoji || "").trim() }]); }); setDialog(null); };

    const tabBtn = (k, label) => bookTab(tab === k, label, () => setTab(k), pageColor("ledger", "accent", ACCENT));

    const rowStyle = { display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 12, background: t.bg2, border: "1px solid " + t.line };
    const iconBtn = (Icon, onClick, color) => h("button", { onClick, className: "active:opacity-50", style: { background: "transparent", border: "none", padding: 4 } }, h(Icon, { size: 16, color: color || t.fog }));

    // 整页，不用半窗：三个 tab、一屋子币种和分类，半窗里一次只看得见三四行
    return h("div", { style: { position: "absolute", inset: 0, zIndex: 50, display: "flex", flexDirection: "column" } },
      h("div", { className: "h-full flex flex-col", style: Object.assign({}, props.sk ? props.sk.page : paperBg()) },
        h(Head, { zh: "记账设置", onBack: props.onClose, ink: props.sk ? props.sk.ink : pageColor("ledger", "ink", "#33322c"), bg: "transparent", noLine: true,
          right: null }),
        h("div", { style: { display: "flex", gap: 6, padding: "0 20px" } },
          tabBtn("visible", "谁能看到"), tabBtn("cur", "币种"), tabBtn("cat", "分类")),
        h("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "18px 20px 6px", borderTop: "1px solid " + pageColor("ledger", "line", "rgba(60,54,40,.16)"), marginTop: -1 } },
          // ---- 可见性 ----
          tab === "visible" ? h(Fragment, null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginBottom: 14, lineHeight: 1.55 } }, "被选中的角色在聊天里能自然感知你本月的真实收支和几笔大开销，按人设关心或调侃你。只是让 TA 知道，不碰任何余额。"),
            chars.length ? chars.map(c => { const on = sel.includes(c.id);
              return h("button", { key: c.id, onClick: () => toggle(c.id), className: "w-full active:opacity-80", style: { ...rowStyle, marginBottom: 8 } },
                h(Avatar, { character: c, size: 36, radius: 10 }),
                h("span", { style: { flex: 1, textAlign: "left", fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, c.name),
                h("div", { style: { width: 22, height: 22, borderRadius: 999, border: "1.5px solid " + (on ? pageColor("ledger", "accent", ACCENT) : t.line), background: on ? pageColor("ledger", "accent", ACCENT) : "transparent", display: "flex", alignItems: "center", justifyContent: "center" } }, on ? h(ICheck, { size: 13, color: "#fff" }) : null));
            }) : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, textAlign: "center", padding: "20px 0" } }, "先去『人格档案馆』建个角色")) : null,
          // ---- 币种管理 ----
          tab === "cur" ? h(Fragment, null,
            curs.map(c => h("div", { key: c.code, style: { ...rowStyle, marginBottom: 8 } },
              h("div", { style: { width: 30, height: 22, borderRadius: 5, background: "linear-gradient(135deg,#e8cf94,#b89150)", flexShrink: 0 } }),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, c.label + " " + c.symbol),
                h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, letterSpacing: "0.08em" } }, c.code)),
              iconBtn(IPencil, () => editCur(c), t.sub), iconBtn(ITrash, () => delCur(c)))),
            h("button", { onClick: addCur, className: "w-full active:opacity-70", style: { ...rowStyle, justifyContent: "center", border: "1px dashed " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: 13 } }, "＋ 添加币种")) : null,
          // ---- 分类管理 ----
          tab === "cat" ? h(Fragment, null,
            h("div", { style: { display: "flex", gap: 4, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: 3, marginBottom: 14 } },
              ["expense", "income"].map(k => h("button", { key: k, onClick: () => setCatType(k), className: "flex-1 active:opacity-80",
                style: { padding: "7px 0", borderRadius: 8, fontFamily: F_BODY, fontSize: 12.5, fontWeight: 600, border: "none", background: catType === k ? (k === "income" ? INC : EXP) : "transparent", color: catType === k ? "#fff" : t.sub } }, k === "income" ? "收入分类" : "支出分类"))),
            cats.map(c => h("div", { key: c.name, style: { ...rowStyle, marginBottom: 8 } },
              h("span", { style: { fontSize: 19, width: 24, textAlign: "center" } }, c.emoji || "•"),
              h("span", { style: { flex: 1, fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, c.name),
              iconBtn(IPencil, () => editCat(c), t.sub), iconBtn(ITrash, () => delCat(c)))),
            h("button", { onClick: addCat, className: "w-full active:opacity-70", style: { ...rowStyle, justifyContent: "center", border: "1px dashed " + t.line, color: t.fog, fontFamily: F_BODY, fontSize: 13 } }, "＋ 添加分类")) : null),
        // 底部主按钮（可见性 tab 才需要保存；管理 tab 即时生效，给「完成」）
        h("div", { className: "shrink-0", style: { padding: "10px 20px calc(env(safe-area-inset-bottom, 0px) + 14px)", borderTop: "1px solid " + pageColor("ledger", "line", "rgba(60,54,40,.12)") } },
          h("button", { onClick: tab === "visible" ? saveVisible : props.onClose, className: "w-full active:opacity-85",
            style: { background: pageColor("ledger", "accent", ACCENT), color: "#fff", border: "none", borderRadius: 999, padding: "14px 0", fontFamily: F_BODY, fontSize: 14.5, fontWeight: 600 } },
            tab === "visible" ? "保存" : "完成"))),
      // 弹窗们
      dialog && dialog.kind === "addcur" ? h(FieldDialog, { title: "新币种", submitLabel: "添加", fields: [{ key: "label", label: "名称", placeholder: "如 日元", required: true }, { key: "code", label: "三字母代码", placeholder: "JPY", maxLength: 4, required: true }, { key: "symbol", label: "符号（可留空）", placeholder: "¥", maxLength: 3 }], onSubmit: submitAddCur, onCancel: () => setDialog(null) }) : null,
      dialog && dialog.kind === "editcur" ? h(FieldDialog, { title: "改币种", submitLabel: "保存", fields: [{ key: "code", label: "代码（不可改）", value: dialog.code, locked: true }, { key: "label", label: "名称", value: dialog.label, required: true }, { key: "symbol", label: "符号", value: dialog.symbol, maxLength: 3 }], onSubmit: submitEditCur, onCancel: () => setDialog(null) }) : null,
      dialog && dialog.kind === "addcat" ? h(FieldDialog, { title: "新分类", submitLabel: "添加", fields: [{ key: "name", label: "名称", placeholder: "如 咖啡", required: true }, { key: "emoji", label: "Emoji（可留空）", placeholder: "☕", maxLength: 4 }], onSubmit: submitAddCat, onCancel: () => setDialog(null) }) : null,
      dialog && dialog.kind === "editcat" ? h(FieldDialog, { title: "改分类", submitLabel: "保存", fields: [{ key: "name", label: "名称", value: dialog.name, required: true }, { key: "emoji", label: "Emoji", value: dialog.emoji, maxLength: 4 }], onSubmit: submitEditCat, onCancel: () => setDialog(null) }) : null,
      confirm ? h(ConfirmDialog, { title: confirm.title, body: confirm.body, confirmLabel: "删掉", danger: true, onConfirm: confirm.onConfirm, onCancel: () => setConfirm(null) }) : null);
  }

  window.Ledger = Ledger;
})();
