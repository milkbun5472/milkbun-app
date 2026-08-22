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
  const i = engine.indexOf("  // ⚠️替换顺序有讲究");
  const j = engine.indexOf("  };", engine.indexOf("const softenForModeration")) + 4;
  return new Function(engine.slice(i, j) + "\nreturn softenForModeration;")();
})();
const looksLikePolicy = (() => {
  const i = engine.indexOf("  const looksLikePolicy = ");
  return new Function(engine.slice(i, engine.indexOf("\n", i)) + "\nreturn looksLikePolicy;")();
})();

// v54.85：她第二张截图——同一场景改报「自拍没生成」，整个函数抛了。
// 两个新病根：① 光秃秃一个「醉」字把【醉仙楼】拆成了「微红的脸色仙楼」，
// 逐词替换还拼出了「因喝着茶而起的微红的脸色感」这种病句；
// ② 软化只用在带照片那次，最后的 no-ref 兜底仍用【原始 prompt】——
// 原措辞本来就被拒，不带照片照样被拒，于是整个抛出。
test("地名不许误伤：醉仙楼、酒楼要原样活着", () => {
  const real = "背景是醉仙楼雅间模糊的木雕窗棂，带着几分因饮酒而起的微醺感";
  const out = soften(real);
  assert.match(out, /醉仙楼雅间/, "把地名拆了：" + out);
  assert.equal(soften("他在酒楼二楼靠窗坐着"), null, "酒楼是场所，不是画面里的酒");
});

test("整词组先处理，别逐词拼出病句", () => {
  const out = soften("带着几分随性和几分因饮酒而起的微醺感").split("【画面尺度补充】")[0];
  assert.ok(!/带着几分带着几分/.test(out), "拼重了：" + out);
  assert.ok(!/微红的脸色感/.test(out), "拼出病句了：" + out);
  assert.match(out, /带着几分随性和几分松弛/);
});

test("酒/烟/刀被换掉，并补一句尺度声明", () => {
  const out = soften("他坐在醉仙楼二楼，手里端着酒杯，正在喝酒");
  assert.ok(!/酒/.test(out.split("【画面尺度补充】")[0]), "正文里不该再有酒：" + out);
  assert.match(out, /茶/);
  assert.match(out, /【画面尺度补充】画面必须是可公开展示的日常场景/);
  assert.ok(!/烟/.test(soften("他叼着烟").split("【画面尺度补充】")[0]));
  assert.ok(!/刀/.test(soften("腰间佩刀").split("【画面尺度补充】")[0]));
  assert.match(soften("衣袖沾了血迹"), /衣袖沾了尘土/);
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
  // 单张参考照：只在疑似审核拒绝时才算软化稿
  assert.match(engine, /const soft = looksLikePolicy\(e\) \? softenForModeration\(prompt\) : null;/);
  assert.match(engine, /return mark\(await attemptWith\(refBlobs, "first", soft\), "softened"\);/);
  // 多张（合照）
  assert.match(engine, /const softM = looksLikePolicy\(\{ message: lastRefErr \}\) \? softenForModeration\(prompt\) : null;/);
  // 顺序要紧：软化重试必须排在 no-ref 之前，否则脸已经丢了再软化毫无意义
  const softAt = engine.indexOf('"softened"');
  const noRefAt = engine.indexOf('mark(await attempt(false), "no-ref")');
  assert.ok(softAt > 0 && softAt < noRefAt, "软化重试要排在退回无参考照之前");
});

test("兜底那级也必须用软化后的措辞——否则软化等于白做", () => {
  // 这是「自拍没生成」的真正病根：原措辞被拒，不带照片照样被拒，整个函数抛出
  assert.match(engine, /return mark\(await attempt\(false, false, null, soft\), "softened-no-ref"\);/, "单张");
  assert.match(engine, /return mark\(await attempt\(false, false, null, softM\), "softened-no-ref"\);/, "多张");
  // 四级顺序：原样带照片 → 软化带照片 → 软化不带照片 → 原样不带照片
  const i1 = engine.indexOf('"softened"'), i2 = engine.indexOf('"softened-no-ref"');
  assert.ok(i1 < i2, "保住脸的那级要排在前面");
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
  // 脸没保住的那级要说实话，别和「脸保住了」报成同一句
  const lost = "审核挡了两次，换掉酒/烟/刀才出得来，而且没用上参考照——脸可能不像";
  assert.ok(app.includes(lost), "单聊要报 softened-no-ref");
  assert.equal((theater.match(new RegExp(lost.replace(/[/—]/g, "."), "g")) || []).length, 2, "小剧场两处也要报");
});

// 她 2026-08-22：「到底咋样才能永远保住脸嘤」。
// 补救总是慢一拍，真正的答案是两层：① 别让触发词进 prompt；② 丢脸之前先把场景整个拿掉。
test("上游预防：模型写 scene 时就被告知画面要能过审", () => {
  assert.match(app, /scene 必须是【能公开展示】的画面/);
  assert.match(app, /不出现酒精（酒杯、饮酒、微醺）、烟草、武器刀刃、血迹伤口、裸露与性暗示/);
  // 要说清后果，模型才有动机遵守
  assert.match(app, /出图接口对这些会【整张拒绝】——那样你连脸都发不出去/);
  // 角色真在喝酒时该怎么办，也得给出路，否则它只能硬写
  assert.match(app, /把镜头取在【不含这些东西的那一格】/);
});

test("保脸级：丢参考照之前，先试一版没有场景描述的最简稿", () => {
  // 阶梯里要有这一级，并且由调用方传进来（只有它知道锁脸段长什么样）
  assert.match(engine, /if \(opts && opts\.minimalPrompt\) \{/);
  assert.match(engine, /return mark\(await attemptWith\(refBlobs, "first", opts\.minimalPrompt\), "minimal"\);/);
  // 顺序：软化带照片 → 最简带照片 → 才是丢照片
  const soft = engine.indexOf('"softened"'), min = engine.indexOf('"minimal"'), lost = engine.indexOf('"softened-no-ref"');
  assert.ok(soft < min && min < lost, "保脸的两级都要排在丢照片之前");
});

test("两条出图线路都把最简稿传下去了", () => {
  assert.match(app, /const minimalPrompt = buildPhotoPrompt\(char, "普通的日常人像/, "单聊自拍");
  assert.match(app, /minimalPrompt: minimalPrompt \}\);/);
  assert.match(app, /const gMinimal = buildPhotoPrompt\(spk, "普通的日常人像/, "群聊合照");
  assert.match(app, /\{ minimalPrompt: gMinimal \}/);
  // 最简稿必须【不含】任何场景文字，否则这一级白设
  const m = app.match(/buildPhotoPrompt\(char, "([^"]+)"/);
  assert.ok(m && !/酒|刀|血|烟/.test(m[1]), "最简稿里不许再有触发词");
});

test("minimal 那一级要说明白：脸是对的，只是没有场景", () => {
  assert.ok(app.includes("审核挡了两次，这张只拍了人和神情、没带场景——但脸是对的"));
  assert.match(app, /out\.degraded === "minimal" \?/);
});
