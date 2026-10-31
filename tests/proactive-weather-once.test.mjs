// 天气由头一天只给同一个人用一回；主动开场记整轮
import { readFileSync } from "node:fs"; import assert from "node:assert/strict";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
assert.match(app, /const wxWhoToday = \(\) =>/);
assert.match(app, /if \(wxWhoToday\(\)\.includes\(c\.id\)\) continue;/);
assert.match(app, /!wxWhoToday\(\)\.includes\(c\.id\) && !laneBusy/);
assert.equal((app.match(/saveJSON\("x_wxWhoDay"/g) || []).length, 2);
assert.match(app, /\.join\(" \/ "\)\.slice\(0, 90\);/);
console.log("proactive weather once ok");
