const test = require("node:test"); const assert = require("node:assert");
const src = (require("fs").readFileSync(__dirname + "/../js/screens.js", "utf8") + "\n" + require("fs").readFileSync(__dirname + "/../js/screens-ui.js", "utf8"));
test("Fish、ElevenLabs 模型都能自己填，不是写死的下拉", () => {
  assert.match(src, /voiceModelInput\(c\.fishModel, "s1", "fish-models"/);
  assert.match(src, /voiceModelInput\(c\.elModel, "eleven_multilingual_v2", "el-models"/);
  assert.doesNotMatch(src, /h\("select", \{ value: c\.(elModel|fishModel)/);
});
