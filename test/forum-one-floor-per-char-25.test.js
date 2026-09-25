const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");

// 把公共那一段抠出来单独跑
const i = app.indexOf("  const dropRepeatCharFloors = (existing, floors) => {");
const j = app.indexOf("  const forumRepliedCharCells = ", i);
assert.ok(i > 0 && j > i, "抠不出 dropRepeatCharFloors");
const drop = new Function(app.slice(i, j) + "\nreturn dropRepeatCharFloors;")();

// 桩照写入方 buildForumFloor：角色楼 authorType 以 character 开头、authorId=角色 id；路人 authorType:"npc"
const pei = n => ({ id: "fc_" + n, authorId: "c_pei", authorType: "character", authorName: "裴照川", content: "三十万？" + n, replies: [] });
const npc = n => ({ id: "fc_n" + n, authorId: "npc_" + n, authorType: "npc", authorName: "路人" + n, content: "笑死", replies: [] });

test("buildForumFloor 写的字段还是 authorId / authorType", () => {
  assert.match(app, /authorId: cc \? cc\.id : npc\.id,\n\s*authorType: cc \? identity\.authorType : "npc",/);
});

test("帖里已经有他一层：新批次里他的顶楼全丢，路人照留", () => {
  const out = drop([pei(1)], [pei(2), npc(1), pei(3), npc(2)]);
  assert.deepEqual(out.map(f => f.id), ["fc_n1", "fc_n2"]);
});

test("同一批里他出现两次：只留第一层", () => {
  const out = drop([], [pei(1), npc(1), pei(2)]);
  assert.deepEqual(out.map(f => f.id), ["fc_1", "fc_n1"]);
});

test("三处出楼都过这道闸", () => {
  assert.equal((app.match(/dropRepeatCharFloors\((\[\]|existing), /g) || []).length, 3);
});
