// 有人 2026-09-16 报：「锁脸锁角色可以，锁她自己不行」。
//
// 病根在 multipart 的字段模式上：`first` 只 append refBlobs[0]，**第二张之后的脸全被丢掉**。
// 合照的参考图顺序是【角色在前、她自己在后】，所以角色永远锁得住、她自己永远丢。
// 而且回执里 referenceCount 写死成 refBlobs.length——明明只发了一张，报告说发了两张，
// 排查的人全被这个数带偏。
//
// ⚠️选 "first" 的本意是【我这个站只认 image 这个字段名】，不是「只发一张」。
//   repeat 用的也是 image 字段，只是发多次——多图时自动走它，两头都不亏。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const engine = fs.readFileSync("js/engine.js", "utf8");
const grab = re => { const m = engine.match(re); assert.ok(m, "找不到：" + re); return m[0]; };

const pickMode = new Function("a", "refBlobs",
  grab(/    const rawMode = a\.refFieldMode[\s\S]*?const preferredMode = [^\n]+\n/) + " return preferredMode;");

test("多张参考照时，「image」这个选择不许退化成「只发第一张」", () => {
  const two = [{}, {}], one = [{}];
  assert.equal(pickMode({ refFieldMode: "first" }, two), "repeat", "合照里她自己那张被丢了");
  assert.equal(pickMode({ refFieldMode: "first" }, one), "first", "单图照旧走 image，别改动已验证的路径");
  // 其余选择原样尊重
  assert.equal(pickMode({ refFieldMode: "bracket" }, two), "bracket");
  assert.equal(pickMode({ refFieldMode: "repeat" }, two), "repeat");
  assert.equal(pickMode({ refFieldMode: "auto" }, two), "bracket");
  assert.equal(pickMode({ refFieldMode: "auto" }, one), "first");
  assert.equal(pickMode({}, two), "bracket");
});

test("回执要报【真的发出去了几张】，不许拿总数充数", () => {
  const finish = new Function("refBlobs", "uploadedBytes",
    grab(/    const finish = \(out, how, mode, legacyShape\) => \{[\s\S]*?\n    \};/) + " return finish;");
  const f2 = finish([{ size: 10 }, { size: 20 }], 30);
  const kept = f2({}, "classic", "repeat", true);
  assert.equal(kept.referenceCount, 2);
  assert.equal(kept.referenceDropped, 0);
  assert.ok(!String(kept.degraded || "").startsWith("refs-dropped"));
  // 真发生了丢脸，必须说出来——「成功出图」但换了张脸是最坏的一种失败
  const lost = f2({}, "classic", "first", true);
  assert.equal(lost.referenceCount, 1, "只发了一张就得报一张");
  assert.equal(lost.referenceDropped, 1);
  assert.equal(lost.degraded, "refs-dropped-1", "丢了脸却不吭声，外面看起来就是「拍好了」");
});

test("兜底换字段名时也不许退回 first 把脸丢掉", () => {
  assert.match(engine, /const alternateMode = preferredMode === "bracket"\n\s*\? \(refBlobs\.length > 1 \? "repeat" : "first"\) : "bracket";/);
});

test("三种模式发的字段名和张数都没变", () => {
  assert.match(engine, /if \(refMode === "first"\) fd\.append\("image", refBlobs\[0\]/);
  assert.match(engine, /else if \(refMode === "repeat"\) refBlobs\.forEach\(\(blob, i\) => fd\.append\("image", blob/,
    "repeat 必须仍然用 image 这个字段名——它存在的全部理由就是「字段名照旧、张数不丢」");
  assert.ok(engine.indexOf('else refBlobs.forEach((blob, i) => fd.append("image[]", blob') > 0);
});
