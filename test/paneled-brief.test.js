const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
// 她 2026-10-16 截图：照片日记三格胶片只出了一张——聊天/Gemini 出图那句「ONE single photograph, not a collage, grid」把版式盖了
test("要好几格的图，聊天和 Gemini 出图那句开头不再写死「一张单图、不许拼格」", () => {
  const n = (eng.match(/\/【版式\|九宫格\|四宫格\|四格\|三格\|胶片条\/\.test\(promptText\)/g) || []).length;
  assert.equal(n, 2, "聊天接口和 Gemini 原生两处都要认格子");
  assert.match(eng, /follows the panel layout described in the brief/);
  assert.match(eng, /leave collage and multiple views out of the negative/, "NAI 那份负面词还在杀格子");
});
