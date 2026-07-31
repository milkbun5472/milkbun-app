"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../js/somatic-core.js");

test("指数衰减按通道时钟计算，不需要后台定时器", () => {
  const start = 1000;
  let state = Core.createState("a", start);
  state = Core.ignite(state, { channel: "touch", delta: 0.8, label: "头顶被揉过", labelCode: "touch:头顶" }, start);
  const afterTau = Core.snapshot(state, start + Core.CHANNELS.touch.tauMs);
  assert.ok(Math.abs(afterTau.active.touch.value - 0.29) < 0.02);
});

test("线下真实触碰强、线上文字抱抱只留低强度象征余韵", () => {
  const physical = Core.detect({ text: "我摸摸你的头发", role: "user", mode: "physical", source: "offline" });
  const symbolic = Core.detect({ text: "我摸摸你的头发", role: "user", mode: "symbolic", source: "private" });
  assert.equal(physical[0].channel, "touch");
  assert.equal(physical[0].entity, "头顶");
  assert.ok(physical[0].delta > symbolic[0].delta * 2);
});

test("否定、假设和工具手不误判为真实触觉", () => {
  assert.deepEqual(Core.detect({ text: "别抱我", role: "user", mode: "physical" }), []);
  assert.deepEqual(Core.detect({ text: "我想摸摸你的头", role: "user", mode: "physical" }), []);
  assert.deepEqual(Core.detect({ text: "我伸手摸了摸杯子", role: "user", mode: "physical" }), []);
});

test("动作与身体部位不跨标点串味", () => {
  const events = Core.detect({ text: "我摸摸你。然后说起自己的手腕", role: "user", mode: "physical" });
  assert.equal(events[0].entity, "身上");
});

test("角色输出、OOC 和系统消息不能给自己伪造身体经历", () => {
  assert.deepEqual(Core.detect({ text: "她摸了我的头", role: "assistant", mode: "physical" }), []);
  assert.deepEqual(Core.detect({ text: "请以后多写拥抱", role: "user", kind: "ooc", mode: "physical" }), []);
  assert.deepEqual(Core.detect({ text: "摸摸头", role: "system", kind: "system", mode: "physical" }), []);
});

test("真实语音只读取本机耳朵的受控观察，不解释情绪", () => {
  const events = Core.detect({ text: "宝宝", role: "user", tone: { observations: ["声音比平时更轻", "停顿比平时更多"] }, source: "voice" });
  assert.equal(events.length, 1);
  assert.equal(events[0].channel, "sound");
  assert.match(events[0].label, /声音比平时更轻/);
});

test("嗅觉味觉只收明确已发生表述，保留干净实体名", () => {
  const smell = Core.detect({ text: "我闻到淡淡的咖啡香味。", role: "user", mode: "physical" });
  const taste = Core.detect({ text: "刚刚喝了绿咖喱汤。", role: "user", mode: "physical" });
  assert.equal(smell[0].channel, "smell");
  assert.match(smell[0].entity, /咖啡/);
  assert.equal(taste[0].channel, "taste");
  assert.match(taste[0].entity, /绿咖喱汤/);
  assert.deepEqual(Core.detect({ text: "我刚喝了粥", role: "user", mode: "symbolic" }), []);
});

test("状态按角色 ID 创建，快照只暴露越过阈值的通道", () => {
  let a = Core.createState("char-a", 1), b = Core.createState("char-b", 1);
  a = Core.ignite(a, { channel: "touch", delta: 0.7, label: "暖", labelCode: "touch:warm" }, 1);
  assert.equal(Core.snapshot(a, 2).count, 1);
  assert.equal(Core.snapshot(b, 2).count, 0);
  assert.equal(a.charId, "char-a");
  assert.equal(b.charId, "char-b");
});
