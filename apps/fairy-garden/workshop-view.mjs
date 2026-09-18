import * as T from 'three';
import {MILL_RECIPES,millRemaining} from './workshop.mjs?v=fg-0a6ba51aff5eff37';
// Two reusable vessels show the actual saved batch state, without their own timer.
export function makeWorkshopView(){
 const root=new T.Group(),rows=[];root.name='工坊加工中的小瓶';
 for(const [i,key]of Object.keys(MILL_RECIPES).entries()){
  const group=new T.Group();group.position.set(-2.6+i*1.5,1.05,-.3);root.add(group);
  const mat=new T.MeshStandardMaterial({color:i?'#a2c6a1':'#b7b1d1',emissive:'#adcfa0',emissiveIntensity:.1,roughness:.4});
  const jar=new T.Mesh(new T.CylinderGeometry(.20,.22,.42,12),mat);jar.position.y=.22;group.add(jar);
  const cap=new T.Mesh(new T.CylinderGeometry(.21,.21,.06,12),new T.MeshStandardMaterial({color:'#9e8251'}));cap.position.y=.46;group.add(cap);
  const gleam=new T.Mesh(new T.OctahedronGeometry(.11),new T.MeshBasicMaterial({color:'#fff1aa'}));gleam.position.y=.8;group.add(gleam);
  rows.push({key,group,gleam,mat});
 }
 return {root,update(s,time){root.visible=s.map==='watermill';for(const row of rows){const remaining=millRemaining(s,row.key);row.group.visible=remaining!==null;row.gleam.visible=remaining===0;row.gleam.rotation.y=time;row.gleam.position.y=.8+Math.sin(time*2)*.035;row.mat.emissiveIntensity=remaining===0?.55:.13+.06*Math.sin(time*2);}},inspect:()=>({visible:root.visible,batches:rows.filter(r=>r.group.visible).map(r=>({key:r.key,ready:r.gleam.visible}))})};
}
