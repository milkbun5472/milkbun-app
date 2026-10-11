// Measure the real Draco sleeves, not only the bones: the old straight sleeve
// passed the hinge test while the bent hand emerged beside its cuff.
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.DAY_URL||'http://127.0.0.1:18985',engine=process.env.DAY_ENGINE||'webkit',out=process.env.DAY_EVIDENCE||'/tmp/char-day-arms';fs.mkdirSync(out,{recursive:true});
const baseline=process.env.DAY_BASELINE?fs.readFileSync(process.env.DAY_BASELINE,'utf8'):null;
(async()=>{const browser=await pw[engine].launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true}),errors=[];
async function page(old=false){const p=await browser.newPage({viewport:{width:900,height:1000}});p.on('pageerror',e=>errors.push(e.message));await p.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));if(old)await p.route('**/traveler.mjs*',r=>r.fulfill({body:baseline,contentType:'text/javascript'}));await p.goto(base+'/apps/companion/');return p;}
async function sample(p){return p.evaluate(async()=>{
const T=await import('three'),{loadTravelerSource,createTraveler}=await import('../fairy-garden/traveler.mjs'),{OUTFITS,seatLook}=await import('../fairy-garden/wardrobe.mjs'),source=await loadTravelerSource(),catalog=await(await fetch('../fairy-garden/doll.json')).json();
const variants=[{},seatLook('me',{},'她').dims,Object.fromEntries(catalog.dims.map(x=>[x.key,x.min])),Object.fromEntries(catalog.dims.map(x=>[x.key,x.max]))],d=createTraveler(source,true,{outfit:'ranger',hair:'korean'});await d.ready();const rows=[],poses=[{name:'chin',emotion:'chin',progress:.5},{name:'read',gesture:'read'},{name:'drink',task:{kind:'drink',daily:true},progress:.5},{name:'wave',emotion:'happy',progress:.5}];let time=0;
const visible=m=>{for(let o=m;o;o=o.parent)if(!o.visible)return false;return true;};
function verts(){const values={};d.root.updateMatrixWorld(true);d.root.traverse(m=>{if(!m.isSkinnedMesh||!visible(m))return;values[m.name]=[];for(let i=0;i<m.geometry.attributes.position.count;i++)values[m.name].push(...m.getVertexPosition(i,new T.Vector3()).toArray());});return values;}
function pose(opt){time=0;d.root.position.set(0,0,0);for(let j=0;j<80;j++)d.animate(time+=.05,{height:.08,gesture:'rest',...opt});d.root.updateMatrixWorld(true);}
for(const outfit of Object.keys(OUTFITS))for(const [variant,dims]of variants.entries()){
 d.setLook({outfit,dims},true);await d.ready();pose({});const standing=verts(),row={outfit,variant,standing,poses:[]};
 for(const opt of poses){pose(opt);const cuffs=[];d.root.traverse(m=>{if(!m.isSkinnedMesh||!visible(m)||!m.userData.sleeveSide)return;
  const side=m.userData.sleeveSide,upper=d.root.getObjectByName(side+'Arm'),lower=d.root.getObjectByName(side+'Forearm'),hand=d.root.getObjectByName(side==='left'?'Left_hand':'Right_hand');
  // Restore the vertex to bind space with its authored morphs, then apply the
  // real forearm alone. Distal sleeve vertices must follow that same rigid
  // transform as the wrist. This fails on the original upper-arm-only sleeve.
  const shoulder=new T.Vector3().setFromMatrixPosition(m.skeleton.boneInverses[m.skeleton.bones.indexOf(upper)].clone().invert()),wrist=new T.Vector3().setFromMatrixPosition(m.skeleton.boneInverses[m.skeleton.bones.indexOf(lower)].clone().invert());
  const span=wrist.clone().sub(shoulder),axis=span.clone().normalize(),points=[],pos=m.geometry.attributes.position,si=m.geometry.attributes.skinIndex,sw=m.geometry.attributes.skinWeight;let maxGap=0,distalWeight=0;
  const lowerIndex=m.skeleton.bones.indexOf(lower),inverse=lowerIndex<0?null:m.skeleton.boneInverses[lowerIndex];
  let end=-Infinity;for(let i=0;i<pos.count;i++){const v=T.Mesh.prototype.getVertexPosition.call(m,i,new T.Vector3()).applyMatrix4(m.bindMatrix);end=Math.max(end,v.sub(shoulder).dot(axis));}
  for(let i=0;i<pos.count;i++){
   const rest=T.Mesh.prototype.getVertexPosition.call(m,i,new T.Vector3()).applyMatrix4(m.bindMatrix);
   if(rest.clone().sub(shoulder).dot(axis)<end-.006)continue;
   const actual=m.getVertexPosition(i,new T.Vector3());m.localToWorld(actual);points.push(actual);
   for(let k=0;k<4;k++)if(si.getComponent(i,k)===lowerIndex)distalWeight+=sw.getComponent(i,k);
   if(inverse&&end/span.length()>1.42){const wanted=rest.clone().applyMatrix4(inverse).applyMatrix4(lower.matrixWorld);maxGap=Math.max(maxGap,actual.distanceTo(wanted));}
  }
  const centre=points.reduce((a,v)=>a.add(v),new T.Vector3()).divideScalar(points.length||1),elbow=lower.getWorldPosition(new T.Vector3()),wristPoint=hand.getWorldPosition(new T.Vector3()),forearm=wristPoint.clone().sub(elbow).normalize(),offset=centre.clone().sub(elbow),radial=offset.clone().addScaledVector(forearm,-offset.dot(forearm)).length();
  cuffs.push({side,points:points.length,lowerBound:!!inverse,distalWeight:distalWeight/(points.length||1),maxGap,radial,handGap:centre.distanceTo(wristPoint)});
 });row.poses.push({name:opt.name,cuffs});}
 pose({});row.afterStanding=verts();rows.push(row);
}
// Refitting and late outfit loading while bent must not alter another person.
const other=createTraveler(source,true,{outfit:'ranger',hair:'korean'});await other.ready();other.animate(1,{emotion:'chin',progress:.5});other.root.updateMatrixWorld(true);const sleeve=other.root.getObjectByName('outfit_ranger_right_sleeve'),before=sleeve.getVertexPosition(200,new T.Vector3()).toArray();d.setLook({dims:variants[3],outfit:'suit'},true);await d.ready();other.root.updateMatrixWorld(true);const after=sleeve.getVertexPosition(200,new T.Vector3()).toArray();
const scene=new T.Scene();scene.background=new T.Color('#ece4d5');scene.add(new T.HemisphereLight('#fff','#9c9186',2.3));const light=new T.DirectionalLight('#fff',2);light.position.set(-3,5,5);scene.add(light);scene.add(d.root);const camera=new T.OrthographicCamera(-.60,.60,.66,-.66,.1,30),r=new T.WebGLRenderer({antialias:true});r.setSize(900,1000);document.body.append(r.domElement);window.armQA={T,d,scene,camera,r};return {rows,isolation:{before,after}};
});}
try{let reference=null;if(baseline){const p=await page(true);reference=await sample(p);await p.close();}const p=await page(),current=await sample(p);let maxStandingDifference=0;
fs.writeFileSync(path.join(out,'raw.json'),JSON.stringify({current,reference}));
function compare(a,b,label){assert.deepEqual(Object.keys(a),Object.keys(b),label);for(const name of Object.keys(a)){assert.equal(a[name].length,b[name].length);for(let i=0;i<a[name].length;i++){const delta=Math.abs(a[name][i]-b[name][i]);maxStandingDifference=Math.max(maxStandingDifference,delta);assert.ok(delta<.00003,label+' '+name+' moved '+delta);}}}
let cuffCases=0,baselineMisses=0;for(let i=0;i<current.rows.length;i++){const row=current.rows[i];if(reference){compare(reference.rows[i].standing,row.standing,row.outfit+' standing');baselineMisses+=reference.rows[i].poses.flatMap(p=>p.cuffs).filter(c=>!c.lowerBound||c.maxGap>.01||c.distalWeight<.2).length;}compare(row.standing,row.afterStanding,row.outfit+' lower arms');for(const pose of row.poses)for(const cuff of pose.cuffs){cuffCases++;assert.ok(cuff.points>20,row.outfit+' cuff not sampled');assert.ok(cuff.lowerBound&&cuff.distalWeight>.2,row.outfit+' missing forearm binding');assert.ok(cuff.maxGap<.00003,row.outfit+' '+pose.name+' cuff stays on upper arm '+cuff.maxGap);assert.ok(cuff.radial<.10,row.outfit+' cuff far from forearm');}delete row.standing;delete row.afterStanding;}
assert.ok(cuffCases>100);if(reference)assert.ok(baselineMisses>50,'test must reject original straight sleeves');assert.deepEqual(current.isolation.before,current.isolation.after);assert.deepEqual(errors,[]);
for(const outfit of [...new Set(current.rows.map(row=>row.outfit))]){
 await p.evaluate(async outfit=>{const {d,scene,camera,r}=armQA;d.setLook({outfit,hair:'korean',dims:{height:1,shoulder:1,waist:1,flare:1,build:1,head:1}},true);await d.ready();for(let j=0;j<60;j++)d.animate(50+j*.05,{height:.08,emotion:'chin',progress:.5});camera.position.set(2.5,1.8,4);camera.lookAt(0,.72,0);r.render(scene,camera);},outfit);await p.waitForTimeout(200);await p.evaluate(()=>armQA.r.render(armQA.scene,armQA.camera));await p.screenshot({path:path.join(out,outfit+'-chin-front.png')});
 await p.evaluate(()=>{const {camera,r,scene}=armQA;camera.position.set(4,1.3,.08);camera.lookAt(0,.72,0);r.render(scene,camera);});await p.screenshot({path:path.join(out,outfit+'-chin-side.png')});
}
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:true,engine,baselineCompared:!!baseline,baselineMisses,cuffCases,maxStandingDifference,errors,...current},null,2));console.log(JSON.stringify({ok:true,engine,wardrobeCases:current.rows.length,cuffCases,baselineMisses,maxStandingDifference}));await p.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
