const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(require.resolve("../js/engine.js"), "utf8");
const start = source.indexOf("function offlineGroupSpeaker");
const end = source.indexOf("// ctx: { members", start);
const box = {};
vm.runInNewContext(source.slice(start, end) + ";this.api={offlineGroupSpeaker,offlineGroupBeatList,salvageOfflineGroupProse};", box);
const { offlineGroupSpeaker, offlineGroupBeatList, salvageOfflineGroupProse } = box.api;
const members = [{ id: "a", name: "顾朝" }, { id: "b", name: "顾暮" }];

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
