import { readFileSync } from "node:fs"; import assert from "node:assert/strict";
const s = readFileSync(new URL("../js/weekly.js", import.meta.url), "utf8");
const a = s.indexOf("线下[^】]*】/.test(line)) return;"), b = s.indexOf("const pure = saidOnly(txt)");
assert.ok(a > 0 && a < b, "线下叙述不进高频词");
assert.ok(s.indexOf("total++") < a, "线下条数照算");
console.log("weekly offline words ok");
