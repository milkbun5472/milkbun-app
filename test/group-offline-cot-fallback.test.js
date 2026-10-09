const fs = require("fs");
const assert = require("assert");

const engine = fs.readFileSync("js/engine.js", "utf8");
assert(engine.includes('const OFFLINE_NO_COT_KEY = "x_offlineNoCotModels"'), "group offline must retain its compatibility memory");
assert(engine.includes('const OFFLINE_SINGLE_NO_COT_V2_KEY = "x_offlineSingleNoCotModelsV2"'), "single offline v2 must not inherit the legacy pre-writing blacklist");
assert(engine.includes('[OFFLINE_NO_COT_KEY, "x_groupOfflineNoCotModels"]'), "legacy group-only compatibility memory must migrate safely");
assert(engine.includes('function isOfflineEmptyStop(e)'), "fallback must only handle the narrow empty-stop case");
assert(engine.includes('system.replace(cotSystemBlock(cotT), "")'), "group fallback retry must remove explicit cot instructions");
assert(engine.includes('system.replace(singleCotBlock, "")'), "single v2 fallback retry must remove retrospective note instructions");
assert(engine.includes('rememberOfflineSingleNoCotV2Model(cotModelKey)'), "single v2 must remember only v2 incompatibility");
assert(engine.includes('rememberOfflineNoCotModel(cotModelKey)'), "group offline must remember a known-bad cot model");
assert((engine.match(/splitCot\(raw, usedCot\)/g) || []).length >= 2, "fallback responses must not be parsed as cot responses");
console.log("shared offline cot fallback tests passed");
