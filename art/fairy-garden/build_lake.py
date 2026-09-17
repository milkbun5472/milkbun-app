"""Expand the village pond into Moon Lake; preserve buildings, dock, bridge and forest exit.
Blender --background --python art/fairy-garden/build_lake.py -- ART_ROOT OUTPUT_DIR
Run after build_architecture.py. Lake outline/trees/deck come from MAPS.garden.lake.
Ground, near water and far water export independently; animated bottle belongs to lake-view.mjs.
"""
import bpy,bmesh,math,random,json,subprocess,sys,ast
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
base,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
repo=Path(__file__).resolve().parents[2]
plan=json.loads(subprocess.check_output(['/opt/homebrew/bin/node','-e',"require('./apps/fairy-garden/rules.js');console.log(JSON.stringify(FairyGardenRules.MAPS.garden))"],cwd=repo));lake=plan['lake'];shore=[(p['x'],p['z']) for p in lake['shore']];split=lake['splitZ'];random.seed(927)
bpy.ops.wm.open_mainfile(filepath=str(base/'architecture-v2/village-architecture.blend'))
# Use the same primitives as the architecture builder, rather than a second geometry library.
source=ast.parse((repo/'art/fairy-garden/build_architecture.py').read_text())
for n in source.body:
 if isinstance(n,ast.FunctionDef) and n.name in ['xyz','material']:exec(compile(ast.Module(body=[n],type_ignores=[]),'shared','exec'))
wood=bpy.data.materials['Architecture walnut wood'];oak=bpy.data.materials['Architecture warm oak'];stone=bpy.data.materials['Architecture limestone'];leaf=bpy.data.materials['Architecture vine foliage'];brass=bpy.data.materials['Architecture aged brass']
for n in source.body:
 if isinstance(n,ast.FunctionDef) and n.name in ['mesh','box','rod','line','sphere','cylinder']:exec(compile(ast.Module(body=[n],type_ignores=[]),'shared','exec'))
water=material('Moon lake water',(.105,.30,.29),.34);shallows=material('Moon lake shallow water',(.21,.43,.37),.46);silt=material('Lake bank earth',(.42,.43,.28));grass=material('Lake bank grass',(.36,.44,.24));rock=material('Lake limestone',(.50,.52,.43));reed=material('Lake reeds foliage',(.28,.40,.22));tips=material('Reed ochre seedheads',(.43,.30,.18));silver=material('Birch pale bark',(.67,.66,.49));willow=material('Willow lake foliage',(.30,.43,.29));willowLight=material('Willow light foliage',(.42,.51,.31));pollen=material('Waterlily cream petals',(.84,.77,.53));glint=material('Lake reflected sky water',(.32,.48,.43),.38)

def inside(x,z):
 result=False
 for i,(a,b) in enumerate(shore):
  c,d=shore[i-1]
  if (b>z)!=(d>z) and x<(c-a)*(z-b)/(d-b)+a:result=not result
 return result

def center(o):
 vs=[o.matrix_world@Vector(v) for v in o.bound_box];return sum(v.x for v in vs)/8,-sum(v.y for v in vs)/8
# Remove complete trees whose trunks became submerged, not random individual leaf clusters.
removedTrees=set()
for o in bpy.data.objects:
 if o.name.startswith('Forest trunk') and inside(*center(o)):removedTrees.add(int(o.name.rsplit('.',1)[1]) if '.' in o.name else 0)
for o in list(bpy.data.objects):
 if o.type not in {'MESH','CURVE'}:continue
 o.hide_render=False
 name=o.name.split('.')[0];index=int(o.name.rsplit('.',1)[1]) if '.' in o.name and o.name.rsplit('.',1)[1].isdigit() else 0
 tree=index if name=='Forest trunk' else index//5 if name=='Painterly canopy' else index//20 if name=='Leaf cluster' else None
 if name in ['Moon pond water','Soft mossy pond bank','Moon creek ribbon','Creek moss bank'] or tree in removedTrees and tree is not None:
  bpy.data.objects.remove(o,do_unlink=True);continue
 if o.get('district')=='ground' and name in ['Waterside reed','Lily floating leaf','Painted flower petal','Flower fine stem','Flower golden heart','Garden shrub','Old path addition']:
  x,z=center(o)
  if inside(x,z):bpy.data.objects.remove(o,do_unlink=True)

def district(z):return 'pond' if z>=split else 'lake-far'
def upward(o):
 for p in o.data.polygons:
  if p.normal.z<0:p.flip()
 return o
# Sutherland-Hodgman split produces exactly matching vertices at the streaming seam.
def clip(points,north):
 result=[]
 for i,a in enumerate(points):
  b=points[i-1];ina=a[1]<=split if north else a[1]>=split;inb=b[1]<=split if north else b[1]>=split
  if ina!=inb:
   t=(split-b[1])/(a[1]-b[1]);result.append((b[0]+(a[0]-b[0])*t,split))
  if ina:result.append(a)
 return result
