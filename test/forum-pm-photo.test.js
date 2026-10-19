// 论坛私信也能发照片（群里 2026-10-18）；网友拍到自己照他说的长相画、不要参考照（她 2026-10-19）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "../js/screens-ui.js"), "utf8");
const a = app.indexOf("const pmPhotoMsg = "), b = app.indexOf("const pmAppend = ");
const pmPhotoMsg = new Function(app.slice(a, b) + "; return pmPhotoMsg;")();
test("回复里的 photo 收成一条照片消息，look 跟着走；没写画面就没有", () => {
  assert.deepStrictEqual(pmPhotoMsg({ photo: { desc: "窗边", who: "self", look: "短发" } }, 5), { from: "npc", text: "", photo: { desc: "窗边", who: "self", look: "短发" }, ts: 5 });
  assert.equal(pmPhotoMsg({ photo: { desc: "" } }, 1), null);
  assert.equal(pmPhotoMsg({ say: ["hi"] }, 1), null);
  assert.equal(pmPhotoMsg({ photo: { desc: "x", who: "乱写" } }, 1).photo.who, "");
});
test("三条私信路都教得会发照片，只有网友那条要 look", () => {
  assert.equal((app.match(/pmPhotoHint\(false\)/g) || []).length, 2);
  assert.match(app, /pmPhotoHint\(true\) \+ \(th\.look \?/);
  assert.equal((app.match(/pmAppend\(threadId, \w+, \w+\)/g) || []).length, 3);
});
test("网友拍到自己：照 look 画、不带参考照；没拍到人就画景；角色用自己的参考照", () => {
  assert.match(app, /const drawer = real \|\| \(look && who !== "none" \? \{ id: "pmnpc_" \+ th\.id, name: th\.npcName, appearance: look \} : null\);/);
});
test("私信里照片画出来、点开能生能重画", () => {
  assert.match(ui, /"data-wk": "pmphoto"/);
  assert.match(ui, /window\.forumPMGenImage\(photoView\.pmAt\.tid, photoView\.pmAt\.i\)/);
});
