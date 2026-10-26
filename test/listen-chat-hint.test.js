const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("一起听页面写明：边听边回单聊也接得上（单聊本来就有 nowPlaying）", () => {
  assert.match(ui, /"data-wk": "listenchathint"/); assert.match(ui, /回单聊直接找/);
  assert.match(app, /nowPlaying: \(\(\) => \{/);
  assert.match(fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8"), /"listenchathint"/);
});
