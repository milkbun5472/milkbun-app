const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

// 她 2026-08-24：「在人设里填了生日日期，可以显示他的年龄，然后过了生日之后这个数字
// 可以自动变大，角色也知道自己长了一岁，不用我自己手动进去调」。
// 生日字段本来就有，「快到生日了」的提醒也有——缺的是年份那一段：
// parseMonthDay 直接把年份丢掉了，所以从来算不出年龄。

const age = (() => {
  const g = n => { const i = engine.indexOf(n); return engine.slice(i, engine.indexOf("\n}\n", i) + 2); };
  return new Function(g("function parseBirthDate(") + g("function charAge(") + "\nreturn charAge;")();
})();
const on = d => new Date(d + "T12:00:00");

test("生日当天就长一岁，前一天还没有", () => {
  assert.equal(age("1998-3-15", on("2026-03-14")), 27);
  assert.equal(age("1998-3-15", on("2026-03-15")), 28, "当天就该跳");
  assert.equal(age("1998-3-15", on("2026-03-16")), 28);
});

test("几种写法都认", () => {
  assert.equal(age("1998年3月15日", on("2026-08-24")), 28);
  assert.equal(age("1998/3/15", on("2026-08-24")), 28);
  assert.equal(age("1998.3.15", on("2026-08-24")), 28);
});

test("没填年份就不算年龄——古风/架空角色多半只填月日", () => {
  assert.equal(age("3-15", on("2026-08-24")), null);
  assert.equal(age("", on("2026-08-24")), null);
  assert.equal(age(null, on("2026-08-24")), null);
});

test("离谱的日期一律不认，别显示个负数或者三百岁", () => {
  assert.equal(age("2030-1-1", on("2026-08-24")), null, "还没出生");
  assert.equal(age("1998-13-40", on("2026-08-24")), null);
  assert.equal(age("1700-1-1", on("2026-08-24")), null, "超过 200 岁");
});

test("年龄现算不存盘——存了就得在生日当天去改它", () => {
  // 落库的字段里不许出现 age
  assert.ok(!/\bage:\s/.test(engine.slice(engine.indexOf("function charAge"), engine.indexOf("function charAge") + 900)));
  assert.match(engine, /年龄一律【现算】不存盘/);
  assert.match(engine, /那正是她不想手动做的事/);
  assert.ok(screens.indexOf("age: ") < 0 || screens.indexOf("birthday: birthday.trim()") > 0, "人设表单只存 birthday");
});

test("角色自己知道多大，而且知道人设里写死的岁数已经过期", () => {
  assert.match(engine, /parts\.push\("【你现在的年龄】" \+ _age \+ " 岁/);
  assert.match(engine, /每过一次生日会自己长一岁/);
  assert.match(engine, /人设里若写着别的岁数，那是写下时的旧数字，以这里为准/, "写死的岁数会过期，这条不会");
  assert.match(engine, /别动不动把年龄挂在嘴边/, "别让他逢人就报岁数");
});

test("生日当天要说清「今天满几岁」——那一刻他才真的知道长了一岁", () => {
  assert.match(app, /你今天满 " \+ _cage \+ " 岁了（昨天还是 " \+ \(_cage - 1\) \+ "）/);
  assert.match(app, /过完就 " \+ \(_cage \+ 1\) \+ " 岁了/, "临近生日也提一句");
  // 只填月日的角色仍然照常过生日，只是不提岁数
  assert.match(app, /_cage != null \?/);
});

test("联系人页显示年龄和生日", () => {
  assert.match(comp, /const age = typeof charAge === "function" \? charAge\(character\.birthday, Date\.now\(\)\) : null;/);
  assert.match(comp, /age \+ " 岁"/);
  assert.match(comp, /if \(age == null && !bd\) return null;/, "两样都没有就别占地方");
});

test("表单里要告诉她「带上年份才有年龄」", () => {
  assert.match(screens, /【带上年份】就会显示年龄、生日一过自己长一岁，Ta 也知道；只填月日就不算年龄/);
});
