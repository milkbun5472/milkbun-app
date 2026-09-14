// 系统音色这一层：谁来念、念多快。
// ⚠️只有这一份（施工规则/one-public-mechanism.md）：旧电台和时间线电台都从这儿要嗓子。
//   原来「按台挑一把中文嗓子」只写在 radio-ui.js 里，时间线电台那边连挑都没挑、
//   用的是系统列表里的第一把——同一层规则写在一处、第二处没跟上的老形状。
//
// 她 2026-09-13：「系统音色太人机了，有没有别的办法可以免费又不会那么机械」。
// 最便宜的那一刀在这儿：iOS / macOS 的【增强·高级】中文音色是要用户自己去
// 系统设置下载的，装了之后浏览器就列得出来。同样免费，气口比默认那把好一大截。
// 所以挑嗓子先在增强那一档里挑，挑不到才回默认那几把。
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.RadioVoice = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  // 名字或 voiceURI 里带这些字样的，就是下载来的那一档
  const ENHANCED = /premium|enhanced|neural|siri|增强|高级/i;
  const isZh = v => /^zh/i.test((v && v.lang) || "");
  const isEnhanced = v => ENHANCED.test(((v && v.name) || "") + " " + ((v && v.voiceURI) || ""));
  let cache = null;
  function scan(list) {
    const zh = (Array.isArray(list) ? list : []).filter(isZh);
    const good = zh.filter(isEnhanced);
    return { all: zh, best: good.length ? good : zh, enhanced: good.length };
  }
  function voices() {
    if (cache) return cache;
    let list = [];
    try { list = (typeof speechSynthesis !== "undefined" && speechSynthesis.getVoices()) || []; } catch (e) { list = []; }
    cache = scan(list);
    return cache;
  }
  // 声音表是异步加载的，第一次问常常是空的
  try {
    if (typeof speechSynthesis !== "undefined" && speechSynthesis.addEventListener) {
      speechSynthesis.addEventListener("voiceschanged", () => { cache = null; });
    }
  } catch (e) {}
  // 她自己指定的那一把（她 2026-09-13：装了增强音色还是默认那把）。
  // ⚠️「自动优先增强」是猜的：增强音色在不同系统里叫什么、暴不暴露给网页，我们说了不算。
  //   所以给一格手动——顺带它也是诊断：拉开就知道这台机器到底列得出哪几把。
  const KEY = "x_radioVoice";
  function loadPick() {
    try { return String((typeof localStorage !== "undefined" && localStorage.getItem(KEY)) || ""); } catch (e) { return ""; }
  }
  function savePick(uri) {
    try { if (typeof localStorage !== "undefined") localStorage.setItem(KEY, String(uri || "")); } catch (e) {}
    return String(uri || "");
  }
  // 这台机器上所有中文嗓子，按【增强的排前面】给界面列
  function options() {
    const v = voices();
    const good = v.all.filter(isEnhanced), rest = v.all.filter(x => !isEnhanced(x));
    return good.concat(rest).map(x => ({ uri: x.voiceURI || x.name, name: x.name, lang: x.lang, enhanced: isEnhanced(x) }));
  }
  // 0~1 的种子 → 一把嗓子。挑不出来返回 null（那就用浏览器默认的，别硬塞）
  // 她手动指定过就一律用那一把：手动 > 自动，种子不再参与。
  function pick(seed) {
    const v = voices();
    const mine = loadPick();
    if (mine) {
      const hit = v.all.find(x => (x.voiceURI || x.name) === mine);
      if (hit) return hit;
    }
    const list = v.best;
    if (!list.length) return null;
    const n = Number(seed);
    const at = Number.isFinite(n) ? Math.floor(Math.abs(n) * list.length) : 0;
    return list[at % list.length] || list[0];
  }
  // 没有种子可用的地方（一条时间线一把嗓子）：拿字符串自己换一个
  function hash01(str) {
    let x = 0;
    String(str == null ? "" : str).split("").forEach(ch => { x = (x * 31 + ch.charCodeAt(0)) >>> 0; });
    return (x % 1000) / 1000;
  }
  const hasEnhanced = () => voices().enhanced > 0;
  // 装增强音色的路（她的机器是 iPhone，先写 iOS 那一条）
  const ENHANCED_HINT = "系统音色偏硬？去 设置 → 辅助功能 → 朗读内容 → 声音 里装一把增强中文音色，这儿会自动用上。";
  return { pick, hash01, hasEnhanced, options, loadPick, savePick, KEY, zhVoices: () => voices().all, bestVoices: () => voices().best, scan, isEnhanced, ENHANCED_HINT };
});
