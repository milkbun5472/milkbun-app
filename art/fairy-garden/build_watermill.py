"""Downstream watermill. MAPS.garden.watermill owns all footprints and stream coordinates.
Blender --background --python art/fairy-garden/build_watermill.py -- OUTPUT_DIR
"""
import bpy,bmesh,math,random,json,subprocess,sys,ast
from pathlib import Path
from mathutils import Vector
out=Path(sys.argv[sys.argv.index('--')+1]);out.mkdir(parents=True,exist_ok=True)
repo=Path(__file__).resolve().parents[2]
plan=json.loads(subprocess.check_output(['/opt/homebrew/bin/node','-e',"require('./apps/fairy-garden/rules.js');console.log(JSON.stringify(FairyGardenRules.MAPS.garden.watermill))"],cwd=repo))
bpy.ops.wm.read_factory_settings(use_empty=True)
source=ast.parse(Path(__file__).with_name('build_architecture.py').read_text())
def shared(names):
 for n in source.body:
  if isinstance(n,ast.FunctionDef) and n.name in names:exec(compile(ast.Module(body=[n],type_ignores=[]),'<architecture>','exec'),globals())
shared({'material'})
wood=material('Mill weathered walnut wood',(.20,.135,.095));oak=material('Mill honey oak wood',(.43,.28,.16));stone=material('Mill fieldstone',(.49,.49,.40));stone2=material('Mill pale cut limestone',(.64,.59,.47));ivory=material('Mill lime plaster',(.78,.70,.52));brass=material('Mill patinated iron',(.20,.25,.23),.5,.35);dark=material('Mill deep window recess',(.075,.11,.095));glass=material('Mill honey window glass',(.67,.70,.49),.4,0,.1);leaf=material('Mill willow foliage',(.31,.44,.25));leaf2=material('Mill light foliage',(.43,.53,.30));petal=material('Mill lavender blossom',(.44,.32,.48));sage=material('Mill sage painted timber',(.23,.35,.29));grass=material('Mill bank grass earth',(.36,.44,.24));water=material('Moon lake outlet water',(.105,.30,.29),.34);pathmat=material('Mill sandy earth path',(.52,.46,.32))
roofs={'moss':[material('Mill aged clay roof '+str(i),tuple(c*v for c in (.43,.25,.15))) for i,v in enumerate([.85,.97,1.06,1.15])]}
current='watermill';shared({'xyz','mesh','box','rod','line','sphere','cylinder','arch','arch_trim','window','door','roof','body','chimney','lantern','mill_wheel'})
for n in ast.parse(Path(__file__).with_name('build_lake.py').read_text()).body:
 if isinstance(n,ast.FunctionDef) and n.name=='upward':exec(compile(ast.Module(body=[n],type_ignores=[]),'<lake-surface>','exec'),globals())
random.seed(91792)
# Water and the solid stream polygon use the same sampled centerline and width.
for name,points,width,h,mat in [('Moon lake mill outlet water',plan['creek'],plan['width'],.127,water),('Mill winding earth footpath',plan['approach'],1.25,.086,pathmat)]:
 verts=[]
 for p in points:
  for side in [-1,1]:verts.append((p['x'],p['z']+side*width/2,h))
 upward(mesh(name,verts,[(i*2-2,i*2-1,i*2+1,i*2) for i in range(1,len(points))],mat))
for side in [-1,1]:
 verts=[]
 for p in plan['creek']:
  verts.extend([(p['x'],p['z']+side*.62,.128),(p['x'],p['z']+side*1.0,.085)])
 upward(mesh('Mill grassy stream bank',verts,[(i*2-2,i*2-1,i*2+1,i*2) for i in range(1,len(plan['creek']))],grass))
for i,p in enumerate(plan['parts']):
 body(p);x,z,w,d,h=[p[k] for k in ['x','z','w','d','h']]
 roof(x,z,w,d,h+.22,2.55 if i==0 else .8,skew=-.32 if i==0 else 0)
 front=z+d/2+.09
 # Half-timber braces on the facade; the gear wing uses an open-looking slatted upper panel.
 for dx in [-w*.35,0,w*.35]:
  if i==0 and dx<0:continue
  rod('Mill facade timber post',(x+dx,front,.55),(x+dx,front,h+.2),.065,wood)
  line('Mill diagonal timber brace',[(x+dx-.48,front,.65),(x+dx+.48,front,1.4)],.05,wood)
 if i==0:
  door(plan['door']['x'],front,1.13,2.2)
  window(x+1.15,front,1.8,.92,1.25,True)
  window(x-.22,front,4.25,.88,1.35,True)
  for dx in [-1.7,-.85,0,.85,1.7]:rod('Gable fan framing',(x-.32,front,5.98),(x+dx,front,4.1),.04,wood)
  chimney(x-1.7,z-1.0,4.4,2.1)
  lantern(x-2.2,front+.03,2.45)
 else:
  for dx in [-.6,-.3,0,.3,.6]:box('Wheelhouse louver',x+dx,front,2.05,.14,.10,.65,sage)
