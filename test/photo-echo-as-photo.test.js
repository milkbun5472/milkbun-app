// 单独一泡「照片内容：xxx」当成照片发（她 2026-10-17 群里截图）
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "../js/engine.js"), "utf8");
const a = s.indexOf("function pullPhotoEcho("), b = s.indexOf("function photoCapLine(");
const { pullPhotoMarker } = new Function(s.slice(a, b) + "; return { pullPhotoMarker };")();
test("单独一泡照片内容：变成照片，那一泡拿掉", () => {
  assert.deepStrictEqual(pullPhotoMarker(["好呀", "照片内容：江边步道上"]), { words: ["好呀"], photo: { kind: "none", scene: "江边步道上" } });
});
test("抄了整段【…】旁注的不变照片，留给 dropEchoedNotes 摘", () => {
  assert.equal(pullPhotoMarker(["【你在这里已经实际发出一张照片】", "照片内容：x"]).photo, null);
});
test("正常说话里提到照片内容不动", () => {
  assert.equal(pullPhotoMarker(["你那张照片内容是什么"]).photo, null);
  assert.equal(pullPhotoMarker(["照片内容："]).photo, null);
});
