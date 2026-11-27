// 旧 iPhone 也装得进来（群友 2026-11-27 白屏：「SyntaxError: Invalid regular expression: invalid group specifier name」）
//   iOS 16.4 以前的 Safari 不认「往前看」那种正则（(?<=…) / (?<!…)）。写成 /…/ 字面量的话，
//   整个脚本在解析那一刻就报错，app 一个字都装不进来——跟这条正则用不用得上无关。
//   所以凡是带往前看的正则一律写成 (globalThis.reLB || RegExp)(String.raw`…`, "g")：新系统原样用；旧系统把往前看那一截拿掉再编（判断粗一点，但 app 能开）。
//   「|| RegExp」那半是给测试沙盒的：沙盒里没装这一份，就直接用原生的，测试不用一份份改。
// ⚠️只写在这一处（one-public-mechanism）；test/regex-lookbehind-compat.test.js 卡着不许再出现字面量。
(function (root) {
  function stripLookbehind(src) {
    let out = "", i = 0;
    while (i < src.length) {
      if (src[i] === "\\") { out += src.slice(i, i + 2); i += 2; continue; }
      if (src.startsWith("(?<=", i) || src.startsWith("(?<!", i)) {
        let depth = 0, inCls = false, j = i;
        for (; j < src.length; j++) {
          const c = src[j];
          if (c === "\\") { j++; continue; }
          if (inCls) { if (c === "]") inCls = false; continue; }
          if (c === "[") { inCls = true; continue; }
          if (c === "(") depth++;
          else if (c === ")" && --depth === 0) break;
        }
        i = j + 1; continue;
      }
      out += src[i++];
    }
    return out;
  }
  function reLB(src, flags) {
    try { return new RegExp(src, flags || ""); }
    catch (e) { return new RegExp(stripLookbehind(src), flags || ""); }
  }
  reLB.strip = stripLookbehind;
  root.reLB = reLB;
  if (typeof module !== "undefined" && module.exports) module.exports = reLB;
})(typeof window !== "undefined" ? window : globalThis);
