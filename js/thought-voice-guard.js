// Keep task-analysis / reply-planning prose out of the character's inner-voice history.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ThoughtVoiceGuard = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const clean = value => String(value == null ? "" : value).replace(/\s+/g, " ").trim();

  function inspect(value) {
    const text = clean(value);
    if (!text || text.toLowerCase() === "null") return { ok: false, reason: "empty" };

    // These are not forbidden words by themselves. They form a structural pattern:
    // recap/classify the other person, then plan how to manage the reply.
    const other = "(?:Lisa|用户|对方|她|他|TA|ta)";
    const recap = new RegExp(other + ".{0,18}(?:说|问|发|等|主动|故意|刚|现在|这会儿|在)");
    const classify = /(?:是在|像是在|看起来|显然|说明|意味着|其实是|应该是).{0,22}(?:撒娇|示弱|试探|求关注|难过|生气|委屈|心情|想让我|引导)/;
    const replyPlan = /(?:我得|我要|我应该|得赶紧|需要|最好|先).{0,24}(?:回复|回应|接住|安抚|哄|顺着|解释|满足|追问|问问|告诉(?:她|他|TA)|说(?:清楚|一下|我))/;
    const interactionPlan = /(?:我|嘴上).{0,18}(?:会|要|得|应该|肯定会).{0,18}(?:满足|别扭|嘴硬|装作|回应|回复|哄|安抚|接住|顺着|解释|追问)/;
    const topicPlan = /(?:关心|逗|试探|追问|回应|回复).{0,18}(?:一下|她|他|TA).{0,24}(?:把|将).{0,12}(?:话题|对话).{0,12}(?:引向|转到|带到)/;
    const directorTerms = /(?:回复策略|回应方式|情绪需求|用户意图|对话走向|这一轮(?:应该|需要)|接下来(?:应该|要|得)|(?:这些|这都).{0,8}(?:可以|能).{0,8}(?:作为|是我的).{0,8}(?:背景|铺垫)|把话题引向)/;
    // 策略权衡与事后复盘:汇报「想完的结果」而非正在想(2026-08-18 V 案)
    const stratCompare = /比.{0,16}(?:更像对话|更像聊天|要好得多|更稳妥|更有效|更自然)/;
    const wrapup = /(?:看来|总算).{0,12}(?:话题|安抚|哄|聊|误会|情绪).{0,12}(?:好了|过去了|结束了|翻篇|平息)/;
    // 判词 + 结案陈词:给对方的行为盖个定性戳,再给这一轮收尾归档(2026-08-18 Lisa 案:
    // 「她是挑衅，这笔账我记下了」)。这是旁白在结案,不是人在想事情——正在想的时候
    // 根本还没想明白对方什么意思。判词单独出现也算:它本身就是想完了的产物。
    const verdict = new RegExp("(?:" + other + "|这|那)(?:这)?(?:是|就是|分明是|根本是|纯粹是|无非是)(?:在)?\\s*(?:挑衅|示威|试探|挑事|找茬|报复|示弱|撒娇|求关注|演戏|装的|故意的|做给我看)");
    // 「回头再收拾她」这一族和上面的记账是同一个动作：给这一轮盖个戳、把处置推到以后
    //（她 2026-08-27：「心声又在收拾我了」——「这人真是无法无天了，待会儿买完菜回去看我怎么收拾她」）。
    // 判据要窄：只认【收拾／算账／教训】直接跟着人的那种，「回去收拾一下屋子」碰不到。
    // 而且这类狠话本来就是【说得出口的】——真要撂，写进 word 让她听见，不该躺在心声里。
    const ledger = /(?:这笔账|这一笔|这账|这本账).{0,8}(?:记下|记住|先记|算在|留着)|我(?:先)?(?:记下了|记住了)。?$|倒要看看(?:她|他|TA)?(?:能|想|要)|(?:回头|回去|回来|待会儿?|等会儿?|等下|一会儿|改天|晚点|明天|下次)[^。！？!?]{0,14}(?:收拾|教训|治治)\s*(?:她|他|TA|你)|(?:回头|回去|回来|待会儿?|等会儿?|等下|一会儿|改天|晚点|明天|下次)[^。！？!?]{0,14}(?:跟|和|找)?\s*(?:她|他|TA|你)?\s*(?:好好)?算(?:账|总账)/;
    // 「这人真是无法无天了」也是判词，只是骂的是人不是行为——那串定性词里没有这一族
    const verdictLoose = /(?:这人|这家伙|这女人|这丫头|某人)\s*(?:真是|真的是|简直|可真是)?\s*(?:无法无天|翻天|反了|越来越|不像话|太不像话|越发)/;
    const selfPerformance = /(?:我(?:得|要|应该|需要|最好)|得|需要|最好).{0,12}(?:表现出一种|表现得|显得|营造出|呈现出|摆出).{0,24}(?:感觉|样子|态度|语气|形象|反应)?/;
    const selfPresentation = /(?:让自己|把自己|给人).{0,12}(?:看起来|显得|表现得|呈现得|感觉).{0,24}/;
    const hasRecap = recap.test(text);
    const hasClassify = classify.test(text);
    const hasReplyPlan = replyPlan.test(text) || interactionPlan.test(text) || topicPlan.test(text);

    if (directorTerms.test(text)) return { ok: false, reason: "director-language" };
    if (selfPerformance.test(text) || selfPresentation.test(text)) return { ok: false, reason: "self-performance-direction" };
    if (stratCompare.test(text) || wrapup.test(text)) return { ok: false, reason: "post-hoc-planning" };
    if (verdict.test(text) || verdictLoose.test(text) || ledger.test(text)) return { ok: false, reason: "verdict-and-filing" };
    if (hasReplyPlan && (hasRecap || hasClassify)) return { ok: false, reason: "recap-and-reply-plan" };
    if (hasRecap && hasClassify) return { ok: false, reason: "user-analysis" };
    return { ok: true, reason: "inner-voice" };
  }

  // 疏离称呼：把对方当第三方点评的说法（v55.22）。
  // PERSONA_REGISTER_ANCHOR 里已经点名禁过「这女人／这丫头」，她刷完还是被这么叫
  // （2026-08-22）——和句尾句号那次一样，体裁惯性压过提示词，得上确定性的刀。
  // 只换称呼，不动句子：「这丫头真是……」→「她真是……」，念头本身完整留着。
  const APPELLATION = [
    [/(?:这|那)(?:个)?(?:女人|丫头|妮子|姑娘家|小妮子)/g, "她"],
    [/(?:这|那)(?:个)?(?:男人|小子|臭小子)/g, "他"],
    [/(?:这|那)(?:个)?(?:家伙|人儿|小东西|小祖宗|磨人精)/g, null]  // 性别不明 → 用调用方给的代词
  ];
  function normalizeAppellation(value, pronoun) {
    let text = clean(value);
    if (!text) return text;
    const fallback = pronoun || "她";
    APPELLATION.forEach(([re, to]) => { text = text.replace(re, to || fallback); });
    return text;
  }

  function accept(value, pronoun) {
    const text = normalizeAppellation(clean(value), pronoun);
    return inspect(text).ok ? text : null;
  }

  function normalizeAction(value, characterName) {
    let text = clean(value);
    if (!text || text.toLowerCase() === "null") return null;
    const escapeRegExp = value => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const names = [characterName, "他", "她", "TA", "Ta", "ta"].filter(Boolean).map(escapeRegExp);
    const subject = "(?:" + names.join("|") + ")";
    text = text.replace(new RegExp("^\\s*" + subject + "的"), "我的");
    text = text.replace(new RegExp("^\\s*" + subject + "(?=\\s|[，,。！？!?]|[正在刚还又把将盯看坐站躺靠拿走跑按敲点翻伸收低抬转])"), "我");
    return text;
  }

  return { inspect, accept, normalizeAction, normalizeAppellation };
});
