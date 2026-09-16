const assert=require('node:assert/strict');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.GARDEN_TEST_URL||'http://127.0.0.1:18894';
(async()=>{const b=await chromium.launch({headless:true,channel:'chrome'});try{const p=await b.newPage({viewport:{width:700,height:700}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await p.goto(base+'/apps/fairy-garden/');await p.waitForFunction(()=>window.gardenDebug?.getReady());
const result=await p.evaluate(async()=>{const T=await import('three'),{GLTFLoader}=await import('./vendor/GLTFLoader.js'),{createTraveler}=await import('./traveler.mjs');const source=(await new GLTFLoader().loadAsync('./doll.glb')).scene;
 const a=createTraveler(source),b=createTraveler(source,true);const names=['leftLeg','rightLeg'];let checks=0;
 const centre=o=>new T.Box3().setFromObject(o,true).getCenter(new T.Vector3());
 for(const avatar of [a,b])for(const height of [.8,1,1.2]){avatar.setLook({dims:{height,build:1.1},hair:'wolf'});avatar.root.updateMatrixWorld(true);
  const legs=names.map(n=>avatar.root.getObjectByName(n));for(const leg of legs){if(leg.children.length!==2)throw Error('Leg must contain leggings and boot: '+leg.name);}
  avatar.animate(Math.PI/20,{moving:true});avatar.root.updateMatrixWorld(true);const first=legs.map(l=>l.children.map(centre));
  if(legs[0].rotation.x*legs[1].rotation.x>=0)throw Error('Legs not alternating');
  avatar.animate(3*Math.PI/20,{moving:true});avatar.root.updateMatrixWorld(true);
  legs.forEach((l,i)=>l.children.forEach((o,j)=>{if(centre(o).distanceTo(first[i][j])<.08)throw Error('Actual leg/boot vertices did not move');}));
  avatar.animate(0,{moving:false});if(legs.some(l=>Math.abs(l.rotation.x)>1e-8))throw Error('Rest pose not restored');checks++;
 }
 const left=a.root.getObjectByName('leftLeg'),other=b.root.getObjectByName('leftLeg');a.animate(.15,{moving:true});if(other.rotation.x!==0)throw Error('Animations shared between avatars');
 const scene=new T.Scene();scene.background=new T.Color('#d9e2df');scene.add(new T.HemisphereLight('#ffffff','#727e74',2.5));const light=new T.DirectionalLight('#fff3df',3);light.position.set(3,5,4);scene.add(light);
 a.root.position.x=-.7;b.root.position.x=.7;a.root.rotation.y=b.root.rotation.y=.65;scene.add(a.root,b.root);a.animate(Math.PI/20,{moving:true});b.animate(3*Math.PI/20,{moving:true});
 const camera=new T.PerspectiveCamera(32,1,.1,20);camera.position.set(2.4,1.8,5);camera.lookAt(0,.85,0);const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(700,700);renderer.setPixelRatio(1);renderer.domElement.style.cssText='position:fixed;inset:0;z-index:99999';document.body.append(renderer.domElement);renderer.render(scene,camera);
 return {checks,parts:left.children.map(o=>o.name)};
});assert.equal(result.checks,6);await p.screenshot({path:'/tmp/fairy-walk-fixed.png'});assert.deepEqual(errors,[]);console.log('PASS',result); }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
