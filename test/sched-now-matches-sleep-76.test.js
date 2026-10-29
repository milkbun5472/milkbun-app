// 「此刻在做什么」不许跟「醒没醒」打架（群里 2026-10-29：「显示睡着的角色疯狂发消息说自己在上班」）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const cut = (a, b) => { const i = app.indexOf(a), j = app.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return app.slice(i, j); };
test("两边读的不是同一份日程，所以「此刻」那一句得先问醒没醒", () => {
  // 醒没醒只认今天这一份；此刻在做什么走 schedPlanOf（今天没排就借前后一天）。两处本来就不一样，
  // 所以不能各说各的：此刻那一句以 sleepPhaseOf 为准。
  assert.match(cut("const charAwakeState = char =>", "const sleepPhaseOf"), /plans\[schedLocalDayKey\(char\)\]/, "醒没醒改成借别天了？那这条就得重写");
  const now = cut("const schedNowFor = char =>", "// 结构化「此刻在做什么/在哪」");
  assert.match(now, /schedPlanOf\(char, plans\)/, "此刻那一路不再借别天了？那这条就得重写");
  assert.match(now, /const _asleepNow = \(\(\) => \{ try \{ return sleepPhaseOf\(char\) === "asleep"/);
  assert.match(now, /if \(_asleepNow\) out \+= "\\n\\n此刻 Ta 在睡觉/);
  assert.match(now, /\} else if \(cur\) out \+=|else if \(cur\) out \+=/, "睡着那一档要排在「正在做什么」前面");
});
test("关了时间感知的不受影响：走 sleepPhaseOf，不是直接问 charAwakeState", () => {
  assert.match(cut("const sleepPhaseOf = char =>", "const sleepToneOf"), /if \(!timeAwareFor\(char\.id\)\) return "awake";/);
});