q=plan['wheel'];mill_wheel('Stream-driven timber waterwheel',q['x'],q['z'],q['center'],q['r'],q['d'],oak,brass)
rod('Mill drive shaft',(q['x'],10.72,q['center']),(q['x'],q['z']+.45,q['center']),.15,wood)
# The outlet disappears into an old stone culvert, instead of ending as a cut-off blue strip.
c=plan['culvert'];cx,cz=c['x'],c['z']
for j in range(16):
 a=j*math.pi/16;b=(j+1)*math.pi/16;verts=[]
 for xx in [cx-c['w']/2,cx+c['w']/2]:
  for r,angle in [(.73,a),(.73,b),(1.05,b),(1.05,a)]:verts.append((xx,cz+math.cos(angle)*r,.15+math.sin(angle)*r))
 mesh('Culvert radial limestone block',verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],stone2 if j%3 else stone,.018)
box('Culvert downstream shadow',cx+.4,cz,.43,.08,1.46,.61,dark,.03)
for j in range(8):
 sphere('Culvert moss foliage',cx-.65+j*.18,cz+.18*math.sin(j*2),1.15,.27,.30,.15,leaf)
# Stone threshold is shallow and fully traversable, not a collision box.
box('Mill worn entry threshold',plan['door']['x'],10.24,.10,1.4,.48,.07,stone2)
for n,t in enumerate(plan['trees']):
 x,z,h,r=t['x'],t['z'],t['h'],t['r'];cylinder('Willow slender trunk',x,z,.08,r,h*.78,wood,10,r*.5)
 for j in range(6):
  a=j*2.399+n;dx,dz=math.cos(a)*.85,math.sin(a)*.75
  line('Willow sweeping branch',[(x,z,h*.52),(x+dx*.8,z+dz*.8,h*.84),(x+dx,z+dz,h*.73)],.045,wood)
  sphere('Willow foliage',x+dx,z+dz,h*.75,.85,.76,.88,leaf if j%2 else leaf2)
  for k in range(3):
   xx=x+dx+(k-1)*.24;line('Willow trailing leaves',[(xx,z+dz,h*.76),(xx+.08,z+dz+.09,h*.52)],.05,leaf)
# Fine reeds stay in the inaccessible water strip; visible solids stay in the shared table.
for i,p in enumerate(plan['creek']):
 if i%3 or abs(p['x']-q['x'])<2:continue
 for side in [-1,1]:
  for k in range(3):
   x=p['x']+k*.09;z=p['z']+side*.56;h=.35+(i%4)*.08
   rod('Creek reed',(x,z,.13),(x+.06,z+.04,h),.012,leaf);sphere('Reed seed head',x+.06,z+.04,h,.025,.025,.09,oak)
current='preview-ground';box('Preview meadow',38,8,-.035,30,24,.09,grass,0)
sc=bpy.context.scene;world=bpy.data.worlds.new('Mill afternoon');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.73,.68,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65;sc.world=world
bpy.ops.object.light_add(type='SUN');sun=bpy.context.object;sun.data.energy=2;sun.data.angle=.28;sun.rotation_euler=(.45,-.5,-.4)
bpy.ops.object.camera_add(location=xyz(52,27,18));cam=bpy.context.object;cam.rotation_euler=(Vector(xyz(38.7,9,1.4))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=22;sc.camera=cam
sc.render.engine='CYCLES';sc.cycles.samples=24;sc.cycles.use_denoising=True;sc.render.resolution_x=1500;sc.render.resolution_y=1100;sc.render.resolution_percentage=100
for o in bpy.data.objects:
 if o.type=='MESH' and o.get('district')=='preview-ground':o.hide_render=True
bpy.ops.wm.save_as_mainfile(filepath=str(out/'village-watermill.blend'))
for o in bpy.data.objects:o.hide_render=False
sc.render.filepath=str(out/'watermill-exterior.png');bpy.ops.render.render(write_still=True);print('WATERMILL_READY',flush=True)
