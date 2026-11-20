// The collar and inner yoke are pinned in each authored fit. The sleeve
// samples are offsets from material points on the complete posed arm.
export function createOutwardSleeve(T, chart, cloth, welded, bodyPositions, armInfluence) {
 if (!chart) return null;
 const rows = new Map(chart.groups.map((group, row) => [group, row]));
 const sides = [[], []];
 const axis=new T.Vector3(),radial=new T.Vector3();
 const guides=cloth.row.sleeveSectionGuides;
 const rootSections=guides.map(g=>new T.Vector3(...g.sections[3].center));
 const directions=guides.map((g,s)=>new T.Vector3(...g.sections[6].center).sub(rootSections[s]).normalize());
 const clamp = x => Math.max(0, Math.min(1, x));
 const smooth = x => { const t = clamp(x); return t*t*(3-2*t); };
 for (const vertex of cloth.ids) {
  const row = rows.get(welded[vertex]);
  if (row === undefined) continue;
  const side=cloth.row.rest[3*vertex]<0?0:1;
  radial.fromArray(cloth.row.rest,3*vertex).sub(rootSections[side]);
  const along=radial.dot(directions[side]);
  radial.addScaledVector(directions[side],-along).normalize();
  const medial=radial.x*(side?-1:1);
  const gusset=smooth((medial-.1)/.55)*smooth((along+.15)/.045)*smooth((.018-along)/.07);
  sides[side].push({vertex,row,gusset});
 }
 // A section through the moving arm gives the inside sleeve its clearance.
 // Use overlapping axial supports so a sample entering a slice cannot pop
 // the garment as the upper arm rolls. The collar is outside this region.
 const ringCount=32, rays=24, step=.009, origin=16;
 const cos=Array.from({length:rays},(_,i)=>Math.cos(i*2*Math.PI/rays));
 const sin=Array.from({length:rays},(_,i)=>Math.sin(i*2*Math.PI/rays));
 const support=new Float64Array(ringCount*rays), front=new T.Vector3(), across=new T.Vector3();
 const bodyIds=[[],[]];
 for(let id=0;id<armInfluence.length;id++){
  if(armInfluence[id]>.4)bodyIds[bodyPositions[id*3]<0?0:1].push(id);
 }
 function fitSections(body,side){
  support.fill(0);front.copy(centers[2]).addScaledVector(axis,-centers[2].dot(axis)).normalize();
  across.crossVectors(axis,front);
  for(const id of bodyIds[side]){
   radial.fromArray(body,3*id).sub(centers[0]);
   const at=radial.dot(axis),x=radial.dot(front),y=radial.dot(across);
   const slice=at/step+origin,lo=Math.max(0,Math.ceil(slice-5)),hi=Math.min(ringCount-1,Math.floor(slice+5));
   for(let j=lo;j<=hi;j++){
    const penalty=Math.max(0,Math.abs(slice-j)*step-.006)*3.5;
    for(let k=0;k<rays;k++){
     const index=j*rays+k;
     support[index]=Math.max(support[index],x*cos[k]+y*sin[k]-penalty);
    }
   }
  }
 }
 function coverArm(position,amount,gusset){
  radial.copy(position).sub(centers[0]);
  const at=radial.dot(axis);radial.addScaledVector(axis,-at);
  const radius=radial.length();
  if(radius<.0001)return;
  radial.multiplyScalar(1/radius);
  const x=radial.dot(front),y=radial.dot(across),slice=clamp((at/step+origin)/(ringCount-1))*(ringCount-1);
  const j=Math.min(ringCount-2,Math.floor(slice)),mix=slice-j;
  let boundary=Infinity;
  for(let k=0;k<rays;k++){
   const facing=x*cos[k]+y*sin[k];if(facing<=.3)continue;
   const lo=support[j*rays+k],hi=support[(j+1)*rays+k];
   boundary=Math.min(boundary,(lo+(hi-lo)*mix)/facing);
  }
  const shaft=smooth((at+.15)/.05)*smooth((.105-at)/.055);
  const allowance=.006+.008*gusset;
  const push=Math.max(0,boundary+allowance-radius);
  position.addScaledVector(radial,push*shaft*amount);
 }
 const samples = chart.samples;
 const states = [{amount:0}, {amount:0}];
 const centers = Array.from({length:4}, () => new T.Vector3());
 const sourceBasis = new T.Matrix3(), armBasis = new T.Matrix3();
 const linear = new T.Matrix3();
 const point = new T.Vector3(), delta = new T.Vector3(), scratch = new T.Vector3();
 function update(features, elbowBlend, actionBlend) {
  for (let side=0; side<2; side++) {
   const state = states[side], k = 6*side, pitch = -features[k];
   const start = (pitch-samples[0].pitch)/(samples[1].pitch-samples[0].pitch);
   state.amount = actionBlend * smooth(start) * (1-elbowBlend[side]);
   if (!state.amount) continue;
   let j = 0;
   while (j < samples.length-2 && samples[j+1].pitch < pitch) j++;
   const low = samples[j], high = samples[j+1];
   const mix = clamp((pitch-low.pitch)/(high.pitch-low.pitch));
   // Fade on interruption if the arm turns away from the measured lift plane.
   const sign = side ? -1 : 1;
   const deviation = Math.hypot(...low.lateral.map((value, n) =>
    sign*features[k+n+1] - (value+(high.lateral[n]-value)*mix)));
   Object.assign(state, {low, high, mix, amount:state.amount*(1-smooth((deviation-.15)/.4))});
  }
 }
 function apply(body, positions) {
  if(!states.some(state=>state.amount))return;
  for (let side=0; side<2; side++) {
   const {amount, low, high, mix} = states[side];
   if (!amount) continue;
   for (const [i, group] of chart.guides[side].entries()) {
    centers[i].set(0,0,0);
    for (const id of group) centers[i].add(scratch.fromArray(body,3*id));
    centers[i].multiplyScalar(1/group.length);
   }
   for (let i=0; i<3; i++) centers[i+1].sub(centers[0]).toArray(armBasis.elements,3*i);
   for (let i=0; i<9; i++) sourceBasis.elements[i]=low.bases[side][i]+(high.bases[side][i]-low.bases[side][i])*mix;
   linear.multiplyMatrices(armBasis,sourceBasis.invert());
   axis.copy(centers[1]).normalize();fitSections(body,side);
   for (const {vertex, row, gusset} of sides[side]) {
    const k = 3*row;
    const w1 = chart.bary[2*row]/65535, w2 = chart.bary[2*row+1]/65535;
    point.fromArray(body, 3*chart.body[k]).multiplyScalar(1-w1-w2);
    point.addScaledVector(scratch.fromArray(body, 3*chart.body[k+1]), w1);
    point.addScaledVector(scratch.fromArray(body, 3*chart.body[k+2]), w2);
    delta.fromArray(low.offset, k).lerp(scratch.fromArray(high.offset, k), mix);
    point.add(delta.applyMatrix3(linear));
    scratch.fromArray(positions, 3*vertex).lerp(point, amount);
    coverArm(scratch,amount,gusset);
    scratch.toArray(positions,3*vertex);
   }
  }
 }
 return {update, apply};
}
