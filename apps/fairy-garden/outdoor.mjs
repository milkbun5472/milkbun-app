import * as T from 'three';
import {MAPS} from './world.mjs?v=fg-f8143a96b488fdaa';
import {weatherLook,rainSurface} from './weather-look.mjs?v=fg-f8143a96b488fdaa';
// One seasonal renderer for every outdoor map and late-arriving streamed chunk.
export function makeOutdoor(scene,landscapes=[]){
 const group=new T.Group();group.name='室外四季';scene.add(group);
 function texture(kind){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle='#fff';
  if(kind==='rain'){const g=x.createLinearGradient(0,0,0,64);g.addColorStop(0,'#ffffff00');g.addColorStop(.7,'#ffffff');g.addColorStop(1,'#ffffff66');x.strokeStyle=g;x.lineWidth=4;x.lineCap='round';x.beginPath();x.moveTo(42,3);x.lineTo(23,60);x.stroke();}
  else if(kind==='petal'){x.translate(32,32);x.rotate(-.6);x.beginPath();x.ellipse(0,0,12,21,0,0,Math.PI*2);x.fill();}
  else if(kind==='leaf'){x.beginPath();x.moveTo(10,8);x.bezierCurveTo(53,4,60,29,51,54);x.bezierCurveTo(10,55,5,36,10,8);x.fill();x.strokeStyle='#ffffff77';x.lineWidth=2;x.beginPath();x.moveTo(12,10);x.lineTo(51,53);x.stroke();}
  else {const g=x.createRadialGradient(32,32,kind==='mist'?0:8,32,32,30);g.addColorStop(0,'#ffffffff');g.addColorStop(.4,kind==='mist'?'#ffffff99':'#ffffffff');g.addColorStop(1,'#ffffff00');x.fillStyle=g;x.fillRect(0,0,64,64);}
  return new T.CanvasTexture(c);
 }
 const maps=Object.fromEntries(['rain','snow','petal','leaf','glow','mist'].map(k=>[k,texture(k)]));
 // PointsMaterial size is in screen pixels for our ORTHOGRAPHIC camera, not world units.
 const pointMat=(color,map,size,opacity)=>new T.PointsMaterial({color,map,size,sizeAttenuation:false,transparent:true,opacity,depthWrite:false,toneMapped:false});
 const rainMat=pointMat('#c9e2ec',maps.rain,25,.8),snowMat=pointMat('#f4faff',maps.snow,5.5,.9);
 const coords=new Float32Array(700*3),geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(coords,3));const precipitation=new T.Points(geo,rainMat);precipitation.frustumCulled=false;group.add(precipitation);
 const flecks=new Float32Array(90*3),fg=new T.BufferGeometry();fg.setAttribute('position',new T.BufferAttribute(flecks,3));const petalMat=pointMat('#f4cecb',maps.petal,6,.8),petals=new T.Points(fg,petalMat);petals.frustumCulled=false;group.add(petals);
 const splashMat=new T.MeshBasicMaterial({color:'#c9e4df',transparent:true,opacity:.48,depthWrite:false,side:T.DoubleSide,toneMapped:false});
 const splashes=new T.InstancedMesh(new T.RingGeometry(.8,1,18),splashMat,80);splashes.frustumCulled=false;group.add(splashes);
 const fogSheets=[];for(let i=0;i<8;i++){const mat=new T.SpriteMaterial({map:maps.mist,color:'#e3ebdb',transparent:true,opacity:0,depthWrite:false});const sprite=new T.Sprite(mat);sprite.raycast=()=>{};group.add(sprite);fogSheets.push(sprite);}
 precipitation.raycast=petals.raycast=splashes.raycast=()=>{};
 const roots=new WeakMap(),materials=new WeakMap();let look=null,contacts=[],contactKey='';const dummy=new T.Object3D();
 function materialInfo(m){let e=materials.get(m);if(e)return e;
  const name=m.name||'',role=m.userData.seasonRole||(/foliage|reeds|canopy|leaves/i.test(name)?'leaf':/grass|earth|meadow/i.test(name)?'ground':/shingles|roof/i.test(name)?'roof':/lake.*water/i.test(name)?'water':'other');
  e={m,base:m.color.clone(),rough:m.roughness,role,snow:{value:0}};materials.set(m,e);
  if(['leaf','ground','roof'].includes(role)){const original=m.onBeforeCompile,snow=e.snow;m.onBeforeCompile=shader=>{original.call(m,shader);shader.uniforms.seasonSnow=snow;shader.vertexShader='varying float seasonUp;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nseasonUp = normalize(mat3(modelMatrix) * objectNormal).y;');shader.fragmentShader='varying float seasonUp;\nuniform float seasonSnow;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84,0.91,0.94), seasonSnow * smoothstep(0.15,0.8,seasonUp));');};m.customProgramCacheKey=()=> 'fairy-season-snow-v1';m.needsUpdate=true;}
  return e;
 }
 function style(root,p){let entry=roots.get(root);if(!entry){const unique=new Set();root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.color)unique.add(m);});entry={key:'',items:[...unique].map(materialInfo)};roots.set(root,entry);}if(entry.key===p.key)return;entry.key=p.key;
  for(const {m,base,rough,role,snow}of entry.items){m.color.copy(base);if(role==='leaf')m.color.lerp(new T.Color(p.leaf),p.season===2?.8:.48);else if(role==='ground')m.color.lerp(new T.Color(p.ground),.4);else if(role==='water')m.color.lerp(new T.Color(p.water),p.season===3?.7:.4);
   if(p.wet&&['leaf','ground','roof'].includes(role))m.color.multiplyScalar(role==='ground'?.77:.87);
   snow.value=p.snowCover;if(Number.isFinite(rough))m.roughness=p.wet?Math.max(.2,rough-p.roughness):rough;
  }
 }
 const fract=x=>x-Math.floor(x),rnd=i=>fract(Math.sin(i*127.1+311.7)*43758.5453);
 return {root:group,precipitation,update(s,views,time,center,options={}){
  const outside=!!MAPS[s.map].outdoor;group.visible=outside;if(!outside){precipitation.visible=false;petals.visible=false;splashes.visible=false;fogSheets.forEach(x=>x.visible=false);scene.fog.near=27;scene.fog.far=62;look=null;return;}
  look=weatherLook(s);const p=look,index=p.season,lite=!!options.lite,radius=Math.max(8,Math.min(26,(options.span||22)*.65));
  group.position.set(center.x,0,center.z);precipitation.visible=p.fallCount>0;precipitation.material=p.snow?snowMat:rainMat;precipitation.material.size=p.fallSize;
  const count=Math.round(p.fallCount*(lite?.55:1));geo.setDrawRange(0,count);
  scene.fog.near=p.fogNear;scene.fog.far=p.fogFar;
  for(let i=0;i<count;i++){const y=fract(i*.317-time*p.fallSpeed/10)*10;coords[i*3]=(rnd(i)-.5)*radius*2+(10-y)*p.wind*.18+(p.snow?Math.sin(time*.6+i)*.35:0);coords[i*3+1]=y;coords[i*3+2]=(rnd(i+720)-.5)*radius*2;}geo.attributes.position.needsUpdate=true;
  const driftCount=Math.round(p.driftCount*(lite?.55:1));petals.visible=driftCount>0;petalMat.map=index===0?maps.petal:index===2?maps.leaf:maps.glow;petalMat.color.set(p.drift);petalMat.size=p.driftSize;petalMat.opacity=index===1&&p.night?.88:.72;fg.setDrawRange(0,driftCount);
  for(let i=0;i<driftCount;i++){flecks[i*3]=(rnd(i+1800)-.5)*radius*2+Math.sin(time*.5+i)*p.wind;flecks[i*3+1]=index===1?.55+Math.sin(time*.7+i)*.3:fract(i*.57-time*(index===2?.07:.035))*5;flecks[i*3+2]=(rnd(i+1900)-.5)*radius*2+Math.cos(time*.4+i)*.4;}fg.attributes.position.needsUpdate=true;
  const key=s.map+':'+p.key+':'+Math.floor(center.x/3)+':'+Math.floor(center.z/3)+':'+Math.round(radius);
  if(key!==contactKey){contactKey=key;contacts=[];if(p.rain){for(let i=0;i<200&&contacts.length<80;i++){const x=center.x+(rnd(i+2500)-.5)*radius*2,z=center.z+(rnd(i+2900)-.5)*radius*2,surface=rainSurface(s,x,z);if(surface)contacts.push({x,z,...surface});}}}
  splashes.visible=p.rain;splashes.count=Math.min(contacts.length,lite?36:80);for(let i=0;i<splashes.count;i++){const c=contacts[i],phase=fract(time*(c.water?.9:1.9)+i*.618),size=(c.water?.08:.025)+phase*(c.water?.3:.10);dummy.position.set(c.x-center.x,c.y,c.z-center.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.setScalar(phase>.9?0:size);dummy.updateMatrix();splashes.setMatrixAt(i,dummy.matrix);}splashes.instanceMatrix.needsUpdate=true;
  fogSheets.forEach((f,i)=>{f.visible=p.mistOpacity>0&&(!lite||i<4);f.material.opacity=p.mistOpacity*(.75+Math.sin(time*.13+i)*.2);f.material.color.set(p.fog);f.position.set(Math.sin(i*2.4)*radius*.7+Math.sin(time*.08+i)*1.5,.35+(i%3)*.26,Math.cos(i*2.4)*radius*.7);f.scale.set(9+i%3*3,1.0+i%2*.6,1);});
  const view=views[s.map];if(view){style(view.root,p);for(const landscape of landscapes)style(landscape,p);for(const root of view.stream?.roots()||[])style(root,p);}
 },inspect:()=>({outside:group.visible,precipitation:precipitation.visible,petals:petals.visible,weatherProfile:look?.key||null,fallCount:group.visible&&precipitation.visible?geo.drawRange.count:0,fallSize:precipitation.material.size,splashes:group.visible&&splashes.visible?splashes.count:0,waterSplashes:group.visible&&splashes.visible?contacts.filter(x=>x.water).length:0,mistSheets:group.visible?fogSheets.filter(x=>x.visible).length:0,seasonSnow:look?.snowCover||0})};
}
