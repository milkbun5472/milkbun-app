import {postureFrame} from './pet-action.mjs?v=fg-8aa89b39bf44a9c5';
import {ROOM_LAYOUTS} from '../../apps/pets/room-layout.mjs?v=fg-8aa89b39bf44a9c5';
import {normalizePetMood,samplePetMood} from './pet-mood.mjs?v=fg-8aa89b39bf44a9c5';
const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,k)=>a.map(v=>v*k);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const length=a=>Math.hypot(...a);
const unit=a=>mul(a,1/Math.max(1e-8,length(a)));

// Four-beat walking, not a diagonal trot. Stance motion cancels root travel;
// the swing matches the stance velocity at both ends and eases off the floor.
export function sampleFoot(phase,{duty=.68,stride=.14,lift=.043}={}){
  const p=((phase%1)+1)%1;
  if(p<duty)return {forward:stride*(.5-p/duty),height:0,stance:true};
  const s=(p-duty)/(1-duty),s2=s*s,s3=s2*s,m=-stride*(1-duty)/duty;
  return {forward:(2*s3-3*s2+1)*(-stride/2)+(-2*s3+3*s2)*(stride/2)+(2*s3-3*s2+s)*m,
    height:lift*Math.sin(Math.PI*s)**2,stance:false};
}

export function solveLimb(root,ankle,restKnee,upperLength,lowerLength){
  const delta=sub(ankle,root),d=clamp(length(delta),Math.abs(upperLength-lowerLength)+1e-6,upperLength+lowerLength-1e-6),axis=length(delta)>1e-8?unit(delta):[0,-1,0];
  const a=(upperLength**2-lowerLength**2+d*d)/(2*d),h=Math.sqrt(Math.max(0,upperLength**2-a*a));
  let bend=sub(sub(restKnee,root),mul(axis,dot(sub(restKnee,root),axis)));
  if(length(bend)<1e-7)bend=sub([0,0,1],mul(axis,dot([0,0,1],axis)));
  const knee=add(add(root,mul(axis,a)),mul(unit(bend),h));
  return {knee,ankle:add(root,mul(axis,d)),clamped:Math.abs(d-length(delta))>1e-5};
}

export function floorHeight(x,z){
  // Same authored oval rug and plank dimensions as build.py (web uses Y-up).
  const [sx,sz]=ROOM_LAYOUTS.home.zones.rug.scale;
  const r=(x/(1.86*sx))**2+((z-.54*sz)/(1.32*sz))**2;
  return r<1?.067+.039*Math.sqrt(1-r):.04;
}

