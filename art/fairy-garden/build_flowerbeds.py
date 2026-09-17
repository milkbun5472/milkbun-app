"""Restore visible beds from authoritative collision footprints, including empty saves.
Blender --background --python art/fairy-garden/build_flowerbeds.py -- SOURCE.blend OUTPUT_DIR
Called by build_lake.py too, so future landscape rebuilds retain the beds.
"""
import bpy,bmesh,math,ast,json,subprocess,sys
from pathlib import Path
from mathutils import Vector

def add_flowerbeds(plan):
 repo=Path(__file__).resolve().parents[2]
 ns={'bpy':bpy,'bmesh':bmesh,'math':math,'Vector':Vector,'current':'ground'}
 funcs={n.name:n for n in ast.parse((repo/'art/fairy-garden/build_architecture.py').read_text()).body if isinstance(n,ast.FunctionDef)}
 def use(name):exec(compile(ast.Module(body=[funcs[name]],type_ignores=[]),'architecture primitives','exec'),ns)
 use('material');mat=ns['material'];wood=mat('Flowerbed aged oak wood',(.34,.23,.145));soil=mat('Flowerbed cultivated earth',(.19,.13,.085));furrow=mat('Flowerbed furrow earth',(.13,.09,.065));pin=mat('Flowerbed brass pin',(.46,.33,.17))
 ns['wood']=wood;ns['leaf']=soil
 for name in ['xyz','mesh','box','sphere']:use(name)
 box=ns['box'];sphere=ns['sphere']
 for o in list(bpy.data.objects):
  if o.get('flowerbed'):bpy.data.objects.remove(o,do_unlink=True);continue
  # Legacy baked flowers/shrubs cannot represent an empty or freshly harvested bed.
  if o.type=='MESH' and o.name.startswith(('Flower fine stem','Flower golden heart','Painted flower petal','Garden shrub')):
   vs=[o.matrix_world@Vector(v) for v in o.bound_box];x=sum(v.x for v in vs)/8;z=-sum(v.y for v in vs)/8
   if any(abs(x-p['x'])<p['w']/2+.30 and abs(z-p['z'])<p['d']/2+.20 for p in [*plan['flowerbeds'],*[p['former'] for p in plan['flowerbeds'] if p.get('former')]]):bpy.data.objects.remove(o,do_unlink=True)
 for p in plan['flowerbeds']:
  before=set(bpy.data.objects);x,z,w,d=p['x'],p['z'],p['w'],p['d'];t=.10
  box('Flowerbed soil',x,z,.21,w-t*2,d-t*2,.14,soil,.02)
  for side in [-1,1]:
   box('Flowerbed long timber rim',x,z+side*(d-t)/2,.205,w,t,.27,wood,.025)
   box('Flowerbed end timber rim',x+side*(w-t)/2,z,.205,t,d-t*2,.27,wood,.025)
  for side in [-1,1]:
   for end in [-1,1]:sphere('Flowerbed inset fixing',x+side*(w-t)/2,z+end*(d-t)/2,.342,.023,.023,.008,pin)
  for row in [-1,0,1]:box('Flowerbed planting furrow',x,z+row*.21,.282,w-.32,.024,.007,furrow,0)
  for o in set(bpy.data.objects)-before:o['flowerbed']=p['id']
 return len(plan['flowerbeds'])

if __name__=='__main__':
 source,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
 repo=Path(__file__).resolve().parents[2];plan=json.loads(subprocess.check_output(['/opt/homebrew/bin/node','-e',"require('./apps/fairy-garden/rules.js');console.log(JSON.stringify(FairyGardenRules.MAPS.garden))"],cwd=repo))
 bpy.ops.wm.open_mainfile(filepath=str(source));assert add_flowerbeds(plan)==2
 sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=20;sc.cycles.use_denoising=True
 x=sum(p['x'] for p in plan['flowerbeds'])/2;z=sum(p['z'] for p in plan['flowerbeds'])/2
 sc.camera.location=(x+5,-z-7,8);sc.camera.rotation_euler=(Vector((x,-z,.1))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.ortho_scale=5
 sc.render.resolution_x=1100;sc.render.resolution_y=1000;sc.render.resolution_percentage=100;sc.render.filepath=str(out/'empty-flowerbeds.png')
 bpy.ops.wm.save_as_mainfile(filepath=str(out/'village-ground.blend'));bpy.ops.render.render(write_still=True)
