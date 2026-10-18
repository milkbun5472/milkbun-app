const test = require("node:test"); const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), scr = (fs.readFileSync(__dirname + "/../js/screens.js", "utf8") + "\n" + fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8"));
test("语音试听不许一声不吭：类型不对按 mp3，8 秒放不出来就说", () => {
  assert.match(eng, /return \/\^audio\\\/\/i\.test\(blob\.type \|\| ""\) \? blob : new Blob\(\[blob\], \{ type: "audio\/mpeg" \}\);/);
  assert.match(scr, /await Promise\.race\(\[aud\.play\(\), new Promise\(\(_, no\) => setTimeout\(/);
});
