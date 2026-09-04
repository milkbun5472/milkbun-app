// v62.59 审美审计（2026-09-04）：查手机的子页里有 8 处是半窗，其中 7 处按 no-half-sheet
// 就该是整页——「凡是掀半窗的子页，没有一处是合格的，因为半窗那一层压根没地方放
// 题材元素」。（第 8 处是主屏切换角色，选一下就走，合法。）
//
// 这一版把那 7 处一次改完，而且共用【一个】整页外壳：
// 一处一份地各写各的，五处迟早长成五个样子——这个仓库里「一层写在两处」犯过很多次。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const SRC = fs.readFileSync("js/phone.js", "utf8");
const NOC = SRC.split("\n").map(l => l.split("//")[0]).join("\n");

test("整页外壳只有一份，七处都用它", () => {
  assert.match(NOC, /function PhoneSubPage\(\{ bg, ink, title, onClose, right, children \}\)/);
  // 剪贴板和想买详情有自己的皮（纸/册页），另外五处走共用壳
  assert.ok((NOC.match(/h\(PhoneSubPage, \{/g) || []).length >= 5,
    "共用壳的用处不到五处，说明有人又自己写了一份");
  // 壳自己得是整页：h-full + 自己的滚动区
  const fn = NOC.slice(NOC.indexOf("function PhoneSubPage("), NOC.indexOf("function PGlyph("));
  assert.match(fn, /className: "absolute inset-0 h-full min-h-0 flex flex-col"/);
  assert.match(fn, /className: "flex-1 min-h-0 overflow-y-auto"/);
  // 返回键 40px 可点区（mobile-ui-layout §1）
  assert.match(fn, /"aria-label": "返回"[\s\S]{0,180}width: 40, height: 40/);
});

test("从底下掀起来的那种半窗，phone.js 里一处不剩", () => {
  // 「半窗」判的是【从屏幕底下掀起来、只占下半屏】那一种：
  //   遮罩 justify-end + 面板上圆角 20/20/0/0。
  // ⚠️别把【居中的模态卡】也扫进来：阅读的一本书（书签 + 骑缝）和便签的一张
  //   （真的一张便利贴）审计判的是【合格】——它们是居中的卡，不是掀起来的半窗，
  //   而且卡本身就是题材元素。一刀切会把两处合格的页面误伤掉。
  assert.doesNotMatch(NOC, /"absolute inset-0 flex flex-col justify-end"/);
  assert.doesNotMatch(NOC, /borderRadius: "20px 20px 0 0"/);
  // 掀起来那一层专用的底部安全区补丁也该跟着走干净
  assert.doesNotMatch(NOC, /paddingBottom: "calc\(env\(safe-area-inset-bottom\) \* 0\.4 \+ 20px\)"/);
});

test("时间线详情不再借通用 Sheet", () => {
  const tv = NOC.slice(NOC.indexOf("function TimelineView("), NOC.indexOf("function StickyView(") > 0 ? NOC.indexOf("function StickyView(") : NOC.length);
  assert.doesNotMatch(tv.slice(0, tv.indexOf("\nfunction ")), /h\(Sheet,/);
});

test("浏览器详情里那把锁是画出来的，不是 emoji", () => {
  const bv = NOC.slice(NOC.indexOf("const detail = open && !open._search"), NOC.indexOf("const PAGES = [\n    { key: \"tabs\""));
  // ⚠️展开必须用 [...str]：.split("") 会把四字节字符拆成两半代理，
  //   两半都不在判定区间里，这条断言就成了空转。
  assert.ok(![...bv].some(ch => ch.codePointAt(0) > 0x1F000), "详情里还有 emoji");
  assert.match(bv, /h\("rect", \{ x: 0\.9, y: 5\.2/);
});
