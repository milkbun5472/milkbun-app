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
    // ⚠️v67.50 起提示词要的是【一段一项】（一句一项会把整章写成等重的短句，见 storyPrompt），
    //   所以拆句这一步从「顺手兜一下」变成了【唯一的那道工序】——它掉链子，
    //   她就会拿到一张两千字的卡。没有 Intl.Segmenter 的那条路照旧要能把段落拆开。
    const segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "sentence" }) : null;
    const split = body => segmenter
      ? [...segmenter.segment(body)].map(s => s.segment.trim()).filter(Boolean)
      : body.replace(/([。！？!?…]+["」』）)]*)/g, "$1\u0000").split("\u0000").map(s => s.trim()).filter(Boolean);
    return { id, era: eraId, title: text(raw.title) || era(eraId).label, lines: rows.flatMap(x => {
      const sentences = split(text(x.text));
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
      // ⚠️原句是「未写的小事可以创作，改变人物根基的经历只采用用户明确给出的设定」。
      //   她 2026-09-12：「也没有剧情」。病根在这儿：**只准编小事**＝只准写没有后果的事，
      //   于是整章长成一份「我做了什么、后来还不错」的履历。可这条分支是沙盒
      //   （文件头第一行：仅存在本分支，不写主线），本来就不必替他把风险都绕开。
      //   所以这儿改成【钉根基、放事情】：来历身份关系不许改写，这一章里发生的事可以有代价。
      "角色卡明确事实与世界规则是依据：他的来历、身份、已有的关系这些根基不改写。除此之外，这一章里可以真的发生要紧的事——他的决定可以有代价，事情可以往不好的方向去，可以留下收不回来的后果。这条分支是平行创作、只活在这条线上，不回流主线，不必替他把风险都绕开。人物的选择从其性格与处境生长。",
      "过去讲一段过往经历；现在讲本分支正在经历的事情；未来讲分岔条件下可能经历的事情。三个频率属于同一条分支，已写事件相容；同一频率的新章节接着已有进展往下走，不复述旧章、也不拿同一个开场再来一遍。",
      // ⚠️「让事件有可辨认的起因、过程、人物选择及实际结果」这一句 v67.41 就在了，
      //   可它夹在字数要求中间当个从句，整份提示词九段里八段在管【形式】，
      //   于是模型把力气全花在「别写旁白、别称呼她」上，故事本身没人管。
      //   她 2026-09-12：「还是没头没尾。然后也没有剧情」。所以它单独成段，并且给判据。
      "**这一章要是一件事，不是一段生平。**它自己有头有尾：开头落在某一天真正发生的一个场面上——哪件事从哪一刻起不对劲了、他是怎么被卷进去的；中间他得做点什么，而且做了要付出代价；结尾停在一个看得见的画面、或一句真说出口的话上，事情有了结果，他也不再是开头那个人。可以跨越时间与场景；本章落点之后，长线仍能往下走。⚠️判据：这一章单独播给一个没听过前文的人，他能说出「这讲的是什么事、最后怎么了」——说不出来，就是还没成一件事。",
      "同一章里【轻重要分开】：要紧的那一两处摊开来写——他当时看见什么、谁说了什么、他手上在做什么、心里怎么翻的；过场的部分一句带过就行。⚠️别让全章每一句都是同一个分量、同一个速度。尤其别用「后来……再后来……」把关键的地方交代过去：被这样交代过去的那几句，正是故事本该发生的地方。",
      "篇幅按完整章节展开，中文约1200—2200字，其他语言按相当叙事容量。篇幅用于新的经历和变化，不用反复抒情或动作拆解凑数。",
      // ⚠️原来这儿还摆着一串节拍（我怎么到的那儿→我看见什么→我当时怎么判断→我做了什么→后来怎么样）。
      //   那是 v67.42 我为了说清「第一人称」写的，可它整串被当成了【每一章的骨架】照抄——
      //   一份按顺序交代过程的报告，正是「没有剧情」本身（施工规则/prompt-no-content-samples.md）。
      //   人称这件事下面那句「不是他把耳罩拨开一点，是我把耳罩拨开一点」已经说得够清楚了。
      "全篇只有他一个人的声音，用他自己的措辞和他会留意的东西讲出来。**不要旁白、不要第三人称交代**——场景也由他自己说（不是「他把耳罩拨开一点」，是「我把耳罩拨开一点」）。故事里别人说的话可以嵌进来，标明说话者。",
      "他是在【讲一段自己经历过的事】，不是现场直播。哪怕频率是「现在」，也是他回过头来把这段讲完，有始有终；不是一句一句同步播报此刻正在发生什么。",
      "⚠️用户是收听者，不是这段独白的收件人——他不是在对谁说话。广播那头没有人：没有听众、没有称呼（姐姐、宝宝、名字、你，一个都不要）、不提问、不索取回应、不停下来等人接话。用户就算作为一个人出现在他讲的事里，那也只是他故事里的一个人物，这段独白仍然不是说给她听的。",
      "角色自己的目标、生活关系和处境驱动事件，故事不默认围绕用户或恋爱展开。陪听者始终在广播之外。",
      // ⚠️原来这儿要的是【一句一项】。可 accept() 拿到结果之后本来就会再按句界拆一遍
      //   （上面那段代码，v67.41 Codex 写的），所以一句一项一个字都没多换来——
      //   换来的是模型得连着吐四十个 JSON 对象，每一句都写成能单独立住的样子：
      //   句子等长、各自完整、谁也不接谁。那正是她看到的「没有剧情」的手感。
      //   拆句归代码，成文归模型：这一层只在提示词里撤掉，播放器那头一模一样。
      "先把整章正文写完整，再按【自然段】放进lines：一段一项。**不要一句一项**——播放器自己会按句子拆开来播，不用你替它拆；一句一项只会逼着每句话都写成能单独立住的样子，整章就没有轻重了。每一项都是他的第一人称叙述：kind一律填character、speaker填角色姓名，**不要输出kind=narrator的项**。写的是连贯正文，不是章节提纲或梗概。",
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
