"""Blender QA: compare rest geometry/morph offsets to the pre-migration GLB.
Usage: Blender --background --python verify-cardigan-surface.py -- before.glb after.glb report.json
Cardigan is rebuilt; all other meshes and texture bytes must remain unchanged.
"""
import bpy, json, sys
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
before=snapshot(original)
after=snapshot(updated)
sleeves={f'outfit_cardigan_{side}_sleeve' for side in ('left','right')}
assert set(after)==set(before)|sleeves
report={}
for name,b in before.items():
 if name=='outfit_cardigan':continue
 a=after[name];tree=KDTree(len(b['points']))
 for i,p in enumerate(b['points']):tree.insert(p,i)
 tree.balance();err=0;shapeErr=0
 assert set(a['keys'])==set(b['keys'])
 for i,p in enumerate(a['points']):
  _,j,d=tree.find(p);err=max(err,d)
  candidates=tree.find_range(p,max(d+1e-6,.0001))
  if a['keys']:
   delta=min(max(((a['keys'][key][i]-p)-(b['keys'][key][idx]-b['points'][idx])).length for key in a['keys']) for _,idx,_ in candidates)
   shapeErr=max(shapeErr,delta)
 assert err<.0002,(name,err)
 assert shapeErr<.0002,(name,shapeErr)
 report[name]={'restError':err,'morphDeltaError':shapeErr,'verticesBefore':len(b['points']),'verticesAfter':len(a['points'])}
Path(report_path).write_text(json.dumps(report,indent=2))
print('PASS rest geometry, shape-key offsets, normalized weights')

# Re-export must retain the original embedded texture bytes.
import struct, hashlib
def image_hashes(path):
 raw=Path(path).read_bytes();length=struct.unpack_from('<I',raw,12)[0]
 gltf=json.loads(raw[20:20+length]);start=28+length;result=[]
 for image in gltf['images']:
  view=gltf['bufferViews'][image['bufferView']];offset=start+view.get('byteOffset',0)
  result.append(hashlib.sha256(raw[offset:offset+view['byteLength']]).hexdigest())
 return sorted(result)
assert image_hashes(original)==image_hashes(updated)
print('PASS all original embedded textures preserved')

import bmesh
mesh=bpy.data.objects['outfit_cardigan']
assert mesh['continuousSurfaceVersion']==1
assert mesh['loweredCollarVersion']==1
assert set(after[mesh.name]['keys'])==set(before[mesh.name]['keys'])
bm=bmesh.new();bm.from_mesh(mesh.data)
# UV export duplicates vertices, so reunite numerically identical positions first.
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00004)
boundary=[e for e in bm.edges if e.is_boundary]
assert all(max(v.co.z for v in e.verts)<.141 for e in boundary), 'Only the concealed ankle join may remain open'
assert not any(len(e.link_faces)>2 for e in bm.edges), 'No non-manifold cloth seams'
report['cardiganSurface']={'boundaryEdges':len(boundary),'faces':len(bm.faces),'trianglesBudget':15500}
# Bisecting the ankle creates quads which are triangulated on GLB export.
assert len(bm.faces)<=15500
bm.free()
for name in sleeves:
 sleeve=bpy.data.objects[name]
 assert sleeve['roundSleeveVersion']==1
 assert set(after[name]['keys'])==set(before['outfit_cardigan']['keys'])
 bm=bmesh.new();bm.from_mesh(sleeve.data)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00004)
 # Only the inner wrist edge is open; the shoulder cap and complete tube are closed.
 assert all(.43<v.co.z<.53 for e in bm.edges if e.is_boundary for v in e.verts)
 assert not any(len(e.link_faces)>2 for e in bm.edges)
 assert len(bm.faces)<1500
 bm.free()
Path(report_path).write_text(json.dumps(report,indent=2))
print('PASS continuous cardigan surface; only the ankle join is open')

# Re-entering the authoring pipeline must neither add another sleeve nor cut again.
import runpy
repair=runpy.run_path(str(Path(__file__).resolve().parents[2]/'art/fairy-garden/doll/rebuild_cardigan_sleeves.py'))['rebuild_cardigan_sleeves']
counts={o.name:len(o.data.vertices) for o in bpy.data.objects if o.type=='MESH'}
assert repair(mesh) is mesh
assert counts=={o.name:len(o.data.vertices) for o in bpy.data.objects if o.type=='MESH'}
print('PASS idempotent sleeve authoring')
