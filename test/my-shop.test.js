const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const screens = R("screens.js"), app = R("app.js"), components = R("components.js");

// 她 2026-08-29：「做我的 app 的购物看看怎么样弄好点然后把界面做好看可以参考淘宝配色」
test("购物页有自己的一套配色，不跟主题的米白走", () => {
  assert.match(screens, /const MSHOP = \{/);
  const c = screens.match(/const MSHOP = \{[\s\S]*?\n\};/)[0];
  ["orange", "price", "soft", "bg", "card", "ink", "sub", "dim", "line"].forEach(k =>
    assert.ok(c.includes(k + ":"), "缺 " + k));
  // 橙红是这一页的主色（淘宝那套）
  assert.match(c, /orange: "#ff5000"/);
  assert.match(c, /price: "#ff4000"/);
  // 页面底是浅灰的货架，不是米——一片米色就没有购物 app 的样子
  assert.match(c, /bg: "#f4f4f6"/);
});

// 她截图里最明显的浪费：120px 高的图位里，把商品名用斜体又写了一遍
test("商品图位不再把商品名印第二遍", () => {
  const i = screens.indexOf('h("div", { className: "grid grid-cols-2 gap-2.5" }');
  assert.ok(i > 0, "找不到商品流");
  const seg = screens.slice(i, screens.indexOf('h("button", { onClick: () => doGen(true)', i));
  assert.equal((seg.match(/it\.name/g) || []).length, 1, "商品名在一张卡里只该出现一次");
  assert.doesNotMatch(seg, /fontStyle: "italic"[^}]*\}\s*\}, it\.name\)/, "旧的斜体名字图位还在");
  // 图位改成从名字认出来的品类色
  assert.match(seg, /const c = shopTone\(it, gi\)/);
  assert.match(seg, /c\.word \? h\("div"/, "品类标");
});

test("品类色是从商品名里认出来的，和随身物共用同一套认法", () => {
  assert.match(screens, /const shopTone = \(it, i\) => toneFrom\(SHOP_TONES, SHOP_FALLBACK, it, i\)/);
  const F = (() => {
    const pre = screens.slice(screens.indexOf("const clothHex"), screens.indexOf("const clothTone ="));
    const head = screens.slice(screens.indexOf("const MSHOP"), screens.indexOf("const SHOP_CATS"));
    return new Function(pre + head + "\nreturn shopTone;")();
  })();
  const w = n => F({ name: n }, 0).word;
  assert.equal(w("北欧风纯棉四件套 亲肤裸睡级"), "四件套");
  assert.equal(w("冷萃咖啡液 无糖黑咖 30条装"), "咖啡");
  assert.equal(w("小猫形状陶瓷马克杯 带盖勺"), "瓷");
  assert.equal(w("AirPods Pro 2代"), "数码", "命中英文牌子名时该显示中文");
  assert.equal(w("某个说不清是什么的东西"), "", "认不出就别硬安一个品类");
  // 认不出的按次序发兜底色，一屏里不会几件撞成一片
  assert.notEqual(F({ name: "甲" }, 0).base, F({ name: "乙" }, 1).base);
});

test("商品点得进去了——以前只有那颗加购钮能点", () => {
  assert.match(screens, /const \[detail, setDetail\] = useState\(null\)/);
  assert.match(screens, /onClick: \(\) => setDetail\(it\)/, "商品卡没有点开详情");
  // 卡上那颗加购钮不能把点击冒泡到卡片上，否则加完购物车还会弹出详情
  assert.match(screens, /onClick: e => \{ e\.stopPropagation\(\); onAddCart\(it\)/, "加购钮会连带弹出详情");
  const i = screens.indexOf("  const detailEl = detail ? (() => {");
  assert.ok(i > 0, "找不到详情");
  const seg = screens.slice(i, screens.indexOf("\n  })() : null;", i));
  assert.match(seg, /钱包里还有 ¥/, "详情要告诉她买不买得起");
  assert.match(seg, /这件买不起，可以让他代付或用亲属卡/);
  assert.match(seg, /"加入购物车"/);
  assert.match(seg, /"去结算"/);
});

// 和随身物「摆到他面前」是同一个动作语言，但语境完全相反
test("买之前能拿给他看，而且不是「被撞破」那套语境", () => {
  assert.match(app, /const askCharAboutItem = \(charId, item\) => \{/);
  assert.match(app, /kind: "shopask"/);
  assert.match(screens, /onAskChar\(ch\.id, detail\)/, "详情里没有拿给他看");
  assert.match(app, /onAskChar: askCharAboutItem/, "没接到购物页上");
  const i = app.indexOf("  const askCharAboutItem = (charId, item) => {");
  const seg = app.slice(i, app.indexOf("\n  };", i));
  // ⚠️绝不能复用 phonepeek 那张卡和那段判词：那边是他被撞破，这边是我主动拿给你看
  assert.doesNotMatch(seg, /phonepeek|phonePeekTag/, "语境相反的两件事不许共用一张卡");
  assert.match(seg, /她在问你的意见，不是在通知你/);
  assert.match(seg, /别当客服念参数/);
  assert.match(seg, /也别一律附和/);
  // 卡片得有人画
  assert.match(components, /function ShopAskCard\(\{ m \}\)/);
  assert.match(components, /if \(m\.kind === "shopask"\)/, "聊天里这条没人渲染");
});

test("购物车、我的两页也换过来了，且都用紧凑标题栏", () => {
  assert.match(screens, /const shopHead = \(zh, right\) =>/);
  assert.match(screens, /shopHead\("购物车"\)/);
  assert.match(screens, /shopHead\("我的"\)/);
  // mobile-ui-layout.md §1：普通子页面不许用 30px 大标题
  const i = screens.indexOf("  const cartView = ");
  const seg = screens.slice(i, screens.indexOf("  // ---------- 商品详情", i));
  assert.doesNotMatch(seg, /h\(Head, \{/, "又退回 Head 那块大标题了");
  const head = screens.slice(screens.indexOf("  const shopHead = (zh, right) =>"), screens.indexOf("  const cartView = "));
  assert.match(head, /paddingTop: safeTop\(12\)/, "顶栏得自己吃安全区");
  assert.equal((head.match(/width: 40, height: 40/g) || []).length, 2, "左右操作位要等宽，标题才真居中");
  // 购物车缩略图和商品流用同一套品类色，一眼认得出是同一件东西
  assert.match(seg, /const c = shopTone\(it, ci\)/);
  // 结算条和底栏用橙
  assert.match(seg, /background: selItems\.length \? MSHOP\.orange/);
  assert.match(screens, /h\(G, \{ size: 21, color: nav === k \? MSHOP\.orange : MSHOP\.dim \}\)/, "底栏选中态没变橙");
});
