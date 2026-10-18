const test = require("node:test"); const assert = require("node:assert");
const src = (require("fs").readFileSync(__dirname + "/../js/screens.js", "utf8") + "\n" + require("fs").readFileSync(__dirname + "/../js/screens-ui.js", "utf8"));
test("图像站测试：尺寸和等待跟聊天拍照一样，不另写死", () => {
  const m = src.match(/const out = await generateSelfieImage\(prompt, testRef, \{([^\n]*)/);
  assert.ok(m);
  assert.doesNotMatch(m[1], /size:|attemptMs|budgetMs/);
});
