import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshState,restoreState,perform,fillVein,NODES,MAPS,targetFor,advanceTime,wellTide,wellContext,wellWeights,wellFind,chooseWellKit} from './world.mjs';
const dive=s=>perform({...s,position:MAPS.garden.stations.dive},'dive');
test('tide is daily, reproducible and season/weather weighted without bad days',()=>{
 const ids=new Set();for(let day=1;day<200;day++){const s={...freshState(),day};const t=wellTide(s);ids.add(t.id);assert.deepEqual(t,wellTide(restoreState(s)));assert.ok(Object.values(wellWeights(s)).every(v=>v>0));}assert.equal(ids.size,4);
});
test('kit nudges its own form, cannot change underground, trip survives restore and midnight',()=>{
 const base=freshState(),kit=chooseWellKit(base,'bell');assert.ok(wellWeights(kit).shell>wellWeights(base).shell);let s=advanceTime(dive(kit),1000);assert.equal(s.wellTrip.day,1);assert.equal(chooseWellKit(s,'pot'),s);const node=NODES.find(n=>n.depth===1);assert.equal(wellFind(s,node),wellFind(restoreState(s),node));assert.deepEqual(wellContext(s),wellContext({...s,day:s.day+1}));
});
test('real gathering stores the visible form and preserves original contents across restore',()=>{
 let s=dive(chooseWellKit(freshState(),'pot'));s=fillVein(s,[{kind:'echo',text:'测试原文，不重写',whole:true}]);const n=NODES.find(n=>n.depth===1),form=wellFind(s,n);s=perform({...s,position:targetFor(s,'gather',n.id)},'gather',n.id);assert.equal(s.shards[0].curio,form);assert.equal(s.shards[0].text,'测试原文，不重写');assert.equal(s.shards[0].kind,'echo');assert.deepEqual(restoreState(s).shards,s.shards);assert.equal(perform(s,'gather',n.id),s);
});
test('legacy discoveries remain unrelabeled and progression runes stay guaranteed',()=>{
 let s=dive(freshState());for(let i=0;i<2;i++)s=perform({...s,position:MAPS.depths.stations.deeper},'deeper');const n=NODES.find(n=>n.depth===3&&n.kind==='stone');assert.equal(wellFind(s,n),'rune');s=perform({...s,position:targetFor(s,'gather',n.id)},'gather',n.id);assert.equal(s.stones,1);assert.equal(s.shards.length,0);const old={...s,shards:[{id:'old',kind:'dream',text:'旧原文',day:1,depth:1,whole:false,pinned:true}]};assert.deepEqual(restoreState(old).shards,old.shards);
});
test('every form can occur and anomalous floors contrast with daily tide',()=>{
 const forms=new Set();let odd=0;for(let day=1;day<=140;day++){const s={...freshState(),day};for(const n of NODES.filter(n=>n.map==='depths')){forms.add(wellFind(s,n));const c=wellContext(s,n.depth);if(c.anomaly){odd++;assert.notEqual(c.local.id,c.tide.id);}}}assert.deepEqual([...forms].sort(),['relic','rune','seed','shell','thread']);assert.ok(odd>0);
});
