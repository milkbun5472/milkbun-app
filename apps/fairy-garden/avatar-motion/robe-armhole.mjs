// Distribute the change of direction across the front armhole. Use nearby
// points on the original cloth so duplicated seam vertices share a field.
export function bindRobeArmhole(q, {o,row,ids}, cuffs) {
 const T=q.T, step=.019, cells=new Map(), points=[];
 const smooth=x=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};
 const vector=()=>new T.Vector3();
 for(let i=0;i<row.rest.length/3;i++){
  const rest=vector().fromArray(row.rest,3*i),side=Number(rest.x>0);
  const shoulder=q.rigFit[side].shoulder;
  const x=Math.abs(rest.x-shoulder[0]),y=rest.y-shoulder[1];
  if(x>.22||y<-.285||y>.13)continue;
  const key=[rest.x,rest.y,rest.z].map(k=>Math.floor(k/step)).join(',');
  if(!cells.has(key))cells.set(key,{center:vector(),delta:vector(),count:0});
  const cell=cells.get(key);
  cell.center.add(rest);cell.count++;
  const cuff=cuffs[side],depth=cuff.normal.reduce((sum,n,k)=>sum+n*(cuff.center[k]-row.rest[3*i+k]),0);
  const outerShoulder=smooth((Math.abs(rest.x)-Math.abs(shoulder[0])+.049)/.030);
  const mask=outerShoulder*smooth((.086-x)/.038)*smooth((y+.14)/.066)*smooth((depth-.07)/.055);
  // Below the shoulder the robe changes from a body panel to a sleeve.
  // The intervening fold is supported at the armpit, above the belt.
  const pit=smooth((depth-.006)/.080)*smooth((.075-y)/.090)*smooth((y+.285)/.055);
  points.push({i,side,rest,cell,mask,pit,posed:vector(),neighbors:[]});
 }
 for(const cell of cells.values())cell.center.divideScalar(cell.count);
 for(const p of points)if(p.mask){
  let sum=0;
  for(const cell of cells.values()){
   const d=p.rest.distanceToSquared(cell.center)/(.060**2);
   if(d>=1)continue;
   const w=(1-d)**2;p.neighbors.push({cell,w});sum+=w;
  }
  for(const n of p.neighbors)n.w/=sum;
 }
 const delta=vector(),skin=new T.Matrix3(),matrix=new T.Matrix4();
 const attr=o.geometry.attributes;
 const transported=new Set(ids);
 const front=points.filter(p=>(p.mask||p.pit)&&!transported.has(p.i));
 for(const p of front)p.authored=vector().fromBufferAttribute(attr.position,p.i);
 let applied=false;
 function restore(){
  if(!applied)return;
  for(const {i,authored:v} of front)attr.position.setXYZ(i,v.x,v.y,v.z);
  attr.position.needsUpdate=true;applied=false;
 }
 const target=vector(),toCloth=new T.Matrix4(),toTorso=new T.Matrix4();
 function fit(lift,frames){
  if(!lift.some(v=>v>0))return;
  applied=true;
  toCloth.copy(o.matrixWorld).invert().multiply(q.body.matrixWorld).multiply(frames[0]);
  toTorso.copy(toCloth).invert();
  const bones=o.skeleton.bones.map((_,i)=>new T.Matrix3().setFromMatrix4(matrix.fromArray(o.skeleton.boneMatrices,16*i).premultiply(o.bindMatrixInverse).multiply(o.bindMatrix)));
  for(const cell of cells.values())cell.delta.set(0,0,0);
  for(const p of points){
   o.getVertexPosition(p.i,p.posed);
   p.cell.delta.add(delta.copy(p.posed).sub(p.rest));
  }
  for(const cell of cells.values())cell.delta.divideScalar(cell.count);
  for(const p of points){
   const amount=p.mask*lift[p.side],pit=p.pit*lift[p.side];if(!amount&&!pit)continue;
   delta.copy(p.rest).sub(p.posed);
   for(const n of p.neighbors){
    delta.addScaledVector(n.cell.delta,n.w);
    delta.addScaledVector(n.cell.center,n.w*.70).addScaledVector(p.rest,-n.w*.70);
   }
   delta.clampLength(0,.032).multiplyScalar(amount);
   if(pit){
    const shoulder=q.rigFit[p.side].shoulder;
    target.copy(p.posed).applyMatrix4(toTorso);
    const outside=Math.abs(target.x)-Math.abs(shoulder[0]);
    const low=shoulder[1]-target.y;
    // Pull the lower side panel toward the rib cage. Farther out,
    // the sleeve underside rises, leaving a hollow between the two.
    const lower=smooth((low+.025)/.135)*(1-smooth((low-.19)/.07));
    const sidePanel=smooth((outside+.025)/.065)*(1-smooth((outside-.035)/.10));
    // Fade into the front and rear faces so the lifted underside
    // does not stamp a horizontal edge across the visible sleeve.
    const inner=1-.55*smooth((Math.abs(target.z-shoulder[2])-.024)/.060);
    // Ease the change in sleeve height over a wider strip. Keep the
    // body's side seam anchored while the cloth turns under the upper arm.
    const sleeveLift=smooth((outside+.026)/.114)*(1-smooth((outside-.080)/.16));
    target.y+=.058*sleeveLift*lower*inner;
    target.x-=Math.sign(target.x)*.022*sidePanel*lower*inner;
    // Fold surplus side cloth against the ribs above the belt. Limit the
    // pull by the distance to the torso so the front overlap stays full.
    const rib=Math.abs(shoulder[0])*.92;
    const surplus=Math.max(0,Math.abs(target.x)-rib);
    const waistFold=smooth((low-.100)/.072)*(1-smooth((low-.165)/.070));
    const underSleeve=1-smooth((outside-.048)/.090);
    const sideCloth=1-smooth((Math.abs(p.rest.x)-Math.abs(shoulder[0])-.012)/.058);
    // Let the tucked side cloth open back out as it enters the sash.
    const aboveSash=smooth((target.y-.461)/.038);
    target.x-=sideCloth*Math.sign(target.x)*.055*Math.tanh(surplus/.065)*waistFold*underSleeve*aboveSash;
    delta.addScaledVector(target.applyMatrix4(toCloth).sub(p.posed),pit);
   }
   skin.elements.fill(0);
   for(let k=0;k<4;k++){
    const w=attr.skinWeight.getComponent(p.i,k);if(!w)continue;
    const e=bones[attr.skinIndex.getComponent(p.i,k)].elements;
    for(let j=0;j<9;j++)skin.elements[j]+=w*e[j];
   }
   if(Math.abs(skin.determinant())<1e-8)continue;
   delta.applyMatrix3(skin.invert()).add(p.posed.fromBufferAttribute(attr.position,p.i));
   attr.position.setXYZ(p.i,delta.x,delta.y,delta.z);
  }
  attr.position.needsUpdate=true;
 }
 return {restore,fit};
}
