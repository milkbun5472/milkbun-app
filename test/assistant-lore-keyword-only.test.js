// 她 2026-10-10 截图：叫秋秋把 4 条常驻世界书改成关键词触发，它两次都说「卡在下面，快点应用」，底下一张卡都没有。
//   只改关键词的那种 patch 正文不动、text 空着，原来的筛子只认有正文的，整批丢掉。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const src = fs.readFileSync("js/assistant.js", "utf8");

function load(out) {
  const start = src.indexOf("(function () {\n  const useState = React.useState;");
  const end = src.indexOf("// ============================================================\n// 界面：");
  assert.ok(start >= 0 && end > start, "抠不出 Assistant");
  const sandbox = { console, React: { useState: () => [] }, h: () => null, Svg: null,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, loadJSON: (_k, f) => f,
    callAI: async () => JSON.stringify(out), parseJSONLoose: s => JSON.parse(s), extractJSON: s => JSON.parse(s) };
  sandbox.window = sandbox;
  vm.runInNewContext(src.slice(start, end), sandbox);
  return sandbox.Assistant;
}

test("只改关键词的世界书改动稿照样出卡，应用后正文一个字不动", async () => {
  const A = load({ reply: "卡在下面", patches: [
    { target: "lore", id: "le1", keyword: "下雨,伞", always: false },
    { target: "lore", id: "le2", keyword: "猫" }] });
  let saved = null;
  const lore = [{ id: "le1", title: "雨", payload: "原来的正文一", keyword: "", alwaysOn: true }, { id: "le2", title: "猫", payload: "原来的正文二", keyword: "", alwaysOn: true }];
  const ctx = { characters: [], profile: {}, loreList: () => lore, onSaveLore: l => { saved = l; } };
  const r = await A.ask({}, ctx, [], "把常驻改成关键词");
  assert.equal(r.patches.length, 2, "两张卡都该在");
  A.apply(r.patches[0], ctx);
  const e = saved.find(x => x.id === "le1");
  assert.equal(e.payload, "原来的正文一", "正文不许被清空");
  assert.equal(e.keyword, "下雨,伞");
  assert.equal(e.alwaysOn, false);
});

test("它说有卡、一张都没留下：回话里照实说", async () => {
  const A = load({ reply: "卡在下面", patches: [{ target: "lore", id: "le1" }] });
  const r = await A.ask({}, { characters: [], profile: {}, loreList: () => [] }, [], "改一下");
  assert.equal(r.patches.length, 0);
  assert.match(r.reply, /格式不对，没能做成卡片/);
});
