import * as T from 'three';
import {environmentAt} from './environment.mjs?v=fg-90b53e2779ab7a1c';

const vertexShader=`varying vec2 surface;void main(){surface=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fragmentShader=`varying vec2 surface;uniform float time;uniform float rain;uniform float night;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec2 p=surface*vec2(12.0,6.0);p.y+=time*1.7;vec2 cell=floor(p);vec2 uv=fract(p)-.5;float seed=hash(cell);float drop=(1.0-smoothstep(.025,.065,abs(uv.x+(seed-.5)*.50)))*(1.0-smoothstep(.08,.35,abs(uv.y)))*step(.42,seed);gl_FragColor=vec4(mix(vec3(.78,.88,.91),vec3(.45,.60,.78),night),drop*rain*.48);}`;

// Capture real window geometry before room batching removes individual meshes.
// The overlay stays in the scene graph, so ordinary map disposal owns every resource.
export function prepareEnvironmentSurfaces(root){
 if(root.userData.dayEnvironmentPrepared)return;root.userData.dayEnvironmentPrepared=true;
 root.updateMatrixWorld(true);const windows=[],roofs=[];
 root.traverse(o=>{
  if(o.isMesh&&/^(?:WindowGlass|window-view|window-glass|LibraryWindowGlass|PaperWindow)$/i.test(o.name))windows.push(o);
  if(o.isMesh&&/CanopyRoof|StationRoof/.test(o.name)){const b=new T.Box3().setFromObject(o);roofs.push({min:b.min.toArray(),max:b.max.toArray()});}
 });
 root.userData.dayWeatherRoofs=roofs;
 if(!windows.length)return;
 const group=new T.Group();group.name='DayWindowWeather';group.userData.replaceable=true;
 const mat=new T.ShaderMaterial({vertexShader,fragmentShader,uniforms:{time:{value:0},rain:{value:0},night:{value:0}},transparent:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 for(const source of windows){
  const mesh=new T.Mesh(source.geometry.clone(),mat);mesh.matrixAutoUpdate=false;mesh.matrix.copy(root.matrixWorld.clone().invert().multiply(source.matrixWorld));mesh.renderOrder=2;group.add(mesh);
 }
 group.visible=false;root.add(group);
}

export function createDayEnvironment({scene,renderer,hemi,sun,fill}){
 const root=new T.Group();root.name='DayWeather';scene.add(root);
 const max=200,rainPositions=new Float32Array(max*6),snowPositions=new Float32Array(max*3);
 const rainGeometry=new T.BufferGeometry();rainGeometry.setAttribute('position',new T.BufferAttribute(rainPositions,3));
 const snowGeometry=new T.BufferGeometry();snowGeometry.setAttribute('position',new T.BufferAttribute(snowPositions,3));
 const rain=new T.LineSegments(rainGeometry,new T.LineBasicMaterial({color:'#9fb9c5',transparent:true,opacity:.47,depthWrite:false}));
 const snow=new T.Points(snowGeometry,new T.PointsMaterial({color:'#f2f3e9',size:2.2,sizeAttenuation:false,depthWrite:false}));rain.frustumCulled=snow.frustumCulled=false;rain.visible=snow.visible=false;root.visible=false;root.add(rain,snow);
 const lamps=Array.from({length:3},()=>new T.PointLight('#ffd9a0',0,5,2));for(const light of lamps)scene.add(light);
 let map=null,view=null,quality={particles:200},windows=[],glows=[],state=environmentAt(),lastLight='';
 const background=new T.Color(),nightSky=new T.Color('#242f43'),daySky=new T.Color('#dce5df'),warmSky=new T.Color('#e5cbb2');
 const sunDay=new T.Color('#fff3df'),sunWarm=new T.Color('#ffd6a7'),sunNight=new T.Color('#b7cbe0');
 function bind(next,nextView,nextQuality){
  map=next;view=nextView;quality=nextQuality||quality;windows=[];glows=[];lastLight='';
  view?.root.traverse(o=>{
   if(o.name==='DayWindowWeather')windows.push(o);
   for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.emissive&&m.emissive.getHex()>0&&!glows.includes(m))glows.push(m);
  });
  const furniture=map?.furniture||[],spots=furniture.filter(p=>['light','lamp'].includes(p.kind)).slice(0,3);
  if(!spots.length&&windows.length)spots.push({x:map.bounds?.w/2-1.5,z:-map.bounds?.d/2+1.0,kind:'lamp'});
  for(let i=0;i<lamps.length;i++){lamps[i].userData.used=!!spots[i];lamps[i].position.set(spots[i]?.x||0,spots[i]?.kind==='light'?1.55:2.45,spots[i]?.z||0);lamps[i].intensity=0;}
 }
 function setQuality(next){quality=next;}
 function update(minute,weather,time){
  state=environmentAt(minute,weather);const lightKey=JSON.stringify([state.minute,state.kind]);
  if(lightKey!==lastLight){
   lastLight=lightKey;hemi.intensity=state.hemi;sun.intensity=state.sun;fill.intensity=state.fill;
   background.copy(nightSky).lerp(daySky,state.daylight).lerp(warmSky,state.warmth*.55);if(state.wet||state.kind==='fog')background.lerp(new T.Color('#87959c'),.28);
   renderer.setClearColor(background);sun.color.copy(sunNight).lerp(sunDay,state.daylight).lerp(sunWarm,state.warmth*.72);
   sun.position.set(-8+state.daylight*3,12+state.daylight*5,10);hemi.color.copy(sunNight).lerp(sunDay,state.daylight);
   for(const light of lamps)light.intensity=light.userData.used?state.lamp*2.4:0;
   for(const m of glows)m.emissiveIntensity=.04+state.daylight*.15;
  }
  for(const g of windows){g.visible=state.wet;g.traverse(o=>{if(o.material?.uniforms?.rain){o.material.uniforms.time.value=time;o.material.uniforms.rain.value=state.wet?1:0;o.material.uniforms.night.value=state.lamp;}});}
  const outside=map?.outdoor||['dayStreet','dayTraining','dayStation'].includes(map?.renderer||map?.id),count=Math.min(max,quality.particles||max);
  rain.visible=outside&&state.kind==='rain';snow.visible=outside&&state.kind==='snow';
  root.visible=rain.visible||snow.visible;
  if(root.visible){
   const w=map.bounds?.w||18,d=map.bounds?.d||16,roofs=view?.root.userData.dayWeatherRoofs||[];
   for(let i=0;i<count;i++){
    let x=((i*.61803398875)%1-.5)*w,z=((i*.41421356237)%1-.5)*d;
    if((map.renderer||map.id)==='dayStation')x=w/2+.9+(i%7)*.17;
    const under=roofs.some(r=>x>r.min[0]&&x<r.max[0]&&z>r.min[2]&&z<r.max[2]);
    const y=under?-10:.25+((i*.137-time*(rain.visible?1.45:.17))%1+1)%1*5.4;
    rainPositions.set([x,y,z,x-.06,y-.23,z-.015],i*6);snowPositions.set([x+Math.sin(time+i)*.07,y,z],i*3);
   }
   rainGeometry.setDrawRange(0,count*2);snowGeometry.setDrawRange(0,count);rainGeometry.attributes.position.needsUpdate=true;snowGeometry.attributes.position.needsUpdate=true;
  }
  return state;
 }
 function close(){root.removeFromParent();rainGeometry.dispose();snowGeometry.dispose();rain.material.dispose();snow.material.dispose();for(const l of lamps)l.removeFromParent();}
 return {bind,setQuality,update,close,inspect:()=>({...state,windows:windows.length,outsideRain:rain.visible,outsideSnow:snow.visible,particles:root.visible?Math.min(max,quality.particles||max):0,lamps:lamps.filter(l=>l.intensity>0).length})};
}
