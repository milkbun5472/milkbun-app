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
  // 条数区间整段撤掉（她 2026-09-25：「改吧」）。
  // 以前按她那句话的字数报「参考区间 1～3 / 1～4 / 2～5 个短气泡」，放在每轮尾部、离生成最近，
  // 她那种短句一来就是 1～3——v54.57 放宽过一次、后面补了「超出也没关系」，照样被区间压着。
  // 定条数的只剩两样：这句话的分量和这个人的性格；她用 OOC 立了条数准则时照准则。
  // 气泡节奏：只有线上单聊有「气泡」这个东西，不能搬去线下叙事。
  // 她用 OOC 立的长期准则里定了条数/长短时,这一轮的节奏就照准则走,不再报区间。
  // 以前准则压在 system 前段,每轮尾部又递一句「参考区间 1～3 个短气泡」——
  // 尾部离生成最近,于是准则记下了、回复还是短(她 2026-09-25 截图:立了「至少12条」照样三两句)。
  const LENGTH_RULE = /\d+\s*条|条数|几条|气泡|话多|话少|话密|发得?密|回复.{0,6}(长|短|多|少)|(长|短|多|少)一?点.{0,4}(回|说|发)/;
  function lengthRules(directives) {
    return (directives || []).map(d => String((typeof d === "string" ? d : d && d.text) || "").trim()).filter(t => t && LENGTH_RULE.test(t));
  }
  function pacing(history, options) {
    const rules = lengthRules(options && options.directives);
    if (rules.length) return "【这一轮的聊天节奏】发几条、每条多长，照你答应过她的长期准则来：" + rules.map(t => "「" + t + "」").join("") + "。每一条都是真想说的话，一个意思说一遍就往下走。";
    // 主动开口 / 自己续说不是在回她的话,原来那一档 1～2 条照留:没有她那句话可以称分量
    if (options && (options.proactive || options.continueMode)) return "【这一轮的聊天节奏】这是你自己开口、不是在回她，一两条短气泡说清想说的就够。";
    return "【这一轮的聊天节奏】发几条短气泡、每条多长，看你此刻有多少真想说的话，和你这个人平时怎么说话；对方那句的长短不决定你的长短。一个意思说一遍就往下走。";
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
  return { trailingUserBurst, lengthRules, pacing, reading, guidance };
});
