// Isolated browser only. Supply PLAYWRIGHT_MODULE and GARDEN_TEST_URL; never uses a real profile/API.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.GARDEN_TEST_URL||'http://127.0.0.1:18893';
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{const p=await browser.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await p.addInitScript(()=>{if(!sessionStorage.getItem('garden-test-seeded')){localStorage.setItem('x_characters',JSON.stringify([{id:'garden_test_role',name:'测试同行者',persona:'温和的魔法学徒，喜欢观察草木。',gender:'other'},{id:'garden_other_role',name:'另一位同行者',persona:'喜欢冒险的魔法师。',gender:'other'}]));localStorage.setItem('x_profile',JSON.stringify({name:'测试玩家',persona:'旅行者'}));localStorage.setItem('x_api',JSON.stringify([{id:'fake',name:'测试线路',base:'https://invalid.test',key:'dummy',model:'mock'}]));sessionStorage.setItem('garden-test-seeded','1');}});await p.goto(base);await p.getByText('翻 开',{exact:true}).click({timeout:20000});await p.getByText('微光庭院',{exact:true}).click();await p.getByRole('button',{name:'测试同行者',exact:true}).click();
const game=()=>p.frames().find(f=>f.url().includes('/apps/fairy-garden/'));
await p.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.gardenDebug?.getReady(),{},{timeout:30000});
// View changes remain local UI preferences, with real pointer pinch input in the iframe.
const f=game();const expanded=await f.locator('#action-panel').boundingBox();
await f.getByRole('button',{name:'收起行动',exact:true}).click();assert.equal(await f.locator('#panel-content').isVisible(),false);
const compact=await f.locator('#action-panel').boundingBox();assert.ok(compact.height<65&&compact.height<expanded.height/2);
await f.getByRole('button',{name:'放大地图'}).click();assert.ok(await f.evaluate(()=>gardenDebug.getView().zoom)>1);
await f.getByRole('button',{name:'缩小地图'}).click();assert.ok(Math.abs(await f.evaluate(()=>gardenDebug.getView().zoom)-1)<.001);
const beforePinch=await f.evaluate(()=>gardenDebug.getPlayer());const cdp=await p.context().newCDPSession(p);const rect=await p.locator('iframe').boundingBox();
const touch=(x,y,id)=>({x:rect.x+x,y:rect.y+y,id,radiusX:4,radiusY:4,force:1});
// A real single-finger drag moves the camera, never the player; the reset restores origin.
const initialPan=await f.evaluate(()=>gardenDebug.getView().pan);const projectionBefore=await f.evaluate(()=>gardenDebug.project(0,0));
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(160,250,7)]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(215,285,7)]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
const draggedPan=await f.evaluate(()=>gardenDebug.getView().pan);assert.ok(Math.hypot(draggedPan.x-initialPan.x,draggedPan.z-initialPan.z)>.1);assert.deepEqual(await f.evaluate(()=>gardenDebug.getPlayer()),beforePinch);const projectionAfter=await f.evaluate(()=>gardenDebug.project(0,0));assert.ok(Math.abs(projectionAfter.x-projectionBefore.x-55)<2&&Math.abs(projectionAfter.y-projectionBefore.y-35)<2);
await f.getByRole('button',{name:'恢复默认地图大小'}).click();assert.deepEqual(await f.evaluate(()=>gardenDebug.getView().pan),{x:0,z:0});

