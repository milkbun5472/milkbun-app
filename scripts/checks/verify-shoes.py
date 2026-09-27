"""Validate the exported footwear, preserving every non-shoe mesh and texture."""
import bpy,bmesh,sys,json,runpy
from pathlib import Path
from mathutils.kdtree import KDTree
HERE=Path(__file__).parent
helper=runpy.run_path(str(HERE/'cloth_asset_helpers.py'))
src,out,report=sys.argv[sys.argv.index('--')+1:]
before=helper['snapshot'](src);after=helper['snapshot'](out)
assert helper['image_hashes'](src)==helper['image_hashes'](out)
is_shoe=lambda name:any(name.startswith('outfit_'+o+'_shoes') for o in ('academy','garden','ranger'))
assert {n for n in before if not is_shoe(n)}=={n for n in after if not is_shoe(n)}
max_drift=0
for name,old in before.items():
 if is_shoe(name):continue
 new=after[name];assert old['keys'].keys()==new['keys'].keys()
 tree=KDTree(len(new['points']))
 for i,p in enumerate(new['points']):tree.insert(p,i)
 tree.balance()
 for i,p in enumerate(old['points']):
  _,j,d=tree.find(p);max_drift=max(max_drift,d);assert d<.0002,(name,d)
  candidates=tree.find_range(p,max(d+1e-6,.0001))
  drift=min(max(((old['keys'][key][i]-p)-(new['keys'][key][idx]-new['points'][idx])).length for key in old['keys']) for _,idx,_ in candidates) if old['keys'] else 0
  assert drift<.0002,(name,drift)
parts=[];triangles=0
for o in bpy.data.objects:
 if o.type!='MESH' or not is_shoe(o.name):continue
 assert o.get('footwearVersion')==1
 assert list(o.data.shape_keys.key_blocks.keys())==['Basis','height','shoulder','waist','flare','build','head']
 for v in o.data.vertices:
  assert len(v.groups)==1 and abs(v.groups[0].weight-1)<.0001
  expected='leftLeg' if v.co.x<-.0075 else 'rightLeg';assert o.vertex_groups[v.groups[0].group].name==expected
 # Coincident buckle endpoints are capped individually, so test boundaries before
 # welding (the exported UV-free components otherwise share every edge).
 bm=bmesh.new();bm.from_mesh(o.data)
 assert not any(e.is_boundary for e in bm.edges),(o.name,'open edge')
 bm.free()
 tri=sum(len(p.vertices)-2 for p in o.data.polygons);triangles+=tri
 if o.name.endswith('_sole'):
  zs=[v.co.z for v in o.data.vertices];assert abs(min(zs)+.003)<.00005
 for k in o.data.shape_keys.key_blocks[1:]:assert k.value==0,(o.name,k.name,k.value)
 parts.append({'name':o.name,'triangles':tri})
assert len(parts)==15;assert triangles<18000,triangles
objects=len(bpy.data.objects);runpy.run_path(str(Path('art/fairy-garden/doll/shoes.py').resolve()))['replace_shoes']();assert len(bpy.data.objects)==objects
result={'parts':parts,'triangles':triangles,'preservedMeshDrift':max_drift,'textures':'identical','idempotent':True}
Path(report).write_text(json.dumps(result,indent=2));print(json.dumps(result))
