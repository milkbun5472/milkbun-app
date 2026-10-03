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
    phase:{backL:0,frontL:.75,backR:.5,frontR:.25}[name],started:false,lock:null,start:null,landing:null,wasStance:true,orientation:cat.getWorldQuaternion(new T.Quaternion()),startQ:null,
    upperLength:length(sub(data.knee,data.root)),lowerLength:length(sub(data.ankle,data.knee))}));
  let elapsed=0,clamps=0,lastFeet=[];
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
    const walking=speed>.006,rate=walking?speed/modelScale/(rig.stride/rig.duty):0;
    for(const c of controls.values()){c.bone.position.copy(c.position);c.bone.quaternion.copy(c.quaternion);c.bone.updateMatrix();}
    root.updateMatrixWorld(true);
    const amount=clamp(speed/(rig.stride/rig.duty/rig.cycle*modelScale),0,1);
    const phase=legs.find(l=>l.name==='backL').phase*TAU;
    const bob=.0045*amount*Math.cos(phase*2),sway=.004*amount*Math.sin(phase);
    const chestQ=new T.Quaternion().setFromEuler(new T.Euler(.012*amount*Math.sin(phase),.014*amount*Math.sin(phase),.010*amount*Math.sin(phase)));
    const pelvisQ=new T.Quaternion().setFromEuler(new T.Euler(-.010*amount*Math.sin(phase),-.012*amount*Math.sin(phase),-.008*amount*Math.sin(phase)));
    const offset=new T.Vector3(sway,bob,0),chestPivot=controls.get('chest').head,pelvisPivot=controls.get('pelvis').head;
    for(const [name,q,pivot] of [['chest',chestQ,chestPivot],['pelvis',pelvisQ,pelvisPivot]]){
      const d=rig.bones[name];place(name,transformed(d.head,pivot,q,offset),transformed(d.tail,pivot,q,offset),q);
    }
    const headQ=new T.Quaternion().setFromEuler(new T.Euler(-.007*amount*Math.sin(phase),clamp(turn*.11,-.12,.12),-.008*amount*Math.sin(phase)));
    const head=rig.bones.head;place('head',add(head.head,[sway*.4,bob*.35,0]),add(head.tail,[sway*.4,bob*.35,0]),headQ);
    lastFeet=[];
    for(const leg of legs){
      const oldPhase=leg.phase;
      if(walking)leg.phase=(leg.phase+dt*rate)%1;
      else if(leg.started&&leg.phase>=rig.duty)leg.phase=(leg.phase+dt/(rig.cycle*.6))%1;
      if(walking&&oldPhase<rig.duty&&leg.phase>=rig.duty)leg.started=true;
      const f=leg.started?sampleFoot(leg.phase,rig):{stance:true,forward:0,height:0};
      if(f.stance){
        if(!leg.lock||!leg.wasStance||leg.phase<oldPhase)leg.lock=leg.landing?.clone()||groundAnkle(leg,f.forward);
      }else if(leg.wasStance||!leg.start){
        leg.start=leg.lock?.clone()||groundAnkle(leg);
        leg.startQ=leg.orientation.clone();
        const duration=(1-rig.duty)*(matchSpeed&&rate>0?1/rate:rig.cycle),forward=new T.Vector3(0,0,1).applyQuaternion(root.quaternion);
        leg.landing=groundAnkle(leg,rig.stride/2).addScaledVector(forward,speed*duration);
        leg.landing.y=ground(leg.landing.x,leg.landing.z)+leg.data.ankle[1]*modelScale+.001;
      }
      if(!intent&&!f.stance){leg.landing.lerp(groundAnkle(leg),1-Math.exp(-12*dt));}
      let goal;
      if(f.stance)goal=leg.lock.clone();
      else{
        const s=(leg.phase-rig.duty)/(1-rig.duty),h=s*s*(3-2*s);
        goal=leg.start.clone().lerp(leg.landing,h);goal.y+=f.height*modelScale;
        leg.orientation.copy(leg.startQ).slerp(cat.getWorldQuaternion(new T.Quaternion()),h);
      }
      const ankle=cat.worldToLocal(goal.clone()).toArray();
      const q=leg.name.startsWith('front')?chestQ:pelvisQ,pivot=leg.name.startsWith('front')?chestPivot:pelvisPivot;
      const hip=transformed(leg.data.root,pivot,q,offset);
      const restKnee=transformed(leg.data.knee,pivot,q,offset);
      const solved=solveLimb(hip,ankle,restKnee,leg.upperLength,leg.lowerLength);if(solved.clamped)clamps++;
      place(leg.name+'Upper',hip,solved.knee);place(leg.name+'Lower',solved.knee,solved.ankle);
      const pawQ=cat.getWorldQuaternion(new T.Quaternion()).invert().multiply(leg.orientation);
      place(leg.name+'Paw',solved.ankle,add(solved.ankle,sub(leg.data.toe,leg.data.ankle)),pawQ);
      leg.wasStance=f.stance;
      lastFeet.push({name:leg.name,stance:f.stance,goal:goal.toArray(),ankle:cat.localToWorld(new T.Vector3().fromArray(solved.ankle)).toArray(),phase:leg.phase});
    }
    let prevOffset=[0,0,0];
    for(let i=0;i<3;i++){
      const d=rig.bones['tail'+i];
      const q=new T.Quaternion().setFromEuler(new T.Euler(.025*Math.sin(elapsed*.95-i*.35),.075*Math.sin(elapsed*1.35-i*.45)+clamp(turn*.035,-.04,.04),.018*Math.sin(elapsed*.9-i*.4)));
      const head=add(d.head,prevOffset),end=new T.Vector3().fromArray(sub(d.tail,d.head)).applyQuaternion(q).add(new T.Vector3().fromArray(head));
      place('tail'+i,head,end.toArray(),q);prevOffset=sub(end.toArray(),d.tail);
    }
    root.updateMatrixWorld(true);
  }
  return {update,snapshot:()=>({clamps,feet:lastFeet,elapsed}),dispose:()=>{for(const c of controls.values()){c.bone.position.copy(c.position);c.bone.quaternion.copy(c.quaternion);}}};
}
