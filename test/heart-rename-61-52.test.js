// 她 2026-09-03 拿来了那份参考文档：《欲望盒子人格系统》。
// 对照下来我们不是借了一个名字——**整套词汇表都是他们的**：
//   欲望盒子 / 人格档案 / 小满日 / 冬至日 / 观测者 / 痕避 / 心念藤蔓 / 蜕变诗 /
//   成长回响 / 旧日回响 / 灵光独白 / 显灵时刻 / 行动刻痕 / 瞬灭 —— 十四个词一个不落，
//   「人格档案」在代码里出现 62 次。只改容器名等于换个封面。
// ⚠️和动念那次不一样：这套【代码是我们自己写的】（没有任何 vendored 声明），
//   借的只是名字，所以是干净的换名，不用留出处。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const jsDir = path.join(root, "js");
const all = fs.readdirSync(jsDir).filter(f => f.endsWith(".js")).map(f => [f, fs.readFileSync(path.join(jsDir, f), "utf8")]);

// 这几个文件里的「欲望」是【别的意思】，不归这次改名管：
//   games.js 真心话里「挖出角色最深的欲望」、tarot.js 牌义「行动与欲望」、
//   phone.js 深夜取材层的情欲、personality-shadow 的维度枚举（那是存进卡里的值）。
const OTHER_MEANING = new Set(["games.js", "tarot.js", "phone.js"]);

test("那十四个词一个都不剩", () => {
  const OLD = ["欲望盒子", "欲望盒", "小满", "冬至", "灵光独白", "观测者", "痕避",
               "心念藤蔓", "显灵时刻", "蜕变诗", "成长回响", "旧日回响", "行动刻痕", "瞬灭"];
  const bad = [];
  all.forEach(([f, s]) => {
    if (OTHER_MEANING.has(f)) return;
    s.split("\n").forEach((l, i) => {
      // heart.js 头上那段【名字的来历】要把旧词列出来，那是档案不是残留
      // heart.js 里【说明来历】的注释要把旧词列出来——那是档案，不是残留。
      // ⚠️别用行号放行（第一版写的是「前 25 行」，后来在 200 多行处又写了一段
      //   「原来是…那份文档的小满日/冬至日」，立刻误报）。按【性质】放行：
      //   只有明确在讲出处的那几句可以带旧词。
      // 两类可以带旧词，别的都算残留：
      //   ① 说明来历的档案注释（这一套是照着哪份文档做的、原来那两个数是怎么来的）
      //   ② 她的原话——引文按她说的留着，跟着改名一起改就是篡改她说过的话
      //      （动念那次踩过：脚本把「jiwen 也没用」改成了「dongnian 也没用」）
      // ⚠️别按行号放行：第一版写的是「前 25 行」，后来在 200 多行处又加了一段来历说明，
      //   立刻误报。按【性质】放行才站得住。
      const isArchive = /那份文档|名字的来历|原来是 10 天和 90 天|连词汇表一起借了|十四个词一个不落/.test(l);
      const isQuote = /她 20\d\d-\d\d-\d\d[：:]/.test(l);
      if (f === "heart.js" && (isArchive || isQuote)) return;
      OLD.forEach(w => { if (l.includes(w)) bad.push(f + ":" + (i + 1) + " 「" + w + "」 " + l.trim().slice(0, 56)); });
    });
  });
  assert.deepEqual(bad, [], "还写着旧词：\n  " + bad.join("\n  "));
});

test("「人格档案」换成了我们自己的说法，但【人格档案馆】那个界面名不许被误伤", () => {
  const bad = [];
  all.forEach(([f, s]) => s.split("\n").forEach((l, i) => {
    if (f === "heart.js" && /欲望盒子\/人格档案/.test(l)) return;
    // 「人格档案馆」是她的界面名（她 2026-08-30 亲自改的），不是这套系统的词
    const hit = l.replace(/人格档案馆/g, "");
    if (hit.includes("人格档案")) bad.push(f + ":" + (i + 1) + " " + l.trim().slice(0, 60));
  }));
  assert.deepEqual(bad, [], "还写着「人格档案」：\n  " + bad.join("\n  "));
  // 界面名必须还在
  const scr = all.find(x => x[0] === "screens.js")[1];
  assert.match(scr, /人格档案馆/, "把她的界面名一起改掉了");
  // 换成的说法是代码里本来就在用的那个
  const app = all.find(x => x[0] === "app.js")[1];
  assert.match(app, /长出来的自我/, "没换成我们自己的说法");
});

test("⚠️存档键和存进档的值一个都没动", () => {
  const heart = all.find(x => x[0] === "heart.js")[1];
  // ⚠️查【真读写】不是查注释：x_desires 的 loadJSON/saveJSON 在 app.js，
  //   heart.js 里只有说明文字。只对着注释断言＝空转（第一版就是这么写的，
  //   变异把键改掉照样绿）。
  const app = all.find(x => x[0] === "app.js")[1];
  ["loadJSON(\"x_desires\"", "saveJSON(\"x_desires\""].forEach(k =>
    assert.ok(app.includes(k), "app.js 里 " + k + " 没了——存档键被改了，所有角色攒的念想会全丢"));
  all.forEach(([f, s]) => assert.doesNotMatch(s, /x_hearts?\b/, f + " 里出现了新键名"));
  // status / source 是写进存档里的值，跟着改名就读不回来了。
  // 同样查真代码：boxOf/housekeep 那几处，不是文件头的形状说明。
  const body = heart.slice(heart.indexOf("function boxOf("));
  ["active", "ash", "graduated", "withered", "echo", "spark", "vine"].forEach(v =>
    assert.ok(body.includes('"' + v + '"') || body.includes("'" + v + "'"), "存档值 " + v + " 在真代码里不见了"));
  assert.match(heart, /键名不许跟着改名/, "没把这条写进注释，下一个人会手贱");
});

test("文件名和挂点都换过来了", () => {
  assert.ok(fs.existsSync(path.join(jsDir, "heart.js")), "js/heart.js 不在");
  assert.ok(!fs.existsSync(path.join(jsDir, "desire.js")), "旧文件还留着");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /js\/heart\.js/);
  assert.doesNotMatch(html, /js\/desire/, "index.html 还指着旧文件");
  all.forEach(([f, s]) => assert.doesNotMatch(s, /DesireKit/, f + " 还在用 DesireKit"));
  assert.match(all.find(x => x[0] === "heart.js")[1], /window\.HeartKit = \{/);
});
