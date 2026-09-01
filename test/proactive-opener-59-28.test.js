// 她 2026-09-01 发来四个角色的截图：主动找她的消息全长成同一个骨架——
//   ①「我在哪／刚做完什么」→ ②「顺带买了／带了什么」→ ③「你今天起床没有／吃没吃」
// 病根在那句提示词里：它原来给了一张【清单】（此刻正在做的事、刚遇到的小事、
// 天气/饭点/行程…），清单的头一项最省力，于是每个角色每次都挑它；第三拍那句
// 「问你起没起/吃没吃」更是换谁都成立的万能句。跟如果馆那次同一个形状。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), eng = R("engine.js");
const cut = (s, a, b) => { const i = s.indexOf(a); return s.slice(i, s.indexOf(b, i + a.length)); };
const hint = cut(app, "【此刻·隔了一阵后主动开口】", "\n      : \"\";");

test("撤掉那张清单，改成挡住两个最省力的开口", () => {
  // ⚠️清单本身就是模板：给了它就会在里头挑，而且总挑第一项
  assert.ok(hint.indexOf("优先从你此刻正在做的事、刚遇到的小事") < 0, "那张清单还在");
  // ① 报备行踪
  assert.match(hint, /报备行踪——「我在 X」「刚做完 Y」/, "没挡住「先说我在哪」那种开口");
  // ② 查岗式关心——四张截图里四个角色都在问这个
  assert.match(hint, /「你吃了吗」「你起床没有」「你睡了没」/, "没挡住「问你吃没吃起没起」");
  // ③ 连拼起来当模板也挡住：那正是她截图里的三拍
  assert.match(hint, /先报备、再顺带买点什么、最后问她起没起/, "没挡住把那两样拼成模板");
  // 光禁不行，得给正面判据
  assert.match(hint, /只有你、只有今天才会说出口的/, "没给正面判据");
  assert.match(hint, /这句话要是换个角色说出来也成立，就是没开口/, "那条通用判据没写");
});

test("规则只降概率：他自己说过的开口原样发回去", () => {
  // 存
  const save = cut(app, "      if (opts.proactive && words.length) {", "\n      }");
  assert.match(save, /String\(words\[0\] \|\| ""\)/, "记的不是开口那一句");
  assert.match(save, /\.slice\(0, 6\)/, "没有上限，会越攒越长");
  assert.match(save, /cur\.filter\(x => x !== first\)/, "同一句会在名单里堆好几遍");
  assert.match(app, /saveJSON\("x_openers", n\)/, "只在内存里，重开就没了");
  assert.match(app, /setOpeners\(loadJSON\("x_openers", \{\}\)\)/, "开机不读盘");
  // ⚠️只记【主动】那一路：被动回复本来就该顺着她的话走，记下来只会误伤
  assert.match(save, /^      if \(opts\.proactive && words\.length\)/m, "被动回复也被记进去了");
  // 发
  const avoid = cut(app, "      const openerAvoid = (opts.proactive && _openLines.length)", "\n      const proactiveHint");
  assert.match(avoid, /你前几次就是这么开口的，一句都不许再用/, "没把原话发回去");
  assert.match(avoid, /同一个起手式/, "只挡了字面重复，换几个字照样过");
  // ⚠️两处任务串都要接上——「一层写在两处，第二处没跟上」在这份文件里犯过太多次
  assert.equal((app.match(/callHint \+ proactiveHintAll \+ jiwenHint/g) || []).length, 2, "两处任务串没都接上");
  assert.ok(!/callHint \+ proactiveHint \+ jiwenHint/.test(app), "还有一处用的是没带避重的那个");
});
