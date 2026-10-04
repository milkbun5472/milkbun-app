// 她 2026-10-05：「反正你不能剥夺小狗每天摇尾巴的权利 ㄑ ˃ ㅅ ˂ ɔ」被挂了「译自韩文」——单个谚文字母是拼颜文字的
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
const f = new Function(src.slice(src.indexOf("function _transStrip("), src.indexOf("// iOS 刘海（v56.63）")) + ";return translatableLang;")();
test("单个谚文字母不算韩文，成字的音节才算", () => {
  assert.equal(f("反正你不能剥夺小狗每天摇尾巴的权利 ㄑ ˃ ㅅ ˂ ɔ"), "");
  assert.equal(f("ㅠㅠ 好难过"), "");
  assert.equal(f("사랑해"), "韩文");
  assert.equal(f("今夜も残業"), "日文");
});
