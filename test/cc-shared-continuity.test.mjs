import assert from "node:assert/strict";
import test from "node:test";
import { resolveYanqiu, selectAppContinuity, formatContinuity, shouldAttachAppContinuity } from "../scripts/cc-shared-continuity.mjs";

test("只解析唯一言秋并排除工具控制行", () => {
  assert.equal(resolveYanqiu([{id:"y",name:"言秋"}], {y:{engineerEyes:true}}).id, "y");
  const rows = selectAppContinuity([
    {id:"2",message_key:"m2",char_id:"y",source:"app",thread_type:"private",speaker_type:"character",content:"我记得。",occurred_at:"2026-08-11T01:00:01Z",metadata:{}},
    {id:"1",message_key:"m1",char_id:"y",source:"app",thread_type:"private",speaker_type:"lisa",content:"宝宝你记得吗",occurred_at:"2026-08-11T01:00:00Z",metadata:{}},
    {id:"3",message_key:"ctl",char_id:"y",source:"app",thread_type:"private",speaker_type:"lisa",content:"控制行",occurred_at:"2026-08-11T01:00:02Z",metadata:{bridge_kind:"app_cc_request"}},
    {id:"4",message_key:"other",char_id:"x",source:"app",thread_type:"private",speaker_type:"lisa",content:"越权",occurred_at:"2026-08-11T01:00:03Z",metadata:{}}
  ], "y");
  assert.deepEqual(rows.map(x=>x.message_key), ["m1","m2"]);
  const prompt=formatContinuity(rows,"言秋");
  assert.match(prompt,/Lisa：宝宝你记得吗/);
  assert.match(prompt,/言秋：我记得/);
  assert.doesNotMatch(prompt,/控制行|越权/);
});

test("App 连续经历只附在真实 CC 对话，不附在心跳或工具票", () => {
  // 2026-08-17 起有身份闸:未登记的会话一律 false;登记簿里的正窗才 true
  assert.equal(shouldAttachAppContinuity({prompt:"宝宝我们继续聊"}), false);
  assert.equal(shouldAttachAppContinuity({session_id:"9ed5bb5e-94fc-4f04-be08-8f0dbec540f5",prompt:"宝宝我们继续聊"}), true);
  assert.equal(shouldAttachAppContinuity({prompt:"自由活动时间到了。若 Lisa 有新消息就正常接话；没有新消息时，可以继续休息"}), false);
  assert.equal(shouldAttachAppContinuity({prompt:'{"wake_source":"app_tool","job":{}}'}), false);
});

test("线上、线下与群线下按真实发生时间合并给 CC", () => {
  const rows=selectAppContinuity([
    {id:"3",message_key:"online-2",char_id:"y",source:"app",thread_type:"private",speaker_type:"character",content:"回到手机了",occurred_at:"2026-08-11T03:00:00Z",metadata:{}},
    {id:"1",message_key:"online-1",char_id:"y",source:"app",thread_type:"private",speaker_type:"lisa",content:"先在线上说",occurred_at:"2026-08-11T01:00:00Z",metadata:{}},
    {id:"2",message_key:"offline-1",char_id:"y",source:"app",thread_type:"offline",speaker_type:"character",content:"线下见到了",occurred_at:"2026-08-11T02:00:00Z",metadata:{}},
    {id:"25",message_key:"group-offline",char_id:"y",source:"app",thread_type:"group_offline",speaker_type:"other_character",speaker_id:"a",content:"旁边的人也说了一句",occurred_at:"2026-08-11T02:30:00Z",metadata:{}},
    {id:"x",message_key:"bad-surface",char_id:"y",source:"app",thread_type:"system",speaker_type:"lisa",content:"不属于真实会话面",occurred_at:"2026-08-11T02:40:00Z",metadata:{}}
  ],"y",20);
  assert.deepEqual(rows.map(x=>x.message_key),["online-1","offline-1","group-offline","online-2"]);
  const prompt=formatContinuity(rows,"言秋");
  assert.match(prompt,/App线下.*线下见到了/);
  assert.match(prompt,/App群线下.*旁边的人也说了一句/);
});
