// 群里 2026-10-12：「为何我搜索到了城市但天气不能显示」——拉天气失败一声不吭，格子里永远「获取中…」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comps = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");

test("天气拉不到就说拉不到，能点重拉；换地方先清掉上一处的天气", () => {
  assert.match(comps, /weatherFor\(place\.lat, place\.lng\)\.then\(x => \{ if \(!alive\) return; if \(x\) setReal\(x\); else setWxFail\(true\); \}\)/);
  assert.match(comps, /setReal\(c \|\| null\); setWxFail\(false\);/);
  assert.match(comps, /"天气没拉到：连不上天气服务。换个网络或开梯子，点这儿再试"/);
  assert.match(comps, /\[place && place\.key, place && place\.lat, place && place\.lng, wxTry\]/);
});
