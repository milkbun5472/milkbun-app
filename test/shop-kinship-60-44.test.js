const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
// 规则原文只从这一处拿（路径写在 test/_rules.js 那一行，搬家改一处就够）
const { ruleText } = require("./_rules.js");
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

// 她 2026-09-02：「maxtoken 开到 65535，那个反正开了也不代表用得到那么多」——
// 这条得写进规矩里，不然下次有人照那张「阶梯表」把它压回 20000。
test("「上限是天花板不是花销」这条写进规矩了", () => {
  const rule = ruleText("max-tokens-floor");
  assert.match(rule, /上限是【天花板】，不是【花销】/);
  assert.match(rule, /maxtoken 开到 65535/, "她的原话要留着");
  assert.match(rule, /别拿上面那张表去往下压它/);
  assert.match(rule, /有些上游对 max_tokens 有自己的硬上限/, "真被上游拒了要认得出来");
});

test("刷信息流那一处不许再叫模型去抄别人，占位值也不许是样例内容", () => {
  const i = app.indexOf("const genShop = async");
  const g = app.slice(i, app.indexOf("const WISH_CAP", i));
  const live = g.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(live.indexOf("类似淘宝") < 0, "直接叫它抄别人");
  // 施工规则/prompt-no-content-samples.md：schemaHint 里写样例内容＝被逐字照抄
  assert.ok(live.indexOf("川味经典红油抄手") < 0 && live.indexOf("地道成都风味") < 0);
  assert.match(g, /\\"name\\":\\"具体商品名\\"/, "占位值要写成说明");
  assert.match(g, /cat === "forhim" \?/, "给他买那一栏得知道自己是在替别人挑");
  // 她 2026-09-02 亲口定的上限；一次也从 6 件放开到 10~15 件
  assert.match(g, /maxTokens: 65535/);
  assert.match(g, /给 10~15 件商品（items 数组至少 10 个元素）/);
  assert.ok(g.indexOf("正好 6 件") < 0, "还卡在六件");
});

// 刷卡进聊天那三条挪去了 kinship-no-call-60-45 / kinship-card-face-60-45：
// v60.44 那一版被她当天推翻了（买东西不该调用、格式不对、卡面太平淡）。
