// 她 2026-09-13：「系统音色太人机了，有没有别的办法可以免费又不会那么机械」。
//
// 最便宜的那一刀：iOS / macOS 的【增强·高级】中文音色要用户自己去系统设置下载，
// 装了浏览器就列得出来。同样免费，气口比默认那把好一大截——我们只要【优先挑它】。
// 顺带把「挑嗓子」这一层从 radio-ui.js 里抽出来：时间线电台原来连挑都没挑。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const V = require("../js/radio-voice.js");
const ui = fs.readFileSync(path.join(root, "js/radio-timeline-ui.js"), "utf8");
const old = fs.readFileSync(path.join(root, "js/radio-ui.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const v = (name, lang, uri) => ({ name, lang, voiceURI: uri || name });

test("装了增强音色就只在增强那一档里挑", () => {
  const s = V.scan([
    v("Ting-Ting", "zh-CN"), v("Li-mu (增强)", "zh-CN"), v("Yu-shu", "zh-CN"),
    v("Samantha", "en-US"), v("Siri 语音 4", "zh-CN", "com.apple.siri.premium.zh-CN")
  ]);
  assert.equal(s.all.length, 4, "非中文的不算");
  assert.deepEqual(s.best.map(x => x.name), ["Li-mu (增强)", "Siri 语音 4"]);
  assert.equal(s.enhanced, 2);
});

test("一把增强的都没有时，老老实实用默认那几把", () => {
  const s = V.scan([v("Ting-Ting", "zh-CN"), v("Yu-shu", "zh-TW")]);
  assert.equal(s.enhanced, 0);
  assert.equal(s.best.length, 2, "挑不到增强就在普通那几把里挑，别挑成空");
  // 一把中文都没有：返回空，调用方该退回浏览器默认，而不是硬塞一把外语嗓子
  assert.equal(V.scan([v("Samantha", "en-US")]).best.length, 0);
  assert.equal(V.pick(0.5), null, "这台机器上没有中文音色，pick 得给 null");
});

test("同一个种子永远同一把嗓子，换个种子才换人", () => {
  assert.equal(V.hash01("branch-a"), V.hash01("branch-a"));
  assert.notEqual(V.hash01("branch-a"), V.hash01("branch-b"));
  assert.ok(V.hash01("x") >= 0 && V.hash01("x") < 1);
});

test("挑嗓子只有这一份：两个电台都从公共那层要", () => {
  assert.match(html, /<script src="js\/radio-voice\.js\?v=/, "新文件要在 index.html 上注册");
  assert.match(old, /root\.RadioVoice \? root\.RadioVoice\.pick\(r\.seed01\(id, "voice"\)\) : null/, "旧电台搬过去了");
  assert.ok(!/function zhVoices\(\)/.test(old), "旧电台里那份私有的还在，等于又多一处要同步");
  assert.match(ui, /root\.RadioVoice\.pick\(root\.RadioVoice\.hash01\(branch\.id\)\)/, "时间线电台一条线一把嗓子");
  // 音高一律不动——「这个女声很诡异像闹鬼」那次的教训，两边都得守
  assert.match(ui, /u\.rate = 0\.98; u\.pitch = 1;/);
  assert.match(old, /pitch: 1/);
});

test("引导只在真的没装时才出现，装了它自己消失", () => {
  assert.match(ui, /root\.RadioVoice && !root\.RadioVoice\.hasEnhanced\(\)/);
  assert.match(ui, /"data-radio-voicehint": true/);
  assert.match(V.ENHANCED_HINT, /设置 → 辅助功能 → 朗读内容 → 声音/);
  assert.ok(!/永远|一直/.test(V.ENHANCED_HINT));
});

// 她 2026-09-13：「我设置了还是默认的嘤」。
// ⚠️「自动优先增强」是【猜】的：增强音色在各家系统里叫什么、暴不暴露给网页，我们说了不算。
// 所以给一格手动——顺带它也是诊断：拉开就知道这台机器到底列得出哪几把。
test("她手动挑过就一律听她的，种子不再参与", () => {
  const store = {};
  global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  try {
    assert.equal(V.loadPick(), "");
    V.savePick("com.apple.voice.enhanced.zh-CN.Lilian");
    assert.equal(V.loadPick(), "com.apple.voice.enhanced.zh-CN.Lilian");
    // 挑的那把不在这台机器上（换了设备/系统删了）→ 退回自动，不许哑掉
    assert.equal(V.pick(0.3), null, "这台机器一把中文音色都没有，本来就该退回浏览器默认");
    V.savePick("");
    assert.equal(V.loadPick(), "");
  } finally { delete global.localStorage; }
});

test("列出来的那几把：增强的排前面，而且标出来", () => {
  const s = V.scan([v("Ting-Ting", "zh-CN"), v("Li-mu (增强)", "zh-CN"), v("Yu-shu", "zh-TW")]);
  // options() 读的是真实机器，这儿只钉排序规则本身
  assert.deepEqual(s.best.map(x => x.name), ["Li-mu (增强)"]);
  assert.match(ui, /h\("option", \{ value: "" \}, voiceOpts\.length \? "嗓子 · 自动"/);
  assert.match(ui, /\(v\.enhanced \? "★ " : ""\) \+ v\.name/);
  assert.match(ui, /setVoicePick\(root\.RadioVoice\.savePick\(ev\.target\.value\)\)/);
  // 她已经手动挑过，就别再唠叨怎么装增强音色
  assert.match(ui, /!root\.RadioVoice\.hasEnhanced\(\) && !voicePick/);
});

// 她 2026-09-13：「在哪儿选呢没看到嘤」——那一排铜键原来是横向滚动的，
// 键一多，嗓子和陪听那两格就整个躲到机器右边沿外面，而且没有任何提示。
test("机器下沿那排键要能全看见：换行，不是横向滚动", () => {
  assert.match(ui, /"data-radio-keys": true[\s\S]{0,160}flexWrap: "wrap"/);
  assert.ok(!/"data-radio-keys": true[\s\S]{0,160}overflowX: "auto"/.test(ui), "又躲到右边沿外面去了");
});

test("一把中文音色都没有时，那一格也要露面", () => {
  // 不渲染的话她只会以为是自己没找着（上一版就是这么坑的）
  assert.match(ui, /voiceOpts\.length \? "嗓子 · 自动" : "嗓子 · 这台机器没有中文音色"/);
  assert.match(ui, /disabled: busy \|\| !voiceOpts\.length/);
});

// 她 2026-09-13 在原生壳里拿到「这台机器没有中文音色」——可它明明念得出来。
// 病根：声音表是【后】填上的，而界面只在某一次渲染时问过一遍，没人叫它再问。
test("声音表后填上时，界面得能重算", () => {
  assert.match(V.onVoices.toString(), /subs\.push\(cb\)/);
  assert.equal(typeof V.refresh, "function");
  // 退订要真的退掉，不然离开页面还在往一个死组件上喊
  const off = V.onVoices(() => {});
  assert.equal(typeof off, "function");
  off();
  assert.equal(typeof V.onVoices(null), "function", "传个不是函数的东西也别炸");
  // 界面这头：订阅 + 过一会儿主动追问两次（有些内核压根不发 voiceschanged）
  assert.match(ui, /root\.RadioVoice\.onVoices\(bump\)/);
  assert.match(ui, /root\.RadioVoice\.refresh\(\); bump\(\);/);
  assert.match(ui, /const t1 = again\(400\), t2 = again\(1600\)/);
  assert.match(ui, /return \(\) => \{ off\(\); clearTimeout\(t1\); clearTimeout\(t2\); \}/, "走的时候要拆干净");
});
