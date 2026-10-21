// 群友 2026-10-21：「换壁纸的时候可不可以出一个预览」；她：都做吧。选好图先整屏预览，点「就用这张」才换上。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const comp = rd("js/components.js"), sui = rd("js/screens-ui.js"), ph = rd("js/phone-ui.js");
test("公共预览页和入口在", () => {
  assert.match(comp, /function WallPreview\(\{ src, kind, fx, onUse, onCancel, onRepick \}\)/);
  assert.match(comp, /function openWallPreview\(o\)/);
  assert.match(comp, /"就用这张"/);
});
test("主屏壁纸、单聊群聊背景、单人群线下场景图、查手机锁屏主页都先预览", () => {
  assert.match(sui, /openWallPreview\(\{ src: dataUrl, kind: "home", fx: fx, onUse: \(\) => onSaveWallpaper\(dataUrl\)/);
  assert.equal((comp.match(/openWallPreview\(\{ src: d, kind: "chat", fx: chatBgFx, onUse: \(\) => setChatBg\(d\)/g) || []).length, 2);
  assert.equal((comp.match(/openWallPreview\(\{ src: d, kind: "offline"/g) || []).length, 2);
  assert.equal((ph.match(/openWallPreview\(\{ src: phoneImage\(v\) \|\| v, kind: kind === "lockWallpaper" \? "phonelock" : "phonehome"/g) || []).length, 2);
});
