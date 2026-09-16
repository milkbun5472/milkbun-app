// 她 2026-09-16：「语音条的颜色没跟上设定的气泡颜色和样式」。
//
// 查下来语音条从头到尾就没被当成一只气泡：
//   · 四层皮肤 CSS 的选择器全是 [data-wk="bubble"][data-me=…]，
//     而语音条挂的是 data-wk="voice"、**连 data-me 都没有**
//     ——「她给某个人单挑的那套气泡」那两层连选都选不中它。
//   · 全局那层也只是 VoiceMsg 自己手抄了一个 myBg：
//     TA 那半边干脆用 t.bg2（皮肤里的 charBg 压根没人问）、
//     文字色写死 "#16330a" / t.ink、圆角写死 15、描边写死 1px t.line、投影没有。
//   · 播放键是【实心圆 + 挖底色的图标】，所以它必须知道底色是什么——
//     写死 myBg / t.bg2，换了皮肤三角形就隐形。
//
// 改法（施工规则/one-public-mechanism.md）：同一样东西（一只气泡的长相）只许有一份规则。
// 皮肤那一层多认一个选择器，VoiceMsg 照文字气泡那一处原样取值，里面一律 currentColor。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

const decls = src.slice(src.indexOf("const bubbleDecls = S =>"), src.indexOf("function applyChatLook"));
// ⚠️只看【代码】，把注释行剔掉：病历里会逐字引用旧的死值（"#16330a"），
//   照着整段 grep 的话，写得越清楚的注释越容易把自己的测试搞红。
const strip = t => t.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const vm = strip(src.slice(src.indexOf("function VoiceMsg({"), src.indexOf("// 气泡上的播放键")));

test("皮肤 CSS 认得语音条这两个选择器", () => {
  assert.match(decls, /one\('\[data-wk="voice"\]\[data-me="1"\]'/);
  assert.match(decls, /one\('\[data-wk="voice"\]\[data-me="0"\]'/);
});

test("语音条吃到的是跟文字气泡一模一样的五样：底、字、描边、圆角、投影", () => {
  const seg = decls.slice(decls.indexOf('[data-wk="voice"][data-me="1"]'), decls.indexOf("聊天页底色"));
  ["S.myBg", "S.myText", "S.myBorder", "S.charBg", "S.charText", "S.charBorder"].forEach(k =>
    assert.ok(seg.includes(k), "语音条没吃到 " + k));
  assert.equal((seg.match(/border-radius:/g) || []).length, 2);
  assert.equal((seg.match(/box-shadow:/g) || []).length, 2);
});

test("语音条自己带 data-me，不然「这个人那两层」选不中它", () => {
  assert.match(vm, /"data-wk": "voice", "data-me": isU \? "1" : "0"/);
});

test("VoiceMsg 的长相照文字气泡那一处取，不再自己拼一份", () => {
  assert.match(vm, /background: isU \? BUBBLE_SKIN\.myBg : BUBBLE_SKIN\.charBg/);
  assert.match(vm, /color: isU \? BUBBLE_SKIN\.myText : \(BUBBLE_SKIN\.charText \|\| t\.ink\)/);
  assert.match(vm, /border: \(isU \? BUBBLE_SKIN\.myBorder : BUBBLE_SKIN\.charBorder\) \|\| "none"/);
  assert.match(vm, /borderRadius: BUBBLE_SKIN\.radius/);
  assert.match(vm, /boxShadow: BUBBLE_SKIN\.shadow \|\| "none"/);
  // 旧的那几个死值一个都不许留
  assert.ok(!/#16330a/.test(vm), "文字色还写死着");
  assert.ok(!/background: isU \? BUBBLE_SKIN\.myBg : t\.bg2/.test(vm), "TA 那半边还在用 t.bg2，charBg 照旧没人问");
  assert.ok(!/borderRadius: 15/.test(vm), "圆角还写死 15");
});

test("里面的波形、时长、转录一律 currentColor 跟着外面走", () => {
  assert.match(vm, /const fg = "currentColor";/);
  assert.ok(!/const fg = isU \?/.test(vm));
});

test("播放键不再需要知道底色：半透明 currentColor 的圆底 + currentColor 的图标", () => {
  assert.match(vm, /background: "currentColor", opacity: 0\.16/);
  assert.match(vm, /border: "1\.6px solid currentColor"/);
  assert.match(vm, /h\(Svg, \{ size: 12, color: "currentColor", sw: 0 \}/);
  assert.ok(!/fill: isU \? BUBBLE_SKIN\.myBg : t\.bg2/.test(vm), "图标还在挖底色");
});

test("展开转录那条分隔线不用 border：currentColor 带不了透明度，会变成一条实线", () => {
  assert.match(vm, /height: 1, background: "currentColor", opacity: 0\.18/);
  assert.ok(!/borderTop: `1px solid \$\{line\}`/.test(vm));
});

test("单聊和群聊两处的选中描边圆角也跟着皮肤走", () => {
  const hits = src.match(/outlineOffset: 2, borderRadius: BUBBLE_SKIN\.radius \}/g) || [];
  assert.equal(hits.length, 2, "两处语音条外壳都要跟着改，不然圆角一变描边就对不上");
  assert.ok(!/outlineOffset: 2, borderRadius: 18 \}/.test(src), "还有一处写死 18");
});

test("主题工作室那两个挂点没被改名（她写好的主题不能失效）", () => {
  const studio = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio.js"), "utf8");
  assert.match(studio, /\["voice", "语音消息整块"\], \["voicebar", "语音条"\]/);
  assert.match(vm, /"data-wk": "voicebar"/);
});
