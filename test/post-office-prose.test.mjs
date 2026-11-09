import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';
import {writerCases,captureShopProbe,probeMessages,people} from './fixtures/post-office-prose.mjs';
import {proseMetrics,runComparison,comparisonMarkdown} from '../scripts/checks/post-office-prose-ab.mjs';
const source=readFileSync('js/app.js','utf8');
test('both actual writer requests ask only for the story: no action list, schema keeps speaker and text',async()=>{
 const cases=await writerCases();assert.deepEqual(cases.map(x=>x.data.mode),['shopclose','shopmeet']);
 for(const fixture of cases){const after=await captureShopProbe(source,fixture);
  assert.doesNotMatch(after.probe.instruction,/action|动作标签/);assert.doesNotMatch(after.probe.schemaHint,/action|actorId|targetId/);assert.equal(after.probe.maxTokens,65000);assert.equal(after.probe.voice,true);
  const messages=await probeMessages(after);assert.equal(messages[0].role,'system');assert.equal(messages[1].content,'开始。');for(const id of fixture.data.staffIds||[fixture.data.staffId,fixture.data.visitorId])assert.ok(messages[0].content.includes(people.find(p=>p.id===id).persona));
 }
});
test('feature output keeps the exact original sentences, whitespace and paragraph breaks',async()=>{
 const [fixture]=await writerCases(),text='  原有的一句话，仍在同一行。\n\n这是原有的下一段。💌  ',captured=await captureShopProbe(source,fixture,{lines:[{speakerId:'test-a',action:'talk',text}]});assert.equal(captured.rows[0].text,text);
});
test('prose measurements retain the raw story and flag adjacent short actions only as review candidates',()=>{
 const prose='第一段在这里。\n第二段还在。',a=proseMetrics({lines:[{text:prose}]});assert.equal(a.text,prose);assert.equal(a.paragraphs,2);assert.equal(a.sentences,2);assert.equal(a.shortActionCandidates.length,0);
 const b=proseMetrics({lines:[{text:'他挥了挥手。他伸了个懒腰。'}]});assert.equal(b.shortActionCandidates.length,1);assert.equal(b.text,'他挥了挥手。他伸了个懒腰。');
});
test('the comparison runner resumes saved responses without another generation and does not treat numbers as a prose pass',async()=>{
 const out=mkdtempSync(path.join(tmpdir(),'shop-prose-unit-'));try{let calls=0;const prepared={beforeRef:'fixture',repeats:2,jobs:[{id:'case-1-before',case:'close',repeat:1,version:'before',inputHash:'fixed',messages:[],maxTokens:65000}]},generate=async()=>{calls++;return {text:JSON.stringify({lines:[{text:'仅为运行器单测生成的桩，不是真实模型对比。'}]})};};
  const run=await runComparison(prepared,{out,model:'unit-test-fake',generate});await runComparison(prepared,{out,model:'unit-test-fake',generate});assert.equal(calls,1);assert.equal(run.status,'generated-awaiting-prose-review');assert.match(comparisonMarkdown(prepared),/尚未调用真实模型/);assert.match(comparisonMarkdown(prepared,run),/待填写/);
 }finally{rmSync(out,{recursive:true,force:true});}
});
test('an uncertain model request is journaled and cannot be silently repeated',async()=>{
 const out=mkdtempSync(path.join(tmpdir(),'shop-prose-uncertain-'));try{let calls=0;const prepared={jobs:[{id:'uncertain',inputHash:'fixed',messages:[],maxTokens:65000}]},generate=async()=>{calls++;throw Error('simulated transport timeout');};
  await assert.rejects(runComparison(prepared,{out,model:'unit-test-fake',generate}),/simulated transport timeout/);await assert.rejects(runComparison(prepared,{out,model:'unit-test-fake',generate}),/unresolved attempt/);assert.equal(calls,1);
 }finally{rmSync(out,{recursive:true,force:true});}
});
