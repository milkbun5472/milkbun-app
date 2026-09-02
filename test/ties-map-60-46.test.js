const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const map = scr.slice(scr.indexOf("function TiesMap("), scr.indexOf("function Ties({"));
const ties = scr.slice(scr.indexOf("function Ties({"), scr.indexOf("function RelComposer("));

// 她 2026-09-02：「关系页面弄好看点吧，或者推翻重做设计，我想要像 mindmap 那种
//                 可以看到关系网然后拖动看不同地方，然后 npc 的也会显示」。

test("默认就是那张网，老那份角色名单整个删掉", () => {
  assert.match(ties, /h\(TiesMap, \{/, "默认视图没换成图");
  // 撤掉东西要删除：名单行、参与者名单、成对卡片三个都只服务于老列表
  ["RosterRow", "const Card = ({ a, b })", "const participants = "].forEach(w =>
    assert.ok(!scr.includes(w), "老列表还留着一半：" + w));
  // 单人详情页要留着：配角的简介只有那儿能读全文、能改、能删
  assert.match(ties, /onOpenPerson: id => setView\(id\)/);
  assert.match(ties, /h\(NpcBrief, \{ npc: npc/);
});

test("配角也在图上，用虚线拴在他主人身边", () => {
  assert.match(map, /const npcs = all\.filter\(isNpc\)/);
  assert.match(map, /const tethers = npcs\.map/);
  assert.match(map, /strokeDasharray: "3 4"/, "配角那根线要跟真关系区分开");
  // 关系被删光、没主人的配角也不许从图上消失
  assert.match(map, /const orphans = npcs\.filter\(n => !hostOf\(n\)\)/);
  assert.match(map, /\.concat\(npcs\.map\(c => \(\{ id: c\.id, kind: "npc" \}\)\)\)/);
});

test("头像不许被浏览器当成图片拖走——拖不动的真凶就是它", () => {
  // walker 数出来的：只走了 2 个 pointermove、0 个 up，中间一个 pointercancel。
  // <img> 触发原生拖图，整个手势被掐掉。
  assert.match(map, /WebkitUserDrag: "none"/);
  assert.match(map, /WebkitTouchCallout: "none"/, "iOS 长按图片那个菜单是同一个口子");
  // ⚠️只在【头像那个盒子】上问：svg 那层也写着 pointerEvents:none，
  //   对着整份 map 问会永远是真（第一版就这么误报了一次）。
  const dot = map.slice(map.indexOf("const nodeDot = "), map.indexOf("const selName ="));
  const box = dot.slice(dot.indexOf("h(\"div\", { style: {", dot.indexOf("cursor: \"grab\"")));
  assert.match(box.slice(0, 200), /pointerEvents: "none"/, "img 连当 target 的机会都不该有");
});

test("松手存的是实时值，不是渲染闭包里那份", () => {
  // pointermove 比重渲染快，读闭包里的 drag 会存成没动过的原位（walker 抓到过）
  assert.match(map, /p\.live = \{ x: cur\.x \+ dx \/ k, y: cur\.y \+ dy \/ k \}/);
  assert.match(map, /onSavePos\(p\.node, p\.live\)/);
  assert.ok(!/onSavePos\(p\.node, drag\[p\.node\]/.test(map), "又去读闭包里的 drag 了");
});

test("节点不是内联组件——那样每渲染一次就把手底下那个 div 换掉", () => {
  assert.ok(!/const NodeDot = \(\{/.test(map), "内联组件每次都是新类型，React 会整棵卸载重建");
  assert.match(map, /const nodeDot = \(id, kind\) =>/);
  assert.match(map, /nodes\.map\(n => nodeDot\(n\.id, n\.kind\)\)/);
});

test("⌖ 只归位视野，不许顺手把她拖了半天的摆法清掉", () => {
  assert.match(map, /const recenter = \(\) => \{ setSel\(null\); fitNow\(\); \}/);
  assert.ok(!/\["⌖", resetLayout\]/.test(map), "归位键接到清摆法上了");
  assert.match(map, /\["⌖", recenter\]/);
  // 清摆法是另一个键，而且她没拖过就不出现
  assert.match(map, /moved \? \[\["⟲", resetLayout\]\] : \[\]/);
});

test("摆法是她的，存得住", () => {
  assert.match(app, /const \[tiePos, setTiePos\] = useState\(\{\}\)/);
  assert.match(app, /setTiePos\(loadJSON\("x_tiesPos", \{\}\)\)/, "重开 app 要读回来");
  assert.match(app, /saveJSON\("x_tiesPos", n\)/);
  assert.match(app, /id == null \? \{\} :/, "归位那一路要能整份清掉");
});

test("第一眼看得见整张网，不是网中间那一块", () => {
  assert.match(map, /const fitNow = \(\) => \{/);
  assert.match(map, /React\.useLayoutEffect\(\(\) => \{ if \(fitted\.current/, "得在画第一帧之前就缩好，不然会跳一下");
  assert.match(map, /Math\.max\(0\.5, Math\.min\(1\.15/, "缩太狠字就没法看了，得夹住");
});

test("整页 + 紧凑标题栏（不是 Head 那个大标题）", () => {
  assert.ok(!/h\(Sheet,/.test(map), "这一层不需要同时看见下面那层——不许用半窗");
  assert.match(map, /className: "h-full flex flex-col"/);
  assert.match(map, /className: "flex-1 min-h-0"/, "图那块要 flex-1 min-h-0");
  assert.ok(!/h\(Head, \{ zh: "关系网"/.test(map), "Head 那个 30px 大标题要吃掉三百多像素");
  assert.match(map, /paddingTop: safeTop\(10\)/);
  assert.match(map, /touchAction: "none"/, "不锁的话拖图会被当成翻页");
});

test("关系名写在线上，不是浮在旁边的一排药丸", () => {
  // 线在字那儿断开：标签自带页底色，压在线上
  const lab = map.slice(map.indexOf("edges.filter(e => e.label)"), map.indexOf("nodes.map(n => nodeDot"));
  assert.match(lab, /background: t\.bg/, "不垫底色就是一根线穿过字");
  assert.match(lab, /onClick: ev => \{ ev\.stopPropagation\(\); onEditEdge\(e\.a, e\.b\)/, "点名字要能改这段关系");
  assert.ok(!/borderRadius: 999/.test(lab), "别做成药丸");
  // 短边的标签会压在名字上（配角那种 84px 的），得推开
  assert.match(map, /const off = bow \/ 2 \+ 10/);
});
