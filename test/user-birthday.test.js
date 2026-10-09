const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");

test("谁知道她生日：跟着面具走", () => {
  assert.match(app, /const myBdayFor = charId => String\(\(\(profileFor\(charId\)/);
});
test("零点生日信：所有知道的人各写一封", () => {
  assert.match(app, /bdayletter:/);
  assert.match(app, /kind: ?"bdayletter"/);
});
test("提前三天暗中准备，生日当天才能拆", () => {
  assert.match(app, /bdayprep:/);
  assert.match(app, /还没到你生日呢/);
  assert.match(app, /bdayPrep \? bdayPrepHint/);
});
test("两张卡都渲染，拆开按钮够大", () => {
  assert.match(comp, /m\.kind === "bdayletter"\) return h\(BdayLetterCard/);
  assert.match(comp, /m\.kind === "bdayplan"\) return h\(BdayPlanCard[^\n]*onBdayPlanOpen/);
  assert.match(comp, /function BdayPlanCard[\s\S]{0,1500}minHeight: 40/);
  assert.match(app, /onBdayPlanOpen: m => openBdayPlan\(activeChar, m\)/);
});
