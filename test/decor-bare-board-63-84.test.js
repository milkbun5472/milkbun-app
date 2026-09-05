// 她 2026-09-05 两条：
//   ①「这个无框还是不能和背景融合还是有底色」
//   ②「还有拍立得斜一点就显示不全了」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const cut = (from, to) => comp.slice(comp.indexOf(from), comp.indexOf(to, comp.indexOf(from)));
// unBoard 是组件里的闭包，连着 bareBoard 一起抠出来在沙箱里真跑
const mk = (preset, gnd) => {
  const src = cut('  const bareBoard = (preset === "bare" && !gnd);', "  const gShadow");
  const ctx = { preset: preset, gnd: gnd, Object: Object, String: String };
  vm.createContext(ctx);
  vm.runInContext("var " + src.trim().replace(/^const /, "").replace(/\n  const /g, ";\n  var ") + "\nthis.f = unBoard; this.b = bareBoard;", ctx);
  return ctx;
};

test("无框＝连照片框自己那层【平色的台子】也撤掉", () => {
  // 她截图里那块半透明的方，就是 V 形拍立得自己画的台子
  assert.match(comp, /background: dark \? "#171613" : "rgba\(239,232,220,\.55\)"/, "V 形拍立得那层台子不在了？这条断言的前提要重想");
  const A = mk("bare", null);
  assert.equal(A.b, true);
  assert.deepEqual({ ...A.f({ background: "rgba(239,232,220,.55)", position: "relative" }) },
    { background: "transparent", position: "relative" });
  assert.deepEqual({ ...A.f({ background: "#e6e0d6" }) }, { background: "transparent" });
});

test("画出来的东西一律不动——撤了胶卷就不是胶卷了", () => {
  const A = mk("bare", null);
  const film = { background: "repeating-linear-gradient(90deg,#161513 0 8px,#292724 8px 12px)" };
  assert.equal(A.f(film).background, film.background, "把胶片的齿孔当成台子撤掉了");
  const wall = { backgroundImage: "url(blob:x)" };
  assert.equal(A.f(wall).backgroundImage, wall.backgroundImage);
  // 胶卷那两款的底真的是 gradient（不然上面这条护不住它们）
  assert.match(comp, /background: "repeating-linear-gradient\(90deg,#161513 0 8px/);
  assert.match(comp, /background: "repeating-linear-gradient\(180deg,#161513 0 9px/);
});

test("不是无框、或者她自己挑过底，都不许撤", () => {
  assert.equal(mk("soft", null).b, false, "雾面也把台子撤了");
  assert.equal(mk("paper", null).f({ background: "#eee" }).background, "#eee");
  // 挑过底就听她的
  assert.equal(mk("bare", { background: "#2b3a36" }).b, false, "挑了底还把它撤掉");
  assert.equal(mk("bare", { background: "#2b3a36" }).f({ background: "#eee" }).background, "#eee");
});

test("接进渲染链：照片那一支挑了底走底，没挑走撤台子", () => {
  assert.match(comp, /if \(gnd && body && body\.props\) body = React\.cloneElement\(body, \{ style: Object\.assign\(\{\}, body\.props\.style, gnd\) \}\);\n\s*else if \(bareBoard && body && body\.props\) body = React\.cloneElement\(body, \{ style: unBoard\(body\.props\.style\) \}\);/);
  // ⚠️别的装饰那张纸就是那件东西本身，不走这一路（书签没了纸就只剩几个字）
  const bm = cut('if (item.type === "bookmark")', 'if (item.type === "scroll")');
  assert.ok(bm.indexOf("unBoard") < 0, "书签那张纸也被当成台子撤了");
  const sc = cut('if (item.type === "scroll")', 'if (item.type === "letter")');
  assert.ok(sc.indexOf("unBoard") < 0, "挂轴那张纸也被当成台子撤了");
});

// ── 斜了就被切掉 ────────────────────────────────────────────
// 转一下之后占的宽是 w·cosθ + h·sinθ，比没转之前宽。原来按【没转之前】的宽去排，
// 左右两张转 10° 之后角就被 overflow:hidden 削掉了。
test("V 形拍立得：三张都得留在框里，两边给转出去的那一截让出位置", () => {
  const fan = cut('} else if (frame === "fan3")', '} else if (frame === "torn4")');
  const turns = JSON.parse(/var turns = (\[[^\]]*\])/.exec(fan)[1]);
  const lefts = JSON.parse(/lefts = (\[[^\]]*\])/.exec(fan)[1]);
  // ⚠️别用宽松的 /width: "N%"/：切片里第一个 width 是【外面那个容器】的 100%，
  //   拿它去算会算出「照片从 -1% 开始」这种鬼数（这条断言第一版就是这么错的）。
  //   要认的是 photo(...) 里那一串，所以连着后面的 height/left 一起匹配。
  const w = Number(/width: "(\d+)%", height: "\d+%", left:/.exec(fan)[1]);
  const shift = Number(/translateX\((-?\d+)%\)/.exec(fan)[1]);   // 按自己的宽算
  assert.equal(turns.length, 3); assert.equal(lefts.length, 3);
  turns.forEach(function (d) { assert.ok(Math.abs(d) <= 8, "角度还是太大：" + d); });
  lefts.forEach(function (L) {
    var l = L + w * shift / 100, r = l + w;
    assert.ok(l >= 3, "左边贴着框，转起来就被切：" + l);
    assert.ok(r <= 97, "右边贴着框，转起来就被切：" + r);
  });
  // 竖着也别顶到边
  const top = Number(/top: i === 1 \? "\d+%" : "(\d+)%"/.exec(fan)[1]);
  const hh = Number(/width: "\d+%", height: "(\d+)%", left:/.exec(fan)[1]);
  assert.ok(top + hh <= 92, "底下顶到框了");
});

test("叠下来的一摞：同一件事，右边也别顶到框", () => {
  const tw = cut('} else if (frame === "tower4")', '} else if (frame === "timeline5")');
  // 同上：要的是那四张自己的宽（towerAt 里的 left 配 width），不是容器的 100%
  const w = Number(/left: c\.left, width: "(\d+)%"/.exec(tw)[1]);
  const lefts = [...tw.matchAll(/left: "(\d+)%", turn:/g)].map(function (m) { return Number(m[1]); });
  assert.equal(lefts.length, 4);
  lefts.forEach(function (L) { assert.ok(L + w <= 95, "这一张的右边顶到框了：" + (L + w)); });
  [...tw.matchAll(/turn: (-?[\d.]+)/g)].forEach(function (m) { assert.ok(Math.abs(Number(m[1])) <= 3, "角度太大：" + m[1]); });
});
