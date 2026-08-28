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

test("wearing / action 仍然是「有变化才填」——只有 mood 和 thought 是每轮必报", () => {
  assert.match(proto, /wearing 仅在穿着发生有意义变化时填写，否则 null/);
  assert.match(proto, /action 仅在角色当前可持续的活动或所处状态发生有意义变化时填写，否则 null/);
  assert.match(proto, /thought 每轮必须填写/);
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

test("计数写完之后才读 liveState，否则会被下一句盖掉", () => {
  const off = app.indexOf("else _moodSkip(charId, false);");
  const live = app.indexOf("const liveState = statesRef.current[charId] || {};", off);
  assert.ok(live > off && live - off < 400, "线下：liveState 必须在 _moodSkip 之后读");
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
