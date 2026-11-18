// Animation and render can request the same deformation. Cache only an exact
// unchanged local pose; camera/root placement does not alter local geometry.
export function createCachedMotionUpdate(context,update){
 const body=context.body;let last=null,lastCurve=null;
 function key(){
  const values=[body.geometry.id,body.geometry.attributes.position.version,body.geometry.attributes.normal.version,body.skeleton.id||0,context.bindingGeneration||0];
  for(const bone of body.skeleton.bones)values.push(...bone.position.toArray(),...bone.quaternion.toArray(),...bone.scale.toArray());
  for(const inverse of body.skeleton.boneInverses)values.push(...inverse.elements);
  values.push(...body.bindMatrix.elements,...(body.morphTargetInfluences||[]));if(body.bindMode!=='attached')values.push(...body.bindMatrixInverse.elements);return values;
 }
 function apply(){
  const current=key();
  if(last&&current.length===last.length&&current.every((v,i)=>v===last[i])){
   context.poseCurveCurrent=lastCurve;context.motionCacheHits=(context.motionCacheHits||0)+1;return;
  }
  update();last=key();lastCurve=context.poseCurveCurrent;
 }
 apply.invalidate=()=>{last=null;lastCurve=null;};return apply;
}
