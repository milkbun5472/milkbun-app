// 她 2026-09-03：「为啥匿名问答有些问题是省略号没说完」。
// 病因不是截断，是【一颗骰子一摇管十条】：ANON_ASKER_SHAPE 里那一面原来写
// 「只丢半句就停了」，模型把它读成了标点模板，于是整组十条全用「……」收尾。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("那一面不再叫「只丢半句就停了」", () => {
  const m = app.match(/const ANON_ASKER_SHAPE = \[[\s\S]*?\n  \];/);
  assert.ok(m, "找不到 ANON_ASKER_SHAPE");
  // 只看真的会发出去的那几个字符串（注释里提到旧写法是在解释为什么要改）
  const faces = m[0].match(/^\s*"[^"]+",?$/gm) || [];
  assert.ok(faces.length >= 10, "骰子面数不对");
  assert.ok(!faces.some(f => f.indexOf("只丢半句就停了") >= 0), "旧那一面还在");
  assert.match(m[0], /话说得不圆整就问出来了/, "要的是话说得不圆，不是句子断在半截");
});

test("提示词里明说每条都要问完，省略号收尾整批最多两条", () => {
  assert.match(app, /每一条都得是问完了的一句话/);
  assert.match(app, /整批里以省略号收尾的最多两条/);
});

test("代码兜一道：一批最多留两条省略号收尾的（规则降概率，代码才保证）", () => {
  const m = app.match(/const brewAnonPool = async \(cur, quiet\) => \{[\s\S]*?\n  \};/);
  assert.ok(m, "找不到 brewAnonPool");
  assert.match(m[0], /const tail = q =>/);
  assert.match(m[0], /fresh = fresh\.filter\(q => !tail\(q\) \|\| \+\+ell <= 2\)/);
  // 只丢多出来的，不许把省略号从原句上抹掉（那会改坏她本来想要的那两条）
  assert.doesNotMatch(m[0], /replace\(\/\(\?:…/);
});
