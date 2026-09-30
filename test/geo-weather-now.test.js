// 群友 2026-09-30：
//   「为什么定位老是显示没有我这个地方呀，我按照格式填写也没有，给我定位到江苏去了」
//   「为啥地图老是说我这边下雨」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const grab = name => {
  const i = engine.indexOf("function " + name + "(") >= 0 ? engine.indexOf("function " + name + "(") : engine.indexOf("async function " + name + "(");
  const k = engine.lastIndexOf("async ", i) === i - 6 ? i - 6 : i;
  assert.ok(i >= 0, name + " 没了");
  return engine.slice(k, engine.indexOf("\n}\n", i) + 3);
};

test("一长串地址按省／市／区往短里拆，从最小那一级问起", () => {
  const ladder = new Function(grab("geoQueryLadder") + "return geoQueryLadder;")();
  const l = ladder("江苏省南京市鼓楼区");
  assert.equal(l[0], "江苏省南京市鼓楼区");
  assert.ok(l.indexOf("鼓楼区") > 0 && l.indexOf("南京市") > l.indexOf("鼓楼区"), "没从最小那一级往大了问：" + l.join("/"));
  assert.ok(l.indexOf("南京") > 0, "去掉「市」的那一版也要问");
  assert.deepEqual(ladder("东京"), ["东京"]);
});

test("同名的不止一个：交回候选让她挑，不替她拿第一个", async () => {
  const f = new Function("geoCandidates", "geoFromPoint", grab("geoFromPlace") + "return geoFromPlace;");
  const two = [{ name: "鼓楼区,江苏", lat: 32.06, lng: 118.77 }, { name: "鼓楼区,福建", lat: 26.08, lng: 119.29 }];
  const r = await f(async () => two, async p => ({ lat: p.lat }))("鼓楼区");
  assert.equal(r.choices.length, 2, "又闷头拿了第一个");
  const one = await f(async () => [two[1]], async p => ({ lat: p.lat, manual: true }))("福州鼓楼");
  assert.equal(one.lat, 26.08);
  const none = await f(async () => [], async p => p)("火星某地");
  assert.match(none.error, /试试只写城市名/);
  assert.match(screens, /找到好几个同名的地方，是哪一个？/);
  assert.match(screens, /await onSetGeoPoint\(c\)/);
});

test("「现在」按当前那一刻的天气，当天别的钟点有雨只补一句「晚些可能有」", () => {
  const E = new Function("wmoEmoji", "wmoZh", grab("wxNowCode") + grab("wxWetKind") + grab("weatherLine") + grab("wxSpecial") + "return { weatherLine, wxSpecial };")(
    () => "", c => ({ 0: "晴", 3: "阴", 61: "小雨" })[c] || "多云");
  const sunnyNowRainLater = { t: 20, lo: 15, hi: 24, code: 0, dayCode: 61 };
  assert.match(E.weatherLine(sunnyNowRainLater), /^晴，现在 20°C/, "一整天的最坏天气冒充了现在");
  assert.match(E.weatherLine(sunnyNowRainLater), /晚些可能有雨/);
  assert.equal(E.wxSpecial(sunnyNowRainLater), null, "现在是晴天，却跟角色说在下雨");
  assert.equal(E.wxSpecial({ t: 18, lo: 15, hi: 20, code: 61, dayCode: 61 }), "下雨");
  assert.ok(!/dayCode != null \? w\.dayCode : w\.code/.test(engine), "还有地方拿一整天的最坏天气当现在");
});
