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
 if(['shoulder','cuddle','sit-hug','sit-lean'].includes(kind))return aa.radius+bb.radius+.23;
 if(kind==='lie-hug')return width+.10;
 if(kind==='sit-pat')return aa.radius+bb.radius+.08;
 if(kind==='sit-hand')return aa.radius+bb.radius+.23;
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
 actor.root.updateWorldMatrix(true,true);const visual=node(actor,'TravelerVisual');
 if(visual&&Math.abs(visual.rotation.x)>1){const body=bonePoint(actor,'body'),l=bonePoint(actor,'leftArm'),r=bonePoint(actor,'rightArm'),shoulder=l.clone().add(r).multiplyScalar(.5),across=r.clone().sub(l),up=shoulder.clone().sub(body),frontAxis=across.clone().cross(up).normalize();return body.lerp(shoulder,level).addScaledVector(across,side*.5).addScaledVector(frontAxis,front);}
 const local=p=>actor.root.worldToLocal(p),body=local(bonePoint(actor,'body')||actor.root.localToWorld(new T.Vector3(0,.3,0))),l=local(bonePoint(actor,'leftArm')||actor.root.localToWorld(new T.Vector3(-.165,.655,0))),r=local(bonePoint(actor,'rightArm')||actor.root.localToWorld(new T.Vector3(.165,.655,0))),shoulder=l.clone().add(r).multiplyScalar(.5),center=body.lerp(shoulder,level),across=r.sub(l);
 center.addScaledVector(across,side*.5);center.z+=front;return actor.root.localToWorld(center);
}
export function pairContact(actor,targets,progress,record=[]){
 actor.root.updateWorldMatrix(true,true);const adjusted={};
 for(const side of ['left','right'])if(targets[side])adjusted[side]=bonePoint(actor,side==='left'?'Left_hand':'Right_hand').lerp(targets[side],progress);
 actor.contactPose(adjusted);
 for(const side of ['left','right'])if(targets[side])record.push({who:actor.root.userData.pairWho,side,error:bonePoint(actor,side==='left'?'Left_hand':'Right_hand').distanceTo(targets[side])});
}
export function shoulderPose(holder,leaner,progress,{embrace=false,holderProgress=progress,minimumHeadGap=0}={}){
 const toward=leaner.root.worldToLocal(holder.root.position.clone()).x<0?-1:1;
 holder.contactPose({lean:toward*.025*holderProgress});
 const shoulder=torsoPoint(holder,-toward*1.05,1,.13),cheek=headPoint(leaner,[toward*.75,-.75,.18]),pivot=bonePoint(leaner,'body')||leaner.root.localToWorld(new T.Vector3(0,.3,0)),local=leaner.root.worldToLocal(cheek.clone()),hip=leaner.root.worldToLocal(pivot.clone()),target=leaner.root.worldToLocal(shoulder.clone());
 let angle=.52,best=Infinity;
 for(let i=0;i<=65;i++){const t=i*.01,rotation=new T.Euler(.20,0,-toward*t),q=local.clone().sub(hip).applyEuler(rotation).add(hip),center=leaner.root.worldToLocal(headPoint(leaner,[0,0,0])).sub(hip).applyEuler(rotation).add(hip);if(minimumHeadGap&&leaner.root.localToWorld(center).distanceTo(headPoint(holder,[0,0,0]))<minimumHeadGap)continue;const error=q.distanceToSquared(target);if(error<best){best=error;angle=t;}}
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

// Keep the hips close while the neck and waist make room for the larger heads.
// Match skin points in world space; feet stay on the floor throughout.
export const faceSpacing=(a,b)=>(pairSize(a).width+pairSize(b).width)*.34;
export function facePose(giver,receiver,gp,rp,goals,seed=null){
 const forward=goals.receiver.clone().sub(goals.giver);forward.y=0;forward.normalize();
 const sample=(actor,point,goal)=>({actor,q:actor.root.worldToLocal(headPoint(actor,point)),head:actor.root.worldToLocal(headPoint(actor,[0,0,0])),waist:actor.root.worldToLocal(bonePoint(actor,'body')),shift:goal.clone().sub(actor.root.position).setY(0)});
 const g=sample(giver,gp,goals.giver),r=sample(receiver,rp,goals.receiver),gy=Math.atan2(gp[1],Math.hypot(gp[0],gp[2])),ry=Math.atan2(rp[1],Math.hypot(rp[0],rp[2])),yaw=-Math.atan2(rp[0],rp[2]);
 const point=(s,tilt,nod,turn=0)=>s.actor.root.localToWorld(s.q.clone().sub(s.head).applyEuler(new T.Euler(nod,turn,0)).add(s.head).sub(s.waist).applyAxisAngle(new T.Vector3(1,0,0),tilt).add(s.waist)).add(s.shift);
 const evaluate=(beta,tilt)=>{const gn=gy-beta-tilt,rn=ry+beta-tilt,from=point(g,tilt,gn),to=point(r,tilt,rn,yaw),delta=from.clone().sub(to);return {y:delta.y,z:delta.dot(forward),error:delta.length(),gn,rn};};
 // Fit contact height and depth with two shared angles: contact inclination
 // and waist tilt. The head turns independently when offering a cheek.
 let beta=seed?.beta??Math.asin(T.MathUtils.clamp((headPoint(receiver,[0,0,0]).y-headPoint(giver,[0,0,0]).y)/.42,-.9,.9)),tilt=seed?.tilt??-.18;
 for(let i=0;i<9;i++){
  const v=evaluate(beta,tilt);if(Math.hypot(v.y,v.z)<.0005)break;
  const h=.004,u=evaluate(beta+h,tilt),w=evaluate(beta,tilt+h),yb=(u.y-v.y)/h,zb=(u.z-v.z)/h,yt=(w.y-v.y)/h,zt=(w.z-v.z)/h,det=yb*zt-yt*zb;
  if(Math.abs(det)<1e-6)break;
  beta=T.MathUtils.clamp(beta+T.MathUtils.clamp((-v.y*zt+v.z*yt)/det,-.2,.2),-1.2,1.2);
  tilt=T.MathUtils.clamp(tilt+T.MathUtils.clamp((v.y*zb-v.z*yb)/det,-.2,.2),-.65,.35);
 }
 const v=evaluate(beta,tilt);
 return {ok:v.error<.035&&Math.abs(v.gn)<1.35&&Math.abs(v.rn)<1.35,beta,tilt,giverNod:v.gn,receiverNod:v.rn,receiverTurn:yaw,error:v.error};
}
export function faceHands(giver,receiver,pg,pr,previous=null){
 const points=[-1,1].flatMap(sign=>[-.50,-.20,.12].map(level=>({sign,level,point:headPoint(receiver,[sign*.9,level,.78])})));
 const head=giver.root.getObjectByName('HeadAnchor');
 const candidates=points.flatMap(({point,sign,level})=>['left','right'].map(side=>{const shoulder=bonePoint(giver,side+'Arm'),elbow=bonePoint(giver,side+'Forearm'),wrist=bonePoint(giver,side==='left'?'Left_hand':'Right_hand'),a=shoulder.distanceTo(elbow),b=elbow.distanceTo(wrist),minimum=Math.sqrt(a*a+b*b+2*a*b*Math.cos(Math.PI*.75)),distance=shoulder.distanceTo(point),self=head.worldToLocal(point.clone()).length();return {side,point,sign,level,distance,penalty:Math.max(0,minimum+.008-distance,distance-a-b+.008)+Math.max(0,.08-(point.y-shoulder.y))+Math.max(0,1.12-self)*.2};})).sort((a,b)=>a.penalty-b.penalty||a.distance-b.distance);
 const held=previous&&candidates.find(q=>q.side===previous.side&&q.sign===previous.sign&&q.level===previous.level),choice=held&&held.penalty<=Math.max(.006,candidates[0].penalty)?held:candidates[0];
 const {side,point}=choice,shoulder=bonePoint(giver,side+'Arm'),elbow=bonePoint(giver,side+'Forearm'),wrist=bonePoint(giver,side==='left'?'Left_hand':'Right_hand'),span=shoulder.distanceTo(elbow)+elbow.distanceTo(wrist),desired=point.clone().sub(shoulder),target=shoulder.clone().addScaledVector(desired.normalize(),Math.min(span-.001,shoulder.distanceTo(point))),contacts=[];
 const free=side==='left'?'right':'left';
 pairContact(giver,{[side]:target,[free]:torsoPoint(receiver,free==='left'?1:-1,.30,.11)},pg,contacts);
 const support=torsoPoint(giver,side==='left'?-1:1,.30,.11);
 pairContact(receiver,{[nearHand(receiver,support)]:support},pr,contacts);
 return {contacts,choice:{side,sign:choice.sign,level:choice.level},faceHand:{who:giver.root.userData.pairWho,side,target:point.toArray(),wrist:bonePoint(giver,side==='left'?'Left_hand':'Right_hand').toArray(),gap:bonePoint(giver,side==='left'?'Left_hand':'Right_hand').distanceTo(point),reachable:shoulder.distanceTo(point)<=span}};
}
