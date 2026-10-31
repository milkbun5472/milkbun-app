// 梗与话题（她 2026-10-31：群里许愿「上传聊天梗和聊天话题的地方」；她定：多选放进聊天，只给自己用）
"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const nest = R("nest.js"), comp = R("components.js");

test("小窝多了「梗与话题」这一类，放进聊天只能选人", () => {
  assert.match(nest, /\{ key: "topic", zh: "梗与话题", seal: "梗"/);
  assert.match(nest, /it\.kind === "topic" \? \["chat"\]/);
  assert.match(nest, /isTopic \? h\(Btn, \{ t, solid: true, wide: true, disabled: busy, onClick: placeWithHeart/);
  assert.match(nest, /if \(it\.liked\) \{ setPlacing\(true\); return; \}/, "点过心的直接去勾人");
  assert.match(nest, /maxLength: 1000/, "跟后端同一个上限");
});

test("放进去：同一条重复放只留一张，新的在最前，一人最多 60 张", () => {
  const helpers = comp.split("\n").filter(l => /^const topicCards(Of|Put) = /.test(l)).join("\n");
  const store = {};
  const ctx = { loadJSON: (k, d) => store[k] ? JSON.parse(store[k]) : d, saveJSON: (k, v) => { store[k] = JSON.stringify(v); } };
  vm.createContext(ctx); vm.runInContext(helpers + "\nglobalThis.of = topicCardsOf; globalThis.put = topicCardsPut;", ctx);
  const add = c => ctx.put("c1", l => [c].concat(l.filter(y => y.id !== c.id)).slice(0, 60));
  add({ id: "nest:a", text: "甲" }); add({ id: "nest:b", text: "乙" }); add({ id: "nest:a", text: "甲" });
  assert.equal(ctx.of("c1").map(x => x.id).join(","), "nest:a,nest:b");
  assert.equal(ctx.of("c2").length, 0, "别人那一叠不受影响");
  ctx.put("c1", () => []);
  assert.equal(JSON.parse(store.x_topicCards).c1, undefined, "拿空了就把那一格删掉");
});

test("聊天里：有卡才出「话题卡」，点一张只填进输入框、不发", () => {
  // 2026-10-31 起能自己写，所以「话题卡」那一格一直在
  assert.match(comp, /key !== "topics" \|\| !!character\)/);
  assert.match(comp, /new CustomEvent\("qq-draft-fill", \{ detail: \{ key: "chat:" \+ character\.id, text: x\.text \} \}\)/);
  const di = comp.slice(comp.indexOf("function DraftInput("), comp.indexOf("function ReplyKey("));
  assert.match(di, /window\.addEventListener\("qq-draft-fill", on\)/);
  assert.ok(!/onSubmit\s*&&\s*onSubmit\(d\.text\)/.test(di), "填卡不许直接发出去");
});

test("不认得的类别不给导入键，只说去更新", () => {
  assert.match(nest, /!KIND\[it\.kind\] \? h\("div", \{ "data-wk": "nestunknownkind"/);
});

test("话题卡互通：自己写、传到小窝带着正文、也放给别人", () => {
  const sheet = comp.slice(comp.indexOf("function TopicCardsSheet("), comp.indexOf("const DRAFTS = (() => {"));
  assert.match(sheet, /id: "own:" \+ Date\.now\(\)\.toString\(36\)/, "自己写的那张");
  assert.match(sheet, /maxLength: 1000/, "跟小窝同一个上限");
  assert.match(sheet, /window\.__nestPending = \{ kind: "topic", text: x\.text/);
  assert.match(sheet, /c\.id !== charId/, "也给别人：名单里不含自己");
  assert.match(nest, /initialKind: \(top\.pre && top\.pre\.kind\)/);
  assert.match(nest, /if \(sessionTok\(\)\) push\(v\); else needLogin\(v\);/, "没登录先登录，登完接着传");
});
