// 她 2026-10-06：「钱包生成能不能除了每天刷新变成每周刷新，周日 24:00 后把周一到周日的全补了；
//   这周有一天我手动刷过就跳过那天。还有现在那个刷新是不是只能把整个档案都刷了，而不是只能刷某一天的」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
test("每周结算：只补到最近一个过完的周日", () => {
  assert.match(app, /if \(weekly\) \{ const d = schedParseKey\(cutoffKey\); d\.setDate\(d\.getDate\(\) - d\.getDay\(\)\); cutoffKey = schedDayKey\(d\); \}/);
  // 周三看：昨天周二 → 退到上周日；周一看：昨天周日 → 就是昨天
  const back = ymd => { const d = new Date(ymd); d.setDate(d.getDate() - d.getDay()); return d.getDate(); };
  assert.equal(back("2026-10-06T12:00"), 4);   // 10/06 周二 → 10/04 周日
  assert.equal(back("2026-10-04T12:00"), 4);   // 周日本身
});
test("手动生成过的那天，补账时跳过、不再花一次调用", () => {
  assert.match(app, /if \(\(charWalletRef\.current\[char\.id\]\.doneDays \|\| \{\}\)\[dk\]\) \{/);
  assert.match(app, /doneDays: walletDoneAdd\(cur\.doneDays, dayKey\)/);
});
test("只重生某一天：撤掉那天推演的几笔、手机上的单不动、重算余额、不动补账进度", () => {
  assert.match(app, /if \(manual\) cur = \{ \.\.\.cur, ledger: \(cur\.ledger \|\| \[\]\)\.filter\(e => !\(e && e\.kind === "daily" && \(e\.dayKey \|\| schedDayKey\(new Date\(e\.ts\)\)\) === dayKey\)\) \};/);
  assert.match(app, /if \(manual\) \{ const rf = walletReflow\(ledger\); ledger = rf\.ledger; bal = rf\.balance; \}/);
  assert.match(app, /lastDailyKey: manual \? cur\.lastDailyKey : dayKey/);
  assert.match(scr, /onClick: \(\) => onRedoDay\(char, dailyDate\)/);
});
test("重算余额：从最老一笔往后加", () => {
  const i = app.indexOf("const walletReflow = ledger => {"), j = app.indexOf("\n  };", i) + 4;
  const f = new Function("r2", app.slice(i, j) + "\nreturn walletReflow;")(x => Math.round(x * 100) / 100);
  const r = f([{ ts: 3, delta: -20 }, { ts: 1, delta: 100 }, { ts: 2, delta: -30 }]);
  assert.equal(r.balance, 50);
  assert.deepEqual(r.ledger.map(e => e.after), [50, 70, 100]);
});

test("每周一次是为了省调用：一枪推演一整周（最多 7 天），各天拿结果入账，不再每天各打一枪", () => {
  assert.match(app, /const genWeekSpend = async \(char, dayKeys, rec, alreadyBy\) => \{/);
  assert.match(app, /const byDay = await genWeekSpend\(char, todo, charWalletRef\.current\[char\.id\], alreadyBy\);/);
  assert.match(app, /for \(const dk of todo\) await applyWalletDay\(char, dk, \{ buys: byDay\[dk\] \|\| \[\] \}\);/);
  assert.match(app, /const buys = opts && Array\.isArray\(opts\.buys\) \? opts\.buys : await genDailySpend\(char, dayKey, rec, already\);/);
  assert.match(app, /for \(let i = 0; i < pending\.length; i \+= 7\)/);
});
test("开关在设置 → 自动生成 → 钱包那一档，默认每天", () => {
  const P = require("../js/auto-refresh-policy.js");
  const f = P.FEATURES.find(x => x.id === "wallet");
  assert.deepEqual(f.rates.map(r => r.id), ["day", "week"]);
  assert.equal(P.normalize({}).features.wallet.rate, "day");
  assert.equal(P.normalize(P.setRate({}, "wallet", "week")).features.wallet.rate, "week");
  assert.equal(P.normalize({}).features.proactive.rate, "mid", "主动私聊照旧默认中频");
  assert.match(app, /const walletWeekly = \(\) => \{ try \{ return window\.AutoRefreshPolicy\.normalize\(autoRefreshRef\.current\)\.features\.wallet\.rate === "week"; \}/);
});
