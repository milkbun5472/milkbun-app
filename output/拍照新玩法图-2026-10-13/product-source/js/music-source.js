// 音乐源适配：GD 音乐台 https://music.gdstudio.xyz （非商业学习试用）。
// 搜索、播放和两处歌词读取共用；GD 不接收账号 Cookie，不代理账号操作。
const MusicSource = (() => {
  const GD = "https://music-api.gdstudio.xyz/api.php";
  const cache = new Map(), pending = new Map();
  let calls = [];
  const https = value => {
    const s = String(value || "").replace(/^http:/, "https:");
    return /^https:\/\//i.test(s) ? s : "";
  };
  async function gd(params) {
    const key = Object.keys(params).sort().map(k => encodeURIComponent(k) + "=" + encodeURIComponent(params[k])).join("&");
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.value;
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      const now = Date.now();
      // 保存窗口计数，刷新页面也不会把本机配额归零。
      try { calls = JSON.parse(localStorage.getItem("x_gdMusicCalls") || "[]"); } catch (_) {}
      calls = (Array.isArray(calls) ? calls : []).filter(t => Number.isFinite(t) && now - t < 300000);
      if (calls.length >= 45) throw new Error("GD 音乐请求较多，请稍后再试（每五分钟限额）");
      calls.push(now);
      try { localStorage.setItem("x_gdMusicCalls", JSON.stringify(calls)); } catch (_) {}
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const r = await fetch(GD + "?" + key, { credentials: "omit", referrerPolicy: "no-referrer", signal: controller.signal });
        if (!r.ok) throw new Error(r.status === 429 ? "GD 音乐请求限流，请稍后再试" : "GD 音乐暂时不可用（" + r.status + "）");
        const value = await r.json();
        if (cache.size > 150) cache.clear();
        cache.set(key, { value, until: now + (params.types === "url" ? 60000 : 300000) });
        return value;
      } finally { clearTimeout(timer); }
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  }
  // ⚠️海外 IP 是「填了 Cookie 还是放不了 VIP」最常见的那一条（她 2026-09-14 报）：
  //   网易云按【请求的来源 IP】判版权，公共 API 实例多半部署在海外，于是就算你
  //   账号真有 VIP，返回的也还是 30 秒试听或者干脆没有地址。
  //   接口本身留了 realIP 这一格（NeteaseCloudMusicApi 的标准参数），带上就当作从那儿来。
  // ⚠️只有这一份：播放地址那一枪在 app.js 里是自己 fetch 的（要 level/回退），
  //   两处都从这儿要这个值，别各写一个（施工规则/one-public-mechanism.md）。
  const REAL_IP = "116.25.146.177";
  const realIP = () => REAL_IP;
  async function request(config, path, { cacheBust = true } = {}) {
    if (config.provider !== "gd") {
      if (!config.base) throw new Error("先配置网易云搜索接口，或开启 GD 音乐试用");
      const extra = [];
      if (config.cookie && !path.startsWith("/search?")) extra.push("cookie=" + encodeURIComponent(config.cookie));
      extra.push("realIP=" + REAL_IP);
      if (cacheBust) extra.push("timestamp=" + Date.now());
      const r = await fetch(config.base + path + (extra.length ? (path.includes("?") ? "&" : "?") + extra.join("&") : ""));
      if (!r.ok) throw new Error("音乐接口暂时不可用（" + r.status + "）");
      return r.json();
    }
    const u = new URL(path, "https://music.invalid");
    const p = u.searchParams;
    if (u.pathname === "/search" || u.pathname === "/cloudsearch") {
      const rows = await gd({ types: "search", source: "netease", name: p.get("keywords") || "", count: Math.min(30, Number(p.get("limit")) || 20), pages: 1 });
      if (!Array.isArray(rows)) throw new Error("GD 搜索返回异常，请稍后再试");
      return { result: { songs: rows.filter(s => s && s.id && (!s.source || s.source === "netease")).map(s => ({ id: s.id, name: s.name, artists: (Array.isArray(s.artist) ? s.artist : [s.artist]).filter(Boolean).map(name => ({ name })), album: {}, gdPicId: s.pic_id, gdLyricId: s.lyric_id })) } };
    }
    if (u.pathname === "/song/url/v1" || u.pathname === "/song/url") {
      const d = await gd({ types: "url", source: "netease", id: p.get("id"), br: 320 });
      return { data: [{ url: https(d && d.url) }] };
    }
    if (u.pathname === "/lyric") {
      const d = await gd({ types: "lyric", source: "netease", id: p.get("id") });
      return { lrc: { lyric: (d && d.lyric) || "" } };
    }
    throw new Error("GD 音乐不提供网易云账号功能，请切回原接口使用");
  }
  async function cover(picId) {
    if (!picId) return "";
    const d = await gd({ types: "pic", source: "netease", id: picId, size: 300 });
    return https(d && d.url);
  }
  return { request, cover, realIP };
})();
