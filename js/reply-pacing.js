(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ReplyPacing = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function trailingUserBurst(history) {
    const out = [];
    for (let i = (Array.isArray(history) ? history.length : 0) - 1; i >= 0; i--) {
      const m = history[i];
      if (!m || m.recalled || m.kind === "ooc" || m.kind === "system") continue;
      if (m.role === "assistant" || m.role === "char") break;
      if (m.role === "user" || m.role === "narration") out.unshift(m);
    }
    return out;
  }
  // v54.57 放宽：短消息档从 1~2 提到 1~3，且明写「字数只是参考、分量和性格才定节奏」。
  // 旧版按用户字数硬夹气泡数——她的聊天风格是短句调情（「可是我不想」5 个字），
  // 于是每一轮都落进 1~2 条的枷锁，角色被压成「想。」「？」，人格全泄进无长度约束的
  // 心声字段（她 2026-08-22 截图：thought 活蹦乱跳、气泡只剩标点）。
  function band(history, options) {
    if (options && (options.proactive || options.continueMode)) return { min: 1, max: 2, kind: "self_continue" };
    const burst = trailingUserBurst(history);
    const chars = burst.reduce((n, m) => n + String(m.content || "").replace(/\s+/g, "").length, 0);
    if (burst.length <= 1 && chars <= 28) return { min: 1, max: 3, kind: "short" };
    if (burst.length <= 2 && chars <= 100) return { min: 1, max: 4, kind: "normal" };
    return { min: 2, max: 5, kind: "substantial" };
  }
  // 气泡节奏：只有线上单聊有「气泡」这个东西，不能搬去线下叙事。
  function pacing(history, options) {
    const b = band(history, options);
    return "【这一轮的聊天节奏】参考区间 " + b.min + "～" + b.max + " 个短气泡——但字数只是参考，真正定节奏的是【这句话的分量】和【你这个人的性格】：对方一句短短的调情、撒娇、反话、抛梗，分量可能很重，话密的人对着一个字也能连发几条，这正是他的活人感，不许因为对方话短就把自己也压成同样短。该刹住的只有一种：把同一个意思换说法凑数。真有话说时自然超出区间也没关系；没话硬凑才是毛病。";
  }
  // 读懂对方这句话在做什么：与「气泡」无关，线上/线下/群聊/单聊都成立。
  // originally 和 pacing 焊在一起，导致只有线上单聊吃得到——这正是同一个角色
  // 在群聊和线下显得不像同一个人的原因之一（Lisa 2026-08-18）。
  function reading() {
    return "【先理解这句话在做什么】结合关系、语气、表情和前文，判断对方此刻是在撒娇、玩笑、求确认、普通分享、吐槽、真实倾诉还是争执，而不是只按字面关键词反应。先匹配对方实际给出的情绪重量，再用这个角色本人最自然的方式接住：证据不足时保持轻量，不擅自把玩笑变严肃、把抱怨变求建议、把求关注变心理危机；有明确事实表明对方真的受伤或需要帮助时，才放慢并认真追问。一次回复只做必要的事，不重复表达同一意图，也不自动跑完否认、解释、共情、保证、建议等整套话术。具体回应优先于概括自己正在关心；角色差异优先于统一的高情商模板。";
  }
  function guidance(history, options) {
    return pacing(history, options) + "\n" + reading();
  }
  return { trailingUserBurst, band, pacing, reading, guidance };
});
