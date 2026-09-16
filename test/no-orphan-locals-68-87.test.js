// 她 2026-09-16：整屏「（发送失败：Can't find variable: _histCache）」。
//
// 是我 v68.68 干的：把 `const _histCache = …` 收进 chatSendShapeFor 时，
// 只改了紧挨着的那一行，**漏了下面两处 callAI 里的 cacheHistory: _histCache**。
// 于是每发一条消息都当场抛异常——而 5780 条测试全绿，因为它们全是【读源码字符串】，
// 没有一条会真的去跑那一行。
//
// 这一份就是补那个洞：一个便宜的、通用的「用了但没声明」扫描。
// 它挡不住所有 ReferenceError，但恰好挡得住【改名/删变量漏掉调用处】这一类——
// 而今天这个仓库三个窗口同时在改，这一类是最常发生的那一种。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

// 有意留着的例外：写得清清楚楚 typeof 守着的可选全局，不是漏网的孤儿
const ALLOW = new Set(["_imgCache"]);

// 只扫下划线开头的局部名（_route / _shape / _gated …）。
// 这个仓库里这类名字【全是某个函数体内的临时变量】，所以「用了却哪儿都没声明」
// 基本等于漏改。不扫普通名字：那会把一堆全局和 import 误伤成孤儿。
for (const f of ["js/app.js", "js/screens.js", "js/engine.js", "js/components.js"])
  test(f + "：下划线局部变量没有用了却没声明的", () => {
    const code = fs.readFileSync(f, "utf8").split("\n").map(l => l.split("//")[0]).join("\n");
    const declared = new Set();
    for (const m of code.matchAll(/(?:const|let|var|function)\s+(_[A-Za-z]\w*)/g)) declared.add(m[1]);
    for (const m of code.matchAll(/[({,]\s*(_[A-Za-z]\w*)\s*(?=[,)=])/g)) declared.add(m[1]);
    // ⚠️前一个字符也要排除中日韩：这个仓库里有 `legacy中_charIds为空_旧全局` 这种
    //   带中文的标识符，不排的话会被从中间切开，当成一个叫 _charIds 的孤儿。
    const used = new Set();
    for (const m of code.matchAll(/(^|[^.\w$'"`一-鿿])(_[A-Za-z]\w*)\s*(?![:\w])/g)) used.add(m[2]);
    const orphans = [...used].filter(x => !declared.has(x) && !ALLOW.has(x));
    assert.deepEqual(orphans, [],
      "这几个名字用了却没声明，多半是改名/删变量时漏了调用处（v68.68 的 _histCache 就是这么炸的）：" + orphans.join("、"));
  });

test("_histCache 那一处：缓存开关要单独交出去，别拿 singleHistoryLayout 顶替", () => {
  const app = fs.readFileSync("js/app.js", "utf8");
  // singleHistoryLayout 还含 engineerEyes 那一支；拿它当 cacheHistory 等于给数字生命
  // 那条线也开了整段历史缓存——那是另一回事。
  assert.match(app, /      histCache: histCache,/);
  assert.equal((app.match(/cacheHistory: _shape\.histCache/g) || []).length, 2, "两处 callAI 都要接同一份");
  assert.ok(app.indexOf("cacheHistory: _shape.singleHistoryLayout") < 0);
});
