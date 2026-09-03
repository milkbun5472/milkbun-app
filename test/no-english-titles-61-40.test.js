// v61.40 她 2026-09-03：「以后标题所有英文都去掉不要只留中文，除非他只有英文没写中文」。
// 落点在 Head（六十多页共用这一个顶栏）——改一处就一起合规，各页自己删迟早漏。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const comp = fs.readFileSync("js/components.js", "utf8");

test("有中文标题时，纯拉丁的副标题一律不发", () => {
  const i = comp.indexOf("function Head({");
  const head = comp.slice(i, i + 1400);
  assert.match(head, /const enCJK = \/\[一-鿿\]\/\.test\(String\(en \|\| ""\)\);/);
  assert.match(head, /const line = sub \|\| \(\(zh && !enCJK\) \? "" : \(en \|\| ""\)\) \|\| "";/);
});

test("en 里写的是中文时照旧当副标题——判断看的是有没有汉字，不是看写在哪个字段", () => {
  // 好些地方是拿 en 当 sub 使的；一刀切会把那些中文副标题也误伤
  const i = comp.indexOf("function Head({");
  const head = comp.slice(i, i + 1400);
  assert.ok(head.indexOf("enCJK") > 0);
  // 只有 en、没有 zh 的那种（真的只写了英文）也得留着
  assert.match(head, /\(zh && !enCJK\)/);
});

test("这条规矩写进了规则目录，不然下一个人不知道", () => {
  const rule = fs.readFileSync(".claude/rules/no-english-titles.md", "utf8");
  assert.match(rule, /标题不留英文/);
  assert.match(rule, /这一处压根没有中文/);
  // 别硬翻：眉标该说的是这一栏在干嘛
  assert.match(rule, /眉标该说的是这一栏在干嘛/);
});
