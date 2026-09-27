// 照片字段被写进正文（2026-09-27）：「[photo: kind=none」「face=false」「scene=…」一条条冒成气泡
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const i = src.indexOf("function pullPhotoMarker("); let d = 0, j = src.indexOf("{", i);
for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && --d === 0) break; }
const pull = new Function(src.slice(i, j + 1) + "\nreturn pullPhotoMarker;")();
// 被拆成好几条气泡的样子（她截图里那样）
let r = pull(["[photo: kind=none", "face=false", "scene=旧港区岸边，夜里九点多的海]", "你看"]);
assert.deepEqual(r.words, ["你看"]);
assert.deepEqual(r.photo, { kind: "none", scene: "旧港区岸边，夜里九点多的海", face: false });
// 没有收尾方括号也认
r = pull(["[photo: kind=none", "face=false", "scene=旧港区岸边，夜里九点多的海"]);
assert.equal(r.photo.scene, "旧港区岸边，夜里九点多的海"); assert.deepEqual(r.words, []);
// 一整条里写完，前后还有话
r = pull(["给你看[photo: kind=self, face=true, scene=镜子前，刚洗完头]就这样"]);
assert.deepEqual(r.words, ["给你看", "就这样"]); assert.equal(r.photo.kind, "self"); assert.equal(r.photo.face, true);
// 正常的话不动
r = pull(["今天好冷", "scene 这个词"]); assert.deepEqual(r.words, ["今天好冷", "scene 这个词"]); assert.equal(r.photo, null);
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
assert.match(app, /const _pm = pullPhotoMarker\(words\)/);
console.log("photo marker ok");
