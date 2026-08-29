const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");

test("相册是图库、精选集、收藏夹三页完整界面", () => {
  assert.match(phone, /\["library", "图库"\]/);
  assert.match(phone, /\["collections", "精选集"\]/);
  assert.match(phone, /\["saved", "收藏夹"\]/);
  assert.match(phone, /function AlbumNavIcon/);
  assert.match(phone, /appKey !== "wechat" && appKey !== "album"/);
});

test("精选集固定五类且二十五张时每类机械保底四张", () => {
  assert.match(phone, /回忆/);
  assert.match(phone, /个人收藏/);
  assert.match(phone, /最近保存/);
  assert.match(phone, /私密/);
  assert.match(phone, /最近删除/);
  assert.match(phone, /items\.length >= 20/);
  assert.match(phone, /buckets\[a\.key\]\.length < 4/);
  assert.match(phone, /正好 25 张互不重复的照片/);
  assert.match(phone, /memory或favorite或saved或private或deleted/);
  assert.match(phone, /scrollSnapType: "x mandatory"/);
  assert.match(phone, /回忆与四本相簿/);
});

test("图库按真实年月分组且禁止相对星期日期", () => {
  assert.match(phone, /m\[1\] \+ "年" \+ Number\(m\[2\]\) \+ "月"/);
  assert.match(phone, /date 必须写真实完整日期 YYYY-MM-DD HH:mm/);
  assert.match(phone, /禁止写周三、周五、昨天、最近等相对日期/);
});

test("相册底栏沿用聊天输入栏的四成安全区，不再垫高一截", () => {
  assert.match(phone, /padding: "5px 20px calc\(env\(safe-area-inset-bottom\) \* 0\.4 \+ 4px\)"/);
  assert.doesNotMatch(phone, /padding: "7px 20px calc\(env\(safe-area-inset-bottom\) \+ 7px\)"/);
});

test("照片详情返回恢复进入前的滚动位置", () => {
  assert.match(phone, /returnScroll\.current = \{ top: scrollRef\.current \? scrollRef\.current\.scrollTop : 0/);
  assert.match(phone, /scrollRef\.current\.scrollTop = top/);
  assert.match(phone, /chrome\("照片", photo\.date \|\| photo\.time \|\| "日期未记", closePhoto\)/);
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
