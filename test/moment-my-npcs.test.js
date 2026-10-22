const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("她自己身边的配角也来她的朋友圈，按她俩的关系说话", () => {
  assert.match(app, /const canSee = \[\.\.\.canSeeMain, \.\.\.npcCrowd\(canSeeMain, 3\), \.\.\.myNpcCrowd\(2\)\];/);
  assert.match(app, /concat\(npcCrowd\(canSee, 4\), myNpcCrowd\(2\)\)/);
  assert.match(app, /const pool = \(npcsOf\("me"\) \|\| \[\]\)/);
  assert.match(app, /String\(c\.ownerId\) === "me"\n\s*\? "（我自己生活里的人"/);
});
