// 群友 2026-10-20：名片选「原尺寸」也被压成一条——下面那行不是空格时伸出去的半截被裁掉。
//   她：「为啥不能做两种情况的适配」→ 下面是一整行空格就照旧 4×1；不是就自己占 4×2。
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
const a = src.indexOf("  const cardHasSpacerRow = ("), b = src.indexOf("  // 每项占几列几行（4 列制）", a);
const seg = src.slice(a, b);
const run = (layout, sizes) => new Function("layout", "DEFAULT_LAYOUT", "SP_RE", "widgetSizes", "homeSizeOf", "homeItemSpan",
  seg + "; return spanFor('w_card', {});")(layout, [["w_card", "sp_a", "sp_b", "sp_c", "sp_d"]], /^sp_/, sizes || {},
  (k, s) => (s && s[k]) || "auto", () => [4, 1]);
assert.deepEqual(run(null), [4, 1], "没存过布局（默认那份下面垫着空格）：照旧 4×1");
assert.deepEqual(run({ 0: ["w_card", "sp_1", "sp_2", "sp_3", "sp_4", "chat"] }), [4, 1], "下面一整行空格：伸进去");
assert.deepEqual(run({ 0: ["w_card", "chat", "sp_2", "sp_3", "sp_4"] }), [4, 2], "下面有东西：自己占两行");
assert.deepEqual(run({ 0: ["w_card"] }), [4, 2], "下面什么都没有：也占两行，别被裁");
assert.deepEqual(run({ 0: ["w_card", "chat"] }, { w_card: "wide" }), [4, 1], "她自己挑了尺寸的照她挑的");
assert.match(src, /const span = \(it\.kind === "widget" \|\| it\.kind === "decor"\) \? spanFor\(key, it\) : \[1, 1\];/, "画格子那处也要走同一个判断");
console.log("ok");
