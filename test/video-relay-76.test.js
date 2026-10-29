const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/video-api.js", "utf8");
test("视频接口有「自定义中转」，两种常见写法都接", () => {
  assert.match(src, /\["relay", "自定义中转"\]/);
  assert.match(src, /k\.baseUrl \+ "\/v1\/video\/generations"/);
  assert.match(src, /k\.baseUrl \+ "\/v1\/videos", k\.apiKey, f, signal/);
  assert.match(src, /record\.vendor === "relay" \|\| record\.vendor === "kling"|record\.vendor === "kling" \|\| record\.vendor === "seedance" \|\| record\.vendor === "relay"/);
});
test("下载只对中转站自己的地址带 key", () => {
  assert.match(src, /record\.vendor === "relay" && url\.indexOf\(record\.baseUrl \+ "\/"\) === 0/);
});
test("中转能拉取模型：跟聊天 API 同一个 fetchModelList，像视频的排前面", () => {
  assert.match(src, /await fetchModelList\(\{ baseUrl: r\.baseUrl, apiKey: r\.apiKey \}\)/);
  assert.match(src, /"拉取模型"/);
});
test("CatsAPI 的视频请求跟图像一样交给原生壳代发", () => {
  assert.match(src, /isCatsImageProvider\(url\) && typeof nativeProviderFetch === "function"/);
});
test("CatsAPI 自己那套：/api/tasks，视频在 result_video.url，型号用它的叫法", () => {
  assert.match(src, /\["cats", "CatsAPI 格式（\/api\/tasks）"\]/);
  assert.match(src, /catsRoot\(k\.baseUrl\) \+ "\/api\/tasks", k\.apiKey, \{ model: k\.model, prompt: text, task_type: "video"/);
  assert.match(src, /"result_video\.url"/);
  assert.match(src, /CATS_VIDEO_MODELS = \["seedance20", "seedance20Mini", "grokImagineVideo", "geminiOmniFlash"\]/);
});
test("CatsAPI 型号秒数超范围：记任务之前就拦，不发请求", () => {
  const i = src.indexOf("const _cs = v === \"relay\""), j = src.indexOf("const record = { vendor: v");
  assert.ok(i > 0 && i < j);
  assert.match(src, /seedance20Mini: \[4, 15\]/);
});
