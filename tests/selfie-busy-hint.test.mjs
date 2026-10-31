import { readFileSync } from "node:fs"; import assert from "node:assert/strict";
const s = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
const busy = s.indexOf("暂时不可用|稍后再?试"), noLock = s.indexOf("这个站要是不收参考照");
assert.ok(busy > 0 && busy < noLock, "站忙要先于「不锁脸」提示判断");
console.log("selfie busy hint ok");
