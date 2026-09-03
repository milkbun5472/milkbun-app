// v61.18 她 2026-09-03：「月度印象这块首页和进去角色页面都还是很普通」。
// 判据照旧：这套形状搬到别的功能上还成立吗？成立就是做坏了。
// 月度印象在现实里是【一本按月贴的剪影相册】，所以两页都照相册内页来做：
// 深色卡纸台面 + 相纸 + 四角相角 + 手写月份；头像墙那边一个人一摞，攒得多就叠得厚。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const src = fs.readFileSync("js/impression.js", "utf8");

test("两页共用同一套相册零件，不是各画一套", () => {
  ["const plate =", "const corners =", "const pageStyle =", "const handLabel ="].forEach(k =>
    assert.ok(src.indexOf(k) >= 0, "少了零件 " + k));
  // 珍藏册和头像墙都得用 plate
  assert.equal((src.match(/plate\(\{ deg: tilt\(i\)/g) || []).length, 2, "两页都要用同一张相纸");
});

test("相角是切出来的三角形，不是转 45 度的方块", () => {
  // 方块转 45 度会从相纸外面支出去，看着是四颗黑菱形——第一版就是这么坏的
  assert.match(src, /clipPath: CLIP\[pos\]/);
  assert.match(src, /tl: "polygon\(0 0,100% 0,0 100%\)"/);
  assert.ok(src.indexOf('transform: "rotate(45deg)", pointerEvents') < 0, "又用回转方块了");
});

test("相角贴在相片里面的角上", () => {
  const i = src.indexOf("const plate = ");
  const block = src.slice(i, i + 700);
  // corners 必须在那个 overflow:hidden 的相片框【里面】渲染
  const inner = block.indexOf("overflow: \"hidden\"");
  assert.ok(inner > 0 && block.indexOf("corners(opts.corner", inner) > inner, "相角跑到相纸外面去了");
});

test("已经贴过的月份不再多摆一个空相角位，而且空位排在最后", () => {
  assert.match(src, /const emptySlot = hasThis \? null :/);
  // 相册从旧读到新，下一张该贴的位置在末尾
  const photos = src.indexOf("mine.map((e, i) => h(\"div\", { key: e.id");
  const slot = src.indexOf("emptySlot),", photos);
  assert.ok(photos > 0 && slot > photos, "空位还摆在相片前面");
});

test("叠得多厚＝攒了几个月，不是纯装饰", () => {
  assert.match(src, /const depth = Math\.min\(3, n\);/);
  // 歪的角度按序号定死，随机的话每次重画都在动
  assert.match(src, /const tilt = i =>/);
  assert.ok(src.indexOf("Math.random()") < 0 || src.indexOf("Math.random().toString(36)") >= 0,
    "别用随机角度，页面会抖");
});

test("台面一直铺到最顶上，顶栏也坐在卡纸上", () => {
  // 她 2026-09-03：「这背景没延伸到顶部啊」——原来只有正文那块是卡纸，
  // 顶栏还留在主题米白上，看着像相册上面压了一条白边。
  const i = src.indexOf("wrap: {");
  const wrap = src.slice(i, i + 320);
  assert.ok(wrap.indexOf("MOUNT") >= 0, "S.wrap 没铺台面色");
  assert.ok(wrap.indexOf("background: t.bg }") < 0, "S.wrap 又退回主题底色了");
  // 顶栏自己不许再画一条主题色分隔线，字也得是浅的（深台面上深字＝看不见）
  const j = src.indexOf("const header = ");
  const head = src.slice(j, j + 620);
  assert.ok(head.indexOf('borderBottom: "1px solid " + t.line') < 0, "顶栏还带着主题色分隔线");
  assert.ok(head.indexOf("rgba(243,236,224,.95)") >= 0, "顶栏标题不是浅色");
  // 正文那块不再自己铺一次底，免得两层叠出色差
  assert.match(src, /const pageStyle = \{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 15px 40px" \};/);
});

test("单张卡片也压相角，和珍藏册是同一本册子里的东西", () => {
  assert.match(src, /corners\(22\),/);
});
