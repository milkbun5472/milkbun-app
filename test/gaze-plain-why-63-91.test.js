// 她 2026-09-05 发了截图：状态卡上原样印着「替他自动复看过 2/3 次:没解析出卡」。
// 「没解析出卡」是 `throw new Error()` 里的话——那是写给我看的，不是给她看的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => path.resolve(__dirname, "..", f);
const gaze = fs.readFileSync(P("js/gaze.js"), "utf8");
const app = fs.readFileSync(P("js/app.js"), "utf8");
const cut = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return src.slice(i, j); };
const plainWhy = new Function(cut(gaze, "  function plainWhy(msg)", "  function markReviewFail(") + "\nreturn plainWhy;")();

test("异常原文一律翻成人话，翻不出来的就说「这一次没成」", () => {
  assert.equal(plainWhy("没解析出卡"), "模型没按格式答");
  assert.equal(plainWhy("Unexpected token < in JSON at position 0"), "模型没按格式答");
  assert.equal(plainWhy("Request timeout after 150s"), "等太久，超时了");
  assert.equal(plainWhy("401 Unauthorized"), "这条线路没配好");
  assert.equal(plainWhy("429 Too Many Requests"), "被限流了");
  assert.equal(plainWhy("Failed to fetch"), "网没连上");
  assert.equal(plainWhy("insufficient_quota"), "额度不够了");
  // ⚠️认不出来的绝不能把原文摆到她眼前
  assert.equal(plainWhy("TypeError: x.y is not a function"), "这一次没成");
  assert.equal(plainWhy(""), "这一次没成");
  assert.equal(plainWhy(undefined), "这一次没成");
  // 已经是人话的那几句原样留着
  assert.equal(plainWhy("他一块也没写出来"), "他一块也没写出来");
  assert.equal(plainWhy("复看了一遍,一块都没改"), "复看了一遍,一块都没改");
});

test("存进去之前就翻好——存原文的话这句在界面上会一直是机器话", () => {
  const rf = cut(gaze, "  function markReviewFail(charId, why)", "  const reviewState =");
  assert.match(rf, /box\.reviewErr = plainWhy\(why\)\.slice\(0, 60\);/);
  const sf = cut(gaze, "  function markAutoSeedFail(charId, why)", "  const autoSeedState =");
  assert.match(sf, /box\.autoSeedErr = plainWhy\(why\)\.slice\(0, 60\);/);
  // 两处都不许再直接存 e.message
  assert.doesNotMatch(rf, /String\(why \|\| /);
  assert.doesNotMatch(sf, /String\(why \|\| /);
});

test("界面那两行说人话，而且说清还试不试", () => {
  // ⚠️「2/3 次」这种写法是给我看的日志格式，她要的是「试满了没有」
  assert.doesNotMatch(gaze, /rv\.tries \+ "\/" \+ rv\.max/, "又摆回 n/m 那种日志写法了");
  assert.doesNotMatch(gaze, /st\.tries \+ "\/" \+ st\.max/);
  assert.match(gaze, /rv\.tries >= rv\.max \? "；试满了，往后不再自动试" : ""/, "试满了不说，她会一直等一个不会来的东西");
  assert.match(gaze, /st\.tries >= st\.max \? "；试满了，往后不再自动试。想现在就要，点下面那个按钮" : ""/, "空卡那一支还得告诉她能自己按");
  assert.match(gaze, /"，都没成（" \+ plainWhy\(rv\.err\) \+ "）"/);
});

// 这一枪一次要写十块，窄上限里还要扣掉思考预算——想完就没配额写正文＝空返回，
// 界面上就是那句「模型没按格式答」。她 2026-09-05 亲口点名这一处开满。
test("建卡和复看那两枪开满 65535", () => {
  const seed = cut(app, "  const seedGazeFor = async (char, auto)", "  // 「规则降概率，代码才保证」在这一层的落法");
  assert.match(seed, /window\.Gaze\.seedSpec\(uN\)[\s\S]{0,120}maxTokens: 65535/);
  const rev = cut(app, "  const reviewGazeFor = async char", "  const maybeAutoReviewGaze");
  assert.match(rev, /window\.Gaze\.reviewSpec\(uN, char\.id\)[\s\S]{0,120}maxTokens: 65535/);
  // ⚠️上限是【天花板】不是【花销】：给宽了一分钱也不多花，给窄了才会写到一半停住、
  //   重来一次——那才是真多花了一次（max-tokens-floor.md「上限是天花板」那一节）。
  //   ⚠️别列黑名单：列几个数就漏几个数。判的是「这两处除了 65535 没有别的 maxTokens」。
  [["建卡", seed], ["复看", rev]].forEach(([zh, seg]) => {
    const all = [...seg.matchAll(/maxTokens:\s*(\d+)/g)].map(m => m[1]);
    assert.deepEqual([...new Set(all)], ["65535"], zh + "那一枪的 maxTokens 被往下压了：" + all.join(","));
  });
});
