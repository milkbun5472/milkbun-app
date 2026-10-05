// 她 2026-10-05 转群里：「角色突然不会发表情包了，群聊会发单聊不会」→「都改」
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("频率看这个人，不看最近发没发过（单聊、群聊同一句判据）", () => {
  assert.doesNotMatch(app, /延续(你这个角色)?已经形成的聊天习惯/);
  assert.match(app, /emote：发多发少看你这个人/);
  assert.match(app, /【表情包】发多发少看每个成员自己是什么样的人/);
  assert.equal((app.match(/最近一阵发没发过不算数/g) || []).length, 2);
});
test("群里每个人只列自己能用的那几套，跟落地那一步认的是同一份", () => {
  assert.match(app, /const gEmoteRows = members\.map\(c => \{ const l = emotesForChar\(c\.id\);/);
  assert.doesNotMatch(app, /const emotesForGroup = /, "全群合起来那一份又回来了");
  assert.match(app, /const av = emotesForChar\(spk\.id\);/);
});
