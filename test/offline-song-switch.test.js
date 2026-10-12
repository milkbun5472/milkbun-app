const test = require("node:test"); const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
test("线下切歌：给 listenOn、读回 songSwitch、走同一个 taSwitchSong", () => {
  assert.match(app, /const taSwitchSong = async songSwitch =>/);
  assert.match(app, /parsed\.songSwitch[^\n]*await taSwitchSong\(parsed\.songSwitch\)/);
  assert.match(app, /listenOn: _offListenOn/);
  assert.match(app, /if \(res\.songSwitch\) taSwitchSong\(res\.songSwitch\)/);
  assert.match(eng, /session\.listenOn\) \? "\\n【songSwitch 格式】/);
  assert.match(eng, /songSwitch: \(session\.listenOn && parsed\.songSwitch/);
});
