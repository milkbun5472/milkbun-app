const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("小房间的状态卡摆这间房自己的动作、穿着", () => {
  const i = app.indexOf("React.createElement(StateCard, {"), seg = app.slice(i, i + 4000);
  assert.match(seg, /hideWearAction: false,/);
  assert.match(seg, /state: roomCard \? \(roomStates\[stateCardRoomKey\] \|\| null\)/);
  assert.match(app, /for \(const key of \["action", "wearing", "place"\]\)/, "setRoomThought 记着本房那一份");
});
