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

import numpy as np,itertools
from mathutils.kdtree import KDTree

def flipped_areas(obj,catalog):
 obj.data.calc_loop_triangles()
 tri=np.array([t.vertices[:] for t in obj.data.loop_triangles])
 basis=np.array([v.co[:] for v in obj.data.shape_keys.key_blocks['Basis'].data])
 pts=basis[tri];ref=np.cross(pts[:,1]-pts[:,0],pts[:,2]-pts[:,0]);areas=np.linalg.norm(ref,axis=1)
 result=[]
 for values in itertools.product((0,1),repeat=6):
  points=basis.copy()
  for dim,high in zip(catalog['dims'],values):
   delta=np.array([v.co[:] for v in obj.data.shape_keys.key_blocks[dim['key']].data])-basis
   points+=delta*(dim['max' if high else 'min']-1)
  pts=points[tri];norm=np.cross(pts[:,1]-pts[:,0],pts[:,2]-pts[:,0])
  result.append(float(areas[np.sum(norm*ref,axis=1)<0].sum()))
 return np.array(result)

def assert_preserved(a,b,changed):
    drift = 0
    count = 0
    assert set(a) - changed == set(b) - changed, (set(a) - set(b), set(b) - set(a))
    for name in sorted(set(a) - changed):
        for aa, bb in ((a[name], b[name]), (b[name], a[name])):
            assert aa["keys"].keys() == bb["keys"].keys(), name
            tree = KDTree(len(aa["points"]))
            for i, p in enumerate(aa["points"]):
                tree.insert(p, i)
            tree.balance()
            keys = list(aa["keys"])
            ap = np.stack(
                [np.array(aa["points"])] + [np.array(aa["keys"][k]) for k in keys], axis=1
            )
            bp = np.stack(
                [np.array(bb["points"])] + [np.array(bb["keys"][k]) for k in keys], axis=1
            )
            for p, values in zip(bb["points"], bp):
                near = tree.find_range(p, 1e-5)
                assert near, (name, p)
                error = min(np.max(np.abs(ap[i] - values)) for _, i, _ in near)
                assert error < 1e-5, (name, float(error))
                drift = max(drift, float(error))
        count += 1
    return count,drift
