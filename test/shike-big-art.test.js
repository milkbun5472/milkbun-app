// 她 2026-10-16：「时刻里生成出来的图能不能全屏预览然后保存到手机」
const test = require("node:test");
const assert = require("node:assert/strict");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "shike.js"), "utf8");
test("时刻：有图就有「看大图」，大图里能存原图", () => {
  assert.match(s, /\["看大图", \(\) => setBig\(/);
  const i = s.indexOf("function MomentArtBig("), j = s.indexOf("function MomentArt(", i);
  assert.ok(i > 0 && j > i, "抠不出 MomentArtBig");
  assert.match(s.slice(i, j), /h\(ImageViewer, \{ onClose, items: \[\{ src \}\]/);   // 2026-10-16 起走全库那一份
  assert.match((() => { const c0 = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8"); const a0 = c0.indexOf("function ImageViewer("); return c0.slice(a0, c0.indexOf("function requestAppConfirm(", a0)); })(), /objectFit: "contain"/);
  assert.match(s, /saveImgOriginal\(ref, big\.name\)/);
});
