// 她 2026-09-15：「我想关系图做单独一个视角界面，因为我也喜欢这种点击头像就看他
// immediate 关系的」。
//
// 这一页和关系页里那块板子的区别只有一条，但那一条是全部：
//  · 板子答的是「这个人有哪些关系」——一人一页，看完就完；
//  · 这一页是用来【走】的：中心可以换，换过的路留着，返回沿原路退回去。
// 所以这份钉的全是「走」这件事：点得动、退得回、绕回原地不会越退越长。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const screens = fs.readFileSync("js/screens.js", "utf8");

const grab = re => { const m = screens.match(re); assert.ok(m, "找不到：" + re); return m[0]; };

test("点一张脸就换中心；拖完松手不算点", () => {
  const card = grab(/const card = id => \{[\s\S]*?\n  \};/);
  assert.match(card, /onClick: \(\) => \{ if \(!onCenter \|\| ptr\.current\.moved \|\| id === centerId\) return; onCenter\(id\); \}/,
    "不看 ptr.moved 的话，每拖一次位置就会跳走一个人");
  assert.match(screens, /function TiesBoard\(\{ centerId[^}]*onCenter \}\)/, "板子没收 onCenter，这一页就点不动");
});

test("返回是退一步，不是直接关掉整页", () => {
  const map = grab(/function TiesWalk\(\{[\s\S]*?\n\}\n/);
  assert.match(map, /const back = \(\) => \{ if \(trail\.length <= 1\) \{ onClose\(\); return; \} setTrail\(p => p\.slice\(0, -1\)\); \};/,
    "走了五层一按返回就回到起点，那条路等于白走");
  assert.match(map, /onBack: back/);
  // 走过的路要看得见，而且点哪一站回哪一站
  assert.match(map, /trail\.length > 1 && h\("div"/, "没有那条走过的路，她不知道自己是怎么走到这儿的");
  assert.match(map, /onClick: \(\) => setTrail\(p => p\.slice\(0, i \+ 1\)\)/);
});

test("绕回走过的人，路要收短、不能越走越长", () => {
  const map = grab(/function TiesWalk\(\{[\s\S]*?\n\}\n/);
  const fn = new Function("useStateTrail", grab(/  const walkTo = id => setTrail\([\s\S]*?\n  \}\);/)
    .replace("const walkTo = id => setTrail(", "return function (trail, id) { return (")
    .replace(/\n  \}\);$/, "\n  })(trail); };"));
  const walk = fn();
  assert.deepEqual(walk(["a"], "b"), ["a", "b"]);
  assert.deepEqual(walk(["a", "b", "c"], "d"), ["a", "b", "c", "d"]);
  assert.deepEqual(walk(["a", "b", "c"], "a"), ["a"], "从 c 走回 a，路该收成 a，而不是 a→b→c→a");
  assert.deepEqual(walk(["a", "b", "c"], "b"), ["a", "b"]);
  assert.ok(map.indexOf("trail") > 0);
});

test("是整页，不是半窗", () => {
  const map = grab(/function TiesWalk\(\{[\s\S]*?\n\}\n/);
  assert.ok(map.indexOf("h(Sheet") < 0,
    "关系图被改成半窗了——这一页的正文就是那张网，高度全给它（施工规则/no-half-sheet.md）");
  assert.match(map, /className: "absolute inset-0 z-40 flex flex-col"/);
});

test("两个入口都在：点脸是顺手，顶栏那颗是明的", () => {
  assert.match(screens, /onCenter: id => setMapAt\(id\)/, "关系板上点脸进不去这一页");
  const openRow = screens.split("\n").find(l => l.indexOf('"走一圈"') > 0) || "";
  assert.match(openRow, /onClick: \(\) => setMapAt\(boardId\)/,
    "只有顺手的入口等于没入口——她得知道有这么一页");
  assert.match(screens, /walkAt && h\(TiesWalk, \{/);
  assert.match(screens, /const \[walkAt, setMapAt\] = useState\(null\);/);
});
