// 她 2026-09-05：「放了的装饰的重新设置页面还是乱。然后设置的时候没有选大小」。
// 两件事同一个根：**新建和重改本来是两份代码**。新建那一页刚整理成整页四段，
// 重改那一页还是老半窗，而且外观那一整套控件在两处各写了一遍——
// 一层写在两处，改一处另一处必然落单：新建挑得到「无框」和「这一件的底」而重改挑不到，
// 重改挑得到尺寸而新建挑不到。她两条抱怨正好各命中一半。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const bare = s => s.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
const cut = (from, to) => comp.slice(comp.indexOf(from), comp.indexOf(to, comp.indexOf(from)));
const PAGE = cut('(showDecorLibrary || (styleKey && REG[styleKey] && REG[styleKey].kind === "decor")) && (function () {', "\n}\n// 主页名片");

test("新建和重改是同一页，不是两份代码", () => {
  assert.match(comp, /\(showDecorLibrary \|\| \(styleKey && REG\[styleKey\] && REG\[styleKey\]\.kind === "decor"\)\) && \(function \(\) \{/);
  assert.match(PAGE, /var A = decorAdapter\(showDecorLibrary \? "new" : "edit"\);/);
  assert.match(PAGE, /A\.isNew \? "做一件装饰" : "改这件装饰"/);
  assert.match(PAGE, /A\.isNew \? "放到桌面上" : "保存"/);
  // 那一整套外观控件只许出现一次
  assert.equal((bare(comp).match(/h\(HomeDecorAppearanceEditor/g) || []).length, 1, "外观那一套又被抄成了两份");
  assert.equal((bare(comp).match(/h\(HomePhotoFrameGrid/g) || []).length, 1, "相框网格又被抄成了两份");
  assert.equal((bare(comp).match(/h\(HomePhotoSlotEditor/g) || []).length, 1, "照片槽位又被抄成了两份");
});

test("装饰不再走那张半窗；普通组件照旧走，而且只剩组件那几栏", () => {
  assert.match(comp, /styleKey && REG\[styleKey\] && REG\[styleKey\]\.kind !== "decor" && h\(Sheet/);
  const sheet = cut('REG[styleKey].kind !== "decor" && h(Sheet', "\n  (showDecorLibrary ||");
  assert.ok(sheet.indexOf("HomeDecorAppearanceEditor") < 0, "半窗里还留着装饰那套控件");
  assert.ok(sheet.indexOf("移除这件装饰") < 0);
  assert.ok(sheet.indexOf("HomePhotoFrameGrid") < 0);
  // 组件那几栏一样都不能少
  ["占格尺寸", "在格子里靠哪儿", "外观样式", "整理位置"].forEach(x =>
    assert.ok(sheet.indexOf(x) > 0, "组件那一支少了一栏：" + x));
  // 组件才有「原生」那一款
  assert.match(sheet, /allowNative: true/);
});

test("适配器：新建读草稿，重改读已存的那一份", () => {
  const A = cut("function decorAdapter(mode) {", "\n  }\n  // ⚠️装饰长什么样");
  assert.match(A, /var isNew = mode === "new";/);
  assert.match(A, /type: isNew \? decorDraftType : \(REG\[key\] \|\| \{\}\)\.which/);
  // 外观和尺寸：重改时是【当场落档】的，那两样本来就不用按保存
  assert.match(A, /preset: isNew \? decorDraftPreset : \(widgetStyles\[key\] \|\| "soft"\)/);
  assert.match(A, /size: isNew \? decorDraftSize : \(widgetSizes\[key\] \|\| "auto"\)/);
  assert.match(A, /setPreset: isNew \? setDecorDraftPreset : function \(id\) \{ setWidgetPreset\(key, id\); \}/);
  assert.match(A, /setSize: isNew \? setDecorDraftSize : function \(id\) \{ setWidgetSize\(key, id\); \}/);
  // ⚠️已经放上去的不给换类型：换了就不是原来那件东西了
  assert.match(A, /setType: isNew \? function \(id\)/);
  assert.match(A, /: null,/);
  assert.match(PAGE, /A\.setType \? h\("div"/, "重改那一页还摆着换类型的格子");
  assert.match(PAGE, /"这是一件已经摆上去的" \+ meta\.name \+ "。想换成别的东西，就再做一件新的。"/);
});

test("造装饰只此一处：预览、放上去、改完存，三处同一个 builder", () => {
  assert.match(comp, /function decorItemOf\(A, id\) \{/);
  assert.equal((bare(comp).match(/decorItemOf\(/g) || []).length, 4, "造装饰的口子不止一个，或有一处没用它");
  assert.match(PAGE, /var PV = decorItemOf\(A, "__preview"\);/);
  assert.match(comp, /var item = decorItemOf\(decorAdapter\("new"\), id\);/);
  assert.match(comp, /var next = decorItemOf\(decorAdapter\("edit"\), styleKey\);/);
  // ⚠️改完存的时候 id / type / createdAt 不许被盖：这一件还是那一件
  assert.match(comp, /delete next\.id; delete next\.type; delete next\.createdAt;/);
});

test("多大：新建那一页原来压根没有这一段", () => {
  assert.match(PAGE, /section\("size", "4", "多大", sizeName,/);
  assert.match(PAGE, /h\(HomeSizeGrid, \{ value: A\.size \|\| "auto", onChange: A\.setSize \}\)/);
  assert.match(comp, /const \[decorDraftSize, setDecorDraftSize\] = useState\(""\)/);
  // 新建时多一颗「自动」——没挑过就按类型/相框推一个
  assert.match(PAGE, /A\.isNew \? h\("button", \{ onClick: function \(\) \{ A\.setSize\(""\); \}/);
  // ⚠️她明说的选择不许被自动那一路盖掉
  assert.match(comp, /if \(decorDraftSize\) setWidgetSizes/);
  assert.match(comp, /else if \(decorDraftType === "photo" && decorDraftFrame !== "single"\)/);
  assert.match(comp, /else if \(decorDraftType !== "photo" && decorDraftType !== "quote"/);
  // 竖的那几款得说清挑哪一档
  assert.match(PAGE, /书签和挂轴那几款是竖的，挑「竖条」「竖块」才立得住。/);
  // 退出时草稿尺寸也要清
  assert.match(comp, /setDecorDraftGround\(null\); setDecorDraftSize\(""\);/);
});

test("竖着的那几款给一张高一点的台子，别把挂轴切掉半截", () => {
  assert.match(PAGE, /var tallOne = !!\(HOME_PHOTO_FRAMES_TALL\[A\.frame\] \|\| A\.type === "bookmark" \|\| A\.type === "scroll"\);/);
  assert.match(PAGE, /height: tallOne \? 186 : 132/);
  assert.match(PAGE, /width: tallOne \? 96 : 208/);
});

test("四段收起来都写着自己现在是什么", () => {
  ['section("what", "1", "是什么"', 'section("words", "2", "写什么"', 'section("look", "3", "什么样子"', 'section("size", "4", "多大"']
    .forEach(x => assert.ok(PAGE.indexOf(x) > 0, "少了一段：" + x));
  assert.match(PAGE, /var sizeName = A\.size \? \(\(HOME_SIZE_PRESETS\.find/);
  assert.match(PAGE, /: "自动";/);
  assert.match(PAGE, /presetName \+ " · 底" \+ groundName/);
});
