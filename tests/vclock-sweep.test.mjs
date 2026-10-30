// 全 app 虚拟时间巡检：角色世界里的日期/钟点走他那只钟，不走真实时间
import { readFileSync } from "node:fs"; import assert from "node:assert/strict";
const r = f => readFileSync(new URL("../js/" + f, import.meta.url), "utf8");
const app = r("app.js");
assert.match(r("companion.js"), /hr = \(typeof vclockNow === "function" \? vclockNow\(char\.id\)/);
assert.match(r("dwell.js"), /schedNowDate\(char\)[^\n]*nowM/);
assert.match(r("date-game.js"), /C\.newGame\(cfg, null, \{ hour: [^\n]*vclockNow\(cfg\.charIds\[0\]\)/);
assert.match(r("phone-ui.js"), /todayStart = dayStart\(phoneNow\(char/);
assert.match(r("engine.js"), /function charAgeNow[\s\S]{0,600}vclockMap/);
for (const re of [/date: ymd\(new Date\(typeof vclockMap[^\n]*vclockMap\(Date\.now\(\), char\.id\)[^\n]*type: "感慨"/,
  /author: cid[^\n]*date: ymd\(new Date\(typeof vclockMap[^\n]*vclockMap\(Date\.now\(\), cid\)/,
  /author: "user"[^\n]*date: ymd\(new Date\(typeof vclockMap/,
  /addTimelineEvent\(char, ymd\(new Date\(typeof vclockMap/,
  /const now = new Date\(typeof vclockMap[^\n]*charId\)/,
  /const vDay = cid =>/]) assert.match(app, re);
assert.match(app, /realm\.terrain, new Date\(typeof vclockMap[^\n]*char\.id\)/);
assert.match(app, /"平原", new Date\(typeof vclockMap[^\n]*c\.id\)/);
assert.match(app, /const due = new Date\(typeof vclockMap[^\n]*pm\.dueTs[^\n]*char\.id/);
assert.match(r("screens.js"), /const _cal = new Date\(typeof vclockMap[^\n]*bCid\)/);
console.log("vclock sweep ok");
