"""Check wrist/cuff overlap, preserved non-target assets, morphs and repeatability."""
import bpy,sys,json,runpy,numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
HERE=Path(__file__).parent
helper=runpy.run_path(str(HERE/'cloth_asset_helpers.py'))
src,out,report=sys.argv[sys.argv.index('--')+1:]
before=helper['snapshot'](src);after=helper['snapshot'](out)
old_images=helper['image_hashes'](src);new_images=helper['image_hashes'](out)
assert all(h in new_images for h in old_images),'source atlases changed'
assert len(new_images)==len(old_images)+1,'one baked hoodie atlas'
assert set(after)-set(before)=={'outfit_ranger_trousers','outfit_ranger_front_accessories'}
max_drift=0
for name,old in before.items():
 if name=='outfit_ranger' or name.endswith('_sleeve'):continue
 new=after[name];tree=KDTree(len(new['points']))
 for i,p in enumerate(new['points']):tree.insert(p,i)
 tree.balance()
 for i,p in enumerate(old['points']):
  # Include every original hand/wrist vertex and morph, with no arm exception.
  _,j,d=tree.find(p);max_drift=max(max_drift,d);assert d<.0002,(name,d)
  candidates=tree.find_range(p,max(d+1e-6,.0001))
  drift=min(max(((old['keys'][key][i]-p)-(new['keys'][key][idx]-new['points'][idx])).length for key in old['keys']) for _,idx,_ in candidates) if old['keys'] else 0
  assert drift<.0002,(name,drift)
# The separated trousers and bag are retained source geometry, not regenerated.
original=before['outfit_ranger'];tree=KDTree(len(original['points']))
for i,p in enumerate(original['points']):tree.insert(p,i)
tree.balance()
for name in ('outfit_ranger_trousers','outfit_ranger_front_accessories'):
 for i,p in enumerate(after[name]['points']):
  _,j,d=tree.find(p);assert d<.0002,(name,d)
  for key in original['keys']:
   assert ((original['keys'][key][j]-original['points'][j])-(after[name]['keys'][key][i]-p)).length<.0003,(name,key)
body=bpy.data.objects['DollBody'];assert body['originalHandVersion']==1 and not body.get('fittedWristVersion')
body.data.calc_loop_triangles();seams=[]
for outfit in ('academy','garden','ranger','cardigan'):
 cloth=bpy.data.objects['outfit_'+outfit];mask=cloth['skinCoverage']['sleeve'][0]
 assert cloth['fittedCuffVersion']==2
 for side,sign in [('left',-1),('right',1)]:
  sleeve=bpy.data.objects['outfit_'+outfit+'_'+side+'_sleeve'];assert sleeve['fittedCuffVersion']==2
  a=Vector((sign*.095,0,-.19)).normalized();start=Vector((sign*.153,0,.655));radii=[];v=a.cross(Vector((0,1,0))).normalized();short=outfit=='garden';center=Vector((0,.01 if sign>0 else .002,0))+v*((-.033 if short else -.025) if sign>0 else (.031 if short else .020))
  for tri in body.data.loop_triangles:
   verts=[body.data.vertices[i] for i in tri.vertices]
   if not all(v.co.x*sign>.12 and sum(g.weight for g in v.groups if body.vertex_groups[g.group].name.endswith(('Arm','Forearm')))>.5 for v in verts):continue
   for i in range(3):
    p,q=verts[i].co,verts[(i+1)%3].co;t0=(p-start).dot(a);t1=(q-start).dot(a)
    if (t0-mask)*(t1-mask)<0:
     cross=p.lerp(q,(mask-t0)/(t1-t0));rad=cross-start-a*mask-center;radii.append(rad.length)
  cuff_radius=min((v.co-start-a*(v.co-start).dot(a)-center).length for v in sleeve.data.vertices if abs((v.co-start).dot(a)-mask)<.012)
  assert radii and max(radii)<cuff_radius+.002,(outfit,side,max(radii,default=0),cuff_radius)
  seams.append({'outfit':outfit,'side':side,'skinRadius':max(radii),'sleeveRadius':cuff_radius})
for o in bpy.data.objects:
 if o.type!='MESH' or not o.data.shape_keys:continue
 assert all(k.value==0 for k in o.data.shape_keys.key_blocks[1:])
for name in ('outfit_ranger','outfit_ranger_front_accessories'):
 o=bpy.data.objects[name]
 assert all(sum(g.weight for g in v.groups if o.vertex_groups[g.group].name.endswith(('Arm','Forearm')))<.0001 for v in o.data.vertices),'upper cloth follows torso'
positions={o.name:np.array([v.co[:] for v in o.data.vertices]) for o in bpy.data.objects if o.type=='MESH'}
root=Path('art/fairy-garden/doll').resolve()
runpy.run_path(str(root/'restore_other_outfits.py'))['restore_other_outfits']()
assert set(positions)=={o.name for o in bpy.data.objects if o.type=='MESH'}
for name,p in positions.items():assert np.array_equal(p,np.array([v.co[:] for v in bpy.data.objects[name].data.vertices])),name
result={'preservedMeshDrift':max_drift,'originalAtlasesPreserved':len(old_images),'newAtlas':1,'cuffOverlap':seams,'morphDefaults':0,'idempotent':True}
Path(report).write_text(json.dumps(result,indent=2));print(json.dumps(result))
