// 别的字段被写进 word 里（群里 2026-10-22：气泡里冒出「photoSeen:{"note":...」）——拿出气泡，那一格没填就照它填
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("word 里长成「字段名:{…}」的那条不进气泡", () => {
  const i = app.indexOf("别的字段被模型写进了 word 里");
  const seg = app.slice(i, app.indexOf("if (_bareCard) parsed.word", i));
  const re = new RegExp(/\/\^(.*)\$\/\.exec\(w\)/.exec(seg)[1].replace(/\\\\/g, "\\") + "$");
  assert.ok(re.test('photoSeen:{"note":"她发来两张截图"}'));
  assert.ok(re.test('"thought": "他想"'));
  assert.ok(!re.test("今晚把你这套27张从头到尾认一遍"));
  assert.ok(!re.test("注意：明天早点起"));
  assert.match(seg, /parseJSONLoose\(m\[2\]\)/);
});
