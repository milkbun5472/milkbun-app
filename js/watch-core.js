// 一起看的开机那半（2026-10-18 瘦身第九批，从 js/watch.js 拆出来）：聊天里那条「一起看了什么」（watchLogText）、时间换算（WatchKit），这些开机就要。
//   一起看整页在 js/watch.js，点进去才加载（js/lazy-mods.js）。测试会 require 这份，所以递过去的那一包挂在 window，没有 window 时挂 globalThis。
// ============================================================
// 一起看（watch）—— 导入一部电影和它的字幕，在秋秋里放；放到哪，那一段台词就喂给TA。
// 她 2026-09-25 群里有人问「可以搞一起看电影嘛」，她：「做吧宝宝做一版试试，然后页面也弄好看点」。
//
// ⚠️模型看不了视频本身，只读得到字：所以TA「跟着看」靠的是字幕；想让TA看画面，
//   就截一帧发过去（要她用的模型能识图）。没有字幕的片子，TA只能靠截图和她说。
// ⚠️电影文件又大又只该在这台手机上：视频本体和字幕都进 IndexedDB（不进云同步），
//   localStorage 只放一张小卡（x_watch_films：片名、看到哪、跟谁看、聊过的话）。
// ⚠️这是「一起读」的第二处同形状：给TA的那段 system 头走 core.js 的 companionHead，
//   记忆走宿主的 onAddMemory（keepWhereItHappened），不在这儿另写一份（施工规则/one-public-mechanism.md）。
// ============================================================
(function () {
  const SUB_WINDOW = 90;     // 喂给TA的是【刚放过的】这一段台词

  // 看完一段回到单聊，那边的TA知道「我们刚一起看了一会儿」（她 2026-09-25：「加吧」）。
  //   单聊里落一条 watchlog；喂给模型的这一句只写在这儿——单聊回话、recentChat、聊天卡片三处都调它
  //   （施工规则/one-public-mechanism.md）。
  // ⚠️只交接【看到哪、最后那几句原话】，不是摘要也不是记忆：那还是「记住」那条路的事。
  function watchLogText(m, uName, cName) {
    const u = uName || "她", c = cName || "你";
    const span = clock(m.from || 0) + " 看到 " + clock(m.to || 0) + (m.done ? "（看完了）" : "（还没看完）");
    const said = (m.lines || []).map(function (x) { return (x.who === "user" ? u : c) + "：" + String(x.text || ""); }).join("\n");
    return "【你们俩在「一起看」里并排看了一会儿电影《" + (m.title || "一部片子") + "》：从 " + span + "。这件事发生在这个位置，现在回到了聊天】"
      + (said ? "\n【当时边看边说的最后几句·原话】\n" + said : "");
  }
  window.watchLogText = watchLogText;
  function clock(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0)), h0 = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    const two = function (n) { return String(n).padStart(2, "0"); };
    return (h0 ? h0 + ":" + two(m) : String(m)) + ":" + two(ss);
  }
  function stamp(s) {
    const m = /(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})/.exec(String(s || ""));
    if (!m) return NaN;
    return (Number(m[1]) || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number((m[4] + "00").slice(0, 3)) / 1000;
  }
  function cleanLine(t) {
    return String(t || "").replace(/\{[^}]*\}/g, "").replace(/\\[Nn]/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }
  function parseSubs(text) {
    const src = String(text || "").replace(/\r/g, "");
    const out = [];
    if (/^\s*\[Script Info\]/m.test(src) || /^Dialogue:/m.test(src)) {
      src.split("\n").forEach(function (line) {
        const m = /^Dialogue:\s*[^,]*,([^,]+),([^,]+),(?:[^,]*,){6}(.*)$/.exec(line);
        if (!m) return;
        const s = stamp(m[1]), e = stamp(m[2]), t = cleanLine(m[3]);
        if (t && s === s && e === e) out.push({ s: s, e: e, t: t });
      });
    } else {
      src.split(/\n\s*\n/).forEach(function (block) {
        const lines = block.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
        const at = lines.findIndex(function (l) { return l.indexOf("-->") > 0; });
        if (at < 0) return;
        const parts = lines[at].split("-->"), s = stamp(parts[0]), e = stamp(parts[1]);
        const t = cleanLine(lines.slice(at + 1).join(" "));
        if (t && s === s && e === e) out.push({ s: s, e: e, t: t });
      });
    }
    return out.sort(function (a, b) { return a.s - b.s; });
  }
  // 刚放过的那一段（到此刻为止，不往后看——不替她剧透，也不让TA「预知」下一句）
  function recentLines(cues, at) {
    return (cues || []).filter(function (c) { return c.s <= at && c.s >= at - SUB_WINDOW; }).slice(-40).map(function (c) { return "[" + clock(c.s) + "] " + c.t; });
  }
  function cueAt(cues, at) {
    const list = cues || [];
    for (let i = list.length - 1; i >= 0; i--) { if (list[i].s <= at) return list[i].e >= at ? list[i].t : ""; }
    return "";
  }
  function parseSay(raw) {
    const s = String(raw || "").trim();
    const m = s.match(/\{[\s\S]*\}/);
    if (m) { try { const d = JSON.parse(m[0]); const arr = Array.isArray(d.say) ? d.say : (d.say ? [d.say] : []); return arr.map(function (x) { return String(x || "").trim(); }).filter(Boolean); } catch (e) {} }
    return s && !/^[\[{]/.test(s) ? [s] : [];
  }
  // ---- 网上的片子：B 站 / YouTube（她 2026-09-26：「做一个b站和youtube的吧」）----
  // 不走后端，所以只能嵌它们自己的播放器：
  //   · YouTube 的播放器会告诉我们播到哪 → 进度自动跟；
  //   · B 站的不告诉 → 放映厅下面有一块「我这边也按一下」的表，TA 按这块表猜进度。
  //   字幕两家都读不到（浏览器不让），想让 TA 跟台词就自己导 srt；画面也截不了。
  // ⚠️b23.tv 短链要先去 B 站那边问一次才知道是哪个视频，没后端问不了：让她贴完整链接。
  function parseOnlineLink(raw) {
    const u = String(raw || "").trim();
    if (!u) return null;
    let m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(u);
    if (m) {
      const t = /[?&#](?:t|start)=(\d+)/.exec(u);
      return { source: "youtube", vid: m[1], start: t ? Number(t[1]) : 0 };
    }
    m = /(BV[0-9A-Za-z]{10})/.exec(u) || /bilibili\.com\/video\/(av\d+)/i.exec(u);
    if (m) {
      const p = /[?&]p=(\d+)/.exec(u);
      return { source: "bilibili", vid: m[1], page: p ? Number(p[1]) : 1 };
    }
    if (/b23\.tv\//i.test(u)) return { source: "bilibili", short: true };
    return null;
  }
  function biliSrc(film, at) {
    const id = /^av/i.test(film.vid) ? "aid=" + String(film.vid).slice(2) : "bvid=" + film.vid;
    // ⚠️她 2026-09-26「一起看 b 站链接打开黑屏」：B 站的外链播放器现在要带 isOutside=true 才肯在别人家的页面里放，
    //   不带就是一整块黑；分 P 用的是 p（page 留着给老播放器）。
    return "https://player.bilibili.com/player.html?isOutside=true&" + id + "&p=" + (film.page || 1) + "&page=" + (film.page || 1) + "&autoplay=0&high_quality=1&danmaku=0" + (at > 3 ? "&t=" + Math.floor(at) : "");
  }
  // 给测试用：纯函数
  window.WatchKit = { parseOnlineLink: parseOnlineLink, biliSrc: biliSrc, parseSubs: parseSubs, recentLines: recentLines, cueAt: cueAt, clock: clock, parseSay: parseSay };

  // 页面那半要用的，原样递过去
  (typeof window !== "undefined" ? window : globalThis).WatchCore = { clock, cleanLine, parseSubs, recentLines, cueAt, parseSay, parseOnlineLink, biliSrc };
})();
