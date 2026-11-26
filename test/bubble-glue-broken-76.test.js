const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const s = fs.readFileSync("js/engine.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8");
const f = new Function(s.slice(s.indexOf("const BUBBLE_DANGLE"), s.indexOf("function splitCardsAndLines")) + ";return bubbleGlueBrokenLines;")();
test("半句话断成两泡粘回去", () => {
  assert.deepEqual(f(["刚在健身会所做完核心", "训练", "两块全麦面包配了杯", "咖啡", "你呢？还没休息？", "还是", "又在做心理测试题？"]),
    ["刚在健身会所做完核心训练", "两块全麦面包配了杯咖啡", "你呢？还没休息？", "还是又在做心理测试题？"]);
});
test("能自己成句的短泡不粘", () => {
  assert.deepEqual(f(["到家了。", "晚安", "嗯", "好"]), ["到家了。", "晚安", "嗯", "好"]);
  assert.deepEqual(f(["今天好累啊😮‍💨", "抱抱"]), ["今天好累啊😮‍💨", "抱抱"]);
});
test("单聊群聊都接上", () => {
  assert.match(app, /if \(_splitOn && typeof bubbleGlueBrokenLines === "function"\) words = bubbleGlueBrokenLines\(words\)/);
  assert.match(app, /bubbleGlueBrokenLines\(_gLines\.map/);
});
test("「怎么」这种单发起下一句的不粘到上一句尾巴上（她 2026-11-25）", () => {
  assert.deepEqual(f(["而且他家牛排切得厚", "煎出来汁水多", "怎么", "嫌我买太勤了？"]), ["而且他家牛排切得厚", "煎出来汁水多", "怎么", "嫌我买太勤了？"]);
  assert.deepEqual(f(["刚在健身会所做完核心", "训练"]), ["刚在健身会所做完核心训练"], "真尾巴照粘");
});
