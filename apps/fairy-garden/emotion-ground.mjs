import * as T from 'three';
// 侧躺／趴下以真正的可见衣装、头发和蒙皮外轮廓落地；不用站姿脚底常数。
export function settleEmotionGround(root,model,amount){
 root.userData.emotionGround=null;if(!amount)return;
 root.updateMatrixWorld(true);const bounds=new T.Box3();
 model.traverseVisible(o=>{if(o.isMesh&&!o.userData.followBone)bounds.expandByObject(o,true);});
 if(bounds.isEmpty())return;
 const shift=bounds.min.y<0?-bounds.min.y:-bounds.min.y*amount,center=bounds.getCenter(new T.Vector3());root.position.y+=shift;model.position.x-=root.worldToLocal(center).x*amount;
 root.updateMatrixWorld(true);root.userData.emotionGround={bottom:bounds.min.y+shift,shift,amount};
}
