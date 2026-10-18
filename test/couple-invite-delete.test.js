// 删掉还没回的空间邀请卡，邀请一起撤回；早先删了卡卡住的「待邀请」自己愈合（群里 2026-10-18）
const test = require("node:test"), assert = require("node:assert");
const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
test("删消息里有等着的邀请卡 → 撤回邀请", () => {
  assert.match(app, /m\.kind === "couple_invite" && \(m\.status === "pending" \|\| m\.status === "failed"\)\)\s*&& couplesRef\.current\[activeChar\.id\]/);
  assert.match(app, /空间邀请也撤回了/);
});
test("卡没了的待邀请：再发邀请放行，TA 也能自己写申请信", () => {
  assert.match(app, /status === "pending" && !coupleInviteCardLive\(char\.id\)\) setCoupleFor\(char\.id, null\)/);
  assert.match(app, /cp\.status === "pending" && coupleInviteCardLive\(charId\)/);
});
