const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const grab = (src, a, b, why) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, "抠不出：" + why); return src.slice(i, j); };

// 她 2026-08-30：「A 也做了吧宝宝」——一本本子该能一页一页翻
const flipSrc = grab(scr, '  if (view === "entry" && curEntry) {', "\n  // ---- 单人档案卡", "翻页那一段");

test("翻的是纸，不是滑卡片：绕装订那条边转，底下露出下一页", () => {
  assert.match(flipSrc, /perspective: 1500/, "没有透视，rotateY 会看起来像压扁");
  assert.match(flipSrc, /rotateY\(-104deg\)/, "往前翻不是绕轴转");
  assert.match(flipSrc, /rotateY\(104deg\)/, "往回翻不是绕轴转");
  assert.match(flipSrc, /transformOrigin: flip && flip\.dir === "back" \? "right center" : "left center"/,
    "两个方向都绕同一条边转，看起来会是错的");
  // 翻的时候底下必须真的是【目标那一页】，不然翻过去才换内容＝闪一下
  assert.match(flipSrc, /const under = flip \? all\.find\(x => x\.id === flip\.to\) : null/);
  assert.match(flipSrc, /under \? page\(under, \{ zIndex: 1 \}\) : null/, "底下没垫目标那一页");
  assert.ok(!/translateX/.test(flipSrc), "又改回平移了——那是卡片轮播，不是翻纸");
});

test("左滑翻到更新的一天，右滑翻回更早的一天，到头就不动", () => {
  // 列表是新→旧：at-1 是更近的一天，at+1 是更早的一天。
  // 手指从右往左划＝往后翻＝翻到【更新的】那天（照读书的方向，她 2026-08-30 纠正过一次）
  assert.match(flipSrc, /const newerE = all\[at - 1\] \|\| null;/);
  assert.match(flipSrc, /const olderE = all\[at \+ 1\] \|\| null;/);
  assert.match(flipSrc, /if \(dx < 0\) goTo\(newerE, "fwd"\); else goTo\(olderE, "back"\);/, "左滑翻的方向又反了");
  assert.match(flipSrc, /if \(!target \|\| flip\) return;/, "到头还翻、或者翻的过程中还能再翻一次");
  // 竖着划不许翻页（正文本来就要上下滚）
  assert.match(flipSrc, /Math\.abs\(dx\) < Math\.abs\(dy\) \* 1\.4/, "没有方向锁，上下滚会误翻页");
  assert.match(flipSrc, /Math\.abs\(dx\) < 56/, "阈值太松，手指抖一下就翻页");
});

// 她 2026-08-30：「为啥阿屿这块直接把查手机的东西原样照搬进来了」
test("摆到他面前的那张卡：只留【发生了什么】，商品文案不进日记素材", () => {
  const i = app.indexOf("const trimPeek = txt =>");
  assert.ok(i > 0, "没有把那张卡压过一遍");
  const trimPeek = new Function(app.slice(i, app.indexOf("const dayChatText", i)) + "\nreturn trimPeek;")();
  const card = "[我翻了你的手机]在你的〈想买清单〉里看到了：《裹满厚厚抹茶粉和冰凉软糯拉丝的手作草莓大福生乳卷》｜某人坐在沙发上鼓着腮帮子跟我翻旧账、必须立刻物理堵嘴的时候。";
  const out = trimPeek(card);
  assert.ok(out.indexOf("鼓着腮帮子") < 0, "卡片里那句 why 还在，模型就会连括号一起抄进日记");
  assert.ok(out.indexOf("生乳卷") < 0, "商品全名还在");
  assert.match(out, /她翻了我的手机/, "把「发生了什么」也一起删掉了——那件事本身是真发生过的");
  assert.ok(out.length < 40, "压完还是太长：" + out);
  // 随身物那张卡共用同一个形状
  assert.match(trimPeek("[我翻了你的包]在你的〈随身物〉里看到了：《一把折了骨的黑伞》｜下雨那天她硬塞给我的。"), /她翻了我的包/);
  // 普通聊天一个字都不许动
  const plain = "今天下午去实验室了，师兄说数据还是不对。";
  assert.equal(trimPeek(plain), plain);
  assert.equal(trimPeek(""), "");
});

test("提示词也说一遍：方括号那几条是卡片，不是谁写的字", () => {
  assert.match(eng, /素材里方括号开头的那几条是 App 的卡片，不是谁写的字/, "没立这条规矩");
  assert.match(eng, /商品名、平台文案、卡片里的原句，一个字都不许照抄进来/);
  assert.match(eng, /你的日记里不该出现一件商品的全名/, "没给一句好检查的判据");
});
