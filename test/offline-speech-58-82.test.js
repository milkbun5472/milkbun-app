const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const comp = R("components.js"), eng = R("engine.js");
const grab = (src, a, b, cap) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return src.slice(i, j);
};
// 引号那一份判据（engine）
const SP = new Function(grab(eng, "function speechSpans(text) {", "// 按台词内容粗判语气") + "\nreturn { speechSpans, extractSpeech };")();
// 线下正文分段 + 对比度（components）
const K = new Function("speechSpans", "h", grab(comp, "const offLum = hex =>", "function offCardSkin(t, accent) {")
  + "\nreturn { offSplit, offReadable, offContrast, offLum };")(SP.speechSpans, () => null);

// 她 2026-08-31 看完参考图：「很多他们说话的部分是有单独 emphasis……我们这个还是米白背景
// 加细框有点无聊，但是你只是做换纸张也还是治标不治本」。
// 治本的那一下：在【一段正文内部】把台词和叙述分开。原来整段一个灰度，底下换什么纸都是一堵墙。
test("一段正文切成台词和叙述，一个字都不许丢", () => {
  const s = "他把伞收了：「你站这儿多久了。」他没往里走，又说「你袖口都湿透了。」";
  const segs = K.offSplit(s);
  assert.equal(segs.map(x => x.s).join(""), s, "切完拼不回原文——正文被吃掉了字");
  assert.deepEqual(segs.map(x => x.k), ["prose", "say", "prose", "say"]);
  assert.equal(segs[1].s, "「你站这儿多久了。」", "引号本身要留着,不许把她写的标点吞掉");
});

test("整段都是叙述时，只给一段 prose——不然正文会被白白变浅", () => {
  assert.deepEqual(K.offSplit("雨还没停。廊下的灯被风吹得晃。"), [{ k: "prose", s: "雨还没停。廊下的灯被风吹得晃。" }]);
  assert.deepEqual(K.offSplit(""), [{ k: "prose", s: "" }]);
  const body = grab(comp, "function offBody(t, text, accent) {", "function offCardSkin(t, accent) {");
  assert.match(body, /const hasSay = segs\.some\(x => x\.k === "say"\);/, "没判这段里到底有没有台词");
  assert.match(body, /color: hasSay \? t\.sub : t\.ink/, "没有台词的那种整段也被压浅了");
});

// 引号判据只该有一处：念台词和上重音必须是同一个判断
test("引号那套判据只有一份，components 没有自己再写一个正则", () => {
  assert.match(eng, /function speechSpans\(text\) \{/, "engine 里没有那一份");
  assert.match(eng, /return speechSpans\(text\)\.map\(x => x\.inner\)\.join\("\\n"\);/, "extractSpeech 没有改成复用 spans");
  const split = grab(comp, "function offSplit(text) {", "function offBody(");
  assert.match(split, /typeof speechSpans === "function" \? speechSpans\(s\) : \[\]/, "没用共享那一份");
  assert.ok(!/「\[\^」\]|『|“\(\[\^”\]/.test(split), "components 里又抄了一份引号正则");
  // 顺带回归：抽出 spans 之后，念台词那条路不许坏
  assert.equal(SP.extractSpeech("他说「快跑」，她没动。"), "快跑");
  assert.equal(SP.extractSpeech("屏幕 5\" 大"), "", "落单的直角引号又被当成台词了（v47.99 那一课）");
  assert.equal(SP.extractSpeech("他喊『快跑』"), "快跑");
});

// 角色的颜色是她随手挑的，浅黄淡粉直接印在纸上根本看不清
test("台词的颜色先过一遍对比度，不靠眼睛猜", () => {
  const PAPER = "#f6f4ef", DARKPAPER = "#232019";
  ["#f2e37a", "#ffd7e6", "#8a5a4a", "#3f6d8c"].forEach(c => {
    assert.ok(K.offContrast(K.offReadable(c, PAPER), PAPER) >= 4.5, c + " 在浅纸上没推到 4.5");
    assert.ok(K.offContrast(K.offReadable(c, DARKPAPER), DARKPAPER) >= 4.5, c + " 在深纸上没推到 4.5");
  });
  // 浅纸往深推、深纸往亮推——方向反了就越推越看不见
  assert.ok(K.offLum(K.offReadable("#f2e37a", PAPER)) < K.offLum("#f2e37a"), "浅纸上没把字压深");
  assert.ok(K.offLum(K.offReadable("#3a2a20", DARKPAPER)) > K.offLum("#3a2a20"), "深纸上没把字提亮");
  // 本来就够的别乱动
  assert.equal(K.offReadable("#1b1a17", PAPER), "#1b1a17", "对比度本来就够还硬推");
  assert.match(K.offReadable("", PAPER), /^#/, "坏色值把整段画崩");
});

test("台词用说话人自己的颜色，我用强调色", () => {
  assert.match(comp, /: offBody\(t, m\.content, isUser \? \(t\.accent \|\| meChar\.color\) : \(\(spk && spk\.color\) \|\| t\.tint\)\)\)/, "正文没按说话人上色");
  const body = grab(comp, "function offBody(t, text, accent) {", "function offCardSkin(t, accent) {");
  assert.match(body, /const sayInk = offReadable\(accent \|\| t\.tint, t\.bg2\);/, "台词颜色没过对比度");
  assert.match(body, /fontWeight: 600/, "台词没加重");
  assert.match(body, /boxDecorationBreak: "clone"/, "高亮带换行会断成一块一块");
  // 旁白里夹着的台词也一样标出来
  const narr = grab(comp, "  if (isNarr) {", "  return h(\"div\", { className: \"my-2.5\" },");
  assert.match(narr, /offSplit\(nText\)\.map/, "长旁白里引的那句话没标出来");
});
