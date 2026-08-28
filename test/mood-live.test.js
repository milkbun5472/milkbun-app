const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

// 她 2026-08-24：「实时心情也好久不会变了」。
// 病根不在管道（setMoodFor 一直好好的），在线下协议自己写着：
//   「mood 只在本轮形成后的主导心情值得更新时填写，否则 null」
// 而示范形状里还直接摆着 "mood":null——模型照着模板填 null，心情就永远冻着。
// 跟 thought 那次是同一个病：字段被写成「有变化才报」，就等于永远不报。

const proto = (() => {
  const i = engine.indexOf("const OFFLINE_PROTOCOL_V2 = `");
  return engine.slice(i, engine.indexOf("`;", i));
})();

test("线下的 mood 改成每轮必填，不再是「值得更新才填」", () => {
  assert.match(proto, /mood 每轮必须填写 \{"label":"中文短词"\}，禁止 null、空串或省略/);
  assert.ok(proto.indexOf("mood 只在本轮形成后的主导心情值得更新时填写") < 0, "旧说法不许留着");
  // 说清「每轮重看一眼」和「有变化才报」的区别，否则模型还是会省
  assert.match(proto, /不是「有变化才报」的变更通知/);
  assert.match(proto, /心情没变就照实写回同一个词/);
});

test("示范形状里不许再摆 \"mood\":null——模型就照着模板填", () => {
  assert.match(proto, /"mood":\{"label":"此刻中文心情词"\}/);
  const nulls = engine.split("\n").filter(l => !/^\s*\/\//.test(l) && l.indexOf('"mood":null') >= 0);
  assert.deepEqual(nulls, [], "线下协议和两份自修协议里都不许再有");
});

test("还是不回就得数出来，别再变成静默失败", () => {
  assert.match(app, /const _moodSkip = \(id, got\) => \{/);
  assert.equal((app.match(/_moodSkip\(charId, true\)/g) || []).length, 2, "线上线下各一处");
  assert.equal((app.match(/_moodSkip\(charId, false\)/g) || []).length, 2);
  assert.match(app, /连着 12 轮没按协议返回心情/);
  assert.match(app, /不数一下就分不出来/, "为什么要这只计数器，写在代码里");
});

test("计数器归零/累加的判据对得上 thought 那只", () => {
  const i = app.indexOf("const _moodSkip = (id, got) =>");
  const fn = app.slice(i, app.indexOf("\n  };", i));
  assert.match(fn, /got \? 0 : Math\.min\(\(Number\(live\.moodSkips\) \|\| 0\) \+ 1, 99\)/);
  assert.match(fn, /if \(n === \(Number\(live\.moodSkips\) \|\| 0\)\) return;/, "没变化就别白写一次盘");
});

test("计数写完之后才读 liveState，中间也不许再有人写 statesRef", () => {
  const off = app.indexOf("else _moodSkip(charId, false);");
  const live = app.indexOf("const liveState = statesRef.current[charId] || {};", off);
  assert.ok(live > off, "线下：liveState 必须在 _moodSkip 之后读");
  // 中间夹进别的层是允许的（v57.01 把 Ta 眼里的写回放在这儿），但它们不能碰实时状态，
  // 否则 liveState 会读到旧的、再被下一句整份盖回去。
  const between = app.slice(off, live);
  assert.doesNotMatch(between, /setStateFor\(|statesRef\.current =/, "夹在中间的代码写了 statesRef：\n" + between);
});

// 她 2026-08-28：「为啥线下也还是不会换实时心情？王爷一直在『好笑』」。
// 看着不动有两种完全不同的病：模型每轮都报了同一个词，和这个角色的心情【压根没人写过】
// （闭群只进不出、配角被挡、模型漏字段）。卡上不写上次写入时间，这两种分不开。
test("实时心情卡要摆出上次写入时间，别让「没人写过」看起来像「一直是这个心情」", () => {
  assert.match(comp, /上次写入：" \+ timeAgo\(dm\.ts\)/);
  assert.match(comp, /!dm\.def && dm\.ts \?/, "默认心情没有写入时间可摆，别显示");
  const i = comp.indexOf("上次写入：");
  assert.ok(comp.lastIndexOf("实时心情", i) > 0 && i - comp.lastIndexOf("实时心情", i) < 1500,
    "这一行得挂在实时心情那张卡上");
});

// 她 2026-08-28 的单人线下心声历史：27 分钟五条，thought 每条都不一样，
// 心情一路「好笑」、穿着动作那一行一个字没变。三个字段一起冻、只有 thought 在动
// ——模型把 scene/thought 写了，剩下的照着【示范形状】抄了 null。
// v55.67 只改了散文（mood 每轮必填），形状里 "wearing":null,"action":null 原样留着；
// 散文和形状打架时模型信形状，因为它是唯一能照抄的东西。
test("线下示范形状里，必填字段的槽位不许出现 null 字面量", () => {
  const shapes = engine.match(/输出形状[：:]\{[^\n]*\}|本轮输出形状严格改为：` \+ \(shape \|\| '\{[^\n]*\}'\)/g) || [];
  assert.ok(shapes.length >= 3, "线下正常协议 + 两处自修协议，一处都不能漏，实际拿到 " + shapes.length);
  shapes.forEach(sh => {
    assert.doesNotMatch(sh, /"mood":\s*null/, sh.slice(0, 60));
    assert.doesNotMatch(sh, /"action":\s*null/, sh.slice(0, 60));
    assert.doesNotMatch(sh, /"thought":\s*null/, sh.slice(0, 60));
    assert.match(sh, /"action":"此刻正在做什么/, "action 槽位要摆真答案，不是 null");
  });
});

test("线下的 action 跟线上一样每轮必填——线下的戏推得更快，不该反而写成可以不填", () => {
  const proto = engine.slice(engine.indexOf("const OFFLINE_PROTOCOL_V2 = "), engine.indexOf("场景先发生，系统再记录。"));
  assert.match(proto, /action 每轮必须填写，禁止 null、空串或省略/);
  assert.doesNotMatch(proto, /action 仅在.*否则 null/, "旧的「有变化才填」要删掉，不是在后面补一句说它错了");
  // 穿着确实是「换了才写」——衣服不会每一拍都变，这条差异是有理由的
  assert.match(proto, /wearing 仅在穿着发生有意义变化时填写，否则 null/);
  assert.match(proto, /thought 每轮必须填写/);
});

test("「没变化就别硬填」这张空白支票要收窄，别把 mood/action 一起免掉", () => {
  const proto = engine.slice(engine.indexOf("const OFFLINE_PROTOCOL_V2 = "), engine.indexOf("场景先发生，系统再记录。"));
  assert.match(proto, /wearing、affinityDelta、toy 没有真实变化时留空即可/);
  assert.match(proto, /thought、mood、action 是【此刻重新看一眼】的读数，不是变更通知，每轮都要写/);
});