// One shared clock determines every footfall (left rear, left front, right
// rear, right front). Two/three paw support overlaps at a regular walk;
// the swing lasts long enough for a relaxed forward reach.
export const WALK_PHASE={backL:0,frontL:.75,backR:.5,frontR:.25};
export const TROT_PHASE={backL:.5,frontL:0,backR:0,frontR:.5};
export function walkPhase(cycle,name){return ((cycle+WALK_PHASE[name])%1+1)%1;}
export function normalizeTail(value={}){
  return {wag:value.wag!==false,pitch:clamp(Number(value.pitch)||0,-25,25),yaw:clamp(Number(value.yaw)||0,-35,35)};
}
export function createCatMotion(T,cat,rig,root,{ground=floorHeight,matchSpeed=false,expressionState,eyes,resetAction=false}={}){
  const modelScale=root.getWorldScale(new T.Vector3()).x*cat.scale.x;
  const controls=new Map();
  cat.updateWorldMatrix(true,true);
  for(const [name,data] of Object.entries(rig.bones)){
    const bone=cat.getObjectByName(name);if(!bone?.isBone)throw Error('Missing kitten bone '+name);
    const parentQ=bone.parent.getWorldQuaternion(new T.Quaternion()).premultiply(cat.getWorldQuaternion(new T.Quaternion()).invert());
    controls.set(name,{bone,position:bone.position.clone(),quaternion:bone.quaternion.clone(),parentQ,
      restInverse:bone.matrixWorld.clone().premultiply(cat.matrixWorld.clone().invert()).invert(),
      head:new T.Vector3().fromArray(data.head),dir:new T.Vector3().fromArray(data.tail).sub(new T.Vector3().fromArray(data.head)).normalize()});
  }
  const legs=Object.entries(rig.legs).map(([name,data])=>({name,data,
    phase:walkPhase(0,name),started:false,lock:null,start:null,landing:null,wasStance:true,orientation:cat.getWorldQuaternion(new T.Quaternion()),startQ:null,
    upperLength:length(sub(data.knee,data.root)),lowerLength:length(sub(data.ankle,data.knee))}));
  let elapsed=Number.isFinite(expressionState?.elapsed)?expressionState.elapsed:0,cycle=0,clamps=0,lastFeet=[],lastClamp=null,tail=normalizeTail(),lastRate=1/rig.cycle,wasWalking=false,gait={...rig,name:'walk'},phases=WALK_PHASE;
  let responseTime=Number.isFinite(expressionState?.responseTime)&&expressionState.responseTime>=0&&expressionState.responseTime<2.6?expressionState.responseTime:-1;
  const response=()=>responseTime<0?0:Math.sin(Math.PI*Math.min(1,responseTime/2.6));
  let mood=normalizePetMood('neutral'),pose=samplePetMood(rig.species,mood),action={sit:0,lie:0,crouch:0,chestPitch:0,earPitch:0,tailCurl:0,tailQuiet:0,headPitch:0,headRoll:0,headYaw:0,height:0,chestHeight:0,pelvisHeight:0,roll:0,frontLLift:0,frontLReach:0,frontRLift:0,frontRReach:0},actionTarget={...action};
  if(expressionState?.pose)for(const key of Object.keys(pose))if(Number.isFinite(expressionState.pose[key]))pose[key]=expressionState.pose[key];
  if(!resetAction&&expressionState?.action)for(const key of Object.keys(action))if(Number.isFinite(expressionState.action[key]))action[key]=actionTarget[key]=expressionState.action[key];
  const chestOffset=new T.Vector3(),pelvisOffset=new T.Vector3();
  function expression(dt){elapsed+=dt;if(responseTime>=0){responseTime+=dt;if(responseTime>=2.6)responseTime=-1;}const target=samplePetMood(rig.species,mood,elapsed),blend=1-Math.exp(-2.5*dt);for(const key of Object.keys(pose))pose[key]+=(target[key]-pose[key])*blend;for(const key of Object.keys(action))action[key]+=(actionTarget[key]-action[key])*(1-Math.exp(-3.8*dt));}
  function poseHead(chestQ,offset,amount=0,phase=0,turn=0){
    const pivot=controls.get('chest').head,head=rig.bones.head;
    const reply=response(),local=new T.Quaternion().setFromEuler(new T.Euler(pose.headPitch+action.headPitch-.004*amount*Math.sin(phase)-.10*reply,pose.headYaw+action.headYaw+clamp(turn*.07,-.08,.08),pose.headRoll+action.headRoll-.005*amount*Math.sin(phase)+.18*reply*Math.sin(responseTime*3)));
    const headQ=chestQ.clone().multiply(local),anchor=transformed(head.head,pivot,chestQ,offset);anchor[1]-=action.lie*(1-amount)*(rig.species==='dog'?.030:.040);
    place('head',anchor,add(anchor,new T.Vector3().fromArray(sub(head.tail,head.head)).applyQuaternion(headQ).toArray()),headQ);
    for(const [side,sign] of [['L',1],['R',-1]]){
      const name='ear'+side,d=rig.bones[name];if(!d)continue;
      const a=new T.Vector3().fromArray(sub(d.head,head.head)).applyQuaternion(headQ).add(new T.Vector3().fromArray(anchor));
      const q=headQ.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(pose.earPitch+action.earPitch,0,pose.earSpread*sign*(rig.species==='dog'?-1:1))));
      place(name,a.toArray(),new T.Vector3().fromArray(sub(d.tail,d.head)).applyQuaternion(q).add(a).toArray(),q);
    }
  }
  function poseTail(pelvisQ,offset){
    let parentQ=pelvisQ.clone(),previousEnd=null;
    const reply=response(),wag=tail.wag?(pose.tailAmplitude+reply*(rig.species==='dog'?.22:.09))*(1-.93*action.lie)*(1-action.tailQuiet)*Math.sin(elapsed*(pose.tailFrequency+reply*1.8)):0;
    for(let i=0;i<3;i++){
      const d=rig.bones['tail'+i];
      const local=new T.Quaternion().setFromEuler(new T.Euler(i===0?tail.pitch*Math.PI/180+pose.tailPitch-.53*action.tailCurl:-.40*action.tailCurl+(tail.wag?.022*Math.sin(elapsed*1.3-i*.5):0),i===0?tail.yaw*Math.PI/180+pose.tailYaw+wag+.22*action.tailCurl:.38*action.tailCurl+(tail.wag?.045*Math.sin(elapsed*1.7-i*.6):0),0));
      const q=parentQ.clone().multiply(local),head=previousEnd||new T.Vector3().fromArray(transformed(d.head,controls.get('pelvis').head,pelvisQ,offset));
      if(action.lie>.00001){
        // All three resting segments share one rotation, preserving the
        // authored fluffy curl while the entire tail settles beside the body.
        const tuck=new T.Quaternion().setFromEuler(rig.species==='dog'?new T.Euler(-.55,.20,-1.0):new T.Euler(2.2,0,-.7));
        q.slerp(tuck,action.lie);
      }
      const end=new T.Vector3().fromArray(sub(d.tail,d.head)).applyQuaternion(q).add(head);
      place('tail'+i,head.toArray(),end.toArray(),q);previousEnd=end;parentQ=q;
    }
  }
  let previousRoot=root.getWorldPosition(new T.Vector3()),previousYaw=root.rotation.y,supportDrop=0;
  const footPhase=name=>((cycle+phases[name])%1+1)%1;
  function place(name,head,tail,deltaQ){
    const c=controls.get(name),world=cat.localToWorld(new T.Vector3().fromArray(head));
    c.bone.position.copy(c.bone.parent.worldToLocal(world));
    const q=deltaQ||new T.Quaternion().setFromUnitVectors(c.dir,new T.Vector3().fromArray(tail).sub(new T.Vector3().fromArray(head)).normalize());
    c.bone.quaternion.copy(c.parentQ.clone().invert().multiply(q).multiply(c.parentQ).multiply(c.quaternion));
    c.bone.updateMatrix();
  }
  function transformed(p,pivot,q,offset){return new T.Vector3().fromArray(p).sub(pivot).applyQuaternion(q).add(pivot).add(offset).toArray();}
  function groundAnkle(leg,forward=0){
    const p=cat.localToWorld(new T.Vector3().fromArray(leg.data.ankle).add(new T.Vector3(0,0,forward)));
    p.y=ground(p.x,p.z)+leg.data.ankle[1]*modelScale+.001;return p;
  }
  function update(dt,speed,turn=0,intent=true){
    dt=clamp(dt,0,.05);expression(dt);
    const rootPosition=root.getWorldPosition(new T.Vector3()),yawDelta=Math.atan2(Math.sin(root.rotation.y-previousYaw),Math.cos(root.rotation.y-previousYaw)),yawRate=dt?yawDelta/dt:0;
    const velocity=dt?rootPosition.clone().sub(previousRoot).divideScalar(dt):new T.Vector3();previousRoot=rootPosition;previousYaw=root.rotation.y;
    const movement=speed+Math.abs(yawRate)*.4*modelScale,walking=movement>.006;
    if(walking&&!wasWalking&&legs.every(l=>l.wasStance)){
      const trot=matchSpeed&&movement/modelScale>.45;
      gait=trot?{...rig,name:'trot',duty:.52,stride:.20,lift:.03}:{...rig,name:'walk'};phases=trot?TROT_PHASE:WALK_PHASE;
    }
    const rate=walking?movement/modelScale/(gait.stride/gait.duty):0;
    if(walking){
      if(!wasWalking&&legs.every(l=>l.wasStance)){
        cycle=Math.floor(cycle)+gait.duty;
        // Start a rear paw (or diagonal pair) at its planted point. Others join
        // at their next lift boundary; no paw appears halfway through swing.
        for(const l of legs){l.phase=footPhase(l.name);l.started=gait.name==='trot'?(l.name==='frontL'||l.name==='backR'):l.name==='backL';l.landing=null;l.start=null;}
      }
      cycle+=dt*rate;lastRate=rate;
    }
    else if(legs.some(l=>l.started&&!l.wasStance))cycle+=dt*Math.max(lastRate,1/rig.cycle);
    for(const c of controls.values()){c.bone.matrixAutoUpdate=true;c.bone.position.copy(c.position);c.bone.quaternion.copy(c.quaternion);c.bone.updateMatrix();}
    root.updateMatrixWorld(true);
    const amount=clamp(movement/(rig.stride/rig.duty/rig.cycle*modelScale),0,1);
    const phase=cycle*TAU,bodyBlend=1-.7*amount,posture=postureFrame(rig,action,elapsed,amount);
    const bob=.0035*amount*Math.cos(phase*2),sway=.0045*amount*Math.sin(phase);
    const chestQ=new T.Quaternion().setFromEuler(new T.Euler(.012*amount*Math.sin(phase)+pose.pitch*bodyBlend+posture.chestPitch,.014*amount*Math.sin(phase),.010*amount*Math.sin(phase)+(pose.roll+action.roll)*bodyBlend));
    const pelvisQ=new T.Quaternion().setFromEuler(new T.Euler(-.010*amount*Math.sin(phase)+pose.pitch*bodyBlend+posture.pelvisPitch,-.012*amount*Math.sin(phase),-.008*amount*Math.sin(phase)+(pose.roll+action.roll)*bodyBlend));
    // The body's height follows the paw support surface, not an abrupt curb
    // height sampled only under its centre. Legs remain reachable across steps.
    const contacts=legs.map(l=>l.wasStance?l.lock:l.landing).filter(Boolean);
    const supportGround=contacts.length?contacts.reduce((sum,p)=>sum+ground(p.x,p.z),0)/contacts.length:ground(rootPosition.x,rootPosition.z);
    const terrain=clamp((supportGround-ground(rootPosition.x,rootPosition.z))/modelScale,-.06,.06);
    const offset=new T.Vector3(sway,bob-.006*amount+terrain+(pose.height+action.height)*bodyBlend,pose.forward*bodyBlend),chestPivot=controls.get('chest').head,pelvisPivot=controls.get('pelvis').head;
    let neededDrop=0;
    for(const leg of legs){
      if(!leg.wasStance||!leg.lock||posture.lie>.001||posture.sit>.001)continue;
      const a=cat.worldToLocal(leg.lock.clone()),front=leg.name.startsWith('front');
      const supportOffset=offset.clone();supportOffset.y+=((front?pose.chestHeight:pose.pelvisHeight)+(front?action.chestHeight:action.pelvisHeight))*bodyBlend;
      const hip=transformed(leg.data.root,front?chestPivot:pelvisPivot,front?chestQ:pelvisQ,supportOffset);
      const horizontal=(a.x-hip[0])**2+(a.z-hip[2])**2;
      const reach=Math.sqrt(Math.max(0,(leg.upperLength+leg.lowerLength-.006)**2-horizontal));
      neededDrop=Math.max(neededDrop,hip[1]-a.y-reach);
    }
    // Bend into support during a pivot; recover gradually after the short step.
    supportDrop=Math.min(.09,Math.max(0,neededDrop,supportDrop*Math.exp(-10*dt)));offset.y-=supportDrop;
    chestOffset.copy(offset);chestOffset.y+=(pose.chestHeight+action.chestHeight)*bodyBlend+posture.chestY;pelvisOffset.copy(offset);pelvisOffset.y+=(pose.pelvisHeight+action.pelvisHeight)*bodyBlend+posture.pelvisY;
    const plans=[];lastFeet=[];
    for(const leg of legs){
      const oldPhase=leg.phase;
      leg.phase=footPhase(leg.name);
      if(walking&&oldPhase<gait.duty&&leg.phase>=gait.duty)leg.started=true;
      const f=leg.started&&(walking||!leg.wasStance)?sampleFoot(leg.phase,gait):{stance:true,forward:0,height:0};
      if(f.stance){
        if(!leg.lock||!leg.wasStance)leg.lock=leg.landing?.clone()||leg.lock?.clone()||groundAnkle(leg);
      }else if(leg.wasStance||!leg.start){
        leg.start=leg.lock?.clone()||groundAnkle(leg);
        leg.startQ=leg.orientation.clone();
        const duration=(1-leg.phase)*(rate>0?1/rate:rig.cycle);
        const centered=leg.data.root[2]-leg.data.ankle[2]+(gait.name==='trot'?0:leg.name.startsWith('front')?.045:-.045);
        leg.landing=groundAnkle(leg,centered+gait.stride/2*(speed/Math.max(.006,movement)));
        // Predict the actual translation and rotation at touchdown, including
        // pivot steps. Turning never sends a planted foot to yesterday's heading.
        leg.landing.sub(rootPosition).applyAxisAngle(new T.Vector3(0,1,0),clamp(yawRate*duration,-.8,.8)).add(rootPosition).addScaledVector(velocity,duration);
        leg.landing.y=ground(leg.landing.x,leg.landing.z)+leg.data.ankle[1]*modelScale+.001;
      }
      if(!f.stance&&intent){
        const remaining=(1-leg.phase)/Math.max(rate,lastRate),centered=leg.data.root[2]-leg.data.ankle[2]+(gait.name==='trot'?0:leg.name.startsWith('front')?.045:-.045);
        const next=groundAnkle(leg,centered+gait.stride/2*(speed/Math.max(.006,movement)));
        next.sub(rootPosition).applyAxisAngle(new T.Vector3(0,1,0),clamp(yawRate*remaining,-.8,.8)).add(rootPosition).addScaledVector(velocity,remaining);
        next.y=ground(next.x,next.z)+leg.data.ankle[1]*modelScale+.001;
        leg.landing.lerp(next,Math.max(1-Math.exp(-18*dt),clamp(1-remaining/.07,0,1)));
      }
      if(!intent&&!f.stance){leg.landing.lerp(groundAnkle(leg),1-Math.exp(-12*dt));}
      let goal;
      if(f.stance)goal=leg.lock.clone();
      else{
        const s=(leg.phase-gait.duty)/(1-gait.duty),h=s*s*s*(10-15*s+6*s*s);
        goal=leg.start.clone().lerp(leg.landing,h);goal.y+=f.height*modelScale;
        leg.orientation.copy(leg.startQ).slerp(cat.getWorldQuaternion(new T.Quaternion()),h);
      }
      const folded=posture.paw(leg);
      if(!walking&&f.stance){
        const rest=groundAnkle(leg),lift=(action[leg.name+'Lift']||0)*(1-amount),reach=(action[leg.name+'Reach']||0)*(1-amount),shift=new T.Vector3(folded.x,posture.lie*(leg.name.startsWith('front')?.005:0)+lift,folded.z+reach).multiplyScalar(modelScale).applyQuaternion(cat.getWorldQuaternion(new T.Quaternion()));
        // Paws fold continuously instead of staying in the standing footprint.
        const blend=Math.max(posture.lie,posture.sit,action.crouch*(1-amount));
        goal.lerp(rest,blend).add(shift);
      }
      const ankle=cat.worldToLocal(goal.clone()).toArray();
      const q=leg.name.startsWith('front')?chestQ:pelvisQ,pivot=leg.name.startsWith('front')?chestPivot:pelvisPivot;
      plans.push({leg,f,goal,ankle,q,pivot,folded});
    }
    // A swinging paw can still be behind the shoulder while turning over a
    // rug edge. All current paw targets must be reachable before posing the
    // torso; checking only planted paws misses that short lift transition.
    let extraDrop=0;
    for(const {leg,ankle,q,pivot} of plans){
      const hip=transformed(leg.data.root,pivot,q,leg.name.startsWith('front')?chestOffset:pelvisOffset);
      const horizontal=(ankle[0]-hip[0])**2+(ankle[2]-hip[2])**2;
      const reach=Math.sqrt(Math.max(0,(leg.upperLength+leg.lowerLength-.006)**2-horizontal));
      extraDrop=Math.max(extraDrop,hip[1]-ankle[1]-reach);
    }
    extraDrop=Math.min(.09-supportDrop,Math.max(0,extraDrop));supportDrop+=extraDrop;
    chestOffset.y-=extraDrop;pelvisOffset.y-=extraDrop;
    for(const [name,q,pivot,o] of [['chest',chestQ,chestPivot,chestOffset],['pelvis',pelvisQ,pelvisPivot,pelvisOffset]]){
      const d=rig.bones[name];const head=transformed(d.head,pivot,q,o);place(name,head,transformed(d.tail,pivot,q,o),q);
      const scale=name==='chest'?posture.chestScale:posture.pelvisScale;
      if(scale!==1){
        // A resting belly softens vertically around its control, while the
        // independently posed skull and paws retain their original shape.
        const c=controls.get(name);c.bone.updateWorldMatrix(true,false);c.bone.matrixAutoUpdate=false;
        const soften=new T.Matrix4().makeTranslation(0,head[1]*(1-scale),0).multiply(new T.Matrix4().makeScale(1,scale,1));
        c.bone.matrix.copy(c.bone.parent.matrixWorld.clone().invert().multiply(cat.matrixWorld).multiply(soften).multiply(cat.matrixWorld.clone().invert()).multiply(c.bone.matrixWorld));
        c.bone.matrixWorldNeedsUpdate=true;
      }
    }
    // The same parent pose carries the entire head and both ears.
    poseHead(chestQ,chestOffset,amount,phase,turn);
    for(const {leg,f,goal,ankle,q,pivot,folded} of plans){
      const hip=transformed(leg.data.root,pivot,q,leg.name.startsWith('front')?chestOffset:pelvisOffset);
      // An elbow/hock bends to the same anatomical side even when a paw
      // passes its shoulder. Projecting the almost-straight rest knee would
      // flip the bend direction mid-stride and curl the foreleg backwards.
      const restKnee=add(hip,new T.Vector3((leg.name.endsWith('L')?-1:1)*posture.lie*(leg.name.startsWith('front')?1.8:.9),posture.lie*(leg.name.startsWith('front')?.10:.25),leg.name.startsWith('front')?-1+.8*posture.lie:1).applyQuaternion(q).toArray());
      const solved=solveLimb(hip,ankle,restKnee,leg.upperLength,leg.lowerLength);if(solved.clamped){clamps++;lastClamp={name:leg.name,hip,ankle,phase:leg.phase,stance:f.stance,root:rootPosition.toArray(),distance:length(sub(hip,ankle)),reach:leg.upperLength+leg.lowerLength,drop:supportDrop,action:{...action}};}
      place(leg.name+'Upper',hip,solved.knee);place(leg.name+'Lower',solved.knee,solved.ankle);
      const pawQ=cat.getWorldQuaternion(new T.Quaternion()).invert().multiply(leg.orientation).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),folded.yaw));
      place(leg.name+'Paw',solved.ankle,add(solved.ankle,sub(leg.data.toe,leg.data.ankle)),pawQ);
      leg.wasStance=f.stance;
      lastFeet.push({name:leg.name,stance:f.stance,goal:goal.toArray(),ankle:cat.localToWorld(new T.Vector3().fromArray(solved.ankle)).toArray(),phase:leg.phase});
    }
    // Compose each segment with the preceding segment: the tip follows the
    // base, rather than three disconnected rotations tearing the tail apart.
    poseTail(pelvisQ,pelvisOffset);
    eyes?.update(action.lie,elapsed);root.updateMatrixWorld(true);wasWalking=walking;
  }
  return {respond(){responseTime=0;return true;},get readyToMove(){return action.lie<.02&&action.sit<.15;},get animating(){if(responseTime>=0)return true;const target=samplePetMood(rig.species,mood,elapsed);return Object.keys(pose).some(k=>Math.abs(pose[k]-target[k])>.0001)||Object.keys(action).some(k=>Math.abs(action[k]-actionTarget[k])>.0001);},update,setMood:value=>(mood=normalizePetMood(value)),setActionPose(value={}){for(const k of Object.keys(actionTarget)){const limit=k==='headPitch'?1.06:k==='height'||k.endsWith('Height')?.09:.35;actionTarget[k]=['sit','lie','crouch','tailCurl','tailQuiet'].includes(k)?clamp(Number(value[k])||0,0,1):clamp(Number(value[k])||0,-limit,limit);}},updateExpression(dt){expression(clamp(dt,0,.05));poseHead(new T.Quaternion(),new T.Vector3());poseTail(new T.Quaternion(),new T.Vector3());root.updateMatrixWorld(true);},attachment(name,point){const c=controls.get(name);if(!c)return null;root.updateMatrixWorld(true);return new T.Vector3().fromArray(point).applyMatrix4(c.restInverse).applyMatrix4(c.bone.matrixWorld);},setTail:value=>(tail=normalizeTail(value)),snapshot:()=>({clamps,lastClamp,feet:lastFeet,elapsed,responseTime,cycle,gait:gait.name,rate:lastRate,tail:{...tail},mood:{...mood},pose:{...pose},action:{...action}}),dispose:()=>{for(const c of controls.values()){c.bone.matrixAutoUpdate=true;c.bone.position.copy(c.position);c.bone.quaternion.copy(c.quaternion);c.bone.updateMatrix();}}};
}
