// 邮票册翻着会闪、会闪退（她 2026-11-28）：读过的图留着别每次清空重读；缩略图一次只缩一张；同键换图时缓存作废
const fs = require("fs"), path = require("path"), assert = require("assert");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const comp = R("components.js"), st = R("stamps.js"), eng = R("engine.js");
assert(/const IDB_URL_CACHE = new Map\(\);/.test(comp) && /const IDB_URL_MAX = 24;/.test(comp));
assert(/window\.__idbUrlDrop = k =>/.test(comp));
assert(/async function idbImgPutOnly\(k, blob\) \{ try \{ if \(typeof window !== "undefined" && window\.__idbUrlDrop\) window\.__idbUrlDrop\(k\);/.test(eng));
assert(/const makeThumb = blob => \{ const job = THUMB_Q\.then\(\(\) => makeThumb1\(blob\)\);/.test(st));
console.log("ok idb-url-cache");
