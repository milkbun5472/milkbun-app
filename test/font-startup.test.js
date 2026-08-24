const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("冷启动会等关键字体后再显形且有断网兜底", () => {
  assert.match(html, /classList\.add\("fonts-pending"\)/);
  assert.match(html, /document\.fonts\.load\("400 16px Archivo"\)/);
  assert.match(html, /document\.fonts\.load\("400 16px Fraunces"\)/);
  assert.match(html, /document\.fonts\.load\("400 16px 'Noto Serif SC'"\)/);
  assert.match(html, /setTimeout\(reveal, 2400\)/);
  assert.match(html, /classList\.remove\("fonts-pending"\)/);
});
