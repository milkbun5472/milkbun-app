// 她 2026-09-14：「我跟 a 在一起，在群里跟 b 说话，a 开着车但是还是坚持非要回一轮」。
//
// 先按 bans-make-it-dumber 那三句查了一遍：
// ① 已经有人管了吗——有，common 里那句「不是每人每轮都要说话」；
// ② 发到了吗——发了；
// ③ 那为什么没用——因为同一份提示词里另外两句在往反方向拽：
//    「TA 可以照常发消息」＋「让在场的人都有戏」。
// 所以改的不是加禁令，是把那两句拧回来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
const busy = app.slice(app.indexOf("const gBusyHint = gBusyOff.length"), app.indexOf("// 群线下进行中"));

test("忙着的人：给判据，不给禁令，也不再【鼓励】TA 非回不可", () => {
  assert.ok(!/可以照常发消息/.test(busy), "原来那句是在鼓励忙着的人回话");
  assert.match(busy, /看 TA 手上那件事腾不腾得出手/, "判据要给出去，别写成一张「开车不许说话」的清单");
  assert.match(busy, /\*\*这一轮完全不出现是最自然的\*\*/);
  assert.match(busy, /群里没人会觉得奇怪/, "给出口，不给判决");
  assert.match(busy, /真要回就只回一句，短/);
  // 那条真正要挡的（人在两个地方）一个字没松
  assert.match(busy, /绝不许让 TA 出现在和那处境矛盾的地点\/活动里/);
  assert.match(busy, /关系隐私/);
});

test("例句删掉：它被逐字照抄，所以每次都是那一句", () => {
  // 施工规则/prompt-no-content-samples.md：留格式示范，删内容示范
  // 只看【真发出去的那一段】：注释里留着原话是为了记住教训，那不会进提示词
  ["在外头呢，抽空回你一句", "稍后细说"].forEach(k =>
    assert.ok(!busy.includes(k), "「" + k + "」这种例句一给就会被照抄成模板"));
});

test("「让在场的人都有戏」不能变成点名每个人", () => {
  const seg = app.slice(app.indexOf("现在群里在场 \" + members.length"), app.indexOf("【对话连贯"));
  assert.ok(!/让在场的人都有戏/.test(seg), "这句话正是「凑齐人头」的出处");
  assert.match(seg, /「多聊几个来回」不等于「点名每个人」/);
  assert.match(seg, /这一轮里有人一句话都没说是正常的/);
  assert.match(seg, /真实群聊从来是几个人在说、几个人在看/);
  // 原来那条「别三两句就收场」还在——不然会矫枉过正成一轮两句
  assert.match(seg, /别三两句就收场/);
});

test("本来就在的那句「不是每人每轮都要说话」没被动", () => {
  assert.match(app, /不是每人每轮都要说话，按情境选合适的人发言/);
});
