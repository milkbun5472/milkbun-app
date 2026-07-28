"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const R = require("../js/reroll-branch.js");

test("抽取结果引用已被 reroll 的消息时不得落库", () => {
  const item = { evidence_message_ids: ["ts_2"] };
  assert.equal(R.candidateStillLive(item, [{ role: "user", ts: 1 }]), false);
  assert.equal(R.candidateStillLive(item, [{ role: "assistant", ts: 2 }]), true);
});

test("私聊重 Roll 较早回复时从该 turn 首泡起截断，后续依赖旧回答的尾巴不保留",()=>{
  const rows=[
    {role:"user",content:"第一问"},
    {role:"assistant",content:"旧答一",turnId:"t1"},
    {role:"assistant",content:"旧答二",turnId:"t1"},
    {role:"user",content:"基于旧答追问",turnId:null},
    {role:"assistant",content:"后续旧答",turnId:"t2"}
  ];
  const out=R.truncateChatBranch(rows,2,"t1");
  assert.deepEqual(out.after,[rows[0]]);
  assert.deepEqual(out.removed,rows.slice(1));
  assert.deepEqual(out.turnIds,["t1","t2"]);
  assert.equal(out.start,1);
});

test("无 turnId 的旧消息也从目标处截尾，不留下悬空后文",()=>{
  const rows=[{role:"user"},{role:"assistant"},{role:"user"},{role:"assistant",turnId:"t2"}];
  const out=R.truncateChatBranch(rows,1,null);
  assert.deepEqual(out.after,[rows[0]]);
  assert.deepEqual(out.removed,rows.slice(1));
});

test("只有纯角色旧分支证据才登记为可撤销记忆", () => {
  const msgs = [{ role: "user", ts: 1 }, { role: "assistant", ts: 2, turnId: "t" }, { role: "assistant", ts: 3, turnId: "t" }];
  const map = R.journalAssignments([
    { id: "pure", evidenceMessageIds: ["ts_2", "ts_3"] },
    { id: "still_true", evidenceMessageIds: ["ts_1", "ts_2"] }
  ], msgs);
  assert.deepEqual(map, { t: ["pure"] });
});

test("reroll 恢复上一份心声状态并清掉旧 turn 历史", () => {
  const current = { thought: "旧分支心声", mood: "紧张", turnId: "bad", affinityBefore: 70 };
  const history = [current, { thought: "此前心声", mood: "平静", wearing: "衬衫", action: "看书", ts: 1, turnId: "good", affinityBefore: 68 }];
  const r = R.rollbackState(current, history, "bad");
  assert.equal(r.state.thought, "此前心声");
  assert.equal(r.history.some(x => x.turnId === "bad"), false);
});

test("升级前无 turnId 的心声只允许最新回合安全退一格", () => {
  const current = { thought: "旧版当前心声", mood: "得意" };
  const history = [current, { thought: "上一条", mood: "平静", ts: 1 }];
  assert.equal(R.rollbackState(current, history, "t", { legacyLatest: true }).state.thought, "上一条");
  assert.equal(R.rollbackState(current, history, "t", { legacyLatest: false }).state.thought, "旧版当前心声");
});

test("群聊尾部连续两轮按倒序回滚后回到最早轮之前", () => {
  const before = { thought: "之前", mood: "平静", turnId: "base", affinityBefore: 50 };
  const one = { thought: "第一轮", mood: "开心", turnId: "g1", affinityBefore: 50 };
  const two = { thought: "第二轮", mood: "紧张", turnId: "g2", affinityBefore: 51 };
  let current = two, history = [two, one, before];
  for (const turn of ["g2", "g1"]) { const r = R.rollbackState(current, history, turn); current = r.state; history = r.history; }
  assert.equal(current.thought, "之前");
  assert.deepEqual(history.map(x => x.turnId), ["base"]);
});
