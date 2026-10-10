import * as T from 'three';

// Shared world-space contact solver for the authored two-bone arm.
export function reachHand(root,upper,lower,hand,target,iterations=16){
  if(!upper||!hand||!target)return;
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
export function pointToolAt(tool,parent,grip,contact,length){
 tool.position.copy(parent.worldToLocal(grip.clone()));tool.rotation.set(0,0,0);tool.scale.set(1,1,1);
 if(!contact)return;
 const point=parent.worldToLocal(new T.Vector3(contact.x,contact.y,contact.z)),to=point.sub(tool.position);
 if(to.lengthSq()<1e-8)return;
 tool.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),to.clone().normalize());tool.scale.y=to.length()/length;
}
