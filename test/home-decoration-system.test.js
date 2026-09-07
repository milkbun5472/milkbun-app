const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

// ⚠️锚点改了（v63.78，她：「增加装饰那一页整理一下吧，越加越多有点难看」）：
//   做装饰那一页从半窗改成了整页（no-half-sheet.md），所以不再有
//   `showDecorLibrary && h(Sheet`。钉的仍是同一段，只是它现在的开头长这样。
// ⚠️锚点／口径改了（v63.82，她：「放了的装饰的重新设置页面还是乱。然后设置的时候
//   没有选大小」）：新建和重改本来是两份代码（同一套外观控件写了两遍），
//   现在合成一页——页内不再直接读 decorDraft*／styleDecor*，一律走适配器 A.*，
//   开头那一行也变成「新建 或 长按的是装饰」。钉的仍是同一件事。
function between(a, b) {
  const i = comp.indexOf(a);
  const j = comp.indexOf(b, i);
  assert.ok(i >= 0 && j > i, `找不到代码段：${a}`);
  return comp.slice(i, j);
}

test("桌面装饰把内容、样式与位置分开持久化", () => {
  const home = between("function Home({", "// 主页名片");
  assert.match(home, /x_homeDecorations/);
  assert.match(home, /x_homeWidgetStyles/);
  assert.match(home, /x_homeWidgetSizes/);
  assert.match(home, /x_homeLayout/);
  assert.match(home, /imgToVault\(data\)/, "照片必须进现有图片金库，不能把大图硬塞进桌面 JSON");
});

test("组件库只给还在用的那几种装饰，退役的三种不再出现在挑选里", () => {
  const library = between('(showDecorLibrary || (styleKey && REG[styleKey] && (REG[styleKey].kind === "decor" || REG[styleKey].kind === "widget"))) && (function () {', "// 主页名片");
  // v62.28 她 2026-09-04：「删吧宝宝」——信封／录音磁带／小物陈列盒退役。
  // 退役＝挑不到，不是抠掉：已经摆在桌面上的那几件还得画得出来，否则当场变白框。
  assert.match(library, /homeDecorPickable\(\)\.map/);
  assert.match(comp, /const HOME_DECOR_RETIRED = \{ letter: 1, cassette: 1, trinket: 1 \}/);
  for (const id of ["letter", "cassette", "trinket"]) {
    assert.match(comp, new RegExp(`if \\(item\\.type === "${id}"\\)`), `${id} 退役了也得留着渲染，老桌面不能变白框`);
  }
  for (const [id, name] of [["photo", "照片框"], ["quote", "字句卡"], ["date", "日期签"], ["ticket", "票根夹"], ["letter", "信封"], ["note", "便利贴"], ["cassette", "录音磁带"], ["trinket", "小物陈列盒"]]) {
    assert.match(comp, new RegExp(`id: "${id}"[\\s\\S]*?name: "${name}"`));
  }
  assert.match(library, /放到桌面上/);
  assert.match(comp, /if \(it\.which === "photo"\) return \[2, 2\]/);
  assert.match(comp, /if \(it\.which === "quote"\) return \[4, 1\]/);
  assert.match(comp, /if \(it\.which === "ticket" \|\| it\.which === "cassette"\) return \[4, 1\]/);
  assert.match(comp, /if \(it\.which === "letter" \|\| it\.which === "note" \|\| it\.which === "trinket"\) return \[2, 2\]/);
  assert.doesNotMatch(library, /multiple: true/, "多格相框必须逐格选图，不能再要求一次选满");
  assert.match(library, /HomePhotoSlotEditor/);
  assert.match(library, /照片可以先不放/);
  for (const id of ["single", "film3", "fan3", "torn4", "contact6", "envelope", "evidence2", "audioPhoto", "booth4", "window4", "postcard2", "locket2", "magazine3", "route3", "drawer4", "timeline5"]) {
    assert.match(comp, new RegExp(`id: "${id}"`));
  }
});

