"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");

function load(){
  const old=global.window;global.window={};
  delete require.cache[require.resolve("../js/context-budget-shadow.js")];
  require("../js/context-budget-shadow.js");
  const mod=global.window.ContextBudgetShadow;global.window=old;return mod;
}

test("v2 全类别预算总和严格等于 12k，身份与规则不再成为无上限漏口",()=>{
  const B=load(),sum=Object.values(B.CATEGORY_CAPS).reduce((n,x)=>n+x,0);
  assert.equal(B.AUDIT_VERSION,2);
  assert.equal(sum,B.SOFT_BUDGET);
  assert.ok(B.CATEGORY_CAPS.identity_relation>B.CATEGORY_CAPS.memory);
  assert.ok(Number.isFinite(B.CATEGORY_CAPS.rules));
});

test("预算草案只按原 bundle 顺序压长度，不重排任何 block",()=>{
  const B=load(),parts=[
    "【角色人设】"+"甲".repeat(6000),
    "【最近对话】"+"乙".repeat(3000),
    "【世界书】"+"丙".repeat(3000),
    "普通规则"+"丁".repeat(4000)
  ],measured=B.measure(parts),out=B.propose(measured);
  assert.equal(out.orderPreserved,true);
  assert.deepEqual(out.blockPlan.map(x=>x.index),[0,1,2,3]);
  assert.ok(out.proposedTotal<=B.SOFT_BUDGET);
  assert.equal(out.wouldStillPressure,false);
  assert.ok(out.blockPlan.every(x=>x.proposedChars<=x.chars));
});

test("同类别多块共享一份额度，不能每块各领一次上限",()=>{
  const B=load(),measured=B.measure([
    "【最近对话】"+"甲".repeat(900),
    "【最近对话】"+"乙".repeat(900)
  ]),out=B.propose(measured),recent=out.blockPlan.filter(x=>x.category==="recent_chat");
  assert.equal(recent.reduce((n,x)=>n+x.proposedChars,0),B.CATEGORY_CAPS.recent_chat);
  assert.ok(recent[1].trimChars>0);
});
