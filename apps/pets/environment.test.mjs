import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {townEnvironment,townSeasonRole,townRainSurface} from './environment.mjs';
import {weather,SEASONS} from '../fairy-garden/world.mjs';
import {restoreClock,realTime} from '../fairy-garden/real-clock.mjs';
import {createPetWorld} from '../../art/pet-career/world-navigation.mjs';
const calendar=(season,minute=720,day=1)=>realTime(restoreClock(null,day,new Date(2026,9,5+season*14).getTime()),new Date(2026,9,5+season*14,Math.floor(minute/60),minute%60).getTime());
test('shared fourteen-day seasons share all twelve profiles, even when old progress points to a different season',()=>{
 for(let i=0;i<4;i++)for(const kind of Object.keys(SEASONS[i].weather)){
  const time=calendar(i,720,999),before=structuredClone(time),epoch=Array.from({length:1000},(_,j)=>'town-'+j).find(e=>weather(time.calendarDay,e,i)===kind),p=townEnvironment(time,epoch);
  assert.equal(p.season,i);assert.equal(p.kind,kind);assert.equal(p.day,time.calendarDay);assert.equal(p.date,time.date);assert.equal(p.time,'12:00');assert.deepEqual(time,before);assert.equal(p.light,1);assert.equal(p.snowCover>0,i===3);
 }
 const a=townEnvironment(calendar(0,720,1),'same'),b=townEnvironment(calendar(0,720,444),'same');assert.deepEqual(a,b);assert.equal(a.season,0);
});
test('light and seasonal sunset follow the shared summer cycle, keeping gradual dawn and night fireflies',()=>{const f=minute=>townEnvironment(calendar(1,minute,1),'town-night');assert.equal(f(120).light,0);assert.equal(f(120).phase,'夜晚');assert.equal(f(120).night,true);assert.ok(f(375).light>f(360).light);assert.ok(f(1150).light>f(1180).light);assert.ok(f(120).driftCount>f(720).driftCount);assert.equal(f(720).night,false);assert.equal(townEnvironment(calendar(3,1030),'x').phase,'傍晚');});
test('only real town foliage terrain roofs and water take seasonal tint; indoor furniture keeps its materials',()=>{for(const name of ['叶片','嫩叶'])assert.equal(townSeasonRole({name}),'leaf');assert.equal(townSeasonRole({name:'面包店屋顶'}),'roof');assert.equal(townSeasonRole({name:'街区柔绿'}),'ground');for(const name of ['奶油织物','浅橡木','面包店外墙'])assert.equal(townSeasonRole({name}),null);});
test('town rain lands on its own navigation terrain and is hidden inside all buildings',()=>{const layout=JSON.parse(readFileSync('art/pet-career/outside.json')),world=createPetWorld(layout),s={map:'outside'};assert.deepEqual(townRainSurface(world,s,layout.spawn.x,layout.spawn.z),{y:world.ground(layout.spawn.x,layout.spawn.z)+.015,water:false});for(const b of layout.buildings){assert.equal(townRainSurface(world,s,b.x,b.z),null);assert.equal(townRainSurface(world,{map:b.id},layout.spawn.x,layout.spawn.z),null);}});
