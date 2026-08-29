// 累积层：日志该越攒越长，当前状态该照实重写
//
// 判据：这一栏说的是「发生过什么」还是「现在是什么样」？
// 前者累积（通话、便签、订单、搜索），后者每次重写（购物车、在途包裹、
// 开着的标签页、今天的健康）。攒起来的购物车不叫真实，叫没清过。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const phoneSrc = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const appSrc = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const P = new Function(phoneSrc + "; return { PHONE_GROW, PHONE_STICKY, phoneGrowList, phoneGrowMerge, phoneMergeSaved, phoneSelfAvoidBlock, phoneFreezeTime, phoneRowKey, phoneProbeSpec };")();
const NOW = new Date(2026, 7, 29, 15, 0).getTime();
const char = { name: "某人" };

test("新的并进旧的，旧的不再消失", () => {
  const old = [{ title: "上一轮那条", time: "8月20日 10:00" }];
  const fresh = [{ title: "这一轮那条", time: "今天 09:00" }];
  const out = Array.from(P.phoneGrowList(fresh, old, 20, NOW), x => x.title);
  assert.deepEqual(out, ["这一轮那条", "上一轮那条"]);
});

test("同一条不会攒成两条，且以新的那份为准", () => {
  const same = { title: "一样的标题", time: "今天 09:00" };
  const out = P.phoneGrowList([{ ...same, body: "新写的" }], [{ ...same, body: "旧的" }], 20, NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].body, "新写的");
});

test("攒到上限从最旧的挤掉", () => {
  const mk = (tag, n, day) => Array.from({ length: n }, (_, i) => ({ title: tag + i, time: day + " 0" + (i % 9) + ":00" }));
  const out = P.phoneGrowList(mk("新", 6, "今天"), mk("旧", 30, "8月10日"), 10, NOW);
  assert.equal(out.length, 10);
  assert.ok(Array.from(out, x => x.title).filter(t => t.startsWith("新")).length === 6, "新的不该被挤掉");
  // 挤掉的是最旧的，不是随便挤
  const ts = Array.from(out, x => x._ts);
  assert.deepEqual(ts, [...ts].sort((a, b) => b - a));
});

test("相对时间存久了会变成谎话，并进来时就落成绝对写法", () => {
  // 存下来的是「今天 09:12」这个字符串，一周后它还写着「今天」
  const yest = P.phoneFreezeTime({ title: "x", time: "昨天 21:03" }, NOW);
  assert.equal(yest.time, "8月28日 21:03", "昨天那条没落成绝对写法");
  assert.ok(yest._ts != null && yest._abs);
  // 还是今天的先留着原样——「今天 09:12」这会儿没说错
  const today = P.phoneFreezeTime({ title: "y", time: "今天 09:12" }, NOW);
  assert.equal(today.time, "今天 09:12");
  assert.ok(!today._abs);
  // 只落一次：已经绝对化的不再动
  const again = P.phoneFreezeTime(yest, NOW + 86400000 * 5);
  assert.equal(again.time, "8月28日 21:03");
  // 认不出时刻的原样放过，不瞎写
  const loose = P.phoneFreezeTime({ title: "z", time: "改天" }, NOW);
  assert.equal(loose.time, "改天");
  assert.equal(loose._ts, undefined);
});

test("今天那条第二天再并，就变成绝对写法了（不会一直写着「今天」）", () => {
  const day1 = P.phoneGrowList([{ title: "那通电话", time: "今天 09:12" }], [], 20, NOW);
  assert.equal(day1[0].time, "今天 09:12");
  const day2 = P.phoneGrowList([{ title: "新的一条", time: "今天 08:00" }], day1, 20, NOW + 86400000);
  const old = day2.find(x => x.title === "那通电话");
  assert.equal(old.time, "8月29日 09:12", "隔天之后还写着「今天」就是在骗人");
});

test("当前状态不许累积：购物车、在途、开着的标签页、今天的健康", () => {
  // 攒起来的购物车不叫真实，叫没清过
  const notGrow = [["shopping", "cart"], ["shopping", "shipping"], ["takeout", "today"], ["takeout", "live"],
    ["takeout", "week"], ["browser", "tabs"], ["shopping", "coupons"], ["takeout", "coupons"]];
  notGrow.forEach(([app, field]) => {
    assert.ok(!(P.PHONE_GROW[app] && P.PHONE_GROW[app][field]), app + "." + field + " 不该累积——它说的是「现在什么样」");
  });
  assert.equal(P.PHONE_GROW.health, undefined, "健康每天重算，不累积");
  // 真的会被换掉
  const out = P.phoneGrowMerge("shopping", { cart: [{ title: "三个月前加的" }] }, { cart: [{ title: "现在在车里的" }] }, NOW);
  assert.deepEqual(Array.from(out.cart, x => x.title), ["现在在车里的"]);
});

