const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.POST_OFFICE_URL||'http://127.0.0.1:18968',out=process.env.POST_OFFICE_EVIDENCE||'/tmp/post-office-evidence';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await (process.env.POST_OFFICE_BROWSER==='webkit'?webkit.launch({headless:true,executablePath:process.env.WEBKIT_EXECUTABLE}):chromium.launch({channel:'chrome',headless:true}));
 const result={errors:[],external:[],viewports:[],models:[]};
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},timezoneId:'America/Winnipeg'});
  p.on('pageerror',e=>{result.errors.push(e.message);console.error('PAGE',e.message);});p.on('request',r=>{if(/\.glb(?:\?|$)/.test(r.url()))result.models.push(new URL(r.url()).pathname);});
  await p.route('**/*',route=>{const u=route.request().url();if(u.startsWith(base)||u.startsWith('blob:')||u.startsWith('data:'))return route.continue();result.external.push(u);return route.abort();});
  await p.clock.setFixedTime(new Date('2026-11-08T10:00:00-06:00'));
  await p.goto(base,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.LazyMods&&typeof saveJSON==='function');
  await p.evaluate(async()=>{await txtVaultReady();await LazyMods.load('garden');await LazyMods.load('stamps');
   window.shopCalls={ai:0,memory:0};window.callAI=window.runProbe=()=>{shopCalls.ai++;throw Error('model forbidden');};window.addMemEntry=()=>{shopCalls.memory++;};
   // Matches the text writer: shared x_stampShop with per-post IDs and card IDs.
   window.shopFixture={day:1,date:'2026-11-8',coins:20,earned:0,decor:['旧木招牌','一盆绿萝','暖黄的吊灯','靠窗的长凳','铜铃门帘'],decorLv:{'一盆绿萝':2},roster:{柜台:'a',分拣:'b',送信:'c',看店:'d'},badge:{},window:['card1','card2','card3'],phase:'plan',period:'傍晚',customers:[],closing:null};
   saveJSON('x_stampShop',shopFixture);
   const looks={a:{hair:'curtains',hairColor:'#a64138',cloth:'#b56751'},b:{hair:'bob',hairColor:'#434535',cloth:'#6c8d76'},c:{hair:'pixie',hairColor:'#8c7347',cloth:'#64788b'},d:{hair:'longpart',hairColor:'#343b5d',cloth:'#a17e92'}};
   saveJSON('x_companion',{autoFace:false,looks});
   const cards=['a','b','c','d'].map((id,i)=>({id:'card'+(i+1),charId:id,kind:'daily',rarity:'R',lv:1,ts:Date.now(),text:{name:['远方的信','窗边一刻','晚风明信片','邮路'][i],gist:'测试卡片',line:'测试'},face:i===0?'shop-test-image':''}));
   const cv=document.createElement('canvas');cv.width=150;cv.height=200;const c=cv.getContext('2d');c.fillStyle='#b06b53';c.fillRect(0,0,150,200);c.fillStyle='#e9d5ac';c.fillRect(12,12,126,176);c.fillStyle='#6a8c7d';c.beginPath();c.arc(75,87,40,0,Math.PI*2);c.fill();const imageBlob=await new Promise(r=>cv.toBlob(r,'image/png'));window.shopImageFixture='idb';try{await idbImgPut('th2_shop-test-image',imageBlob);}catch{window.shopImageFixture='memory';const realGet=idbImgGet;window.idbImgGet=k=>k==='th2_shop-test-image'?Promise.resolve(imageBlob):realGet(k);}
   saveJSON('x_stamps',{cards,opt:{},postage:300,ink:0});
   window.shopArchive=loadJSON('x_fairyGarden',null);window.shopInitial=JSON.stringify(loadJSON('x_stampShop',null));
   const el=document.createElement('div');el.id='post-office-test';el.style.cssText='position:fixed;inset:0;height:100dvh;z-index:999999';document.body.append(el);
   const chars=['a','b','c','d'].map(id=>({id,name:'店员'+id}));window.shopRoot=ReactDOM.createRoot(el);
   function Harness(){const [screen,screenTo]=React.useState('worlds'),[initial,initialTo]=React.useState(null);window.shopSetScreen=screenTo;
    const returnWorld=()=>{initialTo('shop');screenTo('worlds');};
    return screen==='stamps'?React.createElement(StampBookApp,{characters:chars,meName:'玩家',toast:()=>{},onBack:()=>screenTo('worlds'),onReturnToWorld:returnWorld,onDuelChat:()=>{shopCalls.ai++;throw Error('no AI');}}):React.createElement(FairyGardenApp,{key:initial||'list',initialWorld:initial,characters:chars,lookFor:c=>CompanionFace.lookFor(c,{}),toast:()=>{},onOpenStamps:target=>StampNavigation.open(target,screenTo),onBack:()=>{},onNewGardenRoom:()=>{throw Error('shop must not create rooms');}});
   }
   shopRoot.render(React.createElement(Harness));
  });
  const r=p.locator('#post-office-test');
  const names=await r.locator('[data-wk=fgworldname]').allTextContents();assert.deepEqual(names.slice(0,5),['微光庭院','远行列车','绒绒小镇','TA的一天','邮局小店']);
  await r.getByRole('button',{name:/邮局小店/}).click();
  const getFrame=()=>p.frames().find(f=>f.url().includes('/apps/post-office/'));
  await p.waitForFunction(()=>document.querySelector('#post-office-test iframe')?.contentWindow.PostOfficeGame?.ready);
  let f=getFrame();await f.waitForFunction(()=>PostOfficeGame.snapshot().cards.some(c=>c.image));
  let snap=await f.evaluate(()=>PostOfficeGame.snapshot());assert.equal(snap.people.length,4);assert.equal(snap.decor.length,5);assert.equal(snap.cards.length,3);assert.equal(snap.lighting.lamp,0);assert.equal(snap.closedSign,false);assert.equal(snap.people[0].look.hairColor,'#a64138');assert.equal(snap.people[3].posture,'sit');
  assert.deepEqual(await p.evaluate(()=>loadJSON('x_stampShop',null).roster),await p.evaluate(()=>shopFixture.roster),'clock sync preserves assignments');
  for(const [width,height]of [[320,568],[390,844],[430,932]]){
   await p.setViewportSize({width,height});await p.waitForTimeout(150);
   assert.equal(await r.evaluate(el=>el.scrollWidth>innerWidth),false);
   const footer=await r.getByRole('button',{name:'去柜台',exact:true}).boundingBox();assert.ok(footer.height>=40&&footer.x>=0&&footer.x+footer.width<=width&&footer.y+footer.height<=height);
   const frameBox=await r.locator('iframe').boundingBox();assert.ok(frameBox.height>height*.6);
   await p.screenshot({path:path.join(out,'day-'+width+'.png')});result.viewports.push({width,height,ok:true});
  }
  await p.setViewportSize({width:390,height:844});await p.waitForTimeout(300);
  // Physical counter hit-testing, rather than invoking its handler.
  const hit=await f.evaluate(()=>PostOfficeGame.projectCounter()),fb=await r.locator('iframe').boundingBox();
  await p.mouse.click(fb.x+hit.x,fb.y+hit.y);await r.locator('[data-wk=duelshop]').waitFor({timeout:5000}).catch(async e=>{console.log('COUNTER',await f.evaluate(()=>PostOfficeGame.snapshot()),await r.innerText());throw e;});assert.equal(await r.locator('iframe').count(),0);
  const posts=r.locator('[data-wk=duelshoppost]');assert.equal(await posts.count(),4);await posts.nth(2).getByRole('button',{name:'空着',exact:true}).click();await p.waitForFunction(()=>loadJSON('x_stampShop',null).roster['送信']==='');await posts.first().getByRole('button',{name:'店员c',exact:true}).click();await p.waitForFunction(()=>loadJSON('x_stampShop',null).roster['柜台']==='c');
  assert.equal(await p.evaluate(()=>loadJSON('x_stampShop',null).roster['柜台']),'c');
  await r.locator('[data-wk=head] button').first().click();await p.waitForFunction(()=>document.querySelector('#post-office-test iframe')?.contentWindow.PostOfficeGame?.ready);f=getFrame();await f.evaluate(()=>{for(let i=0;i<1200;i++)PostOfficeGame.step(.05);});
  assert.equal((await f.evaluate(()=>PostOfficeGame.snapshot())).people.find(a=>a.post==='柜台').id,'c');result.textRoundTrip=true;
  await p.clock.setFixedTime(new Date('2026-11-08T18:00:00-06:00'));await f.evaluate(()=>PostOfficeGame.refresh());assert.equal((await f.evaluate(()=>PostOfficeGame.snapshot())).lighting.lamp,6);await p.screenshot({path:path.join(out,'evening.png')});
  await p.clock.setFixedTime(new Date('2026-11-09T01:00:00-06:00'));await f.evaluate(async()=>{await PostOfficeGame.refresh();for(let i=0;i<1200;i++)PostOfficeGame.step(.05);});snap=await f.evaluate(()=>PostOfficeGame.snapshot());assert.equal(snap.people.length,0);assert.equal(snap.closedSign,true);assert.equal(snap.lighting.lamp,0);await p.screenshot({path:path.join(out,'night.png')});result.clock=true;
  await p.clock.setFixedTime(new Date('2026-11-09T10:00:00-06:00'));
  for(const value of [null,'bad',{roster:'bad',decor:12,window:{}},{roster:{柜台:'deleted'},window:['deleted']}]){await p.evaluate(v=>saveJSON('x_stampShop',v),value);await f.evaluate(async()=>{await PostOfficeGame.refresh();for(let i=0;i<1200;i++)PostOfficeGame.step(.05);});snap=await f.evaluate(()=>PostOfficeGame.snapshot());assert.equal(snap.people.length,0);assert.equal(snap.cards.length,0);assert.equal(snap.decor.length,0);}
  result.invalidSaves=true;
  // A purchase/roster change made through the shared writer is picked up in-place.
  await p.evaluate(()=>saveJSON('x_stampShop',{...shopFixture,date:'2026-11-9',roster:{分拣:'b'},decor:['一盆绿萝']}));await f.evaluate(()=>PostOfficeGame.refresh());snap=await f.evaluate(()=>PostOfficeGame.snapshot());assert.equal(snap.people.length,1);assert.deepEqual(snap.decor,['一盆绿萝']);
  await r.getByRole('button',{name:'去别处',exact:true}).click();for(const name of ['进入微光庭院','进入远行列车','进入绒绒小镇'])assert.equal(await r.getByRole('button',{name,exact:true}).count(),1);
  // Switch away and return without writing a shop archive or leaking the renderer.
  await r.getByRole('button',{name:'进入远行列车',exact:true}).click();assert.equal(await r.locator('iframe').count(),0);await r.locator('[data-wk=head] button').first().click();await r.getByRole('button',{name:/邮局小店/}).click();await p.waitForFunction(()=>document.querySelector('#post-office-test iframe')?.contentWindow.PostOfficeGame?.ready);f=getFrame();
  const disposal=await f.evaluate(()=>{const game=PostOfficeGame;game.dispose();return {disposed:game.disposed,canvas:document.querySelectorAll('canvas').length};});assert.deepEqual(disposal,{disposed:true,canvas:0});
  result.imageFixture=await p.evaluate(()=>shopImageFixture);assert.deepEqual(await p.evaluate(()=>shopCalls),{ai:0,memory:0});assert.deepEqual(await p.evaluate(()=>loadJSON('x_fairyGarden',null)),await p.evaluate(()=>shopArchive));
  assert.deepEqual(result.errors,[]);assert.ok(result.external.every(u=>u.startsWith('https://fonts.googleapis.com/')||u.startsWith('https://server.arcgisonline.com/')),'unexpected external request');assert.ok(result.models.every(url=>url.startsWith(new URL(base).pathname.replace(/\/$/,'')+'/apps/fairy-garden/')));result.models=[...new Set(result.models)];
  await p.evaluate(async()=>{
   const w=await import('./apps/fairy-garden/world.mjs'),garden=w.setGuide({...w.freshState(),herbs:17},false);garden.companion.mode='wait';
   saveJSON('x_fairyGarden:shop-switch',{version:1,id:'shop-switch',partnerId:'a',world:garden,worlds:{garden,pets:{version:3,configured:true,profile:{species:'cat',name:'测试猫'},map:'outside',position:{x:0,z:0}}},journey:{},dialogs:{}});
   window.shopSwitchProps={storeKey:'x_fairyGarden:shop-switch',entryWorld:'train',characters:['a','b','c','d'].map(id=>({id,name:'店员'+id})),toast:()=>{},onBack:()=>{},onOpenStamps:target=>{window.shopRoomDeepLink=target;}};
   shopRoot.render(React.createElement(FairyGardenApp,shopSwitchProps));
  });
  await p.waitForFunction(()=>document.querySelector('#post-office-test iframe')?.contentWindow.TrainGame?.ready);
  await r.getByRole('button',{name:'下车',exact:true}).click();await r.getByRole('button',{name:'进入邮局小店',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#post-office-test iframe')?.contentWindow.PostOfficeGame?.ready);
  await r.getByRole('button',{name:'去柜台',exact:true}).click();assert.equal(await p.evaluate(()=>shopRoomDeepLink.back),'fairy-shop');
  await r.getByRole('button',{name:'去别处',exact:true}).click();await r.getByRole('button',{name:'进入微光庭院',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#post-office-test iframe')?.contentWindow.gardenDebug?.getReady());
  await r.getByRole('button',{name:'花册',exact:true}).click();await r.getByRole('button',{name:'进入邮局小店',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#post-office-test iframe')?.contentWindow.PostOfficeGame?.ready);
  await r.getByRole('button',{name:'去别处',exact:true}).click();await r.getByRole('button',{name:'进入绒绒小镇',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#post-office-test iframe')?.contentWindow.PetGame?.ready);let town=p.frames().find(f=>f.url().includes('/apps/pets/'));
  await r.getByRole('button',{name:'小镇菜单',exact:true}).click();await r.getByRole('button',{name:'走到绒绒小镇车站',exact:true}).click();await town.waitForFunction(()=>!petCareerPreview.snapshot().busy);await town.evaluate(()=>{for(let i=0;i<7000&&petCareerPreview.snapshot().walking;i++)PetGame.step(.05);});await r.locator('[data-railway-page=pets]').waitFor();
  await r.getByRole('button',{name:'进入邮局小店',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#post-office-test iframe')?.contentWindow.PostOfficeGame?.ready);
  assert.equal(await p.evaluate(()=>loadJSON('x_fairyGarden:shop-switch',null).worlds.garden.herbs),17);assert.deepEqual(await p.evaluate(()=>shopCalls),{ai:0,memory:0});assert.deepEqual(result.errors,[]);result.crossWorlds=true;result.ok=true;
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
