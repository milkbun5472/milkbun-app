"""Blender QA: compare rest geometry/morph offsets to the pre-migration GLB.
Usage: Blender --background --python verify-footwear-asset.py -- before.glb after.glb report.json
Also verifies texture byte identity and footwear leg weights.
"""
import bpy, json, sys, struct, hashlib
from mathutils.kdtree import KDTree
from pathlib import Path

def snapshot(path):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=path)
 result={}
 for o in bpy.data.objects:
  if o.type!='MESH':continue
  result[o.name]={'points':[o.matrix_world @ v.co for v in o.data.vertices], 'keys':{k.name:[o.matrix_world @ v.co for v in k.data] for k in o.data.shape_keys.key_blocks} if o.data.shape_keys else {}}
  if o.vertex_groups:
   for v in o.data.vertices:
    total=sum(g.weight for g in v.groups)
    assert abs(total-1)<.002,(o.name,v.index,total)
 return result
original,updated,report_path=sys.argv[sys.argv.index('--')+1:]
def textures(path):
 data=Path(path).read_bytes();size=struct.unpack_from('<I',data,12)[0]
 gltf=json.loads(data[20:20+size]);start=28+size
 def digest(image):
  view=gltf['bufferViews'][image['bufferView']];offset=start+view.get('byteOffset',0)
  return hashlib.sha256(data[offset:offset+view['byteLength']]).hexdigest()
 return sorted(map(digest,gltf['images']))
assert textures(original)==textures(updated)
before=snapshot(original)
after=snapshot(updated)
assert set(after)-set(before)=={'outfit_cardigan_footwear'}
assert set(before)-set(after)==set()
report={}
for name,b in before.items():
 a=after[name];tree=KDTree(len(b['points']))
 for i,p in enumerate(b['points']):tree.insert(p,i)
 tree.balance();err=0;shapeErr=0
 assert set(a['keys'])==set(b['keys'])
 for i,p in enumerate(a['points']):
  if name=='outfit_cardigan' and p.z < .141:continue
  _,j,d=tree.find(p);err=max(err,d)
  candidates=tree.find_range(p,max(d+1e-6,.0001))
  if a['keys']:
   delta=min(max(((a['keys'][key][i]-p)-(b['keys'][key][idx]-b['points'][idx])).length for key in a['keys']) for _,idx,_ in candidates)
   shapeErr=max(shapeErr,delta)
 assert err<.0002,(name,err)
 assert shapeErr<.0002,(name,shapeErr)
 report[name]={'restError':err,'morphDeltaError':shapeErr,'verticesBefore':len(b['points']),'verticesAfter':len(a['points'])}
print('PASS rest geometry, shape-key offsets, normalized weights')

shoe=bpy.data.objects['outfit_cardigan_footwear']
assert shoe['coversFeetBelow']==.14
assert set(after[shoe.name]['keys'])==set(before['outfit_cardigan']['keys'])
for v in shoe.data.vertices:
 active=[shoe.vertex_groups[g.group].name for g in v.groups if g.weight>.001]
 assert active==['leftLeg' if v.co.x<0 else 'rightLeg'],(v.index,active)
for face in shoe.data.polygons:
 assert len({shoe.vertex_groups[g.group].name for i in face.vertices for g in shoe.data.vertices[i].groups if g.weight>.001})==1
print('PASS footwear morph names and independent leg bindings')

Path(report_path).write_text(json.dumps(report,indent=2))
