const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
test("同一句连着重 roll：删掉的几版都记着（最多三版）", () => {
  assert.match(app, /const rerollHistRef = useRef\(\{\}\);/);
  assert.equal((app.match(/rerollAvoid = withPast\(avoidOf\(/g) || []).length, 2);
  assert.match(app, /\.slice\(-3\)/);
});
test("提示词把几版分开摆、并要求换骨架", () => {
  const a = eng.indexOf("function offlineRerollExcerpt"), b = eng.indexOf("function onlineRerollHint");
  const src = eng.slice(a, eng.indexOf("\n}\n", a) + 3) + "\nfunction rerollDirLine(){return \"\";}\n" + eng.slice(b, eng.indexOf("\n}\n", b) + 3);
  const ctx = {}; vm.runInNewContext(src + "\nthis.f=onlineRerollHint;", ctx);
  const one = ctx.f("A版");
  assert.match(one, /上一版回复/); assert.doesNotMatch(one, /骨架/);
  const many = ctx.f("A版\n——更早被删掉的一版——\nB版");
  assert.match(many, /『A版』『B版』/); assert.match(many, /连骨架一起换/);
});
