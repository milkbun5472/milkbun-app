// 抠图起名、他知道是自己的脸、贴的能自己写（她 2026-10-13）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
test("抠出来那张可以起名，名字就是他发表情用的词", () => {
  assert.match(comp, /window\.__addSelfSticker\(url, charId, cutName\)/);
  assert.match(app, /keyword: String\(name \|\| ""\)\.trim\(\)\.slice\(0, 20\) \|\|/);
});
test("他知道那一套是从自己照片上抠的", () => {
  assert.match(app, /pk\.fromCharFace === charId \? "（这一套是她从你自己的照片上抠下来的，表情里那个人就是你）"/);
});
test("贴的能自己写：数字当分数", () => {
  assert.match(comp, /setStamp\(\/\^\\d\+\(\\\.\\d\+\)\?\$\/\.test\(k\) \? k \+ "分" : k\)/);
});
test("抠的时候画的、贴的字一起带上；能在图上写一行字，不被套索裁掉", () => {
  assert.match(comp, /marks\.current = ownMarks\(\); paint\(\);\n    x\.drawImage\(cv\.current, 0, 0\); x\.restore\(\);/);
  assert.match(comp, /const cap = String\(cutCap \|\| ""\)\.trim\(\)/);
  assert.match(comp, /"data-wk": "doodlecutcap"/);
});
test("贴的字黑字白边", () => {
  assert.match(comp, /x\.lineWidth = st\.size \/ 7; x\.strokeStyle = "#fff"; x\.strokeText/);
});
