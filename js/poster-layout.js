// ============================================================
// 照相馆 · 电影海报 / 杂志封面的排字（她 2026-10-13 跟 GPT 一起讨论出来的那套）
//
// 原来是「拍完图 → 掷骰子挑一种排法 → 把字贴上去」：图和字各说各的，
// 生图那句写「下方留空」，排字却可能挑中「竖排贴右」，正好压在人身上。
//
// 现在倒过来：
//   ① TA 写字那一轮顺手定【方向】：类型、气质、字的性格、片名怎么断行（不给坐标）；
//   ② 本地照方向挑一整张的【文字构图】（片名、宣传语、主演、日期各在哪、彼此什么关系），
//      把主要留白写进生图提示词——图是照着字的位置画的；
//   ③ 图回来以后，本地在【这张构图之内】排两三个候选（片名结构、对齐、深浅字），
//      用规则打分挑一张：碰撞、出界、看不看得清。亮度和杂乱只是辅助——
//      只有真的看不清时才换构图，不会因为哪块「干净」就把片名挪过去（黑衣服胸口也很干净）。
//
// 设计约束（她那天改过的两条要记住）：
//   · 不强制片名最大最粗——片名可以很细很小（文艺片），要的是层级清楚；
//   · 不强制所有字一条对齐线——片名靠右、宣传语靠左是正常的，要的是每一组自己有逻辑。
//
// 字体：只用已经在用的那几款（思源宋/黑、站酷小薇/快乐、马善政、志莽行、龙藏），
//   而且按这一张真用到的字取子集（&text=），一张海报下来只拉几十 KB，不加大字体文件。
//   连不上就退回系统字体，不卡出图。
// ============================================================
(function () {
  "use strict";
  const A = s => Array.from(String(s == null ? "" : s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- 字的性格 → 用哪款字、多重、字距 ----------
  // tr＝字距（以字号为单位）；title/small 各一套，一张最多两种字体
  const PERSONA = {
    elegant: { zh: "优雅", title: ["Noto Serif SC", 300], small: ["Noto Sans SC", 300], tr: 0.18, trS: 0.25 },
    heavy:   { zh: "厚重", title: ["Noto Sans SC", 900], small: ["Noto Sans SC", 500], tr: -0.02, trS: 0.12 },
    sharp:   { zh: "锐利", title: ["Noto Serif SC", 900], small: ["Noto Sans SC", 700], tr: 0.02, trS: 0.15 },
    retro:   { zh: "复古", title: ["Ma Shan Zheng", 400], small: ["ZCOOL XiaoWei", 400], tr: 0.04, trS: 0.18 },
    playful: { zh: "俏皮", title: ["ZCOOL KuaiLe", 400], small: ["Noto Sans SC", 700], tr: 0.02, trS: 0.06 },
    cold:    { zh: "冷峻", title: ["Noto Sans SC", 200], small: ["Noto Sans SC", 300], tr: 0.32, trS: 0.4 },
    hand:    { zh: "手写", title: ["Zhi Mang Xing", 400], small: ["ZCOOL XiaoWei", 400], tr: 0, trS: 0.15 }
  };
  const PERSONA_KEYS = Object.keys(PERSONA);
  const GOOGLE = {
    "Noto Serif SC": "Noto+Serif+SC:wght@200;300;500;700;900",
    "Noto Sans SC": "Noto+Sans+SC:wght@200;300;500;700;900",
    "ZCOOL XiaoWei": "ZCOOL+XiaoWei", "ZCOOL KuaiLe": "ZCOOL+KuaiLe",
    "Ma Shan Zheng": "Ma+Shan+Zheng", "Zhi Mang Xing": "Zhi+Mang+Xing"
  };
  const FALLBACK = { "Noto Serif SC": "'Songti SC','STSong',serif", "Noto Sans SC": "'PingFang SC','Microsoft YaHei',sans-serif",
    "ZCOOL XiaoWei": "'Songti SC',serif", "ZCOOL KuaiLe": "'PingFang SC',sans-serif", "Ma Shan Zheng": "'Kaiti SC','STKaiti',serif", "Zhi Mang Xing": "'Kaiti SC','STKaiti',serif" };
  const stackOf = fam => "'" + fam + "'," + (FALLBACK[fam] || "sans-serif");

  // 类型 → 没给性格时的默认性格、信息量
  const GENRE = [
    [/恐怖|惊悚|灵异/, "heavy", "min"], [/悬疑|犯罪|推理|黑色/, "sharp", "std"], [/喜剧|搞笑|青春|校园/, "playful", "rich"],
    [/科幻|赛博|未来/, "cold", "std"], [/古装|武侠|民国|年代/, "retro", "std"], [/文艺|剧情|独立/, "elegant", "min"],
    [/动作|战争|冒险|灾难/, "heavy", "std"], [/奇幻|童话|动画/, "playful", "std"], [/爱情|浪漫/, "elegant", "std"]
  ];
  const genreDefault = g => { const s = String(g || ""); for (const [re, p, d] of GENRE) if (re.test(s)) return { persona: p, density: d }; return { persona: "elegant", density: "std" }; };

  // ---------- 一整张的文字构图 ----------
  // 每一组是一块【区域】（占画面的比例，可以横跨、可以竖着拉长），不是一个点；
  //   a＝这一组自己的对齐；titles＝这块地方适合哪几种片名结构；space＝写进生图提示词的那句留白。
  //   各组可以不同轴（片名靠右、宣传语靠左），这是故意的。
  const MOVIE = {
    bottomSpan: { space: "画面下方约三分之一是干净的暗部、地面或虚化背景，留给横跨整幅的片名；两个人在画面中上部，脸和身体都别落进下方那一块",
      title: { x: .06, y: .70, w: .88, h: .15, a: "center" }, tagline: { x: .1, y: .05, w: .8, h: .05, a: "center" },
      credits: { x: .1, y: .64, w: .8, h: .04, a: "center" }, date: { x: .1, y: .90, w: .8, h: .04, a: "center" }, en: "under", titles: ["line", "spread", "stack"], scrim: "bottom" },
    topSky: { space: "画面上方约三分之一是干净的天空、墙面或暗部，留给片名；两个人在画面中下部，头顶离上方那一块有距离",
      title: { x: .06, y: .07, w: .88, h: .17, a: "center" }, tagline: { x: .12, y: .27, w: .76, h: .04, a: "center" },
      credits: { x: .1, y: .025, w: .8, h: .03, a: "center" }, date: { x: .1, y: .92, w: .8, h: .035, a: "center" }, en: "under", titles: ["line", "stack", "spread"], scrim: "top" },
    rightColumn: { space: "画面右侧约五分之一是干净的竖条（墙、天空、暗部），从上到下留给一列竖排片名；两个人偏画面左侧和中间，别伸进右边那一条",
      title: { x: .80, y: .07, w: .14, h: .62, a: "center" }, tagline: { x: .06, y: .80, w: .62, h: .04, a: "left" },
      credits: { x: .06, y: .86, w: .62, h: .035, a: "left" }, date: { x: .06, y: .91, w: .62, h: .03, a: "left" }, en: "beside", titles: ["vertical"], scrim: "right" },
    leftStack: { space: "画面左下方有一大片干净的留白（暗部、墙或虚化背景），留给两行错开排的片名；两个人偏画面右侧",
      title: { x: .06, y: .54, w: .54, h: .24, a: "left" }, tagline: { x: .46, y: .06, w: .48, h: .045, a: "right" },
      credits: { x: .06, y: .89, w: .5, h: .035, a: "left" }, date: { x: .5, y: .89, w: .44, h: .035, a: "right" }, en: "under", titles: ["stack", "bigsmall"], scrim: "left" },
    quietLow: { space: "构图大量留白，两个人在画面里占得不大（中景或远景），画面下方四分之一是安静干净的一块",
      title: { x: .15, y: .78, w: .7, h: .07, a: "center" }, tagline: { x: .2, y: .07, w: .6, h: .035, a: "center" },
      credits: { x: .15, y: .91, w: .7, h: .03, a: "center" }, date: { x: .15, y: .945, w: .7, h: .025, a: "center" }, en: "under", titles: ["spread", "line"], scrim: "bottom" },
    diagonal: { space: "画面左上角和右下角各有一块干净的区域（天空、墙或暗部），两个人站在画面中间那条斜线上",
      title: { x: .06, y: .06, w: .56, h: .18, a: "left" }, title2: { x: .42, y: .74, w: .52, h: .11, a: "right" },
      tagline: { x: .06, y: .27, w: .5, h: .04, a: "left" }, credits: { x: .06, y: .9, w: .44, h: .03, a: "left" }, date: { x: .5, y: .9, w: .44, h: .03, a: "right" },
      en: "none", titles: ["bigsmall"], scrim: "diag" }
  };
  // 性格 → 偏爱哪几张构图（不是写死，只是加权）
  const MOVIE_PREF = {
    elegant: ["quietLow", "rightColumn", "topSky", "bottomSpan"], heavy: ["bottomSpan", "diagonal", "leftStack"],
    sharp: ["leftStack", "bottomSpan", "rightColumn", "topSky"], retro: ["rightColumn", "leftStack", "topSky"],
    playful: ["diagonal", "topSky", "leftStack"], cold: ["quietLow", "topSky", "bottomSpan"], hand: ["rightColumn", "quietLow", "leftStack"]
  };
  // 杂志：刊名永远顶天立地在最上面——这是杂志的语言，不跟电影共用构图
  const MAG = {
    classic: { space: "画面最上方约六分之一留给刊名（头顶可以离刊名下沿近一点，但脸别进去），左侧约三分之一留白给一栏封面小标题，两个人偏右、半身到全身",
      mast: { x: .05, y: .02, w: .9, h: .16 }, column: { x: .06, y: .38, w: .4, h: .3, a: "left" }, head: { x: .06, y: .78, w: .62, h: .1, a: "left" }, sub: { x: .06, y: .9, w: .6, h: .03, a: "left" }, barcode: "br" },
    twoCol: { space: "画面最上方约六分之一留给刊名，左右两边各留一窄条给封面小标题，两个人在画面正中、半身构图，底部留一条给大标题",
      mast: { x: .05, y: .02, w: .9, h: .15 }, column: { x: .05, y: .38, w: .3, h: .22, a: "left" }, column2: { x: .65, y: .56, w: .3, h: .18, a: "right" }, head: { x: .06, y: .86, w: .88, h: .08, a: "center" }, barcode: "none" },
    framed: { space: "画面最上方约六分之一留给刊名，右侧约三分之一留白给一栏封面小标题，两个人偏左",
      mast: { x: .07, y: .035, w: .86, h: .15 }, column: { x: .56, y: .40, w: .38, h: .3, a: "right" }, head: { x: .07, y: .8, w: .66, h: .09, a: "left" }, sub: { x: .07, y: .91, w: .6, h: .03, a: "left" }, barcode: "none", frame: true },
    band: { space: "画面最上方约六分之一留给刊名，左侧中部留白给两句封面小标题，画面最下方五分之一会被一条色带盖住，两个人在中部、别落进最底下那一截",
      mast: { x: .05, y: .02, w: .9, h: .15 }, column: { x: .06, y: .44, w: .4, h: .18, a: "left" }, head: { x: .06, y: .83, w: .88, h: .07, a: "left" }, sub: { x: .06, y: .92, w: .88, h: .03, a: "left" }, barcode: "none", band: true }
  };
  const MAG_PREF = { elegant: ["framed", "classic"], heavy: ["classic", "band"], sharp: ["twoCol", "classic"], retro: ["band", "framed"], playful: ["twoCol", "band"], cold: ["framed", "twoCol"], hand: ["framed", "band"] };

  const pickW = (arr, rnd) => { const w = arr.map((_, i) => arr.length - i); const s = w.reduce((a, b) => a + b, 0); let r = rnd() * s; for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; } return arr[0]; };

  // ---------- ① 出图之前：定方向和构图 ----------
  function plan(kind, copy, rnd) {
    rnd = rnd || Math.random;
    const cp = copy || {};
    const gd = genreDefault(cp.genre);
    const persona = PERSONA[cp.persona] ? cp.persona : gd.persona;
    const density = ["min", "std", "rich"].indexOf(cp.density) >= 0 ? cp.density : gd.density;
    if (kind === "magazine") {
      const comp = pickW(MAG_PREF[persona] || Object.keys(MAG), rnd);
      return { kind, persona, density, comp, genre: String(cp.genre || ""), mood: String(cp.mood || "") };
    }
    const T = A(cp.title).length;
    let prefs = (MOVIE_PREF[persona] || Object.keys(MOVIE)).slice();
    // 长片名不进竖排、不进对角（竖排太长会顶满一列，对角要拆成两截）
    if (T > 7) prefs = prefs.filter(k => k !== "rightColumn" && k !== "diagonal");
    if (T < 2) prefs = prefs.filter(k => k !== "diagonal" && k !== "leftStack");
    if (!prefs.length) prefs = ["bottomSpan"];
    const comp = pickW(prefs, rnd);
    return { kind, persona, density, comp, genre: String(cp.genre || ""), mood: String(cp.mood || "") };
  }
  // 写进生图提示词的那一句：留白在哪 + 照类型打光（不写坐标，写画面）
  function spaceLine(p) {
    if (!p) return "";
    const c = (p.kind === "magazine" ? MAG : MOVIE)[p.comp];
    const look = (p.genre || p.mood) ? "这是一部" + (p.genre || "") + (p.mood ? "，气质" + p.mood : "") + (p.kind === "magazine" ? "的封面" : "的电影") + "，光影、色调和场景照这个类型来。" : "";
    return look + "【排字留白】" + (c ? c.space : "") + "；留白那几块里不要有文字、字母、logo。";
  }

  // ---------- 字体：只拉这一张用到的字 ----------
  async function ensureFonts(list, text) {
    if (typeof document === "undefined") return;
    const chars = Array.from(new Set(A(text))).join("");
    const jobs = [];
    list.forEach(([fam, wt]) => {
      if (!GOOGLE[fam]) return;
      const id = "pl-font-" + fam.replace(/\s+/g, "-") + "-" + (chars.length + ":" + chars.slice(0, 12)).replace(/[^\w:]/g, "").slice(0, 20) + chars.length;
      if (!document.getElementById(id)) {
        try { const l = document.createElement("link"); l.id = id; l.rel = "stylesheet";
          l.href = "https://fonts.googleapis.com/css2?family=" + GOOGLE[fam] + "&display=swap&text=" + encodeURIComponent(chars);
          document.head.appendChild(l); } catch (e) {}
      }
      if (document.fonts && document.fonts.load) jobs.push(document.fonts.load(wt + " 40px '" + fam + "'", chars).catch(() => {}));
    });
    // 连不上不卡出图：最多等 4 秒，等不到就用系统字体
    await Promise.race([Promise.all(jobs), new Promise(ok => setTimeout(ok, 4000))]);
  }

  // ---------- 量字、画字（字距一律自己摆：canvas 的 letterSpacing 不是哪台手机都有） ----------
  // 数字连成一串当一个字摆（「11 月」不能被字距拆成「1 1 月」）
  const toks = str => String(str).match(/\d+|[\s\S]/gu) || [];
  function measure(x, str, size, fam, wt, tr) {
    x.font = wt + " " + Math.round(size) + "px " + stackOf(fam);
    const ch = toks(str); let w = 0; ch.forEach(c => { w += x.measureText(c).width; });
    return w + Math.max(0, ch.length - 1) * size * tr;
  }
  function drawLine(x, str, size, fam, wt, tr, px, py, align, ink) {
    const w = measure(x, str, size, fam, wt, tr);
    let cx = align === "center" ? px - w / 2 : align === "right" ? px - w : px;
    x.textAlign = "left"; x.textBaseline = "alphabetic"; x.fillStyle = ink;
    toks(str).forEach(c => { x.fillText(c, cx, py); cx += x.measureText(c).width + size * tr; });
    return { x: align === "center" ? px - w / 2 : align === "right" ? px - w : px, y: py - size * 0.88, w, h: size * 1.08 };
  }
  // 往一个框里塞一行：先按框高起手，宽了就缩，最小到起手的 floor
  function fitSize(x, str, box, fam, wt, tr, start, floor) {
    let z = start; while (z > start * floor && measure(x, str, z, fam, wt, tr) > box.w) z -= Math.max(1, z * 0.03);
    return z;
  }

  // ---------- 看图：一块区域的平均亮度和杂乱程度（只做辅助判断） ----------
  function sampler(x, W, H) {
    const gw = 40, gh = Math.max(20, Math.round(40 * H / W));
    const c = document.createElement("canvas"); c.width = gw; c.height = gh;
    const g = c.getContext("2d"); g.drawImage(x.canvas, 0, 0, gw, gh);
    const d = g.getImageData(0, 0, gw, gh).data;
    const lum = new Float32Array(gw * gh), skin = new Uint8Array(gw * gh);
    // 皮肤（她 2026-10-13：「还是挡住脸」——生图那头不一定照留白画，人可能站满整张）：
    //   照 YCbCr 的肤色范围认，外扩一格，脸、脖子、手都算上；字压上去要重罚
    const raw = new Uint8Array(gw * gh);
    for (let i = 0; i < gw * gh; i++) {
      const r = d[i * 4], g2 = d[i * 4 + 1], b = d[i * 4 + 2];
      lum[i] = (0.2126 * r + 0.7152 * g2 + 0.0722 * b) / 255;
      const Y = 0.299 * r + 0.587 * g2 + 0.114 * b, cb = 128 - 0.1687 * r - 0.3313 * g2 + 0.5 * b, cr = 128 + 0.5 * r - 0.4187 * g2 - 0.0813 * b;
      raw[i] = Y > 45 && cb >= 77 && cb <= 127 && cr >= 140 && cr <= 175 && cr - cb >= 22 ? 1 : 0;   // 米色窗帘、木头也落在老范围里：再要求红比蓝明显多
    }
    for (let yy = 0; yy < gh; yy++) for (let xx = 0; xx < gw; xx++) {
      let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = xx + dx, Y2 = yy + dy; if (X >= 0 && Y2 >= 0 && X < gw && Y2 < gh) n += raw[Y2 * gw + X]; }
      skin[yy * gw + xx] = raw[yy * gw + xx] || n >= 3 ? 1 : 0;   // 孤零零一格的不算（木头、灯光也会落进肤色范围）
    }
    // 脸上面那一截（头发、额头）也护着：字顶在头发上看着跟压脸差不多
    const head = new Uint8Array(gw * gh);
    for (let yy = 0; yy < gh; yy++) for (let xx = 0; xx < gw; xx++) { let h2 = 0; for (let k = 0; k <= 4 && yy + k < gh; k++) if (skin[(yy + k) * gw + xx]) { h2 = 1; break; } head[yy * gw + xx] = h2; }
    const look = r => {
      const x0 = clamp(Math.floor(r.x / W * gw), 0, gw - 1), x1 = clamp(Math.ceil((r.x + r.w) / W * gw), x0 + 1, gw);
      const y0 = clamp(Math.floor(r.y / H * gh), 0, gh - 1), y1 = clamp(Math.ceil((r.y + r.h) / H * gh), y0 + 1, gh);
      let s = 0, s2 = 0, n = 0, k = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const v = lum[yy * gw + xx]; s += v; s2 += v * v; n++; k += skin[yy * gw + xx] ? 1 : head[yy * gw + xx] ? 0.6 : 0; }
      const m = s / n; return { mean: m, busy: Math.sqrt(Math.max(0, s2 / n - m * m)), skin: k / n };
    };
    // 一块区域里脸大概在哪（漫画气泡的尾巴要指着说话的人的脸）：取这块里最上面那团肤色的中心
    look.faceIn = r => {
      const x0 = clamp(Math.floor(r.x / W * gw), 0, gw - 1), x1 = clamp(Math.ceil((r.x + r.w) / W * gw), x0 + 1, gw);
      const y0 = clamp(Math.floor(r.y / H * gh), 0, gh - 1), y1 = clamp(Math.ceil((r.y + r.h) / H * gh), y0 + 1, gh);
      let top = -1; for (let yy = y0; yy < y1 && top < 0; yy++) for (let xx = x0; xx < x1; xx++) if (raw[yy * gw + xx] && skin[yy * gw + xx]) { top = yy; break; }
      if (top < 0) return null;
      let sx = 0, sy = 0, n = 0; for (let yy = top; yy < Math.min(y1, top + 4); yy++) for (let xx = x0; xx < x1; xx++) if (skin[yy * gw + xx]) { sx += xx; sy += yy; n++; }
      return n ? { x: (sx / n + 0.5) * W / gw, y: (sy / n + 0.5) * H / gh, top: top * H / gh } : null;
    };
    return look;
  }
  const px = (r, W, H) => ({ x: r.x * W, y: r.y * H, w: r.w * W, h: r.h * H });
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

  // 一组字底下要不要垫、垫多少、用深字还是浅字：照那块真实的明暗来
  // 字的颜色跟着这张图走（她 2026-10-13：「字体颜色能跟着海报变吗」）：
  //   从图里挑出最有颜色的那个色相当主色；浅字、深字都带一点这个色相（不是死白死黑），
  //   再拿它调出一个强调色给一组字用。深浅照字底下那块的明暗定，保证看得清。
  let PAL = null;
  const hsl = (h, s, l) => "hsl(" + Math.round(h) + "," + Math.round(s * 100) + "%," + Math.round(l * 100) + "%)";
  function paletteOf(x, W, H) {
    const c = document.createElement("canvas"); c.width = 32; c.height = 48; const g = c.getContext("2d"); g.drawImage(x.canvas, 0, 0, 32, 48);
    const d = g.getImageData(0, 0, 32, 48).data; const bins = new Float32Array(24); let sw = 0, ss = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, dl = mx - mn;
      if (dl < 0.04 || l < 0.08 || l > 0.95) continue;
      const sat = dl / (1 - Math.abs(2 * l - 1));
      let h = mx === r ? ((gg - b) / dl) % 6 : mx === gg ? (b - r) / dl + 2 : (r - gg) / dl + 4; h = (h * 60 + 360) % 360;
      const w = sat * sat; bins[Math.floor(h / 15) % 24] += w; sw += w; ss += sat;
    }
    let bi = 0; for (let i = 1; i < 24; i++) if (bins[i] + bins[(i + 1) % 24] > bins[bi] + bins[(bi + 1) % 24]) bi = i;
    const n = (d.length / 4) || 1, grey = sw < n * 0.01;
    return { h: grey ? 38 : bi * 15 + 15, s: grey ? 0.55 : clamp(ss / n * 1.6, 0.4, 0.85), grey };
  }
  function inkFor(st, role) {
    const P0 = PAL || { h: 38, s: 0.55 }; const dark = st.mean <= 0.62;
    if (role === "accent") return { ink: hsl(P0.h, P0.s, dark ? 0.74 : 0.3), dark };
    return dark ? { ink: hsl(P0.h, Math.min(P0.s, 0.4) * 0.45, 0.95), dark: true } : { ink: hsl(P0.h, Math.min(P0.s, 0.5) * 0.6, 0.11), dark: false };
  }
  // 强调色给哪一组：俏皮、复古的片名本身就上色；别的性格只给宣传语上色，片名保持素
  const accentOn = persona => persona === "playful" || persona === "retro" ? "title" : "tagline";
  function scrim(x, W, H, side, strength, dark) {
    if (strength <= 0) return;
    const col = a => (dark ? "rgba(0,0,0," : "rgba(255,255,255,") + (a * strength).toFixed(3) + ")";
    let g;
    if (side === "bottom") { g = x.createLinearGradient(0, H * 0.5, 0, H); g.addColorStop(0, col(0)); g.addColorStop(1, col(0.75)); }
    else if (side === "top") { g = x.createLinearGradient(0, 0, 0, H * 0.45); g.addColorStop(0, col(0.7)); g.addColorStop(1, col(0)); }
    else if (side === "right") { g = x.createLinearGradient(W * 0.6, 0, W, 0); g.addColorStop(0, col(0)); g.addColorStop(1, col(0.65)); }
    else if (side === "left") { g = x.createLinearGradient(0, 0, W * 0.65, 0); g.addColorStop(0, col(0.65)); g.addColorStop(1, col(0)); }
    else { g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, col(0.55)); g.addColorStop(0.45, col(0)); g.addColorStop(0.55, col(0)); g.addColorStop(1, col(0.55)); }
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }

  // ---------- 片名的几种结构 ----------
  // 返回画出来占的框（打分用）。dry=true 只量不画。
  function drawTitle(x, struct, lines, box, P, ink, dry, scale) {
    const [fam, wt] = P.title, tr = P.tr, out = [];
    const all = lines.join("");
    const draw = (s, z, X, Y, al, f2, w2, t2) => dry ? (() => { const w = measure(x, s, z, f2 || fam, w2 || wt, t2 == null ? tr : t2); return { x: al === "center" ? X - w / 2 : al === "right" ? X - w : X, y: Y - z * 0.88, w, h: z * 1.08 }; })() : drawLine(x, s, z, f2 || fam, w2 || wt, t2 == null ? tr : t2, X, Y, al, ink);
    const ax = box.a === "center" ? box.x + box.w / 2 : box.a === "right" ? box.x + box.w : box.x;
    if (struct === "vertical") {
      const ch = A(all); let z = Math.min(box.w * 0.9, box.h / Math.max(1, ch.length) / 1.05) * scale;
      x.font = wt + " " + Math.round(z) + "px " + stackOf(fam);
      let y = box.y + z; const cx = box.x + box.w / 2;
      ch.forEach(c => { const w = x.measureText(c).width; if (!dry) { x.textAlign = "left"; x.fillStyle = ink; x.fillText(c, cx - w / 2, y); } out.push({ x: cx - w / 2, y: y - z * 0.88, w, h: z }); y += z * (1.05 + Math.max(0, tr) * 0.5); });
      return out;
    }
    if (struct === "spread") {
      // 整行拉开字距撑满框宽——字号克制，靠字距出气质
      const ch = A(all); const z0 = Math.min(box.h * 0.7, box.w / Math.max(1, ch.length) * 0.75) * scale;
      const natural = measure(x, all, z0, fam, wt, 0); const t2 = ch.length > 1 ? clamp((box.w - natural) / (ch.length - 1) / z0, 0.1, 1.6) : 0;
      out.push(draw(all, z0, ax, box.y + box.h * 0.75, box.a, fam, wt, t2)); return out;
    }
    if (struct === "stack" && lines.length > 1) {
      // 两行错开：第二行往对齐那侧反方向让出一截，像手排的
      const z = Math.min(...lines.map(l => fitSize(x, l, { w: box.w * 0.92 }, fam, wt, tr, box.h / lines.length * 0.82 * scale, 0.5)));
      const off = box.a === "center" ? 0 : box.w * 0.12 * (box.a === "left" ? 1 : -1);
      lines.slice(0, 3).forEach((l, i) => out.push(draw(l, z, ax + (i % 2 ? off : 0), box.y + z * 0.95 + i * z * 1.16, box.a)));
      return out;
    }
    if (struct === "bigsmall") {
      // 第一截大、其余小；第二截的位置由构图给（title2），没有就跟在下面
      const big = lines.length > 1 ? lines[0] : A(all).slice(0, Math.ceil(A(all).length / 2)).join("");
      const rest = lines.length > 1 ? lines.slice(1).join("") : A(all).slice(A(big).length).join("");
      const zb = fitSize(x, big, box, fam, wt, tr, box.h * 0.85 * scale, 0.45);
      out.push(draw(big, zb, ax, box.y + zb * 0.92, box.a));
      const b2 = box.second || { x: box.x, y: box.y + zb * 1.1, w: box.w, h: zb * 0.5, a: box.a };
      if (rest) { const ax2 = b2.a === "center" ? b2.x + b2.w / 2 : b2.a === "right" ? b2.x + b2.w : b2.x;
        const zs = fitSize(x, rest, b2, fam, wt, tr, Math.min(b2.h * 0.8, zb * 0.55), 0.45); out.push(draw(rest, zs, ax2, b2.y + zs * 0.92, b2.a)); }
      return out;
    }
    // line：一行；放不下先拆成两行，不一直缩
    const z1 = box.h * 0.8 * scale; const z = fitSize(x, all, box, fam, wt, tr, z1, 0.62);
    if (measure(x, all, z, fam, wt, tr) > box.w && lines.length > 1) return drawTitle(x, "stack", lines, box, P, ink, dry, scale);
    out.push(draw(all, z, ax, box.y + box.h * 0.5 + z * 0.36, box.a)); return out;
  }
  // 片名怎么断：模型给了就照它，没给就从中间断（不拆在一个词中间这事管不了，交给模型那一栏）
  function titleLines(cp, T) { const L = (Array.isArray(cp.titleLines) ? cp.titleLines : []).map(s => A(s).join("").trim()).filter(Boolean);
    if (L.length && L.join("") === T) return L.slice(0, 3); const ch = A(T); if (ch.length < 4) return [T]; const m = Math.ceil(ch.length / 2); return [ch.slice(0, m).join(""), ch.slice(m).join("")]; }

  // 一组小字：一行，按框缩
  function smallLine(x, s, box, P, ink, dry, sizeK) {
    if (!s) return null;
    const [fam, wt] = P.small; const z = fitSize(x, s, box, fam, wt, P.trS, box.h * (sizeK || 0.8), 0.5);
    const ax = box.a === "center" ? box.x + box.w / 2 : box.a === "right" ? box.x + box.w : box.x;
    if (dry) { const w = measure(x, s, z, fam, wt, P.trS); return { x: box.a === "center" ? ax - w / 2 : box.a === "right" ? ax - w : ax, y: box.y + box.h * 0.75 - z * 0.88, w, h: z * 1.08 }; }
    return drawLine(x, s, z, fam, wt, P.trS, ax, box.y + box.h * 0.75, box.a, ink);
  }

  // ---------- 打分：只筛明显不合格的，不冒充审美 ----------
  // 按【组】算平均，不按块数加——不然拆得越碎分越高
  function score(boxes, W, H, look, planned, region) {
    let s = planned ? 30 : 0; const m = W * 0.03; const grp = {};
    boxes.forEach(b => {
      if (b.x < m || b.y < m * 0.6 || b.x + b.w > W - m || b.y + b.h > H - m * 0.6) s -= 25;   // 出界、贴边
      const st = look(b); const c = Math.abs(st.mean - (b.dark ? 0.98 : 0.08));
      const v = c * 10 - (b.title ? st.busy * 30 : st.busy * 10);
      // 压在脸上、手上：比出界还重——人是海报的主角，字让人
      s -= (st.skin || 0) * (b.title ? 160 : 110);
      (grp[b.g] = grp[b.g] || []).push(v);
    });
    Object.keys(grp).forEach(k => { s += grp[k].reduce((a, b) => a + b, 0) / grp[k].length; });
    // 片名把定好的那块地方用起来（不是越大越好：细字那一路的 region 本来就小）
    if (region) { const t = boxes.filter(b => b.title); if (t.length) {
      const x0 = Math.min(...t.map(b => b.x)), x1 = Math.max(...t.map(b => b.x + b.w)), y0 = Math.min(...t.map(b => b.y)), y1 = Math.max(...t.map(b => b.y + b.h));
      s += 12 * Math.min(1, ((x1 - x0) * (y1 - y0)) / (region.w * region.h)); } }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[i].g === boxes[j].g) continue;
      const o = overlap(boxes[i], boxes[j]); if (o > 0) s -= 40 + o / (W * H) * 2000;                // 两组字撞在一起
    }
    return s;
  }

  // ---------- 电影海报 ----------
  function movieTexts(cp, names) {
    return {
      tagline: A(cp.tagline).slice(0, 22).join(""),
      credits: cp.credit ? A(cp.credit).slice(0, 28).join("") : names.join("　"),
      date: (cp.date ? String(cp.date) + "　" : "") + "上映",
      en: A(cp.en).slice(0, 36).join("").toUpperCase()
    };
  }
  function renderMovie(x, W, H, look, compKey, struct, cp, T, names, P, density, dry) {
    const C = MOVIE[compKey]; const boxes = [];
    const lines = titleLines(cp, T);
    const tb = px(C.title, W, H); tb.a = C.title.a; if (C.title2) { tb.second = px(C.title2, W, H); tb.second.a = C.title2.a; }
    const tst = look(tb); const tk = inkFor(tst, P.accentOn === "title" ? "accent" : "");
    // 片名不强制最大：文艺那一路（细字）照框排、字号本来就克制
    drawTitle(x, struct, lines, tb, P, tk.ink, dry, P.title[1] <= 300 ? 0.82 : 1).forEach(b => boxes.push({ ...b, g: "t", title: true, dark: tk.dark }));
    const tx = movieTexts(cp, names);
    // 小字那几组（宣传语、主演、日期）不死钉在格子里：压到脸或头发上，就上下挪到最近的空处（她 2026-10-13：「还是挡住脸」）
    const slide = b0 => { if ((look(b0).skin || 0) < 0.04) return b0;
      for (const d of [0.04, -0.04, 0.08, -0.08, 0.12, -0.12, 0.18, -0.18, 0.25, -0.25]) {
        const b = { ...b0, y: b0.y + d * H }; if (b.y < H * 0.02 || b.y + b.h > H * 0.97) continue;
        if ((look(b).skin || 0) < 0.04 && !boxes.some(o => overlap(o, b) > 0)) return b; }
      return b0; };
    const put = (key, s, k) => { const r = C[key]; if (!r || !s) return; const b = slide(px(r, W, H)); b.a = r.a; const ik = inkFor(look(b), P.accentOn === key ? "accent" : ""); const o = smallLine(x, s, b, P, ik.ink, dry, k); if (o) boxes.push({ ...o, g: key, dark: ik.dark }); };
    if (density !== "min" || !C.tagline) put("tagline", tx.tagline, 0.85); else put("tagline", tx.tagline, 0.7);
    put("credits", tx.credits, 0.8);
    put("date", tx.date, 0.75);
    if (tx.en && density !== "min" && C.en !== "none") {
      const last = boxes.filter(b => b.title).sort((a, b) => b.y + b.h - (a.y + a.h))[0];
      if (C.en === "under" && last) { const b = { x: tb.x, y: last.y + last.h + H * 0.012, w: tb.w, h: H * 0.022, a: tb.a }; const o = smallLine(x, tx.en, b, { ...P, trS: 0.3 }, inkFor(tst).ink, dry, 0.9); if (o) boxes.push({ ...o, g: "en", dark: tk.dark }); }
      else if (C.en === "beside" && !dry) {
        // 竖排片名旁边那一列英文：转九十度沿边走
        x.save(); x.translate(tb.x - W * 0.012, tb.y); x.rotate(Math.PI / 2);
        smallLine(x, tx.en, { x: 0, y: -H * 0.022, w: tb.h, h: H * 0.02, a: "left" }, { ...P, trS: 0.35 }, tk.ink, false, 0.9); x.restore();
      }
    }
    return boxes;
  }

  // ---------- 杂志封面 ----------
  function renderMag(x, W, H, look, compKey, variant, cp, T, names, P, accent, dry) {
    const C = MAG[compKey]; const boxes = [];
    const now = new Date(); const issue = now.getFullYear() + " 年 " + (now.getMonth() + 1) + " 月刊";
    const mast = A(cp.mast).slice(0, 4).join("") || "我们";
    const lines = (Array.isArray(cp.lines) ? cp.lines : []).map(v => A(v).slice(0, 18).join("").trim()).filter(Boolean);
    const special = A(cp.special).slice(0, 8).join("");
    if (C.frame && !dry) { x.strokeStyle = "rgba(255,255,255,.95)"; x.lineWidth = W * 0.016; x.strokeRect(W * 0.03, W * 0.03, W - W * 0.06, H - W * 0.06); }
    let bandInk = null;
    // 色带不再一刀切（她 2026-10-13：「图片往下移然后 fade 背景就好看了，然后跟电影刚改的一样字体颜色变化」）：
    //   从画面中下部开始慢慢渐进成色带，照片像是沉进色带里；色带和上面的字都带上这张照片的主色，不再是死黑死白
    let bandAccent = null;
    if (C.band && !dry) {
      const b = { x: 0, y: H * 0.8, w: W, h: H * 0.2 }; const st = look(b), P0 = PAL || { h: 38, s: 0.55 }, darkBand = st.mean > 0.5;
      const bh = P0.h, bs = Math.min(P0.s, 0.6) * (darkBand ? 0.35 : 0.25), bl = darkBand ? 0.12 : 0.93;
      const hsla = a2 => "hsla(" + Math.round(bh) + "," + Math.round(bs * 100) + "%," + Math.round(bl * 100) + "%," + a2 + ")";
      // 一整条渐变画到底（分两块画，接缝那一行会叠出一道细线）
      const g = x.createLinearGradient(0, H * 0.56, 0, H);
      g.addColorStop(0, hsla(0)); g.addColorStop(0.3, hsla(0.55)); g.addColorStop(0.55, hsla(0.94)); g.addColorStop(1, hsla(0.94));
      x.fillStyle = g; x.fillRect(0, Math.floor(H * 0.56), W, H - Math.floor(H * 0.56));
      bandInk = darkBand ? hsl(bh, Math.min(P0.s, 0.4) * 0.45, 0.95) : hsl(bh, Math.min(P0.s, 0.5) * 0.6, 0.11);
      bandAccent = hsl(bh, P0.s, darkBand ? 0.74 : 0.32);
    }
    // 刊名：顶天立地，字号撑满宽度；颜色照那一条的明暗，variant 1 用强调色
    const mb = px(C.mast, W, H); const mk = inkFor(look(mb)); const [mf, mw] = [P.title[0], Math.max(700, P.title[1])];
    let z = mb.h * 0.95; while (z > 10 && measure(x, mast, z, mf, mw, 0.02) > mb.w) z -= 2;
    const mo = dry ? { x: W / 2 - measure(x, mast, z, mf, mw, 0.02) / 2, y: mb.y, w: measure(x, mast, z, mf, mw, 0.02), h: z } : drawLine(x, mast, z, mf, mw, 0.02, W / 2, mb.y + z * 0.88, "center", variant === 1 ? accent : mk.ink);
    boxes.push({ ...mo, g: "mast", dark: mk.dark });
    const meta = smallLine(x, issue + (special ? "　|　" + special : ""), { x: mb.x, y: mb.y + z * 1.08, w: mb.w, h: H * 0.03, a: "center" }, P, mk.ink, dry, 0.75); if (meta) boxes.push({ ...meta, g: "meta", dark: mk.dark });
    const col = (r, arr) => { if (!r || !arr.length) return; const b = px(r, W, H); b.a = r.a; const ik = inkFor(look(b)); let y = b.y;
      arr.forEach((s, n) => { const k = n === 0 ? 1 : 0.62; const bb = { x: b.x, y, w: b.w, h: b.h / arr.length * 0.7 * k + H * 0.012, a: b.a };
        const o = smallLine(x, s, bb, n === 0 ? { ...P, small: [P.title[0], Math.max(700, P.title[1])], trS: 0.02 } : P, n === 0 && variant !== 2 ? accent : ik.ink, dry, 0.9); if (o) { boxes.push({ ...o, g: "col" + r.x, dark: ik.dark }); y = o.y + o.h + H * 0.012; } }); };
    const ls = lines.length ? lines : [];
    col(C.column, C.column2 ? ls.slice(0, 2) : ls.slice(0, 3)); col(C.column2, ls.slice(2, 3));
    const hb = px(C.head, W, H); hb.a = C.head.a; const hk = bandInk ? { ink: bandAccent || bandInk, dark: /,9\d%\)$/.test(bandInk) } : inkFor(look(hb));
    const hz = fitSize(x, T, hb, P.title[0], Math.max(500, P.title[1]), P.tr * 0.5, hb.h * 0.9, 0.5);
    const hax = hb.a === "center" ? hb.x + hb.w / 2 : hb.a === "right" ? hb.x + hb.w : hb.x;
    const ho = dry ? (() => { const w = measure(x, T, hz, P.title[0], Math.max(500, P.title[1]), P.tr * 0.5); return { x: hb.a === "center" ? hax - w / 2 : hax, y: hb.y, w, h: hz }; })() : drawLine(x, T, hz, P.title[0], Math.max(500, P.title[1]), P.tr * 0.5, hax, hb.y + hz * 0.9, hb.a, hk.ink);
    boxes.push({ ...ho, g: "head", title: true, dark: hk.dark });
    if (C.sub) { const sb = px(C.sub, W, H); sb.a = C.sub.a; const o = smallLine(x, names.join(" × ") + "　独家专访", sb, P, bandInk || inkFor(look(sb)).ink, dry, 0.8); if (o) boxes.push({ ...o, g: "sub", dark: bandInk ? /,9\d%\)$/.test(bandInk) : inkFor(look(sb)).dark }); }
    if (C.barcode === "br" && !dry) {
      const bw = W * 0.16, bh = H * 0.045, bx = W - W * 0.07 - bw, by = H - W * 0.07 - bh;
      x.fillStyle = "#fff"; x.fillRect(bx - W * 0.012, by - W * 0.012, bw + W * 0.024, bh + W * 0.05); x.fillStyle = "#111";
      let cx = bx, seed = (A(T).length * 7 + 3) % 11; while (cx < bx + bw) { seed = (seed * 37 + 11) % 97; const w = W * (0.002 + (seed % 3) * 0.0018); x.fillRect(cx, by, w, bh); cx += w + W * (0.002 + (seed % 2) * 0.002); }
    }
    return boxes;
  }

  // ---------- ③ 图回来以后：排几个候选、挑一张 ----------
  async function compose(blob, p, copy, names) {
    const cp = copy || {}; const kind = p && p.kind === "magazine" ? "magazine" : "movie";
    const P = { ...(PERSONA[p && p.persona] || PERSONA.elegant) };
    const T = A(cp.title).slice(0, 16).join("") || (kind === "magazine" ? "我们的故事" : "我们");
    const nm = (Array.isArray(names) ? names : String(names || "").split(/\s+/)).filter(Boolean);
    const u = URL.createObjectURL(blob);
    const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u; });
    URL.revokeObjectURL(u);
    const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext("2d"), W = c.width, H = c.height;
    x.drawImage(im, 0, 0);
    const look = sampler(x, W, H);
    const allText = T + (cp.tagline || "") + (cp.credit || "") + nm.join("") + (cp.date || "") + (cp.genre || "") + (cp.lines || []).join("") + (cp.special || "") + (cp.mast || "") + "上映年月刊独家专访我们的故事|×　0123456789";
    await ensureFonts([P.title, P.small, [P.title[0], 700]], allText);
    PAL = paletteOf(x, W, H); P.accentOn = accentOn(p && p.persona);
    const accent = inkFor(look({ x: 0, y: H * 0.3, w: W, h: H * 0.4 }), "accent").ink;
    // 候选：先在【定好的构图】里换片名结构/变体；只有全都看不清，才去别的构图找
    const cands = [];
    if (kind === "magazine") {
      [0, 1, 2].forEach(v => cands.push({ comp: p.comp, v, planned: true }));
      Object.keys(MAG).filter(k => k !== p.comp).forEach(k => cands.push({ comp: k, v: 0, planned: false }));
    } else {
      const C = MOVIE[p.comp] || MOVIE.bottomSpan;
      C.titles.forEach(s => cands.push({ comp: p.comp in MOVIE ? p.comp : "bottomSpan", v: s, planned: true }));
      // 别的构图也每种结构都排一遍：图要是没照留白画（人站满整张），得有地方可退
      Object.keys(MOVIE).filter(k => k !== p.comp).forEach(k => MOVIE[k].titles.forEach(v => cands.push({ comp: k, v, planned: false })));
    }
    const run = (cd, dry) => kind === "magazine" ? renderMag(x, W, H, look, cd.comp, cd.v, cp, T, nm, P, accent, dry) : renderMovie(x, W, H, look, cd.comp, cd.v, cp, T, nm, P, p.density, dry);
    const regionOf = cd => kind === "magazine" ? px(MAG[cd.comp].head, W, H) : px(MOVIE[cd.comp].title, W, H);
    cands.forEach(cd => { cd.s = score(run(cd, true), W, H, look, cd.planned, regionOf(cd)); });
    const best = cands.slice().sort((a, b) => b.s - a.s)[0];
    // 看得清就照画；字底下太杂、对比不够才垫一层渐变（照那块的明暗选黑垫还是白垫）
    const C2 = kind === "magazine" ? null : MOVIE[best.comp];
    const tb = C2 ? px(C2.title, W, H) : px(MAG[best.comp].mast, W, H); const st = look(tb);
    const need = clamp((st.busy - 0.08) * 4 + (st.mean > 0.35 && st.mean < 0.62 ? 0.4 : 0), 0, 1);
    if (C2) scrim(x, W, H, C2.scrim, 0.35 + need * 0.65, st.mean <= 0.62);
    else scrim(x, W, H, "top", 0.25 + need * 0.5, st.mean <= 0.62);
    // 字带一层很淡的光晕，压在任何底上都读得出（不是粗黑影）
    x.shadowColor = st.mean > 0.62 ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.45)"; x.shadowBlur = W * 0.008;
    run(best, false);
    x.shadowBlur = 0;
    return await new Promise(ok => c.toBlob(b => ok(b || blob), "image/jpeg", 0.92));
  }

  // ============================================================
  // 四格漫画（她 2026-10-13：「四宫格漫画格式会不会也很敷衍」——原来是四张图底下各一条「名字：台词」字幕）
  //   现在：粗黑格框＋白缝；台词进对话气泡，气泡挨着说话的人、尾巴指过去（拍的时候钉死「他左你右」），
  //   靠认脸那一套避开脸；喊的话用炸开的气泡；旁白进左上角的方框；拟声字大、粗、歪、带白边。
  //   名字不再写：气泡的位置就说明了是谁。
  // panels：[{ bubbles:[{who:"ta"|"me", text, shout}], narr, sfx }]；老数据 { line:"名字：话" } 也认
  // ============================================================
  function normPanel(p, names) {
    if (p && Array.isArray(p.bubbles)) return { bubbles: p.bubbles.filter(b => b && String(b.text || "").trim()).slice(0, 2).map(b => ({ who: b.who === "me" ? "me" : "ta", text: A(b.text).slice(0, 28).join(""), shout: !!b.shout })), narr: A(p.narr).slice(0, 12).join(""), sfx: A(p.sfx).slice(0, 4).join("") };
    const line = String((p && p.line) || "").trim(); if (!line) return { bubbles: [], narr: "", sfx: "" };
    const m = /^([^：:]{1,12})[：:]\s*(.+)$/.exec(line);
    if (!m) return { bubbles: [], narr: A(line).slice(0, 18).join(""), sfx: "" };
    return { bubbles: [{ who: m[1].trim() === String(names[1] || "") ? "me" : "ta", text: A(m[2]).slice(0, 28).join(""), shout: /[！!]{1,}$/.test(m[2]) }], narr: "", sfx: "" };
  }
  // 气泡里的字：按宽度折行
  function wrap(x, str, maxW) { const rows = []; let cur = ""; A(str).forEach(c => { if (cur && x.measureText(cur + c).width > maxW) { rows.push(cur); cur = c; } else cur += c; }); if (cur) rows.push(cur); return rows; }
  function bubble(x, b, cx0, cy0, cw, ch, look, side, z, font) {
    x.font = (b.shout ? "900 " : "400 ") + Math.round(z * (b.shout ? 1.15 : 1)) + "px " + font;
    const fz = z * (b.shout ? 1.15 : 1), maxW = cw * 0.6;
    const rows = wrap(x, b.text, maxW); const tw = Math.max(...rows.map(r => x.measureText(r).width)), th = rows.length * fz * 1.22;
    const bw = tw + fz * 1.4, bh = th + fz * 1.0;
    // 候选：说话人那一侧的上方、正上方、那一侧的下方、那一侧的中间；挑压脸最少的
    const L = cx0 + cw * 0.04, R = cx0 + cw * 0.96 - bw, T = cy0 + ch * 0.04, B = cy0 + ch * 0.96 - bh, M = cx0 + (cw - bw) / 2;
    const sideX = side === "me" ? R : L, other = side === "me" ? L : R;
    // 说话的人的脸：他在左半格、你在右半格（拍的时候钉死的）；找得到就把气泡放在脸的上方、尾巴指过去
    const face = look.faceIn ? look.faceIn({ x: side === "me" ? cx0 + cw * 0.45 : cx0, y: cy0, w: cw * 0.55, h: ch * 0.8 }) : null;
    const pos = [[sideX, T], [M, T], [sideX, B], [sideX, cy0 + ch * 0.38], [other, T]];
    if (face) { const fx = clamp(face.x - bw / 2, cx0 + cw * 0.04, cx0 + cw * 0.96 - bw), fy = face.top - bh - fz * 1.6;
      if (fy > cy0 + ch * 0.02) pos.unshift([fx, fy]); }
    let best = null; pos.forEach(([bx, by], i) => { const st = look({ x: bx, y: by, w: bw, h: bh }); const sc = (st.skin || 0) * 100 + i * 2 + (b.used || []).reduce((a, o) => a + (overlap(o, { x: bx, y: by, w: bw, h: bh }) > 0 ? 80 : 0), 0); if (!best || sc < best.sc) best = { bx, by, sc }; });
    const { bx, by } = best;
    // 尾巴：朝说话的人的脸伸过去（认不出脸就朝那一侧斜下方），在脸前面停住、不戳进脸里
    const below = face ? by > face.y : by > cy0 + ch * 0.5;
    const r0 = Math.min(bh / 2, fz * 1.1);
    const aim = face && (below ? (face.y + fz) - (below ? by : by + bh) < -fz * 0.8 : face.top - (by + bh) > fz * 0.8);
    let tx0 = aim ? clamp(face.x, bx + r0 + fz * 0.5, bx + bw - r0 - fz * 0.5) : (side === "me" ? bx + bw * 0.7 : bx + bw * 0.3);
    const ty0 = below ? by : by + bh;
    let tip;
    // 脸跟气泡挨得太近或者在反方向（尾巴会戳回气泡里）就不对着脸，退回朝那一侧斜着伸
    const fdy = face ? (below ? face.y + fz : face.top) - ty0 : 0;
    if (face && (below ? fdy < -fz * 0.8 : fdy > fz * 0.8)) { const dx = face.x - tx0, dy = fdy, len = Math.hypot(dx, dy) || 1, want = clamp(len - fz * 1.2, fz * 1.2, fz * 2.6);
      tip = [tx0 + dx / len * want, ty0 + dy / len * want]; }
    else tip = [side === "me" ? tx0 + fz * 0.9 : tx0 - fz * 0.9, below ? by - fz * 1.2 : by + bh + fz * 1.2];
    x.save(); x.lineWidth = Math.max(2, z * 0.11); x.strokeStyle = "#111"; x.fillStyle = "#fff";
    x.beginPath();
    if (b.shout) {      // 炸开的气泡：锯齿一圈
      const cx = bx + bw / 2, cy = by + bh / 2, rx = bw / 2 + fz * 0.35, ry = bh / 2 + fz * 0.35, n = 18;
      for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? 0.86 : 1.08; const px2 = cx + Math.cos(a) * rx * r, py2 = cy + Math.sin(a) * ry * r; i ? x.lineTo(px2, py2) : x.moveTo(px2, py2); }
    } else {
      const r = Math.min(bh / 2, fz * 1.1); x.moveTo(bx + r, by); x.arcTo(bx + bw, by, bx + bw, by + bh, r); x.arcTo(bx + bw, by + bh, bx, by + bh, r); x.arcTo(bx, by + bh, bx, by, r); x.arcTo(bx, by, bx + bw, by, r);
    }
    x.closePath(); x.fill(); x.stroke();
    // 尾巴（描两条边、底下补白盖住气泡那一段描边）
    const tb = ty0;
    x.beginPath(); x.moveTo(tx0 - fz * 0.45, tb); x.lineTo(tip[0], tip[1]); x.lineTo(tx0 + fz * 0.45, tb); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(tx0 - fz * 0.45, tb); x.lineTo(tip[0], tip[1]); x.lineTo(tx0 + fz * 0.45, tb); x.stroke();
    x.fillStyle = "#fff"; x.fillRect(tx0 - fz * 0.45 + x.lineWidth, tb - x.lineWidth * 1.2, fz * 0.9 - x.lineWidth * 2, x.lineWidth * 2.4);
    x.fillStyle = "#111"; x.textAlign = "center"; x.textBaseline = "middle";
    rows.forEach((r, i) => x.fillText(r, bx + bw / 2, by + bh / 2 + (i - (rows.length - 1) / 2) * fz * 1.22));
    x.restore();
    return { x: bx, y: by, w: bw, h: bh };
  }
  async function comic(blob, panelsIn, names) {
    const nm = Array.isArray(names) ? names : [];
    const panels = (panelsIn || []).slice(0, 4).map(p => normPanel(p, nm));
    const u = URL.createObjectURL(blob);
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = u; });
    URL.revokeObjectURL(u);
    const W = img.naturalWidth, H = img.naturalHeight, cw = Math.floor(W / 2), ch = Math.floor(H / 2);
    const gut = Math.round(W * 0.022), pad = Math.round(W * 0.03), bord = Math.max(4, Math.round(W * 0.006));
    const outW = cw * 2 + gut + pad * 2, outH = ch * 2 + gut + pad * 2;
    const cv = document.createElement("canvas"); cv.width = outW; cv.height = outH; const x = cv.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, outW, outH);
    const FONT = stackOf("ZCOOL KuaiLe"), FONT_H = stackOf("Noto Sans SC");
    const allText = panels.map(p => p.bubbles.map(b => b.text).join("") + p.narr + p.sfx).join("");
    await ensureFonts([["ZCOOL KuaiLe", 400], ["Noto Sans SC", 900]], allText + "！？…");
    for (let i = 0; i < 4; i++) {
      const gx = i % 2, gy = Math.floor(i / 2), X = pad + gx * (cw + gut), Y = pad + gy * (ch + gut);
      x.drawImage(img, gx * cw, gy * ch, cw, ch, X, Y, cw, ch);
      const look = sampler(x, outW, outH);
      const p = panels[i] || { bubbles: [], narr: "", sfx: "" };
      const z = Math.round(cw * 0.058), used = [];
      if (p.narr) {   // 旁白：左上角黄底方框，压在格框上
        x.font = "500 " + Math.round(z * 0.8) + "px " + FONT_H; const w = x.measureText(p.narr).width + z * 1.1, hh = z * 1.5;
        x.fillStyle = "#fff6c8"; x.fillRect(X, Y, w, hh); x.strokeStyle = "#111"; x.lineWidth = bord * 0.7; x.strokeRect(X, Y, w, hh);
        x.fillStyle = "#111"; x.textAlign = "left"; x.textBaseline = "middle"; x.fillText(p.narr, X + z * 0.55, Y + hh / 2); used.push({ x: X, y: Y, w, h: hh });
      }
      p.bubbles.forEach(b => { used.push(bubble(x, { ...b, used }, X, Y, cw, ch, look, b.who, z, FONT)); });
      if (p.sfx) {    // 拟声字：大、粗、歪，白边黑芯，放在不压脸的那一角
        const sz = Math.round(cw * 0.13); x.font = "900 " + sz + "px " + FONT_H;
        const sw = x.measureText(p.sfx).width; const spots = [[X + cw * 0.62, Y + ch * 0.62], [X + cw * 0.08, Y + ch * 0.62], [X + cw * 0.55, Y + ch * 0.3], [X + cw * 0.1, Y + ch * 0.3]];
        let sp = spots[0], bs = 1e9; spots.forEach(([sx, sy]) => { const r = { x: sx, y: sy - sz, w: sw, h: sz }; const v = (look(r).skin || 0) * 100 + used.reduce((a, o) => a + (overlap(o, r) > 0 ? 50 : 0), 0); if (v < bs) { bs = v; sp = [sx, sy]; } });
        x.save(); x.translate(sp[0] + sw / 2, sp[1] - sz / 2); x.rotate(-0.14); x.textAlign = "center"; x.textBaseline = "middle";
        x.lineJoin = "round"; x.lineWidth = sz * 0.16; x.strokeStyle = "#fff"; x.strokeText(p.sfx, 0, 0); x.fillStyle = "#e0342f"; x.fillText(p.sfx, 0, 0); x.lineWidth = sz * 0.04; x.strokeStyle = "#111"; x.strokeText(p.sfx, 0, 0); x.restore();
      }
      x.strokeStyle = "#111"; x.lineWidth = bord; x.strokeRect(X, Y, cw, ch);
    }
    return await new Promise(ok => cv.toBlob(b => ok(b || blob), "image/jpeg", 0.92));
  }

  window.PosterLayout = { plan, spaceLine, compose, comic, PERSONA_KEYS, PERSONA_KEYS, MOVIE_COMPS: Object.keys(MOVIE), MAG_COMPS: Object.keys(MAG), _t: { titleLines, genreDefault, score, overlap, normPanel } };
})();
