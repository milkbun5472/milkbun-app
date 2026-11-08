import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {projectShop,DECOR_BUILDERS,npcLook} from '../apps/post-office/state.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ctx={console};ctx.window=ctx;vm.runInNewContext(read('js/stamp-duel.js'),ctx);const rules=ctx.StampDuel;
// Fields and default values copied from the actual SHOP_KEY/setShop writer in
// stamp-duel-ui.js, not inferred from projectShop's input.
const fixture=()=>({day:1,coins:20,decor:['旧木招牌','一盆绿萝','暖黄的吊灯','靠窗的长凳','铜铃门帘'],decorLv:{'一盆绿萝':2},roster:{柜台:'a',分拣:'b',送信:'c',看店:'d'},customers:[],phase:'plan',closing:null,earned:0,date:'2026-11-8',window:['card1','card2','card3'],badge:{}});
const characters=['a','b','c','d'].map(id=>({id,name:'角色'+id})),cards=[1,2,3].map(n=>({id:'card'+n,charId:'a',rarity:'R',lv:1,text:{name:'卡片'+n},face:n===1?'iv_fake':''}));
const options={characters,cards,lookFor:c=>({hairColor:c.id==='a'?'#b94747':'#354535',dims:{height:1.1}}),shopRules:rules,today:'2026-11-8'};
test('fixture stays tied to the shared text-shop writer',()=>{
 const ctx={};ctx.window=ctx;vm.runInNewContext(read('js/stamp-shop.js'),ctx);const blank=ctx.StampShop.restore(null);
 assert.equal(blank.day,1);assert.equal(blank.coins,20);assert.equal(blank.phase,'plan');assert.equal(blank.window.length,0);assert.equal(Object.keys(blank.badge).length,0);
 assert.match(read('js/stamp-duel-ui.js'),/window\.StampShop\.run/);
 assert.match(read('js/stamp-shop.js'),/commitJSONDurable\(KEY,value\)/);
 assert.deepEqual(Object.keys(fixture().roster),Array.from(rules.SHOP.POSTS));
 assert.deepEqual(Object.keys(DECOR_BUILDERS),Array.from(rules.SHOP.DECOR,x=>x.k));
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
test('shop uses one global writer, exposes no raw model or memory bridge, and uses the common mobile shell',()=>{
 const s=read('js/fairy-garden.js'),a=s.indexOf('function ShopSession('),b=s.indexOf('function WorldSession(',a);assert.ok(a>0&&b>a);const host=s.slice(a,b);
 assert.match(host,/root\.StampShop\.read\(\)/);assert.match(host,/root\.StampShop\.run/);assert.match(host,/\.shopPeriod\(now\)/);assert.match(host,/h\(Head/);assert.match(host,/paddingBottom:COMPOSER_PAD_BOTTOM/);assert.match(host,/minHeight:56/);assert.match(host,/flex-1 min-h-0/);assert.doesNotMatch(host,/saveJSON|addMemEntry|callAI|runProbe|storeKey|lockPartnerId/);
 for(const path of ['apps/post-office/state.mjs','apps/post-office/game.mjs','apps/post-office/view.mjs'])assert.doesNotMatch(read(path),/localStorage|saveJSON|callAI|runProbe|addMemEntry|\.glb/);
 assert.match(read('scripts/build-fairy-garden.mjs'),/walk\('apps\/post-office'\)/);
 assert.match(read('art/train-carriage/view.mjs'),/createWorldRenderer/);
 assert.equal((read('js/app.js').match(/onOpenStamps: openStamps/g)||[]).length,2,'main-world and side-room hosts both wire the same public navigation');
});

test('all actual public customer identities use their own costume IDs, while staff and role visitors share companion looks and day defaults',()=>{
 const actual=[...rules.SHOP.NPC,...rules.SHOP.TOUGH].map(x=>({name:x[0]})).concat([{name:'寄信的客人',wantChar:'a'}]);
 const styles=actual.map(c=>npcLook(c));assert.equal(new Set(styles.map(x=>x.npcStyle)).size,11);assert.ok(styles.every(x=>!Object.hasOwn(x,'outfit')&&!Object.hasOwn(x,'wardrobe')));
 const own={outfit:'jacket',hair:'curtains',hairColor:'#a25435',wardrobe:{jacket:{cloth:'#948571'}},dims:{height:1.17,build:1.08},eyeMode:'split',eyeLeft:'#638b7c',eyeRight:'#978047'};const chars=[{id:'a',name:'店员',ta:'他'},{id:'v',name:'来访角色',ta:'她'}];
 const raw={...fixture(),roster:{柜台:'a'},phase:'open',period:'上午',customers:[{id:'上午v0',charId:'v',visitor:true},{id:'上午c0',name:rules.SHOP.NPC[0][0]}]};
 const first=projectShop(raw,{...options,characters:chars,period:'上午',lookFor:()=>own});assert.deepEqual(first.staff[0].look,first.customers[0].look);assert.equal(first.customers[0].npcStyle,null);assert.equal(first.customers[1].npcStyle,'granny');assert.deepEqual(own.dims,{height:1.17,build:1.08});
 const next=projectShop(raw,{...options,characters:chars,period:'上午',lookFor:()=>({...own,outfit:'tee',hairColor:'#444444'})});assert.equal(next.staff[0].look.outfit,'tee');assert.equal(next.customers[0].look.hairColor,'#444444');
 const blank=projectShop(raw,{...options,characters:chars,period:'上午',lookFor:()=>({})});assert.equal(blank.staff[0].look.dims.height,1.10);assert.equal(blank.customers[0].look.dims.height,1.00);
});

test('outside follows local calendar months and clock without changing the shared shop save',async()=>{
 const {realTime}=await import('../apps/fairy-garden/real-clock.mjs'),{calendarEnvironment}=await import('../apps/pets/environment.mjs');
 const seasons=new Set();for(const month of [4,7,10,1]){const at=new Date(2026,month-1,8,12,30).getTime(),time=realTime(null,at),expected=calendarEnvironment(time,1234),raw=fixture(),before=structuredClone(raw),s=projectShop(raw,{...options,period:'下午',time,weatherSeed:1234});seasons.add(s.environment.season);assert.equal(s.environment.kind,expected.kind);assert.equal(s.environment.date,time.date);assert.equal(s.environment.minute,750);assert.equal(s.environment.source,'real-calendar');assert.equal(s.lighting,'day');assert.deepEqual(raw,before);}assert.equal(seasons.size,4);
});
test('a historical closing casts only its saved original clerks and uses their current companion appearance',()=>{
 const raw={...fixture(),phase:'closed',closing:['正文留底。'],closingTurns:[{speakerId:'b',text:'正文留底。'}],closeCast:{柜台:'b',分拣:'deleted'}};
 const s=projectShop(raw,{...options,period:'傍晚',stories:[{key:'date:2026-11-7',date:'2026-11-7',lines:['上一晚原文。'],cast:{送信:'a',看店:'deleted'}}]});assert.deepEqual(s.closing.staff.map(c=>c.id),['b']);assert.deepEqual(s.stories[0].staff.map(c=>c.id),['a']);assert.equal(s.stories[0].staff[0].look.hairColor,'#b94747');assert.equal(s.staff.length,0);
});
