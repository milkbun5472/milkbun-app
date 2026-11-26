// 2026-11-26 群友截图：失败提示里弹出了一整段提示词原文（「其他·【以下叙事准则适用于一切连续…」）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
test("失败提示不露提示词；邮票册的调用有自己的名字", () => {
  assert.match(ap, /key = \(\/\^其他·\/\.test\(_lb\) \? "这一次生成" : _lb\)/);
  assert.match(en, /replace\(\/【\[\^】\]\*】\/g, ""\)/);
  assert.equal((ap.match(/logFrom: "邮票册·写剧情", instruction: STAMP_CORE\(\)/g) || []).length, 5);
});
