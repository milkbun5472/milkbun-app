const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const C = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), U = fs.readFileSync(__dirname + "/../js/theme-studio-ui.js", "utf8");
test("存好的美化、主题都能就地更新，不用删了重存", () => {
  assert.match(C, /const overwriteOne = it => \{[\s\S]{0,200}look: chatLookClean\(getLook\(\)\)/);
  assert.match(C, /"data-wk": "lookshelfover"/);
  assert.match(U, /const updateShelf = x => requestAppConfirm\(/); assert.match(U, /"data-wk": "themeshelfupdate"/);
  assert.match(U, /const text = await packNow\(\);/);
});
