// 导入吃 zip（她 2026-11-28「我们导入不支持 zip 吗」→「公共的」）：
//   全 App 只这一处。任何一个选文件的框选到 .zip，先在这儿解开，把里面的文件原样换进这个框，再让原来那段导入照常跑——
//   数据备份、角色卡、世界书、表情包、美化……各处一行都不用改，各处原来认什么文件现在还认什么。
//   ⚠️解压用浏览器自带的 DecompressionStream，不引第三方库；只认普通 zip（存储／deflate），zip64 和加密的不认，原样交出去让那一处照旧报读不出来。
(function () {
  const MIME = { json: "application/json", txt: "text/plain", md: "text/markdown", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", css: "text/css", html: "text/html", svg: "image/svg+xml" };
  const isZip = f => !!f && (/\.zip$/i.test(f.name || "") || /zip/i.test(f.type || ""));
  // 压缩包里的杂物：Mac 的 __MACOSX、.DS_Store、Windows 的 Thumbs.db、文件夹本身
  const junk = n => !n || /\/$/.test(n) || /(^|\/)__MACOSX\//.test(n) || /(^|\/)\.DS_Store$/.test(n) || /(^|\/)Thumbs\.db$/i.test(n) || /(^|\/)\._/.test(n);
  function nameOf(bytes, utf8) {
    // 没标 UTF-8 的多半是 Windows 中文系统打的包（GBK）：先按 UTF-8 严格解，解不了再按 GBK
    if (!utf8) { try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch (e) { try { return new TextDecoder("gbk").decode(bytes); } catch (e2) {} } }
    return new TextDecoder("utf-8").decode(bytes);
  }
  async function unzip(file) {
    const buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer);
    // 找目录尾（EOCD）：从文件末尾往回找签名 50 4b 05 06
    let eo = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
    if (eo < 0) throw new Error("不是能解开的 zip");
    const count = dv.getUint16(eo + 10, true);
    let p = dv.getUint32(eo + 16, true);
    const out = [];
    for (let k = 0; k < count; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const flag = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), loc = dv.getUint32(p + 42, true);
      const full = nameOf(buf.subarray(p + 46, p + 46 + nlen), !!(flag & 0x800));
      p += 46 + nlen + xlen + clen;
      if (junk(full) || (flag & 1)) continue;   // 杂物、加密的跳过
      if (dv.getUint32(loc, true) !== 0x04034b50) continue;
      const start = loc + 30 + dv.getUint16(loc + 26, true) + dv.getUint16(loc + 28, true);
      const raw = buf.subarray(start, start + csize);
      let data;
      if (method === 0) data = new Blob([raw]);
      else if (method === 8 && typeof DecompressionStream === "function") data = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();
      else continue;
      const base = full.split("/").pop(), ext = (base.split(".").pop() || "").toLowerCase();
      // 压缩包里又套着 zip：再解一层
      const f = new File([data], base, { type: MIME[ext] || "application/octet-stream", lastModified: file.lastModified || Date.now() });
      if (isZip(f)) { try { out.push(...await unzip(f)); continue; } catch (e) {} }
      out.push(f);
    }
    return out;
  }
  async function expand(files) {
    const list = Array.from(files || []), out = [];
    for (const f of list) {
      if (!isZip(f)) { out.push(f); continue; }
      try { const inner = await unzip(f); if (inner.length) out.push(...inner); else out.push(f); } catch (e) { out.push(f); }
    }
    return out;
  }
  // 挂在 document 的捕获阶段：比 React 挂在根上的那一份先收到 change。里面有 zip 就先拦下、解开、换掉 input.files、再发一次 change
  if (typeof document !== "undefined" && typeof DataTransfer === "function") {
    document.addEventListener("change", e => {
      const el = e.target;
      if (!el || el.tagName !== "INPUT" || el.type !== "file" || el.__zipDone || !el.files || !Array.from(el.files).some(isZip)) return;
      e.stopImmediatePropagation();
      expand(el.files).then(files => {
        try {
          const dt = new DataTransfer(); files.forEach(f => dt.items.add(f));
          el.files = dt.files;
          if (window.__toast && files.length && !files.some(isZip)) window.__toast("解开了压缩包，里面 " + files.length + " 个文件", 2500);
        } catch (er) {}
        el.__zipDone = true;
        try { el.dispatchEvent(new Event("change", { bubbles: true })); } finally { el.__zipDone = false; }
      });
    }, true);
  }
  if (typeof window !== "undefined") window.ZipIn = { isZip, unzip, expand };
  if (typeof module !== "undefined") module.exports = { isZip, unzip, expand };
})();
