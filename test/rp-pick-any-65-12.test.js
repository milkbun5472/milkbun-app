"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const src = fs.readFileSync("js/fanfic.js", "utf8");

const bag = new Map();
global.localStorage = {
  getItem: k => bag.has(k) ? bag.get(k) : null,
  setItem: (k, v) => bag.set(k, String(v)),
  removeItem: k => bag.delete(k)
};
// fanfic.js 是给浏览器写的：顶层就用到 React/主题那一套。这儿只要模块里那几个
// 纯函数（protectedFic / saveRP），所以把它当浏览器载一次，缺什么补什么桩。
const noop = () => null;
global.React = { createElement: noop, useState: () => [null, noop], useEffect: noop, useRef: () => ({ current: null }), memo: x => x, Fragment: "f" };
global.window = { React: global.React };
global.loadJSON = (k, d) => { try { const v = JSON.parse(bag.get(k)); return v == null ? d : v; } catch (_) { return d; } };
global.saveJSON = (k, v) => { bag.set(k, JSON.stringify(v)); return true; };
require("../js/fanfic.js");
const F = global.window.Fanfic;

test.beforeEach(() => bag.clear());

// 她 2026-09-07：「我点加一篇只能选收藏的文，但是理论上所有的我从作者主页
// 可以直接加笔」——同一件事两套门槛，作者主页那一套才是对的。
test("挑一篇下笔：不再只列收藏的，作者主页放行什么这儿就放行什么", () => {
  assert.ok(src.indexOf('sub: "只有收藏进书架的才能加笔"') < 0, "那道门槛还挂在顶栏上");
  assert.ok(src.indexOf("只能穿进【已收藏进书架】的篇目") < 0, "那句灰字还在");
  assert.ok(src.indexOf("const shelf = (props.fics") < 0, "还在按 shelf 过滤");
  // 作者主页那一支从来没有门槛，两边现在是一致的
  assert.match(src, /onAddOn: function \(id\) \{ setRpStart\(id\); setView\("rp"\); \}/);
  // 收藏／自己写的排前面，其余按新旧
  assert.match(src, /const pa = window\.Fanfic\.protectedFic\(a\) \? 1 : 0/);
});

// ⚠️桩照着【写存档的那段】写：session 存的是 ficId（见 startSession 的对象字面量），
// fic 存的是 id / onShelf / source / liked（施工规则/stub-from-the-writer.md）
test("桩字段跟写存档那段对得上", () => {
  assert.match(src, /const sess = \{ id: uid\("rp"\), ficId: fic\.id, ficTitle: fic\.title/);
  assert.match(src, /if \(f\.onShelf === true \|\| f\.source === "user" \|\| f\.liked === true\) return true;/);
});

test("开着加笔的那一篇不许被清掉——不然一局手里就没原文了", () => {
  const plain = { id: "f1", title: "没收藏的", chapters: [] };
  assert.equal(F.protectedFic(plain), false);

  F.saveRP([{ id: "rp1", ficId: "f1", ficTitle: "没收藏的", createdAt: 1, updatedAt: 1 }]);
  assert.equal(F.protectedFic(plain), true, "加笔正在用的那一篇被判成可清理");

  // 会话删掉之后就不再护着它了（saveRP 是唯一写入方，缓存由它作废）
  F.saveRP([]);
  assert.equal(F.protectedFic(plain), false, "会话没了还护着＝又一座坟场");
  assert.match(src, /_rpFicIds = null;\s+\/\/ 名单变了/);
});

test("留不留一篇文的规矩只此一处", () => {
  // 加笔那边不许另立一条「加笔的也留着」
  assert.equal((src.match(/function protectedFic\(/g) || []).length, 1);
  assert.match(src, /if \(rpFicIdSet\(\)\.has\(String\(f\.id\)\)\) return true;/);
});

test("门口那段说明书删掉了，只留一句", () => {
  assert.ok(src.indexOf("⚠️作者本人就在旁边") < 0, "那段说明书还在");
  assert.ok(src.indexOf("顶上那条「原稿剩余」是这篇文还剩几成是她写的") < 0);
  assert.match(src, /"点住原文里的一句，从那句起就归你写；作者在旁边接招。"/);
});
