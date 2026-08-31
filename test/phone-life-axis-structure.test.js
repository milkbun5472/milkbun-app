const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ph = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const shopping = ph.slice(ph.indexOf("function ShoppingView({"), ph.indexOf("function TakeoutView({"));
const takeout = ph.slice(ph.indexOf("const TAKE_ACCENT ="), ph.indexOf("// ============================================================\n// 健康"));

test("购物按角色的眼下、留下、取舍重组，不复刻标准电商四栏", () => {
  assert.match(shopping, /zh: "眼下"[\s\S]*zh: "留下"[\s\S]*zh: "取舍"/);
  assert.match(shopping, /secs: \[accountCard, shipSec, cartSec\]/, "眼下应该合并正在发生的购买动作");
  assert.match(shopping, /secs: \[orderSec, giftSec, monthSec\]/, "买过和送过应该沿留下的痕迹阅读");
  assert.match(shopping, /secs: \[wishSec, viewSec, habitSec, shopSec, addrSec, couponSec\]/, "犹豫、习惯和去处应该组成取舍");
  assert.doesNotMatch(shopping, /zh: "首页"[\s\S]*zh: "购物车"[\s\S]*zh: "订单"[\s\S]*zh: "我的"/);
});

test("外卖按这一顿、怎么吃、和谁吃重组，不再逐项照平台栏目分仓", () => {
  assert.match(takeout, /zh: "这一顿"[\s\S]*zh: "怎么吃"[\s\S]*zh: "和谁吃"/);
  assert.match(takeout, /secs: \[accCard, todayCard, liveSec\]/);
  assert.match(takeout, /secs: \[weekSec, orderSec, tasteSec, monthSec\]/);
  assert.match(takeout, /secs: \[togSec, shopSec, wishSec, addrSec, couponSec\]/);
  assert.doesNotMatch(takeout, /zh: "点餐"[\s\S]*zh: "订单"[\s\S]*zh: "口味"[\s\S]*zh: "我的"/);
});

test("外卖四块使用各自的阅读结构，而不是参考稿的黄卡片模板", () => {
  assert.match(takeout, /secTitle\("一周进食轨迹"/);
  assert.match(takeout, /secTitle\("吃过的记录"/);
  assert.match(takeout, /secTitle\("饭桌上的人"/);
  assert.match(takeout, /secTitle\("吃饭侧写"/);
  assert.match(takeout, /const expanded = open === i/);
  assert.match(takeout, /setOpen\(expanded \? null : i\)/);
  assert.match(takeout, /const mealCount = week\.reduce/);
  assert.doesNotMatch(takeout, /secTitle\("本周吃什么"|secTitle\("我的订单"|secTitle\("一起点过"|secTitle\("本周点餐概况"/);
  assert.doesNotMatch(takeout, /width: 178/);
});

test("外卖主视觉退出美团黄，改用雾蓝灰、鼠尾草绿和珊瑚色", () => {
  assert.match(takeout, /const TAKE_ACCENT = "#5f7f79"/);
  assert.match(takeout, /const TAKE_CORAL = "#d86f62"/);
  assert.match(takeout, /radial-gradient\(circle at 88% 4%/);
  assert.doesNotMatch(takeout, /TAKE_AMBER|#ffd534|#ffe484/);
});

test("两页保留单一滚动区和公共底部安全区公式", () => {
  [shopping, takeout].forEach(src => {
    assert.match(src, /className: "flex-1 min-h-0 overflow-y-auto"/);
    assert.match(src, /paddingBottom: COMPOSER_PAD_BOTTOM/);
  });
});
