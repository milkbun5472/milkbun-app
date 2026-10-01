// 她 2026-10-02「顾朝顾暮现在就说把我带回家在他们身边了」
const test = require("node:test");
const assert = require("node:assert");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js/app.js"), "utf8");
test("没开同处一室：她在哪只看群里说过的话，并且真的拼进群线上 system", () => {
  assert.match(app, /const gWhereHint = \(!gSameRoomFor\(groupId\)/);
  assert.match(app, /gWhereHint \+/);
  assert.ok(app.indexOf("const gWhereHint = ") < app.indexOf("+ gWhereHint +"), "TDZ");
});
