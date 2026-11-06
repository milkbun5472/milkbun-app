import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const eng = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
test("发给模型看的 GIF 先换成第一帧 PNG（callAI 入口一处）", () => {
  const i = eng.indexOf("async function callAI(p, system, messages, opts) {"), body = eng.slice(i, i + 12000);
  assert.ok(body.includes("? gifFirstFramePng(u) : u"));
  assert.match(eng, /async function gifFirstFramePng\(dataUrl\)/);
});
