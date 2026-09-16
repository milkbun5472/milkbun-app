// 她 2026-09-16：「打电话还是如果他挂了最后一轮语音播放不出来」。
//
// v67.43 修过一次，方向是对的：收线不再「固定 1.8 秒」，而是等播报队列念完再挂。
// 可它从头到尾没生效过——因为收线那个 effect 的**第一行**就是 lvStop()，
// 而 lvStop 名义上拆的是【耳朵】（麦克风、识别），实际顺手把【嘴】也拆了：
//   · stopCallAudio() → epoch++ 且停掉正在响的那段 buffer
//   · st.session += 1 → 播报队列的 valid() 当场失效，循环 break
//   · routeCallAudio(..., null) → 连播放路由都撤了
// 于是它开始等的时候，嘴已经死了，quiet() 立刻为真，900ms 后收线。
//
// 两条一起改：lvStop 收一个 keepVoice（只拆耳朵）；嘴的有效期只看 epoch，
// 不再挂在耳朵那个 st.session 上。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

const lvStop = src.slice(src.indexOf("const lvStop = (opts)"), src.indexOf("audioRef.current.mounted = false"));

test("lvStop 收 keepVoice：只拆耳朵，嘴留着", () => {
  assert.match(src, /const lvStop = \(opts\) => \{/, "lvStop 还是没参数的旧样子");
  assert.match(lvStop, /const keepVoice = !!\(opts && opts\.keepVoice\);/);
});

test("keepVoice 时，三样拆嘴的动作一个都不许做", () => {
  // ① 不许 stopCallAudio（它 epoch++、停 buffer、把 played 推到队尾）
  assert.match(lvStop, /if \(!keepVoice\) stopCallAudio\(\);/);
  // ② 不许停掉正在响的那段 buffer
  assert.match(lvStop, /if \(!keepVoice\) \{ try \{ st\.src && st\.src\.stop\(\); \} catch \(e\) \{\} \}/);
  // ③ 不许清 busy/speaking——清了收线那个 effect 的 quiet() 立刻为真，等于没等
  assert.match(lvStop, /if \(!keepVoice\) \{ st\.busy = 0; st\.speaking = false; \}/);
});

test("keepVoice 时播放路由要留着，不然念了也听不见", () => {
  assert.match(lvStop, /const stillSpeaking = keepVoice \|\| !bye;/);
  assert.match(lvStop, /routeCallAudio\(st\.ttsCtx, audioRef\.current\.mounted && autoVoice && stillSpeaking \? "playback" : null\)/);
});

test("收线那个 effect 拆耳朵时必须带 keepVoice", () => {
  const bye = src.slice(src.indexOf("if (!bye || byeRef.current) return;"), src.indexOf("const quiet = ()") + 400);
  assert.match(bye, /lvStop\(\{ keepVoice: true \}\)/, "收线前又把嘴一起拆了");
  // 等的还是这三个数——它们现在真的活着了
  assert.match(bye, /!st\.speaking && !st\.busy && st\.played >= msgsRef\.current\.length/);
});

test("嘴的有效期只看 epoch，不挂在耳朵那个 session 上", () => {
  const loop = src.slice(src.indexOf("嘴：对方新台词自动播"), src.indexOf("播报锁：防多气泡齐唱"));
  assert.match(loop, /const valid = \(\) => audioRef\.current\.enabled && audioRef\.current\.mounted && audioRef\.current\.epoch === epoch;/);
  assert.ok(!/const valid = \(\)[^\n]*st\.session === session/.test(loop),
    "播报队列的 valid() 又挂回 st.session 了——关麦和TA挂电话都会掐掉正念的那一句");
});

test("该停的时候还是停：自己挂断、卸载、关掉自动播报三条路不受影响", () => {
  // 自己挂：先把 enabled 关掉，valid() 立刻为假
  assert.match(src, /audioRef\.current\.enabled = false; lvStop\(\); onHangup\(secRef\.current, "me"\)/);
  // 卸载：mounted=false + enabled=false，且走的是不带 keepVoice 的 lvStop
  assert.match(src, /audioRef\.current\.mounted = false; audioRef\.current\.enabled = false; lvStop\(\);/);
  // 关掉自动播报：stopCallAudio 里 epoch\+\+，正在响的那段当场停
  assert.match(src, /audioRef\.current\.epoch\+\+;/);
});
