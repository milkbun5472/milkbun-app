// Camera-driven district streaming. Collision/simulation stay in MAPS even while artwork is unloaded.
export function createDistrictStream({chunks=[],loadAsset,attach,detach,dispose,now=()=>Date.now()}){
 const loaded=new Map(),pending=new Map(),failures=new Map();let focus={x:0,z:0},range=0,closed=false;
 const distance=c=>Math.hypot(c.x-focus.x,c.z-focus.z)-c.radius;
 const wanted=c=>distance(c)<=range+5;
 async function load(c){if(closed||loaded.has(c.id)||pending.has(c.id))return pending.get(c.id);const work=(async()=>{try{const root=await loadAsset(c.asset);if(closed||distance(c)>range+11){dispose(root);return;}root.userData=root.userData||{};root.userData.districtId=c.id;attach(root);loaded.set(c.id,root);failures.delete(c.id);}catch(e){failures.set(c.id,now()+5000);throw e;}finally{pending.delete(c.id);}})();pending.set(c.id,work);return work;}
 function update(point,radius){focus={...point};range=radius;for(const c of chunks){const root=loaded.get(c.id);if(root&&distance(c)>range+11){detach(root);dispose(root);loaded.delete(c.id);}}if(closed)return;
  for(const c of chunks.filter(wanted).sort((a,b)=>distance(a)-distance(b))){if(pending.size>=2)break;if(!loaded.has(c.id)&&!pending.has(c.id)&&(failures.get(c.id)||0)<=now())load(c).catch(()=>{});}}
 async function prime(point,radius=7){focus={...point};range=radius;for(const c of chunks.filter(wanted).sort((a,b)=>distance(a)-distance(b)))await load(c);}
 function close(){closed=true;for(const root of loaded.values()){detach(root);dispose(root);}loaded.clear();}
 return {update,prime,close,roots:()=>[...loaded.values()],inspect:()=>({loaded:[...loaded.keys()],pending:[...pending.keys()],failed:[...failures.keys()]})};
}
