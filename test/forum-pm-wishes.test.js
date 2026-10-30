const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8"), ts = fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8");
test("私信过的网友在评论区认得她（同一个号、匿名不算、不当众抖私信）", () => {
  assert.match(app, /const forumPmKnow = \(post, names\) =>/);
  assert.match(app, /pmAcctOf\(t\) === \(alt \? "alt" : String\(myMaskTag\(post\)\.mask \|\| ""\)\) && want\.has\(String\(t\.npcName\)\)/);
  assert.match(app, /post\.board === "匿名吧" \|\| post\.anon\) return ""/);
  assert.match(app, /\+ forumPmKnow\(post, \[resp\.name, floor\.authorName, post\.authorName\]/);
});
test("帖子和一楼评论能转进论坛私信", () => {
  assert.match(app, /const forwardPostToPM = \(post, threadId\) =>/);
  assert.match(app, /onForwardToPM: forwardPostToPM,/);
  assert.match(ui, /onForwardToPM\(fwd, th\.id\)/);
  assert.match(ui, /title: "转发这一楼"/);
});
test("私信能单条删", () => {
  assert.match(app, /const delForumPMMsg = \(threadId, idx\) =>/);
  assert.match(ui, /onDelPMMsg\(th\.id, pmSel\)/);
  assert.match(ui, /useEffect\(\(\) => \{ setPmSel\(-1\); \}, \[pmId\]\)/);
  assert.match(ts, /\["pmmsgdel",/); assert.match(ts, /\["fwdpm",/);
});
