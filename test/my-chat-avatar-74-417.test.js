// 我在这个聊天窗里的头像（群里读者 2026-10-02：「仅在这个聊天框里面是这个头像」）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const comp = R("components.js"), app = R("app.js");

test("聊天页我的头像：这个窗设过就用它，没设用资料那张", () => {
  assert.match(comp, /avatarImage: \(character && character\.myChatAvatar\) \|\| \(_me && _me\.avatarImage\)/);
});

test("设置页那一格存得下来", () => {
  assert.match(comp, /const \[myChatAvatar, setMyChatAvatar\] = useState\(character\.myChatAvatar \|\| null\);/);
  assert.match(app, /myChatAvatar: s\.myChatAvatar \|\| null/);
});

test("ChatSettings 里不许用裸的 profile（不在作用域里，一渲染就白屏）", () => {
  const i = comp.indexOf("function ChatSettings(");
  assert.ok(i > 0, "抠不出 ChatSettings");
  // 它是这个文件最后一个顶层函数，后面没有下一个 function 可以当终点
  const nx = comp.indexOf("\nfunction ", i + 10), j = nx > i ? nx : comp.length;
  const body = comp.slice(i, j).split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(!/(^|[^\w.])profile\b/.test(body.replace(/meProfile/g, "")), "ChatSettings 里出现了没传进来的 profile");
  assert.match(app, /meProfile: profileFor\(activeChar\.id\),\n\s*settings: Object\.assign/);
});
