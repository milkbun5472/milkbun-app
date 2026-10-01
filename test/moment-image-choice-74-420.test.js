// 朋友圈配图（群里读者 2026-10-02）：①是不是默认每条都带图——让 char 自己选；②带图的怎么都带人脸。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
const i = app.indexOf("  const genMoment = async char => {"), j = app.indexOf("  const momentGenImage = async (", i);
assert.ok(i > 0 && j > i, "抠不出 genMoment");
const seg = app.slice(i, j);

test("配不配图交给TA：不再替TA掷一半概率，只摆出TA自己的习惯", () => {
  assert.ok(!/"[^"\n]*大约一半概率配一张图/.test(seg), "又替TA掷答案了");
  assert.match(seg, /配不配图你自己定/);
  assert.match(seg, /const _momImgHabit = _ownMoms\.length >= 3/);
  assert.ok(seg.indexOf("const _momImgHabit") < seg.indexOf("instruction:"), "习惯那句在用之前没定义（TDZ）");
});

test("TA自己说画面里有没有人，画图照TA说的来", () => {
  assert.match(seg, /\\"imageWho\\":\\"none｜part｜self\\"/);
  assert.match(seg, /\.\.\.\(newMomImage && newMomWho \? \{ imageWho: newMomWho \} : \{\}\)/);
  assert.match(app, /const kind = whoSaid === "none" \? "view" : whoSaid === "part" \? "part" : whoSaid === "self" \? "" : noFaceKindFor\(desc, who\.name\);/);
  assert.match(app, /const ref = await drawFromDesc\(char, desc, mom\.imageWho\);/);
});

// 她 2026-10-02：「配不配图他自己定，这个不就是相当于让他发吗」——模型拿到可填的格子几乎都会填。
test("有没有配图的机会由代码掷；没掷中这一条连格子都不给，硬填也不作数", () => {
  assert.match(seg, /const MOMENT_IMG_CHANCE = 0\.5;\n\s*const _momImgOpen = Math\.random\(\) < MOMENT_IMG_CHANCE;/);
  assert.match(seg, /_momImgOpen \? "\*\*配不配图你自己定\*\*/);
  assert.match(seg, /: "这一条只发文字，不配图，image 填 null。"\)/);
  assert.match(seg, /schemaHint: _momImgOpen\n/);
  assert.match(seg, /const newMomImage = _momImgOpen && d\.image/);
  assert.ok(seg.indexOf("const _momImgOpen") < seg.indexOf("instruction:"), "掷在用之后了（TDZ）");
});
