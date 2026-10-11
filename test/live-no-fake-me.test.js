// 她 2026-10-11：「它还会编我说的话」——模型编了个跟她同名的常客，每拍以常客的名义替她发弹幕
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const live = fs.readFileSync(__dirname + "/../js/live.js", "utf8");

test("跟她（或马甲）同名的常客剔掉、署她名字的话不收、提示词写明", () => {
  assert.match(live, /const meNames = \[uName, ses\.meName, ses\.maskName\]/);
  assert.match(live, /\.filter\(r => r && !isMe\(r\.name\)\);/, "常客名单（老场次也算）剔掉她");
  assert.match(live, /\.filter\(x => x && x\.text && !isMe\(x\.who\)\)/, "这一拍署她名字的那句不收");
  assert.match(live, /说的话只有她自己发——flow 里一句都不替她写，常客里也没有跟她同名的人/);
});
