// 角色生日 app 内提醒卡（她 2026-10-31：「算了做个app内提醒吧好看点」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const R = f => fs.readFileSync(require.resolve("../js/" + f), "utf8");
const app = R("app.js"), sk = R("shike-core.js"), ts = R("theme-studio.js");

function pick(src, name) {
  const i = src.indexOf("  function " + name + "(");
  const j = src.indexOf("\n  }\n", i);
  return src.slice(i, j + 4);
}
test("前一天和当天才算，配角、没填生日的不算，最多三个", () => {
  const ctx = { daysUntilBirthday: (b) => ({ a: 0, b: 1, c: 2 })[b] };
  vm.runInNewContext(pick(sk, "bdaySoon") + ";this.f=bdaySoon;", ctx);
  const l = ctx.f([{ id: 1, birthday: "b" }, { id: 2, birthday: "a" }, { id: 3, birthday: "c" }, { id: 4, birthday: "a", npc: true }, { id: 5 }]);
  assert.equal(JSON.stringify(l.map(x => [x.char.id, x.du])), "[[2,0],[1,1]]");
});
test("开机落主屏冒一次；点了进聊天、收起，当天都不再冒", () => {
  assert.match(app, /if \(loadJSON\("x_bdayCard", ""\) === schedDayKey\(new Date\(\)\)\) return;/);
  assert.match(app, /onOpen: c => \{ saveJSON\("x_bdayCard", schedDayKey\(new Date\(\)\)\); setBdayCard\(null\); openChatById\(c\.id\); \}/);
  assert.match(sk, /"data-wk": "bdaycard"/);
  assert.match(ts, /\["bdaycard", /);
});
