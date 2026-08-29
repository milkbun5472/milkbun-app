// 身份稳定：一个人的号码、账号、住址、忌口，不该每刷一次就换一个
//
// 每次刷新都是整份重生成，于是他的外卖 id、微信号、收货地址、忌口刷一次换一批。
// 那不是「手机在被使用」，那是「每次都换了个人」。
// 判据：这一栏这周和上周不一样，是「他变了」还是「系统忘了」？是后者的就该钉死。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const phoneSrc = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const appSrc = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const P = new Function(phoneSrc + "; return { PHONE_STICKY, phoneKeepIdentity, phoneIdentityBlock, phoneProbeSpec, PHONE_APPS, PHONE_LIVE_KEYS };")();
const char = { name: "某人" };

test("凡是有账号身份的 app 都登记了身份项，一个都没漏", () => {
  // 「一层只写在一处，别处没跟上」是这个库反复犯的病。有 me/account/archive
  // 这种身份块的 app，必须都在 PHONE_STICKY 里有一行。
  const { FIXTURES } = require("./helpers/phone-render.js");
  const hasIdentity = k => {
    const d = FIXTURES[k];
    return !!(d && (d.me || d.account || d.archive));
  };
  P.PHONE_APPS.map(a => a.key)
    .filter(k => P.PHONE_LIVE_KEYS.indexOf(k) < 0)
    .filter(hasIdentity)
    .forEach(k => assert.ok(P.PHONE_STICKY[k] && P.PHONE_STICKY[k].length, k + " 有账号身份却没登记进 PHONE_STICKY，刷一次换一个号"));
});

test("刷新之后号码、账号、住址、忌口原样留着", () => {
  const old = {
    account: { name: "只买合用的", uid: "1043827", member: "常客", persona: "买东西极快", monthSpend: 100 },
    addrs: [{ label: "家", detail: "老地方", isDefault: true }],
    taste: { avoidTags: ["生姜丝"] },
    orders: [{ shop: "旧的店", time: "上周" }]
  };
  const gen = {
    account: { name: "另起的名", uid: "9999999", member: "新会员", persona: "完全另一个人", monthSpend: 250 },
    addrs: [{ label: "别处", detail: "新编的地址", isDefault: true }],
    taste: { avoidTags: ["香菜"] },
    orders: [{ shop: "新的店", time: "今天" }]
  };
  const out = P.phoneKeepIdentity("takeout", old, gen);
  assert.equal(out.account.name, "只买合用的");
  assert.equal(out.account.uid, "1043827");
  assert.equal(out.account.member, "常客");
  assert.equal(out.account.persona, "买东西极快");
  assert.deepEqual(out.addrs, old.addrs, "收货地址被换掉了");
  assert.deepEqual(out.taste, old.taste, "忌口被换掉了");
  // 痕迹层照常更新——身份钉死不等于整个 app 冻住
  assert.equal(out.orders[0].shop, "新的店");
  assert.equal(out.account.monthSpend, 250, "本月消费是会变的，不该被钉住");
});

test("第一次生成（还没有旧数据）原样收下，不留空洞", () => {
  const gen = { account: { name: "刚长出来的", uid: "1" }, orders: [] };
  assert.deepEqual(P.phoneKeepIdentity("takeout", null, gen), gen);
  assert.deepEqual(P.phoneKeepIdentity("takeout", {}, gen), gen);
  // 旧那份里这一项是空的，就用新的——别拿空值把刚生成的好内容盖掉
  const out = P.phoneKeepIdentity("takeout", { account: { name: "", uid: null }, addrs: [] }, gen);
  assert.equal(out.account.name, "刚长出来的");
  assert.equal(out.account.uid, "1");
});

test("没登记身份项的 app 原样通过", () => {
  const gen = { items: [1, 2] };
  assert.deepEqual(P.phoneKeepIdentity("notes", { items: [3] }, gen), gen);
  assert.deepEqual(P.phoneKeepIdentity("不存在的app", { x: 1 }, gen), gen);
});

test("脏数据不炸", () => {
  for (const [o, n] of [[null, null], [{}, null], ["字符串", { a: 1 }], [{ account: "不是对象" }, { account: { name: "x" } }], [[], {}]]) {
    assert.doesNotThrow(() => P.phoneKeepIdentity("takeout", o, n));
  }
});

test("钉死的身份要发回提示词，否则新内容跟它对不上", () => {
  // 光在存的时候盖回去不够：模型不知道收货地址是哪儿，编的订单会送去别处，
  // 界面上一半是钉死的旧地址、一半是新编的，比不钉还乱。
  const known = { account: { name: "只买合用的", uid: "1043827" }, addrs: [{ label: "家", detail: "老地方" }] };
  const blk = P.phoneIdentityBlock("takeout", known);
  assert.match(blk, /只买合用的/);
  assert.match(blk, /1043827/);
  assert.match(blk, /老地方/);
  assert.match(blk, /原样沿用/);
  // 第一次生成时不该多出这一段
  assert.equal(P.phoneIdentityBlock("takeout", null), "");
  assert.equal(P.phoneIdentityBlock("notes", { items: [] }), "");
  // 真的拼进了推演任务
  const spec = P.phoneProbeSpec("takeout", char, [], "", [], known);
  assert.ok(spec.instruction.indexOf("1043827") > 0, "身份没拼进 instruction");
  assert.ok(P.phoneProbeSpec("takeout", char, [], "", []).instruction.indexOf("1043827") < 0);
});

test("两次生成的调用点都把旧那份传过去了", () => {
  // 单刷和全刷是两处。「一层只写在一处，别处没跟上」——全刷漏了的话，
  // 点一次「刷新全部」他就换了个人，而单刷看起来一切正常。
  // 注意别用 /phoneProbeSpec\([^)]*\)/ 去抓——参数里有 relatedNames(char)，
  // 第一个右括号就把匹配截断了，抓到的永远是半句。整行取。
  const calls = (appSrc.match(/^.*phoneProbeSpec\(.*$/gm) || []);
  assert.ok(calls.length >= 2, "找不到两处生成调用");
  calls.forEach(c => assert.match(c, /avoid, known\)/, "这处没把身份传过去：" + c.trim().slice(0, 100)));
  // known 必须走 ref：全刷是一个 app 接一个写的，闭包里的 phones 会是旧的
  assert.match(appSrc, /const known = \(\(phonesRef\.current \|\| \{\}\)\[char\.id\] \|\| \{\}\)\[key\]/);
  const m = appSrc.match(/const known = /g) || [];
  assert.equal(m.length, 2, "两处调用点都要各自读一次 known");
});

test("存进去之前代码再盖一道（规则降概率，代码才保证）", () => {
  const m = appSrc.match(/const savePhoneApp = \(charId, key, d\) => \{[\s\S]*?\n  \};/);
  assert.ok(m);
  assert.match(m[0], /phoneKeepIdentity\(key, cur\[key\], d\)/, "写入时没把身份盖回来——模型漏抄一次地址就变了");
});
