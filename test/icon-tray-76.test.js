// 图标一次选多张：名字对不上的摆一排，点一张再点 App（群里 2026-10-18 相册编号截图）
const test = require("node:test"), assert = require("node:assert");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "theme-studio-ui.js"), "utf8");
test("对不上的进待分配那一排，点 App 就放上去，也能照顺序一次排", () => {
  assert.match(src, /trayAdd\.push\(\{ ref: await imgToVault\(await resizeImageFile\(f, 512, \.9\)\), name: stem \}\)/);
  assert.match(src, /if \(trayPick >= 0 && iconTray\[trayPick\]\) \{ const it = iconTray\[trayPick\]; patchDraft\(\{ icons: \{ \.\.\.draft\.icons, \[key\]: it\.ref \} \}\)/);
  assert.match(src, /"照列表顺序排上去"/);
});
