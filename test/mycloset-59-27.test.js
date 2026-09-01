// 我的衣柜（她 2026-09-01：「我的衣柜在哪儿设置，也给我搞个 AI 调用用关键词生成
// 几套，再加上可以自己填」）。
// ⚠️在这之前【压根没有正门】：x_myCloset 只能在情侣空间→照相馆里点「配一身约会装」
// 才长得出来，一次一身、还绑着某个角色——她问「在哪儿设置」是问不出来的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), scr = R("screens.js"), comp = R("components.js"), core = R("core.js");
const cut = (s, a, b) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i + a.length)); };

test("有正门：主屏上一格、一条路由、一页", () => {
  assert.match(comp, /mycloset: \{ kind: "app", zh: "我的衣柜"/, "主屏 REG 里没有这一格");
  assert.match(comp, /"carry", "mycloset"/, "默认布局里没摆出来，等于装了但看不见");
  assert.match(core, /mycloset: 44/, "没点名色相，会掉进哈希里跟邻居撞色");
  assert.match(app, /screen === "mycloset"\) body = h\(MyCloset, \{/, "没有路由");
  assert.match(scr, /function MyCloset\(\{ profile, data, busy, onGen, onAdd, onDrop, onBack \}\)/, "没有这一页");
  // 整页，不是半窗（.claude/rules/no-half-sheet.md）
  const ui = cut(scr, "function MyCloset({", "\nfunction ");
  assert.ok(ui.indexOf("h(Sheet") < 0, "用半窗了");
  assert.match(ui, /className: "h-full flex flex-col"/, "不是整页骨架");
  assert.match(ui, /className: "flex-1 min-h-0 overflow-y-auto/, "正文不是那个主滚动容器");
});

test("关键词生成：一次四身，不灌角色上下文", () => {
  const gen = cut(app, "  const myClosetGen = async keywords => {", "\n  };");
  // ⚠️不许走 runProbe：它一定要 buildBundle，而 buildBundle 要角色，没有就炸在
  // ctx.char.name 上（浏览器里报的就是 Cannot read properties of undefined）。
  // 而且这一条是关于【她自己】的，灌一份角色上下文既没用又要花钱。
  // ⚠️剥掉注释行再核：app.js 里那条说明本身就写着 runProbe，不剥会撞自己
  const bare = gen.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(bare.indexOf("runProbe") < 0, "又走 runProbe 了，没有角色就会炸");
  assert.match(gen, /extractJSON\(await callAI\(bgActive \|\| active,/, "没自己拼一份最小 system");
  assert.match(gen, /配 4 身衣服/, "不是一次四身");
  assert.match(gen, /【她给的关键词】/, "关键词没发过去");
  assert.match(gen, /【她没给方向】|【她没给关键词】/, "留空那一档没兜住");
  assert.match(gen, /profile\.persona \? "\\n【她是这样一个人】/, "没带上她的人设，配出来换谁都能穿");
  assert.match(gen, /柜子里已经有这几身，别再配一样的/, "没避重，会配出一模一样的");
  // 这一栏最容易写坏的方向：写成时尚杂志的搭配建议
  assert.match(gen, /别用「知性优雅」「气场全开」这类换谁都贴得上的词/, "没挡住那种换谁都成立的形容词");
  assert.match(gen, /四身要【真的不一样】/, "没要求四身拉得开");
  assert.match(gen, /rows\.slice\(0, 6\)/, "模型多给几身没收口");
});

test("也能自己挂、拿得掉，且不会越攒越多", () => {
  const put = cut(app, "  const myClosetPut = (box, occ, set) => {", "\n  };");
  assert.match(put, /String\(occ \|\| ""\)\.trim\(\)\.slice\(0, 8\) \|\| "平常"/, "场合没兜底，空的会散成一堆无名格");
  assert.match(put, /if \(!one\.name\) return box;/, "没名字也往里塞");
  assert.match(put, /\.slice\(0, MYCLOSET_MAX_SETS\)/, "一个场合里没有上限");
  assert.match(put, /cur\.slice\(0, MYCLOSET_MAX_OCC\)/, "场合数没有上限");
  // 同一个场合挂到同一格里，不是每次新开一格
  assert.match(put, /cur\.findIndex\(g => g && String\(g\.occasion \|\| ""\) === occasion\)/, "同名场合会开出好几格");
  const add = cut(app, "  const myClosetAdd = (occ, name, note) => {", "\n  };");
  assert.match(add, /if \(!String\(name \|\| ""\)\.trim\(\)\) \{ toast/, "空的也能挂进去");
  const drop = cut(app, "  const myClosetDrop = (occ, name) => {", "\n  };");
  assert.match(drop, /\.filter\(g => \(g\.sets \|\| \[\]\)\.length\)/, "拿空了的场合还留着一个空格子");
  // 存的是同一份，照相馆那条路照旧
  assert.match(app, /saveMyCloset\(myClosetPut\(myClosetRef\.current, occ/, "自己挂的没存进同一份");
  assert.match(app, /saveMyCloset\(put\(myClosetRef\.current, d && d\.hers\)\)/, "照相馆那条路被弄坏了");
});
