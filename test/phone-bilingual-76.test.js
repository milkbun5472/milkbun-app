// 查手机跟着双语走：生成时外语写成「原文 | 中文」（2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("查手机生成、联系人回话都带上双语那句", () => {
  assert.match(app, /const phoneBiLine = char => \{ const st = settingsFor\(char && char\.id\) \|\| \{\}; return st\.bilingual && !st\.engineerEyes/);
  assert.match(app, /runProbe\(bgActive, phoneCtx\(char\), phoneBi\(char, spec\)\)/);
  assert.match(app, /phoneBi\(char, phoneRemarkSpec\(char, key, phoneProbeSpec\(/);
  assert.match(app, /callAI\(p, sys \+ phoneBiLine\(char\),/);
});
test("画的那层本来就会把竖线劈成译文", () => {
  assert.match(ui, /const _bi = splitBilingual\(text, false\);/);
});
