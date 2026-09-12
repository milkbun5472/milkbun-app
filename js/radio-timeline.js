// 时间线电台：独立沙盒。故事、听过的句子、陪听对话仅存在本分支，不写主线。
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.RadioTimeline = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const KEY = "x_radioTimelines";
  const ERAS = [{ id: "past", label: "过去", freq: "88.1" }, { id: "present", label: "现在", freq: "98.6" }, { id: "future", label: "未来", freq: "108.0" }];
  const text = x => typeof x === "string" ? x.trim() : "";
  const era = id => ERAS.find(x => x.id === id);
  function create(char, topic, limits, lore, id) {
    if (!char || !char.id || !text(char.persona)) throw Error("先选一位写有人设的角色。");
    if (!text(topic)) throw Error("先写下想探索的事。");
    return { id, charId: char.id, name: char.name, persona: char.persona, lore: text(lore), topic: text(topic), limits: text(limits), fragments: [], corrections: [], heard: [], talks: [] };
  }
  function accept(raw, eraId, id) {
    if (!era(eraId)) throw Error("频率无效。");
    const rows = raw && raw.lines;
    if (!Array.isArray(rows) || !rows.length || rows.some(x => !x || !["narrator", "character"].includes(x.kind) || !text(x.text))) {
      throw Error("片段格式不完整，尚未存入这条线。");
    }
    // 仅对新生成结果按句界拆分；旧存档的索引已被听闻记录引用，保持原样。
    const segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "sentence" }) : null;
    return { id, era: eraId, title: text(raw.title) || era(eraId).label, lines: rows.flatMap(x => {
      const body = text(x.text);
      const sentences = segmenter ? [...segmenter.segment(body)].map(s => s.segment.trim()).filter(Boolean) : [body];
      return sentences.map(sentence => ({ kind: x.kind, speaker: x.kind === "narrator" ? "旁白" : text(x.speaker), text: sentence }));
    }) };
  }
  function reveal(branch, fragmentId, index, companionId) {
    const f = branch.fragments.find(x => x.id === fragmentId);
    if (!f || !Number.isInteger(index) || index < 0 || index >= f.lines.length) return branch;
    const who = companionId || "";
    if (branch.heard.some(x => x.fragmentId === fragmentId && x.index === index && x.companionId === who)) return branch;
    // 复制当时实际展示的原文，之后纠正或重写不会篡改陪听者已经听过的版本。
    return { ...branch, heard: branch.heard.concat({ fragmentId, index, companionId: who, era: f.era, ...f.lines[index] }) };
  }
  function companionContext(branch, companionId) {
    return { heard: branch.heard.filter(x => x.companionId === companionId), talks: branch.talks.filter(x => x.companionId === companionId) };
  }
  // 回放只问实际揭示记录，不用当前游标推算；重听不会解锁后文。
  function heardLines(branch, fragmentId) {
    const seen = new Map();
    branch.heard.filter(x => x.fragmentId === fragmentId).forEach(x => {
      if (!seen.has(x.index)) seen.set(x.index, x);
    });
    return [...seen.values()].sort((a, b) => a.index - b.index);
  }
  function storyPrompt(branch, eraId) {
    if (!era(eraId)) throw Error("频率无效。");
    return [
      "以广播中角色的第一人称，讲述自己的一段经历，写成可独立收听的完整故事章节。这是平行创作，不是主线史实或未来预言。",
      "角色卡明确事实与世界规则是依据；未写的小事可以创作，改变人物根基的经历只采用用户明确给出的设定。人物的选择从其性格与处境生长。",
      "过去讲一段过往经历；现在讲本分支正在经历的事情；未来讲分岔条件下可能经历的事情。三个频率属于同一条分支，已写事件相容；同一频率的新章节承接已有进展，不重复开场或复述旧章。",
      "篇幅按完整章节展开，中文约1200—2200字，其他语言按相当叙事容量。让事件有可辨认的起因、过程、人物选择及实际结果；可以跨越时间与场景，本章有落点，长线仍能继续。篇幅用于新的经历和变化，不用反复抒情或动作拆解凑数。",
      "全篇只有他一个人的声音：我怎么到的那儿、我看见什么、我当时怎么判断、我做了什么、后来怎么样，用他自己的措辞和他会留意的东西讲出来。**不要旁白、不要第三人称交代**——场景也由他自己说（不是「他把耳罩拨开一点」，是「我把耳罩拨开一点」）。故事里别人说的话可以嵌进来，标明说话者。",
      "他是在【讲一段自己经历过的事】，不是现场直播。哪怕频率是「现在」，也是他回过头来把这段讲完，有始有终；不是一句一句同步播报此刻正在发生什么。",
      "⚠️用户是收听者，不是这段独白的收件人——他不是在对谁说话。广播那头没有人：没有听众、没有称呼（姐姐、宝宝、名字、你，一个都不要）、不提问、不索取回应、不停下来等人接话。用户就算作为一个人出现在他讲的事里，那也只是他故事里的一个人物，这段独白仍然不是说给她听的。",
      "角色自己的目标、生活关系和处境驱动事件，故事不默认围绕用户或恋爱展开。陪听者始终在广播之外。",
      "先构成完整章节，再将正文按自然句界依序放入lines，每项是一句完整的话，拆句只为播放器换字幕，不把每项写成一次聊天回复。每一项都是他的第一人称叙述：kind一律填character、speaker填角色姓名，**不要输出kind=narrator的项**。保留连贯正文，不输出章节提纲或梗概。",
      "【角色卡原文】\n" + branch.name + "\n" + branch.persona,
      "【相关世界设定】\n" + branch.lore,
      "【用户想探索的事】\n" + branch.topic,
      "【用户指定的边界】\n" + branch.limits,
      "【本分支纠正】\n" + JSON.stringify(branch.corrections),
      "【本分支已写片段（创作，不是主线事实）】\n" + JSON.stringify(branch.fragments),
      "【本次频率】" + era(eraId).label
    ].join("\n\n");
  }
  function companionPrompt(branch, companionId, question) {
    const heard = companionContext(branch, companionId);
    if (!heard.heard.length) throw Error("先一起听到一句，再聊这一段。");
    return [
      "你是坐在用户身边的陪听者，不是广播中的人物。刚才播放的是一条虚构的平行时间线，不是你真实经历过的事实，也不是预言。",
      "广播已经暂停。回应用户此刻的问题，保持你自己的立场；可以不认同故事中的选择，不必评审剧情或强行表达感想。",
      "你对故事的了解仅限下面实际一起听到的原文。没播的片段、独自听过的内容不属于你的见闻。",
      "【实际一起听到】\n" + JSON.stringify(heard.heard),
      "【这条分支里的陪听对话】\n" + JSON.stringify(heard.talks),
      "【用户现在说】\n" + text(question)
    ].join("\n\n");
  }
  return { KEY, ERAS, create, accept, reveal, heardLines, companionContext, storyPrompt, companionPrompt };
});
