const test = require("node:test"); const assert = require("node:assert");
const scr = (require("fs").readFileSync(__dirname + "/../js/screens.js", "utf8") + "\n" + require("fs").readFileSync(__dirname + "/../js/screens-ui.js", "utf8"));
test("Fish 那格底下有自己搭中转的说明，代码能复制、放行 model 头", () => {
  assert.match(scr, /h\(FishRelayHelp, \{ toast \}\)/);
  assert.match(scr, /"Access-Control-Allow-Headers": "authorization, content-type, model"/);
  // 2026-10-15 起转发代码是公共的 relayCodeFor(上游)（MiniMax 视频也用），复制的是按所选站点生成的那段
  assert.match(scr, /copyText\(code\)/);
  assert.match(scr, /const FISH_RELAY_CODE = relayCodeFor\("https:\/\/api\.fish\.audio"\)/);
});
