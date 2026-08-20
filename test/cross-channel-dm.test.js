const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");

// 她 2026-08-20：群里说「待会私聊给你看」，就该真的到私聊里来；反过来也成立。
test("群 → 私聊：dm 能力要说清「别放空炮」，并真的落进私聊", () => {
  assert.match(app, /const gDmHint = gDmMembers\.length \?/);
  const hint = app.slice(app.indexOf("const gDmHint"), app.indexOf("const gDmField"));
  assert.match(hint, /待会私聊说.*单独跟你讲.*回头发你/, "要点名这几句承诺");
  assert.match(hint, /别放空炮/);
  assert.match(hint, /群里其他人看不到/, "得说清它和 text 是两回事");
  assert.match(hint, /一轮最多一个人用，别频繁/);
  // 落地：形状必须和普通私聊消息一致，未读红点/预览/记忆才吃得到
  assert.match(app, /pChat\(spk\.id, p => \[\.\.\.p, \{ role: "assistant", content: gDm, ts: Date\.now\(\), read: false, fromGroup: groupId \}\]\)/);
  // 被拉黑的人不该还能私聊过来
  assert.match(app, /if \(gDm && spk && !\(blocksRef\.current\[spk\.id\] && \(blocksRef\.current\[spk\.id\]\.iBlocked \|\| blocksRef\.current\[spk\.id\]\.theyBlocked\)\)\)/);
});

test("私聊 → 群：只挑最近有动静的共同群，没共同群就不开这能力", () => {
  const seg = app.slice(app.indexOf("const _myGroups"), app.indexOf("const capabilityHint"));
  assert.match(seg, /\(g\.memberIds \|\| \[\]\)\.includes\(char\.id\)/, "得是他真的在的群");
  assert.match(seg, /\.sort\(\(a, b\) => _gLast\(b\) - _gLast\(a\)\)\[0\] \|\| null/, "挑最近有动静的那个");
  assert.match(seg, /if \(toGroupTarget\) \{/, "没共同群就不开");
  // 公开发言，绝不能把私事带过去——这条是 knownBy 那套隐私工作的延续
  assert.match(seg, /只属于你和 " \+ uName \+ " 之间的私事、你俩的关系、TA 私下跟你说的话，一个字都不许写进去/);
});

test("toGroup 落地形状和群成员平时发言一致", () => {
  assert.match(app, /role: "assistant", senderId: char\.id, senderName: char\.name, content: gText/);
  assert.match(app, /parsed\.toGroup && String\(parsed\.toGroup\)\.toLowerCase\(\) !== "null" && toGroupTarget/,
    "没目标群时不许发");
});

test("决定沉默时不许绕道去群里发言", () => {
  const seg = app.slice(app.indexOf("if (parsed.silent === true"), app.indexOf("// 角色自行撤回一句"));
  assert.match(seg, /parsed\.toGroup = null;/, "和 momentComment 等能力一致，一并清掉");
});

test("两个字段都要写进各自的输出形状里", () => {
  assert.match(app, /const gDmField = gDmMembers\.length \? ",\\"dm\\":/);
  assert.match(app, /" \+ gDmField \+ thoughtField \+ impressionField \+ "/, "群输出形状要带上 dm");
  assert.match(app, /toGroup:string=把这句公开发到共同群里/, "单聊协议要带上 toGroup");
});
