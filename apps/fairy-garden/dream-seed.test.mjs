import {test} from 'node:test';import assert from 'node:assert/strict';
import {freshState,fillVein,perform,NODES,MAPS,wellFind,targetFor,restoreState,sowSeed,readySeeds,growingDreams,dreamStage,advanceTime,pinShard,THING_CAP,placeThing,donate,spotKey,seedPlot,restoreSeeds} from './world.mjs';
function found(){for(let day=1;day<60;day++){let s=perform({...freshState(),day,position:MAPS.garden.stations.dive},'dive');const n=NODES.find(n=>n.depth===1&&wellFind(s,n)==='seed');if(!n)continue;s=fillVein(s,[{kind:'echo',text:'测试种子的原片段'}]);s=perform({...s,position:targetFor(s,'gather',n.id)},'gather',n.id);return perform({...s,position:MAPS.depths.stations.ladder},'ladder');}throw Error('no seed');}
const act=(s,k,id)=>perform({...s,position:targetFor(s,k,id)},k,id);
test('find → plant → grow → harvest → place → museum uses real writers and keeps the source',()=>{
 let s=found(),sh=s.shards[0];assert.equal(sh.curio,'seed');s=act(s,'dreamSow',sh.id);assert.equal(s.shards.length,0);assert.equal(growingDreams(s).length,1);assert.equal(s.seeds[0].origin.text,sh.text);s=restoreState(s);assert.equal(s.seeds[0].origin.text,sh.text);const id=s.seeds[0].id;assert.equal(perform({...s,map:'forest'},'dreamHarvest',id).things.length,0);
 s=advanceTime(s,960*3);assert.equal(dreamStage(s,s.seeds[0]),3);assert.equal(readySeeds(s).length,0,'dream seeds never enter paid blossom requests');s=act(s,'dreamHarvest',id);assert.equal(s.things[0].from,sh.text);assert.equal(s.things[0].recipe,'dreamflower');assert.equal(growingDreams(s).length,0);assert.equal(act(s,'dreamHarvest',id).things.length,1);
 const f=MAPS.home.furniture.findIndex(x=>x.kind==='table'),t=s.things[0];s=placeThing(s,t.id,spotKey('home','table',f));assert.ok(restoreState(s).things[0].spot);s=donate({...s,map:'museum'},t.id);assert.equal(restoreState(s).collection[0].recipe,'dreamflower');assert.equal(s.collection[0].from,sh.text);
});
test('pin, distance, shared daily limit and full inventory protect the seed',()=>{
 let s=found(),id=s.shards[0].id;s=pinShard(s,id);assert.equal(act(s,'dreamSow',id).shards.length,1);s=pinShard(s,id);assert.equal(perform({...s,position:MAPS.garden.spawn},'dreamSow',id).shards.length,1);s=sowSeed(s,'miss','one');s=sowSeed(s,'miss','two');assert.equal(act(s,'dreamSow',id).shards.length,1);
 s=advanceTime(s,960);s=act(s,'dreamSow',id);s=advanceTime(s,960*3);const seed=growingDreams(s)[0];s={...s,things:Array.from({length:THING_CAP},(_,i)=>({id:'t'+i,name:'满'}))};assert.equal(growingDreams(act(s,'dreamHarvest',seed.id)).length,1);
});
test('oldest active plots survive a long history of harvested plants',()=>{
 let s=found();s=act(s,'dreamSow',s.shards[0].id);const first=s.seeds[0];s={...s,seeds:[first,...Array.from({length:50},(_,i)=>({id:'old'+i,kind:'miss',day:i+1,done:true,ask:''}))]};const saved=restoreState(s);assert.equal(growingDreams(saved)[0].id,first.id);assert.equal(seedPlot(saved,growingDreams(saved)[0]),0);assert.ok(restoreSeeds(s.seeds).length<=24);
});
