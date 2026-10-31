// 周刊正文就地放大的那一句：收引号跟着句子走，引号没配对的不放大（2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "weekly.js"), "utf8");
test("句尾带上收引号，配不上对的不挑", () => {
  assert.match(s, /\[。！？!\?\]\+\[」』”’）\)\]\*\/g\) \|\| \[\]\)\.filter\(q => bal\(q\)/);
});
