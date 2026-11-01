// 查手机邮件腔调不定死、账本兜底条款不往最大的词上撑（她 2026-10-31）
require("node:test")("邮件看人、条款要具体", () => {
  const assert = require("node:assert/strict");
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "phone.js"), "utf8");
  assert.doesNotMatch(src, /客气、绕、留余地、把话说死之前先铺三层/);
  assert.match(src, /【邮件里是他对外的那一面】对外是什么样，看他这个人/);
  assert.match(src, /条款写的是他真会做到、也做得到的那一件事，具体到哪件事、做到哪一步/);
});
