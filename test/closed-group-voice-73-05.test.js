// 她 2026-09-22：「没开互通的时候感觉人物表现很刻板印象还很油腻」。
//
// 封闭群自 08-24 起是「只进不出」：长期记忆、记忆库、印象卡、心情、好感都读得到。
// 唯独【TA 平时到底怎么跟你说话】那一层是空的 —— 互通群靠实时私聊补上，
// 封闭群本该靠「入群前上文」那一档，可它默认是 0。
// 没有一句真话垫底，模型就拿「这类人设一般怎么说话」去补：刻板、油腻都从这儿来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");

test("没设过的群默认带 20 条入群前私聊", () => {
  assert.match(app, /preJoinN: 20,/, "gsFor 的默认值还是 0");
  assert.match(app, /const _preJoinN = gs\.preJoinN == null \? 20 : Number\(gs\.preJoinN\) \|\| 0;/);
  assert.match(app, /\.slice\(-_preJoinN\)/, "算出来的数没真的用上");
  // ⚠️她显式拉到 0 的群照旧是 0：只有「没设过」才换默认
  assert.doesNotMatch(app, /gs\.preJoinN \|\| 20/, "把她显式设的 0 也当成没设过了");
});

test("设置页显示的默认跟真正用的是同一个数", () => {
  assert.match(comp, /useState\(gs\.preJoinN == null \? 20 : Number\(gs\.preJoinN\) \|\| 0\)/);
  assert.match(comp, /setPreJoinN, 0, 50, 1,/, "拉条上限没放开");
});

test("说明不再说谎：封闭群是只进不出，不是不进不出", () => {
  assert.doesNotMatch(comp, /记忆不进也不出/, "还在说封闭群读不到记忆 —— 08-24 就改成只进不出了");
  assert.match(comp, /长期记忆、记忆库、印象卡照样读得到，但群里发生的事一个字都不回流主线（只进不出）/);
  assert.match(comp, /拉成 0，角色就只剩人设标签，容易演成刻板印象/, "没说清拉成 0 的后果");
});
