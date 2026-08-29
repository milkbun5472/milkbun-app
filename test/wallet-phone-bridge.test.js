// 钱包 ↔ 购物/外卖：两边说的得是同一个人、同一天
//
// 病一：genDailySpend 读了行程，却完全不知道他今天点了外卖、买了东西——
//       于是同一天里钱包再编一顿饭，出现两笔吃饭钱。
// 病二：购物/外卖不知道他有多少钱——月俸微薄的小官照样下单六百八十文的袍子。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appSrc = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const phoneSrc = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const P = new Function(phoneSrc + "; return { phoneMoneyBlock, PHONE_MONEY_KEYS, phoneProbeSpec };")();
const char = { name: "某人" };

test("手头有多少钱要发给购物和外卖，而且只发给它们", () => {
  const money = { balance: 320, monthlyIncome: 4000, fixedMonthly: 2800, spendingNote: "嫌麻烦多过心疼钱" };
  const blk = P.phoneMoneyBlock("takeout", money);
  assert.match(blk, /320/);
  assert.match(blk, /4000/);
  assert.match(blk, /2800/);
  assert.match(blk, /嫌麻烦多过心疼钱/);
  assert.match(blk, /买不起的东西他就是买不起/);
  // 别的 app 不该收到这一段（深夜台知道他存款多少没有任何意义）
  ["notes", "latenight", "album", "health", "wechat"].forEach(k =>
    assert.equal(P.phoneMoneyBlock(k, money), "", k + " 不该收到钱包简报"));
  // 没建钱包档的角色照旧
  assert.equal(P.phoneMoneyBlock("takeout", null), "");
  assert.equal(P.phoneMoneyBlock("takeout", {}), "");
});

test("透支的时候明说这一轮不该有非必需下单", () => {
  const blk = P.phoneMoneyBlock("shopping", { balance: -1200, monthlyIncome: 3000 });
  assert.match(blk, /透支/);
  assert.ok(P.phoneMoneyBlock("shopping", { balance: 9000 }).indexOf("透支") < 0);
});

test("真的拼进了购物和外卖的推演任务", () => {
  const money = { balance: 320 };
  P.PHONE_MONEY_KEYS.forEach(k => {
    const withM = P.phoneProbeSpec(k, char, [], "", [], null, money).instruction;
    const without = P.phoneProbeSpec(k, char, [], "", [], null, null).instruction;
    assert.ok(withM.indexOf("320") > 0, k + " 没收到钱包简报");
    assert.ok(without.indexOf("320") < 0);
  });
});

test("两处生成调用都把钱包简报传下去了", () => {
  // 「一层只写在一处，别处没跟上」：全刷漏了的话，点一次刷新全部他就又乱花钱
  const calls = appSrc.match(/^.*phoneProbeSpec\(.*$/gm) || [];
  assert.ok(calls.length >= 2);
  calls.forEach(c => assert.match(c, /phoneMoneyFor\(char\)\)/, "这处没传钱包简报：" + c.trim().slice(0, 90)));
  assert.match(appSrc, /const phoneMoneyFor = char => \{/);
  // 只读不写
  const m = appSrc.match(/const phoneMoneyFor = char => \{[\s\S]*?\n  \};/)[0];
  assert.ok(m.indexOf("setCharWallet") < 0 && m.indexOf("saveJSON") < 0, "钱包简报是只读的，不许回写");
});

test("那天手机上真下过的单子直接入账，不再让模型编第二遍", () => {
  const m = appSrc.match(/const phoneOrdersOnDay = \(charId, dayKey\) => \{[\s\S]*?\n  \};/);
  assert.ok(m, "找不到 phoneOrdersOnDay");
  const fn = m[0];
  assert.match(fn, /takeout \|\| \{\}\)\.orders/, "没捞外卖订单");
  assert.match(fn, /shopping \|\| \{\}\)\.orders/, "没捞购物订单");
  // 时刻优先用存进去时算死的 _ts——相对时间隔天再解析就漂了
  assert.match(fn, /x\._ts != null\) \? x\._ts/, "没优先用冻结的时刻");
  assert.match(fn, /phonesRef\.current/, "读的是闭包里的旧 phones");

  const ap = appSrc.match(/const applyWalletDay = async \(char, dayKey\) => \{[\s\S]*?\n  \};/)[0];
  assert.match(ap, /const already = phoneOrdersOnDay\(char\.id, dayKey\)/);
  assert.match(ap, /genDailySpend\(char, dayKey, rec, already\)/, "没把已入账那几笔告诉模型");
  // 补账可能跑不止一遍，同一单不许记两次
  assert.match(ap, /srcKey/, "订单入账没有去重标记，补账跑两遍就记重");
  assert.match(ap, /kind[\s\S]{0,40}"order"|"order"/, "订单没有自己的流水类型");
});

test("已入账那几笔要写进提示词，否则模型再编一顿饭", () => {
  const g = appSrc.match(/const genDailySpend = async \(char, dayKey, rec, already\) => \{[\s\S]*?\n  \};/);
  assert.ok(g, "genDailySpend 没收下 already");
  assert.match(g[0], /const doneBlock = \(already \|\| \[\]\)\.length/);
  assert.match(g[0], /不要重复/);
  assert.match(g[0], /\+ doneBlock,/, "doneBlock 拼出来了却没接进 instruction");
  // 没 API 时：手机上已经有单子就别再兜底编一笔
  assert.match(g[0], /if \(!active\) return already && already\.length \? \[\] : fallback\(\);/);
});

test("回到前台那一路也要补账（开 app / 跨天 / 回前台，三处都得有）", () => {
  // 常驻 PWA 切回前台是最常走的一条路，这儿漏了她的钱包就要等整页重载才结算
  // 三拍：开 app、回前台、跨天。少一拍就有一条路上钱包不结算。
  const hooks = appSrc.match(/walletCatchAllToday\(\)/g) || [];
  assert.ok(hooks.length >= 3, "walletCatchAllToday 的挂点少于三拍，现在 " + hooks.length);
  // 同一条链上的其它每日任务有几处，钱包就该有几处——别再出现「三处有、一处漏」
  const sched = (appSrc.match(/schedMaybeSelfRevise\(\)/g) || []).length;
  assert.equal(hooks.length, sched, "钱包补账的挂点数和行程那条链对不上（钱包 " + hooks.length + " / 行程 " + sched + "）");
  // app.js 里有五个 const kick，别抓错——按「回前台补今日行程」那一个的内容定位
  const kick = (appSrc.match(/^.*const kick = \(\) => \{.*schedGenAllToday.*$/gm) || [])[0];
  assert.ok(kick, "找不到回前台那一路");
  assert.match(kick, /walletCatchAllToday\(\)/, "回到前台那一路没接钱包补账");
});
