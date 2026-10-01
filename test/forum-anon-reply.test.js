const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("匿名吧里我开楼、回楼中楼都用「匿名者」，不亮大号", () => {
  assert.ok(app.includes('const myForumName = post => (post && (post.board === "匿名吧" || post.anon)) ? "匿名者"'));
  assert.strictEqual((app.match(/authorName: myForumName\(post\)/g) || []).length, 2);
});
