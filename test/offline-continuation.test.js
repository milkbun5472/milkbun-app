const assert = require("assert");
const flow = require("../js/offline-continuation.js");

assert.strictEqual(flow.isAutonomousContinuation([
  { id: "u1", role: "user", content: "我先说第一句" },
  { id: "u2", role: "user", content: "我再补一句" }
]), false, "Lisa 连发后按演绎，仍应回应她的新消息");

assert.strictEqual(flow.isAutonomousContinuation([
  { id: "u1", role: "user", content: "我把门推开" },
  { id: "c1", role: "char", content: "他接住门，走进屋里。" }
]), true, "最后一拍由角色生成时才进入自主续演");

assert.strictEqual(flow.isAutonomousContinuation([
  { id: "gc_1", role: "narration", generated: true, content: "走廊尽头响起脚步声。" }
]), true, "群线下的生成旁白也可成为下一拍锚点");

assert.strictEqual(flow.isAutonomousContinuation([
  { id: "n_1", role: "narration", content: "今晚大家在厨房。" }
]), false, "Lisa 写的开场旁白仍需先得到回应");

// ⚠️她的名字是【传进来的】，不是写死的（v65.05 把全库六十来处 "Lisa" 收成 userName(profile)）。
//   桩钉在写它那一头：换个名字传进去，那一段必须跟着换——
//   写死的话这条当场红，不然别人打开这个 app 会被叫成 Lisa。
const single = flow.cue(false, "阿念");
assert(single.includes("不是重新回答"));
assert(single.includes("至少造成一个看得见的新变化"));
assert(single.includes("不要替 阿念 发明新的台词、动作、选择或感受"));
assert(!single.includes("Lisa"), "名字被写死在提示词里了");

// 没传名字时退回中性的「用户」，不是退回某个人的名字
assert(flow.cue(false).includes("不要替 用户 发明新的台词、动作、选择或感受"));

const group = flow.cue(true, "阿念");
assert(group.includes("最后一个角色或旁白 beat"));
assert(group.includes("彼此接话"));

console.log("offline continuation tests passed");
