// 自动记忆的开环资格闸：
// “未来会做”不等于“值得持续惦记”。只收明确承诺、共同约定、关系裂口、
// 悬而未决的心事与有后果的等待；普通吃饭/洗澡/上班安排仍可记，但不标 open。
(function (root) {
  "use strict";

  const STRONG = /约好|说好|答应|承诺|保证|欠(?:你|他|她|对方)|等(?:你|他|她|对方)(?:回来|回复|回应|答复)|陪(?:你|他|她|对方)|给(?:你|他|她|对方)(?:做|带|买|送|写|打|回)|一起(?:去|做|看|吃|玩|见|过)|见面|赴约|兑现|没和好|还没和好|争执未解决|矛盾未解决|心结|悬着|等待.{0,8}(?:结果|答复|回应|决定|消息)|待确认|待决定|尚未决定|还没决定|没有结果/;
  const RELATION = /关系|恋人|分手|复合|边界|信任|道歉|原谅|释怀|冷战|争执|矛盾|心事|心结|承诺|约定/;
  const ROUTINE = /(?:今天|今晚|今早|明天|明早|明晚|待会|一会儿|等会儿|稍后|下班后|放学后)?.{0,8}(?:吃|喝|煮|点|买)(?:粥|饭|面|早餐|午饭|晚饭|夜宵|咖啡|奶茶|水果)|洗澡|洗头|睡觉|起床|上班|下班|上课|下课|健身|跑步|散步|做饭|收拾|打扫|洗衣|看剧|刷视频|打游戏|回宿舍|回家/;

  function evaluate(entry) {
    const e = entry || {};
    if (!e.open) return { open: false, reason: "not_proposed" };
    if (e.source === "manual") return { open: true, reason: "manual" };
    const text = String(e.text || "").replace(/\s+/g, " ").trim();
    const tags = (Array.isArray(e.tags) ? e.tags : []).join(" ");
    const hay = text + " " + tags;
    if (STRONG.test(hay)) return { open: true, reason: "explicit_commitment_or_unresolved" };
    if (RELATION.test(hay) && Number(e.a || 0) >= 2) return { open: true, reason: "relationship_weight" };
    if (ROUTINE.test(text)) return { open: false, reason: "routine_plan" };
    return { open: false, reason: "future_fact_without_open_loop_evidence" };
  }

  function normalize(entry) {
    const verdict = evaluate(entry);
    return Object.assign({}, entry, { open: verdict.open });
  }

  const api = Object.freeze({ evaluate, normalize });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.OpenLoopGate = api;
})(typeof window !== "undefined" ? window : globalThis);
