// 和好间（言秋提，她 2026-08-31 拍板：「和好间我觉得可以，就先松了吧」）
//
// ⚠️先说清它凭什么存在，不然又是一个「把聊天里已经有的东西挪个地方摆第二遍」——
// 她当天刚因为这个撤掉了外卖那栏「写给陌生人」。
// 主聊天里拿不到的东西只有一样：**他没说出口的那一半**。吵起来的时候他在演
// 「我没事」或者在赌气，那句真话不会出现在气泡里。和好间就摆这一样，外加一个
// 能落地的「各退一步」。别的一概不做——递话主聊天本来就能递。
(function (root) {
  "use strict";

  const HIS_CAP = 420;        // 他那段话的字数上限：三小段，不是一封信
  const MY_LINE_CAP = 200;    // 她递过去那一句
  const GIST_TURNS = 14;      // 往回看几条，找「隔着什么」

  // ── 别扭了没有。她说「就先松了吧」，所以任一条命中就算。──
  // ⚠️只用【已经存着的】信号，一次调用都不花：他此刻的心情、上次说话是什么时候。
  // ⚠️这份跟 app.js 里那份 MOOD_NEG【故意不一样】，不是漏抄：那一份是拿来算好感
  // 涨跌的，凡是负面情绪都得算；这一份问的是「你俩之间是不是有事」。
  // 「累」「疲惫」「焦虑」「害怕」是他自己的状态，跟她没关系——他加了个班就把
  // 和好间点亮，那是噪音。留下来的都是【朝着人去的】那几种。
  //
  // ⚠️分成两张表，是因为【单字做子串】会咬中意思相反的词（她 2026-09-04 报：
  // 「为啥憋笑也会进和好馆」）。心情标签是模型自由写的一句话，不是从清单里选的，
  // 所以「憋」会咬中「憋笑」、「闷」会咬中「闷笑」——他正憋着笑，这儿却摆出一张
  // 「还没了结的那一段」。
  // 把「憋」换成「憋屈」只挡得住这一个词，下次「忍笑」「闷乐」照样漏。所以规矩下在形状上：
  //   **单字只认【整个标签就是这个字】，绝不做子串。** 词表以后怎么加都不会再犯。
  // NEG_SUB＝两个字以上、拿去做子串匹配的；NEG_WORD＝只有一个字、必须整条相等的。
  const NEG_SUB = ["生气", "愤怒", "委屈", "失望", "伤心", "难过", "冷漠", "无语",
    "讨厌", "厌烦", "厌倦", "别扭", "郁闷", "沉闷", "低落", "受伤", "沮丧", "心烦", "烦躁",
    "赌气", "憋屈", "憋闷", "憋气", "憋火", "不快", "嫉妒", "孤独"];
  const NEG_WORD = ["厌", "闷", "烦", "憋"];
  const negHit = label => NEG_SUB.some(w => label.indexOf(w) >= 0) || NEG_WORD.indexOf(label) >= 0;
  const MOOD_FRESH_MS = 72 * 3600000;   // 三天前那条心情不算「此刻」
  const COLD_MS = 72 * 3600000;         // 三天没说话也算别扭——冷战不出声
  function signalOf(o) {
    o = o || {};
    const now = Number(o.now) || Date.now();
    const label = String((o.mood && o.mood.label) || "").trim();
    const moodTs = Number(o.mood && o.mood.ts) || 0;
    const hit = !!label && negHit(label);
    const fresh = moodTs > 0 && now - moodTs <= MOOD_FRESH_MS;
    if (hit && fresh) return { on: true, kind: "mood", why: "他从 " + agoWord(now - moodTs) + "开始，心情一直是「" + label + "」" };
    const last = Number(o.lastTalkTs) || 0;
    if (last > 0 && now - last >= COLD_MS) return { on: true, kind: "cold", why: "你俩已经 " + Math.floor((now - last) / 86400000) + " 天没说过话了" };
    // 心情是负面的但已经旧了：还是给一档弱的——她说了要松
    if (hit) return { on: true, kind: "stale", why: "他上一次的心情是「" + label + "」，那之后没再报过" };
    return { on: false, kind: "", why: "" };
  }
  function agoWord(ms) {
    const h = Math.floor(ms / 3600000);
    if (h < 1) return "刚刚";
    if (h < 24) return h + " 小时前";
    return Math.floor(h / 24) + " 天前";
  }

  // ── 他没说出口的那一半 ──
  // 这一段是整个和好间的全部理由，所以禁令要下得比别处狠：
  // 最容易写坏的方向是【提前和好】——模型天然想把场面收圆，写出一段又懂事又
  // 主动道歉的话，读起来舒服，但那不是这个人此刻真的样子，而且和好这件事一旦
  // 在这儿就办完了，主线里那句话就没得说了。
  const HIS_RULE = "【写他没说出口的那一半】\n"
    + "用第一人称，写他此刻【心里真正在想的】，分三小段，合计 " + HIS_CAP + " 字以内：\n"
    + "① 他真正在意的是【哪一件具体发生过的事】——不是「最近有点不对劲」这种谁都能说的话，"
    + "要指得回上面那段记录里的某一句、某一次、某个他记着的细节；\n"
    + "② 他自己心里清楚的那一点：这件事上他哪儿也不占理，或者他知道自己是怎么把话说重的；\n"
    + "③ 他现在能不能低头——**照实写**。\n\n"
    + "⚠️**绝不许在这儿把架吵完、也绝不许提前和好。** 这不是一封道歉信，是他心里那一半话。"
    + "还在气头上就写还在气头上；不想先开口就写不想先开口；觉得自己没错就写没错。"
    + "**「我知道我错了」「我只是太在乎你了」「其实我心里很难受」这类现成的软话一律不许写**——"
    + "那是台词，不是他。\n"
    + "⚠️也不许滑到另一头去演冷酷：他不是不在意，只是这会儿说不出口。\n"
    + "⚠️这一段【她看得见】，但那是她翻他的心，不是他讲给她听的——所以不要写成对她说话的口气，"
    + "不要出现「你听我说」「我想告诉你」。";

  // ── 各退一步：她递一句过去，他回一句 ──
  // 这一步是【真的往前走了一格】，所以他回的那句必须接住她说的，不许答非所问。
  const REPLY_RULE = "【他回她这一句】\n"
    + "她刚刚递过来一句话（不一定是道歉，可能只是一句台阶、一句问、甚至一句还带着刺的）。"
    + "写他会怎么回，一到三句，短。\n"
    + "⚠️**接住她真正说的那句**：她软下来了就别再端着，她还带着刺就别装没听见。\n"
    + "⚠️别一步跨到和好：真实的和好是【往前挪半步】，不是一句话就没事了。"
    + "他可以还别扭着但松了口，可以只应一声，可以先说件别的把气岔开——这些都比「我原谅你了」真。\n"
    + "⚠️不许写成台词腔的深情告白，也不许写成一句「嗯」就打发了。";

  function hisPrompt(charName, uName, why, gist) {
    return "「" + charName + "」和「" + uName + "」之间这会儿有点别扭。\n"
      + (why ? "【看得见的那一点】" + why + "\n" : "")
      + (gist ? "\n【他俩最近说过的话】\n" + gist + "\n" : "")
      + "\n" + HIS_RULE;
  }
  function replyPrompt(charName, uName, why, gist, his, myLine) {
    return "「" + charName + "」和「" + uName + "」之间这会儿有点别扭。\n"
      + (why ? "【看得见的那一点】" + why + "\n" : "")
      + (gist ? "\n【他俩最近说过的话】\n" + gist + "\n" : "")
      + (his ? "\n【他心里那一半（他自己没说出口的）】\n" + his + "\n" : "")
      + "\n【她刚刚递过来这一句】" + String(myLine || "").trim() + "\n\n"
      + REPLY_RULE;
  }
  const HIS_SHAPE = "{\"his\":\"他心里那一半，三小段\"}";
  const REPLY_SHAPE = "{\"reply\":\"他回的那一到三句\"}";

  const api = {
    HIS_CAP: HIS_CAP, MY_LINE_CAP: MY_LINE_CAP, GIST_TURNS: GIST_TURNS,
    NEG_SUB: NEG_SUB, NEG_WORD: NEG_WORD, MOOD_FRESH_MS: MOOD_FRESH_MS, COLD_MS: COLD_MS,
    signalOf: signalOf, agoWord: agoWord,
    HIS_RULE: HIS_RULE, REPLY_RULE: REPLY_RULE,
    hisPrompt: hisPrompt, replyPrompt: replyPrompt,
    HIS_SHAPE: HIS_SHAPE, REPLY_SHAPE: REPLY_SHAPE
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  // ⚠️叫 MakeupKit 不叫 Makeup：screens.js 里那个页面组件另有名字，两个都是全局，
  // 撞上就是 React #130 白屏（如果馆那次栽过）。跟 IfKit / GachaKit 一个叫法。
  if (root) root.MakeupKit = api;
})(typeof window !== "undefined" ? window : globalThis);
