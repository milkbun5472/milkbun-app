const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.PET_CAMERA_URL||'http://127.0.0.1:18952',out=process.env.PET_CAMERA_EVIDENCE||'/tmp/pet-camera-browser';fs.mkdirSync(out,{recursive:true});
const scenes=[['home','/art/pet-house/preview.html','petHousePreview'],...['bakery','florist','alley'].map(id=>[id,'/art/pet-career/preview.html?scene='+id,'petCareerPreview'])];
async function snapshot(page,key){return page.evaluate(key=>window[key].snapshot(),key);}
async function catRect(page,key){return page.evaluate(async key=>{
 const T=await import('three'),p=window[key],b=new T.Box3().setFromObject(p.cat);const points=[];
 for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const v=new T.Vector3(x,y,z).project(p.camera);points.push({x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2});}
 return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
},key);}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),result={scenes:[],errors:[]};
 try{
  const page=await browser.newPage({hasTouch:true});const cdp=await page.context().newCDPSession(page);
  page.on('pageerror',e=>result.errors.push(e.message));page.on('console',e=>{if(e.type()==='error')result.errors.push(e.text());});page.on('response',r=>{if(r.status()>=400)result.errors.push(r.status()+' '+r.url());});
  for(const [id,url,key] of scenes){
   const scene={id,viewports:[]};
   for(const [width,height] of [[320,568],[390,780],[430,932],[932,430]]){
    await page.setViewportSize({width,height});await page.goto(base+url);await page.waitForFunction(key=>window[key]?.snapshot().ready,key);await page.waitForTimeout(100);
    const initial=await snapshot(page,key),initialCat=await catRect(page,key);assert.equal(initial.zoom,width<height?1.30:1.12);
    assert.equal(initial.following,false);
    for(const button of await page.locator('.camera-tools button,#walk,#fur,#light,#reset').all()){
     const b=await button.boundingBox();assert.ok(b&&b.width>=40&&b.height>=40&&b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=height,'Camera controls must fit the screen with finger sized targets');
    }
    await page.screenshot({path:path.join(out,`${id}-${width}-default.png`)});
    await page.locator('#reset').click();await page.waitForTimeout(50);const wholeCat=await catRect(page,key);
    assert.ok((initialCat.bottom-initialCat.top)>(wholeCat.bottom-wholeCat.top)*1.1,'Default scene and cat must be larger than full view');
    await page.locator('#zoom-in').click();assert.equal((await snapshot(page,key)).zoom,1.25);
    await page.locator('#zoom-out').click();assert.equal((await snapshot(page,key)).zoom,1);
    await page.locator('#look-cat').click();await page.waitForTimeout(50);
    const close=await catRect(page,key);assert.equal((await snapshot(page,key)).following,true);assert.equal((await snapshot(page,key)).zoom,5);
    assert.ok(close.bottom-close.top>(wholeCat.bottom-wholeCat.top)*4.9);
    assert.ok(close.left>=0&&close.right<=width&&close.top>=0&&close.bottom<=height,'Cat must remain fully visible in close view');
    await page.screenshot({path:path.join(out,`${id}-${width}-cat.png`)});
    await page.locator('#zoom-in').click();assert.ok((await snapshot(page,key)).zoom>5);await page.locator('#zoom-out').click();
    await page.locator('#look-cat').click();assert.equal((await snapshot(page,key)).following,false);
    await page.locator('#reset').click();assert.equal((await snapshot(page,key)).zoom,1);
    scene.viewports.push({width,height,defaultZoom:initial.zoom,catPixels:Math.round(close.bottom-close.top),ok:true});
   }
   await page.setViewportSize({width:390,height:780});await page.locator('#reset').click();
   // Real two-touch dispatch generates browser PointerEvents and pointer capture.
   const points=(a,b,y=380)=>[{x:a,y,id:1,radiusX:3,radiusY:3,force:1},{x:b,y,id:2,radiusX:3,radiusY:3,force:1}];
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(150,240)});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(110,280)});await page.waitForTimeout(60);
   assert.ok((await snapshot(page,key)).zoom>1.7,'Pinch apart must enlarge scene');
   const zone=(await snapshot(page,key)).zone;
   // Lift one finger; the remaining finger can rotate without tapping a zone.
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[points(110,280)[0]]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:135,y:395,id:1,radiusX:3,radiusY:3,force:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal((await snapshot(page,key)).zone,zone);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(110,280)});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(150,240)});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok((await snapshot(page,key)).zoom<1.1,'Pinch together must shrink scene');
   await page.mouse.move(195,380);await page.mouse.wheel(0,-20000);await page.waitForTimeout(50);assert.equal((await snapshot(page,key)).zoom,8);assert.equal(await page.locator('#zoom-in').isDisabled(),true);
   await page.mouse.wheel(0,20000);await page.waitForTimeout(50);assert.equal((await snapshot(page,key)).zoom,.72);assert.equal(await page.locator('#zoom-out').isDisabled(),true);
   await page.locator('#reset').click();assert.deepEqual((await snapshot(page,key)).pan,[0,0,0]);assert.equal((await snapshot(page,key)).following,false);
   if(id==='home'){
    await page.locator('#look-cat').click();await page.locator('#walk').click();
    await page.evaluate(()=>{for(let i=0;i<600;i++)petHousePreview.step(1/60);});await page.waitForTimeout(60);
    const cat=await catRect(page,key);assert.ok(cat.left>=0&&cat.right<=390&&cat.top>=0&&cat.bottom<=780,'Close camera must follow the walking cat');
    await page.screenshot({path:path.join(out,'home-walking-close.png')});await page.locator('#walk').click();
   }
   scene.pinch=true;scene.zoomLimits=true;result.scenes.push(scene);
  }
  assert.deepEqual(result.errors,[]);result.ok=true;fs.writeFileSync(path.join(out,'camera.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
