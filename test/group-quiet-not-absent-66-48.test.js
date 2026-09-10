// 她 2026-09-11：「为啥你看前面还在 18+，然后我不回复让他们继续，
// 他们就好像不知道前情提要了」——上文正演到她人就在场的一场戏，
// 她没打字、按了「让他们继续」，回来那一轮两个人在收拾浴室、摆毛巾、试水温，
// 等于把那一场从头重铺了一遍。
//
// ⚠️病根不是记不住（历史那一头 groupContextRows 是共用的，手动轮和自发轮读的是同一份），
//   是**有一句提示词叫他们把她删掉**：v56 那会儿为了治「演被冷落」写下的
//   「这一轮就当 TA 不在场」。治好了一个病，造出另一个——
//   她本来就在那个场面里，把她挪走，剩下的人自然只能另起一摊。
// ⚠️更糟的是她开着「同处一室」：system 里 samePlacePresence 刚写完「在场的各位和 TA
//   都在同一个地方」，userContent 又说「就当 TA 不在场」，两句正面打架，而后说的那句离输出更近。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.resolve(__dirname, "..", "js/app.js"), "utf8");
const blk = app.slice(app.indexOf("      if (!tail.length) userContent +="), app.indexOf("      // 双语·每轮提醒（v56.77）"));

test("「就当 TA 不在场」整句删掉，不是在后面补一句说它不对", () => {
  // ⚠️只对着【发出去的那段字】断言：注释里那句是这个项目自己的病历（写着为什么改），
  //   连注释一起匹配的话，越把原因写清楚测试越红。
  const sent = blk.split("\n").map(l => l.split("//")[0]).join("\n");
  assert.ok(sent.indexOf("就当 TA 不在场") < 0, "那句话还在——它离输出最近，补多少句都盖不过它");
  assert.match(blk, /「没出声」不等于「不在场」/, "没把这两件事分开说");
  assert.match(blk, /绝不许因为 TA 没说话就把 TA 挪走/);
  assert.match(blk, /更不许把上文那一场丢掉、另起一个话题或者从头把场面重新铺一遍/, "没挡住「重开一遍」——她看到的正是这个");
  assert.match(blk, /顺着上面正在发生的那件事往下接/);
});

test("原来要治的那个病还得治着：不许催她要回应", () => {
  // v56 那次是真事故（她 2026-08-20：第二轮开始整群都在演被冷落）
  assert.match(blk, /别演成被冷落/);
  assert.match(blk, /绝不许出现「怎么不说话」「是不是不理我了」「人呢」/);
  assert.match(blk, /【不是】不理你们、不是已读不回、不是在生气/);
  assert.match(blk, /TA 什么时候插话都可以/);
});

test("开着同处一室时，这件事由代码说死，不靠模型推测", () => {
  assert.match(blk, /\(gSameRoomFor\(groupId\) && !gs\.spectate\)/, "没读那个开关");
  assert.match(blk, /TA 人就在你们旁边，只是没出声。这一条是确定的，不许推翻/);
  // 旁观群不发：她本来就不在场，那儿说这句才是错的
  assert.ok(blk.indexOf("!gs.spectate") > 0, "旁观群里也说了「TA 就在旁边」");
  // system 那半句还在（两处说的是同一件事，别只剩一处）
  assert.match(app, /const gSameRoomHint = \(gSameRoomFor\(groupId\) && !gs\.spectate/);
});

test("这一段只在【她这一轮没开口】时才发（十轮里九轮用不上的不该常驻）", () => {
  assert.match(app, /if \(!tail\.length\) userContent \+=/);
  // 手动按「让他们继续」和自发轮走的是同一条：两条都没 tail，所以都吃这一段
  assert.match(app, /onContinue: \(\) => replyGroup\(activeGroup\.id\)/, "「让他们继续」那颗键改名了，这条要跟着重看");
  assert.match(app, /userContent = tail\.length \? tail\.map/);
});
