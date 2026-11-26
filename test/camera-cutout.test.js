// 相机里抠出来的人（她 2026-11-26「生好的图怎么扣出人像一起拍」「都做了」）：现生绿底去绿、从照片本机分割，存进贴纸夹，放进实景拍
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const cam = fs.readFileSync(path.join(__dirname, "..", "js", "camera.js"), "utf8"), app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8"), ts = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio.js"), "utf8");
test("现生：锁脸那一套画全身纯绿底，相机那头去绿", () => {
  assert.match(app, /const cameraGenCutout = async \(id, pose\) =>/);
  assert.match(app, /return castShotBlob\(\[who\], sc, \{ kind: "other", extraText:/);
  assert.match(app, /onGenCutout: cameraGenCutout/);
  assert.match(cam, /const raw = await props\.onGenCutout\(cutFor, cutPose\); const png = await keyGreen\(raw\);/);
  assert.match(cam, /if \(!\(kg > kr \+ 40 && kg > kb \+ 40\)\) throw new Error/, "底不是绿的就照实说，不硬抠");
});
test("从照片抠：先用自带的那份（vendor），载不下来再退 CDN", () => {
  assert.match(cam, /here\("vendor\/mediapipe-tasks-vision-" \+ MP_VER \+ "\/vision_bundle\.mjs"\)/);
  assert.match(cam, /here\("vendor\/mediapipe-models\/selfie_multiclass_256x256\.tflite"\)/);
  for (const f of ["vendor/mediapipe-tasks-vision-1.2.3/vision_bundle.mjs", "vendor/mediapipe-tasks-vision-1.2.3/wasm/vision_wasm_internal.js", "vendor/mediapipe-tasks-vision-1.2.3/wasm/vision_wasm_internal.wasm", "vendor/mediapipe-models/selfie_multiclass_256x256.tflite"])
    assert.ok(fs.existsSync(path.join(__dirname, "..", f)), f);
});
test("抠好的存图库、按人记；放进来是 cut 贴纸，拍照时一起画进去", () => {
  assert.match(cam, /const CUT_KEY = "x_camCutouts";/);
  assert.match(cam, /await idbImgPut\(k, png\);/);
  assert.match(cam, /if \(st\.style === "cut"\) \{ ctx\.save\(\);/);
  assert.match(cam, /if \(st\.style === "cut"\) \{   \/\/ 抠出来的人/);
});
test("不往底栏多塞按钮：抠图人是加人面板里的一格", () => {
  assert.ok(!/btn\("抠图人", \(\) => setPanel/.test(cam));
  assert.match(cam, /\[\["avatar", "头像贴纸"\], \["cut", "抠图人"\]\]\.map/);
  for (const k of ["camsheet", "camgencard", "camresultframe"]) assert.ok(ts.includes('["' + k + '"'), k);
  for (const k of ["campicktab", "camcut", "camcutwho", "camcutone", "camcutlist", "camcutthumb", "camcutdel", "camcutpose"]) { assert.ok(ts.includes('["' + k + '"'), k); assert.ok(cam.includes('"data-wk": "' + k + '"'), k); }
});
