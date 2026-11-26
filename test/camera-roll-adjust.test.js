// 相机：拍过的大退重进还在；滤镜后面能自己调（她 2026-11-26）
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const cam = fs.readFileSync(path.join(__dirname, "..", "js", "camera.js"), "utf8"), ts = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio.js"), "utf8");
test("胶卷清单开相机时照图库 img_camroll_ 键排回来，键尾记拍的/画的", () => {
  assert.match(cam, /k = "img_camroll_" \+ ts\.toString\(36\) \+ "_" \+/);
  assert.match(cam, /await idbAllKeys\(idbImgOpen\)/);
  assert.match(cam, /filter\(k => k\.indexOf\("img_camroll_"\) === 0\)/);
});
test("自己调：五根条拼成 CSS 串，只用逐像素兜底认得的那几种函数", () => {
  const src = cam.slice(cam.indexOf("function adjCss"), cam.indexOf("const STYLES"));
  const adjCss = new Function(src + "; return adjCss;")();
  assert.strictEqual(adjCss({ light: 0, contrast: 0, sat: 0, warm: 0, fade: 0 }), "");
  const all = adjCss({ light: 50, contrast: -40, sat: 100, warm: 60, fade: 30 }) + " " + adjCss({ warm: -60 });
  for (const [, f] of all.matchAll(/([a-z-]+)\(/g)) assert.ok(["brightness", "contrast", "saturate", "sepia", "hue-rotate"].includes(f), f);
  assert.match(cam, /const fcss = \(\(FILTERS\.find/);
  assert.ok(ts.includes('["camadjust"') && cam.includes('"data-wk": "camadjust"'));
});
test("给TA看／一起逛：同一个 cameraLook，看图回 say(+caption)；发进聊天走 shareShotToChat，不当场替TA开口", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /const cameraLook = async \(charId, img, kind, inPhoto\) =>/);
  assert.match(app, /const cameraShare = async \(charId, blob, caption\) =>[\s\S]{0,400}return shareShotToChat\(char,/);
  assert.match(app, /onLook: cameraLook, onShare: cameraShare/);
  assert.match(cam, /const finalBlob = async \(\) => look && look\.caption \? await polaroid\(/);
  assert.match(cam, /if \(st\.say\) drawBubble\(ctx,/);
  for (const k of ["camlook", "camlookone", "camlooksay", "camcaption", "camsay"]) { assert.ok(ts.includes('["' + k + '"'), k); assert.ok(cam.includes('"data-wk": "' + k + '"'), k); }
});
test("拍过的点开看大图：复用成片页，左下是删除，删本机图库那张", () => {
  assert.match(cam, /onClick: \(\) => openRoll\(p\)/);
  assert.match(cam, /shot\.fromRoll \? big\("删除", delRoll, "delshot"\)/);
  assert.match(cam, /await idbImgDel\(shot\.k\)/);
  assert.ok(ts.includes('["camrollone"'));
});
test("拍过的按角色分：画面里有谁写在键尾，开相机时读回来，上面一排按人筛", () => {
  assert.match(cam, /ps\.map\(encodeURIComponent\)\.join\("~"\)/);
  assert.match(cam, /rest\.slice\(j \+ 1\)\.split\("~"\)/);
  assert.match(cam, /toRoll\(blob, "拍的", stickers\.map\(s => s\.pid\)\)/);
  assert.match(cam, /toRoll\(blob, "画的", genIds\)/);
  assert.ok(ts.includes('["camrollwho"') && cam.includes('"data-wk": "camrollwhoone"'));
});
test("旅行：一站一站寄；样子可以定也可以让TA挑；出发前选她去不去、记不记", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8"), trip = fs.readFileSync(path.join(__dirname, "..", "js", "camera-trip.js"), "utf8"), html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(app, /const tripPlan = async \(ids, place, meGo, n\) =>/);
  assert.match(app, /const tripCard = async \(trip, idx, styles\) =>/);
  assert.match(app, /if \(trip\.remember\) \{/);
  assert.match(app, /onTripPlan: tripPlan, onTripCard: tripCard/);
  assert.match(trip, /const style = stop\.style !== "auto" \? stop\.style : \(r\.style \|\|/);
  assert.match(trip, /const next = trip\.stops\.findIndex\(s => !s\.card\)/);
  assert.match(html, /data-lazy="camera" data-src="js\/camera-trip\.js\?v=/);
  for (const k of ["trippage", "tripcard", "tripone", "tripstop", "tripitem", "trippost", "tripflip", "tripfront", "tripback", "tripbtn"]) { assert.ok(ts.includes('["' + k + '"'), k); assert.ok(trip.includes('"data-wk": "' + k + '"'), k); }
});
