"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");

function load(){const old=global.window;global.window={};delete require.cache[require.resolve("../js/insight-candidate-shadow.js")];require("../js/insight-candidate-shadow.js");const mod=global.window.InsightCandidateShadow;global.window=old;return mod;}
const messages=[
  {id:"u1",role:"user",content:"我以前以为陪伴就是一直说话，后来才发现安静地在场也算。"},
  {id:"a1",role:"assistant",content:"因为真正让人安心的不是话多，而是你知道我不会走。"}
];
const base={kind:"insight",text:"陪伴的核心从持续说话变成了确认彼此不会离开",evidence_message_ids:["u1","a1"],evidence_quotes:["后来才发现安静地在场也算","因为真正让人安心的不是话多，而是你知道我不会走"]};

test("严格洞察必须同时有综合结论、有效原话、推导和认知转折",()=>{
  const I=load(),out=I.structureCandidate(base,messages,[base.text]);
  assert.equal(out.auditVersion,2);assert.equal(out.strictReady,true);assert.deepEqual(out.missing,[]);assert.equal(out.unsafeOrdinaryLeak,false);
});

test("两条普通事实不再自动算推导，只有因果没有转折也不够",()=>{
  const I=load(),facts={...base,text:"Lisa 今天吃了饭并且去了学校",evidence_quotes:["安静地在场也算","真正让人安心"]};
  const plain=I.structureCandidate(facts,messages,[facts.text]);assert.equal(plain.strictReady,false);assert.ok(plain.missing.includes("derivation"));assert.ok(plain.missing.includes("turning_point"));assert.equal(plain.unsafeOrdinaryLeak,true);
  const causalMessages=[{id:"u2",role:"user",content:"今天下雨"},{id:"a2",role:"assistant",content:"因为下雨所以改坐公交"}],causal={...base,text:"因为下雨所以今天改坐公交",evidence_message_ids:["u2","a2"],evidence_quotes:["今天下雨","因为下雨所以改坐公交"]};
  const one=I.structureCandidate(causal,causalMessages,[causal.text]);assert.equal(one.derivationPresent,true);assert.equal(one.turningPointPresent,false);assert.equal(one.strictReady,false);
});

test("把逐字原话原封不动当结论会被综合门挡住",()=>{
  const I=load(),quote=messages[0].content,c={...base,text:quote,evidence_message_ids:["u1"],evidence_quotes:[quote]};
  const out=I.structureCandidate(c,messages,[quote]);assert.equal(out.conclusionSynthesized,false);assert.ok(out.missing.includes("synthesis"));assert.equal(out.strictReady,false);
});
