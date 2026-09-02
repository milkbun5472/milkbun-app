const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const dot = comp.slice(comp.indexOf("function TtsBubbleDot("), comp.indexOf("// 懒 TTS 小播放器"));

// 她 2026-09-02：「念出来这块能不能给他气泡上面显示一个播放键跟比如塔罗差不多，
// 这样我才知道哪些是缓存过的，而且不用每次长按才能听」——两件事：
// **常驻**（不用长按），而且**分得出这一下花不花钱**（听过的重播免费）。

test("缓存钥匙只留一份，别在外面另算一遍", () => {
  // ⚠️原来整段推导埋在 ttsSpeak 里。在外面另写一份必然漂走，
  //   到时候标着「听过」的一点又去合成一次、真花了钱，比不标还坏。
  assert.match(eng, /function ttsKeyFor\(text, voiceId, opts\)/);
  assert.match(eng, /const _k = ttsKeyFor\(text, voiceId, opts\);/, "ttsSpeak 自己也得用这一份");
  const speak = eng.slice(eng.indexOf("async function ttsSpeak("), eng.indexOf("async function ttsSpeak(") + 2500);
  assert.ok(!/const key = ttsCacheKey\(/.test(speak), "ttsSpeak 里不该再有第二份推导");
  const cached = eng.slice(eng.indexOf("async function ttsCached("), eng.indexOf("async function ttsSpeak("));
  assert.match(cached, /ttsKeyFor\(text, voiceId, opts\)/);
  assert.match(cached, /idbAudGet\(d\.key\)/, "只读缓存");
  assert.ok(!/fetch\(/.test(cached), "查一下缓存不许打上游——那就花钱了");
});

test("钥匙对同一句稳定、对不同参数分得开", () => {
  const src = eng.slice(eng.indexOf("function ttsCacheKey("), eng.indexOf("\n", eng.indexOf("function ttsCacheKey(")));
  const ttsCacheKey = new Function("return " + src.trim())();
  assert.equal(ttsCacheKey("v1", "在吗"), ttsCacheKey("v1", "在吗"), "同一句每次要算出同一把钥匙");
  assert.notEqual(ttsCacheKey("v1", "在吗"), ttsCacheKey("v2", "在吗"), "换个音色是另一段音频");
  assert.notEqual(ttsCacheKey("v1", "在吗"), ttsCacheKey("v1", "在吗？"), "不同的话不能撞进同一格");
});

test("播放键常驻在气泡边上，单聊和群聊两处都挂", () => {
  assert.equal((comp.match(/subLine\(m\)\)\), sayDot\(i, m\)/g) || []).length, 2,
    "一处挂一处不挂，等于这个功能在群里不存在");
  const sd = comp.slice(comp.indexOf("const sayDot = (i, m) =>"), comp.indexOf("const sayDot = (i, m) =>") + 700);
  assert.match(sd, /if \(!canSpeakMsg\(m\)\) return null/, "门槛跟长按菜单那一项同一个");
  assert.match(sd, /k !== "photo" && k !== "location"\) return null/, "语音条自己气泡上已经有一个了");
});

test("实心＝听过了不花钱，空心＝这一下要合成", () => {
  assert.match(dot, /const solid = cached \|\| on;/);
  assert.match(dot, /background: solid \? t\.tint : "transparent"/);
  assert.match(dot, /border: solid \? "none" : "1\.2px solid " \+ t\.fog/, "只靠颜色区分，色弱和阳光下看不出来");
  assert.match(dot, /cached \? "听过了 · 重播不花钱" : "还没合成过 · 点一下会花一次"/, "说清楚花不花钱");
  assert.match(dot, /aria-label/, "读屏读不到");
});

test("合成成功要当场点亮它——那一颗已经挂在屏幕上了", () => {
  // 光往表里记不够：它的 cached 是自己的 state，不通知就还是空心的，
  // 得等下次进这个聊天才变实。
  assert.match(comp, /const _ttsSubs = new Set\(\);/);
  assert.match(comp, /markTtsCached = \(text, voiceId, emo\) => \{[\s\S]{0,200}_ttsSubs\.forEach/);
  assert.match(dot, /_ttsSubs\.add\(f\)[\s\S]{0,80}_ttsSubs\.delete\(f\)/, "订阅了不退订会漏");
  assert.match(comp, /await ttsSpeak\(text, voiceId, opts\);\n\s*markTtsCached\(text, voiceId, opts && opts\.emo\)/);
});

test("查缓存只查一次，别每次重绘都翻 IDB", () => {
  assert.match(dot, /if \(_ttsSeen\.has\(key\)\) \{ setCached/);
  assert.match(dot, /_ttsSeen\.set\(key, v\)/);
});
