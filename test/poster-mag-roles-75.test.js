// 她 2026-10-13：杂志封面单独一套——四种字（刊名/主专题/封面栏目/细节）、类型定密度、栏目要是真事、band 不再默认赢
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const src = R("js/poster-layout.js"), app = R("js/app.js");
const win = {}; new Function("window", src)(win);
const T = win.PosterLayout._t;

test("类型定密度：八卦最满、文艺最少", () => {
  assert.equal(T.mtypeOf("八卦"), "八卦"); assert.equal(T.mtypeOf("", "文学月刊"), "文艺"); assert.equal(T.mtypeOf(""), "生活");
  assert.ok(T.MTYPE.八卦.lines > T.MTYPE.文艺.lines);
});

test("栏目是「小引题＋一句」，最多三组；老存档的 lines 照样认", () => {
  const m = T.magCopy({ coverLines: [{ kicker: "本刊独家", line: "拒绝洗碗事件始末" }, { kicker: "a", line: "b" }, { line: "c" }, { line: "d" }], story: { kicker: "本期封面" }, no: "NO.27" }, "标题");
  assert.equal(m.groups.length, 3); assert.equal(m.groups[0].kicker, "本刊独家"); assert.equal(m.no, "27"); assert.equal(m.story, "标题");
  assert.deepEqual(T.magCopy({ lines: ["老一句"] }, "x").groups, [{ kicker: "", line: "老一句" }]);
});

test("打分看层级：主专题比刊名还大要扣分", () => {
  const look = () => ({ mean: 0.1, busy: 0.02, skin: 0 });
  const good = [{ x: 50, y: 20, w: 900, h: 200, role: "mast", g: "mast" }, { x: 50, y: 1200, w: 600, h: 120, role: "story", g: "head" }];
  const bad = [{ x: 50, y: 20, w: 900, h: 80, role: "mast", g: "mast" }, { x: 50, y: 1200, w: 600, h: 120, role: "story", g: "head" }];
  assert.ok(T.magScore(good, 1000, 1500, look, {}, "生活") > T.magScore(bad, 1000, 1500, look, {}, "生活"));
});

test("band 不再在性格表里占多数；类型也投票", () => {
  const line = src.match(/MAG_PREF = \{[^\n]*\}/)[0], c = k => (line.match(new RegExp('"' + k + '"', "g")) || []).length;
  assert.ok(c("band") <= Math.min(c("classic"), c("framed")), "band 出现得比别的骨架还多");
  assert.match(src, /MTYPE\[mtype\]\.prefs/);
});

test("文案要真事、不要空话", () => {
  assert.match(app, /coverLines＝0~3 组封面栏目/);
  assert.match(app, /不许写「独家揭秘」「甜蜜瞬间」/);
  assert.match(app, /mtype＝这是本什么杂志/);
});

test("挑了衣服，海报的 shot 和生图那句都不许另换装（她 2026-10-13：挑了衬衫拍成女仆装）", () => {
  assert.match(app, /coverCopy\(char, theme\.overlay, [^\n]*, picked\)/);
  assert.match(app, /shot 里只写站位、动作和镜头，不许写穿什么/);
  assert.match(app, /\(picked \? "两个人身上穿的一律照上面挑好的那身/);
});
