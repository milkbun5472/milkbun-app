import {makeIceView} from './ice-view.mjs?v=fg-8a700fd86387e70f';
import * as T from 'three';
import {MAPS,driftError,seasonOf} from './world.mjs?v=fg-8a700fd86387e70f';
// Artwork only: button and bottle mesh both call the existing request('bottle') transaction.
// No inventory, daily counter, or generated content lives in this renderer.
export function makeLakeView(){
 const root=new T.Group();root.name='月湖的水纹与漂流瓶';root.visible=false;
 const ice=makeIceView();root.add(ice.root);
 const bottle=new T.Group();bottle.name='岸边漂流瓶';root.add(bottle);
 const glass=new T.MeshStandardMaterial({color:'#589e8c',roughness:.28,metalness:.08}),paper=new T.MeshStandardMaterial({color:'#fff0cb',roughness:.85}),cork=new T.MeshStandardMaterial({color:'#947354',roughness:1});
 const add=(geo,mat,x,y,z)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);bottle.add(m);return m;};
 const vessel=new T.Group();bottle.add(vessel);
 for(const [geo,mat,y]of [[new T.CylinderGeometry(.17,.15,.44,12),glass,0],[new T.CylinderGeometry(.085,.17,.12,12),glass,.28],[new T.CylinderGeometry(.075,.075,.16,12),glass,.40],[new T.CylinderGeometry(.085,.085,.07,10),cork,.50]]){const m=new T.Mesh(geo,mat);m.position.y=y;vessel.add(m);}
 const letter=new T.Mesh(new T.BoxGeometry(.22,.24,.018),paper);letter.position.set(0,.015,.155);vessel.add(letter);vessel.rotation.z=-.85;vessel.rotation.x=.18;
 const wax=new T.Mesh(new T.SphereGeometry(.035,8,6),new T.MeshStandardMaterial({color:'#ba745f'}));wax.position.set(0,.01,.174);vessel.add(wax);
 const halo=new T.Mesh(new T.RingGeometry(.42,.46,32),new T.MeshBasicMaterial({color:'#fff0af',transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false}));halo.rotation.x=-Math.PI/2;halo.position.y=-.17;halo.raycast=()=>{};bottle.add(halo);
 // Generous invisible hit volume keeps a small bottle usable on a narrow phone screen.
 const hit=add(new T.SphereGeometry(.58,10,8),new T.MeshBasicMaterial({visible:false}),0,.1,0);
 const ripples=new T.Group();root.add(ripples);const rippleGeo=new T.RingGeometry(.5,.515,36,1,0,Math.PI*1.65),rippleMat=new T.MeshBasicMaterial({color:'#cae6d8',transparent:true,opacity:.33,side:T.DoubleSide,depthWrite:false});
 const marks=[[12,6],[10.5,4],[14,1],[17,-2],[24,-.5],[25,2],[9.4,8.3],[21,0]];
 for(const [x,z]of marks){const m=new T.Mesh(rippleGeo,rippleMat);m.rotation.x=-Math.PI/2;m.position.set(x,MAPS.garden.lake.waterHeight+.018,z);m.raycast=()=>{};ripples.add(m);}
 let loaded=[];
 return {root,update(s,time,districts=[]){loaded=districts;ice.update(s,time,districts);root.visible=s.map==='garden'&&districts.some(id=>id==='pond'||id==='lake-far');const winter=seasonOf(s.day).index%4===3,site=MAPS.garden.lake.bottle;bottle.visible=root.visible&&districts.includes('pond')&&!driftError(s);bottle.position.set(site.x,site.height+(winter?0:Math.sin(time*1.4)*.025),site.z);vessel.rotation.y=winter?0:Math.sin(time*.8)*.08;halo.scale.setScalar(1+Math.sin(time*2)*.08);halo.material.opacity=.62+Math.sin(time*2)*.15;glass.color.set(winter?'#649eab':'#589e8c');ripples.children.forEach((m,i)=>{m.visible=!winter&&districts.includes(m.position.z<MAPS.garden.lake.splitZ?'lake-far':'pond');const size=(winter?.7:1)+Math.sin(time*.55+i)*.13;m.scale.set(size*1.6,size,1);});rippleMat.opacity=winter?.13:.3;},pickBottle(ray){return root.visible&&bottle.visible&&ray.intersectObject(hit,false).length>0;},inspect:()=>({...ice.inspect(),visible:root.visible,bottle:root.visible&&bottle.visible,districts:[...loaded],position:{x:bottle.position.x,y:bottle.position.y,z:bottle.position.z}})};
}
