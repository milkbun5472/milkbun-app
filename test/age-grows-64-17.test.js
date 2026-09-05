// 「写了年龄就写死了，但是我不想他是写死的——王爷不应该有个现实年份，
//  但是他也确实可以年龄增加的」（她 2026-09-05）。
// 病根：那一栏存的是【一个数】，而它其实是【那一天他多大】。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

// 真的那几个日子函数一起抠出来：农历那一支不许拿替身糊弄过去
// （stub-from-the-writer 的同一条道理——桩照着真正在跑的那段写）
const pick = name => eng.match(new RegExp("function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}"))[0];
const LUNAR_INFO = eval(eng.match(/const LUNAR_INFO = \[[\s\S]*?\];/)[0].replace("const LUNAR_INFO = ", ""));
const NAMES = ["parseMonthDay", "lunarNewYearUTC", "lunarLeapMonth", "lunarLeapDays", "lunarMonthDays", "lunarYearDays", "solarToLunar", "lunarToSolar", "lunarDayFromZh", "parseLunarBirthday", "ageDrift", "charAgeNow"];
const LUNAR_MON_ZH = eval("(" + eng.match(/const LUNAR_MON_ZH = \{[\s\S]*?\};/)[0].replace("const LUNAR_MON_ZH = ", "").replace(/;$/, "") + ")");
const box = new Function("LUNAR_INFO", "LUNAR_MON_ZH", "charAge",
  NAMES.map(pick).join("\n") + "\nreturn { " + NAMES.join(", ") + " };")(LUNAR_INFO, LUNAR_MON_ZH, () => null);
NAMES.forEach(n => { global[n] = box[n]; });
const ageDrift = box.ageDrift, charAgeNow = box.charAgeNow;
const D = 86400000;

test("没有生日：从写下那天起，满一年长一岁", () => {
  const t0 = new Date(2026, 0, 10).getTime();
  assert.equal(charAgeNow({ age: "29", ageAt: t0 }, t0), 29, "当天就该是她写的那个数");
  assert.equal(charAgeNow({ age: "29", ageAt: t0 }, t0 + 364 * D), 29, "不满一年就长了");
  assert.equal(charAgeNow({ age: "29", ageAt: t0 }, t0 + 366 * D), 30);
  assert.equal(charAgeNow({ age: "29", ageAt: t0 }, t0 + 3 * 366 * D), 32);
  // 妖和神照样长，也照样不封顶
  assert.equal(charAgeNow({ age: "500", ageAt: t0 }, t0 + 366 * D), 501);
});

test("有生日（哪怕只有月日）：生日那天才加一", () => {
  const t0 = new Date(2026, 0, 10).getTime();           // 1 月 10 日写下
  const c = { age: "29", ageAt: t0, birthday: "3-15" };
  assert.equal(charAgeNow(c, new Date(2026, 2, 14).getTime()), 29, "生日前一天就长了");
  assert.equal(charAgeNow(c, new Date(2026, 2, 16).getTime()), 30, "生日过了没加一");
  assert.equal(charAgeNow(c, new Date(2027, 2, 16).getTime()), 31);
  assert.equal(charAgeNow(c, new Date(2026, 11, 31).getTime()), 30, "年底又多加了一次");
});

test("农历生日也认（王爷那一类多半是农历）", () => {
  const t0 = new Date(2026, 0, 10).getTime();
  const c = { age: "29", ageAt: t0, birthday: "腊月廿三" };
  const a1 = charAgeNow(c, new Date(2026, 11, 31).getTime());
  assert.ok(a1 === 29 || a1 === 30, "农历那一支算崩了：" + a1);
  assert.equal(charAgeNow(c, new Date(2030, 5, 1).getTime()) - 29, 4, "四年该长四岁");
});

test("要停就得她亲口说停", () => {
  const t0 = new Date(2020, 0, 1).getTime();
  assert.equal(charAgeNow({ age: "17", ageAt: t0, ageFrozen: true }, Date.now()), 17);
  assert.match(scr, /const \[ageFrozen, setAgeFrozen\] = useState\(!!\(initial && initial\.ageFrozen\)\);/, "表单没有这个开关");
  assert.match(scr, /"就停在这个岁数"/, "界面上说不清它停没停");
});

test("没有起算日的一律不动——绝不凭空替她加几岁", () => {
  assert.equal(charAgeNow({ age: "29" }, Date.now()), 29, "没起算日却长了岁数");
  assert.equal(ageDrift(0, "", Date.now()), 0);
  assert.equal(ageDrift(Date.now() + 10 * D, "", Date.now()), 0, "起算日在未来还敢算");
});

test("起算日：改了那个数才重新起算，改别的栏不许把它往后推", () => {
  assert.match(scr, /ageAt: !ageInput\.trim\(\) \? 0/, "清空岁数没把起算日一起清掉");
  assert.match(scr, /\(initial && String\(initial\.age \|\| ""\)\.trim\(\) === ageInput\.trim\(\) && Number\(initial\.ageAt \|\| 0\)\)\s*\n?\s*\|\| Date\.now\(\)/,
    "改个头像顺手保存一次，就把他的起算日推到今天了——那他永远长不了一岁");
  assert.match(scr, /ageFrozen: !!ageFrozen,/, "开关没存下来");
});

test("老角色补起算日：在塞进 state 之前补完，而且不补已经说了要停的", () => {
  const mig = app.slice(app.indexOf("const c = (() => {"), app.indexOf("setCharacters(c);"));
  assert.match(mig, /if \(!x \|\| x\.ageFrozen \|\| !String\(x\.age \|\| ""\)\.trim\(\) \|\| Number\(x\.ageAt \|\| 0\)\) return x;/, "补的条件不对");
  assert.match(mig, /return \{ \.\.\.x, ageAt: Date\.now\(\) \};/, "补的是今天以外的日子——那等于替她改了角色的岁数");
  assert.match(mig, /return touched \? next : list;/, "补完存了盘却把没补的那份塞进 state，这一开机它们照旧不长");
});
