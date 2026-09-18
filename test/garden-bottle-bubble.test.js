"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const game = rd("apps/fairy-garden/game.mjs");
const host = rd("js/fairy-garden.js");
const rules = rd("apps/fairy-garden/rules.js");
const html = rd("apps/fairy-garden/index.html");
const css = rd("apps/fairy-garden/style.css");

// 她 2026-09-17：「漂流瓶做吧宝宝」
test("捞漂流瓶要走到水边，一天一只", () => {
  assert.match(rules, /bottle:\{x:3\.8,z:5\.1\}/, "站位在月潭栈桥边");
  assert.match(world, /if\(kind==='bottle'\)return driftError\(s\)/);
  assert.match(world, /count\(\(s\.today \|\| \{\}\)\.bottle\) >= 1/);
  assert.match(world, /bottle:'捞漂流瓶'/, "不写进动作名表的话，一天一只那个计数存不住");
  assert.match(game, /\$\('bottle'\)\.onclick=\(\)=>request\('bottle'\)/);
  assert.match(html, /id="bottle-dialog"/);
});

test("新回信经宿主生成，捞瓶沿用原结算与存档", () => {
  assert.match(game, /await host.bottleReply\(row\)/);
  assert.match(game, /data=keepBottleReply\(data,row.id,out.reply,out.sender\)/);
  assert.match(host, /tag:"庭院漂流瓶回信"/);
});

// 当天就能捞到自己刚写的，那是记事本不是漂流瓶
test("自己封的那只要过几天才漂回来", () => {
  assert.match(world, /export const BOTTLE_DAYS = 7/);
  assert.match(world, /openDay: s\.day \+ BOTTLE_DAYS/);
  assert.match(world, /s\.day >= b\.openDay/);
});

// ⚠️它不是第二个背包（先例：codex 的收藏馆也是只读陈列）
test("捞上来不许多出任何新库存", () => {
  const seg = world.slice(world.indexOf("export function drawBottle"), world.indexOf("export const floating"));
  assert.doesNotMatch(seg, /shards:|things:|notes:|collection:/, "捞一只就多一片＝这水成了刷碎片的地方");
  assert.match(world, /它不是第二个背包/);
});

test("写字在手机那一侧，捞在游戏那一侧（跟花笺同一个分法）", () => {
  assert.match(game, /seal:text=>\{const err=sealError\(data,text\)/);
  assert.match(host, /\["bottle", "漂流瓶"/);
  assert.match(host, /g\.seal\(bottleText\)/);
});

// 她 2026-09-17：「在里面说话角色也可以头上显示气泡，然后名字不要那么明显一个框」
test("他说的话浮在头顶上，气泡跟着他走", () => {
  assert.match(html, /id="companion-bubble"/);
  assert.match(css, /#companion-bubble\{[^}]*position:absolute/);
  assert.match(css, /#companion-bubble::after\{/, "气泡要有个指着他的小尖，不然就是一张飘着的卡片");
  assert.match(game, /speak:\(text,who\)=>\{speak\(text,who\);return true;\}/);
  assert.match(host, /game\(\)\.speak\(result\.parts\)/, "递进去的是拆好的那几条");
  assert.match(game, /bubble\.style\.top=Math\.max\(y-19,/, "让开名字那一行");
  assert.match(game, /bubble\.hidden=offscreen\|\|!speaking/, "他走出画面，气泡要跟着收起来");
  // 停留时长按字数走：两个字和两百个字读完要的时间不一样
  assert.match(game, /BUBBLE_MIN\+line\.length\*BUBBLE_PER_CHAR/);
  // ⚠️只是把已经收到的那句显示一遍，不另存、也不另发

  const seg = game.slice(game.indexOf("function speak(text)"), game.indexOf("function updateCompanionUI"));
  assert.doesNotMatch(seg, /save\(\)|host\.|callAI/, "气泡不许自己存一份聊天记录");
});

test("名字退成一行淡字，不再是一个框", () => {
  const tag = css.match(/#companion-tag\{[^}]*\}/)[0];
  assert.match(tag, /background:none/);
  assert.match(tag, /border:0/);
  // ⚠️去掉底色之后浅色背景上还得看得清：靠描边，不靠底色
  assert.match(tag, /text-shadow:/);
});

// ⚠️只写 max-width 的话，气泡宽度会被【它离右边还有多远】掐住：
//   他站在画面右边时可用宽度只剩几十像素，同一句话被挤成一长条。
test("气泡的宽度按内容算，不被他站的位置掐住", () => {
  const bubble = css.match(/#companion-bubble\{[^}]*\}/)[0];
  assert.match(bubble, /width:max-content/);
  assert.match(bubble, /max-width:min\(62vw,250px\)/);
});

// top 是气泡的【底边】：他站在画面很上面时，整只气泡会跑到屏幕外头去
test("他站得太靠上时气泡压下来，不许顶出屏幕", () => {
  assert.match(game, /Math\.max\(y-19,118\+bubble\.offsetHeight\)/);
});
