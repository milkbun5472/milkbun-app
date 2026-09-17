"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const host = fs.readFileSync("js/fairy-garden.js", "utf8");
const engine = fs.readFileSync("js/engine.js", "utf8");
const guard = fs.readFileSync("js/group-identity-guard.js", "utf8");

// 她 2026-09-17：「我说一句话他回复一大段是不是没用分气泡」
// ⚠️桩照【真正的那两个拆气泡实现】装（施工规则/stub-from-the-writer.md）：
//   自己在测试里编一个切句子的函数，等于把同一个误会写两遍。
function service() {
  const ctx = { React: { createElement: () => null }, WeakMap, JSON, Error, Math, String, Array, Object, Number, Boolean, isFinite, RegExp,
    extractJSON: r => { try { return JSON.parse(String(r)); } catch (e) { return null; } },
    callAI: async () => "", narrativeCore: () => "", CONDESCENDING_TONE_BAN: "", REGISTER_FOLLOWS_SCENE: "",
    STOCK_REPLY_BAN: "", OVERREACH_BAN: "", ECHO_QUESTION_BAN: "", userName: p => (p && p.name) || "用户",
    loadJSON: () => null, saveJSON: () => true, useTheme: () => ({}), module: undefined };
  ctx.window = ctx; ctx.globalThis = ctx;
  // 真正的 splitLongBubble（engine.js）
  vm.runInNewContext(engine.slice(engine.indexOf("function bubbleProtectNum"), engine.indexOf("const SCHED_END_RULE")), ctx);
  vm.runInNewContext(guard, ctx);
  ctx.GroupIdentityGuard = ctx.GroupIdentityGuard || ctx.window.GroupIdentityGuard;
  vm.runInNewContext(host, ctx);
  return ctx.FairyGardenService;
}
const reply = (svc, value) => {
  const out = svc.normalizeReply(JSON.stringify({ reply: value, action: { kind: "none" } }));
  return { parts: Array.from(out.parts), reply: out.reply, action: out.action };
};

test("模型给数组就是几条气泡，一条都不合并", () => {
  const out = reply(service(), ["先来一句。", "停一下，再补一句。"]);
  assert.deepEqual(out.parts, ["先来一句。", "停一下，再补一句。"]);
  assert.equal(out.reply, "先来一句。\n停一下，再补一句。", "记进聊天记录的仍是完整一轮");
});

test("给一整块也照它自己的换行拆开", () => {
  const out = reply(service(), "他把伞收起来。\n\n「来得刚好。」");
  assert.deepEqual(out.parts, ["他把伞收起来。", "「来得刚好。」"]);
});

// ⚠️庭院是成段叙事：照即时通讯那把 22 字的尺子切，一段描写会被剁成碎片。
test("短的成段叙事不许被切碎", () => {
  const line = "他蹲下去把那株苗扶正，泥沾了一手，回头看你一眼。";
  assert.ok(line.length < 80);
  assert.deepEqual(reply(service(), line).parts, [line]);
});

test("真长到成墙的那一条才动刀，而且只在句号处断", () => {
  const wall = "他把那把伞收起来靠在门边，水顺着伞骨一滴一滴落下来。你站在廊下没动，他抬头看了你一眼，又低下去把鞋边的泥蹭干净。过了好一会儿他才开口说话，声音比平常低一点，像是怕惊着什么东西。";
  assert.ok(wall.length > 80);
  const parts = reply(service(), wall).parts;
  assert.ok(parts.length > 1, "一堵字墙浮在他头顶上，她根本读不了");
  parts.forEach(x => assert.ok(!/[，,]$/.test(x), "不许在逗号上断——那是即时通讯的切法"));
  assert.equal(parts.join(""), wall.replace(/\s+/g, ""), "拆完少了字或多了字都是坏的");
});

test("一条都读不出来才算失败，空数组不许当成功", () => {
  const svc = service();
  assert.throws(() => reply(svc, ["", "   "]), /没读懂/);
  assert.throws(() => reply(svc, ""), /没读懂/);
  assert.throws(() => svc.normalizeReply("不是 JSON"), /没读懂/);
});

test("最多十二条，再多也不许一直冒", () => {
  const out = reply(service(), Array.from({ length: 30 }, (_, i) => "第" + i + "句。"));
  assert.equal(out.parts.length, 12);
});

// ⚠️这一条修在【公共那一层】（group-identity-guard.js 的 splitBubbles），
//   所以主聊天、群聊、庭院一起好了——在庭院里自己绕开它就是同一层活在两处。
test("句号后面的右引号跟着上一句走，不许单独冒一个「」」", () => {
  const guardMod = require("../js/group-identity-guard.js");
  const rows = guardMod.splitBubbles("他把伞收起来。「来得刚好。」");
  assert.deepEqual(rows, ["他把伞收起来。", "「来得刚好。」"]);
  rows.forEach(x => assert.ok(x.replace(/[」』”’"]/g, "").trim(), "冒出一个只有右引号的气泡"));
  assert.deepEqual(guardMod.splitBubbles("「真的吗？」他说。"), ["「真的吗？」", "他说。"]);
});

// 他自己开口那一枪：料凑得对不对、拆不拆气泡，跟回复走的是同一条路
test("他开口那一枪照样按条出，手上没有东西也得说得出话", async () => {
  const calls = [];
  const svc = (() => {
    const ctx = { React: { createElement: () => null }, WeakMap, JSON, Error, Math, String, Array, Object, Number, Boolean, isFinite, RegExp,
      extractJSON: r => { try { return JSON.parse(String(r)); } catch (e) { return null; } },
      callAI: async (p, sys, msgs, opt) => { calls.push({ sys, msgs, opt }); return JSON.stringify({ say: ["你把伞放在门边了。", "我看见了。"] }); },
      narrativeCore: () => "", CONDESCENDING_TONE_BAN: "", REGISTER_FOLLOWS_SCENE: "", STOCK_REPLY_BAN: "",
      OVERREACH_BAN: "", ECHO_QUESTION_BAN: "", userName: p => (p && p.name) || "用户",
      loadJSON: () => null, saveJSON: () => true, useTheme: () => ({}) };
    ctx.window = ctx; ctx.globalThis = ctx;
    vm.runInNewContext(host, ctx);
    return ctx.FairyGardenService;
  })();
  const out = await svc.missLine({ active: {}, character: { name: "甲", persona: "甲的人设" }, profile: { name: "我" },
    world: { day: 12 }, material: { day: 12, quiet: 3, rows: [{ kind: "花笺", text: "那天你在楼下等我。", day: 4 }] } });
  assert.equal(calls.length, 1, "他开一次口就该是一枪");
  assert.deepEqual(Array.from(out), ["你把伞放在门边了。", "我看见了。"]);
  // 料在 system，user 只有触发那一句
  assert.match(calls[0].sys, /那天你在楼下等我。/);
  assert.match(calls[0].sys, /已经 3 天没正经说过话/);
  assert.equal(calls[0].msgs.length, 1);
  assert.ok(calls[0].opt.maxTokens >= 8000);
  // 手上真没东西的时候，不许硬塞一件进去
  await svc.missLine({ active: {}, character: { name: "甲" }, profile: {}, world: {}, material: { day: 1, quiet: 0, rows: [] } });
  assert.match(calls[1].sys, /【你手上什么都没有】/);
  assert.doesNotMatch(calls[1].sys, /没正经说过话/);
});
