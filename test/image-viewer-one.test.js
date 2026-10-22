// 看大图全库只有一份（她 2026-10-16「搞公共的吧」）：原来九处各写各的，背景、关法、按钮各不一样，
//   只有小窝能翻页、哪儿都不能手指划。这一份钉住：ImageViewer 只定义一次，九处都在用它，旧的那几套不许回来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const files = ["js/components.js", "js/theater.js", "js/trpg.js", "js/shike.js", "js/fairy-garden.js", "js/dwell.js", "js/nest.js"];

test("ImageViewer 全库只定义一次，在 components.js", () => {
  const all = fs.readdirSync(path.resolve(__dirname, "../js")).filter(f => f.endsWith(".js")).map(f => R("js/" + f)).join("\n");
  assert.equal((all.match(/function ImageViewer\(/g) || []).length, 1);
  assert.match(R("js/components.js"), /function ImageViewer\(\{ items, at, onClose, actions, zoomable \}\)/);
});

test("十处都走它：小剧场、跑团两处、聊天照片、通话照片、朋友圈多图、时刻、小世界相框、去处、小窝", () => {
  const n = f => (R(f).match(/h\(ImageViewer, ?\{/g) || []).length;
  assert.equal(n("js/theater.js"), 1, "小剧场");
  assert.equal(n("js/trpg.js"), 2, "跑团两处");
  assert.equal(n("js/components.js"), 3, "聊天照片、通话照片、朋友圈多图（v76.243 九宫格点开）");
  assert.equal(n("js/shike.js"), 1, "时刻");
  assert.equal(n("js/fairy-garden.js"), 1, "小世界相框");
  assert.equal(n("js/dwell.js"), 1, "去处");
  assert.equal(n("js/nest.js"), 1, "小窝");
});

test("旧的那几套不许回来：各自的挂点和整屏黑底都没了", () => {
  const src = files.map(R).join("\n");
  for (const k of ["thrviewer", "trpgviewer", "shikebig\"", "nestshotbig", "data-frame-big", "dwellpagetap"]) assert.ok(src.indexOf(k) < 0, "还留着 " + k);
});

test("它自己能做的：好几张能划、有 ‹ ›、点黑底关、按钮拦住冒泡、挂在 body 上最高层", () => {
  const c = R("js/components.js"), i = c.indexOf("function ImageViewer("), seg = c.slice(i, c.indexOf("function requestAppConfirm(", i));
  assert.match(seg, /onTouchStart/); assert.match(seg, /Math\.abs\(dx\) > 45/);
  assert.match(seg, /"上一张"/); assert.match(seg, /"下一张"/);
  assert.match(seg, /onClick: onClose/);
  assert.match(seg, /onClick: e => \{ stop\(e\); b\.onClick && b\.onClick\(cur, i\); \}/, "按钮不拦冒泡，点了就关");
  assert.match(seg, /ReactDOM\.createPortal\(/); assert.match(seg, /zIndex: 2147483000/);
});

test("小窝预览图：都能存到手机；人设的还能当头像导入（跟手动导入同一条路，只多带一张头像）", () => {
  const nest = R("js/nest.js"), seg = nest.slice(nest.indexOf("function Shots("), nest.indexOf("function Guestbook("));
  assert.match(seg, /window\.saveImgOriginal\(item\.src/);
  assert.match(seg, /it\.kind === "persona" \? \{ label: "用这张当头像，导入这个人设"/);
  assert.match(seg, /importInto\(d\.kind, d\.payload, d\.title, props, \{ avatarImage: key \}\)/);
  assert.match(nest, /opts && opts\.avatarImage \? \{ avatarImage: opts\.avatarImage \} : \{\}/);
  assert.match(R("js/engine.js"), /else if \(typeof ref === "string" && \/\^\(https\?:\|blob:\)\/\.test\(ref\)\)/, "saveImgOriginal 还不认网址");
});
