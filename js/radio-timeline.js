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
    return { id, era: eraId, title: text(raw.title) || era(eraId).label, lines: rows.map(x => ({ kind: x.kind, speaker: x.kind === "narrator" ? "旁白" : text(x.speaker), text: text(x.text) })) };
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
  function storyPrompt(branch, eraId) {
    if (!era(eraId)) throw Error("频率无效。");
    return [
      "写一个供调频收听的平行故事片段。这是创作，不是主线史实或未来预言。",
      "角色卡明确事实与世界规则是依据；未写的小事可以创作，改变人物根基的经历只采用用户明确给出的设定。人物的选择从其性格与处境生长。",
      "过去补一个片刻；现在呈现本分支的此刻；未来体现分岔条件带来的可能。三个频率属于同一条分支，已写片段要相容。",
      "形式：少量第三人称场景交代与人物直接台词交替；第一人称长叙述只用于情节中实际出现的信、录音或回忆。旁白呈现可观察的事，不替人物宣判内心。",
      "每次只展开一小段，人物台词标明说话者。这里没有主持人、听众或陪听者。",
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
  return { KEY, ERAS, create, accept, reveal, companionContext, storyPrompt, companionPrompt };
});