test("日志类的都登记了，别漏", () => {
  // 「一层只写在一处，别处没跟上」是这个库反复犯的病
  [["notes", "items"], ["calls", "calls"], ["calls", "sms"], ["calls", "voicemail"], ["browser", "searches"],
   ["shopping", "orders"], ["takeout", "orders"], ["album", "items"], ["liked", "items"], ["bili", "items"],
   ["latenight", "items"], ["clipboard", "items"], ["wechat", "chats"]].forEach(([app, field]) => {
    assert.ok(P.PHONE_GROW[app] && P.PHONE_GROW[app][field] > 0, app + "." + field + " 是日志却没登记累积");
  });
});

test("身份和累积一起生效，互不干扰", () => {
  const old = { account: { name: "老账号", uid: "111" }, orders: [{ shop: "上一轮的店", time: "8月20日 12:00" }] };
  const gen = { account: { name: "模型另编的", uid: "999" }, orders: [{ shop: "这一轮的店", time: "今天 12:00" }] };
  const out = P.phoneMergeSaved("takeout", old, gen, NOW);
  assert.equal(out.account.name, "老账号", "身份没钉住");
  assert.equal(out.account.uid, "111");
  assert.deepEqual(Array.from(out.orders, x => x.shop), ["这一轮的店", "上一轮的店"], "日志没攒上");
});

test("第一次生成、空数据、脏数据都不炸", () => {
  for (const [o, n] of [[null, { orders: [{ shop: "a" }] }], [{}, {}], [{ orders: "不是数组" }, { orders: [{ shop: "a" }] }],
    ["字符串", { orders: [] }], [{ orders: [null, 3] }, { orders: [{ shop: "a" }] }]]) {
    assert.doesNotThrow(() => P.phoneMergeSaved("takeout", o, n, NOW));
  }
  assert.deepEqual(P.phoneMergeSaved("notes", null, { items: [{ title: "第一条" }] }, NOW).items.length, 1);
});

test("已经攒着的要回喂给模型，否则它会把旧的再写一遍", () => {
  const known = { orders: [{ shop: "西市老马家", time: "昨天" }, { shop: "城南徐记", time: "前天" }] };
  const blk = P.phoneSelfAvoidBlock("takeout", known);
  assert.match(blk, /西市老马家/);
  assert.match(blk, /城南徐记/);
  assert.match(blk, /不要再写一遍/);
  assert.equal(P.phoneSelfAvoidBlock("takeout", null), "");
  assert.equal(P.phoneSelfAvoidBlock("health", { cards: [] }), "");
  // 真的拼进了推演任务
  assert.ok(P.phoneProbeSpec("takeout", char, [], "", [], known).instruction.indexOf("西市老马家") > 0);
});

test("存进去走的是合并那一路，不是直接盖", () => {
  const m = appSrc.match(/const savePhoneApp = \(charId, key, d\) => \{[\s\S]*?\n  \};/);
  assert.ok(m);
  assert.match(m[0], /phoneMergeSaved\(key, cur\[key\], d, Date\.now\(\)\)/, "刷新还是整份盖掉，日志攒不起来");
});

test("本来就是绝对日期的别动——相册跨年，改写会丢年份", () => {
  // 「2024-03-11 18:42」被改成「3月11日 18:42」，下次一解析就认成今年，
  // 一张两年前的照片会跳到今年来
  const old = P.phoneFreezeTime({ caption: "旧照片", date: "2024-03-11 18:42" }, NOW);
  assert.equal(old.date, "2024-03-11 18:42");
  assert.equal(new Date(old._ts).getFullYear(), 2024);
  // 相对写法跨年时，改写出来要带上年份
  const lastYear = P.phoneFreezeTime({ title: "很久以前", time: "8月28日 10:00" }, new Date(2027, 0, 5).getTime());
  assert.match(lastYear.time, /^(2026年)?8月28日 10:00$/);
  // 「300天前」这种跨年的相对写法，改写必须带年份
  const far = P.phoneFreezeTime({ title: "更久", time: "300天前" }, NOW);
  assert.match(far.time, /^2025年/, "跨年的相对写法改写后丢了年份：" + far.time);
});
