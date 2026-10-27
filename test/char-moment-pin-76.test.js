const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8"), cmp = fs.readFileSync("js/components.js", "utf8");
test("角色发朋友圈自己定置顶，最多三条", () => {
  assert.match(app, /const _momPinSpec = ",\\"pin\\":/);
  assert.equal((app.match(/\+ _momPinSpec \+ "\}"/g) || []).length, 2);
  assert.match(app, /\.\.\.\(_pinNew \? \{ top: true, topTs: Date\.now\(\) \} : \{\}\)/);
  assert.match(app, /const drop = new Set\(mineTop\.slice\(2\)/);
});
test("主页里置顶的排最上、挂「置顶」", () => {
  assert.match(cmp, /\.sort\(\(a, b\) => \(b\.top \? 1 : 0\) - \(a\.top \? 1 : 0\)/);
  assert.match(cmp, /"data-wk": "momtoptag"/);
});
