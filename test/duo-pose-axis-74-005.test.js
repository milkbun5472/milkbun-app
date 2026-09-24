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
