const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.COMPANION_TEST_URL||'http://127.0.0.1:18946';
const out=process.env.COMPANION_EVIDENCE||'/tmp/companion-chat-actions';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));await page.goto(base+'/apps/companion/');
 const report=await page.evaluate(async()=>{
  const T=await import('three'),{GLTFLoader}=await import('../fairy-garden/vendor/GLTFLoader.js'),{DRACOLoader}=await import('../fairy-garden/vendor/DRACOLoader.js'),{createTraveler,preloadOutfits}=await import('../fairy-garden/traveler.mjs'),{CHAT_ACTIONS}=await import('./motion.mjs');
  const draco=new DRACOLoader();draco.setDecoderPath('../fairy-garden/vendor/draco/');const loader=new GLTFLoader();loader.setDRACOLoader(draco);
  const source=(await loader.loadAsync('../fairy-garden/doll.glb')).scene;await preloadOutfits();
  const catalog=await(await fetch('../fairy-garden/doll.json')).json(),doll=createTraveler(source,true);await doll.ready();
  const actions=Object.keys(CHAT_ACTIONS),report={frames:0,outfits:Object.keys(catalog.outfits),actions,maxJointStep:0,maxHandIntrusions:0};let time=0;
  for(const outfit of report.outfits)for(const dims of [{},Object.fromEntries(catalog.dims.map(d=>[d.key,d.min])),Object.fromEntries(catalog.dims.map(d=>[d.key,d.max]))]){
   doll.setLook({outfit,dims,hair:'bob',face:'cozy'});await doll.ready();
   for(const action of actions){let previous=null;
    for(let j=0;j<=80;j++){
     doll.animate(time+=.04,{emotion:action,progress:j/80,height:0});doll.root.updateWorldMatrix(true,true);report.frames++;
     doll.root.traverse(o=>{if(o.isBone&&!o.matrixWorld.elements.every(Number.isFinite))throw Error('Invalid bone '+outfit+' '+action);});
     const joints=['rightArm','rightForearm','leftArm','leftForearm'].map(name=>doll.root.getObjectByName(name));
     if(previous){const step=Math.max(...joints.map((b,i)=>b.quaternion.angleTo(previous[i])));report.maxJointStep=Math.max(report.maxJointStep,step);if(step>.55)throw Error('Joint snap '+outfit+' '+action+' '+j+' '+step);}
     previous=joints.map(b=>b.quaternion.clone());
     if(['kiss','giggle','listen'].includes(action)){
      const head=doll.root.getObjectByName('HeadAnchor'),body=doll.root.getObjectByName('DollBody'),pos=body.geometry.attributes.position,idx=body.geometry.attributes.skinIndex,w=body.geometry.attributes.skinWeight;let inside=0;
      for(let k=0;k<pos.count;k++){
       if(pos.getY(k)>.44)continue;let right=0;for(let b=0;b<4;b++)if(body.skeleton.bones[idx.getComponent(k,b)]?.name==='rightForearm')right+=w.getComponent(k,b);if(right<.9)continue;
       const v=head.worldToLocal(body.localToWorld(body.getVertexPosition(k,new T.Vector3())));
       if((v.x/.95)**2+(v.y/.85)**2+(v.z/.8)**2<1)inside++;
      }
      report.maxHandIntrusions=Math.max(report.maxHandIntrusions,inside);if(inside)throw Error('Hand inside face '+outfit+' '+action+' '+j+' '+inside);
     }
    }
    for(let j=0;j<40;j++)doll.animate(time+=.04,{height:0});
    const mask=doll.root.getObjectByName('DollBody').userData.skinCoverageUniforms;
    if(mask.rightElbow.value||mask.leftElbow.value)throw Error('Elbow coverage not reset '+action);
   }
  }
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,900);document.body.append(renderer.domElement);renderer.setScissorTest(true);
  const scene=new T.Scene();scene.background=new T.Color('#eee8e1');scene.add(new T.HemisphereLight('#fff8ee','#b8a38c',2.3));const sun=new T.DirectionalLight('#fff',1.5);sun.position.set(1,3,3);scene.add(sun);scene.add(doll.root);
  const cam=new T.PerspectiveCamera(26,400/450,.05,20);cam.position.set(0,.68,3.25);cam.lookAt(0,.65,0);
  doll.setLook({outfit:'cardigan',hair:'bob',face:'cozy',dims:Object.fromEntries(catalog.dims.map(d=>[d.key,1]))});await doll.ready();
  window.actionGallery=async progress=>{document.querySelectorAll('.label').forEach(e=>e.remove());let i=0;
   for(const name of actions){for(let k=0;k<30;k++)doll.animate(time+=.04,{emotion:name,progress,height:0});
    const x=i%3*400,y=(1-Math.floor(i/3))*450;renderer.setViewport(x,y,400,450);renderer.setScissor(x,y,400,450);renderer.render(scene,cam);
    const label=document.createElement('div');label.className='label';label.textContent=({kiss:'飞吻',giggle:'捂嘴偷笑',listen:'侧耳听',promise:'拍胸保证',cheer:'举手加油',refuse:'摇头摆手'})[name];label.style=`position:absolute;left:${x+16}px;top:${Math.floor(i/3)*450+12}px;color:#45382d;font:18px sans-serif`;document.body.append(label);i++;
   }
  };return report;
 });
 for(const progress of [.3,.6,.8]){await page.evaluate(p=>actionGallery(p),progress);await page.screenshot({path:out+'/actions-'+progress+'.png'});}
 await page.close();
 const text=fs.readFileSync('js/companion.js','utf8');const words=['亲了一下额头','捂着嘴笑','认真地听你讲','拍了拍胸口','握了握拳给你加油','摇了摇头'];
 for(const mode of ['full','float']){
  const view=await browser.newPage({viewport:{width:390,height:700}});view.on('pageerror',e=>errors.push(e.message));await view.goto(base+'/apps/companion/?mode='+mode);await view.waitForFunction(()=>window.petDebug);await view.evaluate(()=>petDebug.ready());
  await view.addScriptTag({content:'window.useEffect=()=>{};'+text});
  for(let i=0;i<words.length;i++){
   const name=report.actions[i];await view.evaluate(line=>{const k=CompanionFace.actForText(line);postMessage({type:'pet-act',kind:k},'*');},words[i]);
   await view.waitForTimeout(180);assert.equal(await view.evaluate(()=>petDebug.snapshot().emotion),name,mode+' '+words[i]);
  }
  // 同轮心情换脸不能把刚触发的聊天动作清掉。
  await view.evaluate(()=>{postMessage({type:'pet-act',kind:'emotion-kiss'},'*');postMessage({type:'pet-look',characterId:'test',look:{face:'happy'},ta:'Test'},'*');});await view.waitForTimeout(180);
  assert.equal(await view.evaluate(()=>petDebug.snapshot().action),'emotion-kiss');
  await view.evaluate(()=>postMessage({type:'pet-act',kind:'invalid-action'},'*'));await view.waitForTimeout(80);assert.equal(await view.evaluate(()=>petDebug.snapshot().action),'emotion-kiss');
  await view.screenshot({path:out+'/'+mode+'.png'});await view.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
