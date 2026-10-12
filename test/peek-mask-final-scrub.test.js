const test = require("node:test"); const assert = require("node:assert");
const src = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
const a = src.indexOf("const peekPhoneMaterial ="), body = src.slice(a, src.indexOf("\n  };", a));
test("查手机出口整份再滤一遍别的面具的名字", () => {
  const m = body.match(/if \(maskNames\.length\) return (out\.map[^\n]+);/);
  assert.ok(m, "出口那一道还在");
  const run = new Function("out", "maskTrace", "return " + m[1]);
  const trace = t => String(t).includes("小黑");
  const res = run(["【她在的群】\n群「宿舍」：\n  「小黑」：在吗\n  她：在", "【外卖】\n· 送给小黑的奶茶", "【日历】\n· 今天：交房租"], trace);
  assert.doesNotMatch(res, /小黑/);
  assert.match(res, /她：在/);
  assert.doesNotMatch(res, /【外卖】/);
  assert.match(res, /交房租/);
});
