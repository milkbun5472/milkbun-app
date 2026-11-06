// GIF 拆帧、拼帧（她 2026-11-06：动图表情要能切九宫格、要能印字）。
//   动图表情是一整张 GIF 回来的：要切成九张、或者在底下印上名字，都得先拆成一帧一帧的画面，
//   改完再拼回 GIF。浏览器自己只会放 GIF、不会拆也不会拼，所以这儿手写一份最小的编解码，不引外部库。
//   decode(ArrayBuffer) → { width, height, frames: [{ rgba: Uint8ClampedArray(整张画布), delay: 毫秒 }] }
//   encode({ width, height, frames: [{ rgba, delay }] }) → Uint8Array（一张循环播放的 GIF）
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GifCodec = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  // ---- 解码 ----
  function lzwDecode(minSize, data, pixelCount) {
    const out = new Uint8Array(pixelCount);
    const clear = 1 << minSize, eoi = clear + 1;
    const prefix = new Int16Array(4096), suffix = new Uint8Array(4096), stack = new Uint8Array(4097);
    let codeSize = minSize + 1, codeMask = (1 << codeSize) - 1, avail = clear + 2, old = -1, first = 0;
    for (let c = 0; c < clear; c++) { prefix[c] = -1; suffix[c] = c; }
    let bits = 0, datum = 0, pi = 0, op = 0;
    while (op < pixelCount) {
      while (bits < codeSize) { if (pi >= data.length) return out; datum |= data[pi++] << bits; bits += 8; }
      const code = datum & codeMask; datum >>>= codeSize; bits -= codeSize;
      if (code === clear) { codeSize = minSize + 1; codeMask = (1 << codeSize) - 1; avail = clear + 2; old = -1; continue; }
      if (code === eoi) break;
      if (old === -1) { out[op++] = suffix[code]; old = code; first = code; continue; }
      let sp = 0, cur = code;
      if (cur >= avail) { stack[sp++] = first; cur = old; }
      while (cur >= clear) { stack[sp++] = suffix[cur]; cur = prefix[cur]; }
      first = suffix[cur]; stack[sp++] = first;
      if (avail < 4096) { prefix[avail] = old; suffix[avail] = first; avail++; if ((avail & codeMask) === 0 && avail < 4096) { codeSize++; codeMask = (1 << codeSize) - 1; } }
      old = code;
      while (sp > 0 && op < pixelCount) out[op++] = stack[--sp];
    }
    return out;
  }
  function decode(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (String.fromCharCode(b[0], b[1], b[2]) !== "GIF") throw new Error("不是 GIF");
    const W = b[6] | (b[7] << 8), H = b[8] | (b[9] << 8), pk = b[10];
    let p = 13, gct = null;
    const readCT = n => { const t = b.subarray(p, p + n * 3); p += n * 3; return t; };
    if (pk & 0x80) gct = readCT(1 << ((pk & 7) + 1));
    const canvas = new Uint8ClampedArray(W * H * 4), frames = [];
    let gce = { disposal: 0, delay: 100, trans: -1 };
    const subBlocks = () => { const parts = []; let n = 0; while (p < b.length) { const len = b[p++]; if (!len) break; parts.push(b.subarray(p, p + len)); n += len; p += len; }
      const all = new Uint8Array(n); let o = 0; parts.forEach(x => { all.set(x, o); o += x.length; }); return all; };
    while (p < b.length) {
      const t = b[p++];
      if (t === 0x3B) break;
      if (t === 0x21) {
        const label = b[p++];
        if (label === 0xF9) { const sz = b[p]; const q = b[p + 1]; gce = { disposal: (q >> 2) & 7, delay: ((b[p + 2] | (b[p + 3] << 8)) * 10) || 100, trans: (q & 1) ? b[p + 4] : -1 }; p += sz + 1; subBlocks(); }
        else subBlocks();
        continue;
      }
      if (t !== 0x2C) break;
      const ix = b[p] | (b[p + 1] << 8), iy = b[p + 2] | (b[p + 3] << 8), iw = b[p + 4] | (b[p + 5] << 8), ih = b[p + 6] | (b[p + 7] << 8), ipk = b[p + 8]; p += 9;
      const lct = (ipk & 0x80) ? readCT(1 << ((ipk & 7) + 1)) : null, ct = lct || gct;
      const minSize = b[p++];
      const idx = lzwDecode(minSize, subBlocks(), iw * ih);
      const saved = gce.disposal === 3 ? canvas.slice() : null;
      // 隔行存的要按 0,8 / 4,8 / 2,4 / 1,2 这四趟排回去
      const rowOf = (ipk & 0x40) ? (() => { const rows = []; [[0, 8], [4, 8], [2, 4], [1, 2]].forEach(([s, st]) => { for (let y = s; y < ih; y += st) rows.push(y); }); return r => rows[r]; })() : r => r;
      if (ct) for (let r = 0; r < ih; r++) {
        const y = iy + rowOf(r); if (y >= H) continue;
        for (let x = 0; x < iw; x++) {
          const ci = idx[r * iw + x], X = ix + x; if (X >= W || ci === gce.trans) continue;
          const o = (y * W + X) * 4; canvas[o] = ct[ci * 3]; canvas[o + 1] = ct[ci * 3 + 1]; canvas[o + 2] = ct[ci * 3 + 2]; canvas[o + 3] = 255;
        }
      }
      frames.push({ rgba: canvas.slice(), delay: gce.delay });
      if (gce.disposal === 2) for (let y = iy; y < Math.min(H, iy + ih); y++) canvas.fill(0, (y * W + ix) * 4, (y * W + Math.min(W, ix + iw)) * 4);
      else if (gce.disposal === 3 && saved) canvas.set(saved);
      gce = { disposal: 0, delay: 100, trans: -1 };
    }
    return { width: W, height: H, frames };
  }

  // ---- 编码 ----
  // 每帧一张 256 色的局部色表：颜色按 5 位一档归桶，取最常见的 256 桶的平均色。贴纸是平涂的，够用
  function quantize(rgba) {
    const n = rgba.length / 4, cnt = new Uint32Array(32768), sr = new Float64Array(32768), sg = new Float64Array(32768), sb = new Float64Array(32768), keys = new Uint16Array(n);
    for (let i = 0; i < n; i++) {
      let r = rgba[i * 4], g = rgba[i * 4 + 1], bl = rgba[i * 4 + 2];
      if (rgba[i * 4 + 3] < 128) { r = g = bl = 255; }   // 透明的当白底
      const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (bl >> 3); keys[i] = k; cnt[k]++; sr[k] += r; sg[k] += g; sb[k] += bl;
    }
    const used = []; for (let k = 0; k < 32768; k++) if (cnt[k]) used.push(k);
    used.sort((a, c) => cnt[c] - cnt[a]);
    const top = used.slice(0, 256), pal = new Uint8Array(256 * 3);
    top.forEach((k, j) => { pal[j * 3] = sr[k] / cnt[k]; pal[j * 3 + 1] = sg[k] / cnt[k]; pal[j * 3 + 2] = sb[k] / cnt[k]; });
    const map = new Int16Array(32768).fill(-1);
    top.forEach((k, j) => { map[k] = j; });
    const idx = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const k = keys[i];
      if (map[k] < 0) { const r = (k >> 10) << 3, g = ((k >> 5) & 31) << 3, bl = (k & 31) << 3; let best = 0, bd = 1e9;
        for (let j = 0; j < top.length; j++) { const dr = pal[j * 3] - r, dg = pal[j * 3 + 1] - g, db = pal[j * 3 + 2] - bl, d = dr * dr * 2 + dg * dg * 4 + db * db * 3; if (d < bd) { bd = d; best = j; } }
        map[k] = best; }
      idx[i] = map[k];
    }
    return { pal, idx };
  }
  function lzwEncode(idx, out) {
    const minSize = 8, clear = 256, eoi = 257;
    let codeSize = 9, next = 258, dict = new Map(), cur = 0, bits = 0, block = [];
    const emit = code => { cur |= code << bits; bits += codeSize; while (bits >= 8) { block.push(cur & 255); cur >>>= 8; bits -= 8; if (block.length === 255) { out.push(255, ...block); block = []; } } };
    out.push(minSize);
    emit(clear);
    let prefix = idx[0];
    for (let i = 1; i < idx.length; i++) {
      const c = idx[i], key = (prefix << 8) | c, hit = dict.get(key);
      if (hit !== undefined) { prefix = hit; continue; }
      emit(prefix);
      if (next < 4096) { dict.set(key, next++); if (next > (1 << codeSize) && codeSize < 12) codeSize++; }
      else { emit(clear); dict = new Map(); next = 258; codeSize = 9; }
      prefix = c;
    }
    emit(prefix); emit(eoi);
    if (bits > 0) block.push(cur & 255);
    if (block.length) out.push(block.length, ...block);
    out.push(0);
  }
  function encode(gif) {
    const W = gif.width, H = gif.height, out = [];
    const u16 = v => { out.push(v & 255, (v >> 8) & 255); };
    "GIF89a".split("").forEach(ch => out.push(ch.charCodeAt(0)));
    u16(W); u16(H); out.push(0x00, 0, 0);   // 不带全局色表，每帧自己一张
    out.push(0x21, 0xFF, 11); "NETSCAPE2.0".split("").forEach(ch => out.push(ch.charCodeAt(0))); out.push(3, 1, 0, 0, 0);   // 无限循环
    (gif.frames || []).forEach(f => {
      const d = Math.max(2, Math.round((Number(f.delay) || 100) / 10));
      out.push(0x21, 0xF9, 4, 0x04, d & 255, (d >> 8) & 255, 0, 0);   // 处置方式 1：留着，下一帧整张盖上去
      out.push(0x2C); u16(0); u16(0); u16(W); u16(H); out.push(0x87);   // 带 256 色局部色表
      const q = quantize(f.rgba);
      for (let i = 0; i < 768; i++) out.push(q.pal[i]);
      lzwEncode(q.idx, out);
    });
    out.push(0x3B);
    return new Uint8Array(out);
  }

  return { decode, encode };
});
