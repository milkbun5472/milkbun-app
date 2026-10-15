import * as T from 'three';

// The elbow has one hinge, rather than the three free axes of a CCD joint.
// Choose its bend plane from the doll's body, so a close contact cannot flip
// the elbow up/back or twist a long sleeve through itself.
export function reachHand(root,upper,lower,hand,target,iterations=16,{work=false}={}){
  if(!upper||!hand||!target)return;
  if(lower?.userData.reachRest){
    root.updateWorldMatrix(true,true);
    const shoulder=upper.getWorldPosition(new T.Vector3()),elbow=lower.getWorldPosition(new T.Vector3()),wrist=hand.getWorldPosition(new T.Vector3());
    const a=shoulder.distanceTo(elbow),b=elbow.distanceTo(wrist),direction=target.clone().sub(shoulder),distance=direction.length();
    if(a<1e-6||b<1e-6||distance<1e-6)return;
    direction.divideScalar(distance);
    const min=Math.sqrt(a*a+b*b+2*a*b*Math.cos(work?Math.PI*2/3:Math.PI*.75));
    const reach=Math.max(min,Math.min(a+b-1e-6,distance));
    const along=(a*a-b*b+reach*reach)/(2*reach),away=Math.sqrt(Math.max(0,a*a-along*along));
    const visual=root.getObjectByName('TravelerVisual')||root,body=visual.getWorldQuaternion(new T.Quaternion());
    const side=upper.name.startsWith('left')?-1:1;
    const pole=new T.Vector3(side*.55,-1,-.12).applyQuaternion(body);
    pole.addScaledVector(direction,-pole.dot(direction));
    if(pole.lengthSq()<1e-8){pole.set(0,0,1).applyQuaternion(body);pole.addScaledVector(direction,-pole.dot(direction));}
    pole.normalize();
    if(work&&away>1e-6){
      // Select a point on the elbow's circle with a low, open elbow. A fixed
      // backward pole raised it into the face; a downward pole buried sleeves
      // in the desk. The arm lengths and wrist contact remain unchanged.
      const vertical=new T.Vector3(0,-1,0);vertical.addScaledVector(direction,-vertical.dot(direction));
      const span=vertical.length();
      if(span>1e-6){
        vertical.divideScalar(span);
        const outward=new T.Vector3(side,0,0).applyQuaternion(body);
        outward.addScaledVector(direction,-outward.dot(direction));outward.addScaledVector(vertical,-outward.dot(vertical));
        if(outward.lengthSq()>1e-8){
          outward.normalize();
          const level=Math.min(shoulder.y,shoulder.y+direction.y*reach)-.015;
          const drop=T.MathUtils.clamp((shoulder.y+direction.y*along-level)/(away*span),-1,1);
          pole.copy(vertical).multiplyScalar(drop).addScaledVector(outward,Math.sqrt(1-drop*drop));
        }
      }
    }
    const nextElbow=shoulder.clone().addScaledVector(direction,along).addScaledVector(pole,away),nextWrist=shoulder.clone().addScaledVector(direction,reach);
    const bend=Math.acos(T.MathUtils.clamp((reach*reach-a*a-b*b)/(2*a*b),-1,1));
    lower.quaternion.copy(lower.userData.reachRest).premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-bend));
    root.updateWorldMatrix(true,true);
    const parent=upper.parent.getWorldQuaternion(new T.Quaternion());
    const turn=(delta)=>upper.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
    const currentElbow=lower.getWorldPosition(new T.Vector3()).sub(shoulder),wantedElbow=nextElbow.clone().sub(shoulder);
    turn(new T.Quaternion().setFromUnitVectors(currentElbow.normalize(),wantedElbow.clone().normalize()));
    root.updateWorldMatrix(true,true);
    const currentWrist=hand.getWorldPosition(new T.Vector3()).sub(nextElbow),wantedWrist=nextWrist.clone().sub(nextElbow),axis=wantedElbow.normalize();
    currentWrist.addScaledVector(axis,-currentWrist.dot(axis)).normalize();wantedWrist.addScaledVector(axis,-wantedWrist.dot(axis)).normalize();
    const twist=Math.atan2(axis.dot(currentWrist.clone().cross(wantedWrist)),currentWrist.dot(wantedWrist));
    turn(new T.Quaternion().setFromAxisAngle(axis,twist));
    root.updateWorldMatrix(true,true);return;
  }
  // Old cached assets without authored elbows retain their original solver.
  for(let i=0;i<iterations;i++)for(const bone of [lower,upper].filter(Boolean)){
    const origin=bone.getWorldPosition(new T.Vector3());
    const from=hand.getWorldPosition(new T.Vector3()).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
    const parent=bone.parent.getWorldQuaternion(new T.Quaternion());
    const delta=new T.Quaternion().setFromUnitVectors(from,to);
    bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
  }
}

export function headSafeTarget(head,target,margin=1.1){
  if(!head)return target;const local=head.worldToLocal(target.clone());
  if(local.length()<margin){local.y=Math.min(local.y,-margin);return head.localToWorld(local);}
  return target;
}

// A held tool shares one grip-to-contact transform in every activity.
export function pointToolAt(tool,parent,grip,contact,length,{scale=true}={}){
 tool.position.copy(parent.worldToLocal(grip.clone()));tool.rotation.set(0,0,0);tool.scale.set(1,1,1);
 if(!contact)return;
 const point=parent.worldToLocal(new T.Vector3(contact.x,contact.y,contact.z)),to=point.sub(tool.position);
 if(to.lengthSq()<1e-8)return;
 tool.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),to.clone().normalize());if(scale)tool.scale.y=to.length()/length;
 return to.length();
}
