// Native skinning and dye, actual strap pixels through rest, raised arms and sit.
const pw=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.CLOTH_TEST_URL||'http://127.0.0.1:18927',out=process.env.CLOTH_TEST_OUT||'/tmp/cardigan-back-strap',engine=process.env.CLOTH_ENGINE||'chromium';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await pw[engine].launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:1800,height:1200}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));if(process.env.STRAP_MODEL)await p.route('**/outfits/cardigan.glb*',r=>r.fulfill({path:process.env.STRAP_MODEL,contentType:'model/gltf-binary'}));await p.goto(base+'/apps/companion/');
 await p.evaluate(async()=>{const T=await import('three'),{loadTravelerSource,createTraveler}=await import('../fairy-garden/traveler.mjs'),source=await loadTravelerSource(),catalog=await(await fetch('../fairy-garden/doll.json')).json(),s=new T.Scene();s.background=new T.Color('#ece5d9');s.add(new T.HemisphereLight('#fff','#968b84',2));const l=new T.DirectionalLight('#fff',2);l.position.set(-3,5,5);s.add(l);const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(1800,1200);document.body.innerHTML='';document.body.style.margin='0';document.body.append(r.domElement);const c=new T.OrthographicCamera(-.32,.32,.32,-.32,.1,20);window.qa={T,source,createTraveler,catalog,s,r,c,dolls:[]};});
 const results=[];for(const mode of ['default','narrow','min','max','cloth','bag']){
  results.push(await p.evaluate(async mode=>{const {T,source,createTraveler,catalog,s,r,c,dolls}=qa;for(const d of dolls)s.remove(d.root);dolls.length=0;r.setScissorTest(true);const result=[];
   for(const [row,gesture]of ['rest','stretch','sit'].entries())for(const [col,angle]of [0,Math.PI*.75,Math.PI,Math.PI*1.25,Math.PI*1.5,Math.PI*.5].entries()){
    for(const d of dolls)d.root.visible=false;const dims=Object.fromEntries(catalog.dims.map(d=>[d.key,mode==='min'||mode==='max'?d[mode]:mode==='narrow'&&d.key==='shoulder'?.96:1]));const d=createTraveler(source,false,{outfit:'cardigan',hair:'bob',dims});await d.ready();s.add(d.root);dolls.push(d);if(mode==='cloth')d.setLook({outfitColors:{cloth:'#487998'}});if(mode==='bag')d.setLook({outfitColors:{bag:'#c35663'}});
    for(let f=0;f<60;f++){d.animate(f/30,{gesture,height:0,seated:gesture==='sit',seatPose:'chair'});if(gesture==='stretch'){const h=d.root.getObjectByName('HeadAnchor');d.root.updateWorldMatrix(true,true);d.contactPose({right:h.localToWorld(new T.Vector3(.6,.05,.6)),left:h.localToWorld(new T.Vector3(-.6,.05,.6))});}}d.root.rotation.y=angle;d.root.updateMatrixWorld(true);const strap=d.root.getObjectByName('outfit_cardigan_back_strap');if(!strap)throw Error('Missing whole back strap');strap.skeleton.update();const pos=strap.geometry.attributes.position,mid=[];
    for(let i=0;i<pos.count;i++)if(pos.getY(i)>.54&&pos.getY(i)<.56&&pos.getZ(i)<-.08)mid.push(i);if(mid.length<8)throw Error('Missing middle of strap');const v=new T.Vector3();for(const i of mid)v.add(strap.getVertexPosition(i,new T.Vector3()));v.multiplyScalar(1/mid.length);strap.localToWorld(v);
    const y=d.root.getObjectByName('HeadAnchor').getWorldPosition(new T.Vector3()).y-.29;c.position.set(0,y,6);c.lookAt(0,y,0);r.setViewport(col*300,(2-row)*400,300,400);r.setScissor(col*300,(2-row)*400,300,400);r.render(s,c);
    if(col===2){const projected=v.clone().project(c),gl=r.getContext(),pixel=new Uint8Array(4);gl.readPixels(Math.round(col*300+(projected.x*.5+.5)*300),Math.round((2-row)*400+(projected.y*.5+.5)*400),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);result.push({gesture,pixel:[...pixel],samples:mid.length});}
   }r.setScissorTest(false);return {mode,result};
  },mode));await p.screenshot({path:path.join(out,mode+'.png')});
 }
 assert.deepEqual(errors,[]);const by=Object.fromEntries(results.map(r=>[r.mode,r.result]));for(let i=0;i<3;i++){
  assert.ok(by.default[i].pixel.slice(0,3).every((v,k)=>Math.abs(v-by.cloth[i].pixel[k])<=3),'Sweater dye overwrote the back strap');
  assert.ok(by.default[i].pixel.slice(0,3).some((v,k)=>Math.abs(v-by.bag[i].pixel[k])>20),'Bag dye did not reach visible rear band');
 }
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({engine,views:108,results,errors},null,2));console.log(JSON.stringify({engine,views:108,errors}));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
