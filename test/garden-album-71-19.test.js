// 她 2026-09-18 转小红书群里读者 ! YOLO：「我情侣空间的花收下来之后，它那个干花册
// 里面看不到完整的详情文字。能不能点开能够弹出来，或者就是直接展示区更大一些」
//
// 病根：册子那一行给 why 写死了 whiteSpace:"nowrap" + ellipsis——一行截断。
// 而窗台上那盆【正在开的】从来就是整段显示的，所以只有收进册子之后才看不见。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

const garden = () => {
  const i = screens.indexOf("function CoupleGarden("), j = screens.indexOf("function CoupleTrip(", i);
  assert.ok(i > 0 && j > i, "抠不出 CoupleGarden");
  return screens.slice(i, j);
};

test("册子里点开那一枚，理由就地摊开", () => {
  const seg = garden();
  assert.ok(seg.includes("const [openFlower, setOpenFlower] = useState(-1)"), "没有「点开哪一枚」这件事");
  assert.ok(/onClick: \(\) => setOpenFlower\(on \? -1 : i\)/.test(seg), "点第二下该收回去");
  // 摊开时必须换掉那两条截断的样式，光放大字号没用
  assert.ok(/whiteSpace: "pre-wrap", wordBreak: "break-word"/.test(seg), "摊开了却还是一行——长句会撑破册子");
  assert.ok(/textOverflow: "ellipsis", whiteSpace: "nowrap"/.test(seg), "收起时该还是一行带省略号，不然册子没法一眼扫完");
});

// ⚠️点了没反应比不能点更糟
test("没有理由那一句的，不做成按钮", () => {
  const seg = garden();
  assert.ok(/if \(!k\.why\) return h\("div", \{ key: i \}, row\);/.test(seg), "没有 why 也做成了按钮——点了没有第二层");
});

test("摊开的是整段，不是又一层截断", () => {
  const seg = garden();
  // 摊开那一支里不许再出现 slice
  const i = seg.indexOf("const on = openFlower === i;"), j = seg.indexOf("fmtD(k.ts)", i);
  assert.ok(i > 0 && j > i, "抠不出册子那一行");
  assert.ok(!/\.slice\(/.test(seg.slice(i, j)), "册子那一行里又切了一刀");
  // 存进去的那份本来就是全的（上限 80 字在写入那头，读这头不许再切）
  assert.match(app, /why: String\(\(d && d\.why\) \|\| ""\)\.replace\(\/\\s\+\/g, " "\)\.trim\(\)\.slice\(0, 80\)/,
    "写入那头的上限变了——读这头的期望要跟着看一眼");
  assert.match(app, /kept: \[\{ species: g\.species, why: g\.why, color: g\.color, ts: Date\.now\(\) \}/,
    "收进册子时 why 被动过——册子里就永远补不回来了");
});

// 不另开弹层：册子本来就是一册一册翻的，就地摊开最像它自己（no-half-sheet 的同一条道理）
test("没为这件事新开一个弹层", () => {
  const seg = garden();
  assert.ok(!/h\(Sheet,/.test(seg), "为一句话开了个半窗");
  assert.ok(!/appDialogPortal/.test(seg), "为一句话开了个对话框");
});

test("窗台上那盆本来就是整段，这次没碰它", () => {
  const seg = garden();
  const i = seg.indexOf('h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic"');
  assert.ok(i > 0, "窗台上那盆的理由那一行没了");
  const line = seg.slice(i, seg.indexOf("\n", i));
  assert.ok(!/nowrap|ellipsis/.test(line), "把窗台那盆也顺手截断了");
});
