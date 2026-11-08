import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {projectShop,DECOR_BUILDERS} from '../apps/post-office/state.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ctx={console};ctx.window=ctx;vm.runInNewContext(read('js/stamp-duel.js'),ctx);const rules=ctx.StampDuel;
// Fields and default values copied from the actual SHOP_KEY/setShop writer in
// stamp-duel-ui.js, not inferred from projectShop's input.
const fixture=()=>({day:1,coins:20,decor:['旧木招牌','一盆绿萝','暖黄的吊灯','靠窗的长凳','铜铃门帘'],decorLv:{'一盆绿萝':2},roster:{柜台:'a',分拣:'b',送信:'c',看店:'d'},customers:[],phase:'plan',closing:null,earned:0,date:'2026-11-8',window:['card1','card2','card3'],badge:{}});
const characters=['a','b','c','d'].map(id=>({id,name:'角色'+id})),cards=[1,2,3].map(n=>({id:'card'+n,charId:'a',rarity:'R',lv:1,text:{name:'卡片'+n},face:n===1?'iv_fake':''}));
const options={characters,cards,lookFor:c=>({hairColor:c.id==='a'?'#b94747':'#354535',dims:{height:1.1}}),shopRules:rules,today:'2026-11-8'};
test('fixture stays tied to the text-shop writer',()=>{
 const src=read('js/stamp-duel-ui.js'),a=src.indexOf('const SHOP_KEY ='),b=src.indexOf('const cardFilterHit',a);assert.ok(a>0&&b>a);
 assert.match(src.slice(a,b),/saveJSON\(SHOP_KEY, v\)/);
 assert.match(src,/shopSt \|\| \{ day: 1, coins: 20, decor: \[\], roster: \{\}, customers: \[\], phase: "plan", closing: null, earned: 0 \}/);
 assert.match(src,/sh\.window = sh\.window \|\| \[\]; sh\.badge = sh\.badge \|\| \{\}/);
 assert.deepEqual(Object.keys(fixture().roster),Array.from(rules.SHOP.POSTS));
 assert.deepEqual(Object.keys(DECOR_BUILDERS),Array.from(rules.SHOP.DECOR.slice(0,5),x=>x.k));
});
test('shared clock drives day, evening, night and exact boundaries; saved period never drives light',()=>{
 const raw=fixture();raw.period='半夜';
 for(const [hour,lighting,count]of [[0,'night',0],[5,'night',0],[6,'day',4],[11,'day',4],[12,'day',4],[17,'day',4],[18,'evening',4],[23,'evening',4]]){
  const next=projectShop(raw,{...options,period:rules.shopPeriod(new Date(2026,10,8,hour))});assert.equal(next.lighting,lighting);assert.equal(next.staff.length,count);assert.equal(next.closed,hour<6);
 }
 const closed=projectShop({...raw,phase:'closed'},{...options,period:'下午'});assert.ok(closed.closed);assert.equal(closed.staff.length,0);
 const tomorrow=projectShop({...raw,phase:'closed'},{...options,today:'2026-11-9',period:'上午'});assert.equal(tomorrow.phase,'plan');assert.equal(tomorrow.staff.length,4);
});
test('four actual identities, existing looks, cards and purchased decor project without modifying a save',()=>{
 const raw=fixture(),before=structuredClone(raw),s=projectShop(raw,{...options,period:'上午'});
 assert.deepEqual(s.staff.map(c=>[c.post,c.id]),[['柜台','a'],['分拣','b'],['送信','c'],['看店','d']]);
 assert.equal(s.staff[0].look.hairColor,'#b94747');assert.equal(s.staff[3].gesture,'sit');assert.equal(s.cards.length,3);assert.equal(s.cards[0].image,'iv_fake');assert.equal(s.decor.length,5);assert.equal(s.decor.find(d=>d.builder==='plant').level,2);assert.deepEqual(raw,before);
 const partial=projectShop({...raw,roster:{柜台:'d'},decor:['一盆绿萝']},{...options,period:'上午'});assert.deepEqual(partial.staff.map(c=>c.id),['d']);assert.deepEqual(partial.decor.map(d=>d.builder),['plant']);
});
test('empty, malformed, deleted roles/cards and invalid decor stay safe and read-only',()=>{
 for(const raw of [null,undefined,0,'broken',[],{roster:'bad',decor:{},window:{}},{roster:{柜台:'deleted'},window:['deleted'],decor:['missing']}]){
  const s=projectShop(raw,{...options,period:'上午'});assert.equal(s.staff.length,0);assert.equal(s.cards.length,0);assert.equal(s.decor.length,0);
 }
 assert.equal(projectShop(fixture(),{...options,lookFor:()=>{throw Error('bad look');},period:'上午'}).staff.length,4);
 const raw=fixture();raw.window=['card1','card1','deleted','card2','card3','card4'];assert.equal(projectShop(raw,{...options,period:'上午'}).cards.length,2);
});
test('one-shot navigation supports the shop, duel invitations, old card links and consumes return targets',()=>{
 const g={React:{}};g.window=g;vm.runInNewContext(read('js/stamps-core.js'),g);const nav=g.StampNavigation;
 let screen;nav.open({tab:'duel',mode:'shop',back:'fairy-shop'},s=>screen=s);assert.equal(screen,'stamps');let d=nav.consume();assert.equal(d.mode,'shop');assert.equal(d.back,'fairy-shop');assert.equal(nav.consume().back,null);
 nav.open({tab:'duel',preset:{foeId:'a',wager:'写信'}},()=>{});assert.equal(nav.consume().preset.foeId,'a');
 g.__stampsOpen='card1';assert.equal(nav.consume().cardId,'card1');g.__stampsDuel={foeId:'old'};assert.equal(nav.consume().preset.foeId,'old');assert.equal(nav.consume().tab,'pull');
});
test('shop is globally read-only, has no chat/AI/storage bridge, and uses the common mobile shell',()=>{
 const s=read('js/fairy-garden.js'),a=s.indexOf('function ShopSession('),b=s.indexOf('function WorldSession(',a);assert.ok(a>0&&b>a);const host=s.slice(a,b);
 assert.match(host,/loadJSON\("x_stampShop",null\)/);assert.match(host,/\.shopPeriod\(now\)/);assert.match(host,/h\(Head/);assert.match(host,/paddingBottom:COMPOSER_PAD_BOTTOM/);assert.match(host,/minHeight:56/);assert.match(host,/flex-1 min-h-0/);assert.doesNotMatch(host,/saveJSON|addMemEntry|callAI|runProbe|storeKey|lockPartnerId/);
 for(const path of ['apps/post-office/state.mjs','apps/post-office/game.mjs','apps/post-office/view.mjs'])assert.doesNotMatch(read(path),/localStorage|saveJSON|callAI|runProbe|addMemEntry|\.glb/);
 assert.match(read('scripts/build-fairy-garden.mjs'),/walk\('apps\/post-office'\)/);
 assert.match(read('art/train-carriage/view.mjs'),/createWorldRenderer/);
 assert.equal((read('js/app.js').match(/onOpenStamps: openStamps/g)||[]).length,2,'main-world and side-room hosts both wire the same public navigation');
});
