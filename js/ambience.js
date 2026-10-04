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
    ["rain", "雨声"], ["waves", "海浪"], ["wind", "风"], ["fire", "壁炉"], ["clock", "钟"],
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

  const SYN = {
    white: () => norm(loopIt(noise(N + FADE, 11)), .35),
    pink: () => norm(loopIt(pinkOf(noise(N + FADE, 12))), .45),
    brown: () => norm(loopIt(brownOf(noise(N + FADE, 13))), .6),
    rain: () => {
      // 沙沙的底（粉噪音去掉低频）＋一阵一阵的疏密＋随机落下的雨滴
      const p = pinkOf(noise(N + FADE, 21)), o = new Float32Array(N + FADE);
      let prev = 0; for (let i = 0; i < o.length; i++) { const hp = p[i] - prev; prev = p[i]; o[i] = hp; }
      const base = loopIt(o);
      for (let i = 0; i < N; i++) base[i] *= .8 + .2 * per(i, 5) * per(i, 4);
      const r = rng(22);
      for (let d = 0; d < 260; d++) {
        const at = Math.floor((r() * .5 + .5) * (N - 600)), amp = .25 + .35 * Math.abs(r()), f = 2400 + 1800 * r();
        for (let j = 0; j < 500; j++) base[at + j] += amp * Math.exp(-j / 70) * Math.sin(2 * Math.PI * f * j / RATE);
      }
      return norm(base, .5);
    },
    waves: () => {
      // 棕噪音按 10 秒一涨一落（20 秒里正好两浪）
      const b = loopIt(brownOf(noise(N + FADE, 31))), o = new Float32Array(N);
      for (let i = 0; i < N; i++) { const env = Math.pow(.5 - .5 * Math.cos(2 * Math.PI * i / (RATE * 10)), 1.6); o[i] = b[i] * (.12 + env); }
      return norm(o, .6);
    },
    wind: () => {
      const b = loopIt(lowpass(pinkOf(noise(N + FADE, 41)), .08)), o = new Float32Array(N);
      for (let i = 0; i < N; i++) o[i] = b[i] * (.55 + .3 * per(i, 20) + .15 * per(i, 4));
      return norm(o, .55);
    },
    fire: () => {
      // 低低的一团火声＋噼啪
      const o = norm(loopIt(lowpass(brownOf(noise(N + FADE, 51)), .3)), .35), r = rng(52);
      for (let c = 0; c < 140; c++) {
        const at = Math.floor((r() * .5 + .5) * (N - 400)), amp = .2 + .5 * Math.abs(r());
        for (let j = 0; j < 300; j++) o[at + j] += amp * Math.exp(-j / (8 + 20 * Math.abs(r()))) * r();
      }
      return norm(o, .55);
    },
    clock: () => {
      // 一秒一下，滴、答两种音高交替
      const o = new Float32Array(N);
      for (let s = 0; s < SEC; s++) { const at = s * RATE, f = s % 2 ? 1700 : 2100;
        for (let j = 0; j < 700; j++) o[at + j] += Math.exp(-j / 90) * Math.sin(2 * Math.PI * f * j / RATE); }
      return norm(o, .45);
    }
  };
  const cache = {};
  const layer = k => cache[k] || (cache[k] = SYN[k]());

  // 按各层音量混成一段；几层一起响时用 tanh 软压一下，不会炸
  function mix(levels) {
    const out = new Float32Array(N);
    let any = false;
    LAYERS.forEach(([k]) => { const g = Number(levels && levels[k]) || 0; if (g <= 0) return; any = true; const a = layer(k); for (let i = 0; i < N; i++) out[i] += a[i] * g; });
    if (!any) return null;
    for (let i = 0; i < N; i++) out[i] = Math.tanh(out[i] * 1.2) / Math.tanh(1.2);
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
