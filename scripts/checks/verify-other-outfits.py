"""Asset regression: preserved parts, normalized weights, intact sleeves and idempotence."""
import bpy,bmesh,json,sys,runpy
from pathlib import Path
from mathutils.kdtree import KDTree
sys.path.insert(0,str(Path(__file__).resolve().parent))
from cloth_asset_helpers import snapshot,image_hashes
original,updated,report_path=sys.argv[sys.argv.index('--')+1:]
before=snapshot(original);after=snapshot(updated);ids=['academy','garden','ranger'];changed={'outfit_'+i for i in ids};added={f'outfit_{i}_{side}_sleeve' for i in ids for side in ['left','right']}
footwear={f'outfit_{oid}_shoes_{part}' for oid in ids for part in ('sole','welt','detail','sock')}
assert set(after)==set(before)|added|footwear
report={'preserved':{},'sleeves':{}}
for name,b in before.items():
 if name in changed or any(name.startswith('outfit_'+oid+'_shoes') for oid in ids):continue
 a=after[name];tree=KDTree(len(b['points']))
 for i,p in enumerate(b['points']):tree.insert(p,i)
 tree.balance();err=shape_err=0
 assert set(a['keys'])==set(b['keys'])
 for i,p in enumerate(a['points']):
  _,j,d=tree.find(p);err=max(err,d)
  if a['keys']:
   candidates=tree.find_range(p,max(d+1e-6,.0001))
   delta=min(max(((a['keys'][key][i]-p)-(b['keys'][key][idx]-b['points'][idx])).length for key in a['keys']) for _,idx,_ in candidates)
   shape_err=max(shape_err,delta)
 assert err<.0002 and shape_err<.0002,(name,err,shape_err)
 report['preserved'][name]={'rest':err,'morph':shape_err}
assert image_hashes(original)==image_hashes(updated)
for name in added:
 o=bpy.data.objects[name];bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00004)
 assert not any(len(e.link_faces)>2 for e in bm.edges)
 boundary=[e for e in bm.edges if e.is_boundary]
 assert len(boundary)==40,(name,len(boundary))
 assert all(.43<v.co.z<.56 for e in boundary for v in e.verts)
 assert len(bm.faces)<1500
 assert len(o.data.shape_keys.key_blocks)==7
 report['sleeves'][name]={'faces':len(bm.faces),'innerCuffEdges':len(boundary)};bm.free()
for name in changed:
 o=bpy.data.objects[name]
 for v in o.data.vertices:
  if v.co.z>.4:assert all(o.vertex_groups[g.group].name=='body' or g.weight<1e-6 for g in v.groups)
import numpy as np
shape=runpy.run_path(str(Path(__file__).resolve().parents[2]/'art/fairy-garden/doll/body_shape.py'))['deform']
probe=np.array([[.15,.10,.2999],[.15,.10,.3001]])
delta=shape(probe,np.zeros(2),'flare','garden')
assert np.linalg.norm(delta[1]-delta[0])<.001,'Skirt flare must be continuous through the old cutoff'
garden=bpy.data.objects['outfit_garden']
assert garden.get('cleanDressVersion')==1
for v in garden.data.vertices:
 assert all('arm' not in garden.vertex_groups[g.group].name.lower() or g.weight<1e-6 for g in v.groups), 'Dress must not stretch with either arm bone'
from mathutils import Vector
for side,sign in [('left',-1),('right',1)]:
 sleeve=bpy.data.objects['outfit_garden_'+side+'_sleeve'];axis=Vector((sign*.095,0,-.19)).normalized();start=Vector((sign*.153,0,.655))
 radius=max(((v.co-start)-axis*(v.co-start).dot(axis)).length for v in sleeve.data.vertices)
 assert radius<.06,('garden sleeve still puffy',radius)
 report['sleeves'][sleeve.name]['maxRadius']=radius
shoe=bpy.data.objects['outfit_garden_shoes'];bm=bmesh.new();bm.from_mesh(shoe.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001)
assert shoe.get('weldedShoeVersion')==1
assert all(v.co.z>.10 for e in bm.edges if e.is_boundary for v in e.verts),'Shoe must have no cracks below its rim'
report['shoes']={'boundaryEdges':sum(e.is_boundary for e in bm.edges),'weldedVersion':1};bm.free()
counts={o.name:len(o.data.vertices) for o in bpy.data.objects if o.type=='MESH'}
runpy.run_path(str(Path(__file__).resolve().parents[2]/'art/fairy-garden/doll/restore_other_outfits.py'))['restore_other_outfits']()
assert counts=={o.name:len(o.data.vertices) for o in bpy.data.objects if o.type=='MESH'}
Path(report_path).write_text(json.dumps(report,indent=2));print('PASS preserved meshes/morphs/textures, weights, sleeve topology and idempotence')
