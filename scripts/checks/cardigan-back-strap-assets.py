"""Check the rabbit strap's real rear coverage, clearance and original clothing.
Blender -b --python this.py -- before.glb after.glb report.json
"""
import bpy, json, sys, runpy, itertools, numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).parent))
from cloth_asset_helpers import snapshot,image_hashes,assert_preserved,flipped_areas
before,after,destination=sys.argv[sys.argv.index('--')+1:]
repo=Path(__file__).resolve().parents[2];name='outfit_cardigan_back_strap'
a=snapshot(before);b=snapshot(after)
assert name in b,'The whole rear strap is missing'
assert set(b)==set(a)|{name},'Only one bag continuation may be added'
preserved,drift=assert_preserved(a,{k:v for k,v in b.items() if k!=name},set())
assert image_hashes(before)==image_hashes(after),'Keep the original embedded atlas'
o=bpy.data.objects[name];cloth=bpy.data.objects['outfit_cardigan']
assert all(len(v.groups)==1 and o.vertex_groups[v.groups[0].group].name=='body' and v.groups[0].weight==1 for v in o.data.vertices)
assert not o.get('repairKnit'),'Do not paint knit over the cream bag band'
assert set(b[name]['keys'])=={'Basis','height','shoulder','waist','flare','build','head'}
catalog=json.loads((repo/'apps/fairy-garden/doll.json').read_text());folds=flipped_areas(o,catalog)
assert max(folds)<1e-7,('Ribbon folds',float(max(folds)))
C=np.array([v.co[:] for v in cloth.data.shape_keys.key_blocks['Basis'].data]);P=np.array([v.co[:] for v in o.data.shape_keys.key_blocks['Basis'].data])
rear=np.flatnonzero((P[:,1]>.06)&(P[:,2]>.475)&(P[:,2]<.65))
assert len(rear)>300
assert P[rear,2].max()-P[rear,2].min()>.165,'The check must span the entire back band'
cloth.data.calc_loop_triangles();tri=[tuple(t.vertices) for t in cloth.data.loop_triangles]
checks=[]
for values in itertools.product((0,1),repeat=6):
 cp=C.copy();sp=P.copy()
 for dim,high in zip(catalog['dims'],values):
  key=dim['key'];weight=dim['max' if high else 'min']-1
  cp+=(np.array([v.co[:] for v in cloth.data.shape_keys.key_blocks[key].data])-C)*weight
  sp+=(np.array([v.co[:] for v in o.data.shape_keys.key_blocks[key].data])-P)*weight
 tree=BVHTree.FromPolygons(cp.tolist(),tri,all_triangles=True);clearance=[]
 for i in rear:
  x,y,z=sp[i];hit=tree.ray_cast(Vector((x,1,z)),Vector((0,-1,0)),2)[0]
  assert hit is not None,('Missing cloth behind strap',values,int(i))
  clearance.append(y-hit.y)
 checks.append({'body':values,'minClearance':float(min(clearance)),'maxClearance':float(max(clearance))})
 assert min(clearance)>.0001,('Cloth hides the back strap',checks[-1])
 assert max(clearance)<.022,('Strap floats away from clothing',checks[-1])
old_count=len(bpy.data.objects);restore=runpy.run_path(str(repo/'art/fairy-garden/doll/restore_cardigan_strap.py'))['restore_cardigan_strap'];restore(cloth)
assert len(bpy.data.objects)==old_count,'Rebuild must not duplicate the band'
result={'preservedMeshesAllMorphs':preserved,'maxDrift':drift,'sameAtlasBytes':True,'rearVertexSamples':len(rear),'bodyEndpointCombinations':checks,'maxFoldedArea':float(max(folds)),'idempotent':True}
Path(destination).write_text(json.dumps(result,indent=2));print(json.dumps(result))
