// 她 2026-09-05：「现在移动装饰的时候想往上移屏幕也会同步上移，很难弄到要到的地方。」
//
// 每一页从 v63.35 起自己是个纵向滚动容器（「跟查手机那样又可以下滑又可以翻页」）。
// 手指拿着一个装饰往上带，那个容器就跟着往上滚——目标格子和手指同向同速地跑，
// 于是永远追不上：这不是「不好对准」，是【对不准】。
//
// ⚠️病根不是没写拦截，是写了的那句【从来没生效过】：
//   React 18 把 touchstart / touchmove / wheel 一律按被动监听挂在根节点上
//   （vendor/react-dom：`"touchstart"!==b&&"touchmove"!==b&&"wheel"!==b||(e=!0)`），
//   被动监听里 e.preventDefault() 是空转的。横滑翻页当初能成，靠的是 touchAction:"pan-y"
//   顺手把横向锁住了，跟那句 preventDefault 没关系——所以纵向这一半一直漏着。
//   这是「规则降概率，代码才保证」的另一个形状：**写了不等于生效，得看它挂在哪儿**。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const code = comp.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("react-dom 确实把 touchmove 挂成被动的——所以 React 的 onTouchMove 拦不住滚动", () => {
  const rd = fs.readFileSync(path.join(__dirname, "..", "vendor", "react-dom.production.min.js"), "utf8");
  assert.match(rd, /"touchmove"!==\w+&&"wheel"!==\w+\|\|\(\w+=!0\)/,
    "react-dom 换版了：这条前提得重新验一遍，不然下面这些拦截可能又变回空转");
});

test("拖着东西的时候，纵向滚动由一个【非被动】监听拦下来", () => {
  const seg = code.slice(code.indexOf("const shellRef = useRef(null);"), code.indexOf("const updateDrop = function"));
  assert.match(seg, /addEventListener\("touchmove", block, \{ passive: false \}\)/, "还是被动监听，preventDefault 照样空转");
  assert.match(seg, /if \(dragKeyRef\.current\) \{ e\.preventDefault\(\); return; \}/, "手里拿着东西时没拦住");
  assert.match(seg, /if \(r && r\.dir === "h"\) e\.preventDefault\(\);/, "横滑翻页那一路没接到非被动监听上");
  assert.match(seg, /if \(!e\.cancelable\) return;/, "没先看 cancelable，浏览器已经开滚之后再拦会报警告");
  assert.match(seg, /removeEventListener\("touchmove", block\)/, "监听没有拆");
  assert.match(comp, /ref: shellRef,/, "监听挂在谁身上都没接上");
});

test("那两句空转的 preventDefault 已经删掉了，不是留在原地加注释", () => {
  // 「撤掉东西要删除，而不是在它后面说 xxx 是错的应该 yyy」
  const onTM = code.slice(code.indexOf("const onTM = e => {"), code.indexOf("const onTE = () => {"));
  assert.ok(!/e\.preventDefault\(\)/.test(onTM), "onTM 里还留着空转的 preventDefault");
});

test("锁死之后还够得着屏幕外那几行：贴边一帧一步地自动滚", () => {
  assert.match(comp, /const HOME_EDGE_ZONE = 66, HOME_EDGE_STEP = 9;/);
  const seg = code.slice(code.indexOf("const edgeScroll = function (y)"), code.indexOf("const onTS = e =>"));
  assert.match(seg, /y < rc\.top \+ HOME_EDGE_ZONE \? -HOME_EDGE_STEP/, "贴上边没有往上滚");
  assert.match(seg, /y > rc\.bottom - HOME_EDGE_ZONE \? HOME_EDGE_STEP : 0/, "贴下边没有往下滚");
  assert.match(seg, /if \(s\.raf\) return;/, "每一帧都再开一个 rAF，会越滚越快");
  assert.match(seg, /if \(!st\.dy \|\| !dragKeyRef\.current\) \{ stopEdge\(\); return; \}/, "放手了还在滚");
  assert.match(seg, /b\.scrollTop \+= st\.dy/);
});

test("自动滚的时候落点跟着换——手指没动，脚下的格子动了", () => {
  const seg = comp.slice(comp.indexOf("const edgeScroll = function (y)"), comp.indexOf("const onTS = e =>"));
  assert.match(seg, /updateDrop\(st\.x, st\.y\);/, "滚过去之后没重扫落点，会落回滚动之前那一格");
  assert.match(seg, /s\.y = y;/, "没记下手指在哪儿，重扫用的是旧坐标");
  assert.match(comp, /edgeRef\.current\.x = tch\.clientX;/);
  // 扫描只此一份：onTM 和自动滚共用，别再各写一份（「一层写在两处，第二处没跟上」）
  assert.equal((code.match(/updateDrop\(st\.x, st\.y\)|updateDrop\(x, tch\.clientY\)/g) || []).length, 2,
    "updateDrop 应当是【一处定义、两处调用】：手指在动那一路，和手指不动、页面在滚那一路");
  assert.match(code, /const updateDrop = function \(x, y\) \{/);
  assert.ok(!/document\.querySelectorAll\("\[data-appkey\]"\)[\s\S]{0,4000}document\.querySelectorAll\("\[data-appkey\]"\)/.test(code),
    "落点扫描又抄了第二份");
});

test("放手、合并、退出整理，三条出口都把自动滚停掉", () => {
  assert.match(code, /const onTE = \(\) => \{\s*clearLP\(\);\s*clearHover\(\);\s*stopEdge\(\);/, "松手没停");
  assert.match(code, /stopEdge\(\);\s*setDragKey\(null\); dragKeyRef\.current = null;/, "合成文件夹那一路没停");
  assert.match(code, /function exitEdit\(\) \{ stopEdge\(\);/, "退出整理没停");
  assert.match(code, /const stopEdge = function \(\) \{ var s = edgeRef\.current; if \(s\.raf\) cancelAnimationFrame\(s\.raf\); s\.raf = 0; s\.dy = 0; \};/);
});

test("拖起来那一刻，touch-action 也把纵向收回来（安卓靠这个）", () => {
  assert.match(comp, /style: \{ touchAction: dragKey \? "none" : "pan-y" \}/, "外壳还一直放行纵向");
  assert.match(comp, /touchAction: dragKey \? "none" : undefined \} \},/, "那一页自己还能被浏览器滚");
  // 自动滚要找得到【当前这一页】那个滚动容器
  assert.match(comp, /"data-homepage": pi,/, "页面上没有标记，自动滚找不到该滚谁");
  assert.match(comp, /document\.querySelector\('\[data-homepage="' \+ pageRef\.current \+ '"\]'\)/);
  assert.match(comp, /const pageRef = useRef\(0\); pageRef\.current = page;/, "监听闭包里读的是过期的 page");
});
