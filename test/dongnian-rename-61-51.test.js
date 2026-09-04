// 她 2026-09-03：「jiwen 是别人那边拿过来参考的名字，我们也改成自己的名字吧」→「就动念」。
//
// 改名有两条硬约束，这个文件就是钉这两条的：
//   ① 算法是别人的（MIT vendored），名字可以换，**出处和许可声明必须留**——仓库是公开的。
//   ② localStorage 的 x_jiwen / x_jiwenSeen **不许跟着改**：那里面是每个角色一直在涨的
//      五轴状态，改名＝全体从零开始。键名是内部字段，她在界面上看不见，留着零代价。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const js = fs.readdirSync(path.join(root, "js")).filter(f => f.endsWith(".js"));
const readAll = () => js.map(f => [f, fs.readFileSync(path.join(root, "js", f), "utf8")]);

test("出处没被一起删掉——那是别人的算法", () => {
  const src = fs.readFileSync(path.join(root, "js/dongnian.js"), "utf8");
  assert.match(src, /github\.com\/ClaraShafiq\/jiwen/, "上游出处没了；MIT 要求保留");
  assert.match(src, /MIT/, "许可声明没了");
  assert.match(src, /原名「积温」/, "没说清我们改了名字，后人会以为算法是我们写的");
});

test("存档键原样不动", () => {
  const keys = readAll().flatMap(([, s]) => s.match(/x_jiwen(Seen)?/g) || []);
  assert.ok(keys.length >= 5, "x_jiwen 系列键少了 " + keys.length + " 处——是不是被一起改名了？那会丢状态");
  // 反过来：不许出现改了名的键
  readAll().forEach(([f, s]) =>
    assert.doesNotMatch(s, /x_dongnian/, f + " 里出现了 x_dongnian——改了键就等于让所有角色失忆"));
});

test("我们这一侧一个 jiwen 都不剩", () => {
  const bad = [];
  readAll().forEach(([f, s]) => {
    s.split("\n").forEach((l, i) => {
      if (!/jiwen|Jiwen|积温/i.test(l)) return;
      // 只有两样可以留：存档键、上游出处（含说明它原名叫什么那句）
      // 可以留的只有三样：存档键、上游出处、以及【她当时的原话】——
      // 引文按她说的留着，跟着改名一起改就是篡改她说过的话。
      if (/x_jiwen/.test(l) || /ClaraShafiq/.test(l) || /原名「积温」/.test(l)) return;
      if (/她原话|那会儿还叫/.test(l) || /「jiwen 也没用/.test(l) || /是别人那边拿过来参考的名字/.test(l)) return;
      bad.push(f + ":" + (i + 1) + "  " + l.trim().slice(0, 70));
    });
  });
  assert.deepEqual(bad, [], "这几处还写着旧名字：\n  " + bad.join("\n  "));
});

test("文件名和挂点都换过来了", () => {
  assert.ok(fs.existsSync(path.join(root, "js/dongnian.js")), "js/dongnian.js 不在");
  assert.ok(!fs.existsSync(path.join(root, "js/jiwen.js")), "旧文件还留着");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /js\/dongnian\.js/, "index.html 没指到新文件");
  const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  assert.match(app, /window\.__dongnian/, "运行时挂点没改");
  assert.match(app, /createDongnian/, "工厂函数没改");
});
