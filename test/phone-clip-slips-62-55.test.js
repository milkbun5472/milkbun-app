// v62.55 审美审计（2026-09-04）点名剪贴板：
// 「注释『一叠纸条』，实物是暗底圆角卡 + 左色边；纸条的纸边、叠、撕口一样没有。」
//
// 判据：这一页原样搬到别的 app 里还成立，它就是坏了。
// 暗底 + 圆角 12 的卡 + 左边一道色边，搬到任何一个深色列表都成立；
// 纸色方角、歪着叠、底边撕口、别一枚回形针——只有一叠纸条会长成这样。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const SRC = fs.readFileSync("js/phone.js", "utf8");
const NOC = SRC.split("\n").map(l => l.split("//")[0]).join("\n");
const CV = SRC.slice(SRC.indexOf("// ── 剪贴板：一叠纸条"), SRC.indexOf("// 浏览器 —— 仿真浏览器"));
const CVC = CV.split("\n").map(l => l.split("//")[0]).join("\n");

test("每一条就是一张纸：纸色、方角、歪着叠", () => {
  assert.match(CVC, /const CLIP_PAPER = "#f2ece0"/);
  // 纸没有圆角。borderRadius 12 的卡是通用列表项。
  assert.doesNotMatch(CVC, /borderRadius: 12/, "又做回圆角卡了");
  assert.match(CVC, /borderRadius: 2/);
  assert.match(CVC, /transform: "rotate\(" \+ tilt \+ "deg\)"/, "叠不齐才像一叠纸");
});

test("底边是撕口，而且是确定性的——不许刷一次换一个形状", () => {
  assert.match(CVC, /const clipTorn = seed =>/);
  assert.match(CVC, /Math\.sin\(\(k \+ 1\) \* 12\.9898 \+ seed \* 78\.233\)/, "撕口得由 seed 定死");
  assert.doesNotMatch(CVC, /Math\.random/, "随机撕口每次重渲染都不一样，纸会自己抖");
  // ⚠️坐标全用百分比：polygon 里塞 calc() 在老一点的 WebKit 上整块静默失效，
  //   纸条会变回齐口的方块，而且不报错。
  const fn = CV.slice(CV.indexOf("const clipTorn"), CV.indexOf("function ClipPin"));
  assert.doesNotMatch(fn, /calc\(/);
  // Safari 还认不认 clipPath 不带前缀两说，所以【每一处】都要配一个带前缀的。
  // ⚠️只断言「出现过一次」是不够的：有两处撕口（列表里的纸条、详情那整张），
  //   漏掉其中一处时那一条断言照样绿（变异验证时正是这么漏过去的）。
  assert.equal((CVC.match(/WebkitClipPath: clipTorn\(/g) || []).length,
    (CVC.match(/[^t]clipPath: clipTorn\(/g) || []).length,
    "有 clipPath 没配 -webkit- 前缀");
});

test("回形针是程序画的 SVG，不是 emoji", () => {
  assert.match(CVC, /function ClipPin\(/);
  assert.match(CVC, /d: "M17 7\.5/);
  // 📎 这类在她机器上会渲成豆腐块。
  // ⚠️查的是【去掉注释之后】的正文：注释里正要写「别用 📎」，拿原文查会把自己抓进去。
  // ⚠️展开必须用 [...str]：.split("") 会把四字节字符拆成两半代理，两半都不在判定区间里，
  //   这条断言就成了永远抓不到 emoji 的空转。
  const emoji = [...CVC].some(ch => ch.codePointAt(0) > 0x1F000);
  assert.ok(!emoji, "剪贴板里混进了 emoji");
});

test("详情是整页，不是半窗（no-half-sheet）", () => {
  // 原来是从底下掀起来的半窗：圆角 20px 20px 0 0 + 遮罩 + maxHeight 82%。
  // 这一层是一整段他复制下来的话，三行说不完，也不需要同时看见底下那一列。
  assert.doesNotMatch(CVC, /borderRadius: "20px 20px 0 0"/);
  assert.doesNotMatch(CVC, /maxHeight: "82%"/);
  assert.doesNotMatch(CVC, /flex flex-col justify-end/);
  assert.match(CVC, /className: "absolute inset-0 h-full min-h-0 flex flex-col"/);
  // 整页就得有自己的返回键（40px 可点区），不能只剩一个 ✕
  assert.match(CVC, /h\(Head, \{ zh: isHeld \? "没发出去的那张" : "复制过的那张"[\s\S]{0,140}onBack: \(\) => setOpen\(null\)/);
});

test("分栏名不做成英文眉标", () => {
  assert.doesNotMatch(CVC, /'Archivo'/);
  assert.match(CVC, /"差一点就发出去"/);
});
