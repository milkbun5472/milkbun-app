"use strict";
// 不只是点点点（她 2026-09-18）：时钟环、星图近景、集市摊面、蔫花看得见、取水／做灯／唤醒的小人动作
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const game = rd("apps/fairy-garden/game.mjs");
const html = rd("apps/fairy-garden/index.html");
const css = rd("apps/fairy-garden/style.css");
const doll = rd("apps/fairy-garden/doll-life.mjs");
const magic = rd("apps/fairy-garden/magic-view.mjs");
const market = rd("apps/fairy-garden/market-view.mjs");
const chartView = rd("apps/fairy-garden/starchart-view.mjs");

test("时钟环：七点到二十三点走一圈，天黑前变暖、夜里变蓝，每分钟刷新", () => {
  assert.match(html, /<svg class="day-ring" id="day-ring"/);
  assert.match(html, /<circle class="arc" id="day-arc"/);
  assert.match(game, /const frac=Math\.max\(0,Math\.min\(1,\(data\.minute-420\)\/960\)\)/);
  assert.match(game, /ring\.classList\.toggle\('dusk',data\.minute>=dusk-90&&data\.minute<dusk\);ring\.classList\.toggle\('night',data\.minute>=dusk\)/);
  assert.match(game, /function ui\(\)\{drawDayRing\(\);/);
  assert.match(game, /function refreshTime\(\)\{\n refreshLeisure\(\);drawDayRing\(\);/, "分钟走了环也得走");
  assert.match(css, /\.day-ring\.dusk \.arc\{stroke:#d3a35a\}/);
  assert.match(css, /stroke-dasharray:94\.25/);
});

test("星图那一夜：六片拖到位才亮，拼齐才结算，中途关掉零消耗", async () => {
  const { createStarChart } = await import("../apps/fairy-garden/starchart.mjs");
  const c = createStarChart("seed");
  assert.equal(c.stage, "place"); assert.equal(c.pieces.length, 6);
  assert.ok(c.pieces.every((p, i) => Math.hypot(p.x - c.slots[i].x, p.y - c.slots[i].y) > .3), "一开始不许有一片已经压在自己位置上");
  assert.equal(c.grab(9, 9), false, "离得远抓不到");
  const first = c.pieces[0];
  assert.ok(c.grab(first.x, first.y)); assert.equal(c.held, 0);
  c.drag(c.slots[3].x, c.slots[3].y);
  assert.equal(c.drop(), false, "拖到别人的位置不算");
  assert.ok(!c.pieces[0].placed);
  let commits = 0;
  for (const p of c.pieces) { c.grab(p.x, p.y); c.drag(c.slots[p.slot].x + .1, c.slots[p.slot].y - .1); assert.ok(c.drop()); }
  assert.equal(c.stage, "ready"); assert.equal(c.count, 6);
  assert.equal(c.tick(.1, () => { commits++; return { ok: true }; }), undefined, "没送出去之前不结算");
  assert.ok(c.send());
  let out; for (let i = 0; i < 40 && out === undefined; i++) out = c.tick(.1, () => { commits++; return { ok: true }; });
  assert.equal(commits, 1); assert.equal(c.stage, "done");
  // 按住辅助：一片一片自己归位
  const h = createStarChart("other"); for (let i = 0; i < 80; i++) h.help(.1);
  assert.equal(h.stage, "ready");
  // 同一颗种子散得一样（读档重开不重摇）
  assert.deepEqual(createStarChart("k").pieces.map(p => [p.x, p.y]), createStarChart("k").pieces.map(p => [p.x, p.y]));
  // 游戏那头：点「摊开星图」先进近景，拼齐那一刻才 keepStarNight，那一枪在那之后
  assert.match(game, /starchart\.open\(\{position:actor\.position,height:floorHeight\(data\.map,actor\.position,data\),helper:companionNearby\(data\),seed:data\.epoch\+':night:'\+data\.day,commit:\(\)=>\{/);
  assert.match(game, /if\(!starNightReady\(data\)\)return \{ok:false,text:'这会儿拼不成：得是夜里，两个人都在旧塔。'\};/);
  assert.match(game, /missing=true;data=keepStarNight\(data\);ui\(\);save\(\);\n  sayStarNight\(\);/);
  assert.match(game, /if\(starchart\.active\)\{starchart\.update\(dt,clock\);/);
  assert.match(chartView, /dialog\.className='scene-activity brewing-dialog'/, "走画咒那套外壳");
});

test("集市摊面：货和摊主在场景里，点货走过去买，摊位几何来自 rules", () => {
  assert.match(market, /import \{MAPS,MARKET_GOODS,MARKET_RARE,FOODS,marketStock,marketOpen,marketError,nightStock,nightMarketOpen,foodError,stallOf,vendorAt,vendorSpot\} from '\.\/world\.mjs/);
  assert.match(market, /g\.group\.visible=g\.night===night&&stock\.includes\(id\)/, "没上摊的货不摆出来；白天一排夜里一排");
  assert.match(market, /const stalls=Object\.fromEntries\(MAPS\.garden\.market\.stalls\.map\(s=>\[s\.kind,s\]\)\)/);
  assert.doesNotMatch(market, /cost:\s*\d/, "价钱只在 world.MARKET_GOODS 一处");
  assert.match(market, /setDoll\(source\)/);
  assert.match(game, /const good=marketView\.pick\(ray\);if\(good\)\{buyGood\(good\);return;\}/);
  assert.match(game, /if\(go\(front,\{kind:'buy',id\}\)\)/);
  assert.match(game, /if\(kind==='buy'\)\{const id=acting\.id;acting=null;\$\('progress'\)\.hidden=true;const food=!!\(foodOf\(id\)\|\|recipeOf\(id\)\);const err=food\?foodError\(data,id\):marketError\(data,id\);if\(err\)\{say\(err\);ui\(\);return;\}data=food\?buyFood\(data,id\):buy\(data,id\);marketView\.fly\(id,/);
  assert.match(game, /dollSource=a\.scene;marketView\.setDoll\(dollSource\);/);
  assert.match(game, /marketView\.update\(data,clock,dt\);/);
});

test("蔫花看得见：茎垂下去、叶子发灰，浇回来慢慢抬起", () => {
  assert.match(magic, /droop\+=\(\(m\.wilted\?1:0\)-droop\)\*Math\.min\(1,dt\*1\.6\);plant\.rotation\.z=droop\*\.62/);
  assert.match(magic, /leaf\.color\.copy\(leafHealthy\)\.lerp\(leafWilted,droop\)/);
});

test("取水拉井绳、做灯举灯罩、唤醒种子两个人都伸手：小人真的动", () => {
  assert.match(doll, /if\(job\.kind==='well'\)return 'draw';if\(job\.kind==='lamp'\)return 'lamp';if\(job\.kind==='seed'\)return 'hold';/);
  assert.match(doll, /job\?\.kind==='well'\?2\.8:job\?\.kind==='lamp'\?3\.2:/);
  assert.match(doll, /bucket\.name='WellBucket'/); assert.match(doll, /lampProp\.name='StarLamp'/);
  assert.match(doll, /if\(drawing\)\{const pull=Math\.sin\(p\*Math\.PI\*5\);/);
  assert.match(doll, /if\(lamping\)\{arms\.rightArm\.rotation\.x=arms\.leftArm\.rotation\.x=\(-2\.1-p\*\.5\)\*envelope;/);
  assert.match(doll, /bulb\.material\.emissiveIntensity=ease\(p\)\*1\.4;/, "光一点点装进灯罩");
  assert.match(game, /if\(acting\?\.kind==='seed'&&companionAvatar&&companionNearby\(data\)\)\{const c=data\.companion;companionAvatar\.root\.rotation\.y=Math\.atan2\(actor\.position\.x-c\.position\.x,actor\.position\.z-c\.position\.z\);companionAvatar\.animate\(clock,\{gesture:'hold'/);
});
