const test = require("node:test"); const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const cmp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("照片没拍成：原因留在卡上（单聊、群聊、线下三处）", () => {
  assert.equal((app.match(/failed: true, failErr:/g) || []).length, 3);
  assert.match(cmp, /m\.failed && m\.failErr \? h\("div", \{ "data-wk": "photofailerr"/);
});
