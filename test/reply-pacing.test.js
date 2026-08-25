const test = require("node:test");
const assert = require("node:assert/strict");
const Pacing = require("../js/reply-pacing.js");
const fs = require("node:fs");

// v54.57 放宽（她 2026-08-22：短句调情被夹成「想。」「？」，人格全泄进心声）：
// 短档 1~3、普通 1~4、长内容 2~5；且提示词明写「字数只是参考，分量和性格才定节奏」。
test("随口一句默认一到三泡——不再按用户字数硬夹", () => {
  assert.deepEqual(Pacing.band([{ role: "assistant", content: "在" }, { role: "user", content: "你在干嘛" }]), { min: 1, max: 3, kind: "short" });
});

test("连发和长内容逐级放宽，但不默认五六泡起步", () => {
  const two = [{ role: "user", content: "第一件事我想问你" }, { role: "user", content: "还有一件事" }];
  assert.equal(Pacing.band(two).max, 4);
  assert.deepEqual(Pacing.band([{ role: "user", content: "这是一段".repeat(40) }]), { min: 2, max: 5, kind: "substantial" });
});

test("节奏提示明写：分量和性格定节奏，短消息不许把角色也压短", () => {
  const p = Pacing.pacing([{ role: "user", content: "可是我不想" }]);
  assert.match(p, /字数只是参考/);
  assert.match(p, /不许因为对方话短就把自己也压成同样短/);
  assert.match(p, /把同一个意思换说法凑数/, "反注水的刹车还在");
});

test("自主续说保持一到两泡", () => {
  assert.deepEqual(Pacing.band([], { continueMode: true }), { min: 1, max: 2, kind: "self_continue" });
});

test("整体提示用通用交际目的与情绪重量原则，不堆具体案例", () => {
  const prompt = Pacing.guidance([{ role: "user", content: "随便一句话" }]);
  assert.match(prompt, /先理解这句话在做什么/);
  assert.match(prompt, /撒娇、玩笑、求确认、普通分享、吐槽、真实倾诉还是争执/);
  assert.match(prompt, /匹配对方实际给出的情绪重量/);
  assert.match(prompt, /证据不足时保持轻量/);
  assert.match(prompt, /角色差异优先于统一的高情商模板/);
  assert.doesNotMatch(prompt, /怎么会呢|我怎么会不想你|好几天没见你了|你是不是今天太累/);
});

// 读懂对方这句话在做什么：与「气泡」无关，四条通道都该吃到（Lisa 2026-08-18 对齐线上线下）
test("读句规则与气泡节奏拆开，并铺到线下与群聊", () => {
  const reading = Pacing.reading();
  assert.match(reading, /先理解这句话在做什么/);
  assert.doesNotMatch(reading, /气泡/, "reading 不该带任何只属于线上聊天的气泡概念");
  assert.match(Pacing.pacing([{ role: "user", content: "嗨" }]), /气泡/);
  assert.match(Pacing.guidance([{ role: "user", content: "嗨" }]), /先理解这句话在做什么/);
  const app = fs.readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
  const engine = fs.readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
  assert.match(app, /ReplyPacing\.reading\(\)/, "群聊线上要接入读句规则");
  // 注释里也会提到这个名字（v55.96 就撑到过 3）——数之前先把注释行滤掉
  const codeOnly = src => src.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  assert.equal((codeOnly(engine).match(/ReplyPacing\.reading\(\)/g) || []).length, 2, "线下单聊与群线下各接入一次");
});
