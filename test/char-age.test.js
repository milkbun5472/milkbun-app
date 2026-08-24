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

// 她 2026-08-24 第二轮：「没有啊宝宝，而且我是要一个单独字段显示生日他 xx 岁，
// 这样可以直接把人设生日删了」。第一版只做在联系人页，而她是在【编辑档案】这一页
// 填生日的——填完当场看不见，就等于没做。
test("年龄要显示在她填生日的那一页，当场就能看见", () => {
  const i = screens.indexOf('zh: "生日"');
  const block = screens.slice(i, i + 2600);
  assert.match(block, /const age = typeof charAge === "function" \? charAge\(birthday, Date\.now\(\)\) : null;/,
    "要读表单里正在编辑的 birthday，不是存档里的");
  assert.match(block, /"现在 " \+ age \+ " 岁"/);
  assert.match(block, /if \(age == null\) return null;/, "只填月日的就别占地方");
  assert.match(block, /生日一过自动加一，Ta 自己也知道/);
});

test("表单说明要指明「人设正文里那句 XX 岁可以删了」", () => {
  assert.match(screens, /【带上年份】才会算年龄/);
  assert.match(screens, /人设正文里那句「XX 岁」可以删掉了/, "这才是她要这个字段的原因");
});

// —— 「再加个农历换算的吧宝宝，王爷腊月廿三的生日填了农历可以换成新历两个都显示」——
// 农历表（1900–2100）本来就有，但只有【公历→农历】；反向没有，所以农历生日
// 从来算不出公历日子，parseMonthDay 也认不出「腊月廿三」——连生日提醒都不会触发。

const L = (() => {
  const g = n => { const i = engine.indexOf(n); return engine.slice(i, engine.indexOf("\n}\n", i) + 2); };
  const src = [
    engine.slice(engine.indexOf("const LUNAR_INFO ="), engine.indexOf("// 公历 Date → { y, m, d, isLeap }")),
    g("function solarToLunar("),
    engine.slice(engine.indexOf("// ── 农历 → 公历"), engine.indexOf("const LUNAR_FESTIVALS = {")),
    g("function parseMonthDay("), g("function parseBirthDate("), g("function charAge("),
    "return { lunarToSolar, solarToLunar, parseLunarBirthday, lunarBirthdayInYear, birthdaySolarDate, daysUntilBirthday, birthdayBothLabel, charAge };"
  ].join("\n");
  return new Function(src)();
})();

test("农历转公历要能原路转回来——五千多个日期一个都不许错", () => {
  let bad = 0, n = 0;
  for (let y = 1950; y <= 2060; y++) for (let m = 1; m <= 12; m++) for (const d of [1, 15, 23, 29]) {
    const s = L.lunarToSolar(y, m, d, false);
    if (!s) continue;
    n++;
    const back = L.solarToLunar(s);
    if (!back || back.y !== y || back.m !== m || back.d !== d || back.isLeap) bad++;
  }
  assert.ok(n > 5000, "样本太少：" + n);
  assert.equal(bad, 0);
});

test("中文月日都要认", () => {
  assert.deepEqual(L.parseLunarBirthday("腊月廿三"), { y: null, m: 12, d: 23, isLeap: false });
  assert.deepEqual(L.parseLunarBirthday("农历腊月廿三"), { y: null, m: 12, d: 23, isLeap: false });
  assert.deepEqual(L.parseLunarBirthday("正月初一"), { y: null, m: 1, d: 1, isLeap: false });
  assert.deepEqual(L.parseLunarBirthday("冬月初八"), { y: null, m: 11, d: 8, isLeap: false });
  assert.deepEqual(L.parseLunarBirthday("闰四月初二"), { y: null, m: 4, d: 2, isLeap: true });
  assert.deepEqual(L.parseLunarBirthday("农历1998年腊月廿三"), { y: 1998, m: 12, d: 23, isLeap: false });
});

test("公历写法不许被农历解析抢走", () => {
  assert.equal(L.parseLunarBirthday("2004-10-25"), null);
  assert.equal(L.parseLunarBirthday("3-15"), null);
  assert.equal(L.parseLunarBirthday(""), null);
});

test("腊月的生日落在下一个公历年，要按目标年份挑对", () => {
  const spec = L.parseLunarBirthday("腊月廿三");
  const d26 = L.lunarBirthdayInYear(spec, 2026);
  assert.equal(d26.getFullYear(), 2026);
  assert.equal(d26.getMonth() + 1, 2);
  // 换一年就是另一天——这正是不能存成固定公历日期的原因
  const d27 = L.lunarBirthdayInYear(spec, 2027);
  assert.equal(d27.getFullYear(), 2027);
  assert.notEqual(d27.getMonth() + "-" + d27.getDate(), d26.getMonth() + "-" + d26.getDate());
});

test("那一年没这个闰月时，退回同名平月——别让生日整年消失", () => {
  const spec = { y: null, m: 4, d: 2, isLeap: true };
  for (const y of [2024, 2025, 2026, 2027, 2028]) {
    assert.ok(L.lunarBirthdayInYear(spec, y), y + " 年算不出来");
  }
});

test("农历生日也要能触发提醒——以前 parseMonthDay 认不出，从来不响", () => {
  const now = new Date("2026-08-24T12:00:00");
  assert.equal(typeof L.daysUntilBirthday("腊月廿三", now), "number");
  assert.equal(L.daysUntilBirthday("八月十五", now), 32);
  assert.equal(L.daysUntilBirthday("2004-10-25", now), 62);
  assert.equal(L.daysUntilBirthday("说不清", now), null);
  // 当天要返回 0，不是 365
  assert.equal(L.daysUntilBirthday("8-24", now), 0);
});

test("两历都显示：填哪个都给出另一个", () => {
  assert.equal(L.birthdayBothLabel("腊月廿三", 2026), "农历 腊月廿三 · 今年公历 2 月 10 日");
  assert.equal(L.birthdayBothLabel("2004-10-25", 2026), "公历 10 月 25 日 · 今年农历 九月十六");
  assert.equal(L.birthdayBothLabel("闰四月初二", 2026), "农历 闰四月初二 · 今年公历 5 月 18 日");
  assert.equal(L.birthdayBothLabel("", 2026), "");
});

test("农历写了年份也能算年龄", () => {
  const now = new Date("2026-08-24T12:00:00");
  assert.equal(L.charAge("农历1998年腊月廿三", now), 27);
  assert.equal(L.charAge("腊月廿三", now), null, "没年份就没年龄");
});

test("界面三处都接上了", () => {
  assert.match(screens, /birthdayBothLabel\(birthday\)/, "编辑档案");
  assert.match(comp, /birthdayBothLabel\(bd\)/, "联系人页");
  assert.match(engine, /parts\.push\("【你的生日】" \+ _both/, "提示词——农历角色得知道今年公历哪天");
  assert.match(screens, /3-15 \/ 1998-3-15 \/ 腊月廿三 \/ 农历八月十五/, "输入框要示范农历写法");
});

test("提醒改走统一入口，旧的 daysUntil 拆干净", () => {
  assert.match(app, /const cdu = daysUntilBirthday\(char && char\.birthday, today\)/);
  assert.match(app, /const du = daysUntilBirthday\(profile && profile\.birthday, today\)/);
  assert.ok(!/const daysUntil = bd =>/.test(app), "旧的只认公历，不许留着");
  assert.match(engine, /提醒、年龄、两历对照全走这一个入口/, "为什么合成一个，写在代码里");
});
