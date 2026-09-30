// 聊天设置有几格，攻略就得写几格（她 2026-09-30 让我「顺便检查 bug」时撞见的）
//
// 当时界面上是【九件事】（性/动/记/窗/衣/听/房/线/清），而攻略还写着「关于他的七件事」，
// 只列了七类——**衣**和**听**这两格在攻略里等于不存在，秋秋照着答就是错的。
// 加这两格的那几版都把 STAMP 写成 entries:[]，于是那道「每版必对攻略」的闸
// 每次都是绿的：**它只问「这一版对过没有」，不问「对得对不对」。**
//
// 所以这一条不看 STAMP，直接拿【界面那张表】和【攻略那段话】对数：
// 组件里那九格是渲染时真用的，改一格必然改到它。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("聊天设置的每一格都在攻略里写着，件数也对得上", () => {
  const comp = fs.readFileSync("js/components.js", "utf8");
  const i = comp.indexOf("function ChatSettings({");
  assert.ok(i > 0, "抠不出 ChatSettings");
  const seg = comp.slice(i, i + 60000);
  // 界面那九格：单字分类牌
  const ui = [...new Set([...seg.matchAll(/["“]([性动记窗衣听房线清])["”]\s*,/g)].map(m => m[1]))];
  assert.ok(ui.length >= 7, "抠不到分类牌了，锚可能断了：" + ui.join("/"));

  const w = {};
  new Function("window", fs.readFileSync("js/assistant-manual.js", "utf8"))(w);
  const doc = w.AssistantManual.byId("chatcfg").doc;
  const inDoc = [...doc.matchAll(/- \*\*([性动记窗衣听房线清]) /g)].map(m => m[1]);

  const missing = ui.filter(x => !inDoc.includes(x));
  assert.deepEqual(missing, [],
    "界面上有这几格、攻略里没写：" + missing.join("/") +
    "（去 js/assistant-manual.js 的 chatcfg 补上，别只把 STAMP 版本号往上推）");

  const ZH = ["零","一","二","三","四","五","六","七","八","九","十"];
  const said = (doc.match(/关于他的(.)件事/) || [])[1];
  assert.equal(said, ZH[ui.length],
    "攻略说「" + said + "件事」，界面实际 " + ui.length + " 格");
});
