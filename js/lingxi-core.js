// ============================================================
// 心有灵犀 · 纯逻辑（她 2026-10-30：「我和角色先各自想一个词，然后我们各自用这俩词的关联想一个新词，
//   如果是一样的就得分，不一样就不得分，然后下一轮继续用我俩的关键词来想」）
//   比对、计分、拼给 TA 的提示词都在这里；没有 React、没有 DOM，测试直接跑。
//   ⚠️给 TA 的提示词只拿【上一轮亮出来的两个词】和更早的往期——她这一轮写的词在揭晓前一个字都不进去。
// ============================================================
(function () {
  "use strict";
  // 比对用：去掉首尾空白、标点、符号、中间的空格，全角半角归一，大小写不论
  function norm(w) {
    let s = String(w == null ? "" : w);
    try { s = s.normalize("NFKC"); } catch (e) {}
    try { s = s.replace(/[\s\p{P}\p{S}]/gu, ""); } catch (e) { s = s.replace(/[\s.,!?;:'"()\[\]{}<>~`@#$%^&*_+=|\\/\-，。！？；：、“”‘’（）【】《》「」『』…—·～]/g, ""); }
    return s.toLowerCase();
  }
  function same(a, b) { const x = norm(a); return !!x && x === norm(b); }
  // 模型回的词：只要一个词，掐掉引号、换行和多余的话
  function cleanWord(w) {
    let s = String(w == null ? "" : w).split(/\r?\n/)[0].trim();
    s = s.replace(/^[「『“"'《【\s]+|[」』”"'》】。！!？?，,\s]+$/g, "").trim();
    return s.slice(0, 20);
  }
  function counted(r) { return !!(r && (r.hit || r.manual)); }
  function score(rounds) { return (rounds || []).filter(counted).length; }
  function newGame() { return { id: "lingxi_" + Date.now().toString(36), status: "open", start: null, pair: null, rounds: [], openSay: [], talk: [] }; }
  // 揭晓一轮：pair 是这一轮桌上的两个词，mine/yours 是两人各写的新词
  function reveal(state, mine, yours, say, thought) {
    const r = { n: state.rounds.length + 1, pair: state.pair.slice(), mine: mine, yours: yours, hit: same(mine, yours), manual: false, say: say || [], thought: String(thought || "").trim(), talk: (state.talk || []).slice() };
    state.talk = [];
    state.rounds.push(r);
    state.pair = [mine, yours];
    return r;
  }
  // 「算我们一样」：只管没自动对上的那几轮，再点一下就撤回
  function toggleManual(state, n) {
    const r = state.rounds.find(function (x) { return x.n === n; });
    if (r && !r.hit) r.manual = !r.manual;
    return state;
  }
  function verdict(r) { return r.hit ? "对上了" : r.manual ? "字不一样，她说算你们一样" : "没对上"; }
  function historyText(rounds, uName) {
    if (!rounds || !rounds.length) return "（还没开始，这是第一轮）";
    return rounds.slice(-12).map(function (r) {
      return "第 " + r.n + " 轮：桌上「" + r.pair[0] + "」和「" + r.pair[1] + "」→ " + uName + " 写「" + r.mine + "」，你写「" + r.yours + "」，" + verdict(r);
    }).join("\n");
  }
  function talkText(talk, uName) {
    return (talk || []).map(function (l) { return (l.who === "me" ? uName : "你") + "：" + l.text; }).join("\n");
  }
  const GAME_LINE = function (uName) {
    return "你在跟 " + uName + " 玩「心有灵犀」：两个人先各自悄悄想一个起始词；之后每一轮，桌上摆着两人最新的那两个词（一个是她的，一个是你的），"
      + "两个人各自悄悄写一个能同时连上这两个词的新词，一起亮出来，一模一样就得一分。下一轮再拿刚亮出来的这两个词接着连。";
  };
  // 开局：TA 自己想起始词。她的起始词这时还锁着，不进提示词。
  function openPrompt(o) {
    return GAME_LINE(o.uName) + (o.who || "")
      + "\n\n现在是开局，你先想你的起始词。" + o.uName + " 也在想她的，你们互相看不到。"
      + "\n起始词照你自己脑子里先冒出来的来：可以跟你这个人、你最近的日子、你们俩有关，也可以就是这会儿想到的东西。是一个词或很短的词组，具体、两个人都认得。"
      + "\nsay 是亮词之前你嘴上说的话（可空）——不许透露你的词。" + (o.sayFree || "")
      + "\nthought 是这一下你心里真在想的东西：这个词是怎么从你脑子里冒出来的。就是你脑子里那几句自言自语，照你这个人想事情的样子来；它是心里话，不是在给谁讲解你怎么选词。她只会在亮词以后看到。"
      + "\n\n只输出 JSON：{\"thought\":\"你心里怎么想的\",\"word\":\"你的起始词\",\"say\":[\"可空\"]}";
  }
  // 每一轮：只给桌上那两个词 + 往期。她这一轮写的词不在这里（揭晓前拿不到）。
  function roundPrompt(o) {
    const st = o.state, last = st.rounds[st.rounds.length - 1];
    return GAME_LINE(o.uName) + (o.who || "")
      + "\n\n【往期】\n" + historyText(st.rounds, o.uName)
      + ((st.talk || []).length ? "\n\n【这一轮写词之前你们聊的】\n" + talkText(st.talk, o.uName) : "")
      + "\n\n【这一轮，第 " + (st.rounds.length + 1) + " 轮】桌上的两个词：「" + st.pair[0] + "」（" + o.uName + " 的）和「" + st.pair[1] + "」（你的）。"
      + "\n" + o.uName + " 已经悄悄写好了她的词，你看不到。你要写一个能同时连上这两个词的新词，想跟她写到一块儿去："
      + "你多了解她、你们之间有过什么、前面几轮她怎么想的，心里有数就照着猜，没数就照你自己的脑子。"
      + (o.easy ? "这局你让着她：挑她一眼就会想到的那个方向。" : "照你自己的脑子去猜，猜不中也是你们俩的事。")
      + "\nword 是一个词或很短的词组，不是一句话；别原样用桌上那两个词。"
      + "\n\nsay 是亮词前你嘴上说的（可空，多半不用说）——不许透露你这一轮的词；亮了以后你另有机会说。" + (o.sayFree || "")
      + "\nthought 是这一下你心里真在想的东西：这两个词勾起了你什么——你自己的日子、身边的人、跟她的事，哪个先冒出来就是哪个——念头又是怎么落到这个词上的。就是你脑子里那几句自言自语，照你这个人想事情的样子来；它是心里话，不是在给谁讲解你怎么选词。她只会在亮词以后看到。"
      + "\n\n只输出 JSON：{\"say\":[\"可空\"],\"thought\":\"你心里怎么走到这个词的\",\"word\":\"这一轮你写的词\"}";
  }
  // 写词之前先聊：TA 还没定词，只是聊这两个词；她这一轮的词还没写，自然也不在这里
  function talkPrompt(o) {
    const st = o.state;
    return GAME_LINE(o.uName) + (o.who || "")
      + "\n\n【往期】\n" + historyText(st.rounds, o.uName)
      + "\n\n【这一轮，第 " + (st.rounds.length + 1) + " 轮】桌上的两个词：「" + st.pair[0] + "」（" + o.uName + " 的）和「" + st.pair[1] + "」（你的）。两个人都还没写这一轮的词，写之前先聊两句。"
      + "\n你也还没定你的词。聊什么、露多少照你这个人来：想跟她对上就往一个方向带，想逗她就绕着说、虚晃一下，嘴硬不说也行。她说的话你可以信，也可以不全信。"
      + ((st.talk || []).length ? "\n\n【这一轮刚才聊的】\n" + talkText(st.talk, o.uName) : "")
      + "\n\n" + o.uName + " 刚说：" + o.line
      + "\n" + (o.sayFree || "")
      + "\n\n只输出 JSON：{\"say\":[\"你回她的话\"]}";
  }
  // 亮词以后的反应（她 2026-10-31：「我们亮了第二组词但是他还在重新反应第一组的，而且还很八股」）：
  //   原来反应跟出词挤在同一枪里，那一枪还看不见她的词，只能回头说上一轮——永远慢一拍。
  //   亮完再问一次：两个词都在眼前，说的是眼前这一对。
  function reactPrompt(o) {
    const st = o.state, r = o.round;
    const what = r ? "第 " + r.n + " 轮刚亮出来：桌上是「" + r.pair[0] + "」和「" + r.pair[1] + "」，" + o.uName + " 写了「" + r.mine + "」，你写了「" + r.yours + "」，" + verdict(r) + "。"
      : "起始词刚亮出来：" + o.uName + " 的是「" + st.start[0] + "」，你的是「" + st.start[1] + "」。";
    return GAME_LINE(o.uName) + (o.who || "")
      + "\n\n【往期】\n" + historyText(st.rounds.slice(0, r ? -1 : undefined), o.uName)
      + (r && (r.talk || []).length ? "\n\n【这一轮写词之前你们聊的】\n" + talkText(r.talk, o.uName) : "")
      + "\n\n【刚刚】" + what
      + (r && r.thought ? "\n你当时心里是这么想的：" + r.thought : "")
      + "\n\n说你看到她这个词的那一下：它让你想到她什么、你们俩的脑子差在哪儿或者想到一块儿去了在哪儿。说的得是眼前这两个词、只有这一对才说得出的话，照你这个人平时跟她说话的样子；不是每轮都要说点评或者鼓劲。"
      + "\n" + (o.sayFree || "")
      + "\n\n只输出 JSON：{\"say\":[\"你的话\"]}";
  }
  function recap(state, uName, cName) {
    const rs = state.rounds, s = score(rs);
    return "一起玩了一局「心有灵犀」：起始词 " + uName + "「" + (state.start ? state.start[0] : "") + "」、" + cName + "「" + (state.start ? state.start[1] : "") + "」，连了 " + rs.length + " 轮，对上 " + s + " 次。"
      + (rs.length ? "最后一轮 " + uName + " 写「" + rs[rs.length - 1].mine + "」，" + cName + " 写「" + rs[rs.length - 1].yours + "」。" : "");
  }
  const api = { norm, same, cleanWord, counted, score, newGame, reveal, toggleManual, verdict, historyText, openPrompt, roundPrompt, talkPrompt, reactPrompt, talkText, recap };
  if (typeof window !== "undefined") window.LingxiCore = api;
  if (typeof module !== "undefined") module.exports = api;
})();
