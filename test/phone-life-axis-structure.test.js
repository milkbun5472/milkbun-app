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

test("外卖按角色生活分档，不逐项照平台栏目分仓", () => {
  assert.match(takeout, /zh: "这一顿"[\s\S]*zh: "怎么吃"[\s\S]*zh: "和谁吃"/);
  assert.doesNotMatch(takeout, /zh: "点餐"[\s\S]*zh: "订单"[\s\S]*zh: "口味"[\s\S]*zh: "我的"/);
  // ⚠️别把 secs 数组【逐字冻死】：往里加一档或挪一个 section 这条就红，
  // 而它想验的「不是平台那四栏」根本没坏。只核每一档里该有的那几样在不在。
  const seg = k => takeout.slice(takeout.indexOf('key: "' + k + '"'), takeout.indexOf("\n", takeout.indexOf('key: "' + k + '"')));
  ["accCard", "todayCard", "liveSec"].forEach(x => assert.ok(seg("home").indexOf(x) > 0, "这一顿少了 " + x));
  ["tasteSec", "weekSec", "orderSec", "monthSec"].forEach(x => assert.ok(seg("rhythm").indexOf(x) > 0, "怎么吃少了 " + x));
  ["togSec", "shopSec", "wishSec", "addrSec"].forEach(x => assert.ok(seg("people").indexOf(x) > 0, "和谁吃少了 " + x));
});

// 她 2026-08-31：「那几样分类和实际数据栏目和另一个太像了，改一下变成我们的」。
// 前两版只改了 tab 名字和配色，卡片上的【平台部件】一个没动——那才是像的地方。
// 这一条钉的是「平台皮不画」和「新开的那一栏在」。（生成层照旧留着，她定的。）
test("平台部件不画，改画只有我们会有的那一栏", () => {
  // 评分／配送方式／会员等级／骑手／四段进度条／五星：全是换个角色照样成立的东西
  ["today.rating", "today.delivery", "acc.member ? h(", "it.rider", "STEPS", "o.stars"].forEach(x =>
    assert.ok(takeout.indexOf(x) < 0, "平台部件还画着：" + x));
  // 红包卡券整栏不再摆（生成层留着，所以只查界面这一端）
  assert.ok(takeout.indexOf("couponSec") < 0, "卡券那一栏还在界面上");
  assert.match(ph, /coupons 红包卡券/, "生成层的卡券被一起删了——她要的是只砍显示");
  // ⚠️v59.16 曾经把订单里的备注挖出来单独摆一面「写给陌生人」。她当天就报
  // 「本质上不就是把怎么吃里面的备注挖出来嘛，有点鸡肋」——那不是一栏新东西，
  // 是同一份数据换个地方摆第二遍。撤掉了，这里钉住别再长回来。
  // ⚠️剥掉注释行再核：phone.js 里那条说明本身就写着「写给陌生人」，不剥会撞自己
  const bare = takeout.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(bare.indexOf("const noteWall") < 0, "备注墙又长回来了");
  assert.ok(bare.indexOf("写给陌生人") < 0, "那一档又长回来了");
  // 「他每次都写的那句」是【算出来的】（挑出现得最多的那条），不是把备注原样再列一遍
  assert.match(takeout, /const stockNote = \(function \(\)/, "没算出「每次都写的那句」");
  assert.match(takeout, /Object\.keys\(tally\)\.sort\(\(a, b\) => tally\[b\] - tally\[a\]\)/, "没按出现次数挑");
  // 口味那五行（辣度/忌口/偏好/预算/习惯）是外卖平台的口味画像表单
  assert.ok(takeout.indexOf('tasteRow("辣度"') < 0, "还在按平台那张口味画像表分行");
  assert.match(takeout, /secTitle\("吃这件事上", "他的挑剔"\)/, "口味那栏没换成我们的问法");
  assert.match(takeout, /他嫌什么——不是嫌这样东西，是嫌它哪一点/, "没问到点子上");
  // 饭桌上的人：同一个人别用好几个别称各占一条
  assert.match(takeout, /const togRows = phoneDedupeByWho\(together\)/, "渲染这一端没去重");
  assert.ok(takeout.indexOf("together.length + \" 段关系\"") < 0, "计数还用没去重的那份");
});

test("外卖四块使用各自的阅读结构，而不是参考稿的黄卡片模板", () => {
  assert.match(takeout, /secTitle\("吃过的记录"/);
  assert.match(takeout, /secTitle\("饭桌上的人"/);
  assert.match(takeout, /const expanded = open === i/);
  assert.match(takeout, /setOpen\(expanded \? null : i\)/);
  assert.doesNotMatch(takeout, /secTitle\("本周吃什么"|secTitle\("我的订单"|secTitle\("一起点过"|secTitle\("本周点餐概况"/);
  assert.doesNotMatch(takeout, /width: 178/);
});

// 她 2026-09-01：「一周进食轨迹可以改个名字，而且格式还是和另一个太像了，
// 只不过把人家的打横变成竖着的」「吃饭侧写也和那个太像了」。
test("这七天是一串连着的饭，不是一天一格的表", () => {
  // 名字：那三个都是记账 App 的说法（轨迹／侧写／清单）
  ["一周进食轨迹", "吃饭侧写", "想吃清单"].forEach(bad =>
    assert.ok(takeout.indexOf('secTitle("' + bad + '"') < 0, "还叫着「" + bad + "」"));
  assert.match(takeout, /secTitle\("这七天"/, "这七天那一格没了");
  assert.match(takeout, /secTitle\("合起来看"/, "合起来看那一格没了");
  assert.match(takeout, /secTitle\("惦记着的"/, "惦记着的那一格没了");
  // 形状：把七天摊平成一串，日子只在换天时出现一次——这是「不再一天一格」的成因
  assert.match(takeout, /const wkFlat = \[\]/, "还是一天一格，只是换了方向");
  assert.match(takeout, /wkFlat\.push\(\{ day: dy\.day, empty: true \}\)/, "没吃的那天被吞掉了，而那才是最像他的几笔");
  assert.match(takeout, /day: j \? "" : dy\.day/, "日子每顿都重复一次，又变回表格了");
  // 合起来看：三块彩色数字是平台的月度账单部件，删掉
  assert.ok(takeout.indexOf("const mealCount = week.reduce") < 0, "记下的餐那块统计还在");
  assert.ok(takeout.indexOf('"深夜落点"') < 0, "深夜落点那块统计还在");
  assert.ok(takeout.indexOf('"同桌的人"') < 0, "同桌的人那块统计还在");
  // 「几顿在深夜」是数量本身就是内容的那一种，所以它该活着——挪进副标
  assert.match(takeout, /wkLate \+ " 顿在深夜"/, "深夜那个数没留下来");
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
