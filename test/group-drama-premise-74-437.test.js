// 修罗场吵不起来（她 2026-10-02：开了修罗场，她发「宝宝我爱你」，一群人在讨论语法）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
const i = app.indexOf("  const groupDramaRule = gid =>"), j = app.indexOf("  const saveGroupSettings = (", i);
assert.ok(i > 0 && j > i, "抠不出 groupDramaRule");
const seg = app.slice(i, j);

test("不再留「这轮可以不来」的口子", () => {
  assert.ok(!/"[^"\n]*不必每一轮都提，该来的时候自然会来/.test(seg));
});

test("把局面摆出来：互相是陌生人，唯一交集是她；客气只管别的话题", () => {
  assert.match(seg, /互相就是【陌生人】——你们之间唯一的交集是她/);
  assert.match(seg, /陌生人之间那份客气只管别的话题/);
  assert.match(seg, /不许几个人一起把这件事当成笑话或语法题岔过去/);
});

test("线上群聊和群线下都走这一份", () => {
  assert.match(app, /gCtx\.dramaRule = groupDramaRule\(group\.id\);/);
  assert.match(app, /const gRelRule = gsFor\(groupId\)\.drama \? groupDramaRule\(groupId\)/);
});

// 她 2026-10-02：「全都是男朋友啊」——吵成了「谁更受宠」，像早就知道彼此存在
test("前提是每个人原本都以为自己是唯一的那个，没摊开过就是此刻撞破", () => {
  assert.match(seg, /你一直以为自己是她【唯一】的那个/);
  assert.match(seg, /要是之前从没在群里摊开过，那就是【现在】/);
});
