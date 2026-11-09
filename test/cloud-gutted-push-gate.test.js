// 整类归零闸（群友 2026-11-09：安卓把站点的 IndexedDB 整个回收，localStorage 没动——
//   角色名单还在、每个人的聊天和整座图库一条不剩）。这台手机【有角色】，于是
//   localMeaningful() 放行、bootHadLocal 判「本地权威」，开机 autoPush 就把这份只剩壳的
//   存档盖上云，而 saves 是一行 upsert、没有历史。
// 钉法照 stub-from-the-writer：桩里的键名和内容照【写存档那一段】来——
//   app.js 写 "x_chat:" + id，消息对象带 role 字段——不照 cloud.js 自己那段编。
const assert = require("node:assert");
const test = require("node:test");
const fs = require("node:fs");

const cloudSrc = fs.readFileSync(__dirname + "/../js/cloud.js", "utf8");
const appSrc = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

function loadSaveShape() {
  const m = cloudSrc.match(/const saveShape = dump => \{[\s\S]*?\n  \};/);
  assert.ok(m, "抠不出 saveShape");
  return eval("(" + m[0].replace(/^const saveShape = /, "").replace(/;$/, "") + ")");
}

test("桩钉在写存档那一头：聊天键名与 role 字段", () => {
  assert.match(appSrc, /saveJSON\("x_chat:" \+ id/, "写聊天的键名变了，这份桩要跟着改");
  assert.match(appSrc, /role: "user"/, "消息对象不再带 role，saveShape 的判法要跟着改");
});

test("saveShape 数的是有话的对话，空壳不算", () => {
  const saveShape = loadSaveShape();
  const full = {
    "x_characters": '[{"id":"c1"},{"id":"c2"}]',
    "x_chat:c1": '[{"role":"user","content":"在吗"},{"role":"assistant","content":"在"}]',
    "x_gchat:g1": '[{"role":"user","content":"大家好"}]',
    "x_theme": "pink"
  };
  assert.deepStrictEqual(saveShape(full), { chats: 2 });
  // 仓库被清掉之后的样子：角色和美化还在（小，外头有副本），对话一个都不剩
  const gutted = { "x_characters": '[{"id":"c1"},{"id":"c2"}]', "x_chat:c1": "[]", "x_theme": "pink" };
  assert.deepStrictEqual(saveShape(gutted), { chats: 0 });
  assert.deepStrictEqual(saveShape({}), { chats: 0 });
});

test("autoPush：上次有话、这次归零就拦下，而且拦在 upsert 之前", () => {
  const m = cloudSrc.match(/async autoPush\(\) \{([\s\S]*?)\n    \},/);
  assert.ok(m, "抠不出 autoPush()");
  const body = m[1];
  const gateIdx = body.indexOf('block("gutted"');
  const upsertIdx = body.indexOf('client.from("saves").upsert');
  assert.ok(gateIdx > 0, "autoPush 没有整类归零闸");
  assert.ok(upsertIdx > gateIdx, "闸必须在 upsert 之前");
  assert.match(body, /was\.chats > 0 && shape\.chats === 0/, "判据不是「上次有、这次零」");
  assert.ok(body.indexOf("noteShape(shape)") > upsertIdx, "推成功之后才许记下这一份的规模");
});

test("手动推送不走这道闸，但一样记规模", () => {
  const m = cloudSrc.match(/async push\(\) \{([\s\S]*?)\n    \},/);
  assert.ok(m, "抠不出 push()");
  const body = m[1];
  assert.ok(body.indexOf('block("gutted"') < 0, "手动推送她自己点过确认，不许拦");
  assert.match(body, /noteShape\(saveShape\(saveData\)\)/, "手动推完没记规模，下一次自动备份会被自己的闸拦住");
});

test("拦下来的理由要有人话，而且算【值得当场打断】的那一类", () => {
  assert.match(cloudSrc, /gutted: "[^"]*导出[^"]*"/, "gutted 的说明里要告诉她先导出");
  const m = cloudSrc.match(/const LOUD_BLOCK = \{[^}]*\}/);
  assert.ok(m && /gutted: 1/.test(m[0]), "gutted 必须在 LOUD_BLOCK 里，不然只记账不吭声");
});
