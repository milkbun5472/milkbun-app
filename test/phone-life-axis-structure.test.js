const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ph = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const shopping = ph.slice(ph.indexOf("function ShoppingView({"), ph.indexOf("function TakeoutView({"));
const takeout = ph.slice(ph.indexOf("const TAKE_ACCENT ="), ph.indexOf("// ============================================================\n// 健康"));

test("购物按角色的眼下、留下、取舍重组，不复刻标准电商四栏", () => {
  assert.match(shopping, /zh: "眼下"[\s\S]*zh: "留下"[\s\S]*zh: "取舍"/);
  // v59.48：账户卡撤了（这是他自己的手机，不需要自我介绍）
  assert.match(shopping, /secs: \[shipSec, cartSec\]/, "眼下应该合并正在发生的购买动作");
  assert.match(shopping, /secs: \[orderSec, giftSec, monthSec\]/, "买过和送过应该沿留下的痕迹阅读");
  assert.match(shopping, /secs: \[wishSec, viewSec, habitSec, shopSec, addrSec\]/, "犹豫、习惯和去处应该组成取舍");
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
  ["feedSec", "shopSec", "wishSec", "addrSec"].forEach(x => assert.ok(seg("people").indexOf(x) > 0, "和谁吃少了 " + x));
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
  // 「饭桌上的人」撤了：那一栏的主键是模型现编的称呼，认不出「老周／周叔」。
  // 顶掉它的「送到别人那儿」按地址归拢——地址会复用，天生是稳的主键。
  assert.ok(takeout.indexOf("phoneDedupeByWho") < 0, "还留着那条认不准的归并");
  assert.match(takeout, /const feedMap = \{\}/, "送到别人那儿没按地方归拢");
  assert.match(takeout, /isHome\(o\.addr\)/, "没把他自己家那些单子排除掉");
});

