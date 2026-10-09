// 跑团剧本导入(群友 2026-10-09):docx/txt 拆成几栏、每栏能改;主角池开团随机抽,事件池给剧情骰抽
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const T = require("../js/trpg.js");
const src = fs.readFileSync(path.join(__dirname, "../js/trpg.js"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "../js/screens.js"), "utf8");
// 分节那把刀从 screens.js 原样取出来跑(角色卡导入和剧本导入共用这一份)
const ctx = {};
vm.createContext(ctx);
vm.runInContext(screens.slice(screens.indexOf("const CARD_SEC_RE"), screens.indexOf("const CARD_SEC_KWS")) + screens.slice(screens.indexOf("function splitDocSections("), screens.indexOf("function parseCharCard(")) + ";this.split = splitDocSections;", ctx);

test("一篇分好节的剧本拆成各栏,主角池/事件池一行一条", () => {
  const doc = "# 雾港\n## 世界\n港口城邦。\n## 势力\n三家商会。\n## 人物\n船长。\n## 主线\n1. 第一步\n2. 第二步\n3. 第三步\n## 主角池\n- 甲\n- 乙\n  接着写乙\n- 丙\n## 随机事件\n1. 事一\n2. 事二\n## 真相\n底。";
  const p = T.parseTrpgScript(doc, ctx.split);
  assert.deepStrictEqual(p.stages, ["第一步", "第二步", "第三步"]);
  assert.deepStrictEqual(p.heroes, ["甲", "乙 接着写乙", "丙"]);
  assert.deepStrictEqual(p.events, ["事一", "事二"]);
  assert.strictEqual(p.truth, "底。");
  assert.match(p.world, /港口城邦/);
  assert.match(p.world, /三家商会/);
  assert.match(p.world, /【人物】\n船长/, "认不出的节要并进世界,不能丢");
  assert.strictEqual(p.title, "雾港");
  assert.doesNotMatch(p.world, /【雾港】/);
});

test("完全没分节的整篇当世界", () => {
  const p = T.parseTrpgScript("就一段话的世界观。", ctx.split);
  assert.strictEqual(p.world, "就一段话的世界观。");
  assert.deepStrictEqual(p.heroes, []);
});

test("没有编号时按空行拆", () => {
  assert.deepStrictEqual(T.scriptList("甲的一段\n还是甲\n\n乙的一段"), ["甲的一段 还是甲", "乙的一段"]);
});

test("主角由程序随机抽,写进守密人提示词", () => {
  assert.match(src, /const hero = script && script\.heroes\.length \? pick\(script\.heroes\)/);
  assert.match(src, /c\.hero \? "\\n【" \+ uName \+ " 这一局扮演的主角】"/);
});

test("剧情骰先从事件池抽,抽过的记 used", () => {
  assert.match(src, /const evLeft = dice \? \(camp\.eventPool \|\| \[\]\)\.filter\(e => !e\.used\)/);
  assert.match(src, /scriptEv \? "\\n〔剧情骰·剧本事件〕/);
});

test("剧本页是整页,读文件走共用的 readOfflineStyleDocument,模组导出带上两个池", () => {
  assert.match(src, /if \(view === "script"\) \{/);
  assert.match(src, /readOfflineStyleDocument\(file\)/);
  assert.match(src, /heroes: \(camp\.heroes \|\| \[\]\)\.slice\(\), events: \(camp\.eventPool/);
});
