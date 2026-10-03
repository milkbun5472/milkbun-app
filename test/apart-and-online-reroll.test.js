const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
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
  assert.match(app, /progress \+ onlineRerollHint\(rerollAvoid\)/);
});
test("blocked reaction: no recycling earlier lines, 2-4 bubbles", () => {
  assert.match(app, /这一轮【一句都不许再发】/);
  assert.match(app, /这一轮两到四个气泡就够/);
});
