// 她 2026-09-16 指着卡上那行字问：「这个试满了又是啥宝宝」。
//
// 查下来那句话本身是假的。复看那一档满了【不是停死】——reviewDue 白纸黑字写着：
//   if (reviewN >= REVIEW_MAX) return t - last >= REVIEW_RETRY_DAYS*86400000 && n >= REVIEW_FLOOR_MIN;
// 也就是退到「隔五天 + 又攒够八条新消息」再试一次，旁边注释自己都写着「不是停死」。
// 界面上却写「往后不再自动试」，把降频说成了放弃：她看到会以为坏了、得手动救。
//
// ⚠️隔壁【建卡】那两句里的同一措辞是真的（autoSeedDue 满了直接 return false，
//   三次是一辈子的上限）。四处措辞一样，说的不是同一件事——所以只改复看那两处。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "gaze.js"), "utf8");

// 只看代码，注释里会逐字引用旧话（病历），照整段 grep 会把自己搞红
const strip = t => t.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const code = strip(src);

test("复看满了之后那句话说的是实话：降频，不是放弃", () => {
  assert.match(code, /var reviewCap = "；试满了，往后改成隔 " \+ REVIEW_RETRY_DAYS \+ " 天、且又攒够 "\s*\n?\s*\+ REVIEW_FLOOR_MIN \+ " 条新消息才自动试一次。想现在就要，点下面那个按钮";/);
  // 复看那两支都用它，没有哪一支还留着旧话
  assert.equal((code.match(/rv\.tries >= rv\.max \? reviewCap : ""/g) || []).length, 2);
  assert.ok(!/rv\.tries >= rv\.max \? "；试满了，往后不再自动试"/.test(code), "复看还留着那句假话");
});

test("天数和条数从常量现取，不在文案里手抄一份", () => {
  // 手抄的话，下次改常量界面上那句就对不上了
  assert.ok(!/隔 5 天/.test(code) && !/攒够 8 条/.test(code), "把数字抄进文案了");
  assert.match(src, /const REVIEW_RETRY_DAYS = 5;/);
  assert.match(src, /const REVIEW_FLOOR_MIN = 8;/);
});

test("文案和 reviewDue 那一行说的是同一件事", () => {
  // 判据：界面上承诺的两个条件，闸里必须真的是这两个，且是「与」不是「或」
  assert.match(code, /if \(\(Number\(box\.reviewN\) \|\| 0\) >= REVIEW_MAX\) return t - last >= REVIEW_RETRY_DAYS \* 86400000 && n >= REVIEW_FLOOR_MIN;/);
});

test("建卡那两句一个字都没动：那一档真的是停死", () => {
  // autoSeedDue 满了直接 return false，没有任何退路——所以「往后不再自动试」是真话
  assert.match(code, /if \(autoSeedTries\(box\) >= AUTOSEED_MAX\) return false;/);
  assert.equal((code.match(/；试满了，往后不再自动试。想现在就要，点下面那个按钮/g) || []).length, 2,
    "建卡那两句被顺手改掉了——它们本来就是实话");
});

test("两个上限都还在，改的只是措辞不是行为", () => {
  assert.match(src, /const REVIEW_MAX = 3;/);
  assert.match(src, /const AUTOSEED_MAX = 3;/);
});
