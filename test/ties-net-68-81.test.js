// 她 2026-09-15 发来的参考图右上角那个「全部」：所有人一次铺开。
//
// 关系板和关系图都是【一次只看一个人】，所以隔着一层的路径永远看不见——
// 「陈倦之 → 顾清 → 凌峭」这种，只有整网图看得出来。
// ⚠️分工要钉死：整网图是【地图】（这张网长什么样、谁离谁近），
//   关系图才是【走路】。在地图上点谁，就落回那个人的关系图接着走。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const screens = fs.readFileSync("js/screens.js", "utf8");
const grab = re => { const m = screens.match(re); assert.ok(m, "找不到：" + re); return m[0]; };
const order = new Function(grab(/function tieNetOrder\(ids, edgeOf\) \{[\s\S]*?\n\}\n/) + ";return tieNetOrder;")();

const netOf = pairs => (a, b) => pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

test("有来往的人排在一起，线才不会横穿整张图", () => {
  // a-b-c 一串，d-e 另一串：两串不许交错着排
  const ids = ["a", "b", "c", "d", "e"];
  const out = order(ids, netOf([["a", "b"], ["b", "c"], ["d", "e"]]));
  assert.deepEqual(out.slice().sort(), ids.slice().sort(), "有人被排丢了");
  const gi = x => out.indexOf(x);
  const g1 = [gi("a"), gi("b"), gi("c")].sort((x, y) => x - y);
  const g2 = [gi("d"), gi("e")].sort((x, y) => x - y);
  assert.ok(g1[2] - g1[0] === 2 && g2[1] - g2[0] === 1, "两串交错着排了：" + out.join(","));
});

test("排法是确定的——她拖好的位置才记得住", () => {
  // ⚠️不做力导向：那玩意每次打开都不一样，昨天记住的位置今天就没了
  const ids = ["a", "b", "c", "d"];
  const e = netOf([["a", "b"], ["c", "d"], ["a", "c"]]);
  const first = order(ids, e).join(",");
  for (let i = 0; i < 5; i++) assert.equal(order(ids.slice().reverse(), e).join(","), order(ids, e).join(","),
    "换个入参顺序就排出另一张图，等于每次打开都不一样");
  assert.equal(order(ids, e).join(","), first);
});

test("谁都不认识的人不画——她要看的是网，不是花名册", () => {
  assert.match(screens, /const live = ids\.filter\(a => ids\.some\(b => b !== a && edgeOf\(a, b\)\)\);/);
  assert.deepEqual(order(["a", "b", "z"], netOf([["a", "b"]])).indexOf("z") >= 0, true,
    "tieNetOrder 本身不负责筛，筛在调用处（这一条只是钉住职责在哪儿）");
});

test("整网图是地图，关系图才是走路", () => {
  const walk = grab(/function TiesWalk\(\{[\s\S]*?\n\}\n/);
  assert.match(walk, /const \[netOpen, setNetOpen\] = useState\(false\);/);
  assert.match(walk, /onOpen: id => \{ walkTo\(id\); setNetOpen\(false\); \}/,
    "在地图上点了人却留在地图上，那这张图就只能看不能用");
  assert.match(walk, /netOpen \? "回到这个人" : "全部"/);
  assert.match(walk, /zh: netOpen \? "这张网"/, "标题不跟着换，她会以为还在看某一个人的关系");
});

test("线太细点不着，所以每一段挂一颗点；标签只在点中时才写", () => {
  const net = grab(/function TiesNet\(\{[\s\S]*?\n\}\n/);
  assert.match(net, /pairs\.filter\(L => sel === L\.a \+ "\|" \+ L\.b && L\.label\)/,
    "几十条线各挂一张牌子就是一团糊");
  assert.match(net, /width: 13, height: 13, borderRadius: 999, pointerEvents: "auto"/);
  // 箭头 marker 是按 svg 找的，借不到隔壁那张图里的
  assert.match(net, /id: "tieNetArrow"/);
  assert.match(net, /markerEnd: L\.both \? undefined : "url\(#tieNetArrow\)"/);
});

test("手势和几何跟关系板共用一份，不许抄第二份", () => {
  const net = grab(/function TiesNet\(\{[\s\S]*?\n\}\n/);
  assert.match(net, /tieBoardPointer\(\{ ptr, centerId: null, onCenter: onOpen, onSavePos,/,
    "整网图自己抄了一套手势——「拖完松手不算点」迟早只在其中一张图上成立");
  assert.match(net, /tieThread\(P\(L\.a\), P\(L\.b\), halfOf\(L\.a\), halfOf\(L\.b\)\)/);
  assert.match(net, /tieKindColor\(L\.label, t\.ink\)/, "整网图上不上色，那张网就只剩「谁连着谁」");
  // 摆位另存一份，别跟一人一页那些位置搅在一起
  assert.match(net, /const key = id => "net\|" \+ id;/);
  assert.match(net, /x\.indexOf\("net\|"\) === 0/);
});
