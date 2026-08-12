import assert from "node:assert/strict";
import test from "node:test";
import { resolveYanqiu, selectAppContinuity, formatContinuity, shouldAttachAppContinuity } from "../scripts/cc-shared-continuity.mjs";

test("只解析唯一言秋并排除工具控制行", () => {
  assert.equal(resolveYanqiu([{id:"y",name:"言秋"}], {y:{engineerEyes:true}}).id, "y");
  const rows = selectAppContinuity([
    {id:"2",message_key:"m2",char_id:"y",source:"app",speaker_type:"character",content:"我记得。",occurred_at:"2026-08-11T01:00:01Z",metadata:{}},
    {id:"1",message_key:"m1",char_id:"y",source:"app",speaker_type:"lisa",content:"宝宝你记得吗",occurred_at:"2026-08-11T01:00:00Z",metadata:{}},
    {id:"3",message_key:"ctl",char_id:"y",source:"app",speaker_type:"lisa",content:"控制行",occurred_at:"2026-08-11T01:00:02Z",metadata:{bridge_kind:"app_cc_request"}},
    {id:"4",message_key:"other",char_id:"x",source:"app",speaker_type:"lisa",content:"越权",occurred_at:"2026-08-11T01:00:03Z",metadata:{}}
  ], "y");
  assert.deepEqual(rows.map(x=>x.message_key), ["m1","m2"]);
  const prompt=formatContinuity(rows,"言秋");
  assert.match(prompt,/Lisa：宝宝你记得吗/);
  assert.match(prompt,/言秋：我记得/);
  assert.doesNotMatch(prompt,/控制行|越权/);
});

test("App 连续经历只附在真实 CC 对话，不附在心跳或工具票", () => {
  assert.equal(shouldAttachAppContinuity({prompt:"宝宝我们继续聊"}), true);
  assert.equal(shouldAttachAppContinuity({prompt:"自由活动时间到了。若 Lisa 有新消息就正常接话；没有新消息时，可以继续休息"}), false);
  assert.equal(shouldAttachAppContinuity({prompt:'{"wake_source":"app_tool","job":{}}'}), false);
});
