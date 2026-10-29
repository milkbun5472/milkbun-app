import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Policy = require("../js/auto-refresh-policy.js");

test("upgrade defaults enable the audited automatic features", () => {
  const p = Policy.normalize(null);
  assert.equal(Policy.enabled(p, "diary", "c1"), true);
  assert.equal(Policy.enabled(p, "wallet", "c1"), true);
  assert.equal(Policy.enabled(p, "weekly", "c1"), true);
  // 查手机和主动私聊是「每人自己开」的两样：全局开着，但新角色默认不开。
  // 主动私聊原来在聊天设置里另存一份、默认关，并进这一份时照旧默认关（见 auto-refresh-policy.js 的说明）。
  assert.equal(Policy.enabled(p, "phone", "c1"), false);
  assert.equal(Policy.enabled(p, "proactive", "c1"), false);
});

test("legacy phone character choices migrate into the unified policy", () => {
  const p = Policy.normalize(null, { a: true, b: false });
  assert.equal(Policy.enabled(p, "phone", "a"), true);
  assert.equal(Policy.enabled(p, "phone", "b"), false);
  assert.equal(Policy.enabled(p, "phone", "c"), false);
});

test("v1 weekly pause migrates to the newly approved automatic default", () => {
  const p = Policy.normalize({ version: 1, features: { weekly: { global: false, chars: {} } } });
  assert.equal(Policy.enabled(p, "weekly", "c1"), true);
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
  // ⚠️这里只钉「这几样一个都不许消失」，不钉整张名单：
  //   名单是会长的（当初 11 项，现在二十来项），钉死它只会在加新功能那天红一次、
  //   被人顺手改掉，拦不住真正要拦的事——某一样被悄悄摘掉。
  const ids = Policy.FEATURES.map(x => x.id);
  ["phone", "weekly", "diary", "wallet", "schedule", "desire",
    "moments", "forum", "whisper", "capsule", "proactive"
  ].forEach(id => assert.ok(ids.includes(id), "名单里少了这一样：" + id));
  assert.equal(new Set(ids).size, ids.length, "名单里有重复的 id");
  Policy.FEATURES.forEach(f => {
    assert.ok(f.title, f.id + " 没有标题，设置页里会是一行空的");
    assert.ok(f.group === "content" || f.group === "social", f.id + " 的分组不认识：" + f.group);
  });
});
