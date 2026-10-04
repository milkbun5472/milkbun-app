// 她 2026-10-05：「一起学里面角色回复喂了啥，为啥人设很刻板印象说话跟聊天不一样」→「都做吧，然后要分角色绑定的面具」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const study = R("study.js"), app = R("app.js"), eng = R("engine.js");

test("线上说话那一层跟单聊同一份", () => {
  assert.match(study, /const VOICE = \(\) => \(typeof onlineRegisterLayer === "function" \? onlineRegisterLayer\(\) : ""\);/);
  const bp = study.slice(study.indexOf("function buildStudyPrompt("), study.indexOf("function stripName("));
  assert.match(bp, /if \(VOICE\(\)\) parts\.push\(VOICE\(\)\);/);
  const tb = study.slice(study.indexOf("function tbPersonas("), study.indexOf("function tbU("));
  assert.match(tb, /if \(VOICE\(\)\) parts\.push\(VOICE\(\)\);/, "当学生那一种没接上");
});

test("她是谁、你俩什么关系：单聊和一起学共用一份拼法", () => {
  assert.match(eng, /function herStableLines\(ctx, uName\)/);
  assert.match(eng, /function coupleStatusLines\(ctx, uName\)/);
  const bb = eng.slice(eng.indexOf("function buildBundle("));
  assert.match(bb, /parts\.push\(\.\.\.herStableLines\(ctx, uName\)\);/);
  assert.match(bb, /parts\.push\(\.\.\.coupleStatusLines\(ctx, uName\)\);/);
  assert.match(app, /const lines = \[\.\.\.herStableLines\(x, uN\), \.\.\.coupleStatusLines\(x, uN\)\];/);
});

test("面具按角色绑定：上课用的是跟这位绑的那张", () => {
  assert.match(app, /profileFor: profileFor,\n\s+\/\/ 她是谁/);
  assert.match(study, /profile: \(props\.profileFor && char \? props\.profileFor\(char\.id\) : null\) \|\| props\.profile,/);
  assert.match(study, /const p = ctx\.profileFor && stus && stus\[0\] \? ctx\.profileFor\(stus\[0\]\.id\) : null;/, "当学生那一种还拿全局面具");
});

test("场景只交代做什么，不替他定口气", () => {
  assert.doesNotMatch(study, /用自然的教学口吻/);
});

// 她 2026-10-05：「每轮消息后面都跟着举手是啥」
test("举手默认没有，跟刚说过的重了也不举", () => {
  const fmt = study.slice(study.indexOf("function tbFmt("), study.indexOf("function tbWho("));
  assert.match(fmt, /\\"hand\\":null\}/, "格式里又摆了一个填好的举手槽，模型会每轮都填");
  const turn = study.slice(study.indexOf("async function tbTurn("), study.indexOf("async function tbAnswer("));
  assert.match(turn, /turns\.some\(function \(t\) \{ const b = bare\(t\.text\);/);
});
