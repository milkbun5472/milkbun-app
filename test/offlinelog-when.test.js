// 昨晚的线下今天才总结，他以为是刚刚的事（她 2026-11-04）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("总结卡记下那场散的时间；过了一个半钟头就照那时候说，不说「刚刚」", () => {
  assert.match(app, /offEnd: offSessEnd\(sess\), ts: Date\.now\(\) \}\]\);/);
  assert.match(app, /const _oe = offEndOfCard\(m\), _ago = _oe \? Date\.now\(\) - _oe : 0;/);
  assert.match(app, /_ago > 90 \* 60000\n\s+\? "【你和" \+ uName \+ "线下见过一面，那场在" \+ offEndWords\(_oe\)/);
  const body = app.slice(app.indexOf("  const offSessEnd = "), app.indexOf("  const offLiveMsgs = "));
  const f = new Function("offlinesRef", body + "return { offSessEnd, offEndOfCard, offAgoWords };")({ current: { c1: [{ id: "s1", msgs: [{ ts: 1000 }, { ts: 5000 }] }] } });
  assert.equal(f.offEndOfCard({ ofs: "s1" }), 5000, "老卡按 ofs 找回那一场");
  assert.equal(f.offEndOfCard({ offEnd: 42 }), 42);
  assert.equal(f.offAgoWords(17 * 3600000), "17 个小时");
});
