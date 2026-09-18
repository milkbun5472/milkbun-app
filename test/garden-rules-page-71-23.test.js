"use strict";
// 村里的规矩那一页 + 花册的竖排索引签（她 2026-09-18：「要不要写一份简易版攻略」「做吧」「按换在另一个 app 还成立吗的规矩换一下这个形状」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const book = rd("apps/fairy-garden/season-book.mjs");
const html = rd("apps/fairy-garden/index.html");
const css = rd("apps/fairy-garden/style.css");
const host = rd("js/fairy-garden.js");
const W = () => import("../apps/fairy-garden/world.mjs");

test("规矩只写规律不写结果；数字全从表里取，不手写", async () => {
  const w = await W();
  const rows = w.villageRules();
  assert.ok(rows.length >= 12 && rows.length <= 16);
  for (const r of rows){ assert.ok(r.head && r.text.length > 20, r.head); assert.ok(!/undefined|NaN/.test(r.text), r.head); }
  const by = Object.fromEntries(rows.map(r => [r.head, r.text]));
  assert.match(by["集市"], new RegExp("每季 " + [4, 8, 12].join("、") + " 日开"));
  assert.match(by["夜市"], new RegExp("每季 " + w.NIGHT_MARKET_DAYS.join("、") + " 日天黑后开"));
  assert.match(by["夜市"], new RegExp("最多装 " + w.PANTRY_CAP + " 样"));
  assert.match(by["灯会"], new RegExp("第 " + w.FESTIVAL_DAY + " 天晚上")); assert.match(by["灯会"], /一朵星铃花、三朵月光花、一样吃的/);
  assert.match(by["花圃"], new RegExp(w.SEED_DAYS + " 天开花"));
  assert.match(by["公告栏"], new RegExp("每 " + w.QUEST_CYCLE + " 天换一次板子，一次最多接 " + w.QUEST_TAKEN_MAX + " 件"));
  assert.match(by["递东西"], new RegExp("一天只递 " + w.GIFT_PER_DAY + " 样"));
  assert.match(by["相处册"], new RegExp(w.BOND_TIERS.map(([n, l]) => l + "（" + n + " 种）").join(" → ")));
  assert.match(by["井"], new RegExp("最多 " + w.DEPTH_MAX + " 层")); assert.match(by["井"], new RegExp("第 " + w.STAR_CHART_FROM + " 颗以后")); assert.match(by["井"], new RegExp("攒够 " + w.STAR_CHART_NEED + " 片"));
  assert.match(by["漂流瓶"], new RegExp(w.BOTTLE_DAYS + " 天到"));
  assert.match(by["邻居"], new RegExp("有 " + w.NEIGHBOR_HOUSES.length + " 间邻居屋"));
  assert.match(by["一天"], new RegExp("取水 " + w.ACTION_MINUTES.well + " 分"));
  // 不剧透：不写摊上有什么、那一夜发生什么、井底有什么
  const all = rows.map(r => r.text).join("");
  assert.doesNotMatch(all, /梦种|完整的碎片|沉睡旧物|回声石|梦屑/, "写规律，不写结果");
  const seg = world.slice(world.indexOf("// ── 村里的规矩"), world.indexOf("export const COLLECTION_CAP"));
  assert.doesNotMatch(seg, /callAI|host\./); assert.match(seg, /只写【规律】，不写【结果】/);
});

test("季节手册：两条丝带书签切页；第一次翻开落在规矩页，之后落在日历；读不到本机记录就当没看过", () => {
  assert.match(html, /<div class="ribbons" role="tablist" aria-label="手册的两条书签"><button class="ribbon" id="season-tab-calendar" role="tab">这一季<\/button><button class="ribbon" id="season-tab-rules" role="tab">村里的规矩<\/button><\/div>/);
  assert.match(html, /<div class="book-body"><div id="season-page-calendar"><p id="season-summary">/);
  assert.match(html, /<div id="season-page-rules" hidden><p class="rules-lead">/); assert.match(html, /<div id="season-rules" class="rules"><\/div>/);
  assert.match(book, /const SEEN='fairy-garden-rules-seen';let page=\(\(\)=>\{try\{return localStorage\.getItem\(SEEN\)\?'calendar':'rules';\}catch\(e\)\{return 'rules';\}\}\)\(\);/);
  assert.match(book, /if\(page==='rules'\)\{try\{localStorage\.setItem\(SEEN,'1'\);\}catch\(e\)\{\}\}/);
  assert.match(book, /for\(const r of villageRules\(\)\)\{const row=el\('div'\);row\.className='rule';row\.append\(el\('b',r\.head\),el\('span',r\.text\)\);/);
  assert.match(book, /\$\('season-open'\)\.onclick=\(\)=>\{draw\(\);drawRules\(\);showPage\(page\);/);
  // 丝带：竖排字、垂下来、选中那条更长更深；可点区不低于 40px 宽
  assert.match(css, /\.season-dialog \.ribbon\{display:block;margin:0;min-width:40px;padding:14px 9px 16px;writing-mode:vertical-rl/);
  assert.match(css, /\.season-dialog \.ribbon\.on\{background:#55704f;padding-top:34px/);
  assert.match(css, /clip-path:polygon\(0 0,100% 0,100% calc\(100% - 8px\),50% 100%,0 calc\(100% - 8px\)\)/, "丝带尾巴是燕尾");
  assert.match(css, /#season-page-calendar\[hidden\],\.season-dialog #season-page-rules\[hidden\]\{display:none\}/, "dialog div 那条通用样式压不住 hidden，得写死");
});

test("花册的 tab：册子右边伸出来的一列竖排索引签，不再是横排一行挤到屏幕外", () => {
  const seg = host.slice(host.indexOf('[["notes", "花册"'), host.indexOf('bookTab === "bond" ?'));
  assert.match(seg, /writingMode: "vertical-rl"/);
  // ⚠️别钉死 minHeight 的数字：v71.24 她说「三个字的塞不下，做大点」，那个数就该能调。
  //   要钉的是【可点区不许比 48 矮】和【高度由内容撑、不许封顶】。
  const mh = /minHeight: (\d+)/.exec(seg);
  assert.ok(mh && Number(mh[1]) >= 48, "可点区矮过 48 了");
  assert.doesNotMatch(seg, /maxHeight/, "给签子封了顶——封了顶三个字就又塞不下了");
  assert.match(seg, /flexShrink: 0/, "壳是 height:0，不关掉 shrink 会被压到一列一个字（字看着从右往左读）");
  assert.match(seg, /background: on \? G\.paper : tint/, "每张一个色，选中那张纸色");
  assert.match(seg, /transform: on \? "translateX\(0\)" : "translateX\(7px\)"/, "没选的往边上缩进去");
  assert.match(seg, /"aria-pressed": on/);
  assert.doesNotMatch(seg, /borderRadius: "11px 11px 0 0"/, "横排那版退役了");
  assert.match(host, /position: "sticky", top: headH \+ 10, height: 0, zIndex: 3/);
  assert.equal((host.match(/padding: "16px 54px 40px 16px"/g) || []).length, 9, "九个页面都给索引签让出右边");
  assert.doesNotMatch(host, /padding: "16px 16px 40px"/);
});