triangles=tessellate_polygon([[Vector((x,z,0)) for x,z in shore]])
for north in [False,True]:
 current='lake-far' if north else 'pond';verts=[];faces=[]
 for triangle in triangles:
  points=clip([shore[p] if isinstance(p,int) else (p.x,p.y) for p in triangle],north)
  if len(points)<3:continue
  n=len(verts);verts.extend((x,z,lake['waterHeight']) for x,z in points);faces.append(tuple(range(n,len(verts))))
 upward(mesh('Moon lake continuous water',verts,faces,water))
# A continuous outlet meanders under the old bridge and beyond the clearing.
current='pond';creek=lake['creek'];verts=[];faces=[]
for i,p in enumerate(creek):
 for side in [-1,1]:verts.append((p['x'],p['z']+side*lake['creekWidth']/2,lake['waterHeight']-.003))
 if i:faces.append((i*2-2,i*2-1,i*2+1,i*2))
 if p['x']<17 or abs(p['x']-18)<1:continue
 if not i:continue
 prev=creek[i-1]
 for side in [-1,1]:
  offset=.99+.09*math.sin(i*.4);before=.99+.09*math.sin((i-1)*.4)
  upward(mesh('Creek grassy bank',[(prev['x'],prev['z']+side*.62,.13),(p['x'],p['z']+side*.62,.13),(p['x'],p['z']+side*offset,.105),(prev['x'],prev['z']+side*before,.105)],[(0,1,2,3)],grass))
upward(mesh('Moon lake outlet water',verts,faces,water))
# Continuous shallow fringe and low, uneven grassy banks; no necklace of identical rocks.
area=sum(shore[i-1][0]*p[1]-p[0]*shore[i-1][1] for i,p in enumerate(shore))
normals=[]
for i,(x,z) in enumerate(shore):
 a=shore[i-1];b=shore[(i+1)%len(shore)];dx,dz=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dz);normals.append((dz/length,-dx/length) if area>0 else (-dz/length,dx/length))
for i,(x,z) in enumerate(shore):
 j=(i+1)%len(shore);xx,zz=shore[j];nx,nz=normals[i];mx,mz=normals[j];current=district((z+zz)/2)
 # Leave the existing creek mouth unobstructed.
 if 15.9<x<17 and 7.15<z<8.85:continue
 width=.38+.17*math.sin(i*.47);widthNext=.38+.17*math.sin(j*.47);bank=.9+.15*math.sin(i*.31);bankNext=.9+.15*math.sin(j*.31)
 band=[(x-nx*width,z-nz*width,.135),(xx-mx*widthNext,zz-mz*widthNext,.135),(xx,zz,.135),(x,z,.135)];upward(mesh('Lake pale shallows',band,[(0,1,2,3)],shallows))
 vs=[(x,z,.137),(xx,zz,.137),(xx+mx*.48,zz+mz*.48,.22),(x+nx*.48,z+nz*.48,.22),(xx+mx*bankNext,zz+mz*bankNext,.09),(x+nx*bank,z+nz*bank,.09)]
 upward(mesh('Soft uneven lake bank',vs,[(0,1,2,3),(3,2,4,5)],grass))
 # Short stretches of gravel walking trail, separated by open lawn.
 if i%4==0 and z<4:
  for k in range(2):sphere('Lake trail pale gravel',x+nx*(1.6+k*.19),z+nz*(1.6+k*.19),.115,.15,.13,.035,silt)
# Reeds gather in irregular patches, keeping the bottle approach and dock clear.
for idx in [2,8,14,29,41,59,71,86,96,106]:
 x,z=shore[idx];nx,nz=normals[idx];current=district(z)
 for k in range(8):
  dx,dz=random.uniform(-.45,.45),random.uniform(-.28,.28);h=random.uniform(.32,.75)
  rod('Lake fine reed',(x+dx,z+dz,.13),(x+dx+.09,z+dz,h),.012,reed)
  rod('Lake reed folded leaf',(x+dx,z+dz,.19),(x+dx-.19,z+dz+.06,h*.7),.016,reed)
  if k%3==0:rod('Reed velvet seedhead',(x+dx+.09,z+dz,h-.11),(x+dx+.09,z+dz,h+.04),.035,tips)
for idx in [5,23,38,51,68,92]:
 x,z=shore[idx];nx,nz=normals[idx];current=district(z)
 for k in range(3):
  sphere('Shore clustered weathered stone',x+nx*.1+k*.22,z+nz*.1,.16,random.uniform(.22,.42),random.uniform(.17,.31),random.uniform(.15,.28),rock)
