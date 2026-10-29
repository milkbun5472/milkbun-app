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
