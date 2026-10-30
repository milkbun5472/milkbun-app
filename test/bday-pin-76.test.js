const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const c = fs.readFileSync("js/components.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8");
test("生日当天，还封着的信封顶到聊天最上面", () => {
  assert.match(c, /bdayToday && onBdayPlanOpen \? \(messages \|\| \[\]\)\.find\(m => m && m\.kind === "bdayplan" && !m\.opened\)/);
  assert.match(c, /"data-wk": "bdaypin", onClick: \(\) => onBdayPlanOpen\(bp\)/);
  // 2026-10-30 重锚：虚拟时间巡检（v76.988~992）把「今天」改成照角色那只钟算，
  //   这条测的不是取今天的写法，是上面那个判据本身。
  assert.match(app, /bdayToday: \(\(\) => \{ const bd = myBdayFor\(activeChar\.id\); return !!bd && typeof daysUntilBirthday === "function" && daysUntilBirthday\(bd, new Date\([\s\S]{0,200}?\)\) === 0; \}\)\(\),/);
  // 写入方：信封是 kind bdayplan、拆开打 opened
  assert.match(app, /kind: "bdayplan", year: year, content: "到你生日那天再拆"/);
});
