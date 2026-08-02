"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Gate = require("../js/open-loop-gate.js");

test("普通短期生活安排可以被记住，但不能自动变成开环", () => {
  for (const text of [
    "Lisa 今晚吃粥",
    "Lisa 和阿屿说好今晚一起吃粥",
    "今晚要吃啥还没决定",
    "阿屿待会洗澡",
    "顾暮明天上班",
    "Lisa 下班后去健身",
    "Lisa 和顾朝约定今天晚上帮顾朝揉脖子半个小时",
    "Lisa 答应明天下午陪顾暮去打羽毛球",
    "两人说好周末去约会",
    "今晚留在木屋过夜"
  ]) {
    assert.deepEqual(Gate.evaluate({ text, open: true, source: "auto", a: 1 }).open, false, text);
  }
});

test("模型随手贴约定标签也不能把日常菜单升级成开环", () => {
  const verdict = Gate.evaluate({
    text: "Lisa 和阿屿今晚一起吃粥",
    tags: ["约定", "共同计划"],
    open: true,
    source: "auto",
    a: 3
  });
  assert.deepEqual(verdict, { open: false, reason: "routine_plan" });
});

test("带明确后果的特殊日常约定仍可保留", () => {
  assert.equal(Gate.evaluate({
    text: "顾暮答应陪 Lisa 去医院吃完检查餐",
    open: true,
    source: "auto",
    a: 2
  }).open, true);
});

test("日常过滤不能误伤非食物承诺", () => {
  assert.equal(Gate.evaluate({
    text: "言秋答应给 Lisa 买一条项链",
    open: true,
    source: "auto",
    a: 2
  }).open, true);
});

test("明确共同约定、承诺和有后果的等待仍保留开环", () => {
  for (const text of [
    "Lisa 和阿屿约好周末见面",
    "顾暮答应陪 Lisa 去医院",
    "言秋还在等待 Lisa 的决定",
    "Lisa 和沈屿白的争执未解决"
  ]) assert.equal(Gate.evaluate({ text, open: true, source: "auto", a: 2 }).open, true, text);
});

test("模型只写了未来事实、没有开环证据时默认不升级", () => {
  assert.equal(Gate.evaluate({ text: "Lisa 下个月可能换一张桌子", open: true, source: "auto", a: 1 }).open, false);
});

test("旧自动条目是否该清理由 open 判决决定，而不是只看一种 reason", () => {
  assert.deepEqual(Gate.evaluate({
    text: "Stack-chan 已经到货，后面可能继续调试",
    tags: ["状态"],
    open: true,
    source: "auto",
    a: 1
  }), { open: false, reason: "future_fact_without_open_loop_evidence" });
});

test("短时词不能误关有明确后果的安排", () => {
  for (const text of [
    "Lisa 明天有考试，答应今晚一起复习",
    "顾暮周六陪 Lisa 去医院复诊",
    "周日是纪念日，两人约好一起吃饭"
  ]) assert.equal(Gate.evaluate({ text, open: true, source: "auto", a: 2 }).open, true, text);
});

test("Lisa 手动勾选的开环永远尊重", () => {
  assert.equal(Gate.evaluate({ text: "今晚吃粥", open: true, source: "manual", a: 0 }).open, true);
});
