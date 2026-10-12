const test = require("node:test"); const assert = require("node:assert");
const fs = require("fs");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("我的钱包「记一笔」：带备注进流水，自成一类", () => {
  assert.match(scr, /function MyWallet\(\{[^}]*onAddEntry/);
  assert.match(scr, /onAddEntry\(entry\.out \? -Math\.abs\(v\) : Math\.abs\(v\), note\)/);
  assert.match(scr, /\["entry", "随手记的"\]/);
  assert.match(app, /onAddEntry: \(delta, note\) => changeWallet\(delta, note, "entry"/);
});
