const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.COMPANION_TEST_URL||'http://127.0.0.1:18946';
const previewOnly=process.env.COMPANION_PREVIEW_ONLY==='1';
const poseActions=(process.env.COMPANION_POSE_ACTIONS||'').split(',').filter(Boolean);
const out=process.env.COMPANION_EVIDENCE||'/tmp/companion-chat-actions';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));await page.goto(base+'/apps/companion/');
 const report=await page.evaluate(async ({requested,previewOnly})=>{
  const T=await import('three'),{GLTFLoader}=await import('../fairy-garden/vendor/GLTFLoader.js'),{DRACOLoader}=await import('../fairy-garden/vendor/DRACOLoader.js'),{createTraveler,preloadOutfits}=await import('../fairy-garden/traveler.mjs'),{CHAT_ACTIONS}=await import('./motion.mjs');
  const draco=new DRACOLoader();draco.setDecoderPath('../fairy-garden/vendor/draco/');const loader=new GLTFLoader();loader.setDRACOLoader(draco);
  const source=(await loader.loadAsync('../fairy-garden/doll.glb')).scene;await preloadOutfits();
  const catalog=await(await fetch('../fairy-garden/doll.json')).json(),doll=createTraveler(source,true);await doll.ready();
  const actions=requested.length?requested:Object.keys(CHAT_ACTIONS),report={frames:0,outfits:Object.keys(catalog.outfits),actions,maxJointStep:0,maxHandIntrusions:0,maxFlowerGripError:0,maxGiftGripError:0,maxSignGripError:0,maxPhoneGripError:0,maxCookieGripError:0,maxPhoneTapError:0};let time=0;
  for(const outfit of previewOnly?[]:report.outfits)for(const dims of [{},Object.fromEntries(catalog.dims.map(d=>[d.key,d.min])),Object.fromEntries(catalog.dims.map(d=>[d.key,d.max]))]){
   doll.setLook({outfit,dims,hair:'bob',face:'cozy'});await doll.ready();
   for(const action of actions){let previous=null;
    for(let j=0;j<=80;j++){
     doll.animate(time+=.04,{emotion:action,progress:j/80,height:0});doll.root.updateWorldMatrix(true,true);report.frames++;
     if(['lie','prone'].includes(action)&&doll.root.userData.emotionGround?.bottom<-.000001)throw Error('Body under ground '+outfit+' '+action+' '+j);
     doll.root.traverse(o=>{if(o.isBone&&!o.matrixWorld.elements.every(Number.isFinite))throw Error('Invalid bone '+outfit+' '+action);});
     const joints=['rightArm','rightForearm','leftArm','leftForearm'].map(name=>doll.root.getObjectByName(name));
     if(previous){const step=Math.max(...joints.map((b,i)=>b.quaternion.angleTo(previous[i])));report.maxJointStep=Math.max(report.maxJointStep,step);if(step>.55)throw Error('Joint snap '+outfit+' '+action+' '+j+' '+step);}
     previous=joints.map(b=>b.quaternion.clone());
     for(const [propName,grips,metric] of [
      ['CompanionFlower',[['FlowerGrip','Right_hand']],'maxFlowerGripError'],
      ['CompanionGift',[['GiftGripLeft','Left_hand'],['GiftGripRight','Right_hand']],'maxGiftGripError'],
      ['CompanionSign',[['SignGrip','Right_hand']],'maxSignGripError'],
      ['CompanionPhone',[['PhoneGrip','Left_hand']],'maxPhoneGripError'],
      ['CompanionCookie',[['CookieGrip','Right_hand']],'maxCookieGripError']]){
      if(!doll.root.getObjectByName(propName)?.visible)continue;
      for(const [gripName,handName] of grips){
       const grip=doll.root.getObjectByName(gripName).getWorldPosition(new T.Vector3()),hand=doll.root.getObjectByName(handName).getWorldPosition(new T.Vector3()),error=grip.distanceTo(hand);
       report[metric]=Math.max(report[metric],error);if(error>1e-6)throw Error(propName+' leaves hand '+outfit+' '+action+' '+j+' '+error);
      }
      if(propName==='CompanionSign'&&!doll.root.getObjectByName('SignPaper').material.map?.isCanvasTexture)throw Error('Sign text missing');
     }
     if(action==='phone'&&j/80>.3&&j/80<.7){
      const {emotionPose}=await import('../fairy-garden/emotion-pose.mjs'),pose=emotionPose(action,j/80);
      if(pose.phoneTap>.85){const tip=doll.root.getObjectByName('CompanionHand-right-point').getObjectByName('PointIndex').children.at(-1).getWorldPosition(new T.Vector3()),screen=doll.root.getObjectByName('PhoneScreen'),at=screen.worldToLocal(tip);const error=Math.max(Math.max(0,Math.abs(at.x)-.0415),Math.max(0,Math.abs(at.y)-.073),Math.abs(at.z));report.maxPhoneTapError=Math.max(report.maxPhoneTapError,error);if(error>.035)throw Error('Phone finger misses screen '+outfit+' '+j+' '+error);}
     }
     if(['kiss','giggle','listen','cheeks','scratch','rubeyes','peekaboo','sneeze','cry','eat','lie','prone'].includes(action)){
      const head=doll.root.getObjectByName('HeadAnchor'),body=doll.root.getObjectByName('DollBody'),pos=body.geometry.attributes.position,idx=body.geometry.attributes.skinIndex,w=body.geometry.attributes.skinWeight;let inside=0;
      for(let k=0;k<pos.count;k++){
       if(pos.getY(k)>.44)continue;let arm=0;for(let b=0;b<4;b++)if(/^(right|left)Forearm$/.test(body.skeleton.bones[idx.getComponent(k,b)]?.name||''))arm+=w.getComponent(k,b);if(arm<.9)continue;
       const v=head.worldToLocal(body.localToWorld(body.getVertexPosition(k,new T.Vector3())));
       if((v.x/.95)**2+(v.y/.85)**2+(v.z/.8)**2<1)inside++;
      }
      report.maxHandIntrusions=Math.max(report.maxHandIntrusions,inside);if(inside)throw Error('Hand inside face '+outfit+' '+action+' '+j+' '+inside);
     }
    }
    for(let j=0;j<40;j++)doll.animate(time+=.04,{height:0});
    const mask=doll.root.getObjectByName('DollBody').userData.skinCoverageUniforms;
    if(mask.rightElbow.value||mask.leftElbow.value||mask.rightHand.value||mask.leftHand.value)throw Error('Elbow coverage not reset '+action);
    for(const name of ['CompanionFlower','CompanionGift','CompanionSign','CompanionPhone','CompanionCookie','CompanionTongue','CompanionTears'])if(doll.root.getObjectByName(name)?.visible)throw Error(name+' did not return '+action);
    if(doll.root.userData.actionFace||doll.root.userData.emotionGround)throw Error('Transient face/posture did not reset '+action);
    doll.root.traverse(o=>{if(o.name.startsWith('CompanionHand-')&&o.visible)throw Error('Gesture hand did not reset '+action);});
   }
  }
  if(actions.includes('wink')){
   doll.setLook({face:'proud',eye:'#32576a'});for(let k=0;k<20;k++)doll.animate(time+=.04,{emotion:'wink',progress:.4,height:0});await doll.ready();doll.animate(time+=.04,{emotion:'wink',progress:.4,height:0});
   if(doll.root.userData.actionFace!=='relax')throw Error('Wink face absent');doll.setLook({face:'sad'});doll.animate(time+=.04,{emotion:'wink',progress:.4,height:0});
   if(doll.root.userData.actionFace!=='relax')throw Error('Look change cancels wink');for(let k=0;k<40;k++)doll.animate(time+=.04,{height:0});await doll.ready();
   if(doll.root.userData.actionFace||!doll.root.getObjectByName('DollBody').material.map.image.src.includes('/sad.webp'))throw Error('Wink did not restore latest face');
  }
  const galleryRows=Math.ceil(actions.length/3),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,galleryRows*450);document.body.append(renderer.domElement);renderer.setScissorTest(true);
  const scene=new T.Scene();scene.background=new T.Color('#eee8e1');scene.add(new T.HemisphereLight('#fff8ee','#b8a38c',2.3));const sun=new T.DirectionalLight('#fff',1.5);sun.position.set(1,3,3);scene.add(sun);scene.add(doll.root);
  const cam=new T.PerspectiveCamera(26,400/450,.05,20);cam.position.set(0,.68,3.25);cam.lookAt(0,.65,0);
  doll.setLook({outfit:'cardigan',hair:'bob',face:'cozy',eye:'#5d4435',dims:Object.fromEntries(catalog.dims.map(d=>[d.key,1]))});await doll.ready();
  window.actionGallery=async progress=>{document.querySelectorAll('.label').forEach(e=>e.remove());let i=0;
   for(const name of actions){for(let k=0;k<30;k++)doll.animate(time+=.04,{emotion:name,progress,height:0});
    await doll.ready();doll.animate(time+=.04,{emotion:name,progress,height:0});
    const x=i%3*400,y=(galleryRows-1-Math.floor(i/3))*450;renderer.setViewport(x,y,400,450);renderer.setScissor(x,y,400,450);renderer.render(scene,cam);
    const label=document.createElement('div');label.className='label';label.textContent=({heart:'双手比心',thumb:'竖大拇指',wink:'眨眼 wink',tongue:'吐吐舌头',cry:'抹眼泪',tilt:'歪头看你',poke:'戳戳你的脸',pinch:'捏捏你的脸',lie:'侧躺歇一会',prone:'趴着陪你',phone:'低头看手机打字',eat:'吃一口小饼干',hips:'叉腰得意',selfhug:'抱住自己轻晃',peekaboo:'捂眼再放开',sneeze:'掩鼻打喷嚏',gift:'递小礼物',sign:'举小纸牌',cheeks:'双手捧脸',plead:'合十拜托',crossarms:'抱胸等你',scratch:'挠后脑勺',rubeyes:'揉揉眼睛',flower:'递小花',kiss:'飞吻',giggle:'捂嘴偷笑',listen:'侧耳听',promise:'拍胸保证',cheer:'举手加油',refuse:'摇头摆手'})[name];label.style=`position:absolute;left:${x+16}px;top:${Math.floor(i/3)*450+12}px;color:#45382d;font:18px sans-serif`;document.body.append(label);i++;
   }
  };return report;
 },{requested:poseActions,previewOnly});
 await page.setViewportSize({width:1200,height:Math.ceil(report.actions.length/3)*450});
 for(const progress of [.3,.6,.8]){await page.evaluate(p=>actionGallery(p),progress);await page.screenshot({path:out+'/actions-'+progress+'.png'});}
 await page.close();
 const text=fs.readFileSync('js/companion.js','utf8'),language=require('../../test/fixtures/companion-action-prose.cjs').cases;
 for(const mode of ['full','float']){
  const view=await browser.newPage({viewport:{width:390,height:700}});view.on('pageerror',e=>errors.push(e.message));await view.goto(base+'/apps/companion/?mode='+mode);await view.waitForFunction(()=>window.petDebug);await view.evaluate(()=>petDebug.ready());
  await view.addScriptTag({content:'window.useEffect=()=>{};'+text});
  for(const name of report.actions){
   const line=language['emotion-'+name][1];await view.evaluate(line=>{const k=CompanionFace.actForText(line);postMessage({type:'pet-act',kind:k},'*');},line);
   await view.waitForTimeout(180);assert.equal(await view.evaluate(()=>petDebug.snapshot().emotion),name,mode+' '+line);
  }
  const filler='窗外的光落在桌角，远处车辆的声音渐渐远去。'.repeat(120);
  const prose=[['早安，知道啦。'+filler+'他点了点自己那颗毛茸茸的脑袋。'+filler,'nod'],['他把那颗乱蓬蓬的脑袋缓缓地往下点了两次。','nod'],['他喝了一大口已经温了许久的红茶。','tea'],['他挥了挥藏在宽大袖子里的手。','wave']];
  for(const [line,kind] of prose){
   await view.evaluate(line=>postMessage({type:'pet-act',kind:CompanionFace.actForText(line)},'*'),line);await view.waitForTimeout(180);
   assert.equal(await view.evaluate(()=>petDebug.snapshot().action),kind,mode+' long prose');
  }
  // 同轮心情换脸不能把刚触发的聊天动作清掉。
  await view.evaluate(()=>{postMessage({type:'pet-act',kind:'emotion-kiss'},'*');postMessage({type:'pet-look',characterId:'test',look:{face:'happy'},ta:'Test'},'*');});await view.waitForTimeout(180);
  assert.equal(await view.evaluate(()=>petDebug.snapshot().action),'emotion-kiss');
  await view.evaluate(()=>postMessage({type:'pet-act',kind:'invalid-action'},'*'));await view.waitForTimeout(80);assert.equal(await view.evaluate(()=>petDebug.snapshot().action),'emotion-kiss');
  await view.screenshot({path:out+'/'+mode+'.png'});await view.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
