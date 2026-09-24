// 合照每张都是同一种姿势（她 2026-09-24）：机位表是给一个人自拍写的，
// 两个人之间什么样子从没被掷过。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js/engine.js"), "utf8");

test("合照另掷一条两人姿势，不跟单人机位共用", () => {
  const i = eng.indexOf("const PHOTO_DUO_POSES = ["), j = eng.indexOf("function photoDuoPoseLine(", i);
  assert.ok(i > 0 && j > i, "抠不出 PHOTO_DUO_POSES");
  const n = (eng.slice(i, j).match(/^\s+"/gm) || []).length;
  assert.ok(n >= 8, "姿势太少，掷了也跟没掷一样：" + n);
});

test("只在两人合照上掷；多人合影和小剧场不掷", () => {
  assert.match(eng, /if \(kind === "duo" && !multi && !opts\.cinematic\) parts\.push\(photoDuoPoseLine\(/);
});

test("连着两张不许掷到同一格", () => {
  const i = eng.indexOf("function photoDuoPoseLine("), j = eng.indexOf("function photoShotLine(", i);
  assert.ok(i > 0 && j > i);
  assert.match(eng.slice(i, j), /if \(idx === buildPhotoPrompt\._lastDuoPose\)/);
});

// 她 2026-09-24：「如果我说让他特定姿势或者我俩特定姿势，能 override 这个轴吗」——能，而且必须能。
test("点名了姿势就照点名的来，轴让路", () => {
  const i = eng.indexOf("function photoDuoPoseLine("), j = eng.indexOf("function photoShotLine(", i);
  const seg = eng.slice(i, j);
  assert.match(seg, /「场景\/正在做什么」那一句已经写明了两个人怎么站/, "合照姿势那格没让路");
  assert.ok(!/"[^"\n]*别又回到/.test(seg), "那句会跟她要的贴脸对着干");
  assert.match(eng, /「场景\/正在做什么」那一句已经点名了机位或姿势的，照那一句来/, "机位那格没让路");
  assert.ok(eng.indexOf('parts.push("场景/正在做什么：') < eng.indexOf("parts.push(photoShotLine(kind"), "场景那句得排在两格前面，「上面那一句」才说得通");
});

test("合照那段不再自带一张以贴脸打头的姿势菜单", () => {
  assert.ok(!/"姿势自然亲密：/.test(eng));
});
