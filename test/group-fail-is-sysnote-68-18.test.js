// 她 2026-09-14：「为啥单聊 load failed 是系统提示可以叉掉，但群聊的是气泡，
// 改成跟单聊一样，用公共的格式」。
//
// 病根是同一件事两种形状：单聊写 kind:"system"（渲染那头认 kind），
// 群聊写 senderName:"系统"（渲染那头认 role）——于是群里那条掉进了普通气泡，
// 既叉不掉、又长得像谁说的话。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const F = require("../js/chat-context-filter.js");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

test("失败提示长什么样只有一处说了算", () => {
  const row = F.failureNotice("（发送失败：Load failed）");
  assert.equal(row.kind, "system");
  assert.equal(row.role, "assistant");
  assert.equal(row.contextExcluded, true);
  assert.equal(row.systemFailure, true);
  assert.ok(row.ts > 0);
  // 认得出自己写的：写和认在同一份里，两头再也分不了家
  assert.equal(F.isFailureNotice(row), true);
  assert.equal(F.allows(row), false, "失败提示不该进上下文");
});

test("额外那几格照旧带得上（turnId / senderName）", () => {
  assert.equal(F.failureNotice("x", { turnId: "e_1" }).turnId, "e_1");
  assert.equal(F.failureNotice("x", { senderName: "系统" }).senderName, "系统");
  // 空值不要画成 undefined
  assert.equal(F.failureNotice(null).content, "");
});

test("两处都改走公共那一份，不许再各拼各的", () => {
  assert.match(app, /pChat\(chatKey, p => \[\.\.\.p, window\.ChatContextFilter\.failureNotice\(/);
  assert.match(app, /pGChat\(groupId, p => \[\.\.\.p, window\.ChatContextFilter\.failureNotice\(/);
  assert.ok(!/senderName: "系统",\s*\n\s*contextExcluded: true/.test(app), "群那份老形状还在");
});

test("渲染：单聊和群聊认同一条判据", () => {
  assert.equal((comp.match(/if \(m\.kind === "system" \|\| m\.role === "system"\) return h\(SysNote/g) || []).length, 2,
    "两处渲染判据没对齐——群里那条又会掉回气泡");
  // 能叉掉这件事两边都要有
  assert.equal((comp.match(/label: "系统", text: m\.content, tone: "warn",\s*\n\s*onClose: onDeleteMessages/g) || []).length, 2);
});
