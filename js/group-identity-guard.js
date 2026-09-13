(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GroupIdentityGuard = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function aliases(member) {
    const name = String(member && member.name || "").trim(), out = [];
    if (name) out.push(name);
    const chars = Array.from(name);
    if (chars.length >= 2 && chars.length <= 4 && /[\u3400-\u9fff]/.test(chars[chars.length - 1])) out.push("阿" + chars[chars.length - 1]);
    return [...new Set(out)];
  }
  function selfVocative(text, member) {
    const names = aliases(member);
    if (!names.length) return false;
    const lead = "(?:哎呀|哎|呀|欸|诶|唉|喂|好啦|不是|我说)?[，,、\\s]*";
    const re = new RegExp("^" + lead + "(?:" + names.map(esc).join("|") + ")[，,！!？?～~：:]", "u");
    return re.test(String(text || "").trim());
  }
  function sanitize(rawItems, members, userName) {
    const roster = new Map((members || []).filter(x => x && x.name).map(x => [String(x.name).trim(), x]));
    const items = [], dropped = [], thoughtsDropped = [];
    (Array.isArray(rawItems) ? rawItems : []).forEach((raw, index) => {
      const name = String(raw && raw.name || "").trim(), speaker = roster.get(name);
      if (!speaker || (userName && name === String(userName).trim())) { dropped.push({ index, reason: "not_a_member", name }); return; }
      if (selfVocative(raw.text, speaker)) { dropped.push({ index, reason: "self_vocative", name }); return; }
      const next = { ...raw, name };
      if (next.thought && selfVocative(next.thought, speaker)) { delete next.thought; thoughtsDropped.push({ index, reason: "self_vocative", name }); }
      items.push(next);
    });
    return { items, dropped, thoughtsDropped };
  }
  // ── 只属于别人的那几个字（她 2026-09-12）──────────────────────────────
  //
  // 她只跟顾朝说过「合照」，群里一个字没提，顾暮在群里直接说了「还用得着合照」。
  // 病根不是围栏写漏了——那条隐私边界铁律又长又狠，一直在发。病根是**群聊一枪写完
  // 所有人的台词**：模型写顾暮那几句的时候，顾朝那一段就摊在眼前。
  // 【规则只降概率，代码才保证】——所以这一份不写新禁令，只做一件事：
  // 回复拿回来之后本地对一遍，某个成员嘴里蹦出了【只在别人那段里出现过、
  // 而公开的地方（群聊记录／人设／世界书／共享记忆）一次都没出现过】的字，就判它漏了。
  //
  // ⚠️纯本地字符串比对，不漏就一分钱不花。
  // ⚠️宁可误伤：她 2026-09-12「没事重 roll 就行」。所以判据取严的一边，
  //   代价是偶尔把一句本来没问题的话也重写一次。
  const LEAK_MIN = 2, LEAK_MAX = 6;
  // 标点和空白处断开：跨标点拼出来的 n-gram 不是词，只会白白多几次误伤
  function chunks(text) {
    return String(text || "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  }
  // text 里有哪几段字，只在 forbidden 里出现过、allowed 里一次都没有。
  // 只报最长的那一段：报了「合照」就不再报「合」。
  function leakedWords(text, forbidden, allowed) {
    const bad = String(forbidden || ""), ok = String(allowed || "");
    if (!bad) return [];
    const out = [];
    chunks(text).forEach(seg => {
      const chars = Array.from(seg);
      const taken = new Array(chars.length).fill(false);
      for (let n = Math.min(LEAK_MAX, chars.length); n >= LEAK_MIN; n--) {
        for (let i = 0; i + n <= chars.length; i++) {
          if (taken.slice(i, i + n).some(Boolean)) continue;   // 已经被更长的那一段吃掉了
          const g = chars.slice(i, i + n).join("");
          if (bad.indexOf(g) < 0 || ok.indexOf(g) >= 0) continue;
          out.push(g);
          for (let k = i; k < i + n; k++) taken[k] = true;
        }
      }
    });
    return [...new Set(out)];
  }
  // items: 模型交回来的那一轮；segs: { 成员名: 只有这个人知道的那一段 }；
  // publicText: 这一枪里【大家都看得到】的全部文字（群聊记录、人设、世界书、共享记忆…）。
  function privacyScan(items, segs, publicText) {
    // ⚠️这儿原来有一句「只有一个人有私密段就直接返回」。变异测试里它活了下来——
    //   因为底下 forbidden 本来就是【除自己以外那几段】，只有一个人的时候它是空的，
    //   leakedWords 见空就返回。那一句一个行为都没改，所以删掉（别留一处看着像在管事的死码）。
    const names = Object.keys(segs || {}).filter(k => String((segs || {})[k] || "").trim());
    const hits = [];
    (Array.isArray(items) ? items : []).forEach((row, index) => {
      const name = String(row && row.name || "").trim();
      if (!name || !names.includes(name)) return;
      const forbidden = names.filter(n => n !== name).map(n => segs[n]).join("\n");
      const allowed = String(publicText || "") + "\n" + String(segs[name] || "");
      const words = leakedWords([row.text, row.thought].filter(Boolean).join("\n"), forbidden, allowed);
      if (words.length) hits.push({ index, name, words });
    });
    return hits;
  }
  // 抓到之后补给模型的那一句：点名是谁、漏了哪几个字。
  // ⚠️不是又一条常驻禁令（那一条已经在发了、而且没用）；这是【这一轮真的漏了】之后
  //   指着错处说一次，所以它具体、只发一次、也只在真漏了的时候花那一枪。
  function leakRetryNote(hits) {
    if (!(hits || []).length) return "";
    return "\n\n【上一轮漏了，重写这一轮】" + hits.map(x =>
      "「" + x.name + "」说出了" + x.words.map(w => "「" + w + "」").join("") + "——这几个字只出现在【别人】和用户的私下往来里，"
      + x.name + "根本无从知道").join("；")
      + "。重写这一整轮：那几个字一个都不许出现，也不许换个说法把同一件事说出来（同义词、暗示、旁敲侧击都算）。"
      + "别的成员照常说话，这一轮的内容和走向不用跟着改。";
  }

  function splitBubbles(text) {
    const out = [];
    String(text || "").split(/\n+/).map(x => x.trim()).filter(Boolean).forEach(line => {
      const pieces = line.match(/.*?(?:……|\.\.\.|[。！？!?]+[”’"]?)(?=\s*|$)|.+$/gu) || [line];
      pieces.map(x => x.trim()).filter(Boolean).forEach(x => out.push(x));
    });
    return out;
  }
  return { aliases, selfVocative, sanitize, splitBubbles, leakedWords, privacyScan, leakRetryNote, LEAK_MIN, LEAK_MAX };
});
