const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const app = require("./_online-layer.js").expand(fs.readFileSync(__dirname + "/../js/app.js", "utf8"));
test("not same room → apart line in single and group, cohabit escape kept", () => {
  assert.match(eng, /function apartPresence\(uName, group\)[\s\S]{0,400}除非对话里明确说过/);
  assert.match(app, /offlineActiveFor\(char\.id\) \|\| \(sameRoomFor\(char\.id\) \? "" : apartPresence\(userName\(profile\)\)\)/);
  assert.match(app, /apartPresence\(userName\(profile\), true\) : ""/);
});
test("online reroll feeds the removed version as avoid, single and group", () => {
  assert.match(eng, /function onlineRerollHint\(avoid\)/);
  assert.match(app, /replyNow\(activeChar\.id, null, null, \{ chatKey: threadKey, room: rerollRoom, rerollAvoid \}\)/);
  assert.match(app, /const _rerollHint = onlineRerollHint\(opts && opts\.rerollAvoid\)[\s\S]{0,900}_rerollHint \+ _turnClosing/);
  assert.match(app, /replyGroup\(groupId, \{ rerollAvoid \}\)/);
  assert.match(app, /onlineRerollHint\(rgOpts && rgOpts\.rerollAvoid\)/);
});
test("reroll while I blocked him goes back to the blocked path with the avoid", () => {
  assert.match(app, /if \(bkNow\.iBlocked\) blockedReaction\(activeChar\.id, blockChatKey\(activeChar\.id\), rerollAvoid\)/);
  // ⚠️原来钉的是「progress + herLine + onlineRerollHint」这个【相邻顺序】，
  //   v74.642 在中间插了一段掷轴（_blkAxes）就断了。顺序不该当锚——
  //   要守的是「reroll 的 avoid 真的送进了拉黑这一枪」。
  const blkCall = app.slice(app.indexOf("const raw = await callAI(apiFor(charId), blockBundleFor"));
  assert.match(blkCall.slice(0, 1500), /onlineRerollHint\(rerollAvoid\)/);
});
test("blocked reaction: no recycling earlier lines, 2-4 bubbles", () => {
  // ⚠️原来钉的是判决式那句「这一轮【一句都不许再发】」。她 2026-10-04 让把拉黑调暖，
  //   那句按 bans-make-it-dumber 改成了给出口的写法（说清为什么、往哪走）。
  //   这条要守的是【别把说过的再说一遍】这件事，不是那一句措辞。
  assert.match(app, /同一件事、同一个意思，换个说法再说一遍/);
  assert.match(app, /往前挪了一步之后才会有的话/);
  assert.doesNotMatch(app, /两到四个气泡/);
  assert.match(app, /applySchedChange\(charId, d\.schedNow\)/);
  assert.match(app, /SCHED_NOW_SPEC : ""\) \+ "（被拉黑以后/);
});
