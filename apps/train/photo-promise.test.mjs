import test from 'node:test';import assert from 'node:assert/strict';
import {startTrip,travelEnvironment} from './travel.mjs';
import {makePromise,currentPromise,matchesTheme,creditPhoto,promiseSummaries} from './photo-promise.mjs';
import {photoPlan,exchangePhotos} from './photography.mjs';
const base=()=>({...startTrip({day:20,minute:720,epoch:'promise-test'},()=>0),distance:42});
const crop={x:350,y:0,w:900,h:600},photo=(id,role='you')=>({id,label:'沿途真实照片',photographer:{role}});
test('a trip has one immutable choice; earlier photos are not backfilled and old promises survive new travel',()=>{
 const s=makePromise({...base(),photos:[photo('old')]},'bridge',{id:'friend',name:'同行者'});assert.equal(currentPromise(s).you.theme,'bridge');assert.equal(currentPromise(s).you.result,undefined);assert.notEqual(currentPromise(s).companion.theme,'bridge');assert.throws(()=>makePromise(s,'water'),/已经约好/);
 const next=startTrip(null,()=>0,s);assert.equal(currentPromise(next),null);assert.deepEqual(next.photoPromises,s.photoPromises);assert.equal(makePromise(next,'water',null).photoPromises.length,2);
 assert.throws(()=>makePromise({...base(),cameraLog:{trip:1,count:6}},'bridge',{id:'friend'}),/拍满/);assert.throws(()=>makePromise(base(),'not-a-theme'),/先选/);
});
test('framing and actual event both matter; tunnel, transition, sky-only and wrong conditions fail',()=>{
 assert.equal(matchesTheme(base(),'bridge',crop),true);assert.equal(matchesTheme(base(),'bridge',{x:500,y:0,w:300,h:200}),false);
 for(const distance of [0,80,140])assert.equal(matchesTheme({...base(),distance},'bridge',crop),false);
 assert.equal(matchesTheme({...base(),distance:62},'station',crop),true);assert.equal(matchesTheme({...base(),distance:62},'lights',crop),false);assert.equal(matchesTheme({...base(),distance:62,minute:1320},'lights',crop),true);assert.equal(matchesTheme({...base(),distance:62,minute:1320},'lights',{x:700,y:250,w:300,h:100}),false);
 let rain;for(let day=1;day<100;day++){const s={...base(),day,minute:1320};if(travelEnvironment(s).weather==='rain'){rain=s;break;}}assert.ok(rain);assert.equal(matchesTheme(rain,'rain-night',crop),true);assert.equal(matchesTheme({...rain,minute:720},'rain-night',crop),false);assert.equal(matchesTheme({...rain,distance:80},'rain-night',crop),false);
});
test('only first valid shot credits a promise, with no mutation or image payload in summaries',()=>{
 const s=makePromise(base(),'bridge',null),first=creditPhoto(s,photo('new'),crop,1600,600);assert.equal(first.photo.promise.name,'桥上的风景');assert.equal(currentPromise(first.s).you.result.photoId,'new');assert.equal(currentPromise(s).you.result,undefined);
 const repeated=creditPhoto(first.s,photo('again'),crop,1600,600);assert.equal(repeated.s,first.s);assert.equal(repeated.photo.promise,undefined);assert.equal(promiseSummaries(first.s)[0].you.status,'已拍到');
});
test('companion reserves shots for its theme and its result is revealed only after exchange',()=>{
 let s=makePromise({...base(),distance:8},'rain-night',{id:'friend',name:'同行者'});assert.equal(promiseSummaries(exchangePhotos(s))[0].companion.status,'暂时还没拍到');let plan,at;
 for(let distance=0;distance<160;distance+=.5){at={...s,distance};plan=photoPlan(at,{id:'friend'},1600,600);if(plan)break;}
 assert.ok(plan);assert.equal(matchesTheme(at,currentPromise(s).companion.theme,plan.crop),true);
 const credited=creditPhoto(at,photo('theirs','companion'),plan.crop,1600,600);s={...credited.s,photos:[],companionPhotos:[credited.photo]};assert.match(promiseSummaries(s)[0].companion.status,/揭晓/);assert.match(promiseSummaries(s,true)[0].companion.status,/尚未交换/);
 const shared=exchangePhotos(s);assert.equal(promiseSummaries(shared)[0].companion.status,'已拍到并交换');assert.equal(shared.photos[0].promise.id,currentPromise(s).id);assert.deepEqual(exchangePhotos(shared),shared);
});

test('人物摄影沿用同一相册，但不冒充窗景约定达成',()=>{const s={trips:1,photoPromises:[{id:'promise-1',trip:1,you:{theme:'bridge'}}]};for(const subject of ['companion','together']){const photo={id:'portrait',subject,photographer:{role:'you'}};const result=creditPhoto(s,photo);assert.equal(result.s,s);assert.equal(result.photo,photo);assert.equal(result.photo.promise,undefined);}});
