"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const components = fs.readFileSync("js/components.js", "utf8");
const call = components.slice(components.indexOf("function CallScreen"), components.indexOf("function CoupleHome", components.indexOf("function CallScreen")));

test("真声通话丢弃旧会话回调并去掉重复 final", () => {
  assert.match(call, /st\.session !== session/);
  assert.match(call, /now - st\.lastFinalAt < 1800/);
  assert.match(call, /st\.session \+= 1; \/\/ 先让识别\/TTS 的迟到 promise全部失效|st\.session \+= 1; \/\/ 先让识别\/TTS 的迟到 promise 全部失效/);
});

test("书房耳保留约 0.7 秒预卷且只拼一次起声帧", () => {
  assert.match(call, /st\.preSamples > 16000 \* 0\.7/);
  assert.match(call, /st\.buf = st\.pre\.slice\(\)/);
  assert.match(call, /if \(wasTalking\) st\.buf\.push\(out\)/);
});
