"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const components = fs.readFileSync("js/components.js", "utf8");
const call = components.slice(components.indexOf("function CallScreen"), components.indexOf("function CoupleHome", components.indexOf("function CallScreen")));

test("真声通话丢弃旧会话回调并去掉重复 final", () => {
  assert.match(call, /st\.session !== session/);
  assert.match(call, /now - st\.lastFinalAt < 1800/);
  // ⚠️v69.12：st.session 现在只管【耳朵】。原来注释里写着「识别/TTS」，
  //   而嘴挂在同一个计数器上正是那个 bug——关麦或TA挂电话都会掐掉正念的那一句。
  //   嘴改看 audioRef.current.epoch（stopCallAudio 那一处在管）。
  assert.match(call, /st\.session \+= 1; \/\/ 先让识别的迟到 promise 全部失效/);
  assert.ok(!/const valid = \(\)[^\n]*st\.session === session/.test(call),
    "播报队列的 valid() 又挂回耳朵那个计数器了");
});

test("书房耳保留约 0.7 秒预卷且只拼一次起声帧", () => {
  assert.match(call, /st\.preSamples > 16000 \* 0\.7/);
  assert.match(call, /st\.buf = st\.pre\.slice\(\)/);
  assert.match(call, /if \(wasTalking\) st\.buf\.push\(out\)/);
});