test("外卖四块使用各自的阅读结构，而不是参考稿的黄卡片模板", () => {
  assert.match(takeout, /secTitle\("吃过的记录"/);
  assert.match(takeout, /secTitle\("送到别人那儿"/);
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
  // ⚠️v59.36：这七天不再是单独生成的一层，是【从 orders 上开的一扇七天的窗】。
  // 她 2026-09-01：「吃过的记录和这七天对不上」——必然对不上，那是两次分别编出来的
  // 同一个星期。同一份数据换个看法才天生对得上；过了七天的自己滑出窗口留在下面，
  // 这就是她说的「顺延」，不需要任何搬运代码。
  assert.ok(takeout.indexOf("A(data.week)") < 0, "还在单独生成一份七天，注定和吃过的记录对不上");
  assert.match(takeout, /const wkDays = \[\]/, "没有那扇七天的窗");
  assert.match(takeout, /todayStart - i \* DAY/, "窗口不是按天切的");
  assert.match(takeout, /wkDays\.push\(\{ start, zh: WK_ZH\[new Date\(start\)\.getDay\(\)\], today: i === 0, rows \}\)/, "空掉的那天被吞掉了，而那才是最像他的几笔");
  assert.match(takeout, /"这一天没吃上什么"/, "空掉的那天没说话");
  // 点一顿就落到「吃过的记录」里那一条并展开——这是两边对得上的证据
  assert.match(takeout, /id: "tk-od-" \+ i/, "吃过的记录那边没有可以落过去的锚");
  assert.match(takeout, /document\.getElementById\("tk-od-" \+ x\.idx\)/, "点这七天里的一顿跳不过去");
  // 合起来看：三块彩色数字是平台的月度账单部件，删掉
  assert.ok(takeout.indexOf("const mealCount = week.reduce") < 0, "记下的餐那块统计还在");
  assert.ok(takeout.indexOf('"深夜落点"') < 0, "深夜落点那块统计还在");
  assert.ok(takeout.indexOf('"同桌的人"') < 0, "同桌的人那块统计还在");
  // 「几顿在深夜」是数量本身就是内容的那一种，所以它该活着——挪进副标
  assert.match(takeout, /late \+ " 顿在深夜"/, "深夜那个数没留下来");
});

// 她 2026-09-01：「原来是黄的美团色，和参考的 app 太像所以 codex 改成了这种不知道
// 什么颜色，能不能换一个好看有食欲的色」。上一版的鼠尾草绿＋雾蓝灰确实不撞了，
// 可它读起来是诊所和体检报告。**食物的颜色是被火烤过的颜色**：燕麦、陶土、焦糖、柿子。
test("外卖走烤过的暖色，既不是美团黄也不是上一版那套冷灰", () => {
  // ⚠️核的是【色相落在暖的那一段】，不是某几个写死的色值——
  // 冻色值的话，下次微调颜色测试就红，可什么 bug 都没抓到（v59.31 那次的教训）。
  const hsl = hex => {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return 0;
    const hh = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return Math.round(hh * 60);
  };
  const pick = name => {
    const m = new RegExp("const " + name + ' = "(#[0-9a-f]{6})"').exec(takeout);
    assert.ok(m, "找不到 " + name);
    return hsl(m[1]);
  };
  // 5°–45°：陶土到焦糖那一段。低于 5 是纯红（可乐），高于 45 就滑进黄（美团）。
  ["TAKE_ACCENT", "TAKE_CORAL", "TAKE_BG", "TAKE_INK", "TAKE_DIM", "TAKE_BODY"].forEach(k => {
    const h2 = pick(k);
    assert.ok(h2 >= 5 && h2 <= 45, k + " 的色相是 " + h2 + "°，不在烤过的那一段（5–45）");
  });
  // 结构色必须走常量：上一版散着二十几个绿灰字面值，换色时总有找漏的
  ["TAKE_BODY", "TAKE_LINE", "TAKE_SOFT", "TAKE_MUTE"].forEach(k =>
    assert.match(takeout, new RegExp("const " + k + ' = "#'), "结构色 " + k + " 没有常量，换色得挨个找"));
  assert.doesNotMatch(takeout, /TAKE_AMBER|#ffd534|#ffe484/, "美团黄又回来了");
  // 绿灰那一族一个都不许剩，剩一个就半绿半棕
  ["#5f7f79", "#edf2f0", "#e5ebe9", "#4f5c59", "#cfdcd8", "#a8b3b0", "#dce8e5"].forEach(c =>
    assert.ok(takeout.indexOf(c) < 0, "还剩着上一版的冷色 " + c));
});

test("两页保留单一滚动区和公共底部安全区公式", () => {
  [shopping, takeout].forEach(src => {
    assert.match(src, /className: "flex-1 min-h-0 overflow-y-auto"/);
    assert.match(src, /paddingBottom: COMPOSER_PAD_BOTTOM/);
  });
});

// 她 2026-09-01：「查手机购物那套也是和别人的参考太像了，根据我们对外卖的改造
// 把这个也改改吧」。撞的是同两样东西：**平台部件**，和**橙＋冷灰白那个组合**。
test("购物也把平台部件摘掉，换成这个人的说法", () => {
  // ① 平台部件：会员等级、积分、那一排统计、物流进度条、快递单号、优惠券、促销标、绿色状态徽章
  ["acc.member ? h(", "acc.points", '"本月消费"', '"积分"', "Number(it.progress)",
   "it.carrier", "couponSec", "it.promo ? h(", '"#3fa363"'].forEach(x =>
    assert.ok(shopping.indexOf(x) < 0, "平台部件还画着：" + x));
  // 生成层留着（她定的「只砍显示」）
  assert.match(ph, /coupons 优惠券|coupons/, "生成层的券被一起删了");
  // ② 但钱包那两个数不许跟着一起没——同一屏不许两处说着不同的钱
  assert.match(shopping, /const spendLine = ms/, "钱包算的那个数没地方看了");
  // ③ 栏目名换成人的说法，不是电商的栏目名
  ["在途包裹", "购物车", "想买清单", "我的订单", "最近浏览", "常逛店铺", "本月购物概况"].forEach(bad =>
    assert.ok(shopping.indexOf('secTitle("' + bad + '"') < 0, "还叫着「" + bad + "」"));
  ["还在路上", "还没舍得付", "一直没下手的", "买过的", "反复看过的", "总回的那几家", "买给别人的", "合起来看"]
    .forEach(good => assert.match(shopping, new RegExp('secTitle\\("' + good + '"'), good + " 那一格没了"));
  // ④ 「预算／常买／不买／习惯」四行标签表是电商的消费画像，改成问句
  assert.ok(shopping.indexOf('["预算", habit.budget]') < 0, "还在按消费画像表分行");
  assert.match(shopping, /secTitle\("买东西这件事上", "他的取舍"\)/, "没换成我们的问法");
  assert.match(shopping, /他什么都舍得，除了这个/, "没问到点子上");
});

// 外卖走烤过的暖色，购物就不能也走暖的——两个 app 会糊成一个。
// 它该长成另一件东西：帖子和册页（想要、舍不得、买给谁），所以冷青纸＋靛蓝＋朱砂。
test("购物走靛蓝与朱砂，不是电商那个橙", () => {
  const hue = hex => {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return 0;
    const hh = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return Math.round(hh * 60);
  };
  const pick = name => {
    const m = new RegExp("const " + name + ' = "(#[0-9a-f]{6})"').exec(ph);
    assert.ok(m, "找不到 " + name);
    return hue(m[1]);
  };
  // 底、墨、强调都在冷的那一段（190–250），跟外卖那套 5–45 的暖色分得开
  ["SHOP_ACCENT", "SHOP_BG", "SHOP_INK", "SHOP_DIM", "SHOP_BODY"].forEach(k => {
    const h2 = pick(k);
    assert.ok(h2 >= 190 && h2 <= 250, k + " 的色相是 " + h2 + "°，不在冷的那一段（190–250）");
  });
  // 朱砂只有一个用处：钱。它是印章不是价签，所以必须留在暖的那一头
  const mk = pick("SHOP_MARK");
  assert.ok(mk >= 0 && mk <= 20, "朱砂那一笔不见了（现在是 " + mk + "°）");
  assert.ok(ph.indexOf("SHOP_ORANGE") < 0, "电商那个橙还留着");
  assert.ok(shopping.indexOf("rgba(255,106,43") < 0, "橙色的半透明尾巴还剩着");
  assert.ok(shopping.indexOf("#ffe6d8") < 0, "顶上那道橙粉渐变还在");
  ["SHOP_BODY", "SHOP_LINE", "SHOP_SOFT"].forEach(k =>
    assert.match(ph, new RegExp("const " + k + ' = "#'), "结构色 " + k + " 没有常量，换色得挨个找"));
});

// 她 2026-09-01（配着一张左右对比图）：「购物这块结构还是太像了」
//「we can keep the prompt of what we generate, but the layout is just straight up plagiarism」。
// v59.38 砍的是零件（会员等级、积分、统计块、进度条），骨架一点没动——
// **而骨架才是撞的那样东西**：一张头像卡打头 → 分段标题 → 竖线时间轴 + 一张张白卡。
test("购物的骨架也换掉：没有账户卡、没有物流卡、没有白卡叠白卡", () => {
  // ① 账户卡：这是他自己的手机，摆一张卡告诉你他是谁纯属家具
  assert.ok(shopping.indexOf("const accountCard") < 0, "账户卡还在");
  assert.ok(shopping.indexOf("secs: [accountCard") < 0, "账户卡还摆在第一页");
  // 里面唯一有内容的那句得有地方去，不能跟着一起没
  assert.match(shopping, /acc\.persona \? h\("div"[\s\S]{0,200}acc\.persona\)/, "他买东西的毛病那句丢了");
  // ② 在途：一行一样，不再是圆点＋白卡的快递追踪
  assert.ok(shopping.indexOf('position: "absolute", left: -22') < 0, "时间轴圆点还在");
  assert.ok(shopping.indexOf("Number(it.progress)") < 0, "进度条还在");
  assert.match(shopping, /\[it\.eta, it\.shop\]\.filter\(Boolean\)\.join\(" · "\)/, "在途没改成一行一样");
  // ③ 去卡片化：那几节的行本来就自带细线，外面不该再套白卡
  assert.match(shopping, /const plain = \(kids, extra\)/, "没有不带底色的那个块");
  ["还没舍得付", "总回的那几家", "反复看过的", "送到哪儿", "买给别人的"].forEach(zh => {
    const i = shopping.indexOf('secTitle("' + zh + '"');
    assert.ok(i > 0, "找不到「" + zh + "」");
    assert.match(shopping.slice(i, i + 120), /plain\(/, "「" + zh + "」还套着白卡");
  });
  assert.match(shopping, /plain\(orders\.map/, "买过的还是一单一张白卡（那是一张张收据）");
  // ④ 商品缩略图位：货架的家具，而且这儿根本没有图
  assert.ok(shopping.indexOf("const thumb = ") < 0, "缩略图位还留着");
  assert.ok(shopping.indexOf("thumb(") < 0, "还有地方在摆缩略图位");
});

// 她 2026-09-01：「现在啥格式都去掉太平了，看不出来哪些是啥」。
// 撤掉白卡是对的（那是电商的排版），但**层次不能跟着一起撤**。
test("去掉白卡之后，层次靠标签和字号重新建起来", () => {
  assert.match(shopping, /const labeled = \(k, v, quiet\)/, "没有小标签这一层");
  ["他写的", "为什么买这个", "送到"].forEach(k =>
    assert.match(shopping, new RegExp('labeled\\("' + k + '"'), "「" + k + "」那一段没有标签，几段话糊成一坨"));
  // 店和时间是出处，买的那样东西才是主角——原来两个都是 16px 深色，分不出主次
  assert.match(shopping, /\[o\.shop, o\.time\]\.filter\(Boolean\)\.join\(" · "\)/, "店和时间没压成一行小字");
  const i = shopping.indexOf("o.title ? h(\"div\", { key: \"n\"");
  assert.ok(i > 0, "找不到商品名那一行");
  assert.match(shopping.slice(i, i + 160), /fontSize: 18/, "商品名没比出处大——读的人分不出哪个是主角");
  // 退掉的那一单实付是 0，摆个「¥0.00」在「后来退了」旁边只是噪音
  assert.match(shopping, /Number\(o\.paid\) > 0 \? h\("span"/, "退掉的那一单还摆着 ¥0.00");
});
