const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8"), eng = fs.readFileSync("js/engine.js", "utf8");
test("日记当补充记忆：日子只从她点名的和召回记忆的日期来，最多两天，秘密段不带", () => {
  const i = app.indexOf("const diaryRecallFor = ");
  const seg = app.slice(i, app.indexOf("const ctxFor = ", i));
  assert.ok(/她说的「/.test(seg) && /召回的记忆那天/.test(seg));
  assert.ok(seg.includes("if (out.length >= 2) return;"));
  assert.ok(seg.includes("!p.secret"));
  assert.ok(app.includes("c.diaryRecall = diaryRecallFor(char, c.memLib,"));
  assert.ok(eng.includes("if (ctx.diaryRecall && String(ctx.diaryRecall).trim()) parts.push("));
});
test("日子也认星期几和生日", () => {
  const i = app.indexOf("const diaryRecallFor = ");
  const seg = app.slice(i, app.indexOf("const ctxFor = ", i));
  assert.ok(seg.includes("(?:周|礼拜|星期)([一二三四五六日天])"));
  assert.ok(seg.includes("daysUntilBirthday(b, d0) === 0"));
});
test("日记也带「语气与年龄感」那条", () => {
  assert.ok(eng.includes('const parts = [DIARY_SKELETON, "", buildBundle(ctx)].concat(ctx.notRoleplay ? [] : ["", PERSONA_REGISTER_ANCHOR]);'));
});
