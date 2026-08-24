(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MoodLabel = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const EN_ZH = Object.freeze({
    proud: "骄傲", pride: "骄傲", accomplished: "有成就感", satisfied: "满足", content: "满足",
    happy: "开心", joyful: "喜悦", excited: "兴奋", cheerful: "愉快", delighted: "欣喜",
    warm: "温柔", tender: "柔软", affectionate: "亲昵", loving: "爱意满满", grateful: "感激",
    calm: "平静", peaceful: "安宁", relaxed: "放松", neutral: "平静", thoughtful: "若有所思",
    curious: "好奇", focused: "专注", determined: "坚定", hopeful: "期待", confident: "自信",
    tired: "疲惫", sleepy: "困倦", bored: "无聊", lonely: "孤独", sad: "难过",
    hurt: "受伤", disappointed: "失望", frustrated: "挫败", annoyed: "烦躁", angry: "生气",
    anxious: "焦虑", worried: "担心", nervous: "紧张", afraid: "害怕", jealous: "吃醋",
    embarrassed: "害羞", shy: "害羞", guilty: "愧疚", confused: "困惑", surprised: "惊讶",
    relieved: "如释重负"
  });
  function localize(label) {
    const raw = String(label == null ? "" : label).trim();
    if (!raw) return raw;
    const key = raw.toLowerCase().replace(/[\s_-]+/g, " ");
    if (EN_ZH[key]) return EN_ZH[key];
    if (/^[a-z][a-z\s_&+/-]*$/i.test(raw)) {
      const parts = key.split(/\s*(?:and|&|\+|\/)\s*/).filter(Boolean);
      const mapped = parts.map(function (p) { return EN_ZH[p]; }).filter(Boolean);
      return mapped.length ? Array.from(new Set(mapped)).join("、") : "心绪复杂";
    }
    return raw;
  }
  function normalizeMood(mood) {
    if (!mood || typeof mood !== "object") return mood;
    return Object.assign({}, mood, { label: localize(mood.label), baseline: localize(mood.baseline), softened: localize(mood.softened) });
  }
  // ── 心情会自己平复（v55.68，她 2026-08-24 问的：「过好久不聊了心情还是会平复的吧」）──
  //
  // 原来不会。moods[id] 只在每轮生成后被覆盖一次，之后就一直躺着；提示词照样把它当
  // 【你此刻的心情】原样注进去。所以三天前那阵气，三天后回来他还在生气，而且是被
  // 提示词【要求】重新演一遍。
  //
  // 积温（jiwen）那五根轴本来就有随时间回归设定点的漂移（valenceRegress 0.005/分钟），
  // 但它的状态只 stash 在 window.__jiwen 里做观测，从来没回流到心情标签，也没进提示词。
  // 也就是说：会衰减的东西不出口，出口的东西不衰减。这里补的就是这一段接缝——
  // 不动存储（历史照留），只在【注入提示词的那一刻】按放了多久重新表述。
  const SETTLE = Object.freeze([
    { h: 3,  phase: "fresh" },   // 三小时内：还在那股劲里
    { h: 14, phase: "fading" },  // 半天上下：淡了，但提一嘴还想得起来
    { h: Infinity, phase: "gone" } // 隔夜以上：早过去了
  ]);
  // 事情本身没解决的那种情绪，不会因为时间到了就一笔勾销——措辞上留个口子，
  // 别让模型把「淡了」理解成「翻篇了」。
  function settle(label, ts, now) {
    const raw = localize(label);
    const at = Number(ts) || 0;
    if (!raw) return { label: "", phase: "none", hours: 0, note: "" };
    if (!at) return { label: raw, phase: "fresh", hours: 0, note: "" };
    const hours = Math.max(0, (Number(now) || Date.now()) - at) / 3600000;
    const phase = (SETTLE.find(function (r) { return hours < r.h; }) || SETTLE[SETTLE.length - 1]).phase;
    if (phase === "fresh") return { label: raw, phase: phase, hours: hours, note: "" };
    const ago = hours < 24 ? Math.round(hours) + " 小时前" : Math.round(hours / 24) + " 天前";
    if (phase === "fading") {
      return {
        label: raw, phase: phase, hours: hours,
        note: "（这是 " + ago + "、你们上次相处结束时的心情。隔了这么久那股劲多半已经淡下去了，别一上来就接着演它；"
          + "除非那件事本身还没过去，或者眼下又有什么把它勾起来。）"
      };
    }
    return {
      label: "", phase: phase, hours: hours,
      note: "（你们上次相处已经是 " + ago + "，那时的心情早就平复了。此刻的心情由现在这一刻决定，"
        + "不必接着上次那股劲——真有没了结的事，它自己会在心里冒出来。）"
    };
  }

  return { localize: localize, normalizeMood: normalizeMood, settle: settle, EN_ZH: EN_ZH };
});
