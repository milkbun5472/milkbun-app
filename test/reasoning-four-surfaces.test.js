const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), comp = R("components.js"), eng = R("engine.js");

// 她 2026-08-27 拿 mingruis-miya 的现场页问「线下也有思考链，看看它咋弄的」。
// 读完（AGPL，只看做法没取代码）：两个来源——先看接口字段，字段没有就从正文里的
// <thinking> 标记捞。我们这边字段那条早就有了，缺的是【线下压根没要过这个字段】。
const grab = name => {
  const i = eng.indexOf("function " + name);
  assert.ok(i >= 0, name + " 没了");
  return eng.slice(i, eng.indexOf("\n}\n", i) + 3);
};
const reasoningFromBody = new Function(grab("reasoningFromBody") + "\nreturn reasoningFromBody;")();

test("正文里的 <thinking> 捞得出来", () => {
  assert.equal(reasoningFromBody("<thinking>先想一下\n再写</thinking>{\"scene\":\"…\"}"), "先想一下\n再写");
  assert.equal(reasoningFromBody("<think>短的</think>正文"), "短的");
  // 全角尖括号：模型偶尔打成这样
  assert.equal(reasoningFromBody("＜thinking＞全角也认＜/thinking＞正文"), "全角也认");
});

test("忘了收尾标记就把后面整段当思考——被截断也不至于整块丢掉", () => {
  assert.equal(reasoningFromBody("<thinking>没收尾的一长段"), "没收尾的一长段");
});

test("没有标记就一个字都别捞，正文一律不动", () => {
  ["", null, "就是普通正文", "a < b > c", "{\"scene\":\"他说 3<5\"}"]
    .forEach(x => assert.equal(reasoningFromBody(x), "", JSON.stringify(x) + " 不该被当成思考链"));
});

// 四处一样喂：单聊线上早就有了，这次把另外三处接齐
test("四处都要真的把 wantReasoning 送出去", () => {
  // ⚠️别冻「这两个选项挨着」：中间插进任何一个新选项(如 webSearch)都会假红。
  // 要证的是这一次调用把 wantReasoning 和 meta 都送出去了。
  const soloCall = (app.match(/callAI\(_route, system, aiMessages, \{[^}]*\}/) || [""])[0];
  assert.ok(soloCall, "单聊线上那次调用找不到了");
  assert.ok(soloCall.includes("wantReasoning: _wantReason"), "单聊线上没送 wantReasoning");
  assert.ok(soloCall.includes("meta: _callMeta"), "单聊线上没送盛思考链的盒子");
  assert.match(eng, /wantReasoning: _wantReason,\n      meta: _reasonMeta,/, "单人线下·主调用");
  assert.match(eng, /maxTokens: gBudget, timeout: 180000, wantReasoning: _wantReason, meta: _reasonMeta/, "群聊线下");
  assert.match(app, /wantReasoning: _gWantReason,\n        meta: _gReasonMeta/, "群聊线上");
});

test("线下兜底那一路也要带上——不然重试一次思考链就没了", () => {
  assert.match(eng, /plainSystem, plainHist, \{ maxTokens: generationBudget, stream: wantStreamOffline, timeout: 180000, wantReasoning: _wantReason, meta: _reasonMeta/, "单人线下·无 cot 兜底");
  assert.match(eng, /plainSystem, plainHist, \{ maxTokens: gBudget, timeout: 180000, wantReasoning: _wantReason, meta: _reasonMeta \}/, "群线下·无 cot 兜底");
});

test("言秋那条线一个字都不碰", () => {
  assert.match(app, /oCtx\.wantReasoning = !settingsFor\(charId\)\.engineerEyes && !!settingsFor\(charId\)\.showReasoning/, "单人线下要挡");
  assert.match(eng, /const _wantReason = !isDigital && !!ctx\.wantReasoning/, "线下引擎里再挡一道");
  assert.match(app, /return !_cs\.engineerEyes && !!_cs\.showReasoning/, "群聊线上按成员挡");
  assert.match(app, /return !_s\.engineerEyes && !!_s\.showReasoning/, "群线下按成员挡");
});

test("整批只想一次：思考链挂在这一轮最先冒出来的那条上", () => {
  assert.match(eng, /out\[0\]\.reasoning = _reasonMeta\.reasoning/, "群线下挂在第一个 beat");
  assert.match(app, /const _gTakeReason = \(\) => \{ const r = _gReasonLeft; _gReasonLeft = null; return r \|\| \{\}; \}/, "群聊线上取一次就消费掉");
});

test("三处新界面都用同一个 ReasoningBlock，不另起一套 UI", () => {
  const hits = (comp.match(/h\(ReasoningBlock, \{/g) || []).length;
  assert.equal(hits, 3, "单聊 + 线下卡片 + 群聊，现在只有 " + hits + " 处");
  assert.match(comp, /\(!isUser && m\.reasoning\) \? h\(ReasoningBlock, \{ m: m \}\) : null/, "线下卡片（单人和群线下共用 OffCard）");
  assert.match(comp, /h\(ReasoningBlock, \{ key: "grz" \+ i, m: _m \}\), row\]/, "群聊线上");
});
