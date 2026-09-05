// v62.64 审美审计（2026-09-04）点名一起读：
// 书架：「一块米白上摆三列圆角卡，**没有搁板、没有架子**，只有卡本身像书」；
// 「和 Ta 讨论」那个 56% 高的半窗直接违 no-half-sheet（正文是一段聊天）。
//
// 判据：这一页原样搬到别的 app 里还成立，它就是坏了。
// 封面本来就是书的样子（书脊色、3/4.3 竖版）——缺的是它站的那个地方。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const SRC = fs.readFileSync("js/read.js", "utf8");
const NOC = SRC.split("\n").map(l => l.split("//")[0]).join("\n");

test("书站在搁板上：三本一排，每排底下压一块板", () => {
  assert.match(NOC, /const shelfBoard = function \(k\) \{/);
  assert.match(NOC, /for \(let i = 0; i < cells\.length; i \+= 3\)/);
  assert.match(NOC, /rows\.push\(shelfBoard\(i\)\)/);
  // 板要有上缘的亮边和下面的厚度，不然就是一条色带
  assert.match(NOC, /linear-gradient\(180deg,rgba\(255,255,255,\.34\) 0 1\.5px/);
});

test("底走 core.js 现成的 wood 纹", () => {
  assert.match(NOC, /pageSkin\("wood", t, \{ strength: \.8 \}\)/);
  assert.match(NOC, /style: shelfPage/);
  assert.match(NOC, /h\(Head, \{ zh: "一起读", onBack: props\.onBack, bg: "transparent" \}\)/);
});

test("空位是书架上空着的一格，不是一条虚线新建按钮", () => {
  assert.doesNotMatch(NOC, /"＋ 上传一本书/);
  assert.match(NOC, /const emptySlot = h\("div", \{ key: "add" \}/);
  assert.match(NOC, /"空着一格"/);
  // ⚠️颜色得从主题里来。pageSkin("wood") 跟着她的主题走，浅主题下那面墙是浅的，
  //   按「木头一定是深的」写死浅色字，在上面等于隐形（第一版就是这样）。
  const slot = NOC.slice(NOC.indexOf("const emptySlot ="), NOC.indexOf("const shelfBoard ="));
  assert.doesNotMatch(slot, /rgba\(243,239,230/);
  assert.match(slot, /border: "1px dashed " \+ t\.line/);
  assert.match(slot, /color: t\.sub/);
});

test("封面上的进度夹在 0~100，不会印出 107%", () => {
  assert.match(NOC, /Math\.max\(0, Math\.min\(100, Math\.round\(\(\(b\.page \|\| 0\)/);
});

test("和 Ta 讨论是整页，不是 56% 的半窗", () => {
  const d = NOC.slice(NOC.indexOf("function DiscussSheet(props)"), NOC.indexOf("function DiscussSheet(props)") + 2200);
  assert.doesNotMatch(d, /height: "56%"/);
  assert.doesNotMatch(d, /borderRadius: "18px 18px 0 0"/);
  assert.doesNotMatch(d, /justifyContent: "flex-end"/);
  // 整页就得自己吃顶部安全区，返回键也要 40px 可点区
  assert.match(d, /padding: "calc\(env\(safe-area-inset-top, 0px\) \+ 12px\) 16px 8px"/);
  assert.match(d, /"aria-label": "返回"[\s\S]{0,140}width: 40, height: 40/);
});
