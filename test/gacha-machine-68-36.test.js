// 她 2026-09-14：「ui 能不能也做好看高级点的扭蛋机可以互动的，扭的时候里面东西会动
// 有出货动画，参考图上但是画我们之间的形状」。
//
// 参考图给的是【机器的样子】，不是内容——蛋里装的得是这副奖池里真有的那几样东西。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

// 真跑一遍那两个纯画图的函数：核的是画出来的东西，不是源码长相
const M = (() => {
  const a = scr.indexOf("const GACHA_SHAPES = [");
  const b = scr.indexOf("function Gacha({ partner, pts");
  const calls = [];
  const h = (tag, props, ...kids) => ({ tag, props: props || {}, kids: kids.flat(9).filter(Boolean) });
  const ctx = { h, F_BODY: "b", F_DISPLAY: "d", useState: v => [v, () => {}], useRef: () => ({ current: null }), useEffect: () => {}, calls };
  vm.createContext(ctx);
  vm.runInContext(scr.slice(a, b) + "\nthis.mk = GachaMachine; this.shapes = GACHA_SHAPES; this.balls = GACHA_BALLS;", ctx);
  return ctx;
})();
const flat = node => { const out = []; (function walk(n) { if (!n || typeof n !== "object") return; out.push(n); (n.kids || []).forEach(walk); })(node); return out; };
const mk = o => M.mk(Object.assign({ have: 900, costOne: 50, costTen: 450, armed: 0, armSeq: 1, spin: 0,
  onArm: () => {}, onSpin: () => {}, partner: { name: "甲" } }, o));
const tree = spin => flat(mk({ spin: spin }));

test("蛋里装的是这副奖池里真有的形状，不是参考图上那家的寿司", () => {
  const ks = M.shapes.map(x => x.k);
  ["photo", "note", "song", "heart", "book", "mail", "tick", "eye", "box", "ring", "star"].forEach(k =>
    assert.ok(ks.indexOf(k) >= 0, "少了 " + k));
  assert.ok(ks.length >= 10, "形状太少，一罐蛋会长得一样");
  // 每一枚蛋都真的画出了外壳、内容和高光——少一层就是个白圆片
  const idle = tree(0);
  assert.ok(idle.filter(n => n.tag === "circle" && n.props.fill === "url(#gm-glass)").length >= 10, "蛋壳那层玻璃没画");
});

test("蛋是堆着的，不是排成格子", () => {
  // 判据：同一「行」里相邻两枚的间距小于两个半径之和（也就是它们压着）
  const byY = M.balls.slice().sort((a, b) => a[1] - b[1]);
  let touching = 0;
  for (let i = 0; i < byY.length; i++) for (let j = i + 1; j < byY.length; j++) {
    const dx = byY[i][0] - byY[j][0], dy = byY[i][1] - byY[j][1];
    if (Math.hypot(dx, dy) < byY[i][2] + byY[j][2]) touching++;
  }
  assert.ok(touching >= 6, "一枚压着一枚的太少，看起来像货架不像扭蛋机");
  // 而且要下重上轻：底下那几枚大一点
  const low = M.balls.filter(b => b[1] > 130), high = M.balls.filter(b => b[1] < 90);
  assert.ok(low.length && high.length);
});

test("转起来：罐子在晃、拉杆在转、有一枚在出货", () => {
  const idle = tree(0), spin = tree(1);
  const anim = t => t.filter(n => n.props.style && n.props.style.animation).map(n => n.props.style.animation).join("|");
  assert.doesNotMatch(anim(idle), /gm-shake|gm-drop/, "没转的时候也在动");
  assert.match(anim(spin), /gm-shake/, "蛋没晃");
  assert.match(anim(spin), /gm-lever/, "拉杆没转");
  assert.match(anim(spin), /gm-drop/, "没有出货那一枚");
  // 出货那一枚只在转的时候存在
  assert.ok(spin.length > idle.length, "转起来之后没多出任何东西");
});

test("正在转的时候不许再按——连点两下会扣两次点数", () => {
  const spin = tree(1).filter(n => n.tag === "button");
  assert.ok(spin.length >= 2);
  spin.forEach(b => assert.equal(b.props.disabled, true));
  const idle = tree(0).filter(n => n.tag === "button");
  idle.forEach(b => assert.equal(!!b.props.disabled, false));
  // 点数不够也要禁用
  const poor = flat(mk({ have: 10 })).filter(n => n.tag === "button");
  poor.forEach(b => assert.equal(b.props.disabled, true));
});

