// 自动取定位不许弹系统询问（群里 2026-10-28：换了地址以后每次打开都被问一次）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "../js", f), "utf8");
const eng = rd("engine.js"), map = rd("map.js"), ui = rd("screens-ui.js");
test("只有已经授权过才静默取；查不出来一律不弹", () => {
  const i = eng.indexOf("function geoIfGranted("), j = eng.indexOf("async function fetchLocalEnv(", i);
  assert.ok(i > 0 && j > i, "抠不出 geoIfGranted");
  const g = eng.slice(i, j);
  assert.match(g, /navigator\.permissions\.query\(\{ name: "geolocation" \}\)/);
  assert.match(g, /if \(!st \|\| st\.state !== "granted"\) return res\(null\);/);
  assert.match(g, /if \(!navigator\.permissions \|\| !navigator\.permissions\.query\) return res\(null\);/, "查不了权限要当没授权，不许退回去直接问");
});
test("开机就跑的那两处都走它：主屏地图组件、写日记", () => {
  assert.match(eng, /: await geoIfGranted\(\);/, "写日记那条（fetchLocalEnv）没走");
  assert.match(map, /geoIfGranted\(\{ enableHighAccuracy: false/, "主屏地图组件没走");
  assert.match(ui, /fetchLocalEnv\(\)\.then/);
});
test("她自己按的那两处照旧直接问：设置「我在哪」、地图页上的定位", () => {
  assert.match(eng, /navigator\.geolocation\.getCurrentPosition\(async pos => \{/, "设置里那颗没了");
  assert.match(map, /navigator\.geolocation\.watchPosition\(/, "地图页那颗没了");
});
