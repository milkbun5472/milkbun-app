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
  // 声音表是异步加载的，第一次问常常是空的。
  // ⚠️光把缓存清掉不够（她 2026-09-13 在原生壳里拿到「这台机器没有中文音色」）：
  //   界面是在某一次渲染时问的，声音表【后来】才填上，没人叫它再问一遍，
  //   那一格就永远停在空的那一版。所以这儿要能【喊一声】，让界面重算。
  const subs = [];
  const notify = () => subs.slice().forEach(f => { try { f(); } catch (e) {} });
  function onVoices(cb) {
    if (typeof cb !== "function") return () => {};
    subs.push(cb);
    return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); };
  }
  // 重新问一次系统。有些内核压根不发 voiceschanged，只是【被问过之后】才把表填上，
  // 所以调用方过一会儿再问一次是必要的，不是保险起见。
  function refresh() { cache = null; return voices(); }
  try {
    if (typeof speechSynthesis !== "undefined" && speechSynthesis.addEventListener) {
      speechSynthesis.addEventListener("voiceschanged", () => { cache = null; notify(); });
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

  // ---- 念一句：先问那张嘴，不行就退回系统音色 ----
  // ⚠️降级链只有这一份（施工规则/one-public-mechanism.md）：两个电台都从这儿念。
  //   Mac 没开、端点报错、音频播不出来——统统退回系统音色，**不许哑掉、不许卡住**。
  //   电台最要紧的是「一直在播」，声音好不好听是第二位的。
  const mouthOn = () => { try { return typeof voiceMouthReady === "function" && voiceMouthReady(); } catch (e) { return false; } };
  function speak(text, opts) {
    const o = opts || {};
    const done = { at: false };
    const end = () => { if (!done.at) { done.at = true; if (typeof o.end === "function") o.end(); } };
    const fail = e => { if (!done.at) { done.at = true; if (typeof o.fail === "function") o.fail(e); } };
    const t = String(text || "").trim();
    if (!t) { end(); return { cancel() { done.at = true; } }; }
    let audio = null, stopped = false;
    // 系统音色那一条（也是所有失败的落点）
    const bySystem = () => {
      if (stopped || done.at) return;
      try {
        if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return fail(new Error("这台设备不会念"));
        const u = new SpeechSynthesisUtterance(t);
        const picked = pick(o.seed);
        if (picked) u.voice = picked;
        u.lang = (picked && picked.lang) || "zh-CN";
        u.rate = Number(o.rate) > 0 ? Number(o.rate) : 1;
        u.pitch = 1;                       // 音高一律不动（「像闹鬼」那次的教训）
        u.onend = end; u.onerror = () => fail(new Error("念到一半断了"));
        speechSynthesis.speak(u);
      } catch (e) { fail(e); }
    };
    if (!mouthOn()) { bySystem(); return { cancel() { stopped = true; try { speechSynthesis.cancel(); } catch (e) {} done.at = true; } }; }
    mouthSpeak(t, { voice: o.voice }).then(blob => {
      if (stopped || done.at) return;
      const url = URL.createObjectURL(blob);
      audio = new Audio(url);
      const drop = () => { try { URL.revokeObjectURL(url); } catch (e) {} };
      audio.onended = () => { drop(); end(); };
      audio.onerror = () => { drop(); audio = null; bySystem(); };
      const p = audio.play();
      if (p && typeof p.catch === "function") p.catch(() => { drop(); audio = null; bySystem(); });
    }).catch(() => { bySystem(); });        // 端点不通＝退回系统音色，不是报错
    return {
      cancel() {
        stopped = true; done.at = true;
        if (audio) { try { audio.pause(); } catch (e) {} audio = null; }
        try { if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); } catch (e) {}
      }
    };
  }
  // ⚠️别再劝人去装「高音质／增强」音色了（她 2026-09-13 实测）：
  //   她在 设置 → 辅助功能 → 朗读内容 → 声音 → 中文 里装好了「月（高音质）」，
  //   可网页这头列出来的还是只有 Tingting / Meijia 那两把基础音色——
  //   **iOS 把高音质那几把留给系统朗读和 Siri，不交给 Web Speech**。
  //   那句引导于是成了假消息，会让人白折腾一趟。说实话，别指一条走不通的路。
  const ENHANCED_HINT = "系统里装的「高音质／增强」音色不给网页用，这儿只有基础那几把。";
  return { pick, hash01, hasEnhanced, speak, mouthOn, options, loadPick, savePick, onVoices, refresh, KEY, zhVoices: () => voices().all, bestVoices: () => voices().best, scan, isEnhanced, ENHANCED_HINT };
});
