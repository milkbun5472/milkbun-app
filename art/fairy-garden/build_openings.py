"""Three spell-responsive scenery overlays. Both authored visibility groups survive export.
Blender --background --python art/fairy-garden/build_openings.py -- OUTPUT_DIR [fallenTree reedBridge towerVines]
"""
import bpy,bmesh,math,random,json,subprocess,sys,ast
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];out=Path(args[0]);out.mkdir(parents=True,exist_ok=True);targets=args[1:] or ['fallenTree','reedBridge','towerVines']
repo=Path(__file__).resolve().parents[2]
cfg=json.loads(subprocess.check_output(['/opt/homebrew/bin/node','-e',"require('./apps/fairy-garden/rules.js');console.log(JSON.stringify(FairyGardenRules.MAPS))"],cwd=repo))
source=ast.parse(Path(__file__).with_name('build_architecture.py').read_text())
def shared(names):
 for n in source.body:
  if isinstance(n,ast.FunctionDef) and n.name in names:exec(compile(ast.Module(body=[n],type_ignores=[]),'<architecture>','exec'),globals())
shared({'material'})
wood=material('Opening weathered bark wood',(.25,.18,.12));oak=material('Opening pale cut oak wood',(.52,.36,.21));stone=material('Opening old blue limestone',(.39,.45,.43));leaf=material('Opening dark fern foliage',(.20,.36,.24));lightleaf=material('Opening sage foliage',(.36,.48,.29));reedmat=material('Opening honey reed wood',(.51,.42,.23));brass=material('Opening verdigris copper',(.24,.43,.38),.5,.3);glow=material('Opening firefly amber',(.75,.62,.25),.5,0,.28);petal=material('Opening soft lilac petals',(.43,.35,.53));earth=material('Opening shaded earth',(.36,.36,.24));water=material('Moon lake preview water',(.105,.30,.29),.34)
current='opening';shared({'xyz','mesh','box','rod','line','sphere','cylinder','branch'})
for n in ast.parse(Path(__file__).with_name('build_lake.py').read_text()).body:
 if isinstance(n,ast.FunctionDef) and n.name=='upward':exec(compile(ast.Module(body=[n],type_ignores=[]),'<lake-surface>','exec'),globals())

def state_group(key,side,fn):
 before=set(bpy.data.objects);fn()
 for o in set(bpy.data.objects)-before:o['export_group']=side+':'+key

def leaf_spray(x,z,h,scale=1):
 for j in range(5):
  a=j*2.399;sphere('Sprig foliage',x+math.cos(a)*.12*scale,z+math.sin(a)*.12*scale,h,.16*scale,.09*scale,.06*scale,leaf if j%2 else lightleaf)

