// 她 2026-10-05：「擂台能不能加一个如果我观战我也能投票然后把我的结果也喂给裁判和选手」
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "debate.js"), "utf8");
test("观战时每轮能投一票，票落进 r.votes（实录、裁判、最后判定都读这一份）", () => {
  assert.match(src, /me: "观战的她亲手投的"/);
  assert.match(src, /if \(!watch \|\| !r\.gen \|\| ended\) return null;/);
  assert.match(src, /rest\.concat\(\[\{ name: uName, for: n, why: "me", reason: "", me: true \}\]\)/);
  assert.match(src, /myVoteBlock\(r, ri2\),/);
  // 票进实录那一处没被绕开
  assert.match(src, /const vs = \(r\.votes \|\| \[\]\)\.filter\(function \(v\) \{ return v && v\.for; \}\);/);
});
