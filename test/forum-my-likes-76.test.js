// 论坛：自己发的帖赞和阅读涨得旺一点（2026-11-02 群里）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8");
const a = ui.indexOf("const forumLiveCounts"), b = ui.indexOf("function forumAge", a);
const forumHash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const f = new Function("forumHash", ui.slice(a, b) + "; return forumLiveCounts;")(forumHash);
test("同一条帖，她发的比别人发的涨得多；只长不落", () => {
  const now = Date.now(), ts = now - 48 * 3600000;
  const me = f({ id: "x1", ts, likeCount: 10, authorType: "me" }, now), other = f({ id: "x1", ts, likeCount: 10, authorType: "npc" }, now);
  assert.ok(me.likeCount > other.likeCount * 2);
  assert.ok(f({ id: "x1", ts, likeCount: 10, authorType: "me" }, now + 3600000).likeCount >= me.likeCount);
});
