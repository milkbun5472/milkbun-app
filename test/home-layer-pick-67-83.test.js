// 她 2026-09-13：「那这个怎么决定叠一块的哪个在上面呢」→「直接手动吧」。
//
// v67.82 之前没有任何规矩：谁排在后面谁盖住谁，纯粹是摆放顺序的副产品。
// 而只有【歪过的】那几张会伸出格子——它伸出来的角要是被旁边一张方卡压住，
// 看着就像角又被削了一次（这回不是裁剪，是被邻居盖了）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

// 真跑那两个小函数
const mk = () => {
  const i = comp.indexOf("const HOME_DECOR_LAYERS = [");
  const j = comp.indexOf("function normalizeHomeDecorTilt(value) {");
  assert.ok(i > 0 && j > i, "抠不出层那一份");
  return new Function(comp.slice(i, j) + "\nreturn { HOME_DECOR_LAYERS, normalizeHomeLayer, homeLayerZ };")();
};

test("三档：垫在下面 / 跟着顺序 / 压在上面", () => {
  const K = mk();
  assert.deepEqual(K.HOME_DECOR_LAYERS.map(x => x.id), ["under", "auto", "over"]);
  assert.deepEqual(K.HOME_DECOR_LAYERS.map(x => x.name), ["垫在下面", "跟着顺序", "压在上面"]);
  // 认不出来的一律当「跟着顺序」——老存档里压根没有这一栏
  [undefined, null, "", "top", 3, {}].forEach(v => assert.equal(K.normalizeHomeLayer(v), "auto"));
});

test("「跟着顺序」也要有一个真的层，不然「垫在下面」是句空话", () => {
  const K = mk();
  // under 0 < auto 1 < over 3：平级之间照旧按出场顺序叠，所以 auto 不能也是 0
  assert.equal(K.homeLayerZ("under", false), 0);
  assert.equal(K.homeLayerZ("auto", false), 1);
  assert.equal(K.homeLayerZ("over", false), 3);
  assert.ok(K.homeLayerZ("under", false) < K.homeLayerZ("auto", false));
  assert.ok(K.homeLayerZ("auto", false) < K.homeLayerZ("over", false));
  // 拖着的那张永远最上面，跟这三档无关
  ["under", "auto", "over", "乱填"].forEach(v => assert.equal(K.homeLayerZ(v, true), 5));
});

test("组件和装饰走同一条：存哪儿不一样，画法只有一份", () => {
  // 画：格子上那个 zIndex
  assert.match(comp, /var layerId = normalizeHomeLayer\(look && look\.layer\);/);
  assert.match(comp, /zIndex: homeLayerZ\(layerId, isDrag\),/);
  assert.ok(!/zIndex: isDrag \? 5 : "auto"/.test(comp), "老的那行还在，两处各算各的");
  // 存：装饰在自己那条记录里，组件在 x_homeWidgetLooks 里
  assert.match(comp, /layer: normalizeHomeLayer\(A\.layer\), createdAt: Date\.now\(\)/, "装饰放上桌面时把这一栏丢了");
  assert.match(comp, /layer: normalizeHomeLayer\(L\.layer\), setLayer: function \(v\) \{ setWidgetLook\(key, \{ layer: v \}\); \}/);
  // 重改旧装饰时要读回它自己的层，不是每次跳回默认（跟倾斜同一个毛病）
  assert.match(comp, /setStyleDecorLayer\(normalizeHomeLayer\(d\.layer\)\);/);
});

test("界面：紧挨着「摆放角度」，而且说清楚「跟着顺序」是什么意思", () => {
  assert.match(comp, /"叠起来时"/);
  assert.match(comp, /choiceRow\(HOME_DECOR_LAYERS, normalizeHomeLayer\(layer\), onLayer\)/);
  assert.match(comp, /「跟着顺序」＝按摆放的先后（后摆的压前面的）/);
  // 没给 onLayer 的调用方不该凭空多出一行（这一格是可选的）
  assert.match(comp, /onLayer \? h\("div", null,/);
  // 接线：编辑器那一处真的收到了
  assert.match(comp, /tilt: A\.tilt, layer: A\.layer,/);
  assert.match(comp, /onTilt: A\.setTilt, onLayer: A\.setLayer/);
});
