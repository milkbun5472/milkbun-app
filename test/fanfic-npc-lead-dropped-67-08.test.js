// 她 2026-09-11，一路追到底的那个：点「皇帝 × 王爷」出三篇，三篇全是「王爷 × 一只精怪」；
// 换一对「萧成烨 × 裴照川」再出三篇，三篇全是「裴照川 × 沈清和」——那两位都是配角出身。
//
// ⚠️不是提示词的问题：**那一位压根没进过提示词**。
//   挑人那一格用的是 cast（含配角的全量），生成那一枪用的是 characters（只有真人角色）。
//   于是配角出身的那一位在 cpChars 里解析不出来、被 filter(Boolean) 悄悄丢掉，
//   两个人的 CP 变成一个人 —— cpBlock 掉进「A × 原创对象」那一支，
//   提示词上写着「另一方是一个由你设定的原创角色」。模型照做了。
// 这是「一层写在两处、第二处没跟上」：picker 升级成 cast 的时候，这一枪没跟着升。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const fic = fs.readFileSync(path.resolve(__dirname, "..", "js/fanfic.js"), "utf8");
const code = fic.split("\n").map(l => l.split("//")[0]).join("\n");
const app = fic.slice(fic.indexOf("    const cast = props.allChars || characters;"));
assert.ok(app.length > 2000, "没切到 FanficApp");

test("生成那一枪用的是 cast，不是只有真人角色的那一份", () => {
  assert.match(app, /const chars = cpChars\(cp, cast, props\.profile\);/,
    "配角出身的那一位会在这儿被悄悄丢掉，CP 当场少一个人");
  // 按 CP 搜也一样：写配角的那几篇也得搜得出来
  assert.match(app, /const c = cast\.find\(function \(x\) \{ return x\.id === id; \}\);/);
  // 这一页里不许再有第二处拿 characters 去解析 cp
  // ⚠️这一条只许在 FanficApp 那一段里找：cpChars 的【定义】本身就叫
  //   function cpChars(cp, characters, profile)，拿整份文件去断永远是红的
  assert.ok(app.indexOf("cpChars(cp, characters") < 0, "这一页里还有一处在用窄的那一份");
});

test("解析不出来就别开枪：悄悄少一位＝花钱买一篇写跑的文", () => {
  const d = app.slice(app.indexOf("async function doGen("), app.indexOf("const run = async function"));
  assert.ok(d.length > 300, "没切到 doGen 的头");
  assert.match(d, /const missing = \(cp \|\| \[\]\)\.filter\(function \(tok\) \{\n\s*return tok && tok !== "me" && !cast\.some\(function \(c\) \{ return c && c\.id === tok; \}\);\n\s*\}\);/);
  assert.match(d, /if \(missing\.length\) \{/);
  assert.match(d, /这一对里有 " \+ missing\.length \+ " 位找不到了（多半是被删了），先去「谁和谁」重挑一下/);
  assert.match(d, /return;\n      \}/);
  // ⚠️查在【开枪之前】：查在后面等于钱已经花了
  const iMiss = d.indexOf("const missing ="), iToast = d.indexOf("已放到后台生成");
  assert.ok(iMiss > 0 && iToast > iMiss, "这一道查在开枪之后了");
  // 「我」不算找不到：她本人不在角色表里
  const box = {};
  vm.createContext(box);
  vm.runInContext("function miss(cp, cast) { return (cp || []).filter(function (tok) {"
    + " return tok && tok !== 'me' && !cast.some(function (c) { return c && c.id === tok; }); }); }"
    + "\nthis.f = miss;", box);
  const CAST = [{ id: "c1" }, { id: "npc1", npc: true }];
  assert.equal(box.f(["c1", "npc1"], CAST).length, 0, "配角在 cast 里，不该报找不到");
  assert.equal(box.f(["me", "c1"], CAST).length, 0, "「我」被当成找不到了");
  assert.equal(box.f(["c1", "gone"], CAST).join(","), "gone");
});

test("少一个人会掉进哪一支：那一支明说了要现编一个人", () => {
  // 这一条是病历：把「为什么少一位就会冒出一个原创角色」钉在这儿，
  // 免得下次有人把上面那道闸当成多余的
  const cb = fic.slice(fic.indexOf("  function cpBlock(cpChars, opts) {"));
  assert.match(cb, /if \(cpChars\.length === 1\) \{/);
  assert.match(cb, /另一方是一个由你设定的原创角色/);
});
