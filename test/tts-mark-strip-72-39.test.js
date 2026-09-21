// 语气标记：说给 TTS 听的，不给她看（她 2026-09-21 拿别家截图来问）
//
// 她原话：「他们语音还会让模型输出语气，我们能不能也弄语气但是不让模型显示出来」。
// 那套 (chuckle) <#0.4#> 就是 MiniMax T2A v2 的语法——我们用的是同一个引擎。
// 第一步只做【剥标记那一支】和【验货台】：MiniMax 认不认，得她真听一条才知道。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js", "engine.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js", "screens.js"), "utf8");

// 真跑那一段：锚只钉常量名/函数名（施工规则/anchor-on-code.md）
const load = () => {
  const i = engine.indexOf("const TTS_MARK_TAGS = [");
  const j = engine.indexOf("function ttsLangBoost(", i);
  assert.ok(i > 0 && j > i, "抠不出剥标记那一段");
  return new Function(engine.slice(i, j) + "\nreturn { ttsMarkStrip, ttsMarkForSynth, ttsHasMark, TTS_MARK_TAGS, VOICE_PAUSE_MARK };")();
};

test("标记剥干净，字一个不少", () => {
  const F = load();
  const raw = "(chuckle) 邊個叫你唔擦乾淨水就想往外跑 <#0.4#> (softly) 唔卷實啲 <#0.5#> 出去吹到風 (laughs)";
  const out = F.ttsMarkStrip(raw);
  assert.equal(out, "邊個叫你唔擦乾淨水就想往外跑 唔卷實啲 出去吹到風");
  assert.ok(!/chuckle|softly|laughs|<#/.test(out));
});

// ⚠️漏剥最多是显示出一个标记（难看，一个字没丢）；误剥是把她角色真说的话吃掉。
// 宁可漏判别误判——跟 noFaceKindFor 那道闸同一条判据。
test("只剥白名单里的标记：中文括号、正常英文括号一律不动", () => {
  const F = load();
  assert.equal(F.ttsMarkStrip("他说（笑着）没事"), "他说（笑着）没事");
  assert.equal(F.ttsMarkStrip("(Plan B) 是我们的备选"), "(Plan B) 是我们的备选");
  assert.equal(F.ttsMarkStrip("这条走 (A) 那条走 (B)"), "这条走 (A) 那条走 (B)");
  // 半角括号里是中文也不碰
  assert.equal(F.ttsMarkStrip("他说(算了)就走了"), "他说(算了)就走了");
});

test("剥完收拾空白，别在气泡里留下一串空洞", () => {
  const F = load();
  assert.equal(F.ttsMarkStrip("(sighs) 算了 <#1#> ，走吧"), "算了，走吧");
  assert.equal(F.ttsMarkStrip("  (softly)  "), "");
  assert.equal(F.ttsMarkStrip(""), "");
  assert.equal(F.ttsMarkStrip(null), "");
});

// ⚠️带 g 的正则 .test() 会推着 lastIndex 走，同一段字连问两次会时真时假。
// 所以判有没有只问【剥完是不是变短了】——判据只有一份，也不可能跟 ttsMarkStrip 漂走。
test("ttsHasMark 连问三次答案一样", () => {
  const F = load();
  const raw = "(chuckle) 你回来啦 <#0.5#> 我等好久了";
  assert.deepEqual([F.ttsHasMark(raw), F.ttsHasMark(raw), F.ttsHasMark(raw)], [true, true, true]);
  assert.deepEqual([F.ttsHasMark("你回来啦"), F.ttsHasMark("你回来啦")], [false, false]);
});

test("剥标记只许有一份实现", () => {
  assert.equal((engine.match(/function ttsMarkStrip\(/g) || []).length, 1);
  // 验货台那一格也问它要，不另写一份
  assert.match(screens, /ttsMarkStrip\(markTxt\)/);
  assert.match(screens, /ttsHasMark\(markTxt\)/);
});

test("验货台送去合成的是【带标记的原文】，不是剥过的那份", () => {
  const i = screens.indexOf("const runMark = async () => {");
  const j = screens.indexOf("const inSt = ", i);
  assert.ok(i > 0 && j > i, "抠不出验货台那一段");
  const fn = screens.slice(i, j);
  assert.match(fn, /const raw = String\(markTxt \|\| ""\)\.trim\(\);/);
  assert.match(fn, /ttsSpeak\(raw,/, "验的就是标记本身，送剥过的等于没验");
  assert.ok(!/ttsMarkStrip/.test(fn), "合成那一路不许剥标记");
});

// ⭐v72.40 实测（她 2026-09-21 在验货台听的）：**停顿认，情感标记不认**——
// <#0.5#> 真的停了半秒，而 (chuckle)(softly) 被当成单词念了出来。
// 所以这一层分成两支，判据是【这个标记送上去会不会变成声音】。
test("送去合成的那一份：情感标记剥掉，停顿留着", () => {
  const F = load();
  const raw = "(chuckle) 你回来啦 <#0.5#> 我等好久了 (softly) 饿不饿";
  assert.equal(F.ttsMarkForSynth(raw), "你回来啦 <#0.5#> 我等好久了 饿不饿");
  // 给人看的那一份两样都剥
  assert.equal(F.ttsMarkStrip(raw), "你回来啦 我等好久了 饿不饿");
});

// ⚠️合成那一支不是可选的：模型偶尔自己就会写 (笑)(laughs)，不剥就会被念出来。
test("合成前剥标记收在 ttsKeyFor 一处，钥匙和真送上去的文本是同一份", () => {
  const key = engine.slice(engine.indexOf("function ttsKeyFor("), engine.indexOf("async function ttsCached("));
  assert.match(key, /const txt = ttsMarkForSynth\(String\(text \|\| ""\)\)\.slice\(0, 800\);/);
  const synth = engine.slice(engine.indexOf("async function ttsSynth("), engine.indexOf("async function ttsCloneVoice("));
  assert.match(synth, /const txt = ttsMarkForSynth\(String\(text \|\| ""\)\)\.slice\(0, 800\);/,
    "合成那一路自己剥了一份，迟早跟钥匙对不上");
  assert.equal((engine.match(/function ttsMarkForSynth\(/g) || []).length, 1);
});

test("教模型写停顿那一句只有一份，单聊群聊都接上了", () => {
  const F = load();
  assert.match(F.VOICE_PAUSE_MARK, /<#0\.5#>/, "没告诉它停顿怎么写");
  // ⚠️这一句【只给许可，不加禁令】（她 2026-09-21 当场纠正 v72.40 第一版）：
  //   「别写 (laughs) 这类标记」那半句删了——那件事代码已经管了（ttsMarkForSynth），
  //   模型本来也没在写，而禁令里点名那几个词等于第一次把这个形状介绍给它。
  assert.ok(!/别写|不许|禁止|绝不/.test(F.VOICE_PAUSE_MARK), "又在这句话后面挂禁令了");
  assert.ok(!/laughs|chuckle|softly|whispering/i.test(F.VOICE_PAUSE_MARK),
    "把标记名写进提示词＝把这个形状介绍给它（prompt-no-content-samples）");
  assert.equal((engine.match(/const VOICE_PAUSE_MARK = /g) || []).length, 1);
  const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
  assert.match(app, /=语音（\$\{VOICE_PAUSE_MARK\}）/, "单聊那一处没接上");
  assert.match(app, /习惯来" \+ VOICE_PAUSE_MARK \+ "/, "群聊那一处没接上");
});

// 波形和秒数也按剥干净的那一份算：不剥的话那几个标记会把时长算长
test("语音条的波形/时长/转录都用剥过的那一份", () => {
  const comp = fs.readFileSync(path.join(root, "js", "components.js"), "utf8");
  const i = comp.indexOf("function VoiceMsg(");
  const j = comp.indexOf("function ", i + 10);
  const vm = comp.slice(i, j);
  assert.match(vm, /const say = typeof ttsMarkStrip === "function" \? ttsMarkStrip\(m\.content\)/);
  assert.match(vm, /voiceBars\(say, dur\)/);
  assert.match(vm, /Math\.round\(say\.replace/);
  // ⚠️合成仍旧送原文：停顿要留给 MiniMax，剥不剥由 ttsKeyFor 那一处统一说了算
  assert.match(vm, /ttsSpeak\(m\.content, speaker\.voiceId/);
});
