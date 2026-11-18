// 她 2026-11-18：「角色给他发文档他能改了发回来吗 还有能看到几轮啊」「都做吧」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const W = require("../js/chat-context-window.js");
const app = R("js/app.js"), comp = R("js/components.js");

test("文件全文算进窗口；装不下时只把文件换成一句，前面的聊天照旧带", () => {
  const msgs = [{ role: "user", content: "早先说的事" }, { role: "user", kind: "file", name: "a.txt", text: "字".repeat(12000), chars: 12000 }];
  for (let i = 0; i < 40; i++) msgs.push({ role: i % 2 ? "assistant" : "user", content: "聊".repeat(60) });
  const pick = W.select(msgs, { maxChars: 8000, maxMessages: 80 });
  const f = pick.find(m => m.kind === "file");
  assert.ok(f && f.fileGone && f.text === "", "文件该换成「发过、全文不在了」");
  assert.equal(pick[0].content, "早先说的事", "文件前面的聊天不该被一起丢");
  assert.ok(W.costOf(msgs[1]) > 12000);
  const roomy = W.select(msgs, { maxChars: 30000, maxMessages: 80 });
  assert.ok(!roomy.find(m => m.kind === "file").fileGone);
});
test("TA 能发回一份文件：协议有这一格、落成 TA 那侧的文件卡、带复制和存成文件", () => {
  assert.match(app, /file:\{"name":"文件名（带扩展名）","text":"文件里的全文"\}=发给她一份文件/);
  assert.match(app, /pChat\(chatKey, p => \[\.\.\.p, \{ role: "assistant", kind: "file", turnId,/);
  assert.match(app, /parsed\.call = null; parsed\.file = null;/);
  assert.match(app, /【你在这里发给她一个文件「/);
  assert.match(app, /之前发来过一个文件「/);
  assert.match(comp, /h\(FileCard, \{ m: m, actions: fMine \? null : fileCardActions\(m\) \}\)/);
});
