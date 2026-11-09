import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../js/components.js", import.meta.url), "utf8");
test("通话连播：一句合成失败只跳过这一句，不关掉连播", () => {
  const i = src.indexOf("念原文、不念译文（群友 2026-11-04");
  const body = src.slice(i, i + 6000);
  assert.match(body, /skipped = "有一句没合成出来/);
  assert.match(body, /continue;\n\s*\}/);
  assert.match(body, /if \(dead\) \{[^}]*audioRef\.current\.enabled = false[^}]*break; \}/);
});