# Island: an old leaning willow, exposed roots and a small crescent of stone.
a=lake['island'];current='lake-far';sphere('Small island earth',a['x'],a['z'],.2,a['rx'],a['rz'],.34,silt);sphere('Small island grass',a['x']-.1,a['z'],.34,a['rx']*.9,a['rz']*.88,.29,grass)
trunk=[(a['x']-.45,a['z'],.4),(a['x']-.4,a['z'],1.2),(a['x']-.1,a['z']-.06,2.2),(a['x']+.35,a['z']-.15,3.2)]
for i in range(3):rod('Willow leaning trunk',trunk[i],trunk[i+1],.17-i*.035,wood)
for i in range(7):
 angle=i*math.tau/7;end=(a['x']+.2+math.cos(angle)*1.1,a['z']+math.sin(angle)*.75,2.6+random.random()*.5);rod('Willow spreading branch',trunk[2],end,.055,wood)
 sphere('Willow layered canopy',*end[:2],end[2],.83,.62,.40,willow if i%2 else willowLight)
 for j in range(3):
  x,z,h=end;x+=random.uniform(-.4,.4);z+=random.uniform(-.3,.3)
  line('Willow hanging branch',[(x,z,h),(x+.1,z,h-.6),(x+.16,z,h-1.15)],.012,wood)
  for n in range(5):sphere('Willow hanging leaves',x+.025*n,z,h-.2-n*.18,.085,.055,.15,willowLight)
for i in range(5):
 angle=i*.8;rod('Willow exposed root',(a['x']-.45,a['z'],.6),(a['x']-.45+math.cos(angle)*.7,a['z']+math.sin(angle)*.45,.38),.055,wood)
# Slim shoreline trees use the same trunk positions/radii as walking obstacles.
for i,t in enumerate(lake['trees']):
 x,z=t['x'],t['z'];current=district(z);h=3.3+(i%3)*.35
 rod('Lakeshore birch trunk',(x,z,.1),(x+.12,z,h),t['r']*.5,silver)
 for k in range(4):
  angle=k*2.4;xx=x+math.cos(angle)*.62;zz=z+math.sin(angle)*.55;yy=h-.1+(k%2)*.42
  rod('Birch fine branch',(x,z,h*.62),(xx,zz,yy),.055,wood);sphere('Birch airy foliage',xx,zz,yy,.86,.72,.83,willow if k%2 else willowLight)
 for k in range(5):box('Birch dark bark fleck',x+.06,z+.12,.6+k*.43,.17,.025,.055,wood,0)
# Waterlily pockets and restrained reflected-sky marks, not collectibles.
for x,z in [(9.2,7.7),(9.6,8),(10,7.5),(13.9,8.9),(22.2,-1.65),(22.7,-1.5),(20.1,-3.7)]:
 current=district(z);sphere('Floating lily leaf',x,z,.145,.25,.19,.018,reed)
 if int(x*10)%3==0:
  for i in range(5):angle=i*math.tau/5;sphere('Waterlily petal',x+math.cos(angle)*.08,z+math.sin(angle)*.08,.18,.08,.05,.035,pollen)
for x,z,length in [(13,4.5,1.2),(11,2,.7),(18,-1,1.3),(24,-.1,.9),(14,-2,.8)]:
 current=district(z);upward(mesh('Soft lake reflection',[(x-length,z,.136),(x-.1,z-.06,.136),(x+length,z+.015,.136),(x+.15,z+.08,.136)],[(0,1,2,3)],glint))
# Low stepping stones leading to the bottle's actual reach point.
current='pond';p=lake['bottle']['target']
for i in range(4):sphere('Bottle shore stepping stone',p['x']-.1+i*.29,p['z']+.4+i*.2,.105,.19,.15,.035,rock)
# Ground beds must survive every full lake/landscape rebuild.
import runpy
runpy.run_path(str(repo/'art/fairy-garden/build_flowerbeds.py'))['add_flowerbeds'](plan)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1500;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
bpy.ops.object.camera_add(location=xyz(36,33,30));camera=bpy.context.object;camera.rotation_euler=(Vector(xyz(16,1,0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=36;scene.camera=camera
bpy.ops.wm.save_as_mainfile(filepath=str(out/'village-lake.blend'));scene.render.filepath=str(out/'moon-lake.png');bpy.ops.render.render(write_still=True)
for zone in ['ground','pond','lake-far']:
 for o in bpy.data.objects:
  if o.type in {'MESH','CURVE'}:o.hide_render=o.get('district')!=zone
 bpy.ops.wm.save_as_mainfile(filepath=str(out/('village-'+zone+'.blend')))
print('MOON_LAKE_READY',flush=True)
