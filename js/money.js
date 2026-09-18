// 钱的显示层 —— 存的永远是人民币，看见的是这个角色那个世界的钱。
//
// 她 2026-09-18：「那就把钱收入公共然后后续任何交易都走一层汇率怎么样？
//   就比如让他转50 换算成日元转账卡直接写50×汇率的数」
//   「每个角色一个，按对方币种写」。
//
// ⚠️**换算只有一个方向。** 存档里、账本里、余额里、模型交回来的金额，永远是人民币；
//   只有【给人看的】和【喂给模型的】那两处出口过这一层。所以没有折返换算、
//   没有误差累积；汇率改了全库立刻一致，历史一条都没被动过；汇率填回 1 就完全复原。
//   ⚠️唯一的例外是 parse()：她在界面上按那个币种输入的数，得折回人民币再存。
//   除了那一处，任何地方把换算后的数写回存档都是错的。
//
// ⚠️这一层只许有这一份（施工规则/one-public-mechanism.md）：
//   phone.js 那个 fmtMoney 已经改成转交给这儿，别再在哪个页面里自己拼 "¥" + n。
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.Money = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT = Object.freeze({ code: "CNY", symbol: "¥", rate: 1, pos: "pre", dec: 2 });
  let BOOK = {};

  const numOr = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

  // 一本册子：{charId: {symbol, rate, pos, dec, code}}。app.js 每次状态变了推一次。
  function setBook(book) { BOOK = book && typeof book === "object" ? book : {}; }
  function getBook() { return BOOK; }

  // ⚠️汇率 0 或负数一律当 1：填错一个字不该让所有人的钱变成 0 或者负的。
  function of(charId) {
    const raw = (charId && BOOK[charId]) || null;
    if (!raw) return DEFAULT;
    const rate = numOr(raw.rate, 1);
    return {
      code: String(raw.code || "").slice(0, 8) || DEFAULT.code,
      symbol: String(raw.symbol == null ? DEFAULT.symbol : raw.symbol).slice(0, 4),
      rate: rate > 0 ? rate : 1,
      pos: raw.pos === "post" ? "post" : "pre",
      dec: Math.max(0, Math.min(2, Math.round(numOr(raw.dec, 2))))
    };
  }
  // 这个角色是不是还在用人民币（用来决定要不要在某些地方多写一句）
  function isDefault(charId) { const c = of(charId); return c.rate === 1 && c.symbol === DEFAULT.symbol; }

  function round(n, dec) { const p = Math.pow(10, dec); return Math.round(n * p) / p; }

  // 人民币 → 这个角色那个世界的数（纯数字，不带符号）
  function conv(amountCNY, charId) {
    const c = of(charId);
    return round(numOr(amountCNY, 0) * c.rate, c.dec);
  }
  // 反过来：她在界面上按那个币种敲的数 → 人民币（存档用）
  function parse(input, charId) {
    const c = of(charId);
    const s = String(input == null ? "" : input).replace(/[,，\s¥￥$€£₩円元]/g, "");
    // ⚠️空的要返回 null，不是 0：Number("") 是 0，直接存下去就是把她的余额清零。
    if (!s) return null;
    const v = Number(s);
    if (!Number.isFinite(v)) return null;
    return round(v / c.rate, 2);
  }

  function wrap(text, c) { return c.pos === "post" ? text + " " + c.symbol : c.symbol + text; }

  // 给人看：带千分位
  function fmt(amountCNY, charId) {
    const c = of(charId);
    const v = conv(amountCNY, charId);
    return wrap(v.toLocaleString("en-US", { minimumFractionDigits: c.dec, maximumFractionDigits: c.dec }), c);
  }
  // 紧凑写法：不带千分位。两个用处——
  //   ① 喂给模型（逗号会被当成分隔符读岔）；
  //   ② 卡面上那些窄格子（亲属卡、刷卡通知、引用条），那儿本来就没写过千分位。
  function say(amountCNY, charId) {
    const c = of(charId);
    return wrap(String(conv(amountCNY, charId)), c);
  }

  return { DEFAULT, setBook, getBook, of, isDefault, conv, parse, fmt, say };
});
