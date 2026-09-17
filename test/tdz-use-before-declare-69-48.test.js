// 她 2026-09-17 截图：聊天里一条系统条写着
//   （发送失败：Cannot access 'capState' before initialization.）
//
// 是 v69.30 我自己种的：那一版给「她提了头像但手上没有照片」补了一句 capState.push，
// 可我把它写进了上面那个 photoSeen 块里——而 `const capState = []` 在它【下面】。
// const 有 TDZ，于是只要她最近四轮提过「头像」而手上又没有可换的照片，
// 这一整轮回复就在拼提示词的时候当场抛出去，一条消息都发不出来。
//
// ⚠️这类错【静态正则一个都抓不到】：那一版新增的 8 条测试全绿，全量 5948 条也全绿，
//   连 Chromium 冒烟都绿——因为冒烟只开机，不发消息。
//   所以这里立一道通用的闸：**同一个函数体里，不许在 const/let 声明之前用它。**
//   它抓的是形状，不是这一个变量，以后别人再踩同一个坑照样会红。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FILES = ["js/app.js", "js/components.js", "js/engine.js", "js/phone.js", "js/screens.js"];
// 只看代码，注释里常常会逐字引用变量名（病历就这么写的）
const codeOnly = src => src.split("\n").map(l => /^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l.replace(/\/\/.*$/, ""));

// 这几个名字在库里同名出现在很多作用域里（每个组件各有一份），
// 行号先后没有意义——它们由各自函数体的结构保证，不归这道闸管。
const SKIP = new Set(["t", "i", "j", "n", "s", "m", "p", "e", "d", "c", "g", "u", "v", "x", "ref", "now"]);

test("不许在 const/let 声明之前用它（TDZ：跑起来才炸，静态正则抓不到）", () => {
  const bad = [];
  for (const f of FILES) {
    const lines = codeOnly(fs.readFileSync(path.join(__dirname, "..", f), "utf8"));
    // 每个名字的【首次声明行】和【首次使用行】
    const declAt = new Map(), useAt = new Map();
    lines.forEach((l, idx) => {
      // ⚠️一行声明好几个是常事（`const removed=x,removedTurns=y`），
      //   只抓第一个会把后面那些当成「用在声明之前」误报。
      //   所以 const/let 那一行里所有 `名字 =` 都算声明——
      //   **宁可多算几个声明（少抓一点），也绝不许错抓**：
      //   这道闸红了就得有人去改代码，错抓会逼人把好代码改坏。
      if (/^\s*(?:const|let)\s/.test(l)) {
        let dm; const dre = /([A-Za-z_$][\w$]*)\s*=(?!=)/g;
        while ((dm = dre.exec(l))) if (!declAt.has(dm[1])) declAt.set(dm[1], idx);
      }
      // 只认【很难看错】的两种用法：xxx.push( 和 xxx.forEach( ——
      // 这两种一定是在读那个变量，不会是别的作用域的同名形参在被赋值
      const u = l.match(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\.(?:push|forEach)\(/);
      if (u && !useAt.has(u[1])) useAt.set(u[1], idx);
    });
    for (const [name, ui] of useAt) {
      if (SKIP.has(name)) continue;
      const di = declAt.get(name);
      if (di == null || di <= ui) continue;   // 同一行先声明后用是正常写法
      // 同名变量可能分属不同函数：只有中间【没有跨过函数边界】才算真的踩线。
      // 判据从简：两行之间不许出现顶格的 function/箭头函数收尾
      const between = lines.slice(ui + 1, di).join("\n");
      if (/^\s{0,2}(function |const \w+ = (async )?\(|\}\)\(\);)/m.test(between)) continue;
      bad.push(f + ":" + (ui + 1) + " 用了 " + name + "，可它在第 " + (di + 1) + " 行才声明");
    }
  }
  assert.deepEqual(bad, [], "这些地方会在跑起来时抛 Cannot access ... before initialization：\n" + bad.join("\n"));
});

test("这一次那条 capState 已经排在声明后面了", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const decl = app.indexOf("      const capState = [];");
  const use = app.indexOf('capState.push("换头像：');
  assert.ok(decl > 0 && use > decl, "又跑到声明前面去了");
  // 病历留在代码里，别让下一个人以为这只是个顺手的挪动
  assert.match(app, /必须排在 capState 声明之后/);
});
