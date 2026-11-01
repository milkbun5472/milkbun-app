const test = require("node:test"); const assert = require("node:assert");
const src = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
const a = src.indexOf("const peekPhoneMaterial ="), body = src.slice(a, src.indexOf("\n  };", a));
// 出口那一段：从 hidNames 起到最后的 return，原样拿出来跑
const s0 = body.indexOf("    const hidNames ="), s1 = body.indexOf("return out.join(\"\\n\\n\");", s0);
const run = (out, maskNames, maskTrace, hideIds, characters) => new Function("out", "maskNames", "maskTrace", "hideIds", "characters", "maskSet",
  body.slice(s0, s1) + "return out.join('\\n\\n');")(out, maskNames, maskTrace, hideIds, characters, new Set());
test("查手机出口整份再滤一遍别的面具的名字", () => {
  assert.ok(s0 > 0 && s1 > s0, "出口那一道还在");
  const trace = t => String(t).includes("小黑");
  const res = run(["【她在的群】\n群「宿舍」：\n  「小黑」：在吗\n  她：在", "【外卖】\n· 送给小黑的奶茶", "【日历】\n· 今天：交房租"], ["小黑"], trace, [], []);
  assert.doesNotMatch(res, /小黑/);
  assert.match(res, /她：在/);
  assert.doesNotMatch(res, /【外卖】/);
  assert.match(res, /交房租/);
});
test("单独藏起来的人：别处提到的整行拦，钱包那格不擦", () => {
  const res = run(["【她在的群】\n  「阿白」：在吗\n  她：在", "【她的钱包流水——是她的钱】\n· 转给阿白 20"], [], () => false, ["w"], [{ id: "w", name: "阿白" }]);
  assert.doesNotMatch(res.split("【她的钱包")[0], /阿白/);
  assert.match(res, /转给阿白 20/);
});
