const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
// 群里 2026-11-08 截图：连发两张照片，其中一张是两个人的合照，他当成情头换上了
test("情头：说清一对里每张只有一个人，合照不算；并排切也一样", () => {
  assert.match(app, /一对头像里【每一张只有一个人（或一只）】/);
  assert.match(app, /切开以后每一半里只该有一个人（或一只）/);
});
