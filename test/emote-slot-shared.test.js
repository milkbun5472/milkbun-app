// 她 2026-10-16「为啥群聊表情包可以插在话中间但是单聊一定在最下面」→「不是跟群聊做公共的吗」：
//   认表情、在原位置留 emoteslot 只有一份（engine 的 emoteSlotWords），单聊和群聊都走它，发到占位就地发
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
function load() {
  const i = eng.indexOf("const EMOTE_SLOT_RE"), j = eng.indexOf("const VOICE_SLOT_TOKEN", i);
  const g = {}; new Function("g", eng.slice(i, j) + "\ng.slot = emoteSlotWords; g.of = emoteSlotOf;")(g); return g;
}
const norm = s => String(s || "").toLowerCase().replace(/[\s【】\[\]（）()「」『』〔〕<>《》.,。，!！?？~]/g, "");
const EM = [{ keyword: "认栽" }, { keyword: "开心" }];
test("夹在中间的表情留在原位置", () => {
  const g = load();
  const r = g.slot(["就你天天惯着她", "[表情] 认栽", "筷子拿好"], EM, norm);
  assert.equal(r.words.length, 3);
  assert.equal(g.of(r.words[1]), 0);
  assert.equal(r.kws[0].kw, "认栽");
  assert.equal(r.words[2], "筷子拿好");
});
test("{emote} 那一项、句尾夹着的、整泡就是关键词的，都在原位置", () => {
  const g = load();
  const r = g.slot(["a", { emote: "开心" }, "我爱听[表情] 认栽", "开心", "b"], EM, norm);
  assert.deepEqual(r.words.map(w => g.of(w) != null ? "E" : w), ["a", "E", "我爱听", "E", "E", "b"]);
});
test("单聊、群聊都调同一个，发到占位就地发", () => {
  assert.match(app, /const _es = emoteSlotWords\(words, emotes, emoteNorm\);/);
  assert.match(app, /const _gEs = emoteSlotWords\(gBubbles, emotesForChar\(spk\.id\), emoteNorm\);/);
  assert.match(app, /const _eSlot = emoteSlotOf\(words\[i\]\);/);
  assert.match(app, /const _gE = emoteSlotOf\(gBubbles\[j\]\);/);
  assert.ok(app.indexOf("const TAG_RE = ") < 0, "app 里又留了一份自己认表情的");
});
test("写成一串字的 {\"emote\":\"…\"} 也认（她 2026-10-17 截图）", () => {
  const g = load();
  const r = g.slot(["不给退货！", '{"emote":"认栽"}', "{ “emote”：“开心” }"], EM, norm);
  assert.deepEqual(r.words.map(w => g.of(w) != null ? "E" : w), ["不给退货！", "E", "E"]);
  assert.equal(r.kws[0].kw, "认栽");
  assert.deepEqual(g.slot(['a', '{"emote":"认栽"}'], [], norm).words, ["a"], "没表情包时也别把它当字发出去");
});
