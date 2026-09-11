// 她 2026-09-11 定的三件（讨论完当轮开工）：
//  ① 续写时给一个输入框说想要的剧情走向——**两档由她自己选**，不按作者身份分权。
//     分权的乐趣在于不确定，而不确定只有在她自愿的时候才是乐趣。
//  ②「以后任何东西都不接受一次发两遍，就弄一个设置最低 token 要求」
//     ⚠️API 上没有 min_tokens（max_tokens 是天花板、没有地板），所以这个数只能
//     落成两件事：发进提示词 + 写完自己数一遍。短了**只提示**，绝不自动补。
//  ③ 章节多了怎么记住重要设定和 callback 不崩——设定卡（只增不改）+ 伏笔盒。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fic = fs.readFileSync(path.resolve(__dirname, "..", "js/fanfic.js"), "utf8");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
// 纯函数抠出来跑：桩照【源码本身】走，不另抄一份实现（stub-from-the-writer.md）
const grab = name => {
  const i = fic.indexOf("function " + name + "(");
  assert.ok(i > 0, "找不到 " + name);
  let d = 0, j = fic.indexOf("{", i);
  for (let k = j; k < fic.length; k++) {
    if (fic[k] === "{") d++; else if (fic[k] === "}") { d--; if (!d) { j = k + 1; break; } }
  }
  return fic.slice(i, j);
};
const F = new Function("BIBLE_CAP", "SEED_CAP", "MIN_CHARS_MAX", "clampPerFic",
  grab("countChars") + grab("shortBy") + grab("clampMinChars") + grab("minCharsFor") + grab("applyChapterMeta") + grab("wantBlock")
  + "\nreturn { countChars, shortBy, clampMinChars, minCharsFor, applyChapterMeta, wantBlock };"
)(60, 12, 20000, v => Math.max(500, Math.min(60000, Number(v) || 4200)));

test("① 点单两档：许个愿给出口，就这么写是硬指标", () => {
  assert.equal(F.wantBlock("", false, false), "", "没点单就别发一段空的");
  const soft = F.wantBlock("我想看他吃醋", false, false);
  assert.match(soft, /【读者在评论区喊的】/);
  assert.match(soft, /你听不听、怎么听，按你自己的脾气来/, "软那一档写成命令，就没有第二档了");
  assert.match(soft, /可以压根不理/, "给的是出口不是判决（bans-make-it-dumber.md）");
  assert.match(F.wantBlock("x", false, true), /你是被请来接这篇的/, "枪手和原作者面对同一条呼声该是两种分寸");
  assert.match(F.wantBlock("x", false, false), /这是你自己的连载，你说了算/);
  const hard = F.wantBlock("我想看他吃醋", true, false);
  assert.match(hard, /硬要求，优先于你自己的想法/);
  assert.match(hard, /不许挪到下一章、不许只提一句带过/, "不钉死的话它会写一句「他有点不是滋味」交差");
  assert.ok(hard.indexOf("按你自己的脾气") < 0, "硬那一档还留着软话，等于两档都没有");
});

test("① 点单接到界面上了，而且会记住上次那条", () => {
  assert.match(fic, /onGo: function \(by, want, hard\) \{ setGhostOpen\(false\); addChapter\(by, want, hard\); \}/);
  assert.match(fic, /async function addChapter\(by, want, hard\)/);
  assert.match(fic, /\{ author: by \|\| null, want: want \|\| "", hardWant: !!hard, grabbed: grabbed, quitting: quitting \}/);
  assert.match(fic, /if \(want && want\.trim\(\)\) fic\.lastWant = want\.trim\(\)\.slice\(0, 600\);/);
  assert.match(fic, /"填回上次那条："/);
  // 那两格不是一排药丸：这一页是给太太的稿约单，所以它长成单子上的勾选项
  assert.match(fic, /h\(ICheck, \{ size: 10, color: t\.ink \}\)/, "选中态只靠填色＝药丸（tabs-not-plain-pills.md）");
  assert.match(fic, /borderBottom: "1px dashed " \+ t\.line/);
});

