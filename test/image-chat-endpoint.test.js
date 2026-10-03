const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
test("image api can post to chat/completions", () => {
  assert.match(eng, /apiFormat: "auto"/);
  assert.match(eng, /root \+ "\/chat\/completions"[\s\S]{0,300}modalities: \["image", "text"\]/);
  assert.match(eng, /a\.apiFormat === "chat"\) r = await chatFetch\(\)/);
  assert.match(eng, /r\.status === 404 \|\| r\.status === 405\)\) r = await chatFetch\(\)/);
  assert.match(scr, /value: "chat" \}, "聊天接口 \/chat\/completions"/);
});
test("empty chat reply retries as stream and stitches SSE", () => {
  assert.match(eng, /usedChat && r\.ok[\s\S]{0,300}chatFetch\(true, c2\.signal\)[\s\S]{0,120}sseToJson\(raw2\)/);
  assert.match(eng, /const sseToJson = raw =>/);
});
test("empty stitched stream keeps the tail; gemini inline_data parsed", () => {
  assert.match(eng, /out\._streamTail = raw/);
  assert.match(eng, /inline_\?\[dD\]ata/);
});
test("chat image brief says the prompt is not content to draw", () => {
  assert.match(eng, /exactly ONE single natural photograph[\s\S]{0,200}NOT content to draw/);
});
test("non gpt-image models don't get the long hand blocks", () => {
  assert.match(eng, /if \(!\/gpt-image\|dall-\?e\/i\.test[\s\S]{0,200}【手脚必须解剖正确】\[\^【\]\*/);
});
test("NAI models get danbooru tags translated first", () => {
  assert.match(eng, /function isNaiImageModel\(model\)/);
  assert.match(eng, /if \(isNaiImageModel\(a\.model\)[\s\S]{0,120}await naiTagsFor\(prompt\)/);
  const f = new Function(eng.match(/function isNaiImageModel\(model\) \{[^\n]*\}/)[0] + "; return isNaiImageModel;")();
  assert.ok(f("nai-diffusion-4-5-full")); assert.ok(f("NovelAI-v4")); assert.ok(f("nai"));
  assert.ok(!f("gpt-image-2")); assert.ok(!f("gemini-3.1-flash-image")); assert.ok(!f("dall-e-3"));
});
test("NAI never asked for fake photos", () => { assert.match(eng, /do NOT write photorealistic\/photo[\s\S]{0,200}semi-realistic, realistic shading, painterly/); });
