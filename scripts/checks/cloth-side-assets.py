"""Blender asset scope, atlas and six-morph preservation for the side repair."""
import sys,json,numpy as np
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from cloth_asset_helpers import snapshot,image_hashes,assert_preserved
import bpy
old,new,outfit,destination=sys.argv[sys.argv.index('--')+1:]
a=snapshot(old);b=snapshot(new)
changed=({'outfit_cardigan','outfit_cardigan_left_sleeve','outfit_cardigan_right_sleeve'} if outfit=='cardigan' else {'outfit_academy_left_side','outfit_academy_right_side'})
count,drift=assert_preserved(a,b,changed)
assert image_hashes(old)==image_hashes(new),'Original atlas bytes changed'
for name in changed:
 assert name in b and set(b[name]['keys'])=={'Basis','height','shoulder','waist','flare','build','head'},name
 for points in b[name]['keys'].values():assert np.isfinite(np.array(points)).all()
# New side panels are body-owned, avoiding both the elbow and hip split.
if outfit=='academy':
 for side in ['left','right']:
  o=bpy.data.objects['outfit_academy_'+side+'_side']
  assert all(len(v.groups)==1 and o.vertex_groups[v.groups[0].group].name=='body' and v.groups[0].weight==1 for v in o.data.vertices)
report={'outfit':outfit,'preservedMeshes':count,'maxDrift':float(drift),'sameAtlasBytes':True}
Path(destination).write_text(json.dumps(report,indent=2));print(report)
