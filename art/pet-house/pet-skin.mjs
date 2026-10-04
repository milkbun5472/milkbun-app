const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
// The curled tips cross back into the old torso mask. Transfer only that
// residual torso influence to their already authored tail controls. Leave
// the root blend, rigid skull, ears and every leg weight intact.
export function restingTailWeights(names,weights,height){
 const total=weights.reduce((n,w,i)=>n+(names[i]?.startsWith('tail')?w:0),0);
 if(total<.05)return [...weights];const blend=smooth((height-.43)/.13)*smooth((total-.05)/.2);
 const residual=weights.reduce((n,w,i)=>n+(['chest','pelvis'].includes(names[i])?w*blend:0),0);
 return weights.map((w,i)=>names[i]?.startsWith('tail')?w+residual*w/total:['chest','pelvis'].includes(names[i])?w*(1-blend):w);
}
export function kittenBackWeights(point,names,weights){
 const [,y,z]=point,blend=smooth((.575-y)/.085)*smooth((-z-.015)/.075);
 const head=names.indexOf('head'),moved=(weights[head]||0)*blend;if(!moved)return names.map((name,i)=>[name,weights[i]]);
 const result=new Map(names.map((name,i)=>[name,weights[i]]));result.set('head',(result.get('head')||0)-moved);
 const pelvis=smooth((.08-z)/.37);result.set('chest',(result.get('chest')||0)+moved*(1-pelvis));result.set('pelvis',(result.get('pelvis')||0)+moved*pelvis);
 const row=[...result].sort((a,b)=>b[1]-a[1]).slice(0,4),total=row.reduce((n,p)=>n+p[1],0);return row.map(([name,w])=>[name,w/total]);
}
export function softCrotchWeights(point,names,weights){
 const [x,y,z]=point;if(y>=.335)return names.map((n,i)=>[n,weights[i]]);
 const row=new Map(),protectedWeight=weights.reduce((sum,w,i)=>{if(['head','earL','earR'].includes(names[i])||names[i]?.startsWith('tail')){row.set(names[i],(row.get(names[i])||0)+w);return sum+w;}return sum;},0);
 const remaining=Math.max(0,1-protectedWeight),side=x<0?'L':'R',crotch=smooth((y-.085)/.070),outer=smooth((Math.abs(x)-.065)/.055),limb=smooth((.335-y)/.105)*(1-crotch*(1-outer));
 const front=1-smooth((.06-z)/.14),back=smooth((-z-.08)/.12),paw=1-smooth((y-.072)/.064),upper=smooth((y-.155)/.10)*(1-paw),lower=1-paw-upper;
 for(const[kind,part]of [['front',front],['back',back]])for(const[suffix,w]of [['Upper',upper],['Lower',lower],['Paw',paw]])row.set(kind+side+suffix,remaining*limb*part*w);
 const torso=remaining*(1-limb*(front+back)),pelvis=smooth((.08-z)/.37);row.set('chest',torso*(1-pelvis));row.set('pelvis',torso*pelvis);
 const sorted=[...row].sort((a,b)=>b[1]-a[1]).slice(0,4),total=sorted.reduce((n,p)=>n+p[1],0);return sorted.map(([n,w])=>[n,w/total]);
}
export function repairPetSkin(model,species){
 model.traverse(o=>{if(!o.isSkinnedMesh)return;const {position,skinIndex,skinWeight}=o.geometry.attributes,indices=new Map(o.skeleton.bones.map((b,i)=>[b.name,i]));
  for(let i=0;i<position.count;i++){
   const names=Array.from({length:4},(_,j)=>o.skeleton.bones[skinIndex.getComponent(i,j)]?.name),weights=Array.from({length:4},(_,j)=>skinWeight.getComponent(i,j));
   const point=[position.getX(i),position.getY(i),position.getZ(i)],tail=restingTailWeights(names,weights,point[1]),back=species==='cat'?kittenBackWeights(point,names,tail):names.map((n,j)=>[n,tail[j]]);
   const row=softCrotchWeights(point,back.map(p=>p[0]),back.map(p=>p[1]));
   for(let j=0;j<4;j++){skinIndex.setComponent(i,j,indices.get(row[j]?.[0])||0);skinWeight.setComponent(i,j,row[j]?.[1]||0);}
  }skinIndex.needsUpdate=true;skinWeight.needsUpdate=true;
 });
}
