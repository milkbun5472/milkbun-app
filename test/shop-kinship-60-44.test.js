const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

// 她 2026-09-02：「购物这个 maxtoken 开了吧，他这几样 category 改一下，我之前是参考了别人的」
// ＋「情趣留着，有点意思，外卖可以不要了」
test("分栏不再是一份通用电商品类词典", () => {
  const i = scr.indexOf("const SHOP_CATS = [");
  const cats = scr.slice(i, scr.indexOf("];", i));
  const zh = (cats.match(/zh: "([^"]+)"/g) || []).map(x => x.slice(5, -1));
  ["外卖", "服饰", "美妆", "数码", "家具", "推荐"].forEach(k =>
    assert.ok(zh.indexOf(k) < 0, "还留着通用品类词：" + k));
  assert.ok(zh.indexOf("情趣") >= 0, "情趣她说留着");
  // 别的购物 app 不可能有的那一栏
  assert.ok(cats.indexOf('key: "forhim"') > 0 && zh.indexOf("给他买") >= 0);
  // ⚠️key 不许改：商品和订单上存着 cat
  ["recommend", "fashion", "beauty", "digital", "furniture", "adult"].forEach(k =>
    assert.ok(cats.indexOf('key: "' + k + '"') > 0, "key 被改了，老数据认不回来：" + k));
  // 老订单里的 food 还得认得出在途文案
  assert.match(scr, /SHOP_SHIP_WORD = \{ food:/);
});

test("刷信息流那一处不许再叫模型去抄别人，占位值也不许是样例内容", () => {
  const i = app.indexOf("const genShop = async");
  const g = app.slice(i, app.indexOf("const WISH_CAP", i));
  const live = g.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(live.indexOf("类似淘宝") < 0, "直接叫它抄别人");
  // .claude/rules/prompt-no-content-samples.md：schemaHint 里写样例内容＝被逐字照抄
  assert.ok(live.indexOf("川味经典红油抄手") < 0 && live.indexOf("地道成都风味") < 0);
  assert.match(g, /\\"name\\":\\"具体商品名\\"/, "占位值要写成说明");
  assert.match(g, /cat === "forhim" \?/, "给他买那一栏得知道自己是在替别人挑");
  // 一次要写六件东西＝一屏名单那一档（max-tokens-floor.md）
  assert.match(g, /maxTokens: 19500/);
});

// 她 2026-09-02：「刷了角色亲属卡好像不进聊天，他不知道我拿来刷了啥」
test("刷了他的卡，聊天里要留下这笔", () => {
  const i = app.indexOf("const payWithKinship");
  const pay = app.slice(i, app.indexOf("// 使用（待收货→我的物品）", i));
  assert.match(pay, /pChat\(charId, p => \[\.\.\.p, \{ role: "system", kind: "system"/, "这笔没进聊天");
  assert.match(pay, /"你刷了" \+ \(char \? char\.name : "对方"\) \+ "的亲属卡："/);
  assert.match(pay, /" · ¥" \+ total/, "花了多少也得写上");
});

test("他那句话要在聊天里说出口，不是只嘀咕进账单页", () => {
  const i = app.indexOf("const genKinshipComment");
  const g = app.slice(i, app.indexOf("// 随身物品 Carry", i));
  assert.match(g, /pChat\(charId, p => \[\.\.\.p, \{ role: "assistant", content: comment/);
  assert.match(g, /bumpUnread\(charId, 1\)/, "不在这个聊天里就该有个红点");
  // 同一次调用的结果，不许为这个再多打一次
  assert.equal((g.match(/callAI\(/g) || []).length, 1, "为了发这句又多花了一次调用");
});

// 她 2026-09-02：「亲属卡没有头像，还有样式也改改」
test("亲属卡看得出是谁给的", () => {
  const i = comp.indexOf("function KinshipIssueCard(");
  const k = comp.slice(i, comp.indexOf("// 代付请求卡", i));
  assert.match(k, /h\(Avatar, \{ character: c, size: 34/, "没有他的头像，就看不出是谁给的");
  assert.match(k, /"给你开了一张亲属卡"/);
  assert.ok(k.indexOf("KINSHIP") < 0, "中英对照那一套（同长按菜单那次）");
  assert.match(k, /"花这张卡，刷的是" \+ \(c\.name \|\| "TA"\) \+ "的钱"/, "底栏还写着「刷 TA 的钱」这种谁都不是的说法");
  // 上沿那条他的颜色：这张卡是从他那儿来的
  assert.match(k, /height: 4, background: ink/);
});
