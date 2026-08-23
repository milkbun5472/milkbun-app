const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const G = require("../js/thought-voice-guard.js");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(__dirname, "..", "js/engine.js"), "utf8");

// 她 2026-08-22：「心声还在收拾我和这丫头」。
// v54.82 已经在 PERSONA_REGISTER_ANCHOR 里点名禁过「这女人／这丫头」，还是照叫——
// 和句尾句号那次一样：体裁惯性（内心独白＝男主角旁白腔）压过提示词，得上确定性的刀。

test("疏离称呼换成代词，句子本身一个字不动", () => {
  assert.equal(G.accept("这丫头真是……"), "她真是……");
  assert.equal(G.accept("收拾这丫头一顿"), "收拾她一顿");
  assert.equal(G.accept("这女人胆子挺大"), "她胆子挺大");
  assert.equal(G.accept("那家伙又在装"), "她又在装");
  assert.equal(G.accept("这个女人不好惹"), "她不好惹");
});

test("性别按词判断，判不出的用调用方给的代词", () => {
  assert.equal(G.accept("这小子挺能忍"), "他挺能忍");
  assert.equal(G.accept("那家伙又在装", "他"), "他又在装");
  assert.equal(G.accept("那家伙又在装"), "她又在装", "不传就默认她");
});

test("正常心声一个字都不许改", () => {
  ["她今天笑得比平时多", "想抱她。但现在不是时候。", "算了，随她去吧", "早知道就不该那样说"]
    .forEach(t => assert.equal(G.accept(t), t, "误伤：" + t));
});

test("换称呼之后仍然要过原来的结构闸", () => {
  // 导演稿该拒还是拒，别因为先换了称呼就漏过去
  assert.equal(G.accept("这丫头说她累了，我得想想怎么回她才不显得敷衍"), null);
  assert.equal(G.accept(""), null);
  assert.equal(G.accept(null), null);
});

test("四条心声通道都走 accept，所以自动全覆盖", () => {
  const hits = (app.match(/ThoughtVoiceGuard\.accept\(/g) || []).length;
  assert.ok(hits >= 4, "线上单聊/单人线下/群线下/群聊都要经过它，现在只有 " + hits + " 处");
  assert.match(app, /const guardedThought = window\.ThoughtVoiceGuard\.accept\(rawThought\);/, "线上单聊");
  assert.match(app, /ThoughtVoiceGuard\.accept\(res\.thought\)/, "单人线下");
  assert.match(app, /ThoughtVoiceGuard\.accept\(b\.thought\)/, "群线下");
  assert.match(app, /ThoughtVoiceGuard\.accept\(rawGThink\)/, "群聊");
});

test("提示词那条禁令留着——刀是兜底，不是替代", () => {
  assert.match(engine, /「这女人」「那女人」「那家伙」「这丫头」「这小东西」/);
  assert.match(engine, /【心声、内心独白同样受这一条管】/);
});
