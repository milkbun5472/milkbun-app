// 她 2026-10-02 转群友：首页提示有新帖但进去没引导；加删楼
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const scr = fs.readFileSync(path.join(__dirname, "..", "js/screens.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
test("角色新帖跨吧列在首页最上面", () => {
  assert.match(scr, /const forumNewCharPosts = \(posts \|\| \[\]\)\.filter\(p => forumVisible\(p\) && (?:\(p\.fmt === "xhs"\) === cardLayout && )?String\(p\.authorType \|\| ""\)\.startsWith\("character"\)/);
  assert.match(scr, /forumNewCharPosts\.length > 0 && h\(/);
});
test("每一楼都能删，删前问一句", () => {
  assert.match(scr, /onDeleteFloor && cm\.id && h\("button"/);
  assert.match(scr, /requestAppConfirm\("删掉这一楼"/);
  assert.match(app, /const deleteForumFloor = \(postId, floorId\) =>/);
  assert.match(app, /onDeleteFloor: deleteForumFloor,/);
});
