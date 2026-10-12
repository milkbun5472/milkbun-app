const test = require("node:test"); const assert = require("node:assert");
const scr = require("fs").readFileSync(__dirname + "/../js/screens.js", "utf8");
test("Fish 那格底下有自己搭中转的说明，代码能复制、放行 model 头", () => {
  assert.match(scr, /h\(FishRelayHelp, \{ toast \}\)/);
  assert.match(scr, /"Access-Control-Allow-Headers": "authorization, content-type, model"/);
  assert.match(scr, /copyText\(FISH_RELAY_CODE\)/);
});
