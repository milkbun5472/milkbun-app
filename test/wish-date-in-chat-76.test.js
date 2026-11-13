const test = require("node:test"); const assert = require("node:assert");
const fs = require("fs"); const src = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("愿望挑的日子／旅行出发日跟着愿望进聊天和发呆", () => {
  const i = src.indexOf("const wishWhenTxt"); assert.ok(i > 0);
  const body = src.slice(i, i + 1500);
  assert.match(body, /wishPlanOf\(w\.id\)/); assert.match(body, /coupleTripsRef\.current/); assert.match(body, /getFullYear\(\)/);
  assert.ok((src.match(/wishWhenTxt\(w\)/g) || []).length >= 2);
});
