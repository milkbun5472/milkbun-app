const test = require("node:test"); const assert = require("node:assert");
const s = require("fs").readFileSync(__dirname + "/../js/screens.js", "utf8");
test("论坛：点开有新回复的帖跳到第一条新的；新帖能一键已读", () => {
  assert.match(s, /if \(unreadFloors\(p\.id\) > 0\) \{[\s\S]{0,200}document\.querySelector\('\[data-wk="fofloor"\]\[data-new="1"\]'\)/);
  assert.match(s, /"data-wk": "fonewallread", onClick: \(\) => \{ setNewPostSeen\(x => x\.concat\(forumNewCharPosts\.map\(p => p\.id\)\)\); try \{ localStorage\.setItem\("x_forumLastSeen"/);
});
