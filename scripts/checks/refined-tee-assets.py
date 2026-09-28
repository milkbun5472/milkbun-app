"""Check tee-only scope, retained denim, body endpoints and repeatable authoring."""
import sys,json,runpy,numpy as np
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from cloth_asset_helpers import snapshot,assert_preserved,flipped_areas,image_hashes
from mathutils.kdtree import KDTree
import bpy
before,after,out=sys.argv[sys.argv.index('--')+1:]
a=snapshot(before);b=snapshot(after)
changed={'outfit_tee','outfit_tee_cotton','outfit_tee_footwear'}
count,drift=assert_preserved(a,b,changed)
# Pocket and leg detail below the waistband and above the footwear overlap survives.
tree=KDTree(len(b['outfit_tee']['points']))
for i,p in enumerate(b['outfit_tee']['points']):tree.insert(p,i)
tree.balance();retained=0;denimDrift=0
for p in a['outfit_tee']['points']:
 if .16<p.z<.28:
  error=tree.find(p)[2];denimDrift=max(denimDrift,error)
  assert error<5e-5,(p,error);retained+=1
catalog=json.loads((Path(__file__).parents[2]/'apps/fairy-garden/doll.json').read_text())
cloth=bpy.data.objects['outfit_tee_cotton'];flips=flipped_areas(cloth,catalog)
assert max(flips)<1e-7,flips.tolist()
assert all(abs(k.value)<1e-8 for k in list(cloth.data.shape_keys.key_blocks)[1:])
assert bpy.data.objects['outfit_tee'].get('refinedTeeVersion')==1
state={o.name:[v.co[:] for v in o.data.vertices] for o in bpy.data.objects if o.type=='MESH'}
runpy.run_path(str(Path(__file__).parents[2]/'art/fairy-garden/doll/refine_tee.py'))['refine_tee']()
assert state=={o.name:[v.co[:] for v in o.data.vertices] for o in bpy.data.objects if o.type=='MESH'}
# Unrelated embedded textures are unchanged; the two old tee side-patch atlases may disappear.
old=image_hashes(before);new=image_hashes(after);assert len(set(old)-set(new))<=2
result={'unchangedMeshes':count,'maximumDrift':drift,'retainedDenimVertices':retained,'denimDrift':denimDrift,'cottonMorphEndpoints':len(flips),'maximumFlippedArea':float(max(flips)),'idempotent':True}
Path(out).write_text(json.dumps(result,indent=2));print(result)
