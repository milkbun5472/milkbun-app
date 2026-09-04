// 她 2026-09-04 一口气问的四件事
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

test("愿望板也进聊天了，而且跟七栏分开说、带围栏", () => {
  const i = app.indexOf("const coupleArchiveFor = charId =>");
  const fn = app.slice(i, i + 2600);
  // 它跟七栏不是一回事：七栏是【已经是这样了】，愿望板是【说好想做、还没做成】
  assert.match(fn, /【你俩的愿望板 · /, "愿望板没接进聊天");
  assert.ok(fn.indexOf("wishBlock") > 0, "没单独成一段——混进七栏里就把两种东西说成一种了");
  assert.match(fn, /\.slice\(0, 5\)/, "没封顶，愿望多了会挤掉别的上下文");
  assert.match(fn, /不是待办清单/, "没围栏：他会天天催「我们什么时候去」");
  // 三条路共用同一份（four-surfaces-same-context.md）：这一层只写在 coupleArchiveFor 里，
  // 所以群线上/群线下白得，不用各接一遍
  assert.equal((app.match(/【你俩的愿望板/g) || []).length, 1, "抄成了两份");
});

test("纪念日提前几天就知道——跟生日那一档挨着写", () => {
  // 她 2026-09-04：「应该是进日历然后他提前几天就会知道对吧」。
  // 原来只有当天那一句；生日旁边早就有 cdu<=5 那一档，纪念日一直没有。
  assert.match(app, /const ANNIV_HEADS_UP = 5;/, "提前几天那个数没了");
  const i = app.indexOf("const ANNIV_HEADS_UP = 5;");
  const seg = app.slice(i, i + 1800);
  assert.match(seg, /else if \(dTo <= ANNIV_HEADS_UP\) \{/, "在一起周年那一路没有提前几天的闸");
  assert.match(seg, /再过 " \+ dTo \+ " 天就是你和 " \+ uName \+ " 在一起的纪念日/, "在一起周年没有提前那一句");
  assert.match(seg, /再过 " \+ nx\.days \+ " 天就是你和 " \+ uName \+ " 的「/, "自定义纪念日没有提前那一句");
  // 别把提前那句写成任务
  assert.match(seg, /看你自己的性子，别当成任务/);
  // 已经过去的不许倒着报（annivNext 对不重复的过期项给负数）
  assert.match(seg, /nx\.days > 0 && nx\.days <= ANNIV_HEADS_UP/, "没挡住负数——过期的会报成「再过 -3 天」");
});

test("里程碑/纪念日的入口是那两样东西本身，不是两颗药丸", () => {
  // tabs-not-plain-pills.md 的判据：原样搬到别的 app 里还成立吗？
  // 这一页现实里是【一条走过来的路 + 一本挂历】，所以两个入口就长成那两样。
  const i = scr.indexOf("function CoupleDays(");
  const seg = scr.slice(i, scr.indexOf("// 情书信纸字体", i));
  assert.ok(seg.indexOf("＋ 里程碑") < 0 && seg.indexOf("＋ 纪念日") < 0, "那两颗药丸还在");
  assert.match(seg, /\["mile", "钉一处", "路上真发生过的一天"/, "里程碑那个入口不是「路上钉一处」");
  assert.match(seg, /\["anniv", "撕一张", "还没到、值得等的那天"/, "纪念日那个入口不是「撕一张日历页」");
  // 选中那一张要长进底下的纸里（下沿方角 + 盖住那条边），照账本索引标签那套
  assert.match(seg, /borderRadius: on \? "14px 14px 0 0" : 14/, "选中的那一格没跟底下那张纸接上");
  assert.match(seg, /borderBottom: on \? "1px solid " \+ t\.bg2/, "接缝那条线没盖掉，看着还是两块");
  // 输入不再是圆角灰框，是写在线上
  assert.ok(seg.indexOf("const inp = {") < 0, "旧那套普通框还在");
  assert.match(seg, /borderBottom: "1px dashed " \+ t\.line/, "输入没改成写在线上");
  assert.match(seg, /"钉在这一天"/); assert.match(seg, /"挂上去"/);
  // 点得着：两个入口的可点区域别缩水（mobile-ui-layout.md §5 那一条的同源要求）
  assert.match(seg, /padding: "11px 10px 12px"/, "入口的可点区域太小了");
});

test("挂历页一处画三处用，不许各画一份", () => {
  assert.equal((scr.match(/function CalPage\(/g) || []).length, 1, "CalPage 抄成了两份");
  assert.ok((scr.match(/h\(CalPage, \{/g) || []).length >= 3, "有一处还在自己画日历页");
  // 原来那份内联的必须删干净，否则改个红色要改两遍
  assert.ok(scr.indexOf('h("div", { style: { background: info.passed ? "#a09890" : "#c25a5a"') < 0, "倒数列表还留着自己画的那一份");
});

test("如果馆开局说明也改成「同样的我们」", () => {
  assert.doesNotMatch(scr, /同样这两个人/);
  assert.match(scr, /"同样的我们、同样这段关系，只换掉当初的一样东西。留空就让他自己想一条。"/);
});

test("我们的日子让他写的那一条，走的是 runProbe（bundle 白得）", () => {
  // 她 2026-09-04 问「让他写也喂了 bundle 吧？（我是不是问过了）」——是的，一直是。
  const i = app.indexOf("const genTimelineMusing = async (char, occasion)");
  assert.ok(i > 0, "genTimelineMusing 没了");
  const seg = app.slice(i, i + 700);
  assert.match(seg, /runProbe\(apiFor\(char\.id\), ctxFor\(char\), \{/, "改成自己拼 sys 了——那就等于人设心情记忆全丢（四处一样喂那条）");
  assert.match(seg, /voice: true/, "没走本人口吻那一路");
});
