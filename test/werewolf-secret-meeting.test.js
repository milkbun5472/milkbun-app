"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../js/games.js"), "utf8");

test("AI 狼刀口分歧时进行一次秘密协商而非随机", () => {
  assert.match(source, /async function genWolfConsensus/);
  assert.match(source, /distinct\.length > 1/);
  assert.match(source, /一轮短协商/);
  assert.match(source, /consensusTarget \|\| tallyKill/);
  assert.match(source, /consensusSkip \? null/);
  assert.match(source, /const pick = tied\.length === 1 \? tied\[0\] : null/);
});

test("真人狼能看到队友建议并最终拍板", () => {
  assert.match(source, /🐺 狼队秘密会议/);
  assert.match(source, /队友先报刀口和理由，最后由你拍板/);
  assert.match(source, /由真人狼最终拍板/);
  assert.match(source, /const finalKill = validWolfTarget\(name, info\.list\)/);
});

test("秘密协商内容不写入公开日志", () => {
  assert.match(source, /内容绝不进入公开牌局日志/);
  assert.doesNotMatch(source, /pushLog\([^\n]*wolfChat/);
});
