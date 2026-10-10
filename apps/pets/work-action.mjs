import {samplePetAction} from '../../art/pet-house/pet-action.mjs?v=fg-bb00e9e166d5c29c';
import {createParcelProp,disposeParcelProp} from './parcel-prop.mjs?v=fg-bb00e9e166d5c29c';

// Work facts own the clock and completion. This view only samples the current
// stage; it never awards items, chooses a story, moves a pet or writes a save.
const STAGES={
 model:[['workGreet','camera'],['workGreet','camera'],['workInspect','photo']],
 actor:[['workInspect','tag'],['workGreet','camera'],['workSort','photo']],
 wedding:[['workInspect','flower'],['workSort','flower'],['workGreet','flower']],
 books:[['workInspect','book'],['workGreet',''],['workSort','book']],
 scent:[['workInspect','flower'],['workInspect','clue'],['workSort','flower']],
 bakery:[['workInspect','bag'],['workGreet',''],['workSort','bag']],
 florist:[['workInspect','flower'],['workSort','flower'],['workInspect','flower']],
 store:[['workInspect','tag'],['workGreet',''],['workSort','tag']],
 cafe:[['workGreet',''],['workGreet',''],['workSort','coaster']],
 alley:[['workInspect','clue'],['workSort','clue'],['workInspect','clue']],
 courier:[['workInspect','parcel'],['workGreet',''],['workSort','tag']],
 stall:[['workSort','parcel'],['workGreet',''],['workSort','parcel']]
};
export function samplePetWork(job,{atDestination=false,species='cat'}={}){
 if(!atDestination||job?.phase!=='working')return null;
 const stage=STAGES[job.profession]?.[job.index];if(!stage)return null;
 const [kind,prop]=stage,time=Math.max(0,Number(job.time)||0);
 return {kind,prop,pose:samplePetAction(kind,time,{species})};
}
export function createPetWorkView(T,{pet}){
 const root=new T.Group();root.name='pet-work-props';root.visible=false;pet.root.add(root);const props=new Map();let current=null;
 function make(kind){
  const g=kind==='bag'||kind==='parcel'?createParcelProp(T,'work-'+kind,{sealed:kind==='parcel'}):new T.Group();g.userData.workProp=kind;
  const add=(geometry,color,x,y,z)=>{const m=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:1}));m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  if(['tag','coaster','clue','book','photo'].includes(kind)){
   add(kind==='coaster'?new T.CylinderGeometry(.10,.10,.009,24):new T.BoxGeometry(.18,.008,.14),'#eee1c8',0,.006,0);
   for(let i=0;i<3;i++)add(new T.BoxGeometry(.085,.003,.006),kind==='clue'?'#81778b':'#a48878',0,.012,-.035+i*.025);
  }else if(kind==='camera'){
   add(new T.BoxGeometry(.20,.12,.075),'#b8acbb',0,.08,0);const lens=add(new T.CylinderGeometry(.05,.05,.03,16),'#625a66',0,.08,.052);lens.rotation.x=Math.PI/2;
  }else if(kind==='flower'){
   add(new T.BoxGeometry(.012,.012,.22),'#79916b',0,.01,-.08);
   add(new T.SphereGeometry(.032,10,6),'#79916b',-.026,.016,-.05).scale.set(1.4,.2,.6);
   for(let i=0;i<5;i++){const a=i*Math.PI*2/5;add(new T.SphereGeometry(.036,10,6),'#dfaaa9',Math.cos(a)*.038,.025,Math.sin(a)*.038+.045).scale.y=.35;}
   add(new T.SphereGeometry(.020,10,6),'#e1c984',0,.029,.045).scale.y=.35;
  }
  if(kind==='bag'||kind==='parcel')g.scale.setScalar(.48);root.add(g);props.set(kind,g);return g;
 }
 function sync(action){
  current=action;root.visible=!!action?.prop;
  for(const [kind,g]of props)g.visible=kind===action?.prop;
  if(!root.visible)return;
  const g=props.get(action.prop)||make(action.prop);g.visible=true;pet.root.updateMatrixWorld(true);
  // Place the temporary work object beside the original front paw, using the
  // current species/model transform. Saved size scales both paw and object.
  const a=pet.rig.legs.frontL.ankle,p=pet.root.worldToLocal(pet.model.localToWorld(new T.Vector3().fromArray(a)));
  root.position.set(p.x,0,p.z+.12);g.position.z=(action.pose.frontLReach||0)*pet.model.scale.x*.45;g.rotation.y=(action.pose.frontLReach||0)*2;
 }
 return {sync,hide:()=>{root.visible=false;current=null;},snapshot:()=>({kind:current?.kind||'',prop:current?.prop||'',visible:root.visible}),root,dispose:()=>{for(const g of props.values())disposeParcelProp(g);root.removeFromParent();}};
}
