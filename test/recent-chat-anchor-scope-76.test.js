// 她 2026-10-30 报的：聊天里弹 toast「Can't find variable: charId」。
// 病根：v76.989 给每条用户消息加日期锚时，在 recentChat 里写了 vAnchor(..., charId)——
//   可 recentChat 这一层拿到的是 char，整个作用域里压根没有 charId（_replyTurn 那边才有）。
//   于是只要有一条用户消息要挂锚，拼上下文就整段抛 ReferenceError。
// 这条钉的是【recentChat 里只认 char】：这一段不许出现裸的 charId。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");

test("拼最近聊天那一段里不许出现裸的 charId（这一层只有 char）", () => {
  const i = app.indexOf("      const ctxN = Math.max(0, Number(settingsFor(char.id).ctxN ?? 50));");
  assert.ok(i > 0, "recentChat 那段没了");
  const j = app.indexOf("      lines.reverse();", i);
  assert.ok(j > i, "收尾那几行变了");
  const body = app.slice(i, j);
  const bare = body.match(/(?<![.\w$])charId(?!\s*[:=]>)(?![\w$])/g) || [];
  assert.equal(bare.length, 0, "recentChat 里又出现了裸的 charId：" + bare.length + " 处");
  assert.match(body, /vAnchor\(m\.content, m\.ts, char\.id\)/, "日期锚没按 char.id 走");
});

// 同一天第二例：群线下生成报「groupId is not defined」。genGroupOfflineFrom 拿到的是 group（groupIn），
//   v76.989 给群线下接那只钟时照抄了 replyGroup 里的 "g:" + groupId。
test("群线下生成那一段只认 group.id，不许出现裸的 groupId", () => {
  const i = app.indexOf("  const genGroupOfflineFrom = async (groupIn, workSess) => {");
  assert.ok(i > 0, "genGroupOfflineFrom 没了");
  const j = app.indexOf("\n  const ", i + 10);
  const body = app.slice(i, j > i ? j : i + 20000);
  const bare = body.match(/(?<![.\w$])groupId(?![\w$])(?!\s*:)/g) || [];
  assert.equal(bare.length, 0, "genGroupOfflineFrom 里又出现了裸的 groupId：" + bare.length + " 处");
  assert.match(body, /clockId: "g:" \+ group\.id/);
});
