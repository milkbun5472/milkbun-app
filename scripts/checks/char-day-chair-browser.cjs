// Real authored Draco wardrobe. Compare standing with the unmodified traveler,
// then check bent knees, rigid shoes, cloth/cushion contact and live refitting.
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.DAY_URL||'http://127.0.0.1:18985',engine=process.env.DAY_ENGINE||'webkit',out=process.env.DAY_EVIDENCE||'/tmp/char-day-chair';fs.mkdirSync(out,{recursive:true});
const baseline=process.env.DAY_BASELINE?fs.readFileSync(process.env.DAY_BASELINE,'utf8'):null;
(async()=>{const browser=await pw[engine].launch(engine==='webkit'?{headless:true}:{channel:'chrome',headless:true}),errors=[];
async function page(old=false){const p=await browser.newPage({viewport:{width:1200,height:900}});p.on('pageerror',e=>errors.push(e.message));await p.route('**/pet.mjs*',r=>r.fulfill({body:'',contentType:'text/javascript'}));if(old)await p.route('**/traveler.mjs*',r=>r.fulfill({body:baseline,contentType:'text/javascript'}));await p.goto(base+'/apps/companion/');return p;}
async function sample(p,chair){return p.evaluate(async chair=>{
const T=await import('three'),{loadTravelerSource,createTraveler}=await import('../fairy-garden/traveler.mjs'),{OUTFITS,seatLook}=await import('../fairy-garden/wardrobe.mjs'),source=await loadTravelerSource(),catalog=await(await fetch('../fairy-garden/doll.json')).json();
const variants=[seatLook('me',{},'她').dims,Object.fromEntries(catalog.dims.map(x=>[x.key,x.min])),Object.fromEntries(catalog.dims.map(x=>[x.key,x.max]))],d=createTraveler(source,true,seatLook('me',{},'她')),rows=[];await d.ready();let time=0;
function visible(m){for(let o=m;o;o=o.parent)if(!o.visible)return false;return true;}
function verts(){const result={};d.root.updateMatrixWorld(true);d.root.traverse(m=>{if(!m.isSkinnedMesh||!visible(m))return;const values=[];for(let i=0;i<m.geometry.attributes.position.count;i++){const v=m.getVertexPosition(i,new T.Vector3());m.localToWorld(v);values.push(...v.toArray());}result[m.name]=values;});return result;}
function pose(seated){time=0;d.root.position.set(0,0,0);d.root.rotation.set(0,0,0);for(let j=0;j<80;j++)d.animate(time+=.1,{height:seated?.58:.08,seated,seatPose:seated?'chair':null,gesture:'rest'});}
for(const outfit of Object.keys(OUTFITS))for(const [variant,dims]of variants.entries()){
d.setLook({outfit,dims},true);await d.ready();time=0;pose(false);const standing=verts(),row={outfit,variant,standing};
if(chair){pose(true);const bones={};d.root.traverse(o=>{if(o.isBone)bones[o.name]=o;});row.knees=['left','right'].map(side=>{const knee=bones[side+'Knee'],hip=bones[side+'Leg'];return {side,knee:knee.getWorldPosition(new T.Vector3()).toArray(),hip:hip.getWorldPosition(new T.Vector3()).toArray(),angle:knee.quaternion.angleTo(knee.userData.testRest||new T.Quaternion())};});
row.parts=[];d.root.traverse(m=>{if(!m.isSkinnedMesh||!visible(m)||!m.userData.outfit)return;const pos=m.geometry.attributes.position;let clipped=0,insideMin=Infinity,footMinZ=Infinity,footMinY=Infinity;const footwear=/_footwear|_shoes/.test(m.name);
for(let i=0;i<pos.count;i++){if(pos.getY(i)>.38)continue;const v=m.getVertexPosition(i,new T.Vector3());m.localToWorld(v);if(v.z+.46<=.41&&v.z+.46>=-.28){insideMin=Math.min(insideMin,v.y);if(v.y<.515)clipped++;}if(footwear||pos.getY(i)<.07){footMinZ=Math.min(footMinZ,v.z+.46);footMinY=Math.min(footMinY,v.y);}}
row.parts.push({name:m.name,clipped,insideMin,footMinZ,footMinY});});
pose(false);row.afterStanding=verts();}
rows.push(row);}
// A second live instance shares the source, but must keep its own body and knees.
let rowIsolation=null;if(chair){const other=createTraveler(source,true,{outfit:'academy',dims:variants[0]});await other.ready();other.animate(1,{seated:true,seatPose:'chair',height:.58});other.root.updateMatrixWorld(true);const before=other.root.getObjectByName('leftKnee').position.toArray();d.setLook({dims:variants[2]},true);await d.ready();rowIsolation={before,after:other.root.getObjectByName('leftKnee').position.toArray()};}
return {rows,isolation:rowIsolation};},chair);}
try{let reference=null;if(baseline){const old=await page(true);reference=await sample(old,false);await old.close();}const p=await page(),current=await sample(p,true);let maxStandingDifference=0;
function compare(a,b,label){assert.deepEqual(Object.keys(a),Object.keys(b),label);for(const name of Object.keys(a)){assert.equal(a[name].length,b[name].length);for(let i=0;i<a[name].length;i++){const delta=Math.abs(a[name][i]-b[name][i]);maxStandingDifference=Math.max(maxStandingDifference,delta);assert.ok(delta<.00003,label+' '+name+' '+i+' moved '+delta);}}}
for(let i=0;i<current.rows.length;i++){const r=current.rows[i];if(reference)compare(reference.rows[i].standing,r.standing,r.outfit+' standing');compare(r.standing,r.afterStanding,r.outfit+' stand back up');for(const k of r.knees){assert.ok(k.knee[2]>k.hip[2]+.07);assert.ok(Math.abs(k.knee[1]-k.hip[1])<.025);}for(const part of r.parts){assert.equal(part.clipped,0,r.outfit+' '+part.name+' crosses cushion');if(Number.isFinite(part.footMinZ)){assert.ok(part.footMinZ>.408,r.outfit+' '+part.name+' heels inside cushion');assert.ok(part.footMinY>.08,r.outfit+' feet under floor');}}delete r.standing;delete r.afterStanding;}
assert.deepEqual(current.isolation.before,current.isolation.after);assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:true,engine,baselineCompared:!!baseline,maxStandingDifference,errors,...current},null,2));console.log(JSON.stringify({ok:true,engine,wardrobeCases:current.rows.length,maxStandingDifference}));await p.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
