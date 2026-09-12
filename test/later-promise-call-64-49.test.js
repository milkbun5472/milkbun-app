// 他自己在聊天里说好的那条约（laterPromise）也能是【打电话】
//（她 2026-09-06：「主动约定是动念那边的……现在我是想把打电话这种也接上去」）。
//
// 病在提示词那一栏自己：触发例子里本来就写着「到家给你打电话」，可这条约
// 【没有一栏能记下它是个电话】，于是每一次都落成一条文字消息——
// 说好的电话到点变成一句「我到家了」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("字段字典里那一栏多了 how，而且说清了它凭什么填", () => {
  assert.match(app, /laterPromise:\{"minutes":数字,"about":"回来要说\/要做的事","how":"chat\|voice\|video"\}/,
    "schema 里没有 how，模型压根没处写「我说的是打电话」");
  assert.match(app, /\*\*how 照你自己刚说出口的那句来\*\*/, "没说清这一栏按什么填");
  assert.match(app, /到点她那边【真的会响】/, "没告诉他这一栏是有后果的");
  assert.match(app, /看不出是哪种就填 chat/, "没给兜底那一档，模型只能瞎猜");
});

// v67.39：认不出的仍旧当 chat，但「认得出」不再等于「逐字等于 voice」——
// 模型写「电话」「语音」「call」时意思一点都不含糊，不认它们，说好的电话
// 到点还是缩水成一条消息（她 2026-09-12：「为啥约定还是不会打电话」）。
test("认得出的写法都认，认不出的一律当发消息", () => {
  const i = app.indexOf("const PROMISE_VIA = {");
  assert.ok(i > 0, "那张表没了");
  const src = app.slice(i, app.indexOf("const promiseVia = ", i)) + app.slice(app.indexOf("const promiseVia = ", i), app.indexOf("\n", app.indexOf("const promiseVia = ", i)));
  const f = new Function(src + "\nreturn promiseVia;")();
  ["voice", "VOICE", " 语音 ", "电话", "打电话", "call", "phone"].forEach(x => assert.equal(f(x), "voice", x + " 没认出来是打电话"));
  ["video", "视频", "视频通话", "FaceTime"].forEach(x => assert.equal(f(x), "video", x + " 没认出来是视频"));
  // 认不出的一律 chat——宁可少响一次，也不能凭一个认不出的值把电话打过去
  ["chat", "", "随便", "true", "语音消息"].forEach(x => assert.equal(f(x), "chat", x + " 被当成了打电话"));
  assert.equal(f(true), "chat");
  assert.equal(f(null), "chat");
  assert.equal(f(undefined), "chat");
  // 存进那条约里
  assert.match(app, /about: String\(lp\.about \|\| ""\)\.slice\(0, 120\), via: via, createdTs: Date\.now\(\)/,
    "认出来了却没存进约里");
  assert.match(app, /const via = promiseVia\(lp\.how\);/, "落账那一处没走这张表");
});

test("两个来源共用同一条到期链，同一个 via", () => {
  // ① 他自己说的（laterPromise）② 她在「我们说好的」里挂的（setPactDue）
  assert.match(app, /id: "pm_" \+ Date\.now\(\)\.toString\(36\)[^\n]*via: via/, "他说的那条没带 via");
  assert.match(app, /id: "pk_" \+ Date\.now\(\)[^\n]*via: v \}/, "她挂的那条没带 via");
  // 消费端只有这一个地方——两条来源不许各走各的
  const consumers = app.match(/ringFromChar\(c, pm\.via/g) || [];
  assert.equal(consumers.length, 1, "到期这一层长出了第二个出口");
});

test("「她正看着这个聊天」那道闸不许拦电话", () => {
  const seg = app.slice(app.indexOf("const due = (promisesRef.current || [])"), app.indexOf("      } catch (e) {}\n      try {"));
  const iRing = seg.indexOf('if (pm.via === "voice" || pm.via === "video")');
  const iView = seg.indexOf("viewRef.current.charId === pm.charId");
  assert.ok(iRing > 0 && iView > 0, "两句都得在");
  assert.ok(iRing < iView,
    "电话那一支排在了「她正看着这个聊天」后面——她坐在这个聊天里等电话，结果一直拖到变成未接来电");
  // 但「人就在旁边」仍然要拦在前面：面对面还给她打电话是荒唐的
  const iTogether = seg.indexOf("currentlyTogetherWithChar(pm.charId)");
  assert.ok(iTogether > 0 && iTogether < iRing, "人就在旁边时还会把电话打过来");
  // 电话这一支自己 drop，不然它 return 之后那条约永远留在队列里，一进 app 就响
  // ⚠️窗口只取到这一支自己的 return——开宽了会把下面那一段的 drop() 也算进来，
  //   于是「电话这一支忘了 drop」这种改法照样绿（第一版就是这么放过去的）
  const branch = seg.slice(iRing, seg.indexOf("return;", iRing));
  assert.match(branch, /drop\(\);/, "电话这一支没把那条约消费掉——会一直响");
  assert.match(branch, /dongnianFiredRef\.current\[pm\.charId\] = Date\.now\(\);/, "刚打完电话，动念还会紧跟着再来一条");
});
