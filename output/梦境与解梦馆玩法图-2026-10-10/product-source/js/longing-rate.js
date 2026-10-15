// 思念（动念 connection 轴）每分钟涨多快 —— 一人一个数，不是全库一个数。
//
// 她 2026-09-18：「我们思念值应该是不是固定的是要随机的根据各种 factor 本地算的」
//   「那你看看思念怎么算的，不应该每个人都一样的」。
//
// 病根：app.js 那个 connectionRateFn 只认最后一条消息里的几个关键词，
//   四个硬写的常量（0.0003 / 0.0005 / 0.0010 / 0.0007）——换谁来都是这四个数。
//   于是所有角色想她的速度一模一样，黏人的和清冷的一起在同一分钟撞上阈值。
//
// ⚠️这一层只许有这一份（施工规则/one-public-mechanism.md）：算在这儿、app.js 只负责
//   把手上那几样现成的料递进来。别在调用点再补一个「不过这个角色要慢一点」。
//
// ⚠️每一档都是【倍率】，各自封在一个窄区间里，谁也吃不掉别人：
//   一个因素最多把速度改到一倍半或者砍掉一半，六个叠起来才拉得开差距。
//   这样任何一样读不到（没配性情、没日程、没心情）都只是少一个倍率，不会塌成 0 或炸上天。
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LongingRate = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BASE = 0.0007;          // 原来那个默认值，留作中心点：谁都不改的话还是它
  const FLOOR = 0.00012, CEIL = 0.0045;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

  // ① 上一句话把话说到哪儿了（原来那四档，改成倍率保留）
  function contextMul(lastMessage) {
    const c = String((lastMessage && lastMessage.content) || "");
    if (!c) return 1;
    if (/晚安|睡了|去睡|睡觉/.test(c)) return 0.45;              // 好好道过晚安
    if (/出门|上班|开会|上课|忙|有事/.test(c)) return 0.72;       // 知道对方在忙
    if (c.replace(/\s+/g, "").length < 8) return 1.42;           // 敷衍短句，心里没底
    return 1;
  }

  // ② 这个人本来是什么性子。读的是【已有的性情锚点】那份（EmotionA 的 temperament），
  //    不另立一张词表——那张表是她自己审过的，再抄一份就是两处要同步。
  //    socialBias：0.28（慢热疏离）… 0.40（默认）… 0.68（黏人／外向／话多）
  function temperMul(temperament) {
    const t = temperament || {};
    const social = clamp(num(t.socialBias, 0.40), 0.2, 0.8);
    const sens = clamp(num(t.sensitivity && t.sensitivity.connection, 1), 0.75, 1.35);
    // 0.28 → 0.70、0.40 → 1.00、0.68 → 1.70，再被 sens 拉一把
    return clamp((1 + (social - 0.40) * 2.5) * sens, 0.55, 1.9);
  }

  // ③ 好感度。⚠️不许让它单独决定一切：好感 0 的人也会想她（讨厌也是一种惦记），
  //    所以这一档只在 0.75~1.25 之间动。
  function affinityMul(affinity) {
    return clamp(0.75 + clamp(num(affinity, 50), 0, 100) / 200, 0.75, 1.25);
  }

  // ④ TA 此刻在干嘛（日程那一段的 type）。睡着的人不会一分钟比一分钟更想你。
  const BUSY = { sleep: 0.22, work: 0.62, create: 0.68, meal: 0.95, social: 0.80, out: 0.85, coffee: 1.05, rest: 1.18 };
  function busyMul(seqType) {
    const k = String(seqType || "").toLowerCase();
    return Object.prototype.hasOwnProperty.call(BUSY, k) ? BUSY[k] : 1;
  }

  // ⑤ 此刻的心情。只认几类大方向，认不出就是 1——**不认识的词一律不猜**。
  function moodMul(moodLabel) {
    const m = String(moodLabel || "");
    if (!m) return 1;
    if (/想|念|舍不得|空|孤单|寂寞|委屈|难过|低落|失落|不安|没安全感/.test(m)) return 1.30;
    if (/烦|躁|气|恼|生气|不爽/.test(m)) return 1.12;            // 气也是一种憋着要说话
    if (/累|困|倦|乏/.test(m)) return 0.70;
    if (/专注|投入|忙|沉浸/.test(m)) return 0.62;
    if (/平静|松弛|自在|满足|踏实/.test(m)) return 0.88;
    return 1;
  }

  // ⑥ 天生的那点差别：拿角色 id 揉一个稳定的数出来。
  //    ⚠️这一档【不是随机】——它每次都一样，所以同一个人今天和明天的底子是同一个；
  //    但两个设定完全一样的角色也不会一模一样。随机的那一档是下面第⑦个。
  function innateMul(charId) {
    const s = String(charId || "");
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 0.86 + ((h >>> 0) % 1000) / 1000 * 0.28;              // 0.86 ~ 1.14
  }

  // ⑦ 每次算都抖一下：思念不是秒表。rand 注入进来，测试里才能钉死。
  function jitterMul(rand) {
    const r = typeof rand === "function" ? rand() : Math.random();
    return 0.9 + clamp(num(r, 0.5), 0, 1) * 0.2;                 // 0.9 ~ 1.1
  }

  // 每一档各是多少，界面上要说得出来（她 2026-09-14 那次「莫名其妙归零」之后的规矩：
  // 算出一个数就要能说出它是怎么来的）。
  function explain(input) {
    const o = input || {};
    return {
      context: contextMul(o.lastMessage),
      temper: temperMul(o.temperament),
      affinity: affinityMul(o.affinity),
      busy: busyMul(o.seqType),
      mood: moodMul(o.moodLabel),
      innate: innateMul(o.charId)
    };
  }

  function compute(input) {
    const o = input || {};
    const parts = explain(o);
    let r = BASE;
    Object.keys(parts).forEach(k => { r *= parts[k]; });
    r *= jitterMul(o.rand);
    return clamp(r, FLOOR, CEIL);
  }

  return { compute, explain, contextMul, temperMul, affinityMul, busyMul, moodMul, innateMul, jitterMul, BASE, FLOOR, CEIL };
});
