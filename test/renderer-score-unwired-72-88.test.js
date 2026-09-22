// offlineRendererScore 是【只记不用】的：只进诊断面板，永不点着自我修订那一道。
// 她 2026-09-22 撤掉 v72.87 时的原话：「不要这个！这是之前特意没接上的！」
// 这份测试是留给下一个窗口的拦路石——别再「顺手接上」一次。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("自我修订那一道只看人设卡的风险词，不看正文打的分", () => {
  const engine = R("js/engine.js");
  assert.match(engine, /const archetypeRevisionRequested = !isDigital && !!archetypePerformanceRisk;/,
    "archetypeRevisionRequested 的判据被加宽了；那一分不许接进来");
});

test("offlineRendererScore 只往诊断走，不回存到场次上", () => {
  const app = R("js/app.js");
  assert.ok(!/nwHot/.test(app), "app 这头又把网文腔分数回存进场次了");
  assert.ok(!/nwHot/.test(R("js/engine.js")), "engine 这头又读起那面旗子了");
  assert.match(app, /rendererScoreAfter: Number\(res\.rendererScoreAfter\)/,
    "分数本身还是要照常记进诊断面板的，别把它一起删了");
});
