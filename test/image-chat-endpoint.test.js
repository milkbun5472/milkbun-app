const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
test("image api can post to chat/completions", () => {
  assert.match(eng, /apiFormat: "auto"/);
  assert.match(eng, /body\.modalities = \["image", "text"\][\s\S]{0,300}root \+ "\/chat\/completions"/);
  assert.match(eng, /else if \(chatFirst\) \{\s*r = await chatFetch\(\);/);
  assert.match(eng, /contents is required[^\n]*\) r = await chatFetch\(\)/);
  assert.match(eng, /const chatFirst = a\.apiFormat === "chat" \|\| a\.apiFormat === "gemini" \|\| \(a\.apiFormat !== "images" && \/gemini\|banana/);
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
test("chat image: retries other content shapes on 'contents is required'; untyped blobs become image/png", () => {
  assert.match(eng, /for \(let sh = 1; sh <= 2 && !r\.ok; sh\+\+\)[\s\S]{0,200}contents is required[\s\S]{0,200}chatFetch\(false, null, sh\)/);
  assert.match(eng, /new Blob\(\[b0\], \{ type: "image\/png" \}\)/);
});
test("gemini native fallback: generateContent with contents/parts/inline_data", () => {
  assert.match(eng, /"\/v1beta\/models\/" \+ encodeURIComponent\(a\.model\) \+ ":generateContent"/);
  assert.match(eng, /contents: \[\{ role: "user", parts \}\], generationConfig: \{ responseModalities: \["image", "text"\]\.map/);
  assert.match(eng, /contents is required\/i\.test\(await r\.clone\(\)\.text\(\)[^\n]*\) r = await geminiFetch\(\)/);
  assert.match(scr, /value: "gemini" \}, "Gemini 原生/);
});
