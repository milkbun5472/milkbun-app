const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(require.resolve("../js/engine.js"), "utf8");
// v72.85：认人先过 memberLabel（重名才有标签），所以从它那儿开始切
const start = source.indexOf("function memberLabel(members, c) {");
const end = source.indexOf("// ctx: { members", start);
const box = {};
vm.runInNewContext(source.slice(start, end) + ";this.api={offlineGroupSpeaker,offlineGroupBeatList,salvageOfflineGroupProse,memberLabel,pickMember};", box);
const { offlineGroupSpeaker, offlineGroupBeatList, salvageOfflineGroupProse } = box.api;
const members = [{ id: "a", name: "顾朝" }, { id: "b", name: "顾暮" }];

// 同名两位（她 2026-09-22：「同名的头像会被第一个人覆盖」）：按标签认得出是第二个
test("重名的两位分得开", () => {
  const twins = [{ id: "a", name: "顾朝", remark: "哥" }, { id: "b", name: "顾朝" }];
  assert.equal(offlineGroupSpeaker(twins, "顾朝（哥）", "他先开口。").id, "a");
  assert.equal(offlineGroupSpeaker(twins, "【顾朝（第2个）】", "他跟着点头。").id, "b");
});

test("角色名带括号或装饰仍归回角色卡", () => {
  assert.equal(offlineGroupSpeaker(members, "【顾暮】（有点恼）", "他把杯子放下。").id, "b");
});

test("beats 的常见外壳都能读取", () => {
  assert.equal(offlineGroupBeatList({ output: { beats: [{ name: "顾朝", scene: "嗯。" }] } }).length, 1);
  assert.equal(offlineGroupBeatList({ beats: { one: { name: "顾暮", scene: "走吧。" } } }).length, 1);
});

test("坏格式按角色标题拆卡，不再整篇吞成旁白", () => {
  const rows = salvageOfflineGroupProse("顾朝：他拉开门。\n\n顾暮：\"等等我。\"", members);
  assert.equal(rows.length, 2);
  assert.deepEqual(Array.from(rows, x => x.name), ["顾朝", "顾暮"]);
});
