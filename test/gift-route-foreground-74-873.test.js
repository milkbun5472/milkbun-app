// 「秋秋的礼物」只跑她自己按下去的那一下（她 2026-10-05 的回馈活动）
//
// 她原话：「禁止用在后台吧，线上线下都能用，这样就更像她们自己选的生成而不是后台烧」。
//
// 钥匙住在 Cloudflare Worker 里（~/yanqiu-den/qiuqiu-trial），前端拿不到——
// 所以这边不管钱，只管【哪一枪可以走这条线】。代理那头有同一道闸，这儿是第一道。
//
// ⚠️fail-closed：没写明 use 的一律当后台。
//   漏标一处，最坏是那个功能对试玩用户不工作；
//   反过来默认放行的话，漏标一处就是在偷偷烧她的额度，而且【没人看得见】。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const eng = fs.readFileSync("js/engine.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const live = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const E = live(eng), A = live(app);

test("① 认得出这条线，而且认两种写法（显式标记 + 代理地址）", () => {
  assert.match(E, /function isGiftRoute\(p\)/, "没有这一层判断");
  const fn = E.slice(E.indexOf("function isGiftRoute(p)"), E.indexOf("function giftHeaders"));
  assert.match(fn, /p\.gift/, "显式标记认不出来");
  assert.match(fn, /qiuqiu-trial/, "按地址认不出来——有人手填这条线路也该走同一道闸");
  // 公共版里写的是秋秋机自己的 /gift/（Worker 真地址带着她账号名，黑名单会拦）
  assert.match(fn, /qiuqiu-machine\\\.pages\\\.dev\\\/gift\\\//, "/gift/ 那个前门认不出来");
});

test("② fail-closed：没写明用途的当后台", () => {
  const fn = E.slice(E.indexOf("function giftHeaders"), E.indexOf("async function callAI"));
  assert.match(fn, /GIFT_USES\[use\] \? use : "bg"/, "默认值不是 bg，漏标一处就会偷烧额度");
  assert.match(E, /const GIFT_USES = \{ chat: 1, offline: 1, call: 1, models: 1 \}/, "放行名单变了");
  // 不是这条线的，一个多余的头都不加
  assert.match(fn, /if \(!isGiftRoute\(p\)\) return \{\};/, "给别的线路也加了头");
});

test("③ 真正发请求那两处都带上了", () => {
  assert.match(E, /Authorization: "Bearer " \+ p\.apiKey \}, giftHeaders\(p, opts\)\)/, "聊天那一枪没带");
  assert.match(E, /giftHeaders\(p, \{ use: "models" \}\)/, "拉模型那一枪没带，选模型会直接被拒");
});

test("④ 她按下去的那几枪都标了", () => {
  // 单聊线上两枪（正常 + 重试）+ 群聊线上一枪 + 群投票一枪；单人通话一枪 + 群通话一枪
  // ⚠️群聊和群通话原来漏了（2026-10-08 开闸当天群友报「群聊走的秋秋的礼物，生不出来」）。
  //   按次数数不够——数对了也可能标在别处——所以下面按【那一枪本身】逐个钉。
  assert.equal((A.match(/use: "chat"/g) || []).length, 4, "线上那几枪没都标（单聊两枪 + 群聊 + 群投票）");
  assert.equal((A.match(/use: "call"/g) || []).length, 2, "通话那两枪没都标（单人 + 群）");
  const gShoot = A.slice(A.indexOf("const _gShoot = uc => callAI("), A.indexOf("const _gShoot = uc => callAI(") + 900);
  assert.match(gShoot, /use: "chat"/, "群聊线上那一枪没标——群里说话会被当成后台拒掉");
  assert.match(A, /window\.CallCamera\.withFrame\(hist, cameraFrame\), \{ use: "call",/, "群通话那一枪没标");
  // 线下：单人两枪 + 群两枪
  assert.equal((E.match(/use: "offline"/g) || []).length, 4, "线下四枪没都标（单人正常/重试 + 群正常/重试）");
});

test("⑤ 后台那些活儿一处都不许标", () => {
  // 摘要、观测、朋友圈、钱包刷新这些都不该出现放行标记
  ["summarize", "extractMem", "autoRefresh", "observe"].forEach(k => {
    const i = A.indexOf(k);
    if (i < 0) return;
    const seg = A.slice(i, i + 400);
    assert.ok(!/use: "(chat|offline|call)"/.test(seg), k + " 附近有人给后台活贴了前台标记");
  });
});

// 开场前她要在【真的 app】里试一遍——curl 只证明代理和站子通，证明不了整条链。
//   所以 app 得能把预览口令带上；口令只活在她那台手机里，不进代码、不进包。
test("⑥ 预览口令：从网址记一次，之后礼物线每枪都带；不跟着存档跑", () => {
  assert.match(E, /new URLSearchParams\(location\.search\), v = q\.get\("giftpreview"\)/, "没从网址里接口令");
  assert.match(E, /localStorage\.setItem\("qq_giftPreview", v\)/, "口令没记住");
  assert.ok(!/x_giftPreview/.test(E), "口令存进了 x_ 键——会被云同步带走");
  assert.match(E, /history\.replaceState/, "口令留在地址栏里了，截个图就漏");
  const fn = E.slice(E.indexOf("function giftHeaders"), E.indexOf("async function callAI"));
  assert.match(fn, /if \(t\) h\["x-qq-preview"\] = t;/, "礼物线那一枪没把口令带上");
  // 不是礼物线就一个头都不加——口令绝不能带去她们自己的站子
  assert.ok(fn.indexOf('if (!isGiftRoute(p)) return {};') < fn.indexOf("qq_giftPreview"),
    "先读了口令再判断线路——有可能把口令发去别人的站子");
});

// 限流按设备算（她 2026-10-05：每台设备每分钟 4 次 + 每个 IP 30 次兜底）。
//   不按 IP 卡：国内手机流量很多人共用同一个出口 IP，按 IP 等于一栋楼的陌生人共用 4 次。
test("⑦ 礼物线每枪带设备编号：随手生成、不跟云同步、只发给礼物线", () => {
  const fn = E.slice(E.indexOf("function giftHeaders"), E.indexOf("async function callAI"));
  assert.match(fn, /localStorage\.getItem\("qq_giftDevice"\)/, "没有设备编号");
  assert.ok(!/x_giftDevice/.test(E), "编号存进了 x_ 键——会被云同步，一个人两台设备共用一份额度");
  assert.match(fn, /crypto\.randomUUID/, "编号不是随机的");
  assert.match(fn, /h\["x-qq-device"\] = d;/, "生成了却没带上");
  assert.ok(fn.indexOf('if (!isGiftRoute(p)) return {};') < fn.indexOf("qq_giftDevice"),
    "先生成编号再判断线路——编号会被发去她们自己的站子");
});