def fallenTree():
 p=cfg['garden']['oldTower'];q=p['fallenTree'];x,z=q['x'],q['z'];c=p['clearing']
 # Clearing floor meets the original winding path. The thicket recipe omits this same region.
 verts=[(c['x']+math.cos(i*math.tau/48)*c['w']/2,c['z']+math.sin(i*math.tau/48)*c['d']/2,.094) for i in range(48)]
 upward(mesh('Side clearing soft earth',verts,[tuple(range(48))],earth))
 for sign in [-1,1]:
  for j in range(12):
   xx=c['x']-c['w']/2+.25+j*(c['w']-.5)/11;zz=z+sign*(c['d']/2+.16)
   leaf_spray(xx,zz,.28,.9)
 # Fixed tree roots frame both states; they sit outside the walkable clearing.
 for sign in [-1,1]:
  zz=z+sign*1.55
  sphere('Ancient tree root mound',x,zz,.25,.50,.30,.25,wood)
  for j in range(4):rod('Gripping root',(x,zz,.28),(x+math.cos(j*1.7)*.55,zz+sign*.30,.08),.075,wood)
 def shut():
  branch('Fallen rough tree trunk',[(x,z-1.48,.49),(x+.08,z-.75,.62),(x-.05,z,.72),(x+.02,z+.75,.54),(x,z+1.48,.34)],.34,wood)
  for j in range(11):
   zz=z-1.3+j*.25;leaf_spray(x+.08*math.sin(j),zz,.90-(abs(zz-z)*.2),.65)
  for sign in [-1,1]:
   line('Broken branch',[(x,z+sign*.5,.64),(x-.14,z+sign*.7,1.1),(x-.24,z+sign*.95,1.23)],.06,wood)
  # End grain is visible on the naturally broken tip.
  sphere('Pale broken trunk end',x,z+1.49,.35,.26,.05,.24,oak)
 def opened():
  points=[(x+.08*math.sin(i*.8),z-1.55+3.1*i/24,.35+2.8*math.sin(math.pi*i/24)**.65) for i in range(25)]
  branch('Awakened tree arch',points,.24,wood)
  for j in range(1,12):
   a=j*math.pi/12;zz=z-1.55+3.1*j/12;h=.35+2.8*math.sin(a)**.65
   leaf_spray(x,zz,h+.10,.9)
   if j%3==0:
    rod('Hanging seed thread',(x,zz,h-.1),(x,zz,h-.43),.012,oak);sphere('Seed lantern',x,zz,h-.46,.07,.07,.10,glow)
 state_group('fallenTree','shut',shut);state_group('fallenTree','open',opened)
 # A tiny circle of glowing mushrooms is scenery at the reachable end, not loot.
 for j in range(7):
  a=j*math.tau/7;xx=c['x']+c['w']/2-.85+math.cos(a)*.35;zz=z+math.sin(a)*.43
  rod('Mushroom stalk',(xx,zz,.09),(xx,zz,.25),.025,oak);sphere('Forest mushroom cap',xx,zz,.27,.12,.12,.06,glow if j%2 else petal)
 return (c['x'],z,1),10,'opening-fallen-tree'

def reedBridge():
 q=cfg['garden']['lake']['reedBridge'];x=q['x'];steps=q['steps']
 def shut():
  for j in range(21):
   xx=x-.66+j*.066;zz=q['z']+.20*math.sin(j*1.9);h=.65+.38*math.sin(j*.7)**2
   line('Closed reed tuft',[(xx,zz,.13),(xx+.035,zz,h*.7),(xx+.11,zz+.04,h)],.018,reedmat)
   sphere('Reed seed head',xx+.11,zz+.04,h,.032,.032,.16,oak)
   line('Long reed leaf',[(xx,zz,.30),(xx-.14,zz,.55),(xx-.21,zz,.49)],.017,lightleaf)
 def opened():
  for step in steps:
   z0,z1=step['z']-step['d']/2,step['z']+step['d']/2
   for i in range(max(1,math.ceil(step['d']/.09))):
    zz=z0+(i+.5)*step['d']/max(1,math.ceil(step['d']/.09));rod('Woven reed deck slat',(x-step['w']/2,zz,step['height']-.04),(x+step['w']/2,zz,step['height']-.04),.043,reedmat)
   for sign in [-1,1]:rod('Reed deck bound edge',(x+sign*step['w']/2,z0,step['height']-.04),(x+sign*step['w']/2,z1,step['height']-.04),.044,wood)
  # Rails and knot uprights stay beyond the actual walkable width.
  for sign in [-1,1]:
   xx=x+sign*.85
   for zz in [-2.72,-1.65,-.55,.55,1.55]:
    line('Bridge woven upright',[(xx,zz,.35),(xx+sign*.04,zz,1.3),(xx,zz,1.48)],.055,wood)
    for j in range(3):line('Reed lash knot',[(xx-.07,zz-.035,1.18+j*.035),(xx+.07,zz-.035,1.18+j*.035),(xx+.07,zz+.035,1.18+j*.035)],.015,reedmat)
   for h in [1.08,1.43]:line('Living reed balustrade',[(xx,-2.9+i*4.8/40,h-.11*math.sin(i*math.pi/10)**2) for i in range(41)],.04,reedmat)
   for j in range(4):leaf_spray(xx,-2.6+j*1.15,1.49,.65)
 state_group('reedBridge','shut',shut);state_group('reedBridge','open',opened)
 return (x,0,.4),9,'opening-reed-bridge'

