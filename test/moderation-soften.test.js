const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const theater = fs.readFileSync(path.join(root, "js/theater.js"), "utf8");

// 她 2026-08-22 截图：只是要一张自拍，角色恰好在醉仙楼喝酒，模型把酒杯写进画面描述，
// 上游对【真人参考照 + 酒精】直接拒了 →「没用上参考照」。
// 旧阶梯是 带照片失败 → 立刻退到无参考照，等于为了一只酒杯丢掉整张脸。

// 把软化器抠出来真跑
const soften = (() => {
  const i = engine.indexOf("  const SOFTEN = [");
  const j = engine.indexOf("  };", engine.indexOf("const softenForModeration")) + 4;
  return new Function(engine.slice(i, j) + "\nreturn softenForModeration;")();
})();
const looksLikePolicy = (() => {
  const i = engine.indexOf("  const looksLikePolicy = ");
  return new Function(engine.slice(i, engine.indexOf("\n", i)) + "\nreturn looksLikePolicy;")();
})();

test("酒/烟/刀被换掉，并补一句尺度声明", () => {
  const out = soften("他坐在醉仙楼二楼，手里端着酒杯，正在喝酒");
  assert.ok(!/酒/.test(out.split("【画面尺度补充】")[0]), "正文里不该再有酒：" + out);
  assert.match(out, /茶/);
  assert.match(out, /【画面尺度补充】画面必须是可公开展示的日常场景/);
  assert.ok(!/烟/.test(soften("他叼着烟").split("【画面尺度补充】")[0]));
  assert.ok(!/刀/.test(soften("腰间挂着刀").split("【画面尺度补充】")[0]));
});

test("一个字都没改就返回 null——别为不相干的失败白跑一次", () => {
  assert.equal(soften("他站在窗边看雨，神情懒散"), null);
  assert.equal(soften(""), null);
});

test("只对疑似审核拒绝重试；网络错误换说法也没用", () => {
  ["该提示可能违反了我们的内容政策", "content policy violation", "safety system blocked", "moderation failed"]
    .forEach(m => assert.ok(looksLikePolicy({ message: m }), "该认出来：" + m));
  ["network timeout", "fetch failed", "429 quota exceeded", "接口没返回 JSON"]
    .forEach(m => assert.ok(!looksLikePolicy({ message: m }), "不该重试：" + m));
});

test("降级阶梯：丢脸【之前】插一级软化重试，两条路都插了", () => {
  // 单张参考照
  assert.match(engine, /if \(looksLikePolicy\(e\)\) \{\s*const soft = softenForModeration\(prompt\);/);
  assert.match(engine, /return mark\(await attemptWith\(refBlobs, "first", soft\), "softened"\);/);
  // 多张（合照）
  assert.match(engine, /if \(looksLikePolicy\(\{ message: lastRefErr \}\)\) \{/);
  // 顺序要紧：软化重试必须排在 no-ref 之前，否则脸已经丢了再软化毫无意义
  const softAt = engine.indexOf('"softened"');
  const noRefAt = engine.indexOf('mark(await attempt(false), "no-ref")');
  assert.ok(softAt > 0 && softAt < noRefAt, "软化重试要排在退回无参考照之前");
});

test("prompt 覆盖串下去了，而且没把 API 的字段名改坏", () => {
  assert.match(engine, /const attemptWith = async \(blobs, refMode, pOverride\)/);
  assert.match(engine, /const attempt = async \(useRef, slim, refMode, pOverride\) => \{\n    const promptText = pOverride \|\| prompt;/);
  // ⚠️两个出口的【键名】必须还是 prompt，值才是 promptText——
  // 改这儿时用正则一不小心会把简写属性 { prompt } 改成 { promptText }，那会让无参考照出图全废
  assert.match(engine, /fd\.append\("prompt", promptText\)/);
  assert.match(engine, /prompt: promptText, size, n: 1/);
  assert.ok(!/\{ model: a\.model \|\| "gpt-image-2", promptText,/.test(engine), "简写属性被改坏了");
});

test("界面要说清楚为什么手里变成了茶，别让她以为角色改喝茶了", () => {
  const msg = "审核不让真人照片配酒/烟/刀，画面里换成了茶和折扇——脸保住了";
  assert.ok(app.includes(msg), "单聊自拍要报");
  assert.equal((theater.match(new RegExp(msg.replace(/[/—]/g, "."), "g")) || []).length, 2, "小剧场剧照与封面两处都要报");
  // softened 不能落进「没用上参考照」那条分支——脸其实保住了，报反了会让人白排查
  assert.match(app, /out\.degraded === "softened" \?/);
});
