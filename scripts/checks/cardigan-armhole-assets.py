"""Verify real cardigan surfaces, morph extremes and unchanged accessories.
Blender -b --python cardigan-armhole-assets.py -- before.glb after.glb report.json
"""
import json, runpy, sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
sys.path.insert(0,str(Path(__file__).parent))
from cloth_asset_helpers import snapshot,image_hashes,assert_preserved,flipped_areas
before,after,destination=sys.argv[sys.argv.index('--')+1:]
repo=Path(__file__).resolve().parents[2]
catalog=json.loads((repo/'apps/fairy-garden/doll.json').read_text())
old=snapshot(before);old_obj=bpy.data.objects['outfit_cardigan'];old_folds=flipped_areas(old_obj,catalog)
# Accessory vertices are selected from the original cream atlas, including the
# shoulder strap's back end; they must stay fixed in every body morph.
image=next(n.image for n in old_obj.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
W,H=image.size;tex=np.array(image.pixels[:]).reshape(H,W,4)[:,:,:3]**(1/2.2);uv=old_obj.data.uv_layers.active.data;accessories=set()
for face in old_obj.data.polygons:
 c=face.center
 if not((c.y>0 and c.z>.62) or (0<c.x<.23 and c.y<-.035 and .35<c.z<.58)):continue
 colors=[tex[min(H-1,max(0,int(uv[li].uv.y*H))),min(W-1,max(0,int(uv[li].uv.x*W)))] for li in face.loop_indices];r,g,b=np.median(colors,axis=0)
 if (g-b)>max(r-g,.005)*.32:accessories.update(face.vertices)
assert len(accessories)>20
new=snapshot(after);obj=bpy.data.objects['outfit_cardigan'];new_folds=flipped_areas(obj,catalog)
count,drift=assert_preserved(old,new,{'outfit_cardigan'})
assert image_hashes(before)==image_hashes(after),'Atlas bytes changed'
assert set(new['outfit_cardigan']['keys'])=={'Basis','height','shoulder','waist','flare','build','head'}
assert np.max(new_folds-old_folds)<.0001,'A body endpoint added folded surface area'
# A rear sleeve remnant rises again after the underarm valley. Sample actual
# triangles; the historical GLB must fail this independently of its metadata.
P=[v.co[:] for v in obj.data.vertices]
tree=BVHTree.FromPolygons(P,[f.vertices[:] for f in obj.data.polygons])
sections=[]
for sign in (-1,1):
 for z in (.51,.54,.57,.60,.63,.65):
  ys=[]
  for x in (.09,.10,.11,.12,.13,.14,.144):
   hit=tree.ray_cast(Vector((sign*x,1,z)),Vector((0,-1,0)),2)[0]
   assert hit is not None,('Missing back',sign,x,z)
   ys.append(hit.y)
  assert max(np.diff(ys))<.001,('Back sleeve bulge',sign,z,ys)
  sections.append({'side':sign,'height':z,'depths':ys})
# Preserve the rounded spine, front pouch, collar and ribbing in all six morphs.
a,b=old['outfit_cardigan'],new['outfit_cardigan'];lookup=KDTree(len(b['points']))
for i,p in enumerate(b['points']):lookup.insert(p,i)
lookup.balance();protected=0
for i,p in enumerate(a['points']):
 x,y,z=p
 if not(i in accessories or y<=-.11 or abs(x)<=.072 or z<=.405 or z>=.715):continue
 matches=lookup.find_range(p,1e-5)
 assert any(all(np.max(np.abs(np.array(a['keys'][k][i])-np.array(b['keys'][k][j])))<1e-5 for k in a['keys']) for _,j,_ in matches),('Protected garment region moved',p)
 protected+=1
assert protected>1000
# A source rebuild of a deployed asset must be a no-op, including normals.
fit=runpy.run_path(str(repo/'art/fairy-garden/doll/fit_cloth_sides.py'))['fit_cardigan']
points={k.name:np.array([v.co[:] for v in k.data]) for k in obj.data.shape_keys.key_blocks}
normals=np.array([n.vector[:] for n in obj.data.corner_normals]);fit(obj)
for key in obj.data.shape_keys.key_blocks:np.testing.assert_array_equal(points[key.name],[v.co[:] for v in key.data])
np.testing.assert_array_equal(normals,[n.vector[:] for n in obj.data.corner_normals])
assert obj['armholeSurfaceVersion']==1
report={'sections':sections,'preservedMeshes':count,'maxDrift':drift,'sameAtlasBytes':True,'protectedVerticesAllMorphs':protected,'accessoryVerticesAllMorphs':len(accessories),'bodyEndpointCombinations':len(new_folds),'maxAdditionalFlippedArea':float(np.max(new_folds-old_folds)),'idempotent':True}
Path(destination).write_text(json.dumps(report,indent=2));print(json.dumps(report))
