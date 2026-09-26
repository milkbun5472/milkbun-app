"""Check the exported satchel, complete strap, morph connections and preservation."""
import bpy,bmesh,sys,runpy,json,itertools,numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
helper=runpy.run_path(str(Path(__file__).with_name('cloth_asset_helpers.py')))
src,out,report=sys.argv[sys.argv.index('--')+1:]
before=helper['snapshot'](src);after=helper['snapshot'](out)
changed={'outfit_ranger','outfit_ranger_trousers','outfit_ranger_front_accessories','outfit_ranger_back_strap'}
assert set(before)-set(after)=={'outfit_ranger_front_accessories'}
assert set(after)-set(before)=={'outfit_ranger_bag','outfit_ranger_bag_flap','outfit_ranger_bag_clasp'}
drift=0
for name,old in before.items():
 if name in changed:continue
 new=after[name] # Draco may coalesce identical vertices at UV seams.
 tree=KDTree(len(new['points']))
 for i,p in enumerate(new['points']):tree.insert(p,i)
 tree.balance()
 for i,p in enumerate(old['points']):
  _,j,d=tree.find(p);drift=max(drift,d);assert d<.0002,(name,d)
  candidates=tree.find_range(p,max(d+1e-6,.0001))
  if old['keys']:assert min(max((old['keys'][key][i]-new['keys'][key][idx]).length for key in old['keys']) for _,idx,_ in candidates)<.0003,(name,'morph drift')
assert len(set(helper['image_hashes'](src)) & set(helper['image_hashes'](out)))==len(set(helper['image_hashes'](src)))-1,'only the hoodie atlas may change'
parts=['outfit_ranger_bag','outfit_ranger_bag_flap','outfit_ranger_bag_clasp','outfit_ranger_back_strap']
for name in parts:
 o=bpy.data.objects[name];assert o['cleanBagPart']==1
 assert len(o.data.shape_keys.key_blocks)==7
 assert all(k.value==0 for k in o.data.shape_keys.key_blocks[1:])
 assert all(len(v.groups)==1 and o.vertex_groups[v.groups[0].group].name=='body' for v in o.data.vertices)
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002)
 assert all(e.is_manifold for e in bm.edges),(name,'open boundary')
 assert all(f.calc_area()>1e-10 for f in bm.faces),(name,'degenerate face');bm.free()
 if name.endswith('clasp'):continue
 assert all(abs(c.color[0]-.77)<.01 for c in o.data.color_attributes.active_color.data),(name,'accent slot')
 assert not any(n.type=='TEX_IMAGE' for n in o.data.materials[0].node_tree.nodes),'bag must not reuse dirty clothing texture'
strap=bpy.data.objects['outfit_ranger_back_strap'];bag=bpy.data.objects['outfit_ranger_bag']
# Caps at both authored attachment points must remain within the bag surface,
# even at all 64 combinations of the six dimensional endpoints.
centers=[Vector((.065,-.140,.492)),Vector((.184,-.137,.491))]
ends=[[v.index for v in strap.data.vertices if (v.co-p).length<.022] for p in centers];assert all(ends)
keys=['height','shoulder','waist','flare','build','head'];catalog=json.loads(Path('apps/fairy-garden/doll.json').read_text());ranges={d['key']:(d['min']-1,d['max']-1) for d in catalog['dims']}
def coords(o,values):
 P=np.array([v.co[:] for v in o.data.shape_keys.key_blocks[0].data]);Q=P.copy()
 for key,v in zip(keys,values):Q+=(np.array([p.co[:] for p in o.data.shape_keys.key_blocks[key].data])-P)*v
 return Q
bag.data.calc_loop_triangles();faces=[tuple(f.vertices) for f in bag.data.loop_triangles];worst=0
for values in itertools.product(*(ranges[k] for k in keys)):
 B=coords(bag,values);S=coords(strap,values);tree=BVHTree.FromPolygons([Vector(p) for p in B],faces,all_triangles=True)
 for indices in ends:
  p=Vector(S[indices].mean(0));hit,_,_,distance=tree.find_nearest(p);assert hit is not None and distance<.024,('detached strap',values,distance);worst=max(worst,distance)
positions={o.name:np.array([v.co[:] for v in o.data.vertices]) for o in bpy.data.objects if o.type=='MESH'}
runpy.run_path(str(Path('art/fairy-garden/doll/restore_other_outfits.py').resolve()))['restore_other_outfits']()
assert set(positions)=={o.name for o in bpy.data.objects if o.type=='MESH'}
for name,p in positions.items():assert np.array_equal(p,np.array([v.co[:] for v in bpy.data.objects[name].data.vertices])),name
result={'preservedMeshDrift':drift,'closedBagParts':len(parts),'morphCombinations':64,'maximumAttachmentDistance':worst,'idempotent':True}
Path(report).write_text(json.dumps(result,indent=2));print(json.dumps(result))
