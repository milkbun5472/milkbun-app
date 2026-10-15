// 文风台导入酒馆预设 json（群友 2026-10-16：「导入失败：这是个 json，但里面没有 modules／presets」）
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js/style-presets.js"), "utf8");
const i = src.indexOf("  function fromTavern("), j = src.indexOf("\n  }\n", i);
const fromTavern = new Function("return " + src.slice(i, j + 4).trim())();
test("按 prompt_order 排、跳过 marker 和空的、关着的不勾", () => {
  const d = { prompts: [
    { identifier: "main", name: "Main Prompt", content: "写得像人" },
    { identifier: "chatHistory", name: "Chat History", marker: true },
    { identifier: "x1", name: "去八股", content: "别用套话" },
    { identifier: "x2", name: "长度", content: "写长" },
    { identifier: "x3", name: "空的", content: "" }],
    prompt_order: [{ character_id: 100001, order: [{ identifier: "x1", enabled: true }, { identifier: "main", enabled: true }, { identifier: "chatHistory", enabled: true }, { identifier: "x2", enabled: false }, { identifier: "x3", enabled: true }] }] };
  const r = fromTavern(d, "某某预设");
  assert.deepEqual(r.modules.map(m => m.name), ["去八股", "Main Prompt", "长度"]);
  assert.equal(r.presets[0].mods.length, 2);
  assert.equal(r.presets[0].name, "某某预设");
  assert.equal(fromTavern({ foo: 1 }), null);
});
