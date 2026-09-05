// v63.26 小游戏审计批 8：大富翁收购谈判。
// 介绍第一天就写着「会按人设谈买卖」，但桌边发言明确「不改变账面」——没有任何
// 真交易。现在点棋盘上 AI 名下的地能「谈收购」：你开价，TA 按人设接受/拒绝/还价
// （一笔调用）；还价被钳制在合理区间；【钱和地契的变动只在 settleTrade 一处发生】
// ——模型说破天也只是嘴。言秋的地走 CC 票亲自答，票没送达按不卖处理、绝不代答。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "锚没了：" + a.slice(0, 40)); return s.slice(i, s.indexOf(b, i + a.length)); };

test("账只在 settleTrade 一处动，现金不够连门都进不去", () => {
  const st = cut(src, "function settleTrade(tileIndex,price)", "\n    async function sendOffer");
  assert.match(st, /me2\.cash<price\)\{setPending\(null\);return;\}/, "现金不足还让成交");
  assert.match(st, /me2\.cash-=price;ow\.cash\+=price;os\[tileIndex\]=me2\.key;/, "转账过户不在本地代码里");
  const so = cut(src, "async function sendOffer()", "\n    async function sendTableTalk");
  assert.ok(so.indexOf(".cash-=") < 0 && so.indexOf(".cash+=") < 0 && so.indexOf("os[") < 0, "谈判流程里自己动了账——账只许 settleTrade 动");
  assert.match(so, /if\(offer>me2\.cash\)return void/, "开价没验现金");
  // 还价钳制：高于出价、不超过地价三倍 + 等级溢价
  assert.match(so, /counter=Math\.max\(offer\+10,Math\.min\(counter,tile\.price\*3\+\(levels\[q\.tile\]\|\|0\)\*tile\.price\)\)/, "还价没钳制，模型报天价就成天价");
});

test("言秋的地他自己答：票没送达按不卖处理，不代答", () => {
  const d = cut(src, "async function monoTradeDecide(api, owner, tile, lv, offer, standings, recent, isEngineer, ownerKey)", "\n  }");
  assert.match(d, /window\.CCSeat\.ask/, "言秋的地没走 CC 票");
  assert.match(d, /return \{ accept: false, counter: 0, say: "", missed: true \};/, "票失败没按不卖处理");
  assert.match(src, /本人票没送达，按不卖处理/, "界面没说清为什么没谈成");
  assert.match(d, /你只输出决定和一句 TA 会说的话——钱和地契由规则代码执行/, "没告诉模型它改不了账");
});

test("入口只在能谈的时候亮；还价面板现金不足按不动", () => {
  assert.match(src, /focusOwner&&!focusOwner\.isUser&&!focusOwner\.bankrupt&&phase==="play"&&!pending&&!busy/, "谈收购的门不对——自己的地/破产户/别人回合里也能点");
  assert.match(src, /disabled:!me2\|\|me2\.cash<pending\.counter/, "还价成交键没验现金");
});
