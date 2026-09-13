// 月度印象第二刀（她 2026-09-13 定的 B 方案）：第一刀加的那三格只写进了存档，
// 卡面上看不见。这一刀把它们放到【相纸背面】——相片背面本来就是写字的地方。
//
// 为什么不是正面多三段：正面回答的是「她是什么样」，背面回答的是「这个月你俩之间」。
// 挤在一面就又变成一张卡说同一件事，那正是这次要治的病。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const imp = fs.readFileSync(path.join(root, "js/impression.js"), "utf8");
// 单张卡片那一段
const card = imp.slice(imp.indexOf("// ---- 单张卡片 ----"), imp.indexOf("// ---- 某个角色的珍藏册"));

test("点一下整张相纸翻过去，是翻不是淡入淡出", () => {
  assert.match(card, /perspective: 1400/);
  assert.match(card, /transformStyle: "preserve-3d"/);
  assert.match(card, /transform: "rotate\(-\.5deg\)" \+ \(flipped \? " rotateY\(180deg\)" : ""\)/);
  assert.match(card, /onClick: \(\) => setFlipId\(flipped \? null : e\.id\)/);
  // 两面都得挡住自己的背面，否则翻过去会看见反字
  assert.equal((card.match(/backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden"/g) || []).length, 2);
  assert.match(card, /transform: "rotateY\(180deg\) translateZ\(1px\)"/, "背面自己要先转过去");
  assert.match(card, /WebkitTransformStyle: "preserve-3d"/, "老 Safari 不带前缀压根不进 3D 上下文");
});

// 她 2026-09-13 截图：翻过去看到的是【正面的镜像】——iOS 上 backface-visibility 失灵了。
test("翻过去看见的必须是背面，不能押在 backface-visibility 一个属性上", () => {
  // 兜底一：两面各自 visibility 显式切，延迟半个动画时长（翻到侧面那一刻）才换人
  assert.match(card, /visibility: flipped \? "visible" : "hidden", transition: "visibility 0s linear \.21s"/, "背面");
  assert.match(card, /visibility: flipped \? "hidden" : "visible", transition: "visibility 0s linear \.21s"/, "正面");
  // 兜底二：两面各占一个 Z，前后顺序才不靠 DOM 次序撞运气
  assert.match(card, /transform: "rotateY\(180deg\) translateZ\(1px\)"/);
  assert.match(card, /transform: "translateZ\(1px\)",/);
});

// 她 2026-09-13：「补写按钮点不了」。backface-visibility 只管看不看得见，
// 不保证点不点得着——iOS 里压在上面那一面转到背后照样吃点击。
test("翻到哪一面，哪一面才吃点击", () => {
  assert.match(card, /pointerEvents: flipped \? "auto" : "none",/, "背面：没翻过来时不许吃点击");
  assert.match(card, /pointerEvents: flipped \? "none" : "auto",/, "正面：翻过去之后就别再挡着了");
});

test("翻的是【哪一张】，不是一个裸 boolean", () => {
  // 按卡 id 记：换一张卡自动回到正面，不然点开下一张会莫名其妙先看见背面
  assert.match(imp, /const \[flipId, setFlipId\] = useState\(null\);/);
  assert.match(card, /const flipped = flipId === e\.id;/);
});

test("背面三段：第一张写「在这之前」，之后写「变了哪儿」", () => {
  assert.match(card, /\[e\.firstShift \? "在这之前" : "变了哪儿", e\.shift\]/);
  assert.match(card, /\["那天", e\.moment\]/);
  assert.match(card, /\["他自己", e\.him\]/);
  // 空的那段不占位（有的月份他就是没话说）
  assert.match(card, /\.filter\(x => String\(x\[1\] \|\| ""\)\.trim\(\)\)/);
});

test("正面下沿那行小字不再是纯装饰，它就是翻面的入口", () => {
  assert.match(card, /hasBack \? \(e\.firstShift \? "在这之前 →" : "印象变了哪儿 →"\) : "背面还空着 →"/);
  assert.ok(!/} }, "印象变了哪儿"\)/.test(imp), "老那行写死的装饰字还在");
});

test("老卡能只补背面：正面和剪影一个字不动，也不另开一条提示词", () => {
  assert.match(imp, /async function writeBack\(charId, entry\)/);
  const seg = imp.slice(imp.indexOf("async function writeBack"), imp.indexOf("// 补齐：最近 12 个月"));
  // 还是走 genText 那一枪，只把三格取回来
  assert.match(seg, /M\.genText\(props\.active, char, props\.profile, entry\.monthKey, rows, gazeText,/);
  assert.match(seg, /\{ moment: d\.moment, shift: d\.shift, him: d\.him, firstShift: d\.firstShift \}/);
  assert.ok(!/M\.genArt/.test(seg), "补三行字不许顺带把剪影重刷一次（出图贵）");
  assert.ok(!/title: d\.title/.test(seg), "正面不许被动");
  // turn 原样带回去：这不是"换个写法"，别把骰子转到下一面
  assert.match(seg, /M\.genOpts\(bookRef\.current, charId, entry\.monthKey, Number\(entry\.turn \|\| 0\)\)/);
  // v67.91：这个按钮不许长在【翻过去的那一面】上。跟 iOS 的 3D 命中测试较劲了两版
  // （她两次都点不着），而它本来就和「只重写文案」「只重出剪影」同族——都是
  // "只重来其中一块"——那就该待在正面那一排：不翻面也点得着。
  assert.match(card, /h\("button", \{ onClick: \(\) => writeBack\(curChar, e\), disabled: !!busy, style: S\.btn\(false\) \},\s*\n\s*busy \? "在写…" : \(hasBack \? "重写背面" : "补写背面"\)\)/);
  assert.ok(!/stopPropagation\(\); writeBack/.test(card), "按钮还在背面上");
  assert.match(card, /"这张是早先贴的，背面还空着。"/);
  assert.match(card, /"翻回正面，点下面那个「补写背面」。"/, "背面空着时要说清去哪儿补");
  // 有背面的卡也要能重写——不然写坏了一次就钉死了
  assert.match(card, /hasBack \? "重写背面" : "补写背面"/);
});
