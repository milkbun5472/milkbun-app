const {cameraView,moreItem}=require('./char-day-ui-helpers.cjs');
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.DAY_URL||'http://127.0.0.1:18985',engine=process.env.DAY_ENGINE||'chromium',out=process.env.DAY_EVIDENCE||'/tmp/char-day-places-browser';fs.mkdirSync(out,{recursive:true});
const app=fs.readFileSync(path.join(__dirname,'../../js/app.js'),'utf8'),start=app.indexOf('  const saveSchedDay ='),end=app.indexOf('  const applySchedChange =',start);assert.ok(start>0&&end>start);const writer=app.slice(start,end);
(async()=>{
  const browser=await pw[engine].launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'America/Winnipeg'}),errors=[],requests=[],worldUrls=new Map(),placeUrls=new Map(),result={engine,places:[],widths:[]};let frame;
  try{
    page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{requests.push(r.url());if(/\/fairy-garden\/world\.mjs\?/.test(r.url()))worldUrls.set(r.frame(),r.url());if(/\/day\/places\/index\.mjs/.test(r.url()))placeUrls.set(r.frame(),r.url());});
    await page.clock.setFixedTime(new Date('2026-10-09T10:10:00Z'));await page.goto(base);
    await page.waitForFunction(()=>window.CharDayApp&&window.ReactDOM&&typeof txtVaultState==='function'&&txtVaultState().ok);
    await page.evaluate(writer=>{
      window.dayPlacesChars=[{id:'places-a',name:'测试研究员',gender:'male',tz:'0'}];let plans={};window.dayPlacesRef={current:plans};
      const save=new Function('setSchedules','schedulesRef','saveJSON',writer+'return saveSchedDay;');window.dayPlacesSave=save(fn=>{plans=fn(plans);},dayPlacesRef,saveJSON);
      dayPlacesSave('places-a','2026-10-09',{seqs:[{seq:1,time:'10:00',end:'12:00',title:'核对当天资料',location:'议事处',type:'work'}]});
      window.dayPlacesWrites=[];const original=saveJSON;window.saveJSON=(key,...args)=>{dayPlacesWrites.push(key);return original(key,...args);};
      window.dayPlacesModels=0;window.callAI=()=>{dayPlacesModels++;throw Error('Unexpected model call');};
      const el=document.createElement('div');el.id='day-places-root';el.style.cssText='position:fixed;inset:0;z-index:999999;height:100dvh';document.body.append(el);
      window.dayPlacesRoot=ReactDOM.createRoot(el);dayPlacesRoot.render(React.createElement(CharDayApp,{characters:dayPlacesChars,plansFor:c=>dayPlacesRef.current[c.id]||{},lookFor:()=>({outfit:'academy',hair:'korean',hairColor:'#43352e',wardrobe:{academy:{cloth:'#a8be83',trim:'#ebcedf',bottom:'#766956',boots:'#163541'}}}),taFor:()=> '他',onBack:()=>{},build:'places-browser'}));
    },writer);
    const root=page.locator('#day-places-root'),shot=name=>page.screenshot({path:path.join(out,name+'.png')}),ready=async()=>{await page.waitForFunction(()=>document.querySelector('#day-places-root iframe')?.contentWindow.CharDayScene?.inspect().ready);frame=page.frames().find(f=>f.url().includes('/fairy-garden/day/'));},state=()=>frame.evaluate(()=>CharDayScene.inspect());
    const demoLayout=async()=>{
      const widths=[];
      for(const [w,h]of [[320,568],[390,844],[430,932],[844,390]]){
        await page.setViewportSize({width:w,height:h});await page.waitForTimeout(100);
        const box=await root.locator('[data-wk=cdaytools]').evaluate(el=>({height:el.getBoundingClientRect().height,width:el.clientWidth,scrollWidth:el.scrollWidth,buttons:[...el.children].map(b=>b.getBoundingClientRect().toJSON())}));
        assert.equal(box.buttons.length,4,'原示例保留四个底键');assert.ok(box.height>=54&&box.height<=65,'示例四键底栏保持移动端标准高度');assert.ok(box.scrollWidth<=box.width);assert.ok(box.buttons.every(b=>b.right<=w+1&&b.x>=0&&b.height>=40));
        await shot('demo-controls-'+w+'x'+h);widths.push({w,h,...box});
      }
      await page.setViewportSize({width:390,height:844});return widths;
    };
    if(process.env.DAY_LAYOUT_ONLY&&process.env.DAY_LAYOUT_ONLY!=='places'){
      await root.getByRole('button',{name:'先看一段示例',exact:true}).click();await ready();await frame.waitForFunction(()=>CharDayScene.inspect().map&&!CharDayScene.inspect().changing);
      const report={engine,ok:true,demoWidths:await demoLayout(),errors};assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'demo-layout-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));return;
    }
    const baseline=await page.evaluate(()=>({plans:JSON.stringify(dayPlacesRef.current),writes:dayPlacesWrites.length,games:JSON.stringify(loadJSON('x_fairyGardenSaves',[]))}));
    const noWrites=async()=>{
      assert.equal(await page.evaluate(()=>JSON.stringify(dayPlacesRef.current)),baseline.plans);
      // The real App remains mounted behind this isolated viewer. Its startup migrations
      // are recorded separately; scene/schedule/chat/game writes must still remain zero.
      const writes=await page.evaluate(n=>dayPlacesWrites.slice(n),baseline.writes);
      assert.deepEqual(writes.filter(k=>/^x_(?:charDay|schedules|fairyGardenSaves|chat(?::|$))/.test(k)),[]);
      result.ambientAppWrites=[...new Set(writes)];
      assert.equal(await page.evaluate(()=>JSON.stringify(loadJSON('x_fairyGardenSaves',[]))),baseline.games);assert.equal(await page.evaluate(()=>dayPlacesModels),0);
    };
    await root.getByRole('button',{name:'新场景摆位试玩',exact:true}).click();await ready();
    await frame.waitForFunction(()=>CharDayScene.inspect().map?.startsWith('day')&&!CharDayScene.inspect().changing);
    await root.locator('select[data-wk=cdayplacepoint]').waitFor();assert.equal((await state()).charId,'__char_day_demo');
    result.pickerDemo=true;await shot('picker-place-entry');
    const placeData=await frame.evaluate(async url=>{const {DAY_PLACES}=await import(url);return DAY_PLACES;},placeUrls.get(frame));
    const places=await frame.evaluate(()=>CharDayScene.listPlaces());
    assert.deepEqual(places.map(p=>p.id),Object.keys(placeData),'场景选择器沿实际注册顺序');
    const requested=process.env.DAY_PLACES_FILTER?.split(',').map(s=>s.trim()).filter(Boolean),ids=requested||places.map(p=>p.id);
    for(const id of ids)assert.ok(placeData[id],'指定场景存在：'+id);
    result.registeredPlaces=places.map(p=>({id:p.id,label:p.label}));result.filtered=!!requested;
    const slug=id=>id.replace(/^day/,'').toLowerCase();
    const choosePlace=async(id,host=root)=>{
      for(let turn=0;turn<=places.length;turn++){
        const before=await state();if(before.map===id&&!before.changing)return;
        await host.getByRole('button',{name:'换场景',exact:true}).click();
        await frame.waitForFunction(previous=>{const s=CharDayScene.inspect();return s.map!==previous&&!s.changing;},before.map);
      }
      throw Error('场景循环未到达：'+id);
    };
    const placeLayouts=async id=>{
      for(const [w,h]of [[320,568],[390,844],[430,932],[844,390]]){
        await page.setViewportSize({width:w,height:h});await page.waitForTimeout(150);
        const boxes=await root.evaluate(el=>{const page=el.querySelector('[data-wk=cdaypage]'),get=selector=>page.querySelector(selector).getBoundingClientRect().toJSON(),tools=page.querySelector('[data-wk=cdaytools]');return {overflow:page.scrollWidth>page.clientWidth,head:get('[data-wk=head]'),scene:get('[data-wk=cdayscene]'),selector:get('[data-wk=cdayplacepoint]'),tools:get('[data-wk=cdaytools]'),bottomFormula:tools.style.paddingBottom,buttons:[...tools.querySelectorAll('button')].map(b=>b.getBoundingClientRect().toJSON())};});
        assert.equal(boxes.overflow,false);assert.ok(boxes.tools.height>=54&&boxes.tools.height<=65);assert.ok(Math.abs(boxes.tools.bottom-h)<2);assert.ok(boxes.scene.height>170);
        assert.ok(boxes.selector.height>=40,'动作位置选择器触区至少40px');assert.ok(boxes.selector.x>=0&&boxes.selector.right<=w+1);assert.ok(boxes.selector.top>=boxes.scene.top&&boxes.selector.bottom<=boxes.scene.bottom);assert.match(boxes.bottomFormula,/safe-area-inset-bottom.*0\.4/);
        assert.equal(boxes.buttons.length,4,'摆位试玩保留四个底键');assert.ok(boxes.buttons.every(b=>b.x>=0&&b.right<=w+1&&b.height>=40));
        await cameraView(root,true);assert.equal((await state()).following,false);
        await shot(slug(id)+'-overview-'+w+'x'+h);result.widths.push({id,w,h,...boxes});
      }
      await page.setViewportSize({width:390,height:844});
    };
    if(process.env.DAY_LAYOUT_ONLY==='places'){
      for(const id of ids){await choosePlace(id);await placeLayouts(id);result.places.push({id,label:placeData[id].label});}
      await noWrites();assert.deepEqual(errors,[]);result.layoutOnly=true;result.zeroModelCalls=true;result.zeroSceneWrites=true;result.errors=errors;result.ok=true;
      fs.writeFileSync(path.join(out,'places-layout-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));return;
    }
    const closeSpots=(id,map)=>{
      const preserved={dayLaboratory:['computer'],dayLibrary:['window-reading','desk-reading']}[id];
      if(preserved)return preserved.map(key=>map.spots.find(s=>s.id===key));
      return [map.spots.find(s=>s.seat),map.spots.find(s=>!s.seat&&!/入口|离开/.test(s.label+s.description))].filter(Boolean);
    };
    const visitSpot=async(map,spot,host=root)=>{
      assert.ok(spot,'存在要验证的动作位置');
      await host.locator('select[data-wk=cdayplacepoint]').selectOption(spot.id);
      assert.ok(worldUrls.get(frame),'找到当前iframe实际请求的导航模块');
      const motion=await frame.evaluate(async({id,spot,url})=>(await import(new URL('../workflow.mjs',url).href)).workMotion(id,spot),{id:map,spot:spot.id,url:placeUrls.get(frame)});
      const observed=await frame.evaluate(async({id,spot,worldUrl,motion})=>{
        const {walkable,segmentClear}=await import(worldUrl);
        return new Promise((resolve,reject)=>{const began=performance.now();let previous=null,frames=0,moved=false;
          function sample(){
            const s=CharDayScene.inspect();if(s.error)return reject(Error(s.error));
            if(s.map===id&&s.spot===spot.id&&!s.changing){
              frames++;
              if(!walkable(s.position.x,s.position.z,id))return reject(Error('动作位置或真实脚步进入障碍：'+spot.id));
              if(previous){if(!segmentClear(previous,s.position,id))return reject(Error('真实脚步跨越家具：'+spot.id));moved||=Math.hypot(s.position.x-previous.x,s.position.z-previous.z)>.001;}
              previous=s.position;
              if(!s.route.length&&(motion?s.workAction?.kind===motion:s.gesture===spot.gesture)&&Math.hypot(s.position.x-spot.target.x,s.position.z-spot.target.z)<.08)return resolve({frames,moved,position:s.position,seat:s.seat,workAction:s.workAction,gesture:s.gesture,avatarPosition:s.avatarPosition});
            }
            if(performance.now()-began>25000)return reject(Error('动作位置未抵达：'+spot.id));requestAnimationFrame(sample);
          }sample();
        });
      },{id:map,spot,worldUrl:worldUrls.get(frame),motion});
      if(motion)assert.equal(observed.workAction?.kind,motion);else assert.equal(observed.gesture,spot.gesture);assert.ok(observed.frames>0);
      if(spot.seat){
        await frame.waitForFunction(({x,z})=>{const s=CharDayScene.inspect();return s.seat&&Math.abs(s.avatarPosition[0]-x)<.01&&Math.abs(s.avatarPosition[2]-z)<.01&&s.avatarPosition[1]>.2&&s.avatarPosition[1]<.3;},spot.seat);
        assert.equal((await state()).seat.rise,.45);
      }else assert.equal((await state()).seat,null);
      if(spot.gesture==='read'&&(!motion||motion==='read')){await frame.waitForFunction(()=>CharDayScene.inspect().dailyAction?.book===true);}
      const text=await host.locator('[data-wk=cdaynow]').innerText();assert.ok(text.includes(spot.label));assert.ok(text.includes(spot.description));
      return {id:spot.id,...observed};
    };
    for(const id of ids){
      await choosePlace(id);
      const map=placeData[id],report={id,label:map.label,spots:[]};
      for(const spot of map.spots)report.spots.push(await visitSpot(id,spot));
      await placeLayouts(id);
      report.nearSpots=[];
      for(const near of closeSpots(id,map)){
        await visitSpot(id,near);await cameraView(root,false);assert.equal((await state()).following,true);await page.waitForTimeout(300);
        const filename=id==='dayLibrary'?(near.id==='window-reading'?'library-window-close':'library-reading-close'):slug(id)+'-'+near.id+'-close';
        await shot(filename);report.nearSpots.push({id:near.id,screenshot:filename+'.png'});
      }
      result.places.push(report);await noWrites();
    }
    const sceneRequests=requests.filter(url=>/\.glb(?:\?|$)/.test(url));assert.ok(sceneRequests.length,'实际加载原小人');
    assert.equal(sceneRequests.filter(url=>/public-hall|home-interior|hall-dormitory|village|neighbor.+-interior/.test(url)).length,0,'独立摆位期间没有加载庭院/公共厅/家里的场景');
    result.independentSceneAssets=sceneRequests;result.showcaseReadOnly=true;
    await root.getByRole('button',{name:'回到日程',exact:true}).click();await frame.waitForFunction(()=>CharDayScene.inspect().map==='dayHome'&&!CharDayScene.inspect().changing);
    result.demoWidths=await demoLayout();
    await root.getByRole('button',{name:'下一段',exact:true}).click();await frame.waitForFunction(()=>CharDayScene.inspect().map==='dayWork'&&!CharDayScene.inspect().changing);result.oldDemoNext=true;
    await root.getByRole('button',{name:'换人',exact:true}).click();await root.locator('[data-wk=cdaypick]').filter({hasText:'测试研究员'}).click();await ready();
    await frame.waitForFunction(()=>CharDayScene.inspect().map==='dayWork'&&!CharDayScene.inspect().changing);const original=await state();assert.equal(original.charId,'places-a');assert.match(original.look,/#a8be83/);
    await moreItem(root,'cdayplaces');await frame.waitForFunction(()=>CharDayScene.inspect().map?.startsWith('day')&&!CharDayScene.inspect().changing);
    result.characterPlaces=[];
    for(const id of ids){
      await choosePlace(id);const stage=await state();assert.equal(stage.charId,original.charId);assert.equal(stage.look,original.look);
      const near=placeData[id].spots.find(s=>s.seat)||placeData[id].spots[0];await visitSpot(id,near);await shot('character-'+slug(id));result.characterPlaces.push(id);
    }
    await root.getByRole('button',{name:'回到日程',exact:true}).click();await frame.waitForFunction(()=>CharDayScene.inspect().map==='dayWork'&&!CharDayScene.inspect().changing);
    const back=await state();assert.equal(back.charId,original.charId);assert.equal(back.look,original.look);assert.match(await root.locator('[data-wk=cdaynow]').innerText(),/核对当天资料/);assert.equal(back.key,original.key);
    await noWrites();result.characterReturn=true;
    // Persist only fictional fixture data in this fresh browser context, then enter through the real App.
    await page.evaluate(async()=>{
      await saveJSONDurable('x_characters',dayPlacesChars);await saveJSONDurable('x_schedules',dayPlacesRef.current);
      await saveJSONDurable('x_homeLayout',{'0':['fairyGarden']});await saveJSONDurable('x_homeFolders',[]);
      await saveJSONDurable('x_companion',{looks:{'places-a':{outfit:'academy',hair:'korean',hairColor:'#43352e'}}});
    });
    await page.reload();await page.locator('#qiu-splash button').click();await page.locator('#qiu-splash').waitFor({state:'hidden'});
    await page.evaluate(()=>{window.dayRealWrites=[];const original=saveJSON;window.saveJSON=(key,...args)=>{dayRealWrites.push(key);return original(key,...args);};window.dayRealModels=0;window.callAI=()=>{dayRealModels++;throw Error('Unexpected model call');};});
    await page.locator('[data-appkey=fairyGarden]').click();await page.locator('[data-wk=fgworld]').filter({hasText:'TA的一天'}).click();
    await page.locator('[data-wk=cdaypick]').filter({hasText:'测试研究员'}).click();
    await page.waitForFunction(()=>{const s=document.querySelector('[data-wk=cdayscene] iframe')?.contentWindow.CharDayScene?.inspect();return s?.ready&&s.map==='dayWork'&&!s.changing;});
    frame=page.frames().find(f=>f.url().includes('/fairy-garden/day/'));const realOriginal=await state();
    const realBaseline=await page.evaluate(()=>({writes:dayRealWrites.length,plans:JSON.stringify(loadJSON('x_schedules',{})),games:JSON.stringify(loadJSON('x_fairyGardenSaves',[]))}));
    await moreItem(page,'cdayplaces');await frame.waitForFunction(()=>CharDayScene.inspect().map?.startsWith('day')&&!CharDayScene.inspect().changing);
    result.actualAppPlaces=[];
    for(const id of ids){
      await choosePlace(id,page);assert.equal((await state()).look,realOriginal.look);assert.equal((await state()).charId,'places-a');
      const near=placeData[id].spots.find(s=>s.seat)||placeData[id].spots[0];await visitSpot(id,near,page);await shot('real-app-'+slug(id));result.actualAppPlaces.push(id);
    }
    await page.getByRole('button',{name:'回到日程',exact:true}).click();await frame.waitForFunction(()=>CharDayScene.inspect().map==='dayWork'&&!CharDayScene.inspect().changing);
    assert.equal((await state()).look,realOriginal.look);assert.equal((await state()).charId,'places-a');assert.equal((await state()).key,realOriginal.key);
    assert.match(await page.locator('[data-wk=cdaynow]').innerText(),/核对当天资料/);
    assert.equal(await page.evaluate(()=>dayRealWrites.length),realBaseline.writes);assert.equal(await page.evaluate(()=>JSON.stringify(loadJSON('x_schedules',{}))),realBaseline.plans);assert.equal(await page.evaluate(()=>JSON.stringify(loadJSON('x_fairyGardenSaves',[]))),realBaseline.games);assert.equal(await page.evaluate(()=>dayRealModels),0);
    assert.deepEqual(errors,[]);result.actualAppEntryReturn=true;result.zeroModelCalls=true;result.zeroSceneWrites=true;result.errors=errors;result.ok=true;
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }catch(e){
    await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
    fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:e.message,errors,requests,state:frame?await frame.evaluate(()=>CharDayScene.inspect()).catch(()=>null):null,body:await page.locator('body').innerText().catch(()=>null)},null,2));throw e;
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
