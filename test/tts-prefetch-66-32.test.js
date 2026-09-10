// 她 2026-09-10：「语音视频自动播放每条气泡有延迟能不能减少延迟，
// 比如说开了自动播报就直接缓存好放队列排序自动播」。
//
// ⚠️病根：那个自动播报循环是【彻底串行】的——播完这一条才去合成下一条，
//    于是每两条之间一定空掉一次网络往返 + 一次解码。合成本来完全可以躲在
//    上一条的播放里跑。原来那句注释「不预取未轮到的收费语音」防的是「她中途关掉、
//    白花钱」，理由仍然成立；但「一条都不预取」把代价整个转嫁成了她每句都要等。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.resolve(__dirname, "..", "js/components.js"), "utf8");
const loop = comp.slice(comp.indexOf("  // —— 嘴：对方新台词自动播"), comp.indexOf("  }, [autoVoice, audioReady, !!bye,"));

test("下一条的合成排在这一条【开播之前】，跑在播放的那几秒里", () => {
  assert.ok(loop.length > 0, "自动播报那个循环抠不出来了");
  assert.match(loop, /let ahead = null;/, "没有预取位");
  // 合成 + 解码打包成一件事，预取的时候两样都提前做掉
  assert.match(loop, /const synth = \(text, voiceId\) => \{[\s\S]{0,400}?await ttsSpeak\(text, voiceId\)[\s\S]{0,200}?decodeAudioData/,
    "解码没一起提前做——那也是一段实打实的空档");
  // 命中预取就直接拿，没命中才现合成
  assert.match(loop, /const task = \(ahead && ahead\.key === idx\) \? ahead\.task : synth\(m\.content, spk2\.voiceId\);/,
    "预取好了却没用上");
  // 顺序：预取必须排在 srcN.start 之前
  assert.ok(loop.indexOf("if (!ahead && ttsReady()) poll = setInterval(tryAhead, 300);") < loop.indexOf("srcN.start(0)"),
    "预取排到播放后面去了，等于没预取");
});

test("只提前一条，不是把整队都合成出来", () => {
  // 语音按次收费，她中途关掉最多只白花一条
  assert.equal((loop.match(/ahead = \{ key:/g) || []).length, 1, "预取位被写在了多处");
  assert.match(loop, /if \(ahead \|\| !valid\(\) \|\| !ttsReady\(\)\) return;/, "已经预取过还会再排一条");
  assert.match(loop, /只提前【一条】/, "那条理由的注释没留下");
});

test("气泡是一条条冒出来的，所以要盯着、不是只看一眼", () => {
  // callSend 里每条气泡之间 sleep 500~550ms：开播那一刻下一条多半还没进 msgs
  const app = fs.readFileSync(path.resolve(__dirname, "..", "js/app.js"), "utf8");
  assert.match(app, /await new Promise\(r => setTimeout\(r, 5[05]0\)\)/, "气泡不再是逐条冒出来的了，这条盯梢可以简化");
  assert.match(loop, /poll = setInterval\(tryAhead, 300\)/, "只看了一眼，多半什么都没预取到");
  assert.match(loop, /if \(poll\) \{ clearInterval\(poll\); poll = null; \}/, "预取到了还在空转");
  assert.match(loop, /finally \{ if \(poll\) clearInterval\(poll\);/, "出错/挂断时定时器漏了，会一直转下去");
});

test("预取那条没人 await 时不许变成未处理拒绝", () => {
  assert.match(loop, /task\.catch\(\(\) => \{\}\);/, "预取失败会炸成 unhandled rejection");
  // 但 await 的时候还是要能抛出来（照旧走原来那条失败提示）
  assert.match(loop, /catch \(e\) \{ if \(valid\(\)\) \{ setAudioStatus\("自动播报失败（"/, "失败提示被改坏了");
});

test("跳过的那几种照旧跳过（她自己的、动作行、没配音色的）", () => {
  assert.match(loop, /if \(!m \|\| m\.role === "user" \|\| m\.act \|\| !m\.content\) continue;/);
  assert.match(loop, /const nextSpeakable = from =>/, "预取没有自己的「下一条能出声的是哪条」");
  // ⚠️预取和真播必须用同一套判据，不然会预取一条根本不会播的
  const nx = loop.slice(loop.indexOf("const nextSpeakable = from =>"), loop.indexOf("while (valid()"));
  assert.match(nx, /mm\.role === "user" \|\| mm\.act \|\| !mm\.content/, "预取的判据和真播的对不上");
  assert.match(nx, /if \(!s2 \|\| !s2\.voiceId\) continue;/, "会预取一条没配音色、根本播不出来的");
});
