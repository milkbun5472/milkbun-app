const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8");
test("单聊气泡开头照抄的「自己名字：」摘掉，只认TA自己的名字", () => {
  assert.match(app, /const _selfNm = \[char\.name, char\.remark\]/);
  assert.match(app, /words = words\.map\(stripAiStamp\)\.map\(stripEchoedMeta\)\.filter\(Boolean\);\n      \/\/ 照抄了「名字：」/);
});
