const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
test("TA 换头像只换聊天里那张，档案那张不动；档案页能用回", () => {
  assert.ok(app.includes("{ ...x, chatAvatar: msg.imageRef }"));
  assert.ok(!app.includes("{ ...x, avatarImage: msg.imageRef }"));
  // v74.80 起 chatFace 搬进 engine.js（公共件），各处共用
  const eng = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
  const f = new Function(eng.match(/function chatFace\(c\) \{[^\n]+/)[0] + "; return chatFace;")();
  assert.strictEqual(f({ avatarImage: "a", chatAvatar: "b" }).avatarImage, "b");
  assert.strictEqual(f({ avatarImage: "a" }).avatarImage, "a");
  // v74.988 小号房里TA开小号时换成小号那张脸，其余照旧是 chatFace(activeChar)
  assert.ok(app.includes(": chatFace(activeChar); })(),"));
  assert.ok(app.includes("characters: liveChars.map(chatFace)"));
  assert.ok(scr.includes("chatAvatar: chatAvatarOn ? initial.chatAvatar : null"));
});
test("聊天设置里能直接设/清聊天头像，存回角色的 chatAvatar", () => {
  const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
  const cs = comp.slice(comp.indexOf("function ChatSettings({"));
  assert.ok(cs.includes('h(LineField, { zh: "聊天头像"'));
  assert.ok(cs.includes("onPick: setChatAvatar"));
  assert.ok(app.includes("chatAvatar: s.chatAvatar || null"));
});
