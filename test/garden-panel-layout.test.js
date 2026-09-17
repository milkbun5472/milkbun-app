"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const css = rd("apps/fairy-garden/style.css");
const html = rd("apps/fairy-garden/index.html");
const game = rd("apps/fairy-garden/game.mjs");

// 她 2026-09-17 截图：「照规矩不能有顶上那个框，现在相当于你有两块顶部了」
// ⚠️外面那层 Head 已经是顶栏了（施工规则/mobile-ui-layout.md：不要重新发明顶栏）。
test("装进小手机里时，游戏这头不许再画一条顶栏", () => {
  assert.match(css, /body\.embedded header\{display:none\}/, "游戏自己那条大标题栏");
  // 「说句话」跟 Head 上那颗「说话」重了
  assert.match(css, /body\.embedded #host-talk\{display:none\}/);
  // 「睡到明天」本来就是个行动，搬进行动面板，顶上那一条只剩日期
  const panel = html.slice(html.indexOf('id="panel-content"'), html.indexOf('class="bag"'));
  assert.match(panel, /id="rest"/, "睡到明天要在面板里");
  const weather = html.match(/<aside class="weather">[\s\S]*?<\/aside>/)[0];
  assert.ok(!/id="rest"/.test(weather), "顶上那一条还留着按钮＝还是一条工具栏");
  assert.ok(!/说句话/.test(weather.replace(/id="host-talk"[^>]*>说句话/, "")), "只剩 host-talk 那一颗，而它已经被 CSS 关掉");
});

// 她：「这个行动也太挤了」
// ⚠️做不了的那些【照样要留着】——她得看得见还有这么一件事，也得看得见为什么做不了
//   （按钮上写着「锅里还没材料」「花还没开」）。所以不是删掉，是收进一格。
test("这会儿做不了的收进一格，不在面板里排一屏灰按钮", () => {
  assert.match(html, /<details id="blocked"/);
  assert.match(game, /function tidyActions\(\)/);
  assert.match(game, /const away=b\.disabled&&!b\.hidden&&!acting;/);
  // ⚠️只认 disabled，不逐个按钮写规则：以后再加行动，这儿一个字都不用改
  assert.match(game, /只认 disabled，不逐个按钮写规则/);
  assert.match(game, /wrap\.hidden=!blocked;/, "一件都没有的时候不许还挂着那一格");
  // 收拾要排在 ui() 算完所有 hidden/disabled 之后
  const fn = game.slice(game.indexOf("function ui()"), game.indexOf("function tidyActions"));
  assert.match(fn, /tidyActions\(\);\n\}/, "排在 ui() 最后一行");
});

// 一行挤三颗时中文标签会折成两三行
test("行动按钮换行走，一行两颗，不被挤扁", () => {
  assert.match(css, /\.secondary-actions\{flex-wrap:wrap\}/);
  assert.match(css, /\.secondary-actions>button\{flex:1 1 calc\(50% - 6px\);min-width:118px\}/);
  // 换行之后「最后一颗加深」会落在半路上，看着像随机有一颗颜色不一样
  assert.match(css, /换行之后那一颗常常落在半路上/);
});
