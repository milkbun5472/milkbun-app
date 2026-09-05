// 她 2026-09-05：「增加装饰那一页整理一下吧，越加越多有点难看宝宝」。
// 病灶不是哪一栏难看，是【什么都摊在一条长长的半窗里】：类型 7 格、相框 24 格、
// 两个输入框、底 9 色＋放图、材质 4、边线 3、强调色 6＋自选、对齐、角标、印字、
// 倾斜 5、版式 6，最后才是按钮——半窗先扣掉半屏，剩下的全靠滚。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const bare = s => s.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
const cut = (from, to) => comp.slice(comp.indexOf(from), comp.indexOf(to, comp.indexOf(from)));
// ⚠️锚点和口径都改了（v63.82，她：「放了的装饰的重新设置页面还是乱。然后设置的时候
//   没有选大小」）：这一页现在【新建和重改共用】，所以开头多了 styleKey 那一支，
//   页内不再直接读 decorDraft*，一律走适配器 A.*。钉的仍是同一件事。
const PAGE = cut('(showDecorLibrary || (styleKey && REG[styleKey] && REG[styleKey].kind === "decor")) && (function () {', "\n}\n// 主页名片");

test("整页，不是半窗（no-half-sheet）", () => {
  assert.ok(bare(PAGE).indexOf("h(Sheet") < 0, "又掀回半窗了");
  assert.match(PAGE, /h\("div", \{ className: "absolute inset-0 z-50 flex flex-col"/);
  // 顶栏走公共的紧凑标题栏，别自己再写一条（mobile-ui-layout §1）
  assert.match(PAGE, /h\(Head, \{ zh: A\.isNew \? "做一件装饰" : "改这件装饰"/);
  assert.match(PAGE, /bg: "transparent"/, "底纹要从外壳透上来，不然顶上横一道平色带");
  // 正文一个主滚动容器，顶栏/预览/底栏都 shrink-0
  assert.match(PAGE, /className: "flex-1 min-h-0 overflow-y-auto"/);
  assert.equal((PAGE.match(/className: "shrink-0"/g) || []).length, 2, "预览条和底栏得钉住，不许跟着滚");
});

test("一次只摊开一段，收起来还看得见自己选了什么", () => {
  assert.match(comp, /const \[decorStep, setDecorStep\] = useState\("what"\)/);
  assert.match(PAGE, /var section = function \(id, no, name, summary, body\)/);
  assert.match(PAGE, /setDecorStep\(open \? "" : id\)/, "点开着的那一段应该能收起来");
  // 三段各一次
  ["section(\"what\", \"1\", \"是什么\"", "section(\"words\", \"2\", \"写什么\"", "section(\"look\", \"3\", \"什么样子\""]
    .forEach(x => assert.ok(PAGE.indexOf(x) > 0, "少了一段：" + x));
  // ⚠️收起来还显示当前选的是什么——只收不显等于把东西藏了
  assert.match(PAGE, /marginLeft: "auto", fontFamily: F_BODY, fontSize: 11, opacity: \.68/);
  assert.match(PAGE, /meta\.name \+ \(A\.type === "photo" && frameName \? " · " \+ frameName : ""\)/);
  assert.match(PAGE, /presetName \+ " · 底" \+ groundName/);
  assert.match(PAGE, /\|\| "（还没写）"/);
});

test("顶上钉一张实时预览，画的就是等会儿真放上去的那一份", () => {
  // ⚠️草稿对象只造一份：各造一份的话，预览里好看的和落到桌面上的迟早对不上，
  //   而且不会有任何报错。
  assert.match(comp, /function decorItemOf\(A, id\) \{/);
  assert.match(PAGE, /var PV = decorItemOf\(A, "__preview"\);/);
  assert.match(comp, /var item = decorItemOf\(decorAdapter\("new"\), id\);/, "真放上去那一处没用同一份");
  // 预览要连壳带材质一起画，不然看到的和桌面上的还是两回事
  assert.match(PAGE, /homeWidgetPresetStyle\(A\.preset, t, A\.type\)/);
  assert.match(PAGE, /homeDecorMaterialStyle\(PV, t, A\.preset\)/);
  assert.match(PAGE, /h\(HomeDecorItem, \{ item: PV, preset: A\.preset, now: now \}\)/);
  // 竖着的那几款按竖的比例摆，别塞进一个横台子里
  assert.match(PAGE, /width: tallOne \? 96 : 208/);
});

test("二十来种相框默认只露八种", () => {
  assert.match(comp, /const \[decorFrameAll, setDecorFrameAll\] = useState\(false\)/);
  assert.match(PAGE, /var frames = decorFrameAll \? HOME_PHOTO_FRAMES : HOME_PHOTO_FRAMES\.slice\(0, 8\);/);
  assert.match(PAGE, /h\(HomePhotoFrameGrid, \{ value: A\.frame, list: frames/);
  assert.match(PAGE, /"全部 " \+ HOME_PHOTO_FRAMES\.length \+ " 种 ›"/);
  assert.match(PAGE, /!decorFrameAll \?/, "展开之后那个按钮该自己走掉");
  // 网格自己要认这个子集；不传就照旧全画（别的调用点不受影响）
  const grid = cut("function HomePhotoFrameGrid(", "function HomePhotoSlotEditor(");
  assert.match(grid, /\{ value, onChange, list \}/);
  assert.match(grid, /\(list \|\| HOME_PHOTO_FRAMES\)\.map/);
});

test("按钮钉在底下，不用把整页滚到尽头才够得着", () => {
  const foot = PAGE.slice(PAGE.indexOf("// 按钮钉在底下"));
  assert.match(foot, /paddingBottom: "calc\(env\(safe-area-inset-bottom\) \* 0\.4 \+ 14px\)"/,
    "底部安全区只吃 0.4 条（mobile-ui-layout §2）");
  // 新建按「放到桌面上」，重改按「保存」——同一颗键，两种活
  assert.match(foot, /if \(A\.isNew\) addDecoration\(\); else \{ saveStyleDecoration\(\); setStyleKey\(null\); setDecorStep\("what"\); \}/);
  assert.match(foot, /A\.isNew \? "放到桌面上" : "保存"/);
});

test("退出这一页要把草稿和摊开的那一段一起清干净", () => {
  assert.match(PAGE, /if \(A\.isNew\) \{ setShowDecorLibrary\(false\); resetDecorDraft\(\); \} else setStyleKey\(null\);/);
  assert.match(PAGE, /setDecorStep\("what"\); setDecorFrameAll\(false\);/);
});
