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

// 她 2026-09-09 纠了我一句：「按次计费不在乎缓存」。
// 我原来把「还有几天」挡在外面，理由是这一行落在缓存切点之前、写进天数会天天作废缓存——
// 那个理由在她这儿不成立：她按【次】付钱，缓不缓住一分钱也省不到。所以天数直接写进去。
test("这一行连今天离生日还有几天一起说", () => {
  const md = (d => (d.getMonth() + 1) + "-" + d.getDate())(new Date());
  assert.match(F.birthdayLine({ birthday: md }), /就是今天/);
  assert.match(F.birthdayLine({ birthday: "1998-03-04" }, new Date("2026-09-09T12:00:00")), /今天离它还有 \d+ 天/);
  // ⚠️天数走 daysUntilBirthday，跟 dateNote 那两句同一个函数——各写一份迟早对不上
  const fn = engine.slice(engine.indexOf("function birthdayLine(char, now)"), engine.indexOf("\n// 生日写了年份时"));
  assert.match(fn, /daysUntilBirthday\(bd, now \|\| new Date\(\)\)/);
  // dateNote 那两句管的是【今天该怎么表现】，还在
  assert.match(app, /const cdu = daysUntilBirthday\(char && char\.birthday, today\)/);
  assert.match(app, /🎂 今天是你自己的生日/);
});
