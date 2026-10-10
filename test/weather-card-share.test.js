// 群友 2026-10-10 许愿：角色知道她那边的天气，问起来发天气小卡片、提醒带伞穿衣。
// 她：「就算我把自己放进架空世界填了真实世界，还是要按真实的来」「卡片做好看点」
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const a = src("app.js"), c = src("components.js"), e = src("engine.js");
test("她这边的天气只认真实位置 x_geo，不走 myRealm（架空世界里照样是真实天气）", () => {
  const fn = a.slice(a.indexOf("const userWxFor = "), a.indexOf("const userWxFor = ") + 500);
  assert.match(fn, /loadJSON\("x_geo", null\)/);
  assert.ok(!/myRealm|realGeo/.test(fn));
});
test("开了才给、名单里的人才给；能力栏开 weatherCard，卡上数字照缓存填", () => {
  assert.match(a, /wxShareOn = \(charId, cfg\) =>/);
  assert.match(a, /openCaps\.push\("weatherCard"\)/);
  assert.match(a, /kind: "weathercard"/);
  assert.match(a, /wx: \{ place: _uw\.place, t: _w\.t, code: wxNowCode\(_w\)/);
});
test("会主动提醒：一天最多一次，走名单", () => {
  assert.match(a, /x_wxNudgeDay/);
  assert.match(a, /forUser: true/);
});
test("天气拉降雨概率；天气页底下有开关；聊天里画卡片", () => {
  assert.match(e, /precipitation_probability_max/);
  assert.match(c, /h\(WxShareBox, \{ userGeo, characters \}\)/);
  assert.match(c, /m\.kind === "weathercard" && m\.wx/);
  assert.match(c, /function WeatherChatCard/);
});
