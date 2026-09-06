// 她 2026-09-05 发了截图：状态卡上原样印着「替他自动复看过 2/3 次:没解析出卡」。
// 「没解析出卡」是 `throw new Error()` 里的话——那是写给我看的，不是给她看的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => path.resolve(__dirname, "..", f);
const gaze = fs.readFileSync(P("js/gaze.js"), "utf8");
const app = fs.readFileSync(P("js/app.js"), "utf8");
const cut = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return src.slice(i, j); };
const plainWhy = new Function(cut(gaze, "  function plainWhy(msg)", "  function markReviewFail(") + "\nreturn plainWhy;")();

test("异常原文一律翻成人话，翻不出来的就说「这一次没成」", () => {
  assert.equal(plainWhy("没解析出卡"), "模型没按格式答");
  assert.equal(plainWhy("Unexpected token < in JSON at position 0"), "模型没按格式答");
  assert.equal(plainWhy("Request timeout after 150s"), "等太久，超时了");
  assert.equal(plainWhy("401 Unauthorized"), "这条线路没配好");
  assert.equal(plainWhy("429 Too Many Requests"), "被限流了");
  assert.equal(plainWhy("Failed to fetch"), "网没连上");
  assert.equal(plainWhy("insufficient_quota"), "额度不够了");
  // ⚠️认不出来的绝不能把原文摆到她眼前
  assert.equal(plainWhy("TypeError: x.y is not a function"), "这一次没成");
  assert.equal(plainWhy(""), "这一次没成");
  assert.equal(plainWhy(undefined), "这一次没成");
  // 已经是人话的那几句原样留着
  assert.equal(plainWhy("他一块也没写出来"), "他一块也没写出来");
  // ⚠️这一句 v64.35 起【不再进这条路】：「一块都没改」是正常结局，
  //   走 markReviewNoChange，不再被记成一次失败。plainWhy 认它的能力留着不碍事。
  assert.equal(plainWhy("复看了一遍,一块都没改"), "复看了一遍,一块都没改");
  // engine 那句诊断自带结论，得先认它——它原话里带着「不是超时」三个字，
  // 排在 /超时/ 后面就会被判反（v64.35 写反过一次，测试当场逮到）。
  assert.equal(plainWhy("〔m｜等了 1.2 秒＝上游直接打回来了（拦截／格式／配额），不是超时〕"), "上游把这次请求打回来了");
  assert.equal(plainWhy("〔m｜等了 150 秒＝等到一半才断，像超时或冷启动〕"), "等太久，超时了");
});

test("存进去之前就翻好——存原文的话这句在界面上会一直是机器话", () => {
  const rf = cut(gaze, "  function markReviewFail(charId, why)", "  const reviewState =");
  assert.match(rf, /box\.reviewErr = plainWhy\(why\)\.slice\(0, 60\);/);
  const sf = cut(gaze, "  function markAutoSeedFail(charId, why)", "  const autoSeedState =");
  assert.match(sf, /box\.autoSeedErr = plainWhy\(why\)\.slice\(0, 60\);/);
  // 两处【显示的那一栏】都不许直接存 e.message
  assert.doesNotMatch(rf, /box\.reviewErr = String\(why/);
  assert.doesNotMatch(sf, /box\.autoSeedErr = String\(why/);
  // ⚠️v64.35 起原文【另存一份】：人话给她看，原文点开才看。
  //   她 2026-09-06 报「还是不行」，界面上只有一句「这一次没成」——
  //   那正是翻不出来时的兜底，于是她和我都不知道到底什么坏了。
  //   翻好了再存这条没变；变的是「翻不出来的那部分不能连原文一起扔」。
  assert.match(rf, /box\.reviewErrRaw = String\(why \|\| ""\)\.slice\(0, 400\);/);
  assert.match(sf, /box\.autoSeedErrRaw = String\(why \|\| ""\)\.slice\(0, 400\);/);
});

test("界面那两行说人话，而且说清还试不试", () => {
  // ⚠️「2/3 次」这种写法是给我看的日志格式，她要的是「试满了没有」
  assert.doesNotMatch(gaze, /rv\.tries \+ "\/" \+ rv\.max/, "又摆回 n/m 那种日志写法了");
  assert.doesNotMatch(gaze, /st\.tries \+ "\/" \+ st\.max/);
  assert.match(gaze, /rv\.tries >= rv\.max \? "；试满了，往后不再自动试" : ""/, "试满了不说，她会一直等一个不会来的东西");
  assert.match(gaze, /st\.tries >= st\.max \? "；试满了，往后不再自动试。想现在就要，点下面那个按钮" : ""/, "空卡那一支还得告诉她能自己按");
  // v64.35：rv.err 存进去的时候就已经是人话了（markReviewFail 里翻好），
  // 这儿再翻一次是白翻——而且「没变」那一支现在根本不走这一句了。
  // v64.54：措辞按【自动试过几次】分两种，条件换成【有没有败因】——
  //   原来写的是 else if (rv.tries)，于是从没自动试过的角色（tries=0）
  //   手动失败之后卡上一个字都没有（她 2026-09-06 报的就是这个）。
  assert.match(gaze, /" 次，都没成（" : "上一次复看没成（"\) \+ rv\.err \+ "）"/);
  assert.match(gaze, /else if \(rv\.err\) lines\.push/, "又拿次数当门槛了");
  // 「他复看过一遍、觉得没什么要改的」是【答案】，不是失败，不许再说成「都没成」
  assert.match(gaze, /if \(rv\.okAt\) lines\.push\("替" \+ say\("他"\) \+ "复看过一遍，"/);
});

// 这一枪一次要写十块，窄上限里还要扣掉思考预算——想完就没配额写正文＝空返回，
// 界面上就是那句「模型没按格式答」。她 2026-09-05 亲口点名这一处开满。
test("建卡和复看那两枪开满 65535", () => {
  // v64.47：这两枪都改走 gazeCall 了（被线路拦下来时会去掉聊天记录再打一次），
  // 于是 maxTokens 从两个调用点搬进了那一处——要钉的还是同一件事，钉的地方换了。
  const seed = cut(app, "  const seedGazeFor = async (char, auto)", "  // 「规则降概率，代码才保证」在这一层的落法");
  assert.match(seed, /await gazeCall\(p, window\.Gaze\.seedSpec\(uN\), user, userSlim\)/);
  const rev = cut(app, "  const reviewGazeFor = async (char, manual)", "  const maybeAutoReviewGaze");
  assert.match(rev, /await gazeCall\(p, window\.Gaze\.reviewSpec\(uN, char\.id\), user, userSlim\)/);
  // ⚠️上限是【天花板】不是【花销】：给宽了一分钱也不多花，给窄了才会写到一半停住、
  //   重来一次——那才是真多花了一次（max-tokens-floor.md「上限是天花板」那一节）。
  //   ⚠️别列黑名单：列几个数就漏几个数。判的是「这一处除了 65535 没有别的 maxTokens」。
  //   ⚠️两次调用（full 和 slim）都得是 65535——缩的是【料】，不是【写多少】。
  const call = cut(app, "  const gazeCall = async (p, sys, full, slim)", "  const reviewGazeFor = async");
  const all = [...call.matchAll(/maxTokens:\s*(\d+)/g)].map(m => m[1]);
  assert.deepEqual(all, ["65535", "65535"], "那两枪的 maxTokens 被往下压了：" + all.join(","));
});
