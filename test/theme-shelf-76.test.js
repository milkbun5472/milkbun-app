const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const ui = fs.readFileSync(__dirname + "/../js/theme-studio-ui.js", "utf8");
test("我存的主题：存的是完整主题包、进 IDB，换上走导入那一条", () => {
  assert.match(ui, /const THEME_SHELF_KEY = "x_themeShelf"/);
  assert.match(ui, /const text = await studio\.exportPackage\(\{ profile: draft, baseTheme: theme, wallpaper,/);
  assert.match(ui, /onClick: \(\) => applyPack\(x\.text\)/);
  assert.match(ui, /requestAppConfirm\("删掉「" \+ x\.name/);
  const i = ui.indexOf("const saveToShelf"); assert.ok(!/localStorage|window\.prompt/.test(ui.slice(i, i + 900)));
});
