// 她 2026-09-06：「为啥以前查手机他们都会查温尼伯有关的，比如沈屿白有曼大的教授邮件、
// 会查温尼伯约会地点，然后现在都变回 general 的国内了」。
//
// ⚠️查下来【不是回归】——char.home.city 从来就没进过提示词。它只用来画地图和查天气
//   （js/app.js schedWeatherLine / js/components.js 地图标签），一次都没发给过模型。
//   所以「生成他的生活」那几处只能靠训练先验补：一屏中文 app（微信/朋友圈/小红书/
//   仿 bilibili，渲染层的钱还写死了 ¥），补出来当然是国内。
//
// ⚠️她 2026-09-05 报过一模一样的病，那次是行程：「资料丢了重新找回来，王爷就变成在
//   公寓里了」。当时给行程写了 SCHED_WORLD_RULE，查手机没跟上——四处一样喂那条老病，
//   而查手机压根不在那张名单上。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), engine = R("js/engine.js");

test("buildBundle 真的会发【他自己住在哪儿】", () => {
  assert.match(engine, /if \(!ctx\.notRoleplay && ctx\.homeCity\) \{/,
    "buildBundle 没发 ctx.homeCity——那就等于算了个寂寞");
  const seg = engine.slice(engine.indexOf("ctx.notRoleplay && ctx.homeCity"), engine.indexOf("ctx.notRoleplay && ctx.homeCity") + 700);
  assert.match(seg, /认识的人、去的地方、收到的信、买东西的渠道、用的货币和地址格式/, "得说清它管哪些东西");
  assert.match(seg, /别把这一条挂在嘴上报地名/, "没挡住它把地名当台词念出来");
  // 言秋那一支不发：他不是被扮演的角色
  assert.ok(seg.indexOf("notRoleplay") >= 0);
});

test("ctxFor 从地图上钉的那个点取城市——照写它那段代码的字段名", () => {
  // ⚠️桩钉在【写的那一头】（stub-from-the-writer.md）：map.js 的 onSetHome 存的是
  //   {city, lat, lng}，components.js:1194 读的也是 c.home.city。字段名一改，这里当场红。
  assert.match(app, /^\s*homeCity: \(char && char\.home && char\.home\.city\) \? String\(char\.home\.city\)\.trim\(\)\.slice\(0, 40\) : "",$/m,
    "ctxFor 没填 homeCity");
  assert.match(R("js/components.js"), /String\(c\.home\.city \|\| "他那边"\)/, "写它那头的字段名变了？两边要一起改");
});

test("群里三处也按人喂——同一个群里的人可能压根不在一个国家", () => {
  // 群线上 / 群通话：拼进各自的 memberDesc
  const hits = app.match(/const hcSeg = \(c\.home && c\.home\.city\)/g) || [];
  assert.equal(hits.length, 2, "群线上和群通话各要一份，现在 " + hits.length + " 份");
  assert.match(app, /\+ aSeg \+ zSeg \+ hcSeg \+ ageSeg/, "群线上没拼进 memberDesc");
  assert.match(app, /\+ aSeg \+ zSeg \+ hcSeg \+ n\.ageSeg/, "群通话没拼进 memberDesc");
  // 群线下：一人一份的 map，engine 按 c.id 取
  assert.match(app, /memberHome: \(\(\) => \{[\s\S]{0,300}c\.home\.city/, "群线下没算");
  assert.match(engine, /ctx\.memberHome && ctx\.memberHome\[c\.id\]/, "群线下 engine 没按人取");
});

test("查手机那一处还要额外挡住「界面是中文的所以他在国内」", () => {
  const phone = R("js/phone.js");
  assert.match(phone, /const PHONE_WORLD_RULE =/, "查手机没有自己那条世界规则");
  const seg = phone.slice(phone.indexOf("const PHONE_WORLD_RULE"), phone.indexOf("const PHONE_ANGLE"));
  assert.match(seg, /这不代表他人在国内/, "没挑明界面语言 ≠ 人在哪儿");
  assert.match(seg, /搬到另一座城市还成立吗/, "没给判据");
  assert.ok(!/曼大|温尼伯|多伦多|@163|北京|上海/.test(seg),
    "塞了内容示范——给了例子每个角色都会长出同一个（prompt-no-content-samples.md）");
  // 真的接进了每一个 app 的提示词，不是声明了没人引用（v55.95 那个形状）
  // ⚠️别钉死它前面还有谁：另一个窗口同时在这一行插了 phoneOwnOnlyBlock（查手机串味那条）。
  //   要查的是【它真的在这条拼接链上】，不是它排第几。
  assert.match(phone, /const _full = spec\.instruction \+[^;]*\+ PHONE_WORLD_RULE \+[^;]*phoneMoneyBlock/, "算了没拼进去");
});

test("每一个 app 的提示词里都真的有它（拼出来核，不是核源码）", () => {
  const { phoneProbeSpec } = require(path.resolve(__dirname, "..", "js/phone.js"));
  const char = { id: "c1", name: "沈屿白", persona: "研究生。", home: { city: "温尼伯" } };
  ["mail", "takeout", "shopping", "wechat", "browser", "album", "wallet"].forEach(k => {
    assert.match(phoneProbeSpec(k, { char }).instruction, /先认准他人在哪儿/, k + " 这一栏没带上");
  });
});
