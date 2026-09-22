// 她 2026-09-22 转群里读者（! YOLO）：「线下文风有时候好像他们想象力很匮乏，就是吃饭睡觉来的，
//   然后会喜欢给我两个选项让我选，剧情推进没有什么惊喜感」。
//
// 这不全是模型的锅：线下那套准则里两条现成的规矩会叠出这个副作用——
// 一边「不可替用户作重大决定」，一边「不要求每轮制造推进」，
// 于是最安全的走法就成了【原地不动 + 把球抛回去】：「你是想先吃饭还是先休息？」
// 所以补的是【射程】和【来源】，不是又一条禁令。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

const runtime = (() => {
  const i = engine.indexOf("const OFFLINE_NARRATIVE_RUNTIME = `");
  assert.ok(i > 0, "抠不出线下叙事准则");
  return engine.slice(i, engine.indexOf("`;", i));
})();

test("把「谁的决定归谁」说清楚，而不是再加一条禁令", () => {
  assert.match(runtime, /谁的决定归谁/, "这一段没了");
  assert.match(runtime, /属于 TA 自己的事，TA 自己定，并且【当场就做】/, "没说清 TA 自己那半可以直接做");
  assert.match(runtime, /只有属于她本人的那几样才停下来等/, "没划清哪些才该停下来等她");
  // ⚠️这条是关键：停下来等 ≠ 摆两个选项
  assert.match(runtime, /「停下来等」不等于「摆两个选项让她挑」/, "没拦住她报的那个具体毛病");
  // 给出口不给判决：不是一刀切禁掉二选一
  assert.match(runtime, /最多出现一次，而且得是真的两难/, "把二选一整个禁死了——真两难的时候它是对的");
});

test("推进有三个来源，且不要求每轮都推", () => {
  assert.match(runtime, /这一幕从哪儿往前走/, "这一段没了");
  assert.match(runtime, /TA 自己此刻想做、但还没做的一件事/, "少了「TA 自己的动机」这一路");
  assert.match(runtime, /这个地方、这个时辰本来就会发生的事/, "少了「环境自己发生」这一路");
  assert.match(runtime, /一件还没了结的旧事忽然在这一刻被碰到/, "少了「旧事被碰到」这一路");
  assert.match(runtime, /绝大多数时候一顿饭就是一顿饭/, "变成了「每拍都要造事件」——那是另一种坏");
  assert.match(runtime, /那不是平淡，那是没在往前走/, "没点破她报的那个「吃吃睡睡」");
});

// ⚠️同一件事只说一处不够：那条「不可替用户作重大决定」在【输出协议】那头也写着一遍，
//   不对齐的话它会继续被读成「所以问她」。
test("字数规则那头那条也跟着对齐了", () => {
  const i = engine.indexOf("遇到需要用户本人选择的岔口时");
  assert.ok(i > 0, "抠不出那一条");
  const seg = engine.slice(i, i + 260);
  assert.match(seg, /指的是【属于她本人】的决定/, "那条还在被读成「所以抛选择题」");
  assert.match(seg, /别改写成两个选项让她挑/, "没对齐");
});

// ⚠️她当轮把要的形状说死了：「就是希望角色推进剧情而不是让她做决定，角色可以推进重大事件，
//   但是最后可以留主动权给她（就算开了角色替我行动也一样）」。
//   所以这不是「别替她决定」那么简单——是【大事 TA 自己推成既成事实，最后那一下停在她手里】。
test("大事归 TA 推，最后那一下归她", () => {
  assert.match(runtime, /重大的那几件也算 TA 自己的事/, "没说清重大推进不用先问她");
  assert.match(runtime, /做成一个既成事实/, "没给「既成事实」这个落点——不给它就只会问");
  assert.match(runtime, /把最后那一下留给她/, "没把主动权还给她");
  assert.match(runtime, /你给局面，她给答案/, "两边的分工没说成一句她能记住的话");
});

// ⚠️「角色替我行动」那个开关原来【只有油门没有刹车】：开着就能把她的重大选择也演完。
test("替我行动那两支各补一半，而且共用同一条尾巴", () => {
  const i = engine.indexOf("const AGENCY_TAIL =");
  assert.ok(i > 0, "两支没有共用那一条——各写一遍迟早只改一处");
  const seg = engine.slice(i, i + 1400);
  assert.match(seg, /推动剧情是你的活，不是她的/, "没把「谁负责推进」说死");
  assert.match(seg, /写到她该回应、该接住、该翻脸或该点头的那一拍就停下/, "没说清停在哪一拍");
  // 开着那一支要有刹车
  assert.match(seg, /替她写的只限\*\*过渡性的那些\*\*/, "开着「替我行动」时没有刹车");
  assert.match(seg, /她的重大选择、她的答应或拒绝、她那句关键的话，一个字都不许替她定/, "刹车没踩在正确的地方");
  // 关着那一支要有油门（不然它被读成「我什么都推不动」）
  assert.match(seg, /: "只描写你自己的言行和心理，不要替对方决定动作或台词。" \+ AGENCY_TAIL/,
    "关着那一支没接上——它会继续被读成「所以我只能问她」");
});
