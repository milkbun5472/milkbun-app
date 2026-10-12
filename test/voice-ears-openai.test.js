const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");

test("真声耳朵可填 OpenAI 兼容的语音转文字接口", () => {
  assert.match(eng, /a\.kind === "openai"[\s\S]{0,400}\/audio\/transcriptions/);
  assert.match(eng, /voiceEarsReady\(a\)[^\n]*a\.kind === "openai" \? !!\(a\.base && a\.key\)/);
  // 老的书房配置（有门锁 k、没 kind）仍按自架服务读
  assert.match(eng, /c\.kind \? \{\} : \(c\.k \? \{ kind: "studio" \}/);
  assert.match(scr, /"data-wk": "earskind"/);
  assert.match(scr, /"data-wk": "earsprefer"/);
});

test("勾了优先就跳过浏览器自带识别", () => {
  assert.match(comp, /loadVoiceEars\(\)\.prefer && voiceEarsReady\(\);\s*if \(earsFirst\) await fallbackEar/);
});
