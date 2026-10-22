const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("她自己身边的配角也来她的朋友圈，按她俩的关系说话", () => {
  assert.match(app, /const canSee = \[\.\.\.canSeeMain, \.\.\.npcCrowd\(canSeeMain, 3\), \.\.\.myNpcCrowd\(2\)\];/);
  assert.match(app, /concat\(npcCrowd\(canSee, 4\), myNpcCrowd\(2\)\)/);
  assert.match(app, /const pool = \(npcsOf\("me"\) \|\| \[\]\)/);
  assert.match(app, /String\(c\.ownerId\) === "me"\n\s*\? "（我自己生活里的人"/);
});

test("她身边的配角在别处也能跟她互动：片刻评论她的视频、角色朋友圈里认识发帖人的、论坛自己发帖、拉群排前面", () => {
  const sh = fs.readFileSync(__dirname + "/../js/shua.js", "utf8"), comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  assert.match(sh, /const myNpcs = maskUse \? \[\] : arr\(props\.myNpcs\)\.filter\(Boolean\);/);
  assert.match(app, /myNpcs: npcsOf\("me"\),/);
  assert.match(app, /const myKnow = npcsOf\("me"\)\.filter\(n => rels\[n\.id \+ "->" \+ author\.id\]/);
  assert.match(app, /genW === "" \? npcsOf\("me"\)\.map\(n => \(\{ n, host: \{ id: "me"/);
  assert.match(comp, /_imIn && String\(c\.ownerId\) === "me"/);
});
