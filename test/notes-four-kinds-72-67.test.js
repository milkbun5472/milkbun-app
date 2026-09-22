// 她 2026-09-22 转来群里读者的话：「手机备忘录现在主要是记录了发生过的事情，
// 感受类的或者未来计划类的或者发散联想之类的偏少？所以看起来有时候没有太多惊喜感，
// 感觉情感浓度也有点淡」。
//
// 病根不在写得不好，在【取材只有一档】：原来那份 spec 只分了「打字 / 录音」，
// 记的是什么一个字都没说 —— 于是默认全落在最安全的那一档：记事。
// 这一份钉住那四档都在，也钉住它仍然是【掷轴不掷答案】：
// 规定档位，不规定写什么（施工规则/bans-make-it-dumber、prompt-no-content-samples）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const phone = fs.readFileSync(__dirname + "/../js/phone.js", "utf8");

// 只看便签那一段：两头都钉在代码上（施工规则/anchor-on-code）
const i = phone.indexOf("    notes: {"), j = phone.indexOf("    calls: {", i);
assert.ok(i > 0 && j > i, "抠不出便签那一段 spec");
const spec = phone.slice(i, j);

test("四档都在，而且说明了不许全挤在记事那一档", () => {
  ["已经发生的事", "此刻的感受", "往后的打算", "没头没尾的"].forEach(k =>
    assert.ok(spec.includes(k), "少了一档：" + k));
  assert.match(spec, /四档都要有，不许全挤在第一档/);
  assert.match(spec, /流水账/, "没说清全写成记事会变成什么");
});

test("第四档给了出口，没变成新的八股", () => {
  // 「别每条都这样」这一句是关键：规矩只加约束不给出口，就会把一种八股换成另一种
  assert.match(spec, /别每条都这样/, "④ 没给出口，迟早每条都变成同一个花样");
});

test("便签里可以出现用户，但不是条条都冲着她", () => {
  assert.match(spec, /TA私下里对TA的叫法/);
  assert.match(spec, /有一两条是冲着用户去的就够了，不必条条都是/);
});

// ⚠️加了四档之后，原来那条「打字 ≠ 录音」不许被挤掉：那是这个 app 的分界
test("打字和录音那条分界还在", () => {
  assert.match(spec, /打字打不出来、必须说出口的东西才会被录/);
  assert.match(spec, /录音在总数里是少数/);
  assert.match(spec, /【长短要差得开】/);
});

test("取材层也跟着说了：这儿不只是已经发生的事", () => {
  const a = phone.indexOf("const PHONE_ANGLE = {"), b = phone.indexOf("  calls: \"【取材层】", a);
  assert.ok(a > 0 && b > a, "抠不出 PHONE_ANGLE");
  const angle = phone.slice(a, b);
  assert.match(angle, /不只是已经发生的事/, "取材层那句没跟上——规则写在一处、别处没跟上是这个仓库最老的形状");
  assert.match(angle, /最不设防的地方/, "没说清这儿的情感浓度该是什么样");
});

// 提示词里不许塞【内容示范】：给了具体例子，模型就抄那个句式
test("四档说的是判据和维度，没塞可以照抄的例子", () => {
  const block = spec.slice(spec.indexOf("一条便签在【记什么】"), spec.indexOf("【关于用户】"));
  assert.ok(block.length > 100, "抠不出四档那一段");
  assert.doesNotMatch(block, /比如「|例如「|像这样/, "塞了内容示范，模型会原样照抄");
  // 「」里如果有整句内容，就是示范；四档这一段里不该出现引号包起来的句子
  assert.doesNotMatch(block, /「[^」]{8,}」/, "引号里出现了整句内容 —— 那就是内容示范");
});
