// 邮票册翻着会闪、会闪退（她 2026-11-28）：读过的图留着别每次清空重读；缩略图一次只缩一张；同键换图时缓存作废
const fs = require("fs"), path = require("path"), assert = require("assert");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const comp = R("components.js"), st = R("stamps.js"), eng = R("engine.js");
assert(/const IDB_URL_CACHE = new Map\(\);/.test(comp) && /const IDB_URL_MAX = 24;/.test(comp));
assert(/window\.__idbUrlDrop = k =>/.test(comp));
assert(/async function idbImgPutOnly\(k, blob\) \{ try \{ if \(typeof window !== "undefined" && window\.__idbUrlDrop\) window\.__idbUrlDrop\(k\);/.test(eng));
assert(/const makeThumb = blob => \{ const job = THUMB_Q\.then\(\(\) => makeThumb1\(blob\)\);/.test(st));
console.log("ok idb-url-cache");
// 册子里动起来的卡面只在看得见时放（她 2026-11-28「下滑看其他卡会闪、会闪退」）
assert(/const vurl = useStampVideo\(card && !back \? coverVideo\(card\) : null, vis\);/.test(st), "滑走就收");
assert(/const io2 = new IntersectionObserver\(es => \{ const e = es\[es\.length - 1\]; if \(e\) setVis\(e\.isIntersecting\); \}/.test(st));
console.log("ok stamp-video-visible");
// 离屏幕一大截的卡把图放掉（她 2026-11-28：滑多了再点开就整页重开）
assert(/rootMargin: "900px 0px"/.test(st) && /face: keep \? url : null/.test(st), "滑远了的卡放掉图");
console.log("ok stamp-unload-far");
