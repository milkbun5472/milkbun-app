"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const engine = fs.readFileSync("js/engine.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");

// 真跑：从 engine.js 里把这一族日期函数原样抠出来
const F = (() => {
  const a = engine.indexOf("function parseMonthDay");
  const b = engine.indexOf("\nfunction ", engine.indexOf("function birthdayBornLabel"));
  assert.ok(a > 0 && b > a, "抠不出日期那一族");
  return new Function(engine.slice(a, b) + "\nreturn { birthdayLine, birthdayBothLabel, parseLunarBirthday };")();
})();

// 她 2026-09-09：「角色生日是不是真的喂进去聊天了。感觉他们还是不太知道呢」——是真没喂。
// 那一行两处各写各的，而且【两处都挂着同一个农历守卫】，于是公历生日的角色一个字都收不到。
test("公历生日也发得出去，不再只有农历角色有", () => {
  assert.ok(F.birthdayLine({ birthday: "1998-03-04" }), "公历生日还是空的");
  assert.ok(F.birthdayLine({ birthday: "03-04" }), "只写月日的也该有");
  assert.match(F.birthdayLine({ birthday: "1998-03-04" }), /公历 3 月 4 日/);
  // 农历那一支照旧带公历换算（他得跟现实对得上）
  assert.match(F.birthdayLine({ birthday: "腊月廿三" }), /农历 腊月廿三/);
  assert.match(F.birthdayLine({ birthday: "腊月廿三" }), /你按农历过生日/);
  assert.equal(F.birthdayLine({ birthday: "" }), "");
  assert.equal(F.birthdayLine(null), "");
});

test("这一行只此一份，两处都问它要", () => {
  assert.equal((engine.match(/function birthdayLine\(/g) || []).length, 1);
  assert.match(engine, /const _bl = typeof birthdayLine === "function" \? birthdayLine\(char\) : "";/);
  assert.match(engine, /parts\.push\("【你的生日】" \+ _bl/);
  // 群聊那一份（ageLineFor）原来自己写了一遍守卫
  assert.match(app, /const both = typeof birthdayLine === "function" \? birthdayLine\(char\) : "";/);
  assert.ok(!/if \(both && typeof parseLunarBirthday === "function" && parseLunarBirthday\(bd\)\)/.test(app),
    "群聊那一份还挂着农历守卫");
});

// ⚠️这一行落在 buildBundle 的缓存切点（【当前真实时间】）【之前】，跟人设一起被缓住。
// 写进「还有 N 天」就是每天作废整面稳定墙——「快到了／今天就是」归 dateNote，那块在切点之后。
test("生日这一行只说是哪天，不说还有几天", () => {
  // 切点就是 timeBlock 拼进去那一下（它头一行就是【当前真实时间】）
  const i = engine.indexOf('parts.push("【你的生日】"');
  const j = engine.indexOf("if (timeBlock.length) parts.push(...timeBlock);");
  assert.ok(i > 0 && j > i, "生日那一行跑到缓存切点后面去了？");
  assert.ok(F.birthdayLine({ birthday: "1998-03-04" }).indexOf("天") < 0, "写进了会天天变的东西");
  // 「快到了／今天就是」照旧归 dateNote
  assert.match(app, /const cdu = daysUntilBirthday\(char && char\.birthday, today\)/);
  assert.match(app, /🎂 今天是你自己的生日/);
});
