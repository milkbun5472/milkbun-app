const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-09-02 问「情侣邀请接受和拒绝的概率是多少、怎么决定的」。
// 答案是没有概率、一次骰子都没掷——全由模型看人设/好感/关系/她补的话来判。
// 但顺着查出来一个不对称：两处都写成
//     const d = extractJSON(raw) || {};  ...  d.accept ? 接受 : 拒绝
// 模型这一次没把 JSON 写好，extractJSON 返回 null，直接落进【拒绝】那一支。
// 她看到的是他一句解释都没有地拒了她，而情侣邀请那一下还不可逆。

// —— 把 askYesNo 抠出来【真跑】，别只 grep ——
const i = app.indexOf("  const _yesVal = v =>");
const j = app.indexOf("  // 我拉黑 TA 后按「回复」");
assert.ok(i > 0 && j > i, "找不到 askYesNo");
const body = app.slice(i, j);
const mk = replies => {
  let n = 0; const calls = [];
  const callAI = async (route, system) => { calls.push(system); return replies[n++]; };
  const extractJSON = s => { try { const m = String(s || "").match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch (e) { return null; } };
  const fn = new Function("callAI", "extractJSON", body + "\nreturn { askYesNo };")(callAI, extractJSON);
  return { ask: fn.askYesNo, calls };
};

test("一次写对就不重问——别白花一次", async () => {
  const { ask, calls } = mk(['{"accept":true,"say":["好"]}']);
  assert.deepEqual(await ask(null, "S", [], {}), { ok: true, accept: true, say: ["好"], d: { accept: true, say: ["好"] } });
  assert.equal(calls.length, 1);
});

test("第一次没写好 → 重问一次，拿第二次的答案", async () => {
  const { ask, calls } = mk(["我觉得吧……", '{"accept":true,"say":["好"]}']);
  const r = await ask(null, "S", [], {});
  assert.equal(r.ok, true);
  assert.equal(r.accept, true);
  assert.equal(calls.length, 2, "该重问一次");
  assert.match(calls[1], /上一次的输出没能解析/, "重问那次要把话说明白");
});

test("两次都读不出来 → 明说读不出来，绝不替他判成拒绝", async () => {
  const { ask, calls } = mk(["我觉得吧……", "还是没写好"]);
  assert.deepEqual(await ask(null, "S", [], {}), { ok: false });
  assert.equal(calls.length, 2, "只重问一次，不许无限重试");
});

test("能解析但没有 accept 也算没表态", async () => {
  // 「能解析」≠「他表了态」：{say:[...]} 里没有 accept，原来会被当成 false
  const { ask } = mk(['{"say":["嗯"]}', '{"say":["嗯"]}']);
  assert.deepEqual(await ask(null, "S", [], {}), { ok: false });
  const { ask: a2 } = mk(['{"accept":null}', '{"accept":false,"say":["不"]}']);
  const r = await a2(null, "S", [], {});
  assert.equal(r.ok, true);
  assert.equal(r.accept, false, "第二次真说了 false，那才是拒绝");
});

test("accept 写成字符串/数字也认", async () => {
  for (const v of ['"true"', "1", "true"]) {
    const { ask } = mk(['{"accept":' + v + ',"say":["好"]}']);
    assert.equal((await ask(null, "S", [], {})).accept, true, "认不出 " + v);
  }
  for (const v of ['"false"', "0", "false"]) {
    const { ask } = mk(['{"accept":' + v + ',"say":["不"]}']);
    assert.equal((await ask(null, "S", [], {})).accept, false, "误判了 " + v);
  }
});

test("情侣邀请：读不出来只标「没送到」，不动情侣状态", () => {
  const k = app.indexOf("const askCoupleInvite");
  // ⚠️只看代码行：注释里写着「原来这儿是 !!d.accept」，对着原文问会永远红（当场踩了一次）
  const codeOnly = src => src.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  const fn = codeOnly(app.slice(k, app.indexOf("const respondCoupleInvite", k)));
  assert.ok(!/!!d\.accept/.test(fn), "又变回「解析失败＝拒绝」了");
  assert.match(fn, /await askYesNo\(apiFor\(charId\)/);
  assert.match(fn, /if \(!r\.ok\) \{[\s\S]{0,220}status: "failed"[\s\S]{0,160}return;/,
    "读不出来要留在 pending 让她再点一次，而不是走 respondCoupleInvite");
  // respondCoupleInvite 是不可逆的那一步：只有真读到了才许走
  const call = fn.indexOf("respondCoupleInvite(charId, cid,");
  assert.ok(call > fn.indexOf("if (!r.ok)"), "得先挡住读不出来那一支");
});

test("解除拉黑：同一个病，同一把刀", () => {
  const k = app.indexOf("const sendMyUnblockReq");
  const fn = app.slice(k, app.indexOf("const blockedReaction", k) > k ? app.indexOf("const blockedReaction", k) : k + 4000);
  assert.ok(!/status: d\.accept \? "accepted" : "declined"/.test(fn), "又变回来了");
  assert.match(fn, /await askYesNo\(apiFor\(char\.id\)/);
  assert.match(fn, /if \(!r\.ok\) \{ toast\([^)]*\); return; \}/, "读不出来要原样留在 pending");
  // 读不出来时也不许把这次算进 tries（那会让她少一次机会）
  const bad = fn.indexOf("if (!r.ok)");
  assert.ok(bad > 0 && fn.indexOf("setBlockFor(charId, { tries: tries })") > bad);
});
