import * as T from 'three';
// 躺下／趴下以真正的可见衣装、头发和蒙皮外轮廓落地；不用站姿脚底常数。
export function settleEmotionGround(root,model,amount){
 root.userData.emotionGround=null;if(!amount)return;
 root.updateMatrixWorld(true);const bounds=new T.Box3();
 model.traverseVisible(o=>{if(!o.isMesh||o.userData.followBone)return;
  for(let p=o;p&&p!==model;p=p.parent)if(p.name.startsWith('Companion'))return;
  bounds.expandByObject(o,true);
 });
 if(bounds.isEmpty())return;
 const shift=bounds.min.y<0?-bounds.min.y:-bounds.min.y*amount,center=bounds.getCenter(new T.Vector3());root.position.y+=shift;const local=root.worldToLocal(center);model.position.x-=local.x*amount;model.position.z-=local.z*amount;
 root.updateMatrixWorld(true);root.userData.emotionGround={bottom:bounds.min.y+shift,shift,amount};
}

// Keep a low resting pose and its face visible in both companion view sizes.
export function emotionCameraFrame(mid,dist,amount=0,canopy=0){
 const a=T.MathUtils.clamp(amount,0,1),u=T.MathUtils.clamp(canopy,0,1);return {position:[0,mid+.05+.95*a+.08*u,dist+.45*u],target:[0,mid-.3*a+.08*u,0]};
}
