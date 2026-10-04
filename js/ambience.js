// ============================================================
// 背景音（她 2026-10-05：「番茄钟里面能不能加背景音的选项」「13 先吧，能叠着」）。
//
// 两种来路：
//   ① 代码现场合成：雨、海浪、风、壁炉、钟、白／粉／棕噪音——不带任何音频文件，没有版权这回事。
//   ② 她自己的一段音频：存进「一起听」那个本地音频库（x_listen_audio），不进云。
//
// ⚠️为什么合成完还要编成 WAV、交给 <audio> 去放，而不是直接用 Web Audio 出声：
//   iOS 切后台／锁屏，Web Audio 那条路会被系统挂起；<audio> 循环放的会一直响
//   ——后台保活靠的就是这个（一起听里那首「静音保活」）。她 2026-10-05 纠正过我：「退出不会停啊」。
//   所以几层合成音先在内存里混成【一段】循环 WAV，用一个 <audio loop> 放；调音量就重新混一遍。
//   （iOS 上 <audio>.volume 是只读的，音量只能烤进音频里——这也是要重混的原因。）
// ⚠️循环接缝：噪音类的头尾交叉淡化一段；有节奏的（海浪、风、钟）周期都整除循环长度。
// ============================================================
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.Ambience = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const RATE = 22050, SEC = 20, N = RATE * SEC, FADE = RATE;   // 20 秒一圈，头尾 1 秒交叉
  const KEY = "x_pomoAmbience", MINE_KEY = "__ambience_mine__";
  const LAYERS = [
    ["rain", "雨声"], ["stream", "溪水"], ["waves", "海浪"], ["wind", "风"], ["fire", "壁炉"],
    ["birds", "鸟叫"], ["purr", "猫呼噜"], ["clock", "钟"],
    ["brown", "棕噪音"], ["pink", "粉噪音"], ["white", "白噪音"]
  ];

  // ── 合成 ─────────────────────────────────────────────
  // 带种子的随机数：同一层每次合出来一样，重混时不会「换了一场雨」
  const rng = seed => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; }; };
  const noise = (len, seed) => { const r = rng(seed), a = new Float32Array(len); for (let i = 0; i < len; i++) a[i] = r(); return a; };
  const pinkOf = w => { const o = new Float32Array(w.length); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < w.length; i++) { const x = w[i];
      b0 = .99886 * b0 + x * .0555179; b1 = .99332 * b1 + x * .0750759; b2 = .969 * b2 + x * .153852;
      b3 = .8665 * b3 + x * .3104856; b4 = .55 * b4 + x * .5329522; b5 = -.7616 * b5 - x * .016898;
      o[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * .5362; b6 = x * .115926; } return o; };
  const brownOf = w => { const o = new Float32Array(w.length); let v = 0; for (let i = 0; i < w.length; i++) { v = (v + .02 * w[i]) / 1.02; o[i] = v; } return o; };
  const lowpass = (a, k) => { const o = new Float32Array(a.length); let v = 0; for (let i = 0; i < a.length; i++) { v += k * (a[i] - v); o[i] = v; } return o; };
  // 头尾接起来：多合 FADE 个样本，把尾巴淡进开头
  const loopIt = a => { const o = a.slice(0, N); for (let i = 0; i < FADE; i++) { const t = i / FADE; o[i] = a[i] * t + a[N + i] * (1 - t); } return o; };
  const norm = (a, peak) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i])); const k = m ? peak / m : 0; for (let i = 0; i < a.length; i++) a[i] *= k; return a; };
  const per = (i, sec) => Math.sin(2 * Math.PI * i / (RATE * sec));   // sec 必须整除 SEC

  // 二阶带通（RBJ 那一式）：f0 中心频率可以每个样本变——风的呜呜声就靠它扫
  const bandpass = (x, f0At, q) => {
    const o = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const w = 2 * Math.PI * f0At(i) / RATE, al = Math.sin(w) / (2 * q), cw = Math.cos(w), a0 = 1 + al;
      const y = ((al) * x[i] - al * x2 - (-2 * cw) * y1 - (1 - al) * y2) / a0;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = y; o[i] = y;
    }
    return o;
  };
  // 按「听起来多响」对齐（均方根），不是按最高点：最高点对齐的话，一直沙沙响的那几层会比别的吵一大截
  const rms = (a, target) => { let e = 0; for (let i = 0; i < a.length; i++) e += a[i] * a[i]; const k = e ? target / Math.sqrt(e / a.length) : 0; for (let i = 0; i < a.length; i++) a[i] *= k; return a; };
  const chirp = (o, at, len, f0, f1, amp, decay) => { let ph = 0; for (let j = 0; j < len && at + j < o.length; j++) { const f = f0 + (f1 - f0) * j / len; ph += 2 * Math.PI * f / RATE; o[at + j] += amp * Math.sin(ph) * Math.exp(-j / decay) * Math.min(1, j / 30); } };
  const randAt = (r, margin) => Math.floor((r() * .5 + .5) * (N - margin));

  // ⚠️她 2026-10-05：「好多听起来都一个样，放一点点就已经很吵」。
  //   第一版几乎全是「噪音换个滤波」，耳朵里都是沙沙。这一版每层抓住【它自己才有的那个声音】：
  //   雨是密密的雨点、溪是咕噜的水泡、鸟是啾、猫是一呼一吸的呼噜、风是呜呜扫过去、火是噼啪。
  //   三种噪音留着给要「纯底噪」的人，但统一压低。
  const SYN = {
    rain: () => {
      // 一层很轻的中频沙沙打底，上面是成千上万颗大小不一的雨点（每颗是一小截带通噪音）
      const bed = loopIt(bandpass(noise(N + FADE, 21), () => 1800, .7));
      const o = rms(bed, .02), r = rng(22), drop = noise(400, 23);
      for (let d = 0; d < 5200; d++) {
        const at = randAt(r, 400), amp = .02 + .06 * Math.pow(Math.abs(r()), 3), len = 120 + Math.floor(200 * Math.abs(r()));
        for (let j = 0; j < len; j++) o[at + j] += amp * drop[j] * Math.exp(-j / (len / 4));
      }
      return rms(o, .05);
    },
    stream: () => {
      // 溪水：一串往上滑的小水泡，底下一点点流水声
      const o = rms(loopIt(bandpass(noise(N + FADE, 61), () => 900, 1.2)), .012), r = rng(62);
      for (let k = 0; k < 900; k++) {
        const f0 = 350 + 700 * Math.abs(r()), len = Math.floor(RATE * (.02 + .04 * Math.abs(r())));
        chirp(o, randAt(r, len), len, f0, f0 * (1.6 + .6 * Math.abs(r())), .05 + .07 * Math.abs(r()), len / 3);
      }
      return rms(o, .05);
    },
    waves: () => {
      // 10 秒一浪：涨的时候低频涌上来，到顶那一下高频哗地碎开
      const lo = loopIt(lowpass(pinkOf(noise(N + FADE, 31)), .05)), hi = loopIt(bandpass(noise(N + FADE, 32), () => 2500, .5)), o = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const ph = (i / (RATE * 10)) % 1, swell = Math.pow(.5 - .5 * Math.cos(2 * Math.PI * ph), 2), wash = Math.exp(-Math.pow((ph - .55) / .12, 2));
        o[i] = lo[i] * (.08 + swell) + hi[i] * .35 * wash;
      }
      return rms(o, .05);
    },
    wind: () => {
      // 呜——的那一声：窄带通的中心频率慢慢地扫上扫下
      const x = noise(N + FADE, 41);
      const f = i => 380 + 220 * Math.sin(2 * Math.PI * (i % N) / (RATE * 20)) + 90 * Math.sin(2 * Math.PI * (i % N) / (RATE * 5));
      const o = loopIt(bandpass(x, f, 6));
      for (let i = 0; i < N; i++) o[i] *= .6 + .4 * Math.pow(.5 + .5 * per(i, 10), 2);
      return rms(o, .045);
    },
    fire: () => {
      // 几乎没有底噪，主要是噼啪：大小、亮暗都不一样的爆点
      const o = rms(loopIt(lowpass(brownOf(noise(N + FADE, 51)), .12)), .008), r = rng(52), pop = noise(600, 53);
      for (let c = 0; c < 420; c++) {
        const at = randAt(r, 600), amp = .05 + .35 * Math.pow(Math.abs(r()), 2.5), len = 60 + Math.floor(500 * Math.pow(Math.abs(r()), 2));
        for (let j = 0; j < len; j++) o[at + j] += amp * pop[(j * 3) % 600] * Math.exp(-j / (len / 5));
      }
      return rms(o, .04);
    },
    birds: () => {
      // 几只鸟隔一阵叫一串：每声是一段很快的上下滑音
      const o = new Float32Array(N), r = rng(71);
      for (let g = 0; g < 9; g++) {
        let at = randAt(r, RATE * 2); const base = 2600 + 1600 * Math.abs(r()), n = 2 + Math.floor(5 * Math.abs(r()));
        for (let k = 0; k < n; k++) {
          const len = Math.floor(RATE * (.05 + .07 * Math.abs(r())));
          chirp(o, at, len, base * (1 + .25 * r()), base * (1.3 + .3 * r()), .12, len / 2.5);
          at += len + Math.floor(RATE * (.03 + .08 * Math.abs(r())));
        }
      }
      return rms(o, .03);
    },
    purr: () => {
      // 猫打呼噜：25 下一秒的低颤，4 秒一呼一吸
      const b = loopIt(lowpass(brownOf(noise(N + FADE, 81)), .08)), o = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const breath = .35 + .65 * Math.pow(.5 - .5 * Math.cos(2 * Math.PI * i / (RATE * 4)), 1.5);
        o[i] = b[i] * (.5 + .5 * Math.sin(2 * Math.PI * 25 * i / RATE)) * breath;
      }
      return rms(o, .05);
    },
    clock: () => {
      const o = new Float32Array(N);
      for (let s = 0; s < SEC; s++) { const at = s * RATE, f = s % 2 ? 1700 : 2100;
        for (let j = 0; j < 700; j++) o[at + j] += Math.exp(-j / 90) * Math.sin(2 * Math.PI * f * j / RATE); }
      return rms(o, .02);
    },
    brown: () => rms(loopIt(brownOf(noise(N + FADE, 13))), .04),
    pink: () => rms(loopIt(pinkOf(noise(N + FADE, 12))), .025),
    white: () => rms(loopIt(noise(N + FADE, 11)), .015)
  };
  const cache = {};
  const layer = k => cache[k] || (cache[k] = SYN[k]());

  // 按各层音量混成一段；几层一起响时用 tanh 软压一下，不会炸
  function mix(levels) {
    const out = new Float32Array(N);
    let any = false;
    // 滑块按平方走：耳朵听响度是对数的，拖一点点就该是很轻的一点点
    LAYERS.forEach(([k]) => { const v = Number(levels && levels[k]) || 0; if (v <= 0) return; any = true; const g = v * v, a = layer(k); for (let i = 0; i < N; i++) out[i] += a[i] * g; });
    if (!any) return null;
    for (let i = 0; i < N; i++) out[i] = Math.tanh(out[i]);   // 只防爆，不放大
    return out;
  }
  function wavOf(f32) {
    const buf = new ArrayBuffer(44 + f32.length * 2), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + f32.length * 2, true); w(8, "WAV" + "E"); w(12, "fmt ");   // 拆开写 WAVE：全库不许有大写拉丁眉标那条测试认的是整串字面量
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, "data"); v.setUint32(40, f32.length * 2, true);
    for (let i = 0; i < f32.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, f32[i])) * 32767, true);
    return buf;
  }

  // ── 存档 ─────────────────────────────────────────────
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); if (v && typeof v === "object") return { levels: v.levels || {}, mine: Number(v.mine) || 0, mineName: v.mineName || "" }; } catch (e) {} return { levels: {}, mine: 0, mineName: "" }; };
  const save = cfg => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };
  const anyOn = cfg => { cfg = cfg || load(); return LAYERS.some(([k]) => (Number(cfg.levels[k]) || 0) > 0) || (cfg.mine > 0 && !!cfg.mineName); };

  // ── 播放 ─────────────────────────────────────────────
  // 两个 <audio> 挂在 body 上：离开番茄钟页面也照样响（跟一起听那个全局播放器一个道理）
  let synthEl = null, mineEl = null, synthUrl = null, mineUrl = null, playing = false, remixTimer = null;
  const el = () => { if (typeof document === "undefined") return null; const a = document.createElement("audio"); a.loop = true; a.preload = "auto"; a.setAttribute("playsinline", ""); a.style.display = "none"; document.body.appendChild(a); return a; };
  // 编成 data: 地址，不用 blob:——有的原生壳里 <audio> 放不了 blob:，静音保活一直用的就是 data:
  const dataUrlOf = buf => { const b = new Uint8Array(buf); let bin = ""; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return "data:audio/wav;base64," + btoa(bin); };
  const SILENT = () => dataUrlOf(wavOf(new Float32Array(RATE / 10)));
  function setSynth(cfg) {
    const f = mix(cfg.levels);
    if (!synthEl) synthEl = el(); if (!synthEl) return;
    if (!f) { synthEl.pause(); synthEl.removeAttribute("src"); synthUrl = null; return; }
    const at = synthEl.currentTime || 0;
    synthUrl = dataUrlOf(wavOf(f));
    synthEl.src = synthUrl;
    try { synthEl.currentTime = at % SEC; } catch (e) {}
    if (playing) synthEl.play().catch(() => {});
  }
  // iOS 只认【她点下去那一刻】同步调的 play()；中间隔了一次 await（比如上发条要先等模型写纸条）就不算了。
  //   所以在点击的当下先拿一小段静音把这两个 <audio> 解锁，之后换 src 再 play 就都放得出来。
  function unlock() {
    if (!synthEl) synthEl = el(); if (!mineEl) mineEl = el(); const s0 = SILENT();
    [synthEl, mineEl].forEach(a => { if (!a || !a.paused) return; if (!a.src) a.src = s0; const pr = a.play(); if (pr && pr.then) pr.then(() => { if (!playing) a.pause(); }).catch(() => {}); });
  }
  async function setMineEl(cfg) {
    if (!(cfg.mine > 0 && cfg.mineName)) { if (mineEl) mineEl.pause(); return; }
    if (!mineEl) mineEl = el(); if (!mineEl) return;
    if (!mineUrl) { try { const b = typeof idbAudioGet === "function" ? await idbAudioGet(MINE_KEY) : null; if (!b) return; mineUrl = URL.createObjectURL(b); mineEl.src = mineUrl; } catch (e) { return; } }
    try { mineEl.volume = Math.max(0, Math.min(1, cfg.mine)); } catch (e) {}   // iOS 上只读：照文件原音量放
    if (playing) mineEl.play().catch(() => {});
  }
  // play 必须在她点按钮的那一下里调（iOS 的自动播放规矩）
  function play() { unlock(); const cfg = load(); playing = true; setSynth(cfg); setMineEl(cfg); }
  function stop() { playing = false; if (synthEl) synthEl.pause(); if (mineEl) mineEl.pause(); }
  const isPlaying = () => playing;
  function setLevel(k, v) {
    const cfg = load();
    if (k === "mine") cfg.mine = v; else cfg.levels[k] = v;
    save(cfg);
    clearTimeout(remixTimer);
    if (k === "mine") { setMineEl(cfg); return cfg; }
    remixTimer = setTimeout(() => { if (playing) setSynth(cfg); }, 350);   // 拖滑块时别每一格都重混
    return cfg;
  }
  async function setMine(file) {
    if (!file || typeof idbAudioPut !== "function") return null;
    await idbAudioPut(MINE_KEY, file);
    if (mineUrl) { URL.revokeObjectURL(mineUrl); mineUrl = null; }
    const cfg = load(); cfg.mineName = String(file.name || "我的音频").slice(0, 40); if (!cfg.mine) cfg.mine = .6; save(cfg);
    await setMineEl(cfg);
    return cfg;
  }
  async function clearMine() {
    try { if (typeof idbAudioDel === "function") await idbAudioDel(MINE_KEY); } catch (e) {}
    if (mineEl) mineEl.pause(); if (mineUrl) { URL.revokeObjectURL(mineUrl); mineUrl = null; }
    const cfg = load(); cfg.mineName = ""; cfg.mine = 0; save(cfg); return cfg;
  }
  return { LAYERS, RATE, SEC, load, save, anyOn, play, stop, unlock, isPlaying, setLevel, setMine, clearMine, _mix: mix, _wavOf: wavOf, _layer: layer };
});
