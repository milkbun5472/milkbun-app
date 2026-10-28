const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const ui = fs.readFileSync("js/screens-ui.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8");
test("小红书「我」多一栏评论：楼和楼中楼都认我自己写的", () => {
  assert.match(ui, /\["liked", "赞过"\], \["cmts", "评论"\]/);
  assert.match(ui, /if \(f\.authorType === "me" && mineAs\(f\)\) acc\.push/);
  assert.match(ui, /if \(r && r\.authorType === "me" && mineAs\(r\)\) acc\.push/);
  assert.match(ui, /"data-wk": "foxhsmycmt", onClick: \(\) => openAtFloor\(x\)/);
  // 写入方：楼和楼中楼都打 authorType: "me"
  assert.match(app, /const floor = \{ id: fid, authorId: "me", authorType: "me"/);
  assert.match(app, /authorType: "me", authorId: "me", content: text, toName: to, ts: Date\.now\(\) \}\] \}/);
  assert.match(ui, /document\.getElementById\("forum-floor-" \+ x\.fid\)/);
  assert.match(ui, /id: "forum-floor-" \+ \(cm\.id \|\| i\)/);
});
