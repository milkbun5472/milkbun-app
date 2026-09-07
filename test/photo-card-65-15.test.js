"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const comp = fs.readFileSync("js/components.js", "utf8");
const cut = (from, to) => comp.slice(comp.indexOf(from), comp.indexOf(to, comp.indexOf(from)));

// 她 2026-09-07：「群聊线上线下我发假图片，都改成一样的好看的卡吧，点开可以看到描述，
// 然后加一个可以实际保存他们发的照片到手机的功能」。
// 原来 kind:"photo" 在单聊线上／单聊线下／群聊线上／群聊线下各画各的，有图没图还各一遍。
test("照片只此一张卡、只此一个查看层（四处共用）", () => {
  assert.equal((comp.match(/function PhotoCard\(/g) || []).length, 1);
  assert.equal((comp.match(/function PhotoSheet\(/g) || []).length, 1);
  // 三个渲染点都调它（线下那一处 OffCard 同时服务单聊线下和群聊线下）
  assert.equal((comp.match(/h\(PhotoCard, \{/g) || []).length, 3, "有渲染点没接上，或者又抄了一份");
  assert.equal((comp.match(/h\(PhotoSheet, \{/g) || []).length, 3);
});

test("没有真图的那一支，四处都接住了——不再掉进通用气泡", () => {
  // 单聊线上：条件不再带 && m.imageRef
  assert.match(comp, /\/\/ 照片：有图没图都走公共那一张卡（PhotoCard）。/);
  assert.doesNotMatch(comp, /if \(m\.kind === "photo" && m\.imageRef\) \{\n      const mine = m\.role === "user";/);
  // 那个 40px 灰方块 + 「\[图片\]」的老写法在聊天里没有了
  const chat = cut("function ChatThread({", "function CallScreen(");
  assert.ok(chat.indexOf('"[图片]"') < 0, "灰方块那一支还在");
  // 线下：不再只在有图时才画卡
  assert.match(comp, /editing \? editBox : \(m\.kind === "photo"\n/);
});

test("点开都看得到描述：三处各有自己的开关，但开的是同一张", () => {
  assert.match(comp, /onOpen: selMode \? \(\) => toggleSel\(i\) : \(\) => setDescView\(m\)/);      // 单聊线上
  assert.match(comp, /onOpen: selMode \? \(\) => toggleSel\(i\) : \(\) => setGPhotoView\(m\)/);    // 群聊线上
  assert.match(comp, /onOpen: \(\) => setPhotoView\(m\)/);                                        // 线下（单聊＋群聊）
  // 群聊线上原来压根没有查看层
  assert.match(comp, /const \[gPhotoView, setGPhotoView\] = useState\(null\);/);
});

test("存到手机走公共那一条 saveImgOriginal，不另写一条下载", () => {
  // 自拍那一层也补上了（她说的「他们发的照片」就是这些）
  const selfie = cut("function SelfieBubble({ m })", "// ---- 线下这一层的纸与光");
  assert.match(selfie, /window\.saveImgOriginal\(m\.imgKey, "照片"\)/);
  // ⚠️外面那层点哪儿都关，按钮不拦住就是点了就关、存不成
  assert.match(selfie, /e\.stopPropagation\(\);/);
  // 自拍存的确实是 img_ 开头的键（照着写存档那段：app.js 的 idbImgPut）
  const app = fs.readFileSync("js/app.js", "utf8");
  assert.match(app, /const key = "img_" \+ char\.id \+ "_" \+ sid;/);
  assert.match(app, /await idbImgPut\(key, out\.blob\);/);
  // 而 saveImgOriginal 认这个前缀
  assert.match(fs.readFileSync("js/engine.js", "utf8"), /ref\.indexOf\("img_"\) === 0\) blob = await idbImgGet\(ref\)/);
  // 全库没有第二条存图路径
  assert.match(comp, /window\.saveImgOriginal\(m\.imageRef, "照片"\)/);
});

test("那张卡长得像一张相纸，不是一个灰方块", () => {
  const card = cut("function PhotoCard({ m, mine, onOpen, max })", "// 点开之后那一层");
  assert.match(card, /background: "#fdfaf4"/);                 // 相纸白边
  assert.match(card, /"点开看这张"/);
  // 没有像素的时候，相面里放的是她写的那句话——那才是这张照片的内容
  assert.match(card, /WebkitLineClamp: 3/);
  assert.match(card, /cap \|\| "一张照片"/);
});
