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
      // ⚠️原来这个正则写死了【冒号后面一个空格】，于是 `maxTokens:6000` 这种压缩写法
      //   一处都扫不到（js/inner-life-b-shadow.js 就那么写着 6000，闸绿着放它过去）。
      //   闸自己有盲区的时候，「全绿」什么都不证明。
      let m; const re = /maxTokens\s*:\s*(\d+)/g;
      while ((m = re.exec(line))) {
        if (Number(m[1]) < FLOOR) bad.push(f + ":" + (i + 1) + "  " + m[1]);
      }
    });
  });
  assert.deepEqual(bad, [], "这几处会让思考型模型想完就没配额写正文：\n" + bad.join("\n"));
});

// ⚠️还有一种写法完全在上面那道闸之外：**调用方压根不传 maxTokens**，
//   由传输层的 `opts.maxTokens || N` 兜底。那个 N 才是这类调用真正拿到的配额，
//   而它原来是 2400——比地板低一大截，而且不会在任何一处出现「maxTokens: 数字」。
//   查缺别顺着「这条规则写没写」找，先问【这一处是靠什么把配额拿到手的】。
test("没传 maxTokens 时的兜底默认值也不许低于地板", () => {
  const engine = fs.readFileSync(path.join(root, "js", "engine.js"), "utf8");
  const m = /const maxTokens = opts\.maxTokens \|\| (\d+);/.exec(engine);
  assert.ok(m, "传输层那个兜底默认值找不到了——它改了名字，这条断言就落单了");
  assert.ok(Number(m[1]) >= FLOOR, "忘了传 maxTokens 的调用点会拿到 " + m[1] + "，低于地板 " + FLOOR);
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
  // ⚠️同人文这两处别冻公式的【长相】。规矩只说了「不许往下调」，
  // 而冻住字面量的话，往上抬也会红——v60.97 穿书那一次正是这样：
  // 开场那一拍现在除了正文还要带回这本书的骨架，抬上限是对的，测试却拦住了。
  // 改成按判据：地板和上限都不许低于当初那个数。
  const fml = [...fic.matchAll(/maxTokens: Math\.max\((\d+), Math\.min\((\d+), \(perFic \|\| (\d+)\) \+ (\d+)\)\)/g)]
    .map(m => m.slice(1).map(Number));
  assert.ok(fml.length >= 2, "同人文那两处算出来的上限找不到了");
  fml.forEach(([floor, cap, base, add]) => {
    assert.ok(floor >= 11000, "地板掉到 " + floor + " 了");
    assert.ok(cap >= 20000, "上限掉到 " + cap + " 了");
    assert.ok(add >= 8000, "加给思考的那一份掉到 " + add + " 了");
  });
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

// ⚠️v60.02：上一版扫的时候只认 `maxTokens: 数字` 这个写法，
//   把【位置传参】那一类整个漏了——weekly 的 genJSON 第四个参数就是 maxTokens，
//   六处（采访/语录/来信/小报/头版）全卡在 6000 以下，而我报告说扫完了。
//   所以这一条不只钉数字，还钉那道兜底：进了 genJSON 也得过同一条线。
test("位置传参那一类也算数：weekly 的 genJSON 六处都过线，而且函数里兜了底", () => {
  const wk = fs.readFileSync(path.join(root, "js", "weekly.js"), "utf8");
  assert.match(wk, /const tok = Math\.max\(8000, Number\(maxTokens\) \|\| 0\);/,
    "genJSON 里没有兜底——以后有人再传个 2000 进来，谁也拦不住");
  assert.match(wk, /\{ maxTokens: tok \}/);
  const calls = (wk.match(/genJSON\([^;]*?, (\d+)\)/g) || []).map(x => Number(x.match(/(\d+)\)$/)[1]));
  assert.equal(calls.length, 6, "genJSON 的调用处不是六处了，核对一下");
  calls.forEach(function (n) { assert.ok(n >= 8000, "还有一处位置传参低于 8000：" + n); });
});
