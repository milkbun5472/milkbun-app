(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TemporalAnchor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const TERMS = [{ word: "前天", delta: -2 }, { word: "昨天", delta: -1 }, { word: "今天", delta: 0 }, { word: "明天", delta: 1 }, { word: "后天", delta: 2 }];
  const pad = n => String(n).padStart(2, "0");
  const key = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const atDay = (base, delta) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta, 12, 0, 0, 0);
  const dayDiff = (a, b) => Math.round((atDay(a, 0) - atDay(b, 0)) / 86400000);
  const fromNow = diff => diff === 0 ? "今天" : diff === 1 ? "明天" : diff === -1 ? "昨天" : diff > 1 ? diff + "天后" : Math.abs(diff) + "天前";

  function anchor(text, sourceTs, nowTs) {
    const body = String(text || ""), ts = Number(sourceTs);
    if (!body || !Number.isFinite(ts) || ts <= 0) return "";
    const found = TERMS.filter(x => body.includes(x.word));
    if (!found.length) return "";
    const source = new Date(ts), now = new Date(Number.isFinite(Number(nowTs)) ? Number(nowTs) : Date.now());
    if (!Number.isFinite(source.getTime()) || !Number.isFinite(now.getTime())) return "";
    const mappings = found.map(x => {
      const target = atDay(source, x.delta);
      return "“" + x.word + "”=" + key(target) + "（相对现在是" + fromNow(dayDiff(target, now)) + "）";
    });
    return "〔日期锚：这句话写于 " + key(source) + "；" + mappings.join("，") + "。按绝对日期理解，不能随着今天变化重新解释。〕";
  }

  // ⚠️anchor 只在这句话里【出现了「今天/昨天…」这种相对词】时才出手。
  //   可记忆库里绝大多数条目压根不带这种词（「一起吃了火锅」），于是模型手上
  //   【没有任何时间信息】——它就会默认当成刚刚发生的，前几天的事张口就说成今天的
  //   （小红书群里读者 2026-09-21 报：「明明是前几天的事情他就说是今天的」）。
  //   所以每一条都得带一个戳：这件事是哪天记下的、离现在多久。
  function stamp(sourceTs, nowTs) {
    const ts = Number(sourceTs);
    if (!Number.isFinite(ts) || ts <= 0) return "";
    const source = new Date(ts), now = new Date(Number.isFinite(Number(nowTs)) ? Number(nowTs) : Date.now());
    if (!Number.isFinite(source.getTime()) || !Number.isFinite(now.getTime())) return "";
    const diff = dayDiff(source, now);
    // 未来的时间戳只可能是存档搬家/改过系统时间，别硬说成「-3 天前」
    const when = diff === 0 ? "就是今天" : diff === -1 ? "昨天" : diff < -1 ? Math.abs(diff) + " 天前" : "日期比今天还晚（存档时间对不上）";
    return "〔记于 " + key(source) + "·" + when + "〕";
  }

  return { anchor, stamp, key };
});
