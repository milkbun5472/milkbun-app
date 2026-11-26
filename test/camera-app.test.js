const fs = require("fs"), assert = require("assert"), path = require("path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const cam = R("js/camera.js"), comp = R("js/components.js"), app = R("js/app.js"), idx = R("index.html"), cc = R("js/call-camera.js");
assert(/window\.CallCamera\.create\(setCs, window, \{ width: 1920, height: 1080 \}\)/.test(cam), "相机走 CallCamera 那一份镜头");
assert(/width: \{ ideal: \(size && size\.width\) \|\| 640 \}/.test(cc), "视频通话不传时照旧 640");
assert(/camera: \{ kind: "app", zh: "相机", tail: true/.test(comp), "主屏单独一个");
assert(/\["CameraApp", "camera", "相机"\]/.test(comp), "懒加载登记");
assert(/data-lazy="camera" data-src="js\/camera\.js\?v=/.test(idx), "index 挂脚本");
assert(/screen === "camera"\) body = h\(window\.CameraApp/.test(app) && /const OK = \["camera"/.test(app), "路由");
// 滤镜兜底：逐像素按同一串算
global.React = { createElement() {}, useState() {}, useRef() {}, useEffect() {} }; global.window = {};
new Function("React", "window", cam)(global.React, global.window);
const K = global.window.CameraKit;
const d = new Uint8ClampedArray([200, 100, 50, 255]);
const ctx = { getImageData: () => ({ data: d }), putImageData() {} };
K.pixelFilter(ctx, 1, 1, "grayscale(1)");
assert(d[0] === d[1] && d[1] === d[2], "黑白兜底算成灰");
assert(K.FILTERS.every(f => f.id && f.zh), "滤镜都有中文名");
// 生图跟小家伙合照同一份提示词：都走 castShotBlob
assert(/const cameraGenShot = [\s\S]{0,700}return castShotBlob\(cast, sc,/.test(app), "相机生图走 castShotBlob");
assert(/const blob = await castShotBlob\(cast, scene, \{ kind: "self", extraRef: pref/.test(app), "小家伙合照也走 castShotBlob");
assert(/onGen: cameraGenShot/.test(app) && /props\.onGen\(genIds, genScene, genWho\)/.test(cam), "相机接上生图");
console.log("ok camera-app");
