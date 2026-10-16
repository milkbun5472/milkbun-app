// 她 2026-10-13：「重画的画风要不要拍之前就可以选，这样省钱不用拍两张」
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = R("js/app.js"), scr = R("js/screens.js"), ts = R("js/theme-studio.js");
assert.match(scr, /"data-wk": "studiopaint"/);
assert.match(scr, /onShoot\(\{ scene, mine: [^}]*polaroid, paint(, expand)? \}\)/);
assert.match(app, /const PAINT = !RESTYLE_ONLY && opt && opt\.paint/);
assert.match(app, /RESTYLE_ONLY \|\| \(PAINT_LINE \? PAINT_LINE/);
// 存成 paint 不存 style：它是原图，不能被挂到别人那一摞底下
assert.match(app, /\.\.\.\(PAINT \? \{ paint: PAINT \} : \{\}\)/);
assert.match(scr, /\["paint", "画风"\]/);
assert.match(ts, /\["studiopaint",/);
console.log("ok");
