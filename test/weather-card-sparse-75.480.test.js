// 一提天气就发天气卡（群友 2026-10-12）：三小时内发过就不开这一格；判据写成「她明说想知道 / 马上要出门而天气真会影响」
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
test("三小时内这个聊天发过天气卡，就不再开 weatherCard", () => {
  assert.match(app, /m\.kind === "weathercard" && Date\.now\(\) - \(Number\(m\.ts\) \|\| 0\) < 3 \* 3600 \* 1000/);
  assert.match(app, /const _userWx = _wxRecent \? null : userWxFor\(charId\)/);
});
test("判据：顺口提到天气用一句话接住，不发卡", () => {
  assert.match(app, /只是聊天里顺口提到天气、冷热、下雨，用一句话接住就够了，不用发卡/);
});
