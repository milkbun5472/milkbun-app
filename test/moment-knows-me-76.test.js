const test = require("node:test"), assert = require("node:assert");
const app = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
test("她的朋友圈：别人的配角只有认识她的才刷得到", () => {
  assert.match(app, /const npcCrowd = \(hosts, max, knowsMe\) =>[\s\S]{0,200}\(!knowsMe \|\| n\.knowsUser\)/);
  assert.match(app, /const canSee = \[\.\.\.canSeeMain, \.\.\.npcCrowd\(canSeeMain, 3, true\)/);
  assert.match(app, /concat\(npcCrowd\(canSee, 4, true\), myNpcCrowd\(2, mom\)\)/);
});
test("她的朋友圈：评论的人带着最近跟她聊过的", () => {
  const i = app.indexOf("const reactToUserMoment = async");
  const body = app.slice(i, i + 6000);
  assert.match(body, /crossRecentFor\(c\.id, \{ surfaces: \["online", "offline"\]/);
});