test("五种生活装饰各有独立骨架和可编辑副文案", () => {
  const render = between("function HomeDecorItem", "function HomePresetGrid");
  const home = between("function Home({", "// 主页名片");
  for (const type of ["ticket", "letter", "note", "cassette", "trinket"]) {
    assert.match(render, new RegExp(`item\\.type === "${type}"`), `${type} 必须有自己的桌面骨架，不能只换名字`);
  }
  assert.match(render, /ADMIT ONE/);
  assert.match(render, /item\.detail/);
  assert.match(home, /decorDraftDetail/);
  assert.match(home, /styleDecorDetail/);
  assert.match(home, /homeDecorHasDetail/);
  assert.match(home, /detail:/);
});

test("新增照片墙各有独立骨架且多格编辑器每行最多三格", () => {
  const frames = between("const HOME_PHOTO_FRAMES", "function homePhotoSlotCount");
  const render = between("function HomeDecorItem", "function HomePresetGrid");
  const editor = between("function HomePhotoSlotEditor", "function Home({");
  assert.match(frames, /id: "torn4"[\s\S]*need: 4/);
  assert.match(frames, /id: "contact6"[\s\S]*need: 6/);
  assert.match(frames, /id: "envelope"[\s\S]*need: 1/);
  assert.match(frames, /id: "evidence2"[\s\S]*need: 2/);
  assert.match(frames, /id: "audioPhoto"[\s\S]*need: 1/);
  for (const frame of ["torn4", "contact6", "envelope", "evidence2", "audioPhoto"]) {
    assert.match(render, new RegExp(`frame === "${frame}"`), `${frame} 不能只是名单，必须有自己的桌面骨架`);
  }
  assert.match(editor, /Math\.min\(3, photos\.length\)/,
    "四格和六格相框的编辑器不能挤成一整行");
});

