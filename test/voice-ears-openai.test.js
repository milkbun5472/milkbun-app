const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");

test("公共的语音识别接口单独一页，书房耳朵原样不动", () => {
  assert.match(eng, /async function sttTranscribe[\s\S]{0,700}\/audio\/transcriptions/);
  assert.match(eng, /function voiceEarsReady\(a\) \{ a = a \|\| loadVoiceEars\(\); return !!\(a\.base && a\.k\); \}/);
  assert.match(scr, /setPage\("apiStt"\)/);
  assert.match(scr, /page === "apiStt" && section\(h\(SttApiConfig/);
  assert.match(scr, /"data-wk": "sttapi"/);
  assert.match(scr, /"data-wk": "sttprefer"/);
});

test("通话：识别不了就换接口；勾了优先就跳过浏览器", () => {
  assert.match(comp, /sttApiReady\(\)\) \? await sttTranscribe\(wav\) : await earsTranscribe\(wav\)/);
  assert.match(comp, /loadSttApi\(\)\.prefer && sttApiReady\(\);\s*if \(earsFirst\) await fallbackEar/);
  assert.match(comp, /backupEarReady\(\)/);
});
