const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");

test("相册是图库、精选集、收藏夹三页完整界面", () => {
  assert.match(phone, /\["library", "▦", "图库"\]/);
  assert.match(phone, /\["collections", "▣", "精选集"\]/);
  assert.match(phone, /\["saved", "♡", "收藏夹"\]/);
  assert.match(phone, /appKey !== "wechat" && appKey !== "album"/);
});

test("精选集固定四类且二十张时每类机械保底四张", () => {
  assert.match(phone, /个人收藏/);
  assert.match(phone, /最近保存/);
  assert.match(phone, /私密/);
  assert.match(phone, /最近删除/);
  assert.match(phone, /items\.length >= 16/);
  assert.match(phone, /buckets\[a\.key\]\.length < 4/);
  assert.match(phone, /正好 20 张互不重复的照片/);
});

test("照片详情含日期、画面介绍、单独想法框和收藏按钮", () => {
  assert.match(phone, /photo\.date \|\| photo\.time/);
  assert.match(phone, /photo\.desc \|\| "没有留下介绍。"/);
  assert.match(phone, /对这张照片的想法/);
  assert.match(phone, /photo\.thought/);
  assert.match(phone, /onClick: \(\) => toggle\(photo\)/);
});

test("收藏独立持久化且缩略图零 API 程序化渲染", () => {
  assert.match(phone, /loadJSON\("x_phoneKeep", \{\}\)/);
  assert.match(phone, /saveJSON\("x_phoneKeep", n\)/);
  assert.match(phone, /phoneStableHash\(\(it\.caption/);
  assert.match(phone, /linear-gradient/);
});
