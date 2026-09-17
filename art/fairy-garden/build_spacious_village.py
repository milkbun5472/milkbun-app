"""Re-space the editable village into rigid districts, then export independently streamable blends.
Blender --background --python art/fairy-garden/build_spacious_village.py -- ART_ROOT OUTPUT
Buildings retain proportions. MAPS.garden and VILLAGE_ZONES own placement and collision data.
"""
import bpy,sys,json,subprocess,ast,math,random
from pathlib import Path
from mathutils import Vector
base,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
repo=Path(__file__).resolve().parents[2]
spec=json.loads(subprocess.check_output(['/opt/homebrew/bin/node','--input-type=module','-e',"import './apps/fairy-garden/rules.js';console.log(JSON.stringify(globalThis.FairyGardenRules))"],cwd=repo))
zones=spec['VILLAGE_ZONES'];plan=spec['MAPS']['garden'];random.seed(912)
bpy.ops.wm.open_mainfile(filepath=str(base/'scene-expansion/village-expanded.blend'))
for n in ast.parse((base/'build.py').read_text()).body:
 if isinstance(n,ast.FunctionDef) and n.name!='flower':exec(compile(ast.Module(body=[n],type_ignores=[]),'primitives','exec'))
M=bpy.data.materials;wood=M['Walnut beams'];oak=M['Honey oak'];stone=M['Old stepping stones'];gold=M['Old brass'];glow=M['Honey window glow']
for n in ast.parse((repo/'art/fairy-garden/build_places.py').read_text()).body:
 if isinstance(n,ast.FunctionDef) and n.name in ['pos','block','pebble','rod','path','lantern','camera']:exec(compile(ast.Module(body=[n],type_ignores=[]),'shared','exec'))
fixed={'01':'home','02':'hall','03':'neighbor3','04':'neighbor2','07':'hall','08':'home','09':'pond','13':'neighbor1'}
oldtrees=[(-10,3),(-10,-1),(-9,-5),(-9,-9),(-5,-10),(-1,-11),(3,-11),(7,-10),(10,-7),(10,-3),(10,1),(-11,7),(5,-11)]
def nearest(x,z):return min(zones,key=lambda k:math.hypot(x-zones[k]['cx'],z-zones[k]['cz']))
for o in list(bpy.data.objects):
 if o.type not in {'MESH','CURVE'}:continue
 if o.hide_render or o.name.startswith(('Firefly','Distant forest','Hand set paving','Old path addition')):
  bpy.data.objects.remove(o,do_unlink=True);continue
 c=next((c.name[:2] for c in o.users_collection if c.name[:2].isdigit()),'')
 zone=fixed.get(c);x,z=o.location.x,-o.location.y
 if c=='05':zone='pond'
 elif c=='11':
  name=o.name.split('.')[0];index=int(o.name.rsplit('.',1)[1]) if '.' in o.name else 0
  tree=index if name=='Forest trunk' else index//5 if name=='Painterly canopy' else index//20 if name=='Leaf cluster' else 12
  tx,tz=oldtrees[tree];o.location+=Vector((tx,-tz,0));o['district']='ground';continue
 elif c=='10':zone=nearest(x,z)
 elif c=='12':zone=nearest(x,z)
 elif c=='':
  if o.name.startswith(('Footbridge','Bridge','Moon creek','Creek moss')):zone='pond'
  elif o.name.startswith(('Hall','Forecourt','Noticeboard','Blank paper','Market','Folded market')):zone='hall'
  else:zone=nearest(x,z)
 if zone:
  d=zones[zone];o.location+=Vector((d['x'],-d['z'],0));o['district']='ground' if c in ['10','12'] or o.name=='Continuous walkable meadow' else zone
 else:o['district']='ground'
# Museum uses its existing authored local frame, translated by the same district descriptor.
with bpy.data.libraries.load(str(base/'museum/museum-exterior.blend'),link=False) as (src,dst):dst.objects=src.objects
for o in dst.objects:
 if o and o.type in {'MESH','CURVE'}:
  bpy.context.scene.collection.objects.link(o);o.location+=Vector((plan['museum']['x']-o.get('district_origin_x',zones['museum']['cx']),-(plan['museum']['z']-o.get('district_origin_z',zones['museum']['cz'])),0));o['district']='museum'
 elif o:bpy.data.objects.remove(o,do_unlink=True)
# Open branching footpaths, with lawns between districts. Keep existing local porches and dock.
start=set(bpy.data.objects)
paths=[ [(-13.4,8.55),(-13,11),(-7,12),(-5,5),(0,3),(-1,-4),(-1,-8.65)],
 [(-1,-4),(-8,-5),(-13,-5),(-18,-5.5)],
 [(-8,-5),(-9,-11),(-10,-14),(-13,-16.6)],
 [(-1,-4),(6,-5),(11,-7),(16,-7),(16,-11.5)],
 [(0,3),(5,4),(6,10),(8,13),(11.8,10.1)],
 [(8,13),(15,13),(18,9.6)],[(18,6.6),(18,4)],
 [(-7,12),(-6,17),(-5,22),(-1.5,22),(-1.5,20.05)] ]
for points in paths:path(points)
for x,z in [(-8,11),(-5,4),(-5,-4),(4,-4),(-10,-11),(6,10),(-5,16)]:lantern(x,z)
for o in set(bpy.data.objects)-start:o['district']='ground'
# One assembled editable source and overview for visual review.
sc=camera('Camera spacious village',(0,0,1),(32,48,47),65);sc.render.resolution_x=1700;sc.render.resolution_y=1300;sc.cycles.samples=16
bpy.ops.wm.save_as_mainfile(filepath=str(out/'village-spacious.blend'));sc.render.filepath=str(out/'village-spacious.png');bpy.ops.render.render(write_still=True)
for zone in ['ground',*zones]:
 for o in bpy.data.objects:
  if o.type in {'MESH','CURVE'}:o.hide_render=o.get('district')!=zone
 bpy.ops.wm.save_as_mainfile(filepath=str(out/('village-'+zone+'.blend')))
print('SPACIOUS_READY',flush=True)
