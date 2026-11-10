import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
test("单聊重拍不拿被重拍的那张当连贯参考（线下那边本来就排除了）", () => {
  assert.match(app, /m\.kind === "selfie" && m\.imgKey && m\.sid !== sid && \(Date\.now\(\)/);
  assert.match(app, /m\.kind === "selfie" && m\.imgKey && m\.sid !== sid\n/);
});
