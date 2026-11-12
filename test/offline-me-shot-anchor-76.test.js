const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("线下他帮她拍：上一张锚只认拍她的，不拿他的自拍当锚", () => {
  assert.match(app, /&& \(\(m\.photoKind === "me" \|\| m\.photoKind === "myself" \|\| m\.photoKind === "myshot"\) === \(kind === "me"\)\)/);
  assert.match(app, /\(\(m\.photoKind === "me" \|\| m\.photoKind === "myself" \|\| m\.photoKind === "myshot"\) === meShot\)/);
});
