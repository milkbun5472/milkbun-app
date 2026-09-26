// 一起看接 B 站 / YouTube（她 2026-09-26：「做一个b站和youtube的吧宝宝放进一起看」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm");
const src = fs.readFileSync(__dirname + "/../js/watch.js", "utf8");

const i = src.indexOf("function parseOnlineLink("), j = src.indexOf("let ytReady = null;", i);
assert.ok(i > 0 && j > i, "抠不出链接解析那两件");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(src.slice(i, j) + ";this.parse=parseOnlineLink;this.biliSrc=biliSrc;", ctx);

test("YouTube 各种链接都认得，带 t= 的记住起点", () => {
  for (const u of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?t=42", "https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ"]) {
    const r = ctx.parse(u);
    assert.equal(r.source, "youtube", u); assert.equal(r.vid, "dQw4w9WgXcQ", u);
  }
  assert.equal(ctx.parse("https://youtu.be/dQw4w9WgXcQ?t=42").start, 42);
});

test("B 站 BV / av / 分 P 都认得，短链明说认不出", () => {
  const r = ctx.parse("https://www.bilibili.com/video/BV1xx411c7mD?p=3&spm_id_from=333");
  assert.equal(r.source, "bilibili"); assert.equal(r.vid, "BV1xx411c7mD"); assert.equal(r.page, 3);
  assert.equal(ctx.parse("https://m.bilibili.com/video/av170001").vid, "av170001");
  assert.equal(ctx.parse("【标题】 https://b23.tv/abc123").short, true);
  assert.equal(ctx.parse("随便一句话"), null);
});

test("B 站播放器地址：av 走 aid，BV 走 bvid，不自动播，续看带起点", () => {
  assert.match(ctx.biliSrc({ vid: "BV1xx411c7mD", page: 2 }, 0), /bvid=BV1xx411c7mD&page=2&autoplay=0/);
  assert.match(ctx.biliSrc({ vid: "av170001" }, 125), /aid=170001&.*&t=125$/);
});

test("放映页：B 站那块表只改我们的表，不重载她那边的播放器", () => {
  assert.match(src, /const \[biliUrl\] = useState\(\(\) => film && film\.source === "bilibili" \? biliSrc\(film, film\.pos \|\| 0\) : ""\);/);
  assert.match(src, /h\("iframe", \{ src: biliUrl,/);
  assert.match(src, /online \? null : btn\("给 TA 看这一帧"/, "网上的片子截不了画面，这颗按钮不该出现");
});
