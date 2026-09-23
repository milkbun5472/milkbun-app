// 单人线下和群线下共用同一份「谁的决定归谁 / 一拍写到哪儿停 / 从哪儿往前走」
// （她 2026-09-23：「为啥这两边不搞公共的」）。
const assert = require("assert");
const eng = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
const r0 = eng.indexOf("const OFFLINE_AGENCY_RULE = `");
assert(r0 > 0);
const rule = eng.slice(r0, eng.indexOf("`;", r0));
for (const k of ["谁的决定归谁", "这一拍写到哪儿停", "这一幕从哪儿往前走"]) assert(rule.includes(k), k);
assert.strictEqual((eng.match(/【这一拍写到哪儿停】/g) || []).length, 1, "只写在一处");
const n0 = eng.indexOf("const OFFLINE_NARRATIVE_RUNTIME = `");
assert(eng.slice(n0, eng.indexOf("`;", n0)).includes("${OFFLINE_AGENCY_RULE}"), "单人线下要带");
const g0 = eng.indexOf("async function generateOfflineGroup");
const g = eng.slice(g0, eng.indexOf("const hist = offlineGroupHistory", g0));
assert(/\+ OFFLINE_AGENCY_RULE \+/.test(g), "群线下要带");
console.log("offline-agency-shared-73-18 ok");
