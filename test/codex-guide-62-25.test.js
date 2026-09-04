// 攻略重做（她 2026-09-04：「去重做一遍名片问号里的攻略，更新一下我们实际功能描述，
// 然后 ui 也做好看点，然后最上面写如果不会问秋秋之类的」）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/codex.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const DB = new Function(src.slice(src.indexOf("const DB = ["), src.indexOf("const CATS = [];")) + "\nreturn DB;")();

test("最上面那一条是「问秋秋」，而且点得进去", () => {
  assert.match(src, /直接问秋秋/);
  assert.match(src, /onClick: \(\) => props\.onAskAssistant && props\.onAskAssistant\(\)/, "只是一句摆设，点不进去");
  const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  assert.match(app, /onAskAssistant: \(\) => setScreen\("assistant"\)/, "App 那头没把这条线接上");
});

test("说的是现在真有的功能：主屏上每个 app 都得在攻略里找得到", () => {
  const names = [...comp.matchAll(/kind: "app", zh: "([^"]+)"/g)].map(m => m[1]);
  const all = DB.map(e => e.t + e.b + (e.k || "")).join("\n");
  // 几个改过名或并进别处的，按它现在的说法算数
  const alias = { "人格档案馆": "人格档案馆", "关系": "关系网", "匿名问答": "匿名问答", "秋秋": "秋秋",
    "小游戏": "小游戏", "梦境": "梦", "互救台": "遇到问题", "值班室": "遇到问题", "三席会客": "遇到问题",
    "文风台": "文风", "购物": "查手机", "随身物": "随身物", "钱包": "钱包", "去处": "去处" };
  const missing = names.filter(n => all.indexOf(alias[n] || n) < 0);
  assert.deepEqual(missing, [], "这几个 app 攻略里没写：" + missing.join(" "));
});

test("退休掉的东西不许还留在攻略里", () => {
  const all = DB.map(e => e.t + e.b).join("\n");
  ["电子木鱼功德", "九维", "记问"].forEach(x => {
    if (x === "电子木鱼功德") return; // 木鱼还在，只是不单独成条
    assert.ok(all.indexOf(x) < 0, "攻略还在介绍已经退休的：" + x);
  });
});

test("不留英文标题（no-english-titles）", () => {
  assert.ok(!/en: "/.test(src), "又给 Head 传英文副标题了");
  DB.forEach(e => assert.ok(!/^[\x00-\x7f\s]+$/.test(e.t), "这一条的标题是纯英文：" + e.t));
  assert.match(src, /sub: "这台手机的说明书"/);
});

test("每一条都是「一句话点题 + 分点」，不是一大坨", () => {
  DB.forEach(e => {
    assert.ok(e.b.length >= 20, e.t + "：正文太短，等于没写");
    assert.ok(e.b.includes("\n· ") || e.b.split("\n").length >= 2, e.t + "：糊成一大段了");
    assert.ok(e.b.split("\n")[0].length <= 60, e.t + "：第一行不是一句话点题");
  });
});

test("形状不是一排药丸／一行下划线（tabs-not-plain-pills）", () => {
  // 章节号 + 条目号（01.03）＝说明书那套编法；展开时正文左边一道竖线
  assert.match(src, /no2\(ci\) \+ "\." \+ no2\(i\)/, "条目没有说明书那种章节编号");
  assert.match(src, /borderLeft: "2px solid " \+ t\.accent/, "展开的正文没有旁注那道竖线");
  // 秋秋那颗圆头像是圆的没问题；不许出现的是【一排并列的圆角药丸】当分类用
  const listPart = src.slice(src.indexOf("list.length === 0"));
  assert.ok(!/borderRadius: 999/.test(listPart), "分类又摆成一排药丸了");
  assert.ok(!/CATS\.map\([^)]*=> h\("button"/.test(src), "分类被做成了一排可点的标签");
});

test("搜索关键词齐全：每条都带 k，好让她拿别的说法也搜得到", () => {
  const noK = DB.filter(e => !e.k || e.k.length < 4).map(e => e.t);
  assert.deepEqual(noK, [], "这几条没写搜索词：" + noK.join(" "));
});

test("那条「先导出再删」的规矩必须写在攻略里（never-say-delete-first）", () => {
  const all = DB.map(e => e.b).join("\n");
    assert.ok(/导出/.test(all) && /json/i.test(all), "攻略里没告诉她删之前先导出");
});
