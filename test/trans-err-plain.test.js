const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("翻译失败只说人话，不摊引擎报错", () => {
  assert.ok(!c.includes('"翻译失败：" + err'));
  assert.equal((c.match(/transErrZh\(err\)/g) || []).length, 3);
  const f = new Function(c.slice(c.indexOf("function transErrZh"), c.indexOf("// 语音消息（v60.17")) + ";return transErrZh;")();
  assert.match(f("都没翻成 · Google：翻出来的不是中文：I went"), /没把这段翻成中文/);
  assert.match(f("微软：取票 HTTP 404"), /网不好/);
});
