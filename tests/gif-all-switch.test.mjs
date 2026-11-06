import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const r = f => readFileSync(new URL("../js/" + f, import.meta.url), "utf8");
const eng = r("engine.js"), app = r("app.js"), ui = r("screens-ui.js");
test("总开关只在出图入口一处：开着就按动图请求，标了 still 的不跟，聊天接口那几种不跟", () => {
  assert.match(eng, /if \(a0\.gifAll && !\(opts && \(opts\.gif \|\| opts\.still\)\) && !\["chat", "gemini", "minimax", "nai"\]\.includes\(a0\.apiFormat\)\)/);
  assert.match(eng, /gifAll: false, noRef: false \}/);
});
test("要裁要拼的那几处标了 still", () => {
  assert.match(app, /draft\.refPhoto \? \[draft\.refPhoto\] : null, \{ size: "1024x1024", still: true \}/);   // 头像
  assert.equal((app.match(/minimalPrompt: prompt, still: true \}, setOpt/g) || []).length, 2);              // 表情包九宫格
  assert.match(r("video-api.js"), /still: true \}\);/);
});
test("设置·图像API 里有这个开关", () => { assert.match(ui, /set\(\{ gifAll: !c\.gifAll \}\)/); });