test("转完了才把卡摆出来——那一下才叫出货", () => {
  const i = scr.indexOf("  const doSpin = () => {");
  assert.ok(i > 0, "扳拉杆那一下没有做成两段");
  const fn = scr.slice(i, i + 700);
  assert.match(fn, /setSpin\(n\)/);
  assert.match(fn, /setTimeout\(\(\) => \{/);
  assert.match(fn, /onPull\(partner, n\)/);
  // onPull 必须在定时器【里面】，不然卡在动画之前就跳出来了
  assert.ok(fn.indexOf("setTimeout") < fn.indexOf("onPull(partner, n)"), "抽的结果没等动画");
  // 离开这一页要把定时器收掉
  assert.match(scr, /useEffect\(\(\) => \(\) => \{ if \(spinTimer\.current\) clearTimeout\(spinTimer\.current\); \}, \[\]\);/);
});

test("机身上的字一律中文（施工规则/no-english-titles.md）", () => {
  const texts = tree(0).filter(n => n.tag === "text").map(n => n.kids.join(""));
  assert.ok(texts.length >= 2, "机器上一个字都没有");
  texts.forEach(x => assert.doesNotMatch(x, /[A-Za-z]/, "机身上还留着英文：" + x));
  assert.ok(texts.some(x => x.indexOf("我们之间") >= 0), "顶上那块铭牌没了");
});

test("洞口不许再画成一颗球", () => {
  // 前两版栽的就是这一笔：洞里描一道白弧 + 顶上最亮 = 人眼读成球体
  // 渐变定义在 defs 里，离洞口那几行很远——按 id 找它，别按行距猜
  const g = scr.slice(scr.indexOf('id: "gm-hole"'), scr.indexOf('id: "gm-hole"') + 320);
  const stops = [...g.matchAll(/stopColor: "(#[0-9a-f]{6})"/g)].map(m => m[1]);
  assert.ok(stops.length >= 2, "洞口没有渐变");
  const lum = c => parseInt(c.slice(1, 3), 16) + parseInt(c.slice(3, 5), 16) + parseInt(c.slice(5, 7), 16);
  assert.ok(lum(stops[0]) < lum(stops[stops.length - 1]), "洞口还是上亮下暗（那就是一颗球）");
  assert.doesNotMatch(scr, /d: "M151 274 q20 -11 40 0"/, "洞里那道白弧还在");
});

// ── v68.37：投币口和拉杆原来只是画上去的（她 2026-09-14：「这俩还是摆设」）──
// 现在是三步：选这次抽多少 → 一张点数卡滑进投币口 → 扳拉杆才真的转。
test("没投点数之前，拉杆扳不动", () => {
  const idle = tree(0);
  const hot = idle.filter(n => n.tag === "circle" && n.props.role === "button");
  assert.equal(hot.length, 1, "拉杆没有一块自己的热区");
  assert.equal(hot[0].props.style.pointerEvents, "none", "还没投点数就能扳了");
  assert.equal(hot[0].props.tabIndex, -1);
  // 热区要够大：细杆按不准（施工规则/mobile-ui-layout.md）
  assert.ok(hot[0].props.r * 2 >= 56, "拉杆热区太小");
});

test("投完点数：卡片进了口子、拉杆亮起来、扳得动了", () => {
  const armed = flat(mk({ armed: 1 }));
  const hot = armed.filter(n => n.tag === "circle" && n.props.role === "button")[0];
  assert.equal(hot.props.style.pointerEvents, "auto");
  assert.equal(hot.props.tabIndex, 0);
  const anim = armed.filter(n => n.props.style && n.props.style.animation).map(n => n.props.style.animation).join("|");
  assert.match(anim, /gm-coin/, "点数卡没有滑进去那一下");
  assert.match(anim, /gm-wait/, "拉杆没提示可以扳了");
  // 投币口那一格要写清楚投了多少
  const txt = armed.filter(n => n.tag === "text").map(n => n.kids.join("")).join("|");
  assert.match(txt, /已投 50/);
});

test("改主意重选，那张卡要重新投一遍（不然看着像没反应）", () => {
  const a = flat(mk({ armed: 1, armSeq: 3 })).filter(n => n.props.key === "coin3");
  const b = flat(mk({ armed: 10, armSeq: 4 })).filter(n => n.props.key === "coin4");
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
});

test("选了还没扳的时候，一点都不许扣", () => {
  const i = scr.indexOf("  const arm = n => {");
  assert.ok(i > 0);
  assert.doesNotMatch(scr.slice(i, i + 200), /onPull/, "选的时候就扣点数了");
  // 扣点数只发生在 onPull 那一处，而它在动画末尾
  const d = scr.slice(scr.indexOf("  const doSpin = () => {"), scr.indexOf("  const doSpin = () => {") + 700);
  assert.match(d, /if \(spin \|\| !armed\) return;/);
  assert.match(d, /setArmed\(0\);/);
  assert.ok(d.indexOf("setTimeout") < d.indexOf("onPull(partner, n)"));
});

test("选中的那一档看得出来", () => {
  const one = flat(mk({ armed: 1 })).filter(n => n.tag === "button");
  assert.equal(one.filter(b => b.props.style.background === "#7e3a54").length, 1, "选中的那个没高亮");
});
