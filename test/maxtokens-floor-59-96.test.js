const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const FLOOR = 8000;
// games.js 是 Codex 的地盘、trpg.js 是言秋的，都不碰
const SKIP = new Set(["games.js", "trpg.js"]);

// 她 2026-09-01：「maxtoken 也放开了吧宝宝」→ 看完清单 →「扫吧宝宝」。
// 思考型模型的思考预算是从 maxTokens 里扣的：给紧了它想完就没配额写正文，
// 直接空返回或者写一半停在半句。她按【次】计费、输出不另外收钱——
// 省这几千 token 一分钱省不到，换来的是一次空返回再重来一次，反而多花一次调用。
test("全 app 没有一处 maxTokens 低于 " + FLOOR + "（games / trpg 除外）", () => {
  const bad = [];
  fs.readdirSync(path.join(root, "js")).filter(f => f.endsWith(".js") && !SKIP.has(f)).forEach(f => {
    const src = fs.readFileSync(path.join(root, "js", f), "utf8");
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      if (/^\s*\/\//.test(line)) return;              // 注释里写着历史值，不算
      let m; const re = /maxTokens: (\d+)/g;
      while ((m = re.exec(line))) {
        if (Number(m[1]) < FLOOR) bad.push(f + ":" + (i + 1) + "  " + m[1]);
      }
    });
  });
  assert.deepEqual(bad, [], "这几处会让思考型模型想完就没配额写正文：\n" + bad.join("\n"));
});

// 算出来的那几处：只抬上限和底数，公式形状不动
test("算出来的那几个上限也抬过了，别留一个 min(4000, …) 在那儿封顶", () => {
  const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
  const eng = fs.readFileSync(path.join(root, "js", "engine.js"), "utf8");
  const fic = fs.readFileSync(path.join(root, "js", "fanfic.js"), "utf8");
  const rd = fs.readFileSync(path.join(root, "js", "read.js"), "utf8");
  const scr = fs.readFileSync(path.join(root, "js", "screens.js"), "utf8");
  assert.match(app, /maxTokens: Math\.min\(20000, 8500 \+ batch\.length \* 60\)/);
  assert.match(app, /maxTokens: Math\.min\(24000, 11200 \+ members\.length \* 900\)/);
  assert.match(eng, /maxTokens: Math\.min\(20000, 8800 \+ \(entries \|\| \[\]\)\.length \* 40\)/);
  assert.match(fic, /maxTokens: Math\.max\(12000, Math\.min\(20000, \(perFic \|\| 3000\) \+ 8000\)\)/);
  assert.match(fic, /maxTokens: Math\.max\(11000, Math\.min\(20000, \(perFic \|\| 2400\) \+ 8000\)\)/);
  assert.match(rd, /maxTokens: Math\.min\(20000, 9500 \+ n \* 400\)/);
  assert.match(scr, /maxTokens: key === "outfit" \? 14000 : 12000/);
});

test("规矩写下来了，而且写清了为什么省不到钱", () => {
  const rule = fs.readFileSync(path.join(root, ".claude", "rules", "max-tokens-floor.md"), "utf8");
  assert.match(rule, /思考预算是从 `maxTokens` 里扣的/, "没写清机制，下一个人还会当成浪费调回去");
  assert.match(rule, /反而多花一次调用/, "没写清「省不到钱」这一层");
  assert.match(rule, /不许低于 8000/);
  assert.match(rule, /新 = min\(24000, 旧 \+ 8000\)/, "没给改旧值的公式");
  assert.match(rule, /js\/games\.js/, "没写清哪两块不归这条管");
  assert.match(rule, /js\/trpg\.js/);
  assert.match(rule, /用户能自己调的那几个不算/, "没划清界线，会有人去改她自己拧的那几个数");
  // ⚠️v59.98：她亲口点名「言秋的也给足吧」，所以那条例外撤掉了，两支合并成一个数。
  //   撤掉就是删掉——不在后面补一句「上面那条作废了」。
  assert.match(rule, /言秋那一支也给足/, "没写清这条是她亲口点名放开的");
  assert.ok(rule.indexOf("一个字不许动") < 0, "旧的那条例外还留着");
});

test("主聊天两处都给足，不再分言秋一支和普通角色一支", () => {
  const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
  assert.ok(app.indexOf("_engineerChat ? 3000") < 0, "言秋那一支还卡在 3000");
  assert.equal((app.match(/maxTokens: 14000, cacheHistory: _histCache/g) || []).length, 2,
    "首发和重试两处没都给足");
});
