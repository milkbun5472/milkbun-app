// v63.21 小游戏审计批 6：真心话大冒险的散场收口。
// 它是唯一没有终局的一桌——只能一直转或弃局，存档标签也只会写「转了几次」。
// 现在转满 3 轮后可以「散完这一场」：一笔调用评一位【今晚之星】（裁判口吻点评，
// 不代任何人写感言）+ 2~3 句散场话；星卡收尾、清存档、可以再开一场。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "锚没了：" + a.slice(0, 40)); return s.slice(i, s.indexOf(b, i + a.length)); };

test("散场是收口不是弃局：够三轮才亮、评完清档、能再开一场", () => {
  assert.match(src, /x\.type === "td"; \}\)\.length >= 3\n\s*\? h\("div"/, "不满三轮也能散——那跟弃局没区别");
  const w = cut(src, "const doWrap = async function ()", "\n    };");
  assert.match(w, /clearGameSave\("tod"\)/, "散完没清存档，中枢还挂着「还摊在桌上」");
  assert.match(w, /\{ type: "star", name: star\.name/, "今晚之星没进日志");
  const r = cut(src, "const resetEvening = function ()", "\n    };");
  assert.match(r, /logDataRef\.current = \[\];/, "再开一场没清同步镜像——记忆会把上一场当这一场");
  assert.match(r, /lastTargetRef\.current = ""; lastAskerRef\.current = "";/, "轮转指针没归零");
  // 散了以后不再往存档里写
  assert.match(src, /if \(busy \|\| phase !== "idle" \|\| wrap\) return;\n\s*saveGameSnap\("tod"/, "散场之后还在续存档");
});

test("评选权在裁判、散场话不代笔：言秋不进散场话名单，但可以当今晚之星", () => {
  const g = cut(src, "async function genTDWrap(api, players, log)", "\n  }");
  assert.match(g, /!p\.isUser && !p\.engineer/, "散场话名单没把真人和言秋摘出去");
  assert.match(g, /裁判口吻/, "点评没锁在裁判位上");
  const w = cut(src, "const doWrap = async function ()", "\n    };");
  assert.match(w, /if \(!p\.isUser && !p\.engineer\) valid\[p\.name\] = 1;/, "散场话的落地过滤和名单不一致——模型编个名字也会上桌");
});

test("星卡真渲染，散场后有收尾面板", () => {
  assert.match(src, /今 晚 之 星/, "星卡没了");
  const ui = cut(src, "else if (wrap) {", "else {");
  assert.match(ui, /再开一场/, "散场后没有再开一场");
  assert.match(ui, /回中枢/, "散场后没有回中枢");
});
