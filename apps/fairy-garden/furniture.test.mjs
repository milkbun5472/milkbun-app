import test from 'node:test';import assert from 'node:assert/strict';
import {MAPS,FURNITURE,SPOTS,spotKey,spotParse,spotsAll,isSpot,spotLabel,furnitureHere,
 furnitureAtPoint,approachSpot,lookText,placeThing,placedAt,walkable,freshState,restoreState} from './world.mjs';
// 她 2026-09-17：「能不能做开放交互，每一个地方的家具都能交互」

test('每一间屋里的每一件家具都点得到、走得到',()=>{
 let total=0;
 for(const [map,m] of Object.entries(MAPS)) (m.furniture||[]).forEach((f,i)=>{
  total++;
  const key=spotKey(map,f.kind,i);
  assert.ok(FURNITURE[f.kind],map+' 里的 '+f.kind+' 还没有说法');
  assert.equal(furnitureAtPoint(map,{x:f.x,z:f.z}),key,'点在它身上要认得出是它');
  const s={...freshState(),map,position:{...m.spawn}};
  const p=approachSpot(s,key);
  assert.ok(p,key+' 旁边站不下人');
  assert.ok(walkable(p.x,p.z,map,s),key+' 旁边那一点站不住');
  assert.ok(lookText(s,key),key+' 看一眼没有话说');
 });
 assert.ok(total>=70,'这个世界里的家具应该有几十件，实际 '+total);
});

// ⚠️按 kind 认：codex 新盖一间屋、摆一张同样的桌子，这边不用改一个字
test('这张表只按 kind，不抄一份「哪间屋有哪几件」',()=>{
 const src=String(lookText);
 for(const key of Object.keys(FURNITURE)) assert.match(key,/^[a-z]+$/);
 // 表里不许出现房间名
 for(const map of Object.keys(MAPS))
  assert.ok(!Object.values(FURNITURE).some(v=>String(v.label+v.look).includes(map)));
});

// 原来能摆东西的只有三个位置，第四样往后全堆在盒子里没去处
test('放得住东西的家具都是一个位置，老三样一个都没丢',()=>{
 const all=spotsAll();
 for(const k of Object.keys(SPOTS)) assert.equal(all[k],SPOTS[k],'老位置「'+k+'」不许丢');
 assert.ok(Object.keys(all).length>=40,'实际只有 '+Object.keys(all).length+' 个位置');
 // holds 的才是位置；沙发不是
 const sofa=spotKey('home','sofa',MAPS.home.furniture.findIndex(f=>f.kind==='sofa'));
 assert.equal(isSpot(sofa),false,'沙发上摆不住东西');
 assert.ok(isSpot('eaves')&&isSpot('home:hearth:0'));
 assert.equal(isSpot('home:hearth:99'),false,'第 99 件不存在');
 assert.equal(isSpot('nowhere:table:0'),false);
});

test('走到哪一件旁边就摆在哪一件上，一处只摆一样',()=>{
 const key='home:hearth:0',other='home:table:2';
 let s={...freshState(),map:'home',things:[{id:'a',name:'雨铃',kind:'relic',day:1},{id:'b',name:'旧钥匙',kind:'relic',day:1}]};
 s=placeThing(s,'a',key);
 assert.equal(placedAt(s,key).name,'雨铃');
 assert.match(lookText(s,key),/雨铃/,'看一眼要先说她自己的东西');
 // 同一处再摆一样，前一样自己让开
 s=placeThing(s,'b',key);
 assert.equal(placedAt(s,key).name,'旧钥匙');
 assert.equal((s.things||[]).find(x=>x.id==='a').spot,null);
 // 换个位置互不影响
 s=placeThing(s,'a',other);
 assert.equal(placedAt(s,other).name,'雨铃');
 assert.equal(placedAt(s,key).name,'旧钥匙');
 // 摆不住的地方摆不上去
 const sofa=spotKey('home','sofa',MAPS.home.furniture.findIndex(f=>f.kind==='sofa'));
 assert.equal(placeThing(s,'a',sofa),s);
 // 存了再读回来还在那儿
 assert.equal(placedAt(restoreState(JSON.parse(JSON.stringify(s))),other).name,'雨铃');
});

// ⚠️钥匙只在一处拼：换个拼法她以前摆出去的东西就全掉了
test('位置的钥匙认得出是哪一间屋的哪一件',()=>{
 const at=spotParse('home:hearth:0');
 assert.equal(at.map,'home');assert.equal(at.kind,'hearth');
 assert.equal(at.piece,MAPS.home.furniture[0]);
 assert.equal(spotParse('home:sofa:0'),null,'第 0 件不是沙发，就不许认');
 assert.equal(spotParse('home:nothing:0'),null);
 assert.equal(spotParse(''),null);
 assert.match(spotLabel('home:hearth:0'),/林间的家.*壁炉/);
 assert.equal(spotLabel('eaves'),'屋檐下');
});

test('站在一件家具旁边，够得着的就是它',()=>{
 // ⚠️挑站位的时候要挑【它自己那一侧】：沙发前面 .4 米其实离那张桌子更近，
 //   那时候够得着的本来就该是桌子。
 const f=MAPS.home.furniture[1];
 const s={...freshState(),map:'home',position:{x:f.x,z:f.z-f.d/2-.4}};
 assert.equal(furnitureHere(s),spotKey('home',f.kind,1));
 assert.equal(furnitureHere({...s,position:{x:0,z:4.35}}),null,'站在屋子当中就没有');
});

test('看一眼一枪都不打，也不编她没有的东西',()=>{
 const s={...freshState(),map:'home'};
 for(const [map,m] of Object.entries(MAPS)) (m.furniture||[]).forEach((f,i)=>{
  const line=lookText({...s,map},spotKey(map,f.kind,i));
  assert.ok(!/你们|那天|还记得/.test(line),'不许编你俩的旧事：'+line);
 });
});
