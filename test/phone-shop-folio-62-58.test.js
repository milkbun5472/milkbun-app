// v62.58 审美审计（2026-09-04）点名购物：
// 「把电商骨架拆干净了（不画券、不画会员、不画白卡），但说好的『册页』一个元素都没
//   长出来：冷青渐变纸 + 细线清单 + 两列渐变卡 + 图标底栏，换成任何清单 app 都成立。」
//
// 判据：这一页原样搬到别的 app 里还成立，它就是坏了。
// 渐变底、圆角白卡、填色药丸标签、两列缩略图，搬到哪儿都成立；
// 毛边纸的帘纹、双边栏的版框、界行、墨围、朱砂圈、叶码——只有册页会长成这样。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const SRC = fs.readFileSync("js/phone.js", "utf8");
const nocom = x => x.split("\n").map(l => l.split("//")[0]).join("\n");
const SV = SRC.slice(SRC.indexOf("function ShoppingView("), SRC.indexOf("// 外卖 —— 他怎么把自己喂饱"));
const SVC = nocom(SV);

test("底子是毛边纸，不是一层渐变", () => {
  assert.match(nocom(SRC), /const SHOP_LAID = "repeating-linear-gradient\(90deg/, "帘纹没了");
  // 底纹铺在【最外那层外壳】上（mobile-ui-layout §3.5），不是铺在滚动区。
  // ⚠️两处外壳（主页、想买详情）都要铺——只断言「出现过一次」的话，
  //   漏掉其中一处照样绿（变异验证时正是这么漏过去的）。
  assert.equal((SVC.match(/backgroundImage: SHOP_LAID/g) || []).length, 2, "有一处外壳没铺纸");
  assert.match(SVC, /className: "h-full min-h-0 flex flex-col relative",[\s\S]{0,400}backgroundImage: SHOP_LAID/);
  // ⚠️内容在动，纸不该跟着动
  assert.doesNotMatch(SVC, /backgroundAttachment/);
  assert.doesNotMatch(SVC, /linear-gradient\(178deg/, "那层冷青渐变还在");
});

test("版框：外粗内细的双边栏，钉着不跟着滚", () => {
  // 一页册子最认得出的记号就是这道框。它属于【这一叶】，所以在滚动区外面。
  assert.match(SVC, /border: "0\.8px solid " \+ SHOP_FRAME, boxShadow: "0 0 0 2\.5px " \+ SHOP_BG \+ ", 0 0 0 4px " \+ SHOP_FRAME/);
  // 框在外、滚在内。⚠️框那一层自己不许滚——它滚起来版框就跟着内容跑上去了。
  // 主页和详情各有一道框，两道都得是「不滚的那种」，所以按出现次数配对着数。
  const frames = SVC.match(/className: "flex-1 min-h-0 flex flex-col",\n\s*style: \{ margin: "2px 13px 10px"/g) || [];
  assert.equal(frames.length, 2, "两道版框（主页 + 想买详情）没都用不滚的那一层包住");
});

test("一直没下手的那几样不摆货架：一条一样 + 朱砂圈", () => {
  const w = SV.slice(SV.indexOf("// ── 一直没下手的"), SV.indexOf("// ── 我的订单 ──"));
  assert.doesNotMatch(nocom(w), /grid-cols-2/);
  assert.doesNotMatch(nocom(w), /linear-gradient/);
  assert.match(nocom(w), /border: "1\.4px solid " \+ SHOP_MARK/);
  // 那张封面色表连同用法一起删了，不是留着不用
  assert.doesNotMatch(nocom(SRC), /WISH_COVERS/);
});

test("纸上不许再叠白色圆角卡：改成墨围和界行", () => {
  assert.doesNotMatch(nocom(SRC), /SHOP_CARD/, "白卡色还留着，迟早有人再拿它铺一张卡");
  assert.doesNotMatch(nocom(SRC), /SHOP_SOFT/, "浅底色同理");
  // 要跳出来的一段用墨围（细线框，方角）
  assert.match(SVC, /const card = \(kids, extra\) => h\("div", \{ style: Object\.assign\(\{ border: "1px solid " \+ SHOP_FRAME, borderRadius: 0/);
  // 标签是方角小签，不是填色药丸
  assert.doesNotMatch(SVC, /borderRadius: 7, padding: "3px 9px"/);
});

test("节标题压着一道界行，不是 21px 大标题", () => {
  assert.match(SVC, /const secTitle = \(title, right\) =>[\s\S]{0,260}borderBottom: "1px solid " \+ SHOP_FRAME/);
  assert.doesNotMatch(SVC, /fontFamily: F_DISPLAY, fontSize: 21, color: SHOP_INK \} \}, title\)/);
});

test("每一叶底下有叶码，用中文数字", () => {
  assert.match(SVC, /"第 " \+ \(YE\[/);
  assert.match(SVC, /const YE = \["一", "二", "三"/);
});

test("想买详情是整页，不是半窗（no-half-sheet）", () => {
  const d = SV.slice(SV.indexOf("// ── 详情：整页"), SV.indexOf("// 叶码："));
  assert.match(nocom(d), /className: "absolute inset-0 h-full min-h-0 flex flex-col"/);
  assert.doesNotMatch(nocom(d), /justify-end/);
  assert.doesNotMatch(nocom(d), /borderRadius: "20px 20px 0 0"/);
  assert.doesNotMatch(nocom(d), /maxHeight: "84%"/);
  // 整页得有自己的返回键（40px 可点区）
  assert.match(nocom(d), /"aria-label": "返回"[\s\S]{0,170}width: 40, height: 40/);
});
