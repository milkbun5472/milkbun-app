const fs = require("fs");
const assert = require("assert");

const engine = fs.readFileSync("js/engine.js", "utf8");
assert(engine.includes('const OFFLINE_NO_COT_KEY = "x_offlineNoCotModels"'), "group offline must retain its compatibility memory");
assert(engine.includes('const OFFLINE_SINGLE_NO_COT_V2_KEY = "x_offlineSingleNoCotModelsV2"'), "single offline v2 must not inherit the legacy pre-writing blacklist");
assert(engine.includes('[OFFLINE_NO_COT_KEY, "x_groupOfflineNoCotModels"]'), "legacy group-only compatibility memory must migrate safely");
assert(engine.includes('function isOfflineEmptyStop(e)'), "fallback must only handle the narrow empty-stop case");
// 2026-10-09 她：失败了不许再试第二次——空正文只记住这条线以后不挂 cot，这一次不再无 cot 补打
assert(!engine.includes('system.replace(cotSystemBlock(cotT), "")'), "group offline must not fire a second no-cot call");
assert(!engine.includes('system.replace(singleCotBlock, "")'), "single offline must not fire a second no-cot call");
assert(engine.includes('rememberOfflineSingleNoCotV2Model(cotModelKey)'), "single v2 must remember only v2 incompatibility");
assert(engine.includes('rememberOfflineNoCotModel(cotModelKey)'), "group offline must remember a known-bad cot model");
console.log("shared offline cot fallback tests passed");
