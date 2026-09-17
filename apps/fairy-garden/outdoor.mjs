import * as T from 'three';
import {MAPS,seasonOf,weather} from './world.mjs?v=fg-a638923bcfb06005';
// One seasonal renderer for every outdoor map, including models loaded after a transition.
export function makeOutdoor(scene,landscapes=[]){
 const group=new T.Group();group.name='室外四季';scene.add(group);
 function texture(snow){const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.fillStyle='#ffffff';if(snow){x.beginPath();x.arc(16,16,10,0,Math.PI*2);x.fill();}else{x.fillRect(15,2,2,28);}const t=new T.CanvasTexture(c);return t;}
 const rainMat=new T.PointsMaterial({color:'#c4dce4',map:texture(false),size:.25,transparent:true,opacity:.65,depthWrite:false}),snowMat=new T.PointsMaterial({color:'#f6fcff',map:texture(true),size:.095,transparent:true,opacity:.85,depthWrite:false});
 const coords=new Float32Array(240*3),geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(coords,3));const precipitation=new T.Points(geo,rainMat);precipitation.frustumCulled=false;group.add(precipitation);
 const flecks=new Float32Array(60*3),fg=new T.BufferGeometry();fg.setAttribute('position',new T.BufferAttribute(flecks,3));const petalMat=new T.PointsMaterial({color:'#f4cecb',map:texture(true),size:.065,transparent:true,opacity:.7,depthWrite:false}),petals=new T.Points(fg,petalMat);petals.frustumCulled=false;group.add(petals);
 precipitation.raycast=petals.raycast=()=>{};
 const tracked=new WeakMap();let last='';
 function style(root,season,wet){let entry=tracked.get(root);if(!entry){const materials=new Set();root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.color)materials.add(m);});entry=[];
  for(const m of materials){const name=m.name||'',role=m.userData.seasonRole||(/foliage|reeds/i.test(name)?'leaf':/grass|earth/i.test(name)?'ground':/shingles|roof/i.test(name)?'roof':'other');const snow={value:0};entry.push({m,base:m.color.clone(),rough:m.roughness,role,snow});
   if(['leaf','ground','roof'].includes(role)){const original=m.onBeforeCompile;m.onBeforeCompile=shader=>{original.call(m,shader);shader.uniforms.seasonSnow=snow;shader.vertexShader='varying float seasonUp;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nseasonUp = normalize(mat3(modelMatrix) * objectNormal).y;');shader.fragmentShader='varying float seasonUp;\nuniform float seasonSnow;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84,0.91,0.94), seasonSnow * smoothstep(0.15,0.8,seasonUp));');};m.customProgramCacheKey=()=> 'fairy-season-snow-v1';m.needsUpdate=true;}
  }tracked.set(root,entry);}
  const index=season.index%4;for(const {m,base,rough,role,snow}of entry){m.color.copy(base);if(role==='leaf')m.color.lerp(new T.Color(['#b6d99c','#638b57','#d09853','#9baaad'][index]),index===2?.78:.45);else if(role==='ground')m.color.lerp(new T.Color(['#acc08a','#829d69','#aa9870','#cad9dd'][index]),.35);snow.value=index===3?.9:0;if(Number.isFinite(rough))m.roughness=wet?Math.max(.35,rough-.22):rough;}
 }
 return {root:group,precipitation,update(s,views,time,center){const outside=!!MAPS[s.map].outdoor;group.visible=outside;if(!outside){precipitation.visible=false;petals.visible=false;scene.fog.near=27;scene.fog.far=62;return;}
  const season=seasonOf(s.day),kind=weather(s.day,s.epoch),index=season.index%4;precipitation.visible=['细雨','细雪'].includes(kind);precipitation.material=kind==='细雪'?snowMat:rainMat;petals.visible=index===0||index===2;petalMat.color.set(index===0?'#f4cecb':'#d49a51');
  scene.fog.near=kind==='薄雾'?14:kind==='细雨'?18:27;scene.fog.far=kind==='薄雾'?46:kind==='细雨'?48:62;
  group.position.set(center.x,0,center.z);const snow=kind==='细雪';for(let i=0;i<240;i++){coords[i*3]=Math.sin(i*91.7)*13+(snow?Math.sin(time*.5+i)*.3:0);coords[i*3+1]=((i*.317-time*(snow?.45:5))%8+8)%8;coords[i*3+2]=Math.cos(i*47.3)*13;}geo.attributes.position.needsUpdate=true;
  for(let i=0;i<60;i++){flecks[i*3]=Math.sin(i*43)*11+Math.sin(time*.4+i)*.7;flecks[i*3+1]=((i*.57-time*.2)%5+5)%5;flecks[i*3+2]=Math.cos(i*17)*11+Math.cos(time*.3+i)*.4;}fg.attributes.position.needsUpdate=true;
  const key=s.map+season.index+kind;const view=views[s.map];if(view&&(last!==key||!tracked.has(view.root))){style(view.root,season,kind==='细雨');for(const landscape of landscapes)style(landscape,season,kind==='细雨');last=key;}
  for(const root of view?.stream?.roots()||[])if(root.userData.weatherKey!==key){style(root,season,kind==='细雨');root.userData.weatherKey=key;}
 },inspect:()=>({outside:group.visible,precipitation:precipitation.visible,petals:petals.visible})};
}