test("② 字数地板只此一份：首发和续写问同一个数", () => {
  assert.equal((fic.match(/Math\.max\(600, Math\.round\(perFic \* 0\.55\)\)/g) || []).length, 0,
    "还有人自己折算一遍——她在设置里填的数迟早只对其中一处生效");
  assert.equal((fic.match(/minWords = minCharsFor\(/g) || []).length, 3, "首发、续写、接着写要走同一个 minCharsFor");
  assert.equal(F.minCharsFor({ perFic: 4200, minChars: 0 }), Math.max(600, Math.round(4200 * 0.55)), "留空要退回老行为");
  assert.equal(F.minCharsFor({ perFic: 4200, minChars: 3000 }), 3000, "填了数就该以它为准");
  assert.equal(F.clampMinChars(""), 0);
  assert.equal(F.clampMinChars(50), 200, "太小的数会把「地板」变成噪音");
  assert.equal(F.clampMinChars(999999), 20000);
});

test("② 数出来短了只提示，绝不自动再打一枪", () => {
  assert.equal(F.countChars("今天 码头\n封了"), 6, "空白算进字数＝排版能骗过地板");
  assert.equal(F.shortBy("一二三四五六七八九十", 0), 0, "没设地板就别判");
  assert.equal(F.shortBy("一二三四五六七八九十", 10), 0);
  assert.equal(F.shortBy("一二三四五六七八九", 10), 0, "差一个字就报偷懒是找茬（留一成余量）");
  assert.equal(F.shortBy("一二三", 100), 97);
  // 界面上：一行字 + 一颗键，按了才发
  assert.match(fic, /const miss = window\.Fanfic\.shortBy\(ch\.content, minChars\);/);
  assert.match(fic, /"让他接着写"/);
  assert.match(fic, /onClick: function \(\) \{ moreChapter\(idx\); \}/);
  // genChapterMore 只能从界面按出来，代码里不许有第二个调用点
  const calls = (strip(fic).match(/genChapterMore\(/g) || []).length;
  assert.equal(calls, 2, "genChapterMore 出现了 " + calls + " 处（该只有：定义 1 + 界面上那一颗键 1）——多出来的那处多半是自动补");
  assert.ok(strip(fic).indexOf("if (miss) moreChapter") < 0, "自动补上了＝一次发两遍");
});

test("② 接着写不是重写，天花板也跟着地板走", () => {
  const g = fic.slice(fic.indexOf("async function genChapterMore"), fic.indexOf("  // ---- 书评"));
  assert.match(g, /从上面最后一个字\*\*往下接着写\*\*/);
  assert.match(g, /绝不许重述已经写过的内容/, "不钉死的话它会把刚才那段换个说法重来一遍");
  assert.match(g, /还差大约/, "不告诉它还差多少，它接两句就停");
  // 她把地板调到 5000 字，天花板还按 perFic 算就会写到一半被截断——那才是真多花一次
  assert.match(fic, /Math\.max\(perFic, minWords \* 2\) \+ 12000/);
  assert.match(g, /Math\.max\(clampPerFic\(opts\.perFic\), minWords \* 2\) \+ 12000/);
});

test("② 字数在提示词里说两处，别只埋在最后那行 schema 里", () => {
  const g = fic.slice(fic.indexOf("async function genNextChapter"), fic.indexOf("  // ---- 「让他接着写」"));
  assert.match(g, /这一章至少写 " \+ minWords \+ " 字\*\*。这是硬指标，不是参考值/, "任务那一段里没说");
  assert.match(g, /\*\*至少 " \+ minWords \+ " 字\*\*/, "输出格式那一行里没说");
  assert.match(g, /的下一章，至少 " \+ minWords \+ " 字/, "user 那句触发里没说");
});

test("③ 设定卡只增不改，伏笔收了才出盒", () => {
  let m = F.applyChapterMeta({ bible: [], seeds: [] }, { facts: ["他母亲姓陈", "戒指是他外婆留下的"], seed: "抽屉里那封没寄的信", paid: [] });
  assert.deepEqual(m.bible, ["他母亲姓陈", "戒指是他外婆留下的"]);
  assert.deepEqual(m.seeds, ["抽屉里那封没寄的信"]);
  m = F.applyChapterMeta(m, { facts: ["他母亲姓陈"], seed: "", paid: ["抽屉里那封没寄的信"] });
  assert.deepEqual(m.bible, ["他母亲姓陈", "戒指是他外婆留下的"], "同一条事实记了两遍");
  assert.deepEqual(m.seeds, [], "收掉的伏笔还留在盒里，它下一章会再被当成没收");
  // 只增不改：后面的章不许推翻前面的
  const keep = F.applyChapterMeta({ bible: ["他母亲姓陈"], seeds: [] }, { facts: ["他母亲姓林"], seed: "", paid: [] });
  assert.ok(keep.bible.indexOf("他母亲姓陈") >= 0, "旧事实被顶掉了＝允许后面的章改设定");
  // 封顶，不然二十章之后它自己就是一大块
  let big = { bible: [], seeds: [] };
  for (let i = 0; i < 80; i++) big = F.applyChapterMeta(big, { facts: ["事实" + i], seed: "伏笔" + i, paid: [] });
  assert.equal(big.bible.length, 60);
  assert.equal(big.seeds.length, 12);
});

test("③ 设定卡发出去了，而且判据不给例子；伏笔不许每章强收", () => {
  assert.match(fic, /bibleBlock\(fic\) \+\s*\n\s*"【前情摘要/, "设定卡没进续写那一枪");
  assert.match(fic, /seedBlock\(fic\) \+/);
  assert.match(fic, /\*\*不必这一章就收\*\*/, "不写这句，它每章都会强行回收一条，变成填格子");
  assert.match(fic, /这一份比你记忆里的前情更权威/);
  // 什么算事实：给判据、不给例子（prompt-no-content-samples.md）
  assert.match(fic, /心情、暧昧到哪一步、这一章的剧情走向\*\*都不算\*\*/);
  assert.ok(fic.indexOf('BIBLE_WHAT = "【什么算事实】名字、身份、亲属') > 0);
  const w = fic.slice(fic.indexOf("const BIBLE_WHAT"), fic.indexOf("function bibleBlock"));
  assert.ok(!/如「|比如「|例如/.test(w), "判据里塞了可以照抄的例句");
  // 落地要走同一处合并规矩
  assert.equal((fic.match(/window\.Fanfic\.applyChapterMeta\(fic, /g) || []).length, 2, "续写和接着写要走同一处");
});

test("③ 前情摘要不再线性变长——远期交给设定卡", () => {
  const g = fic.slice(fic.indexOf("async function genNextChapter"), fic.indexOf("  // ---- 「让他接着写」"));
  assert.match(g, /const hookFrom = Math\.max\(0, chapters\.length - HOOK_TAIL\);/);
  assert.match(g, /chapters\.slice\(hookFrom\)/, "还在 chapters.map 整串——二十章之后它自己占一大块");
  assert.ok(g.indexOf("chapters.map(function (c, i)") < 0);
});

test("⑥ 枪手的路数只管【怎么写】，不管【写什么】", () => {
  // 「设定不许改」和「要看得出是她写的」会打架，打架时模型倾向保文风、丢设定
  assert.match(fic, /\*\*她的路数只管【怎么写】，不管【写什么】。\*\*/);
  assert.match(fic, /一个字不许因为「她会这么写」而改掉/);
});
