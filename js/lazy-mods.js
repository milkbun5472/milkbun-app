// ============================================================
// 用到才加载（她 2026-10-18：「来吧宝宝开始瘦身」）
// ============================================================
// 群里报「打开秋秋白屏，或者白屏跳黑屏，要重进好几次」——不是她东西多，是 app 自己越长越大：
//   开机要一口气读完、执行完一百五十几个脚本（公共版装订完 9MB），内存小的 iPhone 撑不住就把页面杀掉。
//   大部分人开机那一刻一个大功能都用不到（小游戏、周刊、辩论、攻略……），却每次都得先把它们全执行一遍。
//
// 做法：
//   · index.html 里这些脚本照样写着，只是 type 换成 "text/lazy"（浏览器不执行），data-lazy 写它属于哪一组，
//     地址放在 data-src。版本号 ?v= 照旧在 index.html 里，ship.mjs 换指纹那一套一个字都不用改。
//   · 点进那个功能时 LazyMods.load("组名")：按 index.html 里的先后顺序一份份挂成真脚本、等它执行完。
//     同一组只加载一次；网断了加载失败，下次再点会重试（不会卡在「失败」上）。
//   · 开机后闲下来（20 秒后、页面在前台），把这些文件【只下载不执行】走一遍，service worker 按 ?v= 存下：
//     断网也能打开，开机又不用为它们花内存。
//   · 页面那一层用 components.js 的 LazyGate：没加载完先显示「在打开…」，加载完再画。
//
// ⚠️能放进来的只有【开机和后台都用不到】的那部分。挑之前先查谁在用它（聊天拼提示词、后台提醒、主屏小组件、
//   聊天里的分享卡都算开机就要）。要用的那一小块先拆出来留在开机加载（例：js/games-list.js 的游戏目录）。
(function (g) {
  const loaded = {}, pending = {};
  const tagsOf = group => [...document.querySelectorAll('script[type="text/lazy"][data-lazy]')]
    .filter(s => s.getAttribute("data-lazy") === group);
  const groups = () => [...new Set([...document.querySelectorAll('script[type="text/lazy"][data-lazy]')].map(s => s.getAttribute("data-lazy")))];
  const addScript = src => new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = src; s.async = false;
    s.onload = () => ok();
    s.onerror = () => { try { s.remove(); } catch (e) {} no(new Error("没下载下来：" + src.split("?")[0])); };
    document.head.appendChild(s);
  });
  // 一组里几份【一起下载】，下完再【按登记的先后】一份份执行（群里 2026-10-20：「瘦身后要加载的反而慢了，卡在那里」）。
  //   原来是一份下完、跑完再下一份：小世界那组九份，网慢时就是九个来回排着队。现在等的是最慢那一份。
  //   执行用内联脚本（文本 + sourceURL，报错照样指得出是哪份文件）；下载走 fetch，跟闲时预下载、
  //   service worker、浏览器缓存是同一份。没有 fetch 的环境照旧一份份挂 src（退路）。
  const fetchText = src => fetch(src, { credentials: "same-origin" })
    .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
    .catch(() => { throw new Error("没下载下来：" + src.split("?")[0]); });
  const runText = (src, text) => {
    // sourceURL 只供调试，不能替内联脚本保住 import() 的相对基址。
    // 含动态导入的脚本沿原 src 执行（下载仍并行预取并复用缓存），子目录部署也照脚本位置找模块。
    if (/\bimport\s*(?:\(|\/[/*])/.test(text)) return addScript(src);
    const s = document.createElement("script");
    s.text = text + "\n//# sourceURL=" + src.split("?")[0];
    document.head.appendChild(s);   // 内联脚本挂上就同步执行完
  };
  function load(group) {
    if (loaded[group]) return Promise.resolve();
    if (pending[group]) return pending[group];
    const tags = tagsOf(group);
    if (!tags.length) { loaded[group] = true; return Promise.resolve(); }   // 这一组没登记延后（比如测试或老版本页面）：当它本来就在
    pending[group] = (async () => {
      const todo = tags.filter(t => t.getAttribute("data-done") !== "1");
      if (typeof fetch === "function") {
        const texts = todo.map(t => fetchText(t.getAttribute("data-src")));
        texts.forEach(p => p.catch(() => {}));   // 先挂上接手的，别在等前面那份时冒「未处理」
        for (let i = 0; i < todo.length; i++) {
          const text = await texts[i];   // 前面那份没到，后面的已经在下着了
          await runText(todo[i].getAttribute("data-src"), text);
          todo[i].setAttribute("data-done", "1");   // 半路断了，下次从没跑过的那份接着来，跑过的不重跑
        }
      } else {
        for (const t of todo) { await addScript(t.getAttribute("data-src")); t.setAttribute("data-done", "1"); }
      }
      loaded[group] = true;
      // 这一组的脚本把自己挂到 window 上了：趁 load() 还没交差，先把那几个名字换回替身
      //   （components.js 的 lazyReclaim；晚一步的话 app.js 可能先重画一次，页面就被拆掉重建了）
      try { if (g.LazyReclaim) g.LazyReclaim(); } catch (e) {}
    })().finally(() => { delete pending[group]; });
    return pending[group];
  }
  // 闲下来只下载不执行：浏览器 / service worker 存下来，下次点进去不用等网，断网也打得开
  //   2026-10-20：开机后 6 秒就开始（原来 20 秒，很多人点进去时还没轮到），两份一起下
  function warm() {
    const srcs = [...document.querySelectorAll('script[type="text/lazy"][data-src]')].map(s => s.getAttribute("data-src"));
    let i = 0;
    const next = () => {
      if (i >= srcs.length || document.hidden) return;
      fetch(srcs[i++], { credentials: "same-origin" }).catch(() => {}).finally(() => setTimeout(next, 150));
    };
    next(); next();
  }
  try {
    if (typeof window !== "undefined" && typeof document !== "undefined")
      window.addEventListener("load", () => setTimeout(() => { (window.requestIdleCallback || (f => setTimeout(f, 0)))(warm); }, 6000), { once: true });
  } catch (e) {}
  g.LazyMods = { load, isLoaded: group => !!loaded[group] || !tagsOf(group).length, groups };
})(typeof window !== "undefined" ? window : globalThis);
