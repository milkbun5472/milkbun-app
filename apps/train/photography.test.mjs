import test from 'node:test';import assert from 'node:assert/strict';
import {startTrip} from './travel.mjs';
import {photoPlan,exchangePhotos,photoLabel,FILM_LIMIT} from './photography.mjs';
import {albumRows,photographerLabel} from './album.mjs';
const companion={id:'alice',name:'同行者'},base=()=>({...startTrip({day:20,minute:701,epoch:'film'},()=>0),distance:8});
test('companion camera uses actual visible landmarks and a stable individual crop',()=>{
 const s=base(),p=photoPlan(s,companion,1600,600);assert.equal(p.subject,'林间道口');assert.equal(p.environment.time,'11:41');assert.deepEqual(p,photoPlan(s,companion,1600,600));assert.notDeepEqual(p.crop,photoPlan(s,{id:'bob'},1600,600).crop);
 for(const distance of [0,79,140])assert.equal(photoPlan({...s,distance},companion,1600,600),null);assert.equal(photoPlan(s,null,1600,600),null);
 assert.ok(p.crop.x>=0&&p.crop.y>=0&&p.crop.x+p.crop.w<=1600&&p.crop.y+p.crop.h<=600);
});
test('film is bounded, spaced, persisted across reload and resets only on a new trip',()=>{
 const s=base(),plan=photoPlan(s,companion,1600,600),shot={id:'shot',src:'data:image/jpeg;base64,YQ==',label:photoLabel(plan.environment),photographer:{...companion,role:'companion'}};
 const taken={...s,companionPhotos:[shot],cameraLog:plan};assert.equal(photoPlan(JSON.parse(JSON.stringify(taken)),companion,1600,600),null);
 assert.equal(photoPlan({...taken,distance:98,cameraLog:{...plan,count:FILM_LIMIT}},companion,1600,600),null);
 assert.equal(photoPlan({...s,companionPhotos:Array(36).fill(shot)},companion,1600,600),null);
 const next=startTrip(null,()=>0,taken);assert.deepEqual(next.companionPhotos,[shot]);assert.ok(photoPlan({...next,distance:8},companion,1600,600));
});
test('exchange reveals only saved photos once, preserving ownership and existing puzzle',()=>{
 const photo={id:'theirs',src:'data:image/jpeg;base64,YQ==',photographer:{role:'companion',name:'同行者'}};
 const s={photos:[{id:'mine'}],companionPhotos:[photo],puzzle:{photoId:'mine'}};assert.equal(albumRows(s).length,1);
 const exchanged=exchangePhotos(s);assert.equal(exchanged.photos.length,2);assert.deepEqual(exchanged.companionPhotos,[]);assert.deepEqual(exchangePhotos(exchanged),exchanged);assert.equal(exchanged.puzzle,s.puzzle);assert.equal(photographerLabel(photo),'同行者拍的');assert.equal(s.companionPhotos.length,1);
 assert.equal(exchangePhotos({...s,photos:[photo]}).photos.length,1);
});
