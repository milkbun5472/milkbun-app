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
  const r=(x/1.86)**2+((z-.54)/1.32)**2;
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
export function createCatMotion(T,cat,rig,root,{ground=floorHeight,matchSpeed=false}={}){
  const modelScale=root.getWorldScale(new T.Vector3()).x*cat.scale.x;
  const controls=new Map();
  cat.updateWorldMatrix(true,true);
  for(const [name,data] of Object.entries(rig.bones)){
    const bone=cat.getObjectByName(name);if(!bone?.isBone)throw Error('Missing kitten bone '+name);
    const parentQ=bone.parent.getWorldQuaternion(new T.Quaternion()).premultiply(cat.getWorldQuaternion(new T.Quaternion()).invert());
    controls.set(name,{bone,position:bone.position.clone(),quaternion:bone.quaternion.clone(),parentQ,
      head:new T.Vector3().fromArray(data.head),dir:new T.Vector3().fromArray(data.tail).sub(new T.Vector3().fromArray(data.head)).normalize()});
  }
  const legs=Object.entries(rig.legs).map(([name,data])=>({name,data,
    phase:walkPhase(0,name),started:false,lock:null,start:null,landing:null,wasStance:true,orientation:cat.getWorldQuaternion(new T.Quaternion()),startQ:null,
    upperLength:length(sub(data.knee,data.root)),lowerLength:length(sub(data.ankle,data.knee))}));
  let elapsed=0,cycle=0,clamps=0,lastFeet=[],tail=normalizeTail(),lastRate=1/rig.cycle,wasWalking=false,gait={...rig,name:'walk'},phases=WALK_PHASE;
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
    dt=clamp(dt,0,.05);elapsed+=dt;
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
    for(const c of controls.values()){c.bone.position.copy(c.position);c.bone.quaternion.copy(c.quaternion);c.bone.updateMatrix();}
    root.updateMatrixWorld(true);
    const amount=clamp(movement/(rig.stride/rig.duty/rig.cycle*modelScale),0,1);
    const phase=cycle*TAU;
    const bob=.0035*amount*Math.cos(phase*2),sway=.0045*amount*Math.sin(phase);
    const chestQ=new T.Quaternion().setFromEuler(new T.Euler(.012*amount*Math.sin(phase),.014*amount*Math.sin(phase),.010*amount*Math.sin(phase)));
    const pelvisQ=new T.Quaternion().setFromEuler(new T.Euler(-.010*amount*Math.sin(phase),-.012*amount*Math.sin(phase),-.008*amount*Math.sin(phase)));
    // The body's height follows the paw support surface, not an abrupt curb
    // height sampled only under its centre. Legs remain reachable across steps.
    const contacts=legs.map(l=>l.wasStance?l.lock:l.landing).filter(Boolean);
    const supportGround=contacts.length?contacts.reduce((sum,p)=>sum+ground(p.x,p.z),0)/contacts.length:ground(rootPosition.x,rootPosition.z);
    const terrain=clamp((supportGround-ground(rootPosition.x,rootPosition.z))/modelScale,-.06,.06);
    const offset=new T.Vector3(sway,bob-.006*amount+terrain,0),chestPivot=controls.get('chest').head,pelvisPivot=controls.get('pelvis').head;
    let neededDrop=0;
    for(const leg of legs){
      if(!leg.wasStance||!leg.lock)continue;
      const a=cat.worldToLocal(leg.lock.clone()),d=leg.data.root;
      const horizontal=(a.x-d[0]-sway)**2+(a.z-d[2])**2;
      const reach=Math.sqrt(Math.max(0,(leg.upperLength+leg.lowerLength-.006)**2-horizontal));
      neededDrop=Math.max(neededDrop,d[1]+offset.y-a.y-reach);
    }
    // Bend into support during a pivot; recover gradually after the short step.
    supportDrop=Math.min(.09,Math.max(0,neededDrop,supportDrop*Math.exp(-10*dt)));offset.y-=supportDrop;
    for(const [name,q,pivot] of [['chest',chestQ,chestPivot],['pelvis',pelvisQ,pelvisPivot]]){
      const d=rig.bones[name];place(name,transformed(d.head,pivot,q,offset),transformed(d.tail,pivot,q,offset),q);
    }
    // A common parent pose carries the entire head with the neck. Small
    // local stabilization/looking is composed afterwards, never applied
    // just to the front of the face while the rear follows the torso.
    const headLocal=new T.Quaternion().setFromEuler(new T.Euler(-.004*amount*Math.sin(phase),clamp(turn*.07,-.08,.08),-.005*amount*Math.sin(phase)));
    const headQ=chestQ.clone().multiply(headLocal),head=rig.bones.head;
    const headAnchor=transformed(head.head,chestPivot,chestQ,offset);
    place('head',headAnchor,add(headAnchor,new T.Vector3().fromArray(sub(head.tail,head.head)).applyQuaternion(headQ).toArray()),headQ);
    lastFeet=[];
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
      const ankle=cat.worldToLocal(goal.clone()).toArray();
      const q=leg.name.startsWith('front')?chestQ:pelvisQ,pivot=leg.name.startsWith('front')?chestPivot:pelvisPivot;
      const hip=transformed(leg.data.root,pivot,q,offset);
      // An elbow/hock bends to the same anatomical side even when a paw
      // passes its shoulder. Projecting the almost-straight rest knee would
      // flip the bend direction mid-stride and curl the foreleg backwards.
      const restKnee=add(hip,new T.Vector3(0,0,leg.name.startsWith('front')?-1:1).applyQuaternion(q).toArray());
      const solved=solveLimb(hip,ankle,restKnee,leg.upperLength,leg.lowerLength);if(solved.clamped)clamps++;
      place(leg.name+'Upper',hip,solved.knee);place(leg.name+'Lower',solved.knee,solved.ankle);
      const pawQ=cat.getWorldQuaternion(new T.Quaternion()).invert().multiply(leg.orientation);
      place(leg.name+'Paw',solved.ankle,add(solved.ankle,sub(leg.data.toe,leg.data.ankle)),pawQ);
      leg.wasStance=f.stance;
      lastFeet.push({name:leg.name,stance:f.stance,goal:goal.toArray(),ankle:cat.localToWorld(new T.Vector3().fromArray(solved.ankle)).toArray(),phase:leg.phase});
    }
    // Compose each segment with the preceding segment: the tip follows the
    // base, rather than three disconnected rotations tearing the tail apart.
    let parentQ=pelvisQ.clone(),previousEnd=null;
    const wag=tail.wag?(rig.species==='dog'?.24:.105)*Math.sin(elapsed*(rig.species==='dog'?4.2:1.7)):0;
    for(let i=0;i<3;i++){
      const d=rig.bones['tail'+i];
      const local=new T.Quaternion().setFromEuler(new T.Euler(
        i===0?tail.pitch*Math.PI/180:tail.wag?.022*Math.sin(elapsed*1.3-i*.5):0,
        i===0?tail.yaw*Math.PI/180+wag:tail.wag?.045*Math.sin(elapsed*1.7-i*.6):0,0));
      const q=parentQ.clone().multiply(local);
      const head=previousEnd||new T.Vector3().fromArray(transformed(d.head,pelvisPivot,pelvisQ,offset));
      const end=new T.Vector3().fromArray(sub(d.tail,d.head)).applyQuaternion(q).add(head);
      place('tail'+i,head.toArray(),end.toArray(),q);previousEnd=end;parentQ=q;
    }
    root.updateMatrixWorld(true);wasWalking=walking;
  }
  return {update,setTail:value=>(tail=normalizeTail(value)),snapshot:()=>({clamps,feet:lastFeet,elapsed,cycle,gait:gait.name,rate:lastRate,tail:{...tail}}),dispose:()=>{for(const c of controls.values()){c.bone.position.copy(c.position);c.bone.quaternion.copy(c.quaternion);}}};
}
