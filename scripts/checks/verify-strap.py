"""Validate the exported footwear, preserving every non-shoe mesh and texture."""
import bpy,bmesh,sys,json,runpy
from pathlib import Path
from mathutils.kdtree import KDTree
HERE=Path(__file__).parent
helper=runpy.run_path(str(HERE/'cloth_asset_helpers.py'))
src,out,report=sys.argv[sys.argv.index('--')+1:]
before=helper['snapshot'](src);after=helper['snapshot'](out)
assert helper['image_hashes'](src)==helper['image_hashes'](out)
is_shoe=lambda name:name=='outfit_ranger_back_strap'
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
strap=bpy.data.objects['outfit_ranger_back_strap']
assert set(after)-set(before)=={'outfit_ranger_back_strap'}
assert strap.get('backStrapVersion')==1
for v in strap.data.vertices:
 assert len(v.groups)==1 and abs(v.groups[0].weight-1)<1e-6 and strap.vertex_groups[v.groups[0].group].name=='body'
assert list(strap.data.shape_keys.key_blocks.keys())==['Basis','height','shoulder','waist','flare','build','head']
assert all(k.value==0 for k in strap.data.shape_keys.key_blocks[1:])
bm=bmesh.new();bm.from_mesh(strap.data);assert all(len(e.link_faces)==2 for e in bm.edges);bm.free()
assert any(all(abs(c.color[0]-.77)<.005 and c.color[1]==0 for c in attr.data) for attr in strap.data.color_attributes)
assert bpy.data.objects['outfit_ranger'].get('textureSlots')=='ranger'
count=len(bpy.data.objects);runpy.run_path(str(Path('art/fairy-garden/doll/restore_ranger_strap.py').resolve()))['restore_ranger_strap']();assert len(bpy.data.objects)==count
result={'preservedMeshDrift':max_drift,'textures':'identical','strapVertices':len(strap.data.vertices),'triangles':len(strap.data.polygons),'closed':True,'bodyOnly':True,'sixMorphs':True,'idempotent':True}
Path(report).write_text(json.dumps(result,indent=2));print(json.dumps(result))
