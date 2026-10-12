const test = require("node:test"); const assert = require("node:assert");
const app = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
test("隔离房：action 封住不进状态，但动描那一行照样摆", () => {
  const keep = app.indexOf("let _roomActLine = parsed && parsed.action;");
  const gate = app.indexOf("if (room) {", keep);
  assert.ok(keep > 0 && gate > keep, "得在房间那道闸【之前】先留一份");
  assert.match(app, /if \(!_roomActLine && parsed\.action\) _roomActLine = parsed\.action;\s+\/\/[^\n]*\n\s+parsed\.mood = null; parsed\.action = null;/);
  assert.match(app, /const onlineActLine = onlineAction \|\| \(room && _roomActLine \?/);
  assert.match(app, /\} else if \(_actDesc && onlineActLine && String\(onlineActLine\)\.trim\(\)\) \{/);
  assert.match(app, /putLiveField\(st, _live0, "action", onlineAction, stateNow\)/);   // 状态那头照旧只认 onlineAction
});
