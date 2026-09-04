// v61.66 baseUrl 清洗：生图升级回写的 /v1/images 半截尾巴要能削干净（她 9/3 拉模型 404）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const m = src.match(/function isCatsImageProvider[\s\S]*?\nfunction openAICompatibleRoot[\s\S]*?\n}\n/);
assert.ok(m);
eval(m[0]);
test("各种被污染的 baseUrl 都收回 API 根", () => {
  const cases = {
    "https://api.dzzi.ai/": "https://api.dzzi.ai/v1",
    "https://api.dzzi.ai/v1/images/generations": "https://api.dzzi.ai/v1",
    "https://api.dzzi.ai/v1/images": "https://api.dzzi.ai/v1",
    "https://api.dzzi.ai/v1/chat/completions": "https://api.dzzi.ai/v1",
    "https://api.dzzi.ai/v1/models": "https://api.dzzi.ai/v1",
    "https://x.com/api/v1/chat/completions": "https://x.com/api/v1",
    "https://x.com/api": "https://x.com/api/v1"
  };
  for (const [i, e] of Object.entries(cases)) assert.equal(openAICompatibleRoot(i), e, i);
});
