"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");
function load(){const old=global.window;global.window={};delete require.cache[require.resolve("../js/message-branch-shadow.js")];require("../js/message-branch-shadow.js");const m=global.window.MessageBranchShadow;global.window=old;return m;}
test("v3 分支审计记录具体入口，截尾后的旧分支有效",()=>{
  const M=load(),before=[{role:"user"},{role:"assistant",turnId:"t1"},{role:"user"}],after=[before[0]];
  const row=M.inspectMutation({kind:"reroll",surface:"private",before,after,targetIndex:1,turnId:"t1"});
  assert.equal(M.AUDIT_VERSION,3);assert.equal(row.surface,"private");assert.equal(row.oldBranchGone,true);assert.equal(row.tailSurvived,false);assert.equal(row.valid,true);
});
test("只删目标 turn 却保留后文仍会被判悬空",()=>{
  const M=load(),before=[{role:"user"},{role:"assistant",turnId:"t1"},{role:"user"},{role:"assistant",turnId:"t2"}],after=[before[0],before[2],before[3]];
  const row=M.inspectMutation({kind:"reroll",surface:"private",before,after,targetIndex:1,turnId:"t1"});
  assert.equal(row.tailSurvived,true);assert.equal(row.valid,false);
});
