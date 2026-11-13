const test = require("node:test"); const assert = require("node:assert");
const A = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
const i = A.indexOf("const PHOTO_ANGLE_RE"), j = A.indexOf("const drawChatSelfie");
const photoAskAngle = new Function(A.slice(i, j) + "; return photoAskAngle;")();
test("她点名的拍法交给画图，机位不再掷", () => {
  assert.equal(photoAskAngle([{ role: "user", content: "好看。这回给我来张正脸自拍" }]), "这回给我来张正脸自拍");
  assert.equal(photoAskAngle([{ role: "user", content: "拍张照给我看看" }]), "");
  assert.equal(photoAskAngle([{ role: "user", content: "全身照" }, { role: "assistant", content: "x" }, { role: "user", content: "快点" }]), "全身照");
  assert.match(A, /shotLine: "【这一张的机位·她点名要的】/);
  assert.match(A, /askAngle: m\.askAngle \|\| ""/);
});
