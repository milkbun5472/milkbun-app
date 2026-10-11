import * as T from 'three';

const node=(actor,name)=>actor.root.getObjectByName(name);
export const bonePoint=(actor,name)=>node(actor,name)?.getWorldPosition(new T.Vector3());
export function headPoint(actor,point){actor.root.updateWorldMatrix(true,true);return node(actor,'HeadAnchor').localToWorld(new T.Vector3(...point));}
export function nearHand(actor,target){return ['left','right'].sort((x,y)=>bonePoint(actor,x==='left'?'Left_hand':'Right_hand').distanceTo(target)-bonePoint(actor,y==='left'?'Left_hand':'Right_hand').distanceTo(target))[0];}
export function pairSize(actor){
 actor.root.updateWorldMatrix(true,true);const left=bonePoint(actor,'leftArm'),right=bonePoint(actor,'rightArm'),head=node(actor,'HeadAnchor');
 return {width:left&&right?left.distanceTo(right):.33,radius:head?T.MathUtils.clamp(head.getWorldScale(new T.Vector3()).x,.16,.25):.20448};
}
export function pairSpacing(kind,a,b){
 const aa=pairSize(a),bb=pairSize(b),width=(aa.width+bb.width)/2;
 if(['shoulder','cuddle'].includes(kind))return aa.radius+bb.radius+.23;
 if(kind==='closer')return aa.radius+bb.radius+.28;
 if(kind==='arm-walk')return width+.19;
 if(kind==='cup')return width+.25;
 if(['hand','walk'].includes(kind))return width+.28;
 if(['wait','rest'].includes(kind))return width+.34;
 if(kind==='read')return width+.40;
 return null;
}
// Use the current torso frame, rather than the tilted head, for waist/back holds.
export function torsoPoint(actor,side=0,level=.6,front=.1){
 actor.root.updateWorldMatrix(true,true);const local=p=>actor.root.worldToLocal(p),body=local(bonePoint(actor,'body')||actor.root.localToWorld(new T.Vector3(0,.3,0))),l=local(bonePoint(actor,'leftArm')||actor.root.localToWorld(new T.Vector3(-.165,.655,0))),r=local(bonePoint(actor,'rightArm')||actor.root.localToWorld(new T.Vector3(.165,.655,0))),shoulder=l.clone().add(r).multiplyScalar(.5),center=body.lerp(shoulder,level),across=r.sub(l);
 center.addScaledVector(across,side*.5);center.z+=front;return actor.root.localToWorld(center);
}
export function pairContact(actor,targets,progress,record=[]){
 actor.root.updateWorldMatrix(true,true);const adjusted={};
 for(const side of ['left','right'])if(targets[side])adjusted[side]=bonePoint(actor,side==='left'?'Left_hand':'Right_hand').lerp(targets[side],progress);
 actor.contactPose(adjusted);
 for(const side of ['left','right'])if(targets[side])record.push({who:actor.root.userData.pairWho,side,error:bonePoint(actor,side==='left'?'Left_hand':'Right_hand').distanceTo(targets[side])});
}
export function shoulderPose(holder,leaner,progress,{embrace=false,holderProgress=progress}={}){
 const toward=leaner.root.worldToLocal(holder.root.position.clone()).x<0?-1:1;
 holder.contactPose({lean:toward*.025*holderProgress});
 const shoulder=torsoPoint(holder,-toward*1.05,1,.13),cheek=headPoint(leaner,[toward*.75,-.75,.18]),pivot=bonePoint(leaner,'body')||leaner.root.localToWorld(new T.Vector3(0,.3,0)),local=leaner.root.worldToLocal(cheek.clone()),hip=leaner.root.worldToLocal(pivot.clone()),target=leaner.root.worldToLocal(shoulder.clone());
 let angle=.52,best=Infinity;
 for(let i=0;i<=65;i++){const t=i*.01,q=local.clone().sub(hip).applyEuler(new T.Euler(.20,0,-toward*t)).add(hip),error=q.distanceToSquared(target);if(error<best){best=error;angle=t;}}
 leaner.contactPose({lean:-toward*angle*progress,tilt:.20*progress});
 const contacts=[];
 if(embrace){const side=nearHand(holder,leaner.root.position),back=torsoPoint(leaner,-toward*.75,.97,-.025);pairContact(holder,{[side]:back},holderProgress,contacts);
  // The leaning person's hands remain in their lap, with a light clasp on the wrapping wrist.
  const wrist=bonePoint(holder,side==='left'?'Left_hand':'Right_hand'),heldSide=nearHand(leaner,wrist);pairContact(leaner,{[heldSide]:wrist},progress,contacts);}
 return {contacts,shoulderDistance:headPoint(leaner,[toward*.75,-.75,.18]).distanceTo(shoulder),lean:angle};
}
export function hugPose(a,b,pa,pb){
 const contacts=[];
 for(const [giver,receiver,p] of [[a,b,pa],[b,a,pb]]){
  const headSide=giver.root.worldToLocal(receiver.root.position.clone()).x<0?-1:1;giver.contactPose({tilt:.06*p,neckLean:headSide*.20*p});
  const side=receiver.root.worldToLocal(giver.root.position.clone()).x<0?-1:1,back=torsoPoint(receiver,side*.85,.94,-.025),waist=torsoPoint(receiver,side*.85,.60,.10),inner=nearHand(giver,receiver.root.position),outer=inner==='left'?'right':'left',shoulder=bonePoint(giver,inner+'Arm');
  if(shoulder){back.y=Math.min(back.y,shoulder.y-.02);waist.y=Math.min(waist.y,shoulder.y-.12);}
  pairContact(giver,{[inner]:back,[outer]:waist},p,contacts);
 }
 return {contacts};
}
