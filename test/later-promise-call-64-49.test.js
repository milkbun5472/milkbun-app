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

test("认不出的值一律当发消息——宁可少响一次", () => {
  // 这一句真跑：模型写 "call"/"电话"/true 都不能被当成打电话
  const line = app.split("\n").find(l => l.indexOf('const via = ["voice", "video"].indexOf(') >= 0);
  assert.ok(line, "找不到那一句");
  const f = new Function("lp", line + "\nreturn via;");
  assert.equal(f({ how: "voice" }), "voice");
  assert.equal(f({ how: "VIDEO" }), "video");
  assert.equal(f({ how: "chat" }), "chat");
  assert.equal(f({ how: "call" }), "chat", "认不出的值被当成了打电话");
  assert.equal(f({ how: "电话" }), "chat");
  assert.equal(f({ how: true }), "chat");
  assert.equal(f({}), "chat");
  // 存进那条约里
  assert.match(app, /about: String\(lp\.about \|\| ""\)\.slice\(0, 120\), via: via, createdTs: Date\.now\(\)/,
    "认出来了却没存进约里");
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
