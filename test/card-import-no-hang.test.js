// 群里 2026-10-19：「人设卡导入不了，文件导入没反应，复制粘贴就卡死」。
// 粘贴和选文件都走 parseCharCard；几条正则在「标题后面一长串空格」时回溯爆炸（3000 空格卡一分多钟）。
const test = require("node:test");
const assert = require("node:assert/strict");
const s = require("fs").readFileSync(require("path").join(__dirname, "../js/screens.js"), "utf8");
const parse = new Function(s.slice(s.indexOf("function cardFillNames"), s.indexOf("// 整页，不是半窗")) + ";return parseCharCard;")();

test("长串空格/制表符的卡一下就解析完", () => {
  const n = 50000;
  const x = "# 人设" + " ".repeat(n) + "x" + " ".repeat(n) + "\n【设定】" + "\t".repeat(n) + "y\n**姓名**" + " ".repeat(n) + "\n#" + " ".repeat(n) + "z\n";
  const t0 = Date.now(); parse(x, "我");
  assert.ok(Date.now() - t0 < 1000, "解析用了 " + (Date.now() - t0) + "ms");
});

test("名字、分节照旧认得出", () => {
  assert.equal(parse("# 林深 · 角色卡\n## 人设\n他很安静", "我").name, "林深");
  assert.equal(parse("**姓名**：  林深\n", "我").name, "林深");
  const p = parse("名字：林深\n【人设】他很安静\n## 开场白：\n你来了", "我");
  assert.match(p.persona, /他很安静/);
  assert.equal(p.greeting, "你来了");
});
