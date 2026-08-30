const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

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

test("组件库提供照片框、字句卡和日期签", () => {
  const library = between('showDecorLibrary && h(Sheet', "// 主页名片");
  assert.match(library, /\[\["photo", "▣", "照片框"\], \["quote", "“", "字句卡"\], \["date", "31", "日期签"\]\]/);
  assert.match(library, /放到桌面上/);
  assert.match(comp, /if \(it\.which === "photo"\) return \[2, 2\]/);
  assert.match(comp, /if \(it\.which === "quote"\) return \[4, 1\]/);
  assert.doesNotMatch(library, /multiple: true/, "多格相框必须逐格选图，不能再要求一次选满");
  assert.match(library, /HomePhotoSlotEditor/);
  assert.match(library, /照片可以先不放/);
  for (const id of ["single", "film3", "fan3", "torn4", "contact6", "envelope", "evidence2", "audioPhoto", "booth4", "window4", "postcard2", "locket2", "magazine3", "route3", "drawer4", "timeline5"]) {
    assert.match(comp, new RegExp(`id: "${id}"`));
  }
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
  assert.match(home, /normalizeHomePhotoSlots\(decorDraftPhotos, decorDraftFrame\)/,
    "新建空相框也必须保存固定槽位");
  assert.match(home, /normalizeHomePhotoSlots\(styleDecorPhotos, styleDecorFrame\)/,
    "已有相框逐格编辑后必须保存固定槽位");
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
  const sheet = between("styleKey && REG[styleKey]", "showDecorLibrary && h(Sheet");
  assert.match(sheet, /整理位置/);
  assert.match(sheet, /尺寸与外观分开设置，不改组件原来的功能/);
  assert.match(sheet, /占格尺寸/);
  assert.match(sheet, /保存内容/);
  assert.match(sheet, /styleDecorText/);
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
