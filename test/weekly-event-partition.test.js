const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const weekly = fs.readFileSync(path.join(__dirname, "..", "js/weekly.js"), "utf8");

// 她 2026-08-19 报：Codex 加了几种周刊风格，但每种风格写的都是同一件事。
// 换的只是腔调，事件选择仍然是同一份素材上的 argmax。
test("批量生成必须先把事分完再动笔，同一件事只许给一个版面", () => {
  const seg = weekly.slice(weekly.indexOf("async function genMediaBatch"),
    weekly.indexOf("function claimedEvents"));
  assert.match(seg, /先分事，再写稿/);
  assert.match(seg, /\*\*同一件事只许给一个版面\*\*/);
  assert.match(seg, /宁可让某些版少写一篇.*也绝不许两个版报同一件/);
  assert.match(seg, /event/, "每篇要带不带腔调的大白话事件标签");
});

test("提示词只是要求，代码要再硬查一遍并丢掉撞车的后来者", () => {
  const seg = weekly.slice(weekly.indexOf("const rows = d && Array.isArray(d.media)"),
    weekly.indexOf("function claimedEvents"));
  assert.match(seg, /const claimed = new Set\(\);/);
  assert.match(seg, /if \(k && claimed\.has\(k\)\) return;/, "撞车的直接丢掉");
  assert.match(seg, /claimed\.add\(k\)/);
  // 归一化：换标点、换空格不算换事件
  const fn = new Function(weekly.slice(weekly.indexOf("function eventKey"),
    weekly.indexOf("\n", weekly.indexOf("function eventKey"))) + "\nreturn eventKey;")();
  assert.equal(fn("早餐做了两份吐司起了争执"), fn("早餐 做了两份吐司，起了争执！"));
  assert.notEqual(fn("吐司之争"), fn("画室夜话"));
});

test("补洞与单版重刷都要拿到已被占掉的事，否则补出来还是那件", () => {
  assert.match(weekly, /async function genMedia\(active, voice, personasBlock, material, empty, avoid\)/);
  assert.match(weekly, /function avoidBlock\(avoid\)/);
  assert.match(weekly, /这些事已经被本期别的版面报道了 · 一件都不许再写/);
  assert.match(weekly, /换个说法、换个角度、只换主角都算重复/);
  // 三个调用点：整期补洞 / 单版重刷 / 手动补版
  assert.match(weekly, /genMedia\(active, v, personasFor\(charsWithMat, userName\), globalText, empty, taken\.slice\(\)\)/);
  assert.match(weekly, /window\.Weekly\.claimedEvents\(issue\.sections, sec\.id\)/);
  assert.match(weekly, /window\.Weekly\.claimedEvents\(issue\.sections\)/);
  assert.match(weekly, /claimedEvents: claimedEvents/, "要导出给 UI 用");
});

test("翻页的那道书脊边框去掉，翻页动画保留", () => {
  assert.doesNotMatch(weekly, /weekly-page-next:after/, "inset:0 正好落在内容盒上，画成了正文外框");
  assert.doesNotMatch(weekly, /box-shadow:inset 12px 0 18px -20px/);
  assert.match(weekly, /animation:weeklyPageNext \.42s/, "翻页动画本身不动");
  assert.match(weekly, /animation:weeklyPagePrev \.42s/);
});
