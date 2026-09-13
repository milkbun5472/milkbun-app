// 她 2026-09-13：「群聊里我可以发投票，但是他们是不是发不了。还有红包也是，打电话打视频也是」。
//
// 查下来：红包（item.redpacket）和打电话/视频（item.call）协议里本来就有、也真的接上了，
// 只有投票是半条——成员能投（item.pollVote），却没有任何一格让他自己发起一张。
// v67.84 补上 item.pollNew，并且按「同一个形状先开公共的」把我发起的那条也搬到同一个出生点。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 真跑那一份出生点：桩照【写存档的那段】写——pushGroupRich 收到什么就是存档里那条
const mk = () => {
  const i = app.indexOf("  const pushPoll = (groupId, title, options, anon, char) => {");
  const j = app.indexOf("  const groupPoll = (groupId, target) => {");
  assert.ok(i > 0 && j > i, "抠不出发投票那一份");
  const rows = [];
  const src = app.slice(i, j)
    .replace(/toast\(/g, "noop(")
    .replace(/setTimeout\(/g, "noop(");
  const fn = new Function("pushGroupRich", "gsFor", "profile", "noop", "genPollVotes",
    src + "\nreturn { pushPoll, startPoll, postPoll };");
  const K = fn((g, r) => rows.push(r), () => ({ spectate: false }), { name: "丽莎" }, () => {}, () => {});
  return { K, rows };
};

test("成员自己发起的那张，是他发的：头上挂他的名字，卡上写「由他发起」", () => {
  const { K, rows } = mk();
  K.postPoll("g1", { id: "c9", name: "言秋" }, "晚上吃什么", ["火锅", "烧烤"], false);
  assert.equal(rows.length, 1);
  const p = rows[0];
  assert.equal(p.kind, "poll");
  assert.equal(p.role, "assistant");      // user 的话会画到右边、当成我发的
  assert.equal(p.senderId, "c9");
  assert.equal(p.senderName, "言秋");
  assert.equal(p.by, "言秋");             // PollCard 上那句「由 XX 发起」
  assert.deepEqual(p.options.map(o => o.text), ["火锅", "烧烤"]);
  assert.deepEqual(p.options.map(o => o.voters), [[], []]);
});

test("我发起的那张一个字没变：还是我的名字、还是 role user", () => {
  const { K, rows } = mk();
  K.startPoll("g1", "周末去哪", ["海边", "山上"], true);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].role, "user");
  assert.equal(rows[0].by, "丽莎");
  assert.equal(rows[0].anon, true);
  assert.equal(rows[0].senderId, undefined);
  assert.equal(rows[0].content, "[投票] 周末去哪");
});

test("题目空的、选项不够两个：不发，也不算发过", () => {
  const { K, rows } = mk();
  assert.equal(K.pushPoll("g1", "  ", ["A", "B"], false, null), null);
  assert.equal(K.pushPoll("g1", "吃啥", ["只有一个"], false, null), null);
  assert.equal(K.pushPoll("g1", "吃啥", ["A", "  ", null], false, null), null); // 空白选项不算数
  assert.equal(rows.length, 0);
});

test("只有一个出生点：老的那段现拼一张卡的写法不许再有第二份", () => {
  assert.equal(app.split('kind: "poll",').length - 1, 1, "poll 卡还在两处各拼各的");
  assert.match(app, /const startPoll = \(groupId, title, options, anon\) => \{\n    const pollId = pushPoll\(/);
  assert.match(app, /const postPoll = \(groupId, char, title, options, anon\) => \{/);
});

test("接线：协议里有这一格，群回复里真的接住了", () => {
  assert.match(app, /\\"pollNew\\":\{\\"title\\"/);
  assert.match(app, /if \(item\.pollNew && spk\) \{\n            postPoll\(groupId, spk, item\.pollNew\.title, item\.pollNew\.options, item\.pollNew\.anon === true\);/);
  // 她本来就没问题的那两样，顺手钉住，别哪天被改没了
  assert.match(app, /if \(item\.redpacket && Number\(item\.redpacket\.total\) > 0\) \{/);
  assert.match(app, /item\.call && \[/);
});
