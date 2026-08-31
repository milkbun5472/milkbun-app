const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), scr = R("screens.js"), eng = R("engine.js");
const cut = (s, a, b) => s.slice(s.indexOf(a), s.indexOf(b));
const fit = cut(app, "  const genDateOutfits = async (char, hint) => {", "  // 拍一张。走的是线下那条已经调好的出图链");
const shoot = cut(app, "  const studioShoot = async (char, opt) => {", "  const DRAWER_CAP");

// 她 2026-08-31：「合照可以单独做一项情侣空间页面叫照相馆。可以引进角色随身物里的衣柜，
// 或者选择重新生成一套约会装放进衣柜然后给我也弄一套衣柜可以生成合照？」
test("我的衣柜跟角色衣柜同一个形状，两边共用一套渲染", () => {
  assert.match(app, /const \[myCloset, setMyCloset\] = useState\(\{\}\);/, "没有我的衣柜");
  assert.match(app, /setMyCloset\(loadJSON\("x_myCloset", \{\}\)\);/, "没读回来");
  // 复用已有的 closetGroups / carryClosetText，不为「用户的衣服」另写一套
  assert.match(app, /carryClosetText\(myClosetRef\.current\)/, "我的衣柜没走已有那套收口");
  assert.match(scr, /const mySets = closetGroups\(myCloset\);/, "界面上没复用 closetGroups");
  assert.match(scr, /const hisSets = closetGroups\(charCloset && charCloset\.outfit\);/, "角色那侧读错了层");
  // 两侧挑衣服是同一个组件
  assert.equal((scr.match(/h\(StudioPicker, \{/g) || []).length, 2, "两侧没共用同一个挑衣服组件");
});

// 分两次生成会各写各的，凑不成一起出门的样子，还多花一次钱
test("一次调用配一对，不是各配各的", () => {
  assert.equal((fit.match(/runProbe\(/g) || []).length, 1, "配衣服花了不止一次调用");
  assert.match(fit, /\\"his\\":\{[\s\S]*?\\"hers\\":\{/, "一次里没同时要两身");
  assert.match(fit, /配得上同一个场合、也配得上彼此/, "没要求两身是配着的一对");
  assert.match(fit, /换个朝代、换个身份就不成立的才算写对/, "没立那条判据——不然会写出一身谁都能穿的衣服");
  // 两边各挂一身，用的是同一个 put
  assert.match(fit, /saveMyCloset\(put\(myClosetRef\.current, d && d\.hers\)\);/, "我这边没挂上");
  assert.match(fit, /outfit: put\(box\.outfit, d && d\.his\)/, "他那边没挂上");
});

// ⚠️衣柜只挂着没用：图像端读的是画面描述，不是衣柜
test("挑好的两身要显式写进画面描述里", () => {
  assert.match(shoot, /const fits = \[/, "没把两身拼进去");
  assert.match(shoot, /char\.name \+ "穿："/, "他那身没写进画面");
  assert.match(shoot, /me\.name \+ "穿："/, "我那身没写进画面");
  assert.match(shoot, /const sceneFull = scene \+ \(fits \? "。" \+ fits : ""\);/, "拼了却没交给出图");
  assert.match(shoot, /buildPhotoPrompt\(char, sceneFull, st, \{ kind: "duo"/, "没走已有那条出图链");
  // 走的是【已有的】那条链，不是另造一套
  ["buildPhotoPrompt", "generateSelfieImage", "buildMinimalPhotoPrompt", "idbImgPut"].forEach(f =>
    assert.ok(shoot.indexOf(f) > 0, "没复用已有的：" + f));
});

// 照相馆拍的就是【合照】：两张参考照缺一张就锁不住脸。
// 线下那条会降级成「她替他拍的单人照」，这儿不行——这一页的全部意义就是合照。
test("参考照不齐就明说，不偷偷降级成单人照", () => {
  assert.match(shoot, /if \(!\(char\.refPhoto && profile && profile\.refPhoto\)\) \{ toast\([\s\S]*?\); return false; \}/,
    "参考照不齐还往下拍");
  assert.ok(shoot.indexOf('kind = "other"') < 0, "偷偷降级成单人照了");
  assert.match(shoot, /imgApiReady\(\)\)\) \{ toast\([\s\S]*?\); return false; \}/, "没配图像 API 也往下走");
  assert.match(shoot, /if \(!char \|\| !scene\) \{ toast\([\s\S]*?\); return false; \}/, "没写要拍什么也能按下去");
});

test("拍出来的同时上合照墙", () => {
  const duo = cut(app, "  const duoPhotosOf = cid => {", "  // 里程碑册");
  assert.match(duo, /studioRef\.current \|\| \[\]\)\.filter\(x => x\.charId === cid && \(x\.imgKey \|\| x\.imgUrl\)\)/, "合照墙不认照相馆拍的");
  assert.match(duo, /\.concat\(off, shots\)/, "算了却没并进去");
  assert.match(eng, /"x_studio"/, "照相馆那份没登记进 durable，攒多了会把 localStorage 写满");
  assert.match(app, /\.slice\(0, STUDIO_CAP\)/, "照相馆没有上限");
});

// .claude/rules/no-half-sheet.md / mobile-ui-layout.md
test("整页，紧凑标题栏，正门在情侣空间", () => {
  const ui = scr.slice(scr.indexOf("function PhotoStudio({"));
  assert.ok(ui.indexOf("h(Sheet") < 0, "用半窗了");
  assert.match(ui, /className: "h-full flex flex-col"/);
  assert.match(ui, /className: "flex-1 min-h-0 overflow-y-auto/);
  assert.match(ui, /paddingTop: safeTop\(10\)/, "顶栏没吃安全区");
  // 看大图是同一页里退一层，不是再掀一层
  assert.match(ui, /onClick: \(\) => big \? setBig\(null\) : onBack\(\)/, "看大图之后返回键一下退两层");
  assert.match(scr, /sub === "studio"\) \{/, "情侣空间里没有这一页");
  assert.match(scr, /tile\("studio", \{ e: "📷", zh: "照相馆"/, "首页上没有入口");
  assert.match(app, /onStudioShoot: studioShoot,/, "没接上");
});
