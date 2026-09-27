"""Shared Blender cloth regression snapshots and embedded texture hashes."""
import bpy,json,struct,hashlib
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

def image_hashes(path):
 raw=Path(path).read_bytes();length=struct.unpack_from('<I',raw,12)[0]
 gltf=json.loads(raw[20:20+length]);start=28+length;result=[]
 for image in gltf['images']:
  view=gltf['bufferViews'][image['bufferView']];offset=start+view.get('byteOffset',0)
  result.append(hashlib.sha256(raw[offset:offset+view['byteLength']]).hexdigest())
 return sorted(result)
