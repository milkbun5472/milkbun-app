// 先想后说（她 2026-09-22：「能抓到人设关键词造句，但并不能按照人设理解来」）
//
// 病根是协议第一句把生成顺序写死了：「先产生角色此刻真正会发送的消息…
// thought 等不得用于提前规划、解释或【反向塑造 word】」。
// 在"一步之内从一大块人设直接产台词"这个约束下，模型能做的只剩扫关键词造句——
// 「按人设理解来」需要的那一步（先从他的处境推出他此刻的判断）恰好被明文禁掉。
//
// ⚠️不是拿 thought 当那一步：THOUGHT_MEANING 明说它是【没说出口的】念头，
//   还禁止「规划回复」，另有 ThoughtVoiceGuard 守着。动它会毁掉心声。
//   所以只改措辞、不加字段——跟 ai-virtual-phone 那句
//   「在你的思维链中，必须以{{char}}第一人称思考」是同一个做法。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js", "engine.js"), "utf8");

test("三处「先出台词」的说法都翻过来了", () => {
  // ① 单聊线上的稳定协议
  assert.match(app, /你就是 TA 本人。开口之前先以 TA 的第一人称把眼前这件事想一遍/, "单聊线上·协议");
  // ② 单聊线上每轮那句任务
  assert.match(app, /先想一下 TA 此刻怎么看她刚说的这句话，再从那个判断回过去/, "单聊线上·本轮任务");
  // ③ 线下
  assert.match(engine, /你就是 TA 本人。落笔之前先以 TA 的第一人称把此刻这一幕想一遍/, "线下·协议");
  assert.match(engine, /先想清楚 TA 怎么看这一刻，场景再发生/, "线下·收尾那句");
});

// ⚠️「不得反向塑造」那半句是堵死先想后说的那一句，不许写回来；
//   但它原本防的东西（附属字段不许拿来铺剧情、不许给正文补解释）要留着。
test("堵死那半句删了，它原本防的东西留着", () => {
  ["不得用于提前规划、解释或反向塑造 word", "不得用于提前规划、解释或塑造 scene"]
    .forEach(x => assert.ok(app.indexOf(x) < 0 && engine.indexOf(x) < 0, "「" + x + "」写回来了"));
  assert.match(app, /不用来提前铺排剧情，也不用来给 word 补一段解释/);
  assert.match(engine, /不用来提前铺排剧情，也不用来给 scene 补一段解释/);
  assert.match(app, /没有真实变化或实际触发时，不要为了填字段制造内容/, "「别为填字段制造内容」不该跟着删");
});

// 心声那一格一个字都没动：它是【咽下去的】，不是思考过程
test("没有拿 thought 当思考步骤——心声的定义原样不动", () => {
  assert.match(engine, /const THOUGHT_MEANING = "写角色本人脑中此刻真正闪过、却没有说出口的一句第一人称念头/);
  assert.match(engine, /不要总结互动、分析自己、规划回复/, "心声仍旧禁止「规划回复」");
});

test("要的是【从他的判断长出来】，不是【往人设上凑】", () => {
  assert.match(app, /不是先想「这种人该说什么」再往人设上凑/);
  assert.match(engine, /不是先想「这种人该有什么反应」再往人设上凑/);
});
