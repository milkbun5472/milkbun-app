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

test("①那台从来没人开过的自动预算机器——还在的话，下一个看代码的人还会以为它在跑", () => {
  // 事实先钉住：复看只有【一个】调用点，而且是手动那颗键
  // 定义那行写的是 `const reviewGazeFor = async (char, manual) =>`，不带括号，
  // 所以 `reviewGazeFor(` 数出来的就是【调用点】——现在正好一处：手动那颗键。
  const calls = (strip(app).match(/reviewGazeFor\(/g) || []).length;
  assert.equal(calls, 1, "reviewGazeFor 有 " + calls + " 个调用点（现在只有手动那一个）");
  assert.match(app, /reviewGazeFor\(scc, true\)/);
  assert.ok(strip(app).indexOf("reviewGazeFor(char, false)") < 0 && strip(app).indexOf("reviewGazeFor(scc, false)") < 0,
    "有了自动调用点就把这条断言删掉，别让它挡路");
  assert.match(app, /Ta 眼里专门复看只走手动入口/, "这句注释是唯一说清「它不会自己看」的地方，别删");
  // 而 gaze.js 那边整套自动预算还摆着：markReview(charId, 非手动) 那一支、REVIEW_MAX、tries/max
  assert.match(gaze, /const REVIEW_MAX = 3;/);
  assert.match(gaze, /if \(!manual\) box\.reviewN = \(Number\(box\.reviewN\) \|\| 0\) \+ 1;/);
  // ⚠️这一条是【留给下一轮的问题】，不是断言它对：接上自动、或者把这台机器删掉，
  //   二选一。留着不动就是「声明了但没人引用」——看代码的人会以为它在自动跑。
});
