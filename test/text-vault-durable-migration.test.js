"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const engine = fs.readFileSync("js/engine.js", "utf8");
const weekly = fs.readFileSync("js/weekly.js", "utf8");
const screens = fs.readFileSync("js/screens.js", "utf8");
const keys = ["x_weekly_issues", "x_study_sessions", "x_read_books", "x_debate_saves", "x_dream_saves", "x_tarot_saves", "x_ledger"];

test("七个大文本键由文字金库精确接管", () => {
  for (const key of keys) assert.match(engine, new RegExp('DURABLE_TEXT_KEYS[\\s\\S]*"' + key + '"'));
  assert.match(engine, /DURABLE_TEXT_KEYS\.has\(k\) \|\| IDB_TEXT_PREFIXES/);
});

test("旧键必须 WAL 与 IDB 双重逐字验真后才删除", () => {
  assert.match(engine, /isDurableTextKey\(k\) && !\(await walPutVerified\(k, s\)\)/);
  assert.match(engine, /back === s && \(!isDurableTextKey\(k\) \|\| \(await walGetRaw\(k\)\) === s\)/);
  assert.match(engine, /durableWalKeys = \(await walKeys\("x_"\)\)\.filter\(isDurableTextKey\)/);
  assert.match(engine, /if \(back === s && localStorage\.getItem\(k\) === s && walBack === s\)/);
  assert.match(engine, /if \(isDurableTextKey\(k\)\) walDel\(k\)/);
  assert.match(engine, /async function walDeleteDurableTextKeys/);
});

test("存储仪表盘能按名称显示七类金库文本", () => {
  for (const key of keys) assert.match(screens, new RegExp('\\["' + key + '",'));
  assert.match(screens, /文字金库/);
});

test("周刊书架最多保留 52 期", () => {
  assert.match(weekly, /const MAX_ISSUES = 52/);
  assert.match(weekly, /ordered\.slice\(Math\.max\(0, ordered\.length - MAX_ISSUES\)\)/);
});
