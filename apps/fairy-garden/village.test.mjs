import {villagePoint} from './world.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {MAPS,START,freshState,restoreState,findPath,segmentClear,walkable,targetFor,perform,hitInteraction} from './world.mjs';
import {createMapLoader} from './map-loader.mjs';
import {withOpenPaths} from '../../test/_fairy-open.mjs';
// ⚠️带一份【路已经开了】的存档：小岛和倒树后的空地封着的时候本来就走不过去，
//   那是玩法（封着时 visit 说的是哪一句，由 new-scenes.test.mjs 钉）。
test('all new village destinations connect through dry land, with the pier exempted from pond collision',()=>{const open=withOpenPaths();for(const [id,site] of Object.entries(MAPS.garden.sites)){const route=findPath(START,site.target,'garden',[],open);assert.ok(route?.length,id);let p=START;for(const q of route){assert.ok(segmentClear(p,q,'garden',[],open),'path clips geometry: '+id);p=q;}let s={...open,position:site.target};assert.notEqual(perform(s,'visit',id),s);}assert.equal(walkable(12,8),false);assert.equal(walkable(12,10.1),true);assert.equal(walkable(-13,6.6),false);});
test('v4 village migration preserves inventories, dates, journal and forest positions, only relocating old garden coordinates',()=>{const old={...freshState(),version:4,epoch:'old-save',day:47,minute:850,water:2,herbs:17,harvest:29,position:{x:1,z:3},magic:{...freshState().magic,lamps:3,seeds:1},journal:[{day:46,partner:'旧同行者',actions:{well:2}}]};const next=restoreState(old);assert.deepEqual(next.position,START);for(const k of ['epoch','day','minute','water','herbs','harvest','magic'])assert.deepEqual(next[k],old[k]);assert.equal(next.journal[0].actions.well,2);assert.equal(next.version,9);assert.deepEqual(restoreState(next),next);const forest=restoreState({...old,map:'forest',position:{x:0,z:3},companion:{...old.companion,map:'forest',position:{x:2,z:3}}});assert.deepEqual(forest.position,{x:0,z:3});assert.deepEqual(forest.companion.position,{x:2,z:3});});
function resource(){let disposed=0;const texture={isTexture:true,dispose(){disposed++;}},material={map:texture,dispose(){disposed++;}},geometry={dispose(){disposed++;}};return {root:{traverse(fn){fn({material,geometry});fn({material,geometry});}},disposed:()=>disposed};}
test('map loader deduplicates loads, retains the active scene after a failure and releases shared GPU resources once',async()=>{const a=resource(),b=resource(),attached=[],detached=[];let calls=0,fail=true;const loader=createMapLoader({maps:{a:{asset:'a'},b:{asset:'b'}},loadAsset:async url=>{calls++;if(url==='b'&&fail)throw Error('offline');return (url==='a'?a:b).root;},factories:{},attach:r=>attached.push(r),detach:r=>detached.push(r)});await Promise.all([loader.ensure('a'),loader.ensure('a')]);assert.equal(calls,1);await assert.rejects(loader.ensure('b'));assert.deepEqual(Object.keys(loader.views),['a']);assert.equal(a.disposed(),0);fail=false;await loader.ensure('b');loader.keep('b');assert.equal(a.disposed(),3);assert.deepEqual(detached,[a.root]);assert.deepEqual(Object.keys(loader.views),['b']);assert.equal(b.disposed(),0);});

// 她 2026-09-16：「我回不了家了」。地点下拉是照 sites 那张表长的，
// 表里没有家，就只剩「睡到明天」能回去——那是【结束这一天】，不是【回家】。
test('地点名单里必须有自己的小屋，而且走得到',()=>{
 const sites=MAPS.garden.sites;
 assert.ok(sites.home,'名单里没有家');
 assert.equal(sites.home.label,'自己的小屋');
 // 门前那个点就是睡觉那一处，别另立一个（两处迟早对不上）
 assert.deepEqual(sites.home.target,MAPS.garden.stations.rest);
 const path=findPath(MAPS.garden.spawn,sites.home.target,'garden');
 assert.ok(path?.length,'从村口走不回家');
 // 点屋子也认得出来
 assert.equal(hitInteraction('garden',villagePoint({x:-5.4,z:3.1},'home')).id,'home');
});
