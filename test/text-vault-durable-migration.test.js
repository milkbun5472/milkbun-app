"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const engine = fs.readFileSync("js/engine.js", "utf8");
const weekly = fs.readFileSync("js/weekly.js", "utf8");
const screens = fs.readFileSync("js/screens.js", "utf8");
const keys = ["x_weekly_issues", "x_study_sessions", "x_read_books", "x_debate_saves", "x_dream_saves", "x_tarot_saves", "x_ledger"];
const growingKeys = ["x_phone", "x_phoneArch", "x_phoneVitals", "x_diaries", "x_schedules", "x_charWallet"];
const coupleKeys = [
  "x_couple", "x_couples", "x_coupleProfile", "x_coupleHome", "x_coupleBreakup",
  "x_coupleNotes", "x_coupleQA", "x_coupleQATitle", "x_coupleQACustom",
  "x_coupleExDiary", "x_coupleTimeline", "x_coupleAnniv", "x_coupleLetters", "x_coupleDrawer", "x_studio", "x_myCloset",
  "x_coupleLetterCfg", "x_coupleSweet"
];

test("七个大文本键由文字金库精确接管", () => {
  for (const key of keys) assert.match(engine, new RegExp('DURABLE_TEXT_KEYS[\\s\\S]*"' + key + '"'));
  assert.match(engine, /DURABLE_TEXT_KEYS\.has\(k\) \|\| IDB_TEXT_PREFIXES/);
});

test("会持续长大的查手机、日记、日程、钱包与情侣空间正文也由文字金库接管", () => {
  for (const key of [...growingKeys, ...coupleKeys]) {
    assert.match(engine, new RegExp('DURABLE_TEXT_KEYS[\\s\\S]*"' + key + '"'));
  }
  // 这个 UI 小状态仍由 screens.js 直接读写 localStorage，不能被前缀误搬走。
  assert.doesNotMatch(engine.match(/const DURABLE_TEXT_KEYS[\s\S]*?\]\);/)[0], /x_coupleNoteSeen/);
});

test("旧键必须 WAL 与 IDB 双重逐字验真后才删除", () => {
  assert.match(engine, /isDurableTextKey\(k\) && !\(await walPutVerified\(k, s\)\)/);
  assert.match(engine, /back === s && \(!isDurableTextKey\(k\) \|\| \(await walGetRaw\(k\)\) === s\)/);
  assert.match(engine, /durableWalKeys = \(await walKeys\("x_"\)\)\.filter\(isDurableTextKey\)/);
  assert.match(engine, /if \(back === s && \(!needsLocalJournal \|\| localStorage\.getItem\(k\) === s\) && walBack === s\)/);
  assert.match(engine, /if \(isDurableTextKey\(k\)\) walDel\(k\)/);
  assert.match(engine, /async function walDeleteDurableTextKeys/);
});

test("超大单群聊天由 IDB 与 WAL 接管，不再要求塞回 localStorage", () => {
  assert.match(engine, /k\.indexOf\("x_chat:"\) === 0/);
  assert.match(engine, /k\.indexOf\("x_gchat:"\) === 0/);
  assert.match(engine, /function durableTextNeedsLocalJournal\(k\)/);
  assert.match(engine, /return k\.indexOf\("x_chat:"\) !== 0 && k\.indexOf\("x_gchat:"\) !== 0/);
});

test("存储仪表盘能按名称显示七类金库文本", () => {
  for (const key of keys) assert.match(screens, new RegExp('\\["' + key + '",'));
  assert.match(screens, /文字金库/);
});

test("存储仪表盘把新迁移项显示成人话名称", () => {
  assert.match(screens, /\["x_phone", "查手机"\]/);
  assert.match(screens, /\["x_charWallet", "角色钱包"\]/);
  assert.match(screens, /\["x_diaries", "日记"\]/);
  assert.match(screens, /\["x_schedules", "角色日程"\]/);
  assert.match(screens, /\["x_couple", "情侣空间"\]/);
});

test("周刊书架最多保留 52 期", () => {
  assert.match(weekly, /const MAX_ISSUES = 52/);
  assert.match(weekly, /ordered\.slice\(Math\.max\(0, ordered\.length - MAX_ISSUES\)\)/);
});
