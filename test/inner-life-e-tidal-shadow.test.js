"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const Core = require("../js/inner-life-e-tidal-core.js");

function runtime() {
  let row = null;
  const window = {
    InnerLifeETidalCore: Core,
    InnerLifeEAfterglowShadow: {
      getTidalState: async () => row,
      putTidalState: async (_owner, next) => (row = { ...next })
    },
    Cloud: { getUser: async () => ({ id: "test-owner" }) }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("../js/inner-life-e-tidal-shadow.js"), "utf8"), { window, Promise, Date });
  return window.InnerLifeETidalShadow;
}

test("消息按队列落状态：睡眠信号保留睡眠，普通下一句才醒", async () => {
  const shadow = runtime();
  await shadow.onUserMessage("晚安，我睡了", 1000);
  assert.equal((await shadow.status()).state, "maybe_sleeping");
  await shadow.onSessionOpenNoMessage(1001);
  assert.equal((await shadow.status()).state, "maybe_sleeping");
  await shadow.onUserMessage("我回来啦", 1002);
  assert.equal((await shadow.status()).state, "awake");
});

test("快速连续消息串行处理，不让旧异步写覆盖新状态", async () => {
  const shadow = runtime();
  const sleeping = shadow.onUserMessage("晚安", 2000);
  const awake = shadow.onUserMessage("等等，我还要说一句", 2001);
  await Promise.all([sleeping, awake]);
  assert.equal((await shadow.status()).state, "awake");
});

test("回前台只推进超时，不会把 uncertain 判醒", async () => {
  const shadow = runtime();
  await shadow.onUserMessage("睡一会儿", 3000);
  await shadow.onForegroundNoMessage(3000 + Core.SLEEP_WINDOW_MS + 1);
  assert.equal((await shadow.status()).state, "uncertain");
  await shadow.onForegroundNoMessage(3000 + Core.SLEEP_WINDOW_MS + 2);
  assert.equal((await shadow.status()).state, "uncertain");
});
