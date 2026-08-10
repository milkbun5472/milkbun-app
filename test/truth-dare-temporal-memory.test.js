"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../js/games.js"), "utf8");

test("真心话大冒险把整局时间原话锁成持久事实", () => {
  assert.match(source, /function tdTemporalFacts\(log\)/);
  assert.match(source, /整局锁定的时间事实（原话，禁止改写或换算）/);
  assert.match(source, /『上个月』不能改成『前天』/);
  assert.match(source, /tdTemporalFacts\(log\)/);
});

test("真心话大冒险不再只记回答前 90 字和十条插话", () => {
  assert.match(source, /it\.response \|\| ""\)\.slice\(0, 500\)/);
  assert.match(source, /slice\(-20\)/);
  assert.match(source, /rounds\.slice\(-16\)/);
});
