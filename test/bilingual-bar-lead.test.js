// 外语一条、「| 中文」另起一条：这一轮也算双语，接回上一条（她 2026-11-04）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("单聊、群聊认竖线开头的那一条", () => {
  assert.match(app, /const _barLead = w => typeof w === "string" && \/\^\\s\*\[\|｜│︱┃\]\\s\*\\S\/\.test\(w\);/);
  assert.match(app, /\(splitBilingual\(w, hanLangOf\(char\)\) \|\| \(k > 0 && _barLead\(w\)\)\)/);
  assert.match(app, /splitBilingual\(x\.trim\(\), hanLangOf\(spk\)\) \|\| \(k > 0 && \/\^\\s\*\[\|｜│︱┃\]\\s\*\\S\/\.test\(x\)\)/);
});
