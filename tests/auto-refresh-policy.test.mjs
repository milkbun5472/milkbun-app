import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Policy = require("../js/auto-refresh-policy.js");

test("upgrade defaults preserve existing automatic behavior without surprising weekly calls", () => {
  const p = Policy.normalize(null);
  assert.equal(Policy.enabled(p, "diary", "c1"), true);
  assert.equal(Policy.enabled(p, "wallet", "c1"), true);
  assert.equal(Policy.enabled(p, "proactive", "c1"), true);
  assert.equal(Policy.enabled(p, "weekly", "c1"), false);
  assert.equal(Policy.enabled(p, "phone", "c1"), false);
});

test("legacy phone character choices migrate into the unified policy", () => {
  const p = Policy.normalize(null, { a: true, b: false });
  assert.equal(Policy.enabled(p, "phone", "a"), true);
  assert.equal(Policy.enabled(p, "phone", "b"), false);
  assert.equal(Policy.enabled(p, "phone", "c"), false);
});

test("global pause keeps per-character choices for later restore", () => {
  let p = Policy.normalize(null);
  p = Policy.setChar(p, "diary", "a", true);
  p = Policy.setChar(p, "diary", "b", false);
  p = Policy.setGlobal(p, "diary", false);
  assert.equal(Policy.enabled(p, "diary", "a"), false);
  assert.equal(Policy.enabled(p, "diary", "b"), false);
  p = Policy.setGlobal(p, "diary", true);
  assert.equal(Policy.enabled(p, "diary", "a"), true);
  assert.equal(Policy.enabled(p, "diary", "b"), false);
});

test("one character switch never changes another character", () => {
  let p = Policy.normalize(null);
  p = Policy.setChar(p, "forum", "a", false);
  assert.equal(Policy.enabled(p, "forum", "a"), false);
  assert.equal(Policy.enabled(p, "forum", "b"), true);
});

test("catalog includes every audited user-facing automatic feature", () => {
  assert.deepEqual(Policy.FEATURES.map(x => x.id), [
    "phone", "weekly", "diary", "wallet", "schedule", "desire",
    "moments", "forum", "whisper", "capsule", "proactive"
  ]);
});
