// 她 2026-09-22 转来群里读者：「同名的头像会被第一个人覆盖」。
//
// 病根：模型手上只有名字。两个成员同名时它没法指名道姓，而落地这头一律
// find(c => c.name === 模型给的名字) —— 找到的永远是【第一个】。
// 于是第二个人说的那句话，senderId 落成第一个人的 id：头像、心情、好感全记错人。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

function loadHelpers() {
  const i = eng.indexOf("function memberLabel(members, c) {"), j = eng.indexOf("function offlineGroupSpeaker(", i);
  assert.ok(i > 0 && j > i, "抠不出同名那两支");
  const ctx = { String: String, Set: Set };
  vm.runInNewContext(eng.slice(i, j) + "\nthis.memberLabel = memberLabel; this.pickMember = pickMember; this.sameNameNote = sameNameNote;", ctx);
  return ctx;
}

test("没重名的群一个字都不变", () => {
  const { memberLabel } = loadHelpers();
  const ms = [{ id: "a", name: "沈屿白" }, { id: "b", name: "陆闻" }];
  assert.equal(memberLabel(ms, ms[0]), "沈屿白");
  assert.equal(memberLabel(ms, ms[1]), "陆闻");
});

test("重名时给的标签认得出是谁：有备注用备注，没有就排号", () => {
  const { memberLabel } = loadHelpers();
  const ms = [{ id: "a", name: "沈屿白", remark: "哥哥" }, { id: "b", name: "沈屿白" }, { id: "c", name: "陆闻" }];
  assert.equal(memberLabel(ms, ms[0]), "沈屿白（哥哥）");
  assert.equal(memberLabel(ms, ms[1]), "沈屿白（第2个）");
  assert.equal(memberLabel(ms, ms[2]), "陆闻", "没重名的那个不该被连累");
  // 备注跟名字一样就没有分辨力，排号
  const same = [{ id: "a", name: "阿衍", remark: "阿衍" }, { id: "b", name: "阿衍" }];
  assert.equal(memberLabel(same, same[0]), "阿衍（第1个）");
});

test("按标签找人：第二个人的话落在第二个人身上", () => {
  const { pickMember } = loadHelpers();
  const ms = [{ id: "a", name: "沈屿白", remark: "哥哥" }, { id: "b", name: "沈屿白" }];
  assert.equal(pickMember(ms, "沈屿白（哥哥）").id, "a");
  assert.equal(pickMember(ms, "沈屿白（第2个）").id, "b", "又落到第一个人头上了");
  // 模型偷懒只回了个名字：退回老路（第一个），但至少不炸
  assert.equal(pickMember(ms, "沈屿白").id, "a");
  assert.equal(pickMember(ms, "查无此人"), null);
  assert.equal(pickMember(ms, ""), null);
});

test("四处认人都走这一份，没人再自己 find(name)", () => {
  ["members.find(c => c.name ===", "people.find(c => c.name ===", "members.find(m => m.name ==="].forEach(pat =>
    assert.ok(!app.includes(pat), "还有人自己按名字找成员：" + pat));
  // 群线上、投票、群通话、代付：四处都换成了公共那一支
  assert.ok((app.match(/pickMember\(/g) || []).length >= 5, "有路子没搬过来");
});

test("名单那头也得给标签，不然模型根本说不出第二个人是谁", () => {
  // 群线下：输出规格里那份名单 + 格式修复器那份
  assert.match(eng, /members\.map\(c => "『" \+ memberLabel\(members, c\) \+ "』"\)/);
  assert.match(eng, /角色名只能逐字选自：" \+ members\.map\(c => memberLabel\(members, c\)\)/);
  // 三处人设抬头（群线下、群线上、群通话）
  assert.ok((eng.match(/"【" \+ memberLabel\(members, c\) \+ "】"/g) || []).length >= 2, "群线下人设抬头没给标签");
  assert.ok((app.match(/"【" \+ memberLabel\((members|people), c\) \+ "】"/g) || []).length >= 4, "群线上／投票／群通话的人设抬头没给标签");
  assert.doesNotMatch(app, /"【" \+ c\.name \+ "】" \+ groupPersonaText/, "还有一处抬头在用光秃秃的名字");
});

// 群线下走的是自己那支认人（要兼容「旁白」、括号、错字），标签得排在最前面
test("群线下认人先按标签，再走原来那条模糊匹配", () => {
  const i = eng.indexOf("function offlineGroupSpeaker("), j = eng.indexOf("function offlineGroupBeatList(", i);
  const fn = eng.slice(i, j);
  assert.ok(i > 0 && j > i, "抠不出 offlineGroupSpeaker");
  const a = fn.indexOf("compact(memberLabel(members, c)) === wanted");
  const b = fn.indexOf("compact(c.name) === wanted");
  assert.ok(a > 0 && b > a, "标签那一步没排在按名字之前 —— 重名时照样认第一个");
  assert.match(fn, /旁白\|narration/, "旁白那一支被改没了");
});

// 她 2026-09-22 追问：「就是两个沈屿白没有括号也能分吗」——分不出来。
// 标签只是给了它一个能指名道姓的词；不当面说「必须写全」，它照样只写名字。
test("重名时当面告诉模型：必须连括号一起写", () => {
  const { sameNameNote } = loadHelpers();
  assert.equal(sameNameNote([{ id: "a", name: "甲" }, { id: "b", name: "乙" }]), "", "没重名还啰嗦一句");
  assert.equal(sameNameNote([]), "");
  const n = sameNameNote([{ id: "a", name: "沈屿白", remark: "哥哥" }, { id: "b", name: "沈屿白" }, { id: "c", name: "陆闻" }]);
  assert.match(n, /「沈屿白」有 2 位/);
  assert.match(n, /必须连括号里那一段一起逐字写全/);
  assert.match(n, /「沈屿白（哥哥）」、「沈屿白（第2个）」/);
  assert.doesNotMatch(n, /陆闻/, "没重名的人也被点了名");
  assert.match(n, /记到另一个人头上/, "没说清只写名字会出什么事");
});

test("五处群里的名单后面都跟着那句提醒", () => {
  // 群线下（engine）＋ 群线上／投票／群通话／代付（app）
  assert.match(eng, /旁白 beat。" \+ sameNameNote\(members\)/, "群线下没接");
  assert.equal((app.match(/sameNameNote\(/g) || []).length, 4, "app 那四处有漏的");
  assert.match(app, /memberDesc \+ sameNameNote\(members\)/, "群线上／投票没接");
  assert.match(app, /memberDesc \+ sameNameNote\(people\)/, "群通话没接");
  assert.match(app, /roster \+ "。" \+ sameNameNote\(members\)/, "代付没接");
});
