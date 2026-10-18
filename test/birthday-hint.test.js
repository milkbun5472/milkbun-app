// 她 2026-10-11：群友把生日写成「0109」，TA 不知道是生日——生日那一格写清能怎么写，认不出就标红
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const comps = R("components.js"), screens = (R("screens.js") + "\n" + R("screens-ui.js")), engine = R("engine.js");

test("认不认得出只问 birthdaySolarDate（跟到日子记不记得同一个判据）", () => {
  const grab = (src, name) => { const i = src.indexOf("function " + name + "("); return src.slice(i, src.indexOf("\n}\n", i) + 3); };
  const ok = new Function(["parseMonthDay", "parseLunarBirthday", "lunarBirthdayInYear", "birthdaySolarDate", "birthdayOk"].map(n => grab(n === "birthdayOk" ? comps : engine, n)).join("")
    + "\nreturn birthdayOk;")();
  assert.equal(ok("0109"), false);
  assert.equal(ok("19"), false);
  assert.equal(ok("1-9"), true);
  assert.equal(ok("1月9日"), true);
  assert.equal(ok("2000-01-09"), true);
  assert.equal(ok(""), true, "空着不报错");
});

test("「我」和角色档案两处生日都挂上这一行", () => {
  assert.match(comps, /h\(BirthdayHint, \{ value: birthday \}\)/);
  assert.match(screens, /h\(BirthdayHint, \{ value: birthday \}\)/);
  assert.match(comps, /color: bad \? \(t\.accent \|\| "#c25a4a"\) : t\.fog/);
});
