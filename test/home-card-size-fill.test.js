// 她 2026-10-20：名片选了 4×2 还是那么大。原尺寸按内容高；挑了尺寸就照挑的撑满那几行。
const test = require("node:test");
const assert = require("node:assert/strict");
const c = require("fs").readFileSync(require("path").join(__dirname, "../js/components.js"), "utf8");
test("名片只在原尺寸时不钉高度；挑了尺寸就钉死并撑满", () => {
  assert.match(c, /&& !\(HOME_FREE_HEIGHT\[key\] && homeSize === "auto"\) \? homeSpanHeight\(span\[1\], rowUnit\) : null;/);
  assert.match(c, /alignSelf: HOME_FREE_HEIGHT\[key\] && homeSize === "auto" && !asIcon \? "start" : undefined,/);
  assert.match(c, /h\(HomeCard, \{ flush: true, fill: !!fixedH,/);
  assert.match(c, /fill \? \{ height: "100%" \} : null, skin\)/);
});
