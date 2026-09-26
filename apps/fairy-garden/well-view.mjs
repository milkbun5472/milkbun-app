import * as T from 'three';
import {MAPS,wellContext,wellTide,WELL_CURIOS} from './world.mjs?v=fg-f8143a96b488fdaa';
// Low-cost silhouettes make the tide legible even with effects reduced.
export function makeWellSigns(parent,{mouth=false}={}){
 const root=new T.Group();root.name='井潮征兆';root.userData.seasonTint=false;parent.add(root);
 if(mouth){const p=MAPS.garden.interactions.find(p=>p.kind==='well');root.position.set(p.x,.8,p.z);}
 const groups={},materials=[];
 for(const [id,form]of [['echo','shell'],['dream','seed'],['weave','thread'],['old','relic']]){
  const g=new T.Group();root.add(g);groups[id]=g;const m=new T.MeshBasicMaterial({color:WELL_CURIOS[form].color,transparent:true,opacity:.7,side:T.DoubleSide,depthWrite:false});materials.push(m);
  if(id==='dream'){const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),fade=ctx.createRadialGradient(32,32,0,32,32,32);fade.addColorStop(0,'rgba(255,255,255,.7)');fade.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=fade;ctx.fillRect(0,0,64,64);m.map=new T.CanvasTexture(canvas);}

  for(let i=0;i<5;i++){
   let geo,x=0,y=.03,z=0;
   if(id==='echo'){geo=new T.RingGeometry(.18+i*.12,.195+i*.12,40);}
   else if(id==='dream'){geo=new T.PlaneGeometry(.7,.19);x=(i-2)*.2;y=.08+i*.06;z=Math.sin(i)*.18;}
   else if(id==='weave'){const pts=[new T.Vector3(-.65+i*.28,.6,0),new T.Vector3(-.5+i*.28,.3,.16),new T.Vector3(-.65+i*.28,.08,.25)];geo=new T.TubeGeometry(new T.CatmullRomCurve3(pts),12,.011,4,false);}
   else {geo=new T.TorusGeometry(.08,.012,4,4);x=(i-2)*.22;y=.12;z=-.35;}
   const o=new T.Mesh(geo,m);o.position.set(x,y,z);if(id==='echo'||id==='old')o.rotation.x=-Math.PI/2;g.add(o);
  }
 }
 if(!mouth)root.position.set(0,.12,-2.2);
 return {root,update(s,time){root.visible=mouth?s.map==='garden':s.map==='depths';if(!root.visible)return;const id=mouth?wellTide(s).id:wellContext(s).local.id;for(const [k,g]of Object.entries(groups))g.visible=k===id;materials.forEach(m=>m.opacity=.52+Math.sin(time*1.5)*.13);groups.echo.children.forEach((o,i)=>{o.scale.setScalar(.92+Math.sin(time*1.4-i*.7)*.08);});groups.dream.position.y=Math.sin(time*.8)*.06;}};
}
