// 地名查坐标的备用那一家（2026-09-28「在地图里面搜地名一点反应都没有」）：OSM 连不上、查空、卡住都改问 open-meteo
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
const i = src.indexOf("function geoSearch("); let d = 0, j = src.indexOf("{", i);
for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && --d === 0) break; }
const make = fetch => new Function("fetch", src.slice(i, j + 1) + "\nreturn geoSearch;")(fetch);
const OM = { results: [{ name: "东京", admin1: "东京都", country: "日本", latitude: 35.68, longitude: 139.69 }] };
const ok = body => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
(async () => {
  // 1. OSM 挂了 → open-meteo
  let r = await make(u => u.includes("nominatim") ? Promise.reject(new Error("net")) : ok(OM))("东京");
  assert.equal(r[0].lat, 35.68); assert.equal(r[0].name, "东京,东京都");
  // 2. OSM 查空 → open-meteo
  r = await make(u => u.includes("nominatim") ? ok([]) : ok(OM))("东京");
  assert.equal(r.length, 1);
  // 3. OSM 通的时候照旧用它
  r = await make(u => u.includes("nominatim") ? ok([{ display_name: "上海,中国", lat: "31.2", lon: "121.4" }]) : ok(OM))("上海");
  assert.equal(r[0].lat, 31.2);
  assert.match(src, /setTimeout\(\(\) => rej\(new Error\("search_timeout"\)\), 6000\)/, "卡住不回也得换一家");
  console.log("geo fallback ok");
})().catch(e => { console.error(e); process.exit(1); });
