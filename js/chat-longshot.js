// 聊天长图（她 2026-10-23「做吧宝宝」）：多选几条消息，拼成一张长图存下来。
//   网页整页截图截不了 app（外面那层固定一屏高，消息在里面那个框里滚），所以自己画。
//   画在 canvas 上，不去拍真实的 DOM：美化 CSS、外链字体图片都不会把它弄坏；画不出来的图就写成一行字。
(function (g) {
  "use strict";
  const W = 750, PAD = 32, AV = 64, GAP = 18, BUB_MAX = 470, FS = 28, LH = 42, SCALE = 1;
  const C = { bg: "#f4f0ea", head: "#3b332a", fog: "#9a8a76", me: "#3b332a", meText: "#fffaf3", ta: "#ffffff", taText: "#2e261e", sys: "#a4968a" };
  const FONT = "-apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";

  const loadImg = src => new Promise(res => {
    if (!src) return res(null);
    const im = new Image();
    if (!/^(data:|blob:)/.test(src)) im.crossOrigin = "anonymous";
    const t = setTimeout(() => res(null), 6000);
    im.onload = () => { clearTimeout(t); res(im); }; im.onerror = () => { clearTimeout(t); res(null); };
    im.src = src;
  });
  const resolve = v => (typeof g.resolveImg === "function" ? g.resolveImg(v) : v) || "";
  // 外链图要是不许跨域，画上去整张就存不了：先试一下能不能读，读不了就当没有
  async function safeImg(src) {
    const im = await loadImg(resolve(src)); if (!im) return null;
    try { const c = document.createElement("canvas"); c.width = c.height = 2; const x = c.getContext("2d"); x.drawImage(im, 0, 0, 2, 2); x.getImageData(0, 0, 1, 1); return im; } catch (e) { return null; }
  }
  function wrap(ctx, text, max) {
    const out = [];
    String(text || "").split("\n").forEach(par => {
      let line = "";
      for (const ch of par) { if (ctx.measureText(line + ch).width > max && line) { out.push(line); line = ch; } else line += ch; }
      out.push(line);
    });
    return out;
  }
  // 一条消息画成什么：text＝气泡，sys＝居中灰字，img＝图
  const LABEL = { voice: "语音", transfer: "转账", redpacket: "红包", takeout: "外卖", callinvite: "通话", recorded: "录音", ficshare: "分享", chatforward: "聊天记录", xhsshare: "分享", shuashare: "分享", shikeshare: "时刻", tarottable: "塔罗", datememory: "约会", zyask: "照影", zyshare: "照影" };
  function shape(m) {
    if (!m || m.recalled) return m && m.recalled ? { t: "sys", text: (m.role === "user" ? "你" : "对方") + "撤回了一条消息" } : null;
    const k = m.kind || "";
    if (k === "system" || k === "narration" || k === "pat" || k === "ooc") return { t: "sys", text: String(m.content || "").replace(/\s+/g, " ").slice(0, 120) };
    const src = m.imageRef || m.url || m.img || (m.imgKey ? m.imgKey : "");
    if ((k === "emote" || k === "photo" || k === "selfie" || k === "image") && src) return { t: "img", src, alt: k === "emote" ? "[表情]" : "[照片]" + (m.desc ? " " + String(m.desc).slice(0, 40) : ""), small: k === "emote" };
    let text = String(m.content || m.desc || "").trim();
    if (LABEL[k]) text = "[" + LABEL[k] + "] " + text;
    return text ? { t: "text", text } : null;
  }

  async function render(opt) {
    const msgs = (opt.msgs || []).map(m => ({ m, s: shape(m) })).filter(x => x.s);
    if (!msgs.length) throw new Error("选的消息里没有能画的");
    const cv = document.createElement("canvas"), ctx = cv.getContext("2d");
    ctx.font = FS + "px " + FONT;
    const avTa = await safeImg(opt.ta && opt.ta.avatar), avMe = await safeImg(opt.me && opt.me.avatar);
    const extra = {};
    if (opt.avatarSrcOf) for (const x of msgs) { const id = x.m.senderId; if (x.m.role !== "user" && id && !(id in extra)) extra[id] = await safeImg(opt.avatarSrcOf(id)); }
    const pickAv = m => m.role === "user" ? avMe : (m.senderId && m.senderId in extra ? extra[m.senderId] : avTa);
    // 先量高度
    const rows = [];
    for (const x of msgs) {
      const s = x.s, me = x.m.role === "user";
      if (s.t === "sys") { ctx.font = "22px " + FONT; const ls = wrap(ctx, s.text, W - PAD * 4); rows.push({ s, me, ls, h: ls.length * 32 + 12 }); continue; }
      const name = !me && opt.group ? String(x.m.senderName || "") : "";
      if (s.t === "img") {
        const im = await safeImg(s.src);
        if (im) { const mw = s.small ? 200 : 380, sc = Math.min(1, mw / im.width, (s.small ? 200 : 520) / im.height); rows.push({ s, me, im, w: im.width * sc, h: im.height * sc + (name ? 30 : 0), name }); continue; }
        s.t = "text"; s.text = s.alt;
      }
      ctx.font = FS + "px " + FONT;
      const ls = wrap(ctx, s.text, BUB_MAX - 44);
      const w = Math.min(BUB_MAX, Math.max(...ls.map(l => ctx.measureText(l).width)) + 44);
      rows.push({ s, me, ls, w, h: ls.length * LH + 26 + (name ? 30 : 0), name });
    }
    const HEAD = 120, FOOT = 70;
    const H = HEAD + rows.reduce((a, r) => a + Math.max(r.s.t === "sys" ? 0 : AV, r.h) + GAP, 0) + FOOT;
    if (H > 30000) throw new Error("太长了，少选几条");
    cv.width = W * SCALE; cv.height = H * SCALE; ctx.scale(SCALE, SCALE);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "top";
    ctx.fillStyle = C.head; ctx.font = "600 32px " + FONT; ctx.textAlign = "center";
    ctx.fillText(String(opt.title || "").slice(0, 20), W / 2, 40);
    if (opt.sub) { ctx.fillStyle = C.fog; ctx.font = "20px " + FONT; ctx.fillText(opt.sub, W / 2, 82); }
    ctx.textAlign = "left";
    let y = HEAD;
    const round = (x, yy, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, yy); ctx.arcTo(x + w, yy, x + w, yy + h, r); ctx.arcTo(x + w, yy + h, x, yy + h, r); ctx.arcTo(x, yy + h, x, yy, r); ctx.arcTo(x, yy, x + w, yy, r); ctx.closePath(); };
    for (const r of rows) {
      if (r.s.t === "sys") {
        ctx.fillStyle = C.sys; ctx.font = "22px " + FONT; ctx.textAlign = "center";
        r.ls.forEach((l, i) => ctx.fillText(l, W / 2, y + 6 + i * 32)); ctx.textAlign = "left";
        y += r.h + GAP; continue;
      }
      const ax = r.me ? W - PAD - AV : PAD;
      const av = pickAv(r.me ? { role: "user" } : msgs[rows.indexOf(r)].m);
      ctx.save(); ctx.beginPath(); ctx.arc(ax + AV / 2, y + AV / 2, AV / 2, 0, Math.PI * 2); ctx.clip();
      if (av) { const s = Math.max(AV / av.width, AV / av.height); ctx.drawImage(av, ax + (AV - av.width * s) / 2, y + (AV - av.height * s) / 2, av.width * s, av.height * s); }
      else { ctx.fillStyle = r.me ? C.me : "#d9cdbd"; ctx.fillRect(ax, y, AV, AV); }
      ctx.restore();
      let by = y;
      if (r.name) { ctx.fillStyle = C.fog; ctx.font = "20px " + FONT; ctx.fillText(r.name.slice(0, 16), PAD + AV + 16, y); by += 30; }
      const bx = r.me ? W - PAD - AV - 16 - r.w : PAD + AV + 16;
      if (r.s.t === "img") {
        ctx.save(); round(bx, by, r.w, r.h - (r.name ? 30 : 0), 14); ctx.clip(); ctx.drawImage(r.im, bx, by, r.w, r.h - (r.name ? 30 : 0)); ctx.restore();
      } else {
        ctx.fillStyle = r.me ? C.me : C.ta; round(bx, by, r.w, r.h - (r.name ? 30 : 0), 22); ctx.fill();
        ctx.fillStyle = r.me ? C.meText : C.taText; ctx.font = FS + "px " + FONT;
        r.ls.forEach((l, i) => ctx.fillText(l, bx + 22, by + 13 + i * LH + (LH - FS) / 2));
      }
      y += Math.max(AV, r.h) + GAP;
    }
    ctx.fillStyle = C.fog; ctx.font = "18px " + FONT; ctx.textAlign = "center";
    ctx.fillText("—— " + (opt.foot || "") + " ——", W / 2, H - 48);
    return await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("没画出来")), "image/png"));
  }

  // 画好了交给公共那条 saveFile（分享面板优先，不行再下载）
  async function save(opt) {
    const b = await render(opt);
    const file = new File([b], "chat-" + Date.now() + ".png", { type: "image/png" });
    return typeof g.saveFile === "function" ? g.saveFile(file) : "none";
  }
  g.ChatLongShot = { render, save, shape };
})(typeof window !== "undefined" ? window : globalThis);
