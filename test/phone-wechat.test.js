const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("微信手机页有聊天、联系人、朋友圈、我四块", () => {
  assert.match(phone, /\["chats", "聊天"\]/);
  assert.match(phone, /\["contacts", "联系人"\]/);
  assert.match(phone, /\["moments", "朋友圈"\]/);
  assert.match(phone, /\["me", "我"\]/);
  assert.match(phone, /function WechatNavIcon/);
  assert.match(phone, /shrink-0 grid grid-cols-4/);
});

test("微信一次生成五个新会话、五个关系联系人和三条朋友圈", () => {
  assert.match(phone, /正好 5 个互不相同的新会话/);
  assert.match(phone, /contacts 正好 5 个/);
  assert.match(phone, /moments 正好 3 条/);
  assert.match(phone, /maxTokens: 12000/);
  assert.match(phone, /signature/);
  assert.match(phone, /accounts/);
  assert.match(phone, /userContact/);
  assert.match(phone, /wechatName/);
});

test("真实聊天只从本人私聊和本人所在群聊读取并先喂给生成器", () => {
  assert.match(app, /chatsRef\.current\[char\.id\]/);
  assert.match(app, /\(group\.memberIds \|\| \[\]\)\.includes\(char\.id\)/);
  assert.match(app, /gsFor\(group\.id\)\.spectate/);
  assert.match(app, /phoneWechatDigest\(char\)/);
  assert.match(phone, /const chats = \[\.\.\.actual, \.\.\.generated\]/);
});

test("联系人固定补入 Lisa，公众号文章可点开查看感想", () => {
  assert.match(phone, /const contacts = \[\{ name: meName/);
  assert.match(phone, /最近读过的公众号文章/);
  assert.match(phone, /看完想了什么/);
});

test("真实聊天显示头像、十二轮上下文，并在微信内全屏打开", () => {
  assert.match(app, /slice\(-12\)/);
  assert.match(app, /avatarImage: m\.role === "user" \? profile\.avatarImage/);
  assert.match(app, /const groupAvatar = group\.avatarImage/);
  assert.match(phone, /thread && thread\.type !== "contact"/);
  assert.match(phone, /h-full min-h-0 flex flex-col/);
  assert.match(phone, /if \(key === "wechat"\) return h\(WeChatViewFull/);
});
