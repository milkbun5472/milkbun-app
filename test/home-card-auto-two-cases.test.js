// 群友 2026-10-20：名片选「原尺寸」被压成一条——下面那行不是空的就被裁掉半截。
//   照顺序判断「下面是不是空格」不可靠（主屏 dense 排），所以原尺寸一律占 4×2，
//   紧跟它的那一排垫底空格在 buildLayout 里收掉，默认布局不多出空行。
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
const sf = src.slice(src.indexOf("  const spanFor = function (key, it) {"), src.indexOf("  // 每项占几列几行（4 列制）"));
const span = sizes => new Function("widgetSizes", "homeSizeOf", "homeItemSpan", sf + "; return spanFor('w_card', {});")(
  sizes || {}, (k, s) => (s && s[k]) || "auto", () => [4, 1]);
assert.deepEqual(span(), [4, 2], "原尺寸：自己占两行");
assert.deepEqual(span({ w_card: "wide" }), [4, 1], "她自己挑了尺寸的照她挑的");
const ab = src.slice(src.indexOf("    function cardAbsorbSpacers(out) {"), src.indexOf("    saved = saved || {};"));
const absorb = (pages, sizes) => { new Function("widgetSizes", "homeSizeOf", "SP_RE", ab + "; cardAbsorbSpacers(arguments[3]);")(
  sizes || {}, (k, s) => (s && s[k]) || "auto", /^sp_/, pages); return pages; };
assert.deepEqual(absorb([["w_card", "sp_a", "sp_b", "sp_c", "sp_d", "sp_e", "chat"]]), [["w_card", "sp_e", "chat"]], "垫底那一排收掉，只收一排");
assert.deepEqual(absorb([["w_card", "chat", "sp_a"]]), [["w_card", "chat", "sp_a"]], "下面是东西就不动");
assert.deepEqual(absorb([["w_card", "sp_a"]], { w_card: "wide" }), [["w_card", "sp_a"]], "不是原尺寸不收");
assert.match(src, /cardAbsorbSpacers\(out\);\n    var capRows/, "buildLayout 排容量之前先收");
assert.match(src, /const span = \(it\.kind === "widget" \|\| it\.kind === "decor"\) \? spanFor\(key, it\) : \[1, 1\];/, "画格子那处也要走同一个判断");
assert.match(src, /alignSelf: HOME_FREE_HEIGHT\[key\] && !asIcon \? "start" : undefined/, "名片按自己内容高，不被拉满两行");
assert.match(src, /inner = h\(HomeCard, \{ flush: true,/, "主屏格子里的名片不带下边距");
assert.match(src, /marginBottom: flush \? 0 : 14/);
console.log("ok");
