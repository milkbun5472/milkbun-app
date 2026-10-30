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
      + "\nthought 是你心里走的那条路：你怎么挑中了这个起始词，你脑子里是怎么转过去的、中间想到过什么又放下了什么。用第一人称，照你这个人平时想事情的方式和你自己的联想写——这是你的心思，不是写给谁看的解说。她只会在亮词以后看到。"
      + "\n\n只输出 JSON：{\"thought\":\"你心里怎么想的\",\"word\":\"你的起始词\",\"say\":[\"可空\"]}";
  }
  // 每一轮：只给桌上那两个词 + 往期。她这一轮写的词不在这里（揭晓前拿不到）。
  function roundPrompt(o) {
    const st = o.state, last = st.rounds[st.rounds.length - 1];
    const prev = last ? "上一轮刚亮出来：" + o.uName + " 写「" + last.mine + "」，你写「" + last.yours + "」，" + verdict(last) + "。"
      : "刚才亮出了起始词：" + o.uName + " 的是「" + st.pair[0] + "」，你的是「" + st.pair[1] + "」。";
    return GAME_LINE(o.uName) + (o.who || "")
      + "\n\n【往期】\n" + historyText(st.rounds, o.uName)
      + ((st.talk || []).length ? "\n\n【这一轮写词之前你们聊的】\n" + talkText(st.talk, o.uName) : "")
      + "\n\n【这一轮，第 " + (st.rounds.length + 1) + " 轮】桌上的两个词：「" + st.pair[0] + "」（" + o.uName + " 的）和「" + st.pair[1] + "」（你的）。"
      + "\n" + o.uName + " 已经悄悄写好了她的词，你看不到。你要写一个能同时连上这两个词的新词。想得分，就得猜她会落在哪儿："
      + "她是什么样的人、你们之间有过什么、前面几轮她是往直白里联想还是往偏处拐，都能拿来猜。"
      + (o.easy ? "这局你让着她：挑她一眼就会想到的那个方向。" : "照你自己的脑子去猜，猜不中也是你们俩的事。")
      + "\nword 是一个词或很短的词组，不是一句话；别原样用桌上那两个词。"
      + "\n\nsay 是你对【" + prev + "】的反应，照你这个人说——对上了、差一点、她想得怎么样、你当时怎么想的，都可以。"
      + "say 只说上一轮那件事；这一轮你写了什么，等亮出来再说。" + (o.sayFree || "")
      + "\nthought 是你心里走的那条路：从桌上那两个词到你写下的这个词，你脑子里是怎么转过去的、中间想到过什么又放下了什么、你猜她会往哪儿想。用第一人称，照你这个人平时想事情的方式和你自己的联想写——这是你的心思，不是写给谁看的解说。她只会在亮词以后看到。"
      + "\n\n只输出 JSON：{\"say\":[\"你对上一轮的反应\"],\"thought\":\"你心里怎么走到这个词的\",\"word\":\"这一轮你写的词\"}";
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
  function recap(state, uName, cName) {
    const rs = state.rounds, s = score(rs);
    return "一起玩了一局「心有灵犀」：起始词 " + uName + "「" + (state.start ? state.start[0] : "") + "」、" + cName + "「" + (state.start ? state.start[1] : "") + "」，连了 " + rs.length + " 轮，对上 " + s + " 次。"
      + (rs.length ? "最后一轮 " + uName + " 写「" + rs[rs.length - 1].mine + "」，" + cName + " 写「" + rs[rs.length - 1].yours + "」。" : "");
  }
  const api = { norm, same, cleanWord, counted, score, newGame, reveal, toggleManual, verdict, historyText, openPrompt, roundPrompt, talkPrompt, talkText, recap };
  if (typeof window !== "undefined") window.LingxiCore = api;
  if (typeof module !== "undefined") module.exports = api;
})();