def towerVines():
 q=cfg['oldTower']['plan']['vines'];x,z=q['x'],q['z']
 # Stone jambs match the fixed pillar collision, with a copper pointed arch overhead.
 for sign in [-1,1]:
  cylinder('Observatory portal stone jamb',x,z+sign*1.58,.14,.15,2.35,stone,12)
  cylinder('Observatory portal capital',x,z+sign*1.58,2.30,.22,.17,stone,12)
 line('Pointed copper window arch',[(x,z-1.58,2.36),(x,z-1.48,2.70),(x,z-.9,3.13),(x,z,3.7),(x,z+.9,3.13),(x,z+1.48,2.70),(x,z+1.58,2.36)],.095,brass)
 def shut():
  for j in range(11):
   zz=z-1.34+j*.268;h=2.6+.60*(1-abs(zz)/1.4)
   pts=[(x+.08*math.sin(k+j),zz+.08*math.sin(k*.8+j),.18+k*h/14) for k in range(15)]
   line('Dense sleeping vine',pts,.038,wood)
   for k in range(1,14):leaf_spray(*pts[k],.85)
  for k in range(4):line('Vines crossing doorway',[(x-.05,z-1.4,.65+k*.55),(x-.09,z,1.0+k*.5),(x-.05,z+1.4,.55+k*.6)],.045,wood)
 def opened():
  for sign in [-1,1]:
   points=[(x+.12*math.sin(i),z+sign*(1.45-.05*math.sin(i)),.16+i*.18) for i in range(15)]
   line('Waking vine at jamb',points,.045,wood)
   for i in range(2,15,2):leaf_spray(*points[i],.85)
  for j in range(13):
   zz=z-1.25+j*2.5/12;h=2.65+.75*(1-abs(zz)/1.4);leaf_spray(x,zz,h,.8)
   if j%3==0:sphere('Vine pale flower',x-.12,zz,h+.1,.085,.085,.06,petal)
 state_group('towerVines','shut',shut);state_group('towerVines','open',opened)
 return (x,0,1.3),7.5,'opening-tower-vines'

def render(key,target,scale,filename):
 sc=bpy.context.scene;world=bpy.data.worlds.new('Opening soft daylight');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.73,.68,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65;sc.world=world
 bpy.ops.object.light_add(type='SUN');sun=bpy.context.object;sun.data.energy=1.7;sun.data.angle=.3;sun.rotation_euler=(.45,-.5,-.4)
 bpy.ops.object.camera_add(location=xyz(target[0]+8,target[1]+10,target[2]+8));cam=bpy.context.object;cam.rotation_euler=(Vector(xyz(*target))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=scale;sc.camera=cam
 sc.render.engine='CYCLES';sc.cycles.samples=20;sc.cycles.use_denoising=True;sc.render.resolution_x=1200;sc.render.resolution_y=1000;sc.render.resolution_percentage=100
 # Save both alternatives visible. Runtime chooses one after loading; previews toggle only after this save.
 bpy.ops.wm.save_as_mainfile(filepath=str(out/(filename+'.blend')))
 box('Preview backdrop',target[0],target[1],.02,16,16,.09,water if key=='reedBridge' else earth)
 for side in ['shut','open']:
  for o in bpy.data.objects:
   tag=o.get('export_group','');o.hide_render=bool(tag and tag.startswith(('shut:','open:')) and not tag.startswith(side+':'))
  sc.render.filepath=str(out/(key+'-'+side+'.png'));bpy.ops.render.render(write_still=True)
 print('OPENING_READY',key,flush=True)
for key in targets:
 for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
 random.seed(91796);target,scale,filename=globals()[key]();render(key,target,scale,filename)
