// 群友 2026-10-19：「壁纸换了不是很清晰」——铺满整屏的图别压到 1080
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const fn = eng.match(/function screenImageDim\(\) \{[\s\S]*?\n\}/)[0];
const dim = (w, h, dpr) => { const window = { innerWidth: w, innerHeight: h, devicePixelRatio: dpr }; return eval("(" + fn + ")")(); };
assert.equal(dim(430, 932, 3), 2560, "大屏 iPhone：封顶 2560");
assert.equal(dim(390, 844, 3), 2532);
assert.equal(dim(360, 640, 2), 1600, "小屏也不低于 1600");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
assert.match(scr, /resizeImageFile\(file, screenImageDim\(\), 0\.9\)/);
assert.equal((comp.match(/resizeImageFile\(f, screenImageDim\(\), 0\.88\)/g) || []).length, 4, "四处聊天背景都要换");
assert.ok(!/bgFileRef[^\n]*resizeImageFile\(f, 1200/.test(comp));
console.log("ok");
