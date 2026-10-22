// 群里 2026-10-22 许愿：朋友圈一次多发几张图（最多 9 张），九宫格显示，点开左右翻
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const c = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
const a = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
assert.match(c, /function MomentGrid\(\{ refs \}\)/);
assert.equal((c.match(/Array\.isArray\(m\.images\) && m\.images\.length > 1 \? h\(MomentGrid, \{ refs: m\.images \}\)/g) || []).length, 2, "动态流和个人页都走同一个九宫格");
assert.match(c, /type: "file", accept: "image\/\*", multiple: true/);
assert.match(c, /images: realPics\.length > 1 \? realPics : null/);
assert.match(a, /const pics = Array\.isArray\(images\) \? \(await Promise\.all\(images\.slice\(0, 9\)\.map\(toRef\)\)\)/, "每张先进图片保险箱");
assert.match(a, /\.\.\.\(pics\.length > 1 \? \{ images: pics \} : \{\}\)/);
assert.match(a, /if \(mo && Array\.isArray\(mo\.images\)\) for/, "开机搬图也搬多图");
assert.equal((a.match(/"（配了 " \+ mom\.images\.length \+ " 张图片）"/g) || []).length, 2, "评论的人知道配了几张");
console.log("ok");
{
  const ts = require("fs").readFileSync(require("path").join(__dirname, "../js/theme-studio.js"), "utf8");
  require("node:assert/strict").match(ts, /\["mophotogrid", "/);
  require("node:assert/strict").match(ts, /\["mocomposepics", "/);
}
