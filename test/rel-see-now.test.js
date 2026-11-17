const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8"), ui = fs.readFileSync("js/screens-ui.js", "utf8");
test("关系线上的「互相知道对方此刻在干嘛」：按一对人记，开着两头聊天都带对方此刻日程", () => {
  assert.ok(ui.includes('"data-wk": "relseenow"') && ui.includes("function relSeeNowSet(a, b, v)"));
  assert.ok(app.includes("schedNow: timeAwareFor(char.id) ? schedNowFor(char) + peersNowLine(char) : \"\""));
  assert.ok(app.includes("relSeeNowOn(char.id, o.id)"));
  assert.ok(fs.readFileSync("js/theme-studio.js", "utf8").includes('["relseenow",'));
});
