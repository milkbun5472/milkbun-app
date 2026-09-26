// A closed rest mesh is insufficient: UV seam copies must also stay together
// after skinning and body morphs. This check complements the visual pose gallery.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
  if(process.env.MODEL)await page.route('**/doll.glb*',r=>r.fulfill({path:process.env.MODEL,contentType:'model/gltf-binary'}));
  await page.goto((process.env.CLOTH_TEST_URL||'http://127.0.0.1:18926')+'/apps/companion/');
  const report=await page.evaluate(async()=>{
   const T=await import('three'),{GLTFLoader}=await import('../fairy-garden/vendor/GLTFLoader.js'),{DRACOLoader}=await import('../fairy-garden/vendor/DRACOLoader.js'),{createTraveler}=await import('../fairy-garden/traveler.mjs');
   const draco=new DRACOLoader();draco.setDecoderPath('../fairy-garden/vendor/draco/');
   const loader=new GLTFLoader();loader.setDRACOLoader(draco);
   const source=(await loader.loadAsync('../fairy-garden/doll.glb')).scene,catalog=await(await fetch('../fairy-garden/doll.json')).json();
   const doll=createTraveler(source,false,{outfit:'cardigan',hair:'curtains'}),mesh=doll.root.getObjectByName('outfit_cardigan'),g=mesh.geometry,P=g.attributes.position;
   const groups=new Map(),bag=[];
   for(let i=0;i<P.count;i++){
    const x=P.getX(i),y=P.getY(i),z=P.getZ(i),key=[x,y,z].map(v=>v.toFixed(6)).join(',');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);
    // Front panel of the pouch, away from its attachment seam and the sleeve.
    if(x>.04&&x<.17&&y>.37&&y<.53&&z>.11)bag.push(i);
   }
   const seams=[...groups.values()].filter(ids=>ids.length>1);
   const sleeves=['left','right'].map(side=>doll.root.getObjectByName('outfit_cardigan_'+side+'_sleeve'));
   if(sleeves.some(s=>!s?.isSkinnedMesh))throw new Error('Missing complete sleeve surfaces');
   const sampleIds=sleeves.map(s=>{
    const p=s.geometry.attributes.position,ids=[];
    for(let i=0;i<p.count;i+=11)ids.push(i);
    return ids;
   });
   let seamError=0,bagMotion=0,maxEdgeRatio=0,time=0,samples=0,volumeError=0;
   const sleevePoints=()=>sleeves.map((s,k)=>{s.skeleton.update();return sampleIds[k].map(i=>s.getVertexPosition(i,new T.Vector3()).clone());});
   const update=(pose,progress)=>{for(let f=0;f<25;f++){time+=.05;doll.animate(time,{gesture:pose,progress,height:0});}doll.root.updateMatrixWorld(true);mesh.skeleton.update();};
   for(const mode of ['default','min','max']){
    doll.setLook({dims:Object.fromEntries(catalog.dims.map(d=>[d.key,mode==='default'?1:d[mode]]))});
    update('rest',0);const sleeveRest=sleevePoints();const rest=Array.from({length:P.count},(_,i)=>mesh.getVertexPosition(i,new T.Vector3()).clone());
    for(const pose of ['rest','wave','stretch','tea','read','water','plant','draw','eat','give'])for(const progress of [.25,.5,.75]){
     update(pose,progress);samples++;
     const sleevePosed=sleevePoints();
     for(let k=0;k<2;k++)for(let i=0;i<sleeveRest[k].length;i++)for(let j=i+1;j<sleeveRest[k].length;j++){
      const a=sleeveRest[k][i].distanceTo(sleeveRest[k][j]);
      if(a>.03)volumeError=Math.max(volumeError,Math.abs(sleevePosed[k][i].distanceTo(sleevePosed[k][j])/a-1));
     }
     const posed=Array.from({length:P.count},(_,i)=>mesh.getVertexPosition(i,new T.Vector3()).clone());
     for(const ids of seams)for(const i of ids)seamError=Math.max(seamError,posed[ids[0]].distanceTo(posed[i]));
     for(const i of bag)bagMotion=Math.max(bagMotion,rest[i].distanceTo(posed[i]));
     for(let j=0;j<g.index.count;j+=3)for(let k=0;k<3;k++){
      const i=g.index.getX(j+k),n=g.index.getX(j+(k+1)%3),length=rest[i].distanceTo(rest[n]);
      if(length>.002)maxEdgeRatio=Math.max(maxEdgeRatio,posed[i].distanceTo(posed[n])/length);
     }
    }
   }
   // Legacy cloth colours must never multiply the authored sweater atlas.
   doll.setLook({cloth:'#ff0000'});
   const neutralMaterials=sleeves.every(s=>s.material.color.equals(new T.Color('#ffffff')));
   const other=createTraveler(source,true,{outfit:'cardigan'});
   const isolated=sleeves.every(s=>s.material!==other.root.getObjectByName(s.name).material);
   draco.dispose();return {volumeError,neutralMaterials,isolated,version:mesh.userData.continuousSurfaceVersion,seamGroups:seams.length,seamError,bagVertices:bag.length,bagMotion,maxEdgeRatio,samples};
  });
  report.errors=errors;fs.writeFileSync(process.env.SURFACE_REPORT||'/tmp/cardigan-surface.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  if(!process.env.BASELINE){assert.equal(report.version,1);assert.ok(report.volumeError<.0001,'sleeve distances must preserve their full cross-section');assert.ok(report.neutralMaterials,'no legacy red tint');assert.ok(report.isolated);assert.ok(report.seamGroups>100);assert.ok(report.bagVertices>20);assert.ok(report.seamError<.0002,'UV seams must stay closed in every sampled pose');assert.ok(report.bagMotion<.01,'pouch front must remain on the torso');assert.deepEqual(errors,[]);}
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
