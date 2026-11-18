// Authoring metadata edits only face ownership. All source vertex, skin, UV and
// morph channels retain their original indices, including across material seams.
export function applyOutfitMeshEdits(scene,edits){
 if(!edits)return scene;
 const find=row=>{const mesh=scene.getObjectByName(row.name),g=mesh?.geometry;
  if(!mesh?.isSkinnedMesh||g.attributes.position.count!==row.vertices||g.index?.count!==row.triangles*3)throw Error('Outfit face edit source mismatch: '+row.name);
  const faces=new Set(row.faces);if(faces.size!==row.faces.length||row.faces.some(i=>!Number.isInteger(i)||i<0||i>=row.triangles))throw Error('Invalid outfit face ownership');
  const keep=[],take=[],indices=g.index.array;for(let i=0;i<row.triangles;i++)(faces.has(i)?take:keep).push(indices[i*3],indices[i*3+1],indices[i*3+2]);
  return {mesh,keep,take};
 };
 for(const row of edits.removeFaces||[]){const {mesh,keep}=find(row);mesh.geometry=mesh.geometry.clone();mesh.geometry.setIndex(keep);}
 for(const row of edits.splitFaces||[]){const {mesh,keep,take}=find(row);
  if(scene.getObjectByName(row.target)||!take.length||!row.colorSlot)throw Error('Invalid outfit material split');
  const part=mesh.clone();part.name=row.target;part.geometry=mesh.geometry.clone();part.geometry.setIndex(take);part.material=mesh.material.clone();part.userData={...mesh.userData,colorSlot:row.colorSlot};
  mesh.geometry=mesh.geometry.clone();mesh.geometry.setIndex(keep);mesh.parent.add(part);
 }
 return scene;
}
