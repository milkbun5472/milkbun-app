// 她 2026-09-11：「这个 Ta 眼里又是好几天没看过了，为啥来来回回修了那么多次都
// 当天好了以后又不行了。手动复看也是说这条路线没配好」。
//
// 查下来是三件事叠在一起，而且没有一件是「这次又坏了」：
//  ① **复看从来就没有自动的**（app.js 里白纸黑字写着「Ta 眼里专门复看只走手动入口」）。
//     所以「当天好了」＝那天是她自己按的；之后再没人按，就再也不变。
//  ② 复看和建卡走的是【后台任务模型】那条线（bgActive 优先，v64.43 挂上去的），
//     不是聊天那条。她一直在修聊天那条，**怎么修都修不到点上**。
//  ③ 报错只说「这条线路没配好」，不说是哪条——所以②永远暴露不出来。
//
// 这一份钉的是②和③的修法，以及①那台【从来没人开过的自动预算机器】还在不在。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), gaze = R("js/gaze.js"), screens = R("js/screens.js");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");

test("报错要说清是哪条线路——不说的话她只能挨条去试", () => {
  assert.match(app, /const gazeRouteZh = p =>/);
  // bgActive 在没单独选后台线路时【就是主模型】，所以得看 bgApiId 有没有真的选过
  assert.match(app, /\(bgApiId && bgActive && p\.id === bgActive\.id\) \? "后台任务模型" : "主模型"/,
    "不看 bgApiId 的话，没选过后台线路的人也会被告知「后台任务模型坏了」");
  assert.match(app, /p\.name \|\| "未命名"/, "只说「后台任务模型」不说是哪一条，她有好几条的时候还是得挨个试");
  // 三个出口都要带上：卡上那一行、点开的原文、当场那个 toast
  assert.match(app, /markReviewFail\(char\.id, e\.message \|\| "调用没成", gazeRouteZh\(p\)\)/);
  assert.match(app, /markAutoSeedFail\(char\.id, e\.message \|\| "调用没成", gazeRouteZh\(p\)\)/);
  assert.match(app, /toast\("复看没成（" \+ gazeRouteZh\(p\) \+ "）："/);
});

test("线路名要落进卡里，不能只闪一下 toast", () => {
  assert.match(gaze, /function markReviewFail\(charId, why, route\)/);
  assert.match(gaze, /function markAutoSeedFail\(charId, why, route\)/);
  // 显示那一栏照旧是翻好的人话（不许直接存 e.message），只是前面挂了线路名
  assert.match(gaze, /box\.reviewErr = \(\(rt \? rt \+ "：" : ""\) \+ plainWhy\(why\)\)/);
  assert.ok(strip(gaze).indexOf("box.reviewErr = String(why") < 0);
  // 点开那份原文，第一行就写着这一枪走的是哪条
  assert.match(gaze, /box\.reviewErrRaw = \(rt \? "【这一枪走的是 " \+ rt \+ "】/);
});

test("守卫检查的得是【真正要用的那条】", () => {
  // 复看走 bgActive 优先；守卫却只看 apiFor(角色)，于是后台线路坏掉时守卫照样放行，进去才 401
  assert.match(app, /onGazeReview: \(\) => \{ if \(!\(bgActive \|\| apiFor\(scc\.id\)\)\) return toast\("请先配置 API"\)/);
  // 这两枪确实是后台线路优先——守卫和实际用的那条必须是同一条
  assert.equal((app.match(/const p = bgActive \|\| apiFor\(char\.id\);/g) || []).length, 2,
    "建卡和复看都该是后台线路优先；数目对不上说明有一处偷偷改成别的了");
});

test("设置里那一栏的说明要跟上——一层挪了地方，说明没跟上也是漏", () => {
  const i = screens.indexOf('routeBox("后台任务模型"');
  assert.ok(i > 0);
  const box = screens.slice(i, i + 400);
  assert.match(box, /「Ta 眼里」的建卡和复看也走这条/,
    "那一栏写的是「记忆、日程、钱包、便签等机械后台活」——她照着说明指去便宜线路，顺手把「Ta 眼里」也指过去了，而她无从知道");
  assert.match(box, /「Ta 眼里」不更新时先回来看这一栏/);
});

test("① 自动复看接回来了：闸只看「聊了几条／隔了多久」", () => {
  // 她 2026-09-11：「**这本来就是要自动的，我们就是修不好很多次而已**」——
  // gaze.js 里那句「聊天不再依据次数、天数或省略字段自动复看」是当初放弃时留的注释，
  // 不是设计。现在有两个自动挂点 + 手动那颗键。
  const calls = (strip(app).match(/reviewGazeFor\(/g) || []).length;
  assert.equal(calls, 2, "reviewGazeFor 有 " + calls + " 个调用点（自动那一处 + 手动那颗键）");
  assert.match(app, /reviewGazeFor\(scc, true\)/, "手动那颗键没了");
  assert.match(app, /reviewGazeFor\(char, false\)/, "自动那条又没接上");
  assert.equal((strip(app).match(/maybeAutoReviewGaze\(char/g) || []).length, 2,
    "自动复看要跟建卡挂在同样那两处（线上一处、线下一处）");
  // ⚠️闸写在 Gaze 那一处，app 这儿只负责数「上次复看之后又聊了几条」
  assert.match(app, /if \(!window\.Gaze\.reviewDue\(char\.id, fresh\)\) return;/);
  assert.match(app, /Number\(m\.ts \|\| 0\) > since/);
  assert.ok(strip(app).indexOf("REVIEW_FLOOR_DAYS") < 0 && strip(app).indexOf("REVIEW_FRESH") < 0,
    "闸的数字被抄了第二份到 app 里——改一处必然漏一处");
  // 她定的那句：不要那么久 / 有料就写 / 没有就不写 / 不准永远不写
  assert.match(gaze, /const REVIEW_FLOOR_DAYS = 6;/, "又变回十四天那种「那么久」了");
  assert.match(gaze, /const REVIEW_FRESH = 60;/);
  assert.match(gaze, /const REVIEW_FLOOR_MIN = 8;/);
  assert.match(gaze, /这本来就是要自动的，我们就是修不好很多次而已/, "那句放弃的注释得换成她的原话，不然下一轮又有人当它是设计");
  // 失败满三次不许停死——那正是她这些天遇到的「怎么都不更新」
  assert.match(gaze, /if \(\(Number\(box\.reviewN\) \|\| 0\) >= REVIEW_MAX\) return t - last >= REVIEW_RETRY_DAYS \* 86400000/);
});
