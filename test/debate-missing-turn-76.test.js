// 她 2026-10-24 截图：擂台上齐周那一格只剩「……」——缺人就整轮再要一次，字段名多认几个
const assert = require("node:assert/strict"), fs = require("fs");
const d = fs.readFileSync("js/debate.js", "utf8");
assert.match(d, /const sayOf = x => x \? String\(x\.say \|\| x\.text \|\| x\.content \|\| x\.speech \|\| x\["发言"\] \|\| ""\)\.trim\(\) : "";/);
assert.match(d, /const text = sayOf\(hit\) \|\| "……";/);
console.log("ok");
assert.match(d, /\|\| \(J && !callOf\(pp\)\); \};/); assert.match(d, /const call = J \? callOf\(p\) : "";/);
// 回包断在半路：已经写完整的几条从原文捡回来；缺的只补那几位
{
  const a = d.indexOf("    const salvage = (raw, pp) =>"), b = d.indexOf("    const raw0 = ", a);
  const mk = new Function("chars", "J", "sayOf", "callOf", d.slice(a, b) + ";return salvage;");
  const sayOf = x => x ? String(x.say || x.text || "").trim() : "", callOf = pp => String(pp.call || "").trim();
  const salvage = mk([{ name: "周树生" }, { name: "齐周" }], { name: "顾朝" }, sayOf, callOf);
  const cut = '{"turns":[{"name":"周树生","say":"直接回句\\"妈妈\\"不就完了","at":"齐周"},{"name":"齐周","say":"老婆特意发的必须秒回，装君子';
  const got = salvage(cut, {});
  assert.equal(got.turns.length, 1); assert.equal(got.turns[0].name, "周树生"); assert.equal(got.turns[0].say, '直接回句"妈妈"不就完了');
  const whole = salvage('{"turns":[{"name":"齐周","say":"嗯"}],"call":"顾朝判：都别吵"', {});
  assert.equal(whole.call, "顾朝判：都别吵");
}
assert.match(d, /只补缺的这几样，已经写好的别重写/);
console.log("ok2");
