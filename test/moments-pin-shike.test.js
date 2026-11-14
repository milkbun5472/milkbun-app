const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const cmp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("朋友圈收进时刻：走同一处 pinToShike，连评论一起", () => {
  assert.match(app, /const pinMomentToShike = m => \{/);
  assert.match(app, /pinToShike\(m\.characterId, rows\.length > 1 \? rows : rows\[0\], x => x\._who \|\| undefined\);/);
  assert.match(cmp, /onPin: onPin && m\.characterId \? \(\) => onPin\(m\) : null/);
  assert.match(cmp, /item\("收进时刻", onPin, \{ "data-wk": "mompin" \}\)/);
});
