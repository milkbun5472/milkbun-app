// Exterior walls are grouped before batching, so rotation never hides furniture.
export function splitRoomCutaway(T,root,bounds){
 if(!Number.isFinite(bounds?.w)||!Number.isFinite(bounds?.d))return;
 root.updateWorldMatrix(true,true);const sides={back:[],left:[]};
 function visit(node){
  if(node.userData.furnitureId||node.userData.replaceable)return;
  const box=new T.Box3().setFromObject(node);
  if(/wall|window|curtain|skirting|trim|coping|memory|clock/i.test(node.name)&&!box.isEmpty()&&box.max.y>.45){
   const back=box.max.z<-bounds.d/2+1.05&&box.min.z<-bounds.d/2+.45,left=box.max.x<-bounds.w/2+1.05&&box.min.x<-bounds.w/2+.45;
   if(back||left){sides[back?'back':'left'].push(node);return;}
  }
  for(const child of node.children)visit(child);
 }
 for(const node of [...root.children])visit(node);
 for(const [side,nodes]of Object.entries(sides)){
  if(!nodes.length)continue;const group=new T.Group();group.name='RoomCutaway:'+side;group.userData.shellPart=true;group.userData.cutawaySide=side;root.add(group);group.updateWorldMatrix(true,false);
  for(const node of nodes)group.attach(node);
 }
}
export function createRoomCutaway(){
 let current=null,surfaces=[];
 const restore=()=>{for(const s of surfaces)s.node.visible=s.visible;};
 return {update(root,_bounds,direction){
  if(root!==current){restore();current=root;surfaces=[];root?.traverse(node=>{if(node.userData.cutawaySide)surfaces.push({node,side:node.userData.cutawaySide,visible:node.visible});});}
  const length=Math.hypot(direction.x,direction.z)||1;
  for(const s of surfaces)s.node.visible=s.visible&&!((s.side==='back'?direction.z:direction.x)/length<-.08);
 },snapshot:()=>({hidden:surfaces.filter(s=>!s.node.visible).map(s=>s.node.name)}),restore};
}
