// 聊天里那一条居中的时间戳／日期条 —— 一份公共判据（她 2026-09-16 立）
//
// 她原话：**「还有群聊没跟上单聊，不会有日期隔离，过多久界面都是像同一天没有中间那条时间」**。
//
// 查下来这件事在库里写了两遍，而且两遍的分寸和写法都不一样：
//   · 单聊（components.js 的气泡 map）：`i===0 || 换轮了 || 间隔 >3 分钟` 就显示，
//     文案走 fmtStamp——**跨天只写「9/15 14:30」**，是个斜杠日期，混在满屏时刻里看不出是新的一天。
//   · 群聊（GroupThread）：要 `有上一条 && 不同轮 && (跨天 || 间隔 ≥30 分钟)`，
//     文案自己现拼一份。30 分钟那道门在群里几乎天天过不去，于是**整屏一条时间都没有**；
//     跨天那一档虽然判得对，可文案对「今天」只给一个裸时刻，
//     看起来跟同一天里隔了半小时**长得一模一样**——这就是她说的「像同一天」。
//
// 施工规则/one-public-mechanism.md：同一个形状出现第二处 → 抽公共的，**已有的也搬过去**。
// ⚠️同一条规矩的下半句：搬的时候不许顺手改行为。两处的【分寸】本来就不一样，
//   而且都有道理——单聊一对一，换一轮就该有个时刻；群里一轮好几个人说话，
//   换轮只隔几秒，照单聊那样会每几秒糊一条时间上去。所以：
//     · **判据里「多久算断开」由调用方传 minGap**（单聊 3 分钟、群聊 30 分钟）；
//     · **「跨天必须看得出来」两处一样**，这一档不给谁开后门；
//     · 文案只有这一份，谁也别再现拼。
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ChatStamp = api;
})(typeof self !== "undefined" ? self : this, function () {
  const DAY_MS = 86400000;
  const pad = n => String(n).padStart(2, "0");

  // 存档里 ts 有两种写法：多数是 Date.now() 的数字，少数老消息/导入的是字符串。
  // （桩照【写存档的那段】写：pGChat 与 pChat 的 push 都是 `ts: Date.now()`，
  //  而 chat_archive 导回来的那批可能是 ISO 串。）拿不出时间的一律 NaN。
  function timeOf(m) {
    if (!m) return NaN;
    const v = m.ts;
    if (v == null || v === "") return NaN;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    const p = Date.parse(v);
    return Number.isFinite(p) ? p : NaN;
  }

  // 往前找第一条【真的带时间】的。没有 ts 的消息（老存档、系统条）不能顶替，
  // 否则拿它当基准算出来的「跨没跨天」是假的。
  function prevTimed(list, i) {
    for (let j = i - 1; j >= 0; j--) if (Number.isFinite(timeOf(list[j]))) return list[j];
    return null;
  }

  const ymd = d => [d.getFullYear(), d.getMonth(), d.getDate()];
  const sameYMD = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

  // 文案：跨天那一档必须把「哪一天」写在脸上，同一天里才只给时刻。
  // ⚠️「今天」也要写出来：它只会出现在整段聊天的第一条上，那一条正是「这天从这儿开始」。
  function label(ts, now) {
    const d = new Date(ts), n = new Date(now == null ? Date.now() : now);
    const clock = pad(d.getHours()) + ":" + pad(d.getMinutes());
    const dy = ymd(d), ny = ymd(n);
    if (sameYMD(dy, ny)) return "今天 " + clock;
    const y = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1);
    if (sameYMD(dy, ymd(y))) return "昨天 " + clock;
    const sameYear = d.getFullYear() === n.getFullYear();
    return (sameYear ? "" : d.getFullYear() + "年") + (d.getMonth() + 1) + "月" + d.getDate() + "日 " + clock;
  }

  // 只给时刻那一档（同一天里隔久了）
  function clockOnly(ts) {
    const d = new Date(ts);
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  // 判据本体。
  //   prev：上一条【带时间】的消息（用 prevTimed 找），没有就传 null
  //   cur ：这一条
  //   opts：{ now, minGap }  minGap＝同一天里隔多久才值得再来一条时刻
  // 返回 { show, day, text }：day=true 表示这是「新的一天」那一条，文案带日期。
  function decide(prev, cur, opts) {
    const o = opts || {};
    const now = o.now == null ? Date.now() : o.now;
    const minGap = Number.isFinite(o.minGap) ? o.minGap : 3 * 60000;
    const cT = timeOf(cur);
    if (!Number.isFinite(cT)) return { show: false, day: false, text: "" };
    // 整段的第一条：它就是这天的开头，必须写清是哪天
    if (!prev) return { show: true, day: true, text: label(cT, now) };
    const pT = timeOf(prev);
    if (!Number.isFinite(pT) || cT < pT) return { show: false, day: false, text: "" };
    const crossed = !sameYMD(ymd(new Date(cT)), ymd(new Date(pT)));
    // 跨天：**不看 minGap、也不看是不是同一轮**。隔夜那条线比任何节流都重要，
    // 这一档就是她要的「日期隔离」。
    if (crossed) return { show: true, day: true, text: label(cT, now) };
    // 同一轮里连发的几条不各带一个时刻（群里一轮好几个人说话，否则满屏都是时间）
    if (prev.turnId && cur.turnId && prev.turnId === cur.turnId) return { show: false, day: false, text: "" };
    if (cT - pT < minGap) return { show: false, day: false, text: "" };
    return { show: true, day: false, text: clockOnly(cT) };
  }

  return { decide: decide, prevTimed: prevTimed, timeOf: timeOf, label: label, clockOnly: clockOnly, DAY_MS: DAY_MS };
});