test("第二批照片墙覆盖竖条、窗格、明信片和吊坠四种新构图", () => {
  const frames = between("const HOME_PHOTO_FRAMES", "function homePhotoSlotCount");
  const render = between("function HomeDecorItem", "function HomePresetGrid");
  for (const [frame, need] of [["booth4", 4], ["window4", 4], ["postcard2", 2], ["locket2", 2]]) {
    assert.match(frames, new RegExp(`id: "${frame}"[\\s\\S]*need: ${need}`));
    assert.match(render, new RegExp(`frame === "${frame}"`), `${frame} 必须有独立骨架，不能只换名字`);
  }
  assert.match(render, /PHOTO BOOTH/);
  assert.match(render, /wish you were here/);
  assert.match(render, /radial-gradient\(circle at 50% 45%/);
});

test("第三批照片墙提供杂志、旅行、收藏柜与时间轴骨架", () => {
  const frames = between("const HOME_PHOTO_FRAMES", "function homePhotoSlotCount");
  const render = between("function HomeDecorItem", "function HomePresetGrid");
  for (const [frame, need] of [["magazine3", 3], ["route3", 3], ["drawer4", 4], ["timeline5", 5]]) {
    assert.match(frames, new RegExp(`id: "${frame}"[\\s\\S]*need: ${need}`));
    assert.match(render, new RegExp(`frame === "${frame}"`), `${frame} 必须有自己的构图分支`);
  }
  assert.match(render, /WEEKEND/);
  assert.match(render, /CABINET OF MOMENTS/);
  assert.match(render, /timelinePos/);
});

test("照片墙允许空框落桌并按槽位逐张补图", () => {
  const home = between("function Home({", "// 主页名片");
  const slots = between("function HomePhotoSlotEditor", "function Home({");
  assert.match(comp, /function normalizeHomePhotoSlots/,
    "空槽必须被规范化保留，不能被稀疏数组吞掉");
  assert.match(slots, /onPick\(file, i\)/);
  assert.match(slots, /onClear\(i\)/);
  assert.match(home, /next\[slot\] = ref/,
    "放入一张照片时只能改目标槽位");
  assert.match(home, /next\[slot\] = ""/,
    "清空一张照片时只能改目标槽位");
  // ⚠️新建和重改合成一页之后，两边都从适配器取照片：钉的是「造装饰的时候一定规范化槽位」
  assert.match(home, /normalizeHomePhotoSlots\(A\.photos, A\.frame\)/,
    "造装饰的时候没规范化槽位，空框会被稀疏数组吞掉");
  assert.match(home, /photos: isNew \? decorDraftPhotos : styleDecorPhotos/,
    "适配器没把两边的照片都接上");
  assert.doesNotMatch(home, /这个相框需要选 3 张照片/,
    "空框不应被照片数量校验拦住");
});

test("预设不是只换颜色：至少六套并包含几何、边框、材质和留白", () => {
  const presets = between("const HOME_WIDGET_PRESETS", "function HomeDecorItem");
  for (const id of ["native", "soft", "paper", "polaroid", "film", "editorial"]) {
    assert.match(presets, new RegExp(`id: "${id}"`));
  }
  assert.match(presets, /borderRadius/);
  assert.match(presets, /padding/);
  assert.match(presets, /boxShadow/);
  assert.match(presets, /backdropFilter/);
});

test("长按旧组件或装饰开换皮；普通 App 仍进原来的整理模式", () => {
  const gestures = between("const onTS =", "const onTM =");
  assert.match(gestures, /kindOf\(key\) === "widget" \|\| kindOf\(key\) === "decor"/);
  assert.match(gestures, /openStylePanel\(key\)/);
  assert.match(gestures, /else pickUp\(\)/, "普通 App/文件夹的长按整理链不能被装饰面板劫持");
  // ⚠️口径又改了（v65.08）：组件那张半窗撤了，长按组件和长按装饰进的是【同一页】。
  //   她 2026-09-06：「普通组件没跟上还是用的旧版还缺了很多功能，你把组件的也连上去吧」。
  assert.ok(comp.indexOf('REG[styleKey].kind !== "decor" && h(Sheet') < 0, "组件那张半窗又回来了");
  const decorPage = between('(showDecorLibrary || (styleKey && REG[styleKey] && (REG[styleKey].kind === "decor" || REG[styleKey].kind === "widget"))) && (function () {', "// 主页名片");
  ["整理位置", "占格尺寸".slice(2), "在格子里靠哪儿"].forEach(x =>
    assert.ok(decorPage.indexOf(x) > 0, "从半窗搬过来时漏了一栏：" + x));
  assert.match(decorPage, /A\.isWidget \? "好了" : A\.isNew \? "放到桌面上" : "保存"/);
  assert.match(decorPage, /移除这件装饰/);
});

test("装饰不是固定皮肤：内容、透明底、无边框、强调色和角标都能编辑并持久化", () => {
  const materials = between("const HOME_DECOR_SURFACES", "const HOME_PHOTO_FRAMES");
  const home = between("function Home({", "// 主页名片");
  // ⚠️口径改了（v63.82）：新建和重改现在是同一页，所以「两处都得有」变成「那一页里有，
  //   而且两边都从适配器取」——外观那一套控件全库只许出现一次（见 decor-one-editor）。
  const decorPage = between('(showDecorLibrary || (styleKey && REG[styleKey] && (REG[styleKey].kind === "decor" || REG[styleKey].kind === "widget"))) && (function () {', "// 主页名片");

  assert.match(materials, /id: "transparent", name: "透明底"/);
  assert.match(materials, /id: "none", name: "无边框"/);
  assert.match(materials, /surface === "transparent"[\s\S]*background: "transparent"/,
    "透明底必须真的写进渲染样式，不能只是一个没接线的选项");
  assert.match(materials, /borderMode === "none"[\s\S]*style\.border = "none"/,
    "无边框必须真的清掉边线");
  assert.match(comp, /function HomeDecorAppearanceEditor/);
  assert.match(decorPage, /HomeDecorAppearanceEditor/, "那一页里没有材质编辑器");
  assert.match(home, /surface: isNew \? decorDraftSurface : styleDecorSurface/, "重改那一支没接上材质");
  // ⚠️口径改了（v63.82）：这几项不再各写一遍，一律由适配器分流、由同一个 builder 落档。
  //   钉的是【两边都接上了】和【真的存下去了】。
  [["surface", "Surface"], ["borderMode", "BorderMode"], ["accent", "Accent"], ["align", "Align"], ["badge", "Badge"]].forEach(function (pair) {
    assert.match(home, new RegExp(pair[0] + ": isNew \\? decorDraft" + pair[1] + " : styleDecor" + pair[1]),
      "适配器里少了一项：" + pair[0]);
  });
  assert.match(home, /surface: A\.surface, borderMode: A\.borderMode, accent: A\.accent/, "builder 没把材质写进去");
  assert.match(home, /badge: String\(A\.badge \|\| ""\)\.trim\(\)/);
  // ⚠️口径改了（v63.72）：多传了一个【当前外观 id】。挑了「无框」之后，
  //   这一层那几行是无条件给 style.border 赋值的（borderMode 默认「细边」），
  //   不告诉它现在是无框的话，卡刚被撤掉、边框转头又被这一层画回来。
  assert.match(home, /homeDecorMaterialStyle\(look, t, presetId\)/,
    "保存后的材质设置必须进入桌面渲染链");
  assert.match(home, /if \(look\.badge\) \{/);   // v65.08：角标那一层组件也走同一条
  assert.match(comp, /function homeDecorHasDetail\(type\) \{\s*return type !== "photo";/,
    "除照片框外的小物都应能编辑正文与副文案");
});

test("装饰可以独立倾斜：自然预设、细调、持久化与防裁切全部接通", () => {
  const materials = between("const HOME_DECOR_SURFACES", "const HOME_PHOTO_FRAMES");
  const home = between("function Home({", "// 主页名片");
  const editor = between("function HomeDecorAppearanceEditor", "function Home({");

  for (const value of [-8, -4, 0, 4, 8]) {
    assert.match(materials, new RegExp(`value: ${value}`), `缺少 ${value}° 的自然摆放预设`);
  }
  assert.match(materials, /Math\.max\(-12, Math\.min\(12/,
    "自定义角度必须有安全范围，避免装饰翻出桌面");
  assert.match(materials, /transform: "rotate\(" \+ tilt \+ "deg\)"/,
    "角度必须进入装饰内层渲染，而不是只存在设置里");
  assert.match(editor, /type: "range", min: -12, max: 12, step: 1/);
  assert.match(editor, /aria-label": "微调装饰倾斜角度"/);
  // ⚠️口径同上（v63.82）：倾斜也走适配器 + 同一个 builder
  assert.match(home, /tilt: isNew \? decorDraftTilt : styleDecorTilt/);
  assert.match(home, /tilt: normalizeHomeDecorTilt\(A\.tilt\)/, "builder 没把倾斜写进去");
  assert.match(home, /setStyleDecorTilt\(normalizeHomeDecorTilt\(d\.tilt\)\)/,
    "旧装饰再次打开时必须读回自己的角度");
  assert.match(home, /overflow: it\.kind === "decor" \? "visible"/,
    "装饰旋转后不得被占格边缘裁掉四角");
  assert.match(home, /transform: isDrag \? "scale\(1\.08\)"/,
    "拖动缩放应继续留在网格外层，与装饰旋转互不覆盖");
});

test("所有组件与装饰共用独立尺寸轴，音乐会按短条或方块重排", () => {
  const home = between("function Home({", "// 主页名片");
  for (const id of ["auto", "short", "square", "wide", "large"]) {
    assert.match(comp, new RegExp(`id: "${id}"`));
  }
  assert.match(home, /homeItemSpan\(key, it, widgetSizes\)/,
    "布局测量和渲染必须读取同一份尺寸设置");
  assert.match(home, /homeSize: homeSize/);
  const music = between("function MusicWidget", "// 全局悬浮迷你播放器");
  assert.match(music, /homeSize === "short"/);
  assert.match(music, /homeSize === "square"/);
});

test("主屏安全区与唯一根布局铁律未被装饰系统改写", () => {
  const home = between("function Home({", "// 主页名片");
  assert.match(home, /height: "100vh"/);
  assert.match(home, /className: "relative flex-1 min-h-0 overflow-hidden pt-3 flex flex-col"/);
  assert.match(home, /top: "calc\(env\(safe-area-inset-top\) \+ 10px\)"/,
    "编辑态装饰入口必须跟随主屏自己的安全区公式");
});
