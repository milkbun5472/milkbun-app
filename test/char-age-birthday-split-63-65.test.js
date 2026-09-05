// v63.65 她 2026-09-05：「在人格档案年龄和生日分开吧，比如我填了年月日可以显示年龄
// 但是可以改，也可以直接填月日再手动写年龄，或者生日未知但是可以年龄可以填」
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");

// 把纯函数抠出来跑（charAge 用一个够用的替身）
global.charAge = (bd, now) => {
  const m = String(bd || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (!m) return null;
  const n = new Date(now); let a = n.getFullYear() - (+m[1]);
  const mo = n.getMonth() + 1, d = n.getDate();
  if (mo < +m[2] || (mo === +m[2] && d < +m[3])) a--;
  return a;
};
// v64.17 起 charAgeNow 会调 ageDrift（手填的岁数跟着时间长），一起抠出来
global.parseMonthDay = () => null;
global.parseLunarBirthday = () => null;
global.ageDrift = eval("(" + eng.match(/function ageDrift\(ageAt, birthday, now\) \{[\s\S]*?\n\}/)[0].replace("function ageDrift", "function") + ")");
const charAgeNow = eval("(" + eng.match(/function charAgeNow\(char, now\) \{[\s\S]*?\n\}/)[0].replace("function charAgeNow", "function") + ")");
const NOW = new Date(2026, 8, 5).getTime();

test("三种填法都成立", () => {
  // ① 年月日全填 → 自动算
  assert.equal(charAgeNow({ birthday: "1998-3-15" }, NOW), 28);
  // ① 但可以改：手填的压过算出来的
  assert.equal(charAgeNow({ birthday: "1998-3-15", age: "30" }, NOW), 30);
  // ② 只填月日 + 手写岁数
  assert.equal(charAgeNow({ birthday: "3-15", age: "27" }, NOW), 27);
  assert.equal(charAgeNow({ birthday: "3-15" }, NOW), null, "只有月日算不出岁数，那一栏就该是空的");
  // ③ 生日未知，只填岁数
  assert.equal(charAgeNow({ age: "500" }, NOW), 500);
  assert.equal(charAgeNow({}, NOW), null);
});

test("留空＝跟着生日走，不是把算出来的数写进去", () => {
  // 写进去了，明年生日一过它就是个旧数字——而生日那条链本来会自己加一
  assert.match(eng, /「跟着生日走」不是\n\/\/\s*把算出来的数写进去，是把这一栏留空/);
  assert.match(scr, /const agePinned = ageInput\.trim\(\) !== "";/);
  assert.match(scr, /placeholder: autoAge != null \? "跟着生日走（现在 " \+ autoAge \+ "）" : "多大了"/);
  assert.match(scr, /"改回跟着生日"/);
  // 脏值不许算数
  assert.equal(charAgeNow({ age: "  " }, NOW), null);
  assert.equal(charAgeNow({ age: "-3" }, NOW), null);
  assert.equal(charAgeNow({ age: "abc" }, NOW), null);
});

test("手填的不按 200 封顶——妖和神活得久", () => {
  assert.equal(charAgeNow({ age: "9999" }, NOW), 9999);
  assert.equal(charAgeNow({ age: "10000" }, NOW), null);
  assert.match(eng, /可她【亲手写】五百岁的时候，那就是她要的/);
  assert.match(scr, /replace\(\/\[\^\\d\]\/g, ""\)\.slice\(0, 4\)/);
});

test("算法只在一处，六个调用点全换过来了", () => {
  // 原来六处各自 charAge(char.birthday)，谁也不知道有手填这回事
  assert.match(eng, /function charAgeNow\(char, now\)/);
  assert.match(app, /const age = typeof charAgeNow === "function" \? charAgeNow\(char, Date\.now\(\)\) : null;/);
  assert.match(app, /const _cage = typeof charAgeNow === "function" \? charAgeNow\(char, Date\.now\(\)\) : null;/);
  assert.match(eng, /const _age = charAgeNow\(char, Date\.now\(\)\);/);
  assert.match(comp, /charAgeNow\(character, Date\.now\(\)\)/);
  assert.match(scr, /charAgeNow\(c, Date\.now\(\)\)/);
});

test("只填了岁数的角色，那个数要真送到模型手上", () => {
  // ⚠️原来第一行是 if (!bd) return "" ——生日空着的角色整条被挡掉
  assert.match(app, /if \(!bd && age == null\) return "";/);
  assert.match(app, /const pinned = !!\(char && String\(char\.age \|\| ""\)\.trim\(\)\);/);
  // 手填的不是「按今天现算」的，话得说对
  assert.match(app, /pinned \? "（她手填的岁数，以这个为准）"/);
  assert.match(eng, /\(_pinned \|\| !_bd \? "。" : "（按你的生日 " \+ _bd/);
  // 生日空着时不许把 undefined 印进提示词
  assert.doesNotMatch(eng, /String\(char\.birthday\)\.trim\(\)\s*\n?\s*\+ " 和今天的日期算出来的"/);
});

test("档案卡上那一栏：只填岁数也不能是「—」", () => {
  assert.match(scr, /: \(age != null \? age \+ "岁" : "—"\);/);
  assert.match(scr, /cell\("生日", bd, !c\.birthday && age == null\)/);
});

test("存盘：age 跟着卷宗一起存，别的字段不动", () => {
  assert.match(scr, /const \[ageInput, setAgeInput\] = useState\(initial && initial\.age != null \? String\(initial\.age\) : ""\);/);
  assert.match(scr, /birthday: birthday\.trim\(\),\n\s*age: ageInput\.trim\(\),/);
  assert.match(scr, /onSave\(Object\.assign\(\{\}, initial \|\| \{\}, \{/, "得合到老档案上，不然别的栏会被抹掉");
  assert.match(scr, /h\(LineField, \{ zh: "年龄" \}, ageField\)/);
});
