const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("NPC 聊天能从列表删掉、配角和记录不动", () => {
  assert.match(app, /x_hiddenChats/);
  assert.match(app, /onHideChat:/);
  assert.match(comp, /hidAt\[/);
  assert.match(comp, /"data-wk": "mlrowmenu"/);
  assert.match(comp, /从列表删掉/);
});
