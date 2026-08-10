"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../js/games.js"), "utf8");

test("狼刀规则层和用户列表都排除狼队友", () => {
  assert.match(source, /p\.alive && !isWolfRole\(p\.role\)/);
  assert.match(source, /!p\.isUser && !isWolfRole\(p\.role\)/);
});

test("预言家不会重复验人且 AI 非法目标有规则兜底", () => {
  assert.match(source, /已经验过的人不会重复出现/);
  assert.match(source, /无可查验 · 直接天亮/);
  assert.match(source, /knownNames\.has\(p\.name\)/);
  assert.match(source, /AI 预言家若返回自己、死人、已验过的人/);
});

test("平票不再随机放逐且跨阶段使用同步日志和昨夜结果", () => {
  assert.match(source, /平票，本轮无人被放逐/);
  assert.match(source, /const outName = tied\.length === 1 \? tied\[0\] : null/);
  assert.match(source, /const logDataRef = useRef/);
  assert.match(source, /lastDeathRef\.current/);
  assert.match(source, /logDataRef\.current\.filter/);
});