await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(140,220,1),touch(240,220,2)]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(110,220,1),touch(270,220,2)]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
assert.ok(await f.evaluate(()=>gardenDebug.getView().zoom)>1.3);assert.deepEqual(await f.evaluate(()=>gardenDebug.getPlayer()),beforePinch);
await p.screenshot({path:'/tmp/fairy-phone-folded-zoom.png'});
const target=await f.evaluate(()=>gardenDebug.project(0,3));await p.mouse.click(rect.x+target.x,rect.y+target.y);await f.waitForFunction(()=>{const p=gardenDebug.getPlayer();return !p.moving&&Math.hypot(p.x,p.z-3)<.15;},{},{timeout:15000});
await f.getByRole('button',{name:'回到自己位置'}).click();const centered=await f.evaluate(()=>({pan:gardenDebug.getView().pan,player:gardenDebug.getPlayer()}));assert.ok(Math.hypot(centered.pan.x-centered.player.x,centered.pan.z-centered.player.z)<.01);await f.getByRole('button',{name:'恢复默认地图大小'}).click();assert.equal(await f.evaluate(()=>gardenDebug.getView().zoom),1);
await f.getByRole('button',{name:'展开行动',exact:true}).click();assert.equal(await f.locator('#well').isVisible(),true);
await p.setViewportSize({width:320,height:568});const panel=await f.locator('#action-panel').boundingBox();assert.ok(panel.x>=0&&panel.x+panel.width<=320&&panel.y+panel.height<=568);
await f.getByRole('button',{name:'收起行动',exact:true}).click();await p.screenshot({path:'/tmp/fairy-phone-folded-small.png'});const controls=await f.locator('.map-controls').boundingBox(),season=await f.locator('#season-open').boundingBox();assert.ok(controls.x>=season.x+season.width&&controls.x+controls.width<=320);
await p.waitForTimeout(180);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('x_fairyGardenView')).folded),true);
await p.setViewportSize({width:390,height:844});
await p.evaluate(()=>{window.__calls=[];callAI=async(...a)=>{window.__calls.push(a);return JSON.stringify({reply:'好，我沿着小路去池边等你。',action:{kind:'goto',target:'pond'}});};});
await p.getByRole('button',{name:'说话',exact:true}).click();await p.getByRole('textbox',{name:'对同行者说'}).fill('去池边等我');await p.getByRole('button',{name:'发送',exact:true}).click();await p.getByText('好，我沿着小路去池边等你。',{exact:false}).waitFor();
assert.equal(await game().evaluate(()=>gardenDebug.getState().companion.destination),'pond');const calls=await p.evaluate(()=>window.__calls.filter(a=>a[3]?.tag==="微光庭院"));assert.equal(calls.length,1);assert.equal(calls[0][3].maxTokens,65535);assert.match(calls[0][1],/温和的魔法学徒/);
assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:'/tmp/fairy-phone-chat.png'});
await p.setViewportSize({width:375,height:667});await p.screenshot({path:'/tmp/fairy-phone-chat-small.png'});const input=await p.getByRole('textbox',{name:'对同行者说'}).boundingBox();assert.ok(input.y+input.height<=667);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
// Broken model output keeps the user's message, with an explicit retry.
await p.evaluate(()=>{callAI=async()=> 'broken reply';});await p.getByRole('textbox',{name:'对同行者说'}).fill('给我讲个故事');await p.getByRole('button',{name:'发送',exact:true}).click();await p.getByRole('button',{name:'重试上次未完成的回复'}).waitFor();await p.evaluate(()=>{callAI=async()=>JSON.stringify({reply:'树梢亮起了小小的灯。',action:{kind:'wait'}});});await p.getByRole('button',{name:'重试上次未完成的回复'}).click();await p.getByText('树梢亮起了小小的灯。',{exact:false}).waitFor();let saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('x_fairyGarden')));assert.equal(saved.dialogs.garden_test_role.filter(m=>m.content==='给我讲个故事').length,1);assert.equal(saved.world.companion.mode,'wait');
// Role changes retain the world and keep role conversations separate.
const worldBefore=saved.world;await p.getByRole('button',{name:'换同行者'}).click();await p.getByRole('button',{name:'另一位同行者',exact:true}).click();await p.waitForFunction(()=>document.querySelector('iframe')?.contentWindow.gardenDebug?.getReady());await p.getByRole('button',{name:'说话',exact:true}).click();assert.equal(await p.getByText('树梢亮起了小小的灯。',{exact:false}).count(),0);saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('x_fairyGarden')));assert.equal(saved.world.day,worldBefore.day);assert.equal(saved.world.harvest,worldBefore.harvest);
// A late reply must not write into a replaced save.
await p.evaluate(()=>{callAI=()=>new Promise(resolve=>window.__finishGardenReply=resolve);});await p.getByRole('textbox',{name:'对同行者说'}).fill('稍后再说');await p.getByRole('button',{name:'发送',exact:true}).click();await p.waitForFunction(()=>!!window.__finishGardenReply);await p.evaluate(()=>{localStorage.setItem('x_fairyGarden',JSON.stringify({version:1,id:'replacement',partnerId:'garden_test_role',world:null,dialogs:{}}));window.__finishGardenReply(JSON.stringify({reply:'旧请求不应写入',action:{kind:'follow'}}));});await p.getByRole('alert').waitFor();assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('x_fairyGarden')).dialogs),{});
assert.deepEqual(errors,[]);console.log('PASS: phone entry, folding, buttons, real drag follows finger without walking, recenter/reset, real pinch without walking, walking after zoom, 320/375/390 layouts, bounded AI action, persistence, retry, role isolation, replaced-save guard; no page errors.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
