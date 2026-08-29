const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), eng = R("engine.js");

// 她 2026-08-27 拿参考 app 逐轮对了一遍：一轮总字数两边都是 40~67，
// 平均每条却是 10~13 对 17~21——他不是话多，是没断开。
// 查下来「把话拆成多条短气泡」那句只活在两个不发出去的串里：
//   selfTask（只进 _digitalTaskFull，只给言秋）、_normalTaskFull（注释写着不再发送）。
// v2 切换的时候没跟过来，普通角色一个字都没收到。
test("普通角色真的收到断句这条，不是只躺在没人用的串里", () => {
  // 每轮那串的最后一句（_turnClosing）拼在 _normalTaskV2 末尾，临落笔前读到的就是它
  const i = app.indexOf("const _turnClosing =");
  const closing = app.slice(i, i + 900);
  assert.match(closing, /【一条一句】/, "收尾那句里得有");
  assert.match(closing, /别拿逗号缝成一条/);
  assert.match(app, /crossSamenessHint\(charId\) \+ _biTurnLine \+ _turnClosing\)/, "收尾那句没拼进每轮任务串");
  // 字段定义上也写一句——和双语同一个落法，这是最强的位置
  assert.match(app, /word: string\[\]，角色实际发送的消息。【一个元素＝一句话】/, "字段定义上没写");
  assert.match(app, /想说三句就给三个元素/);
});

test("稳定规则里也有一条硬的，且不点字段名（群聊那份要读得通）", () => {
  assert.match(eng, /【说多少自由，一条里塞几句不自由】一条消息＝一句话/);
  assert.ok(!/一个 word 元素＝一句话/.test(eng), "写死 word 的话群聊那份就是错的");
  assert.match(app, /ONLINE_CHAT_RULE_V2\.replace\("word 只包含", "每条 text 只包含"\)/, "群聊仍旧只换字段名那一处");
});

// 关键是别再自相矛盾：说多少自由，一条里塞几句不自由
test("数量仍旧自由——不是把话多的人一起收了", () => {
  assert.match(eng, /一轮说几条、总共说多长，没有固定格式/);
  assert.match(eng, /话多的人连发几条、絮絮叨叨、主动分享和追问，只要是这个人的常态，就不是需要修剪的毛病/);
  assert.ok(!/数量、长度、断句和完整程度没有固定格式/.test(eng), "「断句自由」要拆走，它跟硬规则打架");
});

// 代码兜底只当急救，门槛不动——降到十几字会把「嗯，好，知道了」这种碎句切烂
test("兜底门槛照旧 22，靠提示词管风格、靠代码管急救", () => {
  const i = eng.indexOf("function splitLongBubble(s, allowComma)");
  const seg = eng.slice(i, i + 300);
  assert.match(seg, /const LONG = 22, MIN = 8, TAIL_MIN = 6, MAX_CHUNKS = 4;/, "门槛被动过了");
  // v57.78 起函数上面还有三个千分位小工具，得一起带上
  const helpers = eng.slice(eng.indexOf("const BUBBLE_NUMSEP"), i);
  const fn = new Function(helpers + eng.slice(i, eng.indexOf("\n}\n", i) + 3) + "\nreturn splitLongBubble;")();
  // 她圈出来的那两条正卡在门槛底下：代码救不了，得靠提示词让模型自己一句一条
  assert.equal(fn("给你点了，但必须先把热三明治吃完才准喝", true).length, 1);
  assert.equal(fn("不然下次生理期肚子疼某些人又要找我算账了", true).length, 1);
  // 真正的病句仍旧救得回来
  assert.equal(fn("早饭给你热在微波炉里了，热美式和三明治，自己记得拿出来吃", true).length, 3);
  // 碎句一个字都不许动
  assert.equal(fn("嗯，好，知道了", true).length, 1);
});
