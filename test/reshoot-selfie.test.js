const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("TA 的照片长按有「只重拍这张图」，只换像素；重Roll 照旧整轮", () => {
  assert.ok(app.includes("drawChatSelfie({ chatKey, charId, sid, photoKind, photoScene });"));
  assert.ok(app.includes('if (act === "reshoot") { reshootChatSelfie(threadKey, idx, activeChar.id); return; }'));
  const src = comp.slice(comp.indexOf("const MSG_MENU"), comp.indexOf("// 编辑消息弹层"));
  const f = new Function(src + "; return menuItemsForKind;")();
  const flat = m => f(m, false).flat();
  assert.ok(flat({ kind: "selfie", role: "assistant", sid: "s1" }).includes("reshoot"));
  assert.ok(flat({ kind: "selfie", role: "assistant", sid: "s1" }).includes("reroll"));
  assert.ok(!flat({ kind: "selfie", role: "assistant", sid: "s1", pending: true }).includes("reshoot"));
  // 群里成员发的也有（她 2026-10-01：「群聊也带上，这种不是公共的吗」）
  assert.ok(flat({ kind: "selfie", role: "assistant", sid: "s1", senderId: "g" }).includes("reshoot"));
  assert.ok(app.includes("drawGroupSelfie({ groupId, spk, gsid, gPhotoKind, gPhotoScene, gCast });"));
  assert.ok(app.includes('if (act === "reshoot") { reshootGroupSelfie(groupId, idx); return; }'));
});
