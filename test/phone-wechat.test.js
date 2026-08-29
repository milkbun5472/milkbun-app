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
  assert.match(phone, /aria-label": "刷新微信"/);
  // 微信自己画整屏，不套外层 Head——v57.48 起这条由 FULL_BLEED_KEYS 表达
  assert.match(phone, /const FULL_BLEED_KEYS = \["wechat", "album", "reading", "shopping", "takeout", "health", "bili", "latenight", "liked", "calendar", "notes", "clipboard", "browser"\];/);
  assert.match(phone, /FULL_BLEED_KEYS\.indexOf\(appKey\) < 0 && h\("div", \{\n    className: "shrink-0 px-4 pb-2 flex items-center gap-2"/);
  assert.match(phone, /h\("span"[^\n]+"搜索"/);
  assert.match(phone, /const topBar = tab === "chats" \? searchHead : tab === "contacts" \? contactsHead : plainHead/);
  assert.match(phone, /paddingTop: safeTop\(9\)/);
  assert.match(phone, /paddingTop: safeTop\(16\)/);
});

test("微信一次生成五个新会话、五个关系联系人和三条朋友圈", () => {
  assert.match(phone, /正好 5 个互不相同的新会话/);
  assert.match(phone, /contacts 正好 5 个/);
  assert.match(phone, /moments 正好 3 条/);
  // 输出天花板统一给满（PHONE_OUT_CEILING），不再一个 app 一个数
  assert.match(phone, /const PHONE_OUT_CEILING = 65535;/);
  assert.match(phone, /maxTokens: PHONE_OUT_CEILING/);
  assert.match(phone, /signature/);
  assert.match(phone, /accounts/);
  assert.match(phone, /userContact/);
  assert.match(phone, /wechatName/);
});

test("真实聊天只从本人私聊和本人所在群聊读取并先喂给生成器", () => {
  assert.match(app, /chatsRef\.current\[char\.id\]/);
  assert.match(app, /const memberIds = group\.memberIds \|\| \[\]/);
  assert.match(app, /if \(!memberIds\.includes\(char\.id\)\) continue/);
  assert.match(app, /const groupState = gsFor\(group\.id\)/);
  assert.match(app, /const isSpectate = groupPhoneKind\(group, groupState, groupHistory\) === "spectate"/);
  assert.match(app, /phoneWechatDigest\(char\)/);
  assert.match(phone, /const chats = \[\.\.\.actual, \.\.\.generated\]/);
});

test("查手机排除普通封闭群，但保留旁观对话", () => {
  assert.match(app, /if \(!isSpectate && !groupState\.memoryInterop\) continue;/);
  assert.match(app, /const groupPhoneKind = \(group, state, history\) =>/);
  assert.match(app, /hasNarration/);
  assert.match(app, /hasLisaSpeech/);
  assert.match(app, /return state && state\.spectate \? "spectate" : "group"/);
});

test("普通三人群和同一对角色的两人旁观局不会再按人数混淆", () => {
  assert.match(app, /roomKind: spectate \? "spectate" : "group"/);
  assert.match(app, /group && group\.roomKind === "spectate"/);
  assert.match(app, /group && group\.roomKind === "group"/);
  assert.match(app, /m\.role === "narration"/);
  assert.match(app, /m\.role === "user"/);
});

test("两人旁观显示为私聊，三人以上仍显示群聊", () => {
  assert.match(app, /const spectatePrivate = isSpectate && memberIds\.length === 2/);
  assert.match(app, /type: spectatePrivate \? "private" : "group"/);
});

test("同一对成员的多个两人旁观房只保留最近一条", () => {
  assert.match(app, /const spectatePrivateByPair = new Map\(\)/);
  assert.match(app, /const pairKey = memberIds\.map\(String\)\.sort\(\)\.join\("\|"\)/);
  assert.match(app, /if \(!prev \|\| \(session\.ts \|\| 0\) > \(prev\.ts \|\| 0\)\) spectatePrivateByPair\.set\(pairKey, session\)/);
  assert.match(app, /sessions\.push\(\.\.\.spectatePrivateByPair\.values\(\)\)/);
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
